#!/usr/bin/env node
/**
 * Dockerfile policy checker (Task 97).
 *
 * A convention that lives in a document decays; a convention that lives in a
 * test does not. Every `*Dockerfile*` in the repository is parsed here as text
 * — no Docker daemon, no network — and every rule below fails the build with a
 * named violation. The rules encode the platform's container contract:
 * multi-stage, digest-or-ARG base images, a numeric non-root USER in the final
 * stage, distroless everywhere except the scan runner (which carries pinned,
 * checksum-verified tools instead), and nothing secret-shaped, privileged or
 * piped-from-the-internet anywhere.
 *
 * Usage:
 *   node scripts/verify-dockerfiles.mjs          → repo-wide, prints OK/FAIL
 *   import { checkDockerfile } from this module  → unit tests (node --test)
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_NAME = 'verify-dockerfiles';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIPPED_DIRS = new Set(['node_modules', '.next', 'dist', 'coverage', '.turbo', '.git']);

/** An ARG/ENV name that must never appear: secrets are runtime concerns. */
const SECRET_NAME = /KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL/i;

/**
 * Join line continuations and drop comments, so the rules scan instructions
 * only. The `# syntax=` directive is checked on the raw text BEFORE stripping.
 */
function instructionsOf(text) {
  const withoutComments = text
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
  return withoutComments
    .replace(/\\\r?\n\s*/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

/**
 * Every `FROM` reference in order, with `--platform=…` flags skipped. A
 * reference to a PREVIOUSLY DECLARED stage alias (`FROM base AS build`) is
 * returned as null — it names a local stage, not an external image.
 */
function fromReferences(instructions) {
  const refs = [];
  const aliases = new Set();
  for (const instruction of instructions) {
    const match = /^FROM\s+(?:--\S+\s+)*(\S+)(?:\s+[Aa][Ss]\s+(\S+))?/i.exec(instruction);
    if (match === null) continue;
    const [, reference, alias] = match;
    if (!aliases.has(reference.toLowerCase())) refs.push(reference);
    if (alias !== undefined) aliases.add(alias.toLowerCase());
  }
  return refs;
}

/** The instructions belonging to the final build stage. */
function finalStageInstructions(instructions) {
  let lastFrom = -1;
  instructions.forEach((instruction, index) => {
    if (/^FROM\s/i.test(instruction)) lastFrom = index;
  });
  return lastFrom === -1 ? [] : instructions.slice(lastFrom + 1);
}

function isRunnerFile(relativePath) {
  return /dockerfile\.runner$/i.test(relativePath);
}

/**
 * Check one Dockerfile's text. Returns a (possibly empty) list of violations,
 * each a human-readable `<rule>: <detail>` string. Pure — the repo walk and
 * the exit code live outside.
 */
export function checkDockerfile(relativePath, text) {
  const violations = [];
  const instructions = instructionsOf(text);
  const froms = fromReferences(instructions);
  const finalStage = finalStageInstructions(instructions);
  const runner = isRunnerFile(relativePath);

  // 1 — BuildKit syntax directive.
  const firstLine = text.split('\n').find((line) => line.trim() !== '') ?? '';
  if (!/^\s*#\s*syntax=/.test(firstLine)) {
    violations.push('syntax: missing the leading `# syntax=` directive');
  }

  // 2 — Multi-stage.
  if (froms.length < 2) {
    violations.push(`stages: expected >= 2 FROM stages, found ${froms.length}`);
  }

  // 3 — Numeric non-root USER in the final stage.
  const userLine = finalStage.find((instruction) => /^USER\s/i.test(instruction));
  if (userLine === undefined) {
    violations.push('user: the final stage declares no USER');
  } else {
    const uid = /^USER\s+(\d+)/i.exec(userLine)?.[1];
    if (uid === undefined) {
      violations.push(`user: USER must be numeric, got "${userLine}"`);
    } else if (uid === '0') {
      violations.push('user: the final stage runs as root (uid 0)');
    }
  }

  // 4 — No floating `latest`.
  if (instructions.some((instruction) => instruction.includes(':latest'))) {
    violations.push('latest: image references must be pinned, `:latest` is banned');
  }

  // 5 — Every FROM carries a tag, a digest, or is a build ARG.
  for (const reference of froms) {
    const pinned =
      reference.includes('@sha256:') || reference.includes(':') || reference.startsWith('${');
    if (!pinned) {
      violations.push(`from: "${reference}" has no tag, digest or ARG`);
    }
  }

  // 6 — No remote ADD (no checksum, no TLS story).
  if (instructions.some((instruction) => /^ADD\s+https?:\/\//i.test(instruction))) {
    violations.push('add: `ADD http(s)://…` is banned — download in a stage and verify');
  }

  // 7 — No piping a remote script into a shell.
  if (/(curl|wget)[^|\n]*\|\s*(sudo\s+)?(ba|z|da)?sh\b/.test(text)) {
    violations.push('pipe-to-shell: `curl|sh` / `wget|sh` is banned');
  }

  // 8 — No secret-shaped ENV/ARG names.
  for (const instruction of instructions) {
    const envMatch = /^ENV\s+(\S+)/i.exec(instruction);
    const argMatch = /^ARG\s+(\S+)/i.exec(instruction);
    const name = (envMatch?.[1] ?? argMatch?.[1] ?? '').split('=')[0];
    if (name !== '' && SECRET_NAME.test(name)) {
      violations.push(`secret-name: ENV/ARG "${name}" looks like a secret`);
    }
  }

  // 9 — No privilege escalation or world-writable permissions.
  const bannedPatterns = [
    [/--privileged\b/, 'privileged: `--privileged` is banned'],
    [/\bsetcap\b/, 'capabilities: `setcap` is banned'],
    [/chmod\s+777\b/, 'permissions: `chmod 777` is banned'],
    [/chmod\s+\+s\b/, 'permissions: `chmod +s` (setuid) is banned'],
    [/\bsudo\b/, 'sudo: `sudo` is banned'],
  ];
  for (const [pattern, message] of bannedPatterns) {
    if (instructions.some((instruction) => pattern.test(instruction))) {
      violations.push(message);
    }
  }

  // 10/11 — Distroless final stage; the runner is the one documented exception
  // and must verify every download with sha256sum instead.
  if (runner) {
    if (!text.includes('sha256sum -c')) {
      violations.push('runner: downloads must be verified with `sha256sum -c`');
    }
  } else {
    const finalFrom = froms.at(-1) ?? '';
    if (!/distroless/i.test(finalFrom) && !finalFrom.includes('${DISTROLESS_IMAGE}')) {
      violations.push(`distroless: the final stage must be distroless, got "${finalFrom}"`);
    }
  }

  return violations;
}

/** @returns {Promise<string[]>} repo-relative paths of every Dockerfile */
async function findDockerfiles(dir) {
  const found = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIPPED_DIRS.has(entry.name)) continue;
      found.push(...(await findDockerfiles(full)));
    } else if (/^dockerfile/i.test(entry.name) || /\.dockerfile$/i.test(entry.name)) {
      // Names that merely CONTAIN the word (the checker scripts, the manual
      // verification checklist) are not build recipes.
      found.push(full);
    }
  }
  return found;
}

/** Check the whole repository. @returns {Promise<Map<string, string[]>>} */
export async function checkRepo(root = REPO_ROOT) {
  const results = new Map();
  for (const file of (await findDockerfiles(root)).sort()) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    const text = await readFile(file, 'utf8');
    results.set(relative, checkDockerfile(relative, text));
  }
  return results;
}

const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const results = await checkRepo();
  let failed = 0;
  for (const [file, violations] of results) {
    for (const violation of violations) {
      console.error(`FAIL: ${SCRIPT_NAME}: ${file}: ${violation}`);
      failed += 1;
    }
  }
  if (results.size === 0) {
    console.error(`FAIL: ${SCRIPT_NAME}: no Dockerfiles found — the walk is broken`);
    process.exit(1);
  }
  if (failed > 0) {
    process.exit(1);
  }
  console.log(`OK: ${SCRIPT_NAME}`);
}

#!/usr/bin/env node
/**
 * Workflow policy checker (Task 101).
 *
 * GitHub Actions is the one place the repo executes third-party code with
 * repository credentials in scope, so its policy is enforced statically, in
 * CI, on every change — the same principle as the other verify-* scripts: a
 * convention in a document decays, a convention in a test does not.
 *
 * Rules (each reports file:line):
 *  1. every workflow declares top-level `permissions:`;
 *  2. every job declares `timeout-minutes:`;
 *  3. `pull_request_target` appears nowhere (it hands forks a privileged
 *     context — the classic pwn-request vector);
 *  4. no `${{ github.event.* }}` inside a `run:` script (injection); event
 *     data must travel through `env:`;
 *  5. no `echo` of a secret expression;
 *  6. no `curl|wget … | sh|bash`;
 *  7. third-party `uses:` pins a version tag or a full SHA — never a branch
 *     (`@main`, `@master`);
 *  8. `actions/checkout` sets `persist-credentials: false` (deploy jobs that
 *     genuinely need the credential are named in RELEASE_JOBS);
 *  9. every third-party action used appears in docs/ci.md's allow-list.
 *
 * Usage:
 *   node scripts/verify-workflows.mjs         → repo-wide OK/FAIL
 *   import { checkWorkflow } …                → tests
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_NAME = 'verify-workflows';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Jobs allowed to keep git credentials (they push tags/images). */
export const RELEASE_JOBS = new Set(['release', 'deploy', 'publish']);

/**
 * Jobs that touch a live environment must name it: the `environment:` key is
 * what attaches the reviewer gate, the URL and the scoped secrets. (Image
 * BUILDS are environment-agnostic — digests are digests — so `release`/
 * `images` jobs are deliberately absent from this rule; deploy.yml gates
 * every job that actually touches a cluster, a zone or a database.)
 */
const ENVIRONMENT_REQUIRED = /^(deploy|rollback|migrate|smoke)/;

/** First-party or repo-local references that are not third-party actions. */
function isLocalUse(ref) {
  return ref.startsWith('./') || ref.startsWith('docker://');
}

/** actions/checkout@v4 → owner/name. A branch ref is anything not vX…/40-hex. */
function parseUses(ref) {
  const atIndex = ref.lastIndexOf('@');
  if (atIndex === -1) return null;
  return { name: ref.slice(0, atIndex), pin: ref.slice(atIndex + 1) };
}

function isSafePin(pin) {
  return /^v?\d+(\.\d+)*([.-][0-9A-Za-z.-]+)?$/.test(pin) || /^[0-9a-f]{40}$/i.test(pin);
}

/**
 * Check one workflow's text.
 * @returns {string[]} violations, each `<line>: <rule>: <detail>`
 */
export function checkWorkflow(relativePath, text) {
  const violations = [];
  const lines = text.split('\n');
  const fileName = path.basename(relativePath);

  const at = (index) => `${fileName}:${index + 1}`;

  // 1 — top-level permissions.
  if (!/^permissions:/m.test(text)) {
    violations.push(`${at(0)}: permissions: workflow declares no top-level permissions block`);
  }

  // 3 — pull_request_target anywhere.
  lines.forEach((line, index) => {
    if (/^\s*pull_request_target\s*:/m.test(line)) {
      violations.push(`${at(index)}: trigger: pull_request_target is banned (pwn-request vector)`);
    }
  });

  // Walk the file tracking jobs, run-blocks and uses-blocks.
  let inJobs = false;
  let currentJob = null;
  let jobHasTimeout = false;
  let jobHasEnvironment = false;
  let jobIsReusableCall = false;
  let pendingEnvironmentCheck = null;
  let runBlockIndent = -1; // >=0 while inside a run: block script
  let usesPending = null; // action ref awaiting its `with:` block (checkout rule)
  let checkoutHasPersistFalse = false;
  let checkoutIndent = -1;

  const closeJob = () => {
    // A job that only `uses:` a reusable workflow cannot declare
    // timeout-minutes — the called workflow's own jobs carry theirs.
    if (currentJob !== null && !jobHasTimeout && !jobIsReusableCall) {
      violations.push(`${fileName}: timeout: job "${currentJob}" declares no timeout-minutes`);
    }
    if (pendingEnvironmentCheck !== null && !jobHasEnvironment && !jobIsReusableCall) {
      violations.push(
        `${fileName}: environment: job "${pendingEnvironmentCheck}" touches a live environment but declares no environment: (reviewer gate missing)`,
      );
    }
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.replace(/\s+$/, '');
    const trimmed = line.trim();
    const indent = line.length - line.trimStart().length;

    if (/^jobs:\s*$/.test(line)) {
      inJobs = true;
      return;
    }
    if (inJobs && indent === 0 && trimmed !== '' && !trimmed.startsWith('#')) {
      // Left the jobs section.
      closeJob();
      inJobs = false;
      currentJob = null;
    }
    if (inJobs && indent === 2 && /^[A-Za-z0-9_-]+:\s*$/.test(trimmed)) {
      closeJob();
      currentJob = trimmed.slice(0, -1);
      jobHasTimeout = false;
      jobHasEnvironment = false;
      jobIsReusableCall = false;
      // Decided at closeJob: a job may declare `environment:` anywhere in its
      // body, and a reusable call inherits the caller's gate.
      pendingEnvironmentCheck = ENVIRONMENT_REQUIRED.test(currentJob) ? currentJob : null;
      return;
    }
    if (currentJob !== null && /^timeout-minutes:\s*\d+/.test(trimmed)) {
      jobHasTimeout = true;
    }
    if (currentJob !== null && indent === 4 && /^uses:\s*\S/.test(trimmed)) {
      jobIsReusableCall = true;
    }
    if (currentJob !== null && /^environment:\s*\S/.test(trimmed)) {
      jobHasEnvironment = true;
    }

    // 4 — event interpolation inside run scripts. Step keys may carry the
    // YAML list dash (`- run: |`), so normalise before matching.
    const stepKey = trimmed.replace(/^-\s+/, '');
    if (/^run:\s*[|>][-+]?\s*$/.test(stepKey)) {
      runBlockIndent = indent;
    } else if (/^run:\s*\S/.test(stepKey)) {
      if (/\$\{\{\s*github\.event\./.test(stepKey)) {
        violations.push(
          `${at(index)}: injection: github.event interpolated directly into run: — pass it through env:`,
        );
      }
    } else if (runBlockIndent >= 0) {
      if (trimmed === '' || indent > runBlockIndent) {
        if (/\$\{\{\s*github\.event\./.test(line)) {
          violations.push(
            `${at(index)}: injection: github.event interpolated inside a run: block — pass it through env:`,
          );
        }
      } else {
        runBlockIndent = -1;
      }
    }

    // 5 — echoed secrets.
    if (/echo\s+.*\$\{\{\s*secrets\./.test(line)) {
      violations.push(`${at(index)}: secret-leak: a secret expression is echoed`);
    }

    // 6 — pipe-to-shell downloads.
    if (/(curl|wget)[^|\n]*\|\s*(sudo\s+)?(ba|z|da)?sh\b/.test(line) && !/^\s*#/.test(line)) {
      violations.push(`${at(index)}: pipe-to-shell: curl/wget piped into a shell`);
    }

    // 7/9 — third-party action pins.
    const usesMatch = /^-?\s*uses:\s*(\S+)\s*$/.exec(trimmed);
    if (usesMatch !== null) {
      const ref = usesMatch[1].replace(/^["']|["']$/g, '');
      if (!isLocalUse(ref)) {
        const parsed = parseUses(ref);
        if (parsed === null || !isSafePin(parsed.pin)) {
          violations.push(
            `${at(index)}: pin: "${ref}" must pin a version tag or a full SHA, never a branch`,
          );
        }
      }
      // Track checkout blocks for rule 8.
      if (ref.startsWith('actions/checkout@')) {
        usesPending = ref;
        checkoutHasPersistFalse = false;
        checkoutIndent = indent;
      } else {
        usesPending = null;
      }
    } else if (
      usesPending !== null &&
      trimmed !== '' &&
      indent <= checkoutIndent &&
      !/^with:/.test(trimmed)
    ) {
      // The checkout step ended.
      const jobIsRelease = currentJob !== null && RELEASE_JOBS.has(currentJob);
      if (!checkoutHasPersistFalse && !jobIsRelease) {
        violations.push(
          `${fileName}: checkout: "${usesPending}" must set persist-credentials: false (job "${currentJob}")`,
        );
      }
      usesPending = null;
    }
    if (usesPending !== null && /persist-credentials:\s*false/.test(trimmed)) {
      checkoutHasPersistFalse = true;
    }
  });
  closeJob();

  // A checkout as the LAST step: flush the pending check.
  if (usesPending !== null) {
    const jobIsRelease = currentJob !== null && RELEASE_JOBS.has(currentJob);
    if (!checkoutHasPersistFalse && !jobIsRelease) {
      violations.push(
        `${fileName}: checkout: "${usesPending}" must set persist-credentials: false`,
      );
    }
  }

  return violations;
}

/** The third-party actions docs/ci.md must allow-list (rule 9). */
export function collectThirdPartyActions(texts) {
  const used = new Set();
  for (const text of texts.values()) {
    for (const match of text.matchAll(/uses:\s*(\S+)/g)) {
      const ref = match[1].replace(/^["']|["']$/g, '');
      if (isLocalUse(ref)) continue;
      const parsed = parseUses(ref);
      if (parsed !== null) used.add(parsed.name);
    }
  }
  return used;
}

export async function checkRepo(root = REPO_ROOT) {
  const workflowsDir = path.join(root, '.github/workflows');
  const violations = [];
  const texts = new Map();

  let entries;
  try {
    entries = await readdir(workflowsDir);
  } catch {
    return ['no .github/workflows directory — nothing to check'];
  }
  for (const entry of entries.sort()) {
    if (!/\.ya?ml$/.test(entry)) continue;
    const relative = `.github/workflows/${entry}`;
    const text = await readFile(path.join(workflowsDir, entry), 'utf8');
    texts.set(relative, text);
    for (const violation of checkWorkflow(relative, text)) {
      violations.push(violation);
    }
  }

  // Rule 9 — the allow-list in docs/ci.md.
  try {
    const doc = await readFile(path.join(root, 'docs/ci.md'), 'utf8');
    for (const action of collectThirdPartyActions(texts)) {
      // A documented parent covers its sub-actions (`github/codeql-action`
      // documents `github/codeql-action/init`).
      const parent = action.split('/').slice(0, 2).join('/');
      if (!doc.includes(action) && !doc.includes(parent)) {
        violations.push(`docs/ci.md: allow-list: third-party action "${action}" is not documented`);
      }
    }
  } catch {
    violations.push('docs/ci.md: missing — the action allow-list has no home');
  }

  return violations;
}

const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const violations = await checkRepo();
  if (violations.length > 0) {
    for (const violation of violations) console.error(`FAIL: ${SCRIPT_NAME}: ${violation}`);
    process.exit(1);
  }
  console.log(`OK: ${SCRIPT_NAME}`);
}

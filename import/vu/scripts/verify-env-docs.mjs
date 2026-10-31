#!/usr/bin/env node
/**
 * Environment-documentation drift gate (Task 103).
 *
 * The runbook is only useful if it is TRUE. This script parses the Zod env
 * schemas — the code's own declaration of what it reads — and fails in either
 * direction of drift:
 *
 *   code → docs:  a schema variable missing from docs/env-reference.md or
 *                 from every .env.example is undocumented;
 *   docs → code:  a NAME= entry in an .env.example that no schema declares is
 *                 stale (or a typo an operator will paste and wonder about).
 *
 * Deliberately regex-based, not TS-parsing: the schemas all follow the
 * `NAME: z.…` shape the repo convention mandates, and a checker that needs a
 * compiler is a checker CI runs last instead of first.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_NAME = 'verify-env-docs';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Schema files, keyed by the app whose environment they describe. */
export const ENV_SOURCES = {
  api: 'apps/api/src/config/env.ts',
  web: 'apps/web/src/env.ts',
  'broadcast-worker': 'apps/broadcast-worker/src/config/env.ts',
  'notify-worker': 'apps/notify-worker/src/config/env.ts',
  'maintenance-worker': 'apps/maintenance-worker/src/config/env.ts',
  'scan-worker': 'apps/scan-worker/src/config/env.ts',
};

/**
 * Names an .env.example may carry that no runtime schema declares: migration
 * tooling and local-development conveniences. Each entry needs a reason —
 * this list is reviewed, not discovered.
 */
export const NON_SCHEMA_OK = new Set([
  'DIRECT_URL', // packages/db migrate — DDL over the direct (non-pooler) connection
  'NEXT_PUBLIC_SUPABASE_URL', // web auth-js client config (Task 41), not in env.ts's PublicEnvSchema
  'NEXT_PUBLIC_SUPABASE_ANON_KEY', // ditto
  'NODE_LABEL', // audit/service.ts reads it from an INJECTED env source, not process.env
  'INCIDENT_COMMANDER_ID', // Task 38's escalation target — wired through route options at composition time
]);

/** Drop comments so prose examples (`process.env.NEXT_PUBLIC_X`) never count. */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
}

/** Extract `NAME: z.…` field names from a schema file's text. */
export function extractSchemaNames(rawText) {
  const text = stripComments(rawText);
  const names = new Set();
  for (const match of text.matchAll(/^\s{2,}([A-Z][A-Z0-9_]{2,}):\s*(?:z\.|process\.env)/gm)) {
    names.add(match[1]);
  }
  // web's env.ts assembles the public object from `process.env.NEXT_PUBLIC_*`
  // references rather than a single z.object.
  for (const match of text.matchAll(/process\.env\.(NEXT_PUBLIC_[A-Z0-9_]+)/g)) {
    names.add(match[1]);
  }
  return [...names];
}

/** Extract `NAME=` / `# NAME=` entries from an .env.example file. */
export function extractExampleNames(text) {
  const names = new Set();
  for (const match of text.matchAll(/^\s*#?\s*([A-Z][A-Z0-9_]{2,})\s*=/gm)) {
    names.add(match[1]);
  }
  return [...names];
}

/** Every `process.env.NAME` reference under an app's src — code that reads
 * the environment outside its Zod schema (k8s config, inbox addresses…). */
export async function extractProcessEnvNames(root, appDir) {
  const names = new Set();
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        await walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name) || entry.name.endsWith('.test.ts')) continue;
      const text = await readFile(full, 'utf8');
      for (const match of text.matchAll(/process\.env\.([A-Z][A-Z0-9_]{2,})/g)) {
        names.add(match[1]);
      }
    }
  }
  await walk(path.join(root, appDir, 'src'));
  return names;
}

/** The API's Vault secret names (SECRET_NAMES in lib/secrets/provider.ts). */
export async function extractSecretNames(root) {
  const text = await readFile(path.join(root, 'apps/api/src/lib/secrets/provider.ts'), 'utf8');
  const block = /SECRET_NAMES = \[([\s\S]*?)\]/.exec(text);
  if (block === null) return [];
  return [...block[1].matchAll(/'([A-Z][A-Z0-9_]+)'/g)].map((match) => match[1]);
}

async function findEnvExamples(dir, found = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await findEnvExamples(full, found);
    else if (entry.name === '.env.example') found.push(full);
  }
  return found;
}

/**
 * The whole check. Pure over inputs so tests can drive it with strings.
 * @returns {string[]} violations
 */
export function checkEnvDocs({ schemaNames, envReference, exampleEntries, declared }) {
  const violations = [];
  const documented = new Set();

  // code → env-reference.md
  for (const [app, names] of Object.entries(schemaNames)) {
    for (const name of names) {
      if (!envReference.includes(name)) {
        violations.push(
          `env-reference: ${app}: ${name} is not documented in docs/env-reference.md`,
        );
      }
      documented.add(name);
    }
  }

  // code → some .env.example
  const allExampleNames = new Set();
  for (const names of exampleEntries.values()) {
    for (const name of names) allExampleNames.add(name);
  }
  for (const name of documented) {
    if (!allExampleNames.has(name)) {
      violations.push(`env-example: ${name} is in a schema but in no .env.example`);
    }
  }

  // .env.example → code (stale entries). `declared` covers schemas, direct
  // process.env reads and the Vault SECRET_NAMES list.
  const declaredSet = declared ?? documented;
  for (const [file, names] of exampleEntries) {
    for (const name of names) {
      if (declaredSet.has(name) || NON_SCHEMA_OK.has(name)) continue;
      violations.push(
        `env-example: ${file}: ${name} is listed but nothing in code declares it (stale?)`,
      );
    }
  }

  return violations;
}

export async function checkRepo(root = REPO_ROOT) {
  const schemaNames = {};
  for (const [app, relative] of Object.entries(ENV_SOURCES)) {
    const text = await readFile(path.join(root, relative), 'utf8');
    schemaNames[app] = extractSchemaNames(text);
  }
  // "Declared in code" is wider than the schemas: direct process.env reads
  // (k8s config, inboxes) and the API's Vault SECRET_NAMES are legitimate
  // .env.example entries even though no Zod field names them.
  const declared = new Set();
  for (const names of Object.values(schemaNames)) {
    for (const name of names) declared.add(name);
  }
  for (const app of Object.keys(ENV_SOURCES)) {
    for (const name of await extractProcessEnvNames(root, `apps/${app}`)) declared.add(name);
  }
  for (const name of await extractSecretNames(root)) declared.add(name);

  const envReference = await readFile(path.join(root, 'docs/env-reference.md'), 'utf8');
  const exampleEntries = new Map();
  for (const file of await findEnvExamples(root)) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    exampleEntries.set(relative, extractExampleNames(await readFile(file, 'utf8')));
  }
  return checkEnvDocs({ schemaNames, envReference, exampleEntries, declared });
}

/** Report mode: print the extracted inventory (documentation helper). */
export async function printInventory(root = REPO_ROOT) {
  for (const [app, relative] of Object.entries(ENV_SOURCES)) {
    const text = await readFile(path.join(root, relative), 'utf8');
    console.log(`## ${app} (${relative})`);
    for (const name of extractSchemaNames(text).sort()) console.log(`  ${name}`);
  }
}

const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  if (process.argv.includes('--inventory')) {
    await printInventory();
    process.exit(0);
  }
  const violations = await checkRepo();
  if (violations.length > 0) {
    for (const violation of violations) console.error(`FAIL: ${SCRIPT_NAME}: ${violation}`);
    process.exit(1);
  }
  console.log(`OK: ${SCRIPT_NAME}`);
}

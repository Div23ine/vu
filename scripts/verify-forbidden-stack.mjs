import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Stack guard: VUNVAULT runs on Fastify 5 + Drizzle + Zod, and CI lives in
 * GitHub Actions only. Forbidden dependencies must not appear in any
 * `package.json`, and forbidden CI systems must not exist at the repo root.
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IGNORED_DIRS = new Set(['node_modules', '.next', 'dist', 'coverage', '.turbo', '.git']);
const FORBIDDEN_PACKAGES = new Set(['express', 'prisma', '@prisma/client', 'joi', '@hapi/joi']);
const FORBIDDEN_CI = ['Jenkinsfile', '.gitlab-ci.yml', '.circleci'];
const DEPENDENCY_BLOCKS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

function findPackageJsonFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    if (IGNORED_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      found.push(...findPackageJsonFiles(full));
    } else if (entry === 'package.json') {
      found.push(full);
    }
  }
  return found;
}

/** Collect offending "path: package" entries; exported so tests can retarget. */
export function findForbiddenDependencies(root = ROOT) {
  const offenders = [];
  for (const file of findPackageJsonFiles(root)) {
    const pkg = JSON.parse(readFileSync(file, 'utf8'));
    for (const block of DEPENDENCY_BLOCKS) {
      const deps = pkg[block];
      if (deps && typeof deps === 'object') {
        for (const name of Object.keys(deps)) {
          if (FORBIDDEN_PACKAGES.has(name)) {
            offenders.push(`${path.relative(root, file)}: ${name}`);
          }
        }
      }
    }
  }
  return offenders;
}

/** Collect forbidden CI artifacts at the repo root. */
export function findForbiddenCi(root = ROOT) {
  return FORBIDDEN_CI.filter((entry) => existsSync(path.join(root, entry)));
}

/** Run the guard; returns true on success. Exported for the guard test. */
export function run() {
  const offenders = [
    ...findForbiddenDependencies(),
    ...findForbiddenCi().map((entry) => `${entry} (repo root)`),
  ];
  if (offenders.length > 0) {
    console.error('FAIL: verify-forbidden-stack');
    for (const offender of offenders) console.error(offender);
    return false;
  }
  console.log('OK: verify-forbidden-stack');
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(run() ? 0 : 1);
}

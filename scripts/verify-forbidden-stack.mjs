// @ts-check
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SCRIPT_NAME = 'verify-forbidden-stack';
const FORBIDDEN_PACKAGES = ['express', 'prisma', '@prisma/client', 'joi', '@hapi/joi'];
const FORBIDDEN_CI_FILES = ['Jenkinsfile', '.gitlab-ci.yml', '.circleci'];
const IGNORED_DIRS = new Set(['node_modules', '.next', 'dist', 'coverage', '.turbo']);

/** @param {string} dir @returns {string[]} */
function findPackageJsons(dir) {
  /** @type {string[]} */
  const results = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (entry === 'package.json') {
      results.push(fullPath);
    } else if (!entry.startsWith('.') && !IGNORED_DIRS.has(entry)) {
      try {
        if (readdirSync(fullPath).includes('package.json')) {
          results.push(join(fullPath, 'package.json'));
        }
      } catch {
        // not a directory
      }
    }
  }
  return results;
}

/** @type {string[]} */
const offenders = [];

for (const pkgPath of findPackageJsons('.')) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(pkgPath, 'utf8'));
  } catch {
    continue;
  }
  for (const block of [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ]) {
    const deps = parsed[block];
    if (deps && typeof deps === 'object') {
      for (const name of Object.keys(deps)) {
        if (FORBIDDEN_PACKAGES.includes(name)) {
          offenders.push(`${pkgPath}: ${name}`);
        }
      }
    }
  }
}

for (const ciFile of FORBIDDEN_CI_FILES) {
  if (existsSync(ciFile)) {
    offenders.push(ciFile);
  }
}

if (offenders.length > 0) {
  console.log(`FAIL: ${SCRIPT_NAME}`);
  for (const offender of offenders) {
    console.log(offender);
  }
  process.exit(1);
}
console.log(`OK: ${SCRIPT_NAME}`);

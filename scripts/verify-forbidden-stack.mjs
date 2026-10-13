#!/usr/bin/env node
/**
 * Stack guard: VUNVAULT is Fastify 5 + Drizzle + Zod on GitHub-based CI.
 * This script fails if a forbidden dependency is declared anywhere, or if a
 * foreign CI system's configuration file is committed at the repo root.
 */
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const SCRIPT_NAME = 'verify-forbidden-stack';
const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const SKIPPED_DIRS = new Set(['node_modules', '.next', 'dist', 'coverage', '.turbo', '.git']);
const FORBIDDEN_PACKAGES = new Set(['express', 'prisma', '@prisma/client', 'joi', '@hapi/joi']);
const DEPENDENCY_BLOCKS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];
const FORBIDDEN_CI_PATHS = ['Jenkinsfile', '.gitlab-ci.yml', '.circleci'];

/** @returns {Promise<string[]>} absolute paths of every package.json in the repo */
async function findPackageJsonFiles(dir) {
  const found = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIPPED_DIRS.has(entry.name)) continue;
      found.push(...(await findPackageJsonFiles(full)));
    } else if (entry.name === 'package.json') {
      found.push(full);
    }
  }
  return found;
}

const offenders = [];

for (const file of await findPackageJsonFiles(REPO_ROOT)) {
  const manifest = JSON.parse(await readFile(file, 'utf8'));
  for (const block of DEPENDENCY_BLOCKS) {
    const declared = manifest[block];
    if (!declared || typeof declared !== 'object') continue;
    for (const dependency of Object.keys(declared)) {
      if (FORBIDDEN_PACKAGES.has(dependency)) {
        offenders.push(`${path.relative(REPO_ROOT, file)} → ${block}.${dependency}`);
      }
    }
  }
}

for (const ciPath of FORBIDDEN_CI_PATHS) {
  if (existsSync(path.join(REPO_ROOT, ciPath))) {
    offenders.push(`${ciPath} → foreign CI system`);
  }
}

if (offenders.length > 0) {
  console.error(`FAIL: ${SCRIPT_NAME}`);
  for (const offender of offenders) {
    console.error(offender);
  }
  process.exit(1);
}

console.log(`OK: ${SCRIPT_NAME}`);

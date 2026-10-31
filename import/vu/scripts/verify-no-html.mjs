#!/usr/bin/env node
/**
 * Stack guard: VUNVAULT ships no hand-written HTML. Every surface is rendered by
 * Next.js (App Router) or by Fastify JSON responses. This script fails the build
 * if any *.html / *.htm file appears in the repository.
 */
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const SCRIPT_NAME = 'verify-no-html';
const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const SKIPPED_DIRS = new Set(['node_modules', '.next', 'dist', 'coverage', '.turbo', '.git']);
const HTML_EXTENSIONS = new Set(['.html', '.htm']);

/** @returns {Promise<string[]>} absolute paths of every HTML file in the repo */
async function findHtmlFiles(dir) {
  const found = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIPPED_DIRS.has(entry.name)) continue;
      found.push(...(await findHtmlFiles(full)));
    } else if (entry.isFile() && HTML_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      found.push(full);
    }
  }
  return found;
}

const offenders = await findHtmlFiles(REPO_ROOT);

if (offenders.length > 0) {
  console.error(`FAIL: ${SCRIPT_NAME}`);
  for (const offender of offenders) {
    console.error(path.relative(REPO_ROOT, offender));
  }
  process.exit(1);
}

console.log(`OK: ${SCRIPT_NAME}`);

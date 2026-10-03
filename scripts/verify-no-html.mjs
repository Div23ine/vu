// @ts-check
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SCRIPT_NAME = 'verify-no-html';
const IGNORED_DIRS = new Set(['node_modules', '.next', 'dist', 'coverage', '.turbo']);
const FORBIDDEN_EXTENSIONS = ['.html', '.htm'];

/** @param {string} dir @returns {string[]} */
function findHtmlFiles(dir) {
  /** @type {string[]} */
  const found = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (!IGNORED_DIRS.has(entry)) {
        found.push(...findHtmlFiles(fullPath));
      }
    } else if (FORBIDDEN_EXTENSIONS.some((ext) => entry.toLowerCase().endsWith(ext))) {
      found.push(fullPath);
    }
  }
  return found;
}

const offenders = findHtmlFiles('.');
if (offenders.length > 0) {
  console.log(`FAIL: ${SCRIPT_NAME}`);
  for (const file of offenders) {
    console.log(file);
  }
  process.exit(1);
}
console.log(`OK: ${SCRIPT_NAME}`);

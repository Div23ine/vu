import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Stack guard: the VUNVAULT web surface is Next.js App Router only — no raw
 * `.html` / `.htm` files may exist anywhere in the repository.
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IGNORED_DIRS = new Set(['node_modules', '.next', 'dist', 'coverage', '.turbo']);
const HTML_EXT = /\.(?:html|htm)$/i;

/** Collect offending paths under `dir`; exported so tests can target fixtures. */
export function findHtmlFiles(dir = ROOT) {
  const offenders = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '.git' || IGNORED_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      offenders.push(...findHtmlFiles(full));
    } else if (HTML_EXT.test(entry)) {
      offenders.push(path.relative(ROOT, full));
    }
  }
  return offenders;
}

/** Run the guard; returns true on success. Exported for the guard test. */
export function run() {
  const offenders = findHtmlFiles();
  if (offenders.length > 0) {
    console.error('FAIL: verify-no-html');
    for (const offender of offenders) console.error(offender);
    return false;
  }
  console.log('OK: verify-no-html');
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(run() ? 0 : 1);
}

#!/usr/bin/env node
/**
 * Migration safety checker (Task 102).
 *
 * Policy: migrations are ADDITIVE. A destructive statement in an applied
 * migration cannot be un-applied, and on a system whose selling point is an
 * append-only audit chain, "we dropped the column" is not a sentence anyone
 * wants to write in an incident review. The escape hatch is explicit: a
 * `-- allow-destructive: <ticket>` comment ON the statement, which puts a
 * human name and a ticket number next to the decision.
 *
 * Usage:
 *   node scripts/verify-migrations.mjs           → scan packages/db/sql
 *   import { checkMigrationSql } …               → tests
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const SCRIPT_NAME = 'verify-migrations';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MIGRATIONS_DIR = path.join(REPO_ROOT, 'packages/db/sql');

/** Destructive shapes, each with the marker that would excuse it. */
const DESTRUCTIVE = [
  [/\bDROP\s+TABLE\b/i, 'DROP TABLE'],
  [/\bDROP\s+COLUMN\b/i, 'DROP COLUMN'],
  // `TRUNCATE ON` is trigger syntax — the audit chain's no-truncate GUARD
  // triggers must not be mistaken for a truncation.
  [/\bTRUNCATE\s+(?!ON\b)/i, 'TRUNCATE'],
  [/\bALTER\s+(TABLE\s+)?\S+\s+ALTER\s+(COLUMN\s+)?\S+\s+(SET\s+DATA\s+)?TYPE\b/i, 'ALTER … TYPE'],
  [/\bDROP\s+SCHEMA\b/i, 'DROP SCHEMA'],
];

// Same-line only: `-- allow-destructive:` followed by a NEWLINE and then the
// destructive statement must not count — the ticket belongs on the marker.
const MARKER = /--[ \t]*allow-destructive:[ \t]*\S+/i;

/** Split SQL into statements on `;` at line ends (good enough for policy). */
function statementsOf(sql) {
  return sql
    .split(/;\s*$/m)
    .map((statement) => statement.trim())
    .filter((statement) => statement !== '');
}

/**
 * Check one migration file's text.
 * @returns {string[]} violations, each `<statement snippet>: <rule>`
 */
export function checkMigrationSql(sql) {
  const violations = [];
  for (const statement of statementsOf(sql)) {
    for (const [pattern, label] of DESTRUCTIVE) {
      if (!pattern.test(statement)) continue;
      if (MARKER.test(statement)) continue; // ticketed and deliberate
      const snippet = statement.replace(/\s+/g, ' ').slice(0, 72);
      violations.push(`${label} without an "-- allow-destructive: <ticket>" marker: ${snippet}…`);
    }
  }
  return violations;
}

export async function checkDir(dir = MIGRATIONS_DIR) {
  const violations = [];
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return [`${SCRIPT_NAME}: no ${path.relative(REPO_ROOT, dir)} directory`];
  }
  for (const entry of entries.sort()) {
    if (!entry.endsWith('.sql')) continue;
    const text = await readFile(path.join(dir, entry), 'utf8');
    for (const violation of checkMigrationSql(text)) {
      violations.push(`${entry}: ${violation}`);
    }
  }
  return violations;
}

const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const violations = await checkDir();
  if (violations.length > 0) {
    for (const violation of violations) console.error(`FAIL: ${SCRIPT_NAME}: ${violation}`);
    process.exit(1);
  }
  console.log(`OK: ${SCRIPT_NAME}`);
}

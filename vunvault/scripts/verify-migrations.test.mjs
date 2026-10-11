import { strict as assert } from 'node:assert';
import test, { describe } from 'node:test';
import { checkDir, checkMigrationSql } from './verify-migrations.mjs';

/**
 * The migration safety checker's tests (Task 102): each banned shape fails,
 * the ticketed marker passes, and a marker without a ticket does not.
 */

describe('verify-migrations — statements', () => {
  test('additive migrations pass', () => {
    assert.deepEqual(
      checkMigrationSql(`
CREATE TABLE IF NOT EXISTS thing (id uuid PRIMARY KEY);
ALTER TABLE thing ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX CONCURRENTLY IF NOT EXISTS thing_created_at ON thing (created_at);
`),
      [],
    );
  });

  test('each destructive shape fails', () => {
    for (const sql of [
      'DROP TABLE audit_entries;',
      'ALTER TABLE profiles DROP COLUMN email;',
      'TRUNCATE login_attempts;',
      'ALTER TABLE scans ALTER COLUMN status TYPE text;',
      'DROP SCHEMA public;',
    ]) {
      const violations = checkMigrationSql(sql);
      assert.ok(violations.length > 0, `expected a violation for: ${sql}`);
    }
  });

  test('the ticketed marker excuses exactly its own statement', () => {
    // The marker belongs to the statement it sits in — convention: the line
    // above it, inside the same `;`-delimited chunk.
    assert.deepEqual(checkMigrationSql('-- allow-destructive: VV-471\nDROP TABLE tmp_import;'), []);
    // A marker on a DIFFERENT statement does not travel.
    const violations = checkMigrationSql(`
-- allow-destructive: VV-471
CREATE TABLE x (id int);
DROP TABLE y;
`);
    assert.equal(violations.length, 1);
    assert.match(violations[0], /DROP TABLE/);
  });

  test('a marker without a ticket is not a marker', () => {
    const violations = checkMigrationSql('-- allow-destructive:\nDROP TABLE y;');
    assert.equal(violations.length, 1);
  });

  test("the audit chain's no-truncate GUARD triggers are not truncations", () => {
    assert.deepEqual(
      checkMigrationSql(
        'CREATE TRIGGER vv_audit_entries_no_truncate BEFORE TRUNCATE ON audit_entries FOR EACH STATEMENT EXECUTE FUNCTION vv_refuse();',
      ),
      [],
    );
    // A real truncation still fails.
    assert.equal(checkMigrationSql('TRUNCATE audit_entries;').length, 1);
  });
});

describe('verify-migrations — the repository', () => {
  test('every committed migration passes', async () => {
    const violations = await checkDir();
    assert.deepEqual(violations, []);
  });
});

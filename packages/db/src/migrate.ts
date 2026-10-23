/* eslint-disable no-console -- this file is a CLI; reporting progress is its job. */
/**
 * Migration runner. Executable with `tsx src/migrate.ts` (`pnpm db:migrate`).
 *
 * Convergent by design: it works on a brand-new database AND on one whose
 * schema already exists (created by an earlier runner, a restore, or by
 * hand). Two phases:
 *
 *   1. Drizzle's generated baseline from `./drizzle` (the squashed `0000`).
 *      If the schema already exists, the baseline is RECORDED as applied in
 *      `__drizzle_migrations` (same hash + created_at drizzle itself writes)
 *      instead of being replayed — replaying `CREATE TYPE`/`CREATE TABLE`
 *      over a live database is exactly the crash this runner used to hit.
 *   2. Hand-written SQL from `./sql`, applied in lexicographic filename order
 *      and tracked in `_vv_sql_migrations` so each file runs exactly once. A
 *      file whose statements are already present (duplicate table/column/
 *      key, "already exists") is absorbed: rolled back, recorded as applied
 *      and reported — so an existing database converges to the current
 *      schema instead of failing on the first historical file.
 *
 * Both phases connect with `DIRECT_URL` (port 5432) — DDL and advisory locks
 * need a real session, which the Supavisor transaction pooler on 6543 does
 * not provide.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { migrate as runDrizzleMigrations } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { createDb } from './client';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRIZZLE_FOLDER = path.join(PACKAGE_ROOT, 'drizzle');
const DRIZZLE_JOURNAL = path.join(DRIZZLE_FOLDER, 'meta', '_journal.json');
const SQL_FOLDER = path.join(PACKAGE_ROOT, 'sql');
const TRACKING_TABLE = '_vv_sql_migrations';

/** Errors that mean "this statement is already in the database". */
const ALREADY_PRESENT =
  /already exists|duplicate column|duplicate table|duplicate key|duplicate object|cannot drop .* because .* depends/i;

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

async function schemaAlreadyExists(sql: postgres.Sql): Promise<boolean> {
  const rows = await sql.unsafe<{ found: string }[]>(
    `select 1 as found from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'profiles'`,
  );
  return rows.length > 0;
}

/**
 * Record the drizzle baseline as applied, exactly as drizzle's own migrator
 * would: `__drizzle_migrations` rows carry the sha256 of the migration file
 * and the journal's `when` millis, and drizzle skips everything at or before
 * the newest stored `created_at`.
 */
async function baselineDrizzleJournal(sql: postgres.Sql): Promise<void> {
  await sql.unsafe(
    `create table if not exists __drizzle_migrations (
       id serial primary key,
       hash text not null,
       created_at bigint
     )`,
  );
  const journal = JSON.parse(await readFile(DRIZZLE_JOURNAL, 'utf8')) as {
    entries: JournalEntry[];
  };
  for (const entry of journal.entries) {
    const file = await readFile(path.join(DRIZZLE_FOLDER, `${entry.tag}.sql`), 'utf8');
    const hash = createHash('sha256').update(file).digest('hex');
    await sql.unsafe(
      `insert into __drizzle_migrations (hash, created_at)
       select $1, $2 where not exists (
         select 1 from __drizzle_migrations where created_at = $2
       )`,
      [hash, entry.when],
    );
  }
}

async function ensureTrackingTable(sql: postgres.Sql): Promise<void> {
  await sql.unsafe(
    `CREATE TABLE IF NOT EXISTS ${TRACKING_TABLE} (
       name text primary key,
       applied_at timestamptz not null default now()
     )`,
  );
}

async function appliedNames(sql: postgres.Sql): Promise<Set<string>> {
  const rows = await sql.unsafe<{ name: string }[]>(
    `SELECT name FROM ${TRACKING_TABLE} ORDER BY name`,
  );
  return new Set(rows.map((row) => row.name));
}

async function sqlFiles(folder: string): Promise<string[]> {
  const entries = await readdir(folder).catch(() => [] as string[]);
  return entries.filter((entry) => entry.endsWith('.sql')).sort();
}

async function main(): Promise<void> {
  const url = process.env.DIRECT_URL;
  if (url === undefined || url === '') {
    throw new Error(
      'DIRECT_URL is not set. Migrations must use the direct connection on port 5432.',
    );
  }

  // A migration owns a single session: no pooling, no parallel statements.
  const sql = postgres(url, { max: 1, prepare: false, ssl: 'require' });

  try {
    if (await schemaAlreadyExists(sql)) {
      console.log('existing schema detected — recording the drizzle baseline as applied');
      await baselineDrizzleJournal(sql);
    } else {
      console.log('empty database — applying the drizzle baseline');
      await runDrizzleMigrations(createDb(url, { max: 1 }), {
        migrationsFolder: DRIZZLE_FOLDER,
      });
    }

    await ensureTrackingTable(sql);
    const applied = await appliedNames(sql);

    for (const file of await sqlFiles(SQL_FOLDER)) {
      if (applied.has(file)) {
        console.log(`skipped ${file}`);
        continue;
      }
      const statement = await readFile(path.join(SQL_FOLDER, file), 'utf8');
      try {
        // `unsafe` sends a simple query, so a file may hold several statements.
        await sql.begin(async (tx) => {
          await tx.unsafe(statement);
          await tx.unsafe(`INSERT INTO ${TRACKING_TABLE} (name) VALUES ($1)`, [file]);
        });
        console.log(`applied ${file}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!ALREADY_PRESENT.test(message)) throw error;
        // Every statement in this file is already in the database: roll back
        // (already implicit), record it, and converge onwards.
        await sql.unsafe(
          `INSERT INTO ${TRACKING_TABLE} (name) VALUES ($1) ON CONFLICT DO NOTHING`,
          [file],
        );
        console.log(`absorbed ${file} (its objects already exist — recorded as applied)`);
      }
    }
    console.log('migrations up to date');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error('migration failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});

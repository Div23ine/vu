/* eslint-disable no-console -- this file is a CLI; reporting progress is its job. */
/**
 * Migration runner. Executable with `tsx src/migrate.ts` (`pnpm db:migrate`).
 *
 * Two phases:
 *   1. Drizzle's generated migrations from `./drizzle`.
 *   2. Hand-written SQL from `./sql`, applied in lexicographic filename order and
 *      tracked in `_vv_sql_migrations` so each file runs exactly once.
 *
 * Both phases connect with `DIRECT_URL` (port 5432) — DDL and advisory locks need
 * a real session, which the Supavisor transaction pooler on 6543 does not provide.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { migrate as runDrizzleMigrations } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { createDb } from './client';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DRIZZLE_FOLDER = path.join(PACKAGE_ROOT, 'drizzle');
const SQL_FOLDER = path.join(PACKAGE_ROOT, 'sql');
const TRACKING_TABLE = '_vv_sql_migrations';

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
    console.log('drizzle: applying generated migrations');
    await runDrizzleMigrations(createDb(url, { max: 1 }), {
      migrationsFolder: DRIZZLE_FOLDER,
    });

    await ensureTrackingTable(sql);
    const applied = await appliedNames(sql);

    for (const file of await sqlFiles(SQL_FOLDER)) {
      if (applied.has(file)) {
        console.log(`skipped ${file}`);
        continue;
      }
      const statement = await readFile(path.join(SQL_FOLDER, file), 'utf8');
      // `unsafe` sends a simple query, so a file may hold several statements.
      await sql.begin(async (tx) => {
        await tx.unsafe(statement);
        await tx.unsafe(`INSERT INTO ${TRACKING_TABLE} (name) VALUES ($1)`, [file]);
      });
      console.log(`applied ${file}`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error: unknown) => {
  console.error('migration failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});

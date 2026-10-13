import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Connection rules (Supabase Postgres 15 is the only database):
 *
 * - App traffic uses `DATABASE_URL` → the Supabase **Supavisor transaction pooler
 *   on port 6543**. Transaction pooling means a session is not guaranteed between
 *   statements, so `prepare: false` is MANDATORY — prepared statements would be
 *   pinned to a server connection that the pooler may hand to someone else.
 * - Migrations use `DIRECT_URL` → direct Postgres on port 5432, because DDL and
 *   session-level features (advisory locks, `SET LOCAL`) need a real session.
 *   See `src/migrate.ts`.
 * - Supabase Auth owns identity (`auth.users`); `profiles` mirrors it and
 *   references `authUsers.id`.
 */

/** A Drizzle database bound to the full VUNVAULT schema. */
export type Db = PostgresJsDatabase<typeof schema>;

export interface CreateDbOptions {
  /** Maximum pooled connections. 10 for app traffic, 1 for migrations. */
  max?: number;
}

/**
 * Build the Drizzle client used by the API and the workers.
 * Defaults to `DATABASE_URL` (the Supavisor transaction pooler).
 */
export function createDb(
  url: string | undefined = process.env.DATABASE_URL,
  options: CreateDbOptions = {},
): Db {
  if (url === undefined || url === '') {
    throw new Error(
      'DATABASE_URL is not set. App traffic must use the Supavisor transaction pooler on port 6543.',
    );
  }

  const client = postgres(url, {
    // Required for transaction pooling — see the note at the top of this file.
    prepare: false,
    max: options.max ?? 10,
    ssl: 'require',
  });

  return drizzle(client, { schema });
}

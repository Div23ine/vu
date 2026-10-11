import fp from 'fastify-plugin';
import { createDb, type Db } from '@vunvault/db';
import type { FastifyPluginAsync } from 'fastify';

/** The transaction handle a `withTx` callback receives. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** The `postgres-js` client Drizzle wraps. */
interface PostgresClient {
  end: (options?: { timeout?: number }) => Promise<unknown>;
  unsafe: (query: string) => Promise<unknown>;
}

interface WithClient extends Db {
  $client?: PostgresClient;
}

/**
 * Readiness probe. Goes through the driver rather than the query builder so the
 * API does not need `drizzle-orm` as a direct dependency.
 */
export async function pingDb(db: Db): Promise<void> {
  const client = (db as WithClient).$client;
  if (client === undefined) throw new Error('database client is not available');
  await client.unsafe('select 1');
}

export interface DbPluginOptions {
  /** Test seam: inject a database instead of connecting. */
  db?: Db;
}

/**
 * Decorates `app.db` and `app.withTx`.
 *
 * The connection string comes from the secrets provider and points at the Supavisor
 * transaction pooler on port 6543, which is why `@vunvault/db` sets
 * `prepare: false`. `withTx` is the only way a route should write to more than one
 * table: the audit chain, the ledger and the review gate all depend on all-or-nothing.
 */
const dbPlugin: FastifyPluginAsync<DbPluginOptions> = async (app, options) => {
  const db = options.db ?? createDb(await app.secrets.get('DATABASE_URL'));

  app.decorate('db', db);
  app.decorate('withTx', <T>(work: (tx: Tx) => Promise<T>): Promise<T> => db.transaction(work));

  app.addHook('onClose', async () => {
    const client = (db as WithClient).$client;
    if (client === undefined) return;
    await client.end({ timeout: 5 });
  });
};

export default fp(dbPlugin, { name: 'db', dependencies: ['secrets'] });

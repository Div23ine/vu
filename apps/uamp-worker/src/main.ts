import pino from 'pino';
import IORedis from 'ioredis';
import { createDb, type Db } from '@vunvault/db';
import { SqlUampWorkerRepo } from './adapters/sql-repo.js';
import { loadEnv, LOG_REDACT_PATHS } from './config/env.js';
import { CheckHandler } from './domain/check-handler.js';
import { startConsumers } from './queue/consumer.js';

/**
 * UAMP monitoring worker.
 *
 * - Maintenance worker schedules due monitor checks in BullMQ.
 * - Consumers perform HTTP/API checks with SSRF guards.
 * - Writes check results and opens/resolves incidents.
 * - Independent of AI — monitoring continues if AI is unavailable.
 */

interface PostgresClient {
  end: (options?: { timeout?: number }) => Promise<unknown>;
}
interface WithClient extends Db {
  $client?: PostgresClient;
}

async function main(): Promise<void> {
  const env = loadEnv();
  const log = pino({
    level: env.LOG_LEVEL,
    base: { service: 'uamp-worker' },
    redact: { paths: [...LOG_REDACT_PATHS], censor: '[redacted]' },
  });

  const db = createDb(env.DATABASE_URL) as WithClient;
  const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const repo = new SqlUampWorkerRepo(db);
  const handler = new CheckHandler(repo, env.UAMP_USER_AGENT);

  const consumers = startConsumers({
    connection,
    handler,
    concurrency: env.UAMP_CONCURRENCY,
    prefix: env.REDIS_KEY_PREFIX,
    log: {
      info: (m, f) => log.info(f ?? {}, m),
      warn: (m, f) => log.warn(f ?? {}, m),
      error: (m, f) => log.error(f ?? {}, m),
    },
  });

  log.info('uamp-worker started');

  const shutdown = async (signal: string) => {
    log.info({ signal }, 'uamp-worker shutting down');
    await consumers.close();
    await connection.quit();
    await db.$client?.end({ timeout: 5 });
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

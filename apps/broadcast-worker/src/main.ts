import Redis from 'ioredis';
import pino from 'pino';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '@vunvault/contracts';
import { createDb, type Db } from '@vunvault/db';
import { RedisProgressBus } from './adapters/redis-bus';
import { BullNotifyEnqueuer } from './adapters/notify-queue';
import { buildProviders } from './adapters/providers';
import { SqlBroadcastRepo } from './adapters/sql-repo';
import { LOG_REDACT_PATHS, loadEnv } from './config/env';
import { BroadcastDeliveryService } from './domain/delivery';
import { startConsumer } from './queue/consumer';
import type { Clock, Logger } from './ports';

/**
 * Broadcast-worker bootstrap (Task 89).
 *
 * Wires the real adapters to the delivery service and starts the BullMQ
 * consumer. Three connections are opened on purpose: BullMQ manages its own
 * (queue + worker), the progress bus needs a plain command connection for
 * PUBLISH, and Postgres comes from `@vunvault/db`'s shared `createDb`
 * (Supavisor pooler, `prepare: false`).
 *
 * Graceful shutdown matters because a broadcast may be mid-flight: SIGTERM
 * stops the worker accepting new jobs, `worker.close()` drains the in-flight
 * delivery, and only then are the connections closed. A delivery interrupted
 * by a hard kill leaves the row `sending`; the job is redelivered by BullMQ and
 * the at-least-once guard in the service takes over from there.
 */

const realClock: Clock = { now: () => new Date() };

/** The `postgres-js` client Drizzle wraps (mirrors `apps/api/src/plugins/db.ts`). */
interface PostgresClient {
  end: (options?: { timeout?: number }) => Promise<unknown>;
}
interface WithClient extends Db {
  $client?: PostgresClient;
}

function createLogger(level: string): Logger {
  const log = pino({
    level,
    base: { service: 'broadcast-worker' },
    redact: { paths: [...LOG_REDACT_PATHS], censor: '[redacted]' },
  });
  return {
    info: (message, fields) => log.info(fields ?? {}, message),
    warn: (message, fields) => log.warn(fields ?? {}, message),
    error: (message, fields) => log.error(fields ?? {}, message),
    debug: (message, fields) => log.debug(fields ?? {}, message),
  };
}

export interface BootstrapOptions {
  /** Test seam: replace the delivery service wholesale. */
  delivery?: Pick<BroadcastDeliveryService, 'deliver'>;
  clock?: Clock;
}

export interface RunningWorker {
  stop(): Promise<void>;
}

export async function bootstrap(options: BootstrapOptions = {}): Promise<RunningWorker> {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL);
  const clock = options.clock ?? realClock;

  const db = createDb(env.DATABASE_URL, { max: 4 });
  const commandConnection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const notifyQueue = new Queue(QUEUE_NAMES.notify, {
    connection: { url: env.REDIS_URL },
    prefix: env.REDIS_KEY_PREFIX,
  });

  const providers = buildProviders(env);
  const delivery =
    options.delivery ??
    new BroadcastDeliveryService({
      repo: new SqlBroadcastRepo(db),
      notify: new BullNotifyEnqueuer(notifyQueue),
      email: providers.email,
      sms: providers.sms,
      bus: new RedisProgressBus(
        { publish: (channel, payload) => commandConnection.publish(channel, payload) },
        logger,
      ),
      clock,
      logger,
      throttleMs: env.PROGRESS_THROTTLE_MS,
      flushEvery: env.COUNTER_FLUSH_EVERY,
    });

  const worker = startConsumer({
    delivery,
    redisUrl: env.REDIS_URL,
    concurrency: env.BROADCAST_CONCURRENCY,
    logger,
  });

  logger.info('broadcast worker started', {
    queue: QUEUE_NAMES.broadcast,
    concurrency: env.BROADCAST_CONCURRENCY,
    nodeEnv: env.NODE_ENV,
  });

  let stopping = false;
  return {
    async stop(): Promise<void> {
      if (stopping) return;
      stopping = true;
      logger.info('shutting down; draining in-flight broadcasts');
      await worker.close();
      await notifyQueue.close().catch(() => undefined);
      await commandConnection.quit().catch(() => undefined);
      const client = (db as WithClient).$client;
      if (client !== undefined) await client.end({ timeout: 5 }).catch(() => undefined);
      logger.info('broadcast worker stopped');
    },
  };
}

async function main(): Promise<void> {
  const running = await bootstrap();
  const onSignal = (signal: string): void => {
    console.warn(`received ${signal}, shutting down`);
    void running.stop().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  };
  process.on('SIGTERM', () => onSignal('SIGTERM'));
  process.on('SIGINT', () => onSignal('SIGINT'));
}

// Only run when executed directly, so tests can import `bootstrap` freely.
const entryName = process.argv[1]?.split('/').pop();
if (entryName !== undefined && import.meta.url.endsWith(`/${entryName}`)) {
  main().catch((error: unknown) => {
    console.error('broadcast worker failed to start', error);
    process.exit(1);
  });
}

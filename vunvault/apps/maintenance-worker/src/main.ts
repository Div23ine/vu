import pino from 'pino';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '@vunvault/contracts';
import { createDb, type Db } from '@vunvault/db';
import { parseKeyRing } from '@vunvault/lib/audit-chain';
import { R2ObjectStorage } from '@vunvault/lib/storage';
import { BullBroadcastProducer } from './adapters/broadcast-producer.js';
import { BullNotifyEnqueuer } from './adapters/notify-queue.js';
import { SqlMaintenanceRepo } from './adapters/sql-repo.js';
import { LOG_REDACT_PATHS, loadEnv } from './config/env.js';
import { startConsumer, type HandlerDeps } from './queue/consumer.js';
import { registerSchedulers } from './queue/scheduler.js';
import type { Clock, Logger } from './ports.js';

/**
 * Maintenance-worker bootstrap (Task 91; Task 92 extends the handler table).
 *
 * At boot the worker registers the repeatable schedules (idempotent BullMQ job
 * schedulers, so every replica may boot freely) and then consumes the very
 * queue it feeds. This is deliberate: the schedule IS the product decision —
 * which sweep runs how often — and keeping it in the worker means it deploys,
 * rolls back and scales with the code that implements it.
 *
 * Graceful shutdown: SIGTERM stops the consumer, drains the in-flight sweep
 * (≤ 20 s), closes the scheduler queue and Postgres. Every handler is
 * idempotent, so a kill mid-sweep just means the next run redoes the work.
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
    base: { service: 'maintenance-worker' },
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
  /** Test seam: replace the handler deps wholesale. */
  handlers?: HandlerDeps;
  clock?: Clock;
  /** Test seam: skip schedule registration. */
  skipSchedulers?: boolean;
}

export interface RunningWorker {
  stop(): Promise<void>;
}

export async function bootstrap(options: BootstrapOptions = {}): Promise<RunningWorker> {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL);
  const clock = options.clock ?? realClock;

  const db = createDb(env.DATABASE_URL, { max: 4 });
  const repo = new SqlMaintenanceRepo(db);
  const notifyQueue = new Queue(QUEUE_NAMES.notify, {
    connection: { url: env.REDIS_URL },
    prefix: env.REDIS_KEY_PREFIX,
  });
  const broadcastQueue = new Queue(QUEUE_NAMES.broadcast, {
    connection: { url: env.REDIS_URL },
    prefix: env.REDIS_KEY_PREFIX,
  });
  const maintenanceQueue = new Queue(QUEUE_NAMES.maintenance, {
    connection: { url: env.REDIS_URL },
    prefix: env.REDIS_KEY_PREFIX,
  });

  // Chain VERIFICATION only — the worker holds the key to check signatures,
  // never to append. The key ring parses the same spec format the API uses
  // (JSON ring or a bare base64 key under `AUDIT_HMAC_KEY_ID`).
  const hmacRing = parseKeyRing(env.AUDIT_HMAC_KEY, 'AUDIT_HMAC_KEY', env.AUDIT_HMAC_KEY_ID);
  const storage = new R2ObjectStorage({
    accountId: env.R2_ACCOUNT_ID,
    bucket: env.R2_BUCKET,
    publicBaseUrl: env.R2_PUBLIC_BASE_URL,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  });

  const handlers: HandlerDeps =
    options.handlers ?? {
      repo,
      notify: new BullNotifyEnqueuer(notifyQueue),
      broadcast: new BullBroadcastProducer(broadcastQueue),
      storage,
      hmacKeyFor: (keyId) => hmacRing.key(keyId),
      clock,
      logger,
      tunables: {
        heartbeatStaleMs: env.HEARTBEAT_STALE_MS,
        heartbeatMissLimit: env.HEARTBEAT_MISS_LIMIT,
        loginAttemptRetentionDays: env.LOGIN_ATTEMPT_RETENTION_DAYS,
        invitationGraceHours: env.INVITATION_GRACE_HOURS,
        dormantAfterDays: env.DORMANT_AFTER_DAYS,
        signupStaleDays: env.SIGNUP_STALE_DAYS,
        outboxStuckMinutes: env.OUTBOX_STUCK_MINUTES,
        r2PublicBaseUrl: env.R2_PUBLIC_BASE_URL,
        auditAlertEmail: env.AUDIT_ALERT_EMAIL ?? null,
      },
    };

  if (options.skipSchedulers !== true) {
    await registerSchedulers(maintenanceQueue, logger);
  }

  const worker = startConsumer({
    handlers,
    redisUrl: env.REDIS_URL,
    concurrency: env.MAINTENANCE_CONCURRENCY,
    logger,
  });

  logger.info('maintenance worker started', {
    queue: QUEUE_NAMES.maintenance,
    concurrency: env.MAINTENANCE_CONCURRENCY,
    nodeEnv: env.NODE_ENV,
  });

  let stopping = false;
  return {
    async stop(): Promise<void> {
      if (stopping) return;
      stopping = true;
      logger.info('shutting down; draining the in-flight sweep');
      await worker.close();
      await maintenanceQueue.close().catch(() => undefined);
      await notifyQueue.close().catch(() => undefined);
      await broadcastQueue.close().catch(() => undefined);
      const client = (db as WithClient).$client;
      if (client !== undefined) await client.end({ timeout: 5 }).catch(() => undefined);
      logger.info('maintenance worker stopped');
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
    console.error('maintenance worker failed to start', error);
    process.exit(1);
  });
}

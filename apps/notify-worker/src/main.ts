import pino from 'pino';
import { createDb, type Db } from '@vunvault/db';
import { R2ObjectStorage } from '@vunvault/lib/storage';
import {
  AfricasTalkingSmsProvider,
  ResendEmailProvider,
  SmsRouter,
  TwilioSmsProvider,
} from '@vunvault/lib/providers';
import { ReactPdfRenderer } from './adapters/renderer';
import { SqlNotifyRepo } from './adapters/sql-repo';
import { LOG_REDACT_PATHS, loadEnv } from './config/env';
import { NotifyHandler } from './domain/notify-handler';
import { PdfHandler } from './domain/pdf-handler';
import { startConsumers, type RunningConsumers } from './queue/consumer';
import type { Clock, Logger } from './ports';

/**
 * Notify-worker bootstrap (Task 90).
 *
 * One app, two BullMQ consumers (`notify`, `pdf`). The providers are the SAME
 * clients the API uses — imported from `@vunvault/lib/providers` so behaviour
 * cannot drift between synchronous API mail and queued mail.
 *
 * Graceful shutdown: SIGTERM stops both workers accepting jobs, `close()`
 * drains the in-flight ones (≤ 20 s), then Postgres is released. A hard kill
 * mid-delivery is safe: the job is redelivered, and the worst case is one
 * duplicate receipt row and one duplicate inbox tile — never a lost mail.
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
    base: { service: 'notify-worker' },
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
  /** Test seam: replace either consumer's brain. */
  notify?: Pick<NotifyHandler, 'handle'>;
  pdf?: Pick<PdfHandler, 'handle'>;
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
  const repo = new SqlNotifyRepo(db);
  const storage = new R2ObjectStorage({
    accountId: env.R2_ACCOUNT_ID,
    bucket: env.R2_BUCKET,
    publicBaseUrl: env.R2_PUBLIC_BASE_URL,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  });

  const notify =
    options.notify ??
    new NotifyHandler({
      repo,
      email: new ResendEmailProvider(env.RESEND_API_KEY),
      sms: new SmsRouter(
        new AfricasTalkingSmsProvider(env.AFRICASTALKING_USERNAME, env.AFRICASTALKING_API_KEY),
        new TwilioSmsProvider(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, env.TWILIO_FROM),
      ),
      logger,
    });

  const pdf =
    options.pdf ??
    new PdfHandler({
      repo,
      renderer: new ReactPdfRenderer(),
      storage,
      clock,
      logger,
    });

  const consumers: RunningConsumers = startConsumers({
    notify,
    pdf,
    redisUrl: env.REDIS_URL,
    notifyConcurrency: env.NOTIFY_CONCURRENCY,
    pdfConcurrency: env.PDF_CONCURRENCY,
    logger,
  });

  logger.info('notify worker started', {
    queues: ['notify', 'pdf'],
    notifyConcurrency: env.NOTIFY_CONCURRENCY,
    pdfConcurrency: env.PDF_CONCURRENCY,
    nodeEnv: env.NODE_ENV,
  });

  let stopping = false;
  return {
    async stop(): Promise<void> {
      if (stopping) return;
      stopping = true;
      logger.info('shutting down; draining in-flight jobs');
      await consumers.close();
      const client = (db as WithClient).$client;
      if (client !== undefined) await client.end({ timeout: 5 }).catch(() => undefined);
      logger.info('notify worker stopped');
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
    console.error('notify worker failed to start', error);
    process.exit(1);
  });
}

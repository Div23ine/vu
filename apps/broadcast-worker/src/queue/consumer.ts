import { Worker, type Job } from 'bullmq';
import { BroadcastJobPayload, QUEUE_NAMES } from '@vunvault/contracts';
import type { Logger } from '../ports.js';
import type { BroadcastDeliveryService, DeliverySummary } from '../domain/delivery.js';

/**
 * BullMQ consumer (Task 89) — the `broadcast` queue.
 *
 * The payload is parsed with the contract schema before anything else: a
 * malformed body is a producer bug and fails PERMANENTLY (no retry — it will
 * not become good on its own), logged with the queue job id only, never the
 * raw body (a body could carry advisory text into a log sink).
 *
 * A delivery throw (infrastructure failure — Postgres down mid-run) propagates
 * to BullMQ, which retries per the queue's job options (three attempts,
 * exponential backoff, set by the API producer). Delivery is at-least-once;
 * the row-status guard in `BroadcastDeliveryService.deliver` keeps a retry
 * from re-sending a broadcast that already finished.
 */

export const BROADCAST_QUEUE_NAME = QUEUE_NAMES.broadcast;

/** BullMQ lock renewal window; a large broadcast can run for minutes. */
export const LOCK_DURATION_MS = 60_000;

export interface ConsumerDeps {
  delivery: Pick<BroadcastDeliveryService, 'deliver'>;
  redisUrl: string;
  concurrency: number;
  logger: Logger;
  /** Test seam: inject a Worker stand-in. */
  createWorker?: (options: CreateWorkerOptions) => WorkerLike;
}

export interface CreateWorkerOptions {
  name: string;
  concurrency: number;
  lockDuration: number;
  connection: { url: string };
}

export interface WorkerLike {
  close(): Promise<void>;
}

/**
 * The queue processor, exported for tests: it is the part with the branching
 * (payload parse, permanent fail, dispatch), and a fake BullMQ `Job` is the
 * only way to exercise it without a live Redis.
 */
export function makeProcessor(deps: Pick<ConsumerDeps, 'delivery' | 'logger'>) {
  const { delivery, logger } = deps;
  return async (job: Job<unknown>): Promise<DeliverySummary | undefined> => {
    const parsed = BroadcastJobPayload.safeParse(job.data);
    if (!parsed.success) {
      logger.error('discarding a malformed broadcast job payload', {
        queueJobId: job.id,
        issues: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      });
      // Permanent failure: a bad body will not become good on retry.
      await job.moveToFailed(
        { message: 'invalid_broadcast_payload', name: 'InvalidPayload' },
        'malformed-payload',
      );
      return undefined;
    }

    const summary = await delivery.deliver({
      broadcastId: parsed.data.broadcastId,
      advisoryId: parsed.data.advisoryId,
      kind: parsed.data.kind,
    });
    logger.info('broadcast job finished', {
      queueJobId: job.id,
      broadcastId: summary.broadcastId,
      status: summary.status,
    });
    return summary;
  };
}

export function startConsumer(deps: ConsumerDeps): WorkerLike {
  const { logger } = deps;
  const processor = makeProcessor(deps);

  if (deps.createWorker !== undefined) {
    return deps.createWorker({
      name: BROADCAST_QUEUE_NAME,
      concurrency: deps.concurrency,
      lockDuration: LOCK_DURATION_MS,
      connection: { url: deps.redisUrl },
    });
  }

  const worker = new Worker(BROADCAST_QUEUE_NAME, processor, {
    connection: { url: deps.redisUrl },
    concurrency: deps.concurrency,
    lockDuration: LOCK_DURATION_MS,
  });

  worker.on('failed', (job, error) => {
    logger.warn('broadcast job failed in the queue', {
      queueJobId: job?.id,
      message: error.message,
    });
  });
  worker.on('error', (error) => {
    logger.error('broadcast worker error', { message: error.message });
  });

  return worker;
}

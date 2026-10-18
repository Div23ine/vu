import { Worker, type Job } from 'bullmq';
import { QUEUE_NAMES, ScanJobPayload } from '@vunvault/contracts';
import type { Logger } from '../ports.js';
import type { JobRunner } from '../domain/job-runner.js';

/**
 * BullMQ consumer (Task 84) — the `scan` queue.
 *
 * Concurrency equals the worker-slot ceiling, so the queue and the semaphore
 * agree about how many scans may be in flight; the semaphore is still the
 * authority, because it is shared across replicas and this number is not.
 *
 * `attempts` is 1 and is set by the API, not here: a scan is not safely
 * re-runnable by a queue retry (the pod may already have touched the target),
 * so a failure is reported to the API and the job ends.
 *
 * A payload that does not parse with `ScanJobPayload` fails the job
 * PERMANENTLY (`moveToFailed` with no retry) and is logged at `error`: a
 * malformed body is a producer bug, and requeueing it would spin forever.
 *
 * The "no slot" outcome is the one case that SHOULD be retried — the cluster is
 * simply busy — so the job is moved to the backoff queue rather than failed.
 */

export const SCAN_QUEUE_NAME = QUEUE_NAMES.scan;

/** BullMQ lock renewal window; a scan runs far longer than this. */
export const LOCK_DURATION_MS = 60_000;

/** How long to wait before retrying when every slot is taken. */
export const NO_SLOT_BACKOFF_MS = 15_000;

export interface ConsumerDeps {
  runner: JobRunner;
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

export function startConsumer(deps: ConsumerDeps): WorkerLike {
  const { runner, logger } = deps;

  const processor = async (job: Job<unknown>): Promise<void> => {
    const parsed = ScanJobPayload.safeParse(job.data);
    if (!parsed.success) {
      logger.error('discarding a malformed scan job payload', {
        queueJobId: job.id,
        issues: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      });
      // Permanent failure: a bad body will not become good on retry.
      await job.moveToFailed(
        { message: 'invalid_scan_payload', name: 'InvalidPayload' },
        'malformed-payload',
      );
      return;
    }

    const outcome = await runner.handle({
      queueJobId: job.id ?? parsed.data.jobId,
      jobId: parsed.data.jobId,
      attempt: parsed.data.attempt,
      targetHost: parsed.data.targetHost,
      scanType: parsed.data.scanType,
    });

    if (outcome.kind === 'skipped' && outcome.why === 'no_slot') {
      // Capacity, not failure: put it back with a delay.
      throw new Error('no_worker_slot');
    }
    // `completed`, `failed` and the other `skipped` reasons are all terminal:
    // the API has been told (or already knew), so the queue job succeeds.
  };

  if (deps.createWorker !== undefined) {
    return deps.createWorker({
      name: SCAN_QUEUE_NAME,
      concurrency: deps.concurrency,
      lockDuration: LOCK_DURATION_MS,
      connection: { url: deps.redisUrl },
    });
  }

  const worker = new Worker(SCAN_QUEUE_NAME, processor, {
    connection: { url: deps.redisUrl },
    concurrency: deps.concurrency,
    lockDuration: LOCK_DURATION_MS,
  });

  worker.on('failed', (job, error) => {
    logger.warn('scan job failed in the queue', {
      queueJobId: job?.id,
      message: error.message,
    });
  });
  worker.on('error', (error) => {
    logger.error('scan worker error', { message: error.message });
  });

  return worker;
}

/** The backoff the queue applies when a job is thrown back for want of a slot. */
export const NO_SLOT_BACKOFF = { type: 'fixed', delay: NO_SLOT_BACKOFF_MS } as const;

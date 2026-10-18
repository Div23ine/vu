import { Worker, type Job } from 'bullmq';
import { NotifyJobPayload, PdfJobPayload, QUEUE_NAMES } from '@vunvault/contracts';
import type { NotifyHandler } from '../domain/notify-handler.js';
import type { PdfHandler } from '../domain/pdf-handler.js';
import type { Logger } from '../ports.js';

/**
 * BullMQ consumers (Task 90) — the `notify` and `pdf` queues in one app.
 *
 * One deployment, two workers: they share configuration, logging and shutdown,
 * but keep separate concurrencies (mail is I/O-bound and cheap, PDF rendering
 * is CPU-bound and heavy — `PDF_CONCURRENCY` stays low so a batch of invoices
 * cannot starve a password reset).
 *
 * Payloads are parsed with the contract schemas before anything else; a
 * malformed body fails PERMANENTLY (producer bug — retrying spins forever) and
 * is logged with the queue job id only, never the raw body (a notify body
 * carries a recipient address; a log sink is not the place for it).
 *
 * `UnrecoverableError` thrown by the handlers is BullMQ's own "do not retry"
 * signal, so permanent provider failures and missing rows end in the failed
 * history after one attempt while transient ones use the queue's three-attempt
 * exponential backoff.
 */

export const NOTIFY_QUEUE_NAME = QUEUE_NAMES.notify;
export const PDF_QUEUE_NAME = QUEUE_NAMES.pdf;

/** BullMQ lock renewal window. */
export const LOCK_DURATION_MS = 30_000;

export interface ConsumerDeps {
  notify: Pick<NotifyHandler, 'handle'>;
  pdf: Pick<PdfHandler, 'handle'>;
  redisUrl: string;
  notifyConcurrency: number;
  pdfConcurrency: number;
  logger: Logger;
  /** Test seam: inject Worker stand-ins. */
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

/** The notify-queue processor, exported for tests. */
export function makeNotifyProcessor(deps: Pick<ConsumerDeps, 'notify' | 'logger'>) {
  const { notify, logger } = deps;
  return async (job: Job<unknown>): Promise<void> => {
    const parsed = NotifyJobPayload.safeParse(job.data);
    if (!parsed.success) {
      logger.error('discarding a malformed notify job payload', {
        queueJobId: job.id,
        issues: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      });
      await job.moveToFailed(
        { message: 'invalid_notify_payload', name: 'InvalidPayload' },
        'malformed-payload',
      );
      return;
    }
    await notify.handle(parsed.data);
  };
}

/** The pdf-queue processor, exported for tests. */
export function makePdfProcessor(deps: Pick<ConsumerDeps, 'pdf' | 'logger'>) {
  const { pdf, logger } = deps;
  return async (job: Job<unknown>): Promise<void> => {
    const parsed = PdfJobPayload.safeParse(job.data);
    if (!parsed.success) {
      logger.error('discarding a malformed pdf job payload', {
        queueJobId: job.id,
        issues: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      });
      await job.moveToFailed(
        { message: 'invalid_pdf_payload', name: 'InvalidPayload' },
        'malformed-payload',
      );
      return;
    }
    await pdf.handle(parsed.data);
  };
}

export interface RunningConsumers {
  close(): Promise<void>;
}

export function startConsumers(deps: ConsumerDeps): RunningConsumers {
  const { logger } = deps;

  const attachEvents = (worker: Worker, queue: string): void => {
    worker.on('failed', (job, error) => {
      logger.warn('job failed in the queue', {
        queue,
        queueJobId: job?.id,
        message: error.message,
      });
    });
    worker.on('error', (error) => {
      logger.error('worker error', { queue, message: error.message });
    });
  };

  if (deps.createWorker !== undefined) {
    const notifyWorker = deps.createWorker({
      name: NOTIFY_QUEUE_NAME,
      concurrency: deps.notifyConcurrency,
      lockDuration: LOCK_DURATION_MS,
      connection: { url: deps.redisUrl },
    });
    const pdfWorker = deps.createWorker({
      name: PDF_QUEUE_NAME,
      concurrency: deps.pdfConcurrency,
      lockDuration: LOCK_DURATION_MS,
      connection: { url: deps.redisUrl },
    });
    return {
      async close(): Promise<void> {
        await Promise.all([notifyWorker.close(), pdfWorker.close()]);
      },
    };
  }

  const notifyWorker = new Worker(NOTIFY_QUEUE_NAME, makeNotifyProcessor(deps), {
    connection: { url: deps.redisUrl },
    concurrency: deps.notifyConcurrency,
    lockDuration: LOCK_DURATION_MS,
  });
  const pdfWorker = new Worker(PDF_QUEUE_NAME, makePdfProcessor(deps), {
    connection: { url: deps.redisUrl },
    concurrency: deps.pdfConcurrency,
    lockDuration: LOCK_DURATION_MS,
  });
  attachEvents(notifyWorker, NOTIFY_QUEUE_NAME);
  attachEvents(pdfWorker, PDF_QUEUE_NAME);

  return {
    async close(): Promise<void> {
      await Promise.all([notifyWorker.close(), pdfWorker.close()]);
    },
  };
}

import { describe, expect, it, vi } from 'vitest';
import type { Job } from 'bullmq';
import type { NotifyJobPayload, PdfJobPayload } from '@vunvault/contracts';
import {
  LOCK_DURATION_MS,
  makeNotifyProcessor,
  makePdfProcessor,
  NOTIFY_QUEUE_NAME,
  PDF_QUEUE_NAME,
  startConsumers,
} from './consumer';
import type { Logger } from '../ports';

function makeLogger(): Logger & { lines: Array<{ level: string; message: string }> } {
  const lines: Array<{ level: string; message: string }> = [];
  return {
    lines,
    info: (message) => lines.push({ level: 'info', message }),
    warn: (message) => lines.push({ level: 'warn', message }),
    error: (message) => lines.push({ level: 'error', message }),
    debug: (message) => lines.push({ level: 'debug', message }),
  };
}

function makeJob(data: unknown, id = 'queue-job-1') {
  return {
    id,
    data,
    moveToFailed: vi.fn(async () => undefined),
  } as unknown as Job<unknown> & { moveToFailed: ReturnType<typeof vi.fn> };
}

const VALID_NOTIFY: NotifyJobPayload = {
  channel: 'email',
  to: 'client@horizonsacco.co.ke',
  template: 'scan_completed',
  vars: { title: 't', body: 'b' },
};

const VALID_PDF: PdfJobPayload = { kind: 'invoice', refId: '11111111-1111-4111-8111-111111111111' };

describe('makeNotifyProcessor', () => {
  it('dispatches a parsed payload to the handler', async () => {
    const handle = vi.fn(async () => undefined);
    const processor = makeNotifyProcessor({ notify: { handle }, logger: makeLogger() });

    await processor(makeJob(VALID_NOTIFY));
    expect(handle).toHaveBeenCalledWith(VALID_NOTIFY);
  });

  it('permanently fails a malformed payload without touching the handler', async () => {
    const handle = vi.fn(async () => undefined);
    const logger = makeLogger();
    const processor = makeNotifyProcessor({ notify: { handle }, logger });
    const job = makeJob({ channel: 'email', to: 'not-an-email', template: 'x', vars: {} });

    await processor(job);
    expect(handle).not.toHaveBeenCalled();
    expect(job.moveToFailed).toHaveBeenCalledWith(
      { message: 'invalid_notify_payload', name: 'InvalidPayload' },
      'malformed-payload',
    );
    expect(logger.lines.some((line) => line.level === 'error')).toBe(true);
  });

  it('rejects an unknown channel', async () => {
    const handle = vi.fn(async () => undefined);
    const processor = makeNotifyProcessor({ notify: { handle }, logger: makeLogger() });
    const job = makeJob({ channel: 'pigeon', to: 'x@y.z' });

    await processor(job);
    expect(job.moveToFailed).toHaveBeenCalled();
    expect(handle).not.toHaveBeenCalled();
  });
});

describe('makePdfProcessor', () => {
  it('dispatches a parsed payload to the handler', async () => {
    const handle = vi.fn(async () => ({ kind: 'invoice' as const, key: 'k', bytes: 1 }));
    const processor = makePdfProcessor({ pdf: { handle }, logger: makeLogger() });

    await processor(makeJob(VALID_PDF));
    expect(handle).toHaveBeenCalledWith(VALID_PDF);
  });

  it('permanently fails a malformed payload', async () => {
    const handle = vi.fn();
    const processor = makePdfProcessor({
      pdf: { handle },
      logger: makeLogger(),
    });
    const job = makeJob({ kind: 'brochure', refId: 'x' });

    await processor(job);
    expect(job.moveToFailed).toHaveBeenCalledWith(
      { message: 'invalid_pdf_payload', name: 'InvalidPayload' },
      'malformed-payload',
    );
    expect(handle).not.toHaveBeenCalled();
  });
});

describe('startConsumers', () => {
  it('builds one worker per queue with its own concurrency', async () => {
    const createWorker = vi.fn(() => ({ close: async () => undefined }));
    const consumers = startConsumers({
      notify: { handle: vi.fn(async () => undefined) },
      pdf: {
        handle: vi.fn(async () => ({ kind: 'invoice' as const, key: 'k', bytes: 1 })),
      },
      redisUrl: 'redis://localhost:6379',
      notifyConcurrency: 8,
      pdfConcurrency: 2,
      logger: makeLogger(),
      createWorker,
    });

    expect(createWorker).toHaveBeenCalledTimes(2);
    expect(createWorker).toHaveBeenNthCalledWith(1, {
      name: NOTIFY_QUEUE_NAME,
      concurrency: 8,
      lockDuration: LOCK_DURATION_MS,
      connection: { url: 'redis://localhost:6379' },
    });
    expect(createWorker).toHaveBeenNthCalledWith(2, {
      name: PDF_QUEUE_NAME,
      concurrency: 2,
      lockDuration: LOCK_DURATION_MS,
      connection: { url: 'redis://localhost:6379' },
    });
    expect(NOTIFY_QUEUE_NAME).toBe('notify');
    expect(PDF_QUEUE_NAME).toBe('pdf');

    await consumers.close();
  });
});

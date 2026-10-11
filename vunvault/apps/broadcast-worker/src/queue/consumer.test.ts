import { describe, expect, it, vi } from 'vitest';
import type { Job } from 'bullmq';
import {
  BROADCAST_QUEUE_NAME,
  LOCK_DURATION_MS,
  makeProcessor,
  startConsumer,
} from './consumer';
import type { DeliverySummary } from '../domain/delivery';
import type { Logger } from '../ports';

const BROADCAST_ID = '3f2b8c1e-9d4a-4e7b-8c2f-1a5d6e7f8090';
const ADVISORY_ID = '9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d';

function summary(status: DeliverySummary['status'] = 'sent'): DeliverySummary {
  return {
    broadcastId: BROADCAST_ID,
    kind: 'initial',
    status,
    audienceOrgs: 1,
    contacts: 1,
    sent: { dashboards: 1, email: 1, sms: 0 },
    failed: 0,
  };
}

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

const VALID_PAYLOAD = { broadcastId: BROADCAST_ID, advisoryId: ADVISORY_ID, kind: 'initial' };

describe('makeProcessor', () => {
  it('dispatches a valid payload to the delivery service', async () => {
    const deliver = vi.fn(async () => summary());
    const logger = makeLogger();
    const processor = makeProcessor({ delivery: { deliver }, logger });

    const result = await processor(makeJob(VALID_PAYLOAD));

    expect(deliver).toHaveBeenCalledWith({
      broadcastId: BROADCAST_ID,
      advisoryId: ADVISORY_ID,
      kind: 'initial',
    });
    expect(result?.status).toBe('sent');
    expect(logger.lines.some((line) => line.message === 'broadcast job finished')).toBe(true);
  });

  it('permanently fails a malformed payload without touching the service', async () => {
    const deliver = vi.fn(async () => summary());
    const logger = makeLogger();
    const processor = makeProcessor({ delivery: { deliver }, logger });
    const job = makeJob({ broadcastId: 'not-a-uuid', kind: 'initial' });

    const result = await processor(job);

    expect(result).toBeUndefined();
    expect(deliver).not.toHaveBeenCalled();
    expect(job.moveToFailed).toHaveBeenCalledWith(
      { message: 'invalid_broadcast_payload', name: 'InvalidPayload' },
      'malformed-payload',
    );
    expect(logger.lines.some((line) => line.level === 'error')).toBe(true);
  });

  it('rejects an unknown kind', async () => {
    const deliver = vi.fn(async () => summary());
    const processor = makeProcessor({ delivery: { deliver }, logger: makeLogger() });

    const badKind = makeJob({ ...VALID_PAYLOAD, kind: 'reminder' }, 'job-2');
    await processor(badKind);
    expect(badKind.moveToFailed).toHaveBeenCalled();
    expect(deliver).not.toHaveBeenCalled();
  });

  it('propagates a delivery throw so BullMQ retries the job', async () => {
    const deliver = vi.fn(async (): Promise<DeliverySummary> => {
      throw new Error('advisory_missing');
    });
    const processor = makeProcessor({ delivery: { deliver }, logger: makeLogger() });

    await expect(processor(makeJob(VALID_PAYLOAD))).rejects.toThrow('advisory_missing');
  });
});

describe('startConsumer', () => {
  it('builds the worker with the broadcast queue name, concurrency and lock window', () => {
    const createWorker = vi.fn(() => ({ close: async () => undefined }));
    startConsumer({
      delivery: { deliver: vi.fn(async () => summary()) },
      redisUrl: 'redis://localhost:6379',
      concurrency: 2,
      logger: makeLogger(),
      createWorker,
    });

    expect(createWorker).toHaveBeenCalledWith({
      name: BROADCAST_QUEUE_NAME,
      concurrency: 2,
      lockDuration: LOCK_DURATION_MS,
      connection: { url: 'redis://localhost:6379' },
    });
    expect(BROADCAST_QUEUE_NAME).toBe('broadcast');
  });
});

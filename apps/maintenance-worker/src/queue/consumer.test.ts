import { describe, expect, it, vi } from 'vitest';
import type { Job } from 'bullmq';
import { MAINTENANCE_TASKS } from '@vunvault/contracts';
import {
  HANDLERS,
  LOCK_DURATION_MS,
  MAINTENANCE_QUEUE_NAME,
  makeProcessor,
  startConsumer,
  type HandlerDeps,
} from './consumer.js';
import type { Logger } from '../ports.js';

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

function makeHandlerDeps(): HandlerDeps {
  return {
    repo: {} as HandlerDeps['repo'],
    notify: { enqueueEmail: vi.fn() },
    broadcast: { requeue: vi.fn() },
    storage: { put: vi.fn() },
    hmacKeyFor: () => undefined,
    clock: { now: () => new Date('2026-09-24T09:05:00.000Z') },
    logger: makeLogger(),
    tunables: {
      heartbeatStaleMs: 90_000,
      heartbeatMissLimit: 3,
      loginAttemptRetentionDays: 30,
      invitationGraceHours: 0,
      dormantAfterDays: 90,
      signupStaleDays: 7,
      outboxStuckMinutes: 2,
      r2PublicBaseUrl: 'https://cdn.vunvault.com',
      auditAlertEmail: null,
    },
  };
}

describe('HANDLERS registry', () => {
  it('is total over the contract enum', () => {
    for (const task of MAINTENANCE_TASKS) {
      expect(typeof HANDLERS[task], task).toBe('function');
    }
  });

  it('runs the four Task 91 handlers against a fake repo', async () => {
    const deps = makeHandlerDeps();
    deps.repo = {
      listEndpointWindows: async () => [],
      upsertPlatformMetrics: async () => undefined,
      sweepStaleNodes: async () => ({ degraded: 0, offline: 0 }),
      recoverNodes: async () => 0,
      countAdvisoryThreats: async () => ({
        criticalCves: 1,
        unpatchedCritical: 0,
        weaponizedInWild: 0,
        activeZeroDays: 0,
      }),
      insertThreatSnapshot: async () => undefined,
      publishScheduledContent: async () => [],
    } as unknown as HandlerDeps['repo'];

    const summaries = await Promise.all([
      HANDLERS.metrics_rollup(deps),
      HANDLERS.node_health(deps),
      HANDLERS.threat_level(deps),
      HANDLERS.scheduled_publish(deps),
    ]);
    expect(summaries.map((summary) => summary.task)).toEqual([
      'metrics_rollup',
      'node_health',
      'threat_level',
      'scheduled_publish',
    ]);
  });

  it('runs a Task 92 handler end-to-end through the registry (purge)', async () => {
    const deps = makeHandlerDeps();
    const purge = vi.fn(async () => 9);
    deps.repo = { purgeLoginAttempts: purge } as unknown as HandlerDeps['repo'];

    const summary = await HANDLERS.purge_login_attempts(deps);
    expect(summary).toEqual({ task: 'purge_login_attempts', affected: 9 });
    expect(purge).toHaveBeenCalledOnce();
  });
});

describe('makeProcessor', () => {
  it('dispatches by task name and logs the summary', async () => {
    const deps = makeHandlerDeps();
    deps.repo = {
      listEndpointWindows: async () => [],
      upsertPlatformMetrics: async () => undefined,
    } as unknown as HandlerDeps['repo'];
    const logger = makeLogger();
    const processor = makeProcessor({ handlers: deps, logger });

    const summary = await processor(makeJob({ task: 'metrics_rollup' }));
    expect(summary?.task).toBe('metrics_rollup');
    expect(logger.lines.some((line) => line.message === 'maintenance task finished')).toBe(true);
  });

  it('permanently fails a malformed payload', async () => {
    const logger = makeLogger();
    const processor = makeProcessor({ handlers: makeHandlerDeps(), logger });
    const job = makeJob({ task: 'rm_rf' });

    const result = await processor(job);
    expect(result).toBeUndefined();
    expect(job.moveToFailed).toHaveBeenCalledWith(
      { message: 'invalid_maintenance_payload', name: 'InvalidPayload' },
      'malformed-payload',
    );
    expect(logger.lines.some((line) => line.level === 'error')).toBe(true);
  });

  it('propagates a handler throw so the queue retries', async () => {
    const deps = makeHandlerDeps();
    deps.repo = {
      listEndpointWindows: async () => {
        throw new Error('db down');
      },
    } as unknown as HandlerDeps['repo'];
    const processor = makeProcessor({ handlers: deps, logger: makeLogger() });

    await expect(processor(makeJob({ task: 'metrics_rollup' }))).rejects.toThrow('db down');
  });
});

describe('startConsumer', () => {
  it('builds the worker with the maintenance queue name and lock window', () => {
    const createWorker = vi.fn(() => ({ close: async () => undefined }));
    startConsumer({
      handlers: makeHandlerDeps(),
      redisUrl: 'redis://localhost:6379',
      concurrency: 2,
      logger: makeLogger(),
      createWorker,
    });

    expect(createWorker).toHaveBeenCalledWith({
      name: MAINTENANCE_QUEUE_NAME,
      concurrency: 2,
      lockDuration: LOCK_DURATION_MS,
      connection: { url: 'redis://localhost:6379' },
    });
    expect(MAINTENANCE_QUEUE_NAME).toBe('maintenance');
  });
});

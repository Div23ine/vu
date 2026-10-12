import { describe, expect, it, vi } from 'vitest';
import { runOutboxReenqueue } from './outbox-reenqueue';
import type { BroadcastProducer, Logger, MaintenanceRepo, StuckBroadcastRow } from '../ports';

const makeLogger = () => {
  const warnings: string[] = [];
  const logger: Logger = {
    info: () => undefined,
    warn: (message) => warnings.push(message),
    error: () => undefined,
    debug: () => undefined,
  };
  return { logger, warnings };
};

const NOW = new Date('2026-09-24T09:05:00.000Z');

const ROW: StuckBroadcastRow = {
  broadcastId: '3f2b8c1e-9d4a-4e7b-8c2f-1a5d6e7f8090',
  advisoryId: '9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d',
  kind: 'initial',
};

function makeHarness(options: { stuck?: StuckBroadcastRow[]; requeueFails?: boolean } = {}) {
  const stuck = options.stuck ?? [];
  const requeued: StuckBroadcastRow[] = [];
  const listCalls: Date[] = [];

  const repo = {
    async listStuckBroadcasts(cutoff: Date) {
      listCalls.push(cutoff);
      return stuck;
    },
  } as Pick<MaintenanceRepo, 'listStuckBroadcasts'>;

  const broadcast: BroadcastProducer = {
    async requeue(job) {
      if (options.requeueFails === true) throw new Error('redis down');
      requeued.push(job);
    },
  };

  return { repo, broadcast, requeued, listCalls };
}

describe('runOutboxReenqueue', () => {
  it('re-enqueues every stuck queued row with the stable job contract', async () => {
    const h = makeHarness({ stuck: [ROW, { ...ROW, broadcastId: 'cccccccc-0000-4000-8000-000000000003', kind: 'retraction' }] });
    const { logger } = makeLogger();
    const summary = await runOutboxReenqueue({
      repo: h.repo,
      broadcast: h.broadcast,
      clock: { now: () => NOW },
      stuckMinutes: 2,
      logger,
    });

    expect(h.listCalls[0]?.getTime()).toBe(NOW.getTime() - 2 * 60 * 1000);
    expect(h.requeued).toEqual([
      ROW,
      { ...ROW, broadcastId: 'cccccccc-0000-4000-8000-000000000003', kind: 'retraction' },
    ]);
    expect(summary).toEqual({
      task: 'outbox_reenqueue',
      affected: 2,
      detail: { requeued: 2, skipped: 0 },
    });
  });

  it('does nothing when the outbox is empty', async () => {
    const h = makeHarness();
    const { logger } = makeLogger();
    const summary = await runOutboxReenqueue({
      repo: h.repo,
      broadcast: h.broadcast,
      clock: { now: () => NOW },
      stuckMinutes: 2,
      logger,
    });
    expect(summary.affected).toBe(0);
    expect(h.requeued).toEqual([]);
  });

  it('counts a failing requeue as skipped and keeps sweeping the rest', async () => {
    const requeue = vi.fn(async (job: StuckBroadcastRow) => {
      if (job.kind === 'initial') throw new Error('redis down');
    });
    const h = makeHarness({ stuck: [ROW, { ...ROW, broadcastId: 'dddddddd-0000-4000-8000-000000000004', kind: 'rebroadcast' }] });
    const { logger, warnings } = makeLogger();
    const summary = await runOutboxReenqueue({
      repo: h.repo,
      broadcast: { requeue },
      clock: { now: () => NOW },
      stuckMinutes: 2,
      logger,
    });

    expect(summary).toEqual({
      task: 'outbox_reenqueue',
      affected: 1,
      detail: { requeued: 1, skipped: 1 },
    });
    expect(warnings).toContain('outbox re-enqueue failed; will retry next sweep');
    expect(requeue).toHaveBeenCalledTimes(2);
  });

  it('propagates a repo failure so the queue retries the sweep', async () => {
    const repo = {
      listStuckBroadcasts: vi.fn(async () => {
        throw new Error('db down');
      }),
    } as unknown as Pick<MaintenanceRepo, 'listStuckBroadcasts'>;
    const { logger } = makeLogger();
    await expect(
      runOutboxReenqueue({
        repo,
        broadcast: { requeue: vi.fn() },
        clock: { now: () => NOW },
        stuckMinutes: 2,
        logger,
      }),
    ).rejects.toThrow('db down');
  });
});

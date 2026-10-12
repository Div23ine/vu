import { describe, expect, it, vi } from 'vitest';
import { runNodeHealth } from './node-health';
import type { Logger, MaintenanceRepo } from '../ports';

function makeLogger(): Logger {
  return { info: () => undefined, warn: () => undefined, error: () => undefined, debug: () => undefined };
}

type Repo = Pick<MaintenanceRepo, 'sweepStaleNodes' | 'recoverNodes'>;

function makeRepo(options: { swept?: { degraded: number; offline: number }; recovered?: number } = {}) {
  const sweepCalls: Array<{ cutoff: Date; missLimit: number }> = [];
  const recoverCalls: Date[] = [];
  const repo: Repo = {
    async sweepStaleNodes(cutoff, missLimit) {
      sweepCalls.push({ cutoff, missLimit });
      return options.swept ?? { degraded: 0, offline: 0 };
    },
    async recoverNodes(cutoff) {
      recoverCalls.push(cutoff);
      return options.recovered ?? 0;
    },
  };
  return { repo, sweepCalls, recoverCalls };
}

const NOW = new Date('2026-09-24T09:05:00.000Z');

describe('runNodeHealth', () => {
  it('sweeps with a cutoff of now − staleMs and the configured miss limit', async () => {
    const { repo, sweepCalls, recoverCalls } = makeRepo();
    await runNodeHealth({
      repo,
      clock: { now: () => NOW },
      staleMs: 90_000,
      missLimit: 3,
      logger: makeLogger(),
    });

    expect(sweepCalls).toHaveLength(1);
    expect(sweepCalls[0]?.cutoff.toISOString()).toBe('2026-09-24T09:03:30.000Z');
    expect(sweepCalls[0]?.missLimit).toBe(3);
    expect(recoverCalls).toHaveLength(1);
    expect(recoverCalls[0]?.toISOString()).toBe('2026-09-24T09:03:30.000Z');
  });

  it('reports degraded, offline and recovered counts', async () => {
    const { repo } = makeRepo({ swept: { degraded: 2, offline: 1 }, recovered: 1 });
    const summary = await runNodeHealth({
      repo,
      clock: { now: () => NOW },
      staleMs: 90_000,
      missLimit: 3,
      logger: makeLogger(),
    });

    expect(summary).toEqual({
      task: 'node_health',
      affected: 4,
      detail: { degraded: 2, offline: 1, recovered: 1 },
    });
  });

  it('recovers AFTER sweeping so a node that beats again is not left offline', async () => {
    const order: string[] = [];
    const repo: Repo = {
      async sweepStaleNodes() {
        order.push('sweep');
        return { degraded: 0, offline: 0 };
      },
      async recoverNodes() {
        order.push('recover');
        return 0;
      },
    };
    await runNodeHealth({
      repo,
      clock: { now: () => NOW },
      staleMs: 90_000,
      missLimit: 3,
      logger: makeLogger(),
    });
    expect(order).toEqual(['sweep', 'recover']);
  });

  it('propagates a repo failure so the queue retries', async () => {
    const repo = {
      sweepStaleNodes: vi.fn(async () => {
        throw new Error('db down');
      }),
      recoverNodes: vi.fn(),
    } as unknown as Repo;

    await expect(
      runNodeHealth({ repo, clock: { now: () => NOW }, staleMs: 1, missLimit: 1, logger: makeLogger() }),
    ).rejects.toThrow('db down');
    expect(repo.recoverNodes).not.toHaveBeenCalled();
  });
});

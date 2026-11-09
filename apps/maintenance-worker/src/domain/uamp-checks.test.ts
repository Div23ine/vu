import { describe, expect, it, vi } from 'vitest';
import { runUampChecks } from './uamp-checks';
import type { Logger, MaintenanceRepo, UampCheckProducer } from '../ports';

const monitor = {
  id: 'b2000000-0000-4000-8000-000000000001',
  orgId: 'a1000000-0000-4000-8000-000000000001',
  intervalSeconds: 60,
  lastCheckedAt: null,
};

function logger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

describe('runUampChecks', () => {
  it('enqueues each due monitor and reports the affected count', async () => {
    const enqueue = vi.fn(async () => undefined);
    const repo = {
      listDueUampMonitors: vi.fn(async () => [monitor, { ...monitor, id: 'b2000000-0000-4000-8000-000000000002' }]),
    } as unknown as MaintenanceRepo;
    const uamp = { enqueue } as UampCheckProducer;
    const log = logger();

    const summary = await runUampChecks({
      repo,
      uamp,
      clock: { now: () => new Date('2026-11-09T12:00:00.000Z') },
      logger: log,
    });

    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(summary).toEqual({ task: 'uamp_checks', affected: 2 });
    expect(log.info).toHaveBeenCalledWith('uamp due monitors enqueued', {
      count: 2,
      scheduledAt: '2026-11-09T12:00:00.000Z',
    });
  });

  it('fails loudly when the repository adapter lacks the UAMP query', async () => {
    await expect(
      runUampChecks({
        repo: {} as MaintenanceRepo,
        uamp: { enqueue: vi.fn() },
        clock: { now: () => new Date() },
        logger: logger(),
      }),
    ).rejects.toThrow('maintenance_repo_missing_uamp_scheduler_query');
  });
});

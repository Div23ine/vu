import { describe, expect, it, vi } from 'vitest';
import { computeRollup, rollupWindow, runMetricsRollup } from './metrics-rollup';
import type { EndpointWindowRow, Logger, MaintenanceRepo, PlatformMetricsInput } from '../ports';

function makeLogger(): Logger {
  return { info: () => undefined, warn: () => undefined, error: () => undefined, debug: () => undefined };
}

describe('rollupWindow', () => {
  it('is the last COMPLETE hour, truncated to the hour', () => {
    const { from, to } = rollupWindow(new Date('2026-09-24T09:14:37.250Z'));
    expect(from.toISOString()).toBe('2026-09-24T08:00:00.000Z');
    expect(to.toISOString()).toBe('2026-09-24T09:00:00.000Z');
  });

  it('rolls over midnight and month boundaries correctly', () => {
    const { from, to } = rollupWindow(new Date('2026-10-01T00:04:00.000Z'));
    expect(from.toISOString()).toBe('2026-09-30T23:00:00.000Z');
    expect(to.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });
});

describe('computeRollup', () => {
  it('aggregates requests and computes the request-weighted average latency', () => {
    const rows: EndpointWindowRow[] = [
      { endpoint: '/api/v1/scan/submit', requests: 100, avgLatencyMs: 200 },
      { endpoint: '/api/v1/auth/token', requests: 300, avgLatencyMs: 100 },
    ];
    const rollup = computeRollup(rows);
    expect(rollup.apiRequests).toBe(400);
    // (100×200 + 300×100) / 400 = 125
    expect(rollup.avgResponseMs).toBe(125);
    // The honest approximation: the max endpoint average.
    expect(rollup.p95ResponseMs).toBe(200);
  });

  it('is all zeroes for an empty window', () => {
    expect(computeRollup([])).toEqual({
      siteSessions: 0,
      apiRequests: 0,
      avgResponseMs: 0,
      p95ResponseMs: 0,
      threatsBlocked: 0,
    });
  });

  it('never invents session or blocked-threat numbers (Task 76)', () => {
    const rows: EndpointWindowRow[] = [{ endpoint: '/x', requests: 50, avgLatencyMs: 10 }];
    const rollup = computeRollup(rows);
    expect(rollup.siteSessions).toBe(0);
    expect(rollup.threatsBlocked).toBe(0);
  });
});

describe('runMetricsRollup', () => {
  it('queries the complete window and upserts the hour row', async () => {
    const upserts: PlatformMetricsInput[] = [];
    const windows: Array<{ from: Date; to: Date }> = [];
    const repo = {
      async listEndpointWindows(from: Date, to: Date) {
        windows.push({ from, to });
        return [{ endpoint: '/api/v1/cve/feed', requests: 60, avgLatencyMs: 74 }] satisfies EndpointWindowRow[];
      },
      async upsertPlatformMetrics(input: PlatformMetricsInput) {
        upserts.push(input);
      },
    } as Pick<MaintenanceRepo, 'listEndpointWindows' | 'upsertPlatformMetrics'>;

    const summary = await runMetricsRollup({
      repo,
      clock: { now: () => new Date('2026-09-24T09:05:00.001Z') },
      logger: makeLogger(),
    });

    expect(windows[0]?.from.toISOString()).toBe('2026-09-24T08:00:00.000Z');
    expect(windows[0]?.to.toISOString()).toBe('2026-09-24T09:00:00.000Z');
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({
      hour: new Date('2026-09-24T08:00:00.000Z'),
      apiRequests: 60,
      avgResponseMs: 74,
      p95ResponseMs: 74,
      siteSessions: 0,
      threatsBlocked: 0,
    });
    expect(summary).toMatchObject({ task: 'metrics_rollup', affected: 1 });
  });

  it('propagates a repo failure so the queue retries the sweep', async () => {
    const repo = {
      listEndpointWindows: vi.fn(async () => {
        throw new Error('db down');
      }),
      upsertPlatformMetrics: vi.fn(),
    } as unknown as Pick<MaintenanceRepo, 'listEndpointWindows' | 'upsertPlatformMetrics'>;

    await expect(
      runMetricsRollup({ repo, clock: { now: () => new Date() }, logger: makeLogger() }),
    ).rejects.toThrow('db down');
    expect(repo.upsertPlatformMetrics).not.toHaveBeenCalled();
  });
});

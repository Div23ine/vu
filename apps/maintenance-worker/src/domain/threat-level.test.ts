import { describe, expect, it, vi } from 'vitest';
import { computeThreatLevel, runThreatLevel } from './threat-level';
import type { Logger, MaintenanceRepo, ThreatCounts, ThreatSnapshotInput } from '../ports';

function makeLogger(): Logger {
  return {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
  };
}

function counts(overrides: Partial<ThreatCounts> = {}): ThreatCounts {
  return {
    criticalCves: 0,
    unpatchedCritical: 0,
    weaponizedInWild: 0,
    activeZeroDays: 0,
    ...overrides,
  };
}

describe('computeThreatLevel', () => {
  it('is 1 for a quiet published set', () => {
    expect(computeThreatLevel(counts())).toBe(1);
    expect(computeThreatLevel(counts({ criticalCves: 9 }))).toBe(1);
  });

  it.each([
    ['weaponized in the wild jumps two levels', counts({ weaponizedInWild: 1 }), 3],
    ['an unpatched critical adds one', counts({ unpatchedCritical: 1 }), 2],
    ['ten tracked criticals add one', counts({ criticalCves: 10 }), 2],
    ['nine tracked criticals add nothing', counts({ criticalCves: 9 }), 1],
    [
      'all three rules clamp at 5',
      counts({ weaponizedInWild: 4, unpatchedCritical: 2, criticalCves: 40 }),
      5,
    ],
  ])('%s', (_label, input, expected) => {
    expect(computeThreatLevel(input)).toBe(expected);
  });

  it('is deterministic: the same counts always give the same level', () => {
    const input = counts({ weaponizedInWild: 2, unpatchedCritical: 3, criticalCves: 12 });
    const first = computeThreatLevel(input);
    for (let i = 0; i < 10; i += 1) expect(computeThreatLevel(input)).toBe(first);
  });

  it('never invents a blocked-threat count (Task 76)', async () => {
    const snapshots: ThreatSnapshotInput[] = [];
    const repo = {
      countAdvisoryThreats: async () => counts({ weaponizedInWild: 1 }),
      insertThreatSnapshot: async (input: ThreatSnapshotInput) => {
        snapshots.push(input);
      },
    } as Pick<MaintenanceRepo, 'countAdvisoryThreats' | 'insertThreatSnapshot'>;

    await runThreatLevel({
      repo,
      clock: { now: () => new Date('2026-09-24T09:15:00.000Z') },
      logger: makeLogger(),
    });
    expect(snapshots[0]?.threatsBlockedYtd).toBe(0);
  });
});

describe('runThreatLevel', () => {
  it('writes exactly one snapshot per run with the computed level', async () => {
    const snapshots: ThreatSnapshotInput[] = [];
    const repo = {
      countAdvisoryThreats: async () =>
        counts({
          criticalCves: 46,
          unpatchedCritical: 9,
          weaponizedInWild: 37,
          activeZeroDays: 12,
        }),
      insertThreatSnapshot: async (input: ThreatSnapshotInput) => {
        snapshots.push(input);
      },
    } as Pick<MaintenanceRepo, 'countAdvisoryThreats' | 'insertThreatSnapshot'>;

    const summary = await runThreatLevel({
      repo,
      clock: { now: () => new Date('2026-09-24T09:15:00.000Z') },
      logger: makeLogger(),
    });

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toEqual({
      level: 5,
      criticalCves: 46,
      unpatchedCritical: 9,
      weaponizedInWild: 37,
      activeZeroDays: 12,
      threatsBlockedYtd: 0,
      computedAt: new Date('2026-09-24T09:15:00.000Z'),
    });
    expect(summary).toMatchObject({ task: 'threat_level', affected: 1 });
    expect(summary.detail).toMatchObject({ level: 5 });
  });

  it('propagates a repo failure so the queue retries', async () => {
    const repo = {
      countAdvisoryThreats: vi.fn(async () => {
        throw new Error('db down');
      }),
      insertThreatSnapshot: vi.fn(),
    } as unknown as Pick<MaintenanceRepo, 'countAdvisoryThreats' | 'insertThreatSnapshot'>;

    await expect(
      runThreatLevel({ repo, clock: { now: () => new Date() }, logger: makeLogger() }),
    ).rejects.toThrow('db down');
    expect(repo.insertThreatSnapshot).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { runAuditSnapshot, SNAPSHOT_CONTENT_TYPE, snapshotKey } from './audit-snapshot.js';
import type { AuditHead, LastCheckpoint, Logger, MaintenanceRepo, ObjectWriter } from '../ports.js';

const makeLogger = (): Logger => ({
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
});

const NOW = new Date('2026-09-24T02:00:05.000Z');

function makeHarness(
  options: { head?: AuditHead | null; checkpoint?: LastCheckpoint | null; putFails?: boolean } = {},
) {
  const puts: Array<{ key: string; body: string; contentType: string }> = [];
  const repo = {
    auditHead: vi.fn(async () =>
      options.head === undefined ? { seq: 128, hash: 'a'.repeat(64) } : options.head,
    ),
    lastCheckpoint: vi.fn(async () =>
      options.checkpoint === undefined
        ? {
            toSeq: 128,
            headHash: 'a'.repeat(64),
            mismatches: 0,
            verifiedAt: new Date('2026-09-24T00:00:00.000Z'),
          }
        : options.checkpoint,
    ),
  } as unknown as Pick<MaintenanceRepo, 'auditHead' | 'lastCheckpoint'>;

  const storage: ObjectWriter = {
    async put(key, body, contentType) {
      if (options.putFails === true) throw new Error('r2 503');
      puts.push({ key, body: new TextDecoder().decode(body), contentType });
    },
  };

  return { repo, storage, puts };
}

describe('snapshotKey', () => {
  it('is one idempotent key per UTC day', () => {
    expect(snapshotKey(new Date('2026-09-24T02:00:00.000Z'))).toBe(
      'audit-snapshots/2026-09-24.json',
    );
    expect(snapshotKey(new Date('2026-09-24T23:59:59.999Z'))).toBe(
      'audit-snapshots/2026-09-24.json',
    );
  });
});

describe('runAuditSnapshot', () => {
  it('uploads the structural snapshot with the exact shape', async () => {
    const h = makeHarness();
    const summary = await runAuditSnapshot({
      repo: h.repo,
      storage: h.storage,
      clock: { now: () => NOW },
      logger: makeLogger(),
    });

    expect(h.puts).toHaveLength(1);
    expect(h.puts[0]?.key).toBe('audit-snapshots/2026-09-24.json');
    expect(h.puts[0]?.contentType).toBe(SNAPSHOT_CONTENT_TYPE);
    expect(JSON.parse(h.puts[0]?.body ?? '{}')).toEqual({
      date: '2026-09-24',
      entryCount: 128,
      headSeq: 128,
      headHash: 'a'.repeat(64),
      lastCheckpoint: {
        toSeq: 128,
        mismatches: 0,
        verifiedAt: '2026-09-24T00:00:00.000Z',
      },
      generatedAt: NOW.toISOString(),
    });
    expect(summary).toEqual({
      task: 'audit_snapshot',
      affected: 1,
      detail: { key: 'audit-snapshots/2026-09-24.json', entryCount: 128 },
    });
  });

  it('survives an empty chain (genesis day) with nulls, not crashes', async () => {
    const h = makeHarness({ head: null, checkpoint: null });
    await runAuditSnapshot({
      repo: h.repo,
      storage: h.storage,
      clock: { now: () => NOW },
      logger: makeLogger(),
    });
    expect(JSON.parse(h.puts[0]?.body ?? '{}')).toMatchObject({
      entryCount: 0,
      headSeq: null,
      headHash: null,
      lastCheckpoint: null,
    });
  });

  it('rethrows an upload failure so the queue retries', async () => {
    const h = makeHarness({ putFails: true });
    await expect(
      runAuditSnapshot({
        repo: h.repo,
        storage: h.storage,
        clock: { now: () => NOW },
        logger: makeLogger(),
      }),
    ).rejects.toThrow('r2 503');
  });
});

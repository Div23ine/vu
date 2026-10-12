import { describe, expect, it } from 'vitest';
import type { AuditCategory, AuditSeverity } from '@vunvault/contracts';
import { computeHash, computeSignature, entryPayload, ZERO_HASH } from '@vunvault/lib/audit-chain';
import type { VerifiableAuditEntry } from '@vunvault/lib/audit-chain';
import { runVerifyChain, VERIFIED_BY, VERIFY_BATCH_SIZE } from './verify-chain';
import type { CheckpointInput, LastCheckpoint, Logger, MaintenanceRepo, NotifyEnqueuer } from '../ports';

const KEY_V1 = Buffer.alloc(32, 7);
const hmacKeyFor = (keyId: string): Buffer | undefined => (keyId === 'v1' ? KEY_V1 : undefined);

function buildChain(count: number): VerifiableAuditEntry[] {
  const entries: VerifiableAuditEntry[] = [];
  let prevHash = ZERO_HASH;
  for (let seq = 1; seq <= count; seq += 1) {
    const base = {
      seq,
      category: 'system' as AuditCategory,
      eventType: 'CHAIN_GENESIS',
      severity: 'info' as AuditSeverity,
      actorLabel: 'system',
      subject: null,
      message: `entry ${seq}`,
      details: {},
      createdAt: new Date(Date.UTC(2026, 8, 24, 0, 0, seq)),
      prevHash,
      keyId: 'v1',
    };
    const hash = computeHash(prevHash, entryPayload(base));
    entries.push({ ...base, hash, signature: computeSignature(KEY_V1, hash) });
    prevHash = hash;
  }
  return entries;
}

function makeLogger() {
  const errors: Array<{ message: string; fields?: Record<string, unknown> }> = [];
  const warnings: string[] = [];
  const logger: Logger = {
    info: () => undefined,
    warn: (message) => warnings.push(message),
    error: (message, fields) => errors.push({ message, fields }),
    debug: () => undefined,
  };
  return { logger, errors, warnings };
}

interface HarnessOptions {
  entries?: VerifiableAuditEntry[];
  checkpoint?: LastCheckpoint | null;
  alertEmail?: string | null;
  notifyFails?: boolean;
}

function makeHarness(options: HarnessOptions = {}) {
  const entries = options.entries ?? buildChain(3);
  const checkpoints: CheckpointInput[] = [];
  const enqueued: Array<{ payload: { to: string; template: string; vars: Record<string, string> }; jobId: string }> = [];

  const repo = {
    async lastCheckpoint() {
      return options.checkpoint ?? null;
    },
    async listAuditEntriesAfter(afterSeq: number, limit: number) {
      return entries.filter((entry) => entry.seq > afterSeq).slice(0, limit);
    },
    async insertCheckpoint(input: CheckpointInput) {
      checkpoints.push(input);
    },
  } as Pick<MaintenanceRepo, 'lastCheckpoint' | 'listAuditEntriesAfter' | 'insertCheckpoint'>;

  const notify: NotifyEnqueuer = {
    async enqueueEmail(payload, jobId) {
      if (options.notifyFails === true) throw new Error('queue down');
      enqueued.push({ payload, jobId });
    },
  };

  return {
    repo,
    notify,
    checkpoints,
    enqueued,
    run: (alertEmail = options.alertEmail ?? null) => {
      const { logger, errors, warnings } = makeLogger();
      return runVerifyChain({
        repo,
        notify,
        hmacKeyFor,
        alertEmail,
        clock: { now: () => new Date('2026-09-24T06:00:00.000Z') },
        logger,
      }).then((summary) => ({ summary, errors, warnings }));
    },
  };
}

describe('runVerifyChain', () => {
  it('verifies an intact chain from genesis and writes one clean checkpoint', async () => {
    const entries = buildChain(3);
    const h = makeHarness({ entries });
    const { summary } = await h.run();

    expect(h.checkpoints).toHaveLength(1);
    expect(h.checkpoints[0]).toEqual({
      fromSeq: 1,
      toSeq: 3,
      entries: 3,
      mismatches: 0,
      headHash: entries[2]?.hash,
      verifiedBy: VERIFIED_BY,
    });
    expect(summary).toEqual({
      task: 'verify_chain',
      affected: 3,
      detail: { fromSeq: 1, toSeq: 3, mismatches: 0 },
    });
    expect(h.enqueued).toEqual([]);
  });

  it('reports tampering precisely, still checkpoints, and does not throw', async () => {
    const entries = buildChain(4).map((entry) =>
      entry.seq === 2 ? { ...entry, message: 'entry 2 (rewritten)' } : entry,
    );
    const h = makeHarness({ entries, alertEmail: 'soc@vunvault.com' });
    const { summary, errors } = await h.run();

    expect(h.checkpoints).toHaveLength(1);
    expect(h.checkpoints[0]?.mismatches).toBeGreaterThan(0);
    // Entry 2's recomputed hash breaks; entry 3 still LINKS (verification walks
    // the stored hashes), so exactly one row mismatches and it is pinpointed.
    expect(summary.detail).toEqual({ fromSeq: 1, toSeq: 4, mismatches: 1 });
    expect(errors[0]?.message).toBe('AUDIT CHAIN MISMATCH — possible tampering');
    expect(errors[0]?.fields).toMatchObject({ firstMismatchSeq: 2 });

    // The alert e-mail is queued with the dedupe id and the chain_broken template.
    expect(h.enqueued).toHaveLength(1);
    expect(h.enqueued[0]?.payload.template).toBe('chain_broken');
    expect(h.enqueued[0]?.payload.to).toBe('soc@vunvault.com');
    expect(h.enqueued[0]?.payload.vars).toEqual({ firstMismatchSeq: '2', mismatches: '1' });
    expect(h.enqueued[0]?.jobId).toBe('chain_broken:1:2');
  });

  it('does not alert when no address is configured', async () => {
    const entries = buildChain(2).map((entry) =>
      entry.seq === 1 ? { ...entry, details: { forged: true } } : entry,
    );
    const h = makeHarness({ entries, alertEmail: null });
    await h.run();
    expect(h.enqueued).toEqual([]);
    expect(h.checkpoints[0]?.mismatches).toBeGreaterThan(0);
  });

  it('a dead notify queue does not fail the verification run', async () => {
    const entries = buildChain(2).map((entry) =>
      entry.seq === 2 ? { ...entry, message: 'tampered' } : entry,
    );
    const h = makeHarness({ entries, alertEmail: 'soc@vunvault.com', notifyFails: true });
    const { summary, warnings } = await h.run();
    expect(summary.detail).toMatchObject({ mismatches: 1 });
    expect(warnings).toContain('chain-broken alert could not be queued');
    expect(h.checkpoints).toHaveLength(1);
  });

  it('writes a liveness checkpoint for an empty range', async () => {
    const h = makeHarness({ entries: [] });
    const { summary } = await h.run();

    expect(h.checkpoints).toEqual([
      {
        fromSeq: 1,
        toSeq: 0,
        entries: 0,
        mismatches: 0,
        headHash: ZERO_HASH,
        verifiedBy: VERIFIED_BY,
      },
    ]);
    expect(summary.affected).toBe(0);
  });

  it('resumes from the last checkpoint: fromSeq and anchor come from it', async () => {
    const entries = buildChain(5);
    const anchorEntry = entries[1];
    if (anchorEntry === undefined) throw new Error('unreachable');
    const h = makeHarness({
      entries,
      checkpoint: {
        toSeq: 2,
        headHash: anchorEntry.hash,
        mismatches: 0,
        verifiedAt: new Date('2026-09-24T00:00:00.000Z'),
      },
    });
    const { summary } = await h.run();

    // Only entries 3..5 are checked; the anchor links entry 3 to entry 2.
    expect(summary).toEqual({
      task: 'verify_chain',
      affected: 3,
      detail: { fromSeq: 3, toSeq: 5, mismatches: 0 },
    });
    expect(h.checkpoints[0]?.headHash).toBe(entries[4]?.hash);
  });

  it('a wrong checkpoint anchor surfaces as a link mismatch', async () => {
    const entries = buildChain(3);
    const h = makeHarness({
      entries,
      checkpoint: {
        toSeq: 1,
        headHash: 'f'.repeat(64),
        mismatches: 0,
        verifiedAt: new Date('2026-09-24T00:00:00.000Z'),
      },
    });
    const { summary } = await h.run();
    expect(summary.detail).toMatchObject({ fromSeq: 2, mismatches: 1 });
  });

  it('pages through more entries than one batch', async () => {
    const entries = buildChain(VERIFY_BATCH_SIZE + 1);
    const h = makeHarness({ entries });
    const { summary } = await h.run();
    expect(summary.affected).toBe(VERIFY_BATCH_SIZE + 1);
    expect(h.checkpoints[0]?.toSeq).toBe(VERIFY_BATCH_SIZE + 1);
  }, 30_000);
});

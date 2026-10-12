import { checkEntry, type VerifiableAuditEntry } from '@vunvault/lib/audit-chain';
import type { Logger, MaintenanceRepo, NotifyEnqueuer, Summary } from '../ports';

/**
 * `verify_chain` (Task 92) — the tamper-evidence sweep, every 6 hours.
 *
 * Resumes from the last `audit_checkpoints` row (`from_seq = to_seq + 1`,
 * anchored on its `head_hash`), streams entries in batches through the SHARED
 * `checkEntry` from `@vunvault/lib/audit-chain` — the same primitive the API's
 * on-demand verification uses, so "verified" means one thing platform-wide —
 * and writes exactly ONE checkpoint row per run.
 *
 * An EMPTY range still writes a checkpoint: the row is also the liveness
 * proof that verification ran at all. A gap in `audit_checkpoints` tells an
 * auditor the sweep stopped, which is itself a finding.
 *
 * On mismatch the sweep does NOT throw: the point of a verification run is to
 * REPORT tampering precisely, not to die on the first bad row and hide the
 * rest. The checkpoint records the count, the log names the first bad seq, and
 * (when configured) `AUDIT_ALERT_EMAIL` gets a `chain_broken` e-mail. Appends
 * to the chain stay in the API under its advisory lock — the worker has no
 * write path into `audit_entries` at all.
 */

/** Matches the API's VERIFY_BATCH_SIZE so both verifiers page identically. */
export const VERIFY_BATCH_SIZE = 500;

export const VERIFIED_BY = 'system';

export interface VerifyChainDeps {
  repo: Pick<
    MaintenanceRepo,
    'lastCheckpoint' | 'listAuditEntriesAfter' | 'insertCheckpoint'
  >;
  notify: NotifyEnqueuer;
  hmacKeyFor: (keyId: string) => Buffer | undefined;
  alertEmail: string | null;
  clock: { now(): Date };
  logger: Logger;
}

export interface VerifyChainOutcome {
  fromSeq: number;
  toSeq: number;
  checked: number;
  mismatches: number;
  firstMismatchSeq: number | null;
  headHash: string;
}

/** The pure core: stream, verify, and report. Split out for tests. */
export async function verifyFrom(
  repo: VerifyChainDeps['repo'],
  hmacKeyFor: VerifyChainDeps['hmacKeyFor'],
  fromSeq: number,
  anchorPrevHash: string,
): Promise<VerifyChainOutcome> {
  let expectedPrev = anchorPrevHash;
  let afterSeq = fromSeq - 1;
  let checked = 0;
  let mismatches = 0;
  let firstMismatchSeq: number | null = null;
  let toSeq = fromSeq - 1;
  let headHash = anchorPrevHash;

  for (;;) {
    const batch: VerifiableAuditEntry[] = await repo.listAuditEntriesAfter(afterSeq, VERIFY_BATCH_SIZE);
    if (batch.length === 0) break;

    for (const entry of batch) {
      const issue = checkEntry(entry, expectedPrev, hmacKeyFor);
      if (issue !== null) {
        mismatches += 1;
        if (firstMismatchSeq === null) firstMismatchSeq = entry.seq;
      }
      expectedPrev = entry.hash;
      headHash = entry.hash;
      toSeq = entry.seq;
      checked += 1;
    }

    afterSeq = batch[batch.length - 1]?.seq ?? afterSeq;
    if (batch.length < VERIFY_BATCH_SIZE) break;
  }

  return { fromSeq, toSeq, checked, mismatches, firstMismatchSeq, headHash };
}

export async function runVerifyChain(deps: VerifyChainDeps): Promise<Summary> {
  const last = await deps.repo.lastCheckpoint();
  const fromSeq = last === null ? 1 : last.toSeq + 1;
  const anchor = last === null ? '0'.repeat(64) : last.headHash;

  const outcome = await verifyFrom(deps.repo, deps.hmacKeyFor, fromSeq, anchor);

  // Append-only: one checkpoint per run, even when nothing new arrived.
  await deps.repo.insertCheckpoint({
    fromSeq: outcome.fromSeq,
    toSeq: outcome.toSeq,
    entries: outcome.checked,
    mismatches: outcome.mismatches,
    headHash: outcome.headHash,
    verifiedBy: VERIFIED_BY,
  });

  if (outcome.mismatches > 0) {
    deps.logger.error('AUDIT CHAIN MISMATCH — possible tampering', {
      firstMismatchSeq: outcome.firstMismatchSeq,
      mismatches: outcome.mismatches,
      fromSeq: outcome.fromSeq,
      toSeq: outcome.toSeq,
    });
    if (deps.alertEmail !== null) {
      try {
        await deps.notify.enqueueEmail(
          {
            to: deps.alertEmail,
            template: 'chain_broken',
            vars: {
              firstMismatchSeq: String(outcome.firstMismatchSeq ?? 0),
              mismatches: String(outcome.mismatches),
            },
          },
          // One alert e-mail per (checkpoint run, first bad seq): a repeated
          // sweep over the same break must not become a mail loop, and BullMQ
          // dedupes this id.
          `chain_broken:${outcome.fromSeq}:${outcome.firstMismatchSeq ?? 0}`,
        );
      } catch (error) {
        // The alert is best-effort; the checkpoint and the error log are the record.
        deps.logger.warn('chain-broken alert could not be queued', {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } else {
    deps.logger.info('audit chain verified', {
      fromSeq: outcome.fromSeq,
      toSeq: outcome.toSeq,
      checked: outcome.checked,
    });
  }

  return {
    task: 'verify_chain',
    affected: outcome.checked,
    detail: {
      fromSeq: outcome.fromSeq,
      toSeq: outcome.toSeq,
      mismatches: outcome.mismatches,
    },
  };
}

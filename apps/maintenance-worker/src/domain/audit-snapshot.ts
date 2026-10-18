import type { Logger, MaintenanceRepo, ObjectWriter, Summary } from '../ports.js';

/**
 * `audit_snapshot` (Task 92) — the daily off-database record of the chain's
 * state, written to R2 at 02:00 UTC.
 *
 * The snapshot is deliberately small and structural — date, entry count, head
 * seq/hash, last checkpoint — NOT a copy of the log. Its job is to give an
 * auditor a third vantage point: if the database, the checkpoints and the
 * snapshots disagree about where the chain head was on a given day, one of
 * them has been rewritten. (WORM guarantees come from the bucket: R2 object
 * lock / versioning is an operator/L13 concern, noted here so nobody believes
 * the file itself is immutable.)
 *
 * Idempotent per day: the key is `audit-snapshots/<YYYY-MM-DD>.json`, so a
 * re-run overwrites the same object with the same shape and a fresh
 * `generatedAt`.
 */

export const SNAPSHOT_CONTENT_TYPE = 'application/json';

export function snapshotKey(date: Date): string {
  return `audit-snapshots/${date.toISOString().slice(0, 10)}.json`;
}

export interface AuditSnapshot {
  date: string;
  entryCount: number;
  headSeq: number | null;
  headHash: string | null;
  lastCheckpoint: {
    toSeq: number;
    mismatches: number;
    verifiedAt: string;
  } | null;
  generatedAt: string;
}

export interface AuditSnapshotDeps {
  repo: Pick<MaintenanceRepo, 'auditHead' | 'lastCheckpoint'>;
  storage: ObjectWriter;
  clock: { now(): Date };
  logger: Logger;
}

export async function runAuditSnapshot(deps: AuditSnapshotDeps): Promise<Summary> {
  const now = deps.clock.now();
  const head = await deps.repo.auditHead();
  const checkpoint = await deps.repo.lastCheckpoint();

  const snapshot: AuditSnapshot = {
    date: now.toISOString().slice(0, 10),
    // `seq` is a generated identity starting at 1, so the head seq IS the
    // entry count — no separate COUNT(*) over a 7-year table.
    entryCount: head?.seq ?? 0,
    headSeq: head?.seq ?? null,
    headHash: head?.hash ?? null,
    lastCheckpoint:
      checkpoint === null
        ? null
        : {
            toSeq: checkpoint.toSeq,
            mismatches: checkpoint.mismatches,
            verifiedAt: checkpoint.verifiedAt.toISOString(),
          },
    generatedAt: now.toISOString(),
  };

  const key = snapshotKey(now);
  const body = new TextEncoder().encode(`${JSON.stringify(snapshot, null, 2)}\n`);
  await deps.storage.put(key, body, SNAPSHOT_CONTENT_TYPE);

  deps.logger.info('audit snapshot uploaded', {
    key,
    entryCount: snapshot.entryCount,
    headSeq: snapshot.headSeq,
  });
  return { task: 'audit_snapshot', affected: 1, detail: { key, entryCount: snapshot.entryCount } };
}

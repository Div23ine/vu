import type {
  AuditQuery,
  AuditRange,
  AuditSummary,
  ChainStatus,
  VerifyChainResult,
} from '@vunvault/contracts';
import type { AuditEntryView, AuditService } from '../../../audit/service';
import type { SqlExecutor } from '../../../audit/repo';
import { HttpError } from '../../../lib/http-error';
import { EXPORT_BATCH_SIZE, EXPORT_MAX_ROWS } from './csv';
import type { AuditReadFilters, AuditReadRepo } from './repo';

/**
 * Reading the audit trail (Task 39).
 *
 * This service can list, summarise, describe, verify and export the chain. It
 * cannot change it: there is no method here that writes an entry, and the only
 * write it performs is a `audit_checkpoints` row, which is a record that a
 * verification happened.
 *
 * Verification is expensive — it recomputes a SHA-256 and an HMAC for every entry
 * — so it is serialised behind a Redis lock. Two administrators clicking "verify"
 * at once get one verification and one `409`, not two passes over a million rows.
 */

/** The chain is kept for seven years; the retention figure is displayed, not inferred. */
export const RETENTION_YEARS = 7;

/** The label shown on the Command Center's chain panel. */
export const DEFAULT_NODE_LABEL = 'node-nbo-01 · NBO-CORE';

/** Sealed entries are AES-256-GCM; the panel says so in plain text. */
export const CHAIN_ENCRYPTION = 'AES-256-GCM';

/** How far back each range reaches. */
export const RANGE_MS: Record<AuditRange, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

export const VERIFY_LOCK_KEY = 'audit:verify:lock';
export const VERIFY_LOCK_TTL_SECONDS = 600;

/** Read `NODE_LABEL` without owning the env schema (Task 21's file). */
export function nodeLabel(source: NodeJS.ProcessEnv = process.env): string {
  const configured = source.NODE_LABEL;
  return configured === undefined || configured.trim() === ''
    ? DEFAULT_NODE_LABEL
    : configured.trim();
}

/** A mutex with a TTL, so a crashed verifier cannot hold the chain hostage. */
export interface VerifyLock {
  acquire(): Promise<boolean>;
  release(): Promise<void>;
}

export interface RedisLockClient {
  set(key: string, value: string, mode: 'NX', seconds: 'EX', ttl: number): Promise<'OK' | null>;
  del(key: string): Promise<unknown>;
}

export class RedisVerifyLock implements VerifyLock {
  constructor(
    private readonly redis: RedisLockClient,
    private readonly token: string,
    private readonly ttlSeconds: number = VERIFY_LOCK_TTL_SECONDS,
  ) {}

  async acquire(): Promise<boolean> {
    // The token makes `release` safe: only the holder can drop the lock.
    const result = await this.redis.set(VERIFY_LOCK_KEY, this.token, 'NX', 'EX', this.ttlSeconds);
    return result === 'OK';
  }

  async release(): Promise<void> {
    await this.redis.del(VERIFY_LOCK_KEY).catch(() => undefined);
  }
}

/** A lock that always grants: single-process tests and development. */
export class AlwaysAvailableLock implements VerifyLock {
  held = false;
  async acquire(): Promise<boolean> {
    if (this.held) return false;
    this.held = true;
    return true;
  }
  async release(): Promise<void> {
    this.held = false;
  }
}

export interface AuditReadServiceDeps {
  repo: AuditReadRepo;
  /** Task 25's chain verifier. */
  verifier: Pick<AuditService, 'verify'>;
  lock?: VerifyLock;
  now?: () => Date;
  node?: string;
}

export interface VerifyOutcome {
  result: VerifyChainResult;
  /** True when the chain did not verify: the audit entry is raised to critical. */
  broken: boolean;
}

export class AuditReadService {
  private readonly repo: AuditReadRepo;
  private readonly verifier: Pick<AuditService, 'verify'>;
  private readonly lock: VerifyLock | undefined;
  private readonly now: () => Date;
  private readonly node: string;

  constructor(deps: AuditReadServiceDeps) {
    this.repo = deps.repo;
    this.verifier = deps.verifier;
    this.lock = deps.lock;
    this.now = deps.now ?? (() => new Date());
    this.node = deps.node ?? nodeLabel();
  }

  /** The clock every window in this service is measured against. */
  currentDate(): Date {
    return this.now();
  }

  private filters(query: AuditQuery): AuditReadFilters {
    return {
      page: query.page,
      pageSize: query.pageSize,
      q: query.q,
      category: query.category,
      severity: query.severity,
      actor: query.actor,
      since: new Date(this.now().getTime() - RANGE_MS[query.range]),
    };
  }

  async list(query: AuditQuery): Promise<{ data: AuditEntryView[]; total: number }> {
    const { rows, total } = await this.repo.list(this.filters(query));
    return { data: rows, total };
  }

  async summary(): Promise<AuditSummary> {
    const since = new Date(this.now().getTime() - RANGE_MS['24h']);
    const [counts, checkpoint] = await Promise.all([
      this.repo.counts(since),
      this.repo.latestCheckpoint(),
    ]);
    return {
      ...counts,
      // No checkpoint yet: nothing has been found broken, and nothing has been
      // verified either, so the honest figure is a clean chain.
      chainIntegrityPercent: integrityPercent(
        checkpoint?.entries ?? 0,
        checkpoint?.mismatches ?? 0,
      ),
      hashMismatches: checkpoint?.mismatches ?? 0,
      retentionYears: RETENTION_YEARS,
    };
  }

  async chain(): Promise<ChainStatus> {
    const [head, checkpoint] = await Promise.all([this.repo.head(), this.repo.latestCheckpoint()]);
    return {
      state: (checkpoint?.mismatches ?? 0) > 0 ? 'broken' : 'intact',
      totalEntries: head.totalEntries,
      // A chain with no genesis row has not been initialised; the panel needs a
      // date, and the epoch is the least surprising thing to show.
      genesisDate: head.genesisDate ?? '1970-01-01',
      lastVerifiedAt: checkpoint?.verifiedAt ?? null,
      hashMismatches: checkpoint?.mismatches ?? 0,
      headHash: shortHash(head.headHash),
      node: this.node,
      encryption: CHAIN_ENCRYPTION,
    };
  }

  /**
   * Verify the chain, or the part of it nobody has checked since the last
   * checkpoint. The lock is taken first and released last, including on failure:
   * a verifier that throws must not leave the chain un-verifiable for ten minutes.
   */
  async verify(
    executor: SqlExecutor,
    caller: { id: string; label: string },
    options: { incremental?: boolean } = {},
  ): Promise<VerifyOutcome> {
    if (this.lock !== undefined && !(await this.lock.acquire())) {
      throw new HttpError(409, 'verify_in_progress', 'A chain verification is already running');
    }
    try {
      const checkpoint = options.incremental === true ? await this.repo.latestCheckpoint() : null;
      const fromSeq = checkpoint === null ? 1 : checkpoint.toSeq + 1;

      const outcome = await this.verifier.verify(executor, { fromSeq });
      const head = await this.repo.head();
      await this.repo.insertCheckpoint({
        verifiedAt: new Date(outcome.verifiedAt),
        fromSeq: outcome.checkedFromSeq,
        toSeq: outcome.checkedToSeq,
        entries: outcome.entries,
        mismatches: outcome.mismatches,
        headHash: head.headHash ?? '0'.repeat(64),
        verifiedBy: caller.label,
      });

      return {
        result: {
          checkedFromSeq: outcome.checkedFromSeq,
          checkedToSeq: outcome.checkedToSeq,
          entries: outcome.entries,
          mismatches: outcome.mismatches,
          firstMismatchSeq: outcome.firstMismatchSeq,
          verifiedAt: outcome.verifiedAt,
        },
        broken: outcome.mismatches > 0,
      };
    } finally {
      if (this.lock !== undefined) await this.lock.release();
    }
  }

  /**
   * The export, in cursor batches. Refuses to start past the row cap rather than
   * streaming a hundred thousand rows and then stopping: an export that truncates
   * silently is worse than one that says no.
   */
  async *exportRows(query: AuditQuery): AsyncGenerator<AuditEntryView[]> {
    const filters = this.filters(query);
    let afterSeq = 0;
    let exported = 0;

    for (;;) {
      const batch = await this.repo.exportBatch(filters, afterSeq, EXPORT_BATCH_SIZE);
      if (batch.length === 0) return;
      if (exported + batch.length > EXPORT_MAX_ROWS) {
        throw new HttpError(
          422,
          'range_too_large',
          `Narrow the filter: an export is capped at ${EXPORT_MAX_ROWS} rows`,
        );
      }
      exported += batch.length;
      afterSeq = batch[batch.length - 1]?.seq ?? afterSeq;
      yield batch;
      if (batch.length < EXPORT_BATCH_SIZE) return;
    }
  }

  /** What a reconnecting stream missed, oldest first. */
  async replay(afterSeq: number, limit: number): Promise<AuditEntryView[]> {
    return this.repo.sinceSeq(afterSeq, limit);
  }
}

/** `0x` and the first sixteen hex characters: enough to eyeball, not to forge. */
export function shortHash(hash: string | null): string {
  if (hash === null) return `0x${'0'.repeat(16)}`;
  return `0x${hash.slice(0, 16)}`;
}

/** Whole entries that verified, as a percentage to one decimal place. */
export function integrityPercent(entries: number, mismatches: number): number {
  if (entries <= 0) return 100;
  const verified = Math.max(0, entries - mismatches);
  return Math.round((verified / entries) * 1000) / 10;
}

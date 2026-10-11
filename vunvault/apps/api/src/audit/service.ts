import { randomUUID } from 'node:crypto';
import type { AuditCategory, AuditSeverity } from '@vunvault/contracts';
import {
  checkEntry,
  entryPayload,
  verifyEntries,
  ZERO_HASH,
  type VerifyEntriesResult,
  type VerifyIssue,
} from '@vunvault/lib/audit-chain';
import {
  computeHash,
  computeSignature,
  openWith,
  parseKeyRing,
  sealWith,
  type AuditKeyRing,
} from './crypto';
import { eventDefinition, isHigherSevLevel, isMoreSevere, type AuditEventType } from './events';
import { AuditRepo, VERIFY_BATCH_SIZE, type AuditEntryRow, type SqlExecutor } from './repo';

/**
 * The audit chain service.
 *
 * Append-only by construction: this module has no update and no delete path. A
 * correction is a new entry that references the old one in `details`. The database
 * enforces the same rule with triggers, so even a compromised application role
 * cannot rewrite history.
 */

export const AUDIT_STREAM_CHANNEL = 'audit:stream';
export const AUDIT_SEV1_CHANNEL = 'audit:sev1';

/** Advisory lock id shared with the chain-link trigger in `0018_audit_chain.sql`. */
export const CHAIN_ADVISORY_LOCK = 7340481;

/** Any key that looks like a credential never reaches `details`. */
export const REDACTED_KEY_PATTERN = /pass(word)?|secret|token|authorization|cookie|cvc|pan|code$/i;

export interface AuditActor {
  id: string | null;
  label: string;
}

export interface AuditAppendInput {
  eventType: AuditEventType;
  actor: AuditActor;
  subject?: string;
  message: string;
  ip?: string;
  details?: Record<string, unknown>;
  /** Sensitive fields, sealed with AES-256-GCM instead of stored in `details`. */
  sealed?: Record<string, unknown>;
  /** May only be raised above the catalog's value, never lowered. */
  severity?: AuditSeverity;
  sevLevel?: 1 | 2 | 3;
  /** Chosen by the application so a hash is reproducible; defaults to now. */
  createdAt?: Date;
}

export interface AuditEntryView {
  seq: number;
  id: string;
  category: AuditCategory;
  eventType: string;
  severity: AuditSeverity;
  sevLevel: 1 | 2 | 3 | null;
  actorLabel: string;
  message: string;
  ip: string | null;
  subject: string | null;
  hash: string;
  prevHash: string;
  createdAt: string;
}

export interface VerifyChainOutcome {
  checkedFromSeq: number;
  checkedToSeq: number;
  entries: number;
  mismatches: number;
  firstMismatchSeq: number | null;
  verifiedAt: string;
}

/** Recursively drop credential-shaped keys. */
export function redactDetails(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactDetails);
  if (value instanceof Date) return value.toISOString();
  if (value === null || typeof value !== 'object') return value;

  const redacted: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (REDACTED_KEY_PATTERN.test(key)) continue;
    redacted[key] = redactDetails(entry);
  }
  return redacted;
}

/**
 * The pure chain primitives (`entryPayload`, `checkEntry`, `verifyEntries` and
 * their result types) moved to `@vunvault/lib/audit-chain` in Task 92 so the
 * maintenance worker verifies with the SAME code the API appends with. They are
 * re-exported here: every existing import path keeps working.
 */
export { checkEntry, entryPayload, verifyEntries };
export type { VerifyEntriesResult, VerifyIssue };

export interface AuditServiceOptions {
  hmac: AuditKeyRing;
  /** Optional: without it, `sealed` input is rejected rather than stored in clear. */
  aes?: AuditKeyRing;
  /** Redis publish; failures are logged, never thrown. */
  publish?: (channel: string, payload: string) => Promise<void> | void;
  now?: () => Date;
  repo?: AuditRepo;
  log?: { warn: (message: string, error?: unknown) => void };
}

export class AuditService {
  private readonly hmac: AuditKeyRing;
  private readonly aes?: AuditKeyRing;
  private readonly publisher?: (channel: string, payload: string) => Promise<void> | void;
  private readonly now: () => Date;
  private readonly repo: AuditRepo;
  private readonly log: (message: string, error?: unknown) => void;

  constructor(options: AuditServiceOptions) {
    this.hmac = options.hmac;
    this.aes = options.aes;
    this.publisher = options.publish;
    this.now = options.now ?? (() => new Date());
    this.repo = options.repo ?? new AuditRepo();
    this.log = options.log?.warn.bind(options.log) ?? ((_message, _error) => undefined);
  }

  get currentKeyId(): string {
    return this.hmac.currentKeyId;
  }

  async head(executor: SqlExecutor): Promise<{ seq: number; hash: string } | null> {
    return this.repo.head(executor);
  }

  /**
   * Append one entry inside the caller's transaction.
   *
   * The advisory lock serialises concurrent appends, so two requests can never
   * read the same head and fork the chain. Everything after the lock — the hash,
   * the signature, the seal and the INSERT — happens in the same transaction, so a
   * rolled-back domain write takes its audit entry with it.
   */
  async append(
    executor: SqlExecutor,
    input: AuditAppendInput,
    onCommit?: (callback: () => void) => void,
  ): Promise<AuditEntryRow> {
    await executor.unsafe('select pg_advisory_xact_lock($1)', [CHAIN_ADVISORY_LOCK]);

    const head = await this.repo.head(executor);
    const prevHash = head?.hash ?? ZERO_HASH;

    const definition = eventDefinition(input.eventType);
    const severity =
      input.severity !== undefined && isMoreSevere(input.severity, definition.severity)
        ? input.severity
        : definition.severity;
    const sevLevel =
      input.sevLevel !== undefined &&
      (definition.sevLevel === undefined || isHigherSevLevel(input.sevLevel, definition.sevLevel))
        ? input.sevLevel
        : (definition.sevLevel ?? null);

    const details = redactDetails(input.details ?? {}) as Record<string, unknown>;
    const subject = input.subject ?? null;
    const createdAt = input.createdAt ?? this.now();
    const id = randomUUID();

    const hash = computeHash(
      prevHash,
      entryPayload({
        category: definition.category,
        eventType: input.eventType,
        severity,
        actorLabel: input.actor.label,
        subject,
        message: input.message,
        details,
        createdAt,
      }),
    );

    const keyId = this.hmac.currentKeyId;
    const hmacKey = this.hmac.key(keyId);
    if (hmacKey === undefined) {
      throw new Error(`audit HMAC key ${keyId} is missing from the ring`);
    }
    const signature = computeSignature(hmacKey, hash);

    let sealedDetails: Buffer | null = null;
    let nonce: Buffer | null = null;
    if (input.sealed !== undefined) {
      if (this.aes === undefined) {
        throw new Error('AUDIT_AES_KEY is not configured; refusing to store sealed data');
      }
      const aesKey = this.aes.key(this.aes.currentKeyId);
      if (aesKey === undefined) throw new Error('audit AES key is missing from the ring');
      // The entry uuid is the additional authenticated data, so a sealed blob
      // cannot be detached from its entry and replayed onto another one.
      const blob = sealWith(aesKey, input.sealed, id);
      sealedDetails = blob.sealed;
      nonce = blob.nonce;
    }

    const row = await this.repo.insert(executor, {
      id,
      category: definition.category,
      eventType: input.eventType,
      severity,
      sevLevel,
      actorId: input.actor.id,
      actorLabel: input.actor.label,
      ip: input.ip ?? null,
      subject,
      message: input.message,
      details,
      sealedDetails,
      nonce,
      prevHash,
      hash,
      signature,
      keyId,
      createdAt,
    });

    const view = toView(row);
    const dispatch = () => void this.publish(view);
    if (onCommit !== undefined) onCommit(dispatch);
    else dispatch();

    return row;
  }

  /** Open a sealed blob with the key that sealed it. */
  open(entry: Pick<AuditEntryRow, 'id' | 'sealedDetails' | 'nonce' | 'keyId'>): unknown {
    if (entry.sealedDetails === null || entry.nonce === null) return undefined;
    if (this.aes === undefined) throw new Error('AUDIT_AES_KEY is not configured');
    const key = this.aes.key(entry.keyId);
    if (key === undefined) throw new Error(`audit AES key ${entry.keyId} is not in the ring`);
    return openWith(key, entry.sealedDetails, entry.nonce, entry.id);
  }

  /** Publish to the live stream, and to the SEV-1 channel when applicable. */
  async publish(view: AuditEntryView): Promise<void> {
    const publisher = this.publisher;
    if (publisher === undefined) return;
    const payload = JSON.stringify(view);
    try {
      await publisher(AUDIT_STREAM_CHANNEL, payload);
      if (view.sevLevel === 1) await publisher(AUDIT_SEV1_CHANNEL, payload);
    } catch (error) {
      // A broken stream must never fail a committed audit write.
      this.log('audit stream publish failed', error);
    }
  }

  /**
   * Verify the chain, in batches, without throwing on a mismatch: the point of a
   * verification run is to *report* tampering, not to fail loudly and hide where.
   */
  async verify(
    executor: SqlExecutor,
    options: { fromSeq?: number; toSeq?: number } = {},
  ): Promise<VerifyChainOutcome> {
    const fromSeq = options.fromSeq ?? 1;
    const anchor = fromSeq > 1 ? await this.repo.predecessor(executor, fromSeq) : null;
    let expectedPrev = anchor?.hash ?? ZERO_HASH;

    let afterSeq = fromSeq - 1;
    let checked = 0;
    let mismatches = 0;
    let firstMismatchSeq: number | null = null;
    let checkedToSeq = fromSeq - 1;

    for (;;) {
      const batch = await this.repo.batch(executor, {
        afterSeq,
        toSeq: options.toSeq,
        limit: VERIFY_BATCH_SIZE,
      });
      if (batch.length === 0) break;

      for (const entry of batch) {
        const issue = checkEntry(entry, expectedPrev, (keyId) => this.hmac.key(keyId));
        if (issue !== null) {
          mismatches += 1;
          if (firstMismatchSeq === null) firstMismatchSeq = entry.seq;
        }
        expectedPrev = entry.hash;
        checked += 1;
        checkedToSeq = entry.seq;
      }

      afterSeq = batch[batch.length - 1]?.seq ?? afterSeq;
      if (batch.length < VERIFY_BATCH_SIZE) break;
    }

    return {
      checkedFromSeq: fromSeq,
      checkedToSeq,
      entries: checked,
      mismatches,
      firstMismatchSeq,
      verifiedAt: this.now().toISOString(),
    };
  }
}

export function toView(row: AuditEntryRow): AuditEntryView {
  return {
    seq: row.seq,
    id: row.id,
    category: row.category,
    eventType: row.eventType,
    severity: row.severity,
    sevLevel: row.sevLevel,
    actorLabel: row.actorLabel,
    message: row.message,
    ip: row.ip,
    subject: row.subject,
    hash: row.hash,
    prevHash: row.prevHash,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Build a service from the two secret values the environment provides. */
export function createAuditService(options: {
  hmacSecret: string;
  aesSecret?: string;
  publish?: (channel: string, payload: string) => Promise<void> | void;
  log?: { warn: (message: string, error?: unknown) => void };
}): AuditService {
  return new AuditService({
    hmac: parseKeyRing(options.hmacSecret, 'AUDIT_HMAC_KEY'),
    aes:
      options.aesSecret === undefined
        ? undefined
        : parseKeyRing(options.aesSecret, 'AUDIT_AES_KEY'),
    publish: options.publish,
    log: options.log,
  });
}

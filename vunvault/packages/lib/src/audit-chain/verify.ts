import type { AuditCategory, AuditSeverity } from '@vunvault/contracts';
import { canonicalJson } from './canonical';
import { computeHash, computeSignature, digestsEqual, ZERO_HASH } from './crypto';

/**
 * Pure chain verification (moved out of the API's audit service in Task 92).
 *
 * The maintenance worker's `verify_chain` sweep and the API's on-demand
 * `AuditService.verify` MUST agree byte-for-byte on what a valid chain is —
 * two implementations of "is the log tampered with" is how one of them stops
 * being believed. These functions are that single implementation; both callers
 * supply the entries and the key ring.
 */

/**
 * The fields verification reads. The API's `AuditEntryRow` and the worker's
 * repo rows both satisfy this shape; verification never needs the sealed
 * payload, the actor id or the IP.
 */
export interface VerifiableAuditEntry {
  seq: number;
  category: AuditCategory;
  eventType: string;
  severity: AuditSeverity;
  actorLabel: string;
  subject: string | null;
  message: string;
  details: Record<string, unknown>;
  createdAt: Date;
  prevHash: string;
  hash: string;
  signature: string;
  keyId: string;
}

export interface VerifyIssue {
  seq: number;
  reason: 'link' | 'hash' | 'signature';
}

export interface VerifyEntriesResult {
  mismatches: number;
  firstMismatchSeq: number | null;
  issues: VerifyIssue[];
}

/** The exact byte string a hash is computed over. */
export function entryPayload(entry: {
  category: AuditCategory;
  eventType: string;
  severity: AuditSeverity;
  actorLabel: string;
  subject: string | null;
  message: string;
  details: Record<string, unknown>;
  createdAt: Date;
}): string {
  return canonicalJson({
    category: entry.category,
    event_type: entry.eventType,
    severity: entry.severity,
    actor_label: entry.actorLabel,
    subject: entry.subject,
    message: entry.message,
    details: entry.details,
    created_at: entry.createdAt,
  });
}

/**
 * Recompute an entry's hash and check its signature.
 * Pure: `hmacKeyFor` is supplied by the caller, so tests can rotate keys freely.
 */
export function checkEntry(
  entry: VerifiableAuditEntry,
  expectedPrevHash: string,
  hmacKeyFor: (keyId: string) => Buffer | undefined,
): VerifyIssue | null {
  if (!digestsEqual(entry.prevHash, expectedPrevHash)) {
    return { seq: entry.seq, reason: 'link' };
  }
  const recomputed = computeHash(entry.prevHash, entryPayload(entry));
  if (!digestsEqual(recomputed, entry.hash)) {
    return { seq: entry.seq, reason: 'hash' };
  }
  const key = hmacKeyFor(entry.keyId);
  if (key === undefined) return { seq: entry.seq, reason: 'signature' };
  if (!digestsEqual(computeSignature(key, entry.hash), entry.signature)) {
    return { seq: entry.seq, reason: 'signature' };
  }
  return null;
}

/** Verify an ordered list of entries against an anchor `prev_hash`. */
export function verifyEntries(
  entries: readonly VerifiableAuditEntry[],
  hmacKeyFor: (keyId: string) => Buffer | undefined,
  anchorPrevHash = ZERO_HASH,
): VerifyEntriesResult {
  const issues: VerifyIssue[] = [];
  let expected = anchorPrevHash;

  for (const entry of entries) {
    const issue = checkEntry(entry, expected, hmacKeyFor);
    if (issue !== null) issues.push(issue);
    expected = entry.hash;
  }

  return {
    mismatches: issues.length,
    firstMismatchSeq: issues[0]?.seq ?? null,
    issues,
  };
}

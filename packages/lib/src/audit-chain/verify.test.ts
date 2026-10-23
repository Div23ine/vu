import { describe, expect, it } from 'vitest';
import type { AuditCategory, AuditSeverity } from '@vunvault/contracts';
import { computeHash, computeSignature, ZERO_HASH } from './crypto';
import { checkEntry, entryPayload, verifyEntries, type VerifiableAuditEntry } from './verify';

const KEY_V1 = Buffer.alloc(32, 7);

/** Build a correctly linked, correctly signed entry chain for tests. */
function buildChain(count: number): VerifiableAuditEntry[] {
  const entries: VerifiableAuditEntry[] = [];
  let prevHash = ZERO_HASH;
  for (let seq = 1; seq <= count; seq += 1) {
    const base = {
      seq,
      category: 'authentication' as AuditCategory,
      eventType: 'AUTH_SUCCESS',
      severity: 'ok' as AuditSeverity,
      actorLabel: 'e.reed',
      subject: null,
      message: `entry ${seq}`,
      details: {},
      createdAt: new Date(Date.UTC(2026, 8, 24, 9, seq)),
      prevHash,
      keyId: 'v1',
    };
    const hash = computeHash(prevHash, entryPayload(base));
    entries.push({ ...base, hash, signature: computeSignature(KEY_V1, hash) });
    prevHash = hash;
  }
  return entries;
}

const keyForV1 = (keyId: string): Buffer | undefined => (keyId === 'v1' ? KEY_V1 : undefined);

/** `noUncheckedIndexedAccess`-safe access; the builders always produce the entry. */
function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('unreachable: test builder produced no entry');
  return value;
}

describe('entryPayload', () => {
  it('is deterministic across key insertion orders', () => {
    const entry = must(buildChain(1)[0]);
    const shuffled = { ...entry, details: { b: 2, a: 1 } };
    const original = { ...entry, details: { a: 1, b: 2 } };
    expect(entryPayload(shuffled)).toBe(entryPayload(original));
  });
});

describe('checkEntry', () => {
  it('accepts an intact entry', () => {
    const entry = must(buildChain(1)[0]);
    expect(checkEntry(entry, ZERO_HASH, keyForV1)).toBeNull();
  });

  it('reports a link break when the anchor does not match', () => {
    const entry = must(buildChain(1)[0]);
    expect(checkEntry(entry, 'a'.repeat(64), keyForV1)).toEqual({ seq: 1, reason: 'link' });
  });

  it('reports a hash break when the message was rewritten', () => {
    const entry = must(buildChain(1)[0]);
    const tampered = { ...entry, message: 'entry 1 (edited)' };
    expect(checkEntry(tampered, ZERO_HASH, keyForV1)).toEqual({ seq: 1, reason: 'hash' });
  });

  it('reports a signature break under an unknown or wrong key', () => {
    const entry = must(buildChain(1)[0]);
    expect(checkEntry(entry, ZERO_HASH, () => undefined)).toEqual({ seq: 1, reason: 'signature' });
    expect(checkEntry(entry, ZERO_HASH, () => Buffer.alloc(32, 9))).toEqual({
      seq: 1,
      reason: 'signature',
    });
  });
});

describe('verifyEntries', () => {
  it('verifies an intact chain with zero mismatches', () => {
    const chain = buildChain(5);
    const result = verifyEntries(chain, keyForV1);
    expect(result).toEqual({ mismatches: 0, firstMismatchSeq: null, issues: [] });
  });

  it('pinpoints the first tampered entry and keeps checking after it', () => {
    const chain = buildChain(4);
    const tampered = chain.map((entry, index) =>
      index === 1 ? { ...entry, details: { hidden: true } } : entry,
    );
    const result = verifyEntries(tampered, keyForV1);
    expect(result.mismatches).toBeGreaterThan(0);
    expect(result.firstMismatchSeq).toBe(2);
    expect(result.issues[0]?.reason).toBe('hash');
  });

  it('honours an anchor for resumed verification', () => {
    const chain = buildChain(3);
    // Resume after entry 1: anchor = entry 1's hash, verify entries 2..3.
    const result = verifyEntries(chain.slice(1), keyForV1, must(chain[0]).hash);
    expect(result.mismatches).toBe(0);
    // The wrong anchor breaks the link immediately.
    const broken = verifyEntries(chain.slice(1), keyForV1, 'b'.repeat(64));
    expect(broken.firstMismatchSeq).toBe(2);
    expect(broken.issues[0]?.reason).toBe('link');
  });

  it('verifies an empty range cleanly (the liveness case)', () => {
    expect(verifyEntries([], keyForV1)).toEqual({
      mismatches: 0,
      firstMismatchSeq: null,
      issues: [],
    });
  });
});

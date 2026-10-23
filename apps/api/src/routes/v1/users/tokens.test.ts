import { describe, expect, it } from 'vitest';
import {
  INVITATION_TTL_HOURS,
  INVITATION_TTL_MS,
  TOKEN_BYTES,
  generateInvitationToken,
  hashInvitationToken,
  invitationExpiry,
  isExpired,
  isInvitationToken,
  tokensMatch,
} from './tokens';

describe('generateInvitationToken', () => {
  it('produces 32 random bytes of base64url', () => {
    const token = generateInvitationToken();
    expect(Buffer.from(token, 'base64url')).toHaveLength(TOKEN_BYTES);
    expect(token).toHaveLength(43);
    expect(isInvitationToken(token)).toBe(true);
    expect(token).not.toMatch(/[+/=]/);
  });

  it('never repeats', () => {
    const tokens = new Set(Array.from({ length: 500 }, () => generateInvitationToken()));
    expect(tokens.size).toBe(500);
  });
});

describe('hashInvitationToken', () => {
  it('stores a digest, not the token', () => {
    const token = generateInvitationToken();
    const hash = hashInvitationToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(token).not.toContain(hash);
    // Deterministic, so a lookup by hash works.
    expect(hashInvitationToken(token)).toBe(hash);
    expect(hashInvitationToken(`${token}x`)).not.toBe(hash);
  });
});

describe('tokensMatch', () => {
  it('accepts the issued token and nothing else', () => {
    const token = generateInvitationToken();
    const stored = hashInvitationToken(token);
    expect(tokensMatch(token, stored)).toBe(true);
    expect(tokensMatch(generateInvitationToken(), stored)).toBe(false);
    expect(tokensMatch(token, 'nope')).toBe(false);
    expect(tokensMatch('', stored)).toBe(false);
  });
});

describe('expiry', () => {
  it('is 72 hours after issue', () => {
    expect(INVITATION_TTL_HOURS).toBe(72);
    const now = new Date('2026-09-24T12:00:00.000Z');
    expect(invitationExpiry(now).toISOString()).toBe('2026-09-27T12:00:00.000Z');
    expect(INVITATION_TTL_MS).toBe(72 * 60 * 60 * 1000);
  });

  it('treats the boundary as expired', () => {
    const now = new Date('2026-09-24T12:00:00.000Z');
    // Exactly at the deadline counts as expired; a millisecond later is not.
    expect(isExpired(now, now)).toBe(true);
    expect(isExpired(new Date(now.getTime() + 1), now)).toBe(false);
    expect(isExpired('2026-09-27T12:00:00.000Z', now)).toBe(false);
    expect(isExpired('2026-09-23T12:00:00.000Z', now)).toBe(true);
    expect(isExpired(now, now)).toBe(true);
  });

  it('rejects a value that is not a token', () => {
    expect(isInvitationToken('short')).toBe(false);
    expect(isInvitationToken('a'.repeat(43))).toBe(true);
    expect(isInvitationToken('a'.repeat(44))).toBe(false);
  });
});

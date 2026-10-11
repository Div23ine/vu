import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Invitation tokens.
 *
 * The raw token is a 32-byte secret that exists in exactly one place: the body of
 * the invitation email. Only its SHA-256 digest is stored, so a database dump
 * cannot be used to accept an outstanding invitation. Lookup therefore hashes the
 * presented token and compares digests.
 */

export const TOKEN_BYTES = 32;
/** An invitation expires 72 hours after it is issued or resent. */
export const INVITATION_TTL_HOURS = 72;
export const INVITATION_TTL_MS = INVITATION_TTL_HOURS * 60 * 60 * 1000;

/** base64url, so the token is safe inside a URL query string. */
export function generateInvitationToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Constant-time digest comparison; unequal lengths are rejected without leaking. */
export function tokensMatch(presented: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashInvitationToken(presented), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}

export function isInvitationToken(value: string): boolean {
  // 32 bytes of base64url is 43 characters with no padding.
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function invitationExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITATION_TTL_MS);
}

export function isExpired(expiresAt: Date | string, now: Date = new Date()): boolean {
  const expiry = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  return expiry.getTime() <= now.getTime();
}

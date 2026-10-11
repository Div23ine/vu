import { createHash, randomBytes } from 'node:crypto';

/**
 * PKCE helpers for the OAuth sign-in (Task 40e).
 *
 * The verifier is 32 random bytes, base64url — 43 characters, inside the
 * RFC 7636 window of 43–64 and far above its 40-octet recommendation. The
 * challenge is `base64url(sha256(verifier))` with method `s256`: the provider
 * sees only the challenge, the API keeps only the verifier, and the code that
 * comes back is worth nothing without it.
 *
 * `state` doubles as the CSRF token AND as the Redis key that carries the
 * verifier between the two legs of the dance; it is 24 random bytes and lives
 * for ten minutes in both the cookie and Redis.
 */

export const PKCE_STATE_BYTES = 24;
export const PKCE_VERIFIER_BYTES = 32;
export const PKCE_CHALLENGE_METHOD = 's256';

/** The `state` parameter: 24 random bytes, base64url (32 characters). */
export function generateState(): string {
  return randomBytes(PKCE_STATE_BYTES).toString('base64url');
}

/** The PKCE `code_verifier`: 32 random bytes, base64url (43 characters). */
export function generateCodeVerifier(): string {
  return randomBytes(PKCE_VERIFIER_BYTES).toString('base64url');
}

/** The PKCE `code_challenge`: base64url(sha256(verifier)), method `s256`. */
export function codeChallengeFor(verifier: string): string {
  return createHash('sha256').update(verifier, 'ascii').digest('base64url');
}

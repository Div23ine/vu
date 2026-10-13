import { UserRoleSchema, type UserRole } from '@vunvault/contracts';

/**
 * JWT *peeking* — decoding the payload segment WITHOUT verification.
 *
 * SECURITY: peeking is a routing convenience, never a security decision. The
 * signature is not checked here (it cannot be, at the edge, without the
 * signing key), so a peeked role only ever decides *where an already-guarded
 * request is sent* — every authorisation decision is re-made by the API,
 * which validates the token, on every data call. A forged `vv_at` can earn a
 * redirect; it can never earn data.
 *
 * Edge-safe: base64url decoding via `atob` + `TextDecoder` (no `Buffer`).
 */

export interface PeekedClaims {
  role?: UserRole;
  exp?: number;
}

/** Decode one base64url segment to UTF-8 text. Throws on malformed input. */
function base64UrlDecode(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Extract the `role` and `exp` claims from an access token. Returns `null`
 * for anything that is not a three-segment token with a JSON object payload —
 * garbage in, `null` out, never a throw. Unknown role strings are dropped
 * (the result simply carries no `role`) rather than passed through.
 */
export function peekClaims(token: string): PeekedClaims | null {
  try {
    const segments = token.split('.');
    if (segments.length !== 3) return null;
    const payload = segments[1];
    if (payload === undefined || payload === '') return null;

    const decoded: unknown = JSON.parse(base64UrlDecode(payload));
    if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) return null;

    const record = decoded as Record<string, unknown>;
    const claims: PeekedClaims = {};
    const role = UserRoleSchema.safeParse(record.role);
    if (role.success) claims.role = role.data;
    if (typeof record.exp === 'number' && Number.isFinite(record.exp)) claims.exp = record.exp;
    return claims;
  } catch {
    return null;
  }
}

import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { z } from 'zod';
import { HttpError } from './http-error.js';

/**
 * Access-token verification.
 *
 * The token is read ONLY from the HttpOnly `vv_at` cookie — never from an
 * `Authorization` header and never from a query string. A bearer token in a URL
 * ends up in access logs, browser history and Referer headers; a token in a
 * request body ends up in Sentry. Neither is acceptable.
 *
 * Supabase signs with EITHER family, depending on the project's signing-key
 * configuration, and a project can be switched to asymmetric keys without any
 * change on our side — which is exactly what happened here. Tokens issued before
 * the switch are HS256 under the shared project JWT secret; tokens issued after
 * it are ES256 under a key published at the standard JWKS endpoint and
 * identified by `kid`. Verifying only HS256 therefore rejects every session the
 * live project issues: the magic link verifies, the cookies are set, the browser
 * is redirected, and then the first authenticated request 401s and the member is
 * bounced back to `/login`. Both families are accepted below.
 *
 * Authorization claims are deliberately NOT trusted as the source of role or
 * permissions. Supabase's optional Custom Access Token hook may add
 * `role`, `org_id` and `permissions[]`, but deployments can omit that hook
 * and still issue valid authenticated tokens. After signature verification,
 * `auth.ts` resolves the session id against the server-side session registry,
 * which joins the authoritative `profiles` row and derives permissions from
 * `ROLE_PERMISSIONS`. This keeps authorization database-backed and prevents
 * missing or stale JWT custom claims from creating a login redirect loop.
 */

export const TOKEN_AUDIENCE = 'authenticated';
export const CLOCK_TOLERANCE_SECONDS = 5;

/** Legacy symmetric family: the shared project JWT secret. */
const SYMMETRIC_ALGORITHMS = ['HS256'] as const;

/**
 * Asymmetric families Supabase can sign with. Verified against the published
 * JWKS — never against the shared secret, so the two branches below use
 * disjoint key material.
 */
const ASYMMETRIC_ALGORITHMS = [
  'ES256',
  'ES384',
  'ES512',
  'RS256',
  'RS384',
  'RS512',
  'PS256',
  'PS384',
  'PS512',
] as const;

export type AuthenticatorAssuranceLevel = 'aal1' | 'aal2';

export const TokenPayloadSchema = z.object({
  // Authorization attributes are loaded from the authoritative profiles row by
  // the session registry. Supabase's optional Custom Access Token hook must not
  // be a prerequisite for accepting a cryptographically valid session.
  sub: z.string().uuid(),
  email: z.string().email(),
  role: z.unknown().optional(),
  org_id: z.unknown().optional(),
  permissions: z.unknown().optional(),
  session_id: z.string().uuid(),
  aal: z.enum(['aal1', 'aal2']),
  exp: z.number().int().positive(),
});

export type TokenPayload = z.infer<typeof TokenPayloadSchema>;

export interface VerifiedToken {
  payload: TokenPayload;
  expiresAt: number;
}

export interface VerifyTokenOptions {
  /** The Supabase project JWT secret, for HS256 tokens. */
  secret: string;
  /** `<SUPABASE_URL>/auth/v1`. */
  issuer: string;
  /**
   * Test seam: verify asymmetric tokens against this key set instead of
   * fetching the JWKS over the network.
   */
  jwks?: JWTVerifyGetKey;
  /** Override the JWKS location. Defaults to `jwksUri(issuer)`. */
  jwksUri?: string;
}

/** Supabase issues tokens from `<project url>/auth/v1`. */
export function tokenIssuer(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/$/, '')}/auth/v1`;
}

/**
 * Where GoTrue publishes its signing keys: `<issuer>/.well-known/jwks.json`.
 * For `https://<ref>.supabase.co/auth/v1` that is the documented JWKS location,
 * and it carries the `kid` that an ES256 token's header names.
 */
export function jwksUri(issuer: string): string {
  return `${issuer.replace(/\/+$/, '')}/.well-known/jwks.json`;
}

/**
 * One cached remote key set per JWKS URI.
 *
 * `createRemoteJWKSet` already caches and refreshes keys and re-fetches on an
 * unknown `kid`, so this map exists only to stop every verification building a
 * new fetcher (and a new cache) — which would defeat the caching and hammer the
 * endpoint once per request.
 */
const remoteKeySets = new Map<string, JWTVerifyGetKey>();

function remoteKeySetFor(uri: string): JWTVerifyGetKey {
  const existing = remoteKeySets.get(uri);
  if (existing !== undefined) return existing;
  const created = createRemoteJWKSet(new URL(uri));
  remoteKeySets.set(uri, created);
  return created;
}

/**
 * Verify signature, issuer, audience and expiry, then validate the claims.
 * Any failure — including a well-formed token with unexpected claims — is a 401:
 * telling a caller *why* authentication failed would help an attacker.
 */
export async function verifyAccessToken(
  token: string,
  options: VerifyTokenOptions,
): Promise<VerifiedToken> {
  // Pick the key from the token's own `alg`, and refuse anything outside the two
  // families above rather than letting jose negotiate. Branching on a
  // caller-controlled `alg` is only safe because the branches use disjoint key
  // material: HS256 uses the shared secret, the asymmetric set uses the JWKS.
  // The classic algorithm-confusion forgery — re-signing with HS256 using the
  // public key as the HMAC secret — needs one key to serve both roles, and here
  // it cannot: an attacker who does not hold the project secret cannot produce a
  // token the HS256 branch accepts, and the JWKS branch never sees that secret.
  let algorithm: unknown;
  try {
    algorithm = decodeProtectedHeader(token).alg;
  } catch {
    throw HttpError.unauthorized();
  }

  const isSymmetric = algorithm === 'HS256';
  const isAsymmetric =
    typeof algorithm === 'string' &&
    (ASYMMETRIC_ALGORITHMS as readonly string[]).includes(algorithm);

  // `none`, an unrecognised family, or a missing header: refuse before any
  // crypto is attempted.
  if (!isSymmetric && !isAsymmetric) throw HttpError.unauthorized();

  const envelope = {
    issuer: options.issuer,
    audience: TOKEN_AUDIENCE,
    clockTolerance: CLOCK_TOLERANCE_SECONDS,
  };

  let verified;
  try {
    // Two call sites rather than one union-typed key: jose resolves its
    // overloads on the key's concrete type, so a `Uint8Array | JWTVerifyGetKey`
    // variable matches neither. Each branch also pins its own algorithm list,
    // which is what stops a token choosing a family it was not signed with.
    verified = isSymmetric
      ? await jwtVerify(token, new TextEncoder().encode(options.secret), {
          ...envelope,
          algorithms: [...SYMMETRIC_ALGORITHMS],
        })
      : await jwtVerify(token, options.jwks ?? remoteKeySetFor(options.jwksUri ?? jwksUri(options.issuer)), {
          ...envelope,
          algorithms: [...ASYMMETRIC_ALGORITHMS],
        });
  } catch {
    throw HttpError.unauthorized();
  }

  const parsed = TokenPayloadSchema.safeParse(verified.payload);
  if (!parsed.success) throw HttpError.unauthorized();

  return { payload: parsed.data, expiresAt: parsed.data.exp };
}

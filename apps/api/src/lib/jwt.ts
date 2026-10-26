import { jwtVerify } from 'jose';
import { JwtClaims } from '@vunvault/contracts';
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
 * Supabase signs with HS256 using the project JWT secret. The custom claims
 * (`role`, `org_id`, `permissions[]`) are minted by the Postgres Auth Hook in
 * `packages/db/sql/0024_auth_hook.sql`, which mirrors
 * `packages/contracts/src/permissions.ts`.
 */

export const TOKEN_AUDIENCE = 'authenticated';
export const CLOCK_TOLERANCE_SECONDS = 5;

export type AuthenticatorAssuranceLevel = 'aal1' | 'aal2';

export const TokenPayloadSchema = JwtClaims.extend({
  email: z.string().email(),
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
  /** The Supabase project JWT secret. */
  secret: string;
  /** `<SUPABASE_URL>/auth/v1`. */
  issuer: string;
}

/** Supabase issues tokens from `<project url>/auth/v1`. */
export function tokenIssuer(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/$/, '')}/auth/v1`;
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
  let verified;
  try {
    verified = await jwtVerify(token, new TextEncoder().encode(options.secret), {
      algorithms: ['HS256'],
      issuer: options.issuer,
      audience: TOKEN_AUDIENCE,
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
    });
  } catch {
    throw HttpError.unauthorized();
  }

  const parsed = TokenPayloadSchema.safeParse(verified.payload);
  if (!parsed.success) throw HttpError.unauthorized();

  return { payload: parsed.data, expiresAt: parsed.data.exp };
}

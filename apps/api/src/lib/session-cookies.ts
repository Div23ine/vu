import type { FastifyReply, FastifyRequest } from 'fastify';
import { randomBytes } from 'node:crypto';
import { COOKIE_NAMES, cookieOptions, type CookieName } from '../plugins/cookies.js';

/**
 * Session cookies.
 *
 * Tokens live in HttpOnly cookies and are NEVER returned in a JSON body and NEVER
 * stored in `localStorage`. The readable `vv_csrf` cookie is re-issued with every
 * sign-in so the double-submit pair always belongs to the same session.
 */

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  /** Access-token lifetime in seconds; drives the `vv_at` max-age. */
  expiresIn: number;
}

export interface SessionCookieContext {
  remember?: boolean;
  /** `env.NODE_ENV !== 'development'`. */
  secure?: boolean;
  /** `env.COOKIE_DOMAIN || undefined`. */
  domain?: string;
}

export interface SessionCookies {
  at?: string;
  rt?: string;
  mfa?: string;
}

export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

export function setSessionCookies(
  reply: FastifyReply,
  tokens: SessionTokens,
  context: SessionCookieContext = {},
): void {
  const { remember = false, secure = true, domain } = context;

  reply.setCookie(COOKIE_NAMES.accessToken, tokens.accessToken, {
    ...cookieOptions(COOKIE_NAMES.accessToken, { remember, secure, domain }),
    // The access token expires with the JWT, not with the 3600 s default.
    maxAge: Math.max(0, Math.floor(tokens.expiresIn)),
  });

  reply.setCookie(COOKIE_NAMES.refreshToken, tokens.refreshToken, {
    ...cookieOptions(COOKIE_NAMES.refreshToken, { remember, secure, domain }),
    // Scoped to /api/v1/auth: no other route can read it, and it is never sent
    // anywhere else.
    ...(remember ? {} : { maxAge: undefined }),
  });

  // A fresh double-submit token per session.
  reply.setCookie(COOKIE_NAMES.csrf, generateCsrfToken(), {
    ...cookieOptions(COOKIE_NAMES.csrf, { secure, domain }),
  });
}

/** Expire all four cookies, each with the same attributes it was set with. */
export function clearSessionCookies(
  reply: FastifyReply,
  context: Omit<SessionCookieContext, 'remember'> = {},
): void {
  const { secure = true, domain } = context;
  const names: CookieName[] = [
    COOKIE_NAMES.accessToken,
    COOKIE_NAMES.refreshToken,
    COOKIE_NAMES.mfaChallenge,
    COOKIE_NAMES.csrf,
  ];
  for (const name of names) {
    reply.clearCookie(name, cookieOptions(name, { secure, domain }));
  }
}

export function readSessionCookies(request: FastifyRequest): SessionCookies {
  return {
    at: request.cookies[COOKIE_NAMES.accessToken],
    rt: request.cookies[COOKIE_NAMES.refreshToken],
    mfa: request.cookies[COOKIE_NAMES.mfaChallenge],
  };
}

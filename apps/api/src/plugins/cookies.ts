import cookie from '@fastify/cookie';
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import type { Env } from '../config/env.js';

/**
 * Cookie parsing plus the one place cookie attributes are defined.
 *
 * Tokens are NEVER returned in a JSON body and NEVER stored in `localStorage`:
 * the browser can only ever see `vv_csrf`, which is not a secret on its own — it
 * proves the request came from a page on our own origin.
 */

export const COOKIE_NAMES = {
  accessToken: 'vv_at',
  refreshToken: 'vv_rt',
  mfaChallenge: 'vv_mfa',
  csrf: 'vv_csrf',
} as const;

export type CookieName = (typeof COOKIE_NAMES)[keyof typeof COOKIE_NAMES];

/** Presence of any of these makes a request "session-bound" for CSRF purposes. */
export const SESSION_COOKIES: readonly CookieName[] = [
  COOKIE_NAMES.accessToken,
  COOKIE_NAMES.refreshToken,
  COOKIE_NAMES.mfaChallenge,
];

const DAY_SECONDS = 24 * 60 * 60;

/** Max-age in seconds per cookie; `undefined` means a session cookie. */
export const COOKIE_MAX_AGE: Record<CookieName, number | undefined> = {
  vv_at: 3600,
  vv_rt: 30 * DAY_SECONDS,
  vv_mfa: 300,
  vv_csrf: undefined,
};

export const COOKIE_PATHS: Record<CookieName, string> = {
  vv_at: '/',
  vv_rt: '/api/v1/auth',
  vv_mfa: '/api/v1/auth',
  vv_csrf: '/',
};

export interface CookieSerializeOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none' | boolean;
  path?: string;
  maxAge?: number;
  domain?: string;
}

export interface CookieOptionsInput {
  /** Only meaningful for `vv_rt`: 30 days when remembered, session otherwise. */
  remember?: boolean;
  /** `env.NODE_ENV !== 'development'` in practice. */
  secure?: boolean;
  /** `env.COOKIE_DOMAIN || undefined`. */
  domain?: string;
}

/** The attribute table from the security specification, as code. */
export function cookieOptions(
  name: CookieName,
  options: CookieOptionsInput = {},
): CookieSerializeOptions {
  const { remember = false, secure = true, domain } = options;
  const isRefresh = name === COOKIE_NAMES.refreshToken;
  const maxAge = isRefresh && !remember ? undefined : COOKIE_MAX_AGE[name];

  return {
    // `vv_csrf` must be readable by script for the double-submit check.
    httpOnly: name !== COOKIE_NAMES.csrf,
    secure,
    sameSite:
      name === COOKIE_NAMES.refreshToken || name === COOKIE_NAMES.mfaChallenge ? 'strict' : 'lax',
    path: COOKIE_PATHS[name],
    ...(maxAge === undefined ? {} : { maxAge }),
    ...(domain === undefined || domain === '' ? {} : { domain }),
  };
}

export type CookieOptionsResolver = (
  name: CookieName,
  options?: Pick<CookieOptionsInput, 'remember'>,
) => CookieSerializeOptions;

/** Build a resolver bound to the environment's secure/domain settings. */
export function createCookieOptionsResolver(env: Env): CookieOptionsResolver {
  return (name, options = {}) =>
    cookieOptions(name, {
      ...options,
      secure: env.NODE_ENV !== 'development',
      domain: env.COOKIE_DOMAIN === '' ? undefined : env.COOKIE_DOMAIN,
    });
}

const cookiesPlugin: FastifyPluginAsync = async (app) => {
  await app.register(cookie);
  app.decorate('cookieOptions', createCookieOptionsResolver(app.env));
};

export default fp(cookiesPlugin, { name: 'cookies' });

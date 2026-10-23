import { randomBytes, timingSafeEqual } from 'node:crypto';
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { HttpError } from '../lib/http-error';
import { COOKIE_NAMES, SESSION_COOKIES } from './cookies';

/**
 * Double-submit CSRF, stateless.
 *
 * A mutating request that carries a session cookie must present the readable
 * `vv_csrf` cookie value in the `x-csrf-token` header. A cross-site form can send
 * the cookie but cannot read it, so it cannot forge the header. Requests with no
 * session cookie are public forms — they are protected by rate limits instead.
 *
 * Comparison is constant-time; a length mismatch is rejected before `timingSafeEqual`
 * is called, which is itself safe because the length is not secret.
 */

export const CSRF_HEADER = 'x-csrf-token';
export const CSRF_COOKIE = COOKIE_NAMES.csrf;
export const CSRF_TOKEN_BYTES = 32;

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Route opt-out: webhooks sign their own payloads, node heartbeats are signed. */
export const CSRF_EXEMPT_ROUTES: readonly string[] = [
  '/api/v1/webhooks/stripe',
  '/api/v1/webhooks/paystack',
  '/api/v1/nodes/heartbeat',
];

export function generateCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_BYTES).toString('hex');
}

export function tokensMatch(header: string, cookieValue: string): boolean {
  const headerBuffer = Buffer.from(header);
  const cookieBuffer = Buffer.from(cookieValue);
  if (headerBuffer.length !== cookieBuffer.length) return false;
  return timingSafeEqual(headerBuffer, cookieBuffer);
}

export function carriesSessionCookie(cookies: Record<string, string | undefined>): boolean {
  return SESSION_COOKIES.some((name) => cookies[name] !== undefined);
}

const csrfPlugin: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', async (request) => {
    if (!MUTATING_METHODS.has(request.method)) return;

    const config = request.routeOptions?.config;
    if (config?.csrf === false) return;
    if (config?.rateLimitPolicy === 'webhook') return;
    if (CSRF_EXEMPT_ROUTES.includes(request.url.split('?')[0] ?? '')) return;

    if (!carriesSessionCookie(request.cookies)) return;

    const header = request.headers[CSRF_HEADER];
    const cookieValue = request.cookies[CSRF_COOKIE];
    if (
      typeof header !== 'string' ||
      cookieValue === undefined ||
      !tokensMatch(header, cookieValue)
    ) {
      throw HttpError.forbidden('csrf_failed', 'CSRF validation failed');
    }
  });

  /** Issues the readable CSRF cookie. Idempotent: an existing token is returned. */
  app.get('/api/v1/auth/csrf', async (request, reply) => {
    const existing = request.cookies[CSRF_COOKIE];
    const token = existing !== undefined && existing !== '' ? existing : generateCsrfToken();

    if (existing === undefined || existing === '') {
      reply.setCookie(CSRF_COOKIE, token, app.cookieOptions(CSRF_COOKIE));
    }
    return { data: { csrfToken: token } };
  });
};

export default fp(csrfPlugin, { name: 'csrf', dependencies: ['cookies'] });

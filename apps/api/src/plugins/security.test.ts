import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { buildApp, type App } from '../app.js';
import type { Env } from '../config/env.js';
import {
  COOKIE_MAX_AGE,
  COOKIE_NAMES,
  COOKIE_PATHS,
  SESSION_COOKIES,
  cookieOptions,
  createCookieOptionsResolver,
} from './cookies.js';
import {
  GLOBAL_RATE_LIMIT,
  LOGIN_IP_POLICY,
  RATE_POLICIES,
  isTrustedPeer,
  loginKey,
  memoryCounterStore,
  resolveClientIp,
} from './rate-limit.js';
import { SENTRY_REDACTED_BODY_FIELDS, SENTRY_REDACTED_HEADERS, scrubEvent } from './sentry.js';
import { carriesSessionCookie, CSRF_HEADER, generateCsrfToken, tokensMatch } from './csrf.js';

const WEB_ORIGIN = 'https://www.vunvault.test';

const TEST_ENV: Env = {
  NODE_ENV: 'test',
  PORT: 8080,
  LOG_LEVEL: 'fatal',
  WEB_ORIGIN,
  COOKIE_DOMAIN: '.vunvault.test',
  API_PUBLIC_URL: 'https://api.vunvault.test',
  SECRETS_PROVIDER: 'env',
  SUPABASE_URL: 'https://project.supabase.co',
  WEBAUTHN_RP_ID: 'vunvault.test',
  WEBAUTHN_RP_NAME: 'VUNVAULT',
  R2_ACCOUNT_ID: 'r2-account',
  R2_BUCKET: 'vunvault-media',
  R2_PUBLIC_BASE_URL: 'https://cdn.vunvault.test',
  SENTRY_DSN: undefined,
  OCI_SECRET_MAP: undefined,
};

async function makeApp(overrides: Partial<Env> = {}): Promise<App> {
  const app = await buildApp({
    env: { ...TEST_ENV, ...overrides },
    overrides: { logger: false },
    infra: false,
  });

  app.post('/__test/mutate', async () => ({ data: { ok: true } }));
  app.post(
    '/__test/login',
    {
      config: { rateLimitPolicy: 'login', csrf: false },
      schema: { body: z.object({ email: z.string().email(), password: z.string() }) },
    },
    async () => ({ data: { ok: true } }),
  );
  app.post(
    '/__test/webhook',
    { config: { rateLimitPolicy: 'webhook', csrf: false, rawBody: true } },
    async (request) => ({ data: { raw: request.rawBody?.length ?? 0 } }),
  );
  app.post(
    '/__test/contact',
    { config: { rateLimitPolicy: 'public_form', csrf: false } },
    async () => ({
      data: { ok: true },
    }),
  );

  return app;
}

describe('cookie policy', () => {
  it('names the four cookies exactly', () => {
    expect(COOKIE_NAMES).toEqual({
      accessToken: 'vv_at',
      refreshToken: 'vv_rt',
      mfaChallenge: 'vv_mfa',
      csrf: 'vv_csrf',
    });
    expect(SESSION_COOKIES).toEqual(['vv_at', 'vv_rt', 'vv_mfa']);
    expect(COOKIE_PATHS).toEqual({
      vv_at: '/',
      vv_rt: '/api/v1/auth',
      vv_mfa: '/api/v1/auth',
      vv_csrf: '/',
    });
    expect(COOKIE_MAX_AGE).toEqual({
      vv_at: 3600,
      vv_rt: 2592000,
      vv_mfa: 300,
      vv_csrf: undefined,
    });
  });

  it('is HttpOnly everywhere except the double-submit CSRF cookie', () => {
    expect(cookieOptions('vv_at').httpOnly).toBe(true);
    expect(cookieOptions('vv_rt').httpOnly).toBe(true);
    expect(cookieOptions('vv_mfa').httpOnly).toBe(true);
    // Script must be able to read it, or the double-submit check is impossible.
    expect(cookieOptions('vv_csrf').httpOnly).toBe(false);
  });

  it('uses Strict for the refresh and MFA cookies and Lax for the others', () => {
    expect(cookieOptions('vv_rt').sameSite).toBe('strict');
    expect(cookieOptions('vv_mfa').sameSite).toBe('strict');
    expect(cookieOptions('vv_at').sameSite).toBe('lax');
    expect(cookieOptions('vv_csrf').sameSite).toBe('lax');
  });

  it('makes the refresh cookie a session cookie unless remembered', () => {
    expect(cookieOptions('vv_rt').maxAge).toBeUndefined();
    expect(cookieOptions('vv_rt', { remember: true }).maxAge).toBe(30 * 24 * 60 * 60);
    expect(cookieOptions('vv_at').maxAge).toBe(3600);
    expect(cookieOptions('vv_mfa').maxAge).toBe(300);
    expect(cookieOptions('vv_csrf').maxAge).toBeUndefined();
  });

  it('is Secure by default and scoped to the cookie domain', () => {
    expect(cookieOptions('vv_at')).toMatchObject({ secure: true });
    // No domain attribute at all means "host only".
    expect(cookieOptions('vv_at')).not.toHaveProperty('domain');
    expect(cookieOptions('vv_at', { secure: false }).secure).toBe(false);
    expect(cookieOptions('vv_at', { domain: '.vunvault.test' }).domain).toBe('.vunvault.test');

    const resolver = createCookieOptionsResolver(TEST_ENV);
    expect(resolver('vv_at')).toMatchObject({ secure: true, domain: '.vunvault.test' });
    // In development the API runs over plain http on localhost.
    const development = createCookieOptionsResolver({ ...TEST_ENV, NODE_ENV: 'development' });
    expect(development('vv_at').secure).toBe(false);
    // An empty COOKIE_DOMAIN means "host only" — the attribute must be omitted.
    const hostOnly = createCookieOptionsResolver({ ...TEST_ENV, COOKIE_DOMAIN: '' });
    expect(hostOnly('vv_at').domain).toBeUndefined();
  });

  it('detects a session-bound request', () => {
    expect(carriesSessionCookie({})).toBe(false);
    expect(carriesSessionCookie({ vv_csrf: 'x' })).toBe(false);
    expect(carriesSessionCookie({ vv_at: 'x' })).toBe(true);
    expect(carriesSessionCookie({ vv_rt: 'x' })).toBe(true);
    expect(carriesSessionCookie({ vv_mfa: 'x' })).toBe(true);
  });
});

describe('CSRF', () => {
  it('generates a 64-character hex token and compares in constant time', () => {
    const token = generateCsrfToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(tokensMatch(token, token)).toBe(true);
    expect(tokensMatch(token, generateCsrfToken())).toBe(false);
    expect(tokensMatch('short', token)).toBe(false);
  });

  it('rejects a session-bound mutation without the header', async () => {
    const app = await makeApp();
    const response = await app.inject({
      method: 'POST',
      url: '/__test/mutate',
      headers: { cookie: 'vv_at=access-token' },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'csrf_failed' });
    await app.close();
  });

  it('rejects a header that does not match the cookie', async () => {
    const app = await makeApp();
    const response = await app.inject({
      method: 'POST',
      url: '/__test/mutate',
      headers: {
        cookie: `vv_at=access-token; ${COOKIE_NAMES.csrf}=${'a'.repeat(64)}`,
        [CSRF_HEADER]: 'b'.repeat(64),
      },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'csrf_failed' });
    await app.close();
  });

  it('accepts a session-bound mutation with a matching header', async () => {
    const app = await makeApp();
    const token = generateCsrfToken();
    const response = await app.inject({
      method: 'POST',
      url: '/__test/mutate',
      headers: {
        cookie: `vv_at=access-token; ${COOKIE_NAMES.csrf}=${token}`,
        [CSRF_HEADER]: token,
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: { ok: true } });
    await app.close();
  });

  it('lets a cookie-less public form through', async () => {
    const app = await makeApp();
    const response = await app.inject({ method: 'POST', url: '/__test/mutate' });
    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it('never checks CSRF on a GET', async () => {
    const app = await makeApp();
    const response = await app.inject({
      method: 'GET',
      url: '/healthz',
      headers: { cookie: 'vv_at=access-token' },
    });
    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it('issues the CSRF cookie once and then returns the same token', async () => {
    const app = await makeApp();

    const first = await app.inject({ method: 'GET', url: '/api/v1/auth/csrf' });
    expect(first.statusCode).toBe(200);
    const body = first.json() as { data: { csrfToken: string } };
    expect(body.data.csrfToken).toMatch(/^[0-9a-f]{64}$/);
    const setCookie = String(first.headers['set-cookie']);
    expect(setCookie).toContain(`${COOKIE_NAMES.csrf}=`);
    // Readable by script, so NOT HttpOnly; Lax, root path, session lifetime.
    expect(setCookie.toLowerCase()).not.toContain('httponly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Path=/');
    expect(setCookie.toLowerCase()).not.toContain('max-age');

    const second = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/csrf',
      headers: { cookie: `${COOKIE_NAMES.csrf}=${body.data.csrfToken}` },
    });
    expect((second.json() as { data: { csrfToken: string } }).data.csrfToken).toBe(
      body.data.csrfToken,
    );
    expect(second.headers['set-cookie']).toBeUndefined();
    await app.close();
  });
});

describe('CORS', () => {
  it('answers the configured origin and nobody else', async () => {
    const app = await makeApp();

    const allowed = await app.inject({
      method: 'OPTIONS',
      url: '/healthz',
      headers: { origin: WEB_ORIGIN, 'access-control-request-method': 'POST' },
    });
    expect(allowed.headers['access-control-allow-origin']).toBe(WEB_ORIGIN);
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    expect(String(allowed.headers['access-control-allow-methods'])).toContain('PATCH');
    expect(String(allowed.headers['access-control-allow-headers'])).toContain('X-CSRF-Token');
    expect(String(allowed.headers['access-control-expose-headers'])).toContain('Retry-After');
    expect(allowed.headers['access-control-max-age']).toBe('600');

    const rejected = await app.inject({
      method: 'GET',
      url: '/healthz',
      headers: { origin: 'https://evil.example' },
    });
    expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
    await app.close();
  });

  it('never reflects a wildcard origin', async () => {
    const app = await makeApp();
    const response = await app.inject({
      method: 'GET',
      url: '/healthz',
      headers: { origin: 'https://evil.example' },
    });
    expect(response.headers['access-control-allow-origin']).not.toBe('*');
    await app.close();
  });
});

describe('security headers', () => {
  it('sets the hardened header set', async () => {
    const app = await makeApp();
    const response = await app.inject({ method: 'GET', url: '/healthz' });
    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
    expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(response.headers['strict-transport-security']).toContain('max-age=63072000');
    expect(response.headers['strict-transport-security']).toContain('includeSubDomains');
    expect(response.headers['strict-transport-security']).toContain('preload');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['cross-origin-resource-policy']).toBe('same-site');
    expect(response.headers['x-frame-options']).toBe('DENY');
    await app.close();
  });

  it('lifts the CSP for the docs UI outside production only', async () => {
    const app = await makeApp();
    const docs = await app.inject({ method: 'GET', url: '/docs/static/main.js' });
    expect(docs.headers['content-security-policy']).toBeUndefined();
    const api = await app.inject({ method: 'GET', url: '/healthz' });
    expect(api.headers['content-security-policy']).toBeDefined();
    await app.close();
  });
});

describe('raw body', () => {
  it('captures the exact bytes for a route that opts in', async () => {
    const app = await makeApp();
    const payload = '{"signed":"payload"}';
    const response = await app.inject({
      method: 'POST',
      url: '/__test/webhook',
      headers: { 'content-type': 'application/json' },
      payload,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: { raw: Buffer.byteLength(payload) } });
    await app.close();
  });
});

describe('rate limits', () => {
  it('exposes the documented policies', () => {
    expect(GLOBAL_RATE_LIMIT).toEqual({ max: 300, windowSeconds: 60 });
    expect(RATE_POLICIES.login).toEqual({ max: 5, windowSeconds: 60 });
    expect(RATE_POLICIES.public_form).toEqual({ max: 5, windowSeconds: 600 });
    expect(RATE_POLICIES.sensitive).toEqual({ max: 10, windowSeconds: 60 });
    expect(RATE_POLICIES.webhook).toBe(false);
    expect(LOGIN_IP_POLICY).toEqual({ max: 20, windowSeconds: 900 });
  });

  it('blocks the sixth login attempt within a minute and sends Retry-After', async () => {
    const app = await makeApp();
    const payload = { email: 'admin@vunvault.com', password: 'whatever-1!' };

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/__test/login',
        headers: { 'cf-connecting-ip': '41.90.64.199' },
        payload,
      });
      expect(response.statusCode, `attempt ${attempt}`).toBe(200);
    }

    const blocked = await app.inject({
      method: 'POST',
      url: '/__test/login',
      headers: { 'cf-connecting-ip': '41.90.64.199' },
      payload,
    });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json()).toMatchObject({ error: 'rate_limited' });
    const retryAfter = Number(blocked.headers['retry-after']);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
    await app.close();
  });

  it('keys the login policy by ip plus a hash of the email', () => {
    const key = loginKey('41.90.64.199', 'Admin@VUNVAULT.com ');
    expect(key).toBe(loginKey('41.90.64.199', 'admin@vunvault.com'));
    expect(key).not.toBe(loginKey('41.90.64.200', 'admin@vunvault.com'));
    expect(key).not.toBe(loginKey('41.90.64.199', 'other@vunvault.com'));
    // The raw address never appears in the key.
    expect(key).not.toContain('admin@vunvault.com');
    expect(key.startsWith('login:41.90.64.199:')).toBe(true);
  });

  it('counts a different email separately', async () => {
    const app = await makeApp();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await app.inject({
        method: 'POST',
        url: '/__test/login',
        headers: { 'cf-connecting-ip': '10.0.0.9' },
        payload: { email: 'one@vunvault.com', password: 'whatever-1!' },
      });
    }
    const other = await app.inject({
      method: 'POST',
      url: '/__test/login',
      headers: { 'cf-connecting-ip': '10.0.0.9' },
      payload: { email: 'two@vunvault.com', password: 'whatever-1!' },
    });
    expect(other.statusCode).toBe(200);
    await app.close();
  });

  it('exempts webhook routes from both CSRF and named policies', async () => {
    const app = await makeApp();
    const response = await app.inject({
      method: 'POST',
      url: '/__test/webhook',
      headers: { cookie: 'vv_at=access-token', 'content-type': 'application/json' },
      payload: '{"signed":"payload"}',
    });
    expect(response.statusCode).toBe(200);
    await app.close();
  });
});

describe('client IP resolution', () => {
  it('trusts CF-Connecting-IP only from a trusted peer', () => {
    expect(isTrustedPeer('127.0.0.1')).toBe(true);
    expect(isTrustedPeer('::1')).toBe(true);
    expect(isTrustedPeer('10.244.1.9')).toBe(true);
    expect(isTrustedPeer('192.168.0.1')).toBe(true);
    expect(isTrustedPeer('41.90.64.199')).toBe(false);
    expect(isTrustedPeer(undefined)).toBe(false);

    const behindProxy = {
      ip: '10.244.1.9',
      socket: { remoteAddress: '10.244.1.9' },
      headers: { 'cf-connecting-ip': '41.90.64.199' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    expect(resolveClientIp(behindProxy)).toBe('41.90.64.199');

    const spoofed = {
      ip: '41.90.64.199',
      socket: { remoteAddress: '41.90.64.199' },
      headers: { 'cf-connecting-ip': '8.8.8.8' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    expect(resolveClientIp(spoofed)).toBe('41.90.64.199');
  });

  it('counts windows in memory for tests', async () => {
    let clock = 0;
    const store = memoryCounterStore(() => clock);
    expect(await store.increment('k', 60)).toEqual({ count: 1, resetSeconds: 60 });
    expect(await store.increment('k', 60)).toMatchObject({ count: 2 });
    clock += 61_000;
    expect(await store.increment('k', 60)).toMatchObject({ count: 1 });
  });
});

describe('Sentry scrubbing', () => {
  it('strips credential headers, cookies and secret body fields', () => {
    const event = {
      request: {
        headers: {
          Cookie: 'vv_at=secret',
          authorization: 'Bearer token',
          'x-csrf-token': 'abc',
          'content-type': 'application/json',
        },
        cookies: { vv_at: 'secret' },
        data: {
          email: 'admin@vunvault.com',
          password: 'hunter2',
          currentPassword: 'hunter1',
          newPassword: 'hunter3',
          confirmPassword: 'hunter3',
          code: '481920',
          recoveryAnswer: 'Simba',
          token: 'rt_abc',
          note: 'keep me',
        },
      },
    };

    const scrubbed = scrubEvent(event);
    for (const header of SENTRY_REDACTED_HEADERS) {
      const headers = (scrubbed.request?.headers ?? {}) as Record<string, unknown>;
      const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === header);
      expect(headers[key as string]).toBe('[Filtered]');
    }
    expect((scrubbed.request?.headers as Record<string, unknown>)['content-type']).toBe(
      'application/json',
    );
    expect(scrubbed.request?.cookies).toBe('[Filtered]');

    const data = scrubbed.request?.data as Record<string, unknown>;
    for (const field of SENTRY_REDACTED_BODY_FIELDS) {
      expect(data[field], field).toBe('[Filtered]');
    }
    expect(data.email).toBe('admin@vunvault.com');
    expect(data.note).toBe('keep me');
  });

  it('tolerates an event without a request and captures only 5xx', async () => {
    expect(scrubEvent({})).toEqual({});
    expect(scrubEvent({ request: { data: 'plain string' } })).toEqual({
      request: { data: 'plain string' },
    });

    const captured: Array<{ error: unknown; requestId: string }> = [];
    const app = await buildApp({
      env: TEST_ENV,
      overrides: { logger: false },
      infra: false,
      sentryOptions: {
        capture: (error, requestId) => {
          captured.push({ error, requestId });
        },
      },
    });
    app.get('/__test/boom', async () => {
      throw new Error('boom');
    });
    app.get('/__test/teapot', async () => {
      const { HttpError } = await import('../lib/http-error');
      throw new HttpError(418, 'teapot', 'I am a teapot');
    });

    await app.inject({ method: 'GET', url: '/__test/boom' });
    expect(captured).toHaveLength(1);
    expect(captured[0]?.requestId).toBeDefined();

    await app.inject({ method: 'GET', url: '/__test/teapot' });
    expect(captured).toHaveLength(1);
    await app.close();
  });

  it('does not initialise the SDK without a DSN', async () => {
    const init = vi.fn();
    const app = await buildApp({
      env: TEST_ENV,
      overrides: { logger: false },
      infra: false,
      sentryOptions: { dsn: undefined, capture: init },
    });
    app.get('/__test/boom', async () => {
      throw new Error('boom');
    });
    await app.inject({ method: 'GET', url: '/__test/boom' });
    expect(init).toHaveBeenCalledTimes(1);
    await app.close();
  });
});

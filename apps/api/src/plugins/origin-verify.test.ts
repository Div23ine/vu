import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../config/env';
import originVerifyPlugin, { ORIGIN_VERIFY_HEADER } from './origin-verify';
import { resolveClientIp } from './rate-limit';

/**
 * The edge origin lock's API half (Task 99).
 *
 * The interesting assertions are the refusals: production without the header,
 * production with the WRONG header, production when the secret cannot be
 * read (fail closed), and the exemption list that exists for cluster probes
 * and nothing else. Plus the pairing with `resolveClientIp`: an unverified
 * request must not be able to choose its own rate-limit bucket.
 */

const SECRET = 'edge-shared-secret-value';

function envFor(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: 'production',
    PORT: 8080,
    LOG_LEVEL: 'fatal',
    WEB_ORIGIN: 'https://www.vunvault.test',
    COOKIE_DOMAIN: '',
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
    ...overrides,
  } as Env;
}

async function makeApp(
  options: {
    env?: Env;
    secret?: () => Promise<string>;
  } = {},
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.decorate('env', options.env ?? envFor());
  const get = options.secret ?? (async () => SECRET);
  await app.register(originVerifyPlugin, { secrets: { get } });
  app.get('/healthz', async () => ({ ok: true }));
  app.get('/readyz', async () => ({ ok: true }));
  app.get('/api/v1/probe', async (request) => ({ verified: request.originVerified === true }));
  app.post('/api/v1/probe', async () => ({ ok: true }));
  await app.ready();
  return app;
}

let app: FastifyInstance | null = null;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(async () => {
  vi.useRealTimers();
  await app?.close();
  app = null;
});

describe('origin-verify — production enforcement', () => {
  it('a request with the secret passes and is marked verified', async () => {
    app = await makeApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/probe',
      headers: { [ORIGIN_VERIFY_HEADER]: SECRET },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ verified: true });
  });

  it('a missing header is a bare 403 envelope', async () => {
    app = await makeApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/probe' });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'forbidden' });
  });

  it('a wrong header is a 403, including a prefix of the secret', async () => {
    app = await makeApp();
    for (const attempt of ['nope', SECRET.slice(0, -1), `${SECRET}!`, '']) {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/probe',
        headers: { [ORIGIN_VERIFY_HEADER]: attempt },
      });
      expect(response.statusCode).toBe(403);
    }
  });

  it('mutations are covered too', async () => {
    app = await makeApp();
    const response = await app.inject({ method: 'POST', url: '/api/v1/probe' });
    expect(response.statusCode).toBe(403);
  });

  it('exempts exactly GET /healthz and GET /readyz (cluster probes)', async () => {
    app = await makeApp();
    expect((await app.inject({ method: 'GET', url: '/healthz' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/readyz' })).statusCode).toBe(200);
    // A probe path with a query string is still the probe; a POST is not.
    expect((await app.inject({ method: 'GET', url: '/healthz?x=1' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/healthz' })).statusCode).toBe(403);
  });

  it('fails CLOSED when the secret cannot be read', async () => {
    app = await makeApp({
      secret: async () => {
        throw new Error('vault unreachable');
      },
    });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/probe',
      headers: { [ORIGIN_VERIFY_HEADER]: SECRET },
    });
    expect(response.statusCode).toBe(403);
  });

  it('caches the secret for five minutes and re-reads after', async () => {
    const get = vi.fn(async () => SECRET);
    app = await makeApp({ secret: get });

    for (let i = 0; i < 5; i += 1) {
      await app.inject({
        method: 'GET',
        url: '/api/v1/probe',
        headers: { [ORIGIN_VERIFY_HEADER]: SECRET },
      });
    }
    expect(get).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    await app.inject({
      method: 'GET',
      url: '/api/v1/probe',
      headers: { [ORIGIN_VERIFY_HEADER]: SECRET },
    });
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('ORIGIN_VERIFY_ENFORCE=false stands the lock down', async () => {
    app = await makeApp({ env: envFor({ ORIGIN_VERIFY_ENFORCE: 'false' }) });
    const response = await app.inject({ method: 'GET', url: '/api/v1/probe' });
    expect(response.statusCode).toBe(200);
  });
});

describe('origin-verify — development', () => {
  it('is off outside production, and requests count as verified', async () => {
    app = await makeApp({ env: envFor({ NODE_ENV: 'test' }) });
    const response = await app.inject({ method: 'GET', url: '/api/v1/probe' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ verified: true });
  });
});

describe('origin-verify × resolveClientIp', () => {
  it('an explicitly unverified request cannot choose its rate-limit bucket', () => {
    const unverified = {
      ip: '10.244.1.9',
      socket: { remoteAddress: '10.244.1.9' },
      headers: { 'cf-connecting-ip': '41.90.64.199' },
      originVerified: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    expect(resolveClientIp(unverified)).toBe('10.244.1.9');

    const verified = { ...unverified, originVerified: true };
    expect(resolveClientIp(verified)).toBe('41.90.64.199');

    // `undefined` — no plugin in this harness — keeps the Task 23 rule.
    const harnessOnly = { ...unverified, originVerified: undefined };
    expect(resolveClientIp(harnessOnly)).toBe('41.90.64.199');
  });
});

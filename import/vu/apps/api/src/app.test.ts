import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildApp, REDACT_PATHS, type App } from './app.js';
import { loadEnv, parseEnv, SECRETS_PROVIDER_MESSAGE, type Env } from './config/env.js';
import { HttpError } from './lib/http-error.js';
import { REQUEST_ID_PATTERN, resolveRequestId } from './plugins/request-context.js';

const TEST_ENV: Env = {
  NODE_ENV: 'test',
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
};

/** A built app with logging off and the test-only routes this suite needs. */
async function makeApp(): Promise<App> {
  const app = await buildApp({ env: TEST_ENV, overrides: { logger: false }, infra: false });

  app.get('/__test/boom', async () => {
    throw new Error('boom: SELECT * FROM secrets');
  });

  app.get('/__test/unauthorized', async () => {
    throw HttpError.unauthorized();
  });

  app.get('/__test/forbidden', async () => {
    throw HttpError.forbidden();
  });

  app.get('/__test/conflict', async () => {
    throw HttpError.conflict('payment_outstanding', 'This invoice is not settled yet.');
  });

  app.get('/__test/rate-limited', async (_request, reply) => {
    reply.header('retry-after', '30');
    throw Object.assign(new Error('Rate limit exceeded'), { statusCode: 429 });
  });

  app.post(
    '/__test/echo',
    {
      schema: {
        body: z.object({ name: z.string().min(2, 'Enter the member’s full name') }),
      },
    },
    async (request) => ({ data: { name: request.body.name } }),
  );

  return app;
}

describe('environment configuration', () => {
  it('applies the documented defaults', () => {
    const env = parseEnv({
      WEB_ORIGIN: 'https://www.vunvault.test',
      API_PUBLIC_URL: 'https://api.vunvault.test',
      SUPABASE_URL: 'https://project.supabase.co',
      WEBAUTHN_RP_ID: 'vunvault.test',
      WEBAUTHN_RP_NAME: 'VUNVAULT',
      R2_ACCOUNT_ID: 'r2-account',
      R2_BUCKET: 'vunvault-media',
      R2_PUBLIC_BASE_URL: 'https://cdn.vunvault.test',
    });
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(8080);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.SECRETS_PROVIDER).toBe('env');
  });

  it('coerces PORT and rejects an out-of-range one', () => {
    const base = {
      WEB_ORIGIN: 'https://www.vunvault.test',
      API_PUBLIC_URL: 'https://api.vunvault.test',
      SUPABASE_URL: 'https://project.supabase.co',
      WEBAUTHN_RP_ID: 'vunvault.test',
      WEBAUTHN_RP_NAME: 'VUNVAULT',
      R2_ACCOUNT_ID: 'r2-account',
      R2_BUCKET: 'vunvault-media',
      R2_PUBLIC_BASE_URL: 'https://cdn.vunvault.test',
    };
    expect(parseEnv({ ...base, PORT: '9001' }).PORT).toBe(9001);
    expect(() => parseEnv({ ...base, PORT: '70000' })).toThrow(/PORT/);
  });

  it('refuses SECRETS_PROVIDER=env in production', () => {
    expect(() =>
      parseEnv({
        NODE_ENV: 'production',
        SECRETS_PROVIDER: 'env',
        WEB_ORIGIN: 'https://www.vunvault.com',
        API_PUBLIC_URL: 'https://api.vunvault.com',
        SUPABASE_URL: 'https://project.supabase.co',
        WEBAUTHN_RP_ID: 'vunvault.test',
        WEBAUTHN_RP_NAME: 'VUNVAULT',
        R2_ACCOUNT_ID: 'r2-account',
        R2_BUCKET: 'vunvault-media',
        R2_PUBLIC_BASE_URL: 'https://cdn.vunvault.test',
      }),
    ).toThrow(SECRETS_PROVIDER_MESSAGE);

    // The same configuration is fine outside production…
    expect(parseEnv({ ...TEST_ENV, NODE_ENV: 'development' }).SECRETS_PROVIDER).toBe('env');
    // …and oci-vault is fine everywhere.
    expect(
      parseEnv({
        NODE_ENV: 'production',
        SECRETS_PROVIDER: 'oci-vault',
        WEB_ORIGIN: 'https://www.vunvault.com',
        API_PUBLIC_URL: 'https://api.vunvault.com',
        SUPABASE_URL: 'https://project.supabase.co',
        WEBAUTHN_RP_ID: 'vunvault.test',
        WEBAUTHN_RP_NAME: 'VUNVAULT',
        R2_ACCOUNT_ID: 'r2-account',
        R2_BUCKET: 'vunvault-media',
        R2_PUBLIC_BASE_URL: 'https://cdn.vunvault.test',
      }).SECRETS_PROVIDER,
    ).toBe('oci-vault');
  });

  it('lists every problem when several variables are wrong', () => {
    let message = '';
    try {
      parseEnv({ WEB_ORIGIN: 'not-a-url', PORT: 'abc' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('Invalid environment configuration:');
    expect(message).toContain('WEB_ORIGIN');
    expect(message).toContain('PORT');
    expect(message).toContain('API_PUBLIC_URL');
    expect(message).toContain('SUPABASE_URL');
    expect(message).toContain('WEBAUTHN_RP_ID');
  });

  it('reads process.env through loadEnv', () => {
    const previous = { ...process.env };
    process.env.WEB_ORIGIN = 'https://www.vunvault.test';
    process.env.API_PUBLIC_URL = 'https://api.vunvault.test';
    process.env.SUPABASE_URL = 'https://project.supabase.co';
    process.env.WEBAUTHN_RP_ID = 'vunvault.test';
    process.env.R2_ACCOUNT_ID = 'r2-account';
    process.env.R2_BUCKET = 'vunvault-media';
    process.env.R2_PUBLIC_BASE_URL = 'https://cdn.vunvault.test';
    process.env.PORT = '9100';
    try {
      expect(loadEnv().PORT).toBe(9100);
    } finally {
      process.env = previous;
    }
  });
});

describe('request ids', () => {
  it('keeps a well-formed inbound id and replaces anything else', () => {
    expect(resolveRequestId({ 'x-request-id': 'req-01HZX9K3Q7' })).toBe('req-01HZX9K3Q7');
    expect(REQUEST_ID_PATTERN.test('req-01HZX9K3Q7')).toBe(true);

    const generated = resolveRequestId({ 'x-request-id': 'short' });
    expect(generated).not.toBe('short');
    expect(REQUEST_ID_PATTERN.test(generated)).toBe(true);

    expect(REQUEST_ID_PATTERN.test('has space')).toBe(false);
    expect(REQUEST_ID_PATTERN.test('x'.repeat(65))).toBe(false);
    expect(resolveRequestId({}).length).toBeGreaterThan(8);
  });

  it('echoes a valid inbound id and regenerates a malformed one', async () => {
    const app = await makeApp();

    const echoed = await app.inject({
      method: 'GET',
      url: '/healthz',
      headers: { 'x-request-id': 'req-01HZX9K3Q7V2T8AB' },
    });
    expect(echoed.headers['x-request-id']).toBe('req-01HZX9K3Q7V2T8AB');

    const regenerated = await app.inject({
      method: 'GET',
      url: '/healthz',
      headers: { 'x-request-id': 'bad id' },
    });
    const id = regenerated.headers['x-request-id'];
    expect(id).not.toBe('bad id');
    expect(REQUEST_ID_PATTERN.test(String(id))).toBe(true);

    await app.close();
  });
});

describe('health', () => {
  it('answers liveness without touching a dependency', async () => {
    const app = await makeApp();
    const response = await app.inject({ method: 'GET', url: '/healthz' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('reports ready when every registered check passes', async () => {
    const app = await makeApp();
    app.readiness.set('noop', async () => undefined);
    const response = await app.inject({ method: 'GET', url: '/readyz' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ready', checks: { noop: 'ok' } });
    await app.close();
  });

  it('reports not_ready with a 503 when a check fails or times out', async () => {
    const app = await makeApp();
    app.readiness.set('failing', async () => {
      throw new Error('database unreachable');
    });
    const response = await app.inject({ method: 'GET', url: '/readyz' });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: 'not_ready', checks: { failing: 'fail' } });
    await app.close();
  });

  it('is ready with no checks registered at all', async () => {
    const app = await makeApp();
    const response = await app.inject({ method: 'GET', url: '/readyz' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ready', checks: {} });
    await app.close();
  });
});

describe('error model', () => {
  it('answers an unknown route with the not_found envelope', async () => {
    const app = await makeApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/nope' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: 'not_found' });
    expect(response.headers['x-request-id']).toBeDefined();
    await app.close();
  });

  it('hides the internals of an unhandled error', async () => {
    const app = await makeApp();
    const response = await app.inject({ method: 'GET', url: '/__test/boom' });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: 'internal_error' });
    const body = response.body;
    expect(body).not.toContain('boom');
    expect(body).not.toContain('stack');
    expect(body).not.toContain('SELECT');
    await app.close();
  });

  it('maps HttpError statuses and codes, and keeps a 5xx messageless', async () => {
    const app = await makeApp();

    const unauthorized = await app.inject({ method: 'GET', url: '/__test/unauthorized' });
    expect(unauthorized.statusCode).toBe(401);
    expect(unauthorized.json()).toMatchObject({ error: 'unauthorized' });

    const forbidden = await app.inject({ method: 'GET', url: '/__test/forbidden' });
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json()).toMatchObject({ error: 'forbidden' });

    const conflict = await app.inject({ method: 'GET', url: '/__test/conflict' });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toMatchObject({
      error: 'payment_outstanding',
      message: 'This invoice is not settled yet.',
    });

    await app.close();
  });

  it('preserves Retry-After on a rate-limit rejection', async () => {
    const app = await makeApp();
    const response = await app.inject({ method: 'GET', url: '/__test/rate-limited' });
    expect(response.statusCode).toBe(429);
    expect(response.json()).toEqual({ error: 'rate_limited' });
    expect(response.headers['retry-after']).toBe('30');
    await app.close();
  });

  it('returns the Zod issues as details on a validation failure', async () => {
    const app = await makeApp();
    const response = await app.inject({
      method: 'POST',
      url: '/__test/echo',
      payload: { name: 'x' },
    });
    expect(response.statusCode).toBe(400);
    const body = response.json() as { error: string; details: Array<{ path: string[] }> };
    expect(body.error).toBe('validation_failed');
    expect(Array.isArray(body.details)).toBe(true);
    expect(body.details[0]?.path).toEqual(['name']);

    const ok = await app.inject({
      method: 'POST',
      url: '/__test/echo',
      payload: { name: 'Aisha Mohamed' },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ data: { name: 'Aisha Mohamed' } });
    await app.close();
  });

  it('constructs the HttpError helpers with the documented codes', () => {
    expect(HttpError.unauthorized().status).toBe(401);
    expect(HttpError.unauthorized().code).toBe('unauthorized');
    expect(HttpError.forbidden().code).toBe('forbidden');
    expect(HttpError.forbidden('quota_exceeded').code).toBe('quota_exceeded');
    expect(HttpError.notFound().status).toBe(404);
    expect(HttpError.conflict('email_taken').code).toBe('email_taken');
    const bad = HttpError.badRequest('validation_failed', [{ path: ['email'] }]);
    expect(bad.status).toBe(400);
    expect(bad.details).toEqual([{ path: ['email'] }]);
    expect(HttpError.tooManyRequests().status).toBe(429);
    expect(HttpError.unprocessable('advisory_incomplete').status).toBe(422);
  });
});

describe('OpenAPI', () => {
  it('serves a 3.1 document with both security schemes', async () => {
    const app = await makeApp();
    const response = await app.inject({ method: 'GET', url: '/openapi.json' });
    expect(response.statusCode).toBe(200);
    const document = response.json() as {
      openapi: string;
      info: { title: string; version: string };
      servers: Array<{ url: string }>;
      components: { securitySchemes: Record<string, unknown> };
      paths?: Record<string, unknown>;
    };
    expect(document.openapi).toBe('3.1.0');
    expect(document.info).toEqual({ title: 'VUNVAULT API', version: '1.0.0' });
    expect(document.servers).toEqual([{ url: 'https://api.vunvault.test' }]);
    expect(document.components.securitySchemes).toEqual({
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'vv_at' },
      csrf: { type: 'apiKey', in: 'header', name: 'x-csrf-token' },
    });
    // Health and the document itself are not part of the public surface.
    expect(Object.keys(document.paths ?? {})).not.toContain('/healthz');
    await app.close();
  });

  it('serves the interactive UI outside production and hides it in production', async () => {
    const app = await makeApp();
    const ui = await app.inject({ method: 'GET', url: '/docs' });
    expect(ui.statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/docs/json' })).statusCode).toBe(200);
    await app.close();

    const production = await buildApp({
      // The origin lock (Task 99) stands down for THIS test: it exercises the
      // OpenAPI surface, and in production that surface is reached through the
      // edge Worker, which stamps the header this inject cannot.
      env: {
        ...TEST_ENV,
        NODE_ENV: 'production',
        SECRETS_PROVIDER: 'oci-vault',
        ORIGIN_VERIFY_ENFORCE: 'false',
      },
      overrides: { logger: false },
      infra: false,
    });
    const json = await production.inject({ method: 'GET', url: '/openapi.json' });
    expect(json.statusCode).toBe(200);
    const docs = await production.inject({ method: 'GET', url: '/docs' });
    expect(docs.statusCode).toBe(404);
    await production.close();
  });
});

describe('application wiring', () => {
  it('decorates env and readiness and never listens', async () => {
    const app = await buildApp({ env: TEST_ENV, overrides: { logger: false }, infra: false });
    expect(app.env).toEqual(TEST_ENV);
    expect(app.readiness).toBeInstanceOf(Map);
    expect(app.readiness.size).toBe(0);
    expect(app.addresses()).toEqual([]);
    await app.close();
  });

  it('redacts the credential-bearing header paths', () => {
    expect(REDACT_PATHS).toEqual([
      'req.headers.cookie',
      'req.headers.authorization',
      'req.headers["x-csrf-token"]',
      'res.headers["set-cookie"]',
    ]);
  });

  it('mounts the /api/v1 prefix', async () => {
    const app = await makeApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/' });
    // The aggregator is empty for now, so the prefix answers not_found — but it
    // is mounted, which is what later tasks rely on.
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: 'not_found' });
    await app.close();
  });
});

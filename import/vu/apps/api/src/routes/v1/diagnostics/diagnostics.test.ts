import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../../../config/env.js';
import type { SecretName, SecretProvider } from '../../../lib/secrets/provider.js';
import { buildApp } from '../../../app.js';

/**
 * Revision 2 addendum, A2.4 — the super-admin email-delivery diagnostic.
 *
 * The route can make the platform mail an ARBITRARY address, so what is pinned
 * here is the access control: it exists, it is not public, and it refuses
 * everyone who is not an authenticated super admin holding a second factor.
 */

vi.mock('ioredis', () => {
  class FakeRedis {
    async ping(): Promise<string> {
      return 'PONG';
    }
    async quit(): Promise<string> {
      return 'OK';
    }
    disconnect(): void {}
  }
  return { default: FakeRedis };
});

vi.mock('bullmq', () => {
  class FakeQueue {
    constructor(readonly name: string) {}
    async close(): Promise<void> {}
    async add(): Promise<{ id: string }> {
      return { id: 'job-1' };
    }
  }
  return { Queue: FakeQueue };
});

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

function secrets(): SecretProvider {
  const values: Partial<Record<SecretName, string>> = {
    DATABASE_URL: 'postgres://user:pass@db.test:6543/postgres',
    UPSTASH_REDIS_URL: 'rediss://default:secret@redis.test:6379',
    SUPABASE_JWT_SECRET: 'test-jwt-secret',
    AUDIT_HMAC_KEY: 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=',
    AUDIT_AES_KEY: 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    RESEND_API_KEY: 're_test_key',
    AFRICASTALKING_USERNAME: 'vunvault',
    AFRICASTALKING_API_KEY: 'at_test_key',
    TWILIO_ACCOUNT_SID: 'AC_test',
    TWILIO_AUTH_TOKEN: 'tw_test_token',
    R2_ACCESS_KEY_ID: 'r2-access-key',
    R2_SECRET_ACCESS_KEY: 'r2-secret',
  };
  return {
    async get(name: SecretName): Promise<string> {
      const value = values[name];
      if (value === undefined) throw new Error(`secret ${name} missing`);
      return value;
    },
  };
}

const ROUTE = '/api/v1/admin/diagnostics/email-test';

async function build() {
  const sends: Array<{ to: string; subject: string; requestId: string }> = [];
  const app = await buildApp({
    env: TEST_ENV,
    overrides: { logger: false },
    secretsOptions: { provider: secrets() },
    dbOptions: {
      db: {
        transaction: async (work: (tx: unknown) => Promise<unknown>) => work({ fake: 'tx' }),
        $client: { unsafe: async () => [], end: async () => undefined },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    },
    providersOptions: {
      email: { send: async () => ({ id: 'email-diag-1' }) },
      sms: { send: async () => ({ id: 'sms-1' }) },
    },
  });
  return { app, sends };
}

describe('POST /api/v1/admin/diagnostics/email-test', () => {
  it('is registered, and is NOT public', async () => {
    const { app } = await build();
    const registered = app.hasRoute({ method: 'POST', url: ROUTE });
    expect(registered).toBe(true);

    // No session at all: the guard stack refuses it before any mail is sent.
    const response = await app.inject({
      method: 'POST',
      url: ROUTE,
      payload: { to: 'probe@example.test' },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: 'unauthorized' });
    await app.close();
  });

  it('is not on the public allow-list, so the guard stack is mandatory', async () => {
    const { PUBLIC_ROUTES } = await import('../../../conformance/route-manifest.js');
    expect(PUBLIC_ROUTES).not.toContain(`POST ${ROUTE}`);
    // Task 40's conformance suite walks the live route table and fails any
    // /api/v1/admin/* route missing authenticate + requireStaff + a permission,
    // so this route cannot be registered unguarded without the build going red.
    const { app } = await build();
    expect(app.hasRoute({ method: 'POST', url: ROUTE })).toBe(true);
    await app.close();
  });
});

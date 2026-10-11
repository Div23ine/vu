import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app';
import type { Env } from '../config/env';
import {
  EnvSecretProvider,
  OciVaultSecretProvider,
  createSecretProvider,
  parseSecretMap,
  SECRET_NAMES,
  type OciSecretsClientLike,
  type SecretName,
  type SecretProvider,
} from '../lib/secrets/provider';
import { pingDb } from './db';
import { redisOptionsFromUrl } from './redis';
import { DEFAULT_JOB_OPTIONS, QUEUE_JOB_OPTIONS } from '../queues';
import { QUEUE_NAMES } from '@vunvault/contracts';

vi.mock('ioredis', () => {
  class FakeRedis {
    static instances: FakeRedis[] = [];
    readonly options: unknown;
    quitCalls = 0;
    disconnectCalls = 0;
    constructor(options?: unknown) {
      this.options = options;
      FakeRedis.instances.push(this);
    }
    async ping(): Promise<string> {
      return 'PONG';
    }
    async quit(): Promise<string> {
      this.quitCalls += 1;
      return 'OK';
    }
    disconnect(): void {
      this.disconnectCalls += 1;
    }
  }
  return { default: FakeRedis };
});

vi.mock('bullmq', () => {
  class FakeQueue {
    static instances: FakeQueue[] = [];
    constructor(
      readonly name: string,
      readonly options: { connection?: unknown; defaultJobOptions?: unknown },
    ) {
      FakeQueue.instances.push(this);
    }
    async close(): Promise<void> {
      FakeQueue.instances.pop();
    }
  }
  return { Queue: FakeQueue };
});

const REDIS_URL = 'rediss://default:secret@redis-region.upstash.io:6379';

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

/** A provider that answers every secret with a predictable value. */
function fakeSecrets(values: Partial<Record<SecretName, string>> = {}): SecretProvider {
  return {
    async get(name: SecretName): Promise<string> {
      const value = values[name];
      if (value !== undefined) return value;
      if (name === 'DATABASE_URL') return 'postgres://user:pass@db.test:6543/postgres';
      if (name === 'UPSTASH_REDIS_URL') return REDIS_URL;
      if (name === 'SUPABASE_JWT_SECRET') return 'test-jwt-secret';
      if (name === 'AUDIT_HMAC_KEY') return 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=';
      if (name === 'AUDIT_AES_KEY') return 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=';
      if (name === 'SUPABASE_SERVICE_ROLE_KEY') return 'service-role-key';
      if (name === 'RESEND_API_KEY') return 're_test_key';
      if (name === 'AFRICASTALKING_USERNAME') return 'vunvault';
      if (name === 'AFRICASTALKING_API_KEY') return 'at_test_key';
      if (name === 'TWILIO_ACCOUNT_SID') return 'AC_test';
      if (name === 'TWILIO_AUTH_TOKEN') return 'tw_test_token';
      if (name === 'R2_ACCESS_KEY_ID') return 'r2-access-key';
      if (name === 'R2_SECRET_ACCESS_KEY') return 'r2-secret';
      throw new Error(`secret ${name} missing`);
    },
  };
}

function fakeDb() {
  const transactions: Array<(tx: unknown) => Promise<unknown>> = [];
  return {
    transactions,
    db: {
      transaction: async (work: (tx: unknown) => Promise<unknown>) => {
        transactions.push(work);
        return work({ fake: 'tx' });
      },
      $client: {
        unsafe: async (query: string) => {
          if (query !== 'select 1') throw new Error(`unexpected query ${query}`);
          return [];
        },
        end: async () => undefined,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SECRET_NAMES', () => {
  it('lists exactly the secrets the API may read', () => {
    expect(SECRET_NAMES).toEqual([
      'DATABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_JWT_SECRET',
      'UPSTASH_REDIS_URL',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'PAYSTACK_SECRET_KEY',
      'RESEND_API_KEY',
      'AFRICASTALKING_API_KEY',
      'AFRICASTALKING_USERNAME',
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN',
      'AUDIT_HMAC_KEY',
      'AUDIT_AES_KEY',
      'NVD_API_KEY',
      // Task 40: the public contact form's bot check.
      'TURNSTILE_SECRET_KEY',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      // Task 40g: the scan controller's HMAC callback key.
      'SCAN_CONTROLLER_HMAC_KEY',
      // Task 99: the edge origin lock's shared secret.
      'EDGE_ORIGIN_SECRET',
    ]);
  });
});

describe('EnvSecretProvider', () => {
  it('reads the environment and reports a missing secret by name', async () => {
    const previous = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    try {
      await expect(new EnvSecretProvider().get('STRIPE_SECRET_KEY')).resolves.toBe('sk_test_123');
    } finally {
      if (previous === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = previous;
    }

    delete process.env.NVD_API_KEY;
    await expect(new EnvSecretProvider().get('NVD_API_KEY')).rejects.toThrow(
      'secret NVD_API_KEY missing',
    );
  });
});

describe('OciVaultSecretProvider', () => {
  function fakeClient(content: string): OciSecretsClientLike & { calls: unknown[][] } {
    const calls: unknown[][] = [];
    return {
      calls,
      async getSecretBundle(request: unknown) {
        calls.push([request]);
        return {
          etag: 'etag',
          opcRequestId: 'req-1',
          secretBundle: {
            secretBundleContent: { contentType: 'BASE64', content },
          },
        };
      },
    };
  }

  it('decodes the base64 bundle content', async () => {
    const client = fakeClient(Buffer.from('postgres://real/db', 'utf8').toString('base64'));
    const provider = new OciVaultSecretProvider({
      secretMap: { DATABASE_URL: 'ocid1.secret.oc1..aaa' },
      client,
    });
    await expect(provider.get('DATABASE_URL')).resolves.toBe('postgres://real/db');
    expect(client.calls[0]?.[0]).toEqual({ secretId: 'ocid1.secret.oc1..aaa', stage: 'CURRENT' });
  });

  it('caches for five minutes and refetches after', async () => {
    const client = fakeClient(Buffer.from('value', 'utf8').toString('base64'));
    let clock = 1_000_000;
    const provider = new OciVaultSecretProvider({
      secretMap: { DATABASE_URL: 'ocid1.secret.oc1..aaa' },
      client,
      now: () => clock,
    });

    await provider.get('DATABASE_URL');
    expect(client.calls).toHaveLength(1);

    // Four minutes later: still cached.
    clock += 4 * 60 * 1000;
    await provider.get('DATABASE_URL');
    expect(client.calls).toHaveLength(1);

    // One second past the five-minute TTL: refetched.
    clock += 60 * 1000 + 1;
    await provider.get('DATABASE_URL');
    expect(client.calls).toHaveLength(2);
  });

  it('throws when the OCID is not in the map and never writes to process.env', async () => {
    const client = fakeClient(Buffer.from('value', 'utf8').toString('base64'));
    const provider = new OciVaultSecretProvider({ secretMap: {}, client });
    await expect(provider.get('STRIPE_SECRET_KEY')).rejects.toThrow(
      'secret STRIPE_SECRET_KEY missing',
    );
    expect(client.calls).toHaveLength(0);
    expect(process.env.DATABASE_URL).toBeUndefined();
    expect(process.env.STRIPE_SECRET_KEY).toBeUndefined();
  });

  it('parses OCI_SECRET_MAP and rejects malformed JSON', () => {
    expect(parseSecretMap(undefined)).toEqual({});
    expect(parseSecretMap('')).toEqual({});
    expect(parseSecretMap('{"DATABASE_URL":"ocid1.secret.oc1..aaa"}')).toEqual({
      DATABASE_URL: 'ocid1.secret.oc1..aaa',
    });
    expect(() => parseSecretMap('nope')).toThrow(/OCI_SECRET_MAP is not valid JSON/);
    expect(() => parseSecretMap('["a"]')).toThrow(/must be a JSON object/);
  });
});

describe('createSecretProvider', () => {
  it('selects the Vault provider only for oci-vault', () => {
    const vault = createSecretProvider({
      ...TEST_ENV,
      NODE_ENV: 'production',
      SECRETS_PROVIDER: 'oci-vault',
      OCI_SECRET_MAP: '{"DATABASE_URL":"ocid1.secret.oc1..aaa"}',
    });
    expect(vault).toBeInstanceOf(OciVaultSecretProvider);

    const env = createSecretProvider({ ...TEST_ENV, SECRETS_PROVIDER: 'env' });
    expect(env).toBeInstanceOf(EnvSecretProvider);
  });
});

describe('redis connection options', () => {
  it('derives Upstash-compatible options from the URL', () => {
    const options = redisOptionsFromUrl(REDIS_URL);
    expect(options.host).toBe('redis-region.upstash.io');
    expect(options.port).toBe(6379);
    expect(options.password).toBe('secret');
    // BullMQ blocks on commands, so retries per request must be unlimited.
    expect(options.maxRetriesPerRequest).toBeNull();
    expect(options.enableReadyCheck).toBe(false);
    expect(options.tls).toEqual({});
  });

  it('defaults the port and decodes credentials', () => {
    const options = redisOptionsFromUrl('redis://localhost');
    expect(options.port).toBe(6379);
    expect(options.password).toBeUndefined();
  });
});

describe('queue job options', () => {
  it('retries three times with exponential backoff, but never retries a scan', () => {
    expect(DEFAULT_JOB_OPTIONS).toEqual({
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 86400, count: 1000 },
      removeOnFail: { age: 604800 },
    });
    expect(QUEUE_JOB_OPTIONS.scan.attempts).toBe(1);
    for (const name of ['broadcast', 'maintenance', 'pdf', 'notify'] as const) {
      expect(QUEUE_JOB_OPTIONS[name].attempts).toBe(3);
    }
  });
});

describe('infrastructure plugins', () => {
  it('decorates db, withTx, redis, queues, email and sms', async () => {
    const { db, transactions } = fakeDb();
    const app = await buildApp({
      env: TEST_ENV,
      overrides: { logger: false },
      secretsOptions: { provider: fakeSecrets() },
      dbOptions: { db },
      providersOptions: {
        email: { send: async () => ({ id: 'email-1' }) },
        sms: { send: async () => ({ id: 'sms-1' }) },
      },
    });

    expect(app.db).toBe(db);
    expect(app.redis).toBeDefined();
    expect(app.secrets).toBeDefined();
    expect(app.email).toBeDefined();
    expect(app.sms).toBeDefined();

    // withTx runs the callback inside db.transaction.
    await expect(app.withTx(async (tx) => tx)).resolves.toEqual({ fake: 'tx' });
    expect(transactions).toHaveLength(1);

    // Five queues, named exactly as the workers expect.
    expect(Object.keys(app.queues).sort()).toEqual(Object.values(QUEUE_NAMES).sort());
    expect(app.readiness.has('db')).toBe(true);
    expect(app.readiness.has('redis')).toBe(true);

    await app.close();
  });

  it('creates a fresh connection per createRedis and closes them all', async () => {
    const { default: FakeRedis } = await import('ioredis');
    const instances = (FakeRedis as unknown as { instances: unknown[] }).instances;
    const before = instances.length;

    const app = await buildApp({
      env: TEST_ENV,
      overrides: { logger: false },
      secretsOptions: { provider: fakeSecrets() },
      dbOptions: { db: fakeDb().db },
      providersOptions: {
        email: { send: async () => ({ id: 'email-1' }) },
        sms: { send: async () => ({ id: 'sms-1' }) },
      },
    });

    const subscriber = app.createRedis();
    expect(subscriber).not.toBe(app.redis);
    expect(instances.length).toBeGreaterThan(before);

    await app.close();
    const quitCalls = instances
      .slice(before)
      .map((connection) => (connection as { quitCalls: number }).quitCalls);
    expect(quitCalls.every((count) => count >= 1)).toBe(true);
  });

  it('reports ready through the db and redis probes', async () => {
    const app = await buildApp({
      env: TEST_ENV,
      overrides: { logger: false },
      secretsOptions: { provider: fakeSecrets() },
      dbOptions: { db: fakeDb().db },
      providersOptions: {
        email: { send: async () => ({ id: 'email-1' }) },
        sms: { send: async () => ({ id: 'sms-1' }) },
      },
    });

    const response = await app.inject({ method: 'GET', url: '/readyz' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ready',
      checks: { db: 'ok', redis: 'ok' },
    });
    await app.close();
  });

  it('reports not_ready when the database probe fails', async () => {
    const broken = {
      transaction: async () => undefined,
      $client: {
        unsafe: async () => {
          throw new Error('connection refused');
        },
        end: async () => undefined,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const app = await buildApp({
      env: TEST_ENV,
      overrides: { logger: false },
      secretsOptions: { provider: fakeSecrets() },
      dbOptions: { db: broken },
      providersOptions: {
        email: { send: async () => ({ id: 'email-1' }) },
        sms: { send: async () => ({ id: 'sms-1' }) },
      },
    });

    const response = await app.inject({ method: 'GET', url: '/readyz' });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      status: 'not_ready',
      checks: { db: 'fail', redis: 'ok' },
    });
    await app.close();
  });

  it('pingDb fails when the driver client is unavailable', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(pingDb({} as any)).rejects.toThrow('database client is not available');
  });

  it('can be skipped entirely for HTTP-layer tests', async () => {
    const app = Fastify({ logger: false });
    await app.close();
    const bare = await buildApp({ env: TEST_ENV, overrides: { logger: false }, infra: false });
    expect(bare.readiness.size).toBe(0);
    await bare.close();
  });
});

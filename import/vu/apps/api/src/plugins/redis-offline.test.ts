import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../config/env.js';
import type { SecretName, SecretProvider } from '../lib/secrets/provider.js';
import { buildApp } from '../app.js';
import { MemoryRedis, memoryRedis, MEMORY_STORE_CAVEAT } from '../lib/memory-redis.js';
import {
  offlineMode,
  redisIsOptional,
  redisOptionsFromUrl,
  redisRequiredMessage,
  REDIS_PROBE_TIMEOUT_MS,
} from './redis.js';
import { disabledQueueRegistry, QUEUE_DISABLED_MESSAGE } from '../queues/index.js';

/**
 * Revision 2 addendum, A3 — Redis offline mode.
 *
 * The catalogs make Redis mandatory (Task 22). These tests pin the amendment:
 * the API boots without Redis, auth state falls back to this process's heap, the
 * degraded mode is reported and logged rather than hidden, a REQUIRED Redis still
 * fails the boot loudly, and coming back online needs no code change.
 */

/**
 * Module-level switch, not a per-instance field: the plugin constructs its
 * connection DURING `buildApp`, so a test that flips instances it already holds
 * would miss the one that matters.
 */
let fakeRedisReachable = true;

vi.mock('ioredis', () => {
  class FakeRedis {
    static instances: FakeRedis[] = [];
    readonly options: unknown;
    constructor(options?: unknown) {
      this.options = options;
      FakeRedis.instances.push(this);
    }
    async ping(): Promise<string> {
      if (!fakeRedisReachable) throw new Error('connect ECONNREFUSED');
      return 'PONG';
    }
    async quit(): Promise<string> {
      return 'OK';
    }
    disconnect(): void {
      // no socket in the fake
    }
  }
  return { default: FakeRedis };
});

vi.mock('bullmq', () => {
  class FakeQueue {
    constructor(
      readonly name: string,
      readonly options: unknown,
    ) {}
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

/** Secrets WITH (`online`) and WITHOUT (`offline`) a Redis URL. */
function secrets(options: { redis?: boolean } = { redis: true }): SecretProvider {
  const values: Partial<Record<SecretName, string>> = {
    DATABASE_URL: 'postgres://user:pass@db.test:6543/postgres',
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
  if (options.redis !== false) {
    values.UPSTASH_REDIS_URL = 'rediss://default:secret@redis.test:6379';
  }
  return {
    async get(name: SecretName): Promise<string> {
      const value = values[name];
      if (value === undefined) throw new Error(`secret ${name} missing`);
      return value;
    },
  };
}

function fakeDb() {
  return {
    db: {
      transaction: async (work: (tx: unknown) => Promise<unknown>) => work({ fake: 'tx' }),
      $client: { unsafe: async () => [], end: async () => undefined },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  };
}

/** Build an app with the provider seams filled, so no test touches the network. */
function build(overrides: { env?: Partial<Env>; redis?: boolean } = {}) {
  return buildApp({
    env: { ...TEST_ENV, ...overrides.env },
    overrides: { logger: false },
    secretsOptions: { provider: secrets({ redis: overrides.redis }) },
    dbOptions: { db: fakeDb().db },
    providersOptions: {
      email: { send: async () => ({ id: 'email-1' }) },
      sms: { send: async () => ({ id: 'sms-1' }) },
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  fakeRedisReachable = true;
});

describe('REDIS_OPTIONAL resolution (A3.1)', () => {
  it('is optional outside production and required inside it, by default', () => {
    expect(redisIsOptional('auto', 'development')).toBe(true);
    expect(redisIsOptional('auto', 'test')).toBe(true);
    expect(redisIsOptional('auto', 'production')).toBe(false);
  });

  it('honours an explicit override in both directions', () => {
    expect(redisIsOptional('always', 'production')).toBe(true);
    expect(redisIsOptional('never', 'development')).toBe(false);
  });

  it('keeps the probe budget bounded, so an unreachable host cannot hang a boot', () => {
    expect(REDIS_PROBE_TIMEOUT_MS).toBeGreaterThan(0);
    expect(REDIS_PROBE_TIMEOUT_MS).toBeLessThanOrEqual(10_000);
  });

  it('still derives Upstash options from the URL unchanged (catalog Task 22)', () => {
    expect(redisOptionsFromUrl('rediss://u:p@redis.test:6379').tls).toEqual({});
    expect(redisOptionsFromUrl('redis://redis.test').tls).toBeUndefined();
  });
});

describe('the in-memory store (A3.2)', () => {
  it('implements the single-use semantics magic links depend on', async () => {
    const clock = 1_000_000;
    const store = new MemoryRedis({ now: () => clock });

    // SET … EX … NX claims exactly once — the invite-cooldown gate.
    expect(await store.set('ml:invite:a', '1', 'EX', 900, 'NX')).toBe('OK');
    expect(await store.set('ml:invite:a', '1', 'EX', 900, 'NX')).toBeNull();

    // A token read-and-deleted once can never be replayed.
    await store.set('ml:token:j1', 'signed', 'EX', 900);
    expect(await store.getdel('ml:token:j1')).toBe('signed');
    expect(await store.getdel('ml:token:j1')).toBeNull();
    expect(await store.get('ml:token:j1')).toBeNull();
  });

  it('expires keys on the injected clock, like a TTL would', async () => {
    let clock = 0;
    const store = new MemoryRedis({ now: () => clock });
    await store.set('mfa:handle', 'challenge', 'EX', 300);
    expect(await store.get('mfa:handle')).toBe('challenge');
    expect(await store.ttl('mfa:handle')).toBe(300);

    clock = 300_001;
    expect(await store.get('mfa:handle')).toBeNull();
    expect(await store.ttl('mfa:handle')).toBe(-2);
  });

  it('counts attempts and preserves the window an INCR created', async () => {
    let clock = 0;
    const store = new MemoryRedis({ now: () => clock });
    expect(await store.incr('rl:ip:1.2.3.4')).toBe(1);
    await store.expire('rl:ip:1.2.3.4', 600);
    expect(await store.incr('rl:ip:1.2.3.4')).toBe(2);
    // INCR must not reset the window, or a lockout would never expire.
    expect(await store.ttl('rl:ip:1.2.3.4')).toBe(600);
    clock = 600_001;
    expect(await store.incr('rl:ip:1.2.3.4')).toBe(1);
  });

  it('reports PONG, refuses nothing silently, and reaches no subscriber', async () => {
    const store = memoryRedis();
    expect(await store.ping()).toBe('PONG');
    expect(await store.publish('channel', 'payload')).toBe(0);
  });

  it('names the single-instance caveat an operator has to read (A3.3)', () => {
    expect(MEMORY_STORE_CAVEAT).toMatch(/single API instance/i);
    expect(MEMORY_STORE_CAVEAT).toMatch(/UPSTASH_REDIS_URL/);
  });
});

describe('booting with Redis offline (A3.1, A3.5)', () => {
  it('boots, reports memory mode, and answers /health', async () => {
    const app = await build({ redis: false, env: { REDIS_OPTIONAL: 'always' } });

    expect(app.redisMode).toEqual(offlineMode('UPSTASH_REDIS_URL is not set'));
    expect(app.redis).toBeDefined();

    // The shim really serves auth state — a magic-link style claim/consume cycle.
    await app.redis.set('ml:token:x', 'signed', 'EX', 60);
    expect(await app.redis.get('ml:token:x')).toBe('signed');

    const health = await app.inject({ method: 'GET', url: '/health' });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ redis: 'down', store: 'memory' });

    // /healthz and /readyz keep their catalog shapes (Task 21) — and readiness
    // must NOT fail just because Redis is deliberately absent.
    expect((await app.inject({ method: 'GET', url: '/healthz' })).json()).toEqual({ status: 'ok' });
    expect(app.readiness.has('redis')).toBe(false);
    const ready = await app.inject({ method: 'GET', url: '/readyz' });
    expect(ready.statusCode).toBe(200);

    await app.close();
  });

  it('refuses to boot when Redis is required and absent', async () => {
    await expect(build({ redis: false, env: { REDIS_OPTIONAL: 'never' } })).rejects.toThrow(
      /FATAL: Redis is required/,
    );
  });

  it('refuses to boot in production under the default (auto)', async () => {
    await expect(
      build({
        redis: false,
        env: { NODE_ENV: 'production', SECRETS_PROVIDER: 'oci-vault', OCI_SECRET_MAP: '{}' },
      }),
    ).rejects.toThrow(/FATAL: Redis is required/);
  });

  it('falls back when the URL is set but the server does not answer', async () => {
    fakeRedisReachable = false;
    try {
      const app = await build({ env: { REDIS_OPTIONAL: 'always' } });
      expect(app.redisMode.store).toBe('memory');
      expect(app.redisMode.status).toBe('down');
      expect(app.redisMode.reason).toMatch(/ECONNREFUSED|timed out/);

      const health = await app.inject({ method: 'GET', url: '/health' });
      expect(health.json()).toEqual({ redis: 'down', store: 'memory' });
      await app.close();
    } finally {
      fakeRedisReachable = true;
    }
  });

  it('needs no code change to come back online (A3.5)', async () => {
    const app = await build({ redis: true });
    expect(app.redisMode).toEqual({ status: 'up', store: 'redis', reason: null });
    expect(app.readiness.has('redis')).toBe(true);

    const health = await app.inject({ method: 'GET', url: '/health' });
    expect(health.json()).toEqual({ redis: 'up', store: 'redis' });
    await app.close();
  });

  it('disables the queues loudly instead of pretending to enqueue', async () => {
    const warnings: string[] = [];
    const log = {
      warn: (fields: unknown, message?: string) => {
        warnings.push(typeof fields === 'string' ? fields : (message ?? JSON.stringify(fields)));
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const queues = disabledQueueRegistry(log);
    const job = await queues.notify.add('email', { channel: 'email' });

    expect(job).toBeUndefined();
    expect(warnings.join('\n')).toContain(QUEUE_DISABLED_MESSAGE);
    expect(queues.dropCounts().notify).toBe(1);
    expect(queues.dropCounts().scan).toBe(0);
  });

  it('reports the required-Redis message with the escape hatch in it', () => {
    expect(redisRequiredMessage('no url')).toMatch(/REDIS_OPTIONAL=always/);
    expect(redisRequiredMessage('no url')).toMatch(/no url/);
  });
});

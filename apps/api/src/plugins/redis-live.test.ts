import { afterAll, describe, expect, it } from 'vitest';
import Redis from 'ioredis';
import {
  MagicLinkTokenStore,
  SignupInviteCooldown,
  deriveMagicLinkSecret,
} from '../routes/v1/auth/magic-link.js';
import { LoginAbuseGuard, MAGIC_LINK_EMAIL_MAX } from '../routes/v1/auth/login-abuse.js';
import type { KvStore, StoreLogger } from '../routes/v1/auth/challenge.js';
import { redisOptionsFromUrl } from './redis.js';
import { buildApp } from '../app.js';
import type { Env } from '../config/env.js';
import type { SecretName, SecretProvider } from '../lib/secrets/provider.js';

/**
 * Revision 3, A6 — live verification against a REAL Redis server.
 *
 * The rest of the suite runs against fakes, which is right for unit tests but
 * cannot prove the thing A6 actually asks about: that the magic-link flow works
 * against a genuine Redis, and that the hybrid failure policy behaves correctly
 * when Redis commands really do fail.
 *
 * GATED: it runs only when `REDIS_LIVE_URL` points at a reachable server, so CI
 * and ordinary `vitest run` are unaffected. To run it:
 *
 *   redis-server --port 6379 --save '' --appendonly no &
 *   REDIS_LIVE_URL=redis://127.0.0.1:6379 pnpm --filter api test redis-live
 *
 * Every key it writes is namespaced under `vvtest:` and flushed afterwards.
 */

const LIVE_URL = process.env.REDIS_LIVE_URL;
const describeLive = LIVE_URL === undefined || LIVE_URL === '' ? describe.skip : describe;

/**
 * Open the shared live connection.
 *
 * Vitest always executes a suite body to register its tests — including a
 * SKIPPED one — so this must not parse `LIVE_URL` when it is absent. Constructing
 * eagerly used to throw `Invalid URL` during collection on every ordinary,
 * Redis-free run. When the suite is skipped nothing ever touches the returned
 * value, so `undefined` is a safe placeholder.
 */
function openLiveConnection(): Redis {
  if (LIVE_URL === undefined || LIVE_URL === '') {
    return undefined as unknown as Redis;
  }
  const redis = new Redis(redisOptionsFromUrl(LIVE_URL));
  // ioredis emits unhandled 'error' events on a live socket otherwise.
  redis.on('error', () => {});
  return redis;
}

/** A store whose commands can be made to fail on demand, to exercise the policy. */
function flakyStore(inner: KvStore): KvStore & { fail: boolean; failures: string[] } {
  const state = { fail: false, failures: [] as string[] };
  const wrap =
    <T>(name: string, fn: (...args: never[]) => Promise<T>) =>
    (...args: never[]): Promise<T> => {
      if (state.fail) {
        state.failures.push(name);
        return Promise.reject(new Error('simulated redis fault'));
      }
      return fn(...args);
    };
  return Object.assign(state, {
    get: wrap('get', inner.get.bind(inner)) as KvStore['get'],
    set: wrap('set', inner.set.bind(inner)) as KvStore['set'],
    del: wrap('del', inner.del.bind(inner)) as KvStore['del'],
  });
}

function recordingLogger() {
  const warnings: Array<{ fields: Record<string, unknown>; message: string }> = [];
  const log: StoreLogger = {
    warn: (fields, message) => warnings.push({ fields, message }),
  };
  return { warnings, log };
}

describeLive('live Redis (A6)', () => {
  const connection = openLiveConnection();

  afterAll(async () => {
    if (connection === undefined) return;
    const keys = await connection.keys('vvtest:*');
    if (keys.length > 0) await connection.del(...keys);
    // The auth stores write their own prefixes; clean those too.
    for (const prefix of ['ml:token:', 'ml:pointer:', 'ml:invite:', 'ml:win:', 'ml:soft:']) {
      const found = await connection.keys(`${prefix}*`);
      if (found.length > 0) await connection.del(...found);
    }
    connection.disconnect();
  });

  it('confirms the server is really there', async () => {
    expect(await connection.ping()).toBe('PONG');
  });

  it('issues and consumes a magic link exactly once over real Redis', async () => {
    const store: KvStore = connection as unknown as KvStore;
    const tokens = new MagicLinkTokenStore(store, deriveMagicLinkSecret('live-secret'));

    const { token } = await tokens.issue('live@example.test');
    expect(token).toContain('.');

    // First consumption is valid; the token is gone afterwards.
    const first = await tokens.consume(token);
    expect(first.status).toBe('valid');
    const replay = await tokens.consume(token);
    expect(replay.status).toBe('used');
  });

  it('invalidates the previous link when a new one is issued (real SET/GETDEL)', async () => {
    const store: KvStore = connection as unknown as KvStore;
    const tokens = new MagicLinkTokenStore(store, deriveMagicLinkSecret('live-secret'));

    const older = await tokens.issue('reissue@example.test');
    const newer = await tokens.issue('reissue@example.test');
    expect(newer.token).not.toBe(older.token);

    expect((await tokens.consume(older.token)).status).toBe('used');
    expect((await tokens.consume(newer.token)).status).toBe('valid');
  });

  it('enforces the signup-invite cooldown with a real SET NX', async () => {
    const store: KvStore = connection as unknown as KvStore;
    const invites = new SignupInviteCooldown(store);

    expect(await invites.claim('cooldown@example.test')).toBe(true);
    expect(await invites.claim('cooldown@example.test')).toBe(false);
  });

  it('enforces the per-address issuance window with real counters', async () => {
    const store: KvStore = connection as unknown as KvStore;
    const abuse = new LoginAbuseGuard(store);

    for (let attempt = 1; attempt <= MAGIC_LINK_EMAIL_MAX; attempt += 1) {
      const claim = await abuse.emailWindowClaim('window@example.test');
      expect(claim.allowed).toBe(attempt <= MAGIC_LINK_EMAIL_MAX);
    }
    const over = await abuse.emailWindowClaim('window@example.test');
    expect(over.allowed).toBe(false);
    expect(over.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('boots the whole app against the real server and reports it on /health', async () => {
    const env: Env = {
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
    const values: Partial<Record<SecretName, string>> = {
      DATABASE_URL: 'postgres://user:pass@db.test:6543/postgres',
      UPSTASH_REDIS_URL: LIVE_URL as string,
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
    const provider: SecretProvider = {
      async get(name: SecretName): Promise<string> {
        const value = values[name];
        if (value === undefined) throw new Error(`secret ${name} missing`);
        return value;
      },
    };

    const app = await buildApp({
      env,
      overrides: { logger: false },
      secretsOptions: { provider },
      dbOptions: {
        db: {
          transaction: async (work: (tx: unknown) => Promise<unknown>) => work({ fake: 'tx' }),
          $client: { unsafe: async () => [], end: async () => undefined },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      },
      providersOptions: {
        email: { send: async () => ({ id: 'email-live' }) },
        sms: { send: async () => ({ id: 'sms-live' }) },
      },
    });

    // The real server answered the boot probe, so the mode is online and the
    // readiness probe is registered (it is deliberately absent when offline).
    expect(app.redisMode).toEqual({ status: 'up', store: 'redis', reason: null });
    expect(app.readiness.has('redis')).toBe(true);

    const health = await app.inject({ method: 'GET', url: '/health' });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ redis: 'up', store: 'redis' });

    // A real key written through the decorated connection is visible in Redis.
    await app.redis.set('vvtest:live', 'ok', 'EX', 30);
    expect(await connection.get('vvtest:live')).toBe('ok');

    await app.close();
  });

  describe('hybrid failure policy when real Redis commands fail', () => {
    it('fails OPEN on abuse counters, and says so in the log', async () => {
      const store = flakyStore(connection as unknown as KvStore);
      const { warnings, log } = recordingLogger();
      const abuse = new LoginAbuseGuard(store, undefined, log);

      store.fail = true;
      const claim = await abuse.emailWindowClaim('policy@example.test');

      // Availability wins for a counter: the request proceeds…
      expect(claim.allowed).toBe(true);
      // …but never silently.
      expect(store.failures).toContain('get');
      expect(warnings.some((entry) => /FAILING OPEN/.test(entry.message))).toBe(true);
      expect(warnings[0]?.fields.scope).toBe('magic_link_email_window');
    });

    it('fails CLOSED on the single-use token store, and names Redis not Resend', async () => {
      const store = flakyStore(connection as unknown as KvStore);
      const { warnings, log } = recordingLogger();
      const tokens = new MagicLinkTokenStore(
        store,
        deriveMagicLinkSecret('live-secret'),
        undefined,
        undefined,
        log,
      );

      store.fail = true;
      // Issuing must refuse: a token that was never stored cannot be validated
      // later, and pretending otherwise would send a link that cannot work.
      await expect(tokens.issue('closed@example.test')).rejects.toThrow(/simulated redis fault/);

      const warning = warnings.at(-1);
      expect(warning?.message).toMatch(/fail closed/i);
      expect(warning?.message).toMatch(/NOT a Resend failure/);
      expect(warning?.fields.scope).toBe('magic_link_issue');
    });

    it('fails CLOSED on the invite cooldown, suppressing the send rather than bombing', async () => {
      const store = flakyStore(connection as unknown as KvStore);
      const { warnings, log } = recordingLogger();
      const invites = new SignupInviteCooldown(store, undefined, log);

      store.fail = true;
      expect(await invites.claim('bomb@example.test')).toBe(false);
      expect(warnings.some((entry) => /FAILING CLOSED/.test(entry.message))).toBe(true);
    });
  });
});

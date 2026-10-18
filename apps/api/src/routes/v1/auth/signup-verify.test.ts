import { createHash } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../../../config/env.js';
import type { SignInResult, SupabaseAdmin, SupabaseSession } from '../../../lib/supabase-admin.js';
import { memoryKvStore } from './challenge.js';
import { SIGNUP_OTP_PREFIX, SIGNUP_OTP_RESEND_SECONDS, type SignupOtpRecord } from './email-otp.js';
import cookiesPlugin from '../../../plugins/cookies.js';
import errorHandler from '../../../plugins/error-handler.js';
import authPlugin from '../../../plugins/auth.js';
import { SessionRegistry, type SessionRecord } from '../../../lib/session-registry.js';
import type { AuthRepo, AuthProfileRow, NewSession } from './repo.js';
import authRoutes from './index.js';
import type { AuditEntryRow } from '../../../audit/repo.js';

/**
 * Signup step 2 (Task 40d): the mailbox OTP.
 *
 * What must not fail quietly: the code activates the profile and ONLY then opens
 * a session; five wrong codes destroy the OTP for good; a stale or absent code
 * is a 410 and never a hint about which addresses exist; the resend cooldown is
 * thirty seconds and rotating the code kills the previous email's code.
 */

const SECRET = 'test-jwt-secret-that-is-long-enough-to-be-safe';
const USER_ID = 'c0000000-0000-4000-8000-000000000001';
const ORG_ID = 'a0000000-0000-4000-8000-000000000001';
const SESSION_ID = '20000000-0000-4000-8000-000000000001';

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

const SIGNUP_BODY = {
  fullName: 'Jane Wanjiru',
  email: 'jane.wanjiru@acmefintech.co.ke',
  country: 'KE',
  accountType: 'company',
  password: 'Str0ng-Passphrase!',
  confirmPassword: 'Str0ng-Passphrase!',
  description: 'Acme Fintech Ltd',
};

// --------------------------------------------------------------------- fakes

class FakeAuthRepo implements AuthRepo {
  profiles: AuthProfileRow[] = [];
  organizations: Array<{ id: string; name: string; clientCode: string; country: string | null }> =
    [];
  sessions: Array<NewSession & { revokedAt: Date | null; lastSeenAt: Date | null }> = [];
  attempts: Array<{ emailHash: string; ip: string; succeeded: boolean; reason: string | null }> =
    [];
  passwordChanges: Array<{ userId: string; at: Date }> = [];
  webauthnCount = 0;
  clientCodeSeq = 48211;

  async findProfileByEmail(email: string) {
    return this.profiles.find((p) => p.email === email.trim().toLowerCase()) ?? null;
  }
  async findProfileById(id: string) {
    return this.profiles.find((p) => p.id === id) ?? null;
  }
  async nextClientCode() {
    const code = `VV-CL-${String(this.clientCodeSeq).padStart(5, '0')}`;
    this.clientCodeSeq += 1;
    return code;
  }
  async createOrganization(input: { name: string; clientCode: string; country: string | null }) {
    this.organizations.push({ id: ORG_ID, ...input });
    return ORG_ID;
  }
  async createProfile(input: Parameters<AuthRepo['createProfile']>[0]) {
    this.profiles.push({
      id: input.id,
      email: input.email,
      fullName: input.fullName,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      orgId: input.orgId,
      accountStatus: input.accountStatus ?? 'active',
      deletedAt: null,
      mfaEnrolled: false,
    });
  }
  async activatePendingSignup(profileId: string) {
    const row = this.profiles.find((p) => p.id === profileId);
    if (row === undefined || row.accountStatus !== 'pending_verification') return false;
    row.accountStatus = 'active';
    return true;
  }
  async deletePendingSignup(profileId: string) {
    const index = this.profiles.findIndex(
      (p) => p.id === profileId && p.accountStatus === 'pending_verification',
    );
    if (index === -1) return false;
    this.profiles.splice(index, 1);
    return true;
  }
  async listStalePendingSignups() {
    return this.profiles
      .filter((p) => p.accountStatus === 'pending_verification')
      .map((p) => ({ id: p.id, email: p.email, orgId: p.orgId }));
  }
  async revokeAllSessions(userId: string, at: Date) {
    const revoked = this.sessions.filter((s) => s.userId === userId && s.revokedAt === null);
    for (const row of revoked) row.revokedAt = at;
    return revoked.map((row) => row.id);
  }
  async setLastPasswordChangeAt(userId: string, at: Date) {
    this.passwordChanges.push({ userId, at });
  }
  async countWebauthnCredentials() {
    return this.webauthnCount;
  }
  async recordLoginAttempt(input: {
    emailHash: string;
    ip: string;
    succeeded: boolean;
    reason: string | null;
  }) {
    this.attempts.push(input);
  }
  async countRecentFailuresByEmail(emailHash: string) {
    return this.attempts.filter((a) => a.emailHash === emailHash && !a.succeeded).length;
  }
  async countRecentFailuresByIp(ip: string) {
    return this.attempts.filter((a) => a.ip === ip && !a.succeeded).length;
  }
  async createSession(input: NewSession) {
    this.sessions.push({ ...input, revokedAt: null, lastSeenAt: null });
  }
  async revokeSession(sessionId: string, at: Date) {
    const row = this.sessions.find((s) => s.id === sessionId);
    if (row !== undefined) row.revokedAt = at;
  }
  async touchSession(sessionId: string, at: Date) {
    const row = this.sessions.find((s) => s.id === sessionId);
    if (row !== undefined) row.lastSeenAt = at;
  }
  async touchProfileLastActive() {
    /* no-op */
  }
}

function fakeSession(overrides: Partial<SupabaseSession> = {}): SupabaseSession {
  return {
    accessToken: 'aal1-access-token',
    refreshToken: 'aal1-refresh-token',
    expiresIn: 3600,
    sessionId: SESSION_ID,
    userId: USER_ID,
    aal: 'aal1',
    ...overrides,
  };
}

class FakeSupabase implements SupabaseAdmin {
  factors: Array<{ id: string; type: 'totp'; verified: boolean }> = [];
  confirmedUsers: string[] = [];
  issuedSessions: string[] = [];
  deletedUsers: string[] = [];
  passwordUpdates: Array<{ userId: string; password: string }> = [];

  async createUser() {
    return { id: USER_ID };
  }
  async confirmEmail(userId: string) {
    this.confirmedUsers.push(userId);
  }
  async issueSession(email: string) {
    this.issuedSessions.push(email);
    return fakeSession();
  }
  async deleteUser(userId: string) {
    this.deletedUsers.push(userId);
  }
  buildAuthorizeUrl(): string {
    throw new Error('not used');
  }
  async exchangeCodeForSession(): Promise<{
    session: SupabaseSession;
    user: {
      id: string;
      email: string;
      emailVerified: boolean;
      fullName: string | null;
      avatarUrl: string | null;
    };
  }> {
    throw new Error('not used');
  }
  async signInWithPassword(): Promise<SignInResult> {
    return { session: fakeSession(), userId: USER_ID, mfaRequired: false, factors: [] };
  }
  async refresh() {
    return fakeSession();
  }
  async signOut() {
    /* no-op */
  }
  async updatePassword(userId: string, password: string) {
    this.passwordUpdates.push({ userId, password });
  }
  async deleteSession() {
    /* no-op */
  }
  mfa = {
    enrollTotp: async () => ({
      factorId: 'f1',
      qrSvg: '<svg/>',
      secret: 'JBSWY3DPEHPK3PXP',
      uri: 'otpauth://totp/x',
    }),
    challengeAndVerify: async () => fakeSession({ aal: 'aal2' }),
    unenroll: async () => undefined,
    listFactors: async () => this.factors,
  };
}

interface Harness {
  app: FastifyInstance;
  repo: FakeAuthRepo;
  supabase: FakeSupabase;
  kv: ReturnType<typeof memoryKvStore>;
  audits: Array<{
    eventType: string;
    message: string;
    actorLabel: string;
    subject: string | null;
    details: Record<string, unknown>;
  }>;
  emails: Array<{ to: string; subject: string; text?: string }>;
}

async function makeHarness(): Promise<Harness> {
  const repo = new FakeAuthRepo();
  const supabase = new FakeSupabase();
  const kv = memoryKvStore();
  const emails: Array<{ to: string; subject: string; text?: string }> = [];
  const audits: Harness['audits'] = [];

  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('env', TEST_ENV);
  app.decorateRequest('clientIp', '');
  app.decorateRequest('requestId', '');

  const fakeTx = { unsafe: async () => [] };
  app.decorate('withTx', (async (work: (tx: unknown) => Promise<unknown>) =>
    work(fakeTx)) as unknown as FastifyInstance['withTx']);
  app.decorate('audit', {
    append: async (_executor: unknown, input: Record<string, unknown>) => {
      audits.push({
        eventType: String(input.eventType),
        message: String(input.message),
        actorLabel: String((input.actor as { label: string } | undefined)?.label ?? 'external'),
        subject: (input.subject as string | undefined) ?? null,
        details: (input.details as Record<string, unknown>) ?? {},
      });
      return {
        seq: audits.length,
        id: 'entry-id',
        category: 'authentication',
        eventType: input.eventType,
        severity: 'info',
        sevLevel: null,
        actorId: null,
        actorLabel: 'external',
        ip: null,
        subject: (input.subject as string | undefined) ?? null,
        message: String(input.message),
        details: (input.details as Record<string, unknown>) ?? {},
        sealedDetails: null,
        nonce: null,
        prevHash: '0'.repeat(64),
        hash: 'a'.repeat(64),
        signature: 'b'.repeat(64),
        keyId: 'v1',
        createdAt: new Date('2026-10-06T12:00:00Z'),
      } as unknown as AuditEntryRow;
    },
    publish: async () => undefined,
  } as unknown as FastifyInstance['audit']);
  app.decorate('email', {
    send: async (message: { to: string; subject: string; text?: string }) => {
      emails.push(message);
      return { id: 'email-1' };
    },
  } as unknown as FastifyInstance['email']);

  await app.register(cookiesPlugin);
  await app.register(errorHandler);
  await app.register(authPlugin, {
    supabase: supabase as unknown as FastifyInstance['supabase'],
    secret: SECRET,
    registry: new SessionRegistry({
      lookup: async (sessionId): Promise<SessionRecord | null> =>
        sessionId === SESSION_ID
          ? {
              sessionId,
              userId: USER_ID,
              revokedAt: null,
              mfaMethod: null,
              accountStatus: 'active',
              deletedAt: null,
            }
          : null,
    }),
  });

  await app.register(
    async (scope) => {
      await scope.register(authRoutes, {
        repo,
        supabase: supabase as unknown as SupabaseAdmin,
        kv,
        breach: { isBreached: async () => false },
      });
    },
    { prefix: '/api/v1' },
  );

  return { app, repo, supabase, kv, audits, emails };
}

function otpKey(email: string): string {
  return `${SIGNUP_OTP_PREFIX}${createHash('sha256')
    .update(email.trim().toLowerCase(), 'utf8')
    .digest('hex')}`;
}

function cookieNames(response: { headers: Record<string, unknown> }): string[] {
  const raw = response.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw === undefined ? [] : [String(raw)];
  return list.map((entry) => String(entry).split('=')[0] ?? '');
}

let harness: Harness;

beforeEach(async () => {
  harness = await makeHarness();
});

/** Run the real signup and fish the emailed code out of the mail. */
async function startSignup(email = SIGNUP_BODY.email): Promise<string> {
  const response = await harness.app.inject({
    method: 'POST',
    url: '/api/v1/auth/signup',
    payload: { ...SIGNUP_BODY, email },
  });
  expect(response.statusCode).toBe(202);
  const sent = harness.emails[harness.emails.length - 1];
  const code = /code is (\d{6})/.exec(sent?.text ?? '')?.[1];
  if (code === undefined) throw new Error('no code in the signup email');
  return code;
}

function verify(email: string, code: string) {
  return harness.app.inject({
    method: 'POST',
    url: '/api/v1/auth/signup/verify-email',
    payload: { email, code },
  });
}

describe('POST /api/v1/auth/signup/verify-email', () => {
  it('activates the profile, opens the aal1 session and sets the three cookies', async () => {
    const code = await startSignup();
    const response = await verify(SIGNUP_BODY.email, code);

    expect(response.statusCode, response.body).toBe(200);
    const body = response.json() as {
      data: { email: string; role: string; mfaEnrolled: boolean; permissions: string[] };
    };
    expect(body.data.email).toBe(SIGNUP_BODY.email);
    expect(body.data.role).toBe('client');
    expect(body.data.permissions).toContain('billing:read');
    // Step 3 (the authenticator) has not run yet.
    expect(body.data.mfaEnrolled).toBe(false);
    // A token is never echoed in the body — only cookies carry it.
    expect(response.body).not.toContain('aal1-access-token');
    expect(cookieNames(response).sort()).toEqual(['vv_at', 'vv_csrf', 'vv_rt']);

    // The mailbox was confirmed at Supabase BEFORE the profile activated, and the
    // session was minted server-side from a magic link.
    expect(harness.supabase.confirmedUsers).toEqual([USER_ID]);
    expect(harness.supabase.issuedSessions).toEqual([SIGNUP_BODY.email]);
    expect(harness.repo.profiles[0]?.accountStatus).toBe('active');
    expect(harness.repo.sessions).toHaveLength(1);

    // The OTP is single-use: it is gone the moment it passes.
    expect(harness.kv.entries.has(otpKey(SIGNUP_BODY.email))).toBe(false);

    // Audited as the second stage of the registration, by the new account.
    const registered = harness.audits.filter((entry) => entry.eventType === 'ACCOUNT_REGISTERED');
    expect(registered.map((entry) => entry.details.stage)).toEqual(['started', 'email_verified']);
    expect(registered[1]?.actorLabel).toBe(SIGNUP_BODY.email);
  });

  it('locks the OTP after five wrong codes — even the right one is then expired', async () => {
    const code = await startSignup();

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const wrong = await verify(SIGNUP_BODY.email, '000000');
      expect(wrong.statusCode, `attempt ${attempt}`).toBe(401);
      expect(wrong.json()).toMatchObject({ error: 'otp_invalid' });
    }
    const fifth = await verify(SIGNUP_BODY.email, '000000');
    expect(fifth.statusCode).toBe(401);
    expect(fifth.json()).toMatchObject({ error: 'otp_exhausted' });
    // Destroyed: not even the correct code can revive it.
    expect(harness.kv.entries.has(otpKey(SIGNUP_BODY.email))).toBe(false);
    const afterLock = await verify(SIGNUP_BODY.email, code);
    expect(afterLock.statusCode).toBe(410);
    expect(afterLock.json()).toMatchObject({ error: 'otp_expired' });
    // Nothing was activated and no session exists.
    expect(harness.repo.profiles[0]?.accountStatus).toBe('pending_verification');
    expect(harness.repo.sessions).toHaveLength(0);
    expect(cookieNames(afterLock)).toEqual([]);
  });

  it('answers 410 for an address that never started a signup', async () => {
    const response = await verify('nobody@example.test', '123456');
    expect(response.statusCode).toBe(410);
    expect(response.json()).toMatchObject({ error: 'otp_expired' });
    expect(harness.repo.sessions).toHaveLength(0);
  });

  it('rejects a code that is not six digits with 400', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup/verify-email',
      payload: { email: SIGNUP_BODY.email, code: '12345' },
    });
    expect(response.statusCode).toBe(400);
    expect((response.json() as { error: string }).error).toBe('validation_failed');
  });
});

describe('POST /api/v1/auth/signup/resend', () => {
  it('always answers 202 {} — for pending, unknown and already-active addresses alike', async () => {
    await startSignup();
    harness.emails.length = 0;

    // Inside the 30-second cooldown: 202, but nothing was sent.
    const throttled = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup/resend',
      payload: { email: SIGNUP_BODY.email },
    });
    expect(throttled.statusCode).toBe(202);
    expect(throttled.body).toBe('{}');
    expect(harness.emails).toHaveLength(0);

    // Unknown address: the same answer, and still nothing sent.
    const unknown = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup/resend',
      payload: { email: 'nobody@example.test' },
    });
    expect(unknown.statusCode).toBe(202);
    expect(unknown.body).toBe('{}');
    expect(unknown.body).toBe(throttled.body);
    expect(harness.emails).toHaveLength(0);
  });

  it('rotates the code once the cooldown has passed, killing the old one', async () => {
    const oldCode = await startSignup();
    expect(/code is (\d{6})/.exec(harness.emails[harness.emails.length - 1]?.text ?? '')?.[1]).toBe(
      oldCode,
    );

    // Wind the stored record's clock back past the resend window.
    const key = otpKey(SIGNUP_BODY.email);
    const stored = harness.kv.entries.get(key);
    expect(stored).toBeDefined();
    if (stored === undefined) throw new Error('no OTP record');
    const record = JSON.parse(stored.value) as SignupOtpRecord;
    stored.value = JSON.stringify({
      ...record,
      sentAt: record.sentAt - (SIGNUP_OTP_RESEND_SECONDS + 5) * 1000,
    });

    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup/resend',
      payload: { email: SIGNUP_BODY.email },
    });
    expect(response.statusCode).toBe(202);
    expect(harness.emails).toHaveLength(2);
    const newCode = /code is (\d{6})/.exec(harness.emails[1]?.text ?? '')?.[1] ?? '';
    expect(newCode).toMatch(/^\d{6}$/);

    // The old code is dead; the new one activates the account.
    if (newCode !== oldCode) {
      const stale = await verify(SIGNUP_BODY.email, oldCode);
      expect(stale.statusCode).toBe(401);
      expect(stale.json()).toMatchObject({ error: 'otp_invalid' });
    }
    const fresh = await verify(SIGNUP_BODY.email, newCode);
    expect(fresh.statusCode).toBe(200);
  });

  it('does not re-send to an account that is already active', async () => {
    const code = await startSignup();
    await verify(SIGNUP_BODY.email, code);
    harness.emails.length = 0;

    // Even past the cooldown, an active profile gets no code.
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup/resend',
      payload: { email: SIGNUP_BODY.email },
    });
    expect(response.statusCode).toBe(202);
    expect(harness.emails).toHaveLength(0);
  });
});

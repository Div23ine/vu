import { createHash } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { SignJWT } from 'jose';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MfaMethod } from '@vunvault/contracts';
import type { Env } from '../../../config/env';
import { tokenIssuer } from '../../../lib/jwt';
import type { SignInResult, SupabaseAdmin, SupabaseSession } from '../../../lib/supabase-admin';
import { memoryKvStore, MfaChallengeStore, deriveChallengeKey } from './challenge';
import cookiesPlugin from '../../../plugins/cookies';
import errorHandler from '../../../plugins/error-handler';
import authPlugin from '../../../plugins/auth';
import { SessionRegistry, type SessionRecord } from '../../../lib/session-registry';
import type { AuthRepo, AuthProfileRow, NewSession } from './repo';
import authRoutes from './index';
import type { AuditEntryRow } from '../../../audit/repo';

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

const ISSUER = tokenIssuer(TEST_ENV.SUPABASE_URL);

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
  orgSeq = 0;

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
    this.orgSeq += 1;
    const id =
      this.orgSeq === 1
        ? ORG_ID
        : `a0000000-0000-4000-8000-0000000000${String(this.orgSeq).padStart(2, '0')}`;
    this.organizations.push({ id, ...input });
    return id;
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
    const [removed] = this.profiles.splice(index, 1);
    if (removed?.orgId !== null && removed?.orgId !== undefined) {
      const orgIndex = this.organizations.findIndex((org) => org.id === removed.orgId);
      if (orgIndex !== -1) this.organizations.splice(orgIndex, 1);
    }
    return true;
  }
  async listStalePendingSignups(olderThan: Date) {
    void olderThan;
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
    accessToken: 'access-token-value',
    refreshToken: 'refresh-token-value',
    expiresIn: 3600,
    sessionId: SESSION_ID,
    userId: USER_ID,
    aal: 'aal1',
    ...overrides,
  };
}

class FakeSupabase implements SupabaseAdmin {
  factors: Array<{ id: string; type: 'totp'; verified: boolean }> = [];
  passwordCorrect = true;
  signOutCalls: Array<{ token: string; scope: string }> = [];
  verifyCalls: Array<{ factorId: string; code: string }> = [];
  createdUsers: Array<{ id: string; email: string; emailConfirm: boolean }> = [];
  confirmedUsers: string[] = [];
  deletedUsers: string[] = [];
  issuedSessions: string[] = [];
  passwordUpdates: Array<{ userId: string; password: string }> = [];
  shouldThrow = false;
  private userSeq = 0;

  async createUser(input: { email: string; emailConfirm?: boolean }) {
    // A real Supabase user id is a uuid; the response schema validates it.
    // Sequential so a REPLACED pending signup is visibly a different user.
    this.userSeq += 1;
    const id =
      this.userSeq === 1
        ? USER_ID
        : `c0000000-0000-4000-8000-0000000000${String(this.userSeq).padStart(2, '0')}`;
    this.createdUsers.push({ id, email: input.email, emailConfirm: input.emailConfirm ?? true });
    return { id };
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
  async signInWithPassword(_email: string, password: string): Promise<SignInResult> {
    if (this.shouldThrow || !this.passwordCorrect || password === 'wrong-password') {
      throw new Error('invalid_credentials');
    }
    return {
      session: fakeSession(),
      userId: USER_ID,
      mfaRequired: this.factors.length > 0,
      factors: this.factors,
    };
  }
  async refresh(refreshToken: string) {
    if (refreshToken !== 'refresh-token-value') throw new Error('invalid refresh token');
    return fakeSession({ accessToken: 'rotated-access', refreshToken: 'rotated-refresh' });
  }
  async signOut(accessToken: string, scope: 'global' | 'local' | 'others') {
    this.signOutCalls.push({ token: accessToken, scope });
  }
  async updatePassword(userId: string, newPassword: string) {
    this.passwordUpdates.push({ userId, password: newPassword });
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
    challengeAndVerify: async (_token: string, factorId: string, code: string) => {
      this.verifyCalls.push({ factorId, code });
      if (code !== '481920') throw new Error('mfa_failed');
      return fakeSession({ aal: 'aal2', accessToken: 'aal2-access-token' });
    },
    unenroll: async () => undefined,
    listFactors: async () => this.factors,
  };
}

interface Harness {
  app: FastifyInstance;
  repo: FakeAuthRepo;
  supabase: FakeSupabase;
  kv: ReturnType<typeof memoryKvStore>;
  audits: Array<{ eventType: string; message: string; actorLabel: string; subject: string | null }>;
  emails: Array<{ to: string; subject: string; text?: string }>;
  breach: { breached: boolean };
  challenges: MfaChallengeStore;
}

async function makeHarness(): Promise<Harness> {
  const repo = new FakeAuthRepo();
  const supabase = new FakeSupabase();
  const kv = memoryKvStore();
  const emails: Array<{ to: string; subject: string; text?: string }> = [];
  const breach = { breached: false };
  const audits: Harness['audits'] = [];

  const challenges = new MfaChallengeStore({
    store: kv,
    key: deriveChallengeKey('development-only-key'),
  });

  const app = Fastify({ logger: false });
  // The routes declare Zod schemas, so the app needs the Zod compilers.
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
        actorLabel: String((input.actor as { label: string }).label),
        subject: (input.subject as string | undefined) ?? null,
      });
      return {
        seq: audits.length,
        id: 'entry-id',
        category: 'authentication',
        eventType: input.eventType,
        severity: 'info',
        sevLevel: null,
        actorId: null,
        actorLabel: 'system',
        ip: null,
        subject: null,
        message: String(input.message),
        details: {},
        sealedDetails: null,
        nonce: null,
        prevHash: '0'.repeat(64),
        hash: 'a'.repeat(64),
        signature: 'b'.repeat(64),
        keyId: 'v1',
        createdAt: new Date('2026-09-24T12:00:00Z'),
      } as unknown as AuditEntryRow;
    },
    publish: async () => undefined,
  } as unknown as FastifyInstance['audit']);

  app.decorate('email', {
    send: async (message: { to: string; subject: string; text?: string }) => {
      emails.push({ to: message.to, subject: message.subject, text: message.text });
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

  // Mirror production: the group is registered inside the `/api/v1` scope
  // (`fastify-plugin` skips encapsulation, so the prefix has to come from the
  // enclosing scope, exactly as `routes/v1/index.ts` does).
  await app.register(
    async (scope) => {
      await scope.register(authRoutes, {
        repo,
        supabase: supabase as unknown as SupabaseAdmin,
        kv,
        breach: { isBreached: async () => breach.breached },
      });
    },
    { prefix: '/api/v1' },
  );

  return { app, repo, supabase, kv, audits, emails, breach, challenges };
}

async function signedCookie(): Promise<string> {
  const token = await new SignJWT({
    sub: USER_ID,
    email: 'e.reed@vunvault.com',
    role: 'super_admin',
    org_id: null,
    permissions: ['dashboard:read'],
    session_id: SESSION_ID,
    aal: 'aal2',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(USER_ID)
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience('authenticated')
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(SECRET));
  return `vv_at=${token}`;
}

function cookieNames(response: { headers: Record<string, unknown> }): string[] {
  const raw = response.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw === undefined ? [] : [String(raw)];
  return list.map((entry) => String(entry).split('=')[0] ?? '');
}

const SIGNUP_BODY = {
  fullName: 'Jane Wanjiru',
  email: 'jane.wanjiru@acmefintech.co.ke',
  country: 'KE',
  accountType: 'company',
  password: 'Str0ng-Passphrase!',
  confirmPassword: 'Str0ng-Passphrase!',
  description: 'Acme Fintech Ltd',
};

let harness: Harness;

beforeEach(async () => {
  harness = await makeHarness();
});

describe('POST /api/v1/auth/signup (verified flow, Task 40d)', () => {
  it('answers 202, creates a pending_verification record and sets NO cookies', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: SIGNUP_BODY,
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({
      data: {
        email: SIGNUP_BODY.email,
        verificationRequired: true,
        resendAfterSeconds: 30,
        expiresInSeconds: 600,
      },
    });
    // Step 1 opens no session: the mailbox has not proved itself yet.
    expect(cookieNames(response)).toEqual([]);
    expect(response.body).not.toContain('access-token-value');

    expect(harness.repo.organizations).toHaveLength(1);
    expect(harness.repo.organizations[0]).toMatchObject({
      name: 'Acme Fintech Ltd',
      clientCode: 'VV-CL-48211',
      country: 'KE',
    });
    expect(harness.repo.profiles).toHaveLength(1);
    expect(harness.repo.profiles[0]).toMatchObject({
      email: SIGNUP_BODY.email,
      firstName: 'Jane',
      lastName: 'Wanjiru',
      role: 'client',
      accountStatus: 'pending_verification',
    });
    // No session yet.
    expect(harness.repo.sessions).toHaveLength(0);

    // The Supabase user is created UNCONFIRMED: the OTP is ours, not Supabase's.
    expect(harness.supabase.createdUsers).toHaveLength(1);
    expect(harness.supabase.createdUsers[0]?.emailConfirm).toBe(false);

    expect(harness.audits.map((entry) => entry.eventType)).toContain('ACCOUNT_REGISTERED');
  });

  it('enqueues the OTP email and keeps the code out of the HTTP response', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: SIGNUP_BODY,
    });
    expect(response.statusCode).toBe(202);

    expect(harness.emails).toHaveLength(1);
    expect(harness.emails[0]).toMatchObject({
      to: SIGNUP_BODY.email,
      subject: 'Your VUNVAULT verification code',
    });
    const text = harness.emails[0]?.text ?? '';
    expect(text).toContain('expires in 10 minutes');
    const code = /code is (\d{6})/.exec(text)?.[1];
    expect(code).toMatch(/^\d{6}$/);

    // The code exists in the email and in Redis as a DIGEST — never in the body.
    expect(response.body).not.toContain(code ?? 'impossible');
    const otpKey = `signup:otp:${createHash('sha256')
      .update(SIGNUP_BODY.email.toLowerCase(), 'utf8')
      .digest('hex')}`;
    const stored = harness.kv.entries.get(otpKey);
    expect(stored).toBeDefined();
    expect(stored?.value).not.toContain(code ?? 'impossible');
    const record = JSON.parse(stored?.value ?? '{}') as { codeHash: string; attempts: number };
    expect(record.codeHash).toBe(
      createHash('sha256')
        .update(code ?? '', 'utf8')
        .digest('hex'),
    );
    expect(record.attempts).toBe(0);
  });

  it('names the organisation after the person for an individual account', async () => {
    await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { ...SIGNUP_BODY, accountType: 'individual', description: undefined },
    });
    expect(harness.repo.organizations[0]?.name).toBe('Jane Wanjiru');
  });

  it('rejects a breached password with 422', async () => {
    harness.breach.breached = true;
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: SIGNUP_BODY,
    });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: 'breached_password' });
    expect(harness.repo.profiles).toHaveLength(0);
    expect(response.body.toLowerCase()).not.toContain(SIGNUP_BODY.password.toLowerCase());
  });

  it('rejects an ACTIVE duplicate email with 409', async () => {
    await harness.app.inject({ method: 'POST', url: '/api/v1/auth/signup', payload: SIGNUP_BODY });
    // Activate the first signup: a verified account owns its address.
    await harness.repo.activatePendingSignup(USER_ID);

    const second = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { ...SIGNUP_BODY, email: 'JANE.WANJIRU@acmefintech.co.ke' },
    });
    expect(second.statusCode).toBe(409);
    expect(second.json()).toMatchObject({ error: 'email_taken' });
  });

  it('REPLACES a pending_verification signup for the same email', async () => {
    const first = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: SIGNUP_BODY,
    });
    expect(first.statusCode).toBe(202);
    const firstUserId = harness.repo.profiles[0]?.id ?? '';

    const second = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { ...SIGNUP_BODY, description: 'Acme Fintech Ltd (retry)' },
    });
    expect(second.statusCode).toBe(202);

    // The unverified Supabase user was deleted and the rows replaced: exactly one
    // profile, one organisation, and they belong to the SECOND attempt.
    expect(harness.supabase.deletedUsers).toEqual([firstUserId]);
    expect(harness.repo.profiles).toHaveLength(1);
    expect(harness.repo.profiles[0]?.id).not.toBe(firstUserId);
    expect(harness.repo.organizations).toHaveLength(1);
    expect(harness.repo.organizations[0]?.name).toBe('Acme Fintech Ltd (retry)');
    // A fresh code was emailed for the replacement.
    expect(harness.emails).toHaveLength(2);
  });

  it('rejects mismatched passwords and a weak one', async () => {
    const mismatch = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { ...SIGNUP_BODY, confirmPassword: 'Different-1!' },
    });
    expect(mismatch.statusCode).toBe(400);
    expect((mismatch.json() as { details: Array<{ path: string[] }> }).details[0]?.path).toEqual([
      'confirmPassword',
    ]);

    const weak = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { ...SIGNUP_BODY, password: 'short', confirmPassword: 'short' },
    });
    expect(weak.statusCode).toBe(400);

    // Long but missing the Task 26 complexity rules: still rejected.
    const simple = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: {
        ...SIGNUP_BODY,
        password: 'a-long-enough-passphrase',
        confirmPassword: 'a-long-enough-passphrase',
      },
    });
    expect(simple.statusCode).toBe(400);
  });
});

describe('POST /api/v1/auth/login', () => {
  async function seedProfile(role: 'client' | 'security_analyst' = 'client') {
    harness.repo.profiles.push({
      id: USER_ID,
      email: 'e.reed@vunvault.com',
      fullName: 'Dr. Evelyn Reed',
      firstName: 'Evelyn',
      lastName: 'Reed',
      role,
      orgId: role === 'client' ? ORG_ID : null,
      accountStatus: 'active',
      deletedAt: null,
      mfaEnrolled: false,
    });
  }

  it('issues session cookies and records a success when no second factor exists', async () => {
    await seedProfile();
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'e.reed@vunvault.com', password: 'correct-password', remember: true },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      data: { user: { role: string } | null; mfaRequired: boolean };
    };
    expect(body.data.mfaRequired).toBe(false);
    expect(body.data.user?.role).toBe('client');
    expect(cookieNames(response).sort()).toEqual(['vv_at', 'vv_csrf', 'vv_rt']);
    expect(harness.repo.sessions).toHaveLength(1);
    expect(harness.repo.attempts.filter((a) => a.succeeded)).toHaveLength(1);
    expect(harness.audits.map((e) => e.eventType)).toContain('AUTH_SUCCESS');
  });

  it('answers a wrong password and an unknown email identically', async () => {
    await seedProfile();
    const wrongPassword = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'e.reed@vunvault.com', password: 'wrong-password' },
    });
    const unknownEmail = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'nobody@vunvault.com', password: 'wrong-password' },
    });

    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownEmail.statusCode).toBe(401);
    // Byte-identical bodies: no oracle for account enumeration.
    expect(unknownEmail.body).toBe(wrongPassword.body);
    expect(wrongPassword.json()).toEqual({
      error: 'invalid_credentials',
      message: 'Those credentials were not recognised',
    });
    expect(wrongPassword.body.toLowerCase()).not.toContain('password');
    expect(harness.repo.attempts.every((a) => !a.succeeded)).toBe(true);
  });

  it('refuses a suspended, dormant or soft-deleted account the same way', async () => {
    for (const profile of [
      { accountStatus: 'suspended' as const, deletedAt: null },
      { accountStatus: 'dormant' as const, deletedAt: null },
      { accountStatus: 'active' as const, deletedAt: '2026-09-01T00:00:00Z' },
    ]) {
      harness.repo.profiles = [
        {
          id: USER_ID,
          email: 'e.reed@vunvault.com',
          fullName: 'Dr. Evelyn Reed',
          firstName: 'Evelyn',
          lastName: 'Reed',
          role: 'client',
          orgId: ORG_ID,
          accountStatus: profile.accountStatus,
          deletedAt: profile.deletedAt,
          mfaEnrolled: false,
        },
      ];
      const response = await harness.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'e.reed@vunvault.com', password: 'correct-password' },
      });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ error: 'invalid_credentials' });
      expect(cookieNames(response)).not.toContain('vv_at');
    }
  });

  it('locks out on the sixth attempt and writes an AUTH_RATE_LIMIT entry', async () => {
    await seedProfile();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await harness.app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'e.reed@vunvault.com', password: 'wrong-password' },
      });
      expect(response.statusCode, `attempt ${attempt + 1}`).toBe(401);
    }

    const blocked = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'e.reed@vunvault.com', password: 'correct-password' },
    });
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json()).toMatchObject({ error: 'rate_limited' });
    expect(blocked.headers['retry-after']).toBe('900');
    expect(blocked.body).toContain('5 failed attempts in 15 min');

    const rateLimitEntry = harness.audits.find((e) => e.eventType === 'AUTH_RATE_LIMIT');
    expect(rateLimitEntry).toBeDefined();
    expect(rateLimitEntry?.actorLabel).toBe('external');
    expect(rateLimitEntry?.subject).toBe('e.reed@vunvault.com');
    // Supabase was never asked for the sixth password.
    expect(harness.repo.attempts.filter((a) => a.succeeded)).toHaveLength(0);
  });

  it('sets only vv_mfa when a second factor is available', async () => {
    await seedProfile('security_analyst');
    harness.supabase.factors = [{ id: 'factor-1', type: 'totp', verified: true }];

    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'e.reed@vunvault.com', password: 'correct-password' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      data: { user: unknown; mfaRequired: boolean; mfaMethods: MfaMethod[] };
    };
    expect(body.data).toMatchObject({ user: null, mfaRequired: true });
    expect(body.data.mfaMethods).toContain('totp');
    // Staff may also fall back to an emailed code.
    expect(body.data.mfaMethods).toContain('email_otp');

    const names = cookieNames(response);
    expect(names).toContain('vv_mfa');
    expect(names).not.toContain('vv_at');
    expect(names).not.toContain('vv_rt');
    expect(harness.repo.sessions).toHaveLength(0);
  });

  it('does not offer email OTP to a client', async () => {
    await seedProfile('client');
    harness.repo.webauthnCount = 1;
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'e.reed@vunvault.com', password: 'correct-password' },
    });
    const body = response.json() as { data: { mfaMethods: MfaMethod[] } };
    expect(body.data.mfaMethods).toEqual(['webauthn']);
  });

  it('stores the challenge without the access token in plaintext', async () => {
    await seedProfile('security_analyst');
    harness.supabase.factors = [{ id: 'factor-1', type: 'totp', verified: true }];
    await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'e.reed@vunvault.com', password: 'correct-password' },
    });

    const stored = [...harness.kv.entries.entries()].filter(([key]) => key.startsWith('mfa:'));
    expect(stored).toHaveLength(1);
    const payload = stored[0]?.[1].value ?? '';
    expect(payload).not.toContain('access-token-value');
    const parsed = JSON.parse(payload) as { sessionEnc: string; userId: string; attempts: number };
    expect(parsed.userId).toBe(USER_ID);
    expect(parsed.attempts).toBe(0);
    expect(parsed.sessionEnc).not.toContain('access-token-value');
    // The sealed session still round-trips with the derived key.
    expect(harness.challenges.decryptSession(parsed as never)).toMatchObject({
      accessToken: 'access-token-value',
    });
  });
});

describe('POST /api/v1/auth/mfa/verify', () => {
  async function startChallenge(): Promise<string> {
    harness.repo.profiles.push({
      id: USER_ID,
      email: 'e.reed@vunvault.com',
      fullName: 'Dr. Evelyn Reed',
      firstName: 'Evelyn',
      lastName: 'Reed',
      role: 'security_analyst',
      orgId: null,
      accountStatus: 'active',
      deletedAt: null,
      mfaEnrolled: true,
    });
    harness.supabase.factors = [{ id: 'factor-1', type: 'totp', verified: true }];
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'e.reed@vunvault.com', password: 'correct-password' },
    });
    const cookie = String(response.headers['set-cookie']);
    const handle = /vv_mfa=([^;]+)/.exec(cookie)?.[1];
    if (handle === undefined) throw new Error('no challenge handle issued');
    return handle;
  }

  it('issues session cookies after a correct TOTP code', async () => {
    const handle = await startChallenge();
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/verify',
      headers: { cookie: `vv_mfa=${handle}` },
      payload: { method: 'totp', code: '481920' },
    });

    expect(response.statusCode).toBe(200);
    expect((response.json() as { data: { email: string } }).data.email).toBe('e.reed@vunvault.com');
    expect(cookieNames(response)).toContain('vv_at');
    expect(harness.supabase.verifyCalls).toEqual([{ factorId: 'factor-1', code: '481920' }]);
    // The session row records which factor was used, so the registry can treat it
    // as AAL2 even though Supabase cannot raise its own assurance level.
    expect(harness.repo.sessions[0]?.mfaMethod).toBe('totp');
    expect(harness.audits.map((e) => e.eventType)).toContain('AUTH_SUCCESS');
    // The challenge is single-use.
    expect([...harness.kv.entries.keys()].filter((k) => k.startsWith('mfa:'))).toHaveLength(0);
  });

  it('deletes the challenge on the fifth wrong code', async () => {
    const handle = await startChallenge();
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const response = await harness.app.inject({
        method: 'POST',
        url: '/api/v1/auth/mfa/verify',
        headers: { cookie: `vv_mfa=${handle}` },
        payload: { method: 'totp', code: '000000' },
      });
      expect(response.statusCode, `attempt ${attempt}`).toBe(401);
      expect(response.json()).toMatchObject({ error: 'mfa_failed' });
    }

    const fifth = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/verify',
      headers: { cookie: `vv_mfa=${handle}` },
      payload: { method: 'totp', code: '000000' },
    });
    expect(fifth.statusCode).toBe(401);
    expect([...harness.kv.entries.keys()].filter((k) => k.startsWith('mfa:'))).toHaveLength(0);
    expect(harness.audits.map((e) => e.eventType)).toContain('AUTH_MFA_FAILURE');

    // With the challenge gone, even a correct code is refused.
    const after = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/verify',
      headers: { cookie: `vv_mfa=${handle}` },
      payload: { method: 'totp', code: '481920' },
    });
    expect(after.statusCode).toBe(410);
    expect(after.json()).toMatchObject({ error: 'challenge_expired' });
  });

  it('expires a missing challenge with 410', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/verify',
      payload: { method: 'totp', code: '481920' },
    });
    expect(response.statusCode).toBe(410);
    expect(response.json()).toMatchObject({ error: 'challenge_expired' });
  });

  it('returns 501 for webauthn until Task 27 registers a real verifier', async () => {
    const handle = await startChallenge();
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/verify',
      headers: { cookie: `vv_mfa=${handle}` },
      payload: { method: 'webauthn', assertion: { rawId: 'AA' } },
    });
    expect(response.statusCode).toBe(501);
    expect(response.json()).toMatchObject({ error: 'not_implemented' });
  });

  it('sends an email OTP once per minute and verifies the digest', async () => {
    const handle = await startChallenge();
    const sent = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/email-otp',
      headers: { cookie: `vv_mfa=${handle}` },
    });
    expect(sent.statusCode).toBe(202);
    expect(harness.emails[0]?.subject).toBe('Your VUNVAULT sign-in code');
    expect(harness.emails[0]?.to).toBe('e.reed@vunvault.com');

    // One send per 60 seconds.
    const again = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/email-otp',
      headers: { cookie: `vv_mfa=${handle}` },
    });
    expect(again.statusCode).toBe(429);

    // Only the digest is stored, never the code.
    const stored = harness.kv.entries.get(`emailotp:${USER_ID}`)?.value ?? '';
    expect(stored).not.toMatch(/\b\d{6}\b/);
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('rotates both cookies and touches the session row', async () => {
    harness.repo.sessions.push({
      id: SESSION_ID,
      userId: USER_ID,
      deviceLabel: 'Mac · Safari',
      userAgent: null,
      ip: '41.90.32.10',
      geoCity: null,
      geoCountry: null,
      mfaMethod: null,
      revokedAt: null,
      lastSeenAt: null,
    });

    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { cookie: 'vv_rt=refresh-token-value' },
    });
    expect(response.statusCode).toBe(204);
    expect(cookieNames(response)).toContain('vv_at');
    expect(harness.repo.sessions[0]?.lastSeenAt).not.toBeNull();
  });

  it('rejects an unknown refresh token', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { cookie: 'vv_rt=stolen' },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: 'unauthorized' });
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('revokes the session row and clears every cookie', async () => {
    harness.repo.sessions.push({
      id: SESSION_ID,
      userId: USER_ID,
      deviceLabel: 'Mac · Safari',
      userAgent: null,
      ip: '41.90.32.10',
      geoCity: 'Nairobi',
      geoCountry: 'KE',
      mfaMethod: null,
      revokedAt: null,
      lastSeenAt: null,
    });

    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { cookie: await signedCookie() },
    });

    expect(response.statusCode).toBe(204);
    expect(harness.repo.sessions[0]?.revokedAt).not.toBeNull();
    // The access token presented to Supabase is the one from the vv_at cookie.
    expect(harness.supabase.signOutCalls).toHaveLength(1);
    expect(harness.supabase.signOutCalls[0]?.scope).toBe('local');
    expect(harness.supabase.signOutCalls[0]?.token.startsWith('eyJ')).toBe(true);
    const cleared = String(response.headers['set-cookie']);
    expect(cleared).toContain('vv_at=');
    expect(cleared).toContain('Expires=Thu, 01 Jan 1970');
    expect(harness.audits.map((e) => e.eventType)).toContain('AUTH_LOGOUT');
  });

  it('requires a session', async () => {
    const response = await harness.app.inject({ method: 'POST', url: '/api/v1/auth/logout' });
    expect(response.statusCode).toBe(401);
  });
});

describe('GET /api/v1/auth/session', () => {
  it('returns the session user with the MFA summary', async () => {
    harness.repo.profiles.push({
      id: USER_ID,
      email: 'e.reed@vunvault.com',
      fullName: 'Dr. Evelyn Reed',
      firstName: 'Evelyn',
      lastName: 'Reed',
      role: 'super_admin',
      orgId: null,
      accountStatus: 'active',
      deletedAt: null,
      mfaEnrolled: true,
    });

    const response = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/auth/session',
      headers: { cookie: await signedCookie() },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      data: {
        id: string;
        email: string;
        role: string;
        mfaEnrolled: boolean;
        permissions: string[];
      };
    };
    expect(body.data).toMatchObject({
      id: USER_ID,
      email: 'e.reed@vunvault.com',
      role: 'super_admin',
      mfaEnrolled: true,
    });
    expect(body.data.permissions).toContain('intel:broadcast');
  });

  it('is 401 without a cookie', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/api/v1/auth/session' });
    expect(response.statusCode).toBe(401);
  });
});

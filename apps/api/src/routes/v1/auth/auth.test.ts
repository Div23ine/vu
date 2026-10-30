import { createHash } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { SignJWT } from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../../../config/env.js';
import { tokenIssuer } from '../../../lib/jwt.js';
import type { SignInResult, SupabaseAdmin, SupabaseSession } from '../../../lib/supabase-admin.js';
import { memoryKvStore, MfaChallengeStore, deriveChallengeKey } from './challenge.js';
import {
  deriveMagicLinkSecret,
  MagicLinkTokenStore,
  MAGIC_LINK_TTL_SECONDS,
} from './magic-link.js';
import cookiesPlugin from '../../../plugins/cookies.js';
import errorHandler from '../../../plugins/error-handler.js';
import authPlugin from '../../../plugins/auth.js';
import { SessionRegistry, type SessionRecord } from '../../../lib/session-registry.js';
import type { AuthRepo, AuthProfileRow, NewSession } from './repo.js';
import authRoutes from './index.js';
import type { AuditEntryRow } from '../../../audit/repo.js';
import { MAGIC_LINK_ACK_MESSAGE } from '@vunvault/contracts';
import { captchaFailed, type TurnstileVerifier } from '../public/turnstile.js';

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
  async setAccountStatus(profileId: string, status: AuthProfileRow['accountStatus']) {
    const row = this.profiles.find((p) => p.id === profileId);
    if (row !== undefined) row.accountStatus = status;
  }
  async setMfaEnrolled(profileId: string, enrolled: boolean) {
    const row = this.profiles.find((p) => p.id === profileId);
    if (row !== undefined) row.mfaEnrolled = enrolled;
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
  enrollCalls: Array<{ token: string; friendlyName: string }> = [];
  mfa = {
    enrollTotp: async (token: string, friendlyName: string) => {
      this.enrollCalls.push({ token, friendlyName });
      return {
        factorId: 'f1',
        qrSvg: '<svg/>',
        secret: 'JBSWY3DPEHPK3PXP',
        uri: 'otpauth://totp/x',
      };
    },
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

async function makeHarness(
  options: { turnstileEnforced?: boolean; turnstile?: TurnstileVerifier } = {},
): Promise<Harness> {
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
        ...(options.turnstile !== undefined ? { turnstile: options.turnstile } : {}),
        ...(options.turnstileEnforced !== undefined
          ? { turnstileEnforced: options.turnstileEnforced }
          : {}),
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

/** A redirect's Location as a parsed URL (the magic-link query carries methods/to/next). */
function locationOf(response: { headers: Record<string, unknown> }): URL {
  return new URL(String(response.headers.location));
}

/**
 * Phase 4: simulate a backoff lock elapsing — strip `lockedUntilEpochMs` from
 * the stored challenge without touching the attempt counter (the lock is a
 * wall-clock gate; tests cannot wait real seconds).
 */
function unlock(handle: string): void {
  const key = `mfa:${handle}`;
  const raw = harness.kv.entries.get(key);
  if (raw === undefined) return;
  const challenge = JSON.parse(raw.value) as Record<string, unknown>;
  delete challenge.lockedUntilEpochMs;
  harness.kv.entries.set(key, { ...raw, value: JSON.stringify(challenge) });
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

describe('POST /api/v1/auth/magic-link', () => {
  function seedProfile(
    role: 'client' | 'security_analyst' = 'client',
    overrides: Partial<AuthProfileRow> = {},
  ) {
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
      ...overrides,
    });
  }

  /** The single-use token inside the emailed verify link. */
  function tokenFrom(emailText: string): string {
    const match = /token=([^&\s]+)/.exec(emailText);
    if (match === null) throw new Error(`no token in email text: ${emailText}`);
    return match[1] ?? '';
  }

  async function requestLink(email: string, extra: Record<string, unknown> = {}) {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/magic-link',
      payload: { email, ...extra },
    });
    return response;
  }

  it('emails a single-use sign-in link to a registered address and audits the issuance', async () => {
    await seedProfile();
    const response = await requestLink('e.reed@vunvault.com');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      message: 'If an account exists for that address, a sign-in link is on its way.',
    });
    expect(harness.emails).toHaveLength(1);
    expect(harness.emails[0]).toMatchObject({
      to: 'e.reed@vunvault.com',
      subject: 'Your VUNVAULT sign-in link',
    });
    const text = harness.emails[0]?.text ?? '';
    expect(text).toContain('https://api.vunvault.test/api/v1/auth/magic-link/verify?token=');
    expect(text).toContain('15 minutes');
    // The token lives in the KV, and the audit chain records the FACT — never the token.
    expect([...harness.kv.entries.keys()].some((key) => key.startsWith('ml:token:'))).toBe(true);
    const issued = harness.audits.find((e) => e.eventType === 'MAGIC_LINK_ISSUED');
    expect(issued?.subject).toBe('e.reed@vunvault.com');
    for (const entry of harness.audits) {
      expect(entry.message).not.toContain('token=');
    }
    // No session exists yet: the link has not been followed.
    expect(harness.supabase.issuedSessions).toHaveLength(0);
  });

  it('answers registered and unregistered addresses with byte-identical bodies', async () => {
    await seedProfile();
    const registered = await requestLink('e.reed@vunvault.com');
    const unregistered = await requestLink('nobody@vunvault.com');

    expect(registered.statusCode).toBe(200);
    expect(unregistered.statusCode).toBe(200);
    // The whole anti-enumeration guarantee, in one assertion.
    expect(unregistered.body).toBe(registered.body);
  });

  it('sends exactly one signup invitation per cooldown window to an unregistered address', async () => {
    const first = await requestLink('nobody@vunvault.com');
    expect(first.statusCode).toBe(200);
    expect(harness.emails).toHaveLength(1);
    expect(harness.emails[0]).toMatchObject({
      to: 'nobody@vunvault.com',
      subject: 'No VUNVAULT account found for this email',
    });
    const text = harness.emails[0]?.text ?? '';
    expect(text).toContain('no VUNVAULT account is registered');
    expect(text).toContain('https://www.vunvault.test/signup');
    expect(harness.audits.map((e) => e.eventType)).toContain('SIGNUP_INVITE_SENT');

    // Inside the window: identical 200, but the mailbox is NOT bombed again.
    const second = await requestLink('nobody@vunvault.com');
    expect(second.statusCode).toBe(200);
    expect(second.body).toBe(first.body);
    expect(harness.emails).toHaveLength(1);
  });

  it('rejects a password field outright — no login endpoint accepts one', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/magic-link',
      payload: { email: 'e.reed@vunvault.com', password: 'correct-horse' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('a newer link kills the previous one for the same address', async () => {
    await seedProfile('client', { mfaEnrolled: true });
    await requestLink('e.reed@vunvault.com');
    const firstToken = tokenFrom(harness.emails[0]?.text ?? '');
    await requestLink('e.reed@vunvault.com');
    const secondToken = tokenFrom(harness.emails[1]?.text ?? '');
    expect(secondToken).not.toBe(firstToken);

    const stale = await harness.app.inject({
      method: 'GET',
      url: `/api/v1/auth/magic-link/verify?token=${encodeURIComponent(firstToken)}`,
    });
    expect(stale.statusCode).toBe(302);
    expect(stale.headers.location).toBe('https://www.vunvault.test/login?error=magic_link_used');

    const fresh = await harness.app.inject({
      method: 'GET',
      url: `/api/v1/auth/magic-link/verify?token=${encodeURIComponent(secondToken)}`,
    });
    expect(fresh.statusCode).toBe(302);
    expect(`${locationOf(fresh).origin}${locationOf(fresh).pathname}`).toBe(
      'https://www.vunvault.test/login/mfa',
    );
  });
});

describe('GET /api/v1/auth/magic-link/verify', () => {
  function seedProfile(
    role: 'client' | 'security_analyst' = 'client',
    overrides: Partial<AuthProfileRow> = {},
  ) {
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
      ...overrides,
    });
  }

  /** POST step 1 and pull the token back out of the emailed link. */
  async function mintToken(email = 'e.reed@vunvault.com', extra: Record<string, unknown> = {}) {
    await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/magic-link',
      payload: { email, ...extra },
    });
    const text = harness.emails.at(-1)?.text ?? '';
    const match = /token=([^&\s]+)/.exec(text);
    if (match === null) throw new Error(`no token in email text: ${text}`);
    return {
      token: match[1] ?? '',
      link: text.split('\n').find((l) => l.includes('token=')) ?? '',
    };
  }

  function verifyUrl(token: string, extra = '') {
    return `/api/v1/auth/magic-link/verify?token=${encodeURIComponent(token)}${extra}`;
  }

  function storedChallenge(): {
    methods: string[];
    sessionEnc: string;
    userId: string;
    setup?: { required: true; deadlineEpochMs: number | null };
  } {
    const stored = [...harness.kv.entries.entries()].filter(([key]) => key.startsWith('mfa:'));
    expect(stored).toHaveLength(1);
    return JSON.parse(stored[0]?.[1].value ?? '{}') as never;
  }

  it('opens the pre-MFA challenge: 302 to the MFA screen, vv_mfa and nothing else', async () => {
    await seedProfile('security_analyst');
    harness.supabase.factors = [{ id: 'factor-1', type: 'totp', verified: true }];
    const { token } = await mintToken();

    const response = await harness.app.inject({ method: 'GET', url: verifyUrl(token) });

    expect(response.statusCode).toBe(302);
    const location = locationOf(response);
    expect(`${location.origin}${location.pathname}`).toBe('https://www.vunvault.test/login/mfa');
    // The panel's copy inputs: which methods the challenge holds, and the
    // masked address (never the full one — no PII in a URL).
    expect(location.searchParams.get('methods')).toBe('totp,email_otp');
    expect(location.searchParams.get('to')).toBe('e.\u2022\u2022\u2022\u2022@vunvault.com');
    expect(location.searchParams.get('to')).not.toContain('reed');
    const names = cookieNames(response);
    expect(names).toContain('vv_mfa');
    expect(names).not.toContain('vv_at');
    expect(names).not.toContain('vv_rt');
    // The aal1 session was minted server-side, never passed through a browser.
    expect(harness.supabase.issuedSessions).toEqual(['e.reed@vunvault.com']);
    expect(harness.repo.sessions).toHaveLength(0); // no FULL session row yet
    expect(harness.repo.attempts.filter((a) => a.succeeded)).toHaveLength(1);
    expect(harness.audits.map((e) => e.eventType)).toContain('MAGIC_LINK_VERIFIED');

    // Staff with an enrolled authenticator: both the TOTP and the emailed-code path.
    const challenge = storedChallenge();
    expect(challenge.userId).toBe(USER_ID);
    expect(challenge.methods).toContain('totp');
    expect(challenge.methods).toContain('email_otp');
    // The sealed session never sits in the KV in plaintext.
    expect(challenge.sessionEnc).not.toContain('access-token-value');
    expect(harness.challenges.decryptSession(challenge as never)).toMatchObject({
      accessToken: 'access-token-value',
    });
  });

  it('guarantees a six-digit code path for an enrolled normal user', async () => {
    await seedProfile('client', { mfaEnrolled: true });
    const { token } = await mintToken();

    const response = await harness.app.inject({ method: 'GET', url: verifyUrl(token) });
    expect(response.statusCode).toBe(302);
    expect(`${locationOf(response).origin}${locationOf(response).pathname}`).toBe(
      'https://www.vunvault.test/login/mfa',
    );
    expect(locationOf(response).searchParams.get('methods')).toBe('email_otp');
    expect(storedChallenge().methods).toEqual(['email_otp']);
  });

  it('routes an UNENROLLED normal user to enrolment — blocked from bypassing, never timed', async () => {
    await seedProfile('client');
    const { token } = await mintToken();

    const response = await harness.app.inject({ method: 'GET', url: verifyUrl(token) });
    expect(response.statusCode).toBe(302);
    const location = locationOf(response);
    expect(`${location.origin}${location.pathname}`).toBe(
      'https://www.vunvault.test/login/mfa/setup',
    );
    // Clients get enrolment routing, not the administrator's timed window.
    expect(location.searchParams.has('deadline')).toBe(false);
    expect(cookieNames(response)).toContain('vv_mfa');
    const challenge = storedChallenge();
    expect(challenge.setup).toEqual({ required: true, deadlineEpochMs: null });
    // No ledger record: only TIMED (administrator) windows are recorded.
    const ledgered = [...harness.kv.entries.keys()].filter((key) => key.startsWith('mfasetup:'));
    expect(ledgered).toEqual([]);
  });

  it('a replayed token fails', async () => {
    await seedProfile('client', { mfaEnrolled: true });
    const { token } = await mintToken();

    const first = await harness.app.inject({ method: 'GET', url: verifyUrl(token) });
    expect(first.statusCode).toBe(302);
    expect(`${locationOf(first).origin}${locationOf(first).pathname}`).toBe(
      'https://www.vunvault.test/login/mfa',
    );

    const replay = await harness.app.inject({ method: 'GET', url: verifyUrl(token) });
    expect(replay.statusCode).toBe(302);
    expect(replay.headers.location).toBe('https://www.vunvault.test/login?error=magic_link_used');
    expect(cookieNames(replay)).not.toContain('vv_mfa');
    // The replay opened no second challenge and minted no second session.
    expect(harness.supabase.issuedSessions).toHaveLength(1);
  });

  it('an expired token fails with a clear error', async () => {
    await seedProfile();
    // Mint a token whose clock started 16 minutes in the past: the signature is
    // valid, the TTL is not. The store's injected `now` is the test seam.
    const backdated = new MagicLinkTokenStore(
      harness.kv,
      deriveMagicLinkSecret('development-only-key'),
      MAGIC_LINK_TTL_SECONDS,
      () => Date.now() - 16 * 60 * 1000,
    );
    const { token } = await backdated.issue('e.reed@vunvault.com');

    const response = await harness.app.inject({ method: 'GET', url: verifyUrl(token) });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(
      'https://www.vunvault.test/login?error=magic_link_expired',
    );
    expect(cookieNames(response)).not.toContain('vv_mfa');
    expect(harness.supabase.issuedSessions).toHaveLength(0);
  });

  it('a forged or malformed token fails without touching a session', async () => {
    await seedProfile();
    // Signed with the wrong secret: the HMAC check fails before any storage read.
    const forged = new MagicLinkTokenStore(harness.kv, 'the-wrong-secret');
    const { token } = await forged.issue('e.reed@vunvault.com');

    const response = await harness.app.inject({ method: 'GET', url: verifyUrl(token) });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(
      'https://www.vunvault.test/login?error=magic_link_invalid',
    );

    // Random garbage takes the identical path (and never a JSON 400 in a browser).
    const garbage = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/auth/magic-link/verify?token=not-even-close',
    });
    expect(garbage.statusCode).toBe(302);
    expect(garbage.headers.location).toBe(
      'https://www.vunvault.test/login?error=magic_link_invalid',
    );
    expect(harness.supabase.issuedSessions).toHaveLength(0);
  });

  it('refuses a suspended or blocked account at the verify leg', async () => {
    for (const overrides of [
      { accountStatus: 'suspended' as const },
      { accountStatus: 'blocked_mfa_setup' as const },
    ]) {
      harness.repo.profiles = [];
      seedProfile('client', overrides);
      const { token } = await mintToken();
      const response = await harness.app.inject({ method: 'GET', url: verifyUrl(token) });
      expect(response.statusCode).toBe(302);
      expect(cookieNames(response)).not.toContain('vv_mfa');
      expect(response.headers.location).toBe(
        'https://www.vunvault.test/login?error=account_blocked',
      );
    }
  });

  it('treats a soft-deleted account as unregistered — an invite, never a link', async () => {
    seedProfile('client', { deletedAt: '2026-09-01T00:00:00Z' });
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/magic-link',
      payload: { email: 'e.reed@vunvault.com' },
    });
    // Identical acknowledgement, but the mailbox gets the signup invitation and
    // no verify token exists to replay.
    expect(response.statusCode).toBe(200);
    expect(harness.emails.at(-1)?.subject).toBe('No VUNVAULT account found for this email');
    expect(harness.emails.at(-1)?.text).not.toContain('token=');
  });

  it('refuses a pending_verification account with account_inactive', async () => {
    seedProfile('client', { accountStatus: 'pending_verification' });
    const { token } = await mintToken();
    const response = await harness.app.inject({ method: 'GET', url: verifyUrl(token) });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(
      'https://www.vunvault.test/login?error=account_inactive',
    );
  });

  it('carries a sanitised next from the request through the link to the MFA screen', async () => {
    await seedProfile('client', { mfaEnrolled: true });
    const { token, link } = await mintToken('e.reed@vunvault.com', { next: '/portal/scans' });
    expect(link).toContain('next=%2Fportal%2Fscans');

    const response = await harness.app.inject({
      method: 'GET',
      url: verifyUrl(token, '&next=%2Fportal%2Fscans'),
    });
    const location = locationOf(response);
    expect(`${location.origin}${location.pathname}`).toBe('https://www.vunvault.test/login/mfa');
    expect(location.searchParams.get('next')).toBe('/portal/scans');
  });

  it('drops an open-redirect next', async () => {
    await seedProfile('client', { mfaEnrolled: true });
    const { token, link } = await mintToken('e.reed@vunvault.com', { next: '//evil.example/x' });
    expect(link).not.toContain('next=');
    const response = await harness.app.inject({
      method: 'GET',
      url: verifyUrl(token, '&next=%2F%2Fevil.example%2Fx'),
    });
    const location = locationOf(response);
    expect(`${location.origin}${location.pathname}`).toBe('https://www.vunvault.test/login/mfa');
    expect(location.searchParams.get('next')).toBeNull();
    expect(location.toString()).not.toContain('evil.example');
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
    // Phase 1: the challenge is opened by the magic-link pair, not a password.
    await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/magic-link',
      payload: { email: 'e.reed@vunvault.com' },
    });
    const text = harness.emails.at(-1)?.text ?? '';
    const token = /token=([^&\s]+)/.exec(text)?.[1];
    if (token === undefined) throw new Error('no magic link issued');
    const response = await harness.app.inject({
      method: 'GET',
      url: `/api/v1/auth/magic-link/verify?token=${encodeURIComponent(token)}`,
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
      // Phase 4: let each backoff lock elapse before the next attempt.
      unlock(handle);
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

  it('locks the challenge with exponential backoff after the second failure (Phase 4)', async () => {
    const handle = await startChallenge();
    const wrong = () =>
      harness.app.inject({
        method: 'POST',
        url: '/api/v1/auth/mfa/verify',
        headers: { cookie: `vv_mfa=${handle}` },
        payload: { method: 'totp', code: '000000' },
      });

    expect((await wrong()).statusCode).toBe(401); // attempt 1 — no lock yet
    expect((await wrong()).statusCode).toBe(401); // attempt 2 — locks for 2s

    // While the lock runs: 429 + Retry-After, and NO attempt is consumed.
    const locked = await wrong();
    expect(locked.statusCode).toBe(429);
    expect(locked.json()).toMatchObject({ error: 'rate_limited' });
    expect(String(locked.headers['retry-after'])).toMatch(/^\d+$/);
    const stored = harness.kv.entries.get(`mfa:${handle}`);
    expect(stored).toBeDefined();
    expect((JSON.parse(stored?.value ?? '{}') as { attempts: number }).attempts).toBe(2);

    // Once it elapses (simulated), verification resumes and burns attempt 3.
    unlock(handle);
    expect((await wrong()).statusCode).toBe(401);
    const after = harness.kv.entries.get(`mfa:${handle}`);
    expect((JSON.parse(after?.value ?? '{}') as { attempts: number }).attempts).toBe(3);
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
    // startChallenge() already emailed the sign-in LINK; the OTP is the latest.
    expect(harness.emails.at(-1)?.subject).toBe('Your VUNVAULT sign-in code');
    expect(harness.emails.at(-1)?.to).toBe('e.reed@vunvault.com');

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

// ——— Phase 2: forced first-sign-in MFA setup ———

describe('Phase 2 — magic-link verify routes unenrolled accounts to setup', () => {
  function seedRosterProfile(
    overrides: Partial<AuthProfileRow> & { email: string; role: AuthProfileRow['role'] },
  ) {
    harness.repo.profiles.push({
      id: USER_ID,
      fullName: 'Roster Person',
      firstName: 'Roster',
      lastName: 'Person',
      orgId: null,
      accountStatus: 'active',
      deletedAt: null,
      mfaEnrolled: false,
      ...overrides,
    });
  }

  async function mintAndVerify(email: string, next?: string) {
    await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/magic-link',
      payload: { email },
    });
    const text = harness.emails.at(-1)?.text ?? '';
    const match = /token=([^&\s]+)/.exec(text);
    if (match === null) throw new Error(`no token in email text: ${text}`);
    const token = match[1] ?? '';
    const url = `/api/v1/auth/magic-link/verify?token=${encodeURIComponent(token)}${
      next !== undefined ? `&next=${encodeURIComponent(next)}` : ''
    }`;
    return harness.app.inject({ method: 'GET', url });
  }

  function ledgerRecord(userId: string): {
    handle: string;
    userId: string;
    email: string;
    deadlineEpochMs: number;
    createdAtEpochMs: number;
  } {
    const entry = harness.kv.entries.get(`mfasetup:u:${userId}`);
    if (entry === undefined) throw new Error('no setup ledger record');
    return JSON.parse(entry.value) as never;
  }

  it('an unenrolled ADMINISTRATOR gets the timed setup window (5:00) and a ledger record', async () => {
    seedRosterProfile({ email: 'daniel@vunvault.com', role: 'admin', fullName: 'Daniel Okafor' });
    const before = Date.now();
    const response = await mintAndVerify('daniel@vunvault.com', '/admin/users');
    const after = Date.now();

    expect(response.statusCode).toBe(302);
    const location = locationOf(response);
    expect(`${location.origin}${location.pathname}`).toBe(
      'https://www.vunvault.test/login/mfa/setup',
    );
    expect(location.searchParams.get('to')).toBe('da\u2022\u2022\u2022\u2022@vunvault.com');
    expect(location.searchParams.get('next')).toBe('/admin/users');
    const deadline = Number(location.searchParams.get('deadline'));
    expect(deadline).toBeGreaterThanOrEqual(before + 300_000 - 5_000);
    expect(deadline).toBeLessThanOrEqual(after + 300_000 + 5_000);

    // Only the pre-MFA cookie: no full session before the factor exists.
    const names = cookieNames(response);
    expect(names).toContain('vv_mfa');
    expect(names).not.toContain('vv_at');
    expect(harness.repo.sessions).toHaveLength(0);

    const record = ledgerRecord(USER_ID);
    expect(record.email).toBe('daniel@vunvault.com');
    expect(record.deadlineEpochMs).toBe(deadline);
    const challenge = JSON.parse(harness.kv.entries.get(`mfa:${record.handle}`)?.value ?? '{}') as {
      setup?: { required: true; deadlineEpochMs: number | null };
    };
    expect(challenge.setup).toEqual({ required: true, deadlineEpochMs: deadline });
  });

  it('a NON-ROSTER admin-role account still gets the standard 5:00 window', async () => {
    seedRosterProfile({ email: 'future.admin@vunvault.com', role: 'admin' });
    const response = await mintAndVerify('future.admin@vunvault.com');
    const deadline = Number(locationOf(response).searchParams.get('deadline'));
    expect(deadline).toBeGreaterThan(Date.now() + 290_000);
    expect(ledgerRecord(USER_ID).email).toBe('future.admin@vunvault.com');
  });

  it('the EXEMPT super admin (divine@) signs straight in — no gate, no timer, no ledger', async () => {
    seedRosterProfile({
      email: 'divine@vunvault.com',
      role: 'super_admin',
      fullName: 'Divine Gospel',
    });
    const response = await mintAndVerify('divine@vunvault.com');

    expect(response.statusCode).toBe(302);
    // Full session cookies straight from the verify leg; landing = the admin home.
    expect(response.headers.location).toBe('https://www.vunvault.test/admin');
    const names = cookieNames(response);
    expect(names).toContain('vv_at');
    expect(names).toContain('vv_rt');
    expect(names).not.toContain('vv_mfa');
    expect(harness.repo.sessions).toHaveLength(1);
    expect(harness.audits.map((e) => e.eventType)).toContain('AUTH_SUCCESS');
    const ledgered = [...harness.kv.entries.keys()].filter((key) => key.startsWith('mfasetup:'));
    expect(ledgered).toEqual([]);
  });

  it('an ENROLLED divine@ takes the normal challenge like everyone else', async () => {
    seedRosterProfile({
      email: 'divine@vunvault.com',
      role: 'super_admin',
      fullName: 'Divine Gospel',
    });
    harness.supabase.factors = [{ id: 'factor-1', type: 'totp', verified: true }];
    const response = await mintAndVerify('divine@vunvault.com');

    expect(response.statusCode).toBe(302);
    const location = locationOf(response);
    expect(`${location.origin}${location.pathname}`).toBe('https://www.vunvault.test/login/mfa');
    expect(location.searchParams.get('methods')).toBe('totp,email_otp');
    expect(cookieNames(response)).not.toContain('vv_at');
  });

  it('an ENROLLED administrator takes the normal challenge', async () => {
    seedRosterProfile({ email: 'tshepiso@vunvault.com', role: 'admin' });
    harness.supabase.factors = [{ id: 'factor-1', type: 'totp', verified: true }];
    const response = await mintAndVerify('tshepiso@vunvault.com');
    expect(`${locationOf(response).origin}${locationOf(response).pathname}`).toBe(
      'https://www.vunvault.test/login/mfa',
    );
  });
});

describe('Phase 2 — POST /api/v1/auth/mfa/setup/*', () => {
  function seedAdmin(email = 'daniel@vunvault.com') {
    harness.repo.profiles.push({
      id: USER_ID,
      email,
      fullName: 'Daniel Okafor',
      firstName: 'Daniel',
      lastName: 'Okafor',
      role: 'admin',
      orgId: null,
      accountStatus: 'active',
      deletedAt: null,
      mfaEnrolled: false,
    });
  }

  /** Run the verify leg and return the live setup-challenge handle. */
  async function openSetupWindow(email = 'daniel@vunvault.com'): Promise<string> {
    await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/magic-link',
      payload: { email },
    });
    const text = harness.emails.at(-1)?.text ?? '';
    const token = /token=([^&\s]+)/.exec(text)?.[1] ?? '';
    const response = await harness.app.inject({
      method: 'GET',
      url: `/api/v1/auth/magic-link/verify?token=${encodeURIComponent(token)}`,
    });
    const raw = response.headers['set-cookie'];
    const list = Array.isArray(raw) ? raw : raw === undefined ? [] : [String(raw)];
    for (const entry of list) {
      const cookie = String(entry).split(';')[0] ?? '';
      if (cookie.startsWith('vv_mfa=')) return decodeURIComponent(cookie.slice('vv_mfa='.length));
    }
    throw new Error('no vv_mfa cookie');
  }

  function cookieFor(handle: string) {
    return { cookie: `vv_mfa=${encodeURIComponent(handle)}` };
  }

  /** Simulate the 5-minute window closing: challenge TTL out, ledger stale. */
  function expireWindow(handle: string) {
    harness.kv.entries.delete(`mfa:${handle}`);
    for (const key of [`mfasetup:u:${USER_ID}`, `mfasetup:h:${handle}`]) {
      const entry = harness.kv.entries.get(key);
      if (entry === undefined) throw new Error(`no ledger entry ${key}`);
      const record = JSON.parse(entry.value) as Record<string, unknown>;
      entry.value = JSON.stringify({ ...record, deadlineEpochMs: Date.now() - 1_000 });
    }
  }

  function profileRow(): (typeof harness.repo.profiles)[number] {
    const row = harness.repo.profiles.find((p) => p.id === USER_ID);
    if (row === undefined) throw new Error('profile missing');
    return row;
  }

  it('options enrols a TOTP factor against the pre-MFA session', async () => {
    seedAdmin();
    const handle = await openSetupWindow();

    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/setup/options',
      headers: cookieFor(handle),
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      data: {
        factorId: string;
        qrCodeSvg: string;
        secret: string;
        uri: string;
        deadlineEpochMs: number | null;
      };
    };
    expect(body.data.factorId).toBe('f1');
    expect(body.data.qrCodeSvg).toBe('<svg/>');
    expect(body.data.secret).toBe('JBSWY3DPEHPK3PXP');
    expect(body.data.uri).toBe('otpauth://totp/x');
    expect(body.data.deadlineEpochMs).toBeGreaterThan(Date.now() + 200_000);
    // The enrolment runs as the USER (the challenge's sealed aal1 session).
    expect(harness.supabase.enrollCalls).toEqual([
      { token: 'access-token-value', friendlyName: 'Authenticator app' },
    ]);
  });

  it('options on an ORDINARY (non-setup) challenge is refused 403', async () => {
    seedAdmin();
    harness.supabase.factors = [{ id: 'factor-1', type: 'totp', verified: true }];
    const handle = await openSetupWindow(); // enrolled → normal /login/mfa challenge

    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/setup/options',
      headers: cookieFor(handle),
    });
    expect(response.statusCode).toBe(403);
  });

  it('verify with the first correct code enrols, rotates cookies and opens the full session', async () => {
    seedAdmin();
    const handle = await openSetupWindow();
    await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/setup/options',
      headers: cookieFor(handle),
    });

    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/setup/verify',
      headers: cookieFor(handle),
      payload: { factorId: 'f1', code: '481920' },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: { email: string; role: string; mfaEnrolled: boolean } };
    expect(body.data).toMatchObject({
      email: 'daniel@vunvault.com',
      role: 'admin',
      mfaEnrolled: true,
    });
    expect(harness.supabase.verifyCalls).toEqual([{ factorId: 'f1', code: '481920' }]);

    // Cookies rotate exactly like the ordinary verify leg.
    const names = cookieNames(response);
    expect(names).toContain('vv_at');
    expect(names).toContain('vv_rt');
    expect(profileRow().mfaEnrolled).toBe(true);
    expect(harness.repo.sessions).toHaveLength(1);
    // The window is closed and the ledger cleaned — no lazy block can fire.
    expect(harness.kv.entries.get(`mfa:${handle}`)).toBeUndefined();
    expect(harness.kv.entries.get(`mfasetup:u:${USER_ID}`)).toBeUndefined();
    const events = harness.audits.map((e) => e.eventType);
    expect(events).toContain('MFA_ENABLED');
    expect(events).toContain('AUTH_SUCCESS');
  });

  it('wrong codes burn the attempt budget; the exhausted challenge dies', async () => {
    seedAdmin();
    const handle = await openSetupWindow();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await harness.app.inject({
        method: 'POST',
        url: '/api/v1/auth/mfa/setup/verify',
        headers: cookieFor(handle),
        payload: { factorId: 'f1', code: '000000' },
      });
      expect(response.statusCode).toBe(401);
      // Phase 4: let each backoff lock elapse before the next attempt.
      unlock(handle);
    }
    expect(harness.kv.entries.get(`mfa:${handle}`)).toBeUndefined();
    expect(
      harness.audits.filter((e) => e.eventType === 'AUTH_MFA_FAILURE').length,
    ).toBeGreaterThanOrEqual(5);
    // Not blocked YET: the window is still open, and the lazy block fires on
    // the next touch once it has closed.
    expect(profileRow().accountStatus).toBe('active');

    const after = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/setup/verify',
      headers: cookieFor(handle),
      payload: { factorId: 'f1', code: '481920' },
    });
    expect(after.statusCode).toBe(410);
  });

  it('the setup leg honours the same exponential-backoff lock (Phase 4)', async () => {
    seedAdmin();
    const handle = await openSetupWindow();
    const wrong = () =>
      harness.app.inject({
        method: 'POST',
        url: '/api/v1/auth/mfa/setup/verify',
        headers: cookieFor(handle),
        payload: { factorId: 'f1', code: '000000' },
      });

    expect((await wrong()).statusCode).toBe(401);
    expect((await wrong()).statusCode).toBe(401);
    const locked = await wrong();
    expect(locked.statusCode).toBe(429);
    expect(locked.json()).toMatchObject({ error: 'rate_limited' });
    unlock(handle);
    expect((await wrong()).statusCode).toBe(401);
  });

  it('abandon blocks an administrator inside the timed window', async () => {
    seedAdmin();
    const handle = await openSetupWindow();

    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/setup/abandon',
      headers: cookieFor(handle),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: { blocked: true } });
    expect(profileRow().accountStatus).toBe('blocked_mfa_setup');
    expect(harness.kv.entries.get(`mfasetup:u:${USER_ID}`)).toBeUndefined();
    expect(harness.kv.entries.get(`mfa:${handle}`)).toBeUndefined();
    const blocked = harness.audits.find((e) => e.eventType === 'MFA_SETUP_BLOCKED');
    expect(blocked?.message).toContain('abandoned');

    // A blocked account's next verify leg is refused at the door — while the
    // REQUEST leg stays generic (no enumeration through the block).
    const request = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/magic-link',
      payload: { email: 'daniel@vunvault.com' },
    });
    expect(request.statusCode).toBe(200);
    const text = harness.emails.at(-1)?.text ?? '';
    const token = /token=([^&\s]+)/.exec(text)?.[1] ?? '';
    const verify = await harness.app.inject({
      method: 'GET',
      url: `/api/v1/auth/magic-link/verify?token=${encodeURIComponent(token)}`,
    });
    expect(verify.statusCode).toBe(302);
    expect(verify.headers.location).toBe('https://www.vunvault.test/login?error=account_blocked');
  });

  it('abandon does NOT block an unenrolled client — they simply start over', async () => {
    harness.repo.profiles.push({
      id: USER_ID,
      email: 'client@example.com',
      fullName: 'Test Client',
      firstName: 'Test',
      lastName: 'Client',
      role: 'client',
      orgId: ORG_ID,
      accountStatus: 'active',
      deletedAt: null,
      mfaEnrolled: false,
    });
    const handle = await openSetupWindow('client@example.com');

    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/setup/abandon',
      headers: cookieFor(handle),
    });
    expect(response.json()).toEqual({ data: { blocked: false } });
    expect(profileRow().accountStatus).toBe('active');

    const options = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/setup/options',
      headers: cookieFor(handle),
    });
    expect(options.statusCode).toBe(410);
  });

  it('a closed window blocks lazily on the next setup touch (410 setup_expired)', async () => {
    seedAdmin();
    const handle = await openSetupWindow();
    expireWindow(handle);

    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/setup/options',
      headers: cookieFor(handle),
    });
    expect(response.statusCode).toBe(410);
    expect(response.json()).toMatchObject({ error: 'setup_expired' });
    expect(profileRow().accountStatus).toBe('blocked_mfa_setup');
    expect(harness.audits.map((e) => e.eventType)).toContain('MFA_SETUP_BLOCKED');
  });

  it('a missed window blocks on the NEXT magic-link verify even if setup is never touched again', async () => {
    seedAdmin();
    const handle = await openSetupWindow();
    expireWindow(handle);

    // The visitor walked away; days later they ask for a fresh link.
    const request = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/magic-link',
      payload: { email: 'daniel@vunvault.com' },
    });
    expect(request.statusCode).toBe(200);
    const text = harness.emails.at(-1)?.text ?? '';
    const token = /token=([^&\s]+)/.exec(text)?.[1] ?? '';
    const verify = await harness.app.inject({
      method: 'GET',
      url: `/api/v1/auth/magic-link/verify?token=${encodeURIComponent(token)}`,
    });
    expect(verify.statusCode).toBe(302);
    expect(verify.headers.location).toBe('https://www.vunvault.test/login?error=account_blocked');
    expect(profileRow().accountStatus).toBe('blocked_mfa_setup');
    expect(harness.audits.map((e) => e.eventType)).toContain('MFA_SETUP_BLOCKED');
    expect(cookieNames(verify)).not.toContain('vv_mfa');
  });

  it('setup endpoints without a challenge cookie answer 410/404-shaped refusals, never 500', async () => {
    seedAdmin();
    const options = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/setup/options',
    });
    expect(options.statusCode).toBe(410);
    const verify = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/setup/verify',
      payload: { factorId: 'f1', code: '481920' },
    });
    expect(verify.statusCode).toBe(410);
    const abandon = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/mfa/setup/abandon',
    });
    expect(abandon.statusCode).toBe(200);
    expect(abandon.json()).toEqual({ data: { blocked: false } });
  });
});

// ---------------------------------------------------------------------------
// Phase 4 — signup guard: the admin roster is provisioned, never registered.
// ---------------------------------------------------------------------------

describe('Phase 4 — signup refuses admin-roster emails', () => {
  it('rejects a populated roster slot with the spec copy and does no signup work', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { ...SIGNUP_BODY, email: 'daniel@vunvault.com' },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: 'signup_not_allowed',
      message: 'This email is not eligible for signup.',
    });
    // The guard fires BEFORE any other signup work: no user, no OTP email,
    // no rows, and (a probe gets nothing) no breach check either.
    expect(harness.supabase.createdUsers).toHaveLength(0);
    expect(harness.emails).toHaveLength(0);
    expect(harness.repo.profiles).toHaveLength(0);
  });

  it('is case-insensitive and covers every populated slot including the super admin', async () => {
    for (const email of [
      'Daniel@VUNVAULT.com',
      'divine@vunvault.com',
      'tshepiso@vunvault.com',
      'bukenya@vunvault.com',
    ]) {
      const response = await harness.app.inject({
        method: 'POST',
        url: '/api/v1/auth/signup',
        payload: { ...SIGNUP_BODY, email },
      });
      expect(response.statusCode, email).toBe(422);
      expect(response.json(), email).toMatchObject({ error: 'signup_not_allowed' });
    }
    expect(harness.supabase.createdUsers).toHaveLength(0);
  });

  it('leaves ordinary addresses to the untouched signup flow', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: SIGNUP_BODY,
    });
    expect(response.statusCode).toBe(202);
    expect(harness.supabase.createdUsers).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Phase 4 — magic-link anti-abuse: honeypot + timing bot signals and the
// per-address issuance window. All refusals wear the identical generic 200.
// ---------------------------------------------------------------------------

describe('Phase 4 — magic-link anti-abuse (honeypot, timing, per-address window)', () => {
  function seedReed() {
    harness.repo.profiles.push({
      id: USER_ID,
      email: 'e.reed@vunvault.com',
      fullName: 'Dr. Evelyn Reed',
      firstName: 'Evelyn',
      lastName: 'Reed',
      role: 'client',
      orgId: ORG_ID,
      accountStatus: 'active',
      deletedAt: null,
      mfaEnrolled: false,
    });
  }

  function request(extra: Record<string, unknown> = {}, email = 'e.reed@vunvault.com') {
    return harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/magic-link',
      payload: { email, ...extra },
    });
  }

  it('silently drops a honeypot-filled submission: identical 200, no email, audited as a bot', async () => {
    seedReed();
    const response = await request({ website: 'http://spam.example' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: MAGIC_LINK_ACK_MESSAGE });
    expect(harness.emails).toHaveLength(0);
    expect([...harness.kv.entries.keys()].some((key) => key.startsWith('ml:token:'))).toBe(false);
    const rejected = harness.audits.find((e) => e.eventType === 'AUTH_BOT_REJECTED');
    expect(rejected?.message).toContain('honeypot');
  });

  it('silently drops an inhumanely fast submission (timing signal)', async () => {
    seedReed();
    const response = await request({ formTs: Date.now() - 200 });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: MAGIC_LINK_ACK_MESSAGE });
    expect(harness.emails).toHaveLength(0);
    const rejected = harness.audits.find((e) => e.eventType === 'AUTH_BOT_REJECTED');
    expect(rejected?.message).toContain('timing');
  });

  it('ignores a formTs far in the future (clock skew) and sends normally', async () => {
    seedReed();
    const response = await request({ formTs: Date.now() + 60 * 60 * 1000 });
    expect(response.statusCode).toBe(200);
    expect(harness.emails).toHaveLength(1);
    expect(harness.audits.map((e) => e.eventType)).not.toContain('AUTH_BOT_REJECTED');
  });

  it('suppresses issuance past the per-address window with the identical 200', async () => {
    seedReed();
    const bodies: string[] = [];
    for (let round = 0; round < 3; round += 1) {
      const response = await request();
      expect(response.statusCode).toBe(200);
      bodies.push(response.body);
    }
    expect(harness.emails).toHaveLength(3);

    const fourth = await request();
    expect(fourth.statusCode).toBe(200);
    expect(fourth.body).toBe(bodies[0]);
    expect(harness.emails).toHaveLength(3); // nothing new went out
    const limited = harness.audits.find((e) => e.eventType === 'AUTH_RATE_LIMIT');
    expect(limited?.message).toContain('per-address window');
  });
});

// ---------------------------------------------------------------------------
// Phase 4 — the per-IP soft limit: past three requests in fifteen minutes a
// Turnstile token is demanded (only while TURNSTILE_ENFORCE is on). The flag
// depends on the IP alone, so registered and unregistered bodies stay
// byte-identical and enumeration stays impossible.
// ---------------------------------------------------------------------------

describe('Phase 4 — captcha soft limit (TURNSTILE_ENFORCE on)', () => {
  function seed(local: Harness) {
    local.repo.profiles.push({
      id: USER_ID,
      email: 'e.reed@vunvault.com',
      fullName: 'Dr. Evelyn Reed',
      firstName: 'Evelyn',
      lastName: 'Reed',
      role: 'client',
      orgId: ORG_ID,
      accountStatus: 'active',
      deletedAt: null,
      mfaEnrolled: false,
    });
  }

  function requester(local: Harness) {
    return (email: string, extra: Record<string, unknown> = {}) =>
      local.app.inject({
        method: 'POST',
        url: '/api/v1/auth/magic-link',
        payload: { email, ...extra },
      });
  }

  it('flags captchaRequired past the soft limit — identically for registered and unregistered — and accepts a solved token', async () => {
    const seen: string[] = [];
    const assertHuman = vi.fn(async (token: string) => {
      seen.push(token);
    });
    const local = await makeHarness({ turnstileEnforced: true, turnstile: { assertHuman } });
    seed(local);
    const req = requester(local);

    // Three requests stay under the soft limit: plain generic acks.
    const first = await req('e.reed@vunvault.com');
    expect(first.json()).toEqual({ message: MAGIC_LINK_ACK_MESSAGE });
    await req('stranger.one@vunvault.com');
    await req('stranger.two@vunvault.com');

    // The fourth (same IP) trips it — with the identical body either way.
    const flaggedUnregistered = await req('stranger.three@vunvault.com');
    expect(flaggedUnregistered.statusCode).toBe(200);
    expect(flaggedUnregistered.json()).toEqual({
      message: MAGIC_LINK_ACK_MESSAGE,
      captchaRequired: true,
    });
    const flaggedRegistered = await req('e.reed@vunvault.com');
    expect(flaggedRegistered.body).toBe(flaggedUnregistered.body);
    // The flagged round sent nothing to the registered address.
    expect(local.emails.filter((m) => m.subject === 'Your VUNVAULT sign-in link')).toHaveLength(1);

    // A solved captcha resumes the normal flow: a real link goes out.
    const solved = await req('e.reed@vunvault.com', { captchaToken: 'token-abc' });
    expect(solved.statusCode).toBe(200);
    expect(solved.json()).toEqual({ message: MAGIC_LINK_ACK_MESSAGE });
    expect(seen).toEqual(['token-abc']);
    expect(local.emails.filter((m) => m.subject === 'Your VUNVAULT sign-in link')).toHaveLength(2);
  });

  it('fails closed when the token is rejected: generic 400 captcha_failed, audited', async () => {
    const assertHuman = vi.fn(async (): Promise<void> => {
      throw captchaFailed('test rejection');
    });
    const local = await makeHarness({ turnstileEnforced: true, turnstile: { assertHuman } });
    seed(local);
    const req = requester(local);

    await req('e.reed@vunvault.com');
    await req('stranger.one@vunvault.com');
    await req('stranger.two@vunvault.com');
    const flagged = await req('stranger.three@vunvault.com');
    expect(flagged.json()).toMatchObject({ captchaRequired: true });

    const refused = await req('e.reed@vunvault.com', { captchaToken: 'bad-token' });
    expect(refused.statusCode).toBe(400);
    expect(refused.json()).toEqual({
      error: 'captcha_failed',
      message: 'The human-verification check did not pass',
    });
    expect(local.audits.map((e) => e.eventType)).toContain('AUTH_BOT_REJECTED');
    // The refusal sent nothing new.
    expect(local.emails.filter((m) => m.subject === 'Your VUNVAULT sign-in link')).toHaveLength(1);
  });

  it('stays inert when enforcement is off: the soft limit never demands a token', async () => {
    seed(harness);
    const req = requester(harness);
    const responses = [
      await req('e.reed@vunvault.com'),
      await req('stranger.one@vunvault.com'),
      await req('stranger.two@vunvault.com'),
      await req('stranger.three@vunvault.com'),
    ];
    for (const response of responses) {
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ message: MAGIC_LINK_ACK_MESSAGE });
    }
  });
});

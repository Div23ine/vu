import { createHash } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../../../config/env.js';
import type { SignInResult, SupabaseAdmin, SupabaseSession } from '../../../lib/supabase-admin.js';
import { memoryKvStore } from './challenge.js';
import { PWRESET_PREFIX, resetTokenHash } from './password-reset.js';
import cookiesPlugin from '../../../plugins/cookies.js';
import errorHandler from '../../../plugins/error-handler.js';
import authPlugin from '../../../plugins/auth.js';
import { SessionRegistry, type SessionRecord } from '../../../lib/session-registry.js';
import type { AuthRepo, AuthProfileRow, NewSession } from './repo.js';
import authRoutes from './index.js';
import type { AuditEntryRow } from '../../../audit/repo.js';

/**
 * Forgot / reset password (Task 40d).
 *
 * The two promises under test: `forgot-password` is a black hole that answers
 * `202 {}` identically whether or not the address exists — no audit entry, no
 * timing oracle, no email to a stranger — and a reset token is SINGLE USE: the
 * second presentation of the same token is a 410, the reset revokes every
 * session, and MFA is not bypassed.
 */

const SECRET = 'test-jwt-secret-that-is-long-enough-to-be-safe';
const USER_ID = 'c0000000-0000-4000-8000-000000000001';
const ORG_ID = 'a0000000-0000-4000-8000-000000000001';
const SESSION_ID = '20000000-0000-4000-8000-000000000001';
const EMAIL = 'jane.wanjiru@acmefintech.co.ke';

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
    return `VV-CL-${String(this.clientCodeSeq).padStart(5, '0')}`;
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
  passwordUpdates: Array<{ userId: string; password: string }> = [];
  confirmedUsers: string[] = [];
  issuedSessions: string[] = [];
  deletedUsers: string[] = [];

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
  breach: { breached: boolean };
}

async function makeHarness(): Promise<Harness> {
  const repo = new FakeAuthRepo();
  const supabase = new FakeSupabase();
  const kv = memoryKvStore();
  const emails: Array<{ to: string; subject: string; text?: string }> = [];
  const audits: Harness['audits'] = [];
  const breach = { breached: false };

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
        breach: { isBreached: async () => breach.breached },
      });
    },
    { prefix: '/api/v1' },
  );

  return { app, repo, supabase, kv, audits, emails, breach };
}

/** Seed one ACTIVE client profile with two live sessions. */
function seedActiveUser(role: AuthProfileRow['role'] = 'client'): void {
  harness.repo.profiles.push({
    id: USER_ID,
    email: EMAIL,
    fullName: 'Jane Wanjiru',
    firstName: 'Jane',
    lastName: 'Wanjiru',
    role,
    orgId: ORG_ID,
    accountStatus: 'active',
    deletedAt: null,
    mfaEnrolled: true,
  });
  for (const id of [SESSION_ID, '20000000-0000-4000-8000-000000000002']) {
    harness.repo.sessions.push({
      id,
      userId: USER_ID,
      deviceLabel: 'Chrome · Nairobi',
      userAgent: null,
      ip: '203.0.113.7',
      geoCity: null,
      geoCountry: null,
      mfaMethod: null,
      revokedAt: null,
      lastSeenAt: null,
    });
  }
}

/** Ask for a reset link and fish the token out of the email. */
async function requestReset(email = EMAIL): Promise<string | null> {
  const before = harness.emails.length;
  const response = await harness.app.inject({
    method: 'POST',
    url: '/api/v1/auth/forgot-password',
    payload: { email },
  });
  expect(response.statusCode).toBe(202);
  expect(response.body).toBe('{}');
  const sent = harness.emails.slice(before);
  if (sent.length === 0) return null;
  const token = /token=([A-Za-z0-9_-]{43})/.exec(sent[0]?.text ?? '')?.[1];
  return token ?? null;
}

function reset(token: string, newPassword: string, confirmPassword = newPassword) {
  return harness.app.inject({
    method: 'POST',
    url: '/api/v1/auth/reset-password',
    payload: { token, newPassword, confirmPassword },
  });
}

let harness: Harness;

beforeEach(async () => {
  harness = await makeHarness();
});

describe('POST /api/v1/auth/forgot-password', () => {
  it('answers identically for a known and an unknown address', async () => {
    seedActiveUser();

    const known = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: { email: EMAIL },
    });
    const unknown = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/forgot-password',
      payload: { email: 'nobody@example.test' },
    });

    expect(known.statusCode).toBe(202);
    expect(unknown.statusCode).toBe(202);
    expect(known.body).toBe('{}');
    expect(unknown.body).toBe(known.body);

    // Only the known address got mail — and nothing was audited at request time.
    expect(harness.emails).toHaveLength(1);
    expect(harness.emails[0]).toMatchObject({ to: EMAIL, subject: 'Reset your VUNVAULT password' });
    const text = harness.emails[0]?.text ?? '';
    expect(text).toContain('expires in 30 minutes');
    expect(text).toContain(`${TEST_ENV.WEB_ORIGIN}/reset-password?token=`);
    expect(harness.audits).toHaveLength(0);
  });

  it('stores only the digest of the token, single-use, for 30 minutes', async () => {
    seedActiveUser();
    const token = await requestReset();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const key = `${PWRESET_PREFIX}${resetTokenHash(token ?? '')}`;
    const stored = harness.kv.entries.get(key);
    expect(stored).toBeDefined();
    expect(stored?.value).not.toContain(token ?? 'impossible');
    expect(JSON.parse(stored?.value ?? '{}')).toEqual({ userId: USER_ID });
    // TTL: thirty minutes, give or take the milliseconds this test took.
    const ttlMs = (stored?.expiresAt ?? 0) - Date.now();
    expect(ttlMs).toBeGreaterThan(1_790_000);
    expect(ttlMs).toBeLessThanOrEqual(1_800_000);
  });

  it('keeps at most three live tokens per user and evicts the oldest', async () => {
    seedActiveUser();
    const tokens: string[] = [];
    for (let round = 0; round < 4; round += 1) {
      const token = await requestReset();
      expect(token).not.toBeNull();
      tokens.push(token as string);
    }
    const live = tokens.map((token) =>
      harness.kv.entries.has(`${PWRESET_PREFIX}${resetTokenHash(token)}`),
    );
    expect(live).toEqual([false, true, true, true]);
  });

  it('does not issue a token to a pending_verification signup', async () => {
    seedActiveUser();
    harness.repo.profiles[0]!.accountStatus = 'pending_verification';
    const token = await requestReset();
    expect(token).toBeNull();
    expect(harness.emails).toHaveLength(0);
  });
});

describe('POST /api/v1/auth/reset-password', () => {
  it('rotates the credential, revokes EVERY session and answers 204', async () => {
    seedActiveUser();
    const token = await requestReset();

    const response = await reset(token as string, 'N3w-Str0ng-Passphrase!');
    expect(response.statusCode, response.body).toBe(204);
    expect(response.body).toBe('');

    // The new secret went to Supabase — the API never sees a hash.
    expect(harness.supabase.passwordUpdates).toEqual([
      { userId: USER_ID, password: 'N3w-Str0ng-Passphrase!' },
    ]);
    // Both live sessions are revoked, and the change is stamped.
    expect(harness.repo.sessions.every((row) => row.revokedAt !== null)).toBe(true);
    expect(harness.repo.passwordChanges).toHaveLength(1);
    expect(harness.repo.passwordChanges[0]?.userId).toBe(USER_ID);

    // Audited ONCE, as the user, with the reset marker — and without the token or
    // either password anywhere in the entry.
    const changed = harness.audits.filter((entry) => entry.eventType === 'PASSWORD_CHANGED');
    expect(changed).toHaveLength(1);
    expect(changed[0]?.actorLabel).toBe('jane.wanjiru');
    expect(changed[0]?.subject).toBe(EMAIL);
    expect(changed[0]?.details).toMatchObject({ via: 'reset', revokedSessions: 2 });
    expect(JSON.stringify(changed[0])).not.toContain(token as string);
    expect(JSON.stringify(changed[0])).not.toContain('N3w-Str0ng-Passphrase!');

    // The credentials-changed notice went out (no notify queue in this harness,
    // so the email fallback carries it).
    expect(harness.emails).toHaveLength(2);
    expect(harness.emails[1]).toMatchObject({
      to: EMAIL,
      subject: 'Your VUNVAULT credentials changed',
    });
  });

  it('is single use: the same token again is a 410', async () => {
    seedActiveUser();
    const token = await requestReset();

    const first = await reset(token as string, 'N3w-Str0ng-Passphrase!');
    expect(first.statusCode).toBe(204);
    const second = await reset(token as string, 'An0ther-Str0ng-Pass!');
    expect(second.statusCode).toBe(410);
    expect(second.json()).toMatchObject({ error: 'token_invalid' });
    // The second attempt changed nothing.
    expect(harness.supabase.passwordUpdates).toHaveLength(1);
    expect(harness.audits.filter((entry) => entry.eventType === 'PASSWORD_CHANGED')).toHaveLength(
      1,
    );
  });

  it('answers 410 for an invented token', async () => {
    seedActiveUser();
    const response = await reset('x'.repeat(43), 'N3w-Str0ng-Passphrase!');
    expect(response.statusCode).toBe(410);
    expect(response.json()).toMatchObject({ error: 'token_invalid' });
    expect(harness.repo.sessions.some((row) => row.revokedAt !== null)).toBe(false);
  });

  it('rejects a breached password with 422 and burns the token', async () => {
    seedActiveUser();
    const token = await requestReset();
    harness.breach.breached = true;

    const response = await reset(token as string, 'N3w-Str0ng-Passphrase!');
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: 'breached_password' });
    expect(harness.supabase.passwordUpdates).toHaveLength(0);
    // Consumption is atomic and happens first: the token does not survive a
    // failed reset, so the user asks for a fresh link.
    expect(harness.kv.entries.has(`${PWRESET_PREFIX}${resetTokenHash(token as string)}`)).toBe(
      false,
    );
  });

  it('rejects a staff password of 13 characters and a client one of 11', async () => {
    // Staff: minimum 14. `Abc-12345678!` is exactly 13 complex characters — one
    // short for a role that can reach client data.
    seedActiveUser('admin');
    const staffToken = await requestReset();
    const staff = await reset(staffToken as string, 'Abc-12345678!');
    expect(staff.statusCode).toBe(400);
    expect((staff.json() as { error: string }).error).toBe('validation_failed');
    expect(harness.supabase.passwordUpdates).toHaveLength(0);

    // Client: minimum 12, so 11 is out — caught by the shared contract itself.
    harness.repo.profiles[0]!.role = 'client';
    const clientToken = await requestReset();
    const client = await reset(clientToken as string, 'Abc-123456!');
    expect(client.statusCode).toBe(400);
    expect(harness.supabase.passwordUpdates).toHaveLength(0);
  });

  it('rejects a mismatched confirmation with the contract message', async () => {
    seedActiveUser();
    const token = await requestReset();
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/auth/reset-password',
      payload: {
        token,
        newPassword: 'N3w-Str0ng-Passphrase!',
        confirmPassword: 'Different-1!',
      },
    });
    expect(response.statusCode).toBe(400);
    const body = response.json() as { error: string; details: Array<{ message?: string }> };
    expect(body.error).toBe('validation_failed');
    expect(body.details.some((issue) => issue.message === 'Both entries must match exactly.')).toBe(
      true,
    );
    expect(harness.supabase.passwordUpdates).toHaveLength(0);
  });

  it('refuses a token whose profile was deleted in the meantime', async () => {
    seedActiveUser();
    const token = await requestReset();
    harness.repo.profiles[0]!.deletedAt = new Date().toISOString();

    const response = await reset(token as string, 'N3w-Str0ng-Passphrase!');
    expect(response.statusCode).toBe(410);
    expect(response.json()).toMatchObject({ error: 'token_invalid' });
    expect(harness.supabase.passwordUpdates).toHaveLength(0);
    expect(harness.audits.filter((entry) => entry.eventType === 'PASSWORD_CHANGED')).toHaveLength(
      0,
    );
  });
});

/** The digest helper is the store's identity: it must be plain SHA-256 hex. */
describe('resetTokenHash', () => {
  it('is sha256 hex of the token', () => {
    expect(resetTokenHash('abc')).toBe(createHash('sha256').update('abc', 'utf8').digest('hex'));
  });
});

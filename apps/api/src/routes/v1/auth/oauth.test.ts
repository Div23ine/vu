import { createHash } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../../../config/env.js';
import type {
  OAuthUser,
  SignInResult,
  SupabaseAdmin,
  SupabaseSession,
} from '../../../lib/supabase-admin.js';
import { memoryKvStore } from './challenge.js';
import {
  OAUTH_COOKIE_NAME,
  OAUTH_STATE_PREFIX,
  SUPABASE_PROVIDER_NAMES,
  sanitizeNext,
  type OAuthState,
  type OnboardingRepo,
} from './oauth-service.js';
import { codeChallengeFor } from '../../../lib/pkce.js';
import cookiesPlugin from '../../../plugins/cookies.js';
import errorHandler from '../../../plugins/error-handler.js';
import authPlugin from '../../../plugins/auth.js';
import { SessionRegistry, type SessionRecord } from '../../../lib/session-registry.js';
import type { AuthRepo, AuthProfileRow, NewSession } from './repo.js';
import authRoutes from './index.js';
import type { AuditEntryRow } from '../../../audit/repo.js';

/**
 * OAuth sign-in (Task 40e): the start leg, the callback leg and every refusal.
 *
 * The invariants under test: an unknown provider is a 404; an untrusted `next`
 * falls back to `/portal`; `start` parks a PKCE verifier in Redis and a state
 * cookie and redirects to Supabase with `code_challenge_method=s256`; a tampered
 * state ends the flow with no session; a first-time Google user becomes a CLIENT
 * with an organisation, cookies and two audit entries; staff accounts are refused
 * and their just-minted session destroyed; an unverified mailbox never gets in;
 * and an MFA-enrolled user is handed the `vv_mfa` challenge — never `vv_at`.
 */

const SECRET = 'test-jwt-secret-that-is-long-enough-to-be-safe';
const ORG_ID = 'a0000000-0000-4000-8000-000000000001';
const SESSION_ID = '20000000-0000-4000-8000-000000000001';
const OAUTH_USER_ID = 'c0000000-0000-4000-8000-0000000000aa';
const GOOGLE_EMAIL = 'jane.wanjiru@gmail.com';

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
  profileInputs: Array<Parameters<AuthRepo['createProfile']>[0]> = [];
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
    this.profileInputs.push(input);
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
    return [];
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
  async countRecentFailuresByEmail() {
    return 0;
  }
  async countRecentFailuresByIp() {
    return 0;
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
    accessToken: 'oauth-access-token',
    refreshToken: 'oauth-refresh-token',
    expiresIn: 3600,
    sessionId: SESSION_ID,
    userId: OAUTH_USER_ID,
    aal: 'aal1',
    ...overrides,
  };
}

function oauthUser(overrides: Partial<OAuthUser> = {}): OAuthUser {
  return {
    id: OAUTH_USER_ID,
    email: GOOGLE_EMAIL,
    emailVerified: true,
    fullName: 'Jane Wanjiru',
    avatarUrl: null,
    ...overrides,
  };
}

class FakeSupabase implements SupabaseAdmin {
  factors: Array<{ id: string; type: 'totp'; verified: boolean }> = [];
  exchangeCalls: Array<{ authCode: string; codeVerifier: string }> = [];
  signOutCalls: Array<{ token: string; scope: string }> = [];
  deletedUsers: string[] = [];
  exchangeResult: { session: SupabaseSession; user: OAuthUser } = {
    session: fakeSession(),
    user: oauthUser(),
  };
  exchangeFails = false;

  buildAuthorizeUrl(input: {
    provider: string;
    redirectTo: string;
    codeChallenge: string;
    state: string;
  }): string {
    const params = new URLSearchParams({
      provider: input.provider,
      redirect_to: input.redirectTo,
      code_challenge: input.codeChallenge,
      code_challenge_method: 's256',
      state: input.state,
    });
    return `${TEST_ENV.SUPABASE_URL}/auth/v1/authorize?${params.toString()}`;
  }
  async exchangeCodeForSession(authCode: string, codeVerifier: string) {
    this.exchangeCalls.push({ authCode, codeVerifier });
    if (this.exchangeFails) throw new Error('invalid code');
    return this.exchangeResult;
  }
  async createUser() {
    return { id: OAUTH_USER_ID };
  }
  async confirmEmail() {
    /* no-op */
  }
  async issueSession(): Promise<SupabaseSession> {
    throw new Error('not used');
  }
  async deleteUser(userId: string) {
    this.deletedUsers.push(userId);
  }
  async signInWithPassword(): Promise<SignInResult> {
    throw new Error('not used');
  }
  async refresh() {
    return fakeSession();
  }
  async signOut(accessToken: string, scope: 'global' | 'local' | 'others') {
    this.signOutCalls.push({ token: accessToken, scope });
  }
  async updatePassword() {
    /* no-op */
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

class FakeOnboardingRepo implements OnboardingRepo {
  completed = new Set<string>();
  async hasCompletedOnboarding(userId: string) {
    return this.completed.has(userId);
  }
}

interface Harness {
  app: FastifyInstance;
  repo: FakeAuthRepo;
  supabase: FakeSupabase;
  onboarding: FakeOnboardingRepo;
  kv: ReturnType<typeof memoryKvStore>;
  audits: Array<{
    eventType: string;
    message: string;
    actorLabel: string;
    subject: string | null;
    details: Record<string, unknown>;
  }>;
}

async function makeHarness(): Promise<Harness> {
  const repo = new FakeAuthRepo();
  const supabase = new FakeSupabase();
  const onboarding = new FakeOnboardingRepo();
  const kv = memoryKvStore();
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
      return { seq: audits.length } as unknown as AuditEntryRow;
    },
    publish: async () => undefined,
  } as unknown as FastifyInstance['audit']);
  app.decorate('email', {
    send: async () => ({ id: 'email-1' }),
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
              userId: OAUTH_USER_ID,
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
        onboarding,
        breach: { isBreached: async () => false },
      });
    },
    { prefix: '/api/v1' },
  );

  return { app, repo, supabase, onboarding, kv, audits };
}

// ------------------------------------------------------------------- helpers

function setCookiesOf(response: { headers: Record<string, unknown> }): string[] {
  const raw = response.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw === undefined ? [] : [String(raw)];
  return list.map((entry) => String(entry));
}

function cookieNames(response: { headers: Record<string, unknown> }): string[] {
  return setCookiesOf(response)
    .map((entry) => entry.split('=')[0] ?? '')
    .filter((name) => name !== '');
}

function cookieValue(response: { headers: Record<string, unknown> }, name: string): string | null {
  for (const entry of setCookiesOf(response)) {
    if (entry.startsWith(`${name}=`)) {
      const value = entry.slice(name.length + 1).split(';')[0] ?? '';
      return value;
    }
  }
  return null;
}

let harness: Harness;

beforeEach(async () => {
  harness = await makeHarness();
});

/** Run the start leg and return everything the callback leg needs. */
async function start(
  provider = 'google',
  next?: string,
): Promise<{
  state: string;
  location: string;
  record: OAuthState;
}> {
  const query = next === undefined ? '' : `?next=${encodeURIComponent(next)}`;
  const response = await harness.app.inject({
    method: 'GET',
    url: `/api/v1/auth/oauth/${provider}/start${query}`,
  });
  expect(response.statusCode).toBe(302);
  const state = cookieValue(response, OAUTH_COOKIE_NAME);
  expect(state).not.toBeNull();
  const raw = harness.kv.entries.get(`${OAUTH_STATE_PREFIX}${state ?? ''}`);
  expect(raw).toBeDefined();
  return {
    state: state ?? '',
    location: String(response.headers['location'] ?? ''),
    record: JSON.parse(raw?.value ?? '{}') as OAuthState,
  };
}

/** Run the callback leg with the state cookie (or a tampered one). */
function callback(params: { code?: string; state: string; cookie?: string; error?: string }) {
  const query = new URLSearchParams();
  if (params.code !== undefined) query.set('code', params.code);
  query.set('state', params.state);
  if (params.error !== undefined) query.set('error', params.error);
  return harness.app.inject({
    method: 'GET',
    url: `/api/v1/auth/oauth/callback?${query.toString()}`,
    headers: { cookie: `${OAUTH_COOKIE_NAME}=${params.cookie ?? params.state}` },
  });
}

describe('GET /api/v1/auth/oauth/:provider/start', () => {
  it('answers 404 for a provider the platform does not sell', async () => {
    const response = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/auth/oauth/twitter/start',
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: 'not_found' });
  });

  it('redirects to the Supabase authorize URL with an s256 PKCE challenge', async () => {
    const started = await start('google');

    const url = new URL(started.location);
    expect(url.origin + url.pathname).toBe(`${TEST_ENV.SUPABASE_URL}/auth/v1/authorize`);
    expect(url.searchParams.get('provider')).toBe(SUPABASE_PROVIDER_NAMES.google);
    expect(url.searchParams.get('code_challenge_method')).toBe('s256');
    expect(url.searchParams.get('state')).toBe(started.state);
    expect(url.searchParams.get('redirect_to')).toBe(
      `${TEST_ENV.API_PUBLIC_URL}/api/v1/auth/oauth/callback`,
    );
    // The challenge really is base64url(sha256(verifier)).
    expect(url.searchParams.get('code_challenge')).toBe(codeChallengeFor(started.record.verifier));
    expect(started.record.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(started.record.provider).toBe('google');
    expect(started.record.next).toBe('/portal');

    // The state cookie: HttpOnly, Lax, scoped to the auth paths, ten minutes.
    const response = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/auth/oauth/google/start',
    });
    const raw = setCookiesOf(response).find((entry) => entry.startsWith(`${OAUTH_COOKIE_NAME}=`));
    expect(raw).toContain('HttpOnly');
    expect(raw).toContain('SameSite=Lax');
    expect(raw).toContain('Path=/api/v1/auth');
    expect(raw).toContain('Max-Age=600');
    // TTL matches in Redis, give or take test milliseconds.
    const stored = harness.kv.entries.get(`${OAUTH_STATE_PREFIX}${started.state}`);
    expect((stored?.expiresAt ?? 0) - Date.now()).toBeGreaterThan(590_000);
  });

  it('maps microsoft to the Supabase `azure` provider', async () => {
    const started = await start('microsoft');
    const url = new URL(started.location);
    expect(url.searchParams.get('provider')).toBe('azure');
    expect(started.record.provider).toBe('microsoft');
  });

  it('refuses an untrusted `next` and falls back to /portal', async () => {
    for (const evil of ['//evil.com', '/\\evil.com', 'https://evil.com/portal', 'portal']) {
      const started = await start('google', evil);
      expect(started.record.next, evil).toBe('/portal');
    }
    const honest = await start('google', '/portal/billing');
    expect(honest.record.next).toBe('/portal/billing');
    // The helper itself, pinned:
    expect(sanitizeNext('//evil.com')).toBe('/portal');
    expect(sanitizeNext(undefined)).toBe('/portal');
  });
});

describe('GET /api/v1/auth/oauth/callback', () => {
  it('refuses a tampered state: no session, no cookies, /login?error=oauth_state', async () => {
    const started = await start('google');
    await callback({ code: 'provider-code', state: started.state, cookie: 'forged-state' }).then(
      (response) => {
        expect(response.statusCode).toBe(302);
        expect(response.headers['location']).toBe(`${TEST_ENV.WEB_ORIGIN}/login?error=oauth_state`);
        expect(cookieNames(response)).not.toContain('vv_at');
      },
    );
    expect(harness.repo.sessions).toHaveLength(0);
    expect(harness.audits).toHaveLength(0);
    // The code was never exchanged: a bad state ends the flow before Supabase.
    expect(harness.supabase.exchangeCalls).toHaveLength(0);
  });

  it('refuses a state that is not (or no longer) in Redis', async () => {
    const response = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/auth/oauth/callback?code=x&state=never-issued',
      headers: { cookie: `${OAUTH_COOKIE_NAME}=never-issued` },
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers['location']).toBe(`${TEST_ENV.WEB_ORIGIN}/login?error=oauth_state`);
  });

  it('redirects a provider refusal to /login?error=oauth_denied', async () => {
    const started = await start('github');
    const response = await callback({
      state: started.state,
      error: 'access_denied',
    });
    expect(response.statusCode).toBe(302);
    expect(response.headers['location']).toBe(`${TEST_ENV.WEB_ORIGIN}/login?error=oauth_denied`);
    expect(harness.repo.sessions).toHaveLength(0);
  });

  it('creates a CLIENT account for a first-time Google user and signs them in', async () => {
    const started = await start('google', '/portal/billing');
    const response = await callback({ code: 'provider-code', state: started.state });
    expect(response.statusCode).toBe(302);
    // No onboarding row yet: the wizard wins over `next`.
    expect(response.headers['location']).toBe(`${TEST_ENV.WEB_ORIGIN}/onboarding`);
    expect(cookieNames(response).sort()).toContain('vv_at');
    expect(cookieNames(response)).toContain('vv_rt');
    expect(cookieNames(response)).toContain('vv_csrf');
    // The state cookie is always cleared.
    const cleared = setCookiesOf(response).find((entry) =>
      entry.startsWith(`${OAUTH_COOKIE_NAME}=`),
    );
    expect(cleared).toBeDefined();
    expect(cleared).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/);
    // No token in the redirect target.
    expect(String(response.headers['location'])).not.toContain('oauth-access-token');
    expect(response.body).not.toContain('oauth-access-token');

    // The exchange used the PKCE verifier from the state record.
    expect(harness.supabase.exchangeCalls).toEqual([
      { authCode: 'provider-code', codeVerifier: started.record.verifier },
    ]);

    // A client account: organisation from next_client_code(), profile active.
    expect(harness.repo.organizations).toHaveLength(1);
    expect(harness.repo.organizations[0]).toMatchObject({
      name: 'Jane Wanjiru',
      clientCode: 'VV-CL-48211',
      country: null,
    });
    expect(harness.repo.profileInputs).toHaveLength(1);
    expect(harness.repo.profileInputs[0]).toMatchObject({
      id: OAUTH_USER_ID,
      email: GOOGLE_EMAIL,
      role: 'client',
      accountType: 'individual',
      accountStatus: 'active',
      require2fa: false,
    });
    expect(harness.repo.sessions).toHaveLength(1);
    expect(harness.repo.sessions[0]).toMatchObject({ userId: OAUTH_USER_ID, ip: '127.0.0.1' });

    // Two entries: the registration and the sign-in, both naming the provider.
    expect(harness.audits.map((entry) => [entry.eventType, entry.details.provider])).toEqual([
      ['ACCOUNT_REGISTERED', 'google'],
      ['AUTH_SUCCESS', 'google'],
    ]);
  });

  it('sends an onboarded user to `next`', async () => {
    harness.onboarding.completed.add(OAUTH_USER_ID);
    const started = await start('google', '/portal/billing');
    const response = await callback({ code: 'provider-code', state: started.state });
    expect(response.headers['location']).toBe(`${TEST_ENV.WEB_ORIGIN}/portal/billing`);
    expect(cookieNames(response)).toContain('vv_at');
  });

  it('refuses a staff account, destroys the minted session and audits the refusal', async () => {
    harness.repo.profiles.push({
      id: OAUTH_USER_ID,
      email: 'e.reed@vunvault.com',
      fullName: 'Dr. Evelyn Reed',
      firstName: 'Evelyn',
      lastName: 'Reed',
      role: 'admin',
      orgId: null,
      accountStatus: 'active',
      deletedAt: null,
      mfaEnrolled: true,
    });
    harness.supabase.exchangeResult = {
      session: fakeSession(),
      user: oauthUser({ id: OAUTH_USER_ID, email: 'e.reed@vunvault.com' }),
    };

    const started = await start('google');
    const response = await callback({ code: 'provider-code', state: started.state });
    expect(response.statusCode).toBe(302);
    expect(response.headers['location']).toBe(
      `${TEST_ENV.WEB_ORIGIN}/login?error=oauth_not_allowed`,
    );
    expect(cookieNames(response)).not.toContain('vv_at');

    // The session Supabase just minted is gone.
    expect(harness.supabase.signOutCalls).toEqual([
      { token: 'oauth-access-token', scope: 'global' },
    ]);
    expect(harness.audits).toHaveLength(1);
    expect(harness.audits[0]).toMatchObject({
      eventType: 'AUTH_FAILURE',
      details: { provider: 'google', reason: 'staff_oauth_blocked' },
    });
    expect(harness.repo.sessions).toHaveLength(0);
  });

  it('refuses an unverified mailbox and deletes the user this attempt created', async () => {
    harness.supabase.exchangeResult = {
      session: fakeSession(),
      user: oauthUser({ emailVerified: false }),
    };

    const started = await start('google');
    const response = await callback({ code: 'provider-code', state: started.state });
    expect(response.statusCode).toBe(302);
    expect(response.headers['location']).toBe(
      `${TEST_ENV.WEB_ORIGIN}/login?error=oauth_email_unverified`,
    );
    expect(cookieNames(response)).not.toContain('vv_at');

    // No profile existed, so the Supabase user was born in this attempt — and dies in it.
    expect(harness.supabase.deletedUsers).toEqual([OAUTH_USER_ID]);
    expect(harness.repo.profiles).toHaveLength(0);
    expect(harness.repo.sessions).toHaveLength(0);
  });

  it('refuses to auto-link an email that belongs to a different profile id', async () => {
    harness.repo.profiles.push({
      id: 'c0000000-0000-4000-8000-0000000000bb', // a DIFFERENT id…
      email: GOOGLE_EMAIL, // …but the same address the provider vouched for.
      fullName: 'Jane Wanjiru',
      firstName: 'Jane',
      lastName: 'Wanjiru',
      role: 'client',
      orgId: ORG_ID,
      accountStatus: 'active',
      deletedAt: null,
      mfaEnrolled: false,
    });

    const started = await start('google');
    const response = await callback({ code: 'provider-code', state: started.state });
    expect(response.statusCode).toBe(302);
    expect(response.headers['location']).toBe(
      `${TEST_ENV.WEB_ORIGIN}/login?error=oauth_email_in_use`,
    );
    expect(cookieNames(response)).not.toContain('vv_at');

    // Nothing was created and nothing was linked.
    expect(harness.repo.profiles).toHaveLength(1);
    expect(harness.repo.organizations).toHaveLength(0);
    expect(harness.repo.sessions).toHaveLength(0);
    expect(harness.audits).toHaveLength(0);
  });

  it('hands an MFA-enrolled user the vv_mfa challenge — and never vv_at', async () => {
    harness.repo.profiles.push({
      id: OAUTH_USER_ID,
      email: GOOGLE_EMAIL,
      fullName: 'Jane Wanjiru',
      firstName: 'Jane',
      lastName: 'Wanjiru',
      role: 'client',
      orgId: ORG_ID,
      accountStatus: 'active',
      deletedAt: null,
      mfaEnrolled: true,
    });
    harness.supabase.factors = [{ id: 'factor-1', type: 'totp', verified: true }];
    harness.onboarding.completed.add(OAUTH_USER_ID);

    const started = await start('google', '/portal');
    const response = await callback({ code: 'provider-code', state: started.state });
    expect(response.statusCode).toBe(302);
    expect(response.headers['location']).toBe(`${TEST_ENV.WEB_ORIGIN}/login?mfa=1&next=%2Fportal`);
    const names = cookieNames(response);
    expect(names).toContain('vv_mfa');
    expect(names).not.toContain('vv_at');
    expect(names).not.toContain('vv_rt');

    // No session row yet: the challenge holds the aal1 session, encrypted.
    expect(harness.repo.sessions).toHaveLength(0);
    expect(harness.audits).toHaveLength(0);
  });

  it('treats a failed code exchange as a state failure', async () => {
    harness.supabase.exchangeFails = true;
    const started = await start('google');
    const response = await callback({ code: 'bad-code', state: started.state });
    expect(response.statusCode).toBe(302);
    expect(response.headers['location']).toBe(`${TEST_ENV.WEB_ORIGIN}/login?error=oauth_state`);
    expect(harness.repo.sessions).toHaveLength(0);
  });

  it('consumes the state exactly once: a replayed callback is refused', async () => {
    harness.onboarding.completed.add(OAUTH_USER_ID);
    const started = await start('google');
    const first = await callback({ code: 'provider-code', state: started.state });
    expect(first.statusCode).toBe(302);
    expect(cookieNames(first)).toContain('vv_at');

    const replayed = await callback({ code: 'provider-code', state: started.state });
    expect(replayed.statusCode).toBe(302);
    expect(replayed.headers['location']).toBe(`${TEST_ENV.WEB_ORIGIN}/login?error=oauth_state`);
    // One session, one sign-in entry.
    expect(harness.repo.sessions).toHaveLength(1);
    expect(harness.audits.filter((entry) => entry.eventType === 'AUTH_SUCCESS')).toHaveLength(1);
  });
});

/** The digest identity: state keys are namespaced, nothing else. */
describe('oauth state keys', () => {
  it('namespaces the Redis record under oauth:state:', async () => {
    const started = await start('google');
    const key = `${OAUTH_STATE_PREFIX}${started.state}`;
    const stored = harness.kv.entries.get(key);
    expect(stored).toBeDefined();
    const record = JSON.parse(stored?.value ?? '{}') as OAuthState;
    expect(record.provider).toBe('google');
    // sha256 of the verifier equals the challenge in the authorize URL.
    const challenge = new URL(started.location).searchParams.get('code_challenge');
    expect(challenge).toBe(
      createHash('sha256').update(record.verifier, 'ascii').digest('base64url'),
    );
  });
});

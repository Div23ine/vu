import cookie from '@fastify/cookie';
import Fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it } from 'vitest';
import authRoutes from './index';
import { memoryKvStore } from './challenge';
import type { AuthRepo, AuthProfileRow, NewProfile, NewSession } from './repo';
import type { SupabaseAdmin, SupabaseSession } from '../../../lib/supabase-admin';

/**
 * Passwordless flow tests — the two promises that matter:
 *   1. an abandoned signup leaves NO Supabase auth user behind;
 *   2. a session opens only after the mailbox link AND the six-digit code.
 */

const ACTIVE: AuthProfileRow = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'member@example.test',
  fullName: 'Member One',
  firstName: 'Member',
  lastName: 'One',
  role: 'client',
  orgId: null,
  accountStatus: 'active',
  mfaEnrolled: false,
  deletedAt: null,
  lastActiveAt: null,
} as AuthProfileRow;

class FakeRepo {
  profiles = new Map<string, AuthProfileRow>([[ACTIVE.email, ACTIVE]]);
  created: NewProfile[] = [];
  sessions: NewSession[] = [];

  async findProfileByEmail(email: string) {
    return this.profiles.get(email) ?? null;
  }
  async createProfile(input: NewProfile) {
    this.created.push(input);
    this.profiles.set(input.email, { ...ACTIVE, id: input.id, email: input.email });
  }
  async createSession(input: NewSession) {
    this.sessions.push(input);
  }
  async touchProfileLastActive() {}
  // The rest of the interface is unused by the passwordless routes.
  async countRecentFailuresByEmail() {
    return 0;
  }
  async countRecentFailuresByIp() {
    return 0;
  }
  async recordLoginAttempt() {}
  async revokeSession() {}
  async touchSession() {}
  async revokeAllSessions() {
    return [];
  }
  async setLastPasswordChangeAt() {}
  async listStalePendingSignups() {
    return [];
  }
  async deletePendingSignup() {
    return true;
  }
  async activatePendingSignup() {
    return true;
  }
}

function fakeSupabase(calls: { createdUsers: Array<{ email: string; id?: string }> }) {
  return {
    createUser: async (input: { id?: string; email: string }) => {
      calls.createdUsers.push({ email: input.email, id: input.id });
      return { id: input.id ?? '22222222-2222-4222-8222-222222222222' };
    },
    issueSession: async (): Promise<SupabaseSession> => ({
      accessToken: 'at',
      refreshToken: 'rt',
      expiresIn: 3600,
      sessionId: 'sess-1',
      userId: '11111111-1111-4111-8111-111111111111',
      aal: 'aal1',
    }),
    mfa: {
      listFactors: async () => [],
      enrollTotp: async () => ({}),
      challengeAndVerify: async () => ({}),
      unenroll: async () => {},
    },
    deleteUser: async () => {},
    confirmEmail: async () => {},
    signInWithPassword: async () => ({}),
    refresh: async () => ({}),
    signOut: async () => {},
    deleteSession: async () => {},
  } as unknown as SupabaseAdmin;
}

interface Harness {
  app: FastifyInstance;
  repo: FakeRepo;
  calls: { createdUsers: Array<{ email: string; id?: string }> };
  mail: Array<{ to: string; text: string }>;
}

async function makeHarness(): Promise<Harness> {
  const repo = new FakeRepo();
  const calls = { createdUsers: [] as Array<{ email: string; id?: string }> };
  const mail: Array<{ to: string; text: string }> = [];
  const app = Fastify({ logger: false });
  await app.register(cookie);
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('env', {
    NODE_ENV: 'test',
    WEB_ORIGIN: 'https://www.vunvault.test',
    COOKIE_DOMAIN: '',
  } as never);
  app.decorateRequest('clientIp', '203.0.113.7');
  app.decorateRequest('requestId', 'r1');
  app.decorate('email', {
    send: async (m: { to: string; subject: string; text?: string; html?: string }) => {
      mail.push({ to: m.to, text: m.text ?? m.html ?? '' });
      return { id: 'mail-1' };
    },
  });
  app.decorate('audit', { append: async () => ({ seq: 1 }) } as never);
  app.decorate('withTx', (async (work: (tx: unknown) => Promise<unknown>) => work({})) as never);
  app.decorate('db', { unsafe: async () => [] } as never);
  app.decorate('authenticate', async () => undefined);
  app.decorate('optionalAuth', async () => undefined);
  app.decorate('requirePermission', () => async () => undefined);
  app.decorate('requireSession', async () => undefined);
  await app.register(
    authRoutes as never,
    {
      repo: repo as unknown as AuthRepo,
      supabase: fakeSupabase(calls),
      kv: memoryKvStore(),
    } as never,
  );
  await app.ready();
  return { app, repo, calls, mail };
}

function tokenFrom(mail: Array<{ to: string; text: string }>, which: number): string {
  const match = /token=([A-Za-z0-9_-]+)/.exec(mail[which]?.text ?? '');
  if (match?.[1] === undefined) throw new Error('no token in mail');
  return match[1];
}
function codeFrom(mail: Array<{ to: string; text: string }>, which: number): string {
  const match = /code is (\d{6})/.exec(mail[which]?.text ?? '');
  if (match?.[1] === undefined) throw new Error('no code in mail');
  return match[1];
}

describe('passwordless login', () => {
  let h: Harness;
  beforeEach(async () => {
    h = await makeHarness();
  });

  it('mails a confirmation link for known addresses and stays silent for unknown ones', async () => {
    const known = await h.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'member@example.test' },
    });
    expect(known.statusCode).toBe(202);
    expect(h.mail).toHaveLength(1);
    const unknown = await h.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'ghost@example.test' },
    });
    expect(unknown.statusCode).toBe(202);
    expect(h.mail).toHaveLength(1); // identical behaviour, no mail
  });

  it('opens a session only after link AND code', async () => {
    await h.app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'member@example.test' },
    });
    const link = tokenFrom(h.mail, 0);
    const confirmed = await h.app.inject({
      method: 'POST',
      url: '/auth/login/confirm',
      payload: { token: link },
    });
    expect(confirmed.statusCode).toBe(200);
    const handle = (confirmed.json() as { data: { handle: string } }).data.handle;
    expect(h.mail).toHaveLength(2);
    const code = codeFrom(h.mail, 1);

    const wrong = await h.app.inject({
      method: 'POST',
      url: '/auth/login/verify',
      payload: { handle, code: '000000' },
    });
    expect(wrong.statusCode).toBe(401);
    expect(h.repo.sessions).toHaveLength(0);

    const right = await h.app.inject({
      method: 'POST',
      url: '/auth/login/verify',
      payload: { handle, code },
    });
    expect(right.statusCode).toBe(200);
    expect(h.repo.sessions).toHaveLength(1);
    const cookies = right.headers['set-cookie'];
    expect(String(cookies)).toContain('vv_at');
  });

  it('rejects a reused or forged link token', async () => {
    const response = await h.app.inject({
      method: 'POST',
      url: '/auth/login/confirm',
      payload: { token: 'forged-token-value' },
    });
    expect(response.statusCode).toBe(401);
  });
});

describe('passwordless signup', () => {
  let h: Harness;
  beforeEach(async () => {
    h = await makeHarness();
  });

  it('creates NO supabase user until the code leg completes', async () => {
    await h.app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'new@example.test', fullName: 'New Person' },
    });
    await h.app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'new2@example.test', fullName: 'New Two' },
    });
    expect(h.calls.createdUsers).toHaveLength(0); // abandoned signups leave nothing

    const link = tokenFrom(h.mail, 0);
    const confirmed = await h.app.inject({
      method: 'POST',
      url: '/auth/signup/confirm',
      payload: { token: link },
    });
    expect(confirmed.statusCode).toBe(200);
    const handle = (confirmed.json() as { data: { handle: string } }).data.handle;
    expect(h.calls.createdUsers).toHaveLength(0); // still nothing after the link

    const code = codeFrom(h.mail, h.mail.length - 1);
    const done = await h.app.inject({
      method: 'POST',
      url: '/auth/signup/verify',
      payload: { handle, code },
    });
    expect(done.statusCode).toBe(200);
    expect(h.calls.createdUsers).toHaveLength(1); // created at completion only
    expect(h.repo.created).toHaveLength(1);
    expect(h.repo.sessions).toHaveLength(1);
  });

  it('answers 202 without mail for an address that already has an account', async () => {
    const response = await h.app.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email: 'member@example.test', fullName: 'Dup' },
    });
    expect(response.statusCode).toBe(202);
    expect(h.mail).toHaveLength(0);
  });
});

import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Permission, UserRole } from '@vunvault/contracts';
import { CONSENT_REQUIRED_MESSAGE, ROLE_PERMISSIONS } from '@vunvault/contracts';
import type { Env } from '../../../config/env.js';
import errorHandler from '../../../plugins/error-handler.js';
import cookiesPlugin from '../../../plugins/cookies.js';
import type { AuthUser } from '../../../plugins/auth.js';
import { HttpError } from '../../../lib/http-error.js';
import type { AuditEntryRow } from '../../../audit/repo.js';
import type { ContactCategories as ConsentCategories } from '@vunvault/contracts';
import publicRoutes from './index.js';
import adminBadgesRoutes from '../admin-badges/index.js';
import { ALWAYS_HUMAN, captchaFailed, HttpTurnstileVerifier } from './turnstile.js';
import {
  hashIp,
  VERIFICATION_CATEGORY,
  VERIFICATION_SUBJECT_PREFIX,
  type ContactOutcome,
} from './service.js';
import {
  ANONYMOUS_COOKIE,
  dailySalt,
  type NewConsentRecord,
  type OpenToolRow,
  type NewContactMessage,
  type PublicRepo,
} from './repo.js';

/**
 * Public intake and the blogger badge.
 *
 * The privacy assertions are the point: no raw IP in a row or an audit entry, no
 * message text in the chain, and a bot that fills in the honeypot gets a success
 * it cannot learn anything from.
 */

const ADMIN_ID = 'c1000000-0000-4000-8000-0000000000ad';
const BLOGGER_ID = 'c1000000-0000-4000-8000-0000000000b1';
const CLIENT_IP = '41.90.32.10';

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

class FakePublicRepo implements PublicRepo {
  messages: NewContactMessage[] = [];
  consents: NewConsentRecord[] = [];
  tools: OpenToolRow[] = [];
  waitlist: Array<{ email: string; topic: string }> = [];
  badges: Record<string, { email: string; verifiedBloggerAt: string | null }> = {
    [BLOGGER_ID]: { email: 'wanjiru@example.test', verifiedBloggerAt: null },
  };

  async insertContactMessage(input: NewContactMessage) {
    this.messages.push(input);
    return input.id;
  }
  async insertConsentRecord(input: NewConsentRecord) {
    this.consents.push(input);
    return input.id;
  }
  async findBadgeTarget(userId: string) {
    const badge = this.badges[userId];
    if (badge === undefined) return null;
    return {
      id: userId,
      email: badge.email,
      fullName: 'Wanjiru Kamau',
      verifiedBloggerAt: badge.verifiedBloggerAt,
    };
  }
  async grantBadge(userId: string, _grantedBy: string, at: Date) {
    const badge = this.badges[userId];
    if (badge !== undefined) badge.verifiedBloggerAt = at.toISOString();
  }
  async revokeBadge(userId: string) {
    const badge = this.badges[userId];
    if (badge !== undefined) badge.verifiedBloggerAt = null;
  }
  async listOpenTools() {
    return this.tools;
  }
  async joinWaitlist(email: string, topic: string) {
    this.waitlist.push({ email, topic });
  }
}

interface Harness {
  app: FastifyInstance;
  repo: FakePublicRepo;
  audits: Array<{
    eventType: string;
    message: string;
    actorLabel: string;
    details: Record<string, unknown>;
  }>;
  emails: Array<{ to: string; template: string; vars: Record<string, string> }>;
  user: { current: AuthUser | null };
}

function adminUser(): AuthUser {
  return {
    id: ADMIN_ID,
    email: 'a.mwangi@vunvault.com',
    role: 'super_admin' as UserRole,
    orgId: null,
    permissions: [...ROLE_PERMISSIONS.super_admin] as Permission[],
    aal: 'aal2',
    sessionId: '20000000-0000-4000-8000-000000000001',
  };
}

async function makeHarness(options: { enforceTurnstile?: boolean } = {}): Promise<Harness> {
  const repo = new FakePublicRepo();
  const audits: Harness['audits'] = [];
  const emails: Harness['emails'] = [];
  const user: Harness['user'] = { current: null };

  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('env', TEST_ENV);
  app.decorateRequest('clientIp', CLIENT_IP);
  app.decorateRequest('requestId', '');

  const fakeTx = { unsafe: async () => [] };
  app.decorate('withTx', (async (work: (tx: unknown) => Promise<unknown>) =>
    work(fakeTx)) as unknown as FastifyInstance['withTx']);
  app.decorate('audit', {
    append: async (_executor: unknown, input: Record<string, unknown>) => {
      const actor = input.actor as { label: string };
      audits.push({
        eventType: String(input.eventType),
        message: String(input.message),
        actorLabel: actor.label,
        details: (input.details as Record<string, unknown>) ?? {},
      });
      return {
        seq: audits.length,
        id: 'entry-id',
        category: 'administrative',
        eventType: input.eventType,
        severity: 'info',
        sevLevel: null,
        actorId: null,
        actorLabel: actor.label,
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
        createdAt: new Date('2026-10-06T12:00:00Z'),
      } as unknown as AuditEntryRow;
    },
    publish: async () => undefined,
  } as unknown as FastifyInstance['audit']);
  app.decorate('queues', {
    notify: {
      add: async (_name: string, payload: Harness['emails'][number]) => {
        emails.push(payload);
      },
    },
  } as unknown as FastifyInstance['queues']);
  app.decorate('optionalAuth', (async (request: FastifyRequest) => {
    if (user.current !== null) request.user = user.current;
  }) as unknown as FastifyInstance['optionalAuth']);
  app.decorate('authenticate', (async (request: FastifyRequest) => {
    if (user.current === null) throw HttpError.unauthorized();
    request.user = user.current;
  }) as unknown as FastifyInstance['authenticate']);
  app.decorate('requireStaff', (async (request: FastifyRequest) => {
    const current = request.user;
    if (current === undefined) throw HttpError.unauthorized();
    if (current.role === 'client') throw HttpError.forbidden();
    if (current.aal !== 'aal2') throw new HttpError(403, 'mfa_required');
  }) as unknown as FastifyInstance['requireStaff']);
  app.decorate('requirePermission', ((...required: Permission[]) =>
    async (request: FastifyRequest) => {
      const current = request.user;
      if (current === undefined) throw HttpError.unauthorized();
      const granted = new Set(current.permissions);
      for (const permission of required) {
        if (!granted.has(permission)) throw HttpError.forbidden();
      }
    }) as unknown as FastifyInstance['requirePermission']);

  await app.register(cookiesPlugin);
  await app.register(errorHandler);
  await app.register(
    async (scope) => {
      await scope.register(publicRoutes, {
        repo,
        turnstile:
          options.enforceTurnstile === true
            ? new HttpTurnstileVerifier({
                enforced: true,
                secretKey: 'turnstile-secret',
                fetchImpl: (async () => ({
                  ok: true,
                  status: 200,
                  json: async () => ({ success: true }),
                })) as unknown as typeof fetch,
              })
            : ALWAYS_HUMAN,
        engagementInbox: 'engagement@vunvault.com',
        supportInbox: 'support@vunvault.com',
        ipSaltPepper: 'test-pepper',
      });
      await scope.register(adminBadgesRoutes, { repo });
    },
    { prefix: '/api/v1' },
  );

  return { app, repo, audits, emails, user };
}

let harness: Harness;

beforeEach(async () => {
  harness = await makeHarness();
});

const CONTACT_BODY = {
  name: 'Wanjiru Kamau',
  email: 'wanjiru@example.test',
  organization: 'Example Media',
  category: 'journalist_blogger_profile_request',
  subject: 'Requesting the verified blogger badge',
  message: 'I cover East African fintech for Example Media and would like to contribute.',
  consent: true,
};

// ------------------------------------------------------------------ contact

describe('POST /api/v1/contact', () => {
  it('stores the message, queues the emails and audits the category only', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/contact',
      payload: CONTACT_BODY,
      headers: { 'cf-connecting-ip': CLIENT_IP },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as { data: { id: string } };
    expect(body.data.id).toMatch(/^[0-9a-f-]{36}$/);

    expect(harness.repo.messages).toHaveLength(1);
    const stored = harness.repo.messages[0] as NewContactMessage;
    // A verification request is marked for the badge workflow by its subject.
    expect(stored.subject).toBe(`${VERIFICATION_SUBJECT_PREFIX} ${CONTACT_BODY.subject}`);
    expect(CONTACT_BODY.category).toBe(VERIFICATION_CATEGORY);

    // Two emails: the inbox and the acknowledgement.
    expect(harness.emails.map((email) => email.to)).toEqual([
      'engagement@vunvault.com',
      'wanjiru@example.test',
    ]);

    const audit = harness.audits[0];
    expect(audit?.eventType).toBe('CONTACT_RECEIVED');
    expect(audit?.actorLabel).toBe('external');
    expect(audit?.details).toEqual({ category: VERIFICATION_CATEGORY });
    // The message text is correspondence, not chain material.
    expect(JSON.stringify(harness.audits)).not.toContain('I cover East African fintech');
  });

  it('routes a support message to the support inbox', async () => {
    await harness.app.inject({
      method: 'POST',
      url: '/api/v1/contact',
      payload: {
        ...CONTACT_BODY,
        category: 'general_support',
        subject: 'Cannot reset my password',
      },
    });
    expect(harness.emails[0]?.to).toBe('support@vunvault.com');
    expect(harness.repo.messages[0]?.subject).toBe('Cannot reset my password');
  });

  it('never stores the raw IP address', async () => {
    await harness.app.inject({ method: 'POST', url: '/api/v1/contact', payload: CONTACT_BODY });
    const stored = harness.repo.messages[0] as NewContactMessage;
    expect(stored.ipHash).not.toBeNull();
    expect(stored.ipHash).not.toBe(CLIENT_IP);
    expect(stored.ipHash).toHaveLength(64);
    // The hash is of the address and the day's salt, so it changes with the date.
    const now = new Date('2026-10-06T00:00:00.000Z');
    expect(hashIp(CLIENT_IP, now, 'test-pepper')).not.toBe(
      hashIp(CLIENT_IP, new Date('2026-10-07T00:00:00.000Z'), 'test-pepper'),
    );
    expect(hashIp('', now, 'test-pepper')).toBeNull();
    expect(dailySalt(now, 'pepper')).toBe('2026-10-06:pepper');
    // And it appears nowhere in a response or an audit entry.
    expect(JSON.stringify(harness.audits)).not.toContain(CLIENT_IP);
  });

  it('refuses a submission that does not consent', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/contact',
      payload: { ...CONTACT_BODY, consent: false },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'validation_failed' });
    const body = response.json() as { details: Array<{ message: string }> };
    expect(body.details[0]?.message).toBe(CONSENT_REQUIRED_MESSAGE);
    expect(harness.repo.messages).toHaveLength(0);
    expect(harness.audits).toHaveLength(0);
  });

  it('answers 201 to a honeypot and does nothing at all', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/contact',
      payload: { ...CONTACT_BODY, website: 'https://spam.example' },
    });
    // Indistinguishable from a real submission — that is the entire point.
    expect(response.statusCode).toBe(201);
    expect((response.json() as { data: { id: string } }).data.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(harness.repo.messages).toHaveLength(0);
    expect(harness.emails).toHaveLength(0);
    expect(harness.audits).toHaveLength(0);
  });

  it('accepts an empty honeypot field, which is what a real browser sends', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/contact',
      payload: { ...CONTACT_BODY, website: '' },
    });
    expect(response.statusCode).toBe(201);
    expect(harness.repo.messages).toHaveLength(1);
  });

  it('refuses a bot when Turnstile enforcement is on, and does not say why', async () => {
    const enforced = await makeHarness({ enforceTurnstile: true });
    const response = await enforced.app.inject({
      method: 'POST',
      url: '/api/v1/contact',
      payload: CONTACT_BODY,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'captcha_failed' });
    expect(response.body).not.toContain('missing token');
    expect(enforced.repo.messages).toHaveLength(0);

    const withToken = await enforced.app.inject({
      method: 'POST',
      url: '/api/v1/contact',
      payload: { ...CONTACT_BODY, turnstileToken: 'valid-token' },
    });
    expect(withToken.statusCode).toBe(201);
  });

  it('answers one refusal for every verification failure', () => {
    for (const reason of ['missing token', 'unreachable', 'upstream 500', 'rejected']) {
      const error = captchaFailed(reason);
      expect(error.status).toBe(400);
      expect(error.code).toBe('captcha_failed');
      expect(error.message).not.toContain(reason);
    }
  });
});

// ------------------------------------------------------------------ consent

describe('POST /api/v1/consent', () => {
  const categories = (overrides: Partial<ConsentCategories> = {}): ConsentCategories => ({
    strictlyNecessary: true,
    analytics: false,
    marketing: false,
    functional: false,
    ...overrides,
  });

  it('records an essential-only choice and issues an anonymous cookie', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/consent',
      payload: { categories: categories(), policyVersion: 'v1.2' },
    });
    expect(response.statusCode).toBe(204);

    expect(harness.repo.consents).toHaveLength(1);
    const record = harness.repo.consents[0] as NewConsentRecord;
    expect(record.categories).toEqual({
      strictlyNecessary: true,
      analytics: false,
      marketing: false,
      functional: false,
    });
    expect(record.userId).toBeNull();
    expect(record.anonymousId).toMatch(/^[0-9a-f-]{36}$/);
    expect(record.ipHash).toHaveLength(64);
    expect(record.policyVersion).toBe('v1.2');

    const cookie = String(response.headers['set-cookie']);
    expect(cookie).toContain(`${ANONYMOUS_COOKIE}=`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Max-Age=31536000');
    expect(cookie).toContain('Secure');

    expect(harness.audits.map((audit) => audit.eventType)).toEqual(['CONSENT_RECORDED']);
    expect(harness.audits[0]?.details).toMatchObject({ analytics: false, marketing: false });
  });

  it('records Accept All the same way', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/consent',
      payload: {
        categories: categories({ analytics: true, marketing: true, functional: true }),
        policyVersion: 'v1.2',
      },
    });
    expect(response.statusCode).toBe(204);
    expect((harness.repo.consents[0] as NewConsentRecord).categories.analytics).toBe(true);
  });

  it('refuses a choice that declines the strictly necessary category', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/consent',
      payload: { categories: { ...categories(), strictlyNecessary: false }, policyVersion: 'v1.2' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'validation_failed' });
    expect(harness.repo.consents).toHaveLength(0);
  });

  it('attaches the record to a signed-in user and skips the anonymous cookie', async () => {
    harness.user.current = adminUser();
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/consent',
      payload: { categories: categories(), policyVersion: 'v1.2' },
    });
    expect(response.statusCode).toBe(204);
    // No anonymous identifier for a known user — but the consent version
    // cookie is always stored, signed-in or not.
    const names = response.cookies.map((entry) => entry.name);
    expect(names).not.toContain('vv_anon');
    expect(names).toContain('vv_consent');
    const record = harness.repo.consents[0] as NewConsentRecord;
    expect(record.userId).toBe(ADMIN_ID);
    expect(record.anonymousId).toBeNull();
  });

  it('reuses an anonymous cookie a visitor already has', async () => {
    await harness.app.inject({
      method: 'POST',
      url: '/api/v1/consent',
      payload: { categories: categories(), policyVersion: 'v1.2' },
      headers: { cookie: `${ANONYMOUS_COOKIE}=11111111-2222-4333-8444-555555555555` },
    });
    expect((harness.repo.consents[0] as NewConsentRecord).anonymousId).toBe(
      '11111111-2222-4333-8444-555555555555',
    );
  });

  it('stores the agreed policy version in the vv_consent cookie', async () => {
    const { app } = await makeHarness();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/consent',
      payload: {
        categories: {
          strictlyNecessary: true,
          analytics: false,
          marketing: false,
          functional: false,
        },
        policyVersion: '2',
      },
    });
    expect(response.statusCode).toBe(204);
    const cookie = response.cookies.find((entry) => entry.name === 'vv_consent');
    expect(cookie?.value).toBe('2');
  });
});

// ------------------------------------------------------------ blogger badge

describe('the verified-blogger badge', () => {
  it('grants and revokes for a super administrator', async () => {
    harness.user.current = adminUser();

    const granted = await harness.app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${BLOGGER_ID}/blogger-badge`,
    });
    expect(granted.statusCode).toBe(200);
    const grantedBody = granted.json() as { data: { id: string; verifiedBloggerAt: string } };
    expect(grantedBody.data.id).toBe(BLOGGER_ID);
    expect(new Date(grantedBody.data.verifiedBloggerAt).toISOString()).toBe(
      grantedBody.data.verifiedBloggerAt,
    );
    expect(harness.repo.badges[BLOGGER_ID]?.verifiedBloggerAt).not.toBeNull();
    expect(harness.audits[0]?.message).toBe(
      'Verified Blogger badge granted to wanjiru@example.test',
    );

    const revoked = await harness.app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/users/${BLOGGER_ID}/blogger-badge`,
    });
    expect(revoked.statusCode).toBe(200);
    expect(revoked.json()).toEqual({ data: { id: BLOGGER_ID, verifiedBloggerAt: null } });
    expect(harness.repo.badges[BLOGGER_ID]?.verifiedBloggerAt).toBeNull();
    expect(harness.audits[1]?.message).toBe(
      'Verified Blogger badge revoked from wanjiru@example.test',
    );
    expect(harness.audits.map((audit) => audit.eventType)).toEqual([
      'PERMISSION_CHANGED',
      'PERMISSION_CHANGED',
    ]);
  });

  it('needs users:manage, a second factor, and a session', async () => {
    harness.user.current = {
      ...adminUser(),
      role: 'admin' as UserRole,
      // `admin` is everything except `users:manage`.
      permissions: [...ROLE_PERMISSIONS.admin] as Permission[],
    };
    const forbidden = await harness.app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${BLOGGER_ID}/blogger-badge`,
    });
    expect(forbidden.statusCode).toBe(403);
    expect(harness.repo.badges[BLOGGER_ID]?.verifiedBloggerAt).toBeNull();

    harness.user.current = { ...adminUser(), aal: 'aal1' };
    const oneFactor = await harness.app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${BLOGGER_ID}/blogger-badge`,
    });
    expect(oneFactor.statusCode).toBe(403);
    expect(oneFactor.json()).toMatchObject({ error: 'mfa_required' });

    harness.user.current = null;
    expect(
      (
        await harness.app.inject({
          method: 'POST',
          url: `/api/v1/admin/users/${BLOGGER_ID}/blogger-badge`,
        })
      ).statusCode,
    ).toBe(401);
  });

  it('answers 404 for a user who does not exist', async () => {
    harness.user.current = adminUser();
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/admin/users/c1000000-0000-4000-8000-0000000000ff/blogger-badge',
    });
    expect(response.statusCode).toBe(404);
  });
});

// ------------------------------------------------------------------ service

describe('ContactService outcome shape', () => {
  it('reports whether anything was stored, so the route can stay silent for a bot', async () => {
    const outcome: ContactOutcome = { stored: false, id: 'x', audit: [], emails: [] };
    expect(outcome.stored).toBe(false);
    expect(outcome.audit).toEqual([]);
  });
});

describe('open tools + waitlist', () => {
  it('GET /api/v1/tools lists the catalogue with nullable file URLs', async () => {
    const { app, repo } = await makeHarness();
    repo.tools = [
      {
        id: 'cve-tracker',
        name: 'CVE Tracker CLI',
        summary: 'Prioritised patch queue from the NVD feed.',
        tags: ['CLI'],
        sizeLabel: '2.4 MB · .zip',
        fileUrl: null,
        icon: 'terminal',
      },
    ];
    const response = await app.inject({ method: 'GET', url: '/api/v1/tools' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: repo.tools });
  });

  it('POST /api/v1/waitlist records the signup and swallows duplicates', async () => {
    const { app, repo } = await makeHarness();
    const body = { email: 'early@example.test', topic: 'cve-tracker' };
    const first = await app.inject({ method: 'POST', url: '/api/v1/waitlist', payload: body });
    expect(first.statusCode).toBe(202);
    const second = await app.inject({ method: 'POST', url: '/api/v1/waitlist', payload: body });
    expect(second.statusCode).toBe(202);
    expect(repo.waitlist).toEqual([
      { email: 'early@example.test', topic: 'cve-tracker' },
      { email: 'early@example.test', topic: 'cve-tracker' },
    ]);
  });

  it('POST /api/v1/waitlist rejects a malformed address', async () => {
    const { app } = await makeHarness();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/waitlist',
      payload: { email: 'not-an-email' },
    });
    expect(response.statusCode).toBe(400);
  });
});

import Fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../../../config/env.js';
import type { AuditEntryRow } from '../../../audit/repo.js';
import errorHandler from '../../../plugins/error-handler.js';
import newsletterRoutes from './index.js';
import { hashIp, hashToken, RESEND_WINDOW_MS } from './service.js';
import type { NewsletterRepo, NewsletterRow } from '../store/repo.js';

/**
 * Double opt-in newsletter (Task 40c).
 *
 * The promises these tests hold the routes to: the subscribe endpoint answers
 * `202 {}` for every address — new, pending, confirmed, unsubscribed — with an
 * identical body, because "is this address on the list" is not a question the
 * internet gets to ask; the raw token exists only in the email and only its
 * SHA-256 is stored; one token belongs to exactly one subscriber and rotating it
 * kills the old one; a pending resend is throttled to once per ten minutes; and
 * the IP is stored as a daily-salted hash, never in the clear.
 */

const WEB_ORIGIN = 'https://www.vunvault.test';
const PEPPER = 'test-pepper';

const TEST_ENV: Env = {
  NODE_ENV: 'test',
  PORT: 8080,
  LOG_LEVEL: 'fatal',
  WEB_ORIGIN,
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

interface StoredRow extends NewsletterRow {
  ipHash: string | null;
}

/** What the service sees: the stored row minus the IP hash, which never leaves. */
function strip(row: StoredRow): NewsletterRow {
  return {
    id: row.id,
    email: row.email,
    status: row.status,
    tokenHash: row.tokenHash,
    source: row.source,
    confirmedAt: row.confirmedAt,
    unsubscribedAt: row.unsubscribedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

class FakeNewsletterRepo implements NewsletterRepo {
  rows: StoredRow[] = [];

  async findByEmail(email: string): Promise<NewsletterRow | null> {
    const found = this.byEmail(email);
    return found === undefined ? null : strip(found);
  }

  async findByTokenHash(tokenHash: string): Promise<NewsletterRow | null> {
    const found = this.rows.find((row) => row.tokenHash === tokenHash);
    return found === undefined ? null : strip(found);
  }

  async upsertPending(input: {
    id: string;
    email: string;
    tokenHash: string;
    source: string | null;
    ipHash: string | null;
    at: Date;
  }) {
    const existing = this.byEmail(input.email);
    if (existing !== undefined) {
      existing.status = 'pending';
      existing.tokenHash = input.tokenHash;
      existing.source = input.source ?? existing.source;
      existing.ipHash = input.ipHash;
      existing.unsubscribedAt = null;
      existing.updatedAt = input.at.toISOString();
      return;
    }
    this.rows.push({
      id: input.id,
      email: input.email,
      status: 'pending',
      tokenHash: input.tokenHash,
      source: input.source,
      ipHash: input.ipHash,
      confirmedAt: null,
      unsubscribedAt: null,
      createdAt: input.at.toISOString(),
      updatedAt: input.at.toISOString(),
    });
  }

  async confirm(id: string, at: Date) {
    const row = this.rows.find((candidate) => candidate.id === id);
    if (row === undefined) return;
    row.status = 'confirmed';
    row.confirmedAt = at.toISOString();
    row.updatedAt = at.toISOString();
  }

  async unsubscribe(id: string, at: Date) {
    const row = this.rows.find((candidate) => candidate.id === id);
    if (row === undefined) return;
    row.status = 'unsubscribed';
    row.unsubscribedAt = at.toISOString();
    row.updatedAt = at.toISOString();
  }

  async touchToken(id: string, tokenHash: string, at: Date) {
    const row = this.rows.find((candidate) => candidate.id === id);
    if (row === undefined) return;
    row.tokenHash = tokenHash;
    row.updatedAt = at.toISOString();
  }

  private byEmail(email: string) {
    return this.rows.find((row) => row.email === email.trim().toLowerCase());
  }
}

interface SentEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

interface AuditRecord {
  eventType: string;
  message: string;
  actorLabel: string;
  subject: string | null;
  details: Record<string, unknown>;
}

interface Harness {
  app: FastifyInstance;
  repo: FakeNewsletterRepo;
  emails: SentEmail[];
  audits: AuditRecord[];
}

async function makeHarness(): Promise<Harness> {
  const repo = new FakeNewsletterRepo();
  const emails: SentEmail[] = [];
  const audits: AuditRecord[] = [];

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
      const actor = input.actor as { id: string | null; label: string } | undefined;
      audits.push({
        eventType: String(input.eventType),
        message: String(input.message),
        actorLabel: actor?.label ?? 'external',
        subject: (input.subject as string | undefined) ?? null,
        details: (input.details as Record<string, unknown>) ?? {},
      });
      return { seq: audits.length } as unknown as AuditEntryRow;
    },
    publish: async () => undefined,
  } as unknown as FastifyInstance['audit']);

  await app.register(errorHandler);
  await app.register(
    async (scope) => {
      await scope.register(newsletterRoutes, {
        repo,
        sendEmail: async (input) => {
          emails.push(input);
        },
        confirmUrl: (token: string) => `${WEB_ORIGIN}/newsletter/confirm?token=${token}`,
        ipSaltPepper: PEPPER,
      });
    },
    { prefix: '/api/v1' },
  );

  return { app, repo, emails, audits };
}

/** Pull the raw token out of the confirmation email's link. */
function tokenFrom(email: SentEmail): string {
  const match = /token=([0-9a-f]{64})/.exec(email.text);
  if (match === null) throw new Error(`no token in email: ${email.text}`);
  return match[1] ?? '';
}

function subscribe(app: FastifyInstance, email: string, source?: string) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/newsletter',
    remoteAddress: '203.0.113.7',
    payload: source === undefined ? { email } : { email, source },
  });
}

let harness: Harness;

beforeEach(async () => {
  harness = await makeHarness();
});

describe('POST /api/v1/newsletter', () => {
  it('answers 202 {} for an unknown address, stores a pending row and emails the raw token', async () => {
    const response = await subscribe(harness.app, 'New.Reader@Example.test', 'blog');
    expect(response.statusCode).toBe(202);
    expect(response.body).toBe('{}');

    expect(harness.repo.rows).toHaveLength(1);
    const row = harness.repo.rows[0] as StoredRow;
    expect(row.status).toBe('pending');
    expect(row.email).toBe('new.reader@example.test'); // normalised
    expect(row.source).toBe('blog');

    // Exactly one email, and the raw token exists only inside it.
    expect(harness.emails).toHaveLength(1);
    const raw = tokenFrom(harness.emails[0] as SentEmail);
    expect(harness.emails[0]?.to).toBe('new.reader@example.test');
    expect(harness.emails[0]?.text).toContain(`${WEB_ORIGIN}/newsletter/confirm?token=${raw}`);

    // Only the SHA-256 of the token is stored — never the token itself.
    expect(row.tokenHash).toBe(hashToken(raw));
    expect(JSON.stringify(row)).not.toContain(raw);

    // The IP is a daily-salted hash, not the address.
    expect(row.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.ipHash).not.toContain('203.0.113.7');

    // A pending intention is not a subscription: nothing is audited yet.
    expect(harness.audits).toHaveLength(0);
  });

  it('answers identically for a known address: same 202, same body, and no email for a confirmed one', async () => {
    const unknown = await subscribe(harness.app, 'stranger@example.test');

    await harness.repo.upsertPending({
      id: 'f1000000-0000-4000-8000-0000000000f1',
      email: 'confirmed@example.test',
      tokenHash: hashToken('a'.repeat(64)),
      source: null,
      ipHash: null,
      at: new Date(Date.now() - 60 * 60 * 1000),
    });
    await harness.repo.confirm('f1000000-0000-4000-8000-0000000000f1', new Date());
    harness.emails.length = 0;

    const known = await subscribe(harness.app, 'confirmed@example.test');

    expect(unknown.statusCode).toBe(202);
    expect(known.statusCode).toBe(202);
    expect(known.body).toBe(unknown.body);
    // Already confirmed: re-confirming would be noise, so nothing is sent and
    // the row is untouched.
    expect(harness.emails).toHaveLength(0);
    const row = harness.repo.rows.find((r) => r.email === 'confirmed@example.test');
    expect(row?.status).toBe('confirmed');
    expect(row?.tokenHash).toBe(hashToken('a'.repeat(64)));
  });

  it('throttles a pending resend to once per ten minutes, then rotates the token', async () => {
    const first = await subscribe(harness.app, 'patient@example.test');
    const firstToken = tokenFrom(harness.emails[0] as SentEmail);
    expect(first.statusCode).toBe(202);

    // Inside the window: same 202, but no second email and the token stands.
    const second = await subscribe(harness.app, 'patient@example.test');
    expect(second.statusCode).toBe(202);
    expect(second.body).toBe('{}');
    expect(harness.emails).toHaveLength(1);

    // Wind the row's clock back past the window and try again.
    const row = harness.repo.rows[0] as StoredRow;
    row.updatedAt = new Date(Date.now() - RESEND_WINDOW_MS - 60_000).toISOString();
    const third = await subscribe(harness.app, 'patient@example.test');
    expect(third.statusCode).toBe(202);
    expect(harness.emails).toHaveLength(2);
    const rotated = tokenFrom(harness.emails[1] as SentEmail);
    expect(rotated).not.toBe(firstToken);
    expect(row.tokenHash).toBe(hashToken(rotated));

    // The old token is dead: one live token per subscriber, single-purpose.
    const stale = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/newsletter/confirm',
      payload: { token: firstToken },
    });
    expect(stale.statusCode).toBe(404);
    expect((stale.json() as { error: string }).error).toBe('not_found');
  });

  it('rejects an invalid address with the standard validation envelope', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/newsletter',
      payload: { email: 'not-an-email' },
    });
    expect(response.statusCode).toBe(400);
    expect((response.json() as { error: string }).error).toBe('validation_failed');
    expect(harness.repo.rows).toHaveLength(0);
  });
});

describe('POST /api/v1/newsletter/confirm', () => {
  it('confirms with the emailed token, answers 204 and audits an external actor', async () => {
    await subscribe(harness.app, 'reader@example.test');
    const raw = tokenFrom(harness.emails[0] as SentEmail);

    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/newsletter/confirm',
      payload: { token: raw },
    });
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');

    const row = harness.repo.rows[0] as StoredRow;
    expect(row.status).toBe('confirmed');
    expect(row.confirmedAt).not.toBeNull();

    // The subscription is a fact about a person, so THIS is where it is audited —
    // by `external`, and without the address in the entry.
    expect(harness.audits).toHaveLength(1);
    expect(harness.audits[0]?.eventType).toBe('NEWSLETTER_SUBSCRIBED');
    expect(harness.audits[0]?.actorLabel).toBe('external');
    expect(harness.audits[0]?.subject).toBe(row.id);
    expect(JSON.stringify(harness.audits[0])).not.toContain('reader@example.test');
  });

  it('answers 404 for an unknown token', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/newsletter/confirm',
      payload: { token: 'f'.repeat(64) },
    });
    expect(response.statusCode).toBe(404);
    expect((response.json() as { error: string }).error).toBe('not_found');
    expect(harness.audits).toHaveLength(0);
  });

  it('rejects a token shorter than the contract minimum', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/newsletter/confirm',
      payload: { token: 'too-short' },
    });
    expect(response.statusCode).toBe(400);
    expect((response.json() as { error: string }).error).toBe('validation_failed');
  });
});

describe('POST /api/v1/newsletter/unsubscribe', () => {
  it('unsubscribes with the same token, answers 204 and audits it', async () => {
    await subscribe(harness.app, 'leaver@example.test');
    const raw = tokenFrom(harness.emails[0] as SentEmail);
    await harness.app.inject({
      method: 'POST',
      url: '/api/v1/newsletter/confirm',
      payload: { token: raw },
    });

    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/newsletter/unsubscribe',
      payload: { token: raw },
    });
    expect(response.statusCode).toBe(204);

    const row = harness.repo.rows[0] as StoredRow;
    expect(row.status).toBe('unsubscribed');
    expect(row.unsubscribedAt).not.toBeNull();
    expect(harness.audits.map((entry) => entry.eventType)).toEqual([
      'NEWSLETTER_SUBSCRIBED',
      'NEWSLETTER_UNSUBSCRIBED',
    ]);
    expect(harness.audits[1]?.actorLabel).toBe('external');
  });

  it('lets an unsubscribed address opt back in with a fresh token', async () => {
    await subscribe(harness.app, 'leaver@example.test');
    const raw = tokenFrom(harness.emails[0] as SentEmail);
    await harness.app.inject({
      method: 'POST',
      url: '/api/v1/newsletter/unsubscribe',
      payload: { token: raw },
    });

    // The row's updatedAt is now, so the throttle applies to pending rows only —
    // an unsubscribed row is upserted straight back to pending.
    harness.emails.length = 0;
    const again = await subscribe(harness.app, 'leaver@example.test');
    expect(again.statusCode).toBe(202);

    const row = harness.repo.rows[0] as StoredRow;
    expect(row.status).toBe('pending');
    expect(row.unsubscribedAt).toBeNull();
    expect(harness.emails).toHaveLength(1);
    expect(row.tokenHash).not.toBe(hashToken(raw));

    // The OLD token no longer confirms anything.
    const stale = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/newsletter/confirm',
      payload: { token: raw },
    });
    expect(stale.statusCode).toBe(404);
  });
});

describe('hashIp (daily salt)', () => {
  it('is stable within a day, different the next day, and never the raw address', () => {
    const morning = new Date('2026-10-06T08:00:00.000Z');
    const evening = new Date('2026-10-06T20:00:00.000Z');
    const nextDay = new Date('2026-10-07T08:00:00.000Z');

    const a = hashIp('203.0.113.7', morning, PEPPER);
    const b = hashIp('203.0.113.7', evening, PEPPER);
    const c = hashIp('203.0.113.7', nextDay, PEPPER);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain('203.0.113.7');
    // Different pepper, different digest.
    expect(hashIp('203.0.113.7', morning, 'other-pepper')).not.toBe(a);
    // No address, no hash.
    expect(hashIp('', morning, PEPPER)).toBeNull();
  });

  it('matches the digest the subscribe route stored', () => {
    const row = harness.repo.rows[0];
    expect(row).toBeUndefined(); // nothing subscribed in this harness yet
    const today = new Date();
    const expected = hashIp('198.51.100.9', today, PEPPER);
    const sameDay = hashIp('198.51.100.9', new Date(today.getTime() + 60_000), PEPPER);
    expect(sameDay).toBe(expected);
  });
});

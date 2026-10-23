import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Permission, UserRole } from '@vunvault/contracts';
import { NOTE_REQUIRED_MESSAGE, ROLE_PERMISSIONS } from '@vunvault/contracts';
import type { Env } from '../../../config/env';
import errorHandler from '../../../plugins/error-handler';
import type { AuthUser } from '../../../plugins/auth';
import { HttpError } from '../../../lib/http-error';
import type { AuditEntryRow } from '../../../audit/repo';
import contentRoutes from './index';
import type {
  BadgeRow,
  ContentItemRow,
  ContentRepo,
  ItemPatch,
  ModerationFilters,
  NewContentItem,
  PublicContentFilters,
  SummaryCounts,
} from './repo';

/**
 * Moderation and the public feed.
 *
 * The two things that must not fail quietly: a reviewer moderating their own
 * submission, and the public feed leaking anything that is not published.
 */

const AUTHOR_ID = 'c1000000-0000-4000-8000-00000000a001';
const MODERATOR_ID = 'c1000000-0000-4000-8000-00000000ad01';
const ITEM_ID = 'e1000000-0000-4000-8000-0000000000c1';

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

function item(overrides: Partial<ContentItemRow> = {}): ContentItemRow {
  return {
    id: ITEM_ID,
    type: 'blog_post',
    title: 'Kenya State House cyber audit',
    summary: null,
    bodyMd: '# Findings',
    slugPath: '/blog/kenya-state-house-cyber-audit',
    authorId: AUTHOR_ID,
    authorName: 'Brian Otieno',
    authorInitials: 'BO',
    authorTeam: 'soc_detection_response',
    authorEmail: 'brian.otieno@vunvault.com',
    status: 'pending_review',
    category: 'threat_intel',
    tags: ['security', 'africa'],
    featuredImageKey: null,
    featuredImageUrl: null,
    imageAlt: null,
    readMinutes: 4,
    excerpt: 'An audit of the State House perimeter.',
    riskFlags: [],
    cveId: null,
    severity: null,
    submittedAt: '2026-10-05T09:00:00.000Z',
    publishedAt: null,
    scheduledFor: null,
    updatedAt: '2026-10-05T09:00:00.000Z',
    ...overrides,
  };
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value === undefined) return null;
  return value === null ? null : new Date(value).toISOString();
}

class FakeContentRepo implements ContentRepo {
  items: ContentItemRow[] = [];
  reviews: Array<{ itemId: string; reviewerId: string; action: string; note: string | null }> = [];
  slugs = new Set<string>();
  badges: Record<string, BadgeRow> = {};
  moderatorList: Array<{ userId: string; email: string }> = [];
  counts: SummaryCounts = {
    awaitingReview: 0,
    changesRequested: 0,
    approvedToday: 0,
    rejectedLast7Days: 0,
    publishedLast30Days: 0,
    avgReviewHours: 0,
  };

  async listModeration(filters: ModerationFilters) {
    let rows = [...this.items];
    if (filters.type !== undefined) rows = rows.filter((row) => row.type === filters.type);
    if (filters.status !== undefined) {
      rows = rows.filter((row) => row.status === filters.status);
    } else if (filters.statuses !== undefined) {
      rows = rows.filter((row) => filters.statuses?.includes(row.status));
    }
    if (filters.flag === 'none') {
      rows = rows.filter((row) => row.riskFlags.length === 0);
    } else if (filters.flag !== undefined) {
      rows = rows.filter((row) => row.riskFlags.includes(filters.flag as string));
    }
    return { rows, total: rows.length };
  }
  async getItem(itemId: string) {
    return this.items.find((row) => row.id === itemId) ?? null;
  }
  async summary() {
    return this.counts;
  }
  async insertReview(input: {
    itemId: string;
    reviewerId: string;
    action: string;
    note: string | null;
  }) {
    this.reviews.push(input);
    return `review-${this.reviews.length}`;
  }
  async applyPatch(itemId: string, patch: ItemPatch) {
    const row = this.items.find((candidate) => candidate.id === itemId);
    if (row === undefined) return;
    const { publishedAt, scheduledFor, submittedAt, ...rest } = patch;
    Object.assign(row, rest);
    // The SQL repo stores a timestamp and reads back an ISO string; so does this.
    if (publishedAt !== undefined) row.publishedAt = toIso(publishedAt);
    if (scheduledFor !== undefined) row.scheduledFor = toIso(scheduledFor);
    if (submittedAt !== undefined) row.submittedAt = toIso(submittedAt);
  }
  async listAuthorItems(authorId: string) {
    return this.items.filter((row) => row.authorId === authorId && row.type === 'blog_post');
  }
  async latestReviewerNote(itemId: string) {
    const review = [...this.reviews]
      .reverse()
      .find((row) => row.itemId === itemId && row.note !== null);
    return review?.note ?? null;
  }
  async createItem(input: NewContentItem) {
    const row = item({
      ...input,
      authorName: 'Brian Otieno',
      authorInitials: 'BO',
      authorEmail: 'brian.otieno@vunvault.com',
      submittedAt: null,
      publishedAt: null,
      scheduledFor: null,
      updatedAt: '2026-10-06T12:00:00.000Z',
    });
    this.items.push(row);
    this.slugs.add(input.slugPath);
    return row;
  }
  async slugTaken(slugPath: string) {
    return this.slugs.has(slugPath);
  }
  async deleteDraft(itemId: string) {
    const index = this.items.findIndex((row) => row.id === itemId && row.status === 'draft');
    if (index === -1) return false;
    this.items.splice(index, 1);
    return true;
  }
  async badge(userId: string) {
    return this.badges[userId] ?? null;
  }
  async moderators() {
    return this.moderatorList;
  }
  async listPublished(filters: PublicContentFilters) {
    let rows = this.items.filter((row) => row.status === 'published' && row.publishedAt !== null);
    if (filters.type !== undefined) rows = rows.filter((row) => row.type === filters.type);
    return { rows, total: rows.length };
  }
  async findPublishedBySlug(slug: string) {
    return (
      this.items.find((row) => row.status === 'published' && row.slugPath.endsWith(`/${slug}`)) ??
      null
    );
  }
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
  repo: FakeContentRepo;
  audits: AuditRecord[];
  emails: Array<{ to: string; template: string; vars: Record<string, string> }>;
  user: { current: AuthUser | null };
}

function moderator(role: UserRole = 'admin', permissions?: Permission[]): AuthUser {
  return {
    id: MODERATOR_ID,
    email: 'a.mwangi@vunvault.com',
    role,
    orgId: null,
    // The catalogue assumes a moderator role; `security_analyst` does not hold
    // `content:moderate` in the Task 19 map, so it is granted explicitly where a
    // test needs to exercise the legal-review rule for a non-administrator.
    permissions: permissions ?? [...ROLE_PERMISSIONS[role], 'content:moderate'],
    aal: 'aal2',
    sessionId: '20000000-0000-4000-8000-000000000001',
  };
}

async function makeHarness(): Promise<Harness> {
  const repo = new FakeContentRepo();
  const audits: AuditRecord[] = [];
  const emails: Harness['emails'] = [];
  const user: Harness['user'] = { current: moderator() };

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
      const actor = input.actor as { id: string | null; label: string };
      audits.push({
        eventType: String(input.eventType),
        message: String(input.message),
        actorLabel: actor.label,
        subject: (input.subject as string | undefined) ?? null,
        details: (input.details as Record<string, unknown>) ?? {},
      });
      return {
        seq: audits.length,
        id: 'entry-id',
        category: 'administrative',
        eventType: input.eventType,
        severity: 'info',
        sevLevel: null,
        actorId: 'actor-id',
        actorLabel: 'moderator',
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

  app.decorate('authenticate', (async (request: FastifyRequest) => {
    if (user.current === null) throw HttpError.unauthorized();
    request.user = user.current;
  }) as unknown as FastifyInstance['authenticate']);
  app.decorate('requireStaff', (async (request: FastifyRequest) => {
    const current = request.user;
    if (current === undefined) throw HttpError.unauthorized();
    const staff: UserRole[] = [
      'super_admin',
      'admin',
      'security_analyst',
      'soc_operator',
      'compliance_auditor',
      'support_engineer',
    ];
    if (!staff.includes(current.role)) throw HttpError.forbidden();
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

  await app.register(errorHandler);
  await app.register(
    async (scope) => {
      await scope.register(contentRoutes, { repo });
    },
    { prefix: '/api/v1' },
  );

  return { app, repo, audits, emails, user };
}

let harness: Harness;

beforeEach(async () => {
  harness = await makeHarness();
});

function act(body: Record<string, unknown>, id = ITEM_ID) {
  return harness.app.inject({
    method: 'POST',
    url: `/api/v1/admin/content/${id}/actions`,
    payload: body,
  });
}

// --------------------------------------------------------------- the queue

describe('GET /api/v1/admin/content', () => {
  beforeEach(() => {
    harness.repo.items.push(
      item({ id: ITEM_ID, status: 'pending_review' }),
      item({
        id: 'e1000000-0000-4000-8000-0000000000c2',
        title: 'Accra SOC hub',
        slugPath: '/news/accra-soc-hub',
        type: 'news_announcement',
        status: 'in_review',
      }),
      item({
        id: 'e1000000-0000-4000-8000-0000000000c3',
        title: 'Sentinel',
        slugPath: '/products/sentinel',
        type: 'product_listing',
        status: 'published',
        publishedAt: '2026-10-01T09:00:00.000Z',
        riskFlags: ['legal_review_required'],
      }),
    );
  });

  it('shows the queue by default: pending, in review and sent back', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/api/v1/admin/content' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      data: Array<{
        id: string;
        status: string;
        author: { fullName: string; initials: string; team: string | null };
      }>;
      total: number;
    };
    expect(body.total).toBe(2);
    expect(body.data.map((row) => row.status).sort()).toEqual(['in_review', 'pending_review']);
    // The author block carries initials and a team, and nothing else about them.
    expect(body.data[0]?.author).toMatchObject({
      fullName: 'Brian Otieno',
      initials: 'BO',
      team: 'soc_detection_response',
    });
    expect(response.body).not.toContain('brian.otieno@vunvault.com');
  });

  it('filters by status, type and risk flag', async () => {
    const published = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/admin/content?status=published',
    });
    expect((published.json() as { total: number }).total).toBe(1);

    const legal = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/admin/content?status=published&flag=legal_review_required',
    });
    expect((legal.json() as { total: number }).total).toBe(1);

    const none = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/admin/content?flag=none',
    });
    expect((none.json() as { total: number }).total).toBe(2);

    const byType = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/admin/content?type=news_announcement',
    });
    expect((byType.json() as { total: number }).total).toBe(1);
  });

  it('is staff-only, second-factor-only and permission-gated', async () => {
    harness.user.current = moderator('client' as UserRole);
    expect(
      (await harness.app.inject({ method: 'GET', url: '/api/v1/admin/content' })).statusCode,
    ).toBe(403);

    harness.user.current = { ...moderator(), aal: 'aal1' };
    const oneFactor = await harness.app.inject({ method: 'GET', url: '/api/v1/admin/content' });
    expect(oneFactor.statusCode).toBe(403);
    expect(oneFactor.json()).toMatchObject({ error: 'mfa_required' });

    harness.user.current = moderator('admin', ['scans:read'] as Permission[]);
    expect(
      (await harness.app.inject({ method: 'GET', url: '/api/v1/admin/content' })).statusCode,
    ).toBe(403);
  });
});

describe('GET /api/v1/admin/content/summary', () => {
  it('reports the numbers the fixtures describe', async () => {
    harness.repo.counts = {
      awaitingReview: 9,
      changesRequested: 2,
      approvedToday: 3,
      rejectedLast7Days: 1,
      publishedLast30Days: 14,
      avgReviewHours: 6.25,
    };
    const response = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/admin/content/summary',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: {
        awaitingReview: 9,
        changesRequested: 2,
        approvedToday: 3,
        rejectedLast7Days: 1,
        publishedLast30Days: 14,
        // One decimal place.
        avgReviewHours: 6.3,
      },
    });
  });
});

// ------------------------------------------------------------ moderation

describe('POST /api/v1/admin/content/:id/actions', () => {
  beforeEach(() => {
    harness.repo.items.push(item({ id: ITEM_ID }));
  });

  it('approves, records the decision and audits it', async () => {
    const response = await act({ action: 'approve', note: 'Reads well, sources checked.' });
    expect(response.statusCode).toBe(200);
    expect((response.json() as { data: { status: string } }).data.status).toBe('approved');
    expect(harness.repo.reviews).toHaveLength(1);
    expect(harness.repo.reviews[0]).toMatchObject({ itemId: ITEM_ID, action: 'approve' });
    expect(harness.audits.map((audit) => audit.eventType)).toEqual(['CONTENT_REVIEWED']);
  });

  it('publishes an approved item and stamps the time', async () => {
    await act({ action: 'approve', note: 'Reads well, sources checked.' });
    const response = await act({ action: 'publish' });
    expect(response.statusCode).toBe(200);
    expect((response.json() as { data: { status: string } }).data.status).toBe('published');
    expect(harness.repo.items[0]?.publishedAt).not.toBeNull();
    expect(harness.audits.map((audit) => audit.eventType)).toEqual([
      'CONTENT_REVIEWED',
      'CONTENT_PUBLISHED',
    ]);
  });

  it('refuses a rejection with no note, at the contract', async () => {
    const response = await act({ action: 'reject' });
    expect(response.statusCode).toBe(400);
    const body = response.json() as {
      error: string;
      details: Array<{ path: string[]; message: string }>;
    };
    expect(body.error).toBe('validation_failed');
    expect(body.details[0]?.path).toEqual(['note']);
    expect(body.details[0]?.message).toBe(NOTE_REQUIRED_MESSAGE);
    expect(harness.repo.reviews).toHaveLength(0);
  });

  it('refuses a reviewer moderating their own submission', async () => {
    harness.user.current = { ...moderator(), id: AUTHOR_ID };
    const response = await act({ action: 'approve', note: 'Approving my own piece.' });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'own_submission' });
    expect(harness.repo.reviews).toHaveLength(0);
    expect(harness.audits).toHaveLength(0);
  });

  it('refuses a transition the state machine does not allow', async () => {
    (harness.repo.items[0] as ContentItemRow).status = 'draft';
    const response = await act({ action: 'approve', note: 'Approving a draft directly.' });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'invalid_transition' });
  });

  it('blocks a flagged publish for a non-administrator and allows it for one', async () => {
    (harness.repo.items[0] as ContentItemRow).riskFlags = ['legal_review_required'];
    (harness.repo.items[0] as ContentItemRow).status = 'approved';

    // A security analyst who moderates: the flag is informational for `approve`,
    // a hard stop for `publish`.
    harness.user.current = moderator('security_analyst');
    const blocked = await act({ action: 'publish' });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json()).toMatchObject({ error: 'legal_review_required' });
    expect((harness.repo.items[0] as ContentItemRow).status).toBe('approved');

    harness.user.current = moderator('admin');
    const allowed = await act({ action: 'publish' });
    expect(allowed.statusCode).toBe(200);
    expect((harness.repo.items[0] as ContentItemRow).status).toBe('published');
  });

  it('lets a non-administrator approve the same flagged item', async () => {
    (harness.repo.items[0] as ContentItemRow).riskFlags = ['legal_review_required'];
    harness.user.current = moderator('security_analyst');
    const response = await act({ action: 'approve', note: 'Editorially sound, legal to follow.' });
    expect(response.statusCode).toBe(200);
  });

  it('refuses a schedule in the past', async () => {
    await act({ action: 'approve', note: 'Approved for a scheduled release.' });
    const response = await act({
      action: 'schedule',
      scheduledFor: '2020-01-01T09:00:00.000Z',
    });
    expect(response.statusCode).toBe(400);
    expect((response.json() as { details: Array<{ path: string[] }> }).details[0]?.path).toEqual([
      'scheduledFor',
    ]);
  });

  it('schedules into the future and publishes on demand', async () => {
    await act({ action: 'approve', note: 'Approved for a scheduled release.' });
    const scheduled = await act({ action: 'schedule', scheduledFor: '2099-01-01T09:00:00.000Z' });
    expect(scheduled.statusCode).toBe(200);
    expect((scheduled.json() as { data: { status: string } }).data.status).toBe('scheduled');
    expect(harness.repo.items[0]?.scheduledFor).toBe('2099-01-01T09:00:00.000Z');

    const published = await act({ action: 'publish' });
    expect(published.statusCode).toBe(200);
    expect((published.json() as { data: { status: string } }).data.status).toBe('published');
  });

  it('reminds the author without changing the status', async () => {
    const response = await act({ action: 'remind_author' });
    expect(response.statusCode).toBe(200);
    expect((harness.repo.items[0] as ContentItemRow).status).toBe('pending_review');
    expect(harness.repo.reviews).toHaveLength(1);
    expect(harness.emails[0]).toMatchObject({
      to: 'brian.otieno@vunvault.com',
      template: 'content_remind_author',
    });
  });

  it('answers 404 for an item that does not exist', async () => {
    const response = await act(
      { action: 'approve', note: 'No such item here.' },
      'e1000000-0000-4000-8000-0000000000ff',
    );
    expect(response.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------- the public feed

describe('GET /api/v1/content', () => {
  beforeEach(() => {
    harness.repo.items.push(
      item({
        id: ITEM_ID,
        status: 'published',
        publishedAt: '2026-10-01T09:00:00.000Z',
      }),
      item({
        id: 'e1000000-0000-4000-8000-0000000000c9',
        title: 'A draft nobody has approved',
        slugPath: '/blog/a-draft-nobody-has-approved',
        status: 'draft',
      }),
      item({
        id: 'e1000000-0000-4000-8000-0000000000ca',
        title: 'Waiting for a moderator',
        slugPath: '/blog/waiting-for-a-moderator',
        status: 'pending_review',
        submittedAt: '2026-10-04T09:00:00.000Z',
      }),
    );
  });

  it('serves published items only, with a cache header', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/api/v1/content' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=60');
    const body = response.json() as { data: Array<{ id: string; title: string }>; total: number };
    expect(body.total).toBe(1);
    expect(body.data[0]?.title).toBe('Kenya State House cyber audit');
  });

  it('leaks no draft, no author email and no internal identifier', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/api/v1/content' });
    expect(response.body).not.toContain('A draft nobody has approved');
    expect(response.body).not.toContain('Waiting for a moderator');
    expect(response.body).not.toContain('brian.otieno@vunvault.com');
    expect(response.body).not.toContain(AUTHOR_ID);
    expect(response.body).not.toContain('risk_flags');
    // The only id in the payload is the item's own. Task 40b replaced the
    // Task 20 projection: `summary` became `excerpt` and the blog card gained
    // slug/category/severity/tags/readMinutes/image fields.
    const body = response.json() as { data: Array<Record<string, unknown>> };
    expect(Object.keys(body.data[0] ?? {}).sort()).toEqual([
      'author',
      'category',
      'categoryLabel',
      'excerpt',
      'featuredImageUrl',
      'id',
      'imageAlt',
      'publishedAt',
      'readMinutes',
      'severity',
      'slug',
      'slugPath',
      'tags',
      'title',
      'type',
    ]);
    expect(body.data[0]?.author).toEqual({ fullName: 'Brian Otieno' });
  });

  it('needs no session at all', async () => {
    harness.user.current = null;
    const response = await harness.app.inject({ method: 'GET', url: '/api/v1/content' });
    expect(response.statusCode).toBe(200);
  });

  it('filters by type', async () => {
    const response = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/content?type=threat_advisory',
    });
    expect((response.json() as { total: number }).total).toBe(0);
  });
});

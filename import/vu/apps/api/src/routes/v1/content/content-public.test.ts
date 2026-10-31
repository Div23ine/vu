import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Permission, UserRole } from '@vunvault/contracts';
import { ROLE_PERMISSIONS } from '@vunvault/contracts';
import { publicContent } from '@vunvault/contracts/fixtures/store';
import type { Env } from '../../../config/env.js';
import errorHandler from '../../../plugins/error-handler.js';
import type { AuthUser } from '../../../plugins/auth.js';
import { HttpError } from '../../../lib/http-error.js';
import type { AuditEntryRow } from '../../../audit/repo.js';
import contentRoutes from './index.js';
import { ModerationService } from './service.js';
import type {
  BadgeRow,
  ContentItemRow,
  ContentRepo,
  ItemPatch,
  ModerationFilters,
  NewContentItem,
  PublicContentFilters,
  SummaryCounts,
} from './repo.js';

/**
 * The public feed and the article route (Task 40c).
 *
 * The feed is the internet's view of the Studio, so these tests hold it to three
 * promises: search finds a post by its TAGS, `sort=priority` puts a CRITICAL post
 * above a newer MEDIUM one, and anything that is not published — a draft, a
 * pending review, a post scheduled for next week — is a plain 404 on the detail
 * route and simply absent from the list.
 *
 * The fake repo mirrors `SqlContentRepo.listPublished` semantics exactly: the
 * same filters, the same `q` ILIKE set (title, excerpt, summary, cve_id, tags),
 * the same priority order (severity critical→low, nulls last, then newest) and
 * the same page/total split.
 */

const NOW = new Date('2026-10-06T09:00:00.000Z');
const AUTHOR_ID = 'c1000000-0000-4000-8000-00000000a001';

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

/** A row builder: everything a card needs, overridable per test. */
function row(overrides: Partial<ContentItemRow> = {}): ContentItemRow {
  return {
    id: 'e1000000-0000-4000-8000-0000000000c1',
    type: 'blog_post',
    title: 'A post',
    summary: null,
    bodyMd: '# Body',
    slugPath: '/blog/a-post',
    authorId: AUTHOR_ID,
    authorName: 'Brian Otieno',
    authorInitials: 'BO',
    authorTeam: 'soc_detection_response',
    authorEmail: 'brian.otieno@vunvault.com',
    status: 'published',
    category: 'news',
    tags: [],
    featuredImageKey: null,
    featuredImageUrl: null,
    imageAlt: null,
    readMinutes: 5,
    excerpt: null,
    riskFlags: [],
    cveId: null,
    severity: null,
    submittedAt: '2026-10-01T09:00:00.000Z',
    publishedAt: '2026-10-01T09:00:00.000Z',
    scheduledFor: null,
    updatedAt: '2026-10-01T09:00:00.000Z',
    ...overrides,
  };
}

/** The six seed posts from the fixture, as published rows. */
function seededItems(): ContentItemRow[] {
  return publicContent.map((item, index) =>
    row({
      id: item.id,
      type: item.type,
      title: item.title,
      excerpt: item.excerpt,
      slugPath: item.slugPath,
      category: item.category,
      severity: item.severity,
      tags: item.tags,
      readMinutes: item.readMinutes,
      featuredImageUrl: item.featuredImageUrl,
      imageAlt: item.imageAlt,
      publishedAt: item.publishedAt,
      updatedAt: item.publishedAt,
      authorName: item.author.fullName,
      authorId: `c1000000-0000-4000-8000-0000000000a${index}`,
      bodyMd: `# ${item.title}\n\nThe full, sanitised article body.`,
    }),
  );
}

/** Severity rank for `sort=priority`: critical→low, nulls last. */
const SEVERITY_RANK: Record<string, number> = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
};

class FakePublicContentRepo implements ContentRepo {
  items: ContentItemRow[] = [];

  async listPublished(filters: PublicContentFilters) {
    let rows = this.items.filter(
      (item) =>
        item.status === 'published' &&
        item.publishedAt !== null &&
        new Date(item.publishedAt).getTime() <= filters.now.getTime(),
    );
    if (filters.type !== undefined) rows = rows.filter((item) => item.type === filters.type);
    if (filters.category !== undefined) {
      rows = rows.filter((item) => item.category === filters.category);
    }
    if (filters.severity !== undefined) {
      rows = rows.filter((item) => item.severity === filters.severity);
    }
    if (filters.q !== undefined && filters.q !== '') {
      const q = filters.q.toLowerCase();
      const has = (value: string | null) => value !== null && value.toLowerCase().includes(q);
      rows = rows.filter(
        (item) =>
          has(item.title) ||
          has(item.excerpt) ||
          has(item.summary) ||
          has(item.cveId) ||
          item.tags.some((tag) => tag.toLowerCase().includes(q)),
      );
    }
    const total = rows.length;
    const rank = (item: ContentItemRow) =>
      item.severity === null ? Number.MAX_SAFE_INTEGER : (SEVERITY_RANK[item.severity] ?? 99);
    rows = [...rows].sort((a, b) => {
      if (filters.sort === 'priority') {
        const bySeverity = rank(a) - rank(b);
        if (bySeverity !== 0) return bySeverity;
      }
      return new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime();
    });
    const offset = (filters.page - 1) * filters.pageSize;
    return { rows: rows.slice(offset, offset + filters.pageSize), total };
  }

  async findPublishedBySlug(slug: string, now: Date) {
    return (
      this.items.find(
        (item) =>
          item.status === 'published' &&
          item.publishedAt !== null &&
          new Date(item.publishedAt).getTime() <= now.getTime() &&
          item.slugPath.endsWith(`/${slug}`),
      ) ?? null
    );
  }

  // --- the rest of the interface is unused by the public routes -------------
  async listModeration(_filters: ModerationFilters) {
    return { rows: [], total: 0 };
  }
  async getItem(itemId: string) {
    return this.items.find((item) => item.id === itemId) ?? null;
  }
  async summary(): Promise<SummaryCounts> {
    return {
      awaitingReview: 0,
      changesRequested: 0,
      approvedToday: 0,
      rejectedLast7Days: 0,
      publishedLast30Days: 0,
      avgReviewHours: 0,
    };
  }
  async insertReview() {
    return 'review-1';
  }
  async applyPatch(_itemId: string, _patch: ItemPatch) {}
  async listAuthorItems() {
    return [];
  }
  async latestReviewerNote() {
    return null;
  }
  async createItem(_input: NewContentItem): Promise<ContentItemRow> {
    throw new Error('not used');
  }
  async slugTaken() {
    return false;
  }
  async deleteDraft() {
    return false;
  }
  async badge(_userId: string): Promise<BadgeRow | null> {
    return null;
  }
  async moderators() {
    return [];
  }
}

interface Harness {
  app: FastifyInstance;
  repo: FakePublicContentRepo;
  user: { current: AuthUser | null };
}

function staff(): AuthUser {
  return {
    id: 'c1000000-0000-4000-8000-00000000ad01',
    email: 'a.mwangi@vunvault.com',
    role: 'admin' as UserRole,
    orgId: null,
    permissions: [...ROLE_PERMISSIONS.admin] as Permission[],
    aal: 'aal2',
    sessionId: '20000000-0000-4000-8000-000000000001',
  };
}

async function makeHarness(): Promise<Harness> {
  const repo = new FakePublicContentRepo();
  const user: Harness['user'] = { current: staff() };

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
    append: async (_executor: unknown, input: Record<string, unknown>) =>
      ({ seq: 1, ...input }) as unknown as AuditEntryRow,
    publish: async () => undefined,
  } as unknown as FastifyInstance['audit']);
  app.decorate('queues', {
    notify: { add: async () => undefined },
  } as unknown as FastifyInstance['queues']);

  app.decorate('authenticate', (async (request: FastifyRequest) => {
    if (user.current === null) throw HttpError.unauthorized();
    request.user = user.current;
  }) as unknown as FastifyInstance['authenticate']);
  app.decorate(
    'requireStaff',
    (async () => undefined) as unknown as FastifyInstance['requireStaff'],
  );
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
      await scope.register(contentRoutes, {
        repo,
        // A fixed clock: "published_at <= now" must be reproducible, not a race
        // against the wall time the suite happens to run at.
        service: new ModerationService({ repo, now: () => NOW }),
      });
    },
    { prefix: '/api/v1' },
  );

  return { app, repo, user };
}

let harness: Harness;

beforeEach(async () => {
  harness = await makeHarness();
  harness.repo.items.push(...seededItems());
});

interface FeedBody {
  data: Array<Record<string, unknown>>;
  total: number;
}

describe('GET /api/v1/content (public feed)', () => {
  it('serves the published seed posts, newest first, with a one-minute cache header', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/api/v1/content' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=60');
    const body = response.json() as FeedBody;
    expect(body.total).toBe(6);
    // Newest first: the State House audit (2026-08-14) leads the feed.
    expect(body.data[0]?.title).toBe('Kenya State House Cyber Security Audit & Risk Analysis');
    expect(body.data[5]?.title).toBe(
      'Inside the VUNVAULT Sensor Network: Catching Memory Exfiltration',
    );
  });

  it('needs no session at all', async () => {
    harness.user.current = null;
    const response = await harness.app.inject({ method: 'GET', url: '/api/v1/content' });
    expect(response.statusCode).toBe(200);
  });

  it('matches a TAG with `q`, not just the title', async () => {
    // `incident-response` appears in no title and no excerpt — only in the
    // ransomware post's tags.
    const response = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/content?q=incident-response',
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as FeedBody;
    expect(body.total).toBe(1);
    expect(body.data[0]?.slug).toBe('ransomware-playbooks-now-targeting-east-african-saccos');
  });

  it('sorts by priority: a CRITICAL post outranks a newer MEDIUM one', async () => {
    const response = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/content?sort=priority&pageSize=10',
    });
    const body = response.json() as FeedBody;
    expect(body.data[0]?.severity).toBe('critical');
    expect(body.data[0]?.slug).toBe('zero-day-exploit-trends-what-2026-revealed-about-api-ingress');
    // The critical post was published 2026-08-05; both mediums are newer, and
    // every high post is newer than nothing — the order is severity, then date.
    const severities = body.data.map((item) => item.severity);
    expect(severities).toEqual(['critical', 'high', 'high', 'medium', 'medium', 'low']);
    const mediums = body.data.filter((item) => item.severity === 'medium');
    expect(mediums[0]?.slug).toBe('africas-cyber-awakening-how-the-continent-is-fighting-back');
  });

  it('puts a post with no severity after every severity the feed can show', async () => {
    harness.repo.items.push(
      row({
        id: 'e1000000-0000-4000-8000-0000000000f1',
        title: 'A plain announcement',
        slugPath: '/blog/a-plain-announcement',
        severity: null,
        publishedAt: '2026-10-05T09:00:00.000Z', // the newest post in the feed
      }),
    );
    const response = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/content?sort=priority&pageSize=20',
    });
    const body = response.json() as FeedBody;
    expect(body.total).toBe(7);
    expect(body.data[6]?.title).toBe('A plain announcement');
    // …while `newest` still leads with it.
    const newest = await harness.app.inject({ method: 'GET', url: '/api/v1/content' });
    expect((newest.json() as FeedBody).data[0]?.title).toBe('A plain announcement');
  });

  it('filters by category, severity and type', async () => {
    const byCategory = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/content?category=threat_intel',
    });
    expect((byCategory.json() as FeedBody).total).toBe(1);

    const bySeverity = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/content?severity=high',
    });
    const high = bySeverity.json() as FeedBody;
    expect(high.total).toBe(2);
    expect(high.data.every((item) => item.severity === 'high')).toBe(true);

    const byType = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/content?type=threat_advisory',
    });
    expect((byType.json() as FeedBody).total).toBe(0);
  });

  it('paginates with a stable total', async () => {
    const response = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/content?page=2&pageSize=2',
    });
    const body = response.json() as FeedBody;
    expect(body.total).toBe(6);
    expect(body.data).toHaveLength(2);
    expect(body.data[0]?.title).toBe('Cybersecurity Compliance Frameworks for SACCOs & Fintechs');
  });

  it('hides a scheduled post until its moment arrives', async () => {
    harness.repo.items.push(
      row({
        id: 'e1000000-0000-4000-8000-0000000000f2',
        title: 'Embargoed until next week',
        slugPath: '/blog/embargoed-until-next-week',
        status: 'published',
        publishedAt: '2026-10-13T09:00:00.000Z', // in the future relative to NOW
        scheduledFor: '2026-10-13T09:00:00.000Z',
      }),
    );
    const response = await harness.app.inject({ method: 'GET', url: '/api/v1/content' });
    const body = response.json() as FeedBody;
    expect(body.total).toBe(6);
    expect(response.body).not.toContain('Embargoed until next week');
  });
});

describe('GET /api/v1/content/:slug (article route)', () => {
  it('serves the full detail for a published post', async () => {
    const response = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/content/zero-day-exploit-trends-what-2026-revealed-about-api-ingress',
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=60');
    const body = response.json() as { data: Record<string, unknown> };
    expect(body.data).toMatchObject({
      title: 'Zero-Day Exploit Trends: What 2026 Revealed About API Ingress',
      severity: 'critical',
      categoryLabel: 'Threat Intel',
      readMinutes: 5,
      bodyMd: expect.stringContaining('The full, sanitised article body.'),
    });
    // The author is a name, nothing else: no id, no email, no team.
    expect(body.data.author).toEqual({ fullName: 'Fatima Hassan' });
    expect(JSON.stringify(body.data)).not.toContain('@vunvault.com');
    expect(JSON.stringify(body.data)).not.toContain('risk_flags');
  });

  it('answers 404 for a draft, a pending review and an unknown slug alike', async () => {
    harness.repo.items.push(
      row({
        id: 'e1000000-0000-4000-8000-0000000000f3',
        title: 'A draft nobody has approved',
        slugPath: '/blog/a-draft-nobody-has-approved',
        status: 'draft',
        publishedAt: null,
      }),
      row({
        id: 'e1000000-0000-4000-8000-0000000000f4',
        title: 'Waiting for a moderator',
        slugPath: '/blog/waiting-for-a-moderator',
        status: 'pending_review',
        publishedAt: null,
      }),
    );

    for (const slug of ['a-draft-nobody-has-approved', 'waiting-for-a-moderator', 'no-such-post']) {
      const response = await harness.app.inject({
        method: 'GET',
        url: `/api/v1/content/${slug}`,
      });
      expect(response.statusCode, slug).toBe(404);
      expect((response.json() as { error: string }).error).toBe('not_found');
    }
  });

  it('falls back to the first 240 characters of `summary` when `excerpt` is null', async () => {
    const longSummary = `Sentence about the perimeter. ${' filler'.repeat(60)}`.trim();
    harness.repo.items.push(
      row({
        id: 'e1000000-0000-4000-8000-0000000000f5',
        title: 'An older threat advisory',
        slugPath: '/advisories/an-older-threat-advisory',
        type: 'threat_advisory',
        excerpt: null,
        summary: longSummary,
        cveId: 'CVE-2026-1234',
      }),
    );
    const response = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/content/an-older-threat-advisory',
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: { excerpt: string; slug: string } };
    expect(body.data.excerpt.length).toBeLessThanOrEqual(241); // 240 chars + the ellipsis
    expect(body.data.excerpt.endsWith('…')).toBe(true);
    expect(longSummary.startsWith(body.data.excerpt.slice(0, 40))).toBe(true);
    // The slug is the LAST path segment, whatever the section.
    expect(body.data.slug).toBe('an-older-threat-advisory');

    // …and `q` finds it by its CVE id.
    const search = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/content?q=CVE-2026-1234',
    });
    expect((search.json() as FeedBody).total).toBe(1);
  });
});

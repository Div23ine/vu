import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it } from 'vitest';
import type { UserRole } from '@vunvault/contracts';
import { STUDIO_LIMITS } from '@vunvault/contracts';
import type { Env } from '../../../config/env.js';
import errorHandler from '../../../plugins/error-handler.js';
import type { AuthUser } from '../../../plugins/auth.js';
import { HttpError } from '../../../lib/http-error.js';
import type { ObjectStorage } from '../../../lib/object-storage.js';
import type { AuditEntryRow } from '../../../audit/repo.js';
import type {
  BadgeRow,
  ContentItemRow,
  ContentRepo,
  ItemPatch,
  ModerationFilters,
  NewContentItem,
  SummaryCounts,
} from '../content/repo.js';
import studioRoutes from './index.js';
import { isSafeLinkTarget, normaliseTags, sanitiseMarkdown } from './markdown.js';
import { blogSlugPath, nextSlugCandidate, slugify } from './slug.js';
import { readinessFor } from './service.js';

/**
 * The Content Studio.
 *
 * Two families of assertion matter: the badge gate (who may write at all) and the
 * sanitiser (what an author is allowed to put in the database). Everything else is
 * workflow.
 */

const BLOGGER_ID = 'c1000000-0000-4000-8000-00000000b101';
const STAFF_AUTHOR_ID = 'c1000000-0000-4000-8000-00000000ad01';
const OTHER_AUTHOR_ID = 'c1000000-0000-4000-8000-00000000b102';
const MODERATOR_ID = 'c1000000-0000-4000-8000-00000000ad02';
const DRAFT_ID = 'e1000000-0000-4000-8000-0000000000d1';

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

function row(overrides: Partial<ContentItemRow> = {}): ContentItemRow {
  return {
    id: DRAFT_ID,
    type: 'blog_post',
    title: '',
    summary: null,
    bodyMd: null,
    slugPath: '/blog/untitled-e1000000',
    authorId: BLOGGER_ID,
    authorName: 'Wanjiru Kamau',
    authorInitials: 'WK',
    authorTeam: null,
    authorEmail: 'wanjiru@example.test',
    status: 'draft',
    category: null,
    tags: [],
    featuredImageKey: null,
    featuredImageUrl: null,
    imageAlt: null,
    readMinutes: null,
    excerpt: null,
    riskFlags: [],
    cveId: null,
    severity: null,
    submittedAt: null,
    publishedAt: null,
    scheduledFor: null,
    updatedAt: '2026-10-06T12:00:00.000Z',
    ...overrides,
  };
}

class FakeContentRepo implements ContentRepo {
  items: ContentItemRow[] = [];
  reviews: Array<{ itemId: string; reviewerId: string; action: string; note: string | null }> = [];
  slugs = new Set<string>();
  badges: Record<string, BadgeRow> = {};
  moderatorList: Array<{ userId: string; email: string }> = [
    { userId: MODERATOR_ID, email: 'moderator@vunvault.com' },
  ];
  counts: SummaryCounts = {
    awaitingReview: 0,
    changesRequested: 0,
    approvedToday: 0,
    rejectedLast7Days: 0,
    publishedLast30Days: 0,
    avgReviewHours: 0,
  };

  async listModeration(_filters: ModerationFilters) {
    return { rows: this.items, total: this.items.length };
  }
  async getItem(itemId: string) {
    return this.items.find((candidate) => candidate.id === itemId) ?? null;
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
    const existing = this.items.find((candidate) => candidate.id === itemId);
    if (existing === undefined) return;
    Object.assign(existing, patch);
    if (patch.submittedAt !== undefined && patch.submittedAt !== null) {
      existing.submittedAt = patch.submittedAt.toISOString();
    }
    if (patch.slugPath !== undefined) this.slugs.add(patch.slugPath);
  }
  async listAuthorItems(authorId: string) {
    return this.items.filter((candidate) => candidate.authorId === authorId);
  }
  async latestReviewerNote(itemId: string) {
    const review = [...this.reviews].reverse().find((entry) => entry.itemId === itemId);
    return review?.note ?? null;
  }
  async createItem(input: NewContentItem) {
    const created = row({ ...input, summary: null, submittedAt: null, publishedAt: null });
    this.items.push(created);
    this.slugs.add(input.slugPath);
    return created;
  }
  async slugTaken(slugPath: string) {
    return this.slugs.has(slugPath);
  }
  async deleteDraft(itemId: string) {
    const index = this.items.findIndex(
      (candidate) => candidate.id === itemId && candidate.status === 'draft',
    );
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
  async listPublished() {
    return { rows: [], total: 0 };
  }
  async findPublishedBySlug() {
    return null;
  }
}

function fakeStorage() {
  const presigned: Array<{ key: string; contentType: string; maxBytes: number }> = [];
  const storage = {
    async presignPut(input: { key: string; contentType: string; maxBytes: number }) {
      presigned.push(input);
      return { url: `https://r2.vunvault.test/${input.key}?sig=test`, headers: {} };
    },
    async head() {
      return { size: 1024, contentType: 'image/png' };
    },
    async delete() {
      /* no-op */
    },
    async presignGet(input: { key: string }) {
      return `https://cdn.vunvault.test/${input.key}`;
    },
    publicUrl(key: string) {
      return `https://cdn.vunvault.test/${key}`;
    },
  } satisfies ObjectStorage;
  return { storage, presigned };
}

interface Harness {
  app: FastifyInstance;
  repo: FakeContentRepo;
  audits: Array<{ eventType: string; message: string; details: Record<string, unknown> }>;
  notifications: Array<{ userId: string; title: string }>;
  storage: ReturnType<typeof fakeStorage>;
  user: { current: AuthUser | null };
}

function blogger(): AuthUser {
  return {
    id: BLOGGER_ID,
    email: 'wanjiru@example.test',
    role: 'client' as UserRole,
    orgId: null,
    permissions: [],
    aal: 'aal1',
    sessionId: '20000000-0000-4000-8000-000000000002',
  };
}

async function makeHarness(): Promise<Harness> {
  const repo = new FakeContentRepo();
  const storage = fakeStorage();
  const audits: Harness['audits'] = [];
  const notifications: Harness['notifications'] = [];
  const user: Harness['user'] = { current: blogger() };

  // A verified blogger, a staff author, and an ordinary client with no badge.
  repo.badges[BLOGGER_ID] = {
    userId: BLOGGER_ID,
    displayName: 'Wanjiru Kamau',
    role: 'client',
    verifiedBloggerAt: '2026-09-01T09:00:00.000Z',
  };
  repo.badges[STAFF_AUTHOR_ID] = {
    userId: STAFF_AUTHOR_ID,
    displayName: 'Brian Otieno',
    role: 'security_analyst',
    verifiedBloggerAt: null,
  };
  repo.badges[OTHER_AUTHOR_ID] = {
    userId: OTHER_AUTHOR_ID,
    displayName: 'Someone Else',
    role: 'client',
    verifiedBloggerAt: '2026-09-02T09:00:00.000Z',
  };

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
        actorLabel: 'author',
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
  app.decorate('authenticate', (async (request: FastifyRequest) => {
    if (user.current === null) throw HttpError.unauthorized();
    request.user = user.current;
  }) as unknown as FastifyInstance['authenticate']);

  await app.register(errorHandler);
  await app.register(
    async (scope) => {
      await scope.register(studioRoutes, {
        repo,
        storage: storage.storage,
        notify: async (input) => {
          notifications.push({ userId: input.userId, title: input.title });
        },
      });
    },
    { prefix: '/api/v1' },
  );

  return { app, repo, audits, notifications, storage, user };
}

let harness: Harness;

beforeEach(async () => {
  harness = await makeHarness();
});

function words(count: number): string {
  return Array.from({ length: count }, (_, index) => `word${index + 1}`).join(' ');
}

// ------------------------------------------------------------ the badge gate

describe('the verified-blogger badge', () => {
  it('answers /studio/status for any authenticated user and never 403s', async () => {
    const verified = await harness.app.inject({ method: 'GET', url: '/api/v1/studio/status' });
    expect(verified.statusCode).toBe(200);
    expect(verified.json()).toEqual({
      data: {
        verified: true,
        verifiedAt: '2026-09-01T09:00:00.000Z',
        displayName: 'Wanjiru Kamau',
      },
    });

    harness.user.current = { ...blogger(), id: 'c1000000-0000-4000-8000-00000000b999' };
    harness.repo.badges['c1000000-0000-4000-8000-00000000b999'] = {
      userId: 'c1000000-0000-4000-8000-00000000b999',
      displayName: 'No Badge',
      role: 'client',
      verifiedBloggerAt: null,
    };
    const unverified = await harness.app.inject({ method: 'GET', url: '/api/v1/studio/status' });
    expect(unverified.statusCode).toBe(200);
    expect(unverified.json()).toMatchObject({ data: { verified: false, verifiedAt: null } });
  });

  it('refuses an unverified client with 403 badge_required', async () => {
    harness.user.current = { ...blogger(), id: 'c1000000-0000-4000-8000-00000000b999' };
    harness.repo.badges['c1000000-0000-4000-8000-00000000b999'] = {
      userId: 'c1000000-0000-4000-8000-00000000b999',
      displayName: 'No Badge',
      role: 'client',
      verifiedBloggerAt: null,
    };
    const response = await harness.app.inject({ method: 'GET', url: '/api/v1/studio/submissions' });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'badge_required' });
  });

  it('lets staff who hold content:author in without a badge', async () => {
    harness.user.current = {
      ...blogger(),
      id: STAFF_AUTHOR_ID,
      role: 'security_analyst' as UserRole,
    };
    const response = await harness.app.inject({ method: 'GET', url: '/api/v1/studio/submissions' });
    expect(response.statusCode).toBe(200);
  });

  it('needs a session', async () => {
    harness.user.current = null;
    expect(
      (await harness.app.inject({ method: 'GET', url: '/api/v1/studio/status' })).statusCode,
    ).toBe(401);
  });
});

// ------------------------------------------------------------------- drafts

describe('drafts', () => {
  it('creates a draft with a generated slug and a readiness checklist', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/studio/drafts',
      payload: {
        title: 'Kenya’s State House Cyber Audit',
        tags: ['#security', 'africa', 'security'],
      },
    });
    expect(response.statusCode).toBe(201);
    const body = response.json() as {
      data: {
        slugPath: string;
        status: string;
        tags: string[];
        readiness: Record<string, boolean>;
      };
    };
    expect(body.data.slugPath).toBe('/blog/kenyas-state-house-cyber-audit');
    expect(body.data.status).toBe('draft');
    // Tags keep their order, lose the `#`, and are de-duplicated.
    expect(body.data.tags).toEqual(['security', 'africa']);
    expect(body.data.readiness).toEqual({
      title: true,
      category: false,
      bodyWords: false,
      excerpt: false,
      featuredImage: false,
      tags: true,
    });
  });

  it('suffixes -2 on a slug collision', async () => {
    harness.repo.slugs.add('/blog/kenya-state-house-cyber-audit');
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/studio/drafts',
      payload: { title: 'Kenya State House Cyber Audit', tags: [] },
    });
    expect((response.json() as { data: { slugPath: string } }).data.slugPath).toBe(
      '/blog/kenya-state-house-cyber-audit-2',
    );

    harness.repo.slugs.add('/blog/kenya-state-house-cyber-audit-2');
    const third = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/studio/drafts',
      payload: { title: 'Kenya State House Cyber Audit', tags: [] },
    });
    expect((third.json() as { data: { slugPath: string } }).data.slugPath).toBe(
      '/blog/kenya-state-house-cyber-audit-3',
    );
  });

  it('sanitises the markdown body and keeps the formatting that is allowed', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/studio/drafts',
      payload: {
        title: 'Sanitised',
        tags: [],
        bodyMd: [
          '## Heading',
          '',
          '**bold** and *italic* and `code`.',
          '',
          '<script>alert(1)</script>[x](javascript:alert(1))',
          '',
          '- a list item',
          '> a quote',
          '',
          '[VUNVAULT](https://www.vunvault.com) and ![logo](https://cdn.vunvault.test/logo.png)',
        ].join('\n'),
      },
    });
    expect(response.statusCode).toBe(201);
    const stored = (response.json() as { data: { bodyMd: string | null } }).data.bodyMd ?? '';
    expect(stored).not.toContain('<script');
    expect(stored).not.toContain('</script>');
    expect(stored).not.toContain('javascript:');
    expect(stored).toContain('## Heading');
    expect(stored).toContain('**bold**');
    expect(stored).toContain('*italic*');
    expect(stored).toContain('`code`');
    expect(stored).toContain('- a list item');
    expect(stored).toContain('> a quote');
    expect(stored).toContain('[VUNVAULT](https://www.vunvault.com)');
    // The label survives, the payload does not.
    expect(stored).toContain('x');
    expect(response.body).not.toContain('alert(1)</script>');
  });

  it('audits a draft save at most once a minute', async () => {
    const created = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/studio/drafts',
      payload: { title: 'Quiet typing', tags: [] },
    });
    const id = (created.json() as { data: { id: string } }).data.id;

    for (let save = 0; save < 4; save += 1) {
      const response = await harness.app.inject({
        method: 'PUT',
        url: `/api/v1/studio/drafts/${id}`,
        payload: { title: `Quiet typing ${save}`, tags: [] },
      });
      expect(response.statusCode).toBe(200);
    }
    expect(
      harness.audits.filter((audit) => audit.eventType === 'CONTENT_DRAFT_SAVED'),
    ).toHaveLength(1);
  });

  it('refuses to edit a submitted item, and refuses another author’s draft', async () => {
    harness.repo.items.push(row({ id: DRAFT_ID, status: 'pending_review', title: 'Submitted' }));
    const submitted = await harness.app.inject({
      method: 'PUT',
      url: `/api/v1/studio/drafts/${DRAFT_ID}`,
      payload: { title: 'Rewritten after submission', tags: [] },
    });
    expect(submitted.statusCode).toBe(409);
    expect(submitted.json()).toMatchObject({ error: 'not_editable' });

    harness.repo.items.push(
      row({ id: 'e1000000-0000-4000-8000-0000000000d2', authorId: OTHER_AUTHOR_ID }),
    );
    const foreign = await harness.app.inject({
      method: 'PUT',
      url: '/api/v1/studio/drafts/e1000000-0000-4000-8000-0000000000d2',
      payload: { title: 'Not mine', tags: [] },
    });
    // Somebody else's draft does not exist for this author.
    expect(foreign.statusCode).toBe(404);
  });

  it('deletes only its own drafts', async () => {
    harness.repo.items.push(row({ id: DRAFT_ID }));
    const mine = await harness.app.inject({
      method: 'DELETE',
      url: `/api/v1/studio/drafts/${DRAFT_ID}`,
    });
    expect(mine.statusCode).toBe(204);
    expect(harness.repo.items).toHaveLength(0);

    harness.repo.items.push(row({ id: DRAFT_ID, status: 'approved' }));
    const notADraft = await harness.app.inject({
      method: 'DELETE',
      url: `/api/v1/studio/drafts/${DRAFT_ID}`,
    });
    expect(notADraft.statusCode).toBe(409);
  });
});

// ------------------------------------------------------------------ submit

describe('submitting for moderation', () => {
  function seedDraft(bodyWords: number) {
    harness.repo.items.push(
      row({
        id: DRAFT_ID,
        title: 'A complete post',
        category: 'threat_intel',
        bodyMd: words(bodyWords),
      }),
    );
  }

  it('refuses 149 words and accepts 150', async () => {
    seedDraft(STUDIO_LIMITS.minWords - 1);
    const short = await harness.app.inject({
      method: 'POST',
      url: `/api/v1/studio/drafts/${DRAFT_ID}/submit`,
    });
    expect(short.statusCode).toBe(422);
    const body = short.json() as { error: string; details: Array<Record<string, boolean>> };
    expect(body.error).toBe('not_ready');
    expect(body.details[0]).toMatchObject({ title: true, category: true, bodyWords: false });
    expect((harness.repo.items[0] as ContentItemRow).status).toBe('draft');

    (harness.repo.items[0] as ContentItemRow).bodyMd = words(STUDIO_LIMITS.minWords);
    const long = await harness.app.inject({
      method: 'POST',
      url: `/api/v1/studio/drafts/${DRAFT_ID}/submit`,
    });
    expect(long.statusCode).toBe(200);
    expect((long.json() as { data: { status: string } }).data.status).toBe('pending_review');
    expect((harness.repo.items[0] as ContentItemRow).submittedAt).not.toBeNull();
    expect(harness.audits.map((audit) => audit.eventType)).toEqual(['CONTENT_SUBMITTED']);
    // Moderators are told through their own notification preferences.
    expect(harness.notifications).toEqual([
      { userId: MODERATOR_ID, title: 'A post is waiting for moderation' },
    ]);
  });

  it('computes reading time at two hundred words a minute, never below one', () => {
    expect(readinessFor(row({ bodyMd: words(200), title: 'x', category: 'blog' })).bodyWords).toBe(
      true,
    );
    expect(readinessFor(row({ bodyMd: words(149) })).bodyWords).toBe(false);
    expect(readinessFor(row({ bodyMd: words(150) })).bodyWords).toBe(true);
  });

  it('shows the reviewer’s note on a returned item', async () => {
    harness.repo.items.push(row({ id: DRAFT_ID, status: 'changes_requested', title: 'Sent back' }));
    harness.repo.reviews.push({
      itemId: DRAFT_ID,
      reviewerId: MODERATOR_ID,
      action: 'request_changes',
      note: 'Two claims need a source.',
    });
    const response = await harness.app.inject({ method: 'GET', url: '/api/v1/studio/submissions' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: Array<{ reviewerNote: string | null }> };
    expect(body.data[0]?.reviewerNote).toBe('Two claims need a source.');
  });
});

// ------------------------------------------------------------------ images

describe('POST /api/v1/studio/images/upload-url', () => {
  it('presigns a PUT under the author’s own prefix', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/studio/images/upload-url',
      payload: { contentType: 'image/png', sizeBytes: 500_000 },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      data: { uploadUrl: string; objectKey: string; publicUrl: string; expiresAt: string };
    };
    expect(body.data.objectKey).toMatch(new RegExp(`^studio/${BLOGGER_ID}/[0-9a-f-]{36}\\.png$`));
    expect(body.data.publicUrl).toContain('https://');
    expect(new Date(body.data.expiresAt).toISOString()).toBe(body.data.expiresAt);
    expect(harness.storage.presigned[0]).toMatchObject({
      contentType: 'image/png',
      maxBytes: STUDIO_LIMITS.imageMaxBytes,
    });
  });

  it('refuses a format that is not an image, and one over five megabytes', async () => {
    const notAnImage = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/studio/images/upload-url',
      payload: { contentType: 'application/pdf', sizeBytes: 1000 },
    });
    expect(notAnImage.statusCode).toBe(400);

    const tooBig = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/studio/images/upload-url',
      payload: { contentType: 'image/png', sizeBytes: STUDIO_LIMITS.imageMaxBytes + 1 },
    });
    expect(tooBig.statusCode).toBe(400);
  });
});

// ------------------------------------------------------- sanitiser and slug

describe('sanitiseMarkdown', () => {
  it('neutralises the catalogue’s example', () => {
    const output = sanitiseMarkdown('<script>alert(1)</script>[x](javascript:alert(1))');
    expect(output).not.toContain('<script');
    expect(output).not.toContain('javascript:');
    expect(output).toContain('x');
  });

  it('refuses every non-web scheme and every encoding of one', () => {
    for (const target of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      'java\tscript:alert(1)',
      'data:text/html;base64,PHNjcmlwdD4=',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      '%6a%61%76%61%73%63%72%69%70%74:alert(1)',
    ]) {
      expect(isSafeLinkTarget(target), target).toBe(false);
    }
    for (const target of [
      'https://www.vunvault.com',
      'http://example.test/a?b=c#d',
      '/blog/a-post',
      '#section',
      'mailto:editor@vunvault.com',
    ]) {
      expect(isSafeLinkTarget(target), target).toBe(true);
    }
  });

  it('strips comments, iframes and style blocks with their contents', () => {
    const output = sanitiseMarkdown(
      'before <!-- hidden --> after <iframe src="https://evil.test"></iframe> done <style>body{}</style> end',
    );
    expect(output).not.toContain('hidden');
    expect(output).not.toContain('<iframe');
    expect(output).not.toContain('body{}');
    expect(output).toContain('before');
    expect(output).toContain('done');
  });

  it('normalises tags', () => {
    expect(normaliseTags(['#Security', 'security', 'AFRICA ', ''])).toEqual(['security', 'africa']);
    expect(normaliseTags(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'])).toHaveLength(8);
  });
});

describe('slugify', () => {
  it('makes a URL-safe slug and keeps the words', () => {
    expect(slugify('Kenya’s State House Cyber Audit!')).toBe('kenyas-state-house-cyber-audit');
    expect(slugify('  Multiple   spaces & symbols  ')).toBe('multiple-spaces-symbols');
    expect(slugify('Café Société')).toBe('cafe-societe');
    expect(slugify('###')).toBe('');
  });

  it('builds the -2, -3 sequence', () => {
    expect(nextSlugCandidate('a-post', 1)).toBe('a-post');
    expect(nextSlugCandidate('a-post', 2)).toBe('a-post-2');
    expect(nextSlugCandidate('a-post', 3)).toBe('a-post-3');
    expect(blogSlugPath(nextSlugCandidate('a-post', 2))).toBe('/blog/a-post-2');
  });
});

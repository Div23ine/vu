import { http, HttpResponse } from 'msw';
import {
  countWords,
  isReadyToSubmit,
  readMinutes,
  StudioDraftBody,
  StudioImageUploadRequest,
  StudioItem,
  type StudioSubmitReadiness,
  type StudioStatus,
  STUDIO_LIMITS,
} from '@vunvault/contracts';
import { clientProfile } from '@vunvault/contracts/fixtures/profile';

/**
 * Content Studio mock handlers (Tasks 71 + 72).
 *
 * Used ONLY by tests (through `mocks/server.ts`) and the opt-in dev mock
 * mode. The standing state is the fixture client (Jane Wanjiru) WITH the
 * Verified-Blogger badge; the denied-path test overrides `GET /studio/status`
 * through `server.use` — the badge is a server-side grant, so no mock here
 * may flip it from browser state.
 *
 * The submissions list has no contract fixture (Task 20d's fixture set
 * predates the client studio view), so the mock synthesises a deterministic
 * seed covering every content status — schema-checked with `StudioItem.parse`
 * so mock and contract cannot drift. Two entries carry reviewer notes
 * (changes_requested + rejected) and the first draft has a `null` title (the
 * table's `Untitled article` fallback).
 *
 * Task 72 adds the draft lifecycle on a mutable copy of the seed: create /
 * update (409 `not_editable` once submitted), delete, submit with the real
 * readiness gate (422 `not_ready` carrying the six booleans in `details[0]`,
 * exactly the API's envelope) and the presigned image-upload URL. Tests reset
 * the mutable state through `resetStudioDrafts()`.
 *
 * API contract mirrored here (implemented for real in `apps/api`, Task 36):
 *   GET    /api/v1/studio/status                → 200 { data: StudioStatus }
 *   GET    /api/v1/studio/submissions           → 200 { data: StudioItem[]; total } | 403 badge_required
 *   POST   /api/v1/studio/drafts                → 201 { data: StudioItem }
 *   PUT    /api/v1/studio/drafts/:id            → 200 { data: StudioItem } | 409 not_editable
 *   DELETE /api/v1/studio/drafts/:id            → 204
 *   POST   /api/v1/studio/drafts/:id/submit     → 200 { data: StudioItem } | 422 not_ready
 *   POST   /api/v1/studio/images/upload-url     → 200 { data: { uploadUrl; objectKey; publicUrl; expiresAt } }
 */

export const studioStatus: StudioStatus = {
  verified: true,
  verifiedAt: '2026-03-14T09:00:00.000Z',
  displayName: clientProfile.fullName,
};

const READINESS_FULL = {
  title: true,
  category: true,
  bodyWords: true,
  excerpt: true,
  featuredImage: true,
  tags: true,
} as const;

export const studioSeed: StudioItem[] = [
  StudioItem.parse({
    id: '570d1000-0000-4000-8000-000000000001',
    title: null,
    slugPath: null,
    category: null,
    excerpt: null,
    bodyMd: null,
    tags: [],
    featuredImageUrl: null,
    imageAlt: null,
    status: 'draft',
    readiness: { ...READINESS_FULL, title: false, category: false, bodyWords: false },
    readMinutes: null,
    updatedAt: '2026-10-06T10:12:00.000Z',
    reviewerNote: null,
  }),
  StudioItem.parse({
    id: '570d1000-0000-4000-8000-000000000002',
    title: 'Threat intel roundup: October 2026',
    slugPath: 'threat-intel-roundup-october-2026',
    category: 'threat_intel',
    excerpt: 'The month in East African threat intelligence, in five minutes.',
    bodyMd: 'Draft body copy for the October roundup.',
    tags: ['threatintel', 'africa'],
    featuredImageUrl: null,
    imageAlt: null,
    status: 'pending_review',
    readiness: READINESS_FULL,
    readMinutes: 5,
    updatedAt: '2026-10-05T15:40:00.000Z',
    reviewerNote: null,
  }),
  StudioItem.parse({
    id: '570d1000-0000-4000-8000-000000000003',
    title: 'Inside the new data protection act',
    slugPath: 'inside-the-new-data-protection-act',
    category: 'news',
    excerpt: 'What the amendment changes for fintech compliance teams.',
    bodyMd: 'Draft body copy for the data protection act piece.',
    tags: ['compliance', 'fintech'],
    featuredImageUrl: null,
    imageAlt: null,
    status: 'changes_requested',
    readiness: READINESS_FULL,
    readMinutes: 8,
    updatedAt: '2026-10-04T09:05:00.000Z',
    reviewerNote: 'Add the regulator’s published guidance links and re-check the penalty figures.',
  }),
  StudioItem.parse({
    id: '570d1000-0000-4000-8000-000000000004',
    title: 'Why SMS 2FA is still shipping',
    slugPath: 'why-sms-2fa-is-still-shipping',
    category: 'blog',
    excerpt: 'A second look at the cheapest second factor.',
    bodyMd: 'Draft body copy for the SMS 2FA piece.',
    tags: ['security'],
    featuredImageUrl: null,
    imageAlt: null,
    status: 'rejected',
    readiness: READINESS_FULL,
    readMinutes: 6,
    updatedAt: '2026-10-02T11:30:00.000Z',
    reviewerNote: 'Too close to the piece published in August — rework the angle or cite new data.',
  }),
  StudioItem.parse({
    id: '570d1000-0000-4000-8000-000000000005',
    title: 'Container escape patterns in CI pipelines',
    slugPath: 'container-escape-patterns-in-ci-pipelines',
    category: 'tutorials',
    excerpt: 'Hands-on patterns for hardening build agents.',
    bodyMd: 'Draft body copy for the container escape tutorial.',
    tags: ['research', 'security'],
    featuredImageUrl: null,
    imageAlt: null,
    status: 'approved',
    readiness: READINESS_FULL,
    readMinutes: 12,
    updatedAt: '2026-10-01T08:00:00.000Z',
    reviewerNote: null,
  }),
  StudioItem.parse({
    id: '570d1000-0000-4000-8000-000000000006',
    title: 'The state of phishing in Kenyan banking',
    slugPath: 'the-state-of-phishing-in-kenyan-banking',
    category: 'news',
    excerpt: 'Smishing volumes, mule networks and what banks shipped this year.',
    bodyMd: 'Published body copy for the phishing piece.',
    tags: ['fintech', 'africa'],
    featuredImageUrl: null,
    imageAlt: null,
    status: 'published',
    readiness: READINESS_FULL,
    readMinutes: 9,
    updatedAt: '2026-09-28T14:20:00.000Z',
    reviewerNote: null,
  }),
  StudioItem.parse({
    id: '570d1000-0000-4000-8000-000000000007',
    title: 'Post-quantum readiness checklist',
    slugPath: 'post-quantum-readiness-checklist',
    category: 'industry_updates',
    excerpt: 'A practical checklist for the migration decade.',
    bodyMd: 'Scheduled body copy for the post-quantum checklist.',
    tags: ['research', 'compliance'],
    featuredImageUrl: null,
    imageAlt: null,
    status: 'scheduled',
    readiness: READINESS_FULL,
    readMinutes: 7,
    updatedAt: '2026-09-25T16:45:00.000Z',
    reviewerNote: null,
  }),
];

/** Mutable working list: the seed plus everything the draft routes create. */
let studioItems: StudioItem[] = studioSeed.map((item) => ({ ...item }));
let draftCounter = 0;
let imageCounter = 0;

/** Restore the seed state (tests call this in `beforeEach`). */
export function resetStudioDrafts(): void {
  studioItems = studioSeed.map((item) => ({ ...item }));
  draftCounter = 0;
  imageCounter = 0;
}

/** The API's `readinessFor`, mirrored so the mock gate cannot drift. */
function readinessFor(item: {
  title: string | null;
  category: string | null;
  bodyMd: string | null;
  excerpt: string | null;
  featuredImageUrl: string | null;
  tags: string[];
}): StudioSubmitReadiness {
  return {
    title: (item.title ?? '').trim() !== '',
    category: item.category !== null,
    bodyWords: countWords(item.bodyMd ?? '') >= STUDIO_LIMITS.minWords,
    excerpt: (item.excerpt ?? '').trim() !== '',
    featuredImage: item.featuredImageUrl !== null,
    tags: item.tags.length >= 2,
  };
}

function withComputed(item: StudioItem): StudioItem {
  const body = item.bodyMd ?? '';
  return {
    ...item,
    readiness: readinessFor(item),
    readMinutes: body.trim() === '' ? null : readMinutes(body),
    updatedAt: new Date().toISOString(),
  };
}

const EDITABLE = new Set(['draft', 'changes_requested']);

export const studioHandlers = [
  http.get('*/api/v1/studio/status', () => HttpResponse.json({ data: studioStatus })),

  http.get('*/api/v1/studio/submissions', () =>
    HttpResponse.json({ data: studioItems, total: studioItems.length }),
  ),

  http.post('*/api/v1/studio/drafts', async ({ request }) => {
    const body = StudioDraftBody.parse(await request.json());
    draftCounter += 1;
    const id = `570d1000-0000-4000-8000-0000000f${(0x1000 + draftCounter)
      .toString(16)
      .padStart(4, '0')}`;
    const item = withComputed(
      StudioItem.parse({
        id,
        title: body.title ?? null,
        slugPath: body.slug ?? null,
        category: body.category ?? null,
        excerpt: body.excerpt ?? null,
        bodyMd: body.bodyMd ?? null,
        tags: body.tags,
        featuredImageUrl: body.featuredImageUrl ?? null,
        imageAlt: body.imageAlt ?? null,
        status: 'draft',
        readiness: READINESS_FULL,
        readMinutes: null,
        updatedAt: new Date().toISOString(),
        reviewerNote: null,
      }),
    );
    studioItems = [item, ...studioItems];
    return HttpResponse.json({ data: item }, { status: 201 });
  }),

  http.put('*/api/v1/studio/drafts/:id', async ({ params, request }) => {
    const body = StudioDraftBody.parse(await request.json());
    const id = String(params.id);
    const existing = studioItems.find((item) => item.id === id);
    if (existing === undefined) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (!EDITABLE.has(existing.status)) {
      return HttpResponse.json({ error: 'not_editable' }, { status: 409 });
    }
    const updated = withComputed({
      ...existing,
      title: body.title ?? null,
      slugPath: body.slug ?? existing.slugPath,
      category: body.category ?? null,
      excerpt: body.excerpt ?? null,
      bodyMd: body.bodyMd ?? null,
      tags: body.tags,
      featuredImageUrl: body.featuredImageUrl ?? null,
      imageAlt: body.imageAlt ?? null,
    });
    studioItems = studioItems.map((item) => (item.id === id ? updated : item));
    return HttpResponse.json({ data: updated });
  }),

  http.delete('*/api/v1/studio/drafts/:id', ({ params }) => {
    const id = String(params.id);
    const existing = studioItems.find((item) => item.id === id);
    if (existing === undefined) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (!EDITABLE.has(existing.status)) {
      return HttpResponse.json({ error: 'not_editable' }, { status: 409 });
    }
    studioItems = studioItems.filter((item) => item.id !== id);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('*/api/v1/studio/drafts/:id/submit', ({ params }) => {
    const id = String(params.id);
    const existing = studioItems.find((item) => item.id === id);
    if (existing === undefined) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (!EDITABLE.has(existing.status)) {
      return HttpResponse.json({ error: 'invalid_transition' }, { status: 409 });
    }
    const readiness = readinessFor(existing);
    if (!isReadyToSubmit(readiness)) {
      // The API's envelope: `details` is an array whose only member is the
      // six-boolean readiness object the checklist highlights.
      return HttpResponse.json(
        {
          error: 'not_ready',
          message: 'Finish the required fields before submitting',
          details: [readiness],
        },
        { status: 422 },
      );
    }
    const submitted = withComputed({ ...existing, status: 'pending_review' });
    studioItems = studioItems.map((item) => (item.id === id ? submitted : item));
    return HttpResponse.json({ data: submitted });
  }),

  http.post('*/api/v1/studio/images/upload-url', async ({ request }) => {
    const body = StudioImageUploadRequest.parse(await request.json());
    imageCounter += 1;
    const extension = body.contentType.split('/')[1] ?? 'bin';
    const objectKey = `studio/uploads/cover-${imageCounter}.${extension}`;
    return HttpResponse.json({
      data: {
        uploadUrl: `https://r2.vunvault.test/signed/${objectKey}`,
        objectKey,
        publicUrl: `https://cdn.vunvault.test/${objectKey}`,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    });
  }),
];

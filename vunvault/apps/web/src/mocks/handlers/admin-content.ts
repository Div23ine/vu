import { http, HttpResponse } from 'msw';
import type { ContentReviewAction, ModerationItem } from '@vunvault/contracts';
// Imported as a value: the mock validates every action body with the contract's
// own schema, so the note floor and the schedule rule cannot drift.
import { ModerationActionBody } from '@vunvault/contracts';
import { moderationItems, moderationSummary } from '@vunvault/contracts/fixtures/content';

/**
 * Admin content-moderation mock handlers (Task 83).
 *
 * Used ONLY by tests (through `mocks/server.ts`) and the opt-in dev mock mode.
 * The Task 20 fixtures ARE the queue (ten items across every review state and
 * flag combination) and the summary; the list endpoint applies the real filter
 * semantics (`q` over title, slug path, author name and team; exact `type` /
 * `status`; `flag`, where the contract's `"none"` means "no flags at all";
 * `page` / `pageSize` slicing) so the URL-driven toolbar is exercised end to end.
 *
 * Writes go through a real transition table, which is what makes
 * `409 invalid_transition` reachable from a test rather than a stub: an
 * approved item can publish or schedule, a rejected one cannot move at all.
 * The role-dependent refusals (`403 legal_review_required`,
 * `409 own_submission`) need the caller's identity, which a mock handler cannot
 * see, so tests install those with `server.use(...)` — the per-test override
 * pattern `vitest.setup.ts` documents.
 *
 * API contract mirrored here (implemented for real in `apps/api`, Task 36):
 *   GET  /api/v1/admin/content?…          → 200 { data: ModerationItem[]; total }
 *   GET  /api/v1/admin/content/summary    → 200 { data: ModerationSummary }
 *   POST /api/v1/admin/content/:id/actions → 200 { data: ModerationItem }
 *        | 400 validation_failed | 403 legal_review_required
 *        | 409 own_submission | 409 invalid_transition
 */

let items: ModerationItem[] = moderationItems.map((item) => ({ ...item }));

/** Restore the fixture queue (tests call this in `beforeEach`). */
export function resetAdminContent(): void {
  items = moderationItems.map((item) => ({ ...item }));
}

/**
 * The state machine the API enforces. `remind_author` is deliberately absent
 * from the value sets: it never moves an item, so it is allowed from any state.
 */
const TRANSITIONS: Record<ModerationItem['status'], Partial<Record<ContentReviewAction, ModerationItem['status']>>> =
  {
    draft: { approve: 'approved', request_changes: 'changes_requested', reject: 'rejected' },
    pending_review: {
      approve: 'approved',
      request_changes: 'changes_requested',
      reject: 'rejected',
    },
    in_review: {
      approve: 'approved',
      request_changes: 'changes_requested',
      reject: 'rejected',
    },
    changes_requested: {
      approve: 'approved',
      request_changes: 'changes_requested',
      reject: 'rejected',
    },
    approved: { publish: 'published', schedule: 'scheduled', reject: 'rejected' },
    rejected: {},
    scheduled: { publish: 'published' },
    published: {},
  };

function matches(item: ModerationItem, params: URLSearchParams): boolean {
  const q = (params.get('q') ?? '').trim().toLowerCase();
  if (q !== '') {
    const haystack = [item.title, item.summary ?? '', item.slugPath, item.author.fullName]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  const type = params.get('type');
  if (type !== null && type !== '' && item.type !== type) return false;
  const status = params.get('status');
  if (status !== null && status !== '' && item.status !== status) return false;
  const flag = params.get('flag');
  if (flag === 'none' && item.riskFlags.length !== 0) return false;
  if (flag !== null && flag !== '' && flag !== 'none' && !item.riskFlags.includes(flag as never)) {
    return false;
  }
  return true;
}

export const adminContentHandlers = [
  // Literal path FIRST: MSW matches in registration order, so `/summary` must
  // not be reachable as `/:id`.
  http.get('*/api/v1/admin/content/summary', () =>
    HttpResponse.json({ data: moderationSummary }),
  ),

  http.get('*/api/v1/admin/content', ({ request }) => {
    const params = new URL(request.url).searchParams;
    const filtered = items.filter((item) => matches(item, params));
    const page = Math.max(1, Number(params.get('page') ?? '1'));
    const pageSize = Math.min(100, Math.max(1, Number(params.get('pageSize') ?? '10')));
    const start = (page - 1) * pageSize;
    return HttpResponse.json({
      data: filtered.slice(start, start + pageSize),
      total: filtered.length,
    });
  }),

  http.post('*/api/v1/admin/content/:id/actions', async ({ params, request }) => {
    const id = String(params.id);
    const item = items.find((candidate) => candidate.id === id);
    if (item === undefined) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const body = (await request.json()) as {
      action: ContentReviewAction;
      note?: string;
      scheduledFor?: string;
    };
    const parsed = ModerationActionBody.safeParse(body);
    if (!parsed.success) {
      return HttpResponse.json(
        { error: 'validation_failed', details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { action } = parsed.data;
    if (action !== 'remind_author') {
      const next = TRANSITIONS[item.status][action];
      if (next === undefined) {
        return HttpResponse.json({ error: 'invalid_transition' }, { status: 409 });
      }
      const updated: ModerationItem = { ...item, status: next };
      items = items.map((candidate) => (candidate.id === id ? updated : candidate));
      return HttpResponse.json({ data: updated });
    }

    // `remind_author` records the review row and leaves the state alone.
    return HttpResponse.json({ data: item });
  }),
];

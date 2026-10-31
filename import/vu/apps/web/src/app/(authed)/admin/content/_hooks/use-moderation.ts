import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ContentReviewAction,
  ContentStatus,
  ContentType,
  ModerationItem,
  ModerationSummary,
  RiskFlag,
} from '@vunvault/contracts';
import { queryKeys } from '@vunvault/lib';
import { apiGet, apiPost } from '../../../../../lib/api';

/**
 * Content-moderation hooks — the pre-publication review queue built
 * in an earlier iteration: the summary tiles, the filtered queue and the single action
 * endpoint every editorial decision goes through.
 *
 * The key namespace is the canonical `queryKeys.content` , so a
 * decision invalidates `content.all()` and both the queue and the tiles
 * refresh together. The summary key extends that namespace locally because
 * packages/lib has no `content.summary` entry and this task must not add one
 * (the an earlier iteration `SECURITY_STATUS_KEY` precedent).
 *
 * No `'use client'` directive (the directive-free hook-module pattern).
 */

export const MODERATION_SUMMARY_KEY = [...queryKeys.content.all(), 'summary'] as const;

export const MODERATION_PAGE_SIZE = 10;

export interface ModerationFilters {
  q: string;
  type: ContentType | '';
  status: ContentStatus | '';
  /** `"none"` is the contract's own "no risk flags at all" filter. */
  flag: RiskFlag | 'none' | '';
  page: number;
  pageSize: number;
}

function searchOf(filters: ModerationFilters): string {
  const params = new URLSearchParams();
  if (filters.q !== '') params.set('q', filters.q);
  if (filters.type !== '') params.set('type', filters.type);
  if (filters.status !== '') params.set('status', filters.status);
  if (filters.flag !== '') params.set('flag', filters.flag);
  params.set('page', String(filters.page));
  params.set('pageSize', String(filters.pageSize));
  return params.toString();
}

export function useModerationSummary() {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/admin/content/summary → 200 { data: ModerationSummary }
    queryKey: MODERATION_SUMMARY_KEY,
    queryFn: () =>
      apiGet<{ data: ModerationSummary }>('/api/v1/admin/content/summary').then(
        (response) => response.data,
      ),
  });
}

export function useModerationQueue(filters: ModerationFilters) {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/admin/content?type=&status=&flag=&q=&page=&pageSize=
    //  → 200 { data: ModerationItem[]; total }
    queryKey: queryKeys.content.moderation(filters),
    queryFn: () =>
      apiGet<{ data: ModerationItem[]; total: number }>(
        `/api/v1/admin/content?${searchOf(filters)}`,
      ),
  });
}

/** The aside panels need the WHOLE queue, not the filtered page on screen. */
const SNAPSHOT_FILTERS: ModerationFilters = {
  q: '',
  type: '',
  status: '',
  flag: '',
  page: 1,
  pageSize: 100,
};

export interface QueueSnapshot {
  inReview: number;
  pendingByType: Record<ContentType, number>;
  pendingTotal: number;
  /** Whole hours the oldest waiting item has been in the queue. */
  oldestWaitingHours: number | null;
}

/**
 * Derive the aside's snapshot figures from the unfiltered queue.
 *
 * `ModerationSummary` carries no in-review count and no oldest-item age, and
 * there is no per-type breakdown endpoint, so both are computed from the rows
 * the API already returns rather than hardcoded (the an earlier iteration rule).
 */
export function snapshotOf(items: readonly ModerationItem[], now: Date): QueueSnapshot {
  const pendingByType: Record<ContentType, number> = {
    blog_post: 0,
    news_announcement: 0,
    threat_advisory: 0,
    product_listing: 0,
  };
  let oldest: number | null = null;
  let inReview = 0;

  for (const item of items) {
    if (item.status === 'in_review') inReview += 1;
    if (item.status !== 'pending_review') continue;
    pendingByType[item.type] += 1;
    const ageHours = (now.getTime() - new Date(item.submittedAt).getTime()) / 3_600_000;
    if (oldest === null || ageHours > oldest) oldest = ageHours;
  }

  return {
    inReview,
    pendingByType,
    pendingTotal: Object.values(pendingByType).reduce((sum, value) => sum + value, 0),
    oldestWaitingHours: oldest === null ? null : Math.round(oldest),
  };
}

export function useQueueSnapshot() {
  const queue = useModerationQueue(SNAPSHOT_FILTERS);
  return {
    ...queue,
    snapshot: snapshotOf(queue.data?.data ?? [], new Date()),
  };
}

export interface ModerationActionInput {
  id: string;
  action: ContentReviewAction;
  /** Required by the contract for `reject` and `request_changes` (min 10). */
  note?: string;
  /** Required by the contract for `schedule`. */
  scheduledFor?: string;
}

export function useModerationAction() {
  const queryClient = useQueryClient();
  return useMutation({
    // TODO(backend-contract): POST /api/v1/admin/content/:id/actions
    //  body { action; note?; scheduledFor? } → 200 { data: ModerationItem }
    //  | 403 legal_review_required | 409 own_submission | 409 invalid_transition
    mutationFn: ({ id, ...body }: ModerationActionInput) =>
      apiPost<{ data: ModerationItem }>(`/api/v1/admin/content/${id}/actions`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.content.all() });
    },
  });
}

/**
 * The bulk `Approve All Flag-Free` targets: pending items with no risk flags
 * that the caller did NOT author (the API refuses `own_submission`, so the UI
 * skips those rather than collecting a wall of 409s).
 */
export function bulkApproveTargets(
  items: readonly ModerationItem[],
  currentUserId: string | null,
): ModerationItem[] {
  return items.filter(
    (item) =>
      item.status === 'pending_review' &&
      item.riskFlags.length === 0 &&
      item.author.id !== currentUserId,
  );
}

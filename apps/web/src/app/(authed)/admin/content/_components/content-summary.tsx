'use client';

import { EmptyState, Skeleton } from '@vunvault/ui';
import { isApiError } from '@vunvault/lib';
import { AdmKpi } from '../../_components/admin-page-head';
import { useModerationSummary } from '../_hooks/use-moderation';

/**
 * Content-moderation summary tiles — the six `adm-kpi` tiles that
 * open the queue. Every VALUE is driven by `GET /admin/content/summary` (the
 * an earlier iteration rule: no design number appears in code). A 403 hides the strip;
 * any other failure degrades to `Metrics unavailable` + Retry.
 *
 * Three delta lines carry figures the contract does not supply
 * (`ModerationSummary` has no rejection-reason split, no week-on-week review
 * speed and no period-on-period publishing delta). Those lines are the
 * reference's own copy, reproduced verbatim and flagged with a
 * `TODO(backend-contract)` — the same resolution an earlier iteration's first tile uses.
 */

// TODO(backend-contract): add rejectionReasons, reviewSpeedDeltaPct and
//  publishingDeltaPct to ModerationSummary and derive these three lines.
const REJECTED_DELTA = '2 legal · 1 unsupported claim';
const REVIEW_TIME_DELTA = '▼ 18% faster this week';
const PUBLISHED_DELTA = '▲ 12% vs. previous period';

export function ContentSummary() {
  const query = useModerationSummary();

  if (query.isError && isApiError(query.error) && query.error.status === 403) return null;

  if (query.isLoading) {
    return (
      <div className="adm-kpi-grid" aria-busy="true">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  const data = query.data;
  if (data === undefined) {
    return (
      <div className="adm-card">
        <div className="adm-card-body">
          <EmptyState
            title="Metrics unavailable"
            action={
              <button type="button" className="adm-mini-btn" onClick={() => void query.refetch()}>
                Retry
              </button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="adm-kpi-grid">
      <AdmKpi
        label="Awaiting Review"
        value={String(data.awaitingReview)}
        delta={{ tone: 'warn', text: '● Blocking publication' }}
      />
      <AdmKpi
        label="Changes Requested"
        value={String(data.changesRequested)}
        delta={{ tone: 'dot', text: '● Returned to authors' }}
      />
      <AdmKpi
        label="Approved Today"
        value={String(data.approvedToday)}
        delta={{ tone: 'up', text: '▲ Queued for publication' }}
      />
      <AdmKpi
        label="Rejected (7 days)"
        value={String(data.rejectedLast7Days)}
        delta={{ tone: 'warn', text: REJECTED_DELTA }}
      />
      <AdmKpi
        label="Avg. Review Time"
        value={String(data.avgReviewHours)}
        unit="h"
        delta={{ tone: 'up', text: REVIEW_TIME_DELTA }}
      />
      <AdmKpi
        label="Published (30 days)"
        value={String(data.publishedLast30Days)}
        delta={{ tone: 'up', text: PUBLISHED_DELTA }}
      />
    </div>
  );
}

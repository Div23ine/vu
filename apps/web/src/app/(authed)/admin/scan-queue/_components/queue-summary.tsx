'use client';

import { EmptyState, Skeleton } from '@vunvault/ui';
import { AdmKpi } from '../../_components/admin-page-head';
import { isForbidden } from '../../_dashboard/use-dashboard';
import { useScanQueueSummary } from '../_hooks/use-scan-queue';
import '../_styles/scan-queue.css';

/**
 * Queue summary tiles — the six KPI tiles above the toolbar, all
 * fixture/API-driven (`GET /admin/scans/summary`). Labels and delta copy are
 * verbatim from the reference markup. A 403 hides the strip; any other
 * failure degrades to `Metrics unavailable` + Retry (the an earlier iteration pattern).
 */

export function QueueSummary() {
  const summary = useScanQueueSummary();

  if (summary.isError && isForbidden(summary.error)) return null;

  if (summary.isLoading) {
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

  const data = summary.data;
  if (data === undefined) {
    return (
      <div className="adm-card">
        <div className="adm-card-body">
          <EmptyState
            title="Metrics unavailable"
            action={
              <button type="button" className="adm-mini-btn" onClick={() => void summary.refetch()}>
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
        label="Jobs In Queue"
        value={String(data.jobsInQueue)}
        delta={{ tone: 'up', text: `▲ ${data.addedToday} added today` }}
      />
      <AdmKpi
        label="Running Scans"
        value={String(data.runningScans)}
        delta={{
          tone: 'dot',
          text: `● ${data.workerSlotsUsed} of ${data.workerSlotsTotal} worker slots`,
        }}
      />
      <AdmKpi
        label="Awaiting Admin Review"
        value={String(data.awaitingAdminReview)}
        delta={{ tone: 'dot', text: '● Client release blocked' }}
      />
      <AdmKpi
        label="Approved & Released"
        value={data.approvedReleased.toLocaleString('en-US')}
        delta={{ tone: 'up', text: `▲ ${data.releasedThisWeek} released this week` }}
      />
      <AdmKpi
        label="Payment Outstanding"
        value={String(data.paymentOutstanding)}
        delta={{ tone: 'warn', text: `▲ ${data.overdueOver14Days} overdue > 14 days` }}
      />
      <AdmKpi
        label="Held / Rejected"
        value={String(data.heldRejected)}
        delta={{ tone: 'dot', text: '● Pending remediation' }}
      />
    </div>
  );
}

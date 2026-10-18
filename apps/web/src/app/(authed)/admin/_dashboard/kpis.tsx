'use client';

import type { DashboardKpis } from '@vunvault/contracts';
import { formatUsd } from '@vunvault/lib';
import { EmptyState, Skeleton } from '@vunvault/ui';
import { AdmKpi } from '../_components/admin-page-head';
import { formatCount, isForbidden, useDashboardSection } from './use-dashboard';
import './dashboard.css';

/**
 * KPI strip — the six tiles that open the Command Center, every
 * value API-driven (no design number appears in code). A 403 hides the
 * strip; any other failure degrades to `Metrics unavailable` + Retry.
 */

export function Kpis() {
  const kpis = useDashboardSection<DashboardKpis>('kpis', 'kpis');

  if (kpis.isError && isForbidden(kpis.error)) return null;

  if (kpis.isLoading) {
    return (
      <section aria-labelledby="adm-kpi-heading">
        <h2 id="adm-kpi-heading" className="sr-only">
          Key performance indicators
        </h2>
        <div className="adm-kpi-grid" aria-busy="true">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </section>
    );
  }

  const data = kpis.data;
  if (data === undefined) {
    return (
      <section aria-labelledby="adm-kpi-heading">
        <h2 id="adm-kpi-heading" className="sr-only">
          Key performance indicators
        </h2>
        <div className="adm-card">
          <div className="adm-card-body">
            <EmptyState
              title="Metrics unavailable"
              action={
                <button type="button" className="adm-mini-btn" onClick={() => void kpis.refetch()}>
                  Retry
                </button>
              }
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="adm-kpi-heading">
      <h2 id="adm-kpi-heading" className="sr-only">
        Key performance indicators
      </h2>
      <div className="adm-kpi-grid">
        <AdmKpi
          label="Total Paid Clients"
          value={formatCount(data.totalPaidClients)}
          delta={{ tone: 'up', text: `▲ ${data.newPaidClientsThisMonth} new this month` }}
        />
        <AdmKpi
          label="Total Revenue"
          value={formatUsd(data.totalRevenueUsdCents)}
          delta={{
            tone: 'up',
            text: `▲ ${data.revenueChangeVsLastQuarterPercent}% vs. last quarter`,
          }}
        />
        <AdmKpi
          label="Completed Jobs"
          value={formatCount(data.completedJobs)}
          delta={{ tone: 'up', text: `▲ ${data.closedThisWeek} closed this week` }}
        />
        <AdmKpi
          label="Pending Review"
          value={formatCount(data.pendingReview)}
          delta={{ tone: 'dot', text: '● Awaiting mandatory admin review' }}
        />
        <AdmKpi
          label="Active Running Scans"
          value={formatCount(data.activeRunningScans)}
          delta={{
            tone: 'dot',
            text: `● ${data.workerSlotsUsed} of ${data.workerSlotsTotal} worker slots in use`,
          }}
        />
        <AdmKpi
          label="Critical CVEs Tracked"
          value={formatCount(data.criticalCvesTracked)}
          delta={{
            tone: 'warn',
            text: `▲ ${data.unpatchedCritical} unpatched · escalation advised`,
          }}
        />
      </div>
    </section>
  );
}

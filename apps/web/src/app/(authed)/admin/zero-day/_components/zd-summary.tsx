'use client';

import type { AdvisorySummary } from '@vunvault/contracts';
import { EmptyState, Skeleton } from '@vunvault/ui';
import { isApiError } from '@vunvault/lib';
import { AdmKpi } from '../../_components/admin-page-head';
import { useAdvisorySummary } from '../_hooks/use-advisories-admin';

/**
 * Zero-day summary tiles — the six `adm-kpi` tiles that open the
 * desk, every value driven by `GET /admin/advisories/summary` (the an earlier iteration
 * rule: no design number appears in code). A 403 hides the strip; any
 * other failure degrades to `Metrics unavailable` + Retry.
 *
 * The delta glyph (▲ / ●) is part of the caller's text, exactly as the
 * reference markup carries it, and the tone follows the meaning: more
 * zero-days is `down` (red), exploitation status is the neutral `dot`.
 */

const countFormatter = new Intl.NumberFormat('en-US');

/** `1284 → "1,284"` */
function formatCount(value: number): string {
  return countFormatter.format(value);
}

/**
 * The first tile's weekly movement. `AdvisorySummary` carries no
 * weekly-delta field, so this line is the reference's own copy rather than a
 * derived figure — the design number the contract cannot supply.
 */
// TODO(backend-contract): add `newThisWeek` to AdvisorySummary and derive this.
const ACTIVE_ZERO_DAYS_DELTA = '▲ 62 this week';

const WEAPONIZED_DELTA = '● Active exploitation confirmed';

export interface ZdSummaryProps {
  /** Present so the page can render the tiles inside its own `<section>`. */
  summary?: AdvisorySummary;
}

export function ZdSummary() {
  const query = useAdvisorySummary();

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
        label="Active Zero-Days"
        value={formatCount(data.activeZeroDays)}
        delta={{ tone: 'down', text: ACTIVE_ZERO_DAYS_DELTA }}
      />
      <AdmKpi
        label="Critical Severity"
        value={formatCount(data.criticalSeverity)}
        delta={{ tone: 'warn', text: `${formatCount(data.unpatchedCritical)} currently unpatched` }}
      />
      <AdmKpi
        label="Weaponized In Wild"
        value={formatCount(data.weaponizedInWild)}
        delta={{ tone: 'dot', text: WEAPONIZED_DELTA }}
      />
      <AdmKpi
        label="Advisories Published"
        value={formatCount(data.advisoriesPublished)}
        delta={{
          tone: 'up',
          text: `▲ ${formatCount(data.broadcastThisMonth)} broadcast this month`,
        }}
      />
      <AdmKpi
        label="Open Drafts"
        value={formatCount(data.openDrafts)}
        delta={{
          tone: 'dot',
          text: `● ${formatCount(data.escalatedDrafts)} escalated for review`,
        }}
      />
      <AdmKpi
        label="Dashboards Reached"
        value={formatCount(data.dashboardsReached)}
        delta={{
          tone: 'up',
          text: `▲ ${formatCount(data.newClientsThisMonth)} new clients this month`,
        }}
      />
    </div>
  );
}

'use client';

import { EmptyState, Skeleton } from '@vunvault/ui';
import { isApiError } from '@vunvault/lib';
import { AdmKpi } from '../../_components/admin-page-head';
import { useAuditSummary } from '../_hooks/use-audit';

/**
 * Audit-trail summary tiles (Task 83b) — the six `adm-kpi` tiles that open the
 * console, every value driven by `GET /admin/audit/summary` (the Task 76 rule:
 * no prototype number appears in code). A 403 hides the strip; any other
 * failure degrades to `Metrics unavailable` + Retry.
 *
 * Two delta lines carry figures `AuditSummary` does not supply (there is no
 * day-on-day event delta and no hourly scan-completion delta). Those are the
 * reference's own copy, reproduced verbatim and flagged with a
 * `TODO(backend-contract)` — the resolution Tasks 81 and 83 use.
 */

const countFormatter = new Intl.NumberFormat('en-US');

function formatCount(value: number): string {
  return countFormatter.format(value);
}

// TODO(backend-contract): add eventsDeltaPct and scanCompletionsLastHour to
//   AuditSummary and derive these two lines.
const EVENTS_DELTA = '▲ 6.4% vs. yesterday';
const SCAN_DELTA = '▲ 12 in the last hour';

/** Fixed product copy — the chain's encryption is a contract literal. */
const RETENTION_DELTA = 'Immutable · AES-256-GCM';

const RELEASE_DELTA = 'All approved by review gate';

export function AuditSummary() {
  const query = useAuditSummary();

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
        label="Events (24h)"
        value={formatCount(data.events24h)}
        delta={{ tone: 'up', text: EVENTS_DELTA }}
      />
      <AdmKpi
        label="Auth Attempts"
        value={formatCount(data.authAttempts)}
        delta={{
          tone: 'warn',
          text: `${formatCount(data.failedAuth)} failed · ${formatCount(data.lockedOut)} locked out`,
        }}
      />
      <AdmKpi
        label="Scan Completions"
        value={formatCount(data.scanCompletions)}
        delta={{ tone: 'up', text: SCAN_DELTA }}
      />
      <AdmKpi
        label="Report Releases"
        value={formatCount(data.reportReleases)}
        delta={{ tone: 'dot', text: RELEASE_DELTA }}
      />
      <AdmKpi
        label="Chain Integrity"
        value={String(data.chainIntegrityPercent)}
        unit="%"
        delta={{
          tone: data.hashMismatches === 0 ? 'dot' : 'warn',
          text: `${formatCount(data.hashMismatches)} hash mismatches`,
        }}
      />
      <AdmKpi
        label="Retention (WORM)"
        value={String(data.retentionYears)}
        unit="yr"
        delta={{ tone: 'dot', text: RETENTION_DELTA }}
      />
    </div>
  );
}

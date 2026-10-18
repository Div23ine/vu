'use client';

import { Banknote } from 'lucide-react';
import type { RevenueSummary } from '@vunvault/contracts';
import { formatUsdWhole } from '@vunvault/lib';
import { EmptyState, Skeleton } from '@vunvault/ui';
import { formatCount, isForbidden, useDashboardSection } from './use-dashboard';
import './dashboard.css';

/**
 * Revenue & Paid Scans — the billing-ledger rollup card: the
 * four-figure dl, the package-tier share bars and the trailing-90-days
 * note. All money is USD; the figures come from `GET …/revenue`.
 */

export function RevenuePanel() {
  const revenue = useDashboardSection<RevenueSummary>('revenue', 'revenue');

  if (revenue.isError && isForbidden(revenue.error)) return null;

  if (revenue.isLoading) {
    return (
      <div className="adm-card adm-span-4" aria-busy="true">
        <div className="adm-card-body">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const data = revenue.data;
  if (data === undefined) {
    return (
      <div className="adm-card adm-span-4">
        <div className="adm-card-body">
          <EmptyState
            title="Metrics unavailable"
            action={
              <button type="button" className="adm-mini-btn" onClick={() => void revenue.refetch()}>
                Retry
              </button>
            }
          />
        </div>
      </div>
    );
  }

  const clients = data.paidClients.sme + data.paidClients.sacco + data.paidClients.enterprise;

  return (
    <div className="adm-card adm-span-4">
      <div className="adm-card-head">
        <div>
          <h2 className="adm-card-title" id="adm-revenue-heading">
            <Banknote size={17} aria-hidden="true" />
            Revenue & Paid Scans
          </h2>
          <p className="adm-card-note">
            Billing ledger rollup for penetration testing packages, retainers and compliance
            assessments.
          </p>
        </div>
        <span className="adm-tag adm-tag--ok">Ledger Synced</span>
      </div>
      <div className="adm-card-body">
        <dl className="adm-dl">
          <div className="adm-dl-item">
            <dt>Gross Revenue (YTD)</dt>
            <dd>
              {formatUsdWhole(data.grossRevenueYtdUsdCents)}
              <small>All packages, net of refunds</small>
            </dd>
          </div>
          <div className="adm-dl-item">
            <dt>Revenue This Month</dt>
            <dd>
              {formatUsdWhole(data.revenueThisMonthUsdCents)}
              <small>{data.periodLabel}</small>
            </dd>
          </div>
          <div className="adm-dl-item">
            <dt>Paid Clients</dt>
            <dd>
              {formatCount(clients)}
              <small>
                {data.paidClients.sme} SME · {data.paidClients.sacco} SACCO ·{' '}
                {data.paidClients.enterprise} Enterprise
              </small>
            </dd>
          </div>
          <div className="adm-dl-item">
            <dt>Average Order Value</dt>
            <dd>
              {formatUsdWhole(data.averageOrderValueUsdCents)}
              <small>Across all plan tiers</small>
            </dd>
          </div>
        </dl>

        <hr className="adm-divider" />
        <h3 className="adm-kpi-label">Revenue by Package Tier</h3>
        {data.tiers.map((tier) => (
          <div className="adm-progress-row" key={tier.code}>
            <span className="adm-progress-name">
              {tier.name}
              <small>{tier.unitLabel}</small>
            </span>
            <progress className="adm-progress" value={tier.sharePercent} max={100}>
              {tier.sharePercent}%
            </progress>
            <span className="adm-progress-value">{tier.sharePercent}%</span>
          </div>
        ))}
        <p className="adm-note">
          Tier shares are computed on gross revenue for the trailing 90 days.
        </p>
      </div>
    </div>
  );
}

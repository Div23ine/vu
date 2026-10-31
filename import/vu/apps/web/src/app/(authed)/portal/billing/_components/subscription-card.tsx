'use client';

import Link from 'next/link';
import { ArrowUpRight, Check } from 'lucide-react';
import type { SubscriptionStatus } from '@vunvault/contracts';
import { formatLongDate, formatUsdWhole } from '@vunvault/lib';
import { Skeleton, toast } from '@vunvault/ui';
import { isNotFound, useSubscription } from '../_hooks/use-billing';

/**
 * Current-subscription card — the dark plan panel. Values come from
 * `GET /billing/subscription`: `Renews On` as `DD Mon YYYY` (`formatLongDate`),
 * `Billing Cycle` as `Monthly`/`Annual`, `Amount` via `formatUsdWhole`
 * (`$2,499`). A 404 is a normal state: `No active subscription` + `Browse
 * plans` → `/services#pricing`.
 *
 * `Upgrade Plan` has no endpoint (spec: toast only) — TODO(backend-contract).
 */

/** Authored labels for the non-active statuses (the design pins `Active`). */
const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: 'Active',
  past_due: 'Past due',
  canceled: 'Canceled',
  incomplete: 'Incomplete',
};

export function SubscriptionCard() {
  const { data, isLoading, error } = useSubscription();

  if (isLoading) {
    return (
      <div className="vbb-plan" aria-busy="true">
        <div className="vbb-plan-glow" aria-hidden="true" />
        <div className="vbb-plan-head">
          <span className="vbb-plan-eyebrow">Current Subscription</span>
          <Skeleton className="mt-3 h-8 w-56" />
          <Skeleton className="mt-3 h-16 w-full" />
        </div>
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (data === undefined || (error !== null && isNotFound(error))) {
    return (
      <div className="vbb-plan">
        <div className="vbb-plan-glow" aria-hidden="true" />
        <div className="vbb-plan-empty">
          <span className="vbb-plan-eyebrow">Current Subscription</span>
          <div className="vbb-plan-empty-title">No active subscription</div>
          <Link href="/services#pricing">Browse plans</Link>
        </div>
      </div>
    );
  }

  const requestUpgrade = () => {
    // TODO(backend-contract): no upgrade endpoint exists — the spec pins a
    // toast and an explicit "do not call the API".
    toast({
      kind: 'ok',
      title: 'Upgrade requested',
      message: 'Upgrade options will be emailed to you shortly',
    });
  };

  return (
    <div className="vbb-plan">
      <div className="vbb-plan-glow" aria-hidden="true" />
      <div className="vbb-plan-head">
        <span className="vbb-plan-eyebrow">Current Subscription</span>
        <h2 className="vbb-plan-name">
          {data.planName}
          <span className="vbb-plan-badge">
            <Check size={11} aria-hidden="true" />
            {STATUS_LABELS[data.status]}
          </span>
        </h2>
        <p className="vbb-plan-desc">{data.description}</p>
      </div>
      <div className="vbb-plan-metrics">
        <div>
          <div className="vbb-metric-label">Renews On</div>
          <div className="vbb-metric-value vbb-metric-value--light">
            {formatLongDate(new Date(`${data.renewsOn}T00:00:00Z`))}
          </div>
        </div>
        <div>
          <div className="vbb-metric-label">Billing Cycle</div>
          <div className="vbb-metric-value">
            {data.billingCycle === 'annual' ? 'Annual' : 'Monthly'}
          </div>
        </div>
        <div>
          <div className="vbb-metric-label">Amount</div>
          <div className="vbb-metric-value">{formatUsdWhole(data.amountUsdCents)}</div>
        </div>
      </div>
      <div className="vbb-upgrade">
        <div className="vbb-upgrade-text">
          <div className="vbb-upgrade-title">Need more coverage?</div>
          <div className="vbb-upgrade-sub">
            Add continuous red-team emulation or expand your monitored asset count.
          </div>
        </div>
        <button
          type="button"
          className="vbb-btn vbb-btn--primary vbb-btn--sm"
          onClick={requestUpgrade}
        >
          <ArrowUpRight size={14} aria-hidden="true" />
          <span>Upgrade Plan</span>
        </button>
      </div>
    </div>
  );
}

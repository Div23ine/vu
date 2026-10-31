'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { PlanSummary } from '@vunvault/contracts';
import { track } from '../../../lib/analytics';

/**
 * Pricing tiers + currency toggle (client island).
 *
 * USD is the settlement currency — always. Every other currency is a display
 * conversion at the locked public rate table, and each converted price carries
 * its USD equivalent so nobody is surprised at the Paystack page. The choice
 * persists in the `vv_currency` cookie (a service preference, documented in
 * the Cookie Policy); the default comes from the edge geolocation hint.
 */

export const CURRENCY_OPTIONS = ['USD', 'KES', 'GBP', 'EUR'] as const;
export type CurrencyOption = (typeof CURRENCY_OPTIONS)[number];

const COPY: Record<string, { deliverables: string[]; timeline: string; cta: string }> = {
  starter_scan: {
    deliverables: [
      'External attack-surface enumeration of one estate',
      'Authenticated-free vulnerability scan + manual validation of findings',
      'Executive summary with a prioritised remediation checklist',
      '30-day re-scan of fixed findings',
    ],
    timeline: 'Fieldwork within 5 business days of kickoff; report 3 days after.',
    cta: 'Book the Starter Assessment',
  },
  sacco_fintech_compliance: {
    deliverables: [
      'CBK / SASRA control mapping against your live configuration',
      'Kenya DPA 2019 data-protection gap assessment',
      'Evidence pack your auditor can ingest directly',
      'Remediation roadmap with owners and deadlines',
    ],
    timeline: 'Two to three weeks, depending on evidence availability.',
    cta: 'Book the Compliance Assessment',
  },
  enterprise_retainer: {
    deliverables: [
      'Named assessor team with a standing monthly scope',
      'Continuous attack-surface monitoring and regression testing',
      'Priority incident triage during business hours',
      'Quarterly board-ready risk reporting',
    ],
    timeline: 'Onboarding in week one; monitoring runs from day eight.',
    cta: 'Start the Retainer Conversation',
  },
};

function formatLocal(usdCents: number, currency: CurrencyOption, rate: number): string {
  const major = (usdCents / 100) * rate;
  return new Intl.NumberFormat(currency === 'KES' ? 'en-KE' : 'en-GB', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'USD' ? 0 : 0,
  }).format(currency === 'USD' ? usdCents / 100 : Math.round(major));
}

export interface PlansClientProps {
  plans: readonly PlanSummary[];
  /** Local major units per USD; absent when the rate feed is down. */
  rates: Record<string, string> | null;
  initialCurrency: CurrencyOption;
}

export function PlansClient({ plans, rates, initialCurrency }: PlansClientProps) {
  const [currency, setCurrency] = useState<CurrencyOption>(initialCurrency);

  useEffect(() => {
    track('pricing_view');
  }, []);
  const rate = currency === 'USD' ? 1 : Number(rates?.[currency] ?? Number.NaN);
  const usable = rates !== null && Number.isFinite(rate) && rate > 0;

  function choose(next: CurrencyOption) {
    setCurrency(next);
    const secure = window.location.protocol === 'https:' ? '; secure' : '';
    document.cookie = `vv_currency=${next}; path=/; max-age=31536000; samesite=lax${secure}`;
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-neutral-500">
          Prices settle in <strong className="text-neutral-900">USD</strong>
          {usable && currency !== 'USD' ? ' — shown here at today’s public rate.' : '.'}
        </p>
        <fieldset className="flex items-center gap-1 rounded-xl border border-neutral-200 bg-white p-1">
          <legend className="sr-only">Display currency</legend>
          {CURRENCY_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={currency === option}
              disabled={option !== 'USD' && !usable}
              onClick={() => choose(option)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                currency === option
                  ? 'bg-cyan-700 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100 disabled:opacity-40'
              }`}
            >
              {option}
            </button>
          ))}
        </fieldset>
      </div>
      {!usable && (
        <p className="mt-3 text-xs text-neutral-500">
          Live equivalents are temporarily unavailable, so prices show in USD only.
        </p>
      )}

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const copy = COPY[plan.code] ?? { deliverables: [], timeline: '', cta: 'Book' };
          const shown = usable ? formatLocal(plan.usdCents, currency, rate) : null;
          return (
            <article
              key={plan.code}
              className="flex flex-col rounded-3xl border border-neutral-200 bg-white p-7 shadow-sm"
            >
              <h2 className="text-lg font-extrabold text-neutral-900">{plan.name}</h2>
              <p className="mt-4 text-4xl font-extrabold tracking-tight text-neutral-900">
                {shown ?? formatLocal(plan.usdCents, 'USD', 1)}
                <span className="ml-1 text-sm font-semibold text-neutral-500">
                  {plan.unit === 'month' ? '/ month' : `per ${plan.unit}`}
                </span>
              </p>
              {shown !== null && currency !== 'USD' && (
                <p className="mt-1 text-xs font-semibold text-neutral-500">
                  ≈ ${(plan.usdCents / 100).toLocaleString('en-US')} USD — the amount charged
                </p>
              )}
              <ul className="mt-5 space-y-2 text-sm text-neutral-600">
                {copy.deliverables.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span aria-hidden="true" className="text-cyan-700">
                      ✓
                    </span>
                    {line}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs leading-relaxed text-neutral-500">{copy.timeline}</p>
              <Link
                href={`/checkout?plan=${plan.code}`}
                onClick={() => track('tier_click', { plan: plan.code })}
                className="mt-6 rounded-xl bg-cyan-700 px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-cyan-800"
              >
                {copy.cta}
              </Link>
            </article>
          );
        })}
      </div>
    </>
  );
}

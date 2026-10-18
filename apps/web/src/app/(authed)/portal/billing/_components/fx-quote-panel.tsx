'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { DisplayCurrency, FxQuote } from '@vunvault/contracts';
import { formatLocalDisplay, formatUsd } from '@vunvault/lib';
import '../_styles/pay-dialog.css';

/**
 * Display-currency select + locked FX quote panel .
 *
 * The quote is display-only: the charge is ALWAYS the server-derived USD
 * amount (hard rule — the UI never computes or sends an amount). The panel
 * shows the locked local amount, the locked rate and a mm:ss countdown; at
 * zero it flips to `Quote expired` + `Refresh quote` and the Pay button is
 * disabled by the dialog. The charge sentence renders for every currency.
 */

/** Verbatim option list from the spec spec. */
export const DISPLAY_CURRENCY_OPTIONS = [
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'KES', label: 'KES — Kenyan Shilling' },
  { code: 'NGN', label: 'NGN — Nigerian Naira' },
  { code: 'GHS', label: 'GHS — Ghanaian Cedi' },
  { code: 'ZAR', label: 'ZAR — South African Rand' },
] as const satisfies ReadonlyArray<{ code: DisplayCurrency; label: string }>;

/** Default display currency from the client's billing country (spec map). */
export function defaultCurrencyForCountry(country: string | null | undefined): DisplayCurrency {
  switch (country) {
    case 'KE':
      return 'KES';
    case 'NG':
      return 'NGN';
    case 'GH':
      return 'GHS';
    case 'ZA':
      return 'ZAR';
    default:
      return 'USD';
  }
}

function remainingSeconds(expiresAt: string, now: number): number {
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - now) / 1000));
}

function mmss(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export interface FxQuotePanelProps {
  currency: DisplayCurrency;
  onCurrencyChange: (currency: DisplayCurrency) => void;
  quote: FxQuote | null;
  /** A quote request is in flight. */
  loading: boolean;
  onRefresh: () => void;
  /** The server-derived USD amount the client will actually be charged. */
  usdCents: number;
  /** Fired once per quote when the countdown reaches zero. */
  onExpire?: () => void;
  disabled?: boolean;
}

export function FxQuotePanel({
  currency,
  onCurrencyChange,
  quote,
  loading,
  onRefresh,
  usdCents,
  onExpire,
  disabled = false,
}: FxQuotePanelProps) {
  const [now, setNow] = useState(() => Date.now());
  const expiryReported = useRef<string | null>(null);

  // One ticker while a quote is live; frozen otherwise.
  const ticking = currency !== 'USD' && quote !== null && !loading;
  useEffect(() => {
    if (!ticking || quote === null) return;
    setNow(Date.now());
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (
        onExpire !== undefined &&
        expiryReported.current !== quote.id &&
        remainingSeconds(quote.expiresAt, current) <= 0
      ) {
        expiryReported.current = quote.id;
        onExpire();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [ticking, quote, onExpire]);

  const expired = quote !== null && remainingSeconds(quote.expiresAt, now) <= 0;

  return (
    <div className="vbb-fx">
      <div className="vbb-field">
        <label htmlFor="vbb-display-currency">Display currency</label>
        <select
          id="vbb-display-currency"
          className="vbb-select"
          value={currency}
          disabled={disabled}
          onChange={(event) => onCurrencyChange(event.target.value as DisplayCurrency)}
        >
          {DISPLAY_CURRENCY_OPTIONS.map(({ code, label }) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {currency !== 'USD' ? (
        loading ? (
          <div className="vbb-quote vbb-quote--loading" role="status" aria-label="Loading quote">
            <span className="vbb-btn-spinner" aria-hidden="true" />
          </div>
        ) : quote === null ? (
          <div className="vbb-quote">
            <button
              type="button"
              className="vbb-btn vbb-btn--ghost vbb-btn--sm"
              onClick={onRefresh}
            >
              <RefreshCw size={13} aria-hidden="true" />
              <span>Refresh quote</span>
            </button>
          </div>
        ) : expired ? (
          <div className="vbb-quote vbb-quote--expired" role="status">
            <span className="vbb-quote-expired-text">Quote expired</span>
            <button
              type="button"
              className="vbb-btn vbb-btn--ghost vbb-btn--sm"
              onClick={onRefresh}
            >
              <RefreshCw size={13} aria-hidden="true" />
              <span>Refresh quote</span>
            </button>
          </div>
        ) : (
          <div className="vbb-quote" role="status">
            <div className="vbb-quote-amount">
              ≈ {formatLocalDisplay(quote.localMinor, quote.displayCurrency)}
            </div>
            <div className="vbb-quote-rate">
              Rate locked: 1 USD = {quote.rateLocalPerUsd} {quote.displayCurrency}
            </div>
            <div className="vbb-quote-timer" aria-live="polite">
              Quote valid for {mmss(remainingSeconds(quote.expiresAt, now))}
            </div>
          </div>
        )
      ) : null}

      <p className="vbb-charge-note">
        You will be charged {formatUsd(usdCents)} in USD. The local amount is an estimate based on
        the locked rate; your bank may apply its own conversion.
      </p>
    </div>
  );
}

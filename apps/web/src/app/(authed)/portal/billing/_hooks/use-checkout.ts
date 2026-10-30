import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type {
  CheckoutBody,
  CheckoutResponse,
  FxQuote,
  FxQuoteRequest,
  Invoice,
} from '@vunvault/contracts';
import { apiGet, apiPost } from '../../../../../lib/api';

/**
 * Checkout hooks — the locked FX quote, the USD checkout and the
 * post-payment confirmation poll.
 *
 * `usePaymentAttempt` never trusts the synchronous checkout result for ledger
 * state (hard rule): it polls `GET /billing/invoices` every 3 s for up to 60 s
 * until the invoice flips to `paid`. There is no payment-attempt read endpoint
 * in the contract, so the invoice row IS the confirmation.
 *
 * No `'use client'` directive (the directive-free hook-module pattern): only client
 * components import this module.
 */

const POLL_INTERVAL_MS = 3000;
const POLL_BUDGET_MS = 60_000;

export type PaymentAttemptState = 'idle' | 'polling' | 'paid' | 'timed_out';

export function useFxQuote() {
  return useMutation({
    // TODO(backend-contract): POST /api/v1/billing/fx-quotes body { invoiceId; displayCurrency }
    //  → 201 { data: FxQuote } | 409 already_paid | 422 unsupported_currency | 502 fx_unavailable
    mutationFn: (body: FxQuoteRequest) =>
      apiPost<{ data: FxQuote }>('/api/v1/billing/fx-quotes', body).then(
        (response) => response.data,
      ),
  });
}

export function useCheckout() {
  return useMutation({
    // TODO(backend-contract): POST /api/v1/billing/checkout body CheckoutBody
    //  → 201|200 { data: { paymentAttemptId; status; usdCents; settlementCurrency: "USD"; clientSecret?; redirectUrl? } }
    //  | 409 { error: "quote_expired"|"amount_changed"|"already_paid" } | 422 channel_unavailable
    mutationFn: (body: CheckoutBody) =>
      apiPost<CheckoutResponse>('/api/v1/billing/checkout', body).then((response) => response.data),
  });
}

/**
 * Polls the first invoice page until the given invoice reads `paid`
 * (`'paid'`), the 60 s budget runs out (`'timed_out'`), or polling is
 * switched off (`'idle'`). Single-flight per tick; a failed tick is ignored —
 * the next one retries.
 */
export function usePaymentAttempt(invoiceId: string | null, active: boolean): PaymentAttemptState {
  const [state, setState] = useState<PaymentAttemptState>('idle');

  useEffect(() => {
    if (!active || invoiceId === null) {
      setState('idle');
      return;
    }
    setState('polling');
    const startedAt = Date.now();
    let inFlight = false;
    const timer = setInterval(() => {
      if (inFlight) return;
      if (Date.now() - startedAt >= POLL_BUDGET_MS) {
        clearInterval(timer);
        setState('timed_out');
        return;
      }
      inFlight = true;
      apiGet<{ data: Invoice[]; total: number }>('/api/v1/billing/invoices?page=1&pageSize=10')
        .then((page) => {
          const invoice = page.data.find((candidate) => candidate.id === invoiceId);
          if (invoice !== undefined && invoice.status === 'paid') {
            clearInterval(timer);
            setState('paid');
          }
        })
        .catch(() => {
          // Keep polling — a transient failure is not a verdict.
        })
        .finally(() => {
          inFlight = false;
        });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [active, invoiceId]);

  return state;
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ClientProfile,
  Invoice,
  PaymentMethodView,
  Subscription,
  UpdatePaymentMethodBody,
} from '@vunvault/contracts';
import { isApiError, queryKeys } from '@vunvault/lib';
import { apiGet, apiPut } from '../../../../../lib/api';
import { env } from '../../../../../env';

/**
 * Billing hooks + download helpers .
 *
 * The queries ride the shared api client (cookies + CSRF). The two DOWNLOADS
 * (invoice PDF, CSV export) use `fetch` directly on purpose: they are binary
 * streams, and the JSON-parsing transport cannot carry them. Both are GETs —
 * no CSRF token involved — with `credentials: "include"` for the session.
 *
 * No `'use client'` directive (the `use-login.ts` pattern): only client
 * components import this module.
 */

const PDF_RETRY_DELAY_MS = 3000;
const PDF_MAX_ATTEMPTS = 5;

export function useSubscription() {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/billing/subscription → 200 { data: Subscription } | 404 | 403 no_org
    queryKey: queryKeys.billing.subscription(),
    queryFn: () =>
      apiGet<{ data: Subscription }>('/api/v1/billing/subscription').then(
        (response) => response.data,
      ),
  });
}

export function usePaymentMethod() {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/billing/payment-method → 200 { data: PaymentMethodView } | 404
    queryKey: queryKeys.billing.paymentMethod(),
    queryFn: () =>
      apiGet<{ data: PaymentMethodView }>('/api/v1/billing/payment-method').then(
        (response) => response.data,
      ),
  });
}

export function useInvoices(params: { page: number; pageSize: number }) {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/billing/invoices?page=&pageSize= → 200 { data: Invoice[]; total }
    queryKey: queryKeys.billing.invoices(params),
    queryFn: () =>
      apiGet<{ data: Invoice[]; total: number }>(
        `/api/v1/billing/invoices?page=${params.page}&pageSize=${params.pageSize}`,
      ),
  });
}

export function useUpdatePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    // TODO(backend-contract): PUT /api/v1/billing/payment-method body
    //  { provider: "stripe"; providerPaymentMethodToken; cardholderName; billingCountry }
    //  → 200 { data: PaymentMethodView } | 422 { error: "payment_method_rejected" }
    mutationFn: (body: UpdatePaymentMethodBody) =>
      apiPut<{ data: PaymentMethodView }>('/api/v1/billing/payment-method', body).then(
        (response) => response.data,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.billing.paymentMethod() });
    },
  });
}

/** The client profile — the billing table's caption needs the company name. */
export function useClientProfile() {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/profile → 200 { data: ClientProfile }
    queryKey: queryKeys.profile(),
    queryFn: () =>
      apiGet<{ data: ClientProfile }>('/api/v1/profile').then((response) => response.data),
  });
}

/** `404` on a billing read is a normal state (no subscription / no card yet). */
export function isNotFound(error: unknown): boolean {
  return isApiError(error) && error.status === 404;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Hidden `<a download>` + object URL, revoked right after the click. */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export interface PdfDownloadOptions {
  /** Fired on every `202 generating` answer (the caller toasts once). */
  onGenerating?: () => void;
}

/**
 * Downloads the invoice PDF. While the API answers `202 generating` the call
 * retries after 3 s, up to five attempts. Resolves `true` when a blob landed.
 */
export async function downloadInvoicePdf(
  invoice: Invoice,
  options: PdfDownloadOptions = {},
): Promise<boolean> {
  for (let attempt = 0; attempt < PDF_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(
      `${env.NEXT_PUBLIC_API_URL}/api/v1/billing/invoices/${invoice.id}/pdf`,
      { credentials: 'include' },
    );
    if (response.status === 202) {
      options.onGenerating?.();
      await sleep(PDF_RETRY_DELAY_MS);
      continue;
    }
    if (!response.ok) return false;
    triggerBlobDownload(await response.blob(), `${invoice.number}.pdf`);
    return true;
  }
  return false;
}

/** Streams `/billing/invoices.csv` to a download named `vunvault-invoices.csv`. */
export async function exportInvoicesCsv(): Promise<boolean> {
  const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/v1/billing/invoices.csv`, {
    credentials: 'include',
  });
  if (!response.ok) return false;
  triggerBlobDownload(await response.blob(), 'vunvault-invoices.csv');
  return true;
}

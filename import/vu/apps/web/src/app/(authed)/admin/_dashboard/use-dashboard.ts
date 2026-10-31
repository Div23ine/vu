import { useQuery, type QueryClient } from '@tanstack/react-query';
import { formatDayMonth, isApiError } from '@vunvault/lib';
import { apiGet } from '../../../../lib/api';

/**
 * Command Center data hooks — one query per dashboard section so a
 * failure degrades ONLY that card. `queryKeys` (packages/lib) has no
 * dashboard entry and this task must not touch packages/lib, so the key
 * namespace lives here (the an earlier iteration precedent).
 *
 * Refresh Metrics flips `refreshRequested` and invalidates the namespace:
 * every refetch then carries `?refresh=1`, which bypasses the API's 15 s
 * read-through cache. The 30 s auto-refresh polls while the tab is visible
 * (`refetchIntervalInBackground: false`) WITHOUT the flag.
 *
 * No `'use client'` directive (the directive-free hook-module pattern).
 */

export const DASHBOARD_KEY = ['dashboard'] as const;

const AUTO_REFRESH_MS = 30_000;

let refreshRequested = false;

/** Re-fetch every dashboard query with `?refresh=1` (cache bypass). */
export function refreshDashboard(queryClient: QueryClient): Promise<void> {
  refreshRequested = true;
  return queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY }).finally(() => {
    refreshRequested = false;
  });
}

function urlFor(path: string): string {
  const base = `/api/v1/admin/dashboard/${path}`;
  if (!refreshRequested) return base;
  return `${base}${base.includes('?') ? '&' : '?'}refresh=1`;
}

const SECTION_OPTIONS = {
  refetchInterval: AUTO_REFRESH_MS,
  refetchIntervalInBackground: false,
  retry: false,
} as const;

/** Sections whose envelope is `{ data: T }`. */
export function useDashboardSection<T>(section: string, path: string) {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/admin/dashboard/:section[?refresh=1] → 200 { data } | 403
    queryKey: [...DASHBOARD_KEY, section],
    queryFn: () => apiGet<{ data: T }>(urlFor(path)).then((response) => response.data),
    ...SECTION_OPTIONS,
  });
}

/** Sections whose response IS the envelope (`transactions`, `nodes`, `running-scans`). */
export function useDashboardSectionRaw<T>(section: string, path: string) {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/admin/dashboard/:section[?refresh=1] → 200 { data, … } | 403
    queryKey: [...DASHBOARD_KEY, section],
    queryFn: () => apiGet<T>(urlFor(path)),
    ...SECTION_OPTIONS,
  });
}

/** A 403 hides the section — it is a permission answer, not an error. */
export function isForbidden(error: unknown): boolean {
  return isApiError(error) && error.status === 403;
}

const countFormatter = new Intl.NumberFormat('en-US');

/** `1842 → "1,842"` */
export function formatCount(value: number): string {
  return countFormatter.format(value);
}

/** `2026-09-24T09:14:00Z → "24 Sep · 09:14"` (UTC) */
export function formatTxnStamp(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${formatDayMonth(date)} · ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

/** `2140000 → "2.14M"` */
export function formatMillions(value: number): string {
  return `${(value / 1_000_000).toFixed(2)}M`;
}

/** Payment-method chips (verbatim from the reference table). */
export const METHOD_LABELS = {
  mpesa: 'M-Pesa',
  card: 'Card',
  bank_transfer: 'Bank transfer',
} as const;

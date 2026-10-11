import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AuditCategory,
  AuditEntryView,
  AuditRange,
  AuditSeverity,
  AuditSummary,
  ChainStatus,
  VerifyChainResult,
} from '@vunvault/contracts';
import { queryKeys } from '@vunvault/lib';
import { env } from '../../../../../env';
import { apiGet, apiPost } from '../../../../../lib/api';

/**
 * Audit-trail hooks (Task 83b) — the read-only append-only chain built in
 * Task 39: the summary tiles, the chain-status panel, the filtered tail, the
 * verification write and the compliance CSV export.
 *
 * There is deliberately NO mutation that creates, edits or deletes an entry —
 * the chain is append-only and the API exposes no such route, so this module
 * cannot offer one either. The only write is `POST …/verify`, which records a
 * checkpoint.
 *
 * Keys come from the canonical `queryKeys.audit` namespace (Task 7); the
 * summary key extends it locally because packages/lib has no `audit.summary`
 * entry and this task must not add one (the Task 67 precedent).
 *
 * No `'use client'` directive (the `use-login.ts` pattern).
 */

export const AUDIT_SUMMARY_KEY = [...queryKeys.audit.all(), 'summary'] as const;

/** The console shows the first page; the markup's own count. */
export const AUDIT_PAGE_SIZE = 18;

/**
 * The tail's fallback poll (Task 83b). Since Task 93 it runs ONLY while the
 * SSE stream is offline — a browser without `EventSource`, or one the server
 * refused — so a live console never double-fetches.
 */
export const AUDIT_POLL_MS = 10_000;

/** Range filter → window length, for the client-side match of live entries. */
export const AUDIT_RANGE_MS: Record<AuditRange, number> = {
  '1h': 3_600_000,
  '6h': 21_600_000,
  '24h': 86_400_000,
  '7d': 604_800_000,
  '30d': 2_592_000_000,
};

export interface AuditFilters {
  q: string;
  category: AuditCategory | '';
  severity: AuditSeverity | '';
  actor: string;
  range: AuditRange;
  page: number;
  pageSize: number;
}

export const DEFAULT_RANGE: AuditRange = '24h';

export function auditSearchOf(filters: AuditFilters): string {
  const params = new URLSearchParams();
  if (filters.q !== '') params.set('q', filters.q);
  if (filters.category !== '') params.set('category', filters.category);
  if (filters.severity !== '') params.set('severity', filters.severity);
  if (filters.actor !== '') params.set('actor', filters.actor);
  params.set('range', filters.range);
  params.set('page', String(filters.page));
  params.set('pageSize', String(filters.pageSize));
  return params.toString();
}

export function useAuditSummary() {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/admin/audit/summary → 200 { data: AuditSummary }
    queryKey: AUDIT_SUMMARY_KEY,
    queryFn: () =>
      apiGet<{ data: AuditSummary }>('/api/v1/admin/audit/summary').then(
        (response) => response.data,
      ),
  });
}

export function useChainStatus() {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/admin/audit/chain → 200 { data: ChainStatus }
    queryKey: queryKeys.audit.chain(),
    queryFn: () =>
      apiGet<{ data: ChainStatus }>('/api/v1/admin/audit/chain').then((response) => response.data),
  });
}

/**
 * The audit tail. Only page 1 polls (the spec's rule); deeper pages are fetched
 * on demand so a reviewer reading page 3 is not yanked back to the head.
 */
/**
 * The audit tail. Only page 1 refreshes on a timer (the spec's rule), and only
 * while the SSE stream is offline — when the stream is up, entries arrive by
 * push and a poll would only race it. Deeper pages are fetched on demand so a
 * reviewer reading page 3 is not yanked back to the head.
 */
export function useAuditTrail(filters: AuditFilters, isStreamLive: boolean = false) {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/admin/audit?q=&category=&severity=&actor=&range=&page=&pageSize=
    //   → 200 { data: AuditEntryView[]; total }
    queryKey: queryKeys.audit.list(filters),
    queryFn: () =>
      apiGet<{ data: AuditEntryView[]; total: number }>(
        `/api/v1/admin/audit?${auditSearchOf(filters)}`,
      ),
    refetchInterval: filters.page === 1 && !isStreamLive ? AUDIT_POLL_MS : false,
    refetchIntervalInBackground: false,
  });
}

/** True when no filter narrows the tail, so the footer total can be trusted. */
export function isTrailUnfiltered(filters: AuditFilters): boolean {
  return (
    filters.q === '' && filters.category === '' && filters.severity === '' && filters.actor === ''
  );
}

/**
 * Client-side mirror of the API's tail filters, applied to entries that arrive
 * over SSE. The stream is unfiltered by design — one Redis subscription serves
 * every viewer — so the console decides what belongs on screen.
 *
 * `range` is the one approximation: the API compares against its own clock and
 * the browser compares against its own, so an entry within a second or two of
 * the boundary can land differently. It is corrected by the next fetch, and a
 * tail that drops a boundary row for one refresh is not a correctness problem.
 */
export function entryMatchesFilters(
  entry: AuditEntryView,
  filters: AuditFilters,
  now: Date = new Date(),
): boolean {
  if (filters.category !== '' && entry.category !== filters.category) return false;
  if (filters.severity !== '' && entry.severity !== filters.severity) return false;
  if (filters.actor !== '') {
    const needle = filters.actor.trim().toLowerCase();
    if (needle !== '' && !entry.actorLabel.toLowerCase().includes(needle)) return false;
  }
  if (filters.q !== '') {
    const needle = filters.q.trim().toLowerCase();
    if (
      needle !== '' &&
      !entry.message.toLowerCase().includes(needle) &&
      !entry.eventType.toLowerCase().includes(needle)
    ) {
      return false;
    }
  }
  const created = Date.parse(entry.createdAt);
  if (Number.isFinite(created) && now.getTime() - created > AUDIT_RANGE_MS[filters.range]) {
    return false;
  }
  return true;
}

/**
 * Fold pushed entries into the fetched page: newest first, deduped by `seq`
 * (a reconnect replays up to 200 entries the fetch may already contain), then
 * trimmed to the page size.
 */
export function mergeLiveEntries(
  fetched: readonly AuditEntryView[],
  live: readonly AuditEntryView[],
  pageSize: number = AUDIT_PAGE_SIZE,
): AuditEntryView[] {
  const merged = new Map<number, AuditEntryView>();
  for (const entry of fetched) merged.set(entry.seq, entry);
  for (const entry of live) merged.set(entry.seq, entry);
  return [...merged.values()].sort((a, b) => b.seq - a.seq).slice(0, pageSize);
}

export function useVerifyChain() {
  const queryClient = useQueryClient();
  return useMutation({
    // TODO(backend-contract): POST /api/v1/admin/audit/verify body { incremental? }
    //   → 200 { data: VerifyChainResult } | 409 verify_in_progress
    mutationFn: (body: { incremental?: boolean } = {}) =>
      apiPost<{ data: VerifyChainResult }>('/api/v1/admin/audit/verify', body).then(
        (response) => response.data,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.chain() });
      void queryClient.invalidateQueries({ queryKey: AUDIT_SUMMARY_KEY });
    },
  });
}

/** Hidden `<a download>` + object URL, revoked right after the click. */
function triggerBlobDownload(blob: Blob, filename: string): void {
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

/** `vunvault-audit-2026-09-24.csv` */
export function auditExportFilename(now: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  const day = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
  return `vunvault-audit-${day}.csv`;
}

export type AuditExportOutcome = 'downloaded' | 'range_too_large' | 'failed';

/**
 * Streams the signed compliance CSV with the CURRENT filters applied.
 *
 * A raw `fetch` rather than `apiGet`: the answer is `text/csv`, not the JSON
 * envelope, so the typed transport does not apply (the `exportInvoicesCsv`
 * precedent). Credentials stay cookies — no `Authorization` header ever leaves
 * the browser.
 */
export async function exportAuditCsv(filters: AuditFilters): Promise<AuditExportOutcome> {
  const response = await fetch(
    `${env.NEXT_PUBLIC_API_URL}/api/v1/admin/audit/export?${auditSearchOf(filters)}`,
    { credentials: 'include' },
  );
  if (response.status === 422) return 'range_too_large';
  if (!response.ok) return 'failed';
  triggerBlobDownload(await response.blob(), auditExportFilename(new Date()));
  return 'downloaded';
}

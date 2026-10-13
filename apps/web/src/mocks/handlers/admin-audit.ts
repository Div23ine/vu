import { http, HttpResponse } from 'msw';
import type { AuditEntryView, VerifyChainResult } from '@vunvault/contracts';
import { auditEntries, auditSummary, chainStatus } from '@vunvault/contracts/fixtures/audit';

/**
 * Admin audit-trail mock handlers (Task 83b).
 *
 * Used ONLY by tests (through `mocks/server.ts`) and the opt-in dev mock mode.
 * The Task 20 fixtures ARE the trail (ten linked entries, newest first), the
 * tiles and the chain state; the list endpoint applies the real filter
 * semantics (`q` over actor, ip, subject, event type and message; exact
 * `category` / `severity` / `actor`; `page` / `pageSize` slicing) so the
 * URL-driven toolbar is exercised end to end.
 *
 * `range` is accepted and echoed but not applied: the fixture entries all sit
 * inside the 24 h window, so narrowing would empty the console for every range
 * and the filter would be untestable. The real API filters on `created_at`.
 *
 * There is deliberately NO create / update / delete / redact handler — the
 * chain is append-only and the API exposes no such route, so a test that tried
 * one must fail loudly against `onUnhandledRequest: "error"`.
 *
 * API contract mirrored here (implemented for real in `apps/api`, Task 39):
 *   GET  /api/v1/admin/audit?…        → 200 { data: AuditEntryView[]; total }
 *   GET  /api/v1/admin/audit/summary  → 200 { data: AuditSummary }
 *   GET  /api/v1/admin/audit/chain    → 200 { data: ChainStatus }
 *   POST /api/v1/admin/audit/verify   → 200 { data: VerifyChainResult } | 409 verify_in_progress
 *   GET  /api/v1/admin/audit/export?… → 200 text/csv | 422 range_too_large
 */

let entries: AuditEntryView[] = auditEntries.map((entry) => ({ ...entry }));

/** Restore the fixture trail (tests call this in `beforeEach`). */
export function resetAdminAudit(): void {
  entries = auditEntries.map((entry) => ({ ...entry }));
}

/** Ranges the signing service will produce in one pass (`30d` is too wide). */
const EXPORT_RANGES_TOO_LARGE = new Set(['30d']);

function matches(entry: AuditEntryView, params: URLSearchParams): boolean {
  const q = (params.get('q') ?? '').trim().toLowerCase();
  if (q !== '') {
    const haystack = [
      entry.actorLabel,
      entry.ip ?? '',
      entry.subject ?? '',
      entry.eventType,
      entry.message,
    ]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  const category = params.get('category');
  if (category !== null && category !== '' && entry.category !== category) return false;
  const severity = params.get('severity');
  if (severity !== null && severity !== '' && entry.severity !== severity) return false;
  const actor = params.get('actor');
  if (actor !== null && actor !== '' && entry.actorLabel !== actor) return false;
  return true;
}

/** The compliance CSV: the trail's own columns, quoted. */
function toCsv(rows: readonly AuditEntryView[]): string {
  const header = [
    'seq',
    'created_at',
    'category',
    'event_type',
    'severity',
    'sev_level',
    'actor',
    'subject',
    'ip',
    'message',
    'hash',
    'prev_hash',
  ];
  const escape = (value: string | number | null): string =>
    `"${String(value ?? '').replaceAll('"', '""')}"`;
  const lines = rows.map((row) =>
    [
      row.seq,
      row.createdAt,
      row.category,
      row.eventType,
      row.severity,
      row.sevLevel,
      row.actorLabel,
      row.subject,
      row.ip,
      row.message,
      row.hash,
      row.prevHash,
    ]
      .map(escape)
      .join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

export const adminAuditHandlers = [
  // ——— Literal paths FIRST (MSW matches in registration order) ———
  http.get('*/api/v1/admin/audit/summary', () => HttpResponse.json({ data: auditSummary })),

  http.get('*/api/v1/admin/audit/chain', () => HttpResponse.json({ data: chainStatus })),

  http.post('*/api/v1/admin/audit/verify', () => {
    const result: VerifyChainResult = {
      checkedFromSeq: entries.at(-1)?.seq ?? 1,
      checkedToSeq: entries[0]?.seq ?? 1,
      entries: chainStatus.totalEntries,
      mismatches: chainStatus.hashMismatches,
      firstMismatchSeq: null,
      verifiedAt: new Date().toISOString(),
    };
    return HttpResponse.json({ data: result });
  }),

  http.get('*/api/v1/admin/audit/export', ({ request }) => {
    const params = new URL(request.url).searchParams;
    // A 30-day bundle is beyond what the signer will produce in one pass.
    if (EXPORT_RANGES_TOO_LARGE.has(params.get('range') ?? '')) {
      return HttpResponse.json({ error: 'range_too_large' }, { status: 422 });
    }
    const rows = entries.filter((entry) => matches(entry, params));
    return new HttpResponse(toCsv(rows), {
      status: 200,
      headers: { 'content-type': 'text/csv; charset=utf-8' },
    });
  }),

  // ——— Collection ———
  http.get('*/api/v1/admin/audit', ({ request }) => {
    const params = new URL(request.url).searchParams;
    const filtered = entries.filter((entry) => matches(entry, params));
    const page = Math.max(1, Number(params.get('page') ?? '1'));
    const pageSize = Math.min(100, Math.max(1, Number(params.get('pageSize') ?? '18')));
    const start = (page - 1) * pageSize;
    return HttpResponse.json({
      data: filtered.slice(start, start + pageSize),
      total: filtered.length,
    });
  }),
];

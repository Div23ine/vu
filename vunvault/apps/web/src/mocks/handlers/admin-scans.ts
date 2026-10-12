import { http, HttpResponse } from 'msw';
import type {
  PaymentStatus,
  ReviewGateState,
  ScanJob,
  ScanStatus,
  ScanType,
} from '@vunvault/contracts';
import { scanJobs, scanQueueSummary } from '@vunvault/contracts/fixtures/scans';
import { staffMembers } from '@vunvault/contracts/fixtures/users';

/**
 * Admin scan-queue mock handlers (Task 77).
 *
 * Used ONLY by tests (through `mocks/server.ts`) and the opt-in dev mock
 * mode. The Task 19 catalogue fixtures ARE the queue (ten jobs across every
 * status/gate/payment combination) and the summary; the list endpoint
 * applies the real filter semantics (`q` over job code, host, client name,
 * contact email and scope notes; exact `status`/`gate`/`payment`/`type`;
 * `page`/`pageSize` slicing) so the URL-driven toolbar is exercised end to
 * end.
 *
 * `bulk` answers the happy path (`updated = ids.length`, nothing skipped) —
 * the skipped-all scenario is a per-test override. `cancel` mutates the
 * module-level queue copy (reset via `resetAdminScans()`); `request-payment`
 * re-issues the invoice without changing the payment state, exactly like the
 * real API.
 *
 * The staff roster handler (`GET /api/v1/admin/users`) parks HERE until
 * Task 79's users mocks own it — the reviewer select needs it and no earlier
 * task registered one (the Task 66/68 profile-handler precedent).
 *
 * API contract mirrored here (implemented for real in `apps/api`, Task 35):
 *   GET  /api/v1/admin/scans/summary → 200 { data: ScanQueueSummary }
 *   GET  /api/v1/admin/scans?q=&status=&gate=&payment=&type=&page=&pageSize=
 *                                    → 200 { data: ScanJob[]; total }
 *   POST /api/v1/admin/scans/bulk    → 200 { data: { updated; skippedIds } }
 *   POST /api/v1/admin/scans/:id/request-payment → 200 { data: ScanJob }
 *   POST /api/v1/admin/scans/:id/cancel          → 200 { data: ScanJob }
 *   GET  /api/v1/admin/users         → 200 { data: StaffMember[]; total }
 */

let queueJobs: ScanJob[] = scanJobs.map((job) => ({ ...job }));

/** Restore the fixture queue (tests call this in `beforeEach`). */
export function resetAdminScans(): void {
  queueJobs = scanJobs.map((job) => ({ ...job }));
}

function matches(job: ScanJob, params: URLSearchParams): boolean {
  const q = (params.get('q') ?? '').trim().toLowerCase();
  if (q !== '') {
    const haystack = [
      job.jobCode,
      job.targetHost,
      job.client.name,
      job.client.contactEmail ?? '',
      job.scopeNotes ?? '',
    ]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  const status = params.get('status');
  if (status !== null && status !== '' && job.status !== (status as ScanStatus)) return false;
  const gate = params.get('gate');
  if (gate !== null && gate !== '' && job.reviewGateState !== (gate as ReviewGateState)) {
    return false;
  }
  const payment = params.get('payment');
  if (payment !== null && payment !== '' && job.paymentStatus !== (payment as PaymentStatus)) {
    return false;
  }
  const type = params.get('type');
  if (type !== null && type !== '' && job.scanType !== (type as ScanType)) return false;
  return true;
}

export const adminScansHandlers = [
  http.get('*/api/v1/admin/scans/summary', () => HttpResponse.json({ data: scanQueueSummary })),

  http.get('*/api/v1/admin/scans', ({ request }) => {
    const params = new URL(request.url).searchParams;
    const filtered = queueJobs.filter((job) => matches(job, params));
    const page = Math.max(1, Number(params.get('page') ?? '1'));
    const pageSize = Math.min(100, Math.max(1, Number(params.get('pageSize') ?? '10')));
    const start = (page - 1) * pageSize;
    return HttpResponse.json({
      data: filtered.slice(start, start + pageSize),
      total: filtered.length,
    });
  }),

  http.post('*/api/v1/admin/scans/bulk', async ({ request }) => {
    const body = (await request.json()) as { ids?: string[] };
    const ids = Array.isArray(body.ids) ? body.ids : [];
    return HttpResponse.json({ data: { updated: ids.length, skippedIds: [] } });
  }),

  http.post('*/api/v1/admin/scans/:id/request-payment', ({ params }) => {
    const job = queueJobs.find((candidate) => candidate.id === String(params.id));
    if (job === undefined) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    return HttpResponse.json({ data: job });
  }),

  http.post('*/api/v1/admin/scans/:id/cancel', ({ params }) => {
    const id = String(params.id);
    const job = queueJobs.find((candidate) => candidate.id === id);
    if (job === undefined) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    const cancelled: ScanJob = { ...job, status: 'cancelled' };
    queueJobs = queueJobs.map((candidate) => (candidate.id === id ? cancelled : candidate));
    return HttpResponse.json({ data: cancelled });
  }),

  http.get('*/api/v1/admin/users', () =>
    HttpResponse.json({ data: staffMembers, total: staffMembers.length }),
  ),
];

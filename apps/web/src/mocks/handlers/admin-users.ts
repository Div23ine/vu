import { http, HttpResponse } from 'msw';
import type { AccountStatus, StaffMember, UserRole } from '@vunvault/contracts';
import { TEAM_LABELS } from '@vunvault/contracts';
import { staffMembers, staffSummary } from '@vunvault/contracts/fixtures/users';

/**
 * Admin user-management mock handlers (Task 79).
 *
 * Used ONLY by tests (through `mocks/server.ts`) and the opt-in dev mock
 * mode. The Task 19 catalogue fixtures ARE the roster (ten staff members
 * across every status/MFA combination) and the summary; the list endpoint
 * applies the real filter semantics (`q` over name, email, scope and team
 * label; exact `role`/`status`; `mfa=enrolled|not_enrolled`; `page` /
 * `pageSize` slicing) so the URL-driven toolbar is exercised end to end.
 *
 * Registration order matters: `index.ts` spreads these handlers BEFORE the
 * Task 77 `admin-scans.ts` set, so this file's `GET /api/v1/admin/users`
 * supersedes the roster handler that parked there for the reviewer select
 * (same fixture data, real filtering). The writes mutate a module-level
 * copy; tests reset it through `resetAdminUsers()`.
 *
 * API contract mirrored here (implemented for real in `apps/api`, Task 30):
 *   GET   /api/v1/admin/users?…          → 200 { data: StaffMember[]; total }
 *   GET   /api/v1/admin/users/summary    → 200 { data: StaffSummary }
 *   POST  /api/v1/admin/users/:id/suspend | /reactivate | /enforce-mfa → 200 { data }
 *   PATCH /api/v1/admin/users/:id/role   → 200 { data }
 *   DELETE /api/v1/admin/users/:id       → 204
 */

let members: StaffMember[] = staffMembers.map((member) => ({ ...member }));

/** Restore the fixture roster (tests call this in `beforeEach`). */
export function resetAdminUsers(): void {
  members = staffMembers.map((member) => ({ ...member }));
}

function matches(member: StaffMember, params: URLSearchParams): boolean {
  const q = (params.get('q') ?? '').trim().toLowerCase();
  if (q !== '') {
    const haystack = [
      member.fullName,
      member.email,
      member.scopeSummary ?? '',
      member.team === null ? '' : TEAM_LABELS[member.team],
    ]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  const role = params.get('role');
  if (role !== null && role !== '' && member.role !== (role as UserRole)) return false;
  const status = params.get('status');
  if (status !== null && status !== '' && member.accountStatus !== (status as AccountStatus)) {
    return false;
  }
  const mfa = params.get('mfa');
  if (mfa === 'enrolled' && !member.mfa.enrolled) return false;
  if (mfa === 'not_enrolled' && member.mfa.enrolled) return false;
  return true;
}

function mutate(id: string, patch: Partial<StaffMember>) {
  const member = members.find((candidate) => candidate.id === id);
  if (member === undefined) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
  const updated = { ...member, ...patch };
  members = members.map((candidate) => (candidate.id === id ? updated : candidate));
  return HttpResponse.json({ data: updated });
}

export const adminUsersHandlers = [
  http.get('*/api/v1/admin/users/summary', () => HttpResponse.json({ data: staffSummary })),

  http.get('*/api/v1/admin/users', ({ request }) => {
    const params = new URL(request.url).searchParams;
    const filtered = members.filter((member) => matches(member, params));
    const page = Math.max(1, Number(params.get('page') ?? '1'));
    const pageSize = Math.min(100, Math.max(1, Number(params.get('pageSize') ?? '10')));
    const start = (page - 1) * pageSize;
    return HttpResponse.json({
      data: filtered.slice(start, start + pageSize),
      total: filtered.length,
    });
  }),

  http.post('*/api/v1/admin/users/:id/suspend', ({ params }) =>
    mutate(String(params.id), {
      accountStatus: 'suspended',
      suspendedAt: new Date().toISOString(),
    }),
  ),

  http.post('*/api/v1/admin/users/:id/reactivate', ({ params }) =>
    mutate(String(params.id), { accountStatus: 'active', suspendedAt: null }),
  ),

  http.post('*/api/v1/admin/users/:id/enforce-mfa', ({ params }) => {
    const member = members.find((candidate) => candidate.id === String(params.id));
    if (member === undefined) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return mutate(String(params.id), { mfa: { enrolled: true, methods: ['totp'] } });
  }),

  http.patch('*/api/v1/admin/users/:id/role', async ({ params, request }) => {
    const body = (await request.json()) as { role?: UserRole };
    if (body.role === undefined) {
      return HttpResponse.json({ error: 'validation_failed' }, { status: 400 });
    }
    return mutate(String(params.id), { role: body.role });
  }),

  http.delete('*/api/v1/admin/users/:id', ({ params }) => {
    const id = String(params.id);
    const member = members.find((candidate) => candidate.id === id);
    if (member === undefined) return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    members = members.filter((candidate) => candidate.id !== id);
    return new HttpResponse(null, { status: 204 });
  }),
];

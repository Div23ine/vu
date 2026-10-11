import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { StaffMember, StaffSummary, UserRole } from '@vunvault/contracts';
import { queryKeys } from '@vunvault/lib';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../../../../lib/api';

/**
 * User-management hooks (Task 79) — the staff roster API (Task 30): the
 * summary tiles, the filtered roster and the five row writes (suspend,
 * reactivate, enforce-MFA, role change, delete). Every write refreshes the
 * roster AND the summary (`queryKeys.users.all()` covers list, summary and
 * invitations). The summary key extends the canonical `users` namespace —
 * packages/lib is out of this task's reach (the Task 67 precedent).
 *
 * No `'use client'` directive (the `use-login.ts` pattern).
 */

export const USERS_SUMMARY_KEY = [...queryKeys.users.all(), 'summary'] as const;

export interface RosterFilters {
  q: string;
  role: UserRole | '';
  status: string;
  mfa: 'enrolled' | 'not_enrolled' | '';
  page: number;
  pageSize: number;
}

function searchOf(filters: RosterFilters): string {
  const params = new URLSearchParams();
  if (filters.q !== '') params.set('q', filters.q);
  if (filters.role !== '') params.set('role', filters.role);
  if (filters.status !== '') params.set('status', filters.status);
  if (filters.mfa !== '') params.set('mfa', filters.mfa);
  params.set('page', String(filters.page));
  params.set('pageSize', String(filters.pageSize));
  return params.toString();
}

export function useStaffSummary() {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/admin/users/summary → 200 { data: StaffSummary }
    queryKey: USERS_SUMMARY_KEY,
    queryFn: () =>
      apiGet<{ data: StaffSummary }>('/api/v1/admin/users/summary').then(
        (response) => response.data,
      ),
  });
}

export function useStaffRoster(filters: RosterFilters) {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/admin/users?q=&role=&status=&mfa=&page=&pageSize=
    //   → 200 { data: StaffMember[]; total }
    queryKey: queryKeys.users.list(filters),
    queryFn: () =>
      apiGet<{ data: StaffMember[]; total: number }>(`/api/v1/admin/users?${searchOf(filters)}`),
  });
}

function useUserWrite<TBody extends object | void>(
  method: 'post' | 'patch' | 'delete',
  pathOf: (id: string) => string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: TBody }) => {
      const path = pathOf(id);
      const promise =
        method === 'post'
          ? apiPost<{ data: StaffMember }>(path, body ?? {})
          : method === 'patch'
            ? apiPatch<{ data: StaffMember }>(path, body ?? {})
            : apiDelete<void>(path);
      return promise as Promise<unknown>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all() });
    },
  });
}

export function useSuspendMember() {
  // TODO(backend-contract): POST /api/v1/admin/users/:id/suspend body { reason? }
  //   → 200 { data: StaffMember } | 409 self_action | last_super_admin | invalid_state
  return useUserWrite<{ reason?: string }>('post', (id) => `/api/v1/admin/users/${id}/suspend`);
}

export function useReactivateMember() {
  // TODO(backend-contract): POST /api/v1/admin/users/:id/reactivate → 200 { data: StaffMember } | 409 …
  return useUserWrite<void>('post', (id) => `/api/v1/admin/users/${id}/reactivate`);
}

export function useEnforceMfa() {
  // TODO(backend-contract): POST /api/v1/admin/users/:id/enforce-mfa → 200 { data: StaffMember } | 409 …
  return useUserWrite<void>('post', (id) => `/api/v1/admin/users/${id}/enforce-mfa`);
}

export function useChangeRole() {
  // TODO(backend-contract): PATCH /api/v1/admin/users/:id/role body { role } → 200 { data: StaffMember }
  return useUserWrite<{ role: UserRole }>('patch', (id) => `/api/v1/admin/users/${id}/role`);
}

export function useDeleteMember() {
  // TODO(backend-contract): DELETE /api/v1/admin/users/:id → 204
  return useUserWrite<void>('delete', (id) => `/api/v1/admin/users/${id}`);
}

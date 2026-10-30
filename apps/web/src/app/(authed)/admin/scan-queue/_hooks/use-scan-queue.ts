import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BulkScanActionBody,
  PaymentStatus,
  ReviewGateState,
  ScanJob,
  ScanQueueSummary,
  ScanStatus,
  ScanType,
  StaffMember,
} from '@vunvault/contracts';
import { queryKeys } from '@vunvault/lib';
import { apiGet, apiPost } from '../../../../../lib/api';

/**
 * Scan-queue hooks — the admin scans API : the summary
 * tiles, the filtered/sortable/paginated list, the bulk action and the two
 * row writes (request-payment, cancel). The list and summary poll every 15 s
 * while the tab is visible (the real-time push arrives in Layer L12); the
 * keys are the canonical `queryKeys.scans.adminQueue`/`summary` entries.
 *
 * No `'use client'` directive (the directive-free hook-module pattern).
 */

const POLL_MS = 15_000;

export interface ScanQueueFilters {
  q: string;
  status: ScanStatus | '';
  gate: ReviewGateState | '';
  payment: PaymentStatus | '';
  type: ScanType | '';
  page: number;
  pageSize: number;
}

export const EMPTY_FILTERS: Omit<ScanQueueFilters, 'page' | 'pageSize'> = {
  q: '',
  status: '',
  gate: '',
  payment: '',
  type: '',
};

function searchOf(filters: ScanQueueFilters): string {
  const params = new URLSearchParams();
  if (filters.q !== '') params.set('q', filters.q);
  if (filters.status !== '') params.set('status', filters.status);
  if (filters.gate !== '') params.set('gate', filters.gate);
  if (filters.payment !== '') params.set('payment', filters.payment);
  if (filters.type !== '') params.set('type', filters.type);
  params.set('page', String(filters.page));
  params.set('pageSize', String(filters.pageSize));
  return params.toString();
}

export function useScanQueueSummary() {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/admin/scans/summary → 200 { data: ScanQueueSummary }
    queryKey: queryKeys.scans.summary(),
    queryFn: () =>
      apiGet<{ data: ScanQueueSummary }>('/api/v1/admin/scans/summary').then(
        (response) => response.data,
      ),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });
}

export function useAdminScans(filters: ScanQueueFilters) {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/admin/scans?q=&status=&gate=&payment=&type=&page=&pageSize=
    //  → 200 { data: ScanJob[]; total }
    queryKey: queryKeys.scans.adminQueue(filters),
    queryFn: () =>
      apiGet<{ data: ScanJob[]; total: number }>(`/api/v1/admin/scans?${searchOf(filters)}`),
    placeholderData: keepPreviousData,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });
}

/** Active staff holding `scans:review` — the Assign-Reviewer roster. */
export function useReviewerRoster() {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/admin/users → 200 { data: StaffMember[]; total }
    queryKey: queryKeys.users.list({ purpose: 'scan-reviewers' }),
    queryFn: () =>
      apiGet<{ data: StaffMember[]; total: number }>('/api/v1/admin/users?pageSize=100').then(
        (response) => response.data,
      ),
  });
}

export interface BulkResult {
  updated: number;
  skippedIds: string[];
}

export function useBulkScanAction() {
  const queryClient = useQueryClient();
  return useMutation({
    // TODO(backend-contract): POST /api/v1/admin/scans/bulk body BulkScanActionBody
    //  → 200 { data: { updated; skippedIds } }
    mutationFn: (body: BulkScanActionBody) =>
      apiPost<{ data: BulkResult }>('/api/v1/admin/scans/bulk', body).then(
        (response) => response.data,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.scans.all() });
    },
  });
}

export function useRequestPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    // TODO(backend-contract): POST /api/v1/admin/scans/:id/request-payment → 200 { data: ScanJob }
    mutationFn: (id: string) =>
      apiPost<{ data: ScanJob }>(`/api/v1/admin/scans/${id}/request-payment`).then(
        (response) => response.data,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.scans.all() });
    },
  });
}

export function useCancelJob() {
  const queryClient = useQueryClient();
  return useMutation({
    // TODO(backend-contract): POST /api/v1/admin/scans/:id/cancel → 200 { data: ScanJob }
    mutationFn: (id: string) =>
      apiPost<{ data: ScanJob }>(`/api/v1/admin/scans/${id}/cancel`).then(
        (response) => response.data,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.scans.all() });
    },
  });
}

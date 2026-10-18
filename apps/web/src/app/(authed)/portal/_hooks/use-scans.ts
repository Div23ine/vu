import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateScanBody, ScanFinding, ScanJob } from '@vunvault/contracts';
import { isApiError, queryKeys } from '@vunvault/lib';
import { apiGet, apiPost } from '../../../../lib/api';

/**
 * Portal scans hooks — the release-locked client views of the
 * scans API . The list endpoint ALREADY excludes unreleased jobs
 * (the API's `clientVisibleWhere`), and a job the caller may not see is a
 * 404 — the UI never infers review, gate or payment state.
 *
 * No `'use client'` directive (the `use-login.ts` pattern).
 */

export interface AuthorisationUpload {
  uploadUrl: string;
  objectKey: string;
  expiresAt: string;
}

export function useScans(params: { page: number; pageSize: number }) {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/scans?page=&pageSize= → 200 { data: ScanJob[]; total }
    //  (released jobs of the caller's org only)
    queryKey: queryKeys.scans.list(params),
    queryFn: () =>
      apiGet<{ data: ScanJob[]; total: number }>(
        `/api/v1/scans?page=${params.page}&pageSize=${params.pageSize}`,
      ),
  });
}

export function useScan(id: string) {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/scans/:id → 200 { data: ScanJob } | 404 not_found
    queryKey: queryKeys.scans.detail(id),
    queryFn: () => apiGet<{ data: ScanJob }>(`/api/v1/scans/${id}`).then((r) => r.data),
    retry: false,
  });
}

export function useScanFindings(id: string) {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/scans/:id/findings → 200 { data: ScanFinding[] }
    queryKey: [...queryKeys.scans.detail(id), 'findings'],
    queryFn: () =>
      apiGet<{ data: ScanFinding[] }>(`/api/v1/scans/${id}/findings`).then((r) => r.data),
  });
}

export function useAuthorisationUrl() {
  return useMutation({
    // TODO(backend-contract): POST /api/v1/scans/authorisation-url body { contentType: "application/pdf"; sizeBytes }
    //  → 200 { data: { uploadUrl; objectKey; expiresAt } }
    mutationFn: (body: { contentType: 'application/pdf'; sizeBytes: number }) =>
      apiPost<{ data: AuthorisationUpload }>('/api/v1/scans/authorisation-url', body).then(
        (response) => response.data,
      ),
  });
}

export function useCreateScan() {
  const queryClient = useQueryClient();
  return useMutation({
    // TODO(backend-contract): POST /api/v1/scans body CreateScanBody
    //  → 201 { data: ScanJob } | 422 { error: "authorisation_missing" | "target_not_allowed" }
    mutationFn: (body: CreateScanBody) =>
      apiPost<{ data: ScanJob }>('/api/v1/scans', body).then((response) => response.data),
    onSuccess: () => {
      // The new job stays INVISIBLE until the review gate releases it — this
      // invalidation only keeps counts honest once it does.
      void queryClient.invalidateQueries({ queryKey: ['scans'] });
    },
  });
}

/** `404` on a release-locked read means "not yours (or not released) — or gone". */
export function isScanNotFound(error: unknown): boolean {
  return isApiError(error) && error.status === 404;
}

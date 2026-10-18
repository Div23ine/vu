import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Advisory,
  AdvisoryDraftBody,
  AdvisoryPatchStatus,
  AdvisoryStatus,
  AdvisorySummary,
  BroadcastEstimate,
  DraftListItem,
  NvdImportResult,
} from '@vunvault/contracts';
import { apiGet, apiPatch, apiPost, apiPut } from '../../../../../lib/api';

/**
 * Zero-Day desk data hooks — the admin advisory API : the
 * summary tiles, the published list, the draft list, the NVD import probe and
 * the four writes (save draft, patch status, retract, and the draft re-read a
 * panel click needs).
 *
 * `queryKeys` (packages/lib) has no intel namespace and this task must not
 * touch packages/lib, so the keys live here — the an earlier iteration `ADVISORIES_KEY`
 * precedent. They are deliberately distinct from the CLIENT feed key: the
 * portal sees published-and-matched advisories, this desk sees every status.
 *
 * Every write invalidates the whole `admin-advisories` namespace so the tiles,
 * the drafts panel and the published table cannot drift apart.
 *
 * No `'use client'` directive (the `use-login.ts` pattern).
 */

export const ADMIN_ADVISORIES_KEY = ['admin-advisories'] as const;
export const ADMIN_ADVISORY_SUMMARY_KEY = [...ADMIN_ADVISORIES_KEY, 'summary'] as const;
export const ADMIN_ADVISORY_DRAFTS_KEY = [...ADMIN_ADVISORIES_KEY, 'drafts'] as const;

export function adminAdvisoryListKey(status: AdvisoryStatus) {
  return [...ADMIN_ADVISORIES_KEY, 'list', status] as const;
}

/** The table shows the last six; the endpoint returns the published set. */
export const RECENT_PUBLISHED_LIMIT = 6;

export function useAdvisorySummary() {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/admin/advisories/summary → 200 { data: AdvisorySummary }
    queryKey: ADMIN_ADVISORY_SUMMARY_KEY,
    queryFn: () =>
      apiGet<{ data: AdvisorySummary }>('/api/v1/admin/advisories/summary').then(
        (response) => response.data,
      ),
  });
}

export function useDraftList() {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/admin/advisories/drafts → 200 { data: DraftListItem[] }
    queryKey: ADMIN_ADVISORY_DRAFTS_KEY,
    queryFn: () =>
      apiGet<{ data: DraftListItem[] }>('/api/v1/admin/advisories/drafts').then(
        (response) => response.data,
      ),
  });
}

export function usePublishedAdvisories() {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/admin/advisories?status=published
    //  → 200 { data: Advisory[]; total }
    queryKey: adminAdvisoryListKey('published'),
    queryFn: () =>
      apiGet<{ data: Advisory[]; total: number }>('/api/v1/admin/advisories?status=published').then(
        (response) => response.data,
      ),
  });
}

/**
 * The full draft behind a panel row.
 *
 * `GET /admin/advisories/drafts` returns the light `DraftListItem` (CVE, title,
 * author, note) — not enough to refill the editor — and the contract has no
 * `GET /:id`, so a click re-reads the draft list and picks the row out. A
 * mutation rather than a query: it is an imperative fetch with no cache value.
 */
export function useLoadDraft() {
  return useMutation({
    // TODO(backend-contract): GET /api/v1/admin/advisories?status=draft → 200 { data: Advisory[]; total }
    mutationFn: async (id: string): Promise<Advisory | null> => {
      const response = await apiGet<{ data: Advisory[]; total: number }>(
        '/api/v1/admin/advisories?status=draft',
      );
      return response.data.find((advisory) => advisory.id === id) ?? null;
    },
  });
}

/**
 * NVD import. A `GET` driven by a button, so it is a mutation: it must run on
 * demand, surface 404/502 to the caller and never auto-save (the spec's rule).
 */
export function useNvdImport() {
  return useMutation({
    // TODO(backend-contract): GET /api/v1/admin/advisories/nvd?cveId=
    //  → 200 { data: NvdImportResult } | 400 | 404 not_found | 502 upstream_unavailable
    mutationFn: (cveId: string) =>
      apiGet<{ data: NvdImportResult }>(
        `/api/v1/admin/advisories/nvd?cveId=${encodeURIComponent(cveId)}`,
      ).then((response) => response.data),
  });
}

export interface SaveAdvisoryInput {
  /** `null` creates; an id updates (and switches the editor to `PUT`). */
  id: string | null;
  body: AdvisoryDraftBody;
}

export function useSaveAdvisory() {
  const queryClient = useQueryClient();
  return useMutation({
    // TODO(backend-contract): POST /api/v1/admin/advisories body AdvisoryDraftBody
    //  → 201 { data: Advisory } | 409 cve_exists
    // TODO(backend-contract): PUT /api/v1/admin/advisories/:id body AdvisoryDraftBody
    //  → 200 { data: Advisory } | 409 not_editable
    mutationFn: ({ id, body }: SaveAdvisoryInput) =>
      id === null
        ? apiPost<{ data: Advisory }>('/api/v1/admin/advisories', body)
        : apiPut<{ data: Advisory }>(`/api/v1/admin/advisories/${id}`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_ADVISORIES_KEY });
    },
  });
}

export interface PatchStatusInput {
  id: string;
  patchStatus: AdvisoryPatchStatus;
}

export function useUpdatePatchStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    // TODO(backend-contract): PATCH /api/v1/admin/advisories/:id/patch-status
    //  body { patchStatus } → 200 { data: Advisory }
    mutationFn: ({ id, patchStatus }: PatchStatusInput) =>
      apiPatch<{ data: Advisory }>(`/api/v1/admin/advisories/${id}/patch-status`, { patchStatus }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_ADVISORIES_KEY });
    },
  });
}

export interface RetractInput {
  id: string;
  /** The contract requires 10–500 characters; the dialog enforces it first. */
  note: string;
}

export function useRetractAdvisory() {
  const queryClient = useQueryClient();
  return useMutation({
    // TODO(backend-contract): POST /api/v1/admin/advisories/:id/retract body { note }
    //  → 200 { data: Advisory } | 422 validation_failed
    mutationFn: ({ id, note }: RetractInput) =>
      apiPost<{ data: Advisory }>(`/api/v1/admin/advisories/${id}/retract`, { note }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ADMIN_ADVISORIES_KEY });
    },
  });
}

/**
 * The audience an emergency broadcast would reach.
 *
 * A `POST` that only reads — the API computes the match against client asset
 * inventories — so it is a query with `retry: false` rather than a mutation:
 * the reach panel and the an earlier iteration dialog both render it, and neither should
 * re-post on a transient failure. Disabled until the advisory exists, because
 * the endpoint is per-advisory (`/:id/estimate`) and an unsaved draft has no
 * id; the panel shows `—` until the first save.
 */
export function useBroadcastEstimate(advisoryId: string | null) {
  return useQuery({
    // TODO(backend-contract): POST /api/v1/admin/advisories/:id/estimate
    //  → 200 { data: BroadcastEstimate }
    queryKey: [...ADMIN_ADVISORIES_KEY, 'estimate', advisoryId],
    enabled: advisoryId !== null,
    retry: false,
    queryFn: () =>
      apiPost<{ data: BroadcastEstimate }>(`/api/v1/admin/advisories/${advisoryId}/estimate`).then(
        (response) => response.data,
      ),
  });
}

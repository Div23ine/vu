import { useQuery } from '@tanstack/react-query';
import type { StudioItem, StudioStatus } from '@vunvault/contracts';
import { apiGet } from '../../../../../lib/api';

/**
 * Content Studio hooks — the badge gate and the author's
 * submissions on the an earlier iteration API. The badge is SERVER-SIDE
 * (`profiles.verified_blogger_at`, granted by an administrator after a
 * Contact-page verification request); nothing here reads browser storage
 * and the UI never grants badges.
 *
 * `queryKeys` (packages/lib) has no studio entries and this task must not
 * touch packages/lib, so the keys live here — the an earlier iteration
 * `SECURITY_STATUS_KEY` precedent.
 *
 * No `'use client'` directive (the directive-free hook-module pattern): only client
 * components import this module.
 */

export const STUDIO_STATUS_KEY = ['studio', 'status'] as const;
export const STUDIO_SUBMISSIONS_KEY = ['studio', 'submissions'] as const;

export function useStudioStatus() {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/studio/status → 200 { data: StudioStatus }
    queryKey: STUDIO_STATUS_KEY,
    queryFn: () =>
      apiGet<{ data: StudioStatus }>('/api/v1/studio/status').then((response) => response.data),
  });
}

/**
 * The submissions list. Only mounted behind the gate — an unverified caller
 * would be answered `403 badge_required`, so the UI never asks.
 */
export function useStudioSubmissions() {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/studio/submissions → 200 { data: StudioItem[]; total } | 403 badge_required
    queryKey: STUDIO_SUBMISSIONS_KEY,
    queryFn: () =>
      apiGet<{ data: StudioItem[]; total: number }>('/api/v1/studio/submissions').then(
        (response) => response.data,
      ),
  });
}

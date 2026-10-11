import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClientProfile, UpdateProfileBody } from '@vunvault/contracts';
import { queryKeys } from '@vunvault/lib';
import { apiGet, apiPatch } from '../../../../../lib/api';

/**
 * Client-profile hooks (Task 68). The GET shares its query key with Task 66's
 * billing caption read (`queryKeys.profile()`), so the two pages read one
 * cache entry; the PATCH invalidates the profile AND the session (the header
 * greeting mirrors the display name).
 *
 * No `'use client'` directive (the `use-login.ts` pattern).
 */

export function useClientProfile() {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/profile → 200 { data: ClientProfile } | 403 no_org
    queryKey: queryKeys.profile(),
    queryFn: () =>
      apiGet<{ data: ClientProfile }>('/api/v1/profile').then((response) => response.data),
  });
}

export function useUpdateClientProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    // TODO(backend-contract): PATCH /api/v1/profile body UpdateProfileBody
    //   → 200 { data: ClientProfile } | 400 validation_failed
    mutationFn: (body: UpdateProfileBody) =>
      apiPatch<{ data: ClientProfile }>('/api/v1/profile', body).then((response) => response.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.session() });
    },
  });
}

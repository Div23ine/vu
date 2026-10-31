import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Invitation, ProvisionInviteBody } from '@vunvault/contracts';
import { queryKeys } from '@vunvault/lib';
import { apiPost } from '../../../../../lib/api';

/**
 * Provisioning hook — `POST /admin/users/invitations` with the
 * contract's `ProvisionInviteBody` (the `draft: true` variant stores without
 * sending). Success invalidates the users namespace so the roster's pending
 * slice and the summary tiles refresh.
 *
 * No `'use client'` directive (the directive-free hook-module pattern).
 */

export function useProvisionInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    // TODO(backend-contract): POST /api/v1/admin/users/invitations body ProvisionInviteBody
    //  → 201 { data: Invitation } | 400 validation_failed | 403 | 409 email_taken
    mutationFn: (body: ProvisionInviteBody) =>
      apiPost<{ data: Invitation }>('/api/v1/admin/users/invitations', body).then(
        (response) => response.data,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all() });
    },
  });
}

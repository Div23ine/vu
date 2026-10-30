import { useMutation, useQuery } from '@tanstack/react-query';
import type { AcceptInvitationBody, InvitationPreview, SessionUser } from '@vunvault/contracts';
import { queryKeys } from '@vunvault/lib';
import { apiGet, apiPost } from '../../../lib/api';

/**
 * Auth-adjacent hooks — the small flows around the session: the public
 * invitation preview + acceptance, and the newsletter double-opt-in confirm.
 * (Forgot/reset password died with password login in Phase 5.)
 *
 * No `'use client'` directive (the directive-free hook-module pattern): these hooks are
 * only ever called from client components, which pull the module into their
 * bundle.
 */

/** The accept response: the new aal1 session plus the mandatory-MFA flag. */
export interface AcceptInvitationResponse {
  data: SessionUser;
  mfaEnrolmentRequired: true;
  deviceLabel?: string;
}

export function useInvitationPreview(token: string | null) {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/invitations/:token
    //  → 200 { data: InvitationPreview } | 404 not_found (unknown, expired and
    //  used tokens all answer 404 — the endpoint must not reveal which exist)
    queryKey: [...queryKeys.users.invitations(), 'preview', token],
    queryFn: () =>
      apiGet<{ data: InvitationPreview }>(`/api/v1/invitations/${token}`).then(
        (response) => response.data,
      ),
    enabled: token !== null,
  });
}

export function useAcceptInvitation(token: string) {
  return useMutation({
    // TODO(backend-contract): POST /api/v1/invitations/:token/accept body { password; confirmPassword }
    //  → 201 { data: SessionUser; mfaEnrolmentRequired: true } | 400 | 404 | 422 breached_password
    mutationFn: (body: AcceptInvitationBody) =>
      apiPost<AcceptInvitationResponse>(`/api/v1/invitations/${token}/accept`, body),
  });
}

export function useConfirmNewsletter() {
  return useMutation({
    // TODO(backend-contract): POST /api/v1/newsletter/confirm body { token } → 204 | 404 not_found
    mutationFn: (token: string) => apiPost<void>('/api/v1/newsletter/confirm', { token }),
  });
}

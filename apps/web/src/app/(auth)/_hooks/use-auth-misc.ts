import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  AcceptInvitationBody,
  ForgotPasswordBody,
  InvitationPreview,
  ResetPasswordBody,
  SessionUser,
} from '@vunvault/contracts';
import { queryKeys } from '@vunvault/lib';
import { apiGet, apiPost } from '../../../lib/api';

/**
 * Auth-adjacent hooks — the four small flows around the session:
 * forgot password (always-202, enumeration-safe), reset password, the public
 * invitation preview + acceptance, and the newsletter double-opt-in confirm.
 *
 * No `'use client'` directive (the `use-login.ts` pattern): these hooks are
 * only ever called from client components, which pull the module into their
 * bundle.
 */

/** The accept response: the new aal1 session plus the mandatory-MFA flag. */
export interface AcceptInvitationResponse {
  data: SessionUser;
  mfaEnrolmentRequired: true;
  deviceLabel?: string;
}

export function useForgotPassword() {
  return useMutation({
    // TODO(backend-contract): POST /api/v1/auth/forgot-password body { email } → 202 {}
    //  (always 202 — the route never reveals whether the address exists)
    mutationFn: (body: ForgotPasswordBody) => apiPost<void>('/api/v1/auth/forgot-password', body),
  });
}

export function useResetPassword() {
  return useMutation({
    // TODO(backend-contract): POST /api/v1/auth/reset-password body { token; newPassword; confirmPassword }
    //  → 204 | 400 | 410 { error: "token_invalid" } | 422 { error: "breached_password" }
    mutationFn: (body: ResetPasswordBody) => apiPost<void>('/api/v1/auth/reset-password', body),
  });
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

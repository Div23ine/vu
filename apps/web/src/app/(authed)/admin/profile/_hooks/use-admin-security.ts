import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  DeactivationRequestBody,
  NotificationPrefs,
  RevokeOthersResponse,
  SessionView,
} from '@vunvault/contracts';
import { apiDelete, apiGet, apiPost, apiPut } from '../../../../../lib/api';

/**
 * Admin account-security hooks — the parts of the administrator's
 * own account that the client Password Manager does NOT already cover: the
 * device-session list with its per-row revoke, the sign-out-everyone-else
 * action, the deactivation request and the notification channel matrix.
 *
 * Password, TOTP, hardware keys and recovery codes are deliberately absent:
 * an earlier iteration's portal hooks already own them and this task IMPORTS those
 * components rather than re-implementing them, so a second copy of the same
 * mutation would be a second source of truth.
 *
 * Keys are local (the an earlier iteration `SECURITY_STATUS_KEY` precedent) because
 * packages/lib has no session or notification namespace and this task must not
 * add one.
 *
 * No `'use client'` directive (the `use-login.ts` pattern).
 */

export const SESSIONS_KEY = ['account', 'sessions'] as const;
export const NOTIFICATIONS_KEY = ['account', 'notifications'] as const;

export function useAccountSessions() {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/account/sessions → 200 { data: SessionView[] }
    queryKey: SESSIONS_KEY,
    queryFn: () =>
      apiGet<{ data: SessionView[] }>('/api/v1/account/sessions').then((response) => response.data),
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    // TODO(backend-contract): DELETE /api/v1/account/sessions/:id → 204
    mutationFn: (id: string) => apiDelete<void>(`/api/v1/account/sessions/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });
}

export function useRevokeOtherSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    // TODO(backend-contract): POST /api/v1/account/revoke-others → 200 { data: { revoked } }
    mutationFn: () =>
      apiPost<RevokeOthersResponse>('/api/v1/account/revoke-others').then(
        (response) => response.data.revoked,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });
}

export function useRequestDeactivation() {
  return useMutation({
    // TODO(backend-contract): POST /api/v1/account/deactivation-request
    //  body { reason } → 202 | 409 already_requested | 422 validation_failed
    mutationFn: (body: DeactivationRequestBody) =>
      apiPost<void>('/api/v1/account/deactivation-request', body),
  });
}

export function useNotificationPrefs() {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/account/notifications → 200 { data: NotificationPrefs }
    queryKey: NOTIFICATIONS_KEY,
    queryFn: () =>
      apiGet<{ data: NotificationPrefs }>('/api/v1/account/notifications').then(
        (response) => response.data,
      ),
  });
}

export function useUpdateNotificationPrefs() {
  const queryClient = useQueryClient();
  return useMutation({
    // TODO(backend-contract): PUT /api/v1/account/notifications
    //  body NotificationPrefs → 200 { data: NotificationPrefs } | 422 validation_failed
    mutationFn: (body: NotificationPrefs) =>
      apiPut<{ data: NotificationPrefs }>('/api/v1/account/notifications', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}

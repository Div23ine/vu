'use client';

import { useMutation } from '@tanstack/react-query';
import type {
  MfaSetupAbandonResponse,
  MfaSetupOptionsResponse,
  MfaSetupVerifyBody,
  SessionUser,
} from '@vunvault/contracts';
import { apiPost } from '../../../../lib/api';

/**
 * Forced first-sign-in MFA setup hooks (Phase 2).
 *
 * Three legs, all guarded by the HttpOnly `vv_mfa` challenge cookie: options
 * starts a TOTP enrolment against the sealed pre-MFA session, verify accepts
 * the first correct code and opens the FULL session (cookies rotate to
 * vv_at/vv_rt), abandon ends the window — for an administrator inside the
 * timed window that means `blocked_mfa_setup` until a super admin unblocks
 * the account. A closed window answers 410 `setup_expired` (the block is
 * applied lazily); an expired pre-MFA challenge answers 410
 * `challenge_expired` and the visitor starts over at /login.
 */

export type MfaSetupOptions = MfaSetupOptionsResponse['data'];

export function useMfaSetupOptions() {
  return useMutation({
    // POST /api/v1/auth/mfa/setup/options → 200 MfaSetupOptionsResponse
    //  | 403 (challenge is not a setup challenge) | 410 challenge_expired | 410 setup_expired
    mutationFn: () =>
      apiPost<MfaSetupOptionsResponse>('/api/v1/auth/mfa/setup/options').then(
        (response) => response.data,
      ),
  });
}

export function useMfaSetupVerify() {
  return useMutation({
    // POST /api/v1/auth/mfa/setup/verify body MfaSetupVerifyBody
    //  → 200 { data: SessionUser } | 401 mfa_failed | 410 setup_expired | 410 challenge_expired
    mutationFn: (body: MfaSetupVerifyBody) =>
      apiPost<{ data: SessionUser }>('/api/v1/auth/mfa/setup/verify', body).then(
        (response) => response.data,
      ),
  });
}

export function useMfaSetupAbandon() {
  return useMutation({
    // POST /api/v1/auth/mfa/setup/abandon → 200 MfaSetupAbandonResponse
    //  (`blocked: true` only for administrators inside a timed window)
    mutationFn: () =>
      apiPost<MfaSetupAbandonResponse>('/api/v1/auth/mfa/setup/abandon').then(
        (response) => response.data,
      ),
  });
}

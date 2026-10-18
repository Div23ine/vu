'use client';

import { useMutation } from '@tanstack/react-query';
import type { MfaVerifyBody, SessionUser } from '@vunvault/contracts';
import { apiPost } from '../../../../lib/api';
import type { WebAuthnRequestOptionsJson } from '../_lib/webauthn-client';

/**
 * MFA hooks .
 *
 * Four endpoints, four mutations — the dialog composes them per method:
 * verify (TOTP / email OTP / WebAuthn assertion), the email-OTP trigger
 * (202, also driven by Resend), the recovery-code exchange, and the WebAuthn
 * options fetch. Errors carry the API envelope (`mfa_failed`,
 * `challenge_expired`, `rate_limited`) for the dialog's verbatim copy.
 */

export function useMfaVerify() {
  return useMutation({
    // TODO(backend-contract): POST /api/v1/auth/mfa/verify body MfaVerifyBody
    //  → 200 { data: SessionUser } | 401 { error: "mfa_failed" } | 410 { error: "challenge_expired" }
    mutationFn: (body: MfaVerifyBody) =>
      apiPost<{ data: SessionUser }>('/api/v1/auth/mfa/verify', body).then(
        (response) => response.data,
      ),
  });
}

export function useMfaEmailOtp() {
  return useMutation({
    // TODO(backend-contract): POST /api/v1/auth/mfa/email-otp → 202 {} | 429 rate_limited
    mutationFn: () => apiPost<void>('/api/v1/auth/mfa/email-otp'),
  });
}

export function useMfaRecovery() {
  return useMutation({
    // TODO(backend-contract): POST /api/v1/auth/mfa/recovery body { code: "XXXX-XXXX-XXXX" }
    //  → 200 { data: SessionUser } | 401 { error: "mfa_failed" } | 410 { error: "challenge_expired" }
    mutationFn: (code: string) =>
      apiPost<{ data: SessionUser }>('/api/v1/auth/mfa/recovery', { code }).then(
        (response) => response.data,
      ),
  });
}

export function useWebAuthnOptions() {
  return useMutation({
    // TODO(backend-contract): POST /api/v1/auth/mfa/webauthn/options → 200 { data: PublicKeyCredentialRequestOptionsJSON }
    mutationFn: () =>
      apiPost<{ data: WebAuthnRequestOptionsJson }>('/api/v1/auth/mfa/webauthn/options').then(
        (response) => response.data,
      ),
  });
}

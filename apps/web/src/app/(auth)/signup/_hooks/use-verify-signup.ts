'use client';

import { useMutation } from '@tanstack/react-query';
import type {
  SessionUser,
  SignupVerifyBody,
  TotpEnrollStart,
  TotpVerifyBody,
} from '@vunvault/contracts';
import { apiPost } from '../../../../lib/api';

/**
 * Signup verification hooks — the four endpoints behind the
 * three-step dialog: the mailbox OTP exchange (which opens the aal1 session
 * via HttpOnly cookies), the always-202 resend, and the mandatory TOTP
 * enrolment pair from an earlier iteration's account-security surface.
 */

/** The `data` half of `TotpEnrollStart` (factorId, qrCodeSvg, secret, uri). */
export type TotpEnroll = TotpEnrollStart['data'];

export function useVerifySignupEmail() {
  return useMutation({
    // TODO(backend-contract): POST /api/v1/auth/signup/verify-email body { email; code: string(6) }
    //  → 200 { data: SessionUser } | 401 { error: "otp_invalid" | "otp_exhausted" }
    //  | 410 { error: "otp_expired" } | 429
    mutationFn: (body: SignupVerifyBody) =>
      apiPost<{ data: SessionUser }>('/api/v1/auth/signup/verify-email', body).then(
        (response) => response.data,
      ),
  });
}

export function useResendSignupCode() {
  return useMutation({
    // TODO(backend-contract): POST /api/v1/auth/signup/resend body { email } → 202 {}
    //  (always 202 — whether the address has a pending signup is not public information)
    mutationFn: (email: string) => apiPost<void>('/api/v1/auth/signup/resend', { email }),
  });
}

export function useTotpEnroll() {
  return useMutation({
    // TODO(backend-contract): POST /api/v1/account/mfa/totp/enroll → 201 TotpEnrollStart
    mutationFn: () =>
      apiPost<TotpEnrollStart>('/api/v1/account/mfa/totp/enroll').then((response) => response.data),
  });
}

export function useTotpVerify() {
  return useMutation({
    // TODO(backend-contract): POST /api/v1/account/mfa/totp/verify body { factorId; code: string(6) }
    //  → 204 | 401 { error: "mfa_failed" }
    mutationFn: (body: TotpVerifyBody) => apiPost<void>('/api/v1/account/mfa/totp/verify', body),
  });
}

/** The base32 secret shown grouped in 4s: `JBSWY3DPEHPK3PXP` → `JBSW Y3DP EHPK 3PXP`. */
export function groupSecret(secret: string): string {
  return (secret.match(/.{1,4}/g) ?? []).join(' ');
}

/**
 * The QR as an `<img>` source — the SVG string from the API is NEVER injected
 * as markup (`dangerouslySetInnerHTML` is banned); it travels as a data URI.
 */
export function qrCodeSrc(qrCodeSvg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(qrCodeSvg)}`;
}

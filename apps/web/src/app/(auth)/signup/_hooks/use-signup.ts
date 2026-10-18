import { useMutation } from '@tanstack/react-query';
import type { SignupBody, SignupStartResponse } from '@vunvault/contracts';
import { apiPost } from '../../../../lib/api';

/**
 * Signup hooks + helpers .
 *
 * No `'use client'` directive on purpose (same split as an earlier iteration's
 * `use-login.ts`): `normalizePhone` is a pure helper, and `useSignup` is only
 * ever called from client components, which pull this module into their bundle.
 */

/**
 * Trim and strip the separators people type in phone numbers (spaces, dashes,
 * parentheses, dots) so the E.164 check sees digits only — the field's own
 * placeholder (`+254 705 998 032`) is a spaced international number.
 */
export function normalizePhone(raw: string): string {
  return raw.replace(/[\s\-().]/g, '');
}

export function useSignup() {
  return useMutation({
    // TODO(backend-contract): POST /api/v1/auth/signup body
    //  { fullName; email; phone?; country: string(2); accountType: "individual"|"company";
    //   password: string(min12); confirmPassword; description? }
    //  → 202 SignupStartResponse | 400 | 409 { error: "email_taken" }
    //  | 422 { error: "breached_password" } | 429
    mutationFn: (body: SignupBody) =>
      apiPost<SignupStartResponse>('/api/v1/auth/signup', body).then((response) => response.data),
  });
}

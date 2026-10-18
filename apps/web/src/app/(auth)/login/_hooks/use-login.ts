import { useMutation } from '@tanstack/react-query';
import type { LoginBody, LoginResponse } from '@vunvault/contracts';
import { apiPost } from '../../../../lib/api';

/**
 * Login hooks + helpers .
 *
 * No `'use client'` directive on purpose: `safeNextPath` is a pure guard the
 * SERVER route uses to sanitise `?next=`, and `useLogin` is only ever called
 * from client components (which pull this module into their bundle). Keeping
 * the module directive-free lets one file own both.
 */

/**
 * Open-redirect guard: a usable `next` must start with a single `/` —
 * protocol-relative (`//evil.com`), backslash-trick (`/\evil.com`) and
 * absolute URLs are rejected. Invalid or absent → `null` (fall back to
 * `homeFor(role)`).
 */
export function safeNextPath(raw: string | undefined | null): string | null {
  if (typeof raw !== 'string' || raw === '') return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null;
  return raw;
}

export function useLogin() {
  return useMutation({
    // TODO(backend-contract): POST /api/v1/auth/login body { email; password(min8); remember? }
    //  → 200 { data: { user: SessionUser | null; mfaRequired; mfaMethods } }
    //  | 401 { error: "invalid_credentials" } | 429 { error: "rate_limited" }
    mutationFn: (body: LoginBody) =>
      apiPost<LoginResponse>('/api/v1/auth/login', body).then((response) => response.data),
  });
}

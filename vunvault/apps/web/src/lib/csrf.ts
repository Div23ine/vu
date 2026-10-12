import { apiGet } from './api';

/**
 * CSRF bootstrap.
 *
 * Mutations authenticate with the double-submit pattern: the API sets a
 * readable (non-HttpOnly) `vv_csrf` cookie, and `@vunvault/lib` echoes it back
 * as the `x-csrf-token` header on every POST/PUT/PATCH/DELETE. For that to
 * work on the very first mutation of a page load, the cookie has to exist
 * before anything is submitted — so `Providers` calls `ensureCsrf()` once on
 * mount.
 */

// TODO(backend-contract): GET /api/v1/auth/csrf → 200 { data: { csrfToken: string } }
// and `set-cookie: vv_csrf=…` (readable, SameSite=Strict). Verified against the
// contracts package when the auth routes are wired end to end.
interface CsrfTokenResponse {
  data: { csrfToken: string };
}

/** Memo of the single bootstrap call made per page load. */
let bootstrap: Promise<void> | null = null;

/**
 * Fetch the CSRF cookie once per page load. Memoised: later callers receive
 * the same promise, so a page with several mounted clients still performs a
 * single request. A no-op during server rendering — the cookie is only needed
 * by browser-side mutations.
 *
 * A failed bootstrap is not retried within the page load (the memo keeps the
 * rejection); the failure surfaces visibly at the first mutation, which the
 * API rejects for a missing token.
 */
export function ensureCsrf(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  bootstrap ??= apiGet<CsrfTokenResponse>('/api/v1/auth/csrf').then(() => undefined);
  return bootstrap;
}

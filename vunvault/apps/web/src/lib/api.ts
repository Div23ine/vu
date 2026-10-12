import { apiGet, configureApi, isApiError } from '@vunvault/lib';
import { env } from '../env';

/**
 * App-side API bootstrap.
 *
 * `@vunvault/lib` ships the transport (Task 7) but deliberately knows nothing
 * about this app: the base URL and the session-expiry behaviour are configured
 * here, once, at module load. Every module that talks to the API imports its
 * helpers from this file rather than from `@vunvault/lib` directly, so the
 * configuration is guaranteed to have run before the first request.
 *
 * Security rules inherited from the transport and NOT relaxed here:
 * credentials are cookies (`credentials: "include"`), no `Authorization`
 * header ever leaves the browser, and mutations carry the double-submit CSRF
 * token from the readable `vv_csrf` cookie (see `csrf.ts`).
 */

export {
  apiDelete,
  apiFetch,
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
  ApiError,
  isApiError,
  type ApiFetchInit,
  type ErrorEnvelope,
} from '@vunvault/lib';

/**
 * Number of quiet requests currently in flight.
 *
 * The session probe (`apiGetQuiet`) must not trigger the redirect below: an
 * anonymous visitor on a marketing page gets a 401 from `GET /auth/session` on
 * every page load, and being flung to `/login` for browsing the home page
 * would be wrong. `apiFetch` invokes `onUnauthorized` synchronously before it
 * throws, and `@vunvault/lib` must not be modified for this task, so the
 * suppression lives in the handler this file owns: a quiet request increments
 * the counter for the duration of its call, and the handler stands down while
 * the counter is non-zero.
 */
let quietDepth = 0;

let configured = false;

function ensureConfigured(): void {
  if (configured) return;
  configured = true;
  configureApi({
    baseUrl: env.NEXT_PUBLIC_API_URL,
    onUnauthorized: () => {
      if (quietDepth > 0) return;
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.assign(
          '/login?next=' + encodeURIComponent(window.location.pathname + window.location.search),
        );
      }
    },
  });
}

// Module-level guard: importing this file is what configures the transport.
ensureConfigured();

/**
 * `GET` that resolves to `null` instead of throwing on 401, and suppresses
 * the global session-expiry redirect for its own call (see `quietDepth`).
 * Any other `ApiError` (and any network failure) still rejects.
 */
export async function apiGetQuiet<T>(path: string): Promise<T | null> {
  quietDepth += 1;
  try {
    return await apiGet<T>(path);
  } catch (error) {
    if (isApiError(error) && error.status === 401) return null;
    throw error;
  } finally {
    quietDepth -= 1;
  }
}

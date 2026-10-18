import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  SessionUser as SessionUserSchema,
  type Permission,
  type SessionUser,
} from '@vunvault/contracts';
import { env } from '../env';
import { can, isStaffRole } from './permissions';

/**
 * Server-side session .
 *
 * Server components and layout guards cannot use the client's TanStack Query
 * cache, so they read the session the same way the browser does — from the
 * HttpOnly cookies — by forwarding them to the API. The API stays the single
 * authority: nothing here decodes or trusts a JWT.
 *
 * This module must only be imported from server code (`next/headers` throws
 * in client components).
 */

// TODO(backend-contract): GET /api/v1/auth/session (server-side, cookie forwarded)
//  → 200 { data: SessionUser } | 401 { error: "unauthorized" }

/**
 * Fetch the current session for the incoming request, or `null` when there is
 * none. Fails closed: a 401, any other non-2xx, a malformed payload or a
 * network failure all resolve to `null` — an unreachable API must never be
 * mistaken for an authenticated user.
 */
export async function getServerSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const cookieHeader = store
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
  // No cookies at all → the API could only answer 401; skip the round trip.
  if (cookieHeader === '') return null;

  try {
    const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/v1/auth/session`, {
      headers: { cookie: cookieHeader, accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (typeof body !== 'object' || body === null) return null;
    const parsed = SessionUserSchema.safeParse((body as { data?: unknown }).data);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export interface RequireSessionOptions {
  /** Require one of the six staff roles (else `/forbidden`). */
  staff?: boolean;
  /** Require a specific permission (else `/forbidden`). */
  permission?: Permission;
}

/**
 * Layout/page guard: returns the session or redirects.
 *
 * - no session      → `/login`
 * - `staff` and not staff → `/forbidden`
 * - `permission` missing → `/forbidden`
 * - staff without MFA   → `/login?error=mfa_required` (see below)
 */
export async function requireSession(options: RequireSessionOptions = {}): Promise<SessionUser> {
  const user = await getServerSession();
  if (user === null) redirect('/login');
  if (options.staff === true && !isStaffRole(user.role)) redirect('/forbidden');
  if (options.permission !== undefined && !can(user, options.permission)) redirect('/forbidden');

  if (options.staff === true && !user.mfaEnrolled) {
    // PLACEHOLDER (per an earlier iteration): staff that authenticated at aal1 (password only)
    // are not sent to an enrolment screen. The intended destination,
    // `/admin/profile#security`, cannot host the enrolment yet — the API answers
    // `mfa_required` on admin calls for aal1 staff, so the very page that would
    // fix the problem is one they cannot load. Until Profile Settings (Part 4)
    // ships the enrolment flow outside the guarded admin area, unenrolled staff
    // are sent back to the login with a machine-readable error.
    redirect('/login?error=mfa_required');
  }

  return user;
}

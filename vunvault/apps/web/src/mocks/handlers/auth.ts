import { http, HttpResponse } from 'msw';
import {
  LoginBody,
  MfaVerifyBody,
  ROLE_PERMISSIONS,
  type SessionUser,
  type StaffMember,
} from '@vunvault/contracts';
import { clientProfile } from '@vunvault/contracts/fixtures/profile';
import { staffMembers } from '@vunvault/contracts/fixtures/users';

/**
 * Auth mock handlers.
 *
 * Used ONLY by tests (through `mocks/server.ts`) and the opt-in dev mock mode
 * (`NEXT_PUBLIC_API_MOCKING=enabled`, mounted by `MockGate`). Every identity
 * comes from the contract fixtures — no invented people, no invented emails —
 * so the mocks and the schemas can never drift apart silently.
 *
 * API contract mirrored here (implemented for real in `apps/api`, Task 26/40d):
 *   GET  /api/v1/auth/csrf    → 200 { data: { csrfToken: string } } + `vv_csrf` cookie
 *   GET  /api/v1/auth/session → 200 { data: SessionUser } | 401 { error: "unauthorized" }
 *   POST /api/v1/auth/login   → 200 LoginResponse | 401 { error: "invalid_credentials" }
 *   POST /api/v1/auth/logout  → 204
 */

/** Cookie a developer (or a test) sets to make the mock session endpoint answer 200. */
export const MOCK_SESSION_COOKIE = 'vv_mock_session=1';

const [reed] = staffMembers;
if (reed === undefined) {
  throw new Error('The auth mock handlers require the staffMembers fixture roster.');
}

function toSessionUser(member: StaffMember): SessionUser {
  return {
    id: member.id,
    email: member.email,
    fullName: member.fullName,
    role: member.role,
    orgId: null,
    permissions: [...ROLE_PERMISSIONS[member.role]],
    mfaEnrolled: member.mfa.enrolled,
  };
}

/** Dr. Evelyn Reed (super_admin) — the session the mock cookie unlocks. */
export const mockStaffSession: SessionUser = toSessionUser(reed);

/** Jane Wanjiru (Acme Fintech Ltd) — the client-portal login. */
export const mockClientSession: SessionUser = {
  id: clientProfile.id,
  email: clientProfile.email,
  fullName: clientProfile.fullName,
  role: 'client',
  orgId: null,
  permissions: [...ROLE_PERMISSIONS.client],
  mfaEnrolled: false,
};

function hasMockSessionCookie(request: Request): boolean {
  const header = request.headers.get('cookie');
  if (header === null) return false;
  return header.split(';').some((part) => part.trim() === MOCK_SESSION_COOKIE);
}

export const authHandlers = [
  http.get('*/api/v1/auth/csrf', () =>
    HttpResponse.json(
      { data: { csrfToken: 'mock' } },
      // Readable (non-HttpOnly) double-submit cookie, exactly like the real API.
      { headers: { 'set-cookie': 'vv_csrf=mock; Path=/' } },
    ),
  ),

  http.get('*/api/v1/auth/session', ({ request }) => {
    if (!hasMockSessionCookie(request)) {
      return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    return HttpResponse.json({ data: mockStaffSession });
  }),

  http.post('*/api/v1/auth/login', async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    const parsed = LoginBody.safeParse(body);
    if (parsed.success) {
      if (parsed.data.email === clientProfile.email) {
        // Client login: password accepted, no second factor enrolled.
        return HttpResponse.json({
          data: { user: mockClientSession, mfaRequired: false, mfaMethods: [] },
        });
      }
      if (parsed.data.email === reed.email) {
        // Staff login: the password check passes but MFA must complete first,
        // so `user` stays null (see LoginResponse in @vunvault/contracts).
        return HttpResponse.json({
          data: { user: null, mfaRequired: true, mfaMethods: ['totp', 'webauthn', 'email_otp'] },
        });
      }
    }
    return HttpResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }),

  // Login MFA completion (Task 107): the mock accepts any well-formed code.
  // OtpCode is six digits; the discriminated union covers totp/email_otp.
  http.post('*/api/v1/auth/mfa/verify', async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    const parsed = MfaVerifyBody.safeParse(body);
    if (parsed.success && parsed.data.method !== 'webauthn' && /^\d{6}$/.test(parsed.data.code)) {
      return HttpResponse.json({ data: mockStaffSession });
    }
    return HttpResponse.json({ error: 'mfa_failed' }, { status: 401 });
  }),

  http.post('*/api/v1/auth/mfa/email-otp', () => new HttpResponse(null, { status: 202 })),

  http.post('*/api/v1/auth/logout', () => new HttpResponse(null, { status: 204 })),
];

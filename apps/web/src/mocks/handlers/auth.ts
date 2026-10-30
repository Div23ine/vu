import { http, HttpResponse } from 'msw';
import {
  MAGIC_LINK_ACK_MESSAGE,
  MagicLinkRequestBody,
  MfaSetupVerifyBody,
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
 * API contract mirrored here (implemented for real in `apps/api`):
 * GET /api/v1/auth/csrf  → 200 { data: { csrfToken: string } } + `vv_csrf` cookie
 * GET /api/v1/auth/session → 200 { data: SessionUser } | 401 { error: "unauthorized" }
 * POST /api/v1/auth/magic-link → 200 { message } — ALWAYS 200 with the generic
 *   ack, registered or not (the real API never reveals registration status;
 *   tests that need a failure path use `server.use` overrides)
 * POST /api/v1/auth/mfa/verify → 200 { data: SessionUser } | 401 mfa_failed
 * POST /api/v1/auth/logout → 204
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

  // Magic-link request (Phase 1): the ONLY login credential leg. The body is
  // STRICT (a `password` field is rejected outright); the answer is always the
  // generic ack — identical bytes for registered and unregistered addresses.
  http.post('*/api/v1/auth/magic-link', async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    const parsed = MagicLinkRequestBody.safeParse(body);
    if (!parsed.success) {
      return HttpResponse.json({ error: 'validation_failed' }, { status: 400 });
    }
    return HttpResponse.json({ message: MAGIC_LINK_ACK_MESSAGE });
  }),

  // Login MFA completion : the mock accepts any well-formed code.
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

  // Phase 2 — forced first-sign-in MFA setup. The mock enrolment is untimed
  // (`deadlineEpochMs: null`); tests needing the admin countdown, the blocked
  // window (410 setup_expired) or `blocked: true` override via `server.use`.
  http.post('*/api/v1/auth/mfa/setup/options', () =>
    HttpResponse.json({
      data: {
        factorId: 'mock-factor',
        qrCodeSvg:
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><rect width="2" height="2"/></svg>',
        secret: 'JBSWY3DPEHPK3PXP',
        uri: 'otpauth://totp/VUNVAULT:mock%40vunvault.com?secret=JBSWY3DPEHPK3PXP&issuer=VUNVAULT',
        deadlineEpochMs: null,
      },
    }),
  ),

  http.post('*/api/v1/auth/mfa/setup/verify', async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    const parsed = MfaSetupVerifyBody.safeParse(body);
    if (parsed.success && parsed.data.factorId === 'mock-factor') {
      return HttpResponse.json({ data: mockStaffSession });
    }
    return HttpResponse.json({ error: 'mfa_failed' }, { status: 401 });
  }),

  http.post('*/api/v1/auth/mfa/setup/abandon', () =>
    HttpResponse.json({ data: { blocked: false } }),
  ),

  http.post('*/api/v1/auth/logout', () => new HttpResponse(null, { status: 204 })),
];

import { http, HttpResponse } from 'msw';
import {
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  TEAM_LABELS,
  type InvitationPreview,
  type SessionUser,
} from '@vunvault/contracts';
import { invitations } from '@vunvault/contracts/fixtures/users';

/**
 * Auth-adjacent mock handlers (Task 63): forgot/reset password, the public
 * invitation preview + acceptance, and the newsletter double-opt-in confirm.
 * (The newsletter SUBSCRIBE route already lives in `newsletter.ts`, Task 56 —
 * only `POST /newsletter/confirm` is added here.)
 *
 * Used ONLY by tests (through `mocks/server.ts`) and the opt-in dev mock mode.
 * Identities come from the contract fixtures — the first pending invitation
 * (Joseph Kariuki, security_analyst, Offensive Security) — so mocks and
 * schemas cannot drift apart silently.
 *
 * Mock convention: the literal token `MOCK_INVALID_TOKEN` answers the failure
 * state of each route (410 for a reset token, 404 for an invitation or a
 * newsletter token); every other token succeeds. It is 48 characters because
 * `ResetPasswordBody` requires `token.min(32)` — a shorter sentinel could
 * never reach the reset route through the form.
 *
 * API contract mirrored here (implemented for real in `apps/api`, Tasks 31 /
 * 40c / 40d):
 *   POST /api/v1/auth/forgot-password        → 202 {} (always)
 *   POST /api/v1/auth/reset-password         → 204 | 410 { error: "token_invalid" }
 *   GET  /api/v1/invitations/:token          → 200 { data: InvitationPreview } | 404
 *   POST /api/v1/invitations/:token/accept   → 201 { data: SessionUser; mfaEnrolmentRequired: true } | 404
 *   POST /api/v1/newsletter/confirm          → 204 | 404 { error: "not_found" }
 */

export const MOCK_INVALID_TOKEN = 'invalid0'.repeat(6);

const [firstInvitation] = invitations;
if (firstInvitation === undefined) {
  throw new Error('The auth-misc mock handlers require the invitations fixture roster.');
}

/** What the invitee sees before setting a password (labels exactly as the API mints them). */
export const mockInvitationPreview: InvitationPreview = {
  email: firstInvitation.email,
  fullName: firstInvitation.fullName,
  role: firstInvitation.role,
  roleLabel: ROLE_LABELS[firstInvitation.role],
  team: firstInvitation.team,
  teamLabel: TEAM_LABELS[firstInvitation.team],
  expiresAt: firstInvitation.expiresAt,
};

/** The aal1 staff session the acceptance opens (MFA still to enrol). */
export const mockAcceptedSession: SessionUser = {
  id: 'd1000000-0000-4000-8000-000000000003',
  email: mockInvitationPreview.email,
  fullName: mockInvitationPreview.fullName,
  role: mockInvitationPreview.role,
  orgId: null,
  permissions: [...ROLE_PERMISSIONS[mockInvitationPreview.role]],
  mfaEnrolled: false,
};

function isInvalidToken(value: string | readonly string[] | undefined): boolean {
  return value === MOCK_INVALID_TOKEN;
}

export const authMiscHandlers = [
  // Always 202 — whether the address exists is not public information.
  http.post('*/api/v1/auth/forgot-password', () => HttpResponse.json({}, { status: 202 })),

  http.post('*/api/v1/auth/reset-password', async ({ request }) => {
    const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
    if (body?.token === MOCK_INVALID_TOKEN) {
      return HttpResponse.json({ error: 'token_invalid' }, { status: 410 });
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.get('*/api/v1/invitations/:token', ({ params }) => {
    if (isInvalidToken(params.token)) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return HttpResponse.json({ data: mockInvitationPreview });
  }),

  http.post('*/api/v1/invitations/:token/accept', ({ params }) => {
    if (isInvalidToken(params.token)) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return HttpResponse.json(
      { data: mockAcceptedSession, mfaEnrolmentRequired: true as const },
      { status: 201 },
    );
  }),

  http.post('*/api/v1/newsletter/confirm', async ({ request }) => {
    const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
    if (body?.token === MOCK_INVALID_TOKEN) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return new HttpResponse(null, { status: 204 });
  }),
];

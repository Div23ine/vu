/**
 * Route documentation for the auth, profile, users, scans and pen-test surfaces.
 *
 * This is a *contract*, not an implementation: Layer L4 registers these routes on
 * Fastify and Layer L13 uses the same constant to emit the OpenAPI document. No
 * handler lives in this package.
 *
 * Every response is wrapped: `2xx → { data: T }` (lists: `{ data: T[]; total }`),
 * `4xx/5xx → { error, message?, details? }`.
 */

export interface RouteErrorDoc {
  status: number;
  code: string;
}

export interface RouteDoc {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'WS';
  path: string;
  /** Name of the Zod schema for the JSON body. */
  request?: string;
  /** Name of the Zod schema for the query string. */
  query?: string;
  /** Name of the Zod schema inside `{ data: … }`. */
  response?: string;
  successStatus: number;
  errors?: readonly RouteErrorDoc[];
  notes?: string;
}

export const ROUTES_A = [
  {
    method: 'GET',
    path: '/api/v1/invitations/:token',
    response: 'InvitationPreview',
    successStatus: 200,
    errors: [{ status: 404, code: 'not_found' }],
    notes: 'Public. Unknown, expired, revoked and already-accepted tokens all answer the same 404.',
  },
  {
    method: 'POST',
    path: '/api/v1/invitations/:token/accept',
    request: 'AcceptInvitationBody',
    response: 'SessionUser',
    successStatus: 201,
    errors: [
      { status: 400, code: 'validation_failed' },
      { status: 404, code: 'not_found' },
      { status: 422, code: 'breached_password' },
    ],
    notes:
      'Public. Creates the confirmed Supabase user and the profile, then signs the invitee in at aal1 with mfaEnrolmentRequired.',
  },
  {
    method: 'POST',
    path: '/api/v1/auth/signup',
    request: 'SignupBody',
    response: 'SignupStartResponse',
    successStatus: 202,
    errors: [
      { status: 400, code: 'validation_failed' },
      { status: 409, code: 'email_taken' },
      { status: 422, code: 'breached_password' },
      { status: 422, code: 'signup_not_allowed' },
      { status: 429, code: 'rate_limited' },
    ],
    notes:
      'Public (Task 40d). Creates the pending_verification profile and emails a six-digit OTP; sets no cookies. The password field is retained per the signup form (Q3) but NO password-login path exists — the only login credential is the magic link. Admin-roster emails are rejected with 422 signup_not_allowed ("This email is not eligible for signup.").',
  },
  {
    method: 'POST',
    path: '/api/v1/auth/signup/verify-email',
    request: 'SignupVerifyBody',
    response: 'SessionUser',
    successStatus: 200,
    errors: [
      { status: 401, code: 'otp_invalid' },
      { status: 401, code: 'otp_exhausted' },
      { status: 410, code: 'otp_expired' },
      { status: 429, code: 'rate_limited' },
    ],
    notes:
      'Public (Task 40d), step 2: the mailbox OTP activates the profile, opens the aal1 session and sets the cookies. Audited ACCOUNT_REGISTERED (stage email_verified).',
  },
  {
    method: 'POST',
    path: '/api/v1/auth/signup/resend',
    request: 'SignupResendBody',
    response: 'EmptyObject',
    successStatus: 202,
    notes:
      'Public. Always 202 {} — whether the address has a pending signup, and whether the 30-second cooldown allowed a send, are not public information.',
  },
  {
    method: 'GET',
    path: '/api/v1/auth/oauth/:provider/start',
    successStatus: 302,
    errors: [{ status: 404, code: 'not_found' }],
    notes:
      'Public (Task 40e). `provider` ∈ google | github | microsoft. Sets the HttpOnly `vv_oauth` state cookie (600 s) and redirects to the Supabase authorize URL with an s256 PKCE challenge and `redirect_to` = `<API_PUBLIC_URL>/api/v1/auth/oauth/callback`. An untrusted `next` falls back to `/portal`.',
  },
  {
    method: 'GET',
    path: '/api/v1/auth/oauth/callback',
    successStatus: 302,
    notes:
      'Public (Task 40e). Consumes the state atomically, exchanges code + verifier and redirects to WEB_ORIGIN: `<next>`, `/onboarding` (wizard incomplete), `/login/mfa?next=<next>` (second factor required), or `/login?error=` with `oauth_state`, `oauth_denied`, `oauth_email_unverified`, `oauth_not_allowed` (staff) or `oauth_email_in_use`. First sign-in creates a CLIENT account; identities are never auto-linked; no token ever appears in a URL or body.',
  },

  // ------------------------------------------------------- magic-link login
  {
    method: 'POST',
    path: '/api/v1/auth/magic-link',
    request: 'MagicLinkRequestBody',
    response: 'MagicLinkRequestResponse',
    successStatus: 200,
    errors: [{ status: 429, code: 'rate_limited' }],
    notes:
      'Public (Phase 1), the ONLY login entry point. Body is strict { email; next? } — a password field is a 400. Registered active address: mints a single-use HMAC token (TTL 15 min, email+purpose-bound, superseded by any newer link for the same address) and emails the verify link. Unregistered address: emails a signup invitation instead. The 200 body is one byte-identical literal either way; per-IP and per-email rate limits plus an invitation cooldown stop email-bombing. Audits MAGIC_LINK_ISSUED / SIGNUP_INVITE_SENT.',
  },
  {
    method: 'GET',
    path: '/api/v1/auth/magic-link/verify',
    query: 'MagicLinkVerifyQuery',
    successStatus: 302,
    notes:
      'Public (Phase 1). Consumes the token atomically (signature → TTL → single-use → email binding; a replay or a superseded link is dead), mints the aal1 session server-side and stores it encrypted in the pre-MFA challenge; sets ONLY the HttpOnly `vv_mfa` cookie — never `vv_at`/`vv_rt` — and redirects to `<WEB_ORIGIN>/login/mfa` (or `/login/mfa/setup` when first-login MFA enrolment is forced). Every failure redirects to `<WEB_ORIGIN>/login?error=magic_link_invalid|magic_link_expired|magic_link_used|account_blocked` with no other signal. Audits MAGIC_LINK_VERIFIED / AUTH_FAILURE.',
  },
  {
    method: 'POST',
    path: '/api/v1/auth/mfa/verify',
    request: 'MfaVerifyBody',
    response: 'SessionUser',
    successStatus: 200,
    errors: [
      { status: 401, code: 'mfa_failed' },
      { status: 410, code: 'challenge_expired' },
      { status: 429, code: 'rate_limited' },
    ],
    notes:
      'Public, guarded by the `vv_mfa` challenge cookie: the six-digit code (TOTP or email OTP) or a WebAuthn assertion against the live challenge opens the FULL session (aal2 for TOTP) and rotates the cookies. Five failures destroy the challenge; repeated failures add exponential backoff. Audits AUTH_SUCCESS / AUTH_MFA_FAILURE.',
  },
  {
    method: 'POST',
    path: '/api/v1/auth/mfa/email-otp',
    response: 'EmptyObject',
    successStatus: 202,
    errors: [
      { status: 410, code: 'challenge_expired' },
      { status: 429, code: 'rate_limited' },
    ],
    notes:
      'Public, `vv_mfa`-guarded. Emails the six-digit sign-in code for a live challenge (one send per 60 s). Only the digest is stored; the send is not audited — the verification is.',
  },
  {
    method: 'POST',
    path: '/api/v1/auth/mfa/webauthn/options',
    response: 'PublicKeyCredentialRequestOptionsJSON',
    successStatus: 200,
    errors: [{ status: 410, code: 'challenge_expired' }],
    notes: 'Public, `vv_mfa`-guarded. Starts a WebAuthn assertion ceremony for a live challenge.',
  },
  {
    method: 'POST',
    path: '/api/v1/auth/mfa/recovery',
    request: 'RecoveryCodeBody',
    response: 'SessionUser',
    successStatus: 200,
    errors: [
      { status: 401, code: 'mfa_failed' },
      { status: 410, code: 'challenge_expired' },
    ],
    notes: 'Public, `vv_mfa`-guarded. A single-use recovery code completes the challenge.',
  },
  {
    method: 'POST',
    path: '/api/v1/auth/refresh',
    successStatus: 204,
    errors: [{ status: 401, code: 'unauthorized' }],
    notes: 'Public. Rotates both session cookies from the refresh token.',
  },

  {
    method: 'POST',
    path: '/api/v1/auth/logout',
    successStatus: 204,
    notes: 'Clears the HttpOnly session cookie and the readable vv_csrf cookie.',
  },
  {
    method: 'GET',
    path: '/api/v1/auth/session',
    response: 'SessionUser',
    successStatus: 200,
    errors: [{ status: 401, code: 'unauthorized' }],
  },
  {
    method: 'GET',
    path: '/api/v1/profile',
    response: 'ClientProfile',
    successStatus: 200,
    errors: [{ status: 401, code: 'unauthorized' }],
  },
  {
    method: 'PATCH',
    path: '/api/v1/profile',
    request: 'UpdateProfileBody',
    response: 'ClientProfile',
    successStatus: 200,
    errors: [{ status: 400, code: 'validation_failed' }],
  },
  {
    method: 'GET',
    path: '/api/v1/admin/users',
    query: 'StaffListQuery',
    response: 'paginated(StaffMember)',
    successStatus: 200,
    errors: [
      { status: 401, code: 'unauthorized' },
      { status: 403, code: 'forbidden' },
    ],
    notes: 'Requires users:read.',
  },
  {
    method: 'GET',
    path: '/api/v1/admin/users/summary',
    response: 'StaffSummary',
    successStatus: 200,
    errors: [{ status: 403, code: 'forbidden' }],
    notes: 'Requires users:read.',
  },
  {
    method: 'POST',
    path: '/api/v1/admin/users/invitations',
    request: 'ProvisionInviteBody',
    response: 'Invitation',
    successStatus: 201,
    errors: [{ status: 403, code: 'forbidden' }],
    notes: 'Requires users:manage. Invitation links expire 72 hours after issue.',
  },
  {
    method: 'POST',
    path: '/api/v1/admin/users/invitations/:id/resend',
    response: 'Invitation',
    successStatus: 200,
    errors: [
      { status: 403, code: 'forbidden' },
      { status: 404, code: 'not_found' },
    ],
  },
  {
    method: 'DELETE',
    path: '/api/v1/admin/users/invitations/:id',
    successStatus: 204,
    errors: [
      { status: 403, code: 'forbidden' },
      { status: 404, code: 'not_found' },
    ],
  },
  {
    method: 'POST',
    path: '/api/v1/admin/users/:id/suspend',
    request: 'UserActionBody',
    response: 'StaffMember',
    successStatus: 200,
    errors: [{ status: 403, code: 'forbidden' }],
    notes: 'Revokes sessions and WebAuthn tokens; writes an audit entry.',
  },
  {
    method: 'POST',
    path: '/api/v1/admin/users/:id/reactivate',
    request: 'UserActionBody',
    response: 'StaffMember',
    successStatus: 200,
    errors: [{ status: 403, code: 'forbidden' }],
  },
  {
    method: 'POST',
    path: '/api/v1/admin/users/:id/enforce-mfa',
    request: 'UserActionBody',
    response: 'StaffMember',
    successStatus: 200,
    errors: [{ status: 403, code: 'forbidden' }],
  },
  {
    method: 'PATCH',
    path: '/api/v1/admin/users/:id/role',
    request: 'ChangeRoleBody',
    response: 'StaffMember',
    successStatus: 200,
    errors: [{ status: 403, code: 'forbidden' }],
  },
  {
    method: 'DELETE',
    path: '/api/v1/admin/users/:id',
    successStatus: 204,
    errors: [{ status: 403, code: 'forbidden' }],
    notes: 'Soft delete: `profiles.deleted_at` is set so audit actors keep resolving.',
  },
  {
    method: 'GET',
    path: '/api/v1/scans',
    query: 'ScanListQuery',
    response: 'paginated(ScanJob)',
    successStatus: 200,
    errors: [{ status: 401, code: 'unauthorized' }],
    notes: 'Clients see only released jobs of their own organisation.',
  },
  {
    method: 'POST',
    path: '/api/v1/scans',
    request: 'CreateScanBody',
    response: 'ScanJob',
    successStatus: 201,
    errors: [
      { status: 400, code: 'validation_failed' },
      { status: 403, code: 'forbidden' },
    ],
    notes: 'Requires scans:create and a signed authorisation reference.',
  },
  {
    method: 'GET',
    path: '/api/v1/admin/scans',
    query: 'ScanListQuery',
    response: 'paginated(ScanJob)',
    successStatus: 200,
    errors: [{ status: 403, code: 'forbidden' }],
  },
  {
    method: 'GET',
    path: '/api/v1/admin/scans/summary',
    response: 'ScanQueueSummary',
    successStatus: 200,
    errors: [{ status: 403, code: 'forbidden' }],
  },
  {
    method: 'POST',
    path: '/api/v1/admin/scans/:id/gate-decision',
    request: 'GateDecisionBody',
    response: 'ScanJob',
    successStatus: 200,
    errors: [
      { status: 403, code: 'forbidden' },
      { status: 409, code: 'payment_outstanding' },
    ],
    notes: 'Requires scans:review; releasing additionally requires scans:release.',
  },
  {
    method: 'POST',
    path: '/api/v1/admin/scans/bulk',
    request: 'BulkScanActionBody',
    response: 'BulkScanActionResult',
    successStatus: 200,
    errors: [{ status: 403, code: 'forbidden' }],
    notes: 'Response body is `{ data: { updated: number } }`.',
  },
  {
    method: 'POST',
    path: '/api/v1/admin/scans/:id/request-payment',
    response: 'ScanJob',
    successStatus: 200,
    errors: [{ status: 403, code: 'forbidden' }],
  },
  {
    method: 'POST',
    path: '/api/v1/admin/scans/:id/cancel',
    response: 'ScanJob',
    successStatus: 200,
    errors: [{ status: 403, code: 'forbidden' }],
  },
  {
    method: 'WS',
    path: '/api/v1/scans/:id/stream',
    successStatus: 101,
    notes:
      'WebSocket upgrade. Server → client: redacted text frames. Client → server: ' +
      'limited to { type: "abort" | "pause" | "resume" | "kill" }.',
  },
  {
    method: 'POST',
    path: '/api/v1/pentest-requests',
    request: 'CreatePentestRequestBody',
    response: 'PentestRequest',
    successStatus: 201,
    errors: [{ status: 400, code: 'validation_failed' }],
  },
] as const satisfies readonly RouteDoc[];

export type RoutesA = typeof ROUTES_A;

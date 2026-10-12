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
      { status: 429, code: 'rate_limited' },
    ],
    notes:
      'Public. Creates a `pending_verification` identity and emails a six-digit OTP; sets no cookies. A re-signup while pending replaces the unverified record.',
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
      'Public. Activates the profile, opens the aal1 session and sets the session cookies with mfaEnrolled false; the web app then runs the Task 27 TOTP enrolment.',
  },
  {
    method: 'POST',
    path: '/api/v1/auth/signup/resend',
    request: 'SignupResendBody',
    response: 'EmptyObject',
    successStatus: 202,
    notes:
      'Public. Always 202; re-issues the OTP at most once per 30 seconds for a pending profile.',
  },
  {
    method: 'POST',
    path: '/api/v1/auth/forgot-password',
    request: 'ForgotPasswordBody',
    response: 'EmptyObject',
    successStatus: 202,
    notes:
      'Public. Always 202 with an identical body for known and unknown addresses; emails a single-use 30-minute reset link for an active profile.',
  },
  {
    method: 'POST',
    path: '/api/v1/auth/reset-password',
    request: 'ResetPasswordBody',
    successStatus: 204,
    errors: [
      { status: 400, code: 'validation_failed' },
      { status: 410, code: 'token_invalid' },
      { status: 422, code: 'breached_password' },
    ],
    notes:
      'Public. Consumes the token atomically, revokes every session and audits PASSWORD_CHANGED; MFA still applies at the next login.',
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
      'Public (Task 40e). Consumes the state atomically, exchanges code + verifier and redirects to WEB_ORIGIN: `<next>`, `/onboarding` (wizard incomplete), `/login?mfa=1&next=<next>` (second factor enrolled), or `/login?error=` with `oauth_state`, `oauth_denied`, `oauth_email_unverified`, `oauth_not_allowed` (staff) or `oauth_email_in_use`. First sign-in creates a CLIENT account; identities are never auto-linked; no token ever appears in a URL or body.',
  },
  {
    method: 'POST',
    path: '/api/v1/auth/login',
    request: 'LoginBody',
    response: 'LoginResponse',
    successStatus: 200,
    errors: [
      { status: 401, code: 'invalid_credentials' },
      { status: 429, code: 'rate_limited' },
    ],
  },
  {
    method: 'POST',
    path: '/api/v1/auth/mfa/verify',
    request: 'MfaVerifyBody',
    response: 'SessionUser',
    successStatus: 200,
    errors: [{ status: 401, code: 'mfa_failed' }],
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

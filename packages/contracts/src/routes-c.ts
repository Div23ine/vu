import type { RouteDoc } from './routes-a';
import type { Permission } from './permissions';

/**
 * Route documentation for the zero-day desk, the Command Center dashboard,
 * account security, the Content Studio and client onboarding.
 *
 * A contract, not an implementation — Layer L4 registers these on Fastify and
 * Layer L13 emits the OpenAPI document from `ROUTES_A` + `ROUTES_B` + `ROUTES_C`.
 *
 * `permission` is the permission the API checks; `undefined` means any
 * authenticated user acting on their own account (or a public route).
 */

export interface RouteDocC extends RouteDoc {
  permission?: Permission;
}

export const ROUTES_C = [
  // --- Zero-day intel desk -------------------------------------------------
  {
    method: 'GET',
    path: '/api/v1/admin/advisories',
    query: 'AdvisoryListQuery',
    response: 'paginated(Advisory)',
    successStatus: 200,
    permission: 'intel:read',
  },
  {
    method: 'GET',
    path: '/api/v1/admin/advisories/summary',
    response: 'AdvisorySummary',
    successStatus: 200,
    permission: 'intel:read',
  },
  {
    method: 'GET',
    path: '/api/v1/admin/advisories/drafts',
    response: 'paginated(DraftListItem)',
    successStatus: 200,
    permission: 'intel:read',
  },
  {
    method: 'GET',
    path: '/api/v1/admin/advisories/nvd',
    query: 'NvdImportQuery',
    response: 'NvdImportResult',
    successStatus: 200,
    permission: 'intel:write',
    errors: [
      { status: 404, code: 'not_found' },
      { status: 502, code: 'nvd_unavailable' },
    ],
  },
  {
    method: 'POST',
    path: '/api/v1/admin/advisories',
    request: 'AdvisoryDraftBody',
    response: 'Advisory',
    successStatus: 201,
    permission: 'intel:write',
    errors: [{ status: 409, code: 'cve_exists' }],
  },
  {
    method: 'PUT',
    path: '/api/v1/admin/advisories/:id',
    request: 'AdvisoryDraftBody',
    response: 'Advisory',
    successStatus: 200,
    permission: 'intel:write',
    errors: [{ status: 409, code: 'not_editable' }],
  },
  {
    method: 'POST',
    path: '/api/v1/admin/advisories/:id/estimate',
    response: 'BroadcastEstimate',
    successStatus: 200,
    permission: 'intel:broadcast',
  },
  {
    method: 'POST',
    path: '/api/v1/admin/advisories/:id/broadcast',
    request: 'EmergencyBroadcastBody',
    response: 'BroadcastRecord',
    successStatus: 202,
    permission: 'intel:broadcast',
    errors: [
      { status: 400, code: 'validation_failed' },
      { status: 422, code: 'advisory_incomplete' },
      { status: 409, code: 'broadcast_in_progress' },
    ],
    notes: 'Irreversible. A mistake is handled with the retract route, never a delete.',
  },
  {
    method: 'POST',
    path: '/api/v1/admin/advisories/:id/rebroadcast',
    request: 'EmergencyBroadcastBody',
    response: 'BroadcastRecord',
    successStatus: 202,
    permission: 'intel:broadcast',
  },
  {
    method: 'POST',
    path: '/api/v1/admin/advisories/:id/retract',
    request: 'RetractBody',
    response: 'Advisory',
    successStatus: 200,
    permission: 'intel:broadcast',
  },
  {
    method: 'PATCH',
    path: '/api/v1/admin/advisories/:id/patch-status',
    request: 'PatchStatusBody',
    response: 'Advisory',
    successStatus: 200,
    permission: 'intel:write',
  },
  {
    method: 'GET',
    path: '/api/v1/admin/advisories/:id/broadcasts',
    response: 'BroadcastRecord[]',
    successStatus: 200,
    permission: 'intel:read',
    notes: 'Counters advance as the broadcast worker progresses.',
  },
  {
    method: 'GET',
    path: '/api/v1/admin/advisories/:id/broadcasts/stream',
    successStatus: 200,
    permission: 'intel:read',
    errors: [{ status: 403, code: 'forbidden' }],
    notes:
      'SSE (text/event-stream). Each `data:` frame is a BroadcastStreamEvent — ' +
      '`snapshot`, `progress` or `heartbeat`. Pushes the worker counters the ' +
      'polling endpoint above reports; the desk falls back to the poll when a ' +
      'browser has no EventSource.',
  },
  {
    method: 'GET',
    path: '/api/v1/advisories',
    response: 'paginated(ClientAdvisory)',
    successStatus: 200,
    notes: 'Client portal. Published advisories only.',
  },
  {
    method: 'POST',
    path: '/api/v1/advisories/:id/acknowledge',
    successStatus: 204,
    notes: 'Client portal. Idempotent per organisation — backs the "reach" metric.',
  },

  // --- Command Center dashboard -------------------------------------------
  {
    method: 'GET',
    path: '/api/v1/admin/dashboard/kpis',
    response: 'DashboardKpis',
    successStatus: 200,
    permission: 'dashboard:read',
  },
  {
    method: 'GET',
    path: '/api/v1/admin/dashboard/revenue',
    response: 'RevenueSummary',
    successStatus: 200,
    permission: 'dashboard:read',
  },
  {
    method: 'GET',
    path: '/api/v1/admin/dashboard/transactions',
    response: 'TransactionsResponse',
    successStatus: 200,
    permission: 'dashboard:read',
    notes: 'Accepts `?limit=6`.',
  },
  {
    method: 'GET',
    path: '/api/v1/admin/dashboard/traffic',
    response: 'TrafficSummary',
    successStatus: 200,
    permission: 'dashboard:read',
  },
  {
    method: 'GET',
    path: '/api/v1/admin/dashboard/endpoints',
    response: 'EndpointStat[]',
    successStatus: 200,
    permission: 'dashboard:read',
  },
  {
    method: 'GET',
    path: '/api/v1/admin/dashboard/nodes',
    response: 'NodesResponse',
    successStatus: 200,
    permission: 'dashboard:read',
  },
  {
    method: 'GET',
    path: '/api/v1/admin/dashboard/pipeline',
    response: 'PipelineSummary',
    successStatus: 200,
    permission: 'dashboard:read',
  },
  {
    method: 'GET',
    path: '/api/v1/admin/dashboard/running-scans',
    response: 'RunningScansResponse',
    successStatus: 200,
    permission: 'dashboard:read',
    notes: 'Accepts `?limit=5`.',
  },
  {
    method: 'GET',
    path: '/api/v1/admin/dashboard/threat-level',
    response: 'ThreatLevel',
    successStatus: 200,
    permission: 'dashboard:read',
  },
  {
    method: 'POST',
    path: '/api/v1/nodes/heartbeat',
    request: 'NodeHeartbeatBody',
    successStatus: 204,
    errors: [{ status: 401, code: 'bad_signature' }],
    notes: 'No session: authenticated by an Ed25519 signature over the payload.',
  },

  // --- Account security (self only) ---------------------------------------
  {
    method: 'POST',
    path: '/api/v1/account/password',
    request: 'ChangePasswordBody',
    successStatus: 204,
    errors: [
      { status: 400, code: 'validation_failed' },
      { status: 401, code: 'invalid_credentials' },
      { status: 422, code: 'breached_password' },
    ],
  },
  {
    method: 'GET',
    path: '/api/v1/account/security',
    response: 'SecurityResponse',
    successStatus: 200,
  },
  {
    method: 'POST',
    path: '/api/v1/account/mfa/totp/enroll',
    response: 'TotpEnrollStart',
    successStatus: 201,
  },
  {
    method: 'POST',
    path: '/api/v1/account/mfa/totp/verify',
    request: 'TotpVerifyBody',
    successStatus: 204,
    errors: [{ status: 401, code: 'mfa_failed' }],
  },
  { method: 'DELETE', path: '/api/v1/account/mfa/totp', successStatus: 204 },
  {
    method: 'POST',
    path: '/api/v1/account/mfa/webauthn/register/options',
    response: 'WebauthnRegisterOptionsResponse',
    successStatus: 200,
  },
  {
    method: 'POST',
    path: '/api/v1/account/mfa/webauthn/register/verify',
    request: 'WebauthnRegisterVerifyBody',
    response: 'WebauthnKey',
    successStatus: 201,
  },
  { method: 'DELETE', path: '/api/v1/account/mfa/webauthn/:id', successStatus: 204 },
  {
    method: 'POST',
    path: '/api/v1/account/recovery-codes',
    response: 'RecoveryCodesResponse',
    successStatus: 201,
  },
  {
    method: 'POST',
    path: '/api/v1/account/recovery-codes/regenerate',
    response: 'RecoveryCodesResponse',
    successStatus: 201,
  },

  {
    method: 'GET',
    path: '/api/v1/account/sessions',
    response: 'SessionsResponse',
    successStatus: 200,
  },
  { method: 'DELETE', path: '/api/v1/account/sessions/:id', successStatus: 204 },
  {
    method: 'POST',
    path: '/api/v1/account/sessions/revoke-others',
    response: 'RevokeOthersResponse',
    successStatus: 200,
  },
  {
    method: 'GET',
    path: '/api/v1/account/settings',
    response: 'ProfileSettings',
    successStatus: 200,
  },
  {
    method: 'PATCH',
    path: '/api/v1/account/settings',
    request: 'UpdateProfileSettingsBody',
    response: 'ProfileSettings',
    successStatus: 200,
    notes: 'Email is read-only: Supabase Auth owns it.',
  },
  {
    method: 'POST',
    path: '/api/v1/account/avatar/upload-url',
    request: 'AvatarUploadRequest',
    response: 'AvatarUploadResponse',
    successStatus: 200,
    notes: 'Presigned R2 PUT. The file never passes through the API.',
  },
  {
    method: 'POST',
    path: '/api/v1/account/avatar/confirm',
    request: 'AvatarConfirmBody',
    response: 'ProfileSettings',
    successStatus: 200,
  },
  { method: 'DELETE', path: '/api/v1/account/avatar', successStatus: 204 },
  {
    method: 'GET',
    path: '/api/v1/account/notifications',
    response: 'NotificationPrefs',
    successStatus: 200,
  },
  {
    method: 'PUT',
    path: '/api/v1/account/notifications',
    request: 'UpdateNotificationPrefsBody',
    response: 'NotificationPrefs',
    successStatus: 200,
  },
  {
    method: 'POST',
    path: '/api/v1/account/deactivation-request',
    request: 'DeactivationRequestBody',
    successStatus: 202,
  },

  // --- Content Studio ------------------------------------------------------
  { method: 'GET', path: '/api/v1/studio/status', response: 'StudioStatus', successStatus: 200 },
  {
    method: 'GET',
    path: '/api/v1/studio/submissions',
    response: 'paginated(StudioItem)',
    successStatus: 200,
  },
  {
    method: 'POST',
    path: '/api/v1/studio/drafts',
    request: 'StudioDraftBody',
    response: 'StudioItem',
    successStatus: 201,
    permission: 'content:author',
  },
  {
    method: 'PUT',
    path: '/api/v1/studio/drafts/:id',
    request: 'StudioDraftBody',
    response: 'StudioItem',
    successStatus: 200,
    permission: 'content:author',
    errors: [{ status: 409, code: 'not_editable' }],
  },
  {
    method: 'DELETE',
    path: '/api/v1/studio/drafts/:id',
    successStatus: 204,
    permission: 'content:author',
  },
  {
    method: 'POST',
    path: '/api/v1/studio/drafts/:id/submit',
    response: 'StudioItem',
    successStatus: 200,
    permission: 'content:author',
    errors: [{ status: 422, code: 'not_ready' }],
    notes: 'The 422 body carries the StudioSubmitReadiness map as `details`.',
  },
  {
    method: 'POST',
    path: '/api/v1/studio/images/upload-url',
    request: 'StudioImageUploadRequest',
    response: 'StudioImageUploadResponse',
    successStatus: 200,
  },

  // --- Client onboarding ---------------------------------------------------
  { method: 'GET', path: '/api/v1/onboarding', response: 'OnboardingStatus', successStatus: 200 },
  {
    method: 'POST',
    path: '/api/v1/onboarding',
    request: 'OnboardingSubmitBody',
    response: 'OnboardingStatus',
    successStatus: 201,
    errors: [{ status: 400, code: 'validation_failed' }],
  },
] as const satisfies readonly RouteDocC[];

export type RoutesC = typeof ROUTES_C;

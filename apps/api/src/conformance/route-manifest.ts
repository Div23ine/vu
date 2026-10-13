/**
 * The explicit allow-lists the route-table conformance suite reads.
 *
 * Every entry here is a deliberate exception to a rule the whole API otherwise
 * follows, and each one carries the reason it exists. The suite fails on a route
 * that is missing a guard, an audit wrapper or a schema; adding a name to one of
 * these lists is how an exception is granted, and a reviewer reading this file sees
 * all of them in one place.
 *
 * Patterns are `METHOD /path`, with `:param` matching one segment.
 */

export interface RouteManifest {
  PUBLIC_ROUTES: string[];
  AUDIT_EXEMPT: string[];
  CSRF_EXEMPT: string[];
}

/**
 * Routes with no session behind them. Each is protected by something else: a
 * rate-limit policy, a signature, a one-time token, or the fact that it only reads
 * published data.
 */
export const PUBLIC_ROUTES: readonly string[] = [
  // Infrastructure
  'GET /healthz',
  'GET /readyz',
  'GET /openapi.json',
  'GET /docs',
  'GET /docs/*',
  // Session lifecycle: these ARE the authentication.
  'POST /api/v1/auth/signup',
  'POST /api/v1/auth/signup/verify-email',
  'POST /api/v1/auth/signup/resend',
  'POST /api/v1/auth/forgot-password',
  'POST /api/v1/auth/reset-password',
  'POST /api/v1/auth/login',
  // OAuth PKCE (Task 40e): the `state` cookie + Redis record is the CSRF bound,
  // and the callback's code is worthless without the PKCE verifier.
  'GET /api/v1/auth/oauth/:provider/start',
  'GET /api/v1/auth/oauth/callback',
  'POST /api/v1/auth/mfa/verify',
  'POST /api/v1/auth/mfa/email-otp',
  'POST /api/v1/auth/mfa/webauthn/options',
  'POST /api/v1/auth/mfa/recovery',
  'POST /api/v1/auth/refresh',
  'GET /api/v1/auth/csrf',
  // A staff invitation carries its own one-time token.
  'GET /api/v1/invitations/:token',
  'POST /api/v1/invitations/:token/accept',
  // Anonymous intake, rate-limited and Turnstile-checked.
  'POST /api/v1/contact',
  'POST /api/v1/consent',
  // Published content only.
  'GET /api/v1/content',
  'GET /api/v1/content/:slug',
  // The catalogue is public; buying it is not.
  'GET /api/v1/products',
  'GET /api/v1/products/:slug',
  // Double opt-in: the token in the email is the authentication.
  'POST /api/v1/newsletter',
  'POST /api/v1/newsletter/confirm',
  'POST /api/v1/newsletter/unsubscribe',
  // Signed by the provider; the signature is the authentication.
  'POST /api/v1/webhooks/stripe',
  'POST /api/v1/webhooks/paystack',
  // Signed by the node's Ed25519 key.
  'POST /api/v1/nodes/heartbeat',
  // Task 40g: signed by the scan controller's HMAC-SHA256 over
  // timestamp.method.path.body-hash, replay-guarded by nonce, optionally
  // IP-restricted by SCAN_CONTROLLER_CIDRS, and per-IP rate-capped (600/min).
  'POST /api/v1/internal/scans/:id/claim',
  'POST /api/v1/internal/scans/:id/progress',
  'POST /api/v1/internal/scans/:id/findings',
  'POST /api/v1/internal/scans/:id/log-url',
  'POST /api/v1/internal/scans/:id/complete',
  'POST /api/v1/internal/scans/:id/fail',
];

/**
 * Mutations that write no audit entry, with the reason for each.
 *
 * `webhooks/*` is here because those routes append their own entries inside the
 * service with the `system` actor, and are tagged as audited; the suite checks the
 * tag, and this list documents why the tag is set by hand rather than by the
 * `audited()` wrapper.
 */
export const AUDIT_EXEMPT: readonly string[] = [
  // No state changes: a token is rotated, a CSRF cookie is issued.
  'POST /api/v1/auth/refresh',
  'GET /api/v1/auth/csrf',
  // Sends a code; the send is rate-limited, and the verification is what is audited.
  'POST /api/v1/auth/mfa/email-otp',
  // Task 40d: re-sends the signup OTP. Same reasoning as the MFA code send — the
  // intention is not a fact about a person; the verification that follows is
  // (`ACCOUNT_REGISTERED` with `stage: "email_verified"`).
  'POST /api/v1/auth/signup/resend',
  // Task 40d: forgot-password must answer identically for known and unknown
  // addresses, and "a reset was requested" is exactly the fact an enumerator
  // would read off the chain. The successful RESET is audited (`PASSWORD_CHANGED`).
  'POST /api/v1/auth/forgot-password',
  // Starts a WebAuthn ceremony; only its completion is a decision worth recording.
  'POST /api/v1/auth/mfa/webauthn/options',
  // A machine actor; entries are appended inside the service (see above).
  'POST /api/v1/webhooks/stripe',
  'POST /api/v1/webhooks/paystack',
  // A heartbeat is telemetry: 400 a minute of these would bury the chain.
  'POST /api/v1/nodes/heartbeat',
  // Issues a presigned URL. Nothing is stored until the upload lands.
  'POST /api/v1/scans/authorisation-url',
  'POST /api/v1/studio/images/upload-url',
  'POST /api/v1/account-settings/avatar/upload-url',
  // Reads with a POST verb: an estimate and a reconciliation change nothing.
  'POST /api/v1/admin/advisories/:id/estimate',
  'POST /api/v1/admin/payments/reconcile',
  // Ceremony STARTS. Enrolling a factor or registering a passkey only becomes a
  // fact about the account when the ceremony completes, and the completion route
  // is the one that writes `MFA_ENABLED`. Auditing the start would record
  // intentions, including the ones a user abandons halfway through.
  'POST /api/v1/account/mfa/totp/enroll',
  'POST /api/v1/account/mfa/webauthn/register/options',
  // Issues a presigned PUT; nothing is stored until the upload lands and the
  // profile write that follows it is audited (`AVATAR_UPDATED`).
  'POST /api/v1/account/avatar/upload-url',
  // A draft is an author's private working copy, not a record of a decision, and
  // the audit catalogue has no event for discarding one.
  'DELETE /api/v1/studio/drafts/:id',
  // A signup writes a `pending` row and sends a token. The fact worth recording is
  // the CONFIRMATION, which is audited as `NEWSLETTER_SUBSCRIBED`; auditing every
  // form post would fill the chain with addresses that never confirmed.
  'POST /api/v1/newsletter',
  // Task 40g: high-frequency scan telemetry — a pod posts progress every few
  // seconds and findings in batches; burying the chain in them would hide the
  // entries that matter. The STATE changes around them ARE audited by the
  // service with the system actor (SCAN_STARTED / SCAN_COMPLETE / SCAN_FAILED /
  // SCAN_CANCELLED), and log-url only issues a presigned PUT.
  'POST /api/v1/internal/scans/:id/progress',
  'POST /api/v1/internal/scans/:id/findings',
  'POST /api/v1/internal/scans/:id/log-url',
];

/**
 * Mutations that take no request body. A POST is not automatically a body: these
 * act on the path, the session, or a raw signed payload the JSON parser never sees.
 */
export const NO_BODY_MUTATIONS: readonly string[] = [
  'POST /api/v1/auth/logout',
  'POST /api/v1/auth/refresh',
  'POST /api/v1/auth/mfa/email-otp',
  'POST /api/v1/auth/mfa/webauthn/options',
  // The provider signs the raw bytes; a JSON body schema would re-parse them.
  'POST /api/v1/webhooks/stripe',
  'POST /api/v1/webhooks/paystack',
  'POST /api/v1/admin/payments/reconcile',
  'POST /api/v1/admin/scans/:id/request-payment',
  'POST /api/v1/admin/scans/:id/cancel',
  'POST /api/v1/studio/drafts/:id/submit',
  'POST /api/v1/admin/advisories/:id/estimate',
  'POST /api/v1/advisories/:id/acknowledge',
  'POST /api/v1/admin/users/:id/blogger-badge',
  // Acts on the path only: which licence to issue a download URL for.
  'POST /api/v1/entitlements/:id/download-url',
  // Self-service actions that act on the session's own account: the actor and the
  // target are the same person, and there is nothing to parse.
  'POST /api/v1/account/mfa/totp/enroll',
  'POST /api/v1/account/mfa/webauthn/register/options',
  'POST /api/v1/account/recovery-codes',
  'POST /api/v1/account/recovery-codes/regenerate',
  'POST /api/v1/account/sessions/revoke-others',
  'POST /api/v1/admin/users/invitations/:id/resend',
];

/**
 * Routes whose success response is not a JSON envelope: a 204, a CSV stream or an
 * SSE stream. Each still sets its own `Content-Type`.
 */
export const NO_JSON_RESPONSE: readonly string[] = [
  'GET /api/v1/billing/invoices.csv',
  'POST /api/v1/auth/refresh',
  'POST /api/v1/auth/mfa/webauthn/options',
  'GET /api/v1/admin/audit/export',
  'GET /api/v1/admin/audit/stream',
  // Task 95: a WebSocket upgrade. Frames are contract schemas, not the envelope.
  'GET /api/v1/scans/:id/stream',
  // Task 94: an SSE stream — the frames are BroadcastStreamEvent, not the JSON
  // envelope, and the reply is hijacked before any serializer runs.
  'GET /api/v1/admin/advisories/:id/broadcasts/stream',
  // Task 40e: bare 302s. The browser follows them; there is no body to shape.
  'GET /api/v1/auth/oauth/:provider/start',
  'GET /api/v1/auth/oauth/callback',
];

/** Routes the CSRF double-submit check must not apply to, and why. */
export const CSRF_EXEMPT: readonly string[] = [
  // A provider cannot hold our CSRF cookie; it signs the body instead.
  'POST /api/v1/webhooks/stripe',
  'POST /api/v1/webhooks/paystack',
  // A sensor node has no browser and no cookie jar; it signs with Ed25519.
  'POST /api/v1/nodes/heartbeat',
  // Task 40e: GETs, and cookie-bound by their own `state` (the `vv_oauth`
  // cookie must equal the query parameter AND the Redis record).
  'GET /api/v1/auth/oauth/:provider/start',
  'GET /api/v1/auth/oauth/callback',
  // Task 40g: the scan controller is a machine with no cookie jar; the HMAC
  // over the raw bytes is the binding.
  'POST /api/v1/internal/scans/:id/claim',
  'POST /api/v1/internal/scans/:id/progress',
  'POST /api/v1/internal/scans/:id/findings',
  'POST /api/v1/internal/scans/:id/log-url',
  'POST /api/v1/internal/scans/:id/complete',
  'POST /api/v1/internal/scans/:id/fail',
];

/**
 * Routes that must declare a non-default rate-limit policy, because they are the
 * ones an attacker automates first.
 */
export const RATE_LIMITED_ROUTES: readonly string[] = [
  'POST /api/v1/auth/login',
  'POST /api/v1/auth/signup',
  'POST /api/v1/auth/signup/verify-email',
  'POST /api/v1/auth/signup/resend',
  'POST /api/v1/auth/forgot-password',
  'POST /api/v1/auth/reset-password',
  'POST /api/v1/contact',
  'POST /api/v1/consent',
  'POST /api/v1/account/password',
  'POST /api/v1/account/recovery-codes',
  'POST /api/v1/account/mfa/totp',
  'POST /api/v1/account/mfa/webauthn',
  'POST /api/v1/billing/checkout',
];

/** The prefix under which nothing but a read (and one verification) may exist. */
export const AUDIT_IMMUTABLE_PREFIX = '/api/v1/admin/audit';
export const AUDIT_VERIFY_ROUTE = 'POST /api/v1/admin/audit/verify';

/**
 * Documented in `ROUTES_A`/`ROUTES_B`/`ROUTES_C` but owned by a layer that has not
 * been built yet (L10 scan worker relay, L11 workers, L12 real-time). The suite
 * reports any OTHER documented route that is missing.
 */
export const NOT_YET_IMPLEMENTED: readonly string[] = [
  // Task 95 ships this route; Fastify registers it as GET with `websocket: true`,
  // so the live table carries the GET line and only the documented `WS` alias
  // still needs the exemption.
  'WS /api/v1/scans/:id/stream',
  'GET /api/v1/admin/audit/stream',
];

/** Import specifiers that must not appear anywhere under `apps/api/src`. */
export const FORBIDDEN_IMPORTS: readonly string[] = [
  'express',
  '@prisma/client',
  'prisma',
  'joi',
  '@hapi/joi',
];

/** Identifiers that must not appear: sessions live in HttpOnly cookies. */
export const FORBIDDEN_IDENTIFIERS: readonly string[] = ['localStorage', 'sessionStorage'];

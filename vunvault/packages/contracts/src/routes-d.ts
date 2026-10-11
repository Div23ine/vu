import type { RouteDoc } from './routes-a';
import type { Permission } from './permissions';

/**
 * Route documentation for the marketing backend addendum (Task 40c): the public
 * content feed and article route, the product catalogue and purchase, licence
 * entitlements with presigned downloads, and the double-opt-in newsletter.
 *
 * A contract, not an implementation. Layer L4 registers these on Fastify; the
 * conformance suite in `apps/api` compares this list against the live route table
 * and fails on drift.
 *
 * `permission` is what the API checks. `undefined` means public — and every public
 * route here is either a read of published data or a form protected by the
 * `public_form` rate-limit policy.
 */

export interface RouteDocD extends RouteDoc {
  permission?: Permission;
}

export const ROUTES_D: RouteDocD[] = [
  // --- public content -------------------------------------------------------
  {
    method: 'GET',
    path: '/api/v1/content',
    query: 'PublicContentQuery',
    response: 'paginated(PublicContentItem)',
    successStatus: 200,
    notes: 'Published items only; `Cache-Control: public, max-age=60`.',
  },
  {
    method: 'GET',
    path: '/api/v1/content/:slug',
    response: 'PublicContentDetail',
    successStatus: 200,
    errors: [{ status: 404, code: 'not_found' }],
    notes: 'Matches a published item whose `slug_path` ends in `/<slug>`.',
  },

  // --- product catalogue ----------------------------------------------------
  {
    method: 'GET',
    path: '/api/v1/products',
    response: 'paginated(ProductView)',
    successStatus: 200,
    notes: 'Active products only, ordered by `sort_order`; cacheable 300 s.',
  },
  {
    method: 'GET',
    path: '/api/v1/products/:slug',
    response: 'ProductView',
    successStatus: 200,
    errors: [{ status: 404, code: 'not_found' }],
  },
  {
    method: 'POST',
    path: '/api/v1/products/:id/purchase',
    request: 'PurchaseBody',
    response: 'PurchaseResponse',
    successStatus: 201,
    permission: 'billing:manage',
    errors: [
      { status: 403, code: 'no_org' },
      { status: 404, code: 'not_found' },
    ],
    notes:
      'Issues (or reuses) a pending USD invoice. Payment then runs through ' +
      '`POST /billing/fx-quotes` and `POST /billing/checkout`.',
  },

  // --- entitlements ---------------------------------------------------------
  {
    method: 'GET',
    path: '/api/v1/entitlements',
    response: 'paginated(EntitlementView)',
    successStatus: 200,
    notes: 'Scoped to the caller’s organisation.',
  },
  {
    method: 'POST',
    path: '/api/v1/entitlements/:id/download-url',
    response: 'DownloadUrlResponse',
    successStatus: 200,
    errors: [
      { status: 404, code: 'not_found' },
      { status: 409, code: 'not_available' },
    ],
    notes: 'Presigned GET, 300 s, `Content-Disposition: attachment`. Own org only.',
  },

  // --- newsletter -----------------------------------------------------------
  {
    method: 'POST',
    path: '/api/v1/newsletter',
    request: 'NewsletterSubscribeBody',
    successStatus: 202,
    errors: [
      { status: 400, code: 'validation_failed' },
      { status: 429, code: 'rate_limited' },
    ],
    notes:
      'Always 202: whether an address is already subscribed is not public ' +
      'information. Double opt-in — the token is emailed, never returned.',
  },
  {
    method: 'POST',
    path: '/api/v1/newsletter/confirm',
    request: 'NewsletterTokenBody',
    successStatus: 204,
    errors: [{ status: 404, code: 'not_found' }],
  },
  {
    method: 'POST',
    path: '/api/v1/newsletter/unsubscribe',
    request: 'NewsletterTokenBody',
    successStatus: 204,
    errors: [{ status: 404, code: 'not_found' }],
  },

  // --- internal scan-controller callbacks (Task 40g) -------------------------
  // No session, no cookies, no permission: the HMAC signature over
  // `timestamp.method.path.sha256hex(rawBody)` IS the authentication
  // (`SCAN_CONTROLLER_HMAC_KEY`), replay-guarded by nonce and optionally
  // restricted by `SCAN_CONTROLLER_CIDRS`.
  {
    method: 'POST',
    path: '/api/v1/internal/scans/:id/claim',
    request: 'InternalClaimBody',
    response: 'InternalClaimResponse',
    successStatus: 200,
    errors: [
      { status: 401, code: 'bad_signature' },
      { status: 404, code: 'not_found' },
      { status: 409, code: 'not_claimable' },
      { status: 422, code: 'authorisation_invalid' },
    ],
    notes:
      'HMAC-signed (x-vv-timestamp + x-vv-signature). Row-locked transition ' +
      'queued → running; requires a present, unexpired authorisation document ' +
      '(otherwise the job is held). Opens a scan_runs attempt. Audited SCAN_STARTED.',
  },
  {
    method: 'POST',
    path: '/api/v1/internal/scans/:id/progress',
    request: 'InternalProgressBody',
    successStatus: 204,
    errors: [
      { status: 401, code: 'bad_signature' },
      { status: 404, code: 'not_found' },
      { status: 409, code: 'invalid_state' },
    ],
    notes: 'HMAC-signed. Monotonic (lower values ignored), only while running. Not audited.',
  },
  {
    method: 'POST',
    path: '/api/v1/internal/scans/:id/findings',
    request: 'InternalFindingsBody',
    successStatus: 204,
    errors: [
      { status: 401, code: 'bad_signature' },
      { status: 404, code: 'not_found' },
      { status: 409, code: 'invalid_state' },
      { status: 422, code: 'too_many_findings' },
    ],
    notes:
      'HMAC-signed. Only while running; ≤100 findings per call, 500 per job; ' +
      "deduped on (job_id, md5(title || coalesce(cwe,''))); text re-redacted " +
      'server-side. Not audited.',
  },
  {
    method: 'POST',
    path: '/api/v1/internal/scans/:id/log-url',
    request: 'InternalLogUrlBody',
    response: 'InternalLogUrlResponse',
    successStatus: 200,
    errors: [
      { status: 401, code: 'bad_signature' },
      { status: 404, code: 'not_found' },
      { status: 409, code: 'invalid_state' },
    ],
    notes:
      'HMAC-signed. Presigned PUT for scan-logs/<jobId>/<attempt>.log (≤5 MB, ' +
      'text/plain). Not audited.',
  },
  {
    method: 'POST',
    path: '/api/v1/internal/scans/:id/complete',
    request: 'InternalCompleteBody',
    response: 'InternalCompleteResponse',
    successStatus: 200,
    errors: [
      { status: 401, code: 'bad_signature' },
      { status: 404, code: 'not_found' },
      { status: 409, code: 'invalid_state' },
    ],
    notes:
      'HMAC-signed. running → completed, progress 100, gate → in_review; ' +
      'audited SCAN_COMPLETE; reviewers notified (job_awaiting_review), admins ' +
      'also on critical findings (critical_finding).',
  },
  {
    method: 'POST',
    path: '/api/v1/internal/scans/:id/fail',
    request: 'InternalFailBody',
    successStatus: 204,
    errors: [
      { status: 401, code: 'bad_signature' },
      { status: 404, code: 'not_found' },
      { status: 409, code: 'invalid_state' },
    ],
    notes:
      'HMAC-signed. abort/kill → cancelled; deadline/error → held (the status ' +
      'enum has no failed). Audited SCAN_CANCELLED / SCAN_FAILED; the requester ' +
      'gets an in-app notification titled "Scan could not be completed".',
  },
];

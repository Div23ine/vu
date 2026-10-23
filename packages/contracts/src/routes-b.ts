import type { RouteDoc } from './routes-a';

/**
 * Route documentation for billing & FX, content moderation, the audit trail,
 * public contact and consent.
 *
 * A contract, not an implementation — Layer L4 registers these on Fastify and
 * Layer L13 emits the OpenAPI document from `ROUTES_A` + `ROUTES_B`.
 *
 * NOTE: there is intentionally NO `PUT`, `PATCH` or `DELETE` route for audit
 * entries — the chain is append-only and the database refuses mutation.
 */

export const ROUTES_B = [
  {
    method: 'GET',
    path: '/api/v1/billing/subscription',
    response: 'Subscription',
    successStatus: 200,
    errors: [{ status: 401, code: 'unauthorized' }],
    notes: 'Requires billing:read.',
  },
  {
    method: 'GET',
    path: '/api/v1/billing/payment-method',
    response: 'PaymentMethodView',
    successStatus: 200,
    errors: [{ status: 401, code: 'unauthorized' }],
    notes: 'Requires billing:read. Returns tokenised card data only.',
  },
  {
    method: 'PUT',
    path: '/api/v1/billing/payment-method',
    request: 'UpdatePaymentMethodBody',
    response: 'PaymentMethodView',
    successStatus: 200,
    errors: [
      { status: 400, code: 'validation_failed' },
      { status: 403, code: 'forbidden' },
    ],
    notes: 'Requires billing:manage. The browser tokenises the card; the API never sees a PAN.',
  },
  {
    method: 'GET',
    path: '/api/v1/billing/invoices',
    query: 'InvoiceListQuery',
    response: 'paginated(Invoice)',
    successStatus: 200,
    errors: [{ status: 401, code: 'unauthorized' }],
    notes: 'Amounts come from the derived invoice_balances view, never from the invoice row.',
  },
  {
    method: 'GET',
    path: '/api/v1/billing/invoices/:id/pdf',
    successStatus: 200,
    errors: [{ status: 404, code: 'not_found' }],
    notes: 'Response media type application/pdf, streamed from object storage.',
  },
  {
    method: 'GET',
    path: '/api/v1/billing/invoices.csv',
    successStatus: 200,
    errors: [{ status: 401, code: 'unauthorized' }],
    notes: 'Response media type text/csv.',
  },
  {
    method: 'POST',
    path: '/api/v1/billing/fx-quotes',
    request: 'FxQuoteRequest',
    response: 'FxQuote',
    successStatus: 201,
    errors: [{ status: 422, code: 'unsupported_currency' }],
    notes: 'Locks a display rate for 15 minutes. Display only — the charge stays in USD.',
  },
  {
    method: 'POST',
    path: '/api/v1/billing/checkout',
    request: 'CheckoutBody',
    response: 'CheckoutResponse',
    successStatus: 201,
    errors: [
      { status: 409, code: 'quote_expired' },
      { status: 409, code: 'already_paid' },
    ],
    notes: 'Always charges usdCents in USD, even when fxQuoteId is present.',
  },
  {
    method: 'POST',
    path: '/api/v1/webhooks/stripe',
    response: 'WebhookAck',
    successStatus: 200,
    notes: 'Raw body, signature-verified, idempotent on (provider, event_id).',
  },
  {
    method: 'POST',
    path: '/api/v1/webhooks/paystack',
    response: 'WebhookAck',
    successStatus: 200,
    notes: 'Raw body, signature-verified, idempotent on (provider, event_id).',
  },
  {
    method: 'GET',
    path: '/api/v1/admin/content',
    query: 'ModerationQuery',
    response: 'paginated(ModerationItem)',
    successStatus: 200,
    errors: [{ status: 403, code: 'forbidden' }],
    notes: 'Requires content:moderate.',
  },
  {
    method: 'GET',
    path: '/api/v1/admin/content/summary',
    response: 'ModerationSummary',
    successStatus: 200,
    errors: [{ status: 403, code: 'forbidden' }],
  },
  {
    method: 'POST',
    path: '/api/v1/admin/content/:id/actions',
    request: 'ModerationActionBody',
    response: 'ModerationItem',
    successStatus: 200,
    errors: [
      { status: 400, code: 'validation_failed' },
      { status: 403, code: 'forbidden' },
      { status: 404, code: 'not_found' },
    ],
    notes: 'Appends a content_reviews row; the moderation history is never edited.',
  },
  {
    method: 'GET',
    path: '/api/v1/content',
    query: 'PublicContentQuery',
    response: 'paginated(PublicContentItem)',
    successStatus: 200,
    notes:
      'Public. Published items only, ordered by publishedAt descending.\n' +
      'Task 40b/40c extended this route (search, filters, priority sort) and added the `/api/v1/content/:slug` detail route — see `ROUTES_D`.',
  },
  {
    method: 'GET',
    path: '/api/v1/admin/audit',
    query: 'AuditQuery',
    response: 'paginated(AuditEntryView)',
    successStatus: 200,
    errors: [{ status: 403, code: 'forbidden' }],
    notes: 'Requires audit:read. Default range is 24h.',
  },
  {
    method: 'GET',
    path: '/api/v1/admin/audit/summary',
    response: 'AuditSummary',
    successStatus: 200,
    errors: [{ status: 403, code: 'forbidden' }],
  },
  {
    method: 'GET',
    path: '/api/v1/admin/audit/chain',
    response: 'ChainStatus',
    successStatus: 200,
    errors: [{ status: 403, code: 'forbidden' }],
  },
  {
    method: 'POST',
    path: '/api/v1/admin/audit/verify',
    response: 'VerifyChainResult',
    successStatus: 200,
    errors: [{ status: 403, code: 'forbidden' }],
    notes: 'Requires audit:verify. Writes an audit_checkpoints row and a CHAIN_VERIFIED entry.',
  },
  {
    method: 'GET',
    path: '/api/v1/admin/audit/export',
    query: 'AuditQuery',
    successStatus: 200,
    errors: [{ status: 403, code: 'forbidden' }],
    notes: 'Response media type text/csv.',
  },
  {
    method: 'GET',
    path: '/api/v1/admin/audit/stream',
    successStatus: 200,
    errors: [{ status: 403, code: 'forbidden' }],
    notes:
      'SSE (text/event-stream). Each `data:` frame is an AuditStreamEvent — ' +
      '`entry`, `heartbeat` or `chain`.',
  },
  {
    method: 'POST',
    path: '/api/v1/contact',
    request: 'ContactBody',
    response: 'ContactCreated',
    successStatus: 201,
    errors: [
      { status: 400, code: 'validation_failed' },
      { status: 429, code: 'rate_limited' },
    ],
    notes: 'Public. Response body is `{ data: { id } }`.',
  },
  {
    method: 'POST',
    path: '/api/v1/consent',
    request: 'ConsentBody',
    successStatus: 204,
    notes: 'Public. Append-only: a changed preference is a new record.',
  },
  // Task 40f — the admin contact inbox and the client directory.
  {
    method: 'GET',
    path: '/api/v1/admin/contact',
    query: 'ContactListQuery',
    response: 'paginated(ContactMessageView)',
    successStatus: 200,
    errors: [
      { status: 401, code: 'unauthorized' },
      { status: 403, code: 'forbidden' },
    ],
    notes:
      'Requires support:handle (staff only). Newest first; `q` searches name, email, ' +
      'organization and subject. The full message body is only ever returned to ' +
      'support:handle holders; the raw IP hash never leaves the database.',
  },
  {
    method: 'PATCH',
    path: '/api/v1/admin/contact/:id',
    request: 'ContactTriageBody',
    response: 'ContactMessageView',
    successStatus: 200,
    errors: [
      { status: 400, code: 'validation_failed' },
      { status: 404, code: 'not_found' },
      { status: 422, code: 'invalid_assignee' },
    ],
    notes:
      'Requires support:handle. `assignedTo` must be an ACTIVE STAFF profile (a client or ' +
      'non-active account answers 422 invalid_assignee); `null` unassigns. Audited ' +
      'CONTACT_TRIAGED with details { status, assignedTo }.',
  },
  {
    method: 'GET',
    path: '/api/v1/admin/clients',
    query: 'ClientDirectoryQuery',
    response: 'paginated(ClientDirectoryItem)',
    successStatus: 200,
    errors: [
      { status: 401, code: 'unauthorized' },
      { status: 403, code: 'forbidden' },
    ],
    notes:
      'Requires users:read. Client-role profiles, not deleted; `q` ILIKE on name, email, ' +
      'organization name and client code. This is how the Verified-Blogger badge finds a client.',
  },
  // The Task 40 badge routes were live but undocumented; Task 40f closes the drift
  // (the UI for them is Task 83e).
  {
    method: 'POST',
    path: '/api/v1/admin/users/:id/blogger-badge',
    successStatus: 200,
    errors: [{ status: 404, code: 'not_found' }],
    notes:
      'Requires users:manage (super_admin). Response `{ data: { id, verifiedBloggerAt } }`. ' +
      'Audited PERMISSION_CHANGED.',
  },
  {
    method: 'DELETE',
    path: '/api/v1/admin/users/:id/blogger-badge',
    successStatus: 200,
    errors: [{ status: 404, code: 'not_found' }],
    notes:
      'Requires users:manage (super_admin). Response `{ data: { id, verifiedBloggerAt: null } }`. ' +
      'Audited PERMISSION_CHANGED.',
  },
] as const satisfies readonly RouteDoc[];

export type RoutesB = typeof ROUTES_B;

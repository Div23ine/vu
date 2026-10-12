/**
 * The edge's request policy (Task 99) — pure predicates, no runtime globals,
 * so the whole allow-list is testable as data.
 *
 * The Worker is the only public door to the API. Everything behind it (the
 * WAF custom rules in Terraform, the API's own origin lock) assumes this list
 * already held: a path that is not `/api/v1/…`, `/healthz`, `/readyz` or
 * `/openapi.json` does not exist at the edge, and `/docs` — the interactive
 * API explorer — is explicitly dead here.
 */

/** The allow-list. `/docs*` is deliberately NOT in it. */
const ALLOWED_PATH = /^\/(?:api\/v1\/|healthz$|readyz$|openapi\.json$)/;

export const ALLOWED_METHODS: ReadonlySet<string> = new Set([
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
]);

/** One megabyte everywhere; the webhook paths get a quarter of that. */
export const MAX_BODY_BYTES = 1_048_576;
export const MAX_WEBHOOK_BODY_BYTES = 262_144;

export function isWebhookPath(pathname: string): boolean {
  return pathname.startsWith('/api/v1/webhooks/');
}

export function isAllowedPath(pathname: string): boolean {
  return ALLOWED_PATH.test(pathname);
}

export function isAllowedMethod(method: string): boolean {
  return ALLOWED_METHODS.has(method.toUpperCase());
}

export type SizeVerdict = 'ok' | 'too_large' | 'unknown';

/**
 * Size gate on the DECLARED length only — the edge never reads a body.
 * A request without `Content-Length` (chunked) is `unknown` and passes: the
 * origin's own body limits (Fastify `bodyLimit`, the webhook size rules) are
 * the second gate, and buffering here to measure would defeat the pass-through.
 */
export function sizeVerdict(pathname: string, contentLength: string | null): SizeVerdict {
  if (contentLength === null) return 'unknown';
  const declared = Number(contentLength);
  if (!Number.isFinite(declared) || declared < 0) return 'ok';
  const limit = isWebhookPath(pathname) ? MAX_WEBHOOK_BODY_BYTES : MAX_BODY_BYTES;
  return declared > limit ? 'too_large' : 'ok';
}

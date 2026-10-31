import { randomUUID } from 'node:crypto';
import fp from 'fastify-plugin';
import type { IncomingHttpHeaders } from 'node:http';
import type { FastifyPluginAsync } from 'fastify';

/** An inbound correlation id must be safe to log, echo and store. */
export const REQUEST_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

/** Inbound `x-request-id` when well formed, otherwise a fresh UUID. */
export function resolveRequestId(headers: IncomingHttpHeaders): string {
  const inbound = headers['x-request-id'];
  if (typeof inbound === 'string' && REQUEST_ID_PATTERN.test(inbound)) return inbound;
  return randomUUID();
}

/**
 * Query parameters whose VALUES are credentials. The magic-link verify leg
 * carries its single-use token as `?token=…` (work order §7: tokens are never
 * logged at any level), and `code`/`otp` legs must never reach the log either.
 * Keys are matched case-insensitively; only the value is replaced, so the
 * shape of the request stays readable in the log.
 */
const SENSITIVE_QUERY_PARAMS = new Set(['token', 'code', 'otp', 'secret', 'sig', 'signature']);

/**
 * Rewrite a request URL for logging: every sensitive query parameter's value
 * becomes `[Redacted]` (the logger's censor literal). URLs without a query
 * string — or without sensitive parameters — are returned untouched, so the
 * common case costs one `indexOf`.
 */
export function sanitizeLoggedUrl(url: string): string {
  const queryStart = url.indexOf('?');
  if (queryStart === -1) return url;
  const path = url.slice(0, queryStart);
  const params = new URLSearchParams(url.slice(queryStart + 1));
  let redacted = false;
  for (const key of new Set(params.keys())) {
    if (SENSITIVE_QUERY_PARAMS.has(key.toLowerCase())) {
      params.set(key, '[Redacted]');
      redacted = true;
    }
  }
  return redacted ? `${path}?${params.toString()}` : url;
}

/**
 * Request context.
 *
 * `buildApp` installs `resolveRequestId` as Fastify's `genReqId`, so `request.id`
 * is already the correlation id and Pino binds it as `reqId` on every log line.
 * This plugin exposes it as `request.requestId` and echoes it on the response, so
 * a client can quote it in a support ticket.
 *
 * Cookie, authorization, CSRF and Set-Cookie headers are redacted by the logger
 * configuration in `buildApp`.
 */
const requestContext: FastifyPluginAsync = async (app) => {
  app.decorateRequest('requestId', '');

  app.addHook('onRequest', async (request, reply) => {
    request.requestId = request.id;
    reply.header('x-request-id', request.id);
  });
};

export default fp(requestContext, { name: 'request-context' });

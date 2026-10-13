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

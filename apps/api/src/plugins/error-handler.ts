import fp from 'fastify-plugin';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import type { FastifyError, FastifyPluginAsync } from 'fastify';
import { isHttpError } from '../lib/http-error.js';

/** The wire envelope every failed request returns. */
interface ErrorEnvelope {
  error: string;
  message?: string;
  details?: unknown[];
}

const VALIDATION_MESSAGE = 'Check the highlighted fields';

function isRateLimited(error: FastifyError): boolean {
  return error.statusCode === 429;
}

/** `@fastify/rate-limit` (Task 23) attaches the header to the error object. */
interface ErrorWithHeaders extends FastifyError {
  headers?: Record<string, string | number>;
}

/** Copy a provider-set Retry-After across, whatever the plugin called it. */
function retryAfter(error: ErrorWithHeaders): string | undefined {
  const value = error.headers?.['retry-after'] ?? error.headers?.['Retry-After'];
  return value === undefined ? undefined : String(value);
}

/**
 * Global error handling.
 *
 * Order matters: a Zod validation failure is a client mistake (400 with the
 * issues), an `HttpError` is a deliberate refusal (its own status and code), a
 * rate-limit rejection keeps its `Retry-After`, and anything else is an
 * unhandled fault — logged with the request id and answered with a bare
 * `internal_error`. Stack traces, SQL and secrets never reach a client.
 */
const errorHandler: FastifyPluginAsync = async (app) => {
  app.setErrorHandler<FastifyError>((error, request, reply) => {
    reply.header('x-request-id', request.id);

    if (hasZodFastifySchemaValidationErrors(error)) {
      const envelope: ErrorEnvelope = {
        error: 'validation_failed',
        message: VALIDATION_MESSAGE,
        details: error.validation.map((entry) => entry.params.issue),
      };
      return reply.status(400).send(envelope);
    }

    if (isHttpError(error)) {
      const envelope: ErrorEnvelope = { error: error.code };
      if (error.status < 500 && error.message !== '') envelope.message = error.message;
      if (error.details !== undefined) envelope.details = error.details;
      // Phase 4: a deliberate refusal may carry headers (e.g. `retry-after`
      // on MFA backoff) — copy them across exactly as the plugin path does.
      if (error.headers !== undefined) {
        for (const [name, value] of Object.entries(error.headers)) {
          reply.header(name, String(value));
        }
      }
      if (error.status >= 500) {
        request.log.error({ err: error, requestId: request.id }, 'handled 5xx');
      }
      return reply.status(error.status).send(envelope);
    }

    if (isRateLimited(error)) {
      const after = retryAfter(error as ErrorWithHeaders);
      if (after !== undefined) reply.header('retry-after', after);
      return reply.status(429).send({ error: 'rate_limited' } satisfies ErrorEnvelope);
    }

    // A Fastify validation error from a non-Zod schema still means "bad input".
    if (error.validation !== undefined) {
      return reply.status(400).send({
        error: 'validation_failed',
        message: VALIDATION_MESSAGE,
        details: error.validation,
      } satisfies ErrorEnvelope);
    }

    if (error.statusCode !== undefined && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.status(error.statusCode).send({
        error: error.code ?? 'bad_request',
        message: error.message,
      } satisfies ErrorEnvelope);
    }

    request.log.error({ err: error, requestId: request.id }, 'unhandled error');
    return reply.status(500).send({ error: 'internal_error' } satisfies ErrorEnvelope);
  });

  app.setNotFoundHandler((request, reply) => {
    reply.header('x-request-id', request.id);
    reply.status(404).send({
      error: 'not_found',
      message: `Route ${request.method}:${request.url} not found`,
    } satisfies ErrorEnvelope);
  });
};

export default fp(errorHandler, { name: 'error-handler' });

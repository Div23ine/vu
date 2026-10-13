import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

/**
 * Error reporting.
 *
 * Sentry is initialised only when a DSN is configured, never sends PII by default,
 * and only sees server faults: a 4xx is a client mistake, not an incident. Every
 * captured event is scrubbed of credentials and tagged with the request id so a
 * support ticket can be traced end to end.
 */

export const SENTRY_REDACTED_HEADERS = ['cookie', 'authorization', 'x-csrf-token'] as const;

export const SENTRY_REDACTED_BODY_FIELDS = [
  'password',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'code',
  'recoveryAnswer',
  'token',
] as const;

const REDACTED = '[Filtered]';

interface SentryLikeEvent {
  request?: {
    headers?: Record<string, unknown>;
    data?: unknown;
    cookies?: unknown;
  };
  tags?: Record<string, unknown>;
}

/** Remove credentials from an event, in place, and return it. Pure enough to test. */
export function scrubEvent<T extends SentryLikeEvent>(event: T): T {
  if (event.request !== undefined) {
    if (event.request.headers !== undefined) {
      for (const header of SENTRY_REDACTED_HEADERS) {
        for (const key of Object.keys(event.request.headers)) {
          if (key.toLowerCase() === header) event.request.headers[key] = REDACTED;
        }
      }
    }
    if (event.request.cookies !== undefined) event.request.cookies = REDACTED;
    const data = event.request.data;
    if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
      const record = data as Record<string, unknown>;
      for (const field of SENTRY_REDACTED_BODY_FIELDS) {
        if (field in record) record[field] = REDACTED;
      }
    }
  }
  return event;
}

export type CaptureError = (error: unknown, requestId: string) => void;

export interface SentryPluginOptions {
  /** Test seam: capture without initialising the SDK. */
  capture?: CaptureError;
  dsn?: string;
}

async function initSentry(dsn: string): Promise<CaptureError> {
  const Sentry = await import('@sentry/node');
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    beforeSend: (event) => scrubEvent(event as SentryLikeEvent) as typeof event,
  });
  return (error, requestId) => {
    Sentry.captureException(error, { tags: { requestId } });
  };
}

/**
 * The status this error will produce.
 *
 * `onError` runs BEFORE the error handler sets the reply status (it is still 200
 * at that point), so the severity has to be read from the error itself. Anything
 * without an explicit status is an unhandled fault, i.e. a 500.
 */
export function errorStatus(error: unknown): number {
  const candidate = error as { status?: number; statusCode?: number };
  const status = candidate.status ?? candidate.statusCode;
  return typeof status === 'number' && status >= 400 ? status : 500;
}

const sentryPlugin: FastifyPluginAsync<SentryPluginOptions> = async (app, options) => {
  const dsn = options.dsn ?? app.env.SENTRY_DSN;
  const capture = options.capture ?? (dsn === undefined ? undefined : await initSentry(dsn));

  app.decorate('captureError', (error: unknown, requestId: string): void => {
    capture?.(error, requestId);
  });

  // Only server faults are incidents; a 4xx is a client mistake.
  app.addHook('onError', async (request, _reply, error) => {
    if (errorStatus(error) < 500) return;
    app.captureError(error, request.id);
  });
};

export default fp(sentryPlugin, { name: 'sentry' });

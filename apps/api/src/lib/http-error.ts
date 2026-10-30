/**
 * The API's error model.
 *
 * Every route throws an `HttpError` (or lets a Zod validation failure surface) and
 * the global error handler turns it into the envelope
 * `{ error, message?, details? }`. A 5xx never carries a message: stack traces,
 * SQL and secrets must not reach a client.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown[];
  /**
   * Extra response headers the error handler must set (Phase 4: `retry-after`
   * on backoff refusals). Values are header-safe strings/numbers only.
   */
  readonly headers?: Record<string, string | number>;

  constructor(
    status: number,
    code: string,
    message?: string,
    details?: unknown[],
    headers?: Record<string, string | number>,
  ) {
    super(message ?? code);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.headers = headers;
  }

  static unauthorized(message = 'Authentication required'): HttpError {
    return new HttpError(401, 'unauthorized', message);
  }

  static forbidden(
    code = 'forbidden',
    message = 'You do not have access to this resource',
  ): HttpError {
    return new HttpError(403, code, message);
  }

  static notFound(message = 'Resource not found'): HttpError {
    return new HttpError(404, 'not_found', message);
  }

  static conflict(code: string, message?: string): HttpError {
    return new HttpError(409, code, message);
  }

  static badRequest(code: string, details?: unknown[], message?: string): HttpError {
    return new HttpError(400, code, message, details);
  }

  static tooManyRequests(message = 'Too many requests'): HttpError {
    return new HttpError(429, 'rate_limited', message);
  }

  static unprocessable(code: string, message?: string, details?: unknown[]): HttpError {
    return new HttpError(422, code, message, details);
  }
}

export function isHttpError(value: unknown): value is HttpError {
  return value instanceof HttpError;
}

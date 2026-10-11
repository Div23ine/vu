/**
 * Error model.
 *
 * Every non-2xx API response carries the envelope
 * `{ error: string; message?: string; details?: unknown[] }`. `apiFetch` turns it
 * into an `ApiError` so callers can branch on `code` (`"unauthorized"`,
 * `"validation_failed"`, `"forbidden"`, `"not_found"`, `"rate_limited"`) instead
 * of parsing text, and can quote `requestId` in a support ticket.
 */

/** The wire shape of a failed API response. */
export interface ErrorEnvelope {
  error: string;
  message?: string;
  details?: unknown[];
}

export class ApiError extends Error {
  /** HTTP status code. */
  readonly status: number;

  /** Machine-readable code from the envelope's `error` field. */
  readonly code: string;

  /** Field-level issues (Zod issues for `validation_failed`). */
  readonly details?: unknown[];

  /** Value of the `x-request-id` response header, when the API sent one. */
  readonly requestId?: string;

  constructor(
    status: number,
    code: string,
    message?: string,
    details?: unknown[],
    requestId?: string,
  ) {
    super(message ?? code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

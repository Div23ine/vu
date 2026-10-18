import { ApiError, type ErrorEnvelope } from './errors.js';

/**
 * Typed fetch client for the VUNVAULT API.
 *
 * Contract (see `@vunvault/contracts`):
 *   2xx       → `{ data: T }` (lists: `{ data: T[]; total: number }`)
 *   4xx / 5xx → `{ error: string; message?: string; details?: unknown[] }`
 *   401 `{ error: "unauthorized" }` · 403 `{ error: "forbidden" }` ·
 *   404 `{ error: "not_found" }` · 400 `{ error: "validation_failed"; details: ZodIssue[] }` ·
 *   429 `{ error: "rate_limited" }`
 *
 * Security rules enforced here:
 * - `credentials: "include"` on every call — the session is an HttpOnly cookie.
 * - An `Authorization` header is never attached, and is stripped if a caller adds one.
 * - Web storage is never read or written.
 * - Mutating requests carry the double-submit CSRF token from the NON-HttpOnly
 *   `vv_csrf` cookie as `x-csrf-token`.
 */

/** Name of the readable (non-HttpOnly) CSRF cookie set by the API. */
export const CSRF_COOKIE_NAME = 'vv_csrf';

/** Header the API expects the double-submit token in. */
export const CSRF_HEADER_NAME = 'x-csrf-token';

/** Methods that must not carry a CSRF token or a body. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface ApiConfig {
  /** Absolute API origin, e.g. the web app passes `process.env.NEXT_PUBLIC_API_URL`. */
  baseUrl: string;
  /** Invoked once per 401, before the error is thrown (session expiry redirect). */
  onUnauthorized?: () => void;
}

let apiConfig: ApiConfig = { baseUrl: '' };

/** Set the base URL and the 401 handler. Called once during app bootstrap. */
export function configureApi(config: Partial<ApiConfig>): void {
  apiConfig = { ...apiConfig, ...config };
}

/** Currently effective configuration. Exposed for tests and diagnostics. */
export function getApiConfig(): Readonly<ApiConfig> {
  return apiConfig;
}

export interface ApiFetchInit extends Omit<RequestInit, 'body'> {
  /** A plain object is JSON-serialised and gets a `Content-Type` header. */
  body?: unknown;
}

type HeadersRecord = Record<string, string>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const prototype = Object.getPrototypeOf(value) as object | null;
  return prototype === Object.prototype || prototype === null;
}

/** Flatten any `HeadersInit` into a lowercase-keyed record. */
function normalizeHeaders(input?: HeadersInit): HeadersRecord {
  const normalized: HeadersRecord = {};
  if (input === undefined || input === null) return normalized;

  const asHeaders = input as Headers;
  if (typeof asHeaders.forEach === 'function' && typeof asHeaders.get === 'function') {
    asHeaders.forEach((value, key) => {
      normalized[key.toLowerCase()] = value;
    });
    return normalized;
  }
  if (Array.isArray(input)) {
    for (const [key, value] of input) normalized[key.toLowerCase()] = value;
    return normalized;
  }
  for (const [key, value] of Object.entries(input)) normalized[key.toLowerCase()] = value;
  return normalized;
}

/** Read the double-submit CSRF token. Returns `undefined` during SSR. */
function readCsrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  for (const part of document.cookie.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== CSRF_COOKIE_NAME) continue;
    const raw = part.slice(separator + 1).trim();
    if (raw === '') return undefined;
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return undefined;
}

async function readErrorEnvelope(response: Response): Promise<ErrorEnvelope> {
  try {
    const parsed: unknown = await response.json();
    if (isPlainObject(parsed) && typeof parsed.error === 'string') {
      return {
        error: parsed.error,
        message: typeof parsed.message === 'string' ? parsed.message : undefined,
        details: Array.isArray(parsed.details) ? parsed.details : undefined,
      };
    }
  } catch {
    // A non-JSON error body is a gateway/proxy failure; fall through to the default.
  }
  return { error: response.status === 401 ? 'unauthorized' : 'request_failed' };
}

/**
 * Perform an authenticated API request and return the parsed JSON body.
 * Throws `ApiError` for any non-2xx response.
 */
export async function apiFetch<T>(path: string, init: ApiFetchInit = {}): Promise<T> {
  const { body, headers, method, ...rest } = init;
  const resolvedMethod = (method ?? 'GET').toUpperCase();

  const finalHeaders = normalizeHeaders(headers);
  // The session is a cookie; a bearer token must never leave the browser.
  delete finalHeaders.authorization;
  if (finalHeaders.accept === undefined) finalHeaders.accept = 'application/json';

  let payload: BodyInit | undefined;
  if (body !== undefined && body !== null) {
    if (isPlainObject(body) || Array.isArray(body)) {
      payload = JSON.stringify(body);
      if (finalHeaders['content-type'] === undefined) {
        finalHeaders['content-type'] = 'application/json';
      }
    } else {
      payload = body as BodyInit;
    }
  }

  if (!SAFE_METHODS.has(resolvedMethod)) {
    const csrfToken = readCsrfToken();
    if (csrfToken !== undefined && finalHeaders[CSRF_HEADER_NAME] === undefined) {
      finalHeaders[CSRF_HEADER_NAME] = csrfToken;
    }
  }

  const response = await fetch(`${apiConfig.baseUrl}${path}`, {
    ...rest,
    method: resolvedMethod,
    headers: finalHeaders,
    body: payload,
    credentials: 'include',
  });

  const requestId = response.headers.get('x-request-id') ?? undefined;

  if (!response.ok) {
    const envelope = await readErrorEnvelope(response);
    if (response.status === 401) apiConfig.onUnauthorized?.();
    throw new ApiError(
      response.status,
      envelope.error,
      envelope.message,
      envelope.details,
      requestId,
    );
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  if (text === '') return undefined as T;
  return JSON.parse(text) as T;
}

export function apiGet<T>(path: string, init: ApiFetchInit = {}): Promise<T> {
  return apiFetch<T>(path, { ...init, method: 'GET' });
}

export function apiPost<T>(path: string, body?: unknown, init: ApiFetchInit = {}): Promise<T> {
  return apiFetch<T>(path, { ...init, method: 'POST', body });
}

export function apiPut<T>(path: string, body?: unknown, init: ApiFetchInit = {}): Promise<T> {
  return apiFetch<T>(path, { ...init, method: 'PUT', body });
}

export function apiPatch<T>(path: string, body?: unknown, init: ApiFetchInit = {}): Promise<T> {
  return apiFetch<T>(path, { ...init, method: 'PATCH', body });
}

export function apiDelete<T>(path: string, init: ApiFetchInit = {}): Promise<T> {
  return apiFetch<T>(path, { ...init, method: 'DELETE' });
}

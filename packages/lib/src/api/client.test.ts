import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  apiDelete,
  apiFetch,
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
  configureApi,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  getApiConfig,
} from './client';
import { createQueryClient } from './query-client';
import { queryKeys } from './query-keys';
import { ApiError, isApiError } from './errors';

interface FakeResponseOptions {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
  rawText?: string;
}

/** Minimal `Response` double — only the members `apiFetch` touches. */
function fakeResponse(options: FakeResponseOptions = {}): Response {
  const { status = 200, body, headers = {}, rawText } = options;
  const lowered: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) lowered[key.toLowerCase()] = value;
  const serialized = rawText ?? (body === undefined ? '' : JSON.stringify(body));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => lowered[name.toLowerCase()] ?? null },
    json: async () => JSON.parse(serialized) as unknown,
    text: async () => serialized,
  } as unknown as Response;
}

interface CapturedCall {
  url: string;
  init: RequestInit;
}

type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const calls: CapturedCall[] = [];

function stubFetch(respond: (call: CapturedCall) => Response): void {
  const impl: FetchImpl = async (input, init) => {
    const call: CapturedCall = { url: String(input), init: init ?? {} };
    calls.push(call);
    return respond(call);
  };
  vi.stubGlobal('fetch', impl);
}

function headersOf(call: CapturedCall): Record<string, string> {
  return (call.init.headers ?? {}) as Record<string, string>;
}

function setCsrfCookie(value: string): void {
  document.cookie = `${CSRF_COOKIE_NAME}=${encodeURIComponent(value)}; path=/`;
}

function clearCsrfCookie(): void {
  document.cookie = `${CSRF_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

beforeEach(() => {
  calls.length = 0;
  clearCsrfCookie();
  configureApi({ baseUrl: 'https://api.vunvault.test', onUnauthorized: undefined });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('configureApi', () => {
  it('prefixes every path with the configured base URL', async () => {
    stubFetch(() => fakeResponse({ body: { data: { ok: true } } }));
    await apiGet<{ data: { ok: boolean } }>('/api/v1/auth/session');
    expect(calls[0]?.url).toBe('https://api.vunvault.test/api/v1/auth/session');
  });

  it('exposes the effective configuration', () => {
    configureApi({ baseUrl: 'https://example.test' });
    expect(getApiConfig().baseUrl).toBe('https://example.test');
  });
});

describe('credentials and headers', () => {
  it('sends credentials: "include" on every call', async () => {
    stubFetch(() => fakeResponse({ status: 204 }));
    await apiGet('/api/v1/scans');
    await apiPost('/api/v1/scans', { targetHost: 'api.example.test' });
    await apiPut('/api/v1/profile', {});
    await apiPatch('/api/v1/profile', {});
    await apiDelete('/api/v1/admin/users/1');
    expect(calls).toHaveLength(5);
    for (const call of calls) expect(call.init.credentials).toBe('include');
  });

  it('sets Accept and a JSON Content-Type only for object bodies', async () => {
    stubFetch(() => fakeResponse({ body: {} }));
    await apiGet('/api/v1/scans');
    expect(headersOf(calls[0] as CapturedCall).accept).toBe('application/json');
    expect(headersOf(calls[0] as CapturedCall)['content-type']).toBeUndefined();

    await apiPost('/api/v1/scans', { targetHost: 'api.example.test' });
    expect(headersOf(calls[1] as CapturedCall)['content-type']).toBe('application/json');
    expect(calls[1]?.init.body).toBe(JSON.stringify({ targetHost: 'api.example.test' }));
  });

  it('never attaches an Authorization header, even if a caller tries', async () => {
    stubFetch(() => fakeResponse({ body: {} }));
    await apiFetch('/api/v1/scans', { headers: { Authorization: 'Bearer leaked' } });
    expect(headersOf(calls[0] as CapturedCall).authorization).toBeUndefined();
  });

  it('forwards an AbortSignal', async () => {
    stubFetch(() => fakeResponse({ body: {} }));
    const controller = new AbortController();
    await apiGet('/api/v1/scans', { signal: controller.signal });
    expect(calls[0]?.init.signal).toBe(controller.signal);
  });
});

describe('CSRF double submit', () => {
  it('attaches the vv_csrf cookie on POST but not on GET', async () => {
    setCsrfCookie('csrf-token-value');
    stubFetch(() => fakeResponse({ body: {} }));

    await apiGet('/api/v1/scans');
    expect(headersOf(calls[0] as CapturedCall)[CSRF_HEADER_NAME]).toBeUndefined();

    await apiPost('/api/v1/scans', { targetHost: 'api.example.test' });
    expect(headersOf(calls[1] as CapturedCall)[CSRF_HEADER_NAME]).toBe('csrf-token-value');
  });

  it('attaches the token to every mutating method', async () => {
    setCsrfCookie('csrf-token-value');
    stubFetch(() => fakeResponse({ status: 204 }));
    await apiPut('/api/v1/billing/payment-method', {});
    await apiPatch('/api/v1/profile', {});
    await apiDelete('/api/v1/admin/users/1');
    for (const call of calls) {
      expect(headersOf(call)[CSRF_HEADER_NAME]).toBe('csrf-token-value');
    }
  });

  it('omits the header when the cookie is absent', async () => {
    stubFetch(() => fakeResponse({ body: {} }));
    await apiPost('/api/v1/scans', {});
    expect(headersOf(calls[0] as CapturedCall)[CSRF_HEADER_NAME]).toBeUndefined();
  });
});

describe('responses', () => {
  it('returns undefined for 204', async () => {
    stubFetch(() => fakeResponse({ status: 204 }));
    await expect(apiDelete('/api/v1/auth/logout')).resolves.toBeUndefined();
  });

  it('parses the 2xx envelope', async () => {
    stubFetch(() => fakeResponse({ body: { data: { total: 24 }, total: 24 } }));
    await expect(apiGet<{ data: { total: number } }>('/api/v1/admin/users')).resolves.toEqual({
      data: { total: 24 },
      total: 24,
    });
  });
});

describe('errors', () => {
  it('maps the error envelope onto ApiError with code and requestId', async () => {
    stubFetch(() =>
      fakeResponse({
        status: 400,
        headers: { 'x-request-id': 'req_01HZX' },
        body: {
          error: 'validation_failed',
          message: 'Check the highlighted fields',
          details: [{ path: ['email'], message: 'Enter a valid work email' }],
        },
      }),
    );

    const error = await apiPost('/api/v1/admin/users/invitations', {}).catch(
      (caught: unknown) => caught,
    );
    expect(isApiError(error)).toBe(true);
    const apiError = error as ApiError;
    expect(apiError).toBeInstanceOf(ApiError);
    expect(apiError.status).toBe(400);
    expect(apiError.code).toBe('validation_failed');
    expect(apiError.message).toBe('Check the highlighted fields');
    expect(apiError.details).toEqual([{ path: ['email'], message: 'Enter a valid work email' }]);
    expect(apiError.requestId).toBe('req_01HZX');
    expect(apiError.name).toBe('ApiError');
  });

  it('calls onUnauthorized and still throws on 401', async () => {
    const onUnauthorized = vi.fn();
    configureApi({ onUnauthorized });
    stubFetch(() =>
      fakeResponse({
        status: 401,
        headers: { 'x-request-id': 'req_401' },
        body: { error: 'unauthorized' },
      }),
    );

    await expect(apiGet('/api/v1/auth/session')).rejects.toThrow(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);

    const error = await apiGet('/api/v1/auth/session').catch((caught: unknown) => caught);
    expect((error as ApiError).status).toBe(401);
    expect((error as ApiError).code).toBe('unauthorized');
    expect((error as ApiError).message).toBe('unauthorized');
  });

  it('falls back to a generic code when the error body is not JSON', async () => {
    stubFetch(() => fakeResponse({ status: 502, rawText: '<html>bad gateway</html>' }));
    const error = await apiGet('/api/v1/scans').catch((caught: unknown) => caught);
    expect((error as ApiError).status).toBe(502);
    expect((error as ApiError).code).toBe('request_failed');
  });

  it('defaults a 401 without a body to the unauthorized code', async () => {
    stubFetch(() => fakeResponse({ status: 401, rawText: '' }));
    const error = await apiGet('/api/v1/scans').catch((caught: unknown) => caught);
    expect((error as ApiError).code).toBe('unauthorized');
  });
});

describe('queryKeys', () => {
  it('builds the canonical key hierarchy', () => {
    expect(queryKeys.session()).toEqual(['session']);
    expect(queryKeys.profile()).toEqual(['profile']);
    expect(queryKeys.users.list({ page: 1 })).toEqual(['users', 'list', { page: 1 }]);
    expect(queryKeys.users.invitations()).toEqual(['users', 'invitations']);
    expect(queryKeys.scans.detail('job-1')).toEqual(['scans', 'detail', 'job-1']);
    expect(queryKeys.scans.adminQueue({ status: 'running' })).toEqual([
      'scans',
      'admin-queue',
      { status: 'running' },
    ]);
    expect(queryKeys.scans.summary()).toEqual(['scans', 'summary']);
    expect(queryKeys.billing.fxQuote('inv-1', 'KES')).toEqual([
      'billing',
      'fx-quote',
      'inv-1',
      'KES',
    ]);
    expect(queryKeys.billing.paymentMethod()).toEqual(['billing', 'payment-method']);
    expect(queryKeys.content.moderation({ status: 'pending_review' })).toEqual([
      'content',
      'moderation',
      { status: 'pending_review' },
    ]);
    expect(queryKeys.audit.chain()).toEqual(['audit', 'chain']);
  });
});

describe('createQueryClient', () => {
  it('applies the documented defaults', () => {
    const client = createQueryClient();
    const defaults = client.getDefaultOptions();
    expect(defaults.queries?.staleTime).toBe(30_000);
    expect(defaults.queries?.gcTime).toBe(300_000);
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
    expect(defaults.mutations?.retry).toBe(false);
    client.clear();
  });

  it('never retries a 4xx and retries everything else twice', () => {
    const client = createQueryClient();
    const retry = client.getDefaultOptions().queries?.retry as (
      failureCount: number,
      error: unknown,
    ) => boolean;

    expect(retry(0, new ApiError(400, 'validation_failed'))).toBe(false);
    expect(retry(0, new ApiError(401, 'unauthorized'))).toBe(false);
    expect(retry(0, new ApiError(403, 'forbidden'))).toBe(false);
    expect(retry(0, new ApiError(404, 'not_found'))).toBe(false);
    expect(retry(0, new ApiError(429, 'rate_limited'))).toBe(false);
    expect(retry(0, new ApiError(500, 'internal_error'))).toBe(true);
    expect(retry(1, new ApiError(503, 'unavailable'))).toBe(true);
    expect(retry(2, new ApiError(503, 'unavailable'))).toBe(false);
    expect(retry(0, new Error('network down'))).toBe(true);
    expect(retry(2, new Error('network down'))).toBe(false);
    client.clear();
  });
});

import type { UampHeader, UampResponseAssertion } from '@vunvault/db';
import { guardTarget } from './target-guard.js';

export interface CheckInput {
  target: string;
  method?: string | null;
  timeoutMs: number;
  headers?: UampHeader[] | null;
  requestBody?: string | null;
  assertions?: UampResponseAssertion | null;
  keyword?: string | null;
  userAgent: string;
}

export interface CheckOutcome {
  status: 'up' | 'down' | 'degraded' | 'error' | 'timeout';
  httpStatus: number | null;
  latencyMs: number | null;
  errorMessage: string | null;
  responseSnippet: string | null;
}

export async function runCheck(input: CheckInput): Promise<CheckOutcome> {
  const guarded = guardTarget(input.target);
  if (!guarded.ok) {
    return {
      status: 'error',
      httpStatus: null,
      latencyMs: null,
      errorMessage: `target_blocked:${guarded.reason}`,
      responseSnippet: null,
    };
  }

  const method = (input.method ?? 'GET').toUpperCase();
  const headers = new Headers();
  headers.set('User-Agent', input.userAgent);
  headers.set('Accept', '*/*');
  for (const h of input.headers ?? []) {
    if (h.name && !['host', 'content-length'].includes(h.name.toLowerCase())) {
      headers.set(h.name, h.value);
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  const started = Date.now();

  try {
    const init: RequestInit = {
      method,
      headers,
      // Never follow an untrusted redirect automatically; it could target a private service.
      // A future redirect feature must validate every hop and the resolved destination IP.
      redirect: 'manual',
      signal: controller.signal,
    };
    if (input.requestBody && ['POST', 'PUT', 'PATCH'].includes(method)) {
      init.body = input.requestBody;
    }
    const response = await fetch(guarded.url, init);
    const latencyMs = Date.now() - started;
    const text = await response.text().catch(() => '');
    const snippet = text.slice(0, 512);

    const expected = input.assertions?.expectedStatusCodes ?? [200, 201, 204];
    let status: CheckOutcome['status'] = expected.includes(response.status) ? 'up' : 'down';

    if (status === 'up' && input.keyword && !text.includes(input.keyword)) {
      status = 'down';
    }
    if (status === 'up' && input.assertions?.bodyContains && !text.includes(input.assertions.bodyContains)) {
      status = 'down';
    }
    if (
      status === 'up' &&
      input.assertions?.maxLatencyMs !== undefined &&
      latencyMs > input.assertions.maxLatencyMs
    ) {
      status = 'degraded';
    }

    return {
      status,
      httpStatus: response.status,
      latencyMs,
      errorMessage: status === 'up' || status === 'degraded' ? null : `unexpected_status:${response.status}`,
      responseSnippet: snippet || null,
    };
  } catch (err) {
    const latencyMs = Date.now() - started;
    const name = err instanceof Error ? err.name : 'Error';
    const message = err instanceof Error ? err.message.slice(0, 400) : 'unknown_error';
    if (name === 'AbortError') {
      return {
        status: 'timeout',
        httpStatus: null,
        latencyMs,
        errorMessage: 'timeout',
        responseSnippet: null,
      };
    }
    return {
      status: 'error',
      httpStatus: null,
      latencyMs,
      errorMessage: message,
      responseSnippet: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

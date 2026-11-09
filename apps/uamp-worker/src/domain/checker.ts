import { isDeepStrictEqual } from 'node:util';
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

type JsonPathResult = { found: true; value: unknown } | { found: false };

function resolveJsonPath(root: unknown, path: string): JsonPathResult {
  if (path === '
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
    let assertionFailure: string | null = status === 'up' ? null : `unexpected_status:${response.status}`;

    if (status === 'up' && input.keyword && !text.includes(input.keyword)) {
      status = 'down';
      assertionFailure = 'keyword_assertion_failed';
    }
    if (status === 'up' && input.assertions?.bodyContains && !text.includes(input.assertions.bodyContains)) {
      status = 'down';
      assertionFailure = 'body_assertion_failed';
    }
    if (
      status === 'up' &&
      (input.assertions?.jsonPath !== undefined || input.assertions?.jsonEquals !== undefined)
    ) {
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        status = 'down';
        assertionFailure = 'json_response_invalid';
      }
      if (status === 'up') {
        const resolved = input.assertions?.jsonPath === undefined
          ? { found: true as const, value: payload }
          : resolveJsonPath(payload, input.assertions.jsonPath);
        if (
          !resolved.found ||
          (input.assertions?.jsonEquals !== undefined &&
            !isDeepStrictEqual(resolved.value, input.assertions.jsonEquals))
        ) {
          status = 'down';
          assertionFailure = 'json_assertion_failed';
        }
      }
    }
    if (
      status === 'up' &&
      input.assertions?.maxLatencyMs !== undefined &&
      latencyMs > input.assertions.maxLatencyMs
    ) {
      status = 'degraded';
      assertionFailure = null;
    }

    return {
      status,
      httpStatus: response.status,
      latencyMs,
      errorMessage: status === 'up' || status === 'degraded' ? null : assertionFailure,
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
 || path === '') return { found: true, value: root };
  let remaining = path.startsWith('
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
) ? path.slice(1) : path;
  const segments: Array<string | number> = [];

  while (remaining.length > 0) {
    if (remaining.startsWith('.')) {
      const match = /^\.([A-Za-z_$][\\w$-]*)/.exec(remaining);
      if (!match) return { found: false };
      segments.push(match[1]!);
      remaining = remaining.slice(match[0].length);
      continue;
    }
    if (remaining.startsWith('[')) {
      const match = /^\\[(\\d+)\\]/.exec(remaining);
      if (!match) return { found: false };
      segments.push(Number(match[1]));
      remaining = remaining.slice(match[0].length);
      continue;
    }
    if (segments.length === 0) {
      const match = /^([A-Za-z_$][\\w$-]*)/.exec(remaining);
      if (!match) return { found: false };
      segments.push(match[1]!);
      remaining = remaining.slice(match[0].length);
      continue;
    }
    return { found: false };
  }

  let value = root;
  for (const segment of segments) {
    if (
      typeof segment === 'string' &&
      (segment === '__proto__' || segment === 'prototype' || segment === 'constructor')
    ) {
      return { found: false };
    }
    if (Array.isArray(value) && typeof segment === 'number') {
      if (segment >= value.length) return { found: false };
      value = value[segment];
      continue;
    }
    if (
      value !== null &&
      typeof value === 'object' &&
      typeof segment === 'string' &&
      Object.prototype.hasOwnProperty.call(value, segment)
    ) {
      value = (value as Record<string, unknown>)[segment];
      continue;
    }
    return { found: false };
  }
  return { found: true, value };
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

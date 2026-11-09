import { isDeepStrictEqual } from 'node:util';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import type { UampHeader, UampResponseAssertion } from '@vunvault/db';
import { resolveGuardedTarget } from './target-guard.js';

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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  const started = Date.now();

  try {
    const guarded = await resolveGuardedTarget(input.target);
    if (!guarded.ok) {
      return {
        status: 'error',
        httpStatus: null,
        latencyMs: Date.now() - started,
        errorMessage: `target_blocked:${guarded.reason}`,
        responseSnippet: null,
      };
    }
    if (controller.signal.aborted) {
      throw new DOMException('The operation was aborted', 'AbortError');
    }

    const method = (input.method ?? 'GET').toUpperCase();
    const headers = new Headers();
    headers.set('User-Agent', input.userAgent);
    headers.set('Accept', '*/*');
    for (const h of input.headers ?? []) {
      if (h.name && !['host', 'content-length', 'connection'].includes(h.name.toLowerCase())) {
        headers.set(h.name, h.value);
      }
    }
    const body = input.requestBody && ['POST', 'PUT', 'PATCH'].includes(method)
      ? input.requestBody
      : undefined;

    // Connect to the exact address that passed the DNS/IP policy check. The
    // original hostname remains in the URL for HTTP Host and TLS SNI validation.
    const response = await requestPinned(guarded.url, guarded.address, guarded.family, {
      method,
      headers: Object.fromEntries(headers.entries()),
      body,
      signal: controller.signal,
    });
    const latencyMs = Date.now() - started;
    const text = response.text;
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

const MAX_RESPONSE_BYTES = 1_048_576;

async function requestPinned(
  url: URL,
  address: string,
  family: 4 | 6,
  options: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    signal: AbortSignal;
  },
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const hostname = url.hostname.replace(/^\\[|\\]$/g, '');
    const pinnedLookup = ((
      _hostname: string,
      lookupOptions: unknown,
      callback: (...args: unknown[]) => void,
    ) => {
      const all = typeof lookupOptions === 'object' &&
        lookupOptions !== null &&
        (lookupOptions as { all?: boolean }).all === true;
      if (all) callback(null, [{ address, family }]);
      else callback(null, address, family);
    }) as never;

    const requestOptions = {
      method: options.method,
      headers: options.headers,
      signal: options.signal,
      lookup: pinnedLookup,
      agent: false,
      servername: isIP(hostname) === 0 ? hostname : undefined,
    };

    let request: import('node:http').ClientRequest;
    const onResponse = (response: import('node:http').IncomingMessage) => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > MAX_RESPONSE_BYTES) {
          request.destroy(new Error('response_too_large'));
          return;
        }
        chunks.push(buffer);
      });
      response.on('error', reject);
      response.on('aborted', () => reject(new Error('response_aborted')));
      response.on('end', () => {
        resolve({
          status: response.statusCode ?? 0,
          text: Buffer.concat(chunks).toString('utf8'),
        });
      });
    };

    request = url.protocol === 'https:'
      ? httpsRequest(url, requestOptions, onResponse)
      : httpRequest(url, requestOptions, onResponse);
    request.on('error', reject);
    if (options.body !== undefined) request.write(options.body);
    request.end();
  });
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

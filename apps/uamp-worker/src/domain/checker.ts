import { isDeepStrictEqual } from 'node:util';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { checkServerIdentity, connect as tlsConnect } from 'node:tls';
import type { UampHeader, UampResponseAssertion } from '@vunvault/db';
import { guardTarget, resolveGuardedTarget, type ResolvedGuardResult } from './target-guard.js';

export interface CheckInput {
  target: string;
  type?: string;
  warnDaysBeforeExpiry?: number | null;
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
  if (path === '$' || path === '') return { found: true, value: root };
  let remaining = path.startsWith('$') ? path.slice(1) : path;
  const segments: Array<string | number> = [];

  while (remaining.length > 0) {
    if (remaining.startsWith('.')) {
      const match = /^\.([A-Za-z_$][\w$-]*)/.exec(remaining);
      if (!match) return { found: false };
      segments.push(match[1]!);
      remaining = remaining.slice(match[0].length);
      continue;
    }
    if (remaining.startsWith('[')) {
      const match = /^\[(\d+)\]/.exec(remaining);
      if (!match) return { found: false };
      segments.push(Number(match[1]));
      remaining = remaining.slice(match[0].length);
      continue;
    }
    if (segments.length === 0) {
      const match = /^([A-Za-z_$][\w$-]*)/.exec(remaining);
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
): Promise<{ status: number; text: string; location?: string }> {
  return new Promise((resolve, reject) => {
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    const pinnedLookup = ((
      _hostname: string,
      lookupOptions: unknown,
      callback: (...args: unknown[]) => void,
    ) => {
      const all =
        typeof lookupOptions === 'object' &&
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

    let request: import('node:http').ClientRequest | undefined;
    const onResponse = (response: import('node:http').IncomingMessage) => {
      const chunks: Buffer[] = [];
      let size = 0;
      let oversized = false;
      response.on('data', (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > MAX_RESPONSE_BYTES) {
          oversized = true;
          request?.destroy();
          return;
        }
        chunks.push(buffer);
      });
      response.on('error', reject);
      response.on('aborted', () => reject(new Error('response_aborted')));
      response.on('end', () => {
        if (oversized) {
          reject(new Error('response_too_large'));
          return;
        }
        resolve({
          status: response.statusCode ?? 0,
          text: Buffer.concat(chunks).toString('utf8'),
          location: response.headers.location,
        });
      });
    };

    const req =
      url.protocol === 'https:'
        ? httpsRequest(url, requestOptions, onResponse)
        : httpRequest(url, requestOptions, onResponse);
    request = req;
    req.on('error', reject);
    if (options.body !== undefined) req.write(options.body);
    req.end();
  });
}

export interface SslProbeResult {
  validTo: string;
  authorized: boolean;
  hostnameValid: boolean;
}

export interface CheckDependencies {
  resolveTarget?: (target: string) => Promise<ResolvedGuardResult>;
  request?: typeof requestPinned;
  sslProbe?: (input: {
    address: string;
    hostname: string;
    port: number;
    timeoutMs: number;
  }) => Promise<SslProbeResult>;
}

async function probeSslCertificate(input: {
  address: string;
  hostname: string;
  port: number;
  timeoutMs: number;
}): Promise<SslProbeResult> {
  return new Promise((resolve, reject) => {
    const socket = tlsConnect({
      host: input.address,
      port: input.port,
      servername: isIP(input.hostname) === 0 ? input.hostname : undefined,
      rejectUnauthorized: false,
    });
    const timer = setTimeout(() => {
      const error = new Error('timeout');
      error.name = 'AbortError';
      socket.destroy(error);
    }, input.timeoutMs);
    socket.once('secureConnect', () => {
      clearTimeout(timer);
      const certificate = socket.getPeerCertificate();
      const validTo = certificate.valid_to;
      const identityError = checkServerIdentity(input.hostname, certificate);
      socket.end();
      if (typeof validTo !== 'string' || validTo.length === 0) {
        reject(new Error('certificate_missing'));
        return;
      }
      resolve({
        validTo,
        authorized: socket.authorized,
        hostnameValid: identityError === undefined,
      });
    });
    socket.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function runDomainCheck(
  input: CheckInput,
  dependencies: CheckDependencies,
): Promise<CheckOutcome> {
  const started = Date.now();
  const guardedInput = guardTarget(input.target);
  if (!guardedInput.ok) {
    return {
      status: 'error',
      httpStatus: null,
      latencyMs: Date.now() - started,
      errorMessage: 'target_blocked:' + guardedInput.reason,
      responseSnippet: null,
    };
  }
  const hostname = guardedInput.url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(hostname) !== 0) {
    return {
      status: 'error',
      httpStatus: null,
      latencyMs: Date.now() - started,
      errorMessage: 'domain_monitor_requires_hostname',
      responseSnippet: null,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  const resolver = dependencies.resolveTarget ?? resolveGuardedTarget;
  const request = dependencies.request ?? requestPinned;
  let url = new URL('https://rdap.org/domain/' + encodeURIComponent(hostname));

  try {
    let response: { status: number; text: string; location?: string } | undefined;
    for (let redirect = 0; redirect <= 3; redirect += 1) {
      const guarded = await resolver(url.toString());
      if (!guarded.ok) {
        return {
          status: 'error',
          httpStatus: null,
          latencyMs: Date.now() - started,
          errorMessage: 'rdap_target_blocked:' + guarded.reason,
          responseSnippet: null,
        };
      }
      if (controller.signal.aborted) {
        throw new DOMException('The operation was aborted', 'AbortError');
      }
      response = await request(guarded.url, guarded.address, guarded.family, {
        method: 'GET',
        headers: {
          Accept: 'application/rdap+json, application/json',
          'User-Agent': input.userAgent,
        },
        signal: controller.signal,
      });
      if ([301, 302, 303, 307, 308].includes(response.status) && response.location) {
        if (redirect === 3) throw new Error('rdap_redirect_limit');
        const nextUrl = new URL(response.location, url);
        if (nextUrl.protocol !== 'https:') throw new Error('rdap_redirect_protocol_not_allowed');
        url = nextUrl;
        continue;
      }
      break;
    }

    if (response === undefined) throw new Error('rdap_response_missing');
    if (response.status === 404) {
      return {
        status: 'down',
        httpStatus: response.status,
        latencyMs: Date.now() - started,
        errorMessage: 'domain_not_registered',
        responseSnippet: null,
      };
    }
    if (response.status !== 200) {
      return {
        status: 'error',
        httpStatus: response.status,
        latencyMs: Date.now() - started,
        errorMessage: 'rdap_http_status:' + response.status,
        responseSnippet: response.text.slice(0, 512) || null,
      };
    }

    const document = JSON.parse(response.text) as {
      events?: Array<{ eventAction?: string; eventDate?: string }>;
    };
    const expiration = document.events?.find((event) =>
      ['expiration', 'expiry'].includes((event.eventAction ?? '').toLowerCase()),
    );
    const expiresAt = expiration?.eventDate ? Date.parse(expiration.eventDate) : Number.NaN;
    if (!Number.isFinite(expiresAt)) throw new Error('rdap_expiration_event_missing');

    const remainingDays = (expiresAt - Date.now()) / 86_400_000;
    const status: CheckOutcome['status'] =
      remainingDays <= 0
        ? 'down'
        : remainingDays <= (input.warnDaysBeforeExpiry ?? 30)
          ? 'degraded'
          : 'up';
    return {
      status,
      httpStatus: response.status,
      latencyMs: Date.now() - started,
      errorMessage: remainingDays <= 0 ? 'domain_expired' : null,
      responseSnippet: 'expires_at:' + new Date(expiresAt).toISOString(),
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : 'Error';
    return {
      status: name === 'AbortError' ? 'timeout' : 'error',
      httpStatus: null,
      latencyMs: Date.now() - started,
      errorMessage:
        name === 'AbortError'
          ? 'timeout'
          : error instanceof Error
            ? error.message.slice(0, 400)
            : 'domain_check_failed',
      responseSnippet: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runDnsCheck(
  input: CheckInput,
  dependencies: CheckDependencies,
): Promise<CheckOutcome> {
  const started = Date.now();
  const guarded = await (dependencies.resolveTarget ?? resolveGuardedTarget)(input.target);
  if (!guarded.ok) {
    const status: CheckOutcome['status'] =
      guarded.reason === 'dns_no_addresses' || guarded.reason === 'dns_resolution_failed'
        ? 'down'
        : 'error';
    return {
      status,
      httpStatus: null,
      latencyMs: Date.now() - started,
      errorMessage: guarded.reason,
      responseSnippet: null,
    };
  }
  if (isIP(guarded.url.hostname.replace(/^\[|\]$/g, '')) !== 0) {
    return {
      status: 'error',
      httpStatus: null,
      latencyMs: Date.now() - started,
      errorMessage: 'dns_monitor_requires_hostname',
      responseSnippet: null,
    };
  }
  return {
    status: 'up',
    httpStatus: null,
    latencyMs: Date.now() - started,
    errorMessage: null,
    responseSnippet: guarded.address,
  };
}

async function runSslCheck(
  input: CheckInput,
  dependencies: CheckDependencies,
): Promise<CheckOutcome> {
  const started = Date.now();
  const guarded = await (dependencies.resolveTarget ?? resolveGuardedTarget)(input.target);
  if (!guarded.ok) {
    return {
      status: 'error',
      httpStatus: null,
      latencyMs: Date.now() - started,
      errorMessage: 'target_blocked:' + guarded.reason,
      responseSnippet: null,
    };
  }
  if (guarded.url.protocol !== 'https:') {
    return {
      status: 'error',
      httpStatus: null,
      latencyMs: Date.now() - started,
      errorMessage: 'ssl_monitor_requires_https',
      responseSnippet: null,
    };
  }

  try {
    const hostname = guarded.url.hostname.replace(/^\[|\]$/g, '');
    const certificate = await (dependencies.sslProbe ?? probeSslCertificate)({
      address: guarded.address,
      hostname,
      port: Number(guarded.url.port || 443),
      timeoutMs: input.timeoutMs,
    });
    const expiresAt = Date.parse(certificate.validTo);
    if (!Number.isFinite(expiresAt)) throw new Error('certificate_expiry_invalid');
    const remainingDays = (expiresAt - Date.now()) / 86_400_000;
    const expired = remainingDays <= 0;
    const valid = certificate.authorized && certificate.hostnameValid && !expired;
    const status: CheckOutcome['status'] = !valid
      ? 'down'
      : remainingDays <= (input.warnDaysBeforeExpiry ?? 14)
        ? 'degraded'
        : 'up';
    return {
      status,
      httpStatus: null,
      latencyMs: Date.now() - started,
      errorMessage: valid ? null : expired ? 'certificate_expired' : 'certificate_validation_failed',
      responseSnippet: 'expires_at:' + new Date(expiresAt).toISOString(),
    };
  } catch (error) {
    const name = error instanceof Error ? error.name : 'Error';
    return {
      status: name === 'AbortError' ? 'timeout' : 'error',
      httpStatus: null,
      latencyMs: Date.now() - started,
      errorMessage:
        name === 'AbortError'
          ? 'timeout'
          : error instanceof Error
            ? error.message.slice(0, 400)
            : 'ssl_check_failed',
      responseSnippet: null,
    };
  }
}

export async function runCheck(
  input: CheckInput,
  dependencies: CheckDependencies = {},
): Promise<CheckOutcome> {
  if (input.type === 'dns') return runDnsCheck(input, dependencies);
  if (input.type === 'domain') return runDomainCheck(input, dependencies);
  if (input.type === 'ssl') return runSslCheck(input, dependencies);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  const started = Date.now();

  try {
    const guarded = await (dependencies.resolveTarget ?? resolveGuardedTarget)(input.target);
    if (!guarded.ok) {
      return {
        status: 'error',
        httpStatus: null,
        latencyMs: Date.now() - started,
        errorMessage: 'target_blocked:' + guarded.reason,
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
    for (const header of input.headers ?? []) {
      if (
        header.name &&
        !['host', 'content-length', 'connection'].includes(header.name.toLowerCase())
      ) {
        headers.set(header.name, header.value);
      }
    }
    const body =
      input.requestBody && ['POST', 'PUT', 'PATCH'].includes(method)
        ? input.requestBody
        : undefined;

    // The validated DNS answer is pinned by requestPinned. Redirects are never followed.
    const response = await (dependencies.request ?? requestPinned)(
      guarded.url,
      guarded.address,
      guarded.family,
      {
        method,
        headers: Object.fromEntries(headers.entries()),
        body,
        signal: controller.signal,
      },
    );
    const latencyMs = Date.now() - started;
    const text = response.text;
    const snippet = text.slice(0, 512);

    const expected = input.assertions?.expectedStatusCodes ?? [200, 201, 204];
    let status: CheckOutcome['status'] = expected.includes(response.status) ? 'up' : 'down';
    let assertionFailure: string | null =
      status === 'up' ? null : 'unexpected_status:' + response.status;

    if (status === 'up' && input.keyword && !text.includes(input.keyword)) {
      status = 'down';
      assertionFailure = 'keyword_assertion_failed';
    }
    if (
      status === 'up' &&
      input.assertions?.bodyContains &&
      !text.includes(input.assertions.bodyContains)
    ) {
      status = 'down';
      assertionFailure = 'body_assertion_failed';
    }
    if (
      status === 'up' &&
      (input.assertions?.jsonPath !== undefined ||
        input.assertions?.jsonEquals !== undefined)
    ) {
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        status = 'down';
        assertionFailure = 'json_response_invalid';
      }
      if (status === 'up') {
        const resolved =
          input.assertions?.jsonPath === undefined
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

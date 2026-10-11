import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { HttpError } from '../../../lib/http-error';

/**
 * HMAC authentication for the internal scan-controller callbacks (Task 40g).
 *
 * The controller runs where untrusted targets are scanned and holds NO
 * database credentials; the signature IS its identity. Every request carries:
 *
 *   x-vv-timestamp: unix milliseconds
 *   x-vv-signature: hex HMAC-SHA256(
 *     SCAN_CONTROLLER_HMAC_KEY,
 *     timestamp + "." + method + "." + path + "." + sha256hex(rawBody))
 *
 * `path` is the request URL as sent (these routes carry no query string).
 * The key is the secret string itself (≥32 bytes, base64-encoded at rest).
 *
 * Rejections: `|now − timestamp| > 60 s` → `401 stale`; a signature already
 * seen (Redis `internal:nonce:<signature>`, SET NX EX 120) → `401 replay`;
 * anything else → `401 bad_signature`. Every rejection is recorded as
 * `WEBHOOK_SIGNATURE_INVALID`, rate-limited to one audit entry per minute per
 * source IP. When `SCAN_CONTROLLER_CIDRS` is set, other source addresses get
 * `403 forbidden` before any crypto runs. A per-IP 600/min counter (the
 * `webhook` policy itself is unlimited) answers `429 rate_limited`.
 */

export const SIGNATURE_MAX_SKEW_MS = 60_000;
export const NONCE_TTL_SECONDS = 120;
export const INTERNAL_RATE_MAX_PER_MINUTE = 600;

export type InternalAuthFailure = 'bad_signature' | 'stale' | 'replay';

/** The two Redis operations the guard needs — trivially fakeable in tests. */
export interface NonceStore {
  /** `SET key '1' EX ttl NX` — true when the key was set (first sighting). */
  setIfAbsent(key: string, ttlSeconds: number): Promise<boolean>;
  /** `INCR key` (+ `EXPIRE` on first hit) — the new counter value. */
  incrementBucket(key: string, ttlSeconds: number): Promise<number>;
}

export interface InternalAuthDeps {
  getSecret: () => Promise<string>;
  nonce: NonceStore;
  /** Empty list = no IP restriction (the HMAC stays mandatory). */
  allowedCidrs: readonly string[];
  clientIpOf: (request: FastifyRequest) => string;
  auditFailure: (request: FastifyRequest, reason: InternalAuthFailure) => Promise<void>;
  /** Test seam; defaults to `Date.now()`. */
  now?: () => number;
}

export function sha256hex(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** The canonical signing payload — the controller implements the same string. */
export function internalSignaturePayload(
  timestamp: string | number,
  method: string,
  path: string,
  rawBody: Buffer | string,
): string {
  return `${timestamp}.${method}.${path}.${sha256hex(rawBody)}`;
}

/** Reference signer: hex HMAC-SHA256 over the canonical payload. */
export function signInternalRequest(
  key: string,
  timestamp: string | number,
  method: string,
  path: string,
  rawBody: Buffer | string,
): string {
  return createHmac('sha256', key)
    .update(internalSignaturePayload(timestamp, method, path, rawBody))
    .digest('hex');
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}

/** IPv4 CIDR (or bare IP = /32) membership; IPv6 only matches exactly. */
export function ipInCidr(ip: string, cidr: string): boolean {
  const [network, prefixText] = cidr.split('/');
  if (network === undefined) return false;
  if (prefixText === undefined) return ip === cidr;
  const prefix = Number(prefixText);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
  const ipValue = ipv4ToInt(ip);
  const netValue = ipv4ToInt(network);
  if (ipValue === null || netValue === null) return ip === cidr;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return ((ipValue >>> 0) & mask) === (netValue & mask);
}

/** `SCAN_CONTROLLER_CIDRS` → list; blank entries dropped, empty = unrestricted. */
export function parseCidrList(value: string | undefined): string[] {
  if (value === undefined) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value === '' ? undefined : value;
}

/**
 * The preHandler factory. Signature failures never throw past the 401 the
 * caller is owed — `auditFailure` is best-effort and itself rate-limited to
 * one entry per minute per source IP.
 */
export function verifyInternalSignature(deps: InternalAuthDeps) {
  const now = deps.now ?? ((): number => Date.now());

  return async function internalSignatureGuard(
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> {
    const ip = deps.clientIpOf(request);

    // 1. Optional source-address allow-list — before any crypto.
    if (deps.allowedCidrs.length > 0 && !deps.allowedCidrs.some((cidr) => ipInCidr(ip, cidr))) {
      throw HttpError.forbidden();
    }

    // 2. Per-IP volume cap (the `webhook` rate policy itself is unlimited).
    const minute = Math.floor(now() / 60_000);
    const hits = await deps.nonce.incrementBucket(`internal:rate:${ip}:${minute}`, 120);
    if (hits > INTERNAL_RATE_MAX_PER_MINUTE) {
      throw new HttpError(429, 'rate_limited', 'Too many internal requests');
    }

    const reject = async (reason: InternalAuthFailure): Promise<never> => {
      try {
        // One WEBHOOK_SIGNATURE_INVALID entry per minute per IP.
        const recorded = await deps.nonce.setIfAbsent(`internal:audit-fail:${ip}:${minute}`, 60);
        if (recorded) await deps.auditFailure(request, reason);
      } catch {
        // The client is owed the 401 even when the audit write fails.
      }
      throw new HttpError(401, reason);
    };

    // 3. Headers.
    const timestamp = headerValue(request.headers['x-vv-timestamp']);
    const signature = headerValue(request.headers['x-vv-signature']);
    if (
      timestamp === undefined ||
      signature === undefined ||
      !/^\d+$/.test(timestamp) ||
      !/^[0-9a-f]{64}$/i.test(signature)
    ) {
      await reject('bad_signature');
    }

    // 4. Skew window.
    if (Math.abs(now() - Number(timestamp)) > SIGNATURE_MAX_SKEW_MS) {
      await reject('stale');
    }

    // 5. Constant-time signature comparison over the canonical payload.
    const rawBody = request.rawBody ?? Buffer.alloc(0);
    const expected = signInternalRequest(
      await deps.getSecret(),
      timestamp as string,
      request.method,
      request.url,
      rawBody,
    );
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const providedBuffer = Buffer.from(String(signature).toLowerCase(), 'utf8');
    if (
      expectedBuffer.length !== providedBuffer.length ||
      !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      await reject('bad_signature');
    }

    // 6. Replay: a signature may be spent exactly once within its TTL.
    const fresh = await deps.nonce.setIfAbsent(
      `internal:nonce:${String(signature).toLowerCase()}`,
      NONCE_TTL_SECONDS,
    );
    if (!fresh) {
      await reject('replay');
    }
  };
}

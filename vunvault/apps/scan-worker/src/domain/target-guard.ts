import { resolve4 } from 'node:dns/promises';
import type { ScanType } from '@vunvault/contracts';

/**
 * Target guard (Task 84) — the controller's security control.
 *
 * This is the ONLY thing standing between a scan pod and an address it must
 * never touch, so it is written to fail closed: anything that is not provably a
 * public IPv4 name, address or small range is rejected, and a hostname is
 * rejected if ANY of its A records is forbidden.
 *
 * Two properties matter most:
 *
 *  1. **DNS rebinding.** The controller resolves the name itself
 *     (`node:dns/promises.resolve4`, not the OS cache) and hands the pod the
 *     PINNED IPs. The pod never resolves a name, so a record that changes
 *     between authorisation and execution cannot redirect a scan inward.
 *  2. **Cloud metadata.** `169.254.169.254` is inside the link-local range
 *     listed below, which is why that range is forbidden wholesale rather than
 *     by special case.
 *
 * IPv6 is rejected in v1: the pod's egress policy pins IPv4 addresses, and
 * admitting v6 without an equivalent pin would reopen exactly the hole this
 * module exists to close.
 */

/** Hostname shape the spec allows: lower-cased labels, no trailing dot. */
const HOSTNAME_PATTERN = /^(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/;

const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** The smallest CIDR prefix accepted — a /24 is 256 addresses. */
export const MIN_CIDR_PREFIX = 24;

/** Never hand a pod more addresses than this. */
export const MAX_RESOLVED_IPS = 16;

/** DNS answers are waited for at most this long. */
export const RESOLVE_TIMEOUT_MS = 3_000;

export type TargetRejectReason = 'invalid_target' | 'target_not_allowed';

export type ValidateTargetResult =
  | { ok: true; kind: 'host'; host: string }
  | { ok: true; kind: 'ip'; ip: string }
  | { ok: true; kind: 'cidr'; cidr: string; prefix: number }
  | { ok: false; reason: TargetRejectReason };

export type ResolveTargetResult =
  | { ok: true; host: string; ips: string[]; cidr?: string }
  | { ok: false; reason: TargetRejectReason };

/** Forbidden ranges, as `[network, prefix]`. */
const FORBIDDEN_RANGES: readonly (readonly [number, number])[] = [
  [toInteger('0.0.0.0'), 8], // "this" network
  [toInteger('10.0.0.0'), 8], // RFC 1918
  [toInteger('100.64.0.0'), 10], // RFC 6598 carrier-grade NAT
  [toInteger('127.0.0.0'), 8], // loopback
  [toInteger('169.254.0.0'), 16], // link-local — includes 169.254.169.254
  [toInteger('172.16.0.0'), 12], // RFC 1918
  [toInteger('192.0.0.0'), 24], // RFC 6890
  [toInteger('192.0.2.0'), 24], // TEST-NET-1
  [toInteger('192.168.0.0'), 16], // RFC 1918
  [toInteger('198.18.0.0'), 15], // benchmarking
  [toInteger('198.51.100.0'), 24], // TEST-NET-2
  [toInteger('203.0.113.0'), 24], // TEST-NET-3
  [toInteger('224.0.0.0'), 4], // multicast
  [toInteger('240.0.0.0'), 4], // reserved / future use
] as const;

const BROADCAST_ADDRESS = toInteger('255.255.255.255');

/** `1.2.3.4` → 32-bit unsigned. Returns null when the text is not a valid IPv4. */
export function toInteger(ip: string): number {
  const match = IPV4_PATTERN.exec(ip);
  if (match === null) return Number.NaN;
  let value = 0;
  for (let index = 1; index <= 4; index += 1) {
    const octet = Number(match[index]);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return Number.NaN;
    value = value * 256 + octet;
  }
  return value >>> 0;
}

/** True when the text is a syntactically valid dotted-quad. */
export function isIpv4(value: string): boolean {
  return Number.isFinite(toInteger(value));
}

/** True for anything with a colon — v6, and the v4-mapped form that wraps it. */
export function isIpv6Like(value: string): boolean {
  return value.includes(':');
}

/**
 * Classify one address.
 *
 * `forbidden` covers private, loopback, link-local, shared NAT, multicast,
 * reserved, documentation/test ranges and the broadcast address — i.e. every
 * range a scan must never be pointed at.
 */
export function classifyIp(ip: string): 'public' | 'forbidden' | 'invalid' {
  const value = toInteger(ip);
  if (!Number.isFinite(value)) return 'invalid';
  if (value === BROADCAST_ADDRESS) return 'forbidden';
  for (const [network, prefix] of FORBIDDEN_RANGES) {
    if (prefix >= 32) {
      if (value === network) return 'forbidden';
      continue;
    }
    const shift = 32 - prefix;
    if (value >>> shift === network >>> shift) return 'forbidden';
  }
  return 'public';
}

/**
 * True when `[cidr]` overlaps any forbidden range.
 *
 * A range overlaps when its first or last address is inside a forbidden block,
 * or when it fully contains one. Containment is checked in both directions
 * because a /8 target swallowing 10.0.0.0/8 is just as unacceptable as the
 * reverse.
 */
export function cidrOverlapsForbidden(cidr: string): boolean {
  const parsed = parseCidr(cidr);
  if (parsed === null) return true;
  const { network, prefix } = parsed;
  const first = network;
  const last = prefix === 0 ? 0xffffffff : (network | (0xffffffff >>> prefix)) >>> 0;

  if (classifyIp(fromInteger(first)) === 'forbidden') return true;
  if (classifyIp(fromInteger(last)) === 'forbidden') return true;

  for (const [forbiddenNetwork, forbiddenPrefix] of FORBIDDEN_RANGES) {
    const shift = 32 - Math.max(prefix, forbiddenPrefix);
    if (first >>> shift === forbiddenNetwork >>> shift) return true;
  }
  return false;
}

function fromInteger(value: number): string {
  return [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ].join('.');
}

function parseCidr(cidr: string): { network: number; prefix: number } | null {
  const [address, rawPrefix] = cidr.split('/');
  if (address === undefined || rawPrefix === undefined) return null;
  if (!/^\d{1,2}$/.test(rawPrefix)) return null;
  const prefix = Number(rawPrefix);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
  const network = toInteger(address);
  if (!Number.isFinite(network)) return null;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return { network: (network & mask) >>> 0, prefix };
}

/** Addresses in a CIDR — used to enforce the 256-address ceiling. */
export function cidrSize(prefix: number): number {
  return 2 ** (32 - prefix);
}

/**
 * Validate the shape of a target.
 *
 * Accepts a hostname, an http/https URL (host part only — userinfo and path are
 * stripped, because a scan target is a host, not a resource), a bare IPv4
 * address, or an IPv4 CIDR no wider than a /24. Everything else, including all
 * IPv6, is `invalid_target`.
 *
 * `scanType` is accepted for the v1 rule below: internal/network scanning is
 * only ever meaningful against a public address here, so the type does not
 * widen what is accepted.
 */
export function validateTarget(raw: string, _scanType: ScanType): ValidateTargetResult {
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: false, reason: 'invalid_target' };

  // DECISION(v1): internal-network scans need a customer-side agent (future).
  // The scan cluster is cloud-hosted and cannot reach a customer's private
  // network, so `internal` and `network` are accepted only for public targets —
  // which is exactly what the forbidden-range check below enforces.
  void _scanType;

  // A URL FIRST: its path contains a `/`, which would otherwise be read as a
  // CIDR prefix. Take the hostname, and only from http/https.
  if (trimmed.includes('://') || trimmed.startsWith('www.')) {
    let url: URL;
    try {
      url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    } catch {
      return { ok: false, reason: 'invalid_target' };
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { ok: false, reason: 'invalid_target' };
    }
    // `URL` already strips userinfo and path; the hostname is what is left.
    return validateHostText(url.hostname);
  }

  // Then a CIDR: at most a /24 (256 addresses), and never inside a forbidden
  // range. `resolveTarget` re-checks the overlap; failing closed here means a
  // private range is refused before a slot is even reserved.
  if (trimmed.includes('/')) {
    const parsed = parseCidr(trimmed);
    if (parsed === null) return { ok: false, reason: 'invalid_target' };
    if (parsed.prefix < MIN_CIDR_PREFIX) return { ok: false, reason: 'invalid_target' };
    if (cidrSize(parsed.prefix) > 256) return { ok: false, reason: 'invalid_target' };
    if (cidrOverlapsForbidden(trimmed)) {
      return { ok: false, reason: 'target_not_allowed' };
    }
    return { ok: true, kind: 'cidr', cidr: trimmed, prefix: parsed.prefix };
  }

  return validateHostText(trimmed);
}

function validateHostText(value: string): ValidateTargetResult {
  // IPv6 (including the bracketed form a URL produces) is out of scope in v1.
  const bare = value.replace(/^\[|\]$/g, '');
  if (isIpv6Like(bare)) return { ok: false, reason: 'invalid_target' };

  if (isIpv4(bare)) {
    return classifyIp(bare) === 'public'
      ? { ok: true, kind: 'ip', ip: bare }
      : { ok: false, reason: 'target_not_allowed' };
  }

  // A trailing dot is a fully-qualified name; the spec accepts no trailing dot.
  if (value.endsWith('.')) return { ok: false, reason: 'invalid_target' };
  const lowered = value.toLowerCase();
  if (!HOSTNAME_PATTERN.test(lowered)) return { ok: false, reason: 'invalid_target' };
  return { ok: true, kind: 'host', host: lowered };
}

/** Injectable resolver, so tests never touch the network. */
export type Resolver = (host: string) => Promise<string[]>;

export interface ResolveTargetOptions {
  resolver?: Resolver;
  now?: () => number;
}

const defaultResolver: Resolver = (host) => resolve4(host);

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`dns_timeout_${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/**
 * Resolve and clear a target for scanning.
 *
 * For a hostname: resolve with `resolve4` under a 3 s timeout, reject if ANY
 * address is not public, and return at most `MAX_RESOLVED_IPS` pinned addresses.
 * For a bare address or CIDR: no DNS at all — the value is already pinned, and a
 * CIDR is checked for overlap with every forbidden range.
 */
export async function resolveTarget(
  validated: ValidateTargetResult,
  options: ResolveTargetOptions = {},
): Promise<ResolveTargetResult> {
  if (!validated.ok) return { ok: false, reason: validated.reason };
  const resolve = options.resolver ?? defaultResolver;

  if (validated.kind === 'ip') {
    return classifyIp(validated.ip) === 'public'
      ? { ok: true, host: validated.ip, ips: [validated.ip] }
      : { ok: false, reason: 'target_not_allowed' };
  }

  if (validated.kind === 'cidr') {
    return cidrOverlapsForbidden(validated.cidr)
      ? { ok: false, reason: 'target_not_allowed' }
      : { ok: true, host: validated.cidr, ips: [], cidr: validated.cidr };
  }

  let addresses: string[];
  try {
    addresses = await withTimeout(resolve(validated.host), RESOLVE_TIMEOUT_MS);
  } catch {
    // Fail closed: an unresolvable or slow name is not scannable.
    return { ok: false, reason: 'target_not_allowed' };
  }
  if (addresses.length === 0) return { ok: false, reason: 'target_not_allowed' };
  // ONE forbidden record rejects the whole target.
  if (addresses.some((address) => classifyIp(address) !== 'public')) {
    return { ok: false, reason: 'target_not_allowed' };
  }
  return {
    ok: true,
    host: validated.host,
    ips: addresses.slice(0, MAX_RESOLVED_IPS),
  };
}

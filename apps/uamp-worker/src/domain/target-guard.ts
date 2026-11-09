import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * SSRF protection for UAMP outbound checks.
 *
 * DNS names are resolved before connecting. Every returned address must be
 * globally routable, and the checker pins the socket lookup to the validated
 * address so a second DNS answer cannot rebind the connection.
 */

const FORBIDDEN_HOST_SUFFIXES = ['.local', '.internal', '.localhost'];
const FORBIDDEN_HOSTS = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
  'instance-data',
  'instance-data.ec2.internal',
]);

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    value = (value << 8) + n;
  }
  return value >>> 0;
}

function inIpv4Range(value: number, network: string, prefix: number): boolean {
  const base = ipv4ToInt(network);
  if (base === null) return true;
  const mask = (~0 << (32 - prefix)) >>> 0;
  return (value & mask) === (base & mask);
}

function isForbiddenIpv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  if (value === null) return true;
  const blocked: Array<[string, number]> = [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.0.2.0', 24],
    ['192.88.99.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['198.51.100.0', 24],
    ['203.0.113.0', 24],
    ['224.0.0.0', 4],
    ['240.0.0.0', 4],
  ];
  return blocked.some(([network, prefix]) => inIpv4Range(value, network, prefix));
}

function ipv6Words(address: string): number[] | null {
  let value = address.toLowerCase().split('%')[0] ?? '';
  const embeddedIpv4 = /(.*:)(\\d+\\.\\d+\\.\\d+\\.\\d+)$/.exec(value);
  if (embeddedIpv4) {
    const ipv4 = ipv4ToInt(embeddedIpv4[2]!);
    if (ipv4 === null) return null;
    const high = ((ipv4 >>> 16) & 0xffff).toString(16);
    const low = (ipv4 & 0xffff).toString(16);
    value = `${embeddedIpv4[1]}${high}:${low}`;
  }

  const halves = value.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const groups = [...left, ...Array(Math.max(0, missing)).fill('0'), ...right];
  if (groups.length !== 8 || groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))) return null;
  return groups.map((group) => Number.parseInt(group, 16));
}

function isForbiddenIpv6(ip: string): boolean {
  const words = ipv6Words(ip);
  if (words === null) return true;

  // IPv4-mapped IPv6 addresses inherit the IPv4 address's restrictions.
  if (words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff) {
    const mapped = `${words[6]! >>> 8}.${words[6]! & 255}.${words[7]! >>> 8}.${words[7]! & 255}`;
    return isForbiddenIpv4(mapped);
  }

  const first = words[0]!;
  // Permit only global-unicast 2000::/3. This excludes unspecified, loopback,
  // ULA, link-local, multicast, IPv4-compatible, NAT64 and other special ranges.
  if ((first & 0xe000) !== 0x2000) return true;
  // Documentation and transition ranges are not valid public monitoring targets.
  if (first === 0x2001 && (words[1] === 0x0db8 || words[1] === 0x0000)) return true;
  if (first === 0x2002) return true; // 6to4 can embed a private IPv4 destination.
  return false;
}

export function isForbiddenIp(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isForbiddenIpv4(address);
  if (family === 6) return isForbiddenIpv6(address);
  return true;
}

export type GuardResult =
  | { ok: true; url: URL }
  | { ok: false; reason: string };

export type ResolvedGuardResult =
  | { ok: true; url: URL; address: string; family: 4 | 6 }
  | { ok: false; reason: string };

export function guardTarget(target: string): GuardResult {
  let url: URL;
  try {
    url = target.includes('://') ? new URL(target) : new URL(`https://${target}`);
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'protocol_not_allowed' };
  }
  if (url.username !== '' || url.password !== '') {
    return { ok: false, reason: 'credentials_not_allowed' };
  }

  const host = url.hostname.toLowerCase().replace(/^\\[|\\]$/g, '').replace(/\\.$/, '');
  if (
    FORBIDDEN_HOSTS.has(host) ||
    FORBIDDEN_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
  ) {
    return { ok: false, reason: 'private_host' };
  }
  if (isIP(host) !== 0 && isForbiddenIp(host)) {
    return { ok: false, reason: 'private_ip' };
  }
  return { ok: true, url };
}

export type TargetAddress = { address: string; family: 4 | 6 };
export type TargetResolver = (host: string) => Promise<TargetAddress[]>;

/** Resolve and validate every DNS answer before a network connection is opened. */
export async function resolveGuardedTarget(
  target: string,
  resolver: TargetResolver = async (host) =>
    (await lookup(host, { all: true, verbatim: true })) as TargetAddress[],
): Promise<ResolvedGuardResult> {
  const guarded = guardTarget(target);
  if (!guarded.ok) return guarded;

  const host = guarded.url.hostname.toLowerCase().replace(/^\\[|\\]$/g, '');
  const literalFamily = isIP(host);
  if (literalFamily === 4 || literalFamily === 6) {
    return { ok: true, url: guarded.url, address: host, family: literalFamily };
  }

  try {
    const addresses = await resolver(host);
    if (addresses.length === 0) return { ok: false, reason: 'dns_no_addresses' };
    if (addresses.some((entry) => isForbiddenIp(entry.address))) {
      return { ok: false, reason: 'dns_private_address' };
    }
    const selected = addresses[0]!;
    return {
      ok: true,
      url: guarded.url,
      address: selected.address,
      family: selected.family as 4 | 6,
    };
  } catch {
    return { ok: false, reason: 'dns_resolution_failed' };
  }
}

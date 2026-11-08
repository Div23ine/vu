/**
 * SSRF protection for UAMP outbound checks.
 * Blocks private, loopback, link-local, and metadata endpoints.
 */

const FORBIDDEN_HOST_SUFFIXES = ['.local', '.internal', '.localhost'];
const FORBIDDEN_HOSTS = new Set(['localhost', 'metadata.google.internal']);

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    value = (value << 8) + n;
  }
  return value >>> 0;
}

function isForbiddenIpv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  if (value === null) return true;
  const ranges: Array<[number, number]> = [
    [ipv4ToInt('0.0.0.0')!, 8],
    [ipv4ToInt('10.0.0.0')!, 8],
    [ipv4ToInt('100.64.0.0')!, 10],
    [ipv4ToInt('127.0.0.0')!, 8],
    [ipv4ToInt('169.254.0.0')!, 16],
    [ipv4ToInt('172.16.0.0')!, 12],
    [ipv4ToInt('192.0.0.0')!, 24],
    [ipv4ToInt('192.168.0.0')!, 16],
    [ipv4ToInt('198.18.0.0')!, 15],
    [ipv4ToInt('224.0.0.0')!, 4],
    [ipv4ToInt('240.0.0.0')!, 4],
  ];
  for (const [network, prefix] of ranges) {
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    if ((value & mask) === (network & mask)) return true;
  }
  return false;
}

export type GuardResult =
  | { ok: true; url: URL }
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
  const host = url.hostname.toLowerCase();
  if (FORBIDDEN_HOSTS.has(host) || FORBIDDEN_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
    return { ok: false, reason: 'private_host' };
  }
  if (host.includes(':')) {
    // IPv6 — reject for now (no private-range classifier yet).
    return { ok: false, reason: 'ipv6_not_supported' };
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) && isForbiddenIpv4(host)) {
    return { ok: false, reason: 'private_ip' };
  }
  return { ok: true, url };
}

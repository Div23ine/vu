import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export interface ResolvedAddress {
  address: string;
  family: number;
}

type LookupAll = (
  hostname: string,
  options: { all: true; family: 4; verbatim: true },
) => Promise<ResolvedAddress[]>;

// Conservative IPv4 policy: only globally routable unicast addresses are allowed.
// Special-purpose, private, local, documentation, benchmarking and multicast
// ranges are deliberately excluded.
const BLOCKED_IPV4_CIDRS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 8, 0, 0], [10, 8, 0, 0], [100, 10, 64, 0], [127, 8, 0, 0],
  [169, 16, 0, 0], [172, 12, 16, 0], [192, 24, 0, 0], [192, 24, 2, 0],
  [192, 88, 99, 0], [192, 168, 0, 0], [198, 15, 18, 0], [198, 15, 51, 100],
  [203, 24, 113, 0], [224, 4, 0, 0], [240, 4, 0, 0],
];

function ipv4Octets(address: string): number[] | null {
  if (isIP(address) !== 4) return null;
  return address.split('.').map(Number);
}

function inRange(octets: number[], network: number, prefix: number, third: number, fourth: number): boolean {
  const value = (((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0);
  const base = (((network << 24) | (prefix << 16) | (third << 8) | fourth) >>> 0);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (value & mask) === (base & mask);
}

export function isPublicIPv4(address: string): boolean {
  const octets = ipv4Octets(address);
  if (octets === null) return false;
  return !BLOCKED_IPV4_CIDRS.some(([first, bits, third, fourth]) =>
    inRange(octets, first, bits, third, fourth),
  );
}

export async function resolvePublicIPv4(
  domain: string,
  lookup: LookupAll = dnsLookup,
): Promise<string> {
  const records = await lookup(domain, { all: true, family: 4, verbatim: true });
  if (records.length === 0) throw new Error('target_has_no_ipv4_address');
  // Reject the whole hostname if ANY answer is unsafe; do not pick a public
  // answer while leaving a private answer available to a later resolver.
  if (records.some((record) => record.family !== 4 || !isPublicIPv4(record.address))) {
    throw new Error('target_resolves_to_non_public_address');
  }
  return records[0].address;
}

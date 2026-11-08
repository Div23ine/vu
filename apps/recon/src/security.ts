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

// Conservative deny-list of special-purpose IPv4 ranges. The scanner only
// accepts globally routable IPv4 unicast addresses; IPv6-only targets are
// intentionally unsupported until equivalent pinning is implemented.
const BLOCKED_IPV4_CIDRS = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.0.2.0/24',
  '192.88.99.0/24',
  '192.168.0.0/16',
  '198.18.0.0/15',
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/4',
  '240.0.0.0/4',
] as const;

function ipv4Number(address: string): number | null {
  if (isIP(address) !== 4) return null;
  return address.split('.').reduce((value, octet) => (value * 256 + Number(octet)) >>> 0, 0);
}

function cidrContains(address: number, cidr: string): boolean {
  const [network, prefixText] = cidr.split('/');
  const base = ipv4Number(network);
  const prefix = Number(prefixText);
  if (base === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (address & mask) === (base & mask);
}

export function isPublicIPv4(address: string): boolean {
  const value = ipv4Number(address);
  return value !== null && !BLOCKED_IPV4_CIDRS.some((cidr) => cidrContains(value, cidr));
}

export async function resolvePublicIPv4(
  domain: string,
  lookup: LookupAll = dnsLookup,
): Promise<string> {
  const records = await lookup(domain, { all: true, family: 4, verbatim: true });
  if (records.length === 0) throw new Error('target_has_no_ipv4_address');
  // Reject the whole hostname if ANY answer is unsafe; do not select a public
  // answer while another DNS answer can direct a later connection internally.
  if (records.some((record) => record.family !== 4 || !isPublicIPv4(record.address))) {
    throw new Error('target_resolves_to_non_public_address');
  }
  return records[0].address;
}

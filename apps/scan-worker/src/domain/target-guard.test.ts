import { describe, expect, it } from 'vitest';
import {
  MAX_RESOLVED_IPS,
  cidrOverlapsForbidden,
  classifyIp,
  resolveTarget,
  validateTarget,
} from './target-guard';

/**
 * Target-guard tests (Task 84). This is a security control, so it is tested
 * hard: every forbidden range, the cloud metadata address, a hostname that
 * resolves to one private address among public ones, an over-wide CIDR, userinfo
 * stripping, and the pinned-IP cap.
 */

const FORBIDDEN_SAMPLES = [
  '0.0.0.0',
  '0.255.255.255',
  '10.0.0.1',
  '10.255.255.255',
  '100.64.0.1',
  '100.127.255.255',
  '127.0.0.1',
  '127.255.255.254',
  '169.254.169.254', // the cloud metadata address
  '169.254.0.1',
  '172.16.0.1',
  '172.31.255.255',
  '192.0.0.1',
  '192.0.2.1',
  '192.168.0.1',
  '192.168.255.255',
  '198.18.0.1',
  '198.19.255.255',
  '198.51.100.1',
  '203.0.113.1',
  '224.0.0.1',
  '239.255.255.255',
  '240.0.0.1',
  '255.255.255.255', // broadcast
] as const;

const PUBLIC_SAMPLES = [
  '8.8.8.8',
  '1.1.1.1',
  '93.184.216.34',
  '172.15.0.1',
  '172.32.0.1',
  '198.17.0.1',
] as const;

describe('classifyIp', () => {
  it('marks every forbidden range forbidden', () => {
    for (const ip of FORBIDDEN_SAMPLES) {
      expect(classifyIp(ip), ip).toBe('forbidden');
    }
  });

  it('leaves genuine public space public', () => {
    for (const ip of PUBLIC_SAMPLES) {
      expect(classifyIp(ip), ip).toBe('public');
    }
  });

  it('rejects malformed input rather than guessing', () => {
    expect(classifyIp('not-an-ip')).toBe('invalid');
    expect(classifyIp('256.1.1.1')).toBe('invalid');
    expect(classifyIp('10.0.0')).toBe('invalid');
    expect(classifyIp('::1')).toBe('invalid');
  });
});

describe('validateTarget', () => {
  it('accepts a lower-cased hostname', () => {
    expect(validateTarget('api.horizonsacco.co.ke', 'external')).toEqual({
      ok: true,
      kind: 'host',
      host: 'api.horizonsacco.co.ke',
    });
  });

  it('lower-cases a mixed-case hostname', () => {
    expect(validateTarget('API.Example.COM', 'external')).toEqual({
      ok: true,
      kind: 'host',
      host: 'api.example.com',
    });
  });

  it('rejects a trailing dot', () => {
    expect(validateTarget('api.example.com.', 'external')).toEqual({
      ok: false,
      reason: 'invalid_target',
    });
  });

  it('accepts a bare public IPv4', () => {
    expect(validateTarget('93.184.216.34', 'network')).toEqual({
      ok: true,
      kind: 'ip',
      ip: '93.184.216.34',
    });
  });

  it('refuses a bare private IPv4 as not allowed', () => {
    expect(validateTarget('10.24.8.9', 'internal')).toEqual({
      ok: false,
      reason: 'target_not_allowed',
    });
  });

  it('accepts an https URL and strips scheme, userinfo and path', () => {
    expect(validateTarget('https://user:pass@api.example.com/admin?x=1', 'external')).toEqual({
      ok: true,
      kind: 'host',
      host: 'api.example.com',
    });
  });

  it('rejects a non-http(s) scheme', () => {
    expect(validateTarget('ftp://api.example.com', 'external')).toEqual({
      ok: false,
      reason: 'invalid_target',
    });
    expect(validateTarget('file:///etc/passwd', 'external')).toEqual({
      ok: false,
      reason: 'invalid_target',
    });
  });

  it('accepts a /24 CIDR and refuses a /16 as too wide', () => {
    const small = validateTarget('203.0.114.0/24', 'network');
    expect(small.ok).toBe(true);
    expect(validateTarget('8.0.0.0/16', 'network')).toEqual({
      ok: false,
      reason: 'invalid_target',
    });
  });

  it('refuses a CIDR inside a forbidden range', () => {
    expect(validateTarget('10.24.8.0/24', 'network')).toEqual({
      ok: false,
      reason: 'target_not_allowed',
    });
  });

  it('rejects IPv6 outright in v1', () => {
    expect(validateTarget('2001:db8::1', 'network')).toEqual({
      ok: false,
      reason: 'invalid_target',
    });
    expect(validateTarget('https://[2001:db8::1]/path', 'external')).toEqual({
      ok: false,
      reason: 'invalid_target',
    });
  });

  it('rejects nonsense', () => {
    // NOTE: `-bad.example.com` is deliberately absent — the spec's hostname
    // regex `^(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$` admits a leading hyphen, and
    // this module implements the spec's pattern exactly rather than a stricter
    // one of its own. An unresolvable label is caught by `resolveTarget`.
    for (const raw of ['', '   ', 'not a host', 'example..com', 'a'.repeat(70), 'exam ple.com']) {
      expect(validateTarget(raw, 'external'), raw).toEqual({
        ok: false,
        reason: 'invalid_target',
      });
    }
  });
});

describe('cidrOverlapsForbidden', () => {
  it('flags a range that touches private space', () => {
    expect(cidrOverlapsForbidden('10.24.8.0/24')).toBe(true);
    expect(cidrOverlapsForbidden('192.168.1.0/24')).toBe(true);
    expect(cidrOverlapsForbidden('169.254.169.0/24')).toBe(true);
  });

  it('allows a genuinely public range', () => {
    expect(cidrOverlapsForbidden('93.184.216.0/24')).toBe(false);
    expect(cidrOverlapsForbidden('8.8.8.0/24')).toBe(false);
  });

  it('flags a range that CONTAINS a forbidden block', () => {
    // A /8 that swallows 10.0.0.0/8 is just as unacceptable as the reverse.
    expect(cidrOverlapsForbidden('10.0.0.0/8')).toBe(true);
  });
});

describe('resolveTarget', () => {
  it('pins the resolved IPs for a public hostname', async () => {
    const result = await resolveTarget(validateTarget('api.example.com', 'external'), {
      resolver: async () => ['93.184.216.34', '93.184.216.35'],
    });
    expect(result).toEqual({
      ok: true,
      host: 'api.example.com',
      ips: ['93.184.216.34', '93.184.216.35'],
    });
  });

  it('rejects a host with ONE private A record among public ones', async () => {
    const result = await resolveTarget(validateTarget('rebinding.example.test', 'external'), {
      resolver: async () => ['93.184.216.34', '127.0.0.1', '8.8.8.8'],
    });
    expect(result).toEqual({ ok: false, reason: 'target_not_allowed' });
  });

  it('rejects a localhost-style name that resolves to loopback', async () => {
    const result = await resolveTarget(validateTarget('localhost.example.test', 'external'), {
      resolver: async () => ['127.0.0.1'],
    });
    expect(result).toEqual({ ok: false, reason: 'target_not_allowed' });
  });

  it('caps the pinned list at 16 addresses', async () => {
    const many = Array.from(
      { length: 40 },
      (_unused, index) => `93.184.${Math.floor(index / 250)}.${(index % 250) + 1}`,
    );
    const result = await resolveTarget(validateTarget('many.example.com', 'external'), {
      resolver: async () => many,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ips).toHaveLength(MAX_RESOLVED_IPS);
  });

  it('fails closed when resolution throws or returns nothing', async () => {
    const throwing = await resolveTarget(validateTarget('down.example.test', 'external'), {
      resolver: async () => {
        throw new Error('ENOTFOUND');
      },
    });
    expect(throwing).toEqual({ ok: false, reason: 'target_not_allowed' });

    const empty = await resolveTarget(validateTarget('empty.example.test', 'external'), {
      resolver: async () => [],
    });
    expect(empty).toEqual({ ok: false, reason: 'target_not_allowed' });
  });

  it('returns the CIDR unchanged for a range target, with no DNS', async () => {
    let called = false;
    const result = await resolveTarget(validateTarget('93.184.216.0/24', 'network'), {
      resolver: async () => {
        called = true;
        return [];
      },
    });
    expect(called).toBe(false);
    expect(result).toEqual({
      ok: true,
      host: '93.184.216.0/24',
      ips: [],
      cidr: '93.184.216.0/24',
    });
  });

  it('passes an invalid validation straight through', async () => {
    const result = await resolveTarget(validateTarget('nope', 'external'));
    expect(result).toEqual({ ok: false, reason: 'invalid_target' });
  });
});

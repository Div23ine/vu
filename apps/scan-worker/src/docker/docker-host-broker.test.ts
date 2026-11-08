import { describe, expect, it } from 'vitest';
import { expandPublicCidr, isPublicIpv4 } from './docker-host-broker';

describe('Docker host broker target validation', () => {
  it('accepts globally routable IPv4 examples', () => {
    expect(isPublicIpv4('8.8.8.8')).toBe(true);
    expect(isPublicIpv4('1.1.1.1')).toBe(true);
  });

  it('rejects private, shared, loopback, link-local and documentation ranges', () => {
    for (const ip of [
      '10.0.0.1',
      '172.16.0.1',
      '192.168.1.1',
      '100.64.0.1',
      '127.0.0.1',
      '169.254.169.254',
      '192.0.2.1',
      '198.51.100.1',
      '203.0.113.1',
      '224.0.0.1',
      '255.255.255.255',
      'not-an-ip',
    ]) {
      expect(isPublicIpv4(ip), ip).toBe(false);
    }
  });

  it('expands only canonical, wholly public /24 through /32 targets', () => {
    expect(expandPublicCidr('8.8.8.0/30')).toEqual([
      '8.8.8.0', '8.8.8.1', '8.8.8.2', '8.8.8.3',
    ]);
    expect(expandPublicCidr('1.1.1.1/32')).toEqual(['1.1.1.1']);
    expect(() => expandPublicCidr('10.0.0.0/24')).toThrow();
    expect(() => expandPublicCidr('8.8.8.1/30')).toThrow();
    expect(() => expandPublicCidr('8.8.8.0/23')).toThrow();
  });
});

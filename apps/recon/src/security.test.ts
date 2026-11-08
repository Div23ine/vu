import { describe, expect, it } from 'vitest';
import { isPublicIPv4, resolvePublicIPv4 } from './security.js';

describe('recon target address policy', () => {
  it.each([
    '0.0.0.0', '10.0.0.1', '100.64.0.1', '127.0.0.1',
    '169.254.169.254', '172.16.0.1', '192.0.2.1', '192.168.1.1',
    '198.18.0.1', '198.51.100.1', '203.0.113.1', '224.0.0.1',
    '240.0.0.1', '255.255.255.255', '::1', '2001:db8::1',
  ])('rejects non-public address %s', (address) => {
    expect(isPublicIPv4(address)).toBe(false);
  });

  it.each(['1.1.1.1', '8.8.8.8', '93.184.216.34'])(
    'allows public IPv4 address %s',
    (address) => expect(isPublicIPv4(address)).toBe(true),
  );

  it('pins resolution to the first validated public IPv4 answer', async () => {
    const address = await resolvePublicIPv4('example.com', async () => [
      { address: '93.184.216.34', family: 4 },
    ]);
    expect(address).toBe('93.184.216.34');
  });

  it('rejects a hostname if any DNS answer is non-public', async () => {
    await expect(
      resolvePublicIPv4('example.com', async () => [
        { address: '93.184.216.34', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ]),
    ).rejects.toThrow('target_resolves_to_non_public_address');
  });

  it('rejects hostnames without IPv4 answers', async () => {
    await expect(resolvePublicIPv4('example.com', async () => [])).rejects.toThrow(
      'target_has_no_ipv4_address',
    );
  });
});

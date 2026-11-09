import { describe, expect, it } from 'vitest';
import { guardTarget, isForbiddenIp, resolveGuardedTarget } from './target-guard.js';

describe('guardTarget', () => {
  it('allows public https URLs', () => {
    const r = guardTarget('https://example.com/health');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.url.hostname).toBe('example.com');
  });

  it('rejects localhost', () => {
    expect(guardTarget('http://localhost/admin').ok).toBe(false);
    expect(guardTarget('http://127.0.0.1/').ok).toBe(false);
  });

  it('rejects private RFC1918 ranges', () => {
    expect(guardTarget('http://10.0.0.5/').ok).toBe(false);
    expect(guardTarget('http://192.168.1.1/').ok).toBe(false);
    expect(guardTarget('http://172.16.0.1/').ok).toBe(false);
  });

  it('rejects link-local / metadata', () => {
    expect(guardTarget('http://169.254.169.254/latest/meta-data').ok).toBe(false);
  });

  it('rejects non-http schemes', () => {
    expect(guardTarget('ftp://example.com/file').ok).toBe(false);
  });

  it('rejects private, link-local and mapped IPv6 destinations', () => {
    expect(isForbiddenIp('::1')).toBe(true);
    expect(isForbiddenIp('fd00::1')).toBe(true);
    expect(isForbiddenIp('fe80::1')).toBe(true);
    expect(isForbiddenIp('::ffff:127.0.0.1')).toBe(true);
  });

  it('allows globally routable IPv6 destinations', () => {
    expect(isForbiddenIp('2001:4860:4860::8888')).toBe(false);
  });

  it('rejects DNS answers containing any private address', async () => {
    const result = await resolveGuardedTarget('https://monitor.example', async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.8', family: 4 },
    ]);

    expect(result).toEqual({ ok: false, reason: 'dns_private_address' });
  });

  it('returns a validated address for connection pinning', async () => {
    const result = await resolveGuardedTarget('https://monitor.example', async () => [
      { address: '93.184.216.34', family: 4 },
    ]);

    expect(result).toMatchObject({
      ok: true,
      address: '93.184.216.34',
      family: 4,
    });
  });

  it('rejects URL user information', () => {
    expect(guardTarget('https://user:pass@example.com').ok).toBe(false);
  });
});

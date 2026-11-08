import { describe, expect, it } from 'vitest';
import { guardTarget } from './target-guard.js';

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
});

import { describe, expect, it } from 'vitest';
import { buildCsp } from './csp';

const baseOptions = {
  nonce: 'TE5TN0NONCE',
  apiOrigin: 'https://api.vunvault.test',
  r2Origin: 'assets.vunvault.test',
  dev: false,
};

describe('buildCsp', () => {
  it('emits every directive, with the nonce interpolated', () => {
    const csp = buildCsp(baseOptions);

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'nonce-TE5TN0NONCE' 'strict-dynamic'");
    expect(csp).toContain('https://js.stripe.com');
    expect(csp).toContain('https://js.paystack.co');
    expect(csp).toContain('https://challenges.cloudflare.com');
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("img-src 'self' data: blob: https://assets.vunvault.test");
    expect(csp).toContain("font-src 'self'");
    expect(csp).toContain(
      "connect-src 'self' https://api.vunvault.test wss://api.vunvault.test " +
        'https://api.stripe.com https://api.paystack.co https://*.ingest.sentry.io',
    );
    expect(csp).toContain(
      'frame-src https://js.stripe.com https://checkout.paystack.com https://challenges.cloudflare.com',
    );
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain('upgrade-insecure-requests');
  });

  it("adds 'unsafe-eval' only in dev", () => {
    expect(buildCsp(baseOptions)).not.toContain("'unsafe-eval'");
    expect(buildCsp({ ...baseOptions, dev: true })).toContain("'unsafe-eval'");
  });

  it('derives the wss:// host from the API origin, port included', () => {
    const csp = buildCsp({ ...baseOptions, apiOrigin: 'https://api.example.com:8443' });
    expect(csp).toContain('wss://api.example.com:8443');
  });
});

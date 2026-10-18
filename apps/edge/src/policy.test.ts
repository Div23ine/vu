import { describe, expect, it } from 'vitest';
import {
  ALLOWED_METHODS,
  MAX_BODY_BYTES,
  MAX_WEBHOOK_BODY_BYTES,
  isAllowedMethod,
  isAllowedPath,
  isWebhookPath,
  sizeVerdict,
} from './policy.js';

describe('edge policy — the allow-list', () => {
  it('admits the four public shapes and nothing else', () => {
    for (const allowed of [
      '/api/v1/auth/login',
      '/api/v1/scans/6f1c0a/stream',
      '/healthz',
      '/readyz',
      '/openapi.json',
    ]) {
      expect(isAllowedPath(allowed), allowed).toBe(true);
    }
    for (const denied of [
      '/admin',
      '/docs',
      '/docs/index.html',
      '/api/v2/anything',
      '/api/v1x',
      '/healthz-extra',
      '/',
      '/../api/v1/auth/login',
    ]) {
      expect(isAllowedPath(denied), denied).toBe(false);
    }
  });

  it('admits exactly the seven methods', () => {
    expect([...ALLOWED_METHODS].sort()).toEqual(
      ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT'].sort(),
    );
    expect(isAllowedMethod('TRACE')).toBe(false);
    expect(isAllowedMethod('CONNECT')).toBe(false);
    expect(isAllowedMethod('get')).toBe(true);
  });

  it('caps declared sizes: 1 MB generally, 256 KB for webhooks', () => {
    expect(MAX_BODY_BYTES).toBe(1_048_576);
    expect(MAX_WEBHOOK_BODY_BYTES).toBe(262_144);
    expect(isWebhookPath('/api/v1/webhooks/stripe')).toBe(true);

    expect(sizeVerdict('/api/v1/contact', String(MAX_BODY_BYTES))).toBe('ok');
    expect(sizeVerdict('/api/v1/contact', String(MAX_BODY_BYTES + 1))).toBe('too_large');
    expect(sizeVerdict('/api/v1/webhooks/stripe', '262145')).toBe('too_large');
    expect(sizeVerdict('/api/v1/webhooks/paystack', '262144')).toBe('ok');
    // No declared length: the origin's own limits are the second gate.
    expect(sizeVerdict('/api/v1/contact', null)).toBe('unknown');
  });
});

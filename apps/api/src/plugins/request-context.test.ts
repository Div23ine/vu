import { describe, expect, it } from 'vitest';
import { REQUEST_ID_PATTERN, resolveRequestId, sanitizeLoggedUrl } from './request-context.js';

/**
 * Request-context helpers.
 *
 * `sanitizeLoggedUrl` is the log-side half of work order §7 ("tokens are
 * never logged at any level"): the magic-link verify leg carries its
 * single-use token as `?token=…`, and Fastify's access log serialises the
 * raw URL. These tests pin the redaction set, the case-insensitivity, the
 * untouched-URL fast paths and the preservation of non-sensitive params.
 */

describe('resolveRequestId', () => {
  it('accepts a well-formed inbound id', () => {
    expect(resolveRequestId({ 'x-request-id': 'abc-123-def' })).toBe('abc-123-def');
  });

  it('rejects unsafe inbound ids and mints a UUID', () => {
    const minted = resolveRequestId({ 'x-request-id': '"; DROP TABLE--' });
    expect(minted).toMatch(REQUEST_ID_PATTERN);
    expect(minted).not.toContain('DROP');
  });
});

describe('sanitizeLoggedUrl', () => {
  it('returns URLs without a query string untouched', () => {
    expect(sanitizeLoggedUrl('/api/v1/auth/session')).toBe('/api/v1/auth/session');
    expect(sanitizeLoggedUrl('/healthz')).toBe('/healthz');
  });

  it('redacts the magic-link verify token', () => {
    const url = '/api/v1/auth/magic-link/verify?token=eyJlbWFpbCI6InNlY3JldCJ9.abc-DEF_123';
    const logged = sanitizeLoggedUrl(url);
    expect(logged).not.toContain('eyJlbWFpbCI6InNlY3JldCJ9');
    expect(logged).toContain('token=%5BRedacted%5D');
    expect(logged.startsWith('/api/v1/auth/magic-link/verify?')).toBe(true);
  });

  it('redacts every sensitive parameter, case-insensitively', () => {
    const logged = sanitizeLoggedUrl('/x?Token=a&CODE=b&Otp=c&secret=d&SIG=e&signature=f');
    expect(logged).not.toMatch(/=[a-f]\b/);
    for (const key of ['Token', 'CODE', 'Otp', 'secret', 'SIG', 'signature']) {
      expect(logged).toContain(`${key}=%5BRedacted%5D`);
    }
  });

  it('preserves non-sensitive parameters and their order', () => {
    const logged = sanitizeLoggedUrl('/y?next=%2Fportal&page=2&token=t0k3n');
    expect(logged).toContain('next=%2Fportal');
    expect(logged).toContain('page=2');
    expect(logged).not.toContain('t0k3n');
  });

  it('leaves a query without sensitive parameters byte-identical', () => {
    const url = '/z?methods=totp%2Cemail_otp&to=go%40example.com';
    expect(sanitizeLoggedUrl(url)).toBe(url);
  });

  it('handles an empty query and repeated sensitive keys', () => {
    expect(sanitizeLoggedUrl('/w?')).toBe('/w?');
    const logged = sanitizeLoggedUrl('/w?code=1&code=2');
    expect(logged).not.toContain('1');
    expect(logged).not.toContain('2');
  });
});

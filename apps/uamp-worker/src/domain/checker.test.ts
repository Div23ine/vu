import { describe, expect, it, vi } from 'vitest';
import { runCheck } from './checker.js';
import type { ResolvedGuardResult } from './target-guard.js';

const publicTarget: ResolvedGuardResult = {
  ok: true,
  url: new URL('https://example.com/health'),
  address: '93.184.216.34',
  family: 4,
};

describe('runCheck', () => {
  it('treats redirects as failed checks without following the Location header', async () => {
    const request = vi.fn(async () => ({ status: 302, text: '' }));
    const result = await runCheck(
      {
        target: 'https://example.com/health',
        timeoutMs: 1_000,
        userAgent: 'UAMP-test/1.0',
      },
      {
        resolveTarget: async () => publicTarget,
        request,
      },
    );

    expect(request).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('down');
    expect(result.httpStatus).toBe(302);
  });

  it('evaluates nested JSON path equality assertions', async () => {
    const result = await runCheck(
      {
        target: 'https://example.com/health',
        timeoutMs: 1_000,
        userAgent: 'UAMP-test/1.0',
        assertions: { jsonPath: '$.data.checks[0].state', jsonEquals: 'healthy' },
      },
      {
        resolveTarget: async () => publicTarget,
        request: async () => ({
          status: 200,
          text: JSON.stringify({ data: { checks: [{ state: 'healthy' }] } }),
        }),
      },
    );

    expect(result.status).toBe('up');
    expect(result.errorMessage).toBeNull();
  });

  it('marks a JSON equality mismatch as a failed assertion', async () => {
    const result = await runCheck(
      {
        target: 'https://example.com/health',
        timeoutMs: 1_000,
        userAgent: 'UAMP-test/1.0',
        assertions: { jsonPath: '$.status', jsonEquals: 'healthy' },
      },
      {
        resolveTarget: async () => publicTarget,
        request: async () => ({ status: 200, text: JSON.stringify({ status: 'degraded' }) }),
      },
    );

    expect(result.status).toBe('down');
    expect(result.errorMessage).toBe('json_assertion_failed');
  });

  it('rejects malformed JSON when JSON assertions are configured', async () => {
    const result = await runCheck(
      {
        target: 'https://example.com/health',
        timeoutMs: 1_000,
        userAgent: 'UAMP-test/1.0',
        assertions: { jsonPath: '$.status' },
      },
      {
        resolveTarget: async () => publicTarget,
        request: async () => ({ status: 200, text: 'not-json' }),
      },
    );

    expect(result.status).toBe('down');
    expect(result.errorMessage).toBe('json_response_invalid');
  });

  it('checks DNS monitors using validated DNS resolution', async () => {
    const result = await runCheck(
      {
        target: 'example.com',
        type: 'dns',
        timeoutMs: 1_000,
        userAgent: 'UAMP-test/1.0',
      },
      { resolveTarget: async () => publicTarget },
    );

    expect(result.status).toBe('up');
    expect(result.responseSnippet).toBe('93.184.216.34');
  });

  it('does not treat private DNS answers as healthy', async () => {
    const result = await runCheck(
      {
        target: 'example.com',
        type: 'dns',
        timeoutMs: 1_000,
        userAgent: 'UAMP-test/1.0',
      },
      {
        resolveTarget: async () => ({ ok: false, reason: 'dns_private_address' }),
      },
    );

    expect(result.status).toBe('error');
    expect(result.errorMessage).toBe('dns_private_address');
  });

  it('marks SSL certificates degraded inside the configured warning window', async () => {
    const result = await runCheck(
      {
        target: 'https://example.com',
        type: 'ssl',
        warnDaysBeforeExpiry: 14,
        timeoutMs: 1_000,
        userAgent: 'UAMP-test/1.0',
      },
      {
        resolveTarget: async () => publicTarget,
        sslProbe: async () => ({
          validTo: new Date(Date.now() + 5 * 86_400_000).toUTCString(),
          authorized: true,
          hostnameValid: true,
        }),
      },
    );

    expect(result.status).toBe('degraded');
    expect(result.errorMessage).toBeNull();
  });

  it('marks an untrusted or hostname-mismatched SSL certificate down', async () => {
    const result = await runCheck(
      {
        target: 'https://example.com',
        type: 'ssl',
        timeoutMs: 1_000,
        userAgent: 'UAMP-test/1.0',
      },
      {
        resolveTarget: async () => publicTarget,
        sslProbe: async () => ({
          validTo: new Date(Date.now() + 90 * 86_400_000).toUTCString(),
          authorized: false,
          hostnameValid: true,
        }),
      },
    );

    expect(result.status).toBe('down');
    expect(result.errorMessage).toBe('certificate_validation_failed');
  });
});

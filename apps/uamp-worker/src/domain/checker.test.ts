import { afterEach, describe, expect, it, vi } from 'vitest';
import { runCheck } from './checker.js';

describe('runCheck', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not follow redirects to an untrusted destination', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'http://169.254.169.254/latest/meta-data' },
      }),
    );

    const result = await runCheck({
      target: 'https://example.com/health',
      timeoutMs: 1_000,
      userAgent: 'UAMP-test/1.0',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ redirect: 'manual' }),
    );
    expect(result.status).toBe('down');
    expect(result.httpStatus).toBe(302);
  });

  it('evaluates nested JSON path equality assertions', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { checks: [{ state: 'healthy' }] } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await runCheck({
      target: 'https://example.com/health',
      timeoutMs: 1_000,
      userAgent: 'UAMP-test/1.0',
      assertions: { jsonPath: '$.data.checks[0].state', jsonEquals: 'healthy' },
    });

    expect(result.status).toBe('up');
    expect(result.errorMessage).toBeNull();
  });

  it('marks a JSON equality mismatch as a failed assertion', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'degraded' }), { status: 200 }),
    );

    const result = await runCheck({
      target: 'https://example.com/health',
      timeoutMs: 1_000,
      userAgent: 'UAMP-test/1.0',
      assertions: { jsonPath: '$.status', jsonEquals: 'healthy' },
    });

    expect(result.status).toBe('down');
    expect(result.errorMessage).toBe('json_assertion_failed');
  });

  it('rejects malformed JSON when JSON assertions are configured', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('not-json', { status: 200 }),
    );

    const result = await runCheck({
      target: 'https://example.com/health',
      timeoutMs: 1_000,
      userAgent: 'UAMP-test/1.0',
      assertions: { jsonPath: '$.status' },
    });

    expect(result.status).toBe('down');
    expect(result.errorMessage).toBe('json_response_invalid');
  });
});

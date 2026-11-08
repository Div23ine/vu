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
});

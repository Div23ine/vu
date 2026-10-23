// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StatusPage from './page';

/** Status page probes the live API; the suite stubs the three endpoints. */

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('StatusPage', () => {
  it('reports operational components from the probes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ status: 'ok' }) })),
    );
    render(await StatusPage());
    expect(screen.getAllByText(/Operational/)).toHaveLength(3);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('reports degradation honestly when a probe fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : String(input);
        return url.includes('readyz')
          ? { ok: false, status: 503 }
          : { ok: true, json: async () => ({}) };
      }),
    );
    render(await StatusPage());
    expect(screen.getAllByText(/Degraded/)).toHaveLength(1);
    expect(screen.getAllByText(/Operational/)).toHaveLength(2);
  });
});

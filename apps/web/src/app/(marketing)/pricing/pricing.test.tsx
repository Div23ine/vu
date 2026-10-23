// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PricingPage from './page';
import { PlansClient } from './plans-client';

/**
 * Pricing page tests — the catalogue and rates come from the API (stubbed
 * fetch), the currency island renders USD-first with honest equivalents, and
 * the FAQ answers the four buyer questions.
 */

const PLANS = {
  data: [
    {
      code: 'starter_scan',
      name: 'Starter Assessment',
      description: null,
      unit: 'scan',
      usdCents: 29900,
    },
    {
      code: 'sacco_fintech_compliance',
      name: 'Compliance Assessment',
      description: null,
      unit: 'assessment',
      usdCents: 89900,
    },
    {
      code: 'enterprise_retainer',
      name: 'Enterprise Retainer',
      description: null,
      unit: 'month',
      usdCents: 299900,
    },
  ],
};
const RATES = {
  data: {
    rates: { USD: '1.00000000', KES: '129.00000000' },
    fetchedAt: '2026-10-18T00:00:00.000Z',
  },
};

function headersWith(cookie: string | null) {
  return {
    get: (name: string) => (name === 'cookie' ? cookie : null),
  };
}

vi.mock('next/headers', () => ({
  headers: async () => (globalThis as Record<string, unknown>).__vvHeaders,
}));

beforeEach(() => {
  (globalThis as Record<string, unknown>).__vvHeaders = headersWith(null);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : String(input);
      if (url.includes('/api/v1/plans')) return { ok: true, json: async () => PLANS };
      if (url.includes('/api/v1/fx-rates')) return { ok: true, json: async () => RATES };
      return { ok: false };
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PricingPage', () => {
  it('renders the three tiers, the FAQ and a single h1', async () => {
    render(await PricingPage());
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Starter Assessment' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Enterprise Retainer' })).toBeInTheDocument();
    expect(screen.getByText('Questions buyers actually ask')).toBeInTheDocument();
    expect(screen.getByText(/What happens after payment/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Book|Start the Retainer/ })).toHaveLength(3);
  });

  it('shows USD-only with an honest note when rates are unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : String(input);
        if (url.includes('/api/v1/plans')) return { ok: true, json: async () => PLANS };
        return { ok: false };
      }),
    );
    render(await PricingPage());
    expect(screen.getByText(/Live equivalents are temporarily unavailable/)).toBeInTheDocument();
  });

  it('honours the vv_currency cookie for the initial display currency', async () => {
    (globalThis as Record<string, unknown>).__vvHeaders = headersWith(
      'vv_currency=KES; vv_consent=2',
    );
    render(await PricingPage());
    // 299 USD * 129 = 38,571 KES major units, rendered by Intl
    expect(screen.getAllByText(/38,571/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/≈ \$299 USD — the amount charged/).length).toBeGreaterThan(0);
  });
});

describe('PlansClient toggle', () => {
  it('persists the chosen currency in the vv_currency cookie', () => {
    render(<PlansClient plans={PLANS.data} rates={RATES.data.rates} initialCurrency="USD" />);
    screen.getByRole('button', { name: 'GBP' }).click();
    expect(document.cookie).toContain('vv_currency=GBP');
  });
});

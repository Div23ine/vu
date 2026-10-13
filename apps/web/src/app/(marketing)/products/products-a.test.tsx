// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { products } from '@vunvault/contracts/fixtures/store';
import { createQueryClient } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import { mockClientSession, mockStaffSession } from '../../../mocks/handlers/auth';
import { server } from '../../../mocks/server';
import ProductsPage from './page';
import { PremiumProducts } from './_components/premium-products';

/**
 * Products page A tests (Task 55).
 *
 * The catalogue is served by the MSW store handler from the contract
 * fixtures, so the card assertions derive from `products` — no duplicated
 * data. Buy Now is exercised in all three session states: anonymous (login
 * link), client (purchase mutation → billing hand-off) and staff (warn
 * toast, no purchase).
 */

const routerPush = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, replace: vi.fn() }),
  usePathname: () => '/products',
}));

function renderWithProviders(element: React.ReactElement) {
  const queryClient = createQueryClient();
  return render(element, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

function useMockSession(session: typeof mockClientSession | null) {
  if (session === null) return; // the default handler already answers 401
  server.use(http.get('*/api/v1/auth/session', () => HttpResponse.json({ data: session })));
}

const EXPECTED_PRICES = ['$49', '$129', '$79', '$199', '$99', '$149'];

beforeEach(() => {
  routerPush.mockClear();
  useToastStore.setState({ toasts: [] });
});

describe('PremiumProducts catalogue', () => {
  it('renders the six fixture cards with names, badges, prices and units', async () => {
    renderWithProviders(<PremiumProducts />);
    await waitFor(() => expect(document.querySelectorAll('article.vv-prod-card')).toHaveLength(6));

    expect(products).toHaveLength(6);
    for (const product of products) {
      expect(screen.getByRole('heading', { name: product.name })).toBeInTheDocument();
      expect(
        screen.getByText(product.category, { selector: '.vv-prod-badge' }),
      ).toBeInTheDocument();
      expect(screen.getByText(product.description)).toBeInTheDocument();
      for (const feature of product.features) {
        expect(screen.getByText(feature)).toBeInTheDocument();
      }
    }
    for (const price of EXPECTED_PRICES) {
      expect(screen.getByText(price)).toBeInTheDocument();
    }
    expect(screen.getAllByText('/ license')).toHaveLength(3);
    expect(screen.getAllByText('/ year')).toHaveLength(2);
    expect(screen.getAllByText('/ pack')).toHaveLength(1);

    // Header furniture, verbatim.
    expect(screen.getByText('Premium Products')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Licensed tooling for professional engagements' }),
    ).toBeInTheDocument();
    expect(screen.getByText('6 Products')).toBeInTheDocument();
    expect(document.getElementById('paid-products')).not.toBeNull();
    expect(document.getElementById('catalog')).not.toBeNull();
  });

  it('answers purchases from the bundled mock handler (201 + invoice)', async () => {
    const first = products[0];
    if (first === undefined) throw new Error('products fixture is empty.');
    const response = await fetch(
      'https://api.vunvault.test/api/v1/products/' + first.id + '/purchase',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId: first.id }),
      },
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      data: {
        invoiceId: string;
        invoiceNumber: string;
        totalUsdCents: number;
        settlementCurrency: string;
      };
    };
    expect(body.data.invoiceNumber).toMatch(/^VV-INV-\d{4}-\d{4}$/);
    expect(body.data.totalUsdCents).toBe(first.priceUsdCents);
    expect(body.data.settlementCurrency).toBe('USD');
  });
});

describe('Buy Now', () => {
  it('links anonymous visitors to /login?next=/products', async () => {
    renderWithProviders(<PremiumProducts />);
    await waitFor(() => expect(document.querySelectorAll('article.vv-prod-card')).toHaveLength(6));
    // Session resolved to null → every Buy Now is a login link.
    await waitFor(() => expect(screen.getAllByRole('link', { name: /Buy Now/ })).toHaveLength(6));
    for (const link of screen.getAllByRole('link', { name: /Buy Now/ })) {
      expect(link).toHaveAttribute('href', '/login?next=/products');
    }
  });

  it('purchases for a client session and hands off to portal billing', async () => {
    useMockSession(mockClientSession);
    let purchasedId: string | null = null;
    server.use(
      http.post('*/api/v1/products/:id/purchase', ({ params }) => {
        purchasedId = String(params.id);
        return HttpResponse.json(
          {
            data: {
              invoiceId: 'b1000000-0000-4000-8000-000000000042',
              invoiceNumber: 'VV-INV-2026-0042',
              totalUsdCents: 4900,
              settlementCurrency: 'USD',
            },
          },
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<PremiumProducts />);
    await waitFor(() => expect(document.querySelectorAll('article.vv-prod-card')).toHaveLength(6));

    const first = products[0];
    if (first === undefined) throw new Error('products fixture is empty.');
    const card = screen.getByRole('heading', { name: first.name }).closest('article.vv-prod-card');
    if (card === null) throw new Error('Product card is missing.');
    await user.click(within(card as HTMLElement).getByRole('button', { name: /Buy Now/ }));

    await waitFor(() => expect(purchasedId).toBe(first.id));
    await waitFor(() =>
      expect(routerPush).toHaveBeenCalledWith(
        '/portal/billing?invoice=b1000000-0000-4000-8000-000000000042',
      ),
    );
  });

  it('warns staff instead of purchasing', async () => {
    useMockSession(mockStaffSession);
    const user = userEvent.setup();
    renderWithProviders(<PremiumProducts />);
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /Buy Now/ }).length).toBeGreaterThan(0),
    );

    await user.click(screen.getAllByRole('button', { name: /Buy Now/ })[0] as HTMLElement);
    await waitFor(() => expect(useToastStore.getState().toasts).toHaveLength(1));
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      kind: 'warn',
      title: 'Client accounts only',
      message: 'Sign in with a client account to purchase licences.',
    });
    expect(routerPush).not.toHaveBeenCalled();
  });
});

describe('ProductsPage assembly', () => {
  it('renders hero and catalogue with the three 55b stubs in place', async () => {
    renderWithProviders(<ProductsPage />);
    expect(screen.getByText('Tools · Automation · Documentation')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Security Tooling Built For Operators' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explore Catalog' })).toHaveAttribute(
      'href',
      '#catalog',
    );
    expect(screen.getByRole('link', { name: 'Free Tools' })).toHaveAttribute('href', '#free-tools');
    for (const [label, value] of [
      ['Tools Shipped', '24'],
      ['Free Resources', '12'],
      ['Active Operators', '3,180'],
      ['Mean Patch Time', '1.2s'],
    ] as const) {
      // 'Free Resources' also names the 55b section kicker — the hero stat
      // strip is asserted by presence, not uniqueness.
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
      expect(screen.getByText(value)).toBeInTheDocument();
    }
    await waitFor(() => expect(document.querySelectorAll('article.vv-prod-card')).toHaveLength(6));
  });
});

// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../../mocks/server';
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === 'reference' ? 'vv-abc' : key === 'plan' ? 'starter_scan' : null),
  }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/checkout',
}));

import CheckoutPage from './page';
import CheckoutCallbackPage from './callback/page';

/**
 * Guest checkout tests — creating an order hands the browser to Paystack's
 * hosted URL (card data never touches us), and the callback page trusts only
 * the server's verification answer.
 */

beforeEach(() => {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...window.location, assign: vi.fn(), replace: vi.fn() },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CheckoutPage', () => {
  it('creates the order and redirects to the Paystack hosted checkout', async () => {
    server.use(
      http.post('*/api/v1/orders', async () =>
        HttpResponse.json({
          data: {
            reference: 'vv-abc',
            planCode: 'starter_scan',
            status: 'pending',
            usdCents: 29900,
            display: null,
            paidAt: null,
            createdAt: '2026-10-18T00:00:00.000Z',
            authorizationUrl: 'https://checkout.paystack.com/vv-abc',
          },
        }),
      ),
    );
    render(<CheckoutPage />);
    await userEvent.type(screen.getByLabelText('Email address'), 'buyer@example.test');
    await userEvent.click(screen.getByRole('button', { name: /Pay securely with Paystack/ }));
    await waitFor(() =>
      expect(window.location.assign).toHaveBeenCalledWith('https://checkout.paystack.com/vv-abc'),
    );
  });

  it('surfaces a visible error when order creation fails', async () => {
    server.use(
      http.post('*/api/v1/orders', () =>
        HttpResponse.json({ error: 'plan_not_found' }, { status: 404 }),
      ),
    );
    render(<CheckoutPage />);
    await userEvent.type(screen.getByLabelText('Email address'), 'buyer@example.test');
    await userEvent.click(screen.getByRole('button', { name: /Pay securely with Paystack/ }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(window.location.assign).not.toHaveBeenCalled();
  });
});

describe('CheckoutCallbackPage', () => {
  it('routes to the success page only after the server verifies payment', async () => {
    server.use(
      http.post('*/api/v1/orders/verify', () =>
        HttpResponse.json({
          data: {
            reference: 'vv-abc',
            planCode: 'starter_scan',
            status: 'paid',
            usdCents: 29900,
            display: null,
            paidAt: '2026-10-18T00:00:00.000Z',
            createdAt: '2026-10-18T00:00:00.000Z',
          },
        }),
      ),
    );
    render(<CheckoutCallbackPage />);
    await waitFor(() =>
      expect(window.location.replace).toHaveBeenCalledWith('/checkout/success/vv-abc'),
    );
  });
});

// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DisplayCurrency } from '@vunvault/contracts';
import { invoices } from '@vunvault/contracts/fixtures/billing';
import { createQueryClient, formatLocalDisplay, formatUsd } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import { server } from '../../../../mocks/server';
import { usePayDialogStore } from '../../../../lib/pay-dialog-store';
import { PayInvoiceDialog } from './_components/pay-invoice-dialog';

/**
 * Pay-invoice dialog tests — the spec's list: switching to KES
 * requests a quote and shows the locked amount + the USD charge sentence; the
 * countdown hitting zero disables Pay and shows `Quote expired`; the Card
 * path checks out with `stripe`/`card`; M-Pesa requires a valid phone and
 * sends `paystack`/`mpesa`; the idempotency key is identical across two
 * submit attempts in one session; success polling flips to `Payment
 * received`; `409 quote_expired` refreshes the quote; and the checkout body
 * carries NO amount field.
 *
 * Stripe is mocked (Elements + createPaymentMethod + confirmCardPayment); the
 * publishable key is stubbed present. Real timers with generous `waitFor`
 * budgets cover the 1 s countdown and the 3 s poll (the Radix + fake-timer
 * combination is avoided deliberately — the portal-chrome precedent).
 */

const createPaymentMethod = vi.hoisted(() => vi.fn());
const confirmCardPayment = vi.hoisted(() => vi.fn());
const stripeConfigured = vi.hoisted(() => ({ current: true }));

vi.mock('@stripe/react-stripe-js', async () => {
  const react = await import('react');
  const makeElement = (name: string) => {
    const Element = ({ onChange }: { onChange?: (event: { complete: boolean }) => void }) => {
      react.useEffect(() => {
        onChange?.({ complete: true });
      }, []);
      return react.createElement('div', { 'data-testid': `${name}-element` });
    };
    return Element;
  };
  return {
    Elements: ({ children }: { children?: React.ReactNode }) =>
      react.createElement(react.Fragment, null, children),
    CardNumberElement: makeElement('card-number'),
    CardExpiryElement: makeElement('card-expiry'),
    CardCvcElement: makeElement('card-cvc'),
    useStripe: () => ({ createPaymentMethod, confirmCardPayment }),
    useElements: () => ({ getElement: () => ({ fake: 'card-element' }) }),
  };
});

vi.mock('../../../../lib/stripe', () => ({
  stripeKeyConfigured: () => stripeConfigured.current,
  getStripe: async () => ({}),
}));

import type { Invoice } from '@vunvault/contracts';
const septemberRow = invoices[0];
if (septemberRow === undefined) throw new Error('The invoices fixture is empty.');
const SEPTEMBER: Invoice = septemberRow;

const RATES: Record<Exclude<DisplayCurrency, 'USD'>, string> = {
  KES: '129.50',
  NGN: '1650.00',
  GHS: '15.80',
  ZAR: '18.20',
  GBP: '0.79',
  EUR: '0.92',
};

function quotePayload(currency: Exclude<DisplayCurrency, 'USD'>, expiresInMs = 15 * 60_000) {
  const lockedAt = new Date();
  return {
    id: 'f0000000-0000-4000-8000-0000000000f1',
    invoiceId: SEPTEMBER.id,
    displayCurrency: currency,
    rateLocalPerUsd: RATES[currency],
    usdCents: SEPTEMBER.outstandingUsdCents,
    localMinor: Math.round(SEPTEMBER.outstandingUsdCents * Number(RATES[currency])),
    lockedAt: lockedAt.toISOString(),
    expiresAt: new Date(lockedAt.getTime() + expiresInMs).toISOString(),
    settlementCurrency: 'USD',
  };
}

let queryClient: QueryClient;
let checkoutCalls: Array<Record<string, unknown>>;
let fxRequests: Array<Record<string, unknown>>;

function renderDialog() {
  queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <PayInvoiceDialog />
    </QueryClientProvider>,
  );
}

async function openDialog() {
  act(() => {
    usePayDialogStore.getState().open(SEPTEMBER);
  });
  return await screen.findByRole('dialog');
}

/** Capture checkout bodies; default answer configurable per test. */
function mockCheckout(
  responder: (body: Record<string, unknown>) => ReturnType<typeof HttpResponse.json>,
) {
  server.use(
    http.post('*/api/v1/billing/checkout', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      checkoutCalls.push(body);
      return responder(body);
    }),
  );
}

function succeededResponse() {
  return HttpResponse.json(
    {
      data: {
        paymentAttemptId: 'a0000000-0000-4000-8000-0000000000a1',
        status: 'succeeded',
        usdCents: SEPTEMBER.outstandingUsdCents,
        settlementCurrency: 'USD',
      },
    },
    { status: 201 },
  );
}

/** Flip the invoice list to `paid` after `pendingCalls` polls. */
function mockInvoicesPaidAfter(pendingCalls: number) {
  let calls = 0;
  server.use(
    http.get('*/api/v1/billing/invoices', () => {
      calls += 1;
      const septemberPaid = calls > pendingCalls;
      return HttpResponse.json({
        data: invoices.map((invoice) =>
          invoice.id === SEPTEMBER.id && septemberPaid
            ? {
                ...invoice,
                status: 'paid' as const,
                outstandingUsdCents: 0,
                paidUsdCents: invoice.totalUsdCents,
              }
            : invoice,
        ),
        total: invoices.length,
      });
    }),
  );
}

beforeEach(() => {
  checkoutCalls = [];
  fxRequests = [];
  createPaymentMethod.mockReset();
  createPaymentMethod.mockResolvedValue({ paymentMethod: { id: 'pm_1PAY' } });
  confirmCardPayment.mockReset();
  stripeConfigured.current = true;
  useToastStore.setState({ toasts: [] });
  usePayDialogStore.setState({ invoice: null });
  server.use(
    http.post('*/api/v1/billing/fx-quotes', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      fxRequests.push(body);
      const currency = body.displayCurrency as Exclude<DisplayCurrency, 'USD'>;
      return HttpResponse.json({ data: quotePayload(currency) }, { status: 201 });
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PayInvoiceDialog — layout and copy', () => {
  it('renders the spec copy, summary row and channel cards', async () => {
    renderDialog();
    const dialog = await openDialog();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByText('Secure payment')).toBeInTheDocument();
    expect(
      within(dialog).getByRole('heading', { name: `Pay invoice ${SEPTEMBER.number}` }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'Charged in US dollars (USD). Local currency is shown for reference only.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Enterprise Retainer — Monthly')).toBeInTheDocument();
    expect(within(dialog).getByText('Amount due')).toBeInTheDocument();
    expect(within(dialog).getByText(formatUsd(SEPTEMBER.outstandingUsdCents))).toBeInTheDocument();

    // The three verbatim channel cards.
    expect(within(dialog).getByRole('radio', { name: /Card/ })).toBeInTheDocument();
    expect(within(dialog).getByText('Visa, Mastercard — processed by Stripe')).toBeInTheDocument();
    expect(within(dialog).getByRole('radio', { name: /M-Pesa/ })).toBeInTheDocument();
    expect(
      within(dialog).getByText('Pay from your phone — processed by Paystack'),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('radio', { name: /Bank transfer/ })).toBeInTheDocument();
    expect(within(dialog).getByText('Pay by transfer — processed by Paystack')).toBeInTheDocument();

    // Saved card source (the fixture method is a Mastercard ending 4290).
    expect(await within(dialog).findByText('Use saved Mastercard •••• 4290')).toBeInTheDocument();
    expect(within(dialog).getByText('Use a different card')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Close dialog' })).toBeInTheDocument();
  });

  it('the default display currency follows the billing country (KE → KES)', async () => {
    renderDialog();
    const dialog = await openDialog();
    await waitFor(() => expect(fxRequests.length).toBeGreaterThan(0));
    expect(fxRequests[0]).toMatchObject({
      invoiceId: SEPTEMBER.id,
      displayCurrency: 'KES',
    });
    expect(within(dialog).getByLabelText('Display currency')).toHaveValue('KES');
  });
});

describe('PayInvoiceDialog — FX quote', () => {
  it('shows the locked local amount, rate, countdown and the USD charge sentence', async () => {
    renderDialog();
    const dialog = await openDialog();
    const expectedLocal = formatLocalDisplay(
      Math.round(SEPTEMBER.outstandingUsdCents * 129.5),
      'KES',
    );
    await within(dialog).findByText('Rate locked: 1 USD = 129.50 KES');
    // `Intl.NumberFormat` separates the currency code with a NBSP (U+00A0),
    // which RTL's exact-text matcher does not normalise — compare the
    // space-normalised textContent directly.
    const amountText = dialog.querySelector('.vbb-quote-amount')?.textContent ?? '';
    expect(amountText.replace(/\u00A0/g, ' ')).toBe(`≈ ${expectedLocal}`.replace(/\u00A0/g, ' '));
    expect(within(dialog).getByText('Rate locked: 1 USD = 129.50 KES')).toBeInTheDocument();
    expect(within(dialog).getByText(/Quote valid for \d{2}:\d{2}/)).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        `You will be charged ${formatUsd(SEPTEMBER.outstandingUsdCents)} in USD. The local amount is an estimate based on the locked rate; your bank may apply its own conversion.`,
      ),
    ).toBeInTheDocument();
  });

  it('switching currency requests a fresh quote', async () => {
    renderDialog();
    const dialog = await openDialog();
    await waitFor(() => expect(fxRequests.length).toBeGreaterThan(0));
    fireEvent.change(within(dialog).getByLabelText('Display currency'), {
      target: { value: 'NGN' },
    });
    await waitFor(() =>
      expect(fxRequests.some((request) => request.displayCurrency === 'NGN')).toBe(true),
    );
    expect(within(dialog).getByText(/Quote valid for \d{2}:\d{2}/)).toBeInTheDocument();
  });

  it('the countdown hitting zero shows Quote expired and disables Pay', async () => {
    server.use(
      http.post('*/api/v1/billing/fx-quotes', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        fxRequests.push(body);
        const currency = body.displayCurrency as Exclude<DisplayCurrency, 'USD'>;
        return HttpResponse.json({ data: quotePayload(currency, 1200) }, { status: 201 });
      }),
    );
    renderDialog();
    const dialog = await openDialog();
    expect(
      await within(dialog).findByText('Quote expired', undefined, { timeout: 6000 }),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Refresh quote/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /^Pay / })).toBeDisabled();
  });
});

describe('PayInvoiceDialog — checkout', () => {
  it('the card path sends stripe/card with the quote and NO amount field', async () => {
    mockCheckout(() => succeededResponse());
    mockInvoicesPaidAfter(0);
    const user = userEvent.setup();
    renderDialog();
    const dialog = await openDialog();
    await within(dialog).findByText('Rate locked: 1 USD = 129.50 KES');

    await user.click(within(dialog).getByRole('button', { name: /^Pay / }));
    await waitFor(() => expect(checkoutCalls).toHaveLength(1));
    const body = checkoutCalls[0] as Record<string, unknown>;
    expect(body).toMatchObject({
      invoiceId: SEPTEMBER.id,
      fxQuoteId: 'f0000000-0000-4000-8000-0000000000f1',
      provider: 'stripe',
      channel: 'card',
    });
    expect(typeof body.idempotencyKey).toBe('string');
    expect((body.idempotencyKey as string).length).toBeGreaterThanOrEqual(16);
    // Hard rule: the UI never sends an amount.
    for (const forbidden of ['amount', 'usdCents', 'localMinor', 'chargeAmount', 'value']) {
      expect(body).not.toHaveProperty(forbidden);
    }
    // The saved method needs no tokenisation.
    expect(createPaymentMethod).not.toHaveBeenCalled();
  });

  it('M-Pesa requires a valid phone and sends paystack/mpesa with the waiting copy', async () => {
    mockCheckout(() =>
      HttpResponse.json(
        {
          data: {
            paymentAttemptId: 'a0000000-0000-4000-8000-0000000000a2',
            status: 'created',
            usdCents: SEPTEMBER.outstandingUsdCents,
            settlementCurrency: 'USD',
          },
        },
        { status: 201 },
      ),
    );
    const user = userEvent.setup();
    renderDialog();
    const dialog = await openDialog();
    await within(dialog).findByText('Rate locked: 1 USD = 129.50 KES');

    await user.click(within(dialog).getByRole('radio', { name: /M-Pesa/ }));
    const phoneField = within(dialog).getByLabelText('Phone number');
    expect(phoneField).toHaveAttribute('placeholder', '+254 7XX XXX XXX');

    await user.click(within(dialog).getByRole('button', { name: /^Pay / }));
    expect(await within(dialog).findByText('Enter a valid phone number.')).toBeInTheDocument();
    expect(checkoutCalls).toHaveLength(0);

    await user.type(phoneField, '+254 712 345 678');
    await user.click(within(dialog).getByRole('button', { name: /^Pay / }));
    await waitFor(() => expect(checkoutCalls).toHaveLength(1));
    expect(checkoutCalls[0]).toMatchObject({ provider: 'paystack', channel: 'mpesa' });
    expect(
      await within(dialog).findByText(
        'Check your phone and enter your M-Pesa PIN to approve the payment.',
      ),
    ).toBeInTheDocument();
  });

  it('bank transfer sends paystack/bank_transfer with no extra field', async () => {
    mockCheckout(() => succeededResponse());
    mockInvoicesPaidAfter(0);
    const user = userEvent.setup();
    renderDialog();
    const dialog = await openDialog();
    await within(dialog).findByText('Rate locked: 1 USD = 129.50 KES');
    await user.click(within(dialog).getByRole('radio', { name: /Bank transfer/ }));
    expect(within(dialog).queryByLabelText('Phone number')).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /^Pay / }));
    await waitFor(() => expect(checkoutCalls).toHaveLength(1));
    expect(checkoutCalls[0]).toMatchObject({ provider: 'paystack', channel: 'bank_transfer' });
  });

  it('reuses ONE idempotency key across retries in a dialog session', async () => {
    mockCheckout(() => HttpResponse.json({ error: 'unexpected' }, { status: 500 }));
    const user = userEvent.setup();
    renderDialog();
    const dialog = await openDialog();
    await within(dialog).findByText('Rate locked: 1 USD = 129.50 KES');

    await user.click(within(dialog).getByRole('button', { name: /^Pay / }));
    await waitFor(() =>
      expect(useToastStore.getState().toasts.some((t) => t.title === 'Payment not completed')).toBe(
        true,
      ),
    );
    await user.click(within(dialog).getByRole('button', { name: /^Pay / }));
    await waitFor(() => expect(checkoutCalls).toHaveLength(2));
    expect(checkoutCalls[0]?.idempotencyKey).toBe(checkoutCalls[1]?.idempotencyKey);
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      kind: 'crit',
      title: 'Payment not completed',
      message: 'You have not been charged. Please try again.',
    });
  });

  it('409 quote_expired refreshes the quote with the verbatim message', async () => {
    mockCheckout(() => HttpResponse.json({ error: 'quote_expired' }, { status: 409 }));
    const user = userEvent.setup();
    renderDialog();
    const dialog = await openDialog();
    await within(dialog).findByText('Rate locked: 1 USD = 129.50 KES');
    const quotesBefore = fxRequests.length;

    await user.click(within(dialog).getByRole('button', { name: /^Pay / }));
    expect(
      await within(dialog).findByText(
        'Your quote expired. We refreshed it — please review and pay again.',
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(fxRequests.length).toBe(quotesBefore + 1));
  });

  it('422 channel_unavailable shows the verbatim inline message', async () => {
    mockCheckout(() => HttpResponse.json({ error: 'channel_unavailable' }, { status: 422 }));
    const user = userEvent.setup();
    renderDialog();
    const dialog = await openDialog();
    await within(dialog).findByText('Rate locked: 1 USD = 129.50 KES');
    await user.click(within(dialog).getByRole('button', { name: /^Pay / }));
    expect(
      await within(dialog).findByText(
        'This payment method is not available for this invoice right now. Choose another method.',
      ),
    ).toBeInTheDocument();
  });
});

describe('PayInvoiceDialog — confirmation polling', () => {
  it('polls the invoices list and flips to Payment received', async () => {
    mockCheckout(() => succeededResponse());
    mockInvoicesPaidAfter(1); // first poll still pending, second flips
    const user = userEvent.setup();
    renderDialog();
    const dialog = await openDialog();
    await within(dialog).findByText('Rate locked: 1 USD = 129.50 KES');
    await user.click(within(dialog).getByRole('button', { name: /^Pay / }));

    expect(
      await within(dialog).findByText('Payment received', undefined, { timeout: 12_000 }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        `Invoice ${SEPTEMBER.number} is paid. A receipt has been emailed to you.`,
      ),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(usePayDialogStore.getState().invoice).toBeNull());
  }, 20_000);
});

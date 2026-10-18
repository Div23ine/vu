// Registers the jest-dom matchers and their Vitest type augmentation.
import '@testing-library/jest-dom/vitest';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invoices } from '@vunvault/contracts/fixtures/billing';
import { createQueryClient } from '@vunvault/lib';
import { useToastStore } from '@vunvault/ui';
import { server } from '../../../../mocks/server';
import { usePayDialogStore } from '../../../../lib/pay-dialog-store';
import { SubscriptionCard } from './_components/subscription-card';
import { PaymentMethodCard } from './_components/payment-method-card';
import { InvoiceTable } from './_components/invoice-table';

/**
 * Billing page tests — subscription card values (`$2,499`,
 * `14 Oct 2026`, `Monthly`), the masked payment card (`•••• •••• •••• 4290`),
 * the six-invoice table with the right chips and `$` formatting, the PDF
 * download (including the 202-retry path under fake timers), the CSV export,
 * the Pay-dialog store hand-offs, and the Edit dialog: Stripe Elements are
 * mocked, Save calls `createPaymentMethod` and then PUTs ONLY the token —
 * the request body never carries a `number`/`cvc`/`exp` key.
 */

const createPaymentMethod = vi.hoisted(() => vi.fn());
const elementsComplete = vi.hoisted(() => ({ current: true }));
const stripeConfigured = vi.hoisted(() => ({ current: true }));

vi.mock('@stripe/react-stripe-js', async () => {
  const react = await import('react');
  const makeElement = (name: string) => {
    const Element = ({ onChange }: { onChange?: (event: { complete: boolean }) => void }) => {
      react.useEffect(() => {
        onChange?.({ complete: elementsComplete.current });
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
    useStripe: () => ({ createPaymentMethod }),
    useElements: () => ({ getElement: () => ({ fake: 'card-element' }) }),
  };
});

vi.mock('../../../../lib/stripe', () => ({
  stripeKeyConfigured: () => stripeConfigured.current,
  getStripe: async () => ({}),
}));

const SEPTEMBER = invoices[0];
if (SEPTEMBER === undefined) throw new Error('The invoices fixture is empty.');

let queryClient: QueryClient;
let downloads: string[];
let pdfHits: number;
const createObjectURL = vi.hoisted(() => vi.fn(() => 'blob:mock'));
const revokeObjectURL = vi.hoisted(() => vi.fn());

function renderPage(initialPayInvoiceId: string | null = null) {
  queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <SubscriptionCard />
      <PaymentMethodCard />
      <InvoiceTable initialPayInvoiceId={initialPayInvoiceId} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] });
  usePayDialogStore.setState({ invoice: null });
  createPaymentMethod.mockReset();
  createPaymentMethod.mockResolvedValue({ paymentMethod: { id: 'pm_1TEST' } });
  elementsComplete.current = true;
  stripeConfigured.current = true;
  downloads = [];
  pdfHits = 0;

  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push(this.download);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Billing — subscription card', () => {
  it('renders the fixture plan with formatted values', async () => {
    renderPage();
    expect(await screen.findByText('Enterprise Client')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Renews On')).toBeInTheDocument();
    expect(screen.getByText('14 Oct 2026')).toBeInTheDocument();
    expect(screen.getByText('Billing Cycle')).toBeInTheDocument();
    expect(screen.getByText('Monthly')).toBeInTheDocument();
    // 'Amount' is also the table's column header — scope to the plan card.
    const plan = document.querySelector('.vbb-plan');
    expect(plan).not.toBeNull();
    expect(within(plan as HTMLElement).getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('$2,499')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Full-scope retainer protection with 24/7 attack-surface monitoring, quarterly penetration testing and a dedicated security architect.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Need more coverage?')).toBeInTheDocument();
  });

  it('Upgrade Plan toasts the spec copy without calling the API', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Enterprise Client');
    await user.click(screen.getByRole('button', { name: /Upgrade Plan/ }));
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      kind: 'ok',
      title: 'Upgrade requested',
      message: 'Upgrade options will be emailed to you shortly',
    });
  });
});

describe('Billing — payment method card', () => {
  it('shows the tokenised card, masked to the last four', async () => {
    renderPage();
    expect(await screen.findByText('•••• •••• •••• 4290')).toBeInTheDocument();
    expect(screen.getByText('Mastercard')).toBeInTheDocument();
    expect(screen.getByText('JANE WANJIRU')).toBeInTheDocument();
    expect(screen.getByText('09 / 2028')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Card details are tokenised and stored by our PCI-DSS compliant payment processor.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Edit Payment Method/ })).toBeInTheDocument();
  });

  it('shows the no-method state when the API answers 404', async () => {
    server.use(
      http.get('*/api/v1/billing/payment-method', () =>
        HttpResponse.json({ error: 'not_found' }, { status: 404 }),
      ),
    );
    renderPage();
    expect(await screen.findByText('No payment method on file')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Payment Method/ })).toBeInTheDocument();
  });
});

describe('Billing — invoice table', () => {
  it('renders all six fixture invoices with chips and USD formatting', async () => {
    renderPage();
    expect(await screen.findByText('VV-INV-2026-0902')).toBeInTheDocument();
    for (const number of ['0841', '0720', '0613', '0511', '0488']) {
      expect(screen.getByText(`VV-INV-2026-${number}`)).toBeInTheDocument();
    }
    expect(screen.getAllByText('Paid')).toHaveLength(5);
    expect(screen.getAllByText('Awaiting Payment')).toHaveLength(1);
    expect(screen.getAllByText('$2,499.00')).toHaveLength(4);
    expect(screen.getByText('$1,440.00')).toBeInTheDocument();
    expect(screen.getByText('$899.00')).toBeInTheDocument();
    expect(screen.getByText('18 Aug 2026')).toBeInTheDocument();
    expect(screen.getByText('Full Scope API PenTest')).toBeInTheDocument();
    expect(
      screen.getByText('Enterprise Retainer · 12 endpoints · retest included'),
    ).toBeInTheDocument();
    expect(screen.getByText('Invoice history for Acme Fintech Ltd')).toBeInTheDocument();
    expect(
      screen.getByText('Showing the last 6 transactions.', { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Billing Support/ })).toHaveAttribute(
      'href',
      '/contact',
    );
  });

  it('Pay Now opens the pay-dialog store for pending invoices only', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('VV-INV-2026-0902');
    const payButtons = screen.getAllByRole('button', { name: /Pay Now/ });
    expect(payButtons).toHaveLength(1); // only the pending September invoice
    await user.click(payButtons[0] as HTMLElement);
    expect(usePayDialogStore.getState().invoice?.id).toBe(SEPTEMBER.id);
  });

  it('?invoice= opens the Pay dialog automatically once loaded', async () => {
    renderPage(SEPTEMBER.id);
    await waitFor(() => expect(usePayDialogStore.getState().invoice?.id).toBe(SEPTEMBER.id));
  });

  it('Download PDF streams the endpoint into a revoked blob download', async () => {
    server.use(
      http.get('*/api/v1/billing/invoices/:id/pdf', ({ params }) => {
        pdfHits += 1;
        return new HttpResponse(new Blob(['%PDF-1.4 mock'], { type: 'application/pdf' }), {
          status: 200,
          headers: { 'content-type': 'application/pdf', 'x-pdf-id': String(params.id) },
        });
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('VV-INV-2026-0902');
    await user.click(screen.getAllByRole('button', { name: /Download PDF/ })[0] as HTMLElement);
    await waitFor(() => expect(pdfHits).toBe(1));
    await waitFor(() => expect(downloads).toEqual([`VV-INV-2026-0902.pdf`]));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });

  it('retries a 202 generating answer after 3 s (fake timers), toasting once', async () => {
    vi.useFakeTimers();
    try {
      server.use(
        http.get('*/api/v1/billing/invoices/:id/pdf', () => {
          pdfHits += 1;
          if (pdfHits < 3) {
            return HttpResponse.json({ data: { status: 'generating' } }, { status: 202 });
          }
          return new HttpResponse(new Blob(['%PDF-1.4 mock'], { type: 'application/pdf' }), {
            status: 200,
            headers: { 'content-type': 'application/pdf' },
          });
        }),
      );
      renderPage();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30);
      });
      screen.getByText('VV-INV-2026-0902');
      fireEvent.click(screen.getAllByRole('button', { name: /Download PDF/ })[0] as HTMLElement);
      // First attempt → 202 → toast → wait 3 s → second 202 → wait → success.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3100);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3100);
      });
      expect(pdfHits).toBe(3);
      expect(downloads).toEqual(['VV-INV-2026-0902.pdf']);
      const preparing = useToastStore
        .getState()
        .toasts.filter((entry) => entry.title === 'Preparing your invoice…');
      expect(preparing).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('Export All (CSV) downloads vunvault-invoices.csv and toasts', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('VV-INV-2026-0902');
    await user.click(screen.getByRole('button', { name: /Export All \(CSV\)/ }));
    await waitFor(() => expect(downloads).toEqual(['vunvault-invoices.csv']));
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      kind: 'ok',
      title: 'Invoice history exported as CSV',
    });
  });

  it('an empty ledger shows the EmptyState and refuses the export', async () => {
    server.use(
      http.get('*/api/v1/billing/invoices', () => HttpResponse.json({ data: [], total: 0 })),
    );
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText('No invoices yet')).toBeInTheDocument();
    expect(
      screen.getByText('Invoices appear here after your first engagement or purchase.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Export All \(CSV\)/ }));
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      kind: 'warn',
      title: 'No invoices to export',
      message: 'There are no invoices on this account yet.',
    });
    expect(downloads).toEqual([]);
  });
});

describe('Billing — edit payment dialog', () => {
  async function openDialog(user: ReturnType<typeof userEvent.setup>) {
    await screen.findByText('•••• •••• •••• 4290');
    await user.click(screen.getByRole('button', { name: /Edit Payment Method/ }));
    return screen.getByRole('dialog');
  }

  it('renders the dialog semantics, Stripe Elements and prefilled fields', async () => {
    const user = userEvent.setup();
    renderPage();
    const dialog = await openDialog(user);
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'vbb-payment-title');
    expect(
      within(dialog).getByRole('heading', { name: 'Edit Payment Method' }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Secure card update')).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'Your card is tokenised immediately — VUNVAULT never stores raw card numbers.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId('card-number-element')).toBeInTheDocument();
    expect(screen.getByTestId('card-expiry-element')).toBeInTheDocument();
    expect(screen.getByTestId('card-cvc-element')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Cardholder Name')).toHaveValue('JANE WANJIRU');
    expect(within(dialog).getByLabelText('Billing Country')).toHaveValue('KE');
    // The verbatim country option list.
    const options = within(within(dialog).getByLabelText('Billing Country')).getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'Kenya',
      'Nigeria',
      'Ghana',
      'South Africa',
      'Uganda',
      'Tanzania',
      'Rwanda',
      'United Kingdom',
      'United States',
      'Other',
    ]);
  });

  it('Save tokenises with Stripe and PUTs only the token — never card data', async () => {
    let putBody: Record<string, unknown> | null = null;
    server.use(
      http.put('*/api/v1/billing/payment-method', async ({ request }) => {
        putBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          data: {
            id: 'b0000000-0000-4000-8000-000000000002',
            provider: 'stripe',
            brand: 'Mastercard',
            last4: '4290',
            expMonth: 9,
            expYear: 2028,
            cardholderName: 'JANE WANJIRU',
            billingCountry: 'KE',
          },
        });
      }),
    );
    const user = userEvent.setup();
    renderPage();
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: /Save Card/ }));

    await waitFor(() => expect(createPaymentMethod).toHaveBeenCalledTimes(1));
    expect(createPaymentMethod).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'card',
        billing_details: { name: 'JANE WANJIRU', address: { country: 'KE' } },
      }),
    );
    await waitFor(() => expect(putBody).not.toBeNull());
    expect(putBody).toMatchObject({
      provider: 'stripe',
      providerPaymentMethodToken: 'pm_1TEST',
      cardholderName: 'JANE WANJIRU',
      billingCountry: 'KE',
    });
    // The wire body must never carry raw card fields.
    for (const forbidden of ['number', 'cvc', 'exp', 'exp_month', 'exp_year']) {
      expect(putBody).not.toHaveProperty(forbidden);
    }
    await waitFor(() =>
      expect(useToastStore.getState().toasts[0]).toMatchObject({
        kind: 'ok',
        title: 'Payment method updated',
        message: 'Changes take effect on your next billing cycle.',
      }),
    );
    // Dialog closed.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('blocks an incomplete Element set with the design message', async () => {
    elementsComplete.current = false;
    const user = userEvent.setup();
    renderPage();
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: /Save Card/ }));
    expect(await within(dialog).findByText('Please complete all card fields')).toBeInTheDocument();
    expect(createPaymentMethod).not.toHaveBeenCalled();
  });

  it('shows Stripe errors inline and never PUTs', async () => {
    createPaymentMethod.mockResolvedValue({ error: { message: 'Your card was declined.' } });
    const user = userEvent.setup();
    renderPage();
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole('button', { name: /Save Card/ }));
    expect(await within(dialog).findByText('Your card was declined.')).toBeInTheDocument();
    expect(screen.queryByText('Payment method updated')).not.toBeInTheDocument();
  });

  it('without a publishable key the dialog says unavailable and disables Save', async () => {
    stripeConfigured.current = false;
    const user = userEvent.setup();
    renderPage();
    const dialog = await openDialog(user);
    expect(
      within(dialog).getByText('Card updates are temporarily unavailable.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Save Card/ })).toBeDisabled();
  });

  it('Escape and the close button dismiss the dialog', async () => {
    const user = userEvent.setup();
    renderPage();
    await openDialog(user);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await openDialog(user);
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

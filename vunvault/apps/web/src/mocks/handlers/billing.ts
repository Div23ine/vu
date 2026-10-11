import { http, HttpResponse } from 'msw';
import { CheckoutBody, UpdatePaymentMethodBody, type DisplayCurrency } from '@vunvault/contracts';
import { invoices, paymentMethod, subscription } from '@vunvault/contracts/fixtures/billing';

/**
 * Billing mock handlers (Task 66).
 *
 * Used ONLY by tests (through `mocks/server.ts`) and the opt-in dev mock mode.
 * Every identity and amount comes from the contract fixtures (Acme Fintech
 * Ltd) — no invented data. The PDF/CSV endpoints stream plausible bytes: the
 * mock layer's job is the transport shape (200 binary / text), not the
 * renderer (the real PDFs come from the API's pdf worker).
 *
 * The invoice table's caption reads `GET /api/v1/profile` — that handler
 * lives in `profile.ts` (Task 68; it was parked here by Task 66 before the
 * profile page existed).
 *
 * API contract mirrored here (implemented for real in `apps/api`, Tasks 30/32):
 *   GET /api/v1/billing/subscription      → 200 { data: Subscription }
 *   GET /api/v1/billing/payment-method    → 200 { data: PaymentMethodView }
 *   PUT /api/v1/billing/payment-method    → 200 { data: PaymentMethodView } | 422
 *   GET /api/v1/billing/invoices          → 200 { data: Invoice[]; total }
 *   GET /api/v1/billing/invoices/:id/pdf  → 200 application/pdf | 202 | 404
 *   GET /api/v1/billing/invoices.csv      → 200 text/csv
 */

const PDF_BYTES = Uint8Array.from(
  atob('JVBERi0xLjQKJW1vY2sgcGRmCjEgMCBvYmoKPDwgPj4KZW5kb2JqCnRyYWlsZXIKPDwgPj4KJSVFT0YK'),
  (byte) => byte.charCodeAt(0),
);

function csvOfRows(): string {
  const header = 'invoice_number,issued_at,title,total_usd,status';
  const rows = invoices.map((invoice) =>
    [
      invoice.number,
      invoice.issuedAt,
      `"${invoice.title.replace(/"/g, '""')}"`,
      (invoice.totalUsdCents / 100).toFixed(2),
      invoice.status,
    ].join(','),
  );
  return [header, ...rows].join('\n');
}

export const billingHandlers = [
  http.get('*/api/v1/billing/subscription', () => HttpResponse.json({ data: subscription })),

  http.get('*/api/v1/billing/payment-method', () => HttpResponse.json({ data: paymentMethod })),

  http.put('*/api/v1/billing/payment-method', async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    const parsed = UpdatePaymentMethodBody.safeParse(body);
    if (!parsed.success) {
      return HttpResponse.json(
        { error: 'validation_failed', details: parsed.error.issues },
        { status: 400 },
      );
    }
    // The mock keeps the stored brand/last4 and records the new holder/country.
    return HttpResponse.json({
      data: {
        ...paymentMethod,
        cardholderName: parsed.data.cardholderName,
        billingCountry: parsed.data.billingCountry,
      },
    });
  }),

  http.get('*/api/v1/billing/invoices.csv', () =>
    HttpResponse.text(csvOfRows(), {
      headers: { 'content-type': 'text/csv; charset=utf-8' },
    }),
  ),

  http.get('*/api/v1/billing/invoices/:id/pdf', ({ params }) => {
    const known = invoices.some((invoice) => invoice.id === String(params.id));
    if (!known) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return new HttpResponse(new Blob([PDF_BYTES], { type: 'application/pdf' }), {
      status: 200,
      headers: { 'content-type': 'application/pdf' },
    });
  }),

  http.get('*/api/v1/billing/invoices', ({ request }) => {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') ?? '10')));
    const start = (page - 1) * pageSize;
    return HttpResponse.json({
      data: invoices.slice(start, start + pageSize),
      total: invoices.length,
    });
  }),

  // (Task 66 parked a GET /api/v1/profile handler here for the invoice-table
  // caption; Task 68 — the profile page — owns it now: see profile.ts.)

  // --- Task 66b: the locked FX quote and the USD checkout -------------------
  http.post('*/api/v1/billing/fx-quotes', async ({ request }) => {
    const body = (await request.json().catch(() => null)) as {
      invoiceId?: string;
      displayCurrency?: DisplayCurrency;
    } | null;
    const invoice = invoices.find((candidate) => candidate.id === body?.invoiceId);
    const currency = body?.displayCurrency ?? 'KES';
    if (invoice === undefined || currency === 'USD') {
      return HttpResponse.json({ error: 'unsupported_currency' }, { status: 422 });
    }
    // Display-only mock rates; the charge stays the fixture's USD cents.
    const rates: Record<Exclude<DisplayCurrency, 'USD'>, string> = {
      KES: '129.50',
      NGN: '1650.00',
      GHS: '15.80',
      ZAR: '18.20',
    };
    const rate = rates[currency];
    const localMinor = Math.round(invoice.outstandingUsdCents * Number(rate));
    const lockedAt = new Date();
    const expiresAt = new Date(lockedAt.getTime() + 15 * 60_000);
    return HttpResponse.json(
      {
        data: {
          id: 'f0000000-0000-4000-8000-0000000000f1',
          invoiceId: invoice.id,
          displayCurrency: currency,
          rateLocalPerUsd: rate,
          usdCents: invoice.outstandingUsdCents,
          localMinor,
          lockedAt: lockedAt.toISOString(),
          expiresAt: expiresAt.toISOString(),
          settlementCurrency: 'USD',
        },
      },
      { status: 201 },
    );
  }),

  http.post('*/api/v1/billing/checkout', async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    const parsed = CheckoutBody.safeParse(body);
    if (!parsed.success) {
      return HttpResponse.json(
        { error: 'validation_failed', details: parsed.error.issues },
        { status: 400 },
      );
    }
    const invoice = invoices.find((candidate) => candidate.id === parsed.data.invoiceId);
    if (invoice === undefined) {
      return HttpResponse.json({ error: 'not_found' }, { status: 404 });
    }
    // The standing mock succeeds synchronously (card path); tests override for
    // requires_action / redirectUrl / created / the 409 family.
    return HttpResponse.json(
      {
        data: {
          paymentAttemptId: 'a0000000-0000-4000-8000-0000000000a1',
          status: 'succeeded',
          usdCents: invoice.outstandingUsdCents,
          settlementCurrency: 'USD',
        },
      },
      { status: 201 },
    );
  }),
];

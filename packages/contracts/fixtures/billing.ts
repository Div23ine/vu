import type { FxQuote, Invoice, PaymentMethodView, Subscription } from '../src/billing';

/**
 * Billing fixtures for Acme Fintech Ltd (the client in `fixtures/profile.ts`).
 *
 * Every amount is integer USD cents. The KES quote is display-only: its
 * `localMinor` is exactly `249900 × 129.50 = 32 362 050`, the same value
 * `@vunvault/lib`'s BigInt converter produces, while the charge stays 2 499.00 USD.
 */

const INVOICE_ID = {
  september: 'e0000000-0000-4000-8000-000000000902',
  august: 'e0000000-0000-4000-8000-000000000841',
  july: 'e0000000-0000-4000-8000-000000000720',
  june: 'e0000000-0000-4000-8000-000000000613',
  academy: 'e0000000-0000-4000-8000-000000000511',
  mobile: 'e0000000-0000-4000-8000-000000000488',
} as const;

export const subscription: Subscription = {
  id: 'b0000000-0000-4000-8000-000000000001',
  planName: 'Enterprise Client',
  status: 'active',
  billingCycle: 'monthly',
  amountUsdCents: 249900,
  settlementCurrency: 'USD',
  renewsOn: '2026-10-14',
  description:
    'Full-scope retainer protection with 24/7 attack-surface monitoring, quarterly penetration testing and a dedicated security architect.',
};

export const paymentMethod: PaymentMethodView = {
  id: 'b0000000-0000-4000-8000-000000000002',
  provider: 'stripe',
  brand: 'Mastercard',
  last4: '4290',
  expMonth: 9,
  expYear: 2028,
  cardholderName: 'JANE WANJIRU',
  billingCountry: 'KE',
};

const RETAINER_TITLE = 'Enterprise Retainer — Monthly';
const RETAINER_DETAIL = '24/7 attack surface monitoring · quarterly pentest credit';
const RETAINER_CENTS = 249900;

export const invoices: Invoice[] = [
  {
    id: INVOICE_ID.september,
    number: 'VV-INV-2026-0902',
    issuedAt: '2026-09-18T09:00:00Z',
    title: RETAINER_TITLE,
    detail: RETAINER_DETAIL,
    totalUsdCents: RETAINER_CENTS,
    paidUsdCents: 0,
    outstandingUsdCents: RETAINER_CENTS,
    status: 'pending',
    settlementCurrency: 'USD',
    pdfAvailable: true,
  },
  {
    id: INVOICE_ID.august,
    number: 'VV-INV-2026-0841',
    issuedAt: '2026-08-18T09:00:00Z',
    title: 'Full Scope API PenTest',
    detail: 'Enterprise Retainer · 12 endpoints · retest included',
    totalUsdCents: RETAINER_CENTS,
    paidUsdCents: RETAINER_CENTS,
    outstandingUsdCents: 0,
    status: 'paid',
    settlementCurrency: 'USD',
    pdfAvailable: true,
  },
  {
    id: INVOICE_ID.july,
    number: 'VV-INV-2026-0720',
    issuedAt: '2026-07-18T09:00:00Z',
    title: RETAINER_TITLE,
    detail: RETAINER_DETAIL,
    totalUsdCents: RETAINER_CENTS,
    paidUsdCents: RETAINER_CENTS,
    outstandingUsdCents: 0,
    status: 'paid',
    settlementCurrency: 'USD',
    pdfAvailable: true,
  },
  {
    id: INVOICE_ID.june,
    number: 'VV-INV-2026-0613',
    issuedAt: '2026-06-18T09:00:00Z',
    title: RETAINER_TITLE,
    detail: RETAINER_DETAIL,
    totalUsdCents: RETAINER_CENTS,
    paidUsdCents: RETAINER_CENTS,
    outstandingUsdCents: 0,
    status: 'paid',
    settlementCurrency: 'USD',
    pdfAvailable: true,
  },
  {
    id: INVOICE_ID.academy,
    number: 'VV-INV-2026-0511',
    issuedAt: '2026-05-12T09:00:00Z',
    title: 'VUNVAULT Academy — Team Subscription',
    detail: '12 seats · SOC Analyst & Red Team tracks · annual',
    totalUsdCents: 144000,
    paidUsdCents: 144000,
    outstandingUsdCents: 0,
    status: 'paid',
    settlementCurrency: 'USD',
    pdfAvailable: true,
  },
  {
    id: INVOICE_ID.mobile,
    number: 'VV-INV-2026-0488',
    issuedAt: '2026-05-02T09:00:00Z',
    title: 'Mobile App PenTest — iOS & Android',
    detail: 'M-Pesa gateway integration review · one-off engagement',
    totalUsdCents: 89900,
    paidUsdCents: 89900,
    outstandingUsdCents: 0,
    status: 'paid',
    settlementCurrency: 'USD',
    pdfAvailable: true,
  },
];

/** The invoice a client would pay next. */
export const openInvoice: Invoice = invoices[0] as Invoice;

/** Locked KES display quote for the open invoice (15-minute window). */
export const fxQuoteKes: FxQuote = {
  id: 'b0000000-0000-4000-8000-000000000003',
  invoiceId: INVOICE_ID.september,
  displayCurrency: 'KES',
  rateLocalPerUsd: '129.50000000',
  usdCents: RETAINER_CENTS,
  localMinor: 32362050,
  lockedAt: '2026-09-24T11:45:00Z',
  expiresAt: '2026-09-24T12:00:00Z',
  settlementCurrency: 'USD',
};

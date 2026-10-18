import { z } from 'zod';
import { IsoDateTime, PageQuery, Uuid, UsdCents } from './common.js';
import {
  BillingCycleSchema,
  DisplayCurrencySchema,
  InvoiceStatusSchema,
  PaymentChannelSchema,
  PaymentProviderSchema,
  SubscriptionStatusSchema,
} from './enums.js';

/**
 * Money rules.
 *
 * USD cents are the ONLY charged amount. Display currencies are
 * `USD | KES | NGN | GHS | ZAR` and are display-only.
 *
 * The FX quote flow is:
 *   1. the client requests a quote for an invoice + display currency;
 *   2. the server returns a locked rate valid for 15 minutes, with `usdCents` and
 *      `localMinor`;
 *   3. checkout charges `usdCents` in USD through Stripe (international cards) or
 *      Paystack (African cards, M-Pesa, bank).
 *
 * Never accept a charge amount in a non-USD currency. No cryptocurrency.
 * Raw card data never reaches this API: the browser tokenises with the provider
 * and only a token, brand, last four and expiry are modelled here.
 */

/** An M-Pesa charge is routed through Paystack and still settles in USD. */
export const MPESA_PROVIDER_MESSAGE = 'M-Pesa is only available through Paystack';

export const Subscription = z.object({
  id: Uuid,
  planName: z.string(),
  status: SubscriptionStatusSchema,
  billingCycle: BillingCycleSchema,
  amountUsdCents: UsdCents,
  settlementCurrency: z.literal('USD'),
  /** Calendar date, e.g. `2026-10-14`. */
  renewsOn: z.string().date(),
  description: z.string(),
});
export type Subscription = z.infer<typeof Subscription>;

/**
 * Tokenised card view. There is deliberately no PAN, no CVC and no track data:
 * the model cannot carry them.
 */
export const PaymentMethodView = z.object({
  id: Uuid,
  provider: PaymentProviderSchema,
  brand: z.string(),
  last4: z.string().length(4),
  expMonth: z.number().int().min(1).max(12),
  expYear: z.number().int(),
  cardholderName: z.string().nullable(),
  billingCountry: z.string().nullable(),
});
export type PaymentMethodView = z.infer<typeof PaymentMethodView>;

export const UpdatePaymentMethodBody = z.object({
  provider: PaymentProviderSchema,
  /** Provider-side token produced in the browser. Never a card number. */
  providerPaymentMethodToken: z.string().min(1),
  cardholderName: z.string().min(2),
  billingCountry: z.string().length(2),
});
export type UpdatePaymentMethodBody = z.infer<typeof UpdatePaymentMethodBody>;

/**
 * Presentation record. `totalUsdCents`, `paidUsdCents` and `outstandingUsdCents`
 * are read from the derived `invoice_balances` view — the ledger is the source of
 * truth, never a mutable column on the invoice.
 */
export const Invoice = z.object({
  id: Uuid,
  number: z.string().regex(/^VV-INV-\d{4}-\d{4,}$/),
  issuedAt: IsoDateTime,
  title: z.string(),
  detail: z.string().nullable(),
  totalUsdCents: UsdCents,
  paidUsdCents: UsdCents,
  outstandingUsdCents: UsdCents,
  status: InvoiceStatusSchema,
  settlementCurrency: z.literal('USD'),
  pdfAvailable: z.boolean(),
});
export type Invoice = z.infer<typeof Invoice>;

export const InvoiceListQuery = PageQuery.extend({
  status: InvoiceStatusSchema.optional(),
});
export type InvoiceListQuery = z.infer<typeof InvoiceListQuery>;

export const FxQuoteRequest = z.object({
  invoiceId: Uuid,
  displayCurrency: DisplayCurrencySchema,
});
export type FxQuoteRequest = z.infer<typeof FxQuoteRequest>;

/**
 * A locked display rate. `rateLocalPerUsd` stays a decimal *string* end to end so
 * the conversion in `@vunvault/lib` can use BigInt arithmetic; `localMinor` is
 * display-only and is never charged.
 */
export const FxQuote = z.object({
  id: Uuid,
  invoiceId: Uuid,
  displayCurrency: DisplayCurrencySchema,
  rateLocalPerUsd: z
    .string()
    .regex(/^\d{1,10}(\.\d{1,8})?$/, 'Rate must be a decimal string of local units per 1 USD'),
  usdCents: UsdCents,
  localMinor: z.number().int().nonnegative(),
  lockedAt: IsoDateTime,
  /** `lockedAt` + 15 minutes. */
  expiresAt: IsoDateTime,
  settlementCurrency: z.literal('USD'),
});
export type FxQuote = z.infer<typeof FxQuote>;

export const CheckoutBody = z
  .object({
    invoiceId: Uuid,
    /** Optional: when present, the locked display rate is shown alongside the USD charge. */
    fxQuoteId: Uuid.optional(),
    provider: PaymentProviderSchema,
    channel: PaymentChannelSchema,
    providerPaymentMethodToken: z.string().optional(),
    idempotencyKey: z.string().min(16),
  })
  .superRefine((value, ctx) => {
    if (value.channel === 'mpesa' && value.provider !== 'paystack') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['provider'],
        message: MPESA_PROVIDER_MESSAGE,
      });
    }
  });
export type CheckoutBody = z.infer<typeof CheckoutBody>;

/** The charge is always created for `usdCents` in USD, whatever the display currency. */
export const CheckoutResponse = z.object({
  data: z.object({
    paymentAttemptId: Uuid,
    status: z.enum(['created', 'requires_action', 'succeeded', 'failed']),
    usdCents: UsdCents,
    settlementCurrency: z.literal('USD'),
    /** Stripe client secret for 3-D Secure confirmation in the browser. */
    clientSecret: z.string().optional(),
    /** Paystack redirect for hosted checkout. */
    redirectUrl: z.string().url().optional(),
  }),
});
export type CheckoutResponse = z.infer<typeof CheckoutResponse>;

/** A provider webhook acknowledgement. */
export const WebhookAck = z.object({ received: z.literal(true) });
export type WebhookAck = z.infer<typeof WebhookAck>;

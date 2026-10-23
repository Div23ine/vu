import type {
  CheckoutBody,
  CheckoutResponse,
  DisplayCurrency,
  FxQuote,
  FxQuoteRequest,
  InvoiceStatus,
  PaymentAttemptStatus,
  PaymentChannel,
} from '@vunvault/contracts';
import { HttpError } from '../../../lib/http-error';
import { isProviderError } from '../../../providers/error';
import type { PaymentProviders } from '../../../billing/providers/index';
import type { FxRateSource } from '../../../billing/fx-rates';
import { FX_CACHE_TTL_SECONDS } from '../../../billing/fx-rates';
import { isDisplayCurrency, usdCentsToLocalMinor } from '../../../billing/money';
import {
  isUniqueViolation,
  type CheckoutInvoiceRow,
  type CheckoutRepo,
  type FxQuoteRow,
  type PaymentAttemptRow,
} from './repo';

/**
 * FX QUOTE FLOW — the three steps, and why they are in this order.
 *
 *   1. The client asks for a quote for ONE invoice in a display currency
 *      (`POST /billing/fx-quotes` with `{ invoiceId, displayCurrency }`).
 *   2. The server locks a rate for 15 minutes and returns the local amount for
 *      DISPLAY: `rateLocalPerUsd`, `usdCents`, `localMinor`, `expiresAt`.
 *   3. Checkout charges `usdCents` in USD (`POST /billing/checkout`).
 *
 * A quote can never change the charged amount; it can only be consumed once. The
 * amount on the charge is read from the ledger-derived balance at checkout time,
 * which is why a quote taken before a payment lands answers `409 amount_changed`
 * instead of quietly charging the old figure.
 *
 * Nothing in this module posts to the ledger. Only the signature-verified webhook
 * (Task 34) posts the capture entry, even when a provider says `succeeded`
 * synchronously: the provider's word in a response body is not money in the bank.
 */

/** Invoice states that can still be charged. */
export const CHARGEABLE_STATUSES: readonly InvoiceStatus[] = ['pending', 'overdue'];

/** A locked rate is valid for this long, and the rate cache lives just as long. */
export const QUOTE_TTL_SECONDS = FX_CACHE_TTL_SECONDS;

/** Paystack's channel vocabulary differs from ours; the mapping is fixed here. */
export const PAYSTACK_CHANNELS: Record<PaymentChannel, string[]> = {
  card: ['card'],
  mpesa: ['mobile_money'],
  bank_transfer: ['bank_transfer'],
};

export type CheckoutResponseData = CheckoutResponse['data'];

export interface FxServiceDeps {
  repo: CheckoutRepo;
  rates: FxRateSource;
  now?: () => Date;
  /** `FX_QUOTE_TTL_SECONDS`; a locked rate's lifetime. */
  ttlSeconds?: number;
  randomUuid?: () => string;
}

export class FxService {
  private readonly repo: CheckoutRepo;
  private readonly rates: FxRateSource;
  private readonly now: () => Date;
  private readonly ttlSeconds: number;
  private readonly randomUuid: () => string;

  constructor(deps: FxServiceDeps) {
    this.repo = deps.repo;
    this.rates = deps.rates;
    this.now = deps.now ?? (() => new Date());
    this.ttlSeconds = deps.ttlSeconds ?? QUOTE_TTL_SECONDS;
    this.randomUuid = deps.randomUuid ?? (() => crypto.randomUUID());
  }

  /**
   * Lock a display rate against one invoice.
   *
   * `usdCents` on the quote is the outstanding balance at this instant. It is
   * recorded so checkout can prove the amount has not moved since the client was
   * shown a number.
   */
  async quote(orgId: string, body: FxQuoteRequest): Promise<FxQuote> {
    const invoice = await this.invoiceOrRefuse(orgId, body.invoiceId);

    // The contract validates the currency; this check exists so an unsupported
    // code cannot reach the rate feed if the enum is ever widened without the
    // display layer catching up.
    if (!isDisplayCurrency(body.displayCurrency)) {
      throw new HttpError(
        422,
        'unsupported_currency',
        `${body.displayCurrency} cannot be displayed. Choose USD, KES, NGN, GHS or ZAR.`,
      );
    }

    const rate = await this.rates.getRate(body.displayCurrency as DisplayCurrency);
    const lockedAt = this.now();
    const row = await this.repo.insertFxQuote({
      id: this.randomUuid(),
      orgId,
      invoiceId: invoice.id,
      displayCurrency: body.displayCurrency,
      rateLocalPerUsd: rate,
      usdCents: invoice.outstandingUsdCents,
      // Display only. This number is never sent to a provider.
      localMinor: usdCentsToLocalMinor(invoice.outstandingUsdCents, rate),
      lockedAt,
      expiresAt: new Date(lockedAt.getTime() + this.ttlSeconds * 1_000),
    });

    return toFxQuote(row);
  }

  /** Shared with checkout: one rule for what may be charged, in one place. */
  async invoiceOrRefuse(orgId: string, invoiceId: string): Promise<CheckoutInvoiceRow> {
    const invoice = await this.repo.getInvoice(orgId, invoiceId);
    // Scoped by org in the query, so a foreign invoice is indistinguishable from
    // one that does not exist.
    if (invoice === null) throw HttpError.notFound();
    if (!isChargeable(invoice)) throw alreadyPaid();
    return invoice;
  }
}

export interface CheckoutServiceDeps {
  repo: CheckoutRepo;
  payments?: PaymentProviders;
  now?: () => Date;
  randomUuid?: () => string;
}

export interface CheckoutOutcome {
  /** `replay` when the idempotency key already existed: nothing was created. */
  kind: 'created' | 'replay';
  data: CheckoutResponseData;
  /** Present only for a newly created attempt, for the audit entry. */
  attempt?: PaymentAttemptRow;
  invoice?: CheckoutInvoiceRow;
}

export class CheckoutService {
  private readonly repo: CheckoutRepo;
  private readonly payments: PaymentProviders | undefined;
  private readonly now: () => Date;
  private readonly randomUuid: () => string;

  constructor(deps: CheckoutServiceDeps) {
    this.repo = deps.repo;
    this.payments = deps.payments;
    this.now = deps.now ?? (() => new Date());
    this.randomUuid = deps.randomUuid ?? (() => crypto.randomUUID());
  }

  /**
   * Charge the outstanding balance of one invoice, in USD, through one provider.
   *
   * The client never supplies an amount. `usdCents` is read from the ledger-derived
   * balance and is the only figure passed to a provider, whatever display currency
   * the quote was taken in.
   */
  async checkout(
    orgId: string,
    actorId: string | null,
    body: CheckoutBody,
  ): Promise<CheckoutOutcome> {
    // 1. Idempotency first: a replayed key must never create a second attempt, and
    //    must never reach a provider.
    const existing = await this.repo.findAttemptByIdempotencyKey(orgId, body.idempotencyKey);
    if (existing !== null) {
      return { kind: 'replay', data: toResponseData(existing) };
    }

    // 2. The amount is server-derived, from the ledger's view of the invoice.
    const invoice = await this.invoiceOrRefuse(orgId, body.invoiceId);
    const usdCents = invoice.outstandingUsdCents;

    // 3. A quote is single-use, must still be live, and must match the amount now
    //    outstanding.
    let quote: FxQuoteRow | null = null;
    if (body.fxQuoteId !== undefined) {
      quote = await this.repo.getFxQuote(orgId, body.fxQuoteId);
      if (
        quote === null ||
        quote.invoiceId !== invoice.id ||
        quote.consumedAt !== null ||
        new Date(quote.expiresAt).getTime() <= this.now().getTime()
      ) {
        // One code for "not yours", "already spent" and "too old": the client's
        // remedy is the same either way, and the difference is not ours to leak.
        throw new HttpError(409, 'quote_expired', 'That exchange rate is no longer locked');
      }
      if (quote.usdCents !== usdCents) {
        throw new HttpError(
          409,
          'amount_changed',
          'The amount outstanding changed since this rate was locked',
        );
      }
      // Consumed inside the caller's transaction: if the provider call or the
      // audit append fails, the quote becomes usable again.
      const consumed = await this.repo.consumeFxQuote(quote.id, this.now());
      if (!consumed) {
        throw new HttpError(409, 'quote_expired', 'That exchange rate is no longer locked');
      }
    }

    if (this.payments === undefined) {
      throw new HttpError(503, 'service_unavailable', 'Payment providers are not configured');
    }

    // 4. Routing. `mpesa` + `stripe` is refused by the contract before this point.
    const attemptId = this.randomUuid();
    let routed: RoutedCharge;
    try {
      routed =
        body.provider === 'stripe'
          ? await this.chargeWithStripe(orgId, body, usdCents, attemptId)
          : await this.chargeWithPaystack(orgId, body, usdCents, attemptId);
    } catch (error) {
      if (isChannelRejection(error)) {
        // If the merchant account cannot present USD for this channel — M-Pesa is
        // the case to watch — this is where it surfaces, as a refusal and not as a
        // charge in some other currency.
        throw new HttpError(
          422,
          'channel_unavailable',
          `${describeChannel(body.channel)} is not available through ${body.provider} for this account`,
        );
      }
      if (!isProviderError(error)) throw error;
      // A declined charge is still an attempt worth recording; the ledger is not
      // touched, because no money moved.
      routed = { status: 'failed', failureCode: error.code, providerReference: null };
    }

    // 5. The attempt row. `settlement_currency` is written as the literal 'USD' in
    //    the repository's INSERT: there is no parameter that could change it.
    const attempt = await this.insertAttempt(orgId, body, {
      id: attemptId,
      invoiceId: invoice.id,
      fxQuoteId: quote?.id ?? null,
      usdCents,
      actorId,
      routed,
    });

    return {
      kind: 'created',
      data: toResponseData(attempt, routed),
      attempt,
      invoice,
    };
  }

  /** Shared with `FxService`: one rule for what may be charged. */
  private async invoiceOrRefuse(orgId: string, invoiceId: string): Promise<CheckoutInvoiceRow> {
    const invoice = await this.repo.getInvoice(orgId, invoiceId);
    if (invoice === null) throw HttpError.notFound();
    if (!isChargeable(invoice)) throw alreadyPaid();
    return invoice;
  }

  private async insertAttempt(
    orgId: string,
    body: CheckoutBody,
    input: {
      id: string;
      invoiceId: string;
      fxQuoteId: string | null;
      usdCents: number;
      actorId: string | null;
      routed: RoutedCharge;
    },
  ): Promise<PaymentAttemptRow> {
    try {
      return await this.repo.insertPaymentAttempt({
        id: input.id,
        invoiceId: input.invoiceId,
        fxQuoteId: input.fxQuoteId,
        provider: body.provider,
        channel: body.channel,
        providerReference: input.routed.providerReference,
        status: input.routed.status,
        usdCents: input.usdCents,
        idempotencyKey: body.idempotencyKey,
        createdBy: input.actorId,
        failureCode: input.routed.failureCode ?? null,
      });
    } catch (error) {
      // Two concurrent checkouts with the same key: the loser reports the winner's
      // attempt rather than a constraint violation. The provider call was already
      // deduplicated by the idempotency key it carried.
      if (!isUniqueViolation(error)) throw error;
      const winner = await this.repo.findAttemptByIdempotencyKey(orgId, body.idempotencyKey);
      if (winner === null) throw error;
      return winner;
    }
  }

  /** Stripe: an international card charge, confirmed immediately, in USD. */
  private async chargeWithStripe(
    orgId: string,
    body: CheckoutBody,
    usdCents: number,
    attemptId: string,
  ): Promise<RoutedCharge> {
    const stripe = this.requirePayments().stripe;
    const organization = await this.repo.getOrganization(orgId);
    if (organization === null) {
      throw new HttpError(403, 'no_org', 'This account is not attached to an organisation');
    }

    let customerId = organization.stripeCustomerId;
    if (customerId === null) {
      // Created once per organisation and reused, exactly as the payment-method
      // route does: a second customer would split the org's payment history.
      const created = await stripe.createCustomer({
        email: organization.email,
        name: organization.name,
        metadata: { orgId },
        idempotencyKey: `cust:${body.idempotencyKey}`,
      });
      customerId = created.id;
      await this.repo.setStripeCustomerId(orgId, customerId);
    }

    const paymentMethodId =
      body.providerPaymentMethodToken ??
      (await this.repo.getDefaultPaymentMethodId(orgId, 'stripe'));
    if (paymentMethodId === null || paymentMethodId === '') {
      throw new HttpError(
        422,
        'payment_method_required',
        'Add a payment method before checking out',
      );
    }

    const intent = await stripe.createPaymentIntent({
      amountUsdCents: usdCents,
      customerId,
      paymentMethodId,
      // The client's key, so a retry after a timeout cannot charge twice.
      idempotencyKey: body.idempotencyKey,
      metadata: { invoiceId: body.invoiceId, attemptId },
    });

    return {
      status: stripeStatusToAttemptStatus(intent.status),
      providerReference: intent.id,
      clientSecret: intent.clientSecret ?? undefined,
      failureCode: null,
    };
  }

  /** Paystack: African cards, M-Pesa and bank transfer, hosted, still in USD. */
  private async chargeWithPaystack(
    orgId: string,
    body: CheckoutBody,
    usdCents: number,
    attemptId: string,
  ): Promise<RoutedCharge> {
    const paystack = this.requirePayments().paystack;
    const organization = await this.repo.getOrganization(orgId);
    if (organization === null) {
      throw new HttpError(403, 'no_org', 'This account is not attached to an organisation');
    }
    if (organization.email === '') {
      throw new HttpError(
        422,
        'billing_contact_missing',
        'This organisation has no billing contact email',
      );
    }

    const initialized = await paystack.initializeTransaction({
      email: organization.email,
      amountUsdCents: usdCents,
      // The reference is the attempt id, so a webhook can be matched to the row
      // without a lookup table.
      reference: attemptId,
      channels: PAYSTACK_CHANNELS[body.channel],
      metadata: { invoiceId: body.invoiceId, channel: body.channel },
    });

    // A hosted checkout is always "created" until Paystack calls back.
    return {
      status: 'created',
      providerReference: initialized.reference,
      redirectUrl: initialized.authorizationUrl,
      failureCode: null,
    };
  }

  private requirePayments(): PaymentProviders {
    if (this.payments === undefined) {
      throw new HttpError(503, 'service_unavailable', 'Payment providers are not configured');
    }
    return this.payments;
  }
}

interface RoutedCharge {
  status: PaymentAttemptStatus;
  providerReference: string | null;
  clientSecret?: string;
  redirectUrl?: string;
  failureCode?: string | null;
}

/** `succeeded | requires_action | created`, with a decline recorded as `failed`. */
export function stripeStatusToAttemptStatus(status: string): PaymentAttemptStatus {
  if (status === 'succeeded') return 'succeeded';
  if (status === 'requires_action') return 'requires_action';
  if (status === 'canceled') return 'failed';
  return 'created';
}

/**
 * A provider refusal of the channel/currency combination, as opposed to a declined
 * card or an unreachable API. Matched on the provider's own code and message
 * because neither provider documents a stable error class for it.
 */
const CHANNEL_REJECTION =
  /channel|currenc|unsupported|not supported|not available|invalid_channel|payment_method_unsupported/i;

export function isChannelRejection(error: unknown): boolean {
  if (!isProviderError(error)) return false;
  return CHANNEL_REJECTION.test(`${error.code} ${error.message}`);
}

export function isChargeable(invoice: CheckoutInvoiceRow): boolean {
  const status = invoice.status as InvoiceStatus;
  return CHARGEABLE_STATUSES.includes(status) && invoice.outstandingUsdCents > 0;
}

function alreadyPaid(): HttpError {
  return new HttpError(409, 'already_paid', 'This invoice has nothing outstanding');
}

export function describeChannel(channel: PaymentChannel): string {
  return channel === 'mpesa' ? 'M-Pesa' : channel === 'bank_transfer' ? 'Bank transfer' : 'Card';
}

export function toFxQuote(row: FxQuoteRow): FxQuote {
  return {
    id: row.id,
    invoiceId: row.invoiceId,
    displayCurrency: row.displayCurrency as FxQuote['displayCurrency'],
    // Stays a decimal string end to end so the BigInt conversion is exact.
    rateLocalPerUsd: row.rateLocalPerUsd,
    usdCents: row.usdCents,
    localMinor: row.localMinor,
    lockedAt: row.lockedAt,
    expiresAt: row.expiresAt,
    // Settlement is USD. A quote is a display artefact and cannot change that.
    settlementCurrency: 'USD',
  };
}

/**
 * A replay carries no `clientSecret` or `redirectUrl`: neither is stored, and a
 * Stripe client secret must not be handed out twice. A client that lost the
 * original response retries with a NEW idempotency key.
 */
export function toResponseData(
  row: PaymentAttemptRow,
  routed?: RoutedCharge,
): CheckoutResponseData {
  const data: CheckoutResponseData = {
    paymentAttemptId: row.id,
    status: row.status as CheckoutResponseData['status'],
    usdCents: row.usdCents,
    settlementCurrency: 'USD',
  };
  if (routed?.clientSecret !== undefined) data.clientSecret = routed.clientSecret;
  if (routed?.redirectUrl !== undefined) data.redirectUrl = routed.redirectUrl;
  return data;
}

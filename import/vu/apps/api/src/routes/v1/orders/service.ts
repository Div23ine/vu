import { randomUUID } from 'node:crypto';
import type { DisplayCurrency } from '@vunvault/contracts';
import { HttpError } from '../../../lib/http-error.js';
import type { PaystackClient, PaystackTransaction } from '../../../billing/providers/paystack.js';
import type { FxRateSource } from '../../../billing/fx-rates.js';
import type { GuestOrderRow, OrdersRepo, PlanRow } from './repo.js';

/**
 * Guest checkout service.
 *
 * Money rules, in order of importance: settlement is USD cents from the
 * `plans` table (never from the client); the display currency is a locked
 * conversion snapshot taken at order creation; and a Paystack transaction is
 * trusted only after `verifyTransaction` confirms status, currency and the
 * exact amount against the stored order. The client-side callback is a
 * rumour; the verify call and the signed webhook are the facts.
 */

export interface OrderDependencies {
  repo: OrdersRepo;
  paystack: PaystackClient;
  fx?: FxRateSource;
  now?: () => Date;
  /** `${WEB_ORIGIN}` — Paystack returns the buyer here after the attempt. */
  webOrigin: string;
}

export interface CreatedOrder {
  reference: string;
  authorizationUrl: string;
  order: GuestOrderRow;
}

export interface VerifiedOrder {
  order: GuestOrderRow;
  /** True only for the call that flipped pending -> paid (sends the receipt). */
  transitioned: boolean;
}

function minorUnits(usdCents: number, rateLocalPerUsd: string, currency: string): number {
  // KES/GBP/EUR/NGN/GHS/ZAR all settle in 1/100 units locally, like USD.
  void currency;
  const major = (usdCents / 100) * Number(rateLocalPerUsd);
  return Math.round(major * 100);
}

export class OrdersService {
  private readonly deps: OrderDependencies;
  private readonly now: () => Date;

  constructor(deps: OrderDependencies) {
    this.deps = deps;
    this.now = deps.now ?? (() => new Date());
  }

  async plans(): Promise<PlanRow[]> {
    return this.deps.repo.listActivePlans();
  }

  async createOrder(input: {
    planCode: string;
    email: string;
    displayCurrency?: DisplayCurrency;
  }): Promise<CreatedOrder> {
    const plan = (await this.deps.repo.listActivePlans()).find(
      (candidate) => candidate.code === input.planCode,
    );
    if (plan === undefined) {
      throw new HttpError(404, 'plan_not_found', `No active plan named ${input.planCode}`);
    }

    const currency = input.displayCurrency ?? 'USD';
    let rateLocalPerUsd: string | null = null;
    if (currency !== 'USD' && this.deps.fx !== undefined) {
      try {
        rateLocalPerUsd = await this.deps.fx.getRate(currency);
      } catch {
        // No rate, no guess: the order proceeds in USD display and the UI
        // says equivalents are temporarily unavailable.
        rateLocalPerUsd = null;
      }
    }
    const displayMinor =
      rateLocalPerUsd === null
        ? null
        : minorUnits(plan.monthly_usd_cents, rateLocalPerUsd, currency);

    const reference = `vv-${randomUUID().replace(/-/g, '')}`;
    const initialized = await this.deps.paystack.initializeTransaction({
      email: input.email,
      amountUsdCents: plan.monthly_usd_cents,
      reference,
      metadata: { plan_code: plan.code, display_currency: currency },
    });

    await this.deps.repo.createGuestOrder({
      reference,
      planCode: plan.code,
      email: input.email,
      usdCents: plan.monthly_usd_cents,
      displayCurrency: rateLocalPerUsd === null ? 'USD' : currency,
      rateLocalPerUsd,
      displayMinor,
    });

    const order = await this.deps.repo.findGuestOrder(reference);
    if (order === null) throw new HttpError(500, 'order_missing', 'Order row vanished');
    return { reference, authorizationUrl: initialized.authorizationUrl, order };
  }

  /**
   * Server-side verification. Every number comes back from Paystack and is
   * compared with the stored order — a forged or replayed reference fails
   * closed.
   */
  async verifyOrder(reference: string): Promise<VerifiedOrder> {
    const order = await this.deps.repo.findGuestOrder(reference);
    if (order === null) {
      throw new HttpError(404, 'order_not_found', `No order with reference ${reference}`);
    }
    if (order.status === 'paid') return { order, transitioned: false };

    let txn: PaystackTransaction;
    try {
      txn = await this.deps.paystack.verifyTransaction(reference);
    } catch {
      throw new HttpError(
        502,
        'payment_provider_unavailable',
        'Paystack could not be reached to verify this payment',
      );
    }

    const problems: string[] = [];
    if (txn.status !== 'success') problems.push(`status ${txn.status}`);
    if (txn.currency.toUpperCase() !== 'USD') problems.push(`currency ${txn.currency}`);
    if (txn.amount !== order.usd_cents) {
      problems.push(`amount ${txn.amount} vs expected ${order.usd_cents}`);
    }
    if (problems.length > 0) {
      await this.deps.repo.failGuestOrder(reference, problems.join('; '));
      throw new HttpError(
        409,
        'payment_verification_failed',
        `Paystack verification rejected this reference: ${problems.join(', ')}`,
      );
    }

    const transitioned = await this.deps.repo.fulfillGuestOrder(reference, this.now());
    const fresh = transitioned ? await this.deps.repo.findGuestOrder(reference) : order;
    return { order: fresh ?? order, transitioned };
  }

  /** Webhook path: fulfil without re-calling Paystack (signature already proved it). */
  async fulfillFromWebhook(reference: string, reportedAmount: number, reportedCurrency: string) {
    const order = await this.deps.repo.findGuestOrder(reference);
    if (order === null) return null;
    if (reportedCurrency.toUpperCase() !== 'USD' || reportedAmount !== order.usd_cents) {
      await this.deps.repo.failGuestOrder(
        reference,
        `webhook reported ${reportedAmount} ${reportedCurrency} vs ${order.usd_cents} USD`,
      );
      return { order, transitioned: false, rejected: true as const };
    }
    const transitioned = await this.deps.repo.fulfillGuestOrder(reference, this.now());
    return { order, transitioned, rejected: false as const };
  }
}

import { describe, expect, it } from 'vitest';
import { HttpError } from '../../../lib/http-error.js';
import type { PaystackClient, PaystackTransaction } from '../../../billing/providers/paystack.js';
import type { FxRateSource } from '../../../billing/fx-rates.js';
import { OrdersService } from './service.js';
import type { GuestOrderRow, NewGuestOrder, OrdersRepo, PlanRow } from './repo.js';

/**
 * Guest checkout service tests — the money rules: the plan catalogue prices
 * in USD cents, a forged or mismatched Paystack verification fails closed,
 * and fulfilment is a single pending -> paid transition no matter how many
 * callers (verify route, webhook) race on the same reference.
 */

const PLANS: PlanRow[] = [
  {
    code: 'starter_scan',
    name: 'Starter Assessment',
    description: null,
    unit: 'scan',
    monthly_usd_cents: 29_900,
  },
];

class FakeRepo implements OrdersRepo {
  orders = new Map<string, GuestOrderRow>();

  async listActivePlans(): Promise<PlanRow[]> {
    return PLANS;
  }
  async createGuestOrder(input: NewGuestOrder): Promise<void> {
    this.orders.set(input.reference, {
      reference: input.reference,
      plan_code: input.planCode,
      email: input.email,
      status: 'pending',
      usd_cents: input.usdCents,
      display_currency: input.displayCurrency,
      rate_local_per_usd: input.rateLocalPerUsd,
      display_minor: input.displayMinor,
      paid_at: null,
      failure_reason: null,
      created_at: new Date().toISOString(),
    });
  }
  async findGuestOrder(reference: string): Promise<GuestOrderRow | null> {
    return this.orders.get(reference) ?? null;
  }
  async fulfillGuestOrder(reference: string, paidAt: Date): Promise<boolean> {
    const order = this.orders.get(reference);
    if (order === undefined || order.status !== 'pending') return false;
    this.orders.set(reference, { ...order, status: 'paid', paid_at: paidAt.toISOString() });
    return true;
  }
  async failGuestOrder(reference: string, reason: string): Promise<void> {
    const order = this.orders.get(reference);
    if (order === undefined || order.status !== 'pending') return;
    this.orders.set(reference, { ...order, status: 'failed', failure_reason: reason });
  }
}

function fakePaystack(verify: () => Promise<PaystackTransaction>): PaystackClient {
  return {
    initializeTransaction: async (input: { email: string; reference: string }) => ({
      authorizationUrl: `https://checkout.paystack.com/${input.reference}`,
      accessCode: 'ac',
      reference: input.reference,
    }),
    verifyTransaction: verify,
  } as unknown as PaystackClient;
}

const RATES: FxRateSource = {
  getRate: async (currency) => (currency === 'KES' ? '129.00000000' : '1.00000000'),
  getRateTable: async () => ({
    rates: { USD: '1.00000000', KES: '129.00000000' },
    fetchedAt: new Date().toISOString(),
  }),
};

function service(repo: FakeRepo, paystack: PaystackClient) {
  return new OrdersService({
    repo,
    paystack,
    fx: RATES,
    webOrigin: 'https://www.vunvault.test',
    now: () => new Date('2026-10-18T12:00:00Z'),
  });
}

function txn(over: Partial<PaystackTransaction>): PaystackTransaction {
  return {
    reference: 'vv-test',
    status: 'success',
    currency: 'USD',
    amount: 29_900,
    channel: 'card',
    ...over,
  };
}

describe('createOrder', () => {
  it('prices from the plan catalogue and locks a display conversion', async () => {
    const repo = new FakeRepo();
    const created = await service(
      repo,
      fakePaystack(async () => txn({})),
    ).createOrder({
      planCode: 'starter_scan',
      email: 'buyer@example.test',
      displayCurrency: 'KES',
    });
    expect(created.order.usd_cents).toBe(29_900);
    expect(created.order.display_currency).toBe('KES');
    expect(created.order.rate_local_per_usd).toBe('129.00000000');
    expect(created.order.display_minor).toBe(3_857_100);
    expect(created.authorizationUrl).toContain(created.reference);
  });

  it('rejects an unknown plan', async () => {
    const repo = new FakeRepo();
    await expect(
      service(
        repo,
        fakePaystack(async () => txn({})),
      ).createOrder({
        planCode: 'cyber_range',
        email: 'buyer@example.test',
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('verifyOrder', () => {
  it('fails closed on a forged reference', async () => {
    const repo = new FakeRepo();
    await expect(
      service(
        repo,
        fakePaystack(async () => txn({})),
      ).verifyOrder('vv-forged'),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('rejects a successful-looking transaction whose amount does not match', async () => {
    const repo = new FakeRepo();
    const svc = service(
      repo,
      fakePaystack(async () => txn({ amount: 1 })),
    );
    const created = await svc.createOrder({ planCode: 'starter_scan', email: 'b@example.test' });
    await expect(svc.verifyOrder(created.reference)).rejects.toMatchObject({ status: 409 });
    expect(repo.orders.get(created.reference)?.status).toBe('failed');
  });

  it('rejects a non-USD settlement', async () => {
    const repo = new FakeRepo();
    const svc = service(
      repo,
      fakePaystack(async () => txn({ currency: 'NGN' })),
    );
    const created = await svc.createOrder({ planCode: 'starter_scan', email: 'b@example.test' });
    await expect(svc.verifyOrder(created.reference)).rejects.toMatchObject({ status: 409 });
  });

  it('pays once: the second verify is idempotent', async () => {
    const repo = new FakeRepo();
    const svc = service(
      repo,
      fakePaystack(async () => txn({})),
    );
    const created = await svc.createOrder({ planCode: 'starter_scan', email: 'b@example.test' });
    const first = await svc.verifyOrder(created.reference);
    const second = await svc.verifyOrder(created.reference);
    expect(first.transitioned).toBe(true);
    expect(second.transitioned).toBe(false);
    expect(repo.orders.get(created.reference)?.status).toBe('paid');
  });
});

describe('fulfillFromWebhook', () => {
  it('returns null for references that are not guest orders', async () => {
    const repo = new FakeRepo();
    const result = await service(
      repo,
      fakePaystack(async () => txn({})),
    ).fulfillFromWebhook('vv-unknown', 29_900, 'USD');
    expect(result).toBeNull();
  });

  it('rejects a webhook whose numbers disagree with the order', async () => {
    const repo = new FakeRepo();
    const svc = service(
      repo,
      fakePaystack(async () => txn({})),
    );
    const created = await svc.createOrder({ planCode: 'starter_scan', email: 'b@example.test' });
    const result = await svc.fulfillFromWebhook(created.reference, 100, 'USD');
    expect(result?.rejected).toBe(true);
    expect(repo.orders.get(created.reference)?.status).toBe('failed');
  });

  it('fulfils once; a replayed webhook transitions nothing', async () => {
    const repo = new FakeRepo();
    const svc = service(
      repo,
      fakePaystack(async () => txn({})),
    );
    const created = await svc.createOrder({ planCode: 'starter_scan', email: 'b@example.test' });
    const first = await svc.fulfillFromWebhook(created.reference, 29_900, 'USD');
    const replay = await svc.fulfillFromWebhook(created.reference, 29_900, 'USD');
    expect(first?.transitioned).toBe(true);
    expect(replay?.transitioned).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import type { UpdatePaymentMethodBody } from '@vunvault/contracts';
import { HttpError } from '../../../lib/http-error.js';
import { ProviderError } from '../../../providers/error.js';
import type { StripeClient } from '../../../billing/providers/stripe.js';
import type { PaystackClient } from '../../../billing/providers/paystack.js';
import type { BillingRepo, InvoiceRow, PaymentMethodRow } from './repo.js';
import { BillingService, usd } from './service.js';

const ORG_A = 'd1000000-0000-4000-8000-0000000000a1';
const ORG_B = 'd1000000-0000-4000-8000-0000000000b1';
const INVOICE_A = 'd1000000-0000-4000-8000-000000000aa1';
const INVOICE_B = 'd1000000-0000-4000-8000-000000000bb1';

function invoiceRow(orgId: string, id: string, number: string): InvoiceRow & { orgId: string } {
  return {
    orgId,
    id,
    number,
    issuedAt: '2026-09-01T09:00:00.000Z',
    title: 'External attack surface scan',
    detail: null,
    totalUsdCents: 250000,
    paidUsdCents: 0,
    outstandingUsdCents: 250000,
    status: 'pending',
    settlementCurrency: 'USD',
    pdfObjectKey: null,
  };
}

class FakeBillingRepo implements BillingRepo {
  invoices: Array<InvoiceRow & { orgId: string }> = [
    invoiceRow(ORG_A, INVOICE_A, 'VV-INV-2026-0841'),
    invoiceRow(ORG_B, INVOICE_B, 'VV-INV-2026-0842'),
  ];
  organization: NonNullable<Awaited<ReturnType<BillingRepo['getOrganization']>>> = {
    id: ORG_A,
    name: 'Acme Fintech',
    email: 'billing@acmefintech.co.ke',
    industry: null,
    stripeCustomerId: null,
    paystackCustomerCode: null,
  };
  methods: PaymentMethodRow[] = [];
  stripeCustomerId: string | null = null;
  paystackCustomerCode: string | null = null;
  cleared: string[] = [];

  async getOrganization(orgId: string) {
    if (orgId !== ORG_A) return null;
    return {
      ...this.organization,
      stripeCustomerId: this.stripeCustomerId,
      paystackCustomerCode: this.paystackCustomerCode,
    };
  }
  async setStripeCustomerId(_orgId: string, customerId: string) {
    this.stripeCustomerId = customerId;
  }
  async setPaystackCustomerCode(_orgId: string, customerCode: string) {
    this.paystackCustomerCode = customerCode;
  }
  async getSubscription(orgId: string) {
    if (orgId !== ORG_A) return null;
    return {
      id: 'sub-1',
      planName: 'Growth',
      status: 'active',
      billingCycle: 'monthly',
      amountUsdCents: 99900,
      settlementCurrency: 'USD',
      renewsOn: '2026-10-01T00:00:00.000Z',
      description: 'Up to 20 assets, monthly external scanning',
    };
  }
  async getDefaultPaymentMethod(orgId: string) {
    return this.methods.find((method) => method.id === `${orgId}-default`) ?? null;
  }
  async clearDefaultPaymentMethods(orgId: string) {
    const previous = this.methods.filter((method) => method.id === `${orgId}-default`);
    this.cleared.push(...previous.map((method) => method.providerPaymentMethodId));
    this.methods = this.methods.filter((method) => method.id !== `${orgId}-default` || false);
    return previous;
  }
  async insertPaymentMethod(
    orgId: string,
    input: Parameters<BillingRepo['insertPaymentMethod']>[1],
  ) {
    const row: PaymentMethodRow = { id: `${orgId}-default`, ...input };
    this.methods.push(row);
    return row;
  }
  async listInvoices(orgId: string, query: { page: number; pageSize: number; status?: string }) {
    let rows = this.invoices.filter((row) => row.orgId === orgId);
    if (query.status !== undefined) rows = rows.filter((row) => row.status === query.status);
    const start = (query.page - 1) * query.pageSize;
    return { rows: rows.slice(start, start + query.pageSize), total: rows.length };
  }
  async getInvoice(orgId: string, invoiceId: string) {
    return this.invoices.find((row) => row.orgId === orgId && row.id === invoiceId) ?? null;
  }
}

interface StripeCalls {
  customers: Array<{ email: string; name?: string }>;
  attached: string[];
  defaults: Array<{ customerId: string; paymentMethodId: string }>;
  retrieved: string[];
  detached: string[];
  idempotencyKeys: string[];
}

function fakeStripe(options: { fail?: boolean } = {}) {
  const calls: StripeCalls = {
    customers: [],
    attached: [],
    defaults: [],
    retrieved: [],
    detached: [],
    idempotencyKeys: [],
  };
  const client = {
    createCustomer: async (input: { email: string; name?: string; idempotencyKey: string }) => {
      calls.customers.push({ email: input.email, name: input.name });
      calls.idempotencyKeys.push(input.idempotencyKey);
      return { id: 'cus_1' };
    },
    attachPaymentMethod: async (paymentMethodId: string, _customerId: string, key: string) => {
      if (options.fail === true) {
        throw new ProviderError('stripe_402', 'card_declined');
      }
      calls.attached.push(paymentMethodId);
      calls.idempotencyKeys.push(key);
    },
    setDefaultPaymentMethod: async (customerId: string, paymentMethodId: string, key: string) => {
      calls.defaults.push({ customerId, paymentMethodId });
      calls.idempotencyKeys.push(key);
    },
    retrievePaymentMethod: async (paymentMethodId: string) => {
      calls.retrieved.push(paymentMethodId);
      return { brand: 'visa', last4: '4242', expMonth: 9, expYear: 2029 };
    },
    detachPaymentMethod: async (paymentMethodId: string) => {
      calls.detached.push(paymentMethodId);
    },
  } as unknown as StripeClient;
  return { client, calls };
}

function fakePaystack() {
  const verified: string[] = [];
  const client = {
    verifyTransaction: async (reference: string) => {
      verified.push(reference);
      return {
        reference,
        status: 'success',
        amount: 99900,
        currency: 'USD',
        channel: 'card',
        authorization: {
          authorization_code: 'AUTH_xyz',
          card_type: 'mastercard',
          last4: '8899',
          exp_month: '12',
          exp_year: '2028',
        },
      };
    },
  } as unknown as PaystackClient;
  return { client, verified };
}

const BODY: UpdatePaymentMethodBody = {
  provider: 'stripe',
  providerPaymentMethodToken: 'pm_1NxYz2TestToken',
  cardholderName: 'Wanjiru Kamau',
  billingCountry: 'KE',
};

describe('subscription and payment method reads', () => {
  it('returns the subscription with a USD settlement currency', async () => {
    const service = new BillingService({ repo: new FakeBillingRepo() });
    const subscription = await service.subscription(ORG_A);
    expect(subscription).toEqual({
      id: 'sub-1',
      planName: 'Growth',
      status: 'active',
      billingCycle: 'monthly',
      amountUsdCents: 99900,
      settlementCurrency: 'USD',
      renewsOn: '2026-10-01T00:00:00.000Z',
      description: 'Up to 20 assets, monthly external scanning',
    });
  });

  it('answers 404 when there is no subscription or payment method', async () => {
    const service = new BillingService({ repo: new FakeBillingRepo() });
    const noSubscription = await service.subscription(ORG_B).catch((caught: unknown) => caught);
    expect((noSubscription as HttpError).status).toBe(404);
    expect((noSubscription as HttpError).code).toBe('not_found');

    const noMethod = await service.paymentMethod(ORG_A).catch((caught: unknown) => caught);
    expect((noMethod as HttpError).status).toBe(404);
  });
});

describe('invoice scoping', () => {
  it('hides another organisation’s invoice behind a 404', async () => {
    const service = new BillingService({ repo: new FakeBillingRepo() });
    // Org A can read its own invoice.
    expect((await service.invoice(ORG_A, INVOICE_A)).number).toBe('VV-INV-2026-0841');

    const foreign = await service.invoice(ORG_A, INVOICE_B).catch((caught: unknown) => caught);
    expect(foreign).toBeInstanceOf(HttpError);
    expect((foreign as HttpError).status).toBe(404);
    expect((foreign as HttpError).code).toBe('not_found');

    const missing = await service
      .invoice(ORG_A, 'd1000000-0000-4000-8000-000000000fff')
      .catch((caught: unknown) => caught);
    expect(missing).toEqual(foreign);

    // The list is scoped the same way.
    const listed = await service.invoices(ORG_A, { page: 1, pageSize: 20 });
    expect(listed.data.map((invoice) => invoice.number)).toEqual(['VV-INV-2026-0841']);
    expect(listed.total).toBe(1);
    expect(listed.data[0]).toMatchObject({
      settlementCurrency: 'USD',
      pdfAvailable: false,
      outstandingUsdCents: 250000,
    });
  });
});

describe('payment method update', () => {
  it('creates a Stripe customer once, attaches and defaults the token', async () => {
    const repo = new FakeBillingRepo();
    const { client, calls } = fakeStripe();
    const service = new BillingService({
      repo,
      payments: { stripe: client, paystack: fakePaystack().client },
      randomUuid: () => 'idem-fixed',
    });

    const result = await service.updatePaymentMethod(ORG_A, BODY);
    expect(result.view).toEqual({
      id: `${ORG_A}-default`,
      provider: 'stripe',
      brand: 'visa',
      last4: '4242',
      expMonth: 9,
      expYear: 2029,
      cardholderName: 'Wanjiru Kamau',
      billingCountry: 'KE',
    });
    expect(result.brand).toBe('visa');
    expect(result.last4).toBe('4242');

    expect(calls.customers).toEqual([{ email: 'billing@acmefintech.co.ke', name: 'Acme Fintech' }]);
    expect(calls.attached).toEqual(['pm_1NxYz2TestToken']);
    expect(calls.defaults).toEqual([
      { customerId: 'cus_1', paymentMethodId: 'pm_1NxYz2TestToken' },
    ]);
    expect(calls.retrieved).toEqual(['pm_1NxYz2TestToken']);
    expect(repo.stripeCustomerId).toBe('cus_1');

    // Every mutating provider call carried an idempotency key.
    expect(calls.idempotencyKeys).toEqual([
      'cust:idem-fixed',
      'attach:idem-fixed',
      'default:idem-fixed',
    ]);
  });

  it('reuses an existing Stripe customer', async () => {
    const repo = new FakeBillingRepo();
    repo.stripeCustomerId = 'cus_existing';
    const { client, calls } = fakeStripe();
    const service = new BillingService({
      repo,
      payments: { stripe: client, paystack: fakePaystack().client },
    });
    await service.updatePaymentMethod(ORG_A, BODY);
    expect(calls.customers).toHaveLength(0);
    expect(calls.defaults[0]?.customerId).toBe('cus_existing');
  });

  it('stores only the provider payment method id — never the raw token elsewhere', async () => {
    const repo = new FakeBillingRepo();
    const { client } = fakeStripe();
    const service = new BillingService({
      repo,
      payments: { stripe: client, paystack: fakePaystack().client },
    });
    await service.updatePaymentMethod(ORG_A, BODY);

    const stored = repo.methods[0] as PaymentMethodRow;
    expect(stored.providerPaymentMethodId).toBe('pm_1NxYz2TestToken');
    // The stored row carries the id exactly once: brand, last4, expiry, name, country.
    const json = JSON.stringify(stored);
    expect(json.match(/pm_1NxYz2TestToken/g)).toHaveLength(1);
    expect(stored).toEqual({
      id: `${ORG_A}-default`,
      provider: 'stripe',
      providerPaymentMethodId: 'pm_1NxYz2TestToken',
      brand: 'visa',
      last4: '4242',
      expMonth: 9,
      expYear: 2029,
      cardholderName: 'Wanjiru Kamau',
      billingCountry: 'KE',
    });
    // No PAN, no CVC, no expiry beyond month/year.
    expect(json).not.toMatch(/\b\d{13,19}\b/);
    expect(json.toLowerCase()).not.toContain('cvc');
  });

  it('demotes the previous default and detaches it best-effort', async () => {
    const repo = new FakeBillingRepo();
    repo.methods = [
      {
        id: `${ORG_A}-default`,
        provider: 'stripe',
        providerPaymentMethodId: 'pm_old',
        brand: 'visa',
        last4: '1111',
        expMonth: 1,
        expYear: 2027,
        cardholderName: 'Old Card',
        billingCountry: 'KE',
      },
    ];
    const { client, calls } = fakeStripe();
    const service = new BillingService({
      repo,
      payments: { stripe: client, paystack: fakePaystack().client },
    });
    await service.updatePaymentMethod(ORG_A, BODY);

    expect(repo.cleared).toEqual(['pm_old']);
    expect(calls.detached).toEqual(['pm_old']);
    expect(repo.methods.map((method) => method.providerPaymentMethodId)).toEqual([
      'pm_1NxYz2TestToken',
    ]);
  });

  it('maps a provider refusal to 422 payment_method_rejected and stores nothing', async () => {
    const repo = new FakeBillingRepo();
    const { client } = fakeStripe({ fail: true });
    const service = new BillingService({
      repo,
      payments: { stripe: client, paystack: fakePaystack().client },
    });
    const error = await service.updatePaymentMethod(ORG_A, BODY).catch((caught: unknown) => caught);
    expect((error as HttpError).status).toBe(422);
    expect((error as HttpError).code).toBe('payment_method_rejected');
    // The provider's own message is not forwarded.
    expect((error as HttpError).message).not.toContain('card_declined');
    expect(repo.methods).toHaveLength(0);
  });

  it('refuses an account with no organisation', async () => {
    const service = new BillingService({
      repo: new FakeBillingRepo(),
      payments: { stripe: fakeStripe().client, paystack: fakePaystack().client },
    });
    const error = await service.updatePaymentMethod(ORG_B, BODY).catch((caught: unknown) => caught);
    expect((error as HttpError).status).toBe(403);
    expect((error as HttpError).code).toBe('no_org');
  });

  it('stores the Paystack authorisation code the same way', async () => {
    const repo = new FakeBillingRepo();
    const { client, verified } = fakePaystack();
    const service = new BillingService({
      repo,
      payments: { stripe: fakeStripe().client, paystack: client },
    });
    const result = await service.updatePaymentMethod(ORG_A, {
      ...BODY,
      provider: 'paystack',
      providerPaymentMethodToken: 'txn_ref_1',
    });
    expect(verified).toEqual(['txn_ref_1']);
    expect(result.view).toMatchObject({
      provider: 'paystack',
      brand: 'mastercard',
      last4: '8899',
      expMonth: 12,
      expYear: 2028,
    });
    expect(repo.methods[0]?.providerPaymentMethodId).toBe('AUTH_xyz');
    // The transaction reference is not stored.
    expect(JSON.stringify(repo.methods[0])).not.toContain('txn_ref_1');
  });
});

describe('invoice PDF and CSV', () => {
  it('queues a render and reports 202 when no PDF exists yet', async () => {
    const queued: Array<{ kind: string; refId: string }> = [];
    const service = new BillingService({
      repo: new FakeBillingRepo(),
      enqueuePdf: async (job) => {
        queued.push(job);
      },
    });
    const result = await service.invoicePdf(ORG_A, INVOICE_A);
    expect(result).toEqual({ kind: 'generating' });
    expect(queued).toEqual([{ kind: 'invoice', refId: INVOICE_A }]);
  });

  it('streams the rendered file with the invoice number as the filename', async () => {
    const repo = new FakeBillingRepo();
    repo.invoices[0] = {
      ...repo.invoices[0]!,
      pdfObjectKey: 'invoices/2026/0841.pdf',
    };
    const service = new BillingService({
      repo,
      storage: {
        presignPut: async () => ({ url: '', headers: {} }),
        head: async () => null,
        delete: async () => undefined,
        presignGet: async ({ key }) => `https://r2.test/${key}?sig=1`,
        publicUrl: (key) => `https://cdn.test/${key}`,
      },
      fetchImpl: (async () =>
        new Response(Buffer.from('%PDF-1.7 fake'), { status: 200 })) as unknown as typeof fetch,
    });
    const result = await service.invoicePdf(ORG_A, INVOICE_A);
    expect(result.kind).toBe('stream');
    if (result.kind === 'stream') {
      expect(result.filename).toBe('VV-INV-2026-0841.pdf');
      expect(Buffer.from(result.body).toString('utf8')).toContain('%PDF-1.7');
    }
  });

  it('answers 404 for another organisation’s PDF', async () => {
    const service = new BillingService({ repo: new FakeBillingRepo() });
    const error = await service.invoicePdf(ORG_A, INVOICE_B).catch((caught: unknown) => caught);
    expect((error as HttpError).status).toBe(404);
  });

  it('exports every invoice with the fixed header and USD amounts', async () => {
    const repo = new FakeBillingRepo();
    repo.invoices = [
      { ...repo.invoices[0]!, issuedAt: '2026-09-02T09:00:00.000Z' },
      invoiceRow(ORG_A, 'd1000000-0000-4000-8000-000000000aa2', 'VV-INV-2026-0840'),
    ];
    const service = new BillingService({ repo });
    const rows = await service.invoiceCsvRows(ORG_A);
    expect([...BillingService.csvHeader]).toEqual([
      'Order / Invoice ID',
      'Date',
      'Service Description',
      'Status',
      'Amount (USD)',
    ]);
    // Oldest first, whichever order the database returned them in.
    expect(rows.map((row) => row[0])).toEqual(['VV-INV-2026-0840', 'VV-INV-2026-0841']);
    expect(rows[0]?.[4]).toBe('2500.00');
    expect(usd(99900)).toBe('999.00');
  });
});

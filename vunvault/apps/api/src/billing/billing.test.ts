import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { HttpError } from '../lib/http-error';
import { ProviderError } from '../providers/error';
import { LEDGER_RECIPES, LedgerService, assertBalanced, assertPositiveAmounts } from './ledger';
import { InvoiceIssuer, revenueKindFor } from './invoice-issuer';
import { formatInvoiceNumber, nextInvoiceNumber } from './invoice-number';
import { escapeCsvCell, csvDocument, csvRow, INVOICE_CSV_HEADER } from './csv';
import { PaystackClient } from './providers/paystack';
import { StripeClient } from './providers/stripe';

const ORG_ID = 'c1000000-0000-4000-8000-000000000001';
const NOW = new Date('2026-09-24T12:00:00.000Z');

/**
 * A fake driver executor: it records every statement and answers the handful of
 * shapes the ledger and the issuer issue. No database, no network.
 */
class FakeExecutor {
  queries: Array<{ sql: string; params: unknown[] }> = [];
  entries = new Map<string, string>();
  accounts = ['accounts_receivable', 'revenue_services', 'revenue_subscription', 'revenue_academy'];
  counters = new Map<number, number>([[2026, 840]]);
  private sequence = 0;
  /** Ledger entries are numbered separately from invoice rows. */
  private entrySequence = 0;

  /** Satisfies `asExecutor`, which looks for `.unsafe`. */
  get connection(): unknown {
    return { unsafe: this.unsafe };
  }

  unsafe = async <T>(sql: string, params: unknown[] = []): Promise<T> => {
    const text = String(sql).replace(/\s+/g, ' ').trim();
    this.queries.push({ sql: text, params });

    if (text.startsWith('select id::text as id from journal_entries')) {
      const key = params[0] as string;
      const existing = this.entries.get(key);
      return (existing === undefined ? [] : [{ id: existing }]) as T;
    }
    if (text.startsWith('select id::text as id, code from ledger_accounts')) {
      const codes = params[0] as string[];
      return codes
        .filter((code) => this.accounts.includes(code))
        .map((code) => ({ id: `acct-${code}`, code })) as T;
    }
    if (text.startsWith('insert into journal_entries')) {
      this.entrySequence += 1;
      const id = `entry-${this.entrySequence}`;
      this.entries.set(params[6] as string, id);
      return [{ id }] as T;
    }
    if (text.startsWith('insert into ledger_lines')) return [] as T;
    if (text.startsWith('insert into invoice_counters')) {
      const year = params[0] as number;
      const next = (this.counters.get(year) ?? 0) + 1;
      this.counters.set(year, next);
      return [{ last: next }] as T;
    }
    if (text.startsWith('insert into invoices')) {
      this.sequence += 1;
      return [{ id: `inv-${this.sequence}`, number: params[0] as string }] as T;
    }
    if (text.startsWith('insert into invoice_lines')) {
      this.sequence += 1;
      return [{ id: `line-${this.sequence}` }] as T;
    }
    if (text.startsWith('update invoice_lines')) return [] as T;
    throw new Error(`unexpected statement: ${text.slice(0, 80)}`);
  };
}

// ------------------------------------------------------------------- ledger

describe('LedgerService.post', () => {
  it('rejects an entry whose debits and credits do not balance', async () => {
    const fake = new FakeExecutor();
    const ledger = new LedgerService();
    const error = await ledger
      .post(fake.connection, {
        orgId: ORG_ID,
        kind: 'invoice_issued',
        memo: 'Unbalanced',
        idempotencyKey: 'test:unbalanced',
        lines: [
          { accountCode: 'accounts_receivable', direction: 'debit', amountUsdCents: 100000 },
          { accountCode: 'revenue_services', direction: 'credit', amountUsdCents: 99000 },
        ],
      })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(400);
    expect((error as HttpError).code).toBe('validation_failed');
    expect((error as HttpError).details).toEqual([
      { path: ['lines'], message: 'Entry is not balanced: 100000 debit vs 99000 credit' },
    ]);
    // Nothing was written.
    expect(fake.queries.some((query) => query.sql.startsWith('insert into journal_entries'))).toBe(
      false,
    );
  });

  it('rejects zero, negative and fractional amounts', () => {
    for (const amount of [0, -100, 10.5, Number.NaN, Number.MAX_SAFE_INTEGER + 10]) {
      expect(() =>
        assertPositiveAmounts([
          { accountCode: 'accounts_receivable', direction: 'debit', amountUsdCents: amount },
        ]),
      ).toThrow(HttpError);
    }
    expect(() => assertPositiveAmounts([])).toThrow(HttpError);
    expect(() =>
      assertBalanced([
        { accountCode: 'a', direction: 'debit' as const, amountUsdCents: 100 },
        { accountCode: 'b', direction: 'credit' as const, amountUsdCents: 100 },
      ]),
    ).not.toThrow();
  });

  it('posts a balanced entry and returns the new id', async () => {
    const fake = new FakeExecutor();
    const posted = await new LedgerService().post(fake.connection, {
      orgId: ORG_ID,
      kind: 'invoice_issued',
      memo: 'VV-INV-2026-0841 — External scan',
      referenceType: 'invoice',
      referenceId: 'inv-1',
      idempotencyKey: 'inv:inv-1',
      lines: [
        { accountCode: 'accounts_receivable', direction: 'debit', amountUsdCents: 250000 },
        { accountCode: 'revenue_services', direction: 'credit', amountUsdCents: 250000 },
      ],
    });
    expect(posted).toEqual({ entryId: 'entry-1', duplicated: false });
    const lines = fake.queries.filter((query) => query.sql.startsWith('insert into ledger_lines'));
    expect(lines).toHaveLength(2);
    expect(lines[0]?.params).toEqual(['entry-1', 'acct-accounts_receivable', 'debit', 250000]);
    expect(lines[1]?.params).toEqual(['entry-1', 'acct-revenue_services', 'credit', 250000]);
  });

  it('returns the original entry id for a duplicate idempotency key', async () => {
    const fake = new FakeExecutor();
    const ledger = new LedgerService();
    const input = {
      orgId: ORG_ID,
      kind: 'payment_captured',
      memo: 'Stripe capture',
      idempotencyKey: 'pi:pi_123',
      lines: [
        { accountCode: 'accounts_receivable', direction: 'debit' as const, amountUsdCents: 50000 },
        { accountCode: 'revenue_services', direction: 'credit' as const, amountUsdCents: 50000 },
      ],
    };

    const first = await ledger.post(fake.connection, input);
    const second = await ledger.post(fake.connection, input);
    expect(first).toEqual({ entryId: 'entry-1', duplicated: false });
    expect(second).toEqual({ entryId: 'entry-1', duplicated: true });
    // The replay posted no new lines.
    expect(
      fake.queries.filter((query) => query.sql.startsWith('insert into journal_entries')),
    ).toHaveLength(1);
    expect(
      fake.queries.filter((query) => query.sql.startsWith('insert into ledger_lines')),
    ).toHaveLength(2);
  });

  it('refuses an unknown account code', async () => {
    const fake = new FakeExecutor();
    const error = await new LedgerService()
      .post(fake.connection, {
        orgId: ORG_ID,
        kind: 'invoice_issued',
        memo: 'Unknown account',
        idempotencyKey: 'inv:bad-account',
        lines: [
          { accountCode: 'accounts_receivable', direction: 'debit', amountUsdCents: 100 },
          { accountCode: 'revenue_bitcoin', direction: 'credit', amountUsdCents: 100 },
        ],
      })
      .catch((caught: unknown) => caught);
    expect((error as HttpError).code).toBe('unknown_account');
  });

  it('documents the three posting recipes', () => {
    expect(LEDGER_RECIPES.invoice_issued).toEqual({
      debit: 'accounts_receivable',
      creditByKind: {
        service: 'revenue_services',
        subscription: 'revenue_subscription',
        academy: 'revenue_academy',
      },
    });
    expect(LEDGER_RECIPES.payment_captured).toEqual({
      debitByProvider: { stripe: 'cash_stripe_clearing', paystack: 'cash_paystack_clearing' },
      credit: 'accounts_receivable',
    });
    expect(LEDGER_RECIPES.refund).toEqual({
      debit: 'refunds',
      creditByProvider: { stripe: 'cash_stripe_clearing', paystack: 'cash_paystack_clearing' },
    });
  });
});

// ----------------------------------------------------------- invoice numbers

describe('nextInvoiceNumber', () => {
  it('increments the per-year counter', async () => {
    const fake = new FakeExecutor();
    const first = await nextInvoiceNumber(fake.connection, 2026);
    const second = await nextInvoiceNumber(fake.connection, 2026);
    expect(first.formatted).toBe('VV-INV-2026-0841');
    expect(second.formatted).toBe('VV-INV-2026-0842');
    expect(second.counter).toBe(842);
  });

  it('starts a new year at 0001', async () => {
    const fake = new FakeExecutor();
    const first = await nextInvoiceNumber(fake.connection, 2027);
    expect(first).toEqual({ formatted: 'VV-INV-2027-0001', year: 2027, counter: 1 });
    expect(formatInvoiceNumber(2027, 42)).toBe('VV-INV-2027-0042');
  });
});

// ------------------------------------------------------------- invoice issuer

describe('InvoiceIssuer.issue', () => {
  it('writes the invoice, its lines and one balanced ledger entry', async () => {
    const fake = new FakeExecutor();
    const issued = await new InvoiceIssuer().issue(fake.connection, {
      orgId: ORG_ID,
      title: 'External attack surface scan — September 2026',
      detail: 'Two targets, one report',
      lines: [{ description: 'External scan', quantity: 2, unitUsdCents: 125000 }],
      issuedAt: NOW,
    });

    expect(issued.number).toBe('VV-INV-2026-0841');
    expect(issued.totalUsdCents).toBe(250000);
    expect(issued.dueAt).toBe('2026-10-08T12:00:00.000Z'); // 14 days
    expect(issued.ledgerEntryId).toBe('entry-1');
    expect(issued.lineCount).toBe(1);

    const invoiceInsert = fake.queries.find((query) =>
      query.sql.startsWith('insert into invoices'),
    );
    expect(invoiceInsert?.params[2]).toBe('pending');
    expect(invoiceInsert?.params[7]).toBe('USD');

    // The entry debits the receivable and credits service revenue.
    const lines = fake.queries.filter((query) => query.sql.startsWith('insert into ledger_lines'));
    expect(lines.map((line) => line.params[2])).toEqual(['debit', 'credit']);
    expect(lines[0]?.params[1]).toBe('acct-accounts_receivable');
    expect(lines[1]?.params[1]).toBe('acct-revenue_services');
    // …and it is idempotent per invoice.
    const entry = fake.queries.find((query) => query.sql.startsWith('insert into journal_entries'));
    expect(entry?.params[6]).toBe(`inv:${issued.id}`);
    // The lines are linked back to the entry.
    expect(
      fake.queries.filter((query) => query.sql.startsWith('update invoice_lines')).length,
    ).toBe(1);
  });

  it('credits subscription revenue for a plan line and academy revenue for training', () => {
    expect(
      revenueKindFor({
        orgId: ORG_ID,
        title: 't',
        lines: [{ description: 'd', quantity: 1, unitUsdCents: 1, planCode: 'plan_growth' }],
      }),
    ).toBe('subscription');
    expect(
      revenueKindFor({
        orgId: ORG_ID,
        title: 't',
        lines: [{ description: 'd', quantity: 1, unitUsdCents: 1, planCode: 'academy_cissp' }],
      }),
    ).toBe('academy');
    expect(
      revenueKindFor({
        orgId: ORG_ID,
        title: 't',
        lines: [{ description: 'd', quantity: 1, unitUsdCents: 1 }],
      }),
    ).toBe('service');
  });

  it('refuses an invoice with no lines or a bad amount', async () => {
    const issuer = new InvoiceIssuer();
    const empty = await issuer
      .issue(new FakeExecutor().connection, { orgId: ORG_ID, title: 'Empty', lines: [] })
      .catch((caught: unknown) => caught);
    expect((empty as HttpError).code).toBe('validation_failed');

    const zero = await issuer
      .issue(new FakeExecutor().connection, {
        orgId: ORG_ID,
        title: 'Zero',
        lines: [{ description: 'Free', quantity: 1, unitUsdCents: 0 }],
      })
      .catch((caught: unknown) => caught);
    expect((zero as HttpError).details).toEqual([
      { path: ['lines'], message: 'Unit prices are positive whole USD cents' },
    ]);
  });
});

// ------------------------------------------------------------------ providers

interface StubbedFetch {
  fetch: typeof fetch;
  calls: Array<{ url: string; init: RequestInit }>;
}

function stubFetch(response: { status?: number; body?: unknown; text?: string }): StubbedFetch {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const text = response.text ?? JSON.stringify(response.body ?? {});
    return new Response(text, { status: response.status ?? 200 });
  }) as unknown as typeof fetch;
  return { fetch: fetchImpl, calls };
}

describe('StripeClient', () => {
  const SECRET = 'sk_test_123';
  const WEBHOOK_SECRET = 'whsec_test_123';

  it('always sends currency=usd and an Idempotency-Key on a PaymentIntent', async () => {
    const { fetch: fetchImpl, calls } = stubFetch({
      body: { id: 'pi_1', status: 'succeeded', amount: 250000, currency: 'usd' },
    });
    const stripe = new StripeClient({ secretKey: SECRET, fetchImpl });

    const intent = await stripe.createPaymentIntent({
      amountUsdCents: 250000,
      customerId: 'cus_1',
      paymentMethodId: 'pm_1',
      idempotencyKey: 'idem-1',
      metadata: { invoiceId: 'inv-1' },
    });
    expect(intent).toEqual({
      id: 'pi_1',
      status: 'succeeded',
      clientSecret: null,
      amountUsdCents: 250000,
    });

    const call = calls[0];
    expect(call?.url).toBe('https://api.stripe.com/v1/payment_intents');
    const headers = call?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${SECRET}`);
    expect(headers['Idempotency-Key']).toBe('idem-1');
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');

    const form = new URLSearchParams(call?.init.body as string);
    expect(form.get('currency')).toBe('usd');
    expect(form.get('amount')).toBe('250000');
    expect(form.get('confirm')).toBe('true');
    expect(form.get('automatic_payment_methods[enabled]')).toBe('true');
    expect(form.get('automatic_payment_methods[allow_redirects]')).toBe('never');
    expect(form.get('metadata[invoiceId]')).toBe('inv-1');
  });

  it('allows redirects only when a return URL is configured', async () => {
    const { fetch: fetchImpl, calls } = stubFetch({
      body: { id: 'pi_2', status: 'requires_action', amount: 100 },
    });
    const stripe = new StripeClient({ secretKey: SECRET, fetchImpl });
    await stripe.createPaymentIntent({
      amountUsdCents: 100,
      customerId: 'cus_1',
      idempotencyKey: 'idem-2',
      returnUrl: 'https://www.vunvault.test/billing/return',
    });
    const form = new URLSearchParams(calls[0]?.init.body as string);
    expect(form.get('automatic_payment_methods[allow_redirects]')).toBe('always');
    expect(form.get('return_url')).toBe('https://www.vunvault.test/billing/return');
  });

  it('maps card details from a payment method', async () => {
    const { fetch: fetchImpl } = stubFetch({
      body: { card: { brand: 'visa', last4: '4242', exp_month: 9, exp_year: 2029 } },
    });
    const stripe = new StripeClient({ secretKey: SECRET, fetchImpl });
    expect(await stripe.retrievePaymentMethod('pm_1')).toEqual({
      brand: 'visa',
      last4: '4242',
      expMonth: 9,
      expYear: 2029,
    });
  });

  it('marks a 5xx retryable and a 4xx not', async () => {
    const retryable = stubFetch({ status: 503, text: 'unavailable' });
    const stripe = new StripeClient({ secretKey: SECRET, fetchImpl: retryable.fetch });
    const serverError = await stripe
      .retrievePaymentMethod('pm_1')
      .catch((caught: unknown) => caught);
    expect(serverError).toBeInstanceOf(ProviderError);
    expect((serverError as ProviderError).retryable).toBe(true);

    const fatal = stubFetch({ status: 402, text: 'card_declined' });
    const other = new StripeClient({ secretKey: SECRET, fetchImpl: fatal.fetch });
    const clientError = await other
      .retrievePaymentMethod('pm_1')
      .catch((caught: unknown) => caught);
    expect((clientError as ProviderError).retryable).toBe(false);
    expect((clientError as ProviderError).code).toBe('stripe_402');
  });

  describe('verifyWebhook', () => {
    const body = Buffer.from(
      JSON.stringify({
        id: 'evt_1',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_1' } },
      }),
    );
    const timestamp = Math.floor(NOW.getTime() / 1000);
    const sign = (secret: string, at: number, payload: Buffer) =>
      createHmac('sha256', secret)
        .update(`${at}.${payload.toString('utf8')}`)
        .digest('hex');

    it('accepts a correctly signed body', () => {
      const stripe = new StripeClient({ secretKey: SECRET, webhookSecret: WEBHOOK_SECRET });
      const event = stripe.verifyWebhook(
        body,
        `t=${timestamp},v1=${sign(WEBHOOK_SECRET, timestamp, body)}`,
        300,
        NOW,
      );
      expect(event).toMatchObject({ id: 'evt_1', type: 'payment_intent.succeeded' });
    });

    it('rejects a tampered body', () => {
      const stripe = new StripeClient({ secretKey: SECRET, webhookSecret: WEBHOOK_SECRET });
      const tampered = Buffer.from(body.toString('utf8').replace('pi_1', 'pi_2'));
      expect(() =>
        stripe.verifyWebhook(
          tampered,
          `t=${timestamp},v1=${sign(WEBHOOK_SECRET, timestamp, body)}`,
          300,
          NOW,
        ),
      ).toThrow(ProviderError);
    });

    it('rejects a signature made with the wrong secret', () => {
      const stripe = new StripeClient({ secretKey: SECRET, webhookSecret: WEBHOOK_SECRET });
      expect(() =>
        stripe.verifyWebhook(
          body,
          `t=${timestamp},v1=${sign('whsec_other', timestamp, body)}`,
          300,
          NOW,
        ),
      ).toThrow(/signature did not match/);
    });

    it('rejects a timestamp older than the tolerance', () => {
      const stripe = new StripeClient({ secretKey: SECRET, webhookSecret: WEBHOOK_SECRET });
      const old = timestamp - 301;
      const error = (() => {
        try {
          stripe.verifyWebhook(body, `t=${old},v1=${sign(WEBHOOK_SECRET, old, body)}`, 300, NOW);
          return null;
        } catch (caught) {
          return caught as ProviderError;
        }
      })();
      expect(error?.code).toBe('timestamp_outside_tolerance');
      expect(error?.retryable).toBe(false);
    });

    it('rejects a malformed header', () => {
      const stripe = new StripeClient({ secretKey: SECRET, webhookSecret: WEBHOOK_SECRET });
      expect(() => stripe.verifyWebhook(body, 'nonsense', 300, NOW)).toThrow(ProviderError);
      expect(() => stripe.verifyWebhook(body, `t=${timestamp}`, 300, NOW)).toThrow(ProviderError);
    });
  });
});

describe('PaystackClient', () => {
  const SECRET = 'sk_test_paystack';

  it('initializes a transaction in USD minor units', async () => {
    const { fetch: fetchImpl, calls } = stubFetch({
      body: {
        data: {
          authorization_url: 'https://checkout.paystack.com/abc',
          access_code: 'abc',
          reference: 'ref-1',
        },
      },
    });
    const paystack = new PaystackClient({ secretKey: SECRET, fetchImpl });
    const result = await paystack.initializeTransaction({
      email: 'w.kamau@acmefintech.co.ke',
      amountUsdCents: 250000,
      reference: 'ref-1',
      metadata: { invoiceId: 'inv-1' },
    });
    expect(result.authorizationUrl).toBe('https://checkout.paystack.com/abc');

    const call = calls[0];
    expect(call?.url).toBe('https://api.paystack.co/transaction/initialize');
    const headers = call?.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${SECRET}`);
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Idempotency-Key']).toBe('ref-1');
    const payload = JSON.parse(call?.init.body as string) as Record<string, unknown>;
    expect(payload.currency).toBe('USD');
    expect(payload.amount).toBe(250000);
    expect(payload.reference).toBe('ref-1');
  });

  it('verifies a transaction and refunds in cents', async () => {
    const { fetch: fetchImpl, calls } = stubFetch({
      body: {
        data: {
          reference: 'ref-1',
          status: 'success',
          amount: 250000,
          currency: 'USD',
          channel: 'card',
          authorization: {
            authorization_code: 'AUTH_abc',
            card_type: 'visa',
            last4: '4242',
            exp_month: '09',
            exp_year: '2029',
          },
        },
      },
    });
    const paystack = new PaystackClient({ secretKey: SECRET, fetchImpl });
    const verified = await paystack.verifyTransaction('ref-1');
    expect(verified.authorization?.authorization_code).toBe('AUTH_abc');
    expect(calls[0]?.url).toBe('https://api.paystack.co/transaction/verify/ref-1');
    expect((calls[0]?.init.headers as Record<string, string>)['Idempotency-Key']).toBeUndefined();

    const refunded = stubFetch({ body: { data: { id: 'rf_1', status: 'processed' } } });
    const client = new PaystackClient({ secretKey: SECRET, fetchImpl: refunded.fetch });
    expect(await client.refund({ transaction: 'ref-1', amountUsdCents: 100000 })).toEqual({
      id: 'rf_1',
      status: 'processed',
    });
    const refundBody = JSON.parse(refunded.calls[0]?.init.body as string) as Record<
      string,
      unknown
    >;
    expect(refundBody.currency).toBe('USD');
    expect(refundBody.amount).toBe(100000);
  });

  describe('verifyWebhook', () => {
    const body = Buffer.from(
      JSON.stringify({ event: 'charge.success', data: { reference: 'ref-1' } }),
    );
    const sign = (secret: string, payload: Buffer) =>
      createHmac('sha512', secret).update(payload).digest('hex');

    it('accepts a correctly signed body', () => {
      const paystack = new PaystackClient({ secretKey: SECRET });
      expect(paystack.verifyWebhook(body, sign(SECRET, body))).toMatchObject({
        event: 'charge.success',
      });
    });

    it('rejects a tampered body and a wrong secret', () => {
      const paystack = new PaystackClient({ secretKey: SECRET });
      const tampered = Buffer.from(body.toString('utf8').replace('ref-1', 'ref-2'));
      expect(() => paystack.verifyWebhook(tampered, sign(SECRET, body))).toThrow(ProviderError);
      expect(() => paystack.verifyWebhook(body, sign('sk_other', body))).toThrow(
        /signature did not match/,
      );
      expect(() => paystack.verifyWebhook(body, 'nope')).toThrow(ProviderError);
    });
  });
});

// ------------------------------------------------------------------------ csv

describe('CSV writer', () => {
  it('neutralises a formula-injection cell', () => {
    expect(escapeCsvCell('=cmd()')).toBe("'=cmd()");
    expect(escapeCsvCell('+1234')).toBe("'+1234");
    expect(escapeCsvCell('-1234')).toBe("'-1234");
    expect(escapeCsvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    // A neutral value is untouched.
    expect(escapeCsvCell('External scan')).toBe('External scan');
    expect(escapeCsvCell(2500)).toBe('2500');
    expect(escapeCsvCell(null)).toBe('');
  });

  it('quotes cells containing commas, quotes or newlines', () => {
    expect(escapeCsvCell('Scan, external')).toBe('"Scan, external"');
    expect(escapeCsvCell('Say "hi"')).toBe('"Say ""hi"""');
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('writes the invoice header verbatim and terminates every row', () => {
    const csv = csvDocument(
      [...INVOICE_CSV_HEADER],
      [
        ['VV-INV-2026-0841', '2026-09-24', '=cmd()', 'pending', '2500.00'],
        ['VV-INV-2026-0842', '2026-09-25', 'Subscription, monthly', 'paid', '999.00'],
      ],
    );
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Order / Invoice ID,Date,Service Description,Status,Amount (USD)');
    expect(lines[1]).toBe("VV-INV-2026-0841,2026-09-24,'=cmd(),pending,2500.00");
    expect(lines[2]).toBe('VV-INV-2026-0842,2026-09-25,"Subscription, monthly",paid,999.00');
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csvRow([])).toBe('');
  });
});

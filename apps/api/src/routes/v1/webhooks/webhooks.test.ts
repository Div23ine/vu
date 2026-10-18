import { createHmac } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../../../config/env.js';
import errorHandler from '../../../plugins/error-handler.js';
import rawBodyPlugin from '../../../plugins/raw-body.js';
import { StripeClient } from '../../../billing/providers/stripe.js';
import { PaystackClient } from '../../../billing/providers/paystack.js';
import type { PaymentProviders } from '../../../billing/providers/index.js';
import type { LedgerEntryInput, LedgerService } from '../../../billing/ledger.js';
import type { AuditEntryRow } from '../../../audit/repo.js';
import type {
  BillingContactRow,
  EntryBalanceRow,
  InvoiceBalanceRow,
  PaymentsRepo,
  ScanJobStateRow,
  WebhookAttemptRow,
} from '../payments-admin/repo.js';
import webhooksRoutes from './index.js';

/**
 * Provider webhooks.
 *
 * The signatures in this file are computed the way the providers compute them —
 * HMAC-SHA256 over `<t>.<body>` for Stripe, HMAC-SHA512 over the body for
 * Paystack — so the real verification code runs, rather than being stubbed out.
 */

const STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
const PAYSTACK_SECRET = 'sk_test_paystack_secret';

const ORG_A = 'd1000000-0000-4000-8000-0000000000a1';
const INVOICE_A = 'd1000000-0000-4000-8000-00000000aa01';
const ATTEMPT_A = 'a1000000-0000-4000-8000-0000000000a1';
const JOB_A = 'b1000000-0000-4000-8000-0000000000b1';
const INTENT_ID = 'pi_test_captured_1';
const PAYSTACK_REFERENCE = 'c1000000-0000-4000-8000-0000000000ff';

/** $2,499.00 — the only amount these tests ever accept. */
const USD_CENTS = 249_900;

const TEST_ENV: Env = {
  NODE_ENV: 'test',
  PORT: 8080,
  LOG_LEVEL: 'fatal',
  WEB_ORIGIN: 'https://www.vunvault.test',
  COOKIE_DOMAIN: '',
  API_PUBLIC_URL: 'https://api.vunvault.test',
  SECRETS_PROVIDER: 'env',
  SUPABASE_URL: 'https://project.supabase.co',
  WEBAUTHN_RP_ID: 'vunvault.test',
  WEBAUTHN_RP_NAME: 'VUNVAULT',
  R2_ACCOUNT_ID: 'r2-account',
  R2_BUCKET: 'vunvault-media',
  R2_PUBLIC_BASE_URL: 'https://cdn.vunvault.test',
  SENTRY_DSN: undefined,
  OCI_SECRET_MAP: undefined,
};

// --------------------------------------------------------------------- fakes

function attempt(overrides: Partial<WebhookAttemptRow> = {}): WebhookAttemptRow {
  return {
    id: ATTEMPT_A,
    txnCode: 'VX-90241',
    invoiceId: INVOICE_A,
    invoiceNumber: 'VV-INV-2026-0841',
    invoiceStatus: 'pending',
    scanJobId: null,
    orgId: ORG_A,
    provider: 'stripe',
    channel: 'card',
    providerReference: INTENT_ID,
    status: 'requires_action',
    usdCents: USD_CENTS,
    settlementCurrency: 'USD',
    failureCode: null,
    ...overrides,
  };
}

class FakePaymentsRepo implements PaymentsRepo {
  attempts: WebhookAttemptRow[] = [];
  events = new Set<string>();
  processed: string[] = [];
  balances: Record<string, InvoiceBalanceRow> = {};
  invoiceStatus: Record<string, string> = {};
  jobs: Record<string, ScanJobStateRow> = {};
  contacts: BillingContactRow[] = [];
  entries: EntryBalanceRow[] = [];
  captured: Array<{ entryId: string; referenceId: string | null }> = [];
  /** Refund entries, as the ledger would hold them. */
  refunds: Array<{ attemptId: string; amountUsdCents: number }> = [];
  mismatchedInvoices: string[] = [];
  /** Throw from this many calls in, to prove a processing failure rolls back. */
  failOnCall: number | null = null;
  private calls = 0;

  private tick(): void {
    this.calls += 1;
    if (this.failOnCall !== null && this.calls === this.failOnCall) {
      throw new Error('ledger unavailable');
    }
  }

  async recordWebhookEvent(provider: string, eventId: string) {
    const key = `${provider}:${eventId}`;
    if (this.events.has(key)) return false;
    this.events.add(key);
    return true;
  }
  async markEventProcessed(provider: string, eventId: string) {
    this.tick();
    this.processed.push(`${provider}:${eventId}`);
  }
  async findAttemptByProviderReference(provider: string, reference: string) {
    return (
      this.attempts.find(
        (row) => row.provider === provider && row.providerReference === reference,
      ) ?? null
    );
  }
  async findAttemptById(attemptId: string) {
    return this.attempts.find((row) => row.id === attemptId) ?? null;
  }
  async setAttemptStatus(attemptId: string, status: string, failureCode: string | null) {
    const row = this.attempts.find((candidate) => candidate.id === attemptId);
    if (row === undefined) return;
    row.status = status;
    row.failureCode = failureCode;
  }
  async getBalance(invoiceId: string) {
    return (
      this.balances[invoiceId] ?? {
        totalUsdCents: 0,
        paidUsdCents: 0,
        outstandingUsdCents: 0,
      }
    );
  }
  async setInvoiceStatus(invoiceId: string, status: string) {
    this.invoiceStatus[invoiceId] = status;
  }
  async getScanJob(jobId: string) {
    return this.jobs[jobId] ?? null;
  }
  async setJobPaymentStatus(jobId: string, status: string) {
    const job = this.jobs[jobId];
    if (job !== undefined) job.paymentStatus = status;
  }
  async setJobReviewGateState(jobId: string, state: string) {
    const job = this.jobs[jobId];
    if (job !== undefined) job.reviewGateState = state;
  }
  async billingContacts() {
    return this.contacts;
  }
  async refundedUsdCents(attemptId: string) {
    return this.refunds
      .filter((row) => row.attemptId === attemptId)
      .reduce((total, row) => total + row.amountUsdCents, 0);
  }
  async refundCount(attemptId: string) {
    return this.refunds.filter((row) => row.attemptId === attemptId).length;
  }
  async listEntryBalances() {
    return this.entries;
  }
  async listAttemptIds() {
    return this.attempts.map((row) => row.id);
  }
  async listSucceededAttemptIds() {
    return this.attempts.filter((row) => row.status === 'succeeded').map((row) => row.id);
  }
  async listCapturedEntries() {
    return this.captured;
  }
  async listInvoicesWithMismatchedStatus() {
    return this.mismatchedInvoices;
  }
}

interface PostedEntry extends LedgerEntryInput {
  entryId: string;
}

function fakeLedger() {
  const posted: PostedEntry[] = [];
  const ledger = {
    post: async (_tx: unknown, input: LedgerEntryInput) => {
      const duplicated = posted.some((entry) => entry.idempotencyKey === input.idempotencyKey);
      if (!duplicated) posted.push({ ...input, entryId: `entry-${posted.length + 1}` });
      return { entryId: `entry-${posted.length}`, duplicated };
    },
  } satisfies Pick<LedgerService, 'post'>;
  return { ledger, posted };
}

interface AuditRecord {
  eventType: string;
  message: string;
  actorLabel: string;
  actorId: string | null;
  subject: string | null;
  details: Record<string, unknown>;
}

interface Harness {
  app: FastifyInstance;
  repo: FakePaymentsRepo;
  ledger: ReturnType<typeof fakeLedger>['posted'];
  audits: AuditRecord[];
  notifications: Array<{
    channel: string;
    to: string;
    template: string;
    vars: Record<string, string>;
  }>;
  rolledBack: number;
}

function providers(): PaymentProviders {
  return {
    stripe: new StripeClient({ secretKey: 'sk_test_stripe', webhookSecret: STRIPE_WEBHOOK_SECRET }),
    paystack: new PaystackClient({ secretKey: PAYSTACK_SECRET }),
  };
}

async function makeHarness(): Promise<Harness> {
  const repo = new FakePaymentsRepo();
  const { ledger, posted } = fakeLedger();
  const audits: AuditRecord[] = [];
  const notifications: Harness['notifications'] = [];
  const state = { rolledBack: 0 };

  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('env', TEST_ENV);
  app.decorateRequest('clientIp', '');
  app.decorateRequest('requestId', '');

  // A transaction that actually rolls back, so a processing failure can be proven
  // to leave no event row behind (which is what makes the provider retry safe).
  app.decorate('withTx', (async (work: (tx: unknown) => Promise<unknown>) => {
    const eventsBefore = new Set(repo.events);
    const processedBefore = repo.processed.length;
    const attemptsBefore = JSON.stringify(repo.attempts);
    const postedBefore = posted.length;
    const fakeTx = { unsafe: async () => [] };
    try {
      return await work(fakeTx);
    } catch (error) {
      state.rolledBack += 1;
      repo.events = eventsBefore;
      repo.processed.length = processedBefore;
      repo.attempts = JSON.parse(attemptsBefore) as WebhookAttemptRow[];
      posted.length = postedBefore;
      throw error;
    }
  }) as unknown as FastifyInstance['withTx']);

  app.decorate('audit', {
    append: async (_executor: unknown, input: Record<string, unknown>) => {
      const actor = input.actor as { id: string | null; label: string };
      audits.push({
        eventType: String(input.eventType),
        message: String(input.message),
        actorLabel: actor.label,
        actorId: actor.id ?? null,
        subject: (input.subject as string | undefined) ?? null,
        details: (input.details as Record<string, unknown>) ?? {},
      });
      return {
        seq: audits.length,
        id: 'entry-id',
        category: 'administrative',
        eventType: input.eventType,
        severity: 'info',
        sevLevel: null,
        actorId: actor.id,
        actorLabel: actor.label,
        ip: null,
        subject: null,
        message: String(input.message),
        details: {},
        sealedDetails: null,
        nonce: null,
        prevHash: '0'.repeat(64),
        hash: 'a'.repeat(64),
        signature: 'b'.repeat(64),
        keyId: 'v1',
        createdAt: new Date('2026-09-24T12:00:00Z'),
      } as unknown as AuditEntryRow;
    },
    publish: async () => undefined,
  } as unknown as FastifyInstance['audit']);

  app.decorate('payments', providers());
  app.decorate('queues', {
    notify: {
      add: async (_name: string, payload: Harness['notifications'][number]) => {
        notifications.push(payload);
      },
    },
  } as unknown as FastifyInstance['queues']);

  await app.register(rawBodyPlugin);
  await app.register(errorHandler);
  await app.register(
    async (scope) => {
      await scope.register(webhooksRoutes, { repo, ledger });
    },
    { prefix: '/api/v1' },
  );

  return {
    app,
    repo,
    ledger: posted,
    audits,
    notifications,
    get rolledBack() {
      return state.rolledBack;
    },
  };
}

let harness: Harness;

beforeEach(async () => {
  harness = await makeHarness();
});

// ------------------------------------------------------------- signing helpers

function stripeSignature(body: string, secret = STRIPE_WEBHOOK_SECRET, timestamp?: number): string {
  const t = timestamp ?? Math.floor(Date.now() / 1000);
  const signed = `${t}.${body}`;
  const v1 = createHmac('sha256', secret).update(signed).digest('hex');
  return `t=${t},v1=${v1}`;
}

function paystackSignature(body: string, secret = PAYSTACK_SECRET): string {
  return createHmac('sha512', secret).update(body).digest('hex');
}

function stripeEvent(type: string, object: Record<string, unknown>, id = 'evt_stripe_1'): string {
  return JSON.stringify({ id, type, data: { object } });
}

function paystackEvent(type: string, data: Record<string, unknown>): string {
  return JSON.stringify({ event: type, data });
}

async function sendStripe(body: string, signature?: string) {
  return harness.app.inject({
    method: 'POST',
    url: '/api/v1/webhooks/stripe',
    headers: {
      'content-type': 'application/json',
      ...(signature === undefined ? {} : { 'stripe-signature': signature }),
    },
    payload: body,
  });
}

async function sendPaystack(body: string, signature?: string) {
  return harness.app.inject({
    method: 'POST',
    url: '/api/v1/webhooks/paystack',
    headers: {
      'content-type': 'application/json',
      ...(signature === undefined ? {} : { 'x-paystack-signature': signature }),
    },
    payload: body,
  });
}

/** A pending invoice for $2,499.00 with a scan job blocked on payment. */
function seedCaptured(overrides: Partial<WebhookAttemptRow> = {}): void {
  harness.repo.attempts.push(attempt(overrides));
  harness.repo.balances[INVOICE_A] = {
    totalUsdCents: USD_CENTS,
    paidUsdCents: USD_CENTS,
    outstandingUsdCents: 0,
  };
  harness.repo.contacts = [{ userId: 'c1', email: 'billing@acmefintech.co.ke' }];
}

// ------------------------------------------------------------------ signature

describe('webhook signature verification', () => {
  it('rejects an invalid Stripe signature with 401 and audits it', async () => {
    const body = stripeEvent('payment_intent.succeeded', { id: INTENT_ID });
    const response = await sendStripe(body, stripeSignature(body, 'whsec_wrong_secret'));

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: 'bad_signature' });
    expect(response.body).not.toContain('stack');

    const entry = harness.audits.find((audit) => audit.eventType === 'WEBHOOK_SIGNATURE_INVALID');
    expect(entry).toBeDefined();
    expect(entry?.actorLabel).toBe('system');
    expect(entry?.subject).toBe('stripe');
    expect(harness.repo.events.size).toBe(0);
    expect(harness.ledger).toHaveLength(0);
  });

  it('rejects a missing signature header', async () => {
    const response = await sendStripe(stripeEvent('payment_intent.succeeded', { id: INTENT_ID }));
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: 'bad_signature' });
  });

  it('rejects a signature over re-serialised bytes', async () => {
    // The provider signs what it sent. A body that has been parsed and
    // re-stringified — whitespace, key order — must not verify.
    const original =
      '{"id":"evt_1","type":"payment_intent.succeeded","data":{"object":{"id":"pi_x"}}}';
    const reordered =
      '{"type":"payment_intent.succeeded","id":"evt_1","data":{"object":{"id":"pi_x"}}}';
    const response = await sendStripe(reordered, stripeSignature(original));
    expect(response.statusCode).toBe(401);
  });

  it('rejects a Stripe signature that is too old', async () => {
    const body = stripeEvent('payment_intent.succeeded', { id: INTENT_ID });
    const stale = Math.floor(Date.now() / 1000) - 3600;
    const response = await sendStripe(body, stripeSignature(body, STRIPE_WEBHOOK_SECRET, stale));
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: 'bad_signature' });
  });

  it('rejects an invalid Paystack signature and accepts a valid one', async () => {
    const body = paystackEvent('charge.success', {
      reference: PAYSTACK_REFERENCE,
      amount: USD_CENTS,
      currency: 'USD',
    });
    seedCaptured({ provider: 'paystack', providerReference: PAYSTACK_REFERENCE });

    const bad = await sendPaystack(body, paystackSignature(body, 'sk_wrong'));
    expect(bad.statusCode).toBe(401);
    expect(harness.audits.map((audit) => audit.eventType)).toContain('WEBHOOK_SIGNATURE_INVALID');

    const good = await sendPaystack(body, paystackSignature(body));
    expect(good.statusCode).toBe(200);
    expect(good.json()).toEqual({ received: true });
  });
});

// ------------------------------------------------------------------- captured

describe('a captured payment', () => {
  it('pays the invoice, unblocks the scan and posts exactly one ledger entry', async () => {
    seedCaptured({ scanJobId: JOB_A });
    harness.repo.jobs[JOB_A] = {
      id: JOB_A,
      paymentStatus: 'pending',
      reviewGateState: 'blocked_payment',
    };

    const body = stripeEvent('payment_intent.succeeded', {
      id: INTENT_ID,
      amount_received: USD_CENTS,
      currency: 'usd',
      status: 'succeeded',
    });
    const response = await sendStripe(body, stripeSignature(body));

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ received: true });

    expect(harness.repo.attempts[0]?.status).toBe('succeeded');
    expect(harness.repo.invoiceStatus[INVOICE_A]).toBe('paid');
    expect(harness.repo.jobs[JOB_A]).toEqual({
      id: JOB_A,
      paymentStatus: 'paid',
      reviewGateState: 'in_review',
    });

    // Debit the provider's clearing account, credit the receivable. Nothing else.
    expect(harness.ledger).toHaveLength(1);
    const entry = harness.ledger[0] as LedgerEntryInput;
    expect(entry.kind).toBe('payment_captured');
    expect(entry.idempotencyKey).toBe(`pay:${ATTEMPT_A}`);
    expect(entry.referenceType).toBe('payment_attempt');
    expect(entry.referenceId).toBe(ATTEMPT_A);
    expect(entry.lines).toEqual([
      { accountCode: 'cash_stripe_clearing', direction: 'debit', amountUsdCents: USD_CENTS },
      { accountCode: 'accounts_receivable', direction: 'credit', amountUsdCents: USD_CENTS },
    ]);

    const audit = harness.audits.find((row) => row.eventType === 'PAYMENT_CAPTURED');
    expect(audit?.actorLabel).toBe('system');
    expect(audit?.actorId).toBeNull();
    expect(audit?.message).toBe('VV-INV-2026-0841 paid · $2499.00 via stripe');
    expect(audit?.details).toMatchObject({ provider: 'stripe', usdCents: USD_CENTS });

    // The receipt goes out on the notify queue.
    expect(harness.notifications).toHaveLength(1);
    expect(harness.notifications[0]).toMatchObject({
      channel: 'email',
      to: 'billing@acmefintech.co.ke',
      template: 'payment_receipt',
    });
    expect(harness.repo.processed).toEqual(['stripe:evt_stripe_1']);
  });

  it('credits the Paystack clearing account for a Paystack charge', async () => {
    seedCaptured({ provider: 'paystack', providerReference: PAYSTACK_REFERENCE, channel: 'mpesa' });
    const body = paystackEvent('charge.success', {
      reference: PAYSTACK_REFERENCE,
      amount: USD_CENTS,
      currency: 'USD',
    });
    const response = await sendPaystack(body, paystackSignature(body));

    expect(response.statusCode).toBe(200);
    const entry = harness.ledger[0] as LedgerEntryInput;
    expect(entry.lines?.[0]).toMatchObject({
      accountCode: 'cash_paystack_clearing',
      amountUsdCents: USD_CENTS,
    });
    expect(harness.audits.map((audit) => audit.message)).toContain(
      'VV-INV-2026-0841 paid · $2499.00 via paystack',
    );
  });

  it('leaves the invoice open when the balance is not settled', async () => {
    seedCaptured();
    harness.repo.balances[INVOICE_A] = {
      totalUsdCents: 500_000,
      paidUsdCents: USD_CENTS,
      outstandingUsdCents: 250_100,
    };
    const body = stripeEvent('payment_intent.succeeded', {
      id: INTENT_ID,
      amount_received: USD_CENTS,
      currency: 'usd',
    });
    await sendStripe(body, stripeSignature(body));
    expect(harness.repo.invoiceStatus[INVOICE_A]).toBeUndefined();
    expect(harness.ledger).toHaveLength(1);
  });

  it('processes a replayed event id once', async () => {
    seedCaptured();
    const body = stripeEvent('payment_intent.succeeded', {
      id: INTENT_ID,
      amount_received: USD_CENTS,
      currency: 'usd',
    });
    const signature = stripeSignature(body);

    const first = await sendStripe(body, signature);
    const second = await sendStripe(body, signature);
    const third = await sendStripe(body, signature);

    expect([first.statusCode, second.statusCode, third.statusCode]).toEqual([200, 200, 200]);
    expect(second.json()).toEqual({ received: true });
    // One ledger entry, one audit entry, one receipt — however often they retry.
    expect(harness.ledger).toHaveLength(1);
    expect(harness.audits.filter((audit) => audit.eventType === 'PAYMENT_CAPTURED')).toHaveLength(
      1,
    );
    expect(harness.notifications).toHaveLength(1);
    expect(harness.repo.processed).toHaveLength(1);
  });
});

// ------------------------------------------------------------- refused money

describe('an amount or currency the platform did not ask for', () => {
  it('fails the attempt and posts nothing when the amount differs', async () => {
    seedCaptured();
    const body = stripeEvent('payment_intent.succeeded', {
      id: INTENT_ID,
      amount_received: 10_000,
      currency: 'usd',
    });
    const response = await sendStripe(body, stripeSignature(body));

    expect(response.statusCode).toBe(200);
    expect(harness.repo.attempts[0]?.status).toBe('failed');
    expect(harness.repo.attempts[0]?.failureCode).toBe('amount_mismatch');
    expect(harness.ledger).toHaveLength(0);
    expect(harness.repo.invoiceStatus[INVOICE_A]).toBeUndefined();

    const audit = harness.audits.find((row) => row.eventType === 'PAYMENT_FAILED');
    expect(audit?.actorLabel).toBe('system');
    expect(audit?.details).toMatchObject({
      reason: 'amount_mismatch',
      expectedUsdCents: USD_CENTS,
    });
  });

  it('fails the attempt when the currency is not USD', async () => {
    seedCaptured();
    const body = stripeEvent('payment_intent.succeeded', {
      id: INTENT_ID,
      amount_received: USD_CENTS,
      currency: 'kes',
    });
    await sendStripe(body, stripeSignature(body));
    expect(harness.repo.attempts[0]?.status).toBe('failed');
    expect(harness.repo.attempts[0]?.failureCode).toBe('currency_mismatch');
    expect(harness.ledger).toHaveLength(0);
  });

  it('ignores an event for an attempt it has never seen', async () => {
    const body = stripeEvent('payment_intent.succeeded', {
      id: 'pi_unknown',
      amount_received: USD_CENTS,
      currency: 'usd',
    });
    const response = await sendStripe(body, stripeSignature(body));
    expect(response.statusCode).toBe(200);
    expect(harness.ledger).toHaveLength(0);
    expect(harness.audits).toHaveLength(0);
    // Stored, so a replay of it is still a replay.
    expect(harness.repo.events.size).toBe(1);
  });
});

// --------------------------------------------------------- other event types

describe('other provider events', () => {
  it('records a failed charge and tells the billing contacts', async () => {
    seedCaptured();
    const body = stripeEvent('payment_intent.payment_failed', {
      id: INTENT_ID,
      last_payment_error: { code: 'card_declined', message: 'Your card was declined.' },
    });
    const response = await sendStripe(body, stripeSignature(body));

    expect(response.statusCode).toBe(200);
    expect(harness.repo.attempts[0]?.status).toBe('failed');
    expect(harness.repo.attempts[0]?.failureCode).toBe('card_declined');
    expect(harness.ledger).toHaveLength(0);
    expect(harness.notifications[0]).toMatchObject({ template: 'payment_failed' });
    expect(harness.audits.map((audit) => audit.eventType)).toEqual(['PAYMENT_FAILED']);
  });

  it('moves an attempt to requires_action without posting or auditing', async () => {
    seedCaptured();
    const body = stripeEvent('payment_intent.requires_action', { id: INTENT_ID });
    await sendStripe(body, stripeSignature(body));
    expect(harness.repo.attempts[0]?.status).toBe('requires_action');
    expect(harness.ledger).toHaveLength(0);
    expect(harness.audits).toHaveLength(0);
  });

  it('stores and ignores an event type it does not handle', async () => {
    const body = stripeEvent('customer.subscription.deleted', { id: 'sub_1' }, 'evt_ignored');
    const response = await sendStripe(body, stripeSignature(body));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ received: true });
    expect(harness.repo.events.has('stripe:evt_ignored')).toBe(true);
    expect(harness.ledger).toHaveLength(0);
    expect(harness.audits).toHaveLength(0);
  });

  it('answers 500 and rolls the event row back when processing fails', async () => {
    seedCaptured();
    // The balance read happens after the ledger post: fail there.
    harness.repo.failOnCall = 1;
    const body = stripeEvent('payment_intent.succeeded', {
      id: INTENT_ID,
      amount_received: USD_CENTS,
      currency: 'usd',
    });
    const response = await sendStripe(body, stripeSignature(body));

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({ error: 'internal_error' });
    expect(harness.rolledBack).toBe(1);
    // Rolled back means the retry is NOT treated as a replay.
    expect(harness.repo.events.size).toBe(0);
    expect(harness.ledger).toHaveLength(0);
  });
});

// -------------------------------------------------------------------- refunds

describe('a refund the provider reports', () => {
  function seedRefundable(): void {
    seedCaptured();
    harness.repo.refunds = [];
  }

  it('posts a refund entry for one made outside the platform', async () => {
    seedRefundable();
    const body = stripeEvent(
      'charge.refunded',
      {
        id: 'ch_1',
        payment_intent: INTENT_ID,
        amount_refunded: USD_CENTS,
        currency: 'usd',
      },
      'evt_refund_1',
    );
    const response = await sendStripe(body, stripeSignature(body));

    expect(response.statusCode).toBe(200);
    expect(harness.ledger).toHaveLength(1);
    const entry = harness.ledger[0] as LedgerEntryInput;
    expect(entry.kind).toBe('refund');
    expect(entry.idempotencyKey).toBe(`refund:${ATTEMPT_A}:1`);
    expect(entry.lines).toEqual([
      { accountCode: 'refunds', direction: 'debit', amountUsdCents: USD_CENTS },
      { accountCode: 'cash_stripe_clearing', direction: 'credit', amountUsdCents: USD_CENTS },
    ]);
    // Fully refunded: the invoice no longer describes money owed.
    expect(harness.repo.invoiceStatus[INVOICE_A]).toBe('void');
    expect(harness.audits.map((audit) => audit.eventType)).toEqual(['REFUND_ISSUED']);
    expect(harness.audits[0]?.actorLabel).toBe('system');
  });

  it('does nothing when the refund was already issued here', async () => {
    seedRefundable();
    harness.repo.refunds = [{ attemptId: ATTEMPT_A, amountUsdCents: USD_CENTS }];
    const body = stripeEvent(
      'charge.refunded',
      { id: 'ch_1', payment_intent: INTENT_ID, amount_refunded: USD_CENTS, currency: 'usd' },
      'evt_refund_2',
    );
    const response = await sendStripe(body, stripeSignature(body));
    expect(response.statusCode).toBe(200);
    expect(harness.ledger).toHaveLength(0);
    expect(harness.audits).toHaveLength(0);
  });

  it('ignores a reported refund larger than the payment', async () => {
    seedRefundable();
    const body = stripeEvent(
      'charge.refunded',
      { id: 'ch_1', payment_intent: INTENT_ID, amount_refunded: 999_999, currency: 'usd' },
      'evt_refund_3',
    );
    await sendStripe(body, stripeSignature(body));
    expect(harness.ledger).toHaveLength(0);
    expect(harness.repo.invoiceStatus[INVOICE_A]).toBeUndefined();
  });

  it('reconciles a Paystack refund by transaction reference', async () => {
    seedCaptured({ provider: 'paystack', providerReference: PAYSTACK_REFERENCE });
    const body = paystackEvent('refund.processed', {
      transaction: { reference: PAYSTACK_REFERENCE },
      amount: 50_000,
      status: 'refunded',
    });
    const response = await sendPaystack(body, paystackSignature(body));
    expect(response.statusCode).toBe(200);
    const entry = harness.ledger[0] as LedgerEntryInput;
    expect(entry.kind).toBe('refund');
    expect(entry.lines?.[1]).toMatchObject({ accountCode: 'cash_paystack_clearing' });
    // A partial refund leaves the invoice alone.
    expect(harness.repo.invoiceStatus[INVOICE_A]).toBeUndefined();
  });
});

import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Permission, UserRole } from '@vunvault/contracts';
import type { Env } from '../../../config/env';
import errorHandler from '../../../plugins/error-handler';
import type { AuthUser } from '../../../plugins/auth';
import { HttpError } from '../../../lib/http-error';
import { StripeClient } from '../../../billing/providers/stripe';
import { PaystackClient } from '../../../billing/providers/paystack';
import type { PaymentProviders } from '../../../billing/providers/index';
import type { LedgerEntryInput, LedgerService } from '../../../billing/ledger';
import type { AuditEntryRow } from '../../../audit/repo';
import type {
  BillingContactRow,
  EntryBalanceRow,
  InvoiceBalanceRow,
  PaymentsRepo,
  ScanJobStateRow,
  WebhookAttemptRow,
} from './repo';
import paymentsAdminRoutes from './index';

/**
 * Refunds and ledger reconciliation.
 *
 * A refund is bounded by two independent records — the captured attempt and the
 * refund entries already in the ledger — and the tests below attack both bounds.
 */

const ORG_A = 'd1000000-0000-4000-8000-0000000000a1';
const INVOICE_A = 'd1000000-0000-4000-8000-00000000aa01';
const ATTEMPT_A = 'a1000000-0000-4000-8000-0000000000a1';
const STAFF_ID = 'c1000000-0000-4000-8000-0000000000a1';
const INTENT_ID = 'pi_test_captured_1';

/** $2,499.00. */
const USD_CENTS = 249_900;

const REASON = 'Client was charged twice for the same scan window';

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

class FakePaymentsRepo implements PaymentsRepo {
  attempts: WebhookAttemptRow[] = [
    {
      id: ATTEMPT_A,
      txnCode: 'VX-90241',
      invoiceId: INVOICE_A,
      invoiceNumber: 'VV-INV-2026-0841',
      invoiceStatus: 'paid',
      scanJobId: null,
      orgId: ORG_A,
      provider: 'stripe',
      channel: 'card',
      providerReference: INTENT_ID,
      status: 'succeeded',
      usdCents: USD_CENTS,
      settlementCurrency: 'USD',
      failureCode: null,
    },
  ];
  events = new Set<string>();
  processed: string[] = [];
  balances: Record<string, InvoiceBalanceRow> = {};
  invoiceStatus: Record<string, string> = {};
  jobs: Record<string, ScanJobStateRow> = {};
  contacts: BillingContactRow[] = [];
  entries: EntryBalanceRow[] = [];
  captured: Array<{ entryId: string; referenceId: string | null }> = [];
  refunds: Array<{ attemptId: string; amountUsdCents: number }> = [];
  mismatchedInvoices: string[] = [];

  async recordWebhookEvent(provider: string, eventId: string) {
    const key = `${provider}:${eventId}`;
    if (this.events.has(key)) return false;
    this.events.add(key);
    return true;
  }
  async markEventProcessed(provider: string, eventId: string) {
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
    if (row !== undefined) {
      row.status = status;
      row.failureCode = failureCode;
    }
  }
  async getBalance(invoiceId: string) {
    return (
      this.balances[invoiceId] ?? { totalUsdCents: 0, paidUsdCents: 0, outstandingUsdCents: 0 }
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

function fakeLedger() {
  const posted: LedgerEntryInput[] = [];
  const ledger = {
    post: async (_tx: unknown, input: LedgerEntryInput) => {
      const duplicated = posted.some((entry) => entry.idempotencyKey === input.idempotencyKey);
      if (!duplicated) posted.push(input);
      // A posted refund is visible to `refundedUsdCents` from then on.
      if (!duplicated && input.kind === 'refund' && input.referenceId !== null) {
        const debit = input.lines.find((line) => line.direction === 'debit');
        currentRepo?.refunds.push({
          attemptId: String(input.referenceId),
          amountUsdCents: debit?.amountUsdCents ?? 0,
        });
      }
      return { entryId: `entry-${posted.length}`, duplicated };
    },
  } satisfies Pick<LedgerService, 'post'>;
  return { ledger, posted };
}

/** The ledger fake records refunds onto the repo the route is using. */
let currentRepo: FakePaymentsRepo | null = null;

interface HttpCall {
  url: string;
  body: string;
  headers: Record<string, string>;
}

function providerHttp() {
  const calls: HttpCall[] = [];
  const fetchImpl = (async (url: unknown, init?: RequestInit) => {
    const target = String(url);
    calls.push({
      url: target,
      body: typeof init?.body === 'string' ? init.body : '',
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    if (target.endsWith('/refunds')) {
      return jsonResponse(200, { id: 're_test_1', status: 'succeeded' });
    }
    return jsonResponse(200, { status: true, data: { id: 'prf_test_1' } });
  }) as unknown as typeof fetch;

  const payments: PaymentProviders = {
    stripe: new StripeClient({ secretKey: 'sk_test_stripe', fetchImpl }),
    paystack: new PaystackClient({ secretKey: 'sk_test_paystack', fetchImpl }),
  };
  return { payments, calls };
}

function jsonResponse(status: number, payload: unknown): Response {
  const text = JSON.stringify(payload);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    json: async () => payload,
  } as unknown as Response;
}

interface AuditRecord {
  eventType: string;
  message: string;
  actorLabel: string;
  subject: string | null;
  details: Record<string, unknown>;
}

interface Harness {
  app: FastifyInstance;
  repo: FakePaymentsRepo;
  ledger: LedgerEntryInput[];
  audits: AuditRecord[];
  calls: HttpCall[];
  user: { current: AuthUser | null };
}

function staffUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: STAFF_ID,
    email: 'e.reed@vunvault.com',
    role: 'super_admin' as UserRole,
    orgId: null,
    permissions: ['billing:manage'] as Permission[],
    aal: 'aal2',
    sessionId: '20000000-0000-4000-8000-000000000001',
    ...overrides,
  };
}

async function makeHarness(): Promise<Harness> {
  const repo = new FakePaymentsRepo();
  currentRepo = repo;
  const { ledger, posted } = fakeLedger();
  const { payments, calls } = providerHttp();
  const audits: AuditRecord[] = [];
  const user: Harness['user'] = { current: staffUser() };

  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('env', TEST_ENV);
  app.decorateRequest('clientIp', '');
  app.decorateRequest('requestId', '');

  const fakeTx = { unsafe: async () => [] };
  app.decorate('withTx', (async (work: (tx: unknown) => Promise<unknown>) =>
    work(fakeTx)) as unknown as FastifyInstance['withTx']);

  app.decorate('audit', {
    append: async (_executor: unknown, input: Record<string, unknown>) => {
      const actor = input.actor as { id: string | null; label: string };
      audits.push({
        eventType: String(input.eventType),
        message: String(input.message),
        actorLabel: actor.label,
        subject: (input.subject as string | undefined) ?? null,
        details: (input.details as Record<string, unknown>) ?? {},
      });
      return {
        seq: audits.length,
        id: 'entry-id',
        category: 'administrative',
        eventType: input.eventType,
        severity: 'warning',
        sevLevel: 3,
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

  app.decorate('payments', payments);

  // Guards: the real ones have their own tests; these reproduce their contract.
  app.decorate('authenticate', (async (request: FastifyRequest) => {
    if (user.current === null) throw HttpError.unauthorized();
    request.user = user.current;
  }) as unknown as FastifyInstance['authenticate']);
  app.decorate('requireStaff', (async (request: FastifyRequest) => {
    const current = request.user;
    if (current === undefined) throw HttpError.unauthorized();
    const staff: UserRole[] = [
      'super_admin',
      'admin',
      'security_analyst',
      'soc_operator',
      'compliance_auditor',
      'support_engineer',
    ];
    if (!staff.includes(current.role)) throw HttpError.forbidden();
    if (current.aal !== 'aal2') throw new HttpError(403, 'mfa_required');
  }) as unknown as FastifyInstance['requireStaff']);
  app.decorate('requirePermission', ((...required: Permission[]) =>
    async (request: FastifyRequest) => {
      const current = request.user;
      if (current === undefined) throw HttpError.unauthorized();
      const granted = new Set(current.permissions);
      for (const permission of required) {
        if (!granted.has(permission)) throw HttpError.forbidden();
      }
    }) as unknown as FastifyInstance['requirePermission']);

  await app.register(errorHandler);
  await app.register(
    async (scope) => {
      await scope.register(paymentsAdminRoutes, { repo, ledger, payments });
    },
    { prefix: '/api/v1' },
  );

  return { app, repo, ledger: posted, audits, calls, user };
}

let harness: Harness;

beforeEach(async () => {
  harness = await makeHarness();
});

/** The seeded attempt, or a loud failure: every test here depends on it. */
function firstAttempt(): WebhookAttemptRow {
  const row = harness.repo.attempts[0];
  if (row === undefined) throw new Error('the fixture attempt is missing');
  return row;
}

function refund(body: Record<string, unknown> = {}, attemptId = ATTEMPT_A) {
  return harness.app.inject({
    method: 'POST',
    url: `/api/v1/admin/payments/${attemptId}/refund`,
    payload: { reason: REASON, ...body },
  });
}

// -------------------------------------------------------------------- refunds

describe('POST /api/v1/admin/payments/:attemptId/refund', () => {
  it('refunds the whole payment, voids the invoice and audits it', async () => {
    const response = await refund();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: {
        attemptId: ATTEMPT_A,
        refundedUsdCents: USD_CENTS,
        totalRefundedUsdCents: USD_CENTS,
      },
    });

    // The provider was asked for exactly the captured amount, under a key that a
    // retry will reuse.
    const call = harness.calls.find((entry) => entry.url.endsWith('/refunds'));
    expect(call).toBeDefined();
    const fields = new URLSearchParams((call as HttpCall).body);
    expect(fields.get('payment_intent')).toBe(INTENT_ID);
    expect(fields.get('amount')).toBe('249900');
    expect((call as HttpCall).headers['Idempotency-Key']).toBe(`refund:${ATTEMPT_A}:1`);

    // One ledger entry: refunds out, the same clearing account credited back.
    expect(harness.ledger).toHaveLength(1);
    const entry = harness.ledger[0] as LedgerEntryInput;
    expect(entry.kind).toBe('refund');
    expect(entry.idempotencyKey).toBe(`refund:${ATTEMPT_A}:1`);
    expect(entry.createdBy).toBe(STAFF_ID);
    expect(entry.lines).toEqual([
      { accountCode: 'refunds', direction: 'debit', amountUsdCents: USD_CENTS },
      { accountCode: 'cash_stripe_clearing', direction: 'credit', amountUsdCents: USD_CENTS },
    ]);

    // Fully refunded: the invoice is void, not "paid".
    expect(harness.repo.invoiceStatus[INVOICE_A]).toBe('void');

    const audit = harness.audits.find((row) => row.eventType === 'REFUND_ISSUED');
    expect(audit?.message).toBe(`$2499.00 refunded on VV-INV-2026-0841 — ${REASON}`);
    expect(audit?.subject).toBe(ATTEMPT_A);
    expect(audit?.actorLabel).toBe('e.reed');
    expect(audit?.details).toMatchObject({ totalRefundedUsdCents: USD_CENTS });
  });

  it('keeps a partially refunded invoice paid', async () => {
    const response = await refund({ amountUsdCents: 100_000 });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: {
        attemptId: ATTEMPT_A,
        refundedUsdCents: 100_000,
        totalRefundedUsdCents: 100_000,
      },
    });
    expect(harness.repo.invoiceStatus[INVOICE_A]).toBeUndefined();
  });

  it('numbers each refund, so the second one gets its own key', async () => {
    await refund({ amountUsdCents: 100_000 });
    const second = await refund({ amountUsdCents: 50_000 });

    expect(second.statusCode).toBe(200);
    expect((second.json() as { data: { totalRefundedUsdCents: number } }).data).toMatchObject({
      refundedUsdCents: 50_000,
      totalRefundedUsdCents: 150_000,
    });
    expect(harness.ledger.map((entry) => entry.idempotencyKey)).toEqual([
      `refund:${ATTEMPT_A}:1`,
      `refund:${ATTEMPT_A}:2`,
    ]);
    expect(harness.repo.invoiceStatus[INVOICE_A]).toBeUndefined();

    // The remainder voids it.
    const third = await refund({ amountUsdCents: 99_900 });
    expect(third.statusCode).toBe(200);
    expect(harness.repo.invoiceStatus[INVOICE_A]).toBe('void');
  });

  it('refuses a refund above what is left of the payment', async () => {
    harness.repo.refunds = [{ attemptId: ATTEMPT_A, amountUsdCents: 200_000 }];
    const response = await refund({ amountUsdCents: 100_000 });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: 'refund_exceeds_payment' });
    expect(harness.ledger).toHaveLength(0);
    expect(harness.calls).toHaveLength(0);
    expect(harness.audits).toHaveLength(0);
  });

  it('refuses a refund of more than the attempt captured', async () => {
    const response = await refund({ amountUsdCents: USD_CENTS + 1 });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: 'refund_exceeds_payment' });
    expect(harness.ledger).toHaveLength(0);
  });

  it('refuses to refund an attempt that never succeeded', async () => {
    const row = firstAttempt();
    row.status = 'requires_action';
    const response = await refund();
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: 'not_refundable' });
    expect(harness.ledger).toHaveLength(0);
  });

  it('answers 404 for an attempt that does not exist', async () => {
    const response = await refund({}, 'a1000000-0000-4000-8000-0000000000ff');
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: 'not_found' });
  });

  it('requires a reason of at least ten characters', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: `/api/v1/admin/payments/${ATTEMPT_A}/refund`,
      payload: { reason: 'too short' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'validation_failed' });
    expect(harness.ledger).toHaveLength(0);
  });

  it('refuses a client, a staff member on one factor, and an unauthenticated caller', async () => {
    harness.user.current = staffUser({ role: 'client' as UserRole });
    expect((await refund()).statusCode).toBe(403);

    harness.user.current = staffUser({ aal: 'aal1' });
    const oneFactor = await refund();
    expect(oneFactor.statusCode).toBe(403);
    expect(oneFactor.json()).toMatchObject({ error: 'mfa_required' });

    harness.user.current = staffUser({ permissions: ['billing:read'] as Permission[] });
    expect((await refund()).statusCode).toBe(403);

    harness.user.current = null;
    expect((await refund()).statusCode).toBe(401);
    expect(harness.ledger).toHaveLength(0);
  });

  it('routes a Paystack refund to Paystack', async () => {
    const row = firstAttempt();
    row.provider = 'paystack';
    row.providerReference = 'paystack_ref_1';
    const response = await refund({ amountUsdCents: 25_000 });

    expect(response.statusCode).toBe(200);
    const call = harness.calls.find((entry) => entry.url.endsWith('/refund'));
    expect(call).toBeDefined();
    expect(JSON.parse((call as HttpCall).body)).toEqual({
      transaction: 'paystack_ref_1',
      amount: 25_000,
      currency: 'USD',
    });
    expect((harness.ledger[0] as LedgerEntryInput).lines?.[1]).toMatchObject({
      accountCode: 'cash_paystack_clearing',
    });
  });
});

// ------------------------------------------------------------- reconciliation

describe('POST /api/v1/admin/payments/reconcile', () => {
  it('reports an unbalanced entry, a missing capture, an orphan capture and a bad status', async () => {
    harness.repo.entries = [
      { id: 'entry-balanced', kind: 'payment_captured', debit: USD_CENTS, credit: USD_CENTS },
      { id: 'entry-unbalanced', kind: 'invoice_issued', debit: 100_000, credit: 99_000 },
    ];
    // The succeeded attempt has no capture entry; the capture entry points at an
    // attempt that no longer exists.
    harness.repo.captured = [{ entryId: 'entry-orphan', referenceId: null }];
    harness.repo.mismatchedInvoices = [INVOICE_A];

    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/admin/payments/reconcile',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      data: {
        checkedEntries: number;
        unbalancedEntries: string[];
        attemptsWithoutEntry: string[];
        entriesWithoutAttempt: string[];
        invoicesWithMismatchedStatus: string[];
        ranAt: string;
      };
    };
    expect(body.data.checkedEntries).toBe(2);
    expect(body.data.unbalancedEntries).toEqual(['entry-unbalanced']);
    expect(body.data.attemptsWithoutEntry).toEqual([ATTEMPT_A]);
    expect(body.data.entriesWithoutAttempt).toEqual(['entry-orphan']);
    expect(body.data.invoicesWithMismatchedStatus).toEqual([INVOICE_A]);
    expect(new Date(body.data.ranAt).toISOString()).toBe(body.data.ranAt);
  });

  it('reports a clean ledger as clean', async () => {
    harness.repo.entries = [
      { id: 'entry-1', kind: 'payment_captured', debit: USD_CENTS, credit: USD_CENTS },
    ];
    harness.repo.captured = [{ entryId: 'entry-1', referenceId: ATTEMPT_A }];

    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/admin/payments/reconcile',
    });
    expect(response.json()).toMatchObject({
      data: {
        checkedEntries: 1,
        unbalancedEntries: [],
        attemptsWithoutEntry: [],
        entriesWithoutAttempt: [],
        invoicesWithMismatchedStatus: [],
      },
    });
  });

  it('is read-only: no ledger entry, no audit entry, no provider call', async () => {
    await harness.app.inject({ method: 'POST', url: '/api/v1/admin/payments/reconcile' });
    expect(harness.ledger).toHaveLength(0);
    expect(harness.audits).toHaveLength(0);
    expect(harness.calls).toHaveLength(0);
  });

  it('is staff-only, like the refund', async () => {
    harness.user.current = staffUser({ role: 'client' as UserRole });
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/admin/payments/reconcile',
    });
    expect(response.statusCode).toBe(403);
  });
});

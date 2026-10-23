import { readFileSync } from 'node:fs';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Permission, UserRole } from '@vunvault/contracts';
import { MPESA_PROVIDER_MESSAGE } from '@vunvault/contracts';
import type { Env } from '../../../config/env';
import { resolveFxConfig } from '../../../config/env';
import errorHandler from '../../../plugins/error-handler';
import type { AuthUser } from '../../../plugins/auth';
import { HttpError } from '../../../lib/http-error';
import { StripeClient } from '../../../billing/providers/stripe';
import { PaystackClient } from '../../../billing/providers/paystack';
import type { PaymentProviders } from '../../../billing/providers/index';
import { HttpFxRateSource, type FxCache, type FxRateSource } from '../../../billing/fx-rates';
import type { AuditEntryRow } from '../../../audit/repo';
import { CheckoutService, FxService } from './service';
import checkoutRoutes from './index';
import type {
  CheckoutInvoiceRow,
  CheckoutOrganizationRow,
  CheckoutRepo,
  FxQuoteRow,
  NewFxQuote,
  NewPaymentAttempt,
  PaymentAttemptRow,
} from './repo';

/**
 * FX quotes and USD checkout.
 *
 * The assertions that matter are the money ones: the amount a provider is asked
 * for is the invoice's outstanding USD cents and nothing else, whatever display
 * currency the client was shown. Everything runs on in-memory fakes — no database,
 * no Redis, no network.
 */

const ORG_A = 'd1000000-0000-4000-8000-0000000000a1';
const ORG_B = 'd1000000-0000-4000-8000-0000000000b1';
const USER_A = 'c1000000-0000-4000-8000-0000000000a1';
const INVOICE_A = 'd1000000-0000-4000-8000-00000000aa01';
const INVOICE_B = 'd1000000-0000-4000-8000-00000000bb01';
const INVOICE_SETTLED = 'd1000000-0000-4000-8000-00000000cc01';
const QUOTE_A = 'f1000000-0000-4000-8000-0000000000a1';
const ATTEMPT_A = 'a1000000-0000-4000-8000-0000000000a1';
const IDEMPOTENCY_KEY = 'idem-0000000000000001';

/** $2,499.00 — the amount every provider call in this file must ask for. */
const OUTSTANDING_USD_CENTS = 249_900;

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
  FX_API_URL: 'https://fx.vunvault.test/latest/USD',
  FX_QUOTE_TTL_SECONDS: 900,
};

const RATES: Record<string, string> = {
  USD: '1.00000000',
  KES: '129.50000000',
  NGN: '1599.50000000',
  GHS: '15.60000000',
  ZAR: '15.42000000',
};

// --------------------------------------------------------------------- fakes

function invoice(
  orgId: string,
  id: string,
  number: string,
  status: string,
  outstandingUsdCents: number,
): CheckoutInvoiceRow {
  return {
    id,
    orgId,
    number,
    title: 'External attack surface scan',
    status,
    outstandingUsdCents,
  };
}

class FakeCheckoutRepo implements CheckoutRepo {
  invoices: CheckoutInvoiceRow[] = [
    invoice(ORG_A, INVOICE_A, 'VV-INV-2026-0841', 'pending', OUTSTANDING_USD_CENTS),
    invoice(ORG_A, INVOICE_SETTLED, 'VV-INV-2026-0840', 'paid', 0),
    invoice(ORG_B, INVOICE_B, 'VV-INV-2026-0842', 'pending', OUTSTANDING_USD_CENTS),
  ];
  organizations: CheckoutOrganizationRow[] = [
    {
      id: ORG_A,
      name: 'Acme Fintech',
      email: 'billing@acmefintech.co.ke',
      stripeCustomerId: 'cus_test_a',
      paystackCustomerCode: null,
    },
    {
      id: ORG_B,
      name: 'Zenith Bank',
      email: 'billing@zenith.test',
      stripeCustomerId: null,
      paystackCustomerCode: null,
    },
  ];
  defaultMethods: Array<{ orgId: string; provider: string; token: string }> = [
    { orgId: ORG_A, provider: 'stripe', token: 'pm_default_a' },
  ];
  quotes: FxQuoteRow[] = [];
  attempts: PaymentAttemptRow[] = [];
  /** Every mutating call, in order. The ledger must never appear in this list. */
  writes: string[] = [];
  txnSequence = 90_241;
  /** Set to a key to make that insert lose a race with a concurrent checkout. */
  uniqueViolationFor: string | null = null;

  async getInvoice(orgId: string, invoiceId: string) {
    return this.invoices.find((row) => row.orgId === orgId && row.id === invoiceId) ?? null;
  }

  async getOrganization(orgId: string) {
    return this.organizations.find((row) => row.id === orgId) ?? null;
  }

  async setStripeCustomerId(orgId: string, customerId: string) {
    this.writes.push('setStripeCustomerId');
    const row = this.organizations.find((org) => org.id === orgId);
    if (row !== undefined) row.stripeCustomerId = customerId;
  }

  async getDefaultPaymentMethodId(orgId: string, provider: string) {
    return (
      this.defaultMethods.find((row) => row.orgId === orgId && row.provider === provider)?.token ??
      null
    );
  }

  async insertFxQuote(input: NewFxQuote): Promise<FxQuoteRow> {
    this.writes.push('insertFxQuote');
    const row: FxQuoteRow = {
      id: input.id,
      orgId: input.orgId,
      invoiceId: input.invoiceId,
      displayCurrency: input.displayCurrency,
      rateLocalPerUsd: input.rateLocalPerUsd,
      usdCents: input.usdCents,
      localMinor: input.localMinor,
      lockedAt: input.lockedAt.toISOString(),
      expiresAt: input.expiresAt.toISOString(),
      consumedAt: null,
    };
    this.quotes.push(row);
    return row;
  }

  async getFxQuote(orgId: string, quoteId: string) {
    return this.quotes.find((row) => row.orgId === orgId && row.id === quoteId) ?? null;
  }

  async consumeFxQuote(quoteId: string, at: Date) {
    const row = this.quotes.find((quote) => quote.id === quoteId);
    if (row === undefined || row.consumedAt !== null) return false;
    this.writes.push('consumeFxQuote');
    row.consumedAt = at.toISOString();
    return true;
  }

  async findAttemptByIdempotencyKey(orgId: string, idempotencyKey: string) {
    const invoiceIds = new Set(
      this.invoices.filter((row) => row.orgId === orgId).map((row) => row.id),
    );
    return (
      this.attempts.find(
        (row) => row.idempotencyKey === idempotencyKey && invoiceIds.has(row.invoiceId),
      ) ?? null
    );
  }

  async insertPaymentAttempt(input: NewPaymentAttempt): Promise<PaymentAttemptRow> {
    if (this.uniqueViolationFor === input.idempotencyKey) {
      throw { code: '23505', message: 'duplicate key value violates unique constraint' };
    }
    this.writes.push('insertPaymentAttempt');
    const row: PaymentAttemptRow = {
      id: input.id,
      txnCode: `VX-${this.txnSequence++}`,
      invoiceId: input.invoiceId,
      fxQuoteId: input.fxQuoteId,
      provider: input.provider,
      channel: input.channel,
      providerReference: input.providerReference,
      status: input.status,
      usdCents: input.usdCents,
      // Written as a literal in the INSERT: no parameter can ask for another.
      settlementCurrency: 'USD',
      idempotencyKey: input.idempotencyKey,
    };
    this.attempts.push(row);
    return row;
  }
}

const STATIC_RATES: FxRateSource = {
  getRate: async (currency) => {
    const rate = RATES[currency];
    if (rate === undefined) throw new Error(`no rate for ${currency}`);
    return rate;
  },
};

const UNREACHABLE: FxRateSource = {
  getRate: async () => {
    throw new HttpError(502, 'fx_unavailable', 'Exchange rates are temporarily unavailable');
  },
};

interface HttpCall {
  url: string;
  body: string;
  headers: Record<string, string>;
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

/** A `fetch` that always fails the way a timeout does. */
const DOWN_FETCH = (async () => {
  throw Object.assign(new Error('network down'), { name: 'AbortError' });
}) as unknown as typeof fetch;

interface ProviderHttpOptions {
  /** The Stripe PaymentIntent status to answer with. */
  stripeStatus?: string;
  /** A refusal to answer charge calls with, for the channel/currency test. */
  chargeFailure?: { status: number; payload: unknown };
}

function providerHttp(options: ProviderHttpOptions = {}) {
  const calls: HttpCall[] = [];
  const fetchImpl = (async (url: unknown, init?: RequestInit) => {
    const target = String(url);
    calls.push({
      url: target,
      body: typeof init?.body === 'string' ? init.body : '',
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    const isCharge = target.includes('/payment_intents') || target.includes('/transaction/');
    if (options.chargeFailure !== undefined && isCharge) {
      return jsonResponse(options.chargeFailure.status, options.chargeFailure.payload);
    }
    if (target.endsWith('/customers')) return jsonResponse(200, { id: 'cus_created_1' });
    if (target.includes('/payment_intents')) {
      return jsonResponse(200, {
        id: 'pi_test_1',
        status: options.stripeStatus ?? 'requires_action',
        client_secret: 'pi_test_1_secret_9xY',
        amount: OUTSTANDING_USD_CENTS,
        currency: 'usd',
      });
    }
    if (target.includes('/transaction/initialize')) {
      const sent = JSON.parse(calls.at(-1)?.body ?? '{}') as { reference?: string };
      return jsonResponse(200, {
        status: true,
        message: 'Authorization URL created',
        data: {
          authorization_url: 'https://checkout.paystack.test/pay/abc123',
          access_code: 'abc123',
          // Paystack echoes the reference we sent: the attempt id.
          reference: sent.reference ?? '',
        },
      });
    }
    return jsonResponse(404, { error: 'not found' });
  }) as unknown as typeof fetch;

  const payments: PaymentProviders = {
    stripe: new StripeClient({ secretKey: 'sk_test_fake', fetchImpl }),
    paystack: new PaystackClient({ secretKey: 'sk_test_fake', fetchImpl }),
  };
  return { payments, calls };
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
  repo: FakeCheckoutRepo;
  payments: PaymentProviders;
  audits: AuditRecord[];
  calls: HttpCall[];
  /** Decorated so that wiring a ledger into checkout later trips this test. */
  ledger: { post: (...args: unknown[]) => Promise<unknown>; calls: number };
  user: { current: AuthUser | null };
}

interface HarnessOptions extends ProviderHttpOptions {
  rates?: FxRateSource;
}

function testUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: USER_A,
    email: 'billing@acmefintech.co.ke',
    role: 'client' as UserRole,
    orgId: ORG_A,
    permissions: ['billing:manage'] as Permission[],
    aal: 'aal1',
    sessionId: '20000000-0000-4000-8000-000000000001',
    ...overrides,
  };
}

async function makeHarness(options: HarnessOptions = {}): Promise<Harness> {
  const repo = new FakeCheckoutRepo();
  const audits: AuditRecord[] = [];
  const { payments, calls } = providerHttp(options);
  const ledger = {
    calls: 0,
    post: async (..._args: unknown[]) => {
      ledger.calls += 1;
      return { entryId: 'entry-1', duplicated: false };
    },
  };
  const user: Harness['user'] = { current: testUser() };

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

  app.decorate('ledger', ledger);

  // Guards: the real ones are covered by the auth plugin's own tests.
  app.decorate('authenticate', (async (request: FastifyRequest) => {
    if (user.current === null) throw HttpError.unauthorized();
    request.user = user.current;
  }) as unknown as FastifyInstance['authenticate']);
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
  // Mirrors production: `fastify-plugin` skips encapsulation, so the prefix has to
  // come from the enclosing scope exactly as `routes/v1/index.ts` does.
  await app.register(
    async (scope) => {
      await scope.register(checkoutRoutes, {
        repo,
        rates: options.rates ?? STATIC_RATES,
        payments,
      });
    },
    { prefix: '/api/v1' },
  );

  return { app, repo, payments, audits, calls, ledger, user };
}

let harness: Harness;

beforeEach(async () => {
  harness = await makeHarness();
});

function quoteBody(overrides: Record<string, unknown> = {}) {
  return { invoiceId: INVOICE_A, displayCurrency: 'KES', ...overrides };
}

function checkoutBody(overrides: Record<string, unknown> = {}) {
  return {
    invoiceId: INVOICE_A,
    provider: 'stripe',
    channel: 'card',
    idempotencyKey: IDEMPOTENCY_KEY,
    ...overrides,
  };
}

/** A locked quote row, seeded straight into the repo for the checkout tests. */
function seedQuote(overrides: Partial<FxQuoteRow> = {}): FxQuoteRow {
  const row: FxQuoteRow = {
    id: QUOTE_A,
    orgId: ORG_A,
    invoiceId: INVOICE_A,
    displayCurrency: 'KES',
    rateLocalPerUsd: '129.50000000',
    usdCents: OUTSTANDING_USD_CENTS,
    localMinor: 32_362_050,
    lockedAt: '2026-10-06T09:00:00.000Z',
    // Far in the future: individual tests overwrite it to expire the quote.
    expiresAt: '2099-10-06T09:15:00.000Z',
    consumedAt: null,
    ...overrides,
  };
  harness.repo.quotes.push(row);
  return row;
}

async function postQuote(target: Harness = harness, body: Record<string, unknown> = {}) {
  return target.app.inject({
    method: 'POST',
    url: '/api/v1/billing/fx-quotes',
    payload: quoteBody(body),
  });
}

async function postCheckout(target: Harness = harness, body: Record<string, unknown> = {}) {
  return target.app.inject({
    method: 'POST',
    url: '/api/v1/billing/checkout',
    payload: checkoutBody(body),
  });
}

/** The call in which Stripe was asked to charge. Throws when it never happened. */
function stripeChargeCall(target: Harness = harness): HttpCall {
  const call = target.calls.find((entry) => entry.url.includes('/payment_intents'));
  if (call === undefined) throw new Error('Stripe was never asked to charge');
  return call;
}

function stripeField(call: HttpCall, field: string): string | null {
  return new URLSearchParams(call.body).get(field);
}

function paystackInitializeCall(target: Harness = harness): HttpCall {
  const call = target.calls.find((entry) => entry.url.includes('/transaction/initialize'));
  if (call === undefined) throw new Error('Paystack was never asked to initialise a transaction');
  return call;
}

// ---------------------------------------------------------------- fx quotes

describe('POST /api/v1/billing/fx-quotes', () => {
  it('locks a display rate for fifteen minutes and still settles in USD', async () => {
    const response = await postQuote();

    expect(response.statusCode).toBe(201);
    const body = response.json() as {
      data: {
        invoiceId: string;
        displayCurrency: string;
        rateLocalPerUsd: string;
        usdCents: number;
        localMinor: number;
        lockedAt: string;
        expiresAt: string;
        settlementCurrency: string;
      };
    };
    expect(body.data).toMatchObject({
      invoiceId: INVOICE_A,
      displayCurrency: 'KES',
      rateLocalPerUsd: '129.50000000',
      usdCents: OUTSTANDING_USD_CENTS,
      // $2,499.00 at 129.50 → KES 323,620.50, display only.
      localMinor: 32_362_050,
      settlementCurrency: 'USD',
    });
    expect(new Date(body.data.expiresAt).getTime() - new Date(body.data.lockedAt).getTime()).toBe(
      900_000,
    );

    expect(harness.repo.quotes).toHaveLength(1);
    expect(harness.repo.writes).toEqual(['insertFxQuote']);
    const entry = harness.audits.find((audit) => audit.eventType === 'FX_QUOTE_LOCKED');
    expect(entry).toBeDefined();
    expect(entry?.subject).toBe(INVOICE_A);
    expect(entry?.details).toMatchObject({
      displayCurrency: 'KES',
      rateLocalPerUsd: '129.50000000',
      usdCents: OUTSTANDING_USD_CENTS,
    });
  });

  it('quotes every display currency without changing the USD amount', async () => {
    const expected: Record<string, number> = {
      USD: OUTSTANDING_USD_CENTS,
      KES: 32_362_050,
      NGN: 399_715_050,
      GHS: 3_898_440,
      ZAR: 3_853_458,
    };
    for (const [displayCurrency, localMinor] of Object.entries(expected)) {
      const response = await postQuote(harness, { displayCurrency });
      expect(response.statusCode, displayCurrency).toBe(201);
      const body = response.json() as { data: { localMinor: number; usdCents: number } };
      expect(body.data.localMinor, displayCurrency).toBe(localMinor);
      expect(body.data.usdCents, displayCurrency).toBe(OUTSTANDING_USD_CENTS);
    }
  });

  it('refuses an invoice with nothing outstanding', async () => {
    const response = await postQuote(harness, { invoiceId: INVOICE_SETTLED });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'already_paid' });
    expect(harness.repo.quotes).toHaveLength(0);
  });

  it('hides another organisation’s invoice behind the same 404 as a random id', async () => {
    const foreign = await postQuote(harness, { invoiceId: INVOICE_B });
    const missing = await postQuote(harness, { invoiceId: 'd1000000-0000-4000-8000-000000000fff' });

    expect(foreign.statusCode).toBe(404);
    expect(foreign.json()).toMatchObject({ error: 'not_found' });
    // Byte-identical: the endpoint cannot be used to probe for invoice ids.
    expect(foreign.body).toBe(missing.body);
    expect(harness.repo.quotes).toHaveLength(0);
  });

  it('rejects a display currency outside the five the portal supports', async () => {
    const response = await postQuote(harness, { displayCurrency: 'BTC' });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'validation_failed' });
  });

  it('answers 422 unsupported_currency when the service is handed one directly', async () => {
    // The contract refuses it first; the service check exists so widening the enum
    // cannot silently reach the rate feed.
    const service = new FxService({ repo: harness.repo, rates: STATIC_RATES });
    const error = await service
      .quote(ORG_A, { invoiceId: INVOICE_A, displayCurrency: 'EUR' as 'KES' })
      .catch((caught: unknown) => caught);
    expect(error).toMatchObject({ status: 422, code: 'unsupported_currency' });
  });

  it('answers 502 fx_unavailable when the feed is down and nothing is cached', async () => {
    const down = await makeHarness({ rates: UNREACHABLE });
    const response = await postQuote(down);
    expect(response.statusCode).toBe(502);
    expect(response.json()).toMatchObject({ error: 'fx_unavailable' });
    expect(down.repo.quotes).toHaveLength(0);
  });

  it('requires billing:manage', async () => {
    harness.user.current = testUser({ permissions: ['billing:read'] as Permission[] });
    const response = await postQuote();
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'forbidden' });
    expect(harness.repo.quotes).toHaveLength(0);
  });

  it('requires a session', async () => {
    harness.user.current = null;
    const response = await postQuote();
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: 'unauthorized' });
  });
});

// ----------------------------------------------------------- the rate source

describe('HttpFxRateSource', () => {
  function memoryCache(): FxCache & { entries: Map<string, { value: string; ttl: number }> } {
    const entries = new Map<string, { value: string; ttl: number }>();
    return {
      entries,
      async get(key) {
        return entries.get(key)?.value ?? null;
      },
      async set(key, value, _mode, seconds) {
        entries.set(key, { value, ttl: seconds });
        return 'OK';
      },
    };
  }

  const FEED_PAYLOAD = { result: 'success', base_code: 'USD', rates: { KES: 129.5, NGN: 1599.5 } };

  function feed(payload: unknown = FEED_PAYLOAD) {
    const calls: string[] = [];
    const fetchImpl = (async (url: unknown) => {
      calls.push(String(url));
      return jsonResponse(200, payload);
    }) as unknown as typeof fetch;
    return { fetchImpl, calls };
  }

  it('caches the whole payload for fifteen minutes and serves the next quote from it', async () => {
    const cache = memoryCache();
    const { fetchImpl, calls } = feed();
    const source = new HttpFxRateSource({ url: 'https://fx.test/latest/USD', cache, fetchImpl });

    expect(await source.getRate('KES')).toBe('129.50000000');
    expect(await source.getRate('NGN')).toBe('1599.50000000');
    expect(await source.getRate('KES')).toBe('129.50000000');

    expect(calls).toHaveLength(1);
    expect(cache.entries.get('fx:latest')?.ttl).toBe(900);
    const cached = JSON.parse(cache.entries.get('fx:latest')?.value ?? '{}') as {
      rates: Record<string, number>;
      fetchedAt: string;
    };
    expect(cached.rates).toMatchObject({ KES: 129.5, NGN: 1599.5 });
    expect(cached.fetchedAt).not.toBe('');
  });

  it('never calls the feed for USD, which is 1.00000000 by definition', async () => {
    const { fetchImpl, calls } = feed();
    const source = new HttpFxRateSource({ url: 'https://fx.test/latest/USD', fetchImpl });
    expect(await source.getRate('USD')).toBe('1.00000000');
    expect(calls).toHaveLength(0);
  });

  it('serves the cached payload when the feed goes away inside the window', async () => {
    const cache = memoryCache();
    const primed = new HttpFxRateSource({
      url: 'https://fx.test/latest/USD',
      cache,
      fetchImpl: feed().fetchImpl,
    });
    await primed.getRate('KES');

    const down = new HttpFxRateSource({
      url: 'https://fx.test/latest/USD',
      cache,
      fetchImpl: DOWN_FETCH,
    });
    expect(await down.getRate('KES')).toBe('129.50000000');
  });

  it('answers 502 fx_unavailable when the feed times out and there is no cache', async () => {
    const source = new HttpFxRateSource({
      url: 'https://fx.test/latest/USD',
      fetchImpl: (async () => {
        throw Object.assign(new Error('timed out'), { name: 'TimeoutError' });
      }) as unknown as typeof fetch,
    });
    expect(await source.getRate('KES').catch((caught: unknown) => caught)).toMatchObject({
      status: 502,
      code: 'fx_unavailable',
    });
  });

  it('refuses a payload with no rates and a 5xx alike', async () => {
    const badResult = new HttpFxRateSource({
      url: 'https://fx.test/latest/USD',
      fetchImpl: (async () => jsonResponse(200, { result: 'error' })) as unknown as typeof fetch,
    });
    expect(await badResult.getRate('KES').catch((caught: unknown) => caught)).toMatchObject({
      status: 502,
      code: 'fx_unavailable',
    });

    const serverError = new HttpFxRateSource({
      url: 'https://fx.test/latest/USD',
      fetchImpl: (async () => jsonResponse(503, {})) as unknown as typeof fetch,
    });
    expect(await serverError.getRate('NGN').catch((caught: unknown) => caught)).toMatchObject({
      status: 502,
      code: 'fx_unavailable',
    });
  });

  it('answers 502 for a currency the feed does not carry', async () => {
    const source = new HttpFxRateSource({
      url: 'https://fx.test/latest/USD',
      fetchImpl: feed({ result: 'success', rates: { KES: 129.5 } }).fetchImpl,
    });
    expect(await source.getRate('GHS').catch((caught: unknown) => caught)).toMatchObject({
      status: 502,
      code: 'fx_unavailable',
    });
  });

  it('resolves its URL and TTL from configuration, with the documented defaults', () => {
    expect(resolveFxConfig(TEST_ENV)).toEqual({
      url: 'https://fx.vunvault.test/latest/USD',
      ttlSeconds: 900,
    });
    expect(
      resolveFxConfig({ ...TEST_ENV, FX_API_URL: undefined, FX_QUOTE_TTL_SECONDS: undefined }),
    ).toEqual({ url: 'https://open.er-api.com/v6/latest/USD', ttlSeconds: 900 });
  });
});

// ------------------------------------------------------------------ checkout

describe('POST /api/v1/billing/checkout', () => {
  it('charges the outstanding USD cents through Stripe, even with a KES quote', async () => {
    const quoted = await postQuote();
    const quoteId = (quoted.json() as { data: { id: string } }).data.id;

    const response = await postCheckout(harness, { fxQuoteId: quoteId });

    expect(response.statusCode).toBe(201);
    const body = response.json() as {
      data: {
        paymentAttemptId: string;
        status: string;
        usdCents: number;
        settlementCurrency: string;
        clientSecret?: string;
      };
    };
    expect(body.data).toMatchObject({
      status: 'requires_action',
      usdCents: OUTSTANDING_USD_CENTS,
      settlementCurrency: 'USD',
      clientSecret: 'pi_test_1_secret_9xY',
    });

    // The provider was asked for USD cents, never for shillings.
    const call = stripeChargeCall();
    expect(stripeField(call, 'currency')).toBe('usd');
    expect(stripeField(call, 'amount')).toBe('249900');
    expect(call.body).not.toContain('32362050');

    // The quote is single-use, and the attempt carries it.
    expect(harness.repo.quotes[0]?.consumedAt).not.toBeNull();
    expect(harness.repo.attempts).toHaveLength(1);
    expect(harness.repo.attempts[0]).toMatchObject({
      usdCents: OUTSTANDING_USD_CENTS,
      settlementCurrency: 'USD',
      fxQuoteId: quoteId,
      providerReference: 'pi_test_1',
    });

    const entry = harness.audits.find((audit) => audit.eventType === 'PAYMENT_ATTEMPT_CREATED');
    expect(entry?.details).toEqual({
      provider: 'stripe',
      channel: 'card',
      usdCents: OUTSTANDING_USD_CENTS,
    });
  });

  it('charges 249900 USD cents for an invoice quoted in NGN', async () => {
    // Definition of done: a quote in NGN for an outstanding $2,499.00 results in a
    // provider call for 249900 USD cents.
    const quoted = await postQuote(harness, { displayCurrency: 'NGN' });
    const quote = (quoted.json() as { data: { id: string; localMinor: number } }).data;
    expect(quote.localMinor).toBe(399_715_050);

    const response = await postCheckout(harness, { fxQuoteId: quote.id });
    expect(response.statusCode).toBe(201);

    const call = stripeChargeCall();
    expect(stripeField(call, 'amount')).toBe('249900');
    expect(stripeField(call, 'currency')).toBe('usd');
    expect(call.body).not.toContain('399715050');
    expect((response.json() as { data: { usdCents: number } }).data.usdCents).toBe(249_900);
  });

  it('charges the outstanding amount when there is no quote at all', async () => {
    const response = await postCheckout();
    expect(response.statusCode).toBe(201);
    expect(stripeField(stripeChargeCall(), 'amount')).toBe('249900');
    expect(harness.repo.quotes).toHaveLength(0);
  });

  it('replays an idempotency key with 200 and creates nothing', async () => {
    const first = await postCheckout();
    const second = await postCheckout();

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    const firstId = (first.json() as { data: { paymentAttemptId: string } }).data.paymentAttemptId;
    const secondId = (second.json() as { data: { paymentAttemptId: string } }).data
      .paymentAttemptId;
    expect(secondId).toBe(firstId);

    expect(harness.repo.attempts).toHaveLength(1);
    expect(harness.calls.filter((call) => call.url.includes('/payment_intents'))).toHaveLength(1);
    expect(
      harness.audits.filter((audit) => audit.eventType === 'PAYMENT_ATTEMPT_CREATED'),
    ).toHaveLength(1);
    // A replay re-issues no client secret: it was never stored.
    expect(
      (second.json() as { data: { clientSecret?: string } }).data.clientSecret,
    ).toBeUndefined();
  });

  it('reports the winner when two checkouts race on one idempotency key', async () => {
    // The pre-check misses (the winner's row is not visible yet), the insert loses
    // on the UNIQUE key, and the retry read reports the attempt that exists.
    const repo = harness.repo;
    const winner: PaymentAttemptRow = {
      id: ATTEMPT_A,
      txnCode: 'VX-90241',
      invoiceId: INVOICE_A,
      fxQuoteId: null,
      provider: 'stripe',
      channel: 'card',
      providerReference: 'pi_winner',
      status: 'requires_action',
      usdCents: OUTSTANDING_USD_CENTS,
      settlementCurrency: 'USD',
      idempotencyKey: IDEMPOTENCY_KEY,
    };
    const realFind = repo.findAttemptByIdempotencyKey.bind(repo);
    let lookups = 0;
    repo.findAttemptByIdempotencyKey = async (orgId, key) => {
      lookups += 1;
      if (lookups === 1) return null;
      return realFind(orgId, key);
    };
    repo.attempts.push(winner);
    repo.uniqueViolationFor = IDEMPOTENCY_KEY;

    const service = new CheckoutService({ repo, payments: harness.payments });
    const outcome = await service.checkout(ORG_A, USER_A, {
      invoiceId: INVOICE_A,
      provider: 'stripe',
      channel: 'card',
      idempotencyKey: IDEMPOTENCY_KEY,
    });

    expect(outcome.data.paymentAttemptId).toBe(ATTEMPT_A);
    expect(repo.attempts).toHaveLength(1);
    expect(repo.attempts[0]?.providerReference).toBe('pi_winner');
  });

  it('rejects an expired quote with 409 quote_expired', async () => {
    // Locked and expired long ago: the fifteen minutes ran out.
    seedQuote({ lockedAt: '2001-01-01T00:00:00.000Z', expiresAt: '2001-01-01T00:15:00.000Z' });
    const response = await postCheckout(harness, { fxQuoteId: QUOTE_A });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'quote_expired' });
    expect(harness.repo.attempts).toHaveLength(0);
    expect(harness.calls.filter((call) => call.url.includes('/payment_intents'))).toHaveLength(0);
  });

  it('refuses to reuse a consumed quote', async () => {
    seedQuote({ consumedAt: '2026-10-06T09:05:00.000Z' });
    const response = await postCheckout(harness, { fxQuoteId: QUOTE_A });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'quote_expired' });
    expect(harness.repo.attempts).toHaveLength(0);
  });

  it('rejects a quote taken before the outstanding amount changed', async () => {
    seedQuote({ usdCents: 250_000, localMinor: 32_375_000 });
    const response = await postCheckout(harness, { fxQuoteId: QUOTE_A });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'amount_changed' });
    expect(harness.repo.attempts).toHaveLength(0);
    // The quote is NOT consumed: the client can take a fresh one for the new amount.
    expect(harness.repo.quotes[0]?.consumedAt).toBeNull();
  });

  it('will not spend a quote that belongs to another invoice or organisation', async () => {
    seedQuote({ invoiceId: INVOICE_B });
    const wrongInvoice = await postCheckout(harness, { fxQuoteId: QUOTE_A });
    expect(wrongInvoice.statusCode).toBe(409);
    expect(wrongInvoice.json()).toMatchObject({ error: 'quote_expired' });

    harness.repo.quotes.length = 0;
    seedQuote({ orgId: ORG_B });
    const foreign = await postCheckout(harness, { fxQuoteId: QUOTE_A });
    expect(foreign.statusCode).toBe(409);
    expect(foreign.json()).toMatchObject({ error: 'quote_expired' });
    expect(harness.repo.attempts).toHaveLength(0);
  });

  it('rejects M-Pesa through Stripe at the contract, before any provider call', async () => {
    const response = await postCheckout(harness, { provider: 'stripe', channel: 'mpesa' });
    expect(response.statusCode).toBe(400);
    const body = response.json() as {
      error: string;
      details: Array<{ path: string[]; message: string }>;
    };
    expect(body.error).toBe('validation_failed');
    expect(body.details[0]?.path).toEqual(['provider']);
    expect(body.details[0]?.message).toBe(MPESA_PROVIDER_MESSAGE);
    expect(harness.calls).toHaveLength(0);
    expect(harness.repo.attempts).toHaveLength(0);
  });

  it('routes M-Pesa through Paystack as mobile_money, still in USD', async () => {
    const response = await postCheckout(harness, {
      provider: 'paystack',
      channel: 'mpesa',
      idempotencyKey: `${IDEMPOTENCY_KEY}-mpesa`,
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as {
      data: { status: string; usdCents: number; settlementCurrency: string; redirectUrl?: string };
    };
    expect(body.data).toMatchObject({
      status: 'created',
      usdCents: OUTSTANDING_USD_CENTS,
      settlementCurrency: 'USD',
      redirectUrl: 'https://checkout.paystack.test/pay/abc123',
    });

    const sent = JSON.parse(paystackInitializeCall().body) as {
      amount: number;
      currency: string;
      channels: string[];
      reference: string;
      email: string;
    };
    expect(sent).toMatchObject({
      amount: OUTSTANDING_USD_CENTS,
      currency: 'USD',
      channels: ['mobile_money'],
      email: 'billing@acmefintech.co.ke',
    });
    // The reference is the attempt id, so a webhook needs no lookup table.
    expect(harness.repo.attempts[0]?.id).toBe(sent.reference);
    expect(harness.repo.attempts[0]?.providerReference).toBe(sent.reference);
  });

  it('maps the other Paystack channels', async () => {
    const channels: Array<[string, string[]]> = [
      ['card', ['card']],
      ['bank_transfer', ['bank_transfer']],
    ];
    for (const [channel, expected] of channels) {
      const local = await makeHarness();
      const response = await local.app.inject({
        method: 'POST',
        url: '/api/v1/billing/checkout',
        payload: checkoutBody({
          provider: 'paystack',
          channel,
          idempotencyKey: `idem-${channel}-0000000000`,
        }),
      });
      expect(response.statusCode, channel).toBe(201);
      const sent = JSON.parse(paystackInitializeCall(local).body) as { channels: string[] };
      expect(sent.channels, channel).toEqual(expected);
    }
  });

  it('turns a provider refusal of the channel/currency pair into 422 channel_unavailable', async () => {
    // If the merchant account cannot present USD for M-Pesa, this is where it shows.
    const local = await makeHarness({
      chargeFailure: {
        status: 400,
        payload: { message: 'Unsupported channel for the requested currency' },
      },
    });
    const response = await local.app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout',
      payload: checkoutBody({ provider: 'paystack', channel: 'mpesa' }),
    });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: 'channel_unavailable' });
    expect(local.repo.attempts).toHaveLength(0);
  });

  it('records a declined card as a failed attempt and never touches the ledger', async () => {
    const local = await makeHarness({
      chargeFailure: { status: 402, payload: { error: { code: 'card_declined' } } },
    });
    const response = await local.app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout',
      payload: checkoutBody(),
    });
    expect(response.statusCode).toBe(201);
    expect((response.json() as { data: { status: string } }).data.status).toBe('failed');
    expect(local.repo.attempts[0]?.status).toBe('failed');
    expect(local.audits.map((audit) => audit.eventType)).toEqual(['PAYMENT_ATTEMPT_CREATED']);
    expect(local.ledger.calls).toBe(0);
  });

  it('maps a synchronous Stripe success without posting anything', async () => {
    const local = await makeHarness({ stripeStatus: 'succeeded' });
    const response = await local.app.inject({
      method: 'POST',
      url: '/api/v1/billing/checkout',
      payload: checkoutBody(),
    });
    expect(response.statusCode).toBe(201);
    expect((response.json() as { data: { status: string } }).data.status).toBe('succeeded');
    // Only the webhook posts `payment_captured` (Task 34).
    expect(local.ledger.calls).toBe(0);
    expect(local.audits.map((audit) => audit.eventType)).toEqual(['PAYMENT_ATTEMPT_CREATED']);
  });

  it('refuses a settled invoice', async () => {
    const response = await postCheckout(harness, { invoiceId: INVOICE_SETTLED });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'already_paid' });
    expect(harness.calls).toHaveLength(0);
  });

  it('refuses an account with no organisation and another org’s invoice', async () => {
    harness.user.current = testUser({ orgId: null });
    const noOrg = await postCheckout();
    expect(noOrg.statusCode).toBe(403);
    expect(noOrg.json()).toMatchObject({ error: 'no_org' });

    harness.user.current = testUser();
    const foreign = await postCheckout(harness, { invoiceId: INVOICE_B });
    expect(foreign.statusCode).toBe(404);
    expect(harness.repo.attempts).toHaveLength(0);
  });

  it('requires an idempotency key of at least sixteen characters', async () => {
    const response = await postCheckout(harness, { idempotencyKey: 'too-short' });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'validation_failed' });
    expect(harness.calls).toHaveLength(0);
  });

  it('creates one Stripe customer per organisation and reuses it', async () => {
    const orgA = harness.repo.organizations.find((org) => org.id === ORG_A);
    if (orgA === undefined) throw new Error('org A is missing from the fixture');
    orgA.stripeCustomerId = null;

    await postCheckout();
    expect(orgA.stripeCustomerId).toBe('cus_created_1');
    expect(harness.repo.writes).toContain('setStripeCustomerId');

    const customerCalls = harness.calls.filter((call) => call.url.endsWith('/customers'));
    expect(customerCalls).toHaveLength(1);
    expect(customerCalls[0]?.headers['Idempotency-Key']).toBe(`cust:${IDEMPOTENCY_KEY}`);

    // The second checkout reuses the customer it just created.
    await postCheckout(harness, { idempotencyKey: `${IDEMPOTENCY_KEY}-second` });
    expect(harness.calls.filter((call) => call.url.endsWith('/customers'))).toHaveLength(1);
  });

  it('refuses a card charge with neither a token nor a stored method', async () => {
    harness.repo.defaultMethods = [];
    const response = await postCheckout();
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: 'payment_method_required' });
    expect(harness.repo.attempts).toHaveLength(0);
  });

  it('charges the token supplied in the body', async () => {
    harness.repo.defaultMethods = [];
    const response = await postCheckout(harness, { providerPaymentMethodToken: 'pm_from_browser' });
    expect(response.statusCode).toBe(201);
    expect(stripeField(stripeChargeCall(), 'payment_method')).toBe('pm_from_browser');
  });

  it('never echoes a token or a client secret into the audit chain', async () => {
    await postCheckout(harness, { providerPaymentMethodToken: 'pm_secret_token_value' });
    const serialised = JSON.stringify(harness.audits);
    expect(serialised).not.toContain('pm_secret_token_value');
    expect(serialised).not.toContain('pm_default_a');
    expect(serialised).not.toContain('pi_test_1_secret_9xY');
  });
});

// ------------------------------------------------------- the ledger firewall

describe('checkout never posts to the ledger', () => {
  const files = ['./index.ts', './service.ts', './repo.ts'];

  it('does not import or reference the ledger anywhere in this module', () => {
    for (const file of files) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8');
      expect(source, file).not.toMatch(/from\s+['"][^'"]*ledger[^'"]*['"]/);
      expect(source, file).not.toContain('LedgerService');
      expect(source, file).not.toContain('LEDGER_RECIPES');
      expect(source, file).not.toContain('journal_entries');
      expect(source, file).not.toContain('payment_captured');
    }
  });

  it('writes only quotes and attempts, and audits only the attempt', async () => {
    const quoted = await postQuote();
    const quoteId = (quoted.json() as { data: { id: string } }).data.id;
    await postCheckout(harness, { fxQuoteId: quoteId });

    expect(new Set(harness.repo.writes)).toEqual(
      new Set(['insertFxQuote', 'consumeFxQuote', 'insertPaymentAttempt']),
    );
    expect(harness.audits.map((audit) => audit.eventType)).toEqual([
      'FX_QUOTE_LOCKED',
      'PAYMENT_ATTEMPT_CREATED',
    ]);
    expect(harness.ledger.calls).toBe(0);
  });
});

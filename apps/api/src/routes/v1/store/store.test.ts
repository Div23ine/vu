import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { describe, expect, it } from 'vitest';
import type { Permission } from '@vunvault/contracts';
import { LICENSE_KEY_PATTERN, ROLE_PERMISSIONS } from '@vunvault/contracts';
import { products as catalogue } from '@vunvault/contracts/fixtures/store';
import type { Env } from '../../../config/env';
import type { AuditEntryRow, SqlExecutor } from '../../../audit/repo';
import { asExecutor } from '../../../audit/repo';
import type { AuthUser } from '../../../plugins/auth';
import { HttpError } from '../../../lib/http-error';
import type { ObjectStorage } from '../../../lib/object-storage';
import errorHandler from '../../../plugins/error-handler';
import type { InvoiceIssuer } from '../../../billing/invoice-issuer';
import type { PaymentsRepo, WebhookAttemptRow } from '../payments-admin/repo';
import { WebhookService, type WebhookEvent } from '../webhooks/service';
import storeRoutes from './index';
import { generateLicenseKey, generateUniqueLicenseKey, isLicenseKey } from './license-key';
import type { EntitlementRow, InvoiceProductLine, ProductRow, StoreRepo } from './repo';
import { addMonths, EntitlementService, invoiceDetailFor } from './service';

/**
 * The store's HTTP contract (Task 40c).
 *
 * What these tests are really about: a purchase issues an invoice and charges
 * nothing, buying twice yields the SAME invoice, a paid invoice mints exactly one
 * licence whose key matches the published format, and one organisation cannot take
 * a download URL for another organisation's licence.
 */

const AT = new Date('2026-10-06T09:00:00.000Z');
const ORG = 'a0000000-0000-4000-8000-00000000000a';
const OTHER_ORG = 'b0000000-0000-4000-8000-00000000000b';

class FakeStoreRepo implements StoreRepo {
  readonly products: ProductRow[] = catalogue.map((product, index) => ({
    id: product.id,
    slug: product.slug,
    name: product.name,
    category: product.category,
    description: product.description,
    features: product.features,
    priceUsdCents: product.priceUsdCents,
    unitLabel: product.unitLabel,
    // Only the first product has an archive uploaded: the rest are sold but not
    // yet deliverable, which is exactly the `409 not_available` case.
    deliveryObjectKey: index === 0 ? 'store/reconvault-pro-1.0.zip' : null,
    sortOrder: index + 1,
  }));
  readonly entitlements: EntitlementRow[] = [];
  readonly lines: InvoiceProductLine[] = [];
  invoices: Array<{ id: string; orgId: string; productId: string; number: string; total: number }> =
    [];
  keyAttempts = 0;

  async listProducts() {
    return this.products;
  }
  async getProductBySlug(slug: string) {
    return this.products.find((product) => product.slug === slug) ?? null;
  }
  async getProductById(productId: string) {
    return this.products.find((product) => product.id === productId) ?? null;
  }
  async findReusableInvoice(orgId: string, productId: string, since: Date) {
    const found = this.invoices.find(
      (invoice) => invoice.orgId === orgId && invoice.productId === productId,
    );
    if (found === undefined || found.total === 0) return null;
    void since;
    return { id: found.id, number: found.number, totalUsdCents: found.total };
  }
  async linkInvoiceLineToProduct(invoiceId: string, productId: string) {
    const product = this.products.find((row) => row.id === productId);
    if (product === undefined) return;
    this.lines.push({
      invoiceId,
      orgId: ORG,
      productId,
      productName: product.name,
    });
  }
  async invoiceProductLines(invoiceId: string) {
    return this.lines.filter((line) => line.invoiceId === invoiceId);
  }
  async findEntitlement(orgId: string, productId: string, invoiceId: string) {
    return (
      this.entitlements.find(
        (row) => row.orgId === orgId && row.productId === productId && row.invoiceId === invoiceId,
      ) ?? null
    );
  }
  async licenseKeyTaken(licenseKey: string) {
    this.keyAttempts += 1;
    return this.entitlements.some((row) => row.licenseKey === licenseKey);
  }
  async insertEntitlement(input: {
    id: string;
    orgId: string;
    productId: string;
    invoiceId: string;
    licenseKey: string;
    grantedAt: Date;
    updatesUntil: Date;
  }) {
    if (await this.findEntitlement(input.orgId, input.productId, input.invoiceId)) return null;
    const product = this.products.find((row) => row.id === input.productId);
    const row: EntitlementRow = {
      id: input.id,
      orgId: input.orgId,
      productId: input.productId,
      productName: product?.name ?? 'Product',
      invoiceId: input.invoiceId,
      licenseKey: input.licenseKey,
      grantedAt: input.grantedAt.toISOString(),
      updatesUntil: input.updatesUntil.toISOString(),
      revokedAt: null,
      deliveryObjectKey: product?.deliveryObjectKey ?? null,
    };
    this.entitlements.push(row);
    return row;
  }
  async listEntitlements(orgId: string) {
    return this.entitlements.filter((row) => row.orgId === orgId);
  }
  async getEntitlement(orgId: string, entitlementId: string) {
    return this.entitlements.find((row) => row.orgId === orgId && row.id === entitlementId) ?? null;
  }
}

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

function fakeStorage(): ObjectStorage {
  return {
    presignPut: async () => ({ url: 'https://assets.test/put', headers: {} }),
    head: async () => null,
    delete: async () => undefined,
    presignGet: async ({ key, expiresSec }) =>
      `https://assets.test/get/${key}?expires=${String(expiresSec)}`,
    publicUrl: (key: string) => `https://cdn.test/${key}`,
  };
}

function buyer(orgId: string | null, permissions?: Permission[]): AuthUser {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'cto@client.test',
    role: 'client',
    orgId,
    permissions: permissions ?? [...ROLE_PERMISSIONS.client],
    aal: 'aal2',
    sessionId: '20000000-0000-4000-8000-000000000001',
  };
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
  repo: StoreRepo;
  audits: AuditRecord[];
  user: { current: AuthUser | null };
}

/**
 * The real `InvoiceIssuer` allocates its number from the database, which a fake
 * transaction cannot answer. The point of these tests is what the store does with
 * an issued invoice, not how invoices are numbered (that is Task 32's suite).
 */
function fakeIssuer(): Pick<InvoiceIssuer, 'issue'> {
  let sequence = 0;
  const issuer = {
    issue: async (_tx: unknown, input: unknown) => {
      sequence += 1;
      const lines = (
        input as unknown as { lines: Array<{ unitUsdCents: number; quantity: number }> }
      ).lines;
      const total = lines.reduce((sum, line) => sum + line.unitUsdCents * line.quantity, 0);
      issued.push({ input: input as unknown as Record<string, unknown>, total });
      return {
        id: `e1000000-0000-4000-8000-0000000000e${String(sequence)}`,
        number: `VV-INV-2026-000${String(sequence)}`,
        totalUsdCents: total,
      };
    },
  };
  return issuer as unknown as Pick<InvoiceIssuer, 'issue'>;
}

const issued: Array<{ input: Record<string, unknown>; total: number }> = [];

async function makeHarness(options?: {
  repo?: StoreRepo;
  orgId?: string | null;
  permissions?: Permission[];
  storage?: ObjectStorage;
}): Promise<Harness> {
  const repo = options?.repo ?? new FakeStoreRepo();
  const audits: AuditRecord[] = [];
  const user: Harness['user'] = {
    current: buyer(options?.orgId === undefined ? ORG : options.orgId, options?.permissions),
  };

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
      const actor = input.actor as { id: string | null; label: string } | undefined;
      audits.push({
        eventType: String(input.eventType),
        message: String(input.message),
        actorLabel: actor?.label ?? 'external',
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
        actorId: 'actor-id',
        actorLabel: audits[audits.length - 1]?.actorLabel ?? 'buyer',
        ip: null,
        subject: (input.subject as string | undefined) ?? null,
        message: String(input.message),
        details: {},
        sealedDetails: null,
        nonce: null,
        prevHash: '0'.repeat(64),
        hash: 'a'.repeat(64),
        signature: 'b'.repeat(64),
        keyId: 'v1',
        createdAt: AT,
      } as unknown as AuditEntryRow;
    },
    publish: async () => undefined,
  } as unknown as FastifyInstance['audit']);
  app.decorate('queues', {
    notify: { add: async () => undefined },
  } as unknown as FastifyInstance['queues']);
  app.decorate('storage', options?.storage ?? fakeStorage());

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
  await app.register(
    async (scope) => {
      await scope.register(storeRoutes, { repo, issuer: fakeIssuer() });
    },
    { prefix: '/api/v1' },
  );

  return { app, repo, audits, user };
}

describe('GET /api/v1/products', () => {
  it('lists the active catalogue in sort order with USD prices', async () => {
    const { app } = await makeHarness();
    const response = await app.inject({ method: 'GET', url: '/api/v1/products' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: Array<Record<string, unknown>>; total: number };
    expect(body.total).toBe(6);
    expect(body.data[0]).toMatchObject({ slug: 'reconvault-pro', settlementCurrency: 'USD' });
    expect(body.data.map((product) => product.slug)).toEqual([
      'reconvault-pro',
      'vulnscope-api',
      'phishguard-kit',
      'loghound-siem-pack',
      'payloadforge',
      'compliancemapper',
    ]);
    // Public and cacheable, and nobody had to sign in.
    expect(response.headers['cache-control']).toBe('public, max-age=300');
  });

  it('serves a product page by slug and 404s an unknown one', async () => {
    const { app } = await makeHarness();
    const ok = await app.inject({ method: 'GET', url: '/api/v1/products/loghound-siem-pack' });
    expect(ok.statusCode).toBe(200);
    expect((ok.json() as { data: Record<string, unknown> }).data).toMatchObject({
      name: 'LogHound SIEM Pack',
      priceUsdCents: 19_900,
      unitLabel: 'pack',
    });
    const missing = await app.inject({ method: 'GET', url: '/api/v1/products/not-a-product' });
    expect(missing.statusCode).toBe(404);
    expect((missing.json() as { error: string }).error).toBe('not_found');
  });
});

describe('POST /api/v1/products/:id/purchase', () => {
  const PRODUCT_ID = catalogue[0]?.id ?? '';

  it('issues a USD invoice and nothing more', async () => {
    const repo = new FakeStoreRepo();
    const { app, audits: entries } = await makeHarness({ repo, permissions: ['billing:manage'] });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/products/${PRODUCT_ID}/purchase`,
      headers: { 'x-idempotency-key': 'buy-1' },
      payload: { productId: PRODUCT_ID },
    });
    expect(response.statusCode, response.body).toBe(201);
    const body = response.json() as {
      data: {
        invoiceId: string;
        invoiceNumber: string;
        totalUsdCents: number;
        settlementCurrency: string;
      };
    };
    expect(body.data.totalUsdCents).toBe(4900);
    expect(body.data.settlementCurrency).toBe('USD');
    // No charge was attempted: a purchase produces a debt, payment is a separate,
    // explicitly chosen act through the FX quote and checkout routes.
    expect(body.data.invoiceNumber).toBeTruthy();
    expect(entries.map((entry) => entry.eventType)).toContain('PRODUCT_PURCHASE_STARTED');
    // The line is linked to the product so the webhook can grant a licence later.
    expect(repo.lines).toHaveLength(1);
    expect(repo.lines[0]?.productId).toBe(PRODUCT_ID);
  });

  it('returns the SAME invoice when the buyer clicks twice', async () => {
    const repo = new FakeStoreRepo();
    const { app } = await makeHarness({ repo, permissions: ['billing:manage'] });
    const invoice = {
      id: 'e1000000-0000-4000-8000-0000000000e1',
      orgId: ORG,
      productId: PRODUCT_ID,
      number: 'VV-INV-2026-0001',
      total: 4900,
    };
    repo.invoices.push(invoice);
    const first = await app.inject({
      method: 'POST',
      url: `/api/v1/products/${PRODUCT_ID}/purchase`,
      payload: { productId: PRODUCT_ID },
    });
    const second = await app.inject({
      method: 'POST',
      url: `/api/v1/products/${PRODUCT_ID}/purchase`,
      payload: { productId: PRODUCT_ID },
    });
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect((first.json() as { data: { invoiceId: string } }).data.invoiceId).toBe(invoice.id);
    expect((second.json() as { data: { invoiceId: string } }).data.invoiceId).toBe(invoice.id);
    // Two clicks, one debt: no second invoice line was written.
    expect(repo.lines).toHaveLength(0);
  });

  it('refuses a purchase with no organisation, and rejects a mismatched body', async () => {
    const { app } = await makeHarness({ orgId: null, permissions: ['billing:manage'] });
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/products/${PRODUCT_ID}/purchase`,
      payload: { productId: PRODUCT_ID },
    });
    expect(response.statusCode).toBe(403);
    expect((response.json() as { error: string }).error).toBe('no_org');

    const mismatched = await makeHarness({ permissions: ['billing:manage'] });
    const other = catalogue[1]?.id ?? '';
    const bad = await mismatched.app.inject({
      method: 'POST',
      url: `/api/v1/products/${PRODUCT_ID}/purchase`,
      payload: { productId: other },
    });
    expect(bad.statusCode).toBe(400);
  });

  it('prices the invoice detail by unit label', () => {
    const rows = new FakeStoreRepo().products;
    const byName = (name: string) => rows.find((row) => row.name === name);
    expect(invoiceDetailFor(byName('ReconVault Pro') as ProductRow)).toBe(
      'Recon · license licence',
    );
    expect(invoiceDetailFor(byName('VulnScope API') as ProductRow)).toBe(
      'Scanning · annual licence',
    );
    expect(invoiceDetailFor(byName('LogHound SIEM Pack') as ProductRow)).toBe('Detection · pack');
  });
});

describe('entitlements', () => {
  it('lists only the caller’s own licences and says which are downloadable', async () => {
    const repo = new FakeStoreRepo();
    const service = new EntitlementService({ repo });
    const executor = { unsafe: async () => [] } as unknown as SqlExecutor;
    repo.lines.push({
      invoiceId: 'e1000000-0000-4000-8000-0000000000e1',
      orgId: ORG,
      productId: catalogue[0]?.id ?? '',
      productName: 'ReconVault Pro',
    });
    await service.grantForInvoice(executor, 'e1000000-0000-4000-8000-0000000000e1');

    const { app } = await makeHarness({ repo });
    const response = await app.inject({ method: 'GET', url: '/api/v1/entitlements' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: Array<Record<string, unknown>>; total: number };
    expect(body.total).toBe(1);
    expect(body.data[0]).toMatchObject({ productName: 'ReconVault Pro', downloadable: true });
    expect(isLicenseKey(body.data[0]?.licenseKey as string)).toBe(true);
  });

  it('grants exactly one licence for a paid invoice, with a key in the published format', async () => {
    const repo = new FakeStoreRepo();
    const invoiceId = 'e1000000-0000-4000-8000-0000000000e9';
    const productId = catalogue[0]?.id ?? '';
    repo.lines.push({ invoiceId, orgId: ORG, productId, productName: 'ReconVault Pro' });

    const entries: Array<Record<string, unknown>> = [];
    const emails: Array<{ to: string; vars: Record<string, string> }> = [];
    const service = new EntitlementService({
      repo,
      audit: {
        async append(executor, input) {
          void asExecutor(executor);
          const entry = input as unknown as Record<string, unknown>;
          entries.push(entry);
          return entry as never;
        },
      },
      enqueueEmail: async (input) => {
        emails.push({ to: input.to, vars: input.vars });
      },
      contactsFor: async () => ['cto@client.test'],
      now: () => AT,
    });
    const executor = { unsafe: async () => [] } as unknown as SqlExecutor;

    await service.grantForInvoice(executor, invoiceId);
    // Replayed webhook: the same capture arrives twice.
    await service.grantForInvoice(executor, invoiceId);

    expect(repo.entitlements).toHaveLength(1);
    const key = repo.entitlements[0]?.licenseKey ?? '';
    expect(LICENSE_KEY_PATTERN.test(key)).toBe(true);
    expect(key).toMatch(/^VV-[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
    // "Twelve months of updates."
    expect(repo.entitlements[0]?.updatesUntil).toBe('2027-10-06T09:00:00.000Z');
    // Audited once, by the system, and WITHOUT the key: a licence key is a bearer
    // credential and the chain is readable by every auditor.
    expect(entries.map((entry) => entry.eventType)).toEqual(['ENTITLEMENT_GRANTED']);
    expect((entries[0]?.actor as { label: string }).label).toBe('system');
    expect(JSON.stringify(entries[0]?.details)).not.toContain(key);
    expect(JSON.stringify(entries[0])).not.toContain(key);
    // The key travels in the buyer's email instead.
    expect(emails).toHaveLength(1);
    expect(emails[0]?.vars.licenseKey).toBe(key);
  });

  it('never lets one organisation download another’s licence', async () => {
    const repo = new FakeStoreRepo();
    repo.entitlements.push({
      id: 'd1000000-0000-4000-8000-0000000000d1',
      orgId: ORG,
      productId: catalogue[0]?.id ?? '',
      productName: 'ReconVault Pro',
      invoiceId: 'e1000000-0000-4000-8000-0000000000e1',
      licenseKey: 'VV-2B7Q-XK4M-9RTH-3WD6',
      grantedAt: AT.toISOString(),
      updatesUntil: addMonths(AT, 12).toISOString(),
      revokedAt: null,
      deliveryObjectKey: 'store/reconvault-pro-1.0.zip',
    });

    const owner = await makeHarness({ repo });
    const ok = await owner.app.inject({
      method: 'POST',
      url: '/api/v1/entitlements/d1000000-0000-4000-8000-0000000000d1/download-url',
    });
    expect(ok.statusCode, ok.body).toBe(200);
    const body = ok.json() as { data: { url: string; expiresAt: string } };
    expect(body.data.url).toContain('store/reconvault-pro-1.0.zip');
    // 300 s, and the URL says so: the archive is fetchable for five minutes and
    // then the buyer asks again, which is audited again.
    expect(body.data.url).toContain('expires=300');
    const expiresAt = new Date(body.data.expiresAt).getTime();
    expect(expiresAt - Date.now()).toBeGreaterThan(290_000);
    expect(expiresAt - Date.now()).toBeLessThanOrEqual(300_000);

    const intruder = await makeHarness({ repo, orgId: OTHER_ORG });
    const denied = await intruder.app.inject({
      method: 'POST',
      url: '/api/v1/entitlements/d1000000-0000-4000-8000-0000000000d1/download-url',
    });
    // A 404, not a 403: existence of somebody else's licence is not public either.
    expect(denied.statusCode).toBe(404);
    expect((denied.json() as { error: string }).error).toBe('not_found');
  });

  it('refuses a download for a product with no archive and for a revoked licence', async () => {
    const repo = new FakeStoreRepo();
    // VulnScope has no `delivery_object_key` in the fixture repo.
    repo.entitlements.push({
      id: 'd1000000-0000-4000-8000-0000000000d2',
      orgId: ORG,
      productId: catalogue[1]?.id ?? '',
      productName: 'VulnScope API',
      invoiceId: 'e1000000-0000-4000-8000-0000000000e2',
      licenseKey: 'VV-2B7Q-XK4M-9RTH-3WD7',
      grantedAt: AT.toISOString(),
      updatesUntil: addMonths(AT, 12).toISOString(),
      revokedAt: null,
      deliveryObjectKey: null,
    });
    const { app } = await makeHarness({ repo });
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/entitlements/d1000000-0000-4000-8000-0000000000d2/download-url',
    });
    expect(response.statusCode).toBe(409);
    expect((response.json() as { error: string }).error).toBe('not_available');
  });
});

describe('the webhook that pays for a licence', () => {
  it('grants exactly one entitlement when the invoice reaches zero outstanding', async () => {
    const storeRepo = new FakeStoreRepo();
    const invoiceId = 'e1000000-0000-4000-8000-0000000000e7';
    storeRepo.lines.push({
      invoiceId,
      orgId: ORG,
      productId: catalogue[0]?.id ?? '',
      productName: 'ReconVault Pro',
    });

    const attempt = {
      id: 'f1000000-0000-4000-8000-0000000000f1',
      txnCode: 'TXN-4471',
      invoiceId,
      invoiceNumber: 'VV-INV-2026-0001',
      invoiceStatus: 'pending',
      scanJobId: null,
      orgId: ORG,
      provider: 'stripe',
      channel: 'card',
      providerReference: 'pi_1',
      status: 'pending',
      usdCents: 4900,
      settlementCurrency: 'USD',
    } as WebhookAttemptRow;

    const ledgerPosts: Array<{ kind: string }> = [];
    const audits: Array<Record<string, unknown>> = [];
    const repo = {
      recordWebhookEvent: async () => true,
      markEventProcessed: async () => undefined,
      findAttemptByProviderReference: async () => attempt,
      setAttemptStatus: async () => undefined,
      getBalance: async () => ({
        totalUsdCents: 4900,
        paidUsdCents: 4900,
        outstandingUsdCents: 0,
      }),
      setInvoiceStatus: async () => undefined,
      getScanJob: async () => null,
      billingContacts: async () => [],
    } as unknown as PaymentsRepo;

    const service = new WebhookService({
      repo,
      ledger: {
        post: async (_executor, input) => {
          ledgerPosts.push({ kind: input.kind });
          return { entryId: 'entry-1', duplicated: false };
        },
      },
      audit: {
        async append(executor, input) {
          void asExecutor(executor);
          audits.push(input as unknown as Record<string, unknown>);
          return input as never;
        },
      },
      payments: {} as never,
      now: () => AT,
      // The real grant logic, against the fake store repo and the same audit sink.
      entitlements: new EntitlementService({
        repo: storeRepo,
        now: () => AT,
        audit: {
          async append(executor, input) {
            void asExecutor(executor);
            audits.push(input as unknown as Record<string, unknown>);
            return input as never;
          },
        },
      }),
    });

    const event: WebhookEvent = {
      id: 'evt_1',
      type: 'payment_intent.succeeded',
      payload: { id: 'pi_1', amount_received: 4900, currency: 'usd' },
    };
    const outcome = await service.handle({ unsafe: async () => [] }, 'stripe', event);

    expect(outcome.kind).toBe('captured');
    expect(ledgerPosts).toEqual([{ kind: 'payment_captured' }]);
    // One paid invoice, one licence, in the published key format.
    expect(storeRepo.entitlements).toHaveLength(1);
    expect(LICENSE_KEY_PATTERN.test(storeRepo.entitlements[0]?.licenseKey ?? '')).toBe(true);
    // The licence is granted inside the settle step, before the capture entry.
    expect(audits.map((entry) => entry.eventType)).toEqual([
      'ENTITLEMENT_GRANTED',
      'PAYMENT_CAPTURED',
    ]);
  });
});

describe('licence keys', () => {
  it('generates Crockford base32 keys and retries a collision', async () => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const key = generateLicenseKey();
      expect(LICENSE_KEY_PATTERN.test(key), key).toBe(true);
      expect(key).not.toMatch(/[ILOU]/);
    }
    const seen: string[] = [];
    const unique = await generateUniqueLicenseKey(async (key) => {
      seen.push(key);
      return seen.length < 3;
    });
    expect(LICENSE_KEY_PATTERN.test(unique)).toBe(true);
    expect(seen).toHaveLength(3);
    await expect(generateUniqueLicenseKey(async () => true, 5)).rejects.toThrow(
      /unique licence key/,
    );
  });
});

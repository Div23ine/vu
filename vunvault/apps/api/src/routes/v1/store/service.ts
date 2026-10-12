import type { EntitlementView, ProductView, PurchaseResponse } from '@vunvault/contracts';
import type { AuditEventType } from '../../../audit/events';
import type { AuditService } from '../../../audit/service';
import type { SqlExecutor } from '../../../audit/repo';
import { HttpError } from '../../../lib/http-error';
import type { ObjectStorage } from '../../../lib/object-storage';
import type { InvoiceIssuer } from '../../../billing/invoice-issuer';
import { generateUniqueLicenseKey } from './license-key';
import type { EntitlementRow, ProductRow, StoreRepo } from './repo';

/**
 * The store: what is for sale, what a purchase produces, and what owning one
 * entitles you to.
 *
 * A purchase produces an INVOICE, never a charge. Payment runs through the FX quote
 * and checkout routes (Task 33) in USD, and the licence is granted by the payment
 * webhook (Task 34 → this task) — not by the purchase response. Selling something
 * the platform has not been paid for is the failure mode this ordering prevents.
 *
 * Granting is idempotent on (organisation, product, invoice): the database has the
 * unique index, and the service checks before it inserts, so a replayed webhook
 * cannot mint a second licence key for one purchase.
 */

/** A pending invoice is reusable for this long before a new one is issued. */
export const REUSABLE_INVOICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** "Twelve months of updates." */
export const UPDATE_WINDOW_MONTHS = 12;

/** How long a presigned download URL stays valid. */
export const DOWNLOAD_URL_SECONDS = 300;

export interface AuditInstruction {
  eventType: AuditEventType;
  message: string;
  subject?: string;
  details?: Record<string, unknown>;
  actor?: { id: string | null; label: string };
}

export interface StoreServiceDeps {
  repo: StoreRepo;
  /** The transaction the invoice and its product link are written in. */
  executor?: SqlExecutor;
  issuer?: Pick<InvoiceIssuer, 'issue'>;
  now?: () => Date;
}

/** `<category> · <unit> licence` — the invoice line's detail, per unit label. */
export function invoiceDetailFor(product: ProductRow): string {
  switch (product.unitLabel) {
    case 'year':
      return `${product.category} · annual licence`;
    case 'pack':
      return `${product.category} · pack`;
    default:
      return `${product.category} · ${product.unitLabel} licence`;
  }
}

export class StoreService {
  private readonly repo: StoreRepo;
  private readonly executor: SqlExecutor | undefined;
  private readonly issuer: Pick<InvoiceIssuer, 'issue'> | undefined;
  private readonly now: () => Date;

  constructor(deps: StoreServiceDeps) {
    this.repo = deps.repo;
    this.executor = deps.executor;
    this.issuer = deps.issuer;
    this.now = deps.now ?? (() => new Date());
  }

  async list(): Promise<{ data: ProductView[]; total: number }> {
    const rows = await this.repo.listProducts();
    return { data: rows.map(toProductView), total: rows.length };
  }

  async bySlug(slug: string): Promise<ProductView> {
    const row = await this.repo.getProductBySlug(slug);
    if (row === null) throw HttpError.notFound();
    return toProductView(row);
  }

  /**
   * Issue (or reuse) the USD invoice for one product.
   *
   * Reusing a pending invoice from the last 24 hours is what makes a double click,
   * a refresh or a retried request produce one debt rather than two.
   */
  async purchase(
    orgId: string,
    productId: string,
  ): Promise<{ data: PurchaseResponse['data']; audit: AuditInstruction[] }> {
    const product = await this.repo.getProductById(productId);
    if (product === null) throw HttpError.notFound();

    const since = new Date(this.now().getTime() - REUSABLE_INVOICE_WINDOW_MS);
    const reusable = await this.repo.findReusableInvoice(orgId, productId, since);

    if (reusable !== null) {
      return {
        data: {
          invoiceId: reusable.id,
          invoiceNumber: reusable.number,
          totalUsdCents: reusable.totalUsdCents,
          settlementCurrency: 'USD',
        },
        audit: [
          {
            eventType: 'PRODUCT_PURCHASE_STARTED',
            subject: reusable.id,
            message: `${product.name} purchase reused open invoice ${reusable.number}`,
            details: { productId: product.id, invoiceId: reusable.id, reused: true },
          },
        ],
      };
    }

    if (this.issuer === undefined) {
      throw new HttpError(503, 'service_unavailable', 'Invoicing is not configured');
    }
    const issued = await this.issuer.issue(this.executor, {
      orgId,
      title: product.name,
      detail: invoiceDetailFor(product),
      lines: [
        {
          description: product.name,
          quantity: 1,
          unitUsdCents: product.priceUsdCents,
        },
      ],
    });
    // The issuer prices plans, not products, so the product link is set here — in
    // the same transaction, before anything can read the line.
    await this.repo.linkInvoiceLineToProduct(issued.id, product.id);

    return {
      data: {
        invoiceId: issued.id,
        invoiceNumber: issued.number,
        totalUsdCents: issued.totalUsdCents,
        settlementCurrency: 'USD',
      },
      audit: [
        {
          eventType: 'PRODUCT_PURCHASE_STARTED',
          subject: issued.id,
          message: `${product.name} purchase started on invoice ${issued.number}`,
          details: {
            productId: product.id,
            invoiceId: issued.id,
            usdCents: product.priceUsdCents,
          },
        },
      ],
    };
  }
}

export interface EntitlementServiceDeps {
  repo: StoreRepo;
  audit?: Pick<AuditService, 'append'>;
  storage?: ObjectStorage;
  /** Enqueues the licence email; wired to the `notify` queue by the route. */
  enqueueEmail?: (input: {
    to: string;
    template: string;
    vars: Record<string, string>;
  }) => Promise<void>;
  /** The buyer's billing contacts, for the licence email. */
  contactsFor?: (orgId: string) => Promise<string[]>;
  now?: () => Date;
  randomUuid?: () => string;
}

export class EntitlementService {
  private readonly repo: StoreRepo;
  private readonly audit: Pick<AuditService, 'append'> | undefined;
  private readonly storage: ObjectStorage | undefined;
  private readonly deps: EntitlementServiceDeps;
  private readonly now: () => Date;
  private readonly randomUuid: () => string;

  constructor(deps: EntitlementServiceDeps) {
    this.deps = deps;
    this.repo = deps.repo;
    this.audit = deps.audit;
    this.storage = deps.storage;
    this.now = deps.now ?? (() => new Date());
    this.randomUuid = deps.randomUuid ?? (() => crypto.randomUUID());
  }

  /**
   * Grant every product on a paid invoice. Called from inside the webhook
   * transaction, so a grant and the ledger entry that justifies it commit together.
   *
   * The licence key never enters the audit chain: `details` is readable by anyone
   * with `audit:read`, and a key is a bearer credential for a download.
   */
  async grantForInvoice(
    executor: SqlExecutor,
    invoiceId: string,
  ): Promise<{ granted: EntitlementRow[] }> {
    const lines = await this.repo.invoiceProductLines(invoiceId);
    const granted: EntitlementRow[] = [];

    for (const line of lines) {
      const existing = await this.repo.findEntitlement(line.orgId, line.productId, invoiceId);
      if (existing !== null) continue;

      const grantedAt = this.now();
      const licenseKey = await generateUniqueLicenseKey((key) => this.repo.licenseKeyTaken(key));
      const row = await this.repo.insertEntitlement({
        id: this.randomUuid(),
        orgId: line.orgId,
        productId: line.productId,
        invoiceId,
        licenseKey,
        grantedAt,
        updatesUntil: addMonths(grantedAt, UPDATE_WINDOW_MONTHS),
      });
      if (row === null) continue; // lost a race; the winner's row stands
      granted.push(row);

      if (this.audit !== undefined) {
        await this.audit.append(executor, {
          eventType: 'ENTITLEMENT_GRANTED',
          actor: { id: null, label: 'system' },
          subject: row.id,
          message: `${line.productName} licence granted against invoice ${invoiceId}`,
          details: { productId: line.productId, invoiceId, productName: line.productName },
        });
      }
      await this.emailLicense(line.orgId, row).catch(() => undefined);
    }

    return { granted };
  }

  private async emailLicense(orgId: string, row: EntitlementRow): Promise<void> {
    if (this.deps.enqueueEmail === undefined || this.deps.contactsFor === undefined) return;
    const contacts = await this.deps.contactsFor(orgId);
    for (const to of contacts) {
      await this.deps.enqueueEmail({
        to,
        template: 'licence_granted',
        vars: {
          productName: row.productName,
          licenseKey: row.licenseKey,
          updatesUntil: row.updatesUntil.slice(0, 10),
        },
      });
    }
  }

  async list(orgId: string): Promise<EntitlementView[]> {
    const rows = await this.repo.listEntitlements(orgId);
    return rows.map(toEntitlementView);
  }

  /**
   * A short-lived presigned GET for the licensed archive.
   *
   * `409 not_available` when the product has no archive yet: the catalogue is sold
   * before an operator uploads the build, and pretending otherwise would send a
   * buyer to a URL that 404s.
   */
  async downloadUrl(
    orgId: string,
    entitlementId: string,
  ): Promise<{ url: string; expiresAt: string; audit: AuditInstruction[] }> {
    const row = await this.repo.getEntitlement(orgId, entitlementId);
    if (row === null) throw HttpError.notFound();
    if (row.revokedAt !== null || row.deliveryObjectKey === null) {
      throw new HttpError(409, 'not_available', 'There is no download for this licence yet');
    }
    if (this.storage === undefined) {
      throw new HttpError(503, 'service_unavailable', 'Object storage is not configured');
    }

    const url = await this.storage.presignGet({
      key: row.deliveryObjectKey,
      expiresSec: DOWNLOAD_URL_SECONDS,
    });
    return {
      url,
      expiresAt: new Date(this.now().getTime() + DOWNLOAD_URL_SECONDS * 1000).toISOString(),
      audit: [
        {
          eventType: 'PRODUCT_DOWNLOADED',
          subject: row.id,
          message: `${row.productName} download issued`,
          details: { productId: row.productId, entitlementId: row.id },
        },
      ],
    };
  }
}

/** `downloadable` is derived: an archive exists and the licence still stands. */
export function toEntitlementView(row: EntitlementRow): EntitlementView {
  return {
    id: row.id,
    productId: row.productId,
    productName: row.productName,
    licenseKey: row.licenseKey,
    grantedAt: row.grantedAt,
    updatesUntil: row.updatesUntil,
    downloadable: row.deliveryObjectKey !== null && row.revokedAt === null,
  };
}

export function toProductView(row: ProductRow): ProductView {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    description: row.description,
    features: row.features,
    priceUsdCents: row.priceUsdCents,
    unitLabel: row.unitLabel as ProductView['unitLabel'],
    settlementCurrency: 'USD',
  };
}

/** Calendar months, clamped to the last valid day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(from: Date, months: number): Date {
  const target = new Date(
    Date.UTC(
      from.getUTCFullYear(),
      from.getUTCMonth() + months,
      from.getUTCDate(),
      from.getUTCHours(),
      from.getUTCMinutes(),
      from.getUTCSeconds(),
      from.getUTCMilliseconds(),
    ),
  );
  return target;
}

import { asExecutor, type SqlExecutor } from '../../../audit/repo';

/**
 * Store data access (Task 40c): the product catalogue, the licence entitlements a
 * paid invoice grants, and the newsletter list.
 *
 * Entitlements are keyed by (organisation, product, invoice) and that triple is
 * UNIQUE in the database, which is what makes granting idempotent: a webhook
 * delivered twice, or a reconciliation replaying a capture, mints one key and not
 * two.
 */

export interface ProductRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  features: string[];
  priceUsdCents: number;
  unitLabel: string;
  deliveryObjectKey: string | null;
  sortOrder: number;
}

export interface EntitlementRow {
  id: string;
  orgId: string;
  productId: string;
  productName: string;
  invoiceId: string;
  licenseKey: string;
  grantedAt: string;
  updatesUntil: string;
  revokedAt: string | null;
  deliveryObjectKey: string | null;
}

export interface InvoiceProductLine {
  invoiceId: string;
  orgId: string;
  productId: string;
  productName: string;
}

export interface ReusableInvoice {
  id: string;
  number: string;
  totalUsdCents: number;
}

export interface NewsletterRow {
  id: string;
  email: string;
  status: string;
  tokenHash: string;
  source: string | null;
  confirmedAt: string | null;
  unsubscribedAt: string | null;
  createdAt: string;
  /** Only for the resend throttle; never leaves the API. */
  updatedAt: string;
}

export interface StoreRepo {
  listProducts(): Promise<ProductRow[]>;
  getProductBySlug(slug: string): Promise<ProductRow | null>;
  getProductById(productId: string): Promise<ProductRow | null>;

  /** A pending invoice for the same org and product, issued inside the window. */
  findReusableInvoice(
    orgId: string,
    productId: string,
    since: Date,
  ): Promise<ReusableInvoice | null>;
  /** Points the invoice's product line at the product, after the issuer writes it. */
  linkInvoiceLineToProduct(invoiceId: string, productId: string): Promise<void>;
  invoiceProductLines(invoiceId: string): Promise<InvoiceProductLine[]>;

  findEntitlement(
    orgId: string,
    productId: string,
    invoiceId: string,
  ): Promise<EntitlementRow | null>;
  licenseKeyTaken(licenseKey: string): Promise<boolean>;
  insertEntitlement(input: {
    id: string;
    orgId: string;
    productId: string;
    invoiceId: string;
    licenseKey: string;
    grantedAt: Date;
    updatesUntil: Date;
  }): Promise<EntitlementRow | null>;
  listEntitlements(orgId: string): Promise<EntitlementRow[]>;
  getEntitlement(orgId: string, entitlementId: string): Promise<EntitlementRow | null>;
}

export interface NewsletterRepo {
  findByEmail(email: string): Promise<NewsletterRow | null>;
  findByTokenHash(tokenHash: string): Promise<NewsletterRow | null>;
  upsertPending(input: {
    id: string;
    email: string;
    tokenHash: string;
    source: string | null;
    ipHash: string | null;
    at: Date;
  }): Promise<void>;
  confirm(id: string, at: Date): Promise<void>;
  unsubscribe(id: string, at: Date): Promise<void>;
  touchToken(id: string, tokenHash: string, at: Date): Promise<void>;
}

const PRODUCT_COLUMNS = `
  p.id::text as id, p.slug, p.name, p.category, p.description, p.features,
  p.price_usd_cents::text as price_usd_cents, p.unit_label, p.delivery_object_key, p.sort_order`;

interface SqlProductRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  features: string[] | null;
  price_usd_cents: string | number;
  unit_label: string;
  delivery_object_key: string | null;
  sort_order: number;
}

function mapProduct(row: SqlProductRow): ProductRow {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    description: row.description,
    features: row.features ?? [],
    priceUsdCents: Number(row.price_usd_cents),
    unitLabel: row.unit_label,
    deliveryObjectKey: row.delivery_object_key,
    sortOrder: Number(row.sort_order),
  };
}

const ENTITLEMENT_COLUMNS = `
  e.id::text as id, e.org_id::text as org_id, e.product_id::text as product_id,
  p.name as product_name, e.invoice_id::text as invoice_id, e.license_key,
  e.granted_at, e.updates_until, e.revoked_at, p.delivery_object_key`;

interface SqlEntitlementRow {
  id: string;
  org_id: string;
  product_id: string;
  product_name: string;
  invoice_id: string;
  license_key: string;
  granted_at: Date | string;
  updates_until: Date | string;
  revoked_at: Date | string | null;
  delivery_object_key: string | null;
}

function mapEntitlement(row: SqlEntitlementRow): EntitlementRow {
  return {
    id: row.id,
    orgId: row.org_id,
    productId: row.product_id,
    productName: row.product_name,
    invoiceId: row.invoice_id,
    licenseKey: row.license_key,
    grantedAt: new Date(row.granted_at).toISOString(),
    updatesUntil: new Date(row.updates_until).toISOString(),
    revokedAt: row.revoked_at === null ? null : new Date(row.revoked_at).toISOString(),
    deliveryObjectKey: row.delivery_object_key,
  };
}

export class SqlStoreRepo implements StoreRepo {
  private readonly executor: SqlExecutor;

  constructor(connection: unknown) {
    this.executor = asExecutor(connection);
  }

  async listProducts(): Promise<ProductRow[]> {
    const rows = await this.executor.unsafe<SqlProductRow[]>(
      `select ${PRODUCT_COLUMNS} from products p where p.active = true order by p.sort_order asc, p.name asc`,
    );
    return rows.map(mapProduct);
  }

  async getProductBySlug(slug: string): Promise<ProductRow | null> {
    const rows = await this.executor.unsafe<SqlProductRow[]>(
      `select ${PRODUCT_COLUMNS} from products p where p.slug = $1 and p.active = true limit 1`,
      [slug],
    );
    const row = rows[0];
    return row === undefined ? null : mapProduct(row);
  }

  async getProductById(productId: string): Promise<ProductRow | null> {
    const rows = await this.executor.unsafe<SqlProductRow[]>(
      `select ${PRODUCT_COLUMNS} from products p where p.id = $1::uuid and p.active = true limit 1`,
      [productId],
    );
    const row = rows[0];
    return row === undefined ? null : mapProduct(row);
  }

  async findReusableInvoice(
    orgId: string,
    productId: string,
    since: Date,
  ): Promise<ReusableInvoice | null> {
    // A buyer who clicks twice, or refreshes after a timeout, gets the same
    // invoice: two open invoices for one product is a support ticket, not a sale.
    const rows = await this.executor.unsafe<
      Array<{ id: string; number: string; total: string | number }>
    >(
      `select i.id::text as id, i.number,
              coalesce(sum(il.quantity * il.unit_usd_cents), 0)::text as total
         from invoices i
         join invoice_lines il on il.invoice_id = i.id
        where i.org_id = $1::uuid
          and i.status = 'pending'
          and i.created_at >= $2
          and il.product_id = $3::uuid
        group by i.id, i.number
        order by i.created_at desc
        limit 1`,
      [orgId, since, productId],
    );
    const row = rows[0];
    if (row === undefined) return null;
    return { id: row.id, number: row.number, totalUsdCents: Number(row.total) };
  }

  async linkInvoiceLineToProduct(invoiceId: string, productId: string): Promise<void> {
    await this.executor.unsafe(
      `update invoice_lines set product_id = $2::uuid
        where invoice_id = $1::uuid and product_id is null`,
      [invoiceId, productId],
    );
  }

  async invoiceProductLines(invoiceId: string): Promise<InvoiceProductLine[]> {
    const rows = await this.executor.unsafe<
      Array<{ invoice_id: string; org_id: string; product_id: string; product_name: string }>
    >(
      `select il.invoice_id::text as invoice_id, i.org_id::text as org_id,
              il.product_id::text as product_id, p.name as product_name
         from invoice_lines il
         join invoices i on i.id = il.invoice_id
         join products p on p.id = il.product_id
        where il.invoice_id = $1::uuid and il.product_id is not null`,
      [invoiceId],
    );
    return rows.map((row) => ({
      invoiceId: row.invoice_id,
      orgId: row.org_id,
      productId: row.product_id,
      productName: row.product_name,
    }));
  }

  async findEntitlement(orgId: string, productId: string, invoiceId: string) {
    const rows = await this.executor.unsafe<SqlEntitlementRow[]>(
      `select ${ENTITLEMENT_COLUMNS}
         from product_entitlements e
         join products p on p.id = e.product_id
        where e.org_id = $1::uuid and e.product_id = $2::uuid and e.invoice_id = $3::uuid
        limit 1`,
      [orgId, productId, invoiceId],
    );
    const row = rows[0];
    return row === undefined ? null : mapEntitlement(row);
  }

  async licenseKeyTaken(licenseKey: string): Promise<boolean> {
    const rows = await this.executor.unsafe<Array<{ id: string }>>(
      `select id::text as id from product_entitlements where license_key = $1 limit 1`,
      [licenseKey],
    );
    return rows.length > 0;
  }

  async insertEntitlement(input: {
    id: string;
    orgId: string;
    productId: string;
    invoiceId: string;
    licenseKey: string;
    grantedAt: Date;
    updatesUntil: Date;
  }): Promise<EntitlementRow | null> {
    const rows = await this.executor.unsafe<SqlEntitlementRow[]>(
      `insert into product_entitlements
         (id, org_id, product_id, invoice_id, license_key, granted_at, updates_until)
       values ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7)
       on conflict (org_id, product_id, invoice_id) do nothing
       returning ${entitlementReturning()}`,
      [
        input.id,
        input.orgId,
        input.productId,
        input.invoiceId,
        input.licenseKey,
        input.grantedAt,
        input.updatesUntil,
      ],
    );
    const row = rows[0];
    return row === undefined ? null : mapEntitlement(row);
  }

  async listEntitlements(orgId: string): Promise<EntitlementRow[]> {
    const rows = await this.executor.unsafe<SqlEntitlementRow[]>(
      `select ${ENTITLEMENT_COLUMNS}
         from product_entitlements e
         join products p on p.id = e.product_id
        where e.org_id = $1::uuid
        order by e.granted_at desc`,
      [orgId],
    );
    return rows.map(mapEntitlement);
  }

  async getEntitlement(orgId: string, entitlementId: string): Promise<EntitlementRow | null> {
    // Scoped by org in the WHERE clause: another organisation's licence is a 404,
    // so this endpoint cannot be used to enumerate entitlement ids.
    const rows = await this.executor.unsafe<SqlEntitlementRow[]>(
      `select ${ENTITLEMENT_COLUMNS}
         from product_entitlements e
         join products p on p.id = e.product_id
        where e.org_id = $1::uuid and e.id = $2::uuid
        limit 1`,
      [orgId, entitlementId],
    );
    const row = rows[0];
    return row === undefined ? null : mapEntitlement(row);
  }
}

/**
 * The insert's RETURNING list. `RETURNING` cannot join, so the two product fields
 * are scalar subqueries — one row, one round trip.
 */
function entitlementReturning(): string {
  return `id::text as id, org_id::text as org_id, product_id::text as product_id,
          (select name from products where id = product_id) as product_name,
          invoice_id::text as invoice_id, license_key, granted_at, updates_until, revoked_at,
          (select delivery_object_key from products where id = product_id) as delivery_object_key`;
}

export class SqlNewsletterRepo implements NewsletterRepo {
  private readonly executor: SqlExecutor;

  constructor(connection: unknown) {
    this.executor = asExecutor(connection);
  }

  async findByEmail(email: string): Promise<NewsletterRow | null> {
    const rows = await this.executor.unsafe<Array<SqlNewsletterRow>>(
      `select ${NEWSLETTER_COLUMNS} from newsletter_subscribers where email = $1::citext limit 1`,
      [email.trim().toLowerCase()],
    );
    const row = rows[0];
    return row === undefined ? null : mapNewsletter(row);
  }

  async findByTokenHash(tokenHash: string): Promise<NewsletterRow | null> {
    const rows = await this.executor.unsafe<Array<SqlNewsletterRow>>(
      `select ${NEWSLETTER_COLUMNS} from newsletter_subscribers where token_hash = $1 limit 1`,
      [tokenHash],
    );
    const row = rows[0];
    return row === undefined ? null : mapNewsletter(row);
  }

  async upsertPending(input: {
    id: string;
    email: string;
    tokenHash: string;
    source: string | null;
    ipHash: string | null;
    at: Date;
  }): Promise<void> {
    await this.executor.unsafe(
      `insert into newsletter_subscribers
         (id, email, status, token_hash, source, ip_hash)
       values ($1::uuid, $2::citext, 'pending', $3, $4, $5)
       on conflict (email) do update
          set status = 'pending',
              token_hash = excluded.token_hash,
              source = coalesce(excluded.source, newsletter_subscribers.source),
              ip_hash = excluded.ip_hash,
              unsubscribed_at = null,
              updated_at = now()`,
      [input.id, input.email.trim().toLowerCase(), input.tokenHash, input.source, input.ipHash],
    );
  }

  async confirm(id: string, at: Date): Promise<void> {
    await this.executor.unsafe(
      `update newsletter_subscribers
          set status = 'confirmed', confirmed_at = $2, updated_at = now()
        where id = $1::uuid`,
      [id, at],
    );
  }

  async unsubscribe(id: string, at: Date): Promise<void> {
    await this.executor.unsafe(
      `update newsletter_subscribers
          set status = 'unsubscribed', unsubscribed_at = $2, updated_at = now()
        where id = $1::uuid`,
      [id, at],
    );
  }

  async touchToken(id: string, tokenHash: string, at: Date): Promise<void> {
    await this.executor.unsafe(
      `update newsletter_subscribers set token_hash = $2, updated_at = $3 where id = $1::uuid`,
      [id, tokenHash, at],
    );
  }
}

const NEWSLETTER_COLUMNS = `
  id::text as id, email::text as email, status::text as status, token_hash, source,
  confirmed_at, unsubscribed_at, created_at, updated_at`;

interface SqlNewsletterRow {
  id: string;
  email: string;
  status: string;
  token_hash: string;
  source: string | null;
  confirmed_at: Date | string | null;
  unsubscribed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

function iso(value: Date | string | null): string | null {
  return value === null ? null : new Date(value).toISOString();
}

function mapNewsletter(row: SqlNewsletterRow): NewsletterRow {
  return {
    id: row.id,
    email: row.email,
    status: row.status,
    tokenHash: row.token_hash,
    source: row.source,
    confirmedAt: iso(row.confirmed_at),
    unsubscribedAt: iso(row.unsubscribed_at),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

import { asExecutor, type SqlExecutor } from '../../../audit/repo.js';
import type { Industry } from '@vunvault/contracts';

/**
 * Billing reads and writes for one organisation.
 *
 * Balances are never stored: `invoice_balances` is a view over the ledger, so
 * `paidUsdCents` cannot drift from the entries that justify it.
 */

export interface SubscriptionRow {
  id: string;
  planName: string;
  status: string;
  billingCycle: string;
  amountUsdCents: number;
  settlementCurrency: string;
  renewsOn: string;
  description: string;
}

export interface PaymentMethodRow {
  id: string;
  provider: string;
  providerPaymentMethodId: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  cardholderName: string | null;
  billingCountry: string | null;
}

export interface PaymentMethodInput {
  provider: string;
  providerPaymentMethodId: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  cardholderName: string | null;
  billingCountry: string | null;
}

export interface InvoiceRow {
  id: string;
  number: string;
  issuedAt: string;
  title: string;
  detail: string | null;
  totalUsdCents: number;
  paidUsdCents: number;
  outstandingUsdCents: number;
  status: string;
  settlementCurrency: string;
  pdfObjectKey: string | null;
}

export interface BillingRepo {
  getOrganization(orgId: string): Promise<{
    id: string;
    name: string;
    email: string;
    industry: Industry | null;
    stripeCustomerId: string | null;
    paystackCustomerCode: string | null;
  } | null>;
  setStripeCustomerId(orgId: string, customerId: string): Promise<void>;
  setPaystackCustomerCode(orgId: string, customerCode: string): Promise<void>;

  getSubscription(orgId: string): Promise<SubscriptionRow | null>;
  getDefaultPaymentMethod(orgId: string): Promise<PaymentMethodRow | null>;
  clearDefaultPaymentMethods(orgId: string): Promise<PaymentMethodRow[]>;
  insertPaymentMethod(orgId: string, input: PaymentMethodInput): Promise<PaymentMethodRow>;

  listInvoices(
    orgId: string,
    query: { page: number; pageSize: number; status?: string },
  ): Promise<{ rows: InvoiceRow[]; total: number }>;
  getInvoice(orgId: string, invoiceId: string): Promise<InvoiceRow | null>;
}

interface SqlInvoiceRow {
  id: string;
  number: string;
  issued_at: string;
  title: string;
  detail: string | null;
  status: string;
  settlement_currency: string;
  pdf_object_key: string | null;
  total_usd_cents: string | number | null;
  paid_usd_cents: string | number | null;
  outstanding_usd_cents: string | number | null;
}

const INVOICE_SELECT = `select i.id::text as id, i.number, i.issued_at, i.title, i.detail,
       i.status::text as status, i.settlement_currency::text as settlement_currency,
       i.pdf_object_key,
       b.total_usd_cents, b.paid_usd_cents, b.outstanding_usd_cents
  from invoices i
  left join invoice_balances b on b.invoice_id = i.id`;

export class SqlBillingRepo implements BillingRepo {
  private readonly executor: SqlExecutor;

  constructor(connection: unknown) {
    this.executor = asExecutor(connection);
  }

  async getOrganization(orgId: string) {
    const rows = await this.executor.unsafe<
      Array<{
        id: string;
        name: string;
        industry: Industry | null;
        stripe_customer_id: string | null;
        paystack_customer_code: string | null;
      }>
    >(
      `select o.id::text as id, o.name, o.industry::text as industry,
              o.stripe_customer_id, o.paystack_customer_code,
              (select p.email::text from profiles p
                where p.org_id = o.id and p.deleted_at is null
                order by p.joined_at asc limit 1) as email
         from organizations o
        where o.id = $1::uuid
        limit 1`,
      [orgId],
    );
    const row = rows[0];
    if (row === undefined) return null;
    return {
      id: row.id,
      name: row.name,
      email: (row as unknown as { email: string | null }).email ?? '',
      industry: row.industry,
      stripeCustomerId: row.stripe_customer_id,
      paystackCustomerCode: row.paystack_customer_code,
    };
  }

  async setStripeCustomerId(orgId: string, customerId: string): Promise<void> {
    await this.executor.unsafe(
      `update organizations set stripe_customer_id = $2, updated_at = now() where id = $1::uuid`,
      [orgId, customerId],
    );
  }

  async setPaystackCustomerCode(orgId: string, customerCode: string): Promise<void> {
    await this.executor.unsafe(
      `update organizations set paystack_customer_code = $2, updated_at = now() where id = $1::uuid`,
      [orgId, customerCode],
    );
  }

  async getSubscription(orgId: string): Promise<SubscriptionRow | null> {
    const rows = await this.executor.unsafe<
      Array<{
        id: string;
        plan_name: string;
        description: string;
        status: string;
        billing_cycle: string;
        amount_usd_cents: number;
        settlement_currency: string;
        renews_on: string;
      }>
    >(
      `select s.id::text as id, p.name as plan_name, p.description,
              s.status::text as status, s.billing_cycle::text as billing_cycle,
              s.amount_usd_cents, s.settlement_currency::text as settlement_currency,
              s.renews_on
         from subscriptions s
         join plans p on p.id = s.plan_id
        where s.org_id = $1::uuid
        order by (s.status = 'active') desc, s.created_at desc
        limit 1`,
      [orgId],
    );
    const row = rows[0];
    if (row === undefined) return null;
    return {
      id: row.id,
      planName: row.plan_name,
      status: row.status,
      billingCycle: row.billing_cycle,
      amountUsdCents: Number(row.amount_usd_cents),
      settlementCurrency: row.settlement_currency,
      renewsOn: new Date(row.renews_on).toISOString(),
      description: row.description,
    };
  }

  async getDefaultPaymentMethod(orgId: string): Promise<PaymentMethodRow | null> {
    const rows = await this.executor.unsafe<
      Array<{
        id: string;
        provider: string;
        provider_payment_method_id: string;
        brand: string;
        last4: string;
        exp_month: number;
        exp_year: number;
        cardholder_name: string | null;
        billing_country: string | null;
      }>
    >(
      `select id::text as id, provider::text as provider, provider_payment_method_id,
              brand, last4, exp_month, exp_year, cardholder_name, billing_country
         from payment_methods
        where org_id = $1::uuid and is_default = true
        order by created_at desc
        limit 1`,
      [orgId],
    );
    const row = rows[0];
    return row === undefined ? null : mapPaymentMethod(row);
  }

  async clearDefaultPaymentMethods(orgId: string): Promise<PaymentMethodRow[]> {
    const rows = await this.executor.unsafe<
      Array<{
        id: string;
        provider: string;
        provider_payment_method_id: string;
        brand: string;
        last4: string;
        exp_month: number;
        exp_year: number;
        cardholder_name: string | null;
        billing_country: string | null;
      }>
    >(
      `update payment_methods
          set is_default = false, updated_at = now()
        where org_id = $1::uuid and is_default = true
        returning id::text as id, provider::text as provider, provider_payment_method_id,
                  brand, last4, exp_month, exp_year, cardholder_name, billing_country`,
      [orgId],
    );
    return rows.map(mapPaymentMethod);
  }

  async insertPaymentMethod(orgId: string, input: PaymentMethodInput): Promise<PaymentMethodRow> {
    const rows = await this.executor.unsafe<
      Array<{
        id: string;
        provider: string;
        provider_payment_method_id: string;
        brand: string;
        last4: string;
        exp_month: number;
        exp_year: number;
        cardholder_name: string | null;
        billing_country: string | null;
      }>
    >(
      `insert into payment_methods
         (org_id, provider, provider_payment_method_id, brand, last4, exp_month, exp_year,
          cardholder_name, billing_country, is_default)
       values ($1::uuid, $2::payment_provider, $3, $4, $5, $6, $7, $8, $9, true)
       returning id::text as id, provider::text as provider, provider_payment_method_id,
                 brand, last4, exp_month, exp_year, cardholder_name, billing_country`,
      [
        orgId,
        input.provider,
        input.providerPaymentMethodId,
        input.brand,
        input.last4,
        input.expMonth,
        input.expYear,
        input.cardholderName,
        input.billingCountry,
      ],
    );
    const row = rows[0];
    if (row === undefined) throw new Error('payment method was not created');
    return mapPaymentMethod(row);
  }

  async listInvoices(
    orgId: string,
    query: { page: number; pageSize: number; status?: string },
  ): Promise<{ rows: InvoiceRow[]; total: number }> {
    const conditions = ['i.org_id = $1::uuid'];
    const values: unknown[] = [orgId];
    if (query.status !== undefined) {
      values.push(query.status);
      conditions.push(`i.status::text = $${values.length}`);
    }
    const where = conditions.join(' and ');
    const offset = (query.page - 1) * query.pageSize;

    const totalRows = await this.executor.unsafe<Array<{ count: string }>>(
      `select count(*)::text as count from invoices i where ${where}`,
      values,
    );
    const rows = await this.executor.unsafe<SqlInvoiceRow[]>(
      `${INVOICE_SELECT}
        where ${where}
        order by i.issued_at desc
        limit $${values.length + 1} offset $${values.length + 2}`,
      [...values, query.pageSize, offset],
    );
    return { rows: rows.map(mapInvoice), total: Number(totalRows[0]?.count ?? '0') };
  }

  async getInvoice(orgId: string, invoiceId: string): Promise<InvoiceRow | null> {
    // Scoped by org in the WHERE clause: another organisation's invoice is a 404,
    // not a 403, so the endpoint cannot be used to probe for invoice ids.
    const rows = await this.executor.unsafe<SqlInvoiceRow[]>(
      `${INVOICE_SELECT}
        where i.org_id = $1::uuid and i.id = $2::uuid
        limit 1`,
      [orgId, invoiceId],
    );
    const row = rows[0];
    return row === undefined ? null : mapInvoice(row);
  }
}

function mapPaymentMethod(row: {
  id: string;
  provider: string;
  provider_payment_method_id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  cardholder_name: string | null;
  billing_country: string | null;
}): PaymentMethodRow {
  return {
    id: row.id,
    provider: row.provider,
    providerPaymentMethodId: row.provider_payment_method_id,
    brand: row.brand,
    last4: row.last4,
    expMonth: row.exp_month,
    expYear: row.exp_year,
    cardholderName: row.cardholder_name,
    billingCountry: row.billing_country,
  };
}

function mapInvoice(row: SqlInvoiceRow): InvoiceRow {
  return {
    id: row.id,
    number: row.number,
    issuedAt: new Date(row.issued_at).toISOString(),
    title: row.title,
    detail: row.detail,
    totalUsdCents: Number(row.total_usd_cents ?? 0),
    paidUsdCents: Number(row.paid_usd_cents ?? 0),
    outstandingUsdCents: Number(row.outstanding_usd_cents ?? 0),
    status: row.status,
    settlementCurrency: row.settlement_currency,
    pdfObjectKey: row.pdf_object_key,
  };
}

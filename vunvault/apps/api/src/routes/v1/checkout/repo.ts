import { asExecutor, type SqlExecutor } from '../../../audit/repo';

/**
 * Checkout and FX-quote data access (Task 33).
 *
 * Two rules shape every statement here. Amounts are read from the ledger-derived
 * `invoice_balances` view, never from a mutable column, so `outstanding_usd_cents`
 * is the ledger's opinion and not a cached one. And every read is scoped by
 * `org_id` in the WHERE clause: another organisation's invoice or quote is a
 * "not found", so these endpoints cannot be used to probe for ids.
 */

export interface CheckoutInvoiceRow {
  id: string;
  orgId: string;
  number: string;
  title: string;
  status: string;
  /** From the `invoice_balances` view. The ONLY amount that is ever charged. */
  outstandingUsdCents: number;
}

export interface CheckoutOrganizationRow {
  id: string;
  name: string;
  /** Billing contact, required by Paystack to initialise a transaction. */
  email: string;
  stripeCustomerId: string | null;
  paystackCustomerCode: string | null;
}

export interface FxQuoteRow {
  id: string;
  orgId: string;
  invoiceId: string;
  displayCurrency: string;
  /** `numeric(18,8)` arrives as a string; it stays a string all the way to the client. */
  rateLocalPerUsd: string;
  usdCents: number;
  localMinor: number;
  lockedAt: string;
  expiresAt: string;
  consumedAt: string | null;
}

export interface PaymentAttemptRow {
  id: string;
  txnCode: string;
  invoiceId: string;
  fxQuoteId: string | null;
  provider: string;
  channel: string;
  providerReference: string | null;
  status: string;
  usdCents: number;
  settlementCurrency: string;
  idempotencyKey: string;
}

export interface NewFxQuote {
  id: string;
  orgId: string;
  invoiceId: string;
  displayCurrency: string;
  rateLocalPerUsd: string;
  usdCents: number;
  localMinor: number;
  lockedAt: Date;
  expiresAt: Date;
}

export interface NewPaymentAttempt {
  id: string;
  invoiceId: string;
  fxQuoteId: string | null;
  provider: string;
  channel: string;
  providerReference: string | null;
  status: string;
  usdCents: number;
  idempotencyKey: string;
  createdBy: string | null;
  /** Provider refusal code, when the charge did not go through. */
  failureCode: string | null;
}

export interface CheckoutRepo {
  getInvoice(orgId: string, invoiceId: string): Promise<CheckoutInvoiceRow | null>;
  getOrganization(orgId: string): Promise<CheckoutOrganizationRow | null>;
  setStripeCustomerId(orgId: string, customerId: string): Promise<void>;
  getDefaultPaymentMethodId(orgId: string, provider: string): Promise<string | null>;

  insertFxQuote(input: NewFxQuote): Promise<FxQuoteRow>;
  getFxQuote(orgId: string, quoteId: string): Promise<FxQuoteRow | null>;
  /** Atomic single-use consumption: false when another request consumed it first. */
  consumeFxQuote(quoteId: string, at: Date): Promise<boolean>;

  findAttemptByIdempotencyKey(
    orgId: string,
    idempotencyKey: string,
  ): Promise<PaymentAttemptRow | null>;
  insertPaymentAttempt(input: NewPaymentAttempt): Promise<PaymentAttemptRow>;
}

const INVOICE_SELECT = `select i.id::text as id, i.org_id::text as org_id, i.number, i.title,
       i.status::text as status,
       coalesce(b.outstanding_usd_cents, 0)::text as outstanding_usd_cents
  from invoices i
  left join invoice_balances b on b.invoice_id = i.id`;

const QUOTE_SELECT = `select q.id::text as id, q.org_id::text as org_id, q.invoice_id::text as invoice_id,
       q.display_currency::text as display_currency,
       q.rate_local_per_usd::text as rate_local_per_usd,
       q.usd_cents::text as usd_cents, q.local_minor::text as local_minor,
       q.locked_at, q.expires_at, q.consumed_at
  from fx_quotes q`;

const ATTEMPT_SELECT = `select pa.id::text as id, pa.txn_code, pa.invoice_id::text as invoice_id,
       pa.fx_quote_id::text as fx_quote_id, pa.provider::text as provider,
       pa.channel::text as channel, pa.provider_reference, pa.status::text as status,
       pa.usd_cents::text as usd_cents,
       pa.settlement_currency::text as settlement_currency, pa.idempotency_key
  from payment_attempts pa`;

interface SqlInvoiceRow {
  id: string;
  org_id: string;
  number: string;
  title: string;
  status: string;
  outstanding_usd_cents: string | number;
}

interface SqlQuoteRow {
  id: string;
  org_id: string;
  invoice_id: string;
  display_currency: string;
  rate_local_per_usd: string;
  usd_cents: string | number;
  local_minor: string | number;
  locked_at: string | Date;
  expires_at: string | Date;
  consumed_at: string | Date | null;
}

interface SqlAttemptRow {
  id: string;
  txn_code: string;
  invoice_id: string;
  fx_quote_id: string | null;
  provider: string;
  channel: string;
  provider_reference: string | null;
  status: string;
  usd_cents: string | number;
  settlement_currency: string;
  idempotency_key: string;
}

export class SqlCheckoutRepo implements CheckoutRepo {
  private readonly executor: SqlExecutor;

  constructor(connection: unknown) {
    this.executor = asExecutor(connection);
  }

  async getInvoice(orgId: string, invoiceId: string): Promise<CheckoutInvoiceRow | null> {
    const rows = await this.executor.unsafe<SqlInvoiceRow[]>(
      `${INVOICE_SELECT}
        where i.org_id = $1::uuid and i.id = $2::uuid
        limit 1`,
      [orgId, invoiceId],
    );
    const row = rows[0];
    if (row === undefined) return null;
    return {
      id: row.id,
      orgId: row.org_id,
      number: row.number,
      title: row.title,
      status: row.status,
      outstandingUsdCents: Number(row.outstanding_usd_cents),
    };
  }

  async getOrganization(orgId: string): Promise<CheckoutOrganizationRow | null> {
    const rows = await this.executor.unsafe<
      Array<{
        id: string;
        name: string;
        email: string | null;
        stripe_customer_id: string | null;
        paystack_customer_code: string | null;
      }>
    >(
      `select o.id::text as id, o.name, o.stripe_customer_id, o.paystack_customer_code,
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
      email: row.email ?? '',
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

  async getDefaultPaymentMethodId(orgId: string, provider: string): Promise<string | null> {
    const rows = await this.executor.unsafe<Array<{ provider_payment_method_id: string }>>(
      `select provider_payment_method_id
         from payment_methods
        where org_id = $1::uuid and provider = $2::payment_provider and is_default = true
        order by created_at desc
        limit 1`,
      [orgId, provider],
    );
    return rows[0]?.provider_payment_method_id ?? null;
  }

  async insertFxQuote(input: NewFxQuote): Promise<FxQuoteRow> {
    const rows = await this.executor.unsafe<SqlQuoteRow[]>(
      `insert into fx_quotes
         (id, org_id, invoice_id, display_currency, rate_local_per_usd, usd_cents, local_minor,
          locked_at, expires_at)
       values ($1::uuid, $2::uuid, $3::uuid, $4::display_currency, $5::numeric, $6, $7, $8, $9)
       returning ${quoteReturning()}`,
      [
        input.id,
        input.orgId,
        input.invoiceId,
        input.displayCurrency,
        input.rateLocalPerUsd,
        input.usdCents,
        input.localMinor,
        input.lockedAt,
        input.expiresAt,
      ],
    );
    const row = rows[0];
    if (row === undefined) throw new Error('fx quote was not created');
    return mapQuote(row);
  }

  async getFxQuote(orgId: string, quoteId: string): Promise<FxQuoteRow | null> {
    const rows = await this.executor.unsafe<SqlQuoteRow[]>(
      `${QUOTE_SELECT}
        where q.org_id = $1::uuid and q.id = $2::uuid
        limit 1`,
      [orgId, quoteId],
    );
    const row = rows[0];
    return row === undefined ? null : mapQuote(row);
  }

  async consumeFxQuote(quoteId: string, at: Date): Promise<boolean> {
    // `where consumed_at is null` makes the quote single-use even under two
    // concurrent checkouts: the loser updates zero rows and gets a 409.
    const rows = await this.executor.unsafe<Array<{ id: string }>>(
      `update fx_quotes set consumed_at = $2
        where id = $1::uuid and consumed_at is null
        returning id::text as id`,
      [quoteId, at],
    );
    return rows.length > 0;
  }

  async findAttemptByIdempotencyKey(
    orgId: string,
    idempotencyKey: string,
  ): Promise<PaymentAttemptRow | null> {
    // Joined through the invoice so the key is only ever matched inside the
    // caller's own organisation.
    const rows = await this.executor.unsafe<SqlAttemptRow[]>(
      `${ATTEMPT_SELECT}
        join invoices i on i.id = pa.invoice_id
        where i.org_id = $1::uuid and pa.idempotency_key = $2
        limit 1`,
      [orgId, idempotencyKey],
    );
    const row = rows[0];
    return row === undefined ? null : mapAttempt(row);
  }

  async insertPaymentAttempt(input: NewPaymentAttempt): Promise<PaymentAttemptRow> {
    const rows = await this.executor.unsafe<SqlAttemptRow[]>(
      `insert into payment_attempts
         (id, invoice_id, fx_quote_id, provider, channel, provider_reference, status,
          usd_cents, settlement_currency, idempotency_key, created_by, failure_code)
       values ($1::uuid, $2::uuid, $3::uuid, $4::payment_provider, $5::payment_channel, $6,
               $7::payment_attempt_status, $8, 'USD', $9, $10::uuid, $11)
       returning ${attemptReturning()}`,
      [
        input.id,
        input.invoiceId,
        input.fxQuoteId,
        input.provider,
        input.channel,
        input.providerReference,
        input.status,
        input.usdCents,
        input.idempotencyKey,
        input.createdBy,
        input.failureCode,
      ],
    );
    const row = rows[0];
    if (row === undefined) throw new Error('payment attempt was not created');
    return mapAttempt(row);
  }
}

/** The quote columns, written once so the insert and the read cannot drift. */
function quoteReturning(): string {
  return `id::text as id, org_id::text as org_id, invoice_id::text as invoice_id,
          display_currency::text as display_currency,
          rate_local_per_usd::text as rate_local_per_usd,
          usd_cents::text as usd_cents, local_minor::text as local_minor,
          locked_at, expires_at, consumed_at`;
}

function attemptReturning(): string {
  return `id::text as id, txn_code, invoice_id::text as invoice_id,
          fx_quote_id::text as fx_quote_id, provider::text as provider,
          channel::text as channel, provider_reference, status::text as status,
          usd_cents::text as usd_cents, settlement_currency::text as settlement_currency,
          idempotency_key`;
}

function mapQuote(row: SqlQuoteRow): FxQuoteRow {
  return {
    id: row.id,
    orgId: row.org_id,
    invoiceId: row.invoice_id,
    displayCurrency: row.display_currency,
    rateLocalPerUsd: row.rate_local_per_usd,
    usdCents: Number(row.usd_cents),
    localMinor: Number(row.local_minor),
    lockedAt: new Date(row.locked_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
    consumedAt: row.consumed_at === null ? null : new Date(row.consumed_at).toISOString(),
  };
}

function mapAttempt(row: SqlAttemptRow): PaymentAttemptRow {
  return {
    id: row.id,
    txnCode: row.txn_code,
    invoiceId: row.invoice_id,
    fxQuoteId: row.fx_quote_id,
    provider: row.provider,
    channel: row.channel,
    providerReference: row.provider_reference,
    status: row.status,
    usdCents: Number(row.usd_cents),
    settlementCurrency: row.settlement_currency,
    idempotencyKey: row.idempotency_key,
  };
}

/** `payment_attempts` has a UNIQUE idempotency key; Postgres reports it as 23505. */
export function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === '23505';
}

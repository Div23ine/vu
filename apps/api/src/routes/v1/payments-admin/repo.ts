import { asExecutor, type SqlExecutor } from '../../../audit/repo';

/**
 * Payment data access for webhooks and the payments admin routes (Task 34).
 *
 * One repo serves both because both work on the same rows: a webhook moves an
 * attempt to `succeeded` and posts the ledger entry; an admin refund moves money
 * back and posts a reversal. Neither is allowed to invent an amount — every
 * figure here is read back from a row that already exists.
 */

/** An attempt joined to its invoice, so a webhook needs one read to act. */
export interface WebhookAttemptRow {
  id: string;
  txnCode: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceStatus: string;
  /** The scan this invoice pays for, when it pays for one. */
  scanJobId: string | null;
  orgId: string;
  provider: string;
  channel: string;
  providerReference: string | null;
  status: string;
  usdCents: number;
  settlementCurrency: string;
  failureCode: string | null;
}

export interface InvoiceBalanceRow {
  totalUsdCents: number;
  paidUsdCents: number;
  outstandingUsdCents: number;
}

export interface ScanJobStateRow {
  id: string;
  paymentStatus: string;
  reviewGateState: string;
}

export interface BillingContactRow {
  userId: string;
  email: string;
}

/** One journal entry with both sides totalled, for reconciliation. */
export interface EntryBalanceRow {
  id: string;
  kind: string;
  debit: number;
  credit: number;
}

export interface PaymentsRepo {
  /** False when the event id was already stored: a provider replay. */
  recordWebhookEvent(provider: string, eventId: string, payload: unknown): Promise<boolean>;
  markEventProcessed(provider: string, eventId: string, at: Date): Promise<void>;

  findAttemptByProviderReference(
    provider: string,
    reference: string,
  ): Promise<WebhookAttemptRow | null>;
  findAttemptById(attemptId: string): Promise<WebhookAttemptRow | null>;
  setAttemptStatus(attemptId: string, status: string, failureCode: string | null): Promise<void>;

  getBalance(invoiceId: string): Promise<InvoiceBalanceRow>;
  setInvoiceStatus(invoiceId: string, status: string): Promise<void>;

  getScanJob(jobId: string): Promise<ScanJobStateRow | null>;
  setJobPaymentStatus(jobId: string, status: string): Promise<void>;
  setJobReviewGateState(jobId: string, state: string): Promise<void>;

  billingContacts(orgId: string): Promise<BillingContactRow[]>;

  /** Sum of the `refunds` debits on `refund` entries referencing this attempt. */
  refundedUsdCents(attemptId: string): Promise<number>;
  /** How many refund entries reference this attempt: the `n` in `refund:<id>:<n>`. */
  refundCount(attemptId: string): Promise<number>;

  // Reconciliation reads. Read-only: nothing here writes.
  listEntryBalances(): Promise<EntryBalanceRow[]>;
  listAttemptIds(): Promise<string[]>;
  listSucceededAttemptIds(): Promise<string[]>;
  listCapturedEntries(): Promise<Array<{ entryId: string; referenceId: string | null }>>;
  listInvoicesWithMismatchedStatus(): Promise<string[]>;
}

const ATTEMPT_SELECT = `select pa.id::text as id, pa.txn_code, pa.invoice_id::text as invoice_id,
       i.number as invoice_number, i.status::text as invoice_status,
       i.scan_job_id::text as scan_job_id, i.org_id::text as org_id,
       pa.provider::text as provider, pa.channel::text as channel, pa.provider_reference,
       pa.status::text as status, pa.usd_cents::text as usd_cents,
       pa.settlement_currency::text as settlement_currency, pa.failure_code
  from payment_attempts pa
  join invoices i on i.id = pa.invoice_id`;

interface SqlAttemptRow {
  id: string;
  txn_code: string;
  invoice_id: string;
  invoice_number: string;
  invoice_status: string;
  scan_job_id: string | null;
  org_id: string;
  provider: string;
  channel: string;
  provider_reference: string | null;
  status: string;
  usd_cents: string | number;
  settlement_currency: string;
  failure_code: string | null;
}

export class SqlPaymentsRepo implements PaymentsRepo {
  private readonly executor: SqlExecutor;

  constructor(connection: unknown) {
    this.executor = asExecutor(connection);
  }

  async recordWebhookEvent(provider: string, eventId: string, payload: unknown): Promise<boolean> {
    // `do nothing` rather than an exception: a replay is a normal event, not an
    // error, and the caller answers 200 without reprocessing.
    const rows = await this.executor.unsafe<Array<{ id: string }>>(
      `insert into provider_webhook_events (provider, event_id, payload)
       values ($1::payment_provider, $2, $3::jsonb)
       on conflict (provider, event_id) do nothing
       returning id::text as id`,
      [provider, eventId, JSON.stringify(payload)],
    );
    return rows.length > 0;
  }

  async markEventProcessed(provider: string, eventId: string, at: Date): Promise<void> {
    await this.executor.unsafe(
      `update provider_webhook_events set processed_at = $3
        where provider = $1::payment_provider and event_id = $2`,
      [provider, eventId, at],
    );
  }

  async findAttemptByProviderReference(
    provider: string,
    reference: string,
  ): Promise<WebhookAttemptRow | null> {
    const rows = await this.executor.unsafe<SqlAttemptRow[]>(
      `${ATTEMPT_SELECT}
        where pa.provider = $1::payment_provider and pa.provider_reference = $2
        limit 1`,
      [provider, reference],
    );
    const row = rows[0];
    return row === undefined ? null : mapAttempt(row);
  }

  async findAttemptById(attemptId: string): Promise<WebhookAttemptRow | null> {
    const rows = await this.executor.unsafe<SqlAttemptRow[]>(
      `${ATTEMPT_SELECT}
        where pa.id = $1::uuid
        limit 1`,
      [attemptId],
    );
    const row = rows[0];
    return row === undefined ? null : mapAttempt(row);
  }

  async setAttemptStatus(
    attemptId: string,
    status: string,
    failureCode: string | null,
  ): Promise<void> {
    await this.executor.unsafe(
      `update payment_attempts
          set status = $2::payment_attempt_status, failure_code = $3, updated_at = now()
        where id = $1::uuid`,
      [attemptId, status, failureCode],
    );
  }

  async getBalance(invoiceId: string): Promise<InvoiceBalanceRow> {
    const rows = await this.executor.unsafe<
      Array<{
        total_usd_cents: string | number | null;
        paid_usd_cents: string | number | null;
        outstanding_usd_cents: string | number | null;
      }>
    >(
      `select total_usd_cents, paid_usd_cents, outstanding_usd_cents
         from invoice_balances
        where invoice_id = $1::uuid
        limit 1`,
      [invoiceId],
    );
    const row = rows[0];
    return {
      totalUsdCents: Number(row?.total_usd_cents ?? 0),
      paidUsdCents: Number(row?.paid_usd_cents ?? 0),
      outstandingUsdCents: Number(row?.outstanding_usd_cents ?? 0),
    };
  }

  async setInvoiceStatus(invoiceId: string, status: string): Promise<void> {
    await this.executor.unsafe(
      `update invoices set status = $2::invoice_status, updated_at = now() where id = $1::uuid`,
      [invoiceId, status],
    );
  }

  async getScanJob(jobId: string): Promise<ScanJobStateRow | null> {
    const rows = await this.executor.unsafe<
      Array<{ id: string; payment_status: string; review_gate_state: string }>
    >(
      `select id::text as id, payment_status::text as payment_status,
              review_gate_state::text as review_gate_state
         from scan_jobs
        where id = $1::uuid
        limit 1`,
      [jobId],
    );
    const row = rows[0];
    if (row === undefined) return null;
    return {
      id: row.id,
      paymentStatus: row.payment_status,
      reviewGateState: row.review_gate_state,
    };
  }

  async setJobPaymentStatus(jobId: string, status: string): Promise<void> {
    await this.executor.unsafe(
      `update scan_jobs set payment_status = $2::payment_status, updated_at = now()
        where id = $1::uuid`,
      [jobId, status],
    );
  }

  async setJobReviewGateState(jobId: string, state: string): Promise<void> {
    await this.executor.unsafe(
      `update scan_jobs set review_gate_state = $2::review_gate_state, updated_at = now()
        where id = $1::uuid`,
      [jobId, state],
    );
  }

  async billingContacts(orgId: string): Promise<BillingContactRow[]> {
    // Everyone attached to the organisation who can still sign in: a receipt is
    // not a broadcast, but it must not go to a deleted account only.
    const rows = await this.executor.unsafe<Array<{ id: string; email: string }>>(
      `select p.id::text as id, p.email::text as email
         from profiles p
        where p.org_id = $1::uuid and p.deleted_at is null
          and p.account_status = 'active'
        order by p.joined_at asc
        limit 10`,
      [orgId],
    );
    return rows.map((row) => ({ userId: row.id, email: row.email }));
  }

  async refundedUsdCents(attemptId: string): Promise<number> {
    const rows = await this.executor.unsafe<Array<{ total: string | number }>>(
      `select coalesce(sum(ll.amount_usd_cents), 0)::text as total
         from journal_entries je
         join ledger_lines ll on ll.entry_id = je.id
        where je.kind = 'refund'
          and je.reference_type = 'payment_attempt'
          and je.reference_id = $1::uuid
          and ll.direction = 'debit'`,
      [attemptId],
    );
    return Number(rows[0]?.total ?? 0);
  }

  async refundCount(attemptId: string): Promise<number> {
    const rows = await this.executor.unsafe<Array<{ count: string | number }>>(
      `select count(*)::text as count from journal_entries
        where kind = 'refund' and reference_type = 'payment_attempt' and reference_id = $1::uuid`,
      [attemptId],
    );
    return Number(rows[0]?.count ?? 0);
  }

  async listEntryBalances(): Promise<EntryBalanceRow[]> {
    const rows = await this.executor.unsafe<
      Array<{ id: string; kind: string; debit: string | number; credit: string | number }>
    >(
      `select je.id::text as id, je.kind::text as kind,
              coalesce(sum(ll.amount_usd_cents) filter (where ll.direction = 'debit'), 0)::text as debit,
              coalesce(sum(ll.amount_usd_cents) filter (where ll.direction = 'credit'), 0)::text as credit
         from journal_entries je
         left join ledger_lines ll on ll.entry_id = je.id
        group by je.id, je.kind
        order by je.id`,
    );
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      debit: Number(row.debit),
      credit: Number(row.credit),
    }));
  }

  async listAttemptIds(): Promise<string[]> {
    const rows = await this.executor.unsafe<Array<{ id: string }>>(
      `select id::text as id from payment_attempts order by id`,
    );
    return rows.map((row) => row.id);
  }

  async listSucceededAttemptIds(): Promise<string[]> {
    const rows = await this.executor.unsafe<Array<{ id: string }>>(
      `select id::text as id from payment_attempts where status = 'succeeded' order by id`,
    );
    return rows.map((row) => row.id);
  }

  async listCapturedEntries(): Promise<Array<{ entryId: string; referenceId: string | null }>> {
    const rows = await this.executor.unsafe<Array<{ id: string; reference_id: string | null }>>(
      `select id::text as id, reference_id::text as reference_id from journal_entries
        where kind = 'payment_captured'
        order by id`,
    );
    return rows.map((row) => ({ entryId: row.id, referenceId: row.reference_id }));
  }

  async listInvoicesWithMismatchedStatus(): Promise<string[]> {
    // `paid` with money outstanding, or nothing outstanding and still open. A
    // `void` invoice is settled by definition (it was refunded).
    const rows = await this.executor.unsafe<Array<{ id: string }>>(
      `select i.id::text as id
         from invoices i
         join invoice_balances b on b.invoice_id = i.id
        where (i.status = 'paid' and b.outstanding_usd_cents <> 0)
           or (b.outstanding_usd_cents = 0 and i.status not in ('paid', 'void'))
        order by i.id`,
    );
    return rows.map((row) => row.id);
  }
}

function mapAttempt(row: SqlAttemptRow): WebhookAttemptRow {
  return {
    id: row.id,
    txnCode: row.txn_code,
    invoiceId: row.invoice_id,
    invoiceNumber: row.invoice_number,
    invoiceStatus: row.invoice_status,
    scanJobId: row.scan_job_id,
    orgId: row.org_id,
    provider: row.provider,
    channel: row.channel,
    providerReference: row.provider_reference,
    status: row.status,
    usdCents: Number(row.usd_cents),
    settlementCurrency: row.settlement_currency,
    failureCode: row.failure_code,
  };
}

/** The cash clearing account a provider settles into. */
export function clearingAccountFor(
  provider: string,
): 'cash_stripe_clearing' | 'cash_paystack_clearing' {
  return provider === 'stripe' ? 'cash_stripe_clearing' : 'cash_paystack_clearing';
}

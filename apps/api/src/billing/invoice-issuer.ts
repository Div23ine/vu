import { HttpError } from '../lib/http-error.js';
import { LedgerService, type InvoiceRevenueKind } from './ledger.js';
import { nextInvoiceNumber } from './invoice-number.js';
import { asExecutor } from '../audit/repo.js';

/**
 * Invoice issuance.
 *
 * An invoice is a *view* over the ledger: issuing one writes the invoice rows and
 * posts a single balanced `invoice_issued` entry in the same transaction, so there
 * is never an invoice without its receivable or a receivable without its invoice.
 *
 * The issuer does NOT audit. Its caller is a route wrapped in `audited()`, which
 * already appends `INVOICE_ISSUED` to the same transaction — auditing twice would
 * double-count the event in the chain.
 */

export interface InvoiceLineInput {
  description: string;
  quantity: number;
  unitUsdCents: number;
  /** Present when the line is a subscription: it picks the revenue account. */
  planCode?: string | null;
}

export interface IssueInvoiceInput {
  orgId: string;
  title: string;
  detail?: string | null;
  lines: InvoiceLineInput[];
  /** Payment terms in days. */
  dueInDays?: number;
  scanJobId?: string | null;
  /** Which revenue account the entry credits; defaults to a service sale. */
  kind?: InvoiceRevenueKind;
  issuedBy?: string | null;
  issuedAt?: Date;
}

export interface IssuedInvoice {
  id: string;
  number: string;
  totalUsdCents: number;
  issuedAt: string;
  dueAt: string;
  ledgerEntryId: string;
  lineCount: number;
}

export const DEFAULT_DUE_IN_DAYS = 14;
export const INVOICE_STATUS_PENDING = 'pending';
export const SETTLEMENT_CURRENCY = 'USD';

/** Plan codes that settle against subscription revenue rather than services. */
const SUBSCRIPTION_KIND_PREFIXES = ['plan', 'subscription'];

export function revenueKindFor(input: IssueInvoiceInput): InvoiceRevenueKind {
  if (input.kind !== undefined) return input.kind;
  const codes = input.lines
    .map((line) => (line.planCode ?? '').toLowerCase())
    .filter((code) => code !== '');
  if (
    codes.length > 0 &&
    codes.every((code) => SUBSCRIPTION_KIND_PREFIXES.some((prefix) => code.startsWith(prefix)))
  ) {
    return 'subscription';
  }
  if (codes.some((code) => code.startsWith('academy') || code.startsWith('training'))) {
    return 'academy';
  }
  return 'service';
}

export class InvoiceIssuer {
  constructor(private readonly ledger: LedgerService = new LedgerService()) {}

  async issue(tx: unknown, input: IssueInvoiceInput): Promise<IssuedInvoice> {
    if (input.lines.length === 0) {
      throw HttpError.badRequest('validation_failed', [
        { path: ['lines'], message: 'An invoice needs at least one line' },
      ]);
    }
    for (const line of input.lines) {
      if (!Number.isSafeInteger(line.unitUsdCents) || line.unitUsdCents <= 0) {
        throw HttpError.badRequest('validation_failed', [
          { path: ['lines'], message: 'Unit prices are positive whole USD cents' },
        ]);
      }
      if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
        throw HttpError.badRequest('validation_failed', [
          { path: ['lines'], message: 'Quantities are positive whole numbers' },
        ]);
      }
    }

    const executor = asExecutor(tx);
    const issuedAt = input.issuedAt ?? new Date();
    const dueInDays = input.dueInDays ?? DEFAULT_DUE_IN_DAYS;
    const allocated = await nextInvoiceNumber(tx, issuedAt.getUTCFullYear());

    const totalUsdCents = input.lines.reduce(
      (total, line) => total + line.quantity * line.unitUsdCents,
      0,
    );

    const invoices = await executor.unsafe<Array<{ id: string; number: string }>>(
      `insert into invoices
         (number, org_id, status, issued_at, due_at, title, detail, settlement_currency, scan_job_id)
       values ($1, $2::uuid, $3::invoice_status, $4, $5, $6, $7, $8::settlement_currency, $9::uuid)
       returning id::text as id, number`,
      [
        allocated.formatted,
        input.orgId,
        INVOICE_STATUS_PENDING,
        issuedAt,
        new Date(issuedAt.getTime() + dueInDays * 24 * 60 * 60 * 1000),
        input.title,
        input.detail ?? null,
        SETTLEMENT_CURRENCY,
        input.scanJobId ?? null,
      ],
    );
    const invoice = invoices[0];
    if (invoice === undefined) throw new Error('invoice was not created');

    const lineIds: string[] = [];
    for (const line of input.lines) {
      const rows = await executor.unsafe<Array<{ id: string }>>(
        `insert into invoice_lines (invoice_id, description, quantity, unit_usd_cents)
         values ($1::uuid, $2, $3, $4)
         returning id::text as id`,
        [invoice.id, line.description, line.quantity, line.unitUsdCents],
      );
      const row = rows[0];
      if (row !== undefined) lineIds.push(row.id);
    }

    const kind = revenueKindFor(input);
    const revenueAccount = LEDGER_REVENUE_ACCOUNTS[kind];
    const posted = await this.ledger.post(tx, {
      orgId: input.orgId,
      kind: 'invoice_issued',
      memo: `${allocated.formatted} — ${input.title}`,
      referenceType: 'invoice',
      referenceId: invoice.id,
      // One entry per invoice, forever: re-issuing the same invoice cannot post twice.
      idempotencyKey: `inv:${invoice.id}`,
      createdBy: input.issuedBy ?? null,
      occurredAt: issuedAt,
      lines: [
        { accountCode: 'accounts_receivable', direction: 'debit', amountUsdCents: totalUsdCents },
        { accountCode: revenueAccount, direction: 'credit', amountUsdCents: totalUsdCents },
      ],
    });

    // The lines point at the entry that justifies them.
    for (const lineId of lineIds) {
      await executor.unsafe(
        `update invoice_lines set ledger_entry_id = $2::uuid where id = $1::uuid`,
        [lineId, posted.entryId],
      );
    }

    return {
      id: invoice.id,
      number: invoice.number,
      totalUsdCents,
      issuedAt: issuedAt.toISOString(),
      dueAt: new Date(issuedAt.getTime() + dueInDays * 24 * 60 * 60 * 1000).toISOString(),
      ledgerEntryId: posted.entryId,
      lineCount: lineIds.length,
    };
  }
}

export const LEDGER_REVENUE_ACCOUNTS: Record<InvoiceRevenueKind, string> = {
  service: 'revenue_services',
  subscription: 'revenue_subscription',
  academy: 'revenue_academy',
};

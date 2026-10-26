import { asExecutor, type SqlExecutor } from '../audit/repo.js';
import { HttpError } from '../lib/http-error.js';

/**
 * Double-entry ledger.
 *
 * MONEY RULES — these are the rules every billing task obeys:
 *
 * 1. Settlement is USD, always. Every amount in this module is an integer number
 *    of USD cents. A local-currency figure only ever exists as a *display* value
 *    derived from a locked FX quote; it is never settled and never posted here.
 * 2. The ledger is the source of truth. Invoices are views over it — there is no
 *    mutable "paid" column anywhere to drift out of step.
 * 3. Ledger rows are immutable. A correction is a new reversal entry, never an
 *    UPDATE of an existing line.
 * 4. No raw card data ever touches this API. Browsers tokenise with Stripe.js or
 *    Paystack Inline; we only ever receive and store a token or authorisation id.
 * 5. No cryptocurrency. There is no provider, account or currency for one, and
 *    none will be added.
 */

export type LedgerDirection = 'debit' | 'credit';

export interface LedgerLineInput {
  /** `ledger_accounts.code`, e.g. `accounts_receivable`. */
  accountCode: string;
  direction: LedgerDirection;
  amountUsdCents: number;
}

export interface LedgerEntryInput {
  orgId: string;
  kind: string;
  memo: string;
  referenceType?: string | null;
  referenceId?: string | null;
  /** Required: a replayed request must never post twice. */
  idempotencyKey: string;
  lines: LedgerLineInput[];
  createdBy?: string | null;
  occurredAt?: Date;
}

export interface PostedEntry {
  entryId: string;
  /** True when an entry with this idempotency key already existed. */
  duplicated: boolean;
}

/**
 * The posting recipes. Each business event names exactly one recipe, so the debit
 * and credit accounts cannot be chosen ad hoc at a call site.
 */
export const LEDGER_RECIPES = {
  /** Debit what the client owes; credit the revenue line for what was sold. */
  invoice_issued: {
    debit: 'accounts_receivable',
    creditByKind: {
      service: 'revenue_services',
      subscription: 'revenue_subscription',
      academy: 'revenue_academy',
    },
  },
  /** Cash lands in the provider's clearing account against the receivable. */
  payment_captured: {
    debitByProvider: { stripe: 'cash_stripe_clearing', paystack: 'cash_paystack_clearing' },
    credit: 'accounts_receivable',
  },
  /** A refund is an expense against the same clearing account the cash came in on. */
  refund: {
    debit: 'refunds',
    creditByProvider: { stripe: 'cash_stripe_clearing', paystack: 'cash_paystack_clearing' },
  },
} as const;

export type InvoiceRevenueKind = keyof (typeof LEDGER_RECIPES)['invoice_issued']['creditByKind'];
export type PaymentProviderName =
  keyof (typeof LEDGER_RECIPES)['payment_captured']['debitByProvider'];

export class LedgerService {
  /**
   * Posts one balanced entry.
   *
   * Validation happens before anything is written: an unbalanced entry, a zero or
   * fractional amount, or an unknown account code is refused, so a half-written
   * journal is impossible.
   */
  async post(tx: unknown, input: LedgerEntryInput): Promise<PostedEntry> {
    const executor = asExecutor(tx);

    assertPositiveAmounts(input.lines);
    assertBalanced(input.lines);

    // Replay protection: the same idempotency key returns the original entry.
    const existing = await executor.unsafe<Array<{ id: string }>>(
      `select id::text as id from journal_entries where idempotency_key = $1 limit 1`,
      [input.idempotencyKey],
    );
    const first = existing[0];
    if (first !== undefined) return { entryId: first.id, duplicated: true };

    const codes = [...new Set(input.lines.map((line) => line.accountCode))];
    const accounts = await executor.unsafe<Array<{ id: string; code: string }>>(
      `select id::text as id, code from ledger_accounts where code = any($1::text[])`,
      [codes],
    );
    const byCode = new Map(accounts.map((account) => [account.code, account.id]));
    for (const code of codes) {
      if (!byCode.has(code)) {
        throw new HttpError(422, 'unknown_account', `No ledger account with code ${code}`);
      }
    }

    const entries = await executor.unsafe<Array<{ id: string }>>(
      `insert into journal_entries
         (org_id, kind, memo, occurred_at, reference_type, reference_id, idempotency_key, created_by)
       values ($1::uuid, $2::journal_kind, $3, $4, $5::ledger_reference, $6::uuid, $7, $8::uuid)
       returning id::text as id`,
      [
        input.orgId,
        input.kind,
        input.memo,
        input.occurredAt ?? new Date(),
        input.referenceType ?? null,
        input.referenceId ?? null,
        input.idempotencyKey,
        input.createdBy ?? null,
      ],
    );
    const entry = entries[0];
    if (entry === undefined) throw new Error('ledger entry was not created');

    for (const line of input.lines) {
      await executor.unsafe(
        `insert into ledger_lines (entry_id, account_id, direction, amount_usd_cents)
         values ($1::uuid, $2::uuid, $3::ledger_direction, $4)`,
        [entry.id, byCode.get(line.accountCode), line.direction, line.amountUsdCents],
      );
    }

    return { entryId: entry.id, duplicated: false };
  }

  /** Total of one side, in USD cents. */
  static side(lines: LedgerLineInput[], direction: LedgerDirection): number {
    return lines
      .filter((line) => line.direction === direction)
      .reduce((total, line) => total + line.amountUsdCents, 0);
  }
}

/** Every amount is a positive safe integer: no zeros, no negatives, no cents-of-cents. */
export function assertPositiveAmounts(lines: LedgerLineInput[]): void {
  if (lines.length === 0) {
    throw HttpError.badRequest('validation_failed', [
      { path: ['lines'], message: 'A ledger entry needs at least one line' },
    ]);
  }
  for (const line of lines) {
    if (!Number.isSafeInteger(line.amountUsdCents) || line.amountUsdCents <= 0) {
      throw HttpError.badRequest('validation_failed', [
        {
          path: ['lines', line.accountCode],
          message: 'Amounts are positive whole USD cents',
        },
      ]);
    }
  }
}

export function assertBalanced(lines: LedgerLineInput[]): void {
  const debit = LedgerService.side(lines, 'debit');
  const credit = LedgerService.side(lines, 'credit');
  if (debit !== credit) {
    throw HttpError.badRequest('validation_failed', [
      { path: ['lines'], message: `Entry is not balanced: ${debit} debit vs ${credit} credit` },
    ]);
  }
}

export type { SqlExecutor };

import { asExecutor } from '../audit/repo';

/**
 * Per-year invoice counters.
 *
 * The number is allocated inside the caller's transaction, so an invoice that
 * rolls back never burns a number and two concurrent issues can never collide:
 * `INSERT … ON CONFLICT DO UPDATE … RETURNING last` is atomic on the row.
 */

export const INVOICE_NUMBER_PREFIX = 'VV-INV';
export const INVOICE_NUMBER_PADDING = 4;

export interface InvoiceNumber {
  /** e.g. `VV-INV-2026-0842`. */
  formatted: string;
  year: number;
  counter: number;
}

export async function nextInvoiceNumber(tx: unknown, year: number): Promise<InvoiceNumber> {
  const executor = asExecutor(tx);
  const rows = await executor.unsafe<Array<{ last: number }>>(
    `insert into invoice_counters (year, last)
     values ($1, 1)
     on conflict (year) do update set last = invoice_counters.last + 1
     returning last`,
    [year],
  );
  const counter = Number(rows[0]?.last ?? 1);
  return { formatted: formatInvoiceNumber(year, counter), year, counter };
}

export function formatInvoiceNumber(year: number, counter: number): string {
  return `${INVOICE_NUMBER_PREFIX}-${year}-${String(counter).padStart(INVOICE_NUMBER_PADDING, '0')}`;
}

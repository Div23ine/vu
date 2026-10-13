/**
 * CSV writer.
 *
 * A cell that begins with `=`, `+`, `-` or `@` is a formula to Excel and Google
 * Sheets: exporting an attacker-controlled invoice title unescaped would let
 * `=cmd()` run on a finance analyst's machine. Every such cell is prefixed with a
 * single quote, which both applications display literally and neither executes.
 */

export const FORMULA_PREFIXES = ['=', '+', '-', '@'] as const;
export const CRLF = '\r\n';

export function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);

  let safe = text;
  if (safe !== '' && (FORMULA_PREFIXES as readonly string[]).includes(safe.charAt(0))) {
    safe = `'${safe}`;
  }
  // A control character (including a newline) always forces quoting.
  if (safe.includes('"') || safe.includes(',') || safe.includes('\n') || safe.includes('\r')) {
    safe = `"${safe.replaceAll('"', '""')}"`;
  }
  return safe;
}

export function csvRow(cells: Array<string | number | null | undefined>): string {
  return cells.map(escapeCsvCell).join(',');
}

export function csvDocument(
  header: string[],
  rows: Array<Array<string | number | null | undefined>>,
): string {
  return [csvRow(header), ...rows.map(csvRow)].join(CRLF) + CRLF;
}

/**
 * Streams a CSV without holding the whole document in memory: the route pipes the
 * returned iterable straight to the response.
 */
export function* csvStream(
  header: string[],
  rows: Iterable<Array<string | number | null | undefined>>,
): Generator<string> {
  yield csvRow(header) + CRLF;
  for (const row of rows) yield csvRow(row) + CRLF;
}

/** The invoice export header, verbatim. */
export const INVOICE_CSV_HEADER = [
  'Order / Invoice ID',
  'Date',
  'Service Description',
  'Status',
  'Amount (USD)',
] as const;

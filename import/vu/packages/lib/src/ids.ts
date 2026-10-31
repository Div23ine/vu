/**
 * Human-readable identifiers. The database stores an integer sequence and, where
 * the code is user-facing, a generated column; these helpers are the single place
 * the string form is built and parsed.
 *
 * `JOB-4471` · `VV-INV-2026-0841` · `VV-PT-000123` · `VV-CL-48210`
 */

function pad(value: number, width: number): string {
  return String(Math.trunc(value)).padStart(width, '0');
}

function parseDigits(pattern: RegExp, value: string): number | null {
  const match = pattern.exec(value.trim());
  if (match?.[1] === undefined) return null;
  const parsed = Number(match[1]);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

const JOB_CODE_PATTERN = /^JOB-(\d{4,})$/;
const INVOICE_NUMBER_PATTERN = /^VV-INV-(\d{4})-(\d{4,})$/;
const PENTEST_REF_PATTERN = /^VV-PT-(\d{6,})$/;
const CLIENT_CODE_PATTERN = /^VV-CL-(\d{5,})$/;

/** `"JOB-4471"` — at least four digits, zero-padded. */
export function formatJobCode(n: number): string {
  return `JOB-${pad(n, 4)}`;
}

export function parseJobCode(value: string): number | null {
  return parseDigits(JOB_CODE_PATTERN, value);
}

/** `"VV-INV-2026-0841"` — sequence padded to four digits. */
export function formatInvoiceNumber(year: number, n: number): string {
  return `VV-INV-${pad(year, 4)}-${pad(n, 4)}`;
}

export function parseInvoiceNumber(value: string): { year: number; n: number } | null {
  const match = INVOICE_NUMBER_PATTERN.exec(value.trim());
  const yearText = match?.[1];
  const sequenceText = match?.[2];
  if (yearText === undefined || sequenceText === undefined) return null;
  const year = Number(yearText);
  const n = Number(sequenceText);
  if (!Number.isSafeInteger(year) || !Number.isSafeInteger(n)) return null;
  return { year, n };
}

/** `"VV-PT-000123"` — sequence padded to six digits. */
export function formatPentestRef(n: number): string {
  return `VV-PT-${pad(n, 6)}`;
}

export function parsePentestRef(value: string): number | null {
  return parseDigits(PENTEST_REF_PATTERN, value);
}

/** `"VV-CL-48210"` — sequence padded to five digits. */
export function formatClientCode(n: number): string {
  return `VV-CL-${pad(n, 5)}`;
}

export function parseClientCode(value: string): number | null {
  return parseDigits(CLIENT_CODE_PATTERN, value);
}

import type { AuditEntryView } from '../../../audit/service';
import { CRLF, csvDocument, csvRow, escapeCsvCell } from '../../../billing/csv';

/**
 * The audit CSV export.
 *
 * Nine columns, in this order, and no others: `details`, the signature, the key id
 * and any sealed payload stay in the database. A CSV is something an auditor
 * emails around, and the chain's whole value depends on the hashes staying inside
 * the system that can verify them.
 *
 * Cells go through the same formula-injection guard the invoice export uses: a
 * message that begins with `=`, `+`, `-` or `@` is prefixed so a spreadsheet reads
 * it as text instead of executing it. Audit messages contain user-supplied
 * fragments (an email address, a note), so this is not theoretical.
 */

export const AUDIT_CSV_HEADER = [
  'Time (UTC)',
  'Seq',
  'Category',
  'Event',
  'Severity',
  'Actor',
  'Subject',
  'Message',
  'Hash',
] as const;

export const AUDIT_CSV_FILENAME_PREFIX = 'vunvault-audit-';

/** Export in batches of a thousand rows, up to a hundred thousand in total. */
export const EXPORT_BATCH_SIZE = 1_000;
export const EXPORT_MAX_ROWS = 100_000;

/** `vunvault-audit-2026-10-06.csv`, dated in UTC. */
export function auditCsvFilename(now: Date): string {
  return `${AUDIT_CSV_FILENAME_PREFIX}${now.toISOString().slice(0, 10)}.csv`;
}

export function auditCsvCells(entry: AuditEntryView): string[] {
  return [
    entry.createdAt,
    String(entry.seq),
    entry.category,
    entry.eventType,
    entry.severity,
    entry.actorLabel,
    entry.subject ?? '',
    entry.message,
    entry.hash,
  ];
}

/** One escaped line, CRLF-terminated like every other export this API writes. */
export function auditCsvRow(entry: AuditEntryView): string {
  return csvRow(auditCsvCells(entry)) + CRLF;
}

export function auditCsvDocument(entries: readonly AuditEntryView[]): string {
  return csvDocument([...AUDIT_CSV_HEADER], entries.map(auditCsvCells));
}

/** A header line, for a stream that writes rows as it fetches them. */
export function auditCsvHeaderLine(): string {
  return csvRow([...AUDIT_CSV_HEADER]) + CRLF;
}

export { escapeCsvCell };

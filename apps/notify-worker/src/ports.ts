import type { FindingSeverity, NotificationEvent, ScanType } from '@vunvault/contracts';
import type { ObjectWriter } from '@vunvault/lib/storage';

/**
 * Ports (Task 90) — the seams the notify worker depends on.
 *
 * Everything behind an interface here is external (Postgres, R2, Resend, the
 * SMS router, the PDF renderer), so `notify-handler.ts` and `pdf-handler.ts`
 * are testable with fakes and never touch I/O directly.
 */

/** One delivery attempt, recorded whatever the outcome. */
export interface ReceiptInput {
  channel: 'in_app' | 'email' | 'sms' | 'push';
  /** E-mail address, E.164 number, or user id — whatever was targeted. */
  destination: string;
  template: string | null;
  status: 'sent' | 'failed' | 'skipped';
  providerMessageId?: string | null;
  error?: string | null;
}

/** The in-app inbox row. */
export interface InboxInput {
  userId: string;
  event: NotificationEvent;
  title: string;
  body: string;
}

export interface InvoiceLineView {
  description: string;
  quantity: number;
  unitUsdCents: number;
}

export interface InvoiceView {
  id: string;
  number: string;
  orgName: string;
  orgClientCode: string;
  title: string;
  detail: string | null;
  status: string;
  issuedAt: Date;
  dueAt: Date | null;
  settlementCurrency: string;
  lines: InvoiceLineView[];
}

export interface ReportFindingView {
  severity: FindingSeverity;
  title: string;
  cwe: string | null;
  cvss: string | null;
  status: string;
  remediationGuidance: string | null;
}

export interface ReportView {
  id: string;
  jobCode: string | null;
  targetHost: string;
  scanType: ScanType;
  status: string;
  releasedAt: Date | null;
  findings: ReportFindingView[];
}

export interface NotifyRepo {
  insertInbox(input: InboxInput): Promise<void>;
  insertReceipt(input: ReceiptInput): Promise<void>;
  getInvoice(invoiceId: string): Promise<InvoiceView | null>;
  setInvoicePdfKey(invoiceId: string, key: string): Promise<void>;
  getReport(scanJobId: string): Promise<ReportView | null>;
  setReportObjectKey(scanJobId: string, key: string): Promise<void>;
}

/** A rendered document. */
export interface PdfRenderer {
  render(document: unknown): Promise<Uint8Array>;
}

export type { ObjectWriter };

export interface Clock {
  now(): Date;
}

export interface Logger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  debug(message: string, fields?: Record<string, unknown>): void;
}

import { UnrecoverableError } from 'bullmq';
import type { PdfJobPayload } from '@vunvault/contracts';
import { InvoiceDocument } from '../pdf/invoice.js';
import { ReportDocument } from '../pdf/report.js';
import type { Clock, Logger, NotifyRepo, ObjectWriter, PdfRenderer } from '../ports.js';

/**
 * PDF-queue handling (Task 90).
 *
 * `invoice` and `report` jobs carry only a reference id: the worker loads the
 * rows, renders, uploads to R2 and stores the key on the row. Rendering is
 * idempotent by key — a retry overwrites the same object — and a missing row
 * is PERMANENT (the producer referenced something that does not exist; three
 * retries will not conjure it). An upload failure is transient and rethrows.
 *
 * Keys:
 *   invoices/<number>.pdf    — e.g. invoices/VV-INV-2026-0841.pdf
 *   reports/<jobCode>.pdf    — e.g. reports/JOB-4471.pdf (falls back to the
 *                              job uuid while `job_code` is still generating)
 */

export const PDF_CONTENT_TYPE = 'application/pdf';

export function invoiceKey(invoiceNumber: string): string {
  return `invoices/${invoiceNumber}.pdf`;
}

export function reportKey(jobCode: string | null, scanJobId: string): string {
  return `reports/${jobCode ?? scanJobId}.pdf`;
}

export interface PdfHandlerDeps {
  repo: NotifyRepo;
  renderer: PdfRenderer;
  storage: ObjectWriter;
  clock: Clock;
  logger: Logger;
}

export interface PdfOutcome {
  kind: PdfJobPayload['kind'];
  key: string;
  bytes: number;
}

export class PdfHandler {
  private readonly deps: PdfHandlerDeps;

  constructor(deps: PdfHandlerDeps) {
    this.deps = deps;
  }

  async handle(payload: PdfJobPayload): Promise<PdfOutcome> {
    return payload.kind === 'invoice'
      ? this.handleInvoice(payload.refId)
      : this.handleReport(payload.refId);
  }

  private async handleInvoice(invoiceId: string): Promise<PdfOutcome> {
    const invoice = await this.deps.repo.getInvoice(invoiceId);
    if (invoice === null) {
      this.deps.logger.error('invoice row is missing for a pdf job', { invoiceId });
      throw new UnrecoverableError('invoice_missing');
    }

    const generatedAt = this.deps.clock.now().toISOString();
    const bytes = await this.deps.renderer.render(InvoiceDocument({ invoice, generatedAt }));
    const key = invoiceKey(invoice.number);
    await this.deps.storage.put(key, bytes, PDF_CONTENT_TYPE);
    await this.deps.repo.setInvoicePdfKey(invoice.id, key);

    this.deps.logger.info('invoice pdf rendered', { invoiceId, key, bytes: bytes.length });
    return { kind: 'invoice', key, bytes: bytes.length };
  }

  private async handleReport(scanJobId: string): Promise<PdfOutcome> {
    const report = await this.deps.repo.getReport(scanJobId);
    if (report === null) {
      this.deps.logger.error('scan job row is missing for a pdf job', { scanJobId });
      throw new UnrecoverableError('scan_job_missing');
    }

    const generatedAt = this.deps.clock.now().toISOString();
    const bytes = await this.deps.renderer.render(ReportDocument({ report, generatedAt }));
    const key = reportKey(report.jobCode, report.id);
    await this.deps.storage.put(key, bytes, PDF_CONTENT_TYPE);
    await this.deps.repo.setReportObjectKey(report.id, key);

    this.deps.logger.info('report pdf rendered', {
      scanJobId,
      key,
      bytes: bytes.length,
      findings: report.findings.length,
    });
    return { kind: 'report', key, bytes: bytes.length };
  }
}

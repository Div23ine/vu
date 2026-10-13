import { asc, eq } from 'drizzle-orm';
import {
  invoiceLines,
  invoices,
  notifications,
  notificationReceipts,
  organizations,
  scanFindings,
  scanJobs,
  type Db,
} from '@vunvault/db';
import type { ScanType } from '@vunvault/contracts';
import type { InboxInput, InvoiceView, NotifyRepo, ReceiptInput, ReportView } from '../ports';

/**
 * Postgres adapter for the notify worker (Task 90).
 *
 * The worker writes exactly three things: inbox rows, receipt rows, and the
 * PDF object keys after an upload. It never updates a status or a balance —
 * those belong to the API's transactional routes.
 */
export class SqlNotifyRepo implements NotifyRepo {
  constructor(private readonly db: Db) {}

  async insertInbox(input: InboxInput): Promise<void> {
    await this.db.insert(notifications).values({
      userId: input.userId,
      event: input.event,
      title: input.title,
      body: input.body,
    });
  }

  async insertReceipt(input: ReceiptInput): Promise<void> {
    await this.db.insert(notificationReceipts).values({
      channel: input.channel,
      destination: input.destination,
      template: input.template,
      status: input.status,
      providerMessageId: input.providerMessageId ?? null,
      error: input.error ?? null,
    });
  }

  async getInvoice(invoiceId: string): Promise<InvoiceView | null> {
    const rows = await this.db
      .select({
        id: invoices.id,
        number: invoices.number,
        title: invoices.title,
        detail: invoices.detail,
        status: invoices.status,
        issuedAt: invoices.issuedAt,
        dueAt: invoices.dueAt,
        settlementCurrency: invoices.settlementCurrency,
        orgName: organizations.name,
        orgClientCode: organizations.clientCode,
      })
      .from(invoices)
      .innerJoin(organizations, eq(invoices.orgId, organizations.id))
      .where(eq(invoices.id, invoiceId))
      .limit(1);
    const row = rows[0];
    if (row === undefined) return null;

    const lines = await this.db
      .select({
        description: invoiceLines.description,
        quantity: invoiceLines.quantity,
        unitUsdCents: invoiceLines.unitUsdCents,
      })
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, invoiceId))
      .orderBy(asc(invoiceLines.id));

    return {
      id: row.id,
      number: row.number,
      orgName: row.orgName,
      orgClientCode: row.orgClientCode,
      title: row.title,
      detail: row.detail,
      status: row.status,
      issuedAt: row.issuedAt,
      dueAt: row.dueAt,
      settlementCurrency: row.settlementCurrency.trim(),
      lines,
    };
  }

  async setInvoicePdfKey(invoiceId: string, key: string): Promise<void> {
    await this.db.update(invoices).set({ pdfObjectKey: key }).where(eq(invoices.id, invoiceId));
  }

  async getReport(scanJobId: string): Promise<ReportView | null> {
    const rows = await this.db
      .select({
        id: scanJobs.id,
        jobCode: scanJobs.jobCode,
        targetHost: scanJobs.targetHost,
        scanType: scanJobs.scanType,
        status: scanJobs.status,
        releasedAt: scanJobs.releasedAt,
      })
      .from(scanJobs)
      .where(eq(scanJobs.id, scanJobId))
      .limit(1);
    const row = rows[0];
    if (row === undefined) return null;

    const findings = await this.db
      .select({
        severity: scanFindings.severity,
        title: scanFindings.title,
        cwe: scanFindings.cwe,
        cvss: scanFindings.cvss,
        status: scanFindings.status,
        remediationGuidance: scanFindings.remediationGuidance,
      })
      .from(scanFindings)
      .where(eq(scanFindings.jobId, scanJobId))
      .orderBy(asc(scanFindings.id));

    return {
      id: row.id,
      jobCode: row.jobCode,
      targetHost: row.targetHost,
      scanType: row.scanType as ScanType,
      status: row.status,
      releasedAt: row.releasedAt,
      findings,
    };
  }

  async setReportObjectKey(scanJobId: string, key: string): Promise<void> {
    await this.db.update(scanJobs).set({ reportObjectKey: key }).where(eq(scanJobs.id, scanJobId));
  }
}

import { describe, expect, it, vi } from 'vitest';
import { UnrecoverableError } from 'bullmq';
import { invoiceKey, PdfHandler, PDF_CONTENT_TYPE, reportKey } from './pdf-handler';
import type {
  Clock,
  InvoiceView,
  Logger,
  NotifyRepo,
  ObjectWriter,
  PdfRenderer,
  ReportView,
} from '../ports';

const INVOICE_ID = '11111111-1111-4111-8111-111111111111';
const SCAN_JOB_ID = '22222222-2222-4222-8222-222222222222';

function makeInvoice(overrides: Partial<InvoiceView> = {}): InvoiceView {
  return {
    id: INVOICE_ID,
    number: 'VV-INV-2026-0841',
    orgName: 'Horizon SACCO',
    orgClientCode: 'VV-HZN-001',
    title: 'Full Scope API PenTest',
    detail: 'Enterprise Retainer · 12 endpoints · retest included',
    status: 'pending',
    issuedAt: new Date('2026-09-24T09:14:00.000Z'),
    dueAt: new Date('2026-10-08T09:14:00.000Z'),
    settlementCurrency: 'USD',
    lines: [
      { description: 'API penetration test', quantity: 1, unitUsdCents: 249900 },
      { description: 'Retest window', quantity: 2, unitUsdCents: 25000 },
    ],
    ...overrides,
  };
}

function makeReport(overrides: Partial<ReportView> = {}): ReportView {
  return {
    id: SCAN_JOB_ID,
    jobCode: 'JOB-4471',
    targetHost: 'api.horizonsacco.co.ke',
    scanType: 'api',
    status: 'completed',
    releasedAt: new Date('2026-09-24T12:00:00.000Z'),
    findings: [
      {
        severity: 'high',
        title: 'Missing rate limiting',
        cwe: 'CWE-770',
        cvss: '7.5',
        status: 'open',
        remediationGuidance: 'Add per-client rate limits.',
      },
      {
        severity: 'critical',
        title: 'SQL injection in search',
        cwe: 'CWE-89',
        cvss: '9.8',
        status: 'validated',
        remediationGuidance: 'Parameterise the query.',
      },
    ],
    ...overrides,
  };
}

function makeHarness(
  options: {
    invoice?: InvoiceView | null;
    report?: ReportView | null;
    storage?: ObjectWriter;
  } = {},
) {
  const puts: Array<{ key: string; bytes: number; contentType: string }> = [];
  const invoiceKeys: Array<{ id: string; key: string }> = [];
  const reportKeys: Array<{ id: string; key: string }> = [];
  const rendered: unknown[] = [];

  const repo = {
    getInvoice: vi.fn(async () =>
      options.invoice === undefined ? makeInvoice() : options.invoice,
    ),
    setInvoicePdfKey: vi.fn(async (id: string, key: string) => {
      invoiceKeys.push({ id, key });
    }),
    getReport: vi.fn(async () => (options.report === undefined ? makeReport() : options.report)),
    setReportObjectKey: vi.fn(async (id: string, key: string) => {
      reportKeys.push({ id, key });
    }),
    insertInbox: vi.fn(),
    insertReceipt: vi.fn(),
  } as unknown as NotifyRepo;

  const renderer: PdfRenderer = {
    async render(document) {
      rendered.push(document);
      return new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"
    },
  };

  const storage: ObjectWriter = options.storage ?? {
    async put(key, body, contentType) {
      puts.push({ key, bytes: body.length, contentType });
    },
  };

  const clock: Clock = { now: () => new Date('2026-09-24T15:00:00.000Z') };
  const logger: Logger = {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
  };

  const handler = new PdfHandler({ repo, renderer, storage, clock, logger });
  return { handler, puts, invoiceKeys, reportKeys, rendered, repo };
}

describe('PdfHandler — invoice', () => {
  it('renders, uploads to the exact key and stores it on the row', async () => {
    const h = makeHarness();
    const outcome = await h.handler.handle({ kind: 'invoice', refId: INVOICE_ID });

    expect(outcome).toEqual({ kind: 'invoice', key: 'invoices/VV-INV-2026-0841.pdf', bytes: 5 });
    expect(h.puts).toEqual([
      { key: 'invoices/VV-INV-2026-0841.pdf', bytes: 5, contentType: PDF_CONTENT_TYPE },
    ]);
    expect(h.invoiceKeys).toEqual([{ id: INVOICE_ID, key: 'invoices/VV-INV-2026-0841.pdf' }]);
    expect(h.rendered).toHaveLength(1);
  });

  it('is permanent when the invoice row does not exist', async () => {
    const h = makeHarness({ invoice: null });
    await expect(h.handler.handle({ kind: 'invoice', refId: INVOICE_ID })).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(h.puts).toEqual([]);
  });

  it('rethrows an upload failure so the queue retries, without storing the key', async () => {
    const failing: ObjectWriter = {
      async put() {
        throw new Error('r2 503');
      },
    };
    const h = makeHarness({ storage: failing });
    await expect(h.handler.handle({ kind: 'invoice', refId: INVOICE_ID })).rejects.toThrow(
      'r2 503',
    );
    expect(h.invoiceKeys).toEqual([]);
  });
});

describe('PdfHandler — report', () => {
  it('renders, uploads under the job code and stores the key', async () => {
    const h = makeHarness();
    const outcome = await h.handler.handle({ kind: 'report', refId: SCAN_JOB_ID });

    expect(outcome.key).toBe('reports/JOB-4471.pdf');
    expect(h.puts[0]?.contentType).toBe(PDF_CONTENT_TYPE);
    expect(h.reportKeys).toEqual([{ id: SCAN_JOB_ID, key: 'reports/JOB-4471.pdf' }]);
  });

  it('falls back to the job uuid while the job code is still generating', () => {
    expect(reportKey(null, SCAN_JOB_ID)).toBe(`reports/${SCAN_JOB_ID}.pdf`);
    expect(reportKey('JOB-1', SCAN_JOB_ID)).toBe('reports/JOB-1.pdf');
  });

  it('is permanent when the scan job row does not exist', async () => {
    const h = makeHarness({ report: null });
    await expect(h.handler.handle({ kind: 'report', refId: SCAN_JOB_ID })).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });
});

describe('key helpers', () => {
  it('names keys exactly as the portal download routes expect', () => {
    expect(invoiceKey('VV-INV-2026-0001')).toBe('invoices/VV-INV-2026-0001.pdf');
    expect(PDF_CONTENT_TYPE).toBe('application/pdf');
  });
});

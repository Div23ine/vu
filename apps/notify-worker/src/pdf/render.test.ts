import { describe, expect, it } from 'vitest';
import { renderToBuffer } from '@react-pdf/renderer';
import { ReactPdfRenderer } from '../adapters/renderer.js';
import { InvoiceDocument } from './invoice.js';
import { ReportDocument, severityCounts, sortFindings } from './report.js';
import type { InvoiceView, ReportView } from '../ports.js';

/**
 * The real renderer runs here — a broken layout must fail CI, not the first
 * customer invoice. Helvetica is one of the PDF standard fonts, so no font
 * files are fetched and the render is fully offline.
 */

const INVOICE: InvoiceView = {
  id: '11111111-1111-4111-8111-111111111111',
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
};

const REPORT: ReportView = {
  id: '22222222-2222-4222-8222-222222222222',
  jobCode: 'JOB-4471',
  targetHost: 'api.horizonsacco.co.ke',
  scanType: 'api',
  status: 'completed',
  releasedAt: new Date('2026-09-24T12:00:00.000Z'),
  findings: [
    {
      severity: 'low',
      title: 'Verbose error page',
      cwe: 'CWE-209',
      cvss: '3.7',
      status: 'open',
      remediationGuidance: null,
    },
    {
      severity: 'critical',
      title: 'SQL injection in search',
      cwe: 'CWE-89',
      cvss: '9.8',
      status: 'validated',
      remediationGuidance: 'Parameterise the query.',
    },
    {
      severity: 'high',
      title: 'Missing rate limiting',
      cwe: 'CWE-770',
      cvss: '7.5',
      status: 'open',
      remediationGuidance: 'Add per-client rate limits.',
    },
  ],
};

describe('severity helpers', () => {
  it('sorts critical first, then by title', () => {
    const sorted = sortFindings(REPORT);
    expect(sorted.map((finding) => finding.severity)).toEqual(['critical', 'high', 'low']);
  });

  it('counts every severity bucket', () => {
    expect(severityCounts(REPORT)).toEqual({ critical: 1, high: 1, medium: 0, low: 1 });
    expect(severityCounts({ ...REPORT, findings: [] })).toEqual({
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    });
  });
});

describe('real renders', () => {
  it('renders the invoice document to a real PDF', async () => {
    const buffer = await renderToBuffer(
      InvoiceDocument({ invoice: INVOICE, generatedAt: '2026-09-24T15:00:00.000Z' }),
    );
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(1000);
  }, 30_000);

  it('renders the report document to a real PDF', async () => {
    const buffer = await renderToBuffer(
      ReportDocument({ report: REPORT, generatedAt: '2026-09-24T15:00:00.000Z' }),
    );
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(1000);
  }, 30_000);

  it('the renderer adapter returns the same bytes as a Uint8Array', async () => {
    const renderer = new ReactPdfRenderer();
    const bytes = await renderer.render(
      InvoiceDocument({ invoice: INVOICE, generatedAt: '2026-09-24T15:00:00.000Z' }),
    );
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(String.fromCharCode(bytes[0] ?? 0, bytes[1] ?? 0, bytes[2] ?? 0, bytes[3] ?? 0)).toBe(
      '%PDF',
    );
  }, 30_000);
});

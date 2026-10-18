'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Headphones, Zap } from 'lucide-react';
import type { Invoice, InvoiceStatus } from '@vunvault/contracts';
import { formatLongDate, formatUsd } from '@vunvault/lib';
import { DataTable, toast, type DataTableProps } from '@vunvault/ui';
import { usePayDialog } from '../../../../../lib/pay-dialog-store';
import {
  downloadInvoicePdf,
  exportInvoicesCsv,
  useClientProfile,
  useInvoices,
} from '../_hooks/use-billing';

/**
 * Invoice history — the shared `DataTable` styled by
 * `billing.css` to the design's table. Status chips: `paid` → `Paid`,
 * `pending` → `Awaiting Payment`, `overdue` → `Overdue`, `void` → `Void`
 * (a `draft` row — not in the design — reuses the muted chip, authored).
 *
 * `Download PDF` streams `GET /billing/invoices/:id/pdf`; while the API
 * answers `202 generating` it toasts `Preparing your invoice…` (once per
 * sequence) and retries after 3 s, up to five attempts; the blob lands via a
 * hidden `<a download>` whose object URL is revoked immediately.
 * `Pay Now` (pending/overdue only) opens an earlier iteration's dialog through the
 * `usePayDialog()` store; `?invoice=<id>` (the Products purchase hand-off)
 * opens it automatically once the list has loaded.
 */

const STATUS_CHIPS: Record<InvoiceStatus, { label: string; className: string }> = {
  paid: { label: 'Paid', className: 'vbb-status--paid' },
  pending: { label: 'Awaiting Payment', className: 'vbb-status--pending' },
  overdue: { label: 'Overdue', className: 'vbb-status--overdue' },
  void: { label: 'Void', className: 'vbb-status--void' },
  draft: { label: 'Draft', className: 'vbb-status--void' },
};

function StatusChip({ status }: { status: InvoiceStatus }) {
  const chip = STATUS_CHIPS[status];
  return (
    <span className={`vbb-status ${chip.className}`}>
      <span className="vbb-status-dot" aria-hidden="true" />
      {chip.label}
    </span>
  );
}

export interface InvoiceTableProps {
  /** `?invoice=<id>` — opens the Pay dialog for that invoice once loaded. */
  initialPayInvoiceId: string | null;
}

export function InvoiceTable({ initialPayInvoiceId }: InvoiceTableProps) {
  const invoicesQuery = useInvoices({ page: 1, pageSize: 10 });
  const profile = useClientProfile();
  const payDialog = usePayDialog();
  const [downloading, setDownloading] = useState<ReadonlySet<string>>(new Set());
  const generatingToasted = useRef<Set<string>>(new Set());
  const handoffDone = useRef(false);

  const invoices = useMemo(() => invoicesQuery.data?.data ?? [], [invoicesQuery.data]);
  const company = profile.data?.company.name;

  // Products purchase hand-off: open the Pay dialog for ?invoice=<id>.
  useEffect(() => {
    if (initialPayInvoiceId === null || handoffDone.current) return;
    if (invoices.length === 0) return;
    const target = invoices.find((invoice) => invoice.id === initialPayInvoiceId);
    if (target === undefined) return;
    handoffDone.current = true;
    payDialog.open(target);
  }, [invoices, initialPayInvoiceId, payDialog]);

  const onDownloadPdf = useCallback(async (invoice: Invoice) => {
    setDownloading((current) => new Set(current).add(invoice.id));
    try {
      const ok = await downloadInvoicePdf(invoice, {
        onGenerating: () => {
          if (generatingToasted.current.has(invoice.id)) return;
          generatingToasted.current.add(invoice.id);
          toast({ kind: 'info', title: 'Preparing your invoice…' });
        },
      });
      if (!ok) {
        // Authored fallback — the spec pinned no download-failure copy.
        toast({ kind: 'crit', title: 'Download failed', message: 'Please try again.' });
      }
    } catch {
      toast({ kind: 'crit', title: 'Download failed', message: 'Please try again.' });
    } finally {
      generatingToasted.current.delete(invoice.id);
      setDownloading((current) => {
        const next = new Set(current);
        next.delete(invoice.id);
        return next;
      });
    }
  }, []);

  const onExportCsv = useCallback(async () => {
    if (invoices.length === 0) {
      toast({
        kind: 'warn',
        title: 'No invoices to export',
        message: 'There are no invoices on this account yet.',
      });
      return;
    }
    try {
      const ok = await exportInvoicesCsv();
      if (ok) {
        toast({ kind: 'ok', title: 'Invoice history exported as CSV' });
      } else {
        toast({ kind: 'crit', title: 'Export failed', message: 'Please try again.' });
      }
    } catch {
      toast({ kind: 'crit', title: 'Export failed', message: 'Please try again.' });
    }
  }, [invoices.length]);

  const columns: DataTableProps<Invoice>['columns'] = [
    {
      id: 'number',
      header: 'Order / Invoice ID',
      enableSorting: false,
      cell: ({ row }) => <span className="vbb-inv-id">{row.original.number}</span>,
    },
    {
      id: 'date',
      header: 'Date',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="vbb-inv-date">{formatLongDate(new Date(row.original.issuedAt))}</span>
      ),
    },
    {
      id: 'service',
      header: 'Service Description',
      enableSorting: false,
      cell: ({ row }) => (
        <>
          <span className="vbb-inv-service">{row.original.title}</span>
          {row.original.detail !== null ? (
            <span className="vbb-inv-service-detail">{row.original.detail}</span>
          ) : null}
        </>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="vbb-inv-amount">{formatUsd(row.original.totalUsdCents)}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      enableSorting: false,
      cell: ({ row }) => <StatusChip status={row.original.status} />,
    },
    {
      id: 'action',
      header: 'Action',
      enableSorting: false,
      cell: ({ row }) => {
        const invoice = row.original;
        const busy = downloading.has(invoice.id);
        return (
          <span className="vbb-inv-actions">
            {invoice.status === 'pending' || invoice.status === 'overdue' ? (
              <button
                type="button"
                className="vbb-dl vbb-dl--pay"
                onClick={() => payDialog.open(invoice)}
              >
                <Zap size={13} aria-hidden="true" />
                <span>Pay Now</span>
              </button>
            ) : null}
            <button
              type="button"
              className="vbb-dl"
              disabled={busy}
              aria-busy={busy}
              onClick={() => void onDownloadPdf(invoice)}
            >
              <Download size={13} aria-hidden="true" />
              <span>Download PDF</span>
            </button>
          </span>
        );
      },
    },
  ];

  return (
    <section className="pt-12 md:pt-16 pb-16 md:pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="vbb-section-head">
          <div>
            <h2 className="vbb-section-title">Invoice History</h2>
            <p className="vbb-section-sub">
              Every engagement, subscription charge and Academy purchase. All invoices are available
              as signed PDFs for your finance and audit records.
            </p>
          </div>
          <button
            type="button"
            className="vbb-btn vbb-btn--ghost"
            id="vbb-export-all"
            onClick={() => void onExportCsv()}
          >
            <Download size={15} aria-hidden="true" />
            <span>Export All (CSV)</span>
          </button>
        </div>

        <div className="vbb-table-wrap">
          <DataTable
            caption={company === undefined ? 'Invoice history' : `Invoice history for ${company}`}
            columns={columns}
            data={invoices}
            isLoading={invoicesQuery.isLoading}
            empty={{
              title: 'No invoices yet',
              description: 'Invoices appear here after your first engagement or purchase.',
            }}
            getRowId={(invoice) => invoice.id}
          />
        </div>

        <div className="vbb-table-foot">
          <p className="vbb-table-foot-note">
            Showing the last 6 transactions. Invoices are retained for 7 years for audit purposes.
            For billing queries contact <strong>billing@vunvault.com</strong>.
          </p>
          <div className="vbb-pay-actions">
            <Link href="/contact" className="vbb-btn vbb-btn--ghost vbb-btn--sm">
              <Headphones size={14} aria-hidden="true" />
              <span>Billing Support</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

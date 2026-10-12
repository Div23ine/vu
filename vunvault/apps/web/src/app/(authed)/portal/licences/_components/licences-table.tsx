'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Copy, Download, Eye, EyeOff } from 'lucide-react';
import type { EntitlementView } from '@vunvault/contracts';
import { cn, formatLongDate, isApiError } from '@vunvault/lib';
import { DataTable, toast, type DataTableProps } from '@vunvault/ui';
import { maskLicenseKey, useDownloadUrl, useEntitlements } from '../_hooks/use-entitlements';
import '../_styles/licences.css';

/**
 * Licences table (Task 73) — the purchased product licences: masked key with
 * `Reveal` + `Copy`, the grant date, the update window with its
 * `Active`/`Expired` chip and the secure download (presigned URL from
 * `POST /entitlements/:id/download-url`, then `window.location.assign` — the
 * app never proxies bytes). A `409 not_available` toasts the verbatim warn
 * pair; the empty state links to `/products`.
 */

function LicenseKeyCell({ licenseKey }: { licenseKey: string }) {
  const [revealed, setRevealed] = useState(false);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(licenseKey);
      toast({ kind: 'ok', title: 'Licence key copied' });
    } catch {
      toast({ kind: 'crit', title: 'Could not copy the key', message: 'Please try again.' });
    }
  };

  return (
    <span className="vbl-key">
      <span className="vbl-key-text">{revealed ? licenseKey : maskLicenseKey(licenseKey)}</span>
      <button
        type="button"
        className="vbl-key-btn"
        aria-pressed={revealed}
        onClick={() => setRevealed((current) => !current)}
      >
        {revealed ? <EyeOff size={12} aria-hidden="true" /> : <Eye size={12} aria-hidden="true" />}
        {revealed ? 'Hide' : 'Reveal'}
      </button>
      <button type="button" className="vbl-key-btn" onClick={() => void copy()}>
        <Copy size={12} aria-hidden="true" />
        Copy
      </button>
    </span>
  );
}

function UpdatesCell({ updatesUntil }: { updatesUntil: string }) {
  const active = new Date(updatesUntil).getTime() >= Date.now();
  return (
    <span className="vbl-updates">
      <span className="vbl-cell-date">{formatLongDate(new Date(updatesUntil))}</span>
      <span className={cn('vbl-status', active ? 'vbl-status--active' : 'vbl-status--expired')}>
        {active ? 'Active' : 'Expired'}
      </span>
    </span>
  );
}

export function LicencesTable() {
  const entitlements = useEntitlements();
  const download = useDownloadUrl();
  const items: EntitlementView[] = entitlements.data ?? [];

  const columns: DataTableProps<EntitlementView>['columns'] = [
    {
      id: 'product',
      header: 'Product',
      enableSorting: false,
      cell: ({ row }) => <span className="vbl-cell-product">{row.original.productName}</span>,
    },
    {
      id: 'key',
      header: 'Licence key',
      enableSorting: false,
      cell: ({ row }) => <LicenseKeyCell licenseKey={row.original.licenseKey} />,
    },
    {
      id: 'granted',
      header: 'Granted',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="vbl-cell-date">{formatLongDate(new Date(row.original.grantedAt))}</span>
      ),
    },
    {
      id: 'updates',
      header: 'Updates until',
      enableSorting: false,
      cell: ({ row }) => <UpdatesCell updatesUntil={row.original.updatesUntil} />,
    },
    {
      id: 'action',
      header: 'Action',
      enableSorting: false,
      cell: ({ row }) => (
        <button
          type="button"
          className="vbl-btn vbl-btn--ghost vbl-btn--sm"
          disabled={download.isPending}
          onClick={() =>
            download.mutate(row.original.id, {
              onSuccess: ({ url }) => {
                window.location.assign(url);
              },
              onError: (error) => {
                if (isApiError(error) && error.status === 409 && error.code === 'not_available') {
                  toast({
                    kind: 'warn',
                    title: 'Download not available yet',
                    message:
                      'The archive for this product has not been published. We will email you when it is ready.',
                  });
                  return;
                }
                toast({
                  kind: 'crit',
                  title: 'Could not start the download',
                  message: 'Please try again.',
                });
              },
            })
          }
        >
          <Download size={13} aria-hidden="true" />
          Download
        </button>
      ),
    },
  ];

  return (
    <div className="vbl-table-wrap">
      <DataTable
        caption="Product licences purchased by your organisation"
        columns={columns}
        data={items}
        isLoading={entitlements.isLoading}
        empty={{
          title: 'No licences yet',
          description: 'Purchase a tool from the Products page to see it here.',
          action: (
            <Link href="/products" className="vbl-btn vbl-btn--primary">
              Browse products
            </Link>
          ),
        }}
        getRowId={(item) => item.id}
      />
    </div>
  );
}

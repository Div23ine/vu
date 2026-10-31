'use client';

import { Receipt } from 'lucide-react';
import type { RecentTransaction, TransactionsResponse } from '@vunvault/contracts';
import { formatUsdWhole } from '@vunvault/lib';
import { cn } from '@vunvault/lib';
import { EmptyState, Skeleton } from '@vunvault/ui';
import {
  formatTxnStamp,
  isForbidden,
  METHOD_LABELS,
  useDashboardSectionRaw,
} from './use-dashboard';
import './dashboard.css';

/**
 * Recent Payment Transactions — the latest six settled, pending
 * and refunded transactions across M-Pesa, card and bank transfer, with the
 * totals footer computed by the API. The mini-button row is the design's
 * static chrome — an earlier iteration implements no writes.
 */

const STATUS_CLASS: Record<RecentTransaction['status'], string> = {
  settled: 'adm-badge--settled',
  pending: 'adm-badge--pending',
  refunded: 'adm-badge--refunded',
};

const STATUS_LABELS: Record<RecentTransaction['status'], string> = {
  settled: 'Settled',
  pending: 'Pending',
  refunded: 'Refunded',
};

export function TransactionsTable() {
  const query = useDashboardSectionRaw<TransactionsResponse>(
    'transactions',
    'transactions?limit=6',
  );

  if (query.isError && isForbidden(query.error)) return null;

  if (query.isLoading) {
    return (
      <div className="adm-card adm-span-8" aria-busy="true">
        <div className="adm-card-body">
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    );
  }

  const data = query.data;
  if (data === undefined) {
    return (
      <div className="adm-card adm-span-8">
        <div className="adm-card-body">
          <EmptyState
            title="Metrics unavailable"
            action={
              <button type="button" className="adm-mini-btn" onClick={() => void query.refetch()}>
                Retry
              </button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="adm-card adm-span-8">
      <div className="adm-card-head">
        <div>
          <h2 className="adm-card-title">
            <Receipt size={17} aria-hidden="true" />
            Recent Payment Transactions
          </h2>
          <p className="adm-card-note">
            Latest six settled, pending and refunded transactions across M-Pesa, card and bank
            transfer.
          </p>
        </div>
        <span className="adm-tag">Last 48 hours</span>
      </div>
      <div className="adm-card-body">
        <div className="adm-table-wrap">
          <table className="adm-table">
            <caption className="sr-only">
              Recent payment transactions for penetration testing packages
            </caption>
            <thead>
              <tr>
                <th scope="col">Txn ID</th>
                <th scope="col">Date (UTC)</th>
                <th scope="col">Client</th>
                <th scope="col">Package</th>
                <th scope="col">Method</th>
                <th scope="col" className="adm-num">
                  Amount
                </th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((txn) => (
                <tr key={txn.txnCode}>
                  <td className="adm-mono">{txn.txnCode}</td>
                  <td className="adm-mono">{formatTxnStamp(txn.occurredAt)}</td>
                  <td className="adm-strong">{txn.client}</td>
                  <td>{txn.package}</td>
                  <td>{METHOD_LABELS[txn.method]}</td>
                  <td className="adm-num adm-strong">{formatUsdWhole(txn.amountUsdCents)}</td>
                  <td>
                    <span className={cn('adm-badge', STATUS_CLASS[txn.status])}>
                      {STATUS_LABELS[txn.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>Total across displayed transactions</td>
                <td className="adm-num">{formatUsdWhole(data.totals.totalUsdCents)}</td>
                <td>
                  {data.totals.settled} settled · {data.totals.pending} pending ·{' '}
                  {data.totals.refunded} refunded
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="adm-inline-actions">
          <button type="button" className="adm-mini-btn">
            Reconcile Ledger
          </button>
          <button type="button" className="adm-mini-btn">
            Download CSV
          </button>
          <button type="button" className="adm-mini-btn">
            Issue Refund
          </button>
        </div>
      </div>
    </div>
  );
}

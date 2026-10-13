'use client';

import { ClipboardList } from 'lucide-react';
import type { ScanEnvironment, ScanJob, ScanPriority } from '@vunvault/contracts';
import { SCAN_TYPE_LABELS } from '@vunvault/contracts';
import { cn, formatEta, formatQueueStamp } from '@vunvault/lib';
import { DataTable, selectColumn, type DataTableProps } from '@vunvault/ui';

/** Derived from the shared table's props — apps/web has no direct
 * `@tanstack/react-table` dependency (the UI package owns it). */
export type QueueSorting = NonNullable<DataTableProps<ScanJob>['sorting']>;
export type QueueRowSelection = NonNullable<DataTableProps<ScanJob>['rowSelection']>;
export type QueueSortingChange = NonNullable<DataTableProps<ScanJob>['onSortingChange']>;
export type QueueSelectionChange = NonNullable<DataTableProps<ScanJob>['onRowSelectionChange']>;
import { GateBadge } from './gate-badge';
import { PaymentChip } from './payment-chip';
import { RowActions } from './row-actions';
import '../_styles/scan-queue.css';

/**
 * Queue table (Task 77) — the shared `DataTable` with row selection, the
 * reference's columns (select, Job/Requested, Target Host, Client Request
 * Info, Type, Payment, Priority, Status/Progress, Review Gate, Actions) and
 * the release-lock footnote. Timestamps are `formatQueueStamp` (UTC); ETAs
 * are `formatEta`; completed rows show the completion stamp.
 */

const PRIORITY_LABELS: Record<ScanPriority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const ENVIRONMENT_LABELS: Record<ScanEnvironment, string> = {
  production: 'Production',
  staging: 'Staging',
};

function statusLine(job: ScanJob): string {
  switch (job.status) {
    case 'running':
      return job.etaSeconds === null ? 'Running' : `Running · ETA ${formatEta(job.etaSeconds)}`;
    case 'completed':
      return job.completedAt === null
        ? 'Completed'
        : `Completed · ${formatQueueStamp(new Date(job.completedAt))}`;
    case 'queued':
      return 'Queued · not yet assigned';
    case 'held':
      return 'Held · held for remediation';
    default:
      return job.status.replaceAll('_', ' ');
  }
}

interface QueueTableProps {
  jobs: ScanJob[];
  isLoading: boolean;
  awaitingReview: number | null;
  rowSelection: QueueRowSelection;
  onRowSelectionChange: QueueSelectionChange;
  sorting: QueueSorting;
  onSortingChange: QueueSortingChange;
  canReview: boolean;
  onResetFilters(): void;
}

export function QueueTable({
  jobs,
  isLoading,
  awaitingReview,
  rowSelection,
  onRowSelectionChange,
  sorting,
  onSortingChange,
  canReview,
  onResetFilters,
}: QueueTableProps) {
  const columns: DataTableProps<ScanJob>['columns'] = [
    selectColumn<ScanJob>(),
    {
      id: 'job',
      header: 'Job / Requested',
      accessorFn: (job) => job.jobCode,
      cell: ({ row }) => (
        <span>
          <span className="sq-job">{row.original.jobCode}</span>
          <span className="sq-sub sq-sub--mono">
            {formatQueueStamp(new Date(row.original.requestedAt))}
          </span>
        </span>
      ),
    },
    {
      id: 'target',
      header: 'Target Host',
      enableSorting: false,
      cell: ({ row }) => (
        <span>
          <span className="sq-host">{row.original.targetHost}</span>
          <span className="sq-sub sq-sub--mono">
            {row.original.targetIp ?? row.original.targetLabel ?? '—'}
          </span>
          {row.original.environment === null ? null : (
            <span
              className={cn(
                'sq-env',
                row.original.environment === 'production' ? 'sq-env--prod' : 'sq-env--staging',
              )}
            >
              {ENVIRONMENT_LABELS[row.original.environment]}
            </span>
          )}
        </span>
      ),
    },
    {
      id: 'client',
      header: 'Client Request Info',
      enableSorting: false,
      cell: ({ row }) => (
        <span>
          <span className="sq-client">{row.original.client.name}</span>
          {row.original.client.contactEmail === null ? null : (
            <span className="sq-sub">{row.original.client.contactEmail}</span>
          )}
          {row.original.scopeNotes === null ? null : (
            <span className="sq-sub">{row.original.scopeNotes}</span>
          )}
        </span>
      ),
    },
    {
      id: 'type',
      header: 'Type',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="adm-badge adm-badge--info">{SCAN_TYPE_LABELS[row.original.scanType]}</span>
      ),
    },
    {
      id: 'payment',
      header: 'Payment',
      enableSorting: false,
      cell: ({ row }) => <PaymentChip status={row.original.paymentStatus} />,
    },
    {
      id: 'priority',
      header: 'Priority',
      accessorFn: (job) => job.priority,
      cell: ({ row }) => (
        <span className={cn('sq-prio', `sq-prio--${row.original.priority}`)}>
          {PRIORITY_LABELS[row.original.priority]}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status / Progress',
      accessorFn: (job) => job.progress,
      cell: ({ row }) => (
        <span>
          <span className="sq-progress">
            <progress
              className="adm-progress"
              value={row.original.progress}
              max={100}
              aria-label={`${row.original.jobCode} progress`}
            >
              {row.original.progress}%
            </progress>
            <span className="sq-progress-val">{row.original.progress}%</span>
          </span>
          <span className="sq-sub">{statusLine(row.original)}</span>
        </span>
      ),
    },
    {
      id: 'gate',
      header: 'Review Gate',
      enableSorting: false,
      cell: ({ row }) => <GateBadge state={row.original.reviewGateState} />,
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => <RowActions job={row.original} canReview={canReview} />,
    },
  ];

  return (
    <section className="adm-card sq-table-card" aria-labelledby="sq-table-heading">
      <div className="adm-card-head">
        <div>
          <h2 className="adm-card-title" id="sq-table-heading">
            <ClipboardList size={17} aria-hidden="true" />
            Vulnerability Assessment & Job Queue
          </h2>
          <p className="adm-card-note">
            Target host details, client request information, payment status and per-job review-gate
            state. Results remain locked until an administrator approves release.
          </p>
        </div>
        {awaitingReview === null ? null : (
          <span className="adm-tag adm-tag--warn">{awaitingReview} Awaiting Review</span>
        )}
      </div>
      <DataTable
        className="sq-table-shell"
        caption="Vulnerability assessment job queue with target host, client request, payment status and mandatory admin review gate"
        columns={columns}
        data={jobs}
        isLoading={isLoading}
        empty={{
          title: 'No jobs match the current filters',
          description:
            'Adjust your search terms or reset the filters to see the full vulnerability assessment queue.',
          action: (
            <button type="button" className="adm-btn adm-btn-ghost" onClick={onResetFilters}>
              Reset Filters
            </button>
          ),
        }}
        getRowId={(job) => job.id}
        enableRowSelection
        rowSelection={rowSelection}
        onRowSelectionChange={onRowSelectionChange}
        sorting={sorting}
        onSortingChange={onSortingChange}
      />
      <p className="adm-note sq-lock-note">
        Client release is locked until the Mandatory Admin Review Gate is cleared by an
        administrator.
      </p>
    </section>
  );
}

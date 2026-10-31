'use client';

import Link from 'next/link';
import { useState } from 'react';
import { FileSearch, Plus } from 'lucide-react';
import type { ScanFinding, ScanJob } from '@vunvault/contracts';
import { SCAN_TYPE_LABELS } from '@vunvault/contracts';
import { formatLongDate } from '@vunvault/lib';
import { DataTable, type DataTableProps } from '@vunvault/ui';
import { usePentestDialog } from './request-pentest-dialog';
import { useScanFindings, useScans } from '../_hooks/use-scans';
import { NewScanDialog } from './new-scan-dialog';
import { SeverityBar, type SeverityCounts } from './severity-bar';
import '../_styles/scans.css';

/**
 * Released-reports table — the portal's scan list on the shared
 * `DataTable`. RELEASE LOCK: the rows are exactly what `GET /api/v1/scans`
 * returns (the API excludes unreleased jobs); nothing here infers or renders
 * review, gate or payment state.
 *
 * The Findings column fetches each row's released findings
 * (`GET /scans/:id/findings`) — the list contract carries no counts. The
 * page holds at most ten rows, the queries are cached under the same keys the
 * detail page uses, and the release lock already guarantees they are small.
 */

function countsOf(findings: ScanFinding[]): SeverityCounts {
  const counts: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const finding of findings) counts[finding.severity] += 1;
  return counts;
}

function FindingsCell({ jobId }: { jobId: string }) {
  const findings = useScanFindings(jobId);
  if (findings.isLoading) return <span className="vps-severity-empty">…</span>;
  if (findings.data === undefined) return <span className="vps-severity-empty">—</span>;
  return <SeverityBar counts={countsOf(findings.data)} />;
}

export function ScansTable() {
  const scans = useScans({ page: 1, pageSize: 10 });
  const pentestDialog = usePentestDialog();
  const [newScanOpen, setNewScanOpen] = useState(false);

  const jobs: ScanJob[] = scans.data?.data ?? [];

  const columns: DataTableProps<ScanJob>['columns'] = [
    {
      id: 'job',
      header: 'Job',
      enableSorting: false,
      cell: ({ row }) => (
        <Link className="vps-job-code" href={`/portal/scans/${row.original.id}`}>
          {row.original.jobCode}
        </Link>
      ),
    },
    {
      id: 'target',
      header: 'Target',
      enableSorting: false,
      cell: ({ row }) => <span className="vps-cell-target">{row.original.targetHost}</span>,
    },
    {
      id: 'type',
      header: 'Type',
      enableSorting: false,
      cell: ({ row }) => SCAN_TYPE_LABELS[row.original.scanType],
    },
    {
      id: 'released',
      header: 'Released',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="vps-cell-date">
          {row.original.completedAt === null
            ? '—'
            : formatLongDate(new Date(row.original.completedAt))}
        </span>
      ),
    },
    {
      id: 'findings',
      header: 'Findings',
      enableSorting: false,
      cell: ({ row }) => <FindingsCell jobId={row.original.id} />,
    },
    {
      id: 'action',
      header: 'Action',
      enableSorting: false,
      cell: ({ row }) => (
        <Link className="vps-view-link" href={`/portal/scans/${row.original.id}`}>
          <FileSearch size={13} aria-hidden="true" />
          View report
        </Link>
      ),
    },
  ];

  return (
    <>
      <div className="vps-hint-card">
        <div>
          <div className="vps-hint-title">Need a full penetration test?</div>
          <p className="vps-hint-text">
            Request a scoped engagement from the Request PenTest button in the header — the VUNVAULT
            team will confirm scope and scheduling with you.
          </p>
        </div>
        <button
          type="button"
          className="vps-btn vps-btn--ghost vps-btn--sm"
          onClick={() => pentestDialog.openDialog()}
        >
          <span>Request PenTest</span>
        </button>
      </div>

      <div className="vps-section-head">
        <div />
        <button
          type="button"
          className="vps-btn vps-btn--ghost"
          id="vps-new-scan"
          onClick={() => setNewScanOpen(true)}
        >
          <Plus size={15} aria-hidden="true" />
          <span>New scan request</span>
        </button>
      </div>

      <div className="vps-table-wrap">
        <DataTable
          caption="Released scan reports for your organisation"
          columns={columns}
          data={jobs}
          isLoading={scans.isLoading}
          empty={{
            title: 'No released reports yet',
            description:
              'Reports appear here after the VUNVAULT team completes the mandatory review.',
          }}
          getRowId={(job) => job.id}
        />
      </div>

      <NewScanDialog open={newScanOpen} onOpenChange={setNewScanOpen} />
    </>
  );
}

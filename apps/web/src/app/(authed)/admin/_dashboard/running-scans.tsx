'use client';

import Link from 'next/link';
import { Radar } from 'lucide-react';
import type { RunningScansResponse } from '@vunvault/contracts';
import { SCAN_TYPE_LABELS } from '@vunvault/contracts';
import { formatEta } from '@vunvault/lib';
import { EmptyState, ProgressBar, Skeleton } from '@vunvault/ui';
import { isForbidden, useDashboardSectionRaw } from './use-dashboard';
import './dashboard.css';

/**
 * Active Running Scans Monitor (Task 76) — live worker telemetry for the
 * scans currently executing: `ProgressBar` + percent, `formatEta` for the
 * ETA and the computed shown/total footnote. `Open Scan Queue` deep-links to
 * Task 77's route; the other two mini-buttons are the prototype's static
 * chrome (Task 76 implements no writes).
 */

export function RunningScans() {
  const query = useDashboardSectionRaw<RunningScansResponse>(
    'running-scans',
    'running-scans?limit=5',
  );

  if (query.isError && isForbidden(query.error)) return null;

  if (query.isLoading) {
    return (
      <div className="adm-card adm-span-7" aria-busy="true">
        <div className="adm-card-body">
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  const data = query.data;
  if (data === undefined) {
    return (
      <div className="adm-card adm-span-7">
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

  const hidden = Math.max(data.total - data.shown, 0);

  return (
    <div className="adm-card adm-span-7">
      <div className="adm-card-head">
        <div>
          <h2 className="adm-card-title">
            <Radar size={17} aria-hidden="true" />
            Active Running Scans Monitor
          </h2>
          <p className="adm-card-note">
            Live worker telemetry for every scan currently executing on the VUNVAULT engine.
          </p>
        </div>
        <span className="adm-tag adm-tag--ok">{data.total} Active</span>
      </div>
      <div className="adm-card-body">
        <div className="adm-table-wrap">
          <table className="adm-table">
            <caption className="sr-only">Currently running penetration test scans</caption>
            <thead>
              <tr>
                <th scope="col">Job ID</th>
                <th scope="col">Target</th>
                <th scope="col">Type</th>
                <th scope="col">Analyst</th>
                <th scope="col">Progress</th>
                <th scope="col" className="adm-num">
                  ETA
                </th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((scan) => (
                <tr key={scan.jobCode}>
                  <td className="adm-mono">{scan.jobCode}</td>
                  <td className="adm-strong">{scan.target}</td>
                  <td>{SCAN_TYPE_LABELS[scan.scanType]}</td>
                  <td className="adm-mono">{scan.analystLabel}</td>
                  <td>
                    <span className="dash-scan-progress">
                      <ProgressBar value={scan.progress} label={`${scan.jobCode} progress`} />
                      <span className="adm-progress-value">{scan.progress}%</span>
                    </span>
                  </td>
                  <td className="adm-num adm-mono">
                    {scan.etaSeconds === null ? '—' : formatEta(scan.etaSeconds)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="adm-note">
          Showing {data.shown} of {data.total} active jobs · {hidden} more running on the secondary
          worker pool
        </p>
        <div className="adm-inline-actions">
          <Link href="/admin/scan-queue" className="adm-mini-btn">
            Open Scan Queue
          </Link>
          <button type="button" className="adm-mini-btn">
            Pause All Workers
          </button>
          <button type="button" className="adm-mini-btn">
            Assign Reviewer
          </button>
        </div>
      </div>
    </div>
  );
}

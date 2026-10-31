'use client';

import { ListTodo } from 'lucide-react';
import type { PipelineSummary } from '@vunvault/contracts';
import { cn } from '@vunvault/lib';
import { EmptyState, Skeleton } from '@vunvault/ui';
import { formatCount, isForbidden, useDashboardSection } from './use-dashboard';
import './dashboard.css';

/**
 * Job Progress & Status — the pipeline barometer: the four dl
 * figures and the distribution rows whose percentages are computed from
 * `distribution` (nothing hard-coded). The unreviewed-escalation note is
 * verbatim.
 */

const DISTRIBUTION_ROWS = [
  { key: 'completed', label: 'Completed', tone: 'adm-progress--ok' },
  { key: 'pending', label: 'Pending', tone: 'adm-progress--warn' },
  { key: 'unreviewed', label: 'Unreviewed', tone: 'adm-progress--crit' },
  { key: 'running', label: 'Running', tone: '' },
] as const;

export function PipelinePanel() {
  const pipeline = useDashboardSection<PipelineSummary>('pipeline', 'pipeline');

  if (pipeline.isError && isForbidden(pipeline.error)) return null;

  if (pipeline.isLoading) {
    return (
      <div className="adm-card adm-span-5" aria-busy="true">
        <div className="adm-card-body">
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  const data = pipeline.data;
  if (data === undefined) {
    return (
      <div className="adm-card adm-span-5">
        <div className="adm-card-body">
          <EmptyState
            title="Metrics unavailable"
            action={
              <button
                type="button"
                className="adm-mini-btn"
                onClick={() => void pipeline.refetch()}
              >
                Retry
              </button>
            }
          />
        </div>
      </div>
    );
  }

  const distributionTotal =
    data.distribution.completed +
    data.distribution.pending +
    data.distribution.unreviewed +
    data.distribution.running;
  const completedJobs = data.distribution.completed;

  return (
    <div className="adm-card adm-span-5">
      <div className="adm-card-head">
        <div>
          <h2 className="adm-card-title" id="adm-pipeline-heading">
            <ListTodo size={17} aria-hidden="true" />
            Job Progress & Status
          </h2>
          <p className="adm-card-note">
            Throughput barometer across the scan pipeline, including jobs blocked on mandatory admin
            review.
          </p>
        </div>
        <span className="adm-tag adm-tag--warn">{data.unreviewedJobs} Awaiting Review</span>
      </div>
      <div className="adm-card-body">
        <dl className="adm-dl">
          <div className="adm-dl-item">
            <dt>Completed Jobs</dt>
            <dd>
              {formatCount(completedJobs)}
              <small>{data.closedLast7Days} closed in the last 7 days</small>
            </dd>
          </div>
          <div className="adm-dl-item">
            <dt>Pending Jobs</dt>
            <dd>
              {formatCount(data.pendingJobs)}
              <small>Queued, not yet assigned</small>
            </dd>
          </div>
          <div className="adm-dl-item">
            <dt>Unreviewed Jobs</dt>
            <dd>
              {formatCount(data.unreviewedJobs)}
              <small>Admin review required before release</small>
            </dd>
          </div>
          <div className="adm-dl-item">
            <dt>Active Running Scans</dt>
            <dd>
              {formatCount(data.running)}
              <small>
                {data.workerSlotsUsed} of {data.workerSlotsTotal} worker slots occupied
              </small>
            </dd>
          </div>
        </dl>

        <hr className="adm-divider" />
        <h3 className="adm-kpi-label">Pipeline Distribution</h3>
        {DISTRIBUTION_ROWS.map((row) => {
          const count = data.distribution[row.key];
          const percent =
            distributionTotal === 0 ? 0 : Math.round((count / distributionTotal) * 100);
          return (
            <div className="adm-progress-row" key={row.key}>
              <span className="adm-progress-name">
                {row.label}
                <small>{formatCount(count)} jobs</small>
              </span>
              <progress
                className={cn('adm-progress', row.tone || undefined)}
                value={percent}
                max={100}
                aria-label={`${row.label} share`}
              >
                {percent}%
              </progress>
              <span className="adm-progress-value">{percent}%</span>
            </div>
          );
        })}
        <p className="adm-note">
          Unreviewed jobs are held for a maximum of 72 hours before automatic escalation to the
          on-call lead.
        </p>
      </div>
    </div>
  );
}

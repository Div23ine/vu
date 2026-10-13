'use client';

import { RadioTower, Server } from 'lucide-react';
import type { NodeStatus, NodesResponse } from '@vunvault/contracts';
import { NODE_STATUS_LABELS } from '@vunvault/contracts';
import { cn } from '@vunvault/lib';
import { EmptyState, Skeleton } from '@vunvault/ui';
import { formatCount, isForbidden, useDashboardSectionRaw } from './use-dashboard';
import './dashboard.css';

/**
 * Sensor-node panels (Task 76) — one component, two placements: the LOAD
 * card in the traffic section (saturation bars; > 85 % arms the warn tone —
 * the autoscaling trigger) and the CONNECTIVITY card in the threat section
 * (heartbeat latency + clock drift). Both read the single `nodes` query;
 * react-query dedupes the two observers.
 */

const NODE_BADGE: Record<NodeStatus, string> = {
  operational: 'adm-badge--ok',
  high_load: 'adm-badge--warn',
  drift_warning: 'adm-badge--warn',
  degraded: 'adm-badge--crit',
  offline: 'adm-badge--crit',
};

export interface NodesPanelProps {
  variant: 'load' | 'connectivity';
}

export function NodesPanel({ variant }: NodesPanelProps) {
  const query = useDashboardSectionRaw<NodesResponse>('nodes', 'nodes');
  const isLoad = variant === 'load';

  if (query.isError && isForbidden(query.error)) return null;

  if (query.isLoading) {
    return (
      <div className="adm-card adm-span-12" aria-busy="true">
        <div className="adm-card-body">
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  const data = query.data;
  if (data === undefined) {
    return (
      <div className="adm-card adm-span-12">
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
    <div className="adm-card adm-span-12">
      <div className="adm-card-head">
        <div>
          <h2 className="adm-card-title">
            {isLoad ? (
              <Server size={17} aria-hidden="true" />
            ) : (
              <RadioTower size={17} aria-hidden="true" />
            )}
            {isLoad ? 'Sensor Node Load Distribution' : 'Sensor Node Network Connectivity'}
          </h2>
          <p className="adm-card-note">
            {isLoad
              ? 'Real-time worker saturation per regional reconnaissance node. Values above 85% trigger autoscaling.'
              : 'Connectivity, heartbeat latency and clock drift for each regional sensor node in the mesh.'}
          </p>
        </div>
        <span className="adm-tag adm-tag--ok">
          {data.online} / {data.total} {isLoad ? 'online' : 'Online'}
        </span>
      </div>
      <div className="adm-card-body">
        <div className="adm-node-grid">
          {data.data.map((node) => (
            <article className="adm-node" key={node.code}>
              <div className="adm-node-top">
                <span className="adm-node-id">{node.code}</span>
                <span className={cn('adm-badge', NODE_BADGE[node.status])}>
                  {NODE_STATUS_LABELS[node.status]}
                </span>
              </div>
              <span className="adm-node-region">
                {isLoad
                  ? `${node.label} · ${formatCount(node.reqPerMin)} req/min`
                  : `${node.label} · ${node.country}`}
              </span>
              <div className="adm-node-metric">
                <span>Load</span>
                <span>{node.loadPercent}%</span>
              </div>
              <progress
                className={cn(
                  'adm-progress',
                  node.loadPercent > 85 ? 'adm-progress--warn' : undefined,
                )}
                value={node.loadPercent}
                max={100}
                aria-label={`${node.code} load`}
              >
                {node.loadPercent}%
              </progress>
              <div className="adm-node-metric">
                <span>Heartbeat</span>
                <span>
                  {node.heartbeatLatencyMs === null ? '—' : `${node.heartbeatLatencyMs} ms`}
                </span>
              </div>
              <div className="adm-node-metric">
                <span>Clock Drift</span>
                <span>
                  {node.clockDriftMs === null ? '—' : `±${Math.abs(node.clockDriftMs)} ms`}
                </span>
              </div>
            </article>
          ))}
        </div>
        <p className="adm-note">
          {isLoad
            ? 'Node load is sampled every 15 seconds from the heartbeat mesh and averaged over a 5-minute window.'
            : 'Connectivity is confirmed by a signed heartbeat every 15 seconds. Two consecutive misses mark a node as degraded; three mark it offline.'}
        </p>
      </div>
    </div>
  );
}

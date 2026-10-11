'use client';

import { Gauge } from 'lucide-react';
import type { EndpointStat } from '@vunvault/contracts';
import { EmptyState, Skeleton } from '@vunvault/ui';
import { formatCount, isForbidden, useDashboardSection } from './use-dashboard';
import './dashboard.css';

/**
 * Top Endpoints by Load (Task 76) — request distribution, mean latency and
 * error ratio per endpoint, with the computed aggregate footer row (total
 * requests, mean latency, mean error ratio across the displayed endpoints).
 */

export function EndpointsTable() {
  const endpoints = useDashboardSection<EndpointStat[]>('endpoints', 'endpoints');

  if (endpoints.isError && isForbidden(endpoints.error)) return null;

  if (endpoints.isLoading) {
    return (
      <div className="adm-card adm-span-7" aria-busy="true">
        <div className="adm-card-body">
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  const rows = endpoints.data;
  if (rows === undefined) {
    return (
      <div className="adm-card adm-span-7">
        <div className="adm-card-body">
          <EmptyState
            title="Metrics unavailable"
            action={
              <button
                type="button"
                className="adm-mini-btn"
                onClick={() => void endpoints.refetch()}
              >
                Retry
              </button>
            }
          />
        </div>
      </div>
    );
  }

  const totalRequests = rows.reduce((sum, row) => sum + row.requests, 0);
  const meanLatency =
    rows.length === 0
      ? 0
      : Math.round(rows.reduce((sum, row) => sum + row.avgLatencyMs, 0) / rows.length);
  // Integer basis points keep the aggregate away from binary-fraction edges
  // (0.215 would print as 0.21 through toFixed on the raw double).
  const meanErrorBp =
    rows.length === 0
      ? 0
      : Math.round(
          rows.reduce((sum, row) => sum + Math.round(row.errorRatio * 100), 0) / rows.length,
        );
  const meanErrors = (meanErrorBp / 100).toFixed(2);

  return (
    <div className="adm-card adm-span-7">
      <div className="adm-card-head">
        <div>
          <h2 className="adm-card-title">
            <Gauge size={17} aria-hidden="true" />
            Top Endpoints by Load
          </h2>
          <p className="adm-card-note">Request distribution, mean latency and error ratio.</p>
        </div>
      </div>
      <div className="adm-card-body">
        <div className="adm-table-wrap">
          <table className="adm-table">
            <caption className="sr-only">Top API endpoints by request volume</caption>
            <thead>
              <tr>
                <th scope="col">Endpoint</th>
                <th scope="col" className="adm-num">
                  Requests
                </th>
                <th scope="col" className="adm-num">
                  Latency
                </th>
                <th scope="col" className="adm-num">
                  Errors
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.endpoint}>
                  <td className="adm-mono">{row.endpoint}</td>
                  <td className="adm-num">{formatCount(row.requests)}</td>
                  <td className="adm-num">{row.avgLatencyMs} ms</td>
                  <td className="adm-num">{row.errorRatio.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Aggregate</td>
                <td className="adm-num">{formatCount(totalRequests)}</td>
                <td className="adm-num">{meanLatency} ms</td>
                <td className="adm-num">{meanErrors}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

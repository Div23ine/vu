'use client';

import { Activity } from 'lucide-react';
import type { TrafficSummary } from '@vunvault/contracts';
import { EmptyState, Skeleton } from '@vunvault/ui';
import { formatCount, formatMillions, isForbidden, useDashboardSection } from './use-dashboard';
import './dashboard.css';

/**
 * Traffic & Network Load — sessions, API volume and latency dl
 * plus the 7-point hourly bar chart, drawn with plain CSS (NO charting
 * library — the bars are height percentages inside `.adm-bar-track`).
 */

export function TrafficPanel() {
  const traffic = useDashboardSection<TrafficSummary>('traffic', 'traffic');

  if (traffic.isError && isForbidden(traffic.error)) return null;

  if (traffic.isLoading) {
    return (
      <div className="adm-card adm-span-5" aria-busy="true">
        <div className="adm-card-body">
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  const data = traffic.data;
  if (data === undefined) {
    return (
      <div className="adm-card adm-span-5">
        <div className="adm-card-body">
          <EmptyState
            title="Metrics unavailable"
            action={
              <button type="button" className="adm-mini-btn" onClick={() => void traffic.refetch()}>
                Retry
              </button>
            }
          />
        </div>
      </div>
    );
  }

  const peak = data.hourly.reduce(
    (best, point) => (point.apiRequestsMillions > best.apiRequestsMillions ? point : best),
    data.hourly[0] ?? { hourUtc: 0, apiRequestsMillions: 0 },
  );
  const max = peak.apiRequestsMillions;

  return (
    <div className="adm-card adm-span-5">
      <div className="adm-card-head">
        <div>
          <h2 className="adm-card-title" id="adm-traffic-heading">
            <Activity size={17} aria-hidden="true" />
            Traffic & Network Load
          </h2>
          <p className="adm-card-note">
            Incoming site sessions, API request volume and per-endpoint latency across the edge
            tier.
          </p>
        </div>
        <span className="adm-tag">Rolling 24h</span>
      </div>
      <div className="adm-card-body">
        <dl className="adm-dl adm-dl--3">
          <div className="adm-dl-item">
            <dt>Site Sessions</dt>
            <dd>
              {formatCount(data.siteSessions)}
              <small>▲ {data.sessionsChangePercent}% day over day</small>
            </dd>
          </div>
          <div className="adm-dl-item">
            <dt>API Requests</dt>
            <dd>
              {formatMillions(data.apiRequests)}
              <small>Across {data.endpointCount} endpoints</small>
            </dd>
          </div>
          <div className="adm-dl-item">
            <dt>Avg. Response</dt>
            <dd>
              {data.avgResponseMs}
              <small>ms · p95 {data.p95ResponseMs} ms</small>
            </dd>
          </div>
        </dl>

        <figure className="adm-figure dash-figure">
          <figcaption className="adm-figcaption">
            <span>Hourly API Request Volume (millions)</span>
            <span>
              Peak {String(peak.hourUtc).padStart(2, '0')}:00 UTC · {max.toFixed(2)}M
            </span>
          </figcaption>
          <div className="adm-bars" role="img" aria-label="Hourly API request volume in millions">
            {data.hourly.map((point) => (
              <div className="adm-bar-col" key={point.hourUtc}>
                <div className="adm-bar-track">
                  <span
                    className="adm-bar-fill"
                    style={{
                      height: `${max === 0 ? 0 : (point.apiRequestsMillions / max) * 100}%`,
                    }}
                  />
                </div>
                <span className="adm-bar-value">{point.apiRequestsMillions.toFixed(2)}</span>
                <span className="adm-bar-label">{String(point.hourUtc).padStart(2, '0')}h</span>
              </div>
            ))}
          </div>
        </figure>
      </div>
    </div>
  );
}

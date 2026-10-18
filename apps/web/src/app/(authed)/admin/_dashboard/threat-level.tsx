'use client';

import { ShieldAlert } from 'lucide-react';
import type { ThreatLevel as ThreatLevelData } from '@vunvault/contracts';
import { THREAT_ESCALATION_LEVEL, THREAT_LEVEL_LABELS } from '@vunvault/contracts';
import { cn } from '@vunvault/lib';
import { EmptyState, Skeleton } from '@vunvault/ui';
import { formatCount, isForbidden, useDashboardSection } from './use-dashboard';
import './dashboard.css';

/**
 * Zero-Day Threat Level — the dark composite-index card (meter,
 * legend, the escalation line at `level >= THREAT_ESCALATION_LEVEL`, the
 * four dl figures) plus the Threats-Blocked 7-day bar figure. Scale steps
 * light up to the current level; the label comes from the API/contract,
 * never from the design's stale copy.
 */

const SCALE_LEVELS = [1, 2, 3, 4, 5] as const;

export function ThreatLevel() {
  const threat = useDashboardSection<ThreatLevelData>('threat-level', 'threat-level');

  if (threat.isError && isForbidden(threat.error)) return null;

  if (threat.isLoading) {
    return (
      <div className="adm-card adm-card--dark adm-span-6" aria-busy="true">
        <div className="adm-card-body">
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  const data = threat.data;
  if (data === undefined) {
    return (
      <div className="adm-card adm-span-6">
        <div className="adm-card-body">
          <EmptyState
            title="Metrics unavailable"
            action={
              <button type="button" className="adm-mini-btn" onClick={() => void threat.refetch()}>
                Retry
              </button>
            }
          />
        </div>
      </div>
    );
  }

  const escalated = data.level >= THREAT_ESCALATION_LEVEL;
  const tone =
    data.level >= 4 ? 'adm-tag--crit' : data.level === 3 ? 'adm-tag--warn' : 'adm-tag--ok';
  const blockedPeak = data.blockedLast7Days.reduce((max, day) => Math.max(max, day.count), 0);

  return (
    <>
      <div className="adm-card adm-card--dark adm-span-6">
        <div className="adm-card-head">
          <div>
            <h2 className="adm-card-title" id="adm-threat-heading">
              <ShieldAlert size={17} aria-hidden="true" />
              Zero-Day Threat Level
            </h2>
            <p className="adm-card-note">
              Composite index derived from weaponisation status, exploit availability and patch
              coverage.
            </p>
          </div>
          <span className={cn('adm-tag', tone)}>{data.label}</span>
        </div>
        <div className="adm-card-body">
          <div className="adm-threat">
            <div className="adm-threat-head">
              <div className="dash-current">
                <span className="adm-kpi-label">Current Level</span>
                <span className="adm-threat-level">LEVEL {data.level} / 5</span>
              </div>
              {escalated ? (
                <span className="adm-badge adm-badge--crit">
                  Escalated to the incident commander on duty.
                </span>
              ) : null}
            </div>
            <div
              className="adm-threat-scale"
              role="img"
              aria-label={`Threat level ${data.level} of 5 — ${data.label}`}
            >
              {SCALE_LEVELS.map((step) => (
                <span
                  key={step}
                  className={cn('adm-threat-step', step <= data.level ? `is-${step}` : undefined)}
                />
              ))}
            </div>
            <div className="adm-threat-legend">
              {SCALE_LEVELS.map((step) => (
                <span key={step}>{THREAT_LEVEL_LABELS[step]}</span>
              ))}
            </div>
          </div>

          <dl className="adm-dl dash-threat-dl">
            <div className="adm-dl-item">
              <dt>Critical CVEs Tracked</dt>
              <dd>
                {formatCount(data.criticalCves)}
                <small>{data.unpatchedCritical} currently unpatched</small>
              </dd>
            </div>
            <div className="adm-dl-item">
              <dt>Total Active Zero-Days</dt>
              <dd>{formatCount(data.activeZeroDays)}</dd>
            </div>
            <div className="adm-dl-item">
              <dt>Weaponized in the Wild</dt>
              <dd>
                {formatCount(data.weaponizedInWild)}
                <small>Active exploitation confirmed</small>
              </dd>
            </div>
            <div className="adm-dl-item">
              <dt>Threats Blocked (YTD)</dt>
              <dd>
                {formatCount(data.threatsBlockedYtd)}
                <small>Perimeter + endpoint sensors</small>
              </dd>
            </div>
          </dl>

          <p className="adm-note">
            Threat level is recalculated hourly. A level of 4 or above triggers automatic escalation
            to the incident commander on duty.
          </p>
        </div>
      </div>

      <div className="adm-card adm-span-6">
        <div className="adm-card-body">
          <figure className="adm-figure dash-figure">
            <figcaption className="adm-figcaption">
              <span>Threats Blocked — Last 7 Days</span>
              <span>Total {formatCount(data.threatsBlockedYtd)}</span>
            </figcaption>
            <div
              className="adm-bars"
              role="img"
              aria-label="Threats blocked per day over the last seven days"
            >
              {data.blockedLast7Days.map((day) => (
                <div className="adm-bar-col" key={day.day}>
                  <div className="adm-bar-track">
                    <span
                      className="adm-bar-fill adm-bar-fill--alt"
                      style={{
                        height: `${blockedPeak === 0 ? 0 : (day.count / blockedPeak) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="adm-bar-value">{formatCount(day.count)}</span>
                  <span className="adm-bar-label">{day.day}</span>
                </div>
              ))}
            </div>
          </figure>
        </div>
      </div>
    </>
  );
}

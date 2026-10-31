'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@vunvault/lib';
import { useUtcClock } from '../../_components/home/use-utc-clock';
import {
  TELEMETRY_ALERTS,
  TELEMETRY_COUNTERS,
  TELEMETRY_FOOTNOTE,
  TELEMETRY_METRICS,
  TELEMETRY_PATCH_COVERAGE_PERCENT,
  type TelemetryAlert,
} from '../_data/about-data';
import { useReveal } from './about-hero';
import '../_styles/about.css';

/**
 * System Telemetry panel — replaces the an earlier iteration stub.
 *
 * Reuses the an earlier iteration pattern exactly: the clock renders `--:--:-- UTC` on the
 * server and first client paint (no hydration mismatch), then ticks every
 * second; the six-row alert feed rotates every 8 s (last row moves to the
 * top, flashing `is-flash` for 1.2 s) with the visible `8s…1s` countdown;
 * every timer is cleaned up on unmount. All values are the fixture constants
 * from `about-data.ts` — nothing is fetched.
 */

const ROTATION_SECONDS = 8;
const FLASH_MS = 1200;

const SEVERITY_CLASS: Record<TelemetryAlert['severity'], string> = {
  Critical: 'vv-tel-sev--crit',
  High: 'vv-tel-sev--high',
  Medium: 'vv-tel-sev--medium',
};

const STATE_CLASS: Record<TelemetryAlert['state'], string> = {
  Unpatched: 'vv-tel-state--unpatched',
  'In progress': 'vv-tel-state--progress',
  Patched: 'vv-tel-state--patched',
};

export function AboutTelemetry() {
  const clock = useUtcClock();
  const reveal = useReveal<HTMLDivElement>();

  const [rows, setRows] = useState<TelemetryAlert[]>(() => [...TELEMETRY_ALERTS]);
  const [countdown, setCountdown] = useState(ROTATION_SECONDS);
  const [flashingCve, setFlashingCve] = useState<string | null>(null);

  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const rotate = useCallback(() => {
    const current = rowsRef.current;
    if (current.length < 2) return;
    const last = current[current.length - 1];
    if (last === undefined) return;
    const next = [last, ...current.slice(0, -1)];
    rowsRef.current = next;
    setRows(next);
    setFlashingCve(last.cve);
  }, []);

  useEffect(() => {
    let remaining = ROTATION_SECONDS;
    const timer = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setCountdown(remaining);
        return;
      }
      remaining = ROTATION_SECONDS;
      setCountdown(ROTATION_SECONDS);
      rotate();
    }, 1000);
    return () => clearInterval(timer);
  }, [rotate]);

  useEffect(() => {
    if (flashingCve === null) return;
    const timer = setTimeout(() => setFlashingCve(null), FLASH_MS);
    return () => clearTimeout(timer);
  }, [flashingCve]);

  return (
    <section className="vv-section" id="telemetry">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="max-w-3xl space-y-4">
          <span className="vv-eyebrow">System Telemetry</span>
          <h2 className="vv-h2">What our sensors are seeing right now.</h2>
          <p className="vv-body max-w-2xl">
            A live slice of the VUNVAULT sensor network — the same telemetry that feeds client
            dashboards and our weekly threat note.
          </p>
        </div>

        <div ref={reveal.ref} className={cn('vv-telemetry', reveal.className)}>
          <div className="vv-telemetry-inner">
            <div className="vv-tel-head">
              <div className="flex items-center gap-3">
                <span className="vv-tel-title">VUNVAULT Sensor Network</span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              </div>
              <span className="vv-tel-clock" id="vv-tel-clock">
                {clock ?? '--:--:--'} UTC
              </span>
            </div>

            <div className="vv-tel-metrics">
              {TELEMETRY_METRICS.map((metric) => (
                <article key={metric.label} className="vv-tel-metric">
                  <div className="vv-tel-metric-label">{metric.label}</div>
                  <div className="vv-tel-metric-value">
                    {metric.value}
                    {metric.suffix !== undefined ? (
                      <span className="text-sm text-neutral-400 ml-0.5">{metric.suffix}</span>
                    ) : null}
                  </div>
                  <div
                    className={cn(
                      'vv-tel-metric-delta',
                      metric.ok === true && 'vv-tel-metric-delta--ok',
                    )}
                  >
                    {metric.delta}
                  </div>
                </article>
              ))}
            </div>

            <div className="vv-tel-split">
              <div className="vv-tel-panel">
                <div className="vv-tel-panel-head">
                  <span className="vv-tel-panel-title">
                    <span className="vv-pulse-dot" aria-hidden="true" />
                    Real-Time Security Alerts
                  </span>
                  <span className="text-neutral-500 font-mono text-[10px]">
                    auto-refresh ·<span id="vv-tel-countdown"> {countdown}s</span>
                  </span>
                </div>
                <div
                  className="vv-tel-feed"
                  id="vv-tel-feed"
                  role="log"
                  aria-live="polite"
                  aria-label="Live security alerts"
                >
                  {rows.map((alert) => (
                    <article
                      key={alert.cve}
                      className={cn('vv-tel-item', flashingCve === alert.cve && 'is-flash')}
                    >
                      <div className="vv-tel-item-main">
                        <div className="vv-tel-item-top">
                          <span className={cn('vv-tel-sev', SEVERITY_CLASS[alert.severity])}>
                            {alert.severity}
                          </span>
                          <span className="text-neutral-500 font-mono text-[10px]">
                            {alert.cve}
                          </span>
                        </div>
                        <div className="vv-tel-item-msg">{alert.msg}</div>
                        <div className="vv-tel-item-sub">{alert.sub}</div>
                      </div>
                      <span className={cn('vv-tel-state', STATE_CLASS[alert.state])}>
                        {alert.state}
                      </span>
                    </article>
                  ))}
                </div>
              </div>

              <div className="vv-tel-panel">
                <div className="vv-tel-panel-head">
                  <span className="vv-tel-panel-title">Status Counters</span>
                </div>
                <div className="vv-tel-counters">
                  {TELEMETRY_COUNTERS.map((counter) => (
                    <div key={counter.label} className="vv-tel-counter">
                      <span className="vv-tel-counter-label">{counter.label}</span>
                      <span className="vv-tel-counter-value">{counter.value}</span>
                    </div>
                  ))}
                </div>
                <div className="vv-tel-bar">
                  <div className="vv-tel-bar-head">
                    <span>Patch Coverage</span>
                    <span className="font-mono">{TELEMETRY_PATCH_COVERAGE_PERCENT}%</span>
                  </div>
                  <div
                    className="vv-tel-bar-track"
                    role="progressbar"
                    aria-label="Patch coverage"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={TELEMETRY_PATCH_COVERAGE_PERCENT}
                  >
                    <span
                      className="vv-tel-bar-fill"
                      style={{ width: `${TELEMETRY_PATCH_COVERAGE_PERCENT}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <p className="pt-4 mt-4 border-t border-neutral-800 text-[10px] text-neutral-500 leading-relaxed">
              {TELEMETRY_FOOTNOTE}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

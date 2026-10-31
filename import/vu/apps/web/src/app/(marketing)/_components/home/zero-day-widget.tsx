'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, Bug, ChevronRight, Crosshair, Radar, ShieldCheck, Timer } from 'lucide-react';
import { cn } from '@vunvault/lib';
import {
  PATCH_COVERAGE_PERCENT,
  SENSORS_ONLINE,
  ZERO_DAY_FEED,
  ZERO_DAY_FOOTNOTE,
  ZERO_DAY_QUICK_ACTIONS,
  ZERO_DAY_STATS,
  ZERO_DAY_STATUS_COUNTERS,
  ZERO_DAY_TABS,
  type FeedRow,
} from './zero-day-data';
import { useUtcClock, utcStamp } from './use-utc-clock';
import '../../_styles/zero-day-widget.css';

/**
 * Zero-Day Exploit Tracking dashboard widget — the live-looking
 * dark panel on the marketing home page. A TEASER: every value is a fixture
 * constant (`zero-day-data.ts`), nothing is fetched, nothing is stored.
 *
 * Behaviour, ported from the design's script to hooks:
 * - the header clock ticks every second as `HH:MM:SS UTC` (and renders
 * `--:--:-- UTC` on the server and the first client paint — no hydration
 * mismatch);
 * - every 8 s the LAST feed row moves to the top, flashes for 1.2 s
 * (`zdet-flash`), the countdown restarts at `8s` and the refresh stamp
 * becomes `Updated HH:MM:SS UTC`;
 * - under `prefers-reduced-motion` the rotation still happens — the CSS
 * block in `zero-day-widget.css` removes only the flash;
 * - every timer is cleaned up on unmount.
 *
 * The mini tabs and quick actions are presentational (no handlers), exactly
 * as the spec specifies.
 */

const ROTATION_SECONDS = 8;
const FLASH_MS = 1200;

const STAT_ICONS = {
  bug: Bug,
  crosshair: Crosshair,
  'shield-check': ShieldCheck,
  timer: Timer,
} as const;

const SEVERITY_CHIP: Record<FeedRow['severity'], string> = {
  Critical: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  High: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  Medium: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30',
};

const PATCH_CHIP: Record<FeedRow['patch'], string> = {
  Unpatched: 'bg-rose-500 text-white',
  'Patch in progress': 'bg-amber-500 text-white',
  Patched: 'bg-emerald-500 text-white',
};

export function ZeroDayWidget() {
  const clock = useUtcClock();

  const [rows, setRows] = useState<FeedRow[]>(() => [...ZERO_DAY_FEED]);
  const [countdown, setCountdown] = useState(ROTATION_SECONDS);
  const [flashingCve, setFlashingCve] = useState<string | null>(null);
  const [updatedStamp, setUpdatedStamp] = useState<string | null>(null);

  // Rotation reads the latest rows without re-scheduling the interval.
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
    setUpdatedStamp(`Updated ${utcStamp()} UTC`);
  }, []);

  // One heartbeat: counts down each second and rotates on the wrap.
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

  // The flash wears off after 1.2 s (timer cleaned up on unmount/re-flash).
  useEffect(() => {
    if (flashingCve === null) return;
    const timer = setTimeout(() => setFlashingCve(null), FLASH_MS);
    return () => clearTimeout(timer);
  }, [flashingCve]);

  return (
    <div className="glass-card rounded-3xl p-6 sm:p-8 border border-neutral-200/90 shadow-sm hover:shadow-md transition-all duration-300">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-neutral-100 border border-neutral-200/80 flex items-center justify-center text-neutral-800 shadow-xs shrink-0">
          <Radar size={22} aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
            Zero-Day Exploit Tracking Dashboard
          </h3>
          <p className="text-neutral-500 text-sm leading-relaxed max-w-2xl">
            Continuous coverage of past and active zero-days across cloud, endpoint, network, web,
            mobile and OT/ICS — with live exploitation status, CVSS severity and patch availability
            in one view.
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-neutral-900/95 text-neutral-100 p-4 sm:p-5 border border-neutral-800 shadow-2xl overflow-hidden font-sans">
        {/* Window chrome: brand, title, UTC clock, live badge, operator chip. */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-neutral-800 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-extrabold tracking-wider text-white">VUNVAULT</span>
            <span className="text-neutral-600">|</span>
            <span className="text-neutral-300 font-semibold uppercase tracking-wider">
              Zero-Day Exploit Tracking
            </span>
            <span className="text-neutral-600 hidden sm:inline">|</span>
            <span
              id="zdet-clock"
              className="text-neutral-400 font-mono text-[11px] hidden sm:inline"
            >
              {clock ?? '--:--:--'} UTC
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/50 border border-emerald-800/60 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
            <div className="w-6 h-6 rounded-full bg-neutral-700 flex items-center justify-center text-neutral-300 text-[10px] font-bold">
              ER
            </div>
            <span className="text-neutral-300 font-medium text-xs hidden sm:inline">
              Dr. Evelyn Reed
            </span>
          </div>
        </div>

        {/* Presentational mini tabs (Dashboard active). */}
        <div className="flex items-center gap-1 sm:gap-2 py-3 overflow-x-auto text-xs border-b border-neutral-800/80 no-scrollbar">
          {ZERO_DAY_TABS.map((tab, index) => (
            <button
              key={tab}
              type="button"
              className={cn(
                'px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer',
                index === 0
                  ? 'bg-neutral-800 text-white font-medium border border-neutral-700'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50',
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Stat cards. */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 pt-4">
          {ZERO_DAY_STATS.map((stat) => {
            const Icon = STAT_ICONS[stat.icon];
            return (
              <article
                key={stat.label}
                className="rounded-xl bg-neutral-800/50 border border-neutral-700/60 p-3 hover:border-neutral-600 transition-colors"
              >
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  <Icon size={12} aria-hidden="true" />
                  {stat.label}
                </div>
                <div className="mt-1.5 text-2xl font-extrabold font-mono tracking-tight text-white">
                  {stat.value}
                  {stat.unit !== undefined ? (
                    <span className="ml-0.5 text-base font-bold text-neutral-400">{stat.unit}</span>
                  ) : null}
                </div>
                <div className="mt-1 text-[10px] font-semibold text-rose-400">{stat.delta}</div>
              </article>
            );
          })}
        </div>

        {/* Intelligence stream + status panel. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          <div className="md:col-span-2 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                Live Zero-Day Intelligence Stream
              </span>
              <span className="text-neutral-500 font-mono text-[10px] normal-case">
                <span id="zdet-refreshed">{updatedStamp ?? 'Auto-refresh'}</span>
                {' · '}
                <span id="zdet-countdown">{countdown}s</span>
              </span>
            </div>
            <div id="zdet-feed" className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {rows.map((row) => (
                <article
                  key={row.cve}
                  className={cn(
                    'group p-2.5 sm:p-3 rounded-xl bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/60 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2',
                    flashingCve === row.cve && 'zdet-flash',
                  )}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider',
                          SEVERITY_CHIP[row.severity],
                        )}
                      >
                        {row.severity}
                      </span>
                      <code className="text-neutral-200 text-[11px] font-mono font-bold">
                        {row.cve}
                      </code>
                      <span className="text-neutral-500 text-[11px] font-mono">{row.time} UTC</span>
                    </div>
                    <div className="text-xs font-semibold text-neutral-100 group-hover:text-cyan-400 transition-colors truncate">
                      {row.title}
                    </div>
                    <div className="text-[11px] text-neutral-500 truncate">{row.meta}</div>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                    <span
                      className={cn(
                        'text-[10px] font-bold px-2.5 py-1 rounded-full',
                        PATCH_CHIP[row.patch],
                      )}
                    >
                      ● {row.patch}
                    </span>
                    <ChevronRight size={16} aria-hidden="true" className="text-neutral-500" />
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="bg-neutral-800/40 rounded-xl p-3.5 border border-neutral-700/60 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
                  Tracking System Status
                </div>
                <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Activity size={14} aria-hidden="true" />
                  All Sensors Nominal
                </div>
              </div>
              <div className="space-y-3">
                {ZERO_DAY_STATUS_COUNTERS.map((counter) => (
                  <div
                    key={counter.label}
                    className="flex items-center justify-between text-xs border-b border-neutral-700/60 pb-2"
                  >
                    <span className="text-neutral-400">{counter.label}</span>
                    <span className="font-bold font-mono text-rose-400">{counter.value}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Sensors Online</span>
                  <span className="text-emerald-400 text-[10px] font-semibold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                    {SENSORS_ONLINE}
                  </span>
                </div>
              </div>
              <div className="pt-1 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  <span>Patch Coverage</span>
                  <span className="font-mono text-cyan-400">{PATCH_COVERAGE_PERCENT}%</span>
                </div>
                <div className="relative h-1.5 w-full rounded-full bg-neutral-700/70 overflow-hidden zdet-sweep">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-cyan-500"
                    style={{ width: `${PATCH_COVERAGE_PERCENT}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="pt-3 border-t border-neutral-700/60">
              <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
                Quick Actions
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                {ZERO_DAY_QUICK_ACTIONS.map((action) => (
                  <button
                    key={action}
                    type="button"
                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 py-1.5 px-2 rounded font-medium transition-colors text-center cursor-pointer border border-neutral-700/60"
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <p className="pt-4 mt-4 border-t border-neutral-800 text-[10px] text-neutral-500 leading-relaxed">
          {ZERO_DAY_FOOTNOTE}
        </p>
      </div>
    </div>
  );
}

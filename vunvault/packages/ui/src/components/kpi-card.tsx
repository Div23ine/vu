import type * as React from 'react';
import { cn } from '@vunvault/lib';

export type KpiDeltaTone = 'up' | 'dot' | 'down' | 'warn';

export interface KpiCardProps {
  /** Uppercase micro-label, e.g. `"Active Team Members"`. */
  label: string;
  /** Pre-formatted value — the caller owns number/percent formatting. */
  value: string;
  /** Rendered as a `<small>` suffix, e.g. `"%"`. */
  unit?: string;
  /** Optional trend line. `text` is passed through verbatim. */
  delta?: { tone: KpiDeltaTone; text: string };
  className?: string;
}

const DELTA_TONE_CLASS: Record<KpiDeltaTone, string> = {
  up: 'text-ok',
  dot: 'text-ok',
  warn: 'text-high',
  down: 'text-critical',
};

/**
 * Metric tile: micro-label, monospace value and an optional trend line, with a
 * 2px brand accent across the top edge.
 */
export function KpiCard({ label, value, unit, delta, className }: KpiCardProps) {
  return (
    <article
      className={cn(
        'relative flex flex-col gap-[7px] overflow-hidden rounded-kpi border border-line bg-white shadow-kpi',
        'px-[18px] pt-[18px] pb-4',
        'transition-[transform,border-color,box-shadow] duration-[250ms] ease-vv',
        'hover:-translate-y-[3px] hover:border-brand-line',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-0.5 bg-[linear-gradient(90deg,transparent,var(--brand),transparent)] opacity-75"
      />
      <p className="text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-ink-faint">
        {label}
      </p>
      <p className="font-mono text-[clamp(1.5rem,2.6vw,1.95rem)] font-extrabold leading-none tracking-[-0.035em] text-ink">
        {value}
        {unit ? (
          <small className="ml-0.5 text-[0.62em] font-bold text-ink-muted">{unit}</small>
        ) : null}
      </p>
      {delta ? (
        <p className={cn('text-[0.7rem] font-semibold', DELTA_TONE_CLASS[delta.tone])}>
          {delta.text}
        </p>
      ) : null}
    </article>
  );
}

export interface KpiGridProps {
  /** Required: names the metric group for assistive technology. */
  'aria-label': string;
  children: React.ReactNode;
  className?: string;
}

/** Six-up metric row on desktop, three-up on tablet, two-up on mobile. */
export function KpiGrid({ 'aria-label': ariaLabel, children, className }: KpiGridProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'mb-[30px] grid grid-cols-2 gap-[14px] md:grid-cols-3 xl:grid-cols-6',
        className,
      )}
    >
      {children}
    </div>
  );
}

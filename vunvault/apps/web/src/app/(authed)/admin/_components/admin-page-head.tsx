import type * as React from 'react';
import { cn } from '@vunvault/lib';
import { Eyebrow } from '@vunvault/ui';
import '../_styles/admin-shared.css';

/**
 * Admin page head + KPI tile (Task 75).
 *
 * `AdminPageHead` is the block every admin page opens with: the `Eyebrow`
 * primitive, `h1.adm-page-title`, `p.adm-page-sub` and a right-aligned
 * actions slot (the reference's `adm-h1`/`adm-lede` names lose to the
 * stylesheet — the CSS wins, per the spec).
 *
 * `AdmKpi` is the `adm-kpi` tile — the same visual and prop API as the
 * shared `KpiCard` (Task 9) rendered through the admin stylesheet so the
 * dark-card contexts and the reference's delta tones apply. The tone glyph
 * (▲ / ● / ▼) is part of the caller's `delta.text`, exactly as the reference
 * markup carries it.
 */

export interface AdminPageHeadProps {
  eyebrow: string;
  title: string;
  description: string;
  /** Right-aligned slot — the page's action buttons. */
  actions?: React.ReactNode;
}

export function AdminPageHead({ eyebrow, title, description, actions }: AdminPageHeadProps) {
  return (
    <div className="adm-page-head">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="adm-page-title">{title}</h1>
        <p className="adm-page-sub">{description}</p>
      </div>
      {actions === undefined ? null : <div className="adm-head-actions">{actions}</div>}
    </div>
  );
}

export type AdmKpiDeltaTone = 'up' | 'dot' | 'down' | 'warn';

export interface AdmKpiProps {
  /** Uppercase micro-label, e.g. `"Total Paid Clients"`. */
  label: string;
  /** Pre-formatted value — the caller owns number/percent formatting. */
  value: string;
  /** Rendered as a `<small>` suffix, e.g. `"ms"`. */
  unit?: string;
  /** Optional trend line; `text` is passed through verbatim. */
  delta?: { tone: AdmKpiDeltaTone; text: string };
  className?: string;
}

/** `dot` is the neutral tone — the base delta colour, no modifier class. */
const DELTA_TONE_CLASS: Record<AdmKpiDeltaTone, string> = {
  up: 'adm-kpi-delta--up',
  dot: '',
  down: 'adm-kpi-delta--down',
  warn: 'adm-kpi-delta--warn',
};

export function AdmKpi({ label, value, unit, delta, className }: AdmKpiProps) {
  return (
    <article className={cn('adm-kpi', className)}>
      <span className="adm-kpi-label">{label}</span>
      <span className="adm-kpi-value">
        {value}
        {unit === undefined ? null : <small>{unit}</small>}
      </span>
      {delta === undefined ? null : (
        <span className={cn('adm-kpi-delta', DELTA_TONE_CLASS[delta.tone] || undefined)}>
          {delta.text}
        </span>
      )}
    </article>
  );
}

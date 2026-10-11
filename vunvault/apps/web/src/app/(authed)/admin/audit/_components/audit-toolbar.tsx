'use client';

import { RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import type { AuditCategory, AuditRange, AuditSeverity } from '@vunvault/contracts';
import {
  AUDIT_CATEGORY_LABELS,
  AUDIT_RANGE_LABELS,
  AUDIT_SEVERITY_LABELS,
} from '@vunvault/contracts';

/**
 * Filter & Search Audit Trail toolbar (Task 83b).
 *
 * The five controls map one-to-one onto `AuditQuery`: `q`, `category`,
 * `severity`, `actor` and `range`. Every option list is generated from the
 * contract's own label records, so the toolbar and the table cells cannot
 * disagree, and `range` defaults to `24h` exactly as `AuditQuery` does.
 *
 * The actor list is the reference's own roster — labels verbatim, values the
 * `actorLabel` the API stores (`system` for the automation entries).
 */

const CATEGORY_OPTIONS = Object.keys(AUDIT_CATEGORY_LABELS) as AuditCategory[];
const SEVERITY_OPTIONS = Object.keys(AUDIT_SEVERITY_LABELS) as AuditSeverity[];

/** The reference's Time Range order: the default first, then ascending span. */
const RANGE_OPTIONS: readonly AuditRange[] = ['24h', '1h', '6h', '7d', '30d'] as const;

/** Label verbatim from the reference; value is the stored `actorLabel`. */
const ACTOR_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'e.reed', label: 'e.reed (Super Admin)' },
  { value: 'a.njoroge', label: 'a.njoroge (Admin)' },
  { value: 'd.mwangi', label: 'd.mwangi (Analyst)' },
  { value: 'f.hassan', label: 'f.hassan (Analyst)' },
  { value: 'b.otieno', label: 'b.otieno (Operator)' },
  { value: 'g.wanjiru', label: 'g.wanjiru (Auditor)' },
  { value: 'system', label: 'System / automation' },
] as const;

export interface AuditToolbarValues {
  q: string;
  category: AuditCategory | '';
  severity: AuditSeverity | '';
  actor: string;
  range: AuditRange;
}

export interface AuditToolbarProps {
  values: AuditToolbarValues;
  shown: number;
  total: number;
  onChange(patch: Partial<AuditToolbarValues>): void;
  onReset(): void;
}

export function AuditToolbar({ values, shown, total, onChange, onReset }: AuditToolbarProps) {
  return (
    <section className="al-toolbar" aria-labelledby="al-filter-heading">
      <div className="al-toolbar-head">
        <h2 className="al-toolbar-title" id="al-filter-heading">
          <SlidersHorizontal size={15} aria-hidden="true" />
          Filter &amp; Search Audit Trail
        </h2>
        <span className="al-results" role="status" aria-live="polite">
          Showing <strong id="al-visible-count">{shown}</strong> of{' '}
          <strong id="al-total-count">{total}</strong> events
        </span>
      </div>
      <div className="al-toolbar-grid">
        <div className="al-field">
          <label className="al-field-label" htmlFor="al-search">
            Search
          </label>
          <div className="al-input-wrap">
            <span className="al-input-icon" aria-hidden="true">
              <Search size={14} />
            </span>
            <input
              id="al-search"
              className="al-input"
              type="search"
              placeholder="Actor, IP, CVE, job ID or message…"
              autoComplete="off"
              value={values.q}
              onChange={(event) => onChange({ q: event.target.value })}
            />
          </div>
        </div>

        <div className="al-field">
          <label className="al-field-label" htmlFor="al-category">
            Event Type
          </label>
          <select
            id="al-category"
            className="al-select"
            value={values.category}
            onChange={(event) => onChange({ category: event.target.value as AuditCategory | '' })}
          >
            <option value="">All events</option>
            {CATEGORY_OPTIONS.map((category) => (
              <option key={category} value={category}>
                {AUDIT_CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
        </div>

        <div className="al-field">
          <label className="al-field-label" htmlFor="al-severity">
            Severity
          </label>
          <select
            id="al-severity"
            className="al-select"
            value={values.severity}
            onChange={(event) => onChange({ severity: event.target.value as AuditSeverity | '' })}
          >
            <option value="">Any severity</option>
            {SEVERITY_OPTIONS.map((severity) => (
              <option key={severity} value={severity}>
                {AUDIT_SEVERITY_LABELS[severity]}
              </option>
            ))}
          </select>
        </div>

        <div className="al-field">
          <label className="al-field-label" htmlFor="al-actor">
            Actor
          </label>
          <select
            id="al-actor"
            className="al-select"
            value={values.actor}
            onChange={(event) => onChange({ actor: event.target.value })}
          >
            <option value="">Any actor</option>
            {ACTOR_OPTIONS.map((actor) => (
              <option key={actor.value} value={actor.value}>
                {actor.label}
              </option>
            ))}
          </select>
        </div>

        <div className="al-field">
          <label className="al-field-label" htmlFor="al-range">
            Time Range
          </label>
          <select
            id="al-range"
            className="al-select"
            value={values.range}
            onChange={(event) => onChange({ range: event.target.value as AuditRange })}
          >
            {RANGE_OPTIONS.map((range) => (
              <option key={range} value={range}>
                {AUDIT_RANGE_LABELS[range]}
              </option>
            ))}
          </select>
        </div>

        <div className="al-toolbar-actions">
          <button type="button" className="al-clear-btn" id="al-clear-filters" onClick={onReset}>
            <RotateCcw size={13} aria-hidden="true" />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </section>
  );
}

'use client';

import { RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import type { ContentStatus, ContentType, RiskFlag } from '@vunvault/contracts';
import {
  CONTENT_STATUS_LABELS,
  CONTENT_TYPE_LABELS,
  RISK_FLAG_LABELS,
} from '@vunvault/contracts';

/**
 * Filter & Search Queue toolbar (Task 83).
 *
 * The four controls map one-to-one onto `ModerationQuery`: `q`, `type`,
 * `status` and `flag` — including the contract's own `"none"` sentinel, which
 * is the `No flags` option (items with no risk flags at all). Labels come from
 * `CONTENT_TYPE_LABELS`, `CONTENT_STATUS_LABELS` and `RISK_FLAG_LABELS` so the
 * selects and the table cells cannot disagree.
 *
 * The status select lists the five review-queue states from the reference, not
 * all eight `CONTENT_STATUSES`: `draft`, `scheduled` and `published` are not
 * queue states and filtering to them would show an empty table by design.
 *
 * Every control is URL-driven by the page (the Task 77/79 precedent), so any
 * filtered view is linkable and the browser Back button works.
 */

/** The queue's five review states, in the reference's order. */
const STATUS_OPTIONS: readonly ContentStatus[] = [
  'pending_review',
  'in_review',
  'changes_requested',
  'approved',
  'rejected',
] as const;

const TYPE_OPTIONS = Object.keys(CONTENT_TYPE_LABELS) as ContentType[];
const FLAG_OPTIONS = Object.keys(RISK_FLAG_LABELS) as RiskFlag[];

export interface ContentToolbarValues {
  q: string;
  type: ContentType | '';
  status: ContentStatus | '';
  flag: RiskFlag | 'none' | '';
}

export interface ContentToolbarProps {
  values: ContentToolbarValues;
  shown: number;
  total: number;
  onChange(patch: Partial<ContentToolbarValues>): void;
  onReset(): void;
}

export function ContentToolbar({ values, shown, total, onChange, onReset }: ContentToolbarProps) {
  return (
    <section className="cm-toolbar" aria-labelledby="cm-filter-heading">
      <div className="cm-toolbar-head">
        <h2 className="cm-toolbar-title" id="cm-filter-heading">
          <SlidersHorizontal size={15} aria-hidden="true" />
          Filter &amp; Search Queue
        </h2>
        <span className="cm-results" role="status" aria-live="polite">
          Showing <strong id="cm-visible-count">{shown}</strong> of{' '}
          <strong id="cm-total-count">{total}</strong> items
        </span>
      </div>
      <div className="cm-toolbar-grid">
        <div className="cm-field">
          <label className="cm-field-label" htmlFor="cm-search">
            Search
          </label>
          <div className="cm-input-wrap">
            <span className="cm-input-icon" aria-hidden="true">
              <Search size={14} />
            </span>
            <input
              id="cm-search"
              className="cm-input"
              type="search"
              placeholder="Title, slug, author or tag…"
              autoComplete="off"
              value={values.q}
              onChange={(event) => onChange({ q: event.target.value })}
            />
          </div>
        </div>

        <div className="cm-field">
          <label className="cm-field-label" htmlFor="cm-type">
            Content Type
          </label>
          <select
            id="cm-type"
            className="cm-select"
            value={values.type}
            onChange={(event) => onChange({ type: event.target.value as ContentType | '' })}
          >
            <option value="">All types</option>
            {TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {CONTENT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        <div className="cm-field">
          <label className="cm-field-label" htmlFor="cm-status">
            Review Status
          </label>
          <select
            id="cm-status"
            className="cm-select"
            value={values.status}
            onChange={(event) => onChange({ status: event.target.value as ContentStatus | '' })}
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {CONTENT_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        <div className="cm-field">
          <label className="cm-field-label" htmlFor="cm-flag">
            Risk Flag
          </label>
          <select
            id="cm-flag"
            className="cm-select"
            value={values.flag}
            onChange={(event) => onChange({ flag: event.target.value as RiskFlag | 'none' | '' })}
          >
            <option value="">Any flag</option>
            {FLAG_OPTIONS.map((flag) => (
              <option key={flag} value={flag}>
                {RISK_FLAG_LABELS[flag]}
              </option>
            ))}
            <option value="none">No flags</option>
          </select>
        </div>

        <div className="cm-toolbar-actions">
          <button type="button" className="cm-clear-btn" id="cm-clear-filters" onClick={onReset}>
            <RotateCcw size={13} aria-hidden="true" />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </section>
  );
}

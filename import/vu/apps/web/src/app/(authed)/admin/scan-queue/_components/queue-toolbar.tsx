'use client';

import { Filter, RotateCcw, Search } from 'lucide-react';
import {
  PAYMENT_STATUS_LABELS,
  REVIEW_GATE_LABELS,
  SCAN_TYPE_LABELS,
  type PaymentStatus,
  type ReviewGateState,
  type ScanType,
} from '@vunvault/contracts';
import '../_styles/scan-queue.css';

/**
 * Filter & Search toolbar — the queue's search box and the four
 * contract-enum selects. The filter values live in the URL (the page owns
 * `useSearchParams`), so every view is linkable. Option labels come from the
 * contract maps; the `All …` placeholders are verbatim from the reference.
 */

/** The five queue-relevant job statuses, in the reference's order. */
const STATUS_OPTIONS = [
  ['running', 'Running'],
  ['awaiting_review', 'Awaiting Review'],
  ['completed', 'Completed'],
  ['queued', 'Queued'],
  ['held', 'Held'],
] as const;

export interface QueueToolbarValues {
  q: string;
  status: string;
  gate: string;
  payment: string;
  type: string;
}

interface QueueToolbarProps {
  values: QueueToolbarValues;
  shown: number;
  total: number;
  onChange(patch: Partial<QueueToolbarValues>): void;
  onReset(): void;
}

export function QueueToolbar({ values, shown, total, onChange, onReset }: QueueToolbarProps) {
  return (
    <section className="sq-toolbar" aria-labelledby="sq-filter-heading">
      <div className="sq-toolbar-head">
        <h2 className="sq-toolbar-title" id="sq-filter-heading">
          <Filter size={15} aria-hidden="true" />
          Filter & Search Queue
        </h2>
        <span className="sq-results" role="status" aria-live="polite">
          Showing <strong id="sq-visible-count">{shown}</strong> of{' '}
          <strong id="sq-total-count">{total}</strong> jobs
        </span>
      </div>
      <div className="sq-toolbar-grid">
        <div className="sq-field">
          <label className="sq-field-label" htmlFor="sq-search">
            Search
          </label>
          <div className="sq-input-wrap">
            <span className="sq-input-icon" aria-hidden="true">
              <Search size={14} />
            </span>
            <input
              id="sq-search"
              className="sq-input"
              type="search"
              placeholder="Job ID, target host, client or requester…"
              autoComplete="off"
              value={values.q}
              onChange={(event) => onChange({ q: event.target.value })}
            />
          </div>
        </div>

        <div className="sq-field">
          <label className="sq-field-label" htmlFor="sq-status">
            Job Status
          </label>
          <select
            id="sq-status"
            className="sq-select"
            value={values.status}
            onChange={(event) => onChange({ status: event.target.value })}
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="sq-field">
          <label className="sq-field-label" htmlFor="sq-gate">
            Review Gate
          </label>
          <select
            id="sq-gate"
            className="sq-select"
            value={values.gate}
            onChange={(event) => onChange({ gate: event.target.value })}
          >
            <option value="">All gate states</option>
            {(Object.keys(REVIEW_GATE_LABELS) as ReviewGateState[]).map((state) => (
              <option key={state} value={state}>
                {REVIEW_GATE_LABELS[state]}
              </option>
            ))}
          </select>
        </div>

        <div className="sq-field">
          <label className="sq-field-label" htmlFor="sq-payment">
            Payment
          </label>
          <select
            id="sq-payment"
            className="sq-select"
            value={values.payment}
            onChange={(event) => onChange({ payment: event.target.value })}
          >
            <option value="">All payments</option>
            {(Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).map((status) => (
              <option key={status} value={status}>
                {PAYMENT_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        <div className="sq-field">
          <label className="sq-field-label" htmlFor="sq-type">
            Scan Type
          </label>
          <select
            id="sq-type"
            className="sq-select"
            value={values.type}
            onChange={(event) => onChange({ type: event.target.value })}
          >
            <option value="">All types</option>
            {(Object.keys(SCAN_TYPE_LABELS) as ScanType[]).map((type) => (
              <option key={type} value={type}>
                {SCAN_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        <div className="sq-toolbar-actions">
          <button type="button" className="sq-clear-btn" id="sq-clear-filters" onClick={onReset}>
            <RotateCcw size={14} aria-hidden="true" />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </section>
  );
}

'use client';

import { Layers } from 'lucide-react';
import type { StaffMember } from '@vunvault/contracts';
import { cn } from '@vunvault/lib';
import '../_styles/scan-queue.css';

/**
 * Bulk action bar (Task 77) — slides in (`.is-active`) once at least one row
 * is selected; inert and hidden otherwise. The count line is the reference's
 * `<strong>n</strong> job(s) selected` under `aria-live="polite"`.
 *
 * BULK CAN NEVER RELEASE — releasing a job is the Task 78 review-gate
 * decision, one job at a time, through the five checks. The reviewer select
 * lists the active staff holding `scans:review` (default: the current user,
 * pre-selected by the page).
 */

export type BulkActionKind =
  'open_review_gate' | 'assign_reviewer' | 'place_on_hold' | 'reject_batch';

interface BulkBarProps {
  selectedCount: number;
  reviewers: StaffMember[];
  reviewerId: string;
  pending: boolean;
  onReviewerChange(id: string): void;
  onAction(action: BulkActionKind): void;
  onClear(): void;
}

export function BulkBar({
  selectedCount,
  reviewers,
  reviewerId,
  pending,
  onReviewerChange,
  onAction,
  onClear,
}: BulkBarProps) {
  const active = selectedCount > 0;

  return (
    <div
      className={cn('sq-bulkbar', active ? 'is-active' : undefined)}
      id="sq-bulkbar"
      role="region"
      aria-label="Bulk job actions"
      inert={!active}
    >
      <span className="sq-bulk-count" aria-live="polite">
        <Layers size={15} aria-hidden="true" />
        <strong id="sq-selected-count">{selectedCount}</strong>
        job(s) selected
      </span>
      <div className="sq-bulk-actions">
        <button
          type="button"
          className="sq-bulk-btn sq-bulk-btn--primary"
          disabled={pending}
          onClick={() => onAction('open_review_gate')}
        >
          Open Review Gate
        </button>
        <label className="sr-only" htmlFor="sq-reviewer">
          Reviewer
        </label>
        <select
          id="sq-reviewer"
          className="sq-bulk-select"
          value={reviewerId}
          disabled={pending}
          onChange={(event) => onReviewerChange(event.target.value)}
        >
          {reviewers.map((member) => (
            <option key={member.id} value={member.id}>
              {member.fullName}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="sq-bulk-btn"
          disabled={pending}
          onClick={() => onAction('assign_reviewer')}
        >
          Assign Reviewer
        </button>
        <button
          type="button"
          className="sq-bulk-btn"
          disabled={pending}
          onClick={() => onAction('place_on_hold')}
        >
          Place On Hold
        </button>
        <button
          type="button"
          className="sq-bulk-btn sq-bulk-btn--danger"
          disabled={pending}
          onClick={() => onAction('reject_batch')}
        >
          Reject Batch
        </button>
        <button type="button" className="sq-bulk-btn" disabled={pending} onClick={onClear}>
          Clear Selection
        </button>
      </div>
    </div>
  );
}

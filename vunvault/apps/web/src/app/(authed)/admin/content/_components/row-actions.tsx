'use client';

import { useState } from 'react';
import {
  Archive,
  CalendarClock,
  Eye,
  RotateCcw,
  Send,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react';
import type { ContentReviewAction, ModerationItem } from '@vunvault/contracts';
import { isApiError } from '@vunvault/lib';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  toast,
} from '@vunvault/ui';
import { useModerationAction } from '../_hooks/use-moderation';

/**
 * Queue row actions (Task 83).
 *
 * The action set follows the item's status exactly as the reference pairs them:
 * pending → `Review` + `Approve`, in review → `Continue Review` + `Approve`,
 * changes requested → `Re-review` + `Remind Author`, approved → `Publish Now` +
 * `Schedule`, rejected → `Reopen` + `Archive`.
 *
 * `Review` / `Approve` / `Request Changes` all open the review dialog — the
 * five editorial checks are a UI rule the dialog owns, so no row button may
 * approve behind its back. `Approve` merely pre-selects the decision.
 *
 * `Publish Now`, `Schedule` and `Remind Author` are direct writes. `Schedule`
 * collects a future date-time first (`SCHEDULE_REQUIRED_MESSAGE` is the
 * contract's own rule). `Preview` has no endpoint and only toasts.
 *
 * DEVIATION (documented): `Reopen` and `Archive` appear in the reference for
 * rejected items, but `CONTENT_REVIEW_ACTIONS` has no such member — all six
 * actions are already spoken for. Per the plan's decision #5 ("some prototype
 * actions have no API and are rendered disabled with a tooltip") they render
 * disabled rather than inventing an endpoint.
 */

/** The note floor the contract enforces for reject / request_changes. */
export const NOTE_MIN = 10;

export const NOTE_TOO_SHORT = `Add a note of at least ${NOTE_MIN} characters.`;

/** Status → the reference's two row buttons. */
export interface RowActionsProps {
  item: ModerationItem;
  canModerate: boolean;
  /** Opens the review dialog, optionally with a decision pre-selected. */
  onReview(preset: ContentReviewAction | null): void;
}

export function RowActions({ item, canModerate, onReview }: RowActionsProps) {
  const action = useModerationAction();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduledFor, setScheduledFor] = useState('');
  const [scheduleError, setScheduleError] = useState('');

  const run = (next: ContentReviewAction, extra?: { scheduledFor?: string }): void => {
    action.mutate(
      { id: item.id, action: next, ...extra },
      {
        onSuccess: () => toastFor(next, item.title),
        onError: (error) => reportError(error),
      },
    );
  };

  const submitSchedule = (): void => {
    if (scheduledFor === '') {
      setScheduleError('Choose a publish date and time to schedule');
      return;
    }
    const when = new Date(scheduledFor);
    if (when.getTime() <= Date.now()) {
      setScheduleError('Choose a future date and time.');
      return;
    }
    setScheduleOpen(false);
    setScheduleError('');
    run('schedule', { scheduledFor: when.toISOString() });
  };

  const disabled = !canModerate || action.isPending;

  return (
    <>
      <div className="cm-row-actions">
        {primaryAction(item, disabled, onReview, () => setScheduleOpen(true), run)}
        <button
          type="button"
          className="cm-act"
          disabled={disabled}
          onClick={() =>
            toast({
              kind: 'info',
              title: 'Reader preview',
              message: `"${item.title}" — rendering as it would appear to the public.`,
            })
          }
        >
          <Eye size={12} aria-hidden="true" />
          Preview
        </button>
      </div>

      <Dialog
        open={scheduleOpen}
        onOpenChange={(next) => {
          setScheduleOpen(next);
          if (!next) setScheduleError('');
        }}
      >
        <DialogContent size="sm">
          <DialogTitle>Schedule publication</DialogTitle>
          <DialogDescription>
            {`"${item.title}" will go live at the next scheduled slot after this time.`}
          </DialogDescription>
          <div className="cm-field">
            <label className="cm-field-label" htmlFor="cm-schedule-for">
              Publish at (UTC)
            </label>
            <input
              id="cm-schedule-for"
              className="cm-input"
              type="datetime-local"
              value={scheduledFor}
              onChange={(event) => {
                setScheduledFor(event.target.value);
                if (scheduleError !== '') setScheduleError('');
              }}
            />
            {scheduleError === '' ? null : (
              <span className="cm-error" role="alert">
                {scheduleError}
              </span>
            )}
          </div>
          <div className="cm-dialog-actions">
            <DialogClose asChild>
              <button type="button" className="adm-btn adm-btn-ghost">
                Cancel
              </button>
            </DialogClose>
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              disabled={action.isPending}
              onClick={submitSchedule}
            >
              <CalendarClock size={15} aria-hidden="true" />
              <span>Schedule</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** The status-driven primary/secondary pair from the reference markup. */
function primaryAction(
  item: ModerationItem,
  disabled: boolean,
  onReview: (preset: ContentReviewAction | null) => void,
  openSchedule: () => void,
  run: (action: ContentReviewAction) => void,
) {
  switch (item.status) {
    case 'pending_review':
      return (
        <>
          <ReviewButton label="Review" disabled={disabled} onClick={() => onReview(null)} />
          <ApproveButton disabled={disabled} onClick={() => onReview('approve')} />
        </>
      );
    case 'in_review':
      return (
        <>
          <ReviewButton
            label="Continue Review"
            disabled={disabled}
            onClick={() => onReview(null)}
          />
          <ApproveButton disabled={disabled} onClick={() => onReview('approve')} />
        </>
      );
    case 'changes_requested':
      return (
        <>
          <ReviewButton label="Re-review" disabled={disabled} onClick={() => onReview(null)} />
          <button
            type="button"
            className="cm-act"
            disabled={disabled}
            onClick={() => run('remind_author')}
          >
            <MessageSquare size={12} aria-hidden="true" />
            Remind Author
          </button>
        </>
      );
    case 'approved':
      return (
        <>
          <button
            type="button"
            className="cm-act"
            disabled={disabled}
            onClick={() => run('publish')}
          >
            <Send size={12} aria-hidden="true" />
            Publish Now
          </button>
          <button type="button" className="cm-act" disabled={disabled} onClick={openSchedule}>
            <CalendarClock size={12} aria-hidden="true" />
            Schedule
          </button>
        </>
      );
    case 'rejected':
      // No `reopen` / `archive` in CONTENT_REVIEW_ACTIONS — see the file note.
      return (
        <>
          <button
            type="button"
            className="cm-act"
            disabled
            title="Reopen is not available yet."
          >
            <RotateCcw size={12} aria-hidden="true" />
            Reopen
          </button>
          <button
            type="button"
            className="cm-act cm-act--danger"
            disabled
            title="Archive is not available yet."
          >
            <Archive size={12} aria-hidden="true" />
            Archive
          </button>
        </>
      );
    default:
      // draft / scheduled / published are not queue states; the dialog is the
      // only sensible entry point.
      return <ReviewButton label="Review" disabled={disabled} onClick={() => onReview(null)} />;
  }
}

function ReviewButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick(): void;
}) {
  return (
    <button type="button" className="cm-act" disabled={disabled} onClick={onClick}>
      <Eye size={12} aria-hidden="true" />
      {label}
    </button>
  );
}

function ApproveButton({ disabled, onClick }: { disabled: boolean; onClick(): void }) {
  return (
    <button type="button" className="cm-act" disabled={disabled} onClick={onClick}>
      <CheckCircle2 size={12} aria-hidden="true" />
      Approve
    </button>
  );
}

/** The verbatim success pair per action. */
export function toastFor(action: ContentReviewAction, title: string): void {
  switch (action) {
    case 'approve':
      toast({
        kind: 'ok',
        title: 'Content approved',
        message: `"${title}" cleared for publication with reviewer notes.`,
      });
      return;
    case 'request_changes':
      toast({
        kind: 'warn',
        title: 'Changes requested',
        message: `"${title}" returned to the author for revision.`,
      });
      return;
    case 'reject':
      toast({
        kind: 'crit',
        title: 'Content rejected',
        message: `"${title}" archived. No further review unless reopened.`,
      });
      return;
    case 'publish':
      toast({
        kind: 'ok',
        title: 'Content published',
        message: `"${title}" is now live on the public website.`,
      });
      return;
    case 'schedule':
      toast({
        kind: 'ok',
        title: 'Publication scheduled',
        message: `"${title}" will go live at the next scheduled slot.`,
      });
      return;
    case 'remind_author':
      toast({
        kind: 'info',
        title: 'Author reminded',
        message: `"${title}" — notification sent to the author.`,
      });
      return;
  }
}

/** The spec's three error mappings, shared by the row actions and the dialog. */
export function reportError(error: unknown): void {
  if (isApiError(error) && error.status === 409 && error.code === 'own_submission') {
    toast({ kind: 'crit', title: 'You cannot review your own submission.' });
    return;
  }
  if (isApiError(error) && error.status === 403 && error.code === 'legal_review_required') {
    toast({
      kind: 'crit',
      title: 'This item needs administrator sign-off before it can be published.',
    });
    return;
  }
  if (isApiError(error) && error.status === 409 && error.code === 'invalid_transition') {
    // The queue moved under us — the mutation's invalidation already refetched.
    toast({
      kind: 'warn',
      title: 'Action recorded',
      message: 'This item changed state. The queue has been refreshed.',
    });
    return;
  }
  toast({
    kind: 'crit',
    title: 'Could not record the decision',
    message: isApiError(error) ? error.message : 'Please try again.',
  });
}

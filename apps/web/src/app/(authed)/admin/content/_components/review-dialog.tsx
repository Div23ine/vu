'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Eye, ShieldCheck, X } from 'lucide-react';
import type { ContentReviewAction, ModerationItem } from '@vunvault/contracts';
import { CONTENT_TYPE_LABELS, ModerationActionBody, ROLE_LABELS } from '@vunvault/contracts';
import { cn, formatQueueStamp, formatUtcStamp, isApiError } from '@vunvault/lib';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@vunvault/ui';
import { useSession } from '../../../../../lib/session';
import { useModerationAction } from '../_hooks/use-moderation';
import {
  EDITORIAL_CHECK_KEYS,
  EditorialChecks,
  EMPTY_CHECKS,
  type EditorialCheckKey,
  type EditorialChecksState,
} from './editorial-checks';
import { NOTE_MIN, NOTE_TOO_SHORT, reportError, toastFor } from './row-actions';

/**
 * Editorial review dialog — the queue's only door onto a decision.
 *
 * Structure mirrors an earlier iteration's review gate, because the rule is the same shape:
 * five mandatory checks, a decision, a reviewer note, and a live status line
 * that walks the four verbatim states. `Approve` additionally requires all five
 * checks (the spec's UI rule — the API enforces separation of duties on its own
 * through `409 own_submission`).
 *
 * The payload is checked against the contract's `ModerationActionBody` before
 * it is sent, so the note floor for `request_changes` / `reject` is the API's
 * rule rather than a second copy of it. Radix supplies `role="dialog"`,
 * `aria-modal`, the focus trap and Escape-to-close; the dialog is not
 * dismissible while the write is in flight.
 */

/** The three decisions, titles and descriptions verbatim from the reference. */
const DECISIONS = [
  {
    action: 'approve' as const,
    title: 'Approve for Publication',
    description: 'Clears the item for the public website and any scheduled client release.',
  },
  {
    action: 'request_changes' as const,
    title: 'Request Changes',
    description: 'Returns the item to the author with reviewer notes attached.',
  },
  {
    action: 'reject' as const,
    title: 'Reject',
    description: 'Marks the item invalid with feedback. It will not be published.',
  },
];

export const CONFIRM_HINT =
  'Complete all five editorial checks and select a decision to enable the action.';

export interface ReviewDialogProps {
  item: ModerationItem | null;
  /** `Approve` when the row's quick-approve button opened the dialog. */
  preset: ContentReviewAction | null;
  open: boolean;
  onOpenChange(open: boolean): void;
}

export function ReviewDialog({ item, preset, open, onOpenChange }: ReviewDialogProps) {
  const { user } = useSession();
  const action = useModerationAction();

  const [checks, setChecks] = useState<EditorialChecksState>(EMPTY_CHECKS);
  const [decision, setDecision] = useState<ContentReviewAction | null>(null);
  const [note, setNote] = useState('');
  const [noteTouched, setNoteTouched] = useState(false);
  const [decidedAt, setDecidedAt] = useState<Date | null>(null);

  // Every opening starts a fresh review — nothing carries over between items.
  useEffect(() => {
    if (!open) return;
    setChecks(EMPTY_CHECKS);
    setDecision(preset);
    setNote('');
    setNoteTouched(false);
    setDecidedAt(preset === null ? null : new Date());
  }, [open, item?.id, preset]);

  if (item === null) return null;

  const passed = EDITORIAL_CHECK_KEYS.filter((key) => checks[key]).length;
  const total = EDITORIAL_CHECK_KEYS.length;
  const outstanding = total - passed;
  const allChecked = outstanding === 0;

  const noteRequired = decision === 'reject' || decision === 'request_changes';
  const noteValid = !noteRequired || note.trim().length >= NOTE_MIN;
  // Approve is the only decision gated on the full checklist.
  const decisionOk = decision !== null && (decision !== 'approve' || allChecked) && noteValid;

  const statusLine = !allChecked
    ? decision === null && outstanding === total
      ? CONFIRM_HINT
      : `${outstanding} editorial check(s) still outstanding before a decision can be confirmed.`
    : decision === null
      ? 'All editorial checks complete — select a decision to continue.'
      : 'All checks complete. Confirming will write this editorial decision to the audit log.';

  const noteError = noteTouched && !noteValid ? NOTE_TOO_SHORT : '';

  const onToggle = (key: EditorialCheckKey): void => {
    setChecks((current) => ({ ...current, [key]: !current[key] }));
  };

  const chooseDecision = (next: ContentReviewAction): void => {
    setDecision(next);
    setDecidedAt(new Date());
  };

  const submit = (): void => {
    if (decision === null) return;
    setNoteTouched(true);
    // The contract decides whether the payload is acceptable — one source of
    // truth for the note floor and the schedule requirement.
    const parsed = ModerationActionBody.safeParse({
      action: decision,
      ...(note.trim() === '' ? {} : { note: note.trim() }),
    });
    if (!parsed.success) return;

    action.mutate(
      { id: item.id, action: decision, ...(note.trim() === '' ? {} : { note: note.trim() }) },
      {
        onSuccess: () => {
          // The verbatim decision pair, then close (the row actions share it).
          toastFor(decision, item.title);
          onOpenChange(false);
        },
        onError: (error) => {
          // `own_submission` and `legal_review_required` are answers about THIS
          // reviewer, not transient failures — surface them and stay open.
          reportError(error);
          if (isApiError(error) && error.status === 409 && error.code === 'invalid_transition') {
            onOpenChange(false);
          }
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && action.isPending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        size="lg"
        className="cm-modal-content"
        dismissible={!action.isPending}
        hideClose
        aria-labelledby="cm-review-title"
      >
        <div className="cm-modal-head">
          <div>
            <span className="cm-modal-eyebrow">
              <ShieldCheck size={13} aria-hidden="true" />
              Pre-Publication Review
            </span>
            <DialogTitle className="cm-modal-title" id="cm-review-title">
              Editorial sign-off
            </DialogTitle>
            <DialogDescription className="cm-modal-sub">
              <span id="cm-modal-slug">{item.slugPath}</span>
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <button
              type="button"
              className="cm-modal-close"
              aria-label="Close review"
              disabled={action.isPending}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </DialogClose>
        </div>

        <div className="cm-modal-body">
          <div>
            <div className="cm-modal-section-title">
              <Eye size={13} aria-hidden="true" />
              Content Preview
            </div>
            <div className="cm-preview-body">
              <h3 className="cm-preview-title" id="cm-modal-preview-title">
                {item.title}
              </h3>
              <div className="cm-preview-meta">
                <span id="cm-modal-preview-type">{CONTENT_TYPE_LABELS[item.type]}</span>
                <span aria-hidden="true">·</span>
                <span id="cm-modal-preview-author">{item.author.fullName}</span>
                <span aria-hidden="true">·</span>
                <span id="cm-modal-preview-date">
                  {formatQueueStamp(new Date(item.submittedAt))}
                </span>
              </div>
              <p className="cm-preview-excerpt" id="cm-modal-preview-excerpt">
                {item.summary ?? 'Full content preview is rendered here for the reviewer.'}
              </p>
              <div className="cm-preview-tags" id="cm-modal-preview-tags">
                {/* `ModerationItem` carries no tag list, so the reference's own
          placeholder chip is what renders. */}
                <span className="cm-preview-tag">no tags</span>
              </div>
            </div>
          </div>

          <EditorialChecks checks={checks} disabled={action.isPending} onToggle={onToggle} />

          <div>
            <div className="cm-modal-section-title">
              <CheckCircle2 size={13} aria-hidden="true" />
              Editorial Decision
            </div>
            <div className="cm-decisions" role="radiogroup" aria-label="Editorial Decision">
              {DECISIONS.map((option) => {
                const id = `cm-decision-${option.action}`;
                return (
                  <label
                    key={option.action}
                    className={cn('cm-decision', `cm-decision--${option.action}`)}
                    htmlFor={id}
                  >
                    <input
                      id={id}
                      type="radio"
                      name="cm-decision"
                      value={option.action}
                      checked={decision === option.action}
                      disabled={action.isPending}
                      onChange={() => chooseDecision(option.action)}
                    />
                    <span className="cm-decision-title">{option.title}</span>
                    <span className="cm-decision-desc">{option.description}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="cm-note-field">
            <label className="cm-field-label" htmlFor="cm-review-note">
              <span>Reviewer Notes</span>
              <span className="cm-hint">
                Recorded in the audit log and sent to the author if changes are requested.
              </span>
            </label>
            <textarea
              id="cm-review-note"
              className={cn('cm-textarea', noteError === '' ? undefined : 'is-invalid')}
              placeholder="Summarise what was checked, any residual concerns and the rationale for this decision…"
              rows={4}
              value={note}
              aria-invalid={noteError === '' ? undefined : true}
              aria-describedby={noteError === '' ? undefined : 'cm-review-note-error'}
              disabled={action.isPending}
              onChange={(event) => {
                setNote(event.target.value);
                if (noteTouched) setNoteTouched(false);
              }}
              onBlur={() => setNoteTouched(true)}
            />
            {noteError === '' ? null : (
              <span className="cm-error" id="cm-review-note-error" role="alert">
                {noteError}
              </span>
            )}
          </div>

          <div className="cm-reviewer">
            <span>
              <span className="cm-reviewer-label">Reviewer</span>
              <span className="cm-reviewer-value">{user?.email ?? '—'}</span>
            </span>
            <span>
              <span className="cm-reviewer-label">Role</span>
              <span className="cm-reviewer-value">
                {user === null ? '—' : ROLE_LABELS[user.role]}
              </span>
            </span>
            <span>
              <span className="cm-reviewer-label">Decision Timestamp</span>
              <span className="cm-reviewer-value">
                {decidedAt === null ? '—' : formatUtcStamp(decidedAt)}
              </span>
            </span>
          </div>
        </div>

        <div className="cm-modal-foot">
          <span className="cm-modal-foot-note" id="cm-modal-hint" role="status">
            {statusLine}
          </span>
          <div className="cm-modal-foot-actions">
            <DialogClose asChild>
              <button type="button" className="adm-btn adm-btn-ghost" disabled={action.isPending}>
                Cancel
              </button>
            </DialogClose>
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              id="cm-confirm-decision"
              disabled={!decisionOk || action.isPending}
              onClick={submit}
            >
              <CheckCircle2 size={15} aria-hidden="true" />
              <span>Confirm Decision</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

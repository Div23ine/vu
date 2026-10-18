'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { GateChecks, ReviewDecision, ScanJob } from '@vunvault/contracts';
import { GATE_DECISION_LABELS, PAYMENT_STATUS_LABELS, ROLE_LABELS } from '@vunvault/contracts';
import { isApiError } from '@vunvault/lib';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  toast,
} from '@vunvault/ui';
import { can } from '../../../../../lib/permissions';
import { useSession } from '../../../../../lib/session';
import { useGateDecision } from '../_hooks/use-gate-decision';
import { GateChecklist, REVIEW_CHECKS, type ReviewCheckKey } from './gate-checklist';
import { GateDecisionPicker } from './gate-decision-picker';
import { GateBadge } from './gate-badge';
import '../_styles/scan-queue.css';

/**
 * Review-gate dialog — the release lock's ONLY door: the five
 * contract checks, the three decision cards, the required reviewer note
 * (min 10 characters), the payment-lock panel and the live status line, on
 * `POST /admin/scans/:id/gate-decision`. A `409 payment_outstanding` shows
 * the inline critical panel instead of any success toast (the API recorded
 * the attempt); `409 already_released` closes and lets the queue refresh;
 * `403` toasts the verbatim role line. Radix supplies the focus trap,
 * Escape and `aria-labelledby`; the confirm label follows the decision.
 */

const EMPTY_CHECKS: GateChecks = REVIEW_CHECKS.reduce((acc, key) => {
  acc[key] = false;
  return acc;
}, {} as GateChecks);

const NOTE_MIN = 10;

export const CONFIRM_HINT =
  'Complete all five verification steps and select a decision to enable the gate action.';

interface ReviewGateDialogProps {
  job: ScanJob | null;
  open: boolean;
  onOpenChange(open: boolean): void;
}

export function ReviewGateDialog({ job, open, onOpenChange }: ReviewGateDialogProps) {
  const { user } = useSession();
  const gate = useGateDecision();

  const [checks, setChecks] = useState<GateChecks>(EMPTY_CHECKS);
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [note, setNote] = useState('');
  const [noteTouched, setNoteTouched] = useState(false);
  const [paymentBlocked, setPaymentBlocked] = useState(false);

  // Every opening starts a fresh review — nothing is carried over.
  useEffect(() => {
    if (!open) return;
    setChecks(EMPTY_CHECKS);
    setDecision(null);
    setNote('');
    setNoteTouched(false);
    setPaymentBlocked(false);
  }, [open, job?.id]);

  if (job === null) return null;

  const canRelease = can(user, 'scans:release');
  const passed = REVIEW_CHECKS.filter((key) => checks[key]).length;
  const total = REVIEW_CHECKS.length;
  const outstanding = total - passed;
  const allChecked = outstanding === 0;
  const noteValid = note.trim().length >= NOTE_MIN;
  const decisionOk =
    decision !== null && (decision !== 'approve_release' || allChecked) && noteValid;

  const statusLine = !allChecked
    ? decision === null && outstanding === total
      ? CONFIRM_HINT
      : `${outstanding} verification step(s) still outstanding before the gate can be cleared.`
    : decision === null
      ? 'All verification steps complete — select a decision to continue.'
      : 'All checks complete. Confirming will write this decision to the immutable audit log.';

  const onToggle = (key: ReviewCheckKey): void => {
    setChecks((current) => ({ ...current, [key]: !current[key] }));
  };

  const submit = (): void => {
    if (decision === null || !noteValid) return;
    setNoteTouched(true);
    gate.mutate(
      { id: job.id, body: { decision, checks, note: note.trim() } },
      {
        onSuccess: () => {
          if (decision === 'approve_release') {
            toast({
              kind: 'ok',
              title: 'Client portal access granted. Decision written to the audit log',
              message: `${job.jobCode} released with reviewer note.`,
            });
          } else if (decision === 'hold_remediation') {
            toast({
              kind: 'warn',
              title: `${job.jobCode} held for remediation`,
              message:
                'Report remains locked. The client has been notified of outstanding findings.',
            });
          } else {
            toast({
              kind: 'crit',
              title: `${job.jobCode} rejected`,
              message: 'Job returned to the assigned analyst for rework and re-submission.',
            });
          }
          onOpenChange(false);
        },
        onError: (error) => {
          if (isApiError(error) && error.status === 409 && error.code === 'payment_outstanding') {
            // The API recorded the attempt and locked the job — no success.
            setPaymentBlocked(true);
            return;
          }
          if (isApiError(error) && error.status === 409 && error.code === 'already_released') {
            onOpenChange(false);
            return;
          }
          if (isApiError(error) && error.status === 403) {
            toast({
              kind: 'crit',
              title: 'Your role cannot release reports. Ask an administrator.',
            });
            return;
          }
          toast({
            kind: 'crit',
            title: 'Could not record the decision',
            message: 'Please try again.',
          });
        },
      },
    );
  };

  const unpaid = job.paymentStatus !== 'paid';
  const confirmLabel =
    decision === null ? 'Confirm Gate Decision' : GATE_DECISION_LABELS[decision].title;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="sq-modal-content">
        <div className="sq-modal-head">
          <div>
            <span className="sq-modal-eyebrow">
              <ShieldCheck size={13} aria-hidden="true" />
              Mandatory Admin Review Gate
            </span>
            <DialogTitle className="sq-modal-title">
              Review findings before client release
            </DialogTitle>
            <DialogDescription className="sq-modal-sub">
              <span>{job.jobCode}</span> · <span>{job.targetHost}</span> ·{' '}
              <span>{job.client.name}</span>
            </DialogDescription>
          </div>
          <GateBadge state={job.reviewGateState} />
        </div>

        <div className="sq-modal-body">
          <div>
            <div className="sq-modal-section-title">Findings Summary</div>
            {/* TODO(backend-contract): no admin findings-count endpoint exists
        yet — the tiles stay em-dashed rather than inventing zeros. */}
            <div className="sq-findings">
              <div className="sq-finding sq-finding--crit">
                <span className="sq-finding-count">—</span>
                <span className="sq-finding-label">Critical</span>
              </div>
              <div className="sq-finding sq-finding--high">
                <span className="sq-finding-count">—</span>
                <span className="sq-finding-label">High</span>
              </div>
              <div className="sq-finding sq-finding--med">
                <span className="sq-finding-count">—</span>
                <span className="sq-finding-label">Medium</span>
              </div>
              <div className="sq-finding sq-finding--low">
                <span className="sq-finding-count">—</span>
                <span className="sq-finding-label">Low</span>
              </div>
            </div>
          </div>

          <div>
            <div className="sq-modal-section-title">Client Request Context</div>
            <dl className="sq-context">
              <div className="sq-context-item">
                <dt>Client</dt>
                <dd>{job.client.name}</dd>
              </div>
              <div className="sq-context-item">
                <dt>Target Host</dt>
                <dd>{job.targetHost}</dd>
              </div>
              <div className="sq-context-item">
                <dt>Payment</dt>
                <dd>{PAYMENT_STATUS_LABELS[job.paymentStatus]}</dd>
              </div>
            </dl>
          </div>

          <GateChecklist checks={checks} onToggle={onToggle} disabled={gate.isPending} />

          {unpaid ? (
            <div className="sq-payment-panel" role="status">
              <strong>
                {job.paymentStatus === 'pending'
                  ? 'Pending — awaiting settlement'
                  : 'Overdue — collection required'}
              </strong>
              <span>Release is blocked until payment is settled.</span>
            </div>
          ) : null}

          {paymentBlocked ? (
            <div className="sq-blocked-panel" role="alert">
              Release blocked — payment is outstanding. The decision was recorded and the job is
              locked until the invoice is paid.
            </div>
          ) : null}

          <GateDecisionPicker decision={decision} canRelease={canRelease} onChange={setDecision} />

          <div className="sq-note-field">
            <label className="sq-field-label" htmlFor="sq-review-note">
              Reviewer Note (recorded in the audit log)
            </label>
            <textarea
              id="sq-review-note"
              className="sq-textarea"
              placeholder="Summarise what was verified, any residual risk accepted, and the rationale for this decision…"
              value={note}
              disabled={gate.isPending}
              onChange={(event) => setNote(event.target.value)}
              onBlur={() => setNoteTouched(true)}
              aria-invalid={noteTouched && !noteValid ? true : undefined}
              aria-describedby={noteTouched && !noteValid ? 'sq-note-error' : undefined}
            />
            {noteTouched && !noteValid ? (
              <span className="sq-note-error" id="sq-note-error">
                Add a reviewer note of at least 10 characters.
              </span>
            ) : null}
          </div>

          <div className="sq-reviewer">
            <span>
              <span className="sq-reviewer-label">Reviewer</span>
              <br />
              <span className="sq-reviewer-value">{user?.email ?? '—'}</span>
            </span>
            <span>
              <span className="sq-reviewer-label">Role</span>
              <br />
              <span className="sq-reviewer-value">
                {user === null ? '—' : ROLE_LABELS[user.role]}
              </span>
            </span>
            <span>
              <span className="sq-reviewer-label">Gate Timestamp</span>
              <br />
              <span className="sq-reviewer-value">—</span>
            </span>
          </div>
        </div>

        <div className="sq-modal-foot">
          <span className="sq-modal-foot-note" id="sq-gate-hint">
            {statusLine}
          </span>
          <div className="sq-modal-foot-actions">
            <DialogClose asChild>
              <button type="button" className="adm-btn adm-btn-ghost">
                Cancel
              </button>
            </DialogClose>
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              id="sq-confirm-gate"
              disabled={!decisionOk || gate.isPending}
              onClick={submit}
            >
              <ShieldCheck size={15} aria-hidden="true" />
              <span>{confirmLabel}</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useState } from 'react';
import { FileSearch } from 'lucide-react';
import type { ScanJob } from '@vunvault/contracts';
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
import { useCancelJob, useRequestPayment } from '../_hooks/use-scan-queue';
import { ReviewGateDialog } from './review-gate-dialog';
import { ScanTerminalDialog } from './scan-terminal-dialog';
import '../_styles/scan-queue.css';

/**
 * Row actions (Tasks 77 + 78) — state-dependent, permission-gated:
 * `Review Findings` (gate `in_review`, needs `scans:review`) opens the Task
 * 78 review-gate dialog, the report preview is a read-only toast (
 * the preview endpoint does not exist yet), `Request Payment` (unpaid jobs)
 * and `Cancel Job` (open jobs, behind a confirm dialog). Items the session
 * lacks `scans:review` for are hidden entirely. Task 96 adds `Live output`:
 * the staff terminal dialog for a running job (and for a job finished within
 * the hour, whose replay buffer still exists), streaming over the Task 95
 * WebSocket relay.
 */

/** The replay buffer's TTL — a recently finished job can still be tailed. */
const REPLAY_WINDOW_MS = 3_600_000;

interface RowActionsProps {
  job: ScanJob;
  canReview: boolean;
}

export function RowActions({ job, canReview }: RowActionsProps) {
  const requestPayment = useRequestPayment();
  const cancelJob = useCancelJob();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);

  // Task 96: the live terminal. The session is read here rather than threaded
  // through the table (the `use-login.ts` pattern); the relay re-checks it on
  // every handshake regardless, so the button's visibility is a courtesy, not
  // the gate.
  const { user } = useSession();
  const canWatchLive = can(user, 'scans:read');
  const finishedRecently =
    job.completedAt !== null && Date.now() - Date.parse(job.completedAt) <= REPLAY_WINDOW_MS;
  const liveEligible =
    job.status === 'running' ||
    ((job.status === 'completed' || job.status === 'cancelled') && finishedRecently);

  const preview = (): void => {
    // TODO(backend-contract): no report-preview endpoint exists — read-only toast only.
    toast({
      kind: 'info',
      title: 'Opening report preview',
      message: `${job.jobCode} — client-facing copy (redacted).`,
    });
  };

  const requestPaymentNow = (): void => {
    requestPayment.mutate(job.id, {
      onSuccess: () => {
        toast({
          kind: 'ok',
          title: 'Payment reminder sent',
          message: `${job.jobCode} — invoice re-issued to the client billing contact.`,
        });
      },
      onError: () => {
        toast({ kind: 'crit', title: 'Could not send the reminder', message: 'Please try again.' });
      },
    });
  };

  const cancelNow = (): void => {
    setConfirmOpen(false);
    cancelJob.mutate(job.id, {
      onSuccess: () => {
        toast({
          kind: 'ok',
          title: 'Job cancelled',
          message: 'Job removed from the queue and archived to the audit trail.',
        });
      },
      onError: () => {
        toast({ kind: 'crit', title: 'Could not cancel the job', message: 'Please try again.' });
      },
    });
  };

  const cancellable =
    job.status === 'queued' || job.status === 'running' || job.status === 'awaiting_review';

  return (
    <span className="sq-actions">
      {canReview && job.reviewGateState === 'in_review' ? (
        <button type="button" className="sq-act sq-act--primary" onClick={() => setGateOpen(true)}>
          Review Findings
        </button>
      ) : null}

      <button
        type="button"
        className="sq-icon-btn"
        aria-label={`View report preview for ${job.jobCode}`}
        onClick={preview}
      >
        <FileSearch size={14} aria-hidden="true" />
      </button>

      {canReview && job.paymentStatus !== 'paid' ? (
        <button
          type="button"
          className="sq-act"
          disabled={requestPayment.isPending}
          onClick={requestPaymentNow}
        >
          Request Payment
        </button>
      ) : null}

      {canReview && cancellable ? (
        <button
          type="button"
          className="sq-act sq-act--danger"
          disabled={cancelJob.isPending}
          onClick={() => setConfirmOpen(true)}
        >
          Cancel Job
        </button>
      ) : null}

      {canWatchLive && liveEligible ? (
        <button
          type="button"
          className="sq-act"
          id={`sq-live-${job.jobCode}`}
          onClick={() => setTerminalOpen(true)}
        >
          Live output
        </button>
      ) : null}

      <ReviewGateDialog job={job} open={gateOpen} onOpenChange={setGateOpen} />

      <ScanTerminalDialog job={job} open={terminalOpen} onOpenChange={setTerminalOpen} />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent size="sm">
          <DialogTitle>Cancel {job.jobCode}?</DialogTitle>
          <DialogDescription>
            The job is removed from the queue and archived to the audit trail. This cannot be
            undone.
          </DialogDescription>
          <div className="sq-confirm-actions">
            <DialogClose asChild>
              <button type="button" className="adm-btn adm-btn-ghost">
                Keep job
              </button>
            </DialogClose>
            <button type="button" className="adm-btn adm-btn-dark" onClick={cancelNow}>
              Cancel job
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </span>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { FileText, Radio, Send, Siren, X } from 'lucide-react';
import type { AdvisoryScopeEntry, BroadcastAck, FindingSeverity } from '@vunvault/contracts';
import {
  BROADCAST_ACK_MESSAGE,
  BROADCAST_CONFIRM_PHRASE,
  EmergencyBroadcastBody,
  SCOPE_CATEGORY_LABELS,
} from '@vunvault/contracts';
import { cn, isApiError } from '@vunvault/lib';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  toast,
} from '@vunvault/ui';
import { formatSessionReference } from '../../_components/admin-footer';
import { useSession } from '../../../../../lib/session';
import { useBroadcastEstimate } from '../_hooks/use-advisories-admin';
import { useBroadcastDispatch, type BroadcastMode } from '../_hooks/use-broadcast';
import { SEVERITY_LABELS } from '../_lib/cvss';
import { ACK_KEYS, AckChecklist, EMPTY_ACK, type BroadcastAckKey } from './ack-checklist';

/**
 * Emergency Broadcast dialog (Task 82) — the irreversible door.
 *
 * The gate is the contract's own rule: the confirm button stays disabled until
 * `EmergencyBroadcastBody` parses, which means all five acknowledgements AND a
 * case-insensitive match on `BROADCAST_CONFIRM_PHRASE`. Nothing here re-derives
 * that logic, so the UI cannot unlock earlier than the API would accept.
 *
 * The status line walks the four verbatim states in order — nothing started,
 * `<n>` outstanding, acks complete but phrase missing, all checks complete.
 *
 * Once the request is in flight the dialog is NOT dismissible
 * (`dismissible={false}`): a backdrop click or Escape mid-dispatch would leave
 * the operator unsure whether the advisory went out.
 *
 * Errors map exactly: `403` and `409 broadcast_in_progress` each have their own
 * verbatim line, `422 advisory_incomplete` re-uses the incomplete toast with the
 * API's own `details`, and `400 validation_failed` (never expected, because the
 * contract gate already held) keeps the dialog open rather than pretending.
 */

/** What the dialog needs about the advisory it is about to dispatch. */
export interface BroadcastTarget {
  id: string;
  cveId: string;
  title: string | null;
  severity: FindingSeverity | null;
  scope: readonly AdvisoryScopeEntry[];
  mode: BroadcastMode;
}

const DIALOG_TITLES: Record<BroadcastMode, string> = {
  initial: 'Confirm advisory broadcast',
  rebroadcast: 'Re-broadcast advisory',
};

/** The four pre-check phrases, in the order the spec lists them. */
export const MISSING_PHRASES = {
  cve: 'a valid CVE identifier',
  title: 'an advisory title',
  severity: 'a severity level',
  scope: 'at least one scope entry',
} as const;

/** `a, b and c` — the incomplete toast reads as a sentence. */
export function joinMissing(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function incompleteMessage(items: readonly string[]): string {
  return `Complete ${joinMissing(items)} before raising an emergency broadcast.`;
}

/** `Web & API · Struts 2.0.0 – 2.5.32, …` — the same projection the table uses. */
function scopeSummary(scope: readonly AdvisoryScopeEntry[]): string {
  if (scope.length === 0) return '—';
  return scope
    .map((entry) =>
      entry.category === null
        ? entry.label
        : `${SCOPE_CATEGORY_LABELS[entry.category]} · ${entry.label}`,
    )
    .join(', ');
}

export interface BroadcastDialogProps {
  /** `null` keeps the dialog closed. */
  target: BroadcastTarget | null;
  onOpenChange(open: boolean): void;
  /** Tells the desk to start polling delivery progress for this advisory. */
  onDispatched(id: string): void;
}

export function BroadcastDialog({ target, onOpenChange, onDispatched }: BroadcastDialogProps) {
  const { user } = useSession();
  const dispatch = useBroadcastDispatch();
  const estimate = useBroadcastEstimate(target?.id ?? null);

  const [ack, setAck] = useState<BroadcastAck>(EMPTY_ACK);
  const [phrase, setPhrase] = useState('');

  const open = target !== null;

  // Every opening starts a fresh gate — an aborted broadcast must not leave
  // acknowledgements ticked for the next one.
  useEffect(() => {
    if (!open) return;
    setAck(EMPTY_ACK);
    setPhrase('');
  }, [open, target?.id]);

  if (target === null) return null;

  const outstanding = ACK_KEYS.filter((key) => !ack[key]).length;
  const allAcked = outstanding === 0;
  const phraseOk = phrase.trim().toUpperCase() === BROADCAST_CONFIRM_PHRASE;
  const unlocked = EmergencyBroadcastBody.safeParse({ ack, confirmPhrase: phrase }).success;

  const statusLine = !allAcked
    ? outstanding === ACK_KEYS.length
      ? BROADCAST_ACK_MESSAGE
      : `${outstanding} acknowledgement(s) still outstanding before broadcast can proceed.`
    : phraseOk
      ? 'All checks complete. Broadcasting will dispatch the advisory immediately and cannot be undone.'
      : `All acknowledgements complete — type "${BROADCAST_CONFIRM_PHRASE}" to unlock the broadcast button.`;

  const onToggle = (key: BroadcastAckKey): void => {
    setAck((current) => ({ ...current, [key]: !current[key] }));
  };

  const submit = (): void => {
    if (!unlocked) return;
    dispatch.mutate(
      { id: target.id, mode: target.mode, body: { ack, confirmPhrase: phrase.trim() } },
      {
        onSuccess: (record) => {
          toast({
            kind: 'ok',
            title: 'Emergency broadcast dispatched',
            message: `${target.cveId} pushed to ${record.audienceDashboards} client dashboards, ${record.emailContacts} email contacts and ${record.smsContacts} on-call SMS numbers.`,
          });
          toast({
            kind: 'info',
            title: 'Audit event recorded',
            message: `SEV-1 broadcast event written with session reference ${formatSessionReference(
              user?.id ?? '',
              new Date(),
            )}.`,
          });
          onDispatched(target.id);
          onOpenChange(false);
        },
        onError: (error) => {
          if (isApiError(error) && error.status === 403) {
            toast({ kind: 'crit', title: 'Only administrators can issue emergency broadcasts.' });
            return;
          }
          if (isApiError(error) && error.status === 409 && error.code === 'broadcast_in_progress') {
            toast({
              kind: 'warn',
              title:
                'A broadcast for this advisory was just sent. Wait a minute before sending another.',
            });
            return;
          }
          if (isApiError(error) && error.status === 422) {
            // The API judged the advisory incomplete; quote its own details.
            const details = (error.details ?? [])
              .map((detail) => (typeof detail === 'string' ? detail : ''))
              .filter((detail) => detail !== '');
            toast({
              kind: 'warn',
              title: 'Advisory incomplete',
              message:
                details.length > 0
                  ? `Complete ${joinMissing(details)} before raising an emergency broadcast.`
                  : incompleteMessage([
                      MISSING_PHRASES.title,
                      MISSING_PHRASES.severity,
                      MISSING_PHRASES.scope,
                    ]),
            });
            return;
          }
          // 400 validation_failed is not expected — the contract gate held — so
          // stay open and let the operator see that nothing was dispatched.
          toast({
            kind: 'crit',
            title: 'Broadcast not dispatched',
            message: isApiError(error) ? error.message : 'Please try again.',
          });
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && dispatch.isPending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        size="lg"
        className="zd-modal-content"
        // A backdrop click or Escape mid-dispatch would hide the outcome.
        dismissible={!dispatch.isPending}
        hideClose
        aria-labelledby="zd-broadcast-title"
      >
        <div className="zd-modal-head">
          <div>
            <span className="zd-modal-eyebrow">
              <Siren size={13} aria-hidden="true" />
              Emergency Broadcast — Irreversible
            </span>
            <DialogTitle className="zd-modal-title" id="zd-broadcast-title">
              {DIALOG_TITLES[target.mode]}
            </DialogTitle>
            <DialogDescription className="zd-modal-sub">
              This pushes the advisory to every matching client dashboard, dispatches email and SMS
              alerts, and opens a SEV-1 audit event. It cannot be undone — only retracted with a
              follow-up notice.
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <button
              type="button"
              className="zd-modal-close"
              aria-label="Close broadcast confirmation"
              disabled={dispatch.isPending}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </DialogClose>
        </div>

        <div className="zd-modal-body">
          <div>
            <div className="zd-modal-section-title">
              <FileText size={13} aria-hidden="true" />
              Advisory Being Broadcast
            </div>
            <div className="zd-modal-summary">
              <div className="zd-modal-summary-item">
                <span className="zd-modal-summary-label">CVE ID</span>
                <span className="zd-modal-summary-value" id="zd-modal-cve">
                  {target.cveId}
                </span>
              </div>
              <div className="zd-modal-summary-item">
                <span className="zd-modal-summary-label">Severity</span>
                <span className="zd-modal-summary-value">
                  {target.severity === null ? '—' : SEVERITY_LABELS[target.severity]}
                </span>
              </div>
              <div className="zd-modal-summary-item">
                <span className="zd-modal-summary-label">Advisory Title</span>
                <span className="zd-modal-summary-value">
                  {target.title === null || target.title === '' ? '—' : target.title}
                </span>
              </div>
              <div className="zd-modal-summary-item">
                <span className="zd-modal-summary-label">Affected Scope</span>
                <span className="zd-modal-summary-value">{scopeSummary(target.scope)}</span>
              </div>
            </div>
          </div>

          <div>
            <div className="zd-modal-section-title">
              <Radio size={13} aria-hidden="true" />
              Immediate Reach
            </div>
            <div className="zd-modal-summary">
              <div className="zd-modal-summary-item zd-modal-summary-item--reach">
                <span className="zd-modal-summary-value">{estimate.data?.dashboards ?? '—'}</span>
                <span className="zd-modal-summary-label">Client Dashboards</span>
              </div>
              <div className="zd-modal-summary-item zd-modal-summary-item--reach">
                <span className="zd-modal-summary-value">
                  {estimate.data?.emailContacts ?? '—'}
                </span>
                <span className="zd-modal-summary-label">Email Contacts</span>
              </div>
              <div className="zd-modal-summary-item zd-modal-summary-item--reach">
                <span className="zd-modal-summary-value">{estimate.data?.smsContacts ?? '—'}</span>
                <span className="zd-modal-summary-label">SMS / On-call</span>
              </div>
            </div>
          </div>

          <AckChecklist ack={ack} disabled={dispatch.isPending} onToggle={onToggle} />

          <div className="zd-confirm-word-field">
            <label className="zd-label" htmlFor="zd-confirm-word">
              <span>
                Type <strong>{BROADCAST_CONFIRM_PHRASE}</strong> to confirm
              </span>
            </label>
            <input
              id="zd-confirm-word"
              className={cn('zd-confirm-word', phraseOk ? 'is-valid' : undefined)}
              type="text"
              placeholder={BROADCAST_CONFIRM_PHRASE}
              autoComplete="off"
              aria-describedby="zd-confirm-hint"
              value={phrase}
              disabled={dispatch.isPending}
              onChange={(event) => setPhrase(event.target.value)}
            />
            <span className="zd-hint" id="zd-confirm-hint">
              The confirmation phrase is case-insensitive and required before the broadcast button
              unlocks.
            </span>
          </div>
        </div>

        <div className="zd-modal-foot">
          <span className="zd-modal-foot-note" id="zd-modal-hint" role="status">
            {statusLine}
          </span>
          <div className="zd-modal-foot-actions">
            <DialogClose asChild>
              <button type="button" className="adm-btn adm-btn-ghost" disabled={dispatch.isPending}>
                Cancel
              </button>
            </DialogClose>
            <button
              type="button"
              className="adm-btn adm-btn-danger"
              id="zd-confirm-broadcast"
              disabled={!unlocked || dispatch.isPending}
              onClick={submit}
            >
              <Send size={15} aria-hidden="true" />
              <span>Broadcast Now</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

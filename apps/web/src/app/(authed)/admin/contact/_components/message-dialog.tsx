'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, Save, ShieldAlert } from 'lucide-react';
import type { ContactMessageView, ContactStatus, StaffMember } from '@vunvault/contracts';
import { ContactTriageBody } from '@vunvault/contracts';
import { cn, formatQueueStamp, isApiError } from '@vunvault/lib';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  toast,
} from '@vunvault/ui';
import {
  CONTACT_STATUSES,
  CONTACT_STATUS_LABELS,
  useTriageMessage,
} from '../_hooks/use-contact-admin';

/**
 * Message dialog — the only place a message body is rendered.
 *
 * The body is inserted as a TEXT NODE (`{message.message}`), never as markup,
 * so a message containing HTML or script from the public form cannot execute in
 * an administrator's session. That is the whole reason this dialog exists
 * separately from the table.
 *
 * Status and assignee are local until `Save`, and the payload is validated with
 * the contract's own `ContactTriageBody` — which is what refuses an empty
 * triage (`CONTACT_TRIAGE_EMPTY_MESSAGE`) rather than the UI guessing.
 *
 * A `journalist_blogger_profile_request` gets the verification banner and the
 * `Find client` hand-off: the badge itself is granted from the Clients & Badges
 * tab, so this dialog points at it and pre-fills its search with the sender's
 * email instead of pretending to grant anything here.
 */

export const VERIFICATION_BANNER =
  'Verification request — grant the Verified Blogger badge from the Clients & Badges tab after you have verified the applicant.';

export interface MessageDialogProps {
  message: ContactMessageView | null;
  staff: readonly StaffMember[];
  open: boolean;
  onOpenChange(open: boolean): void;
  /** Switches to Clients & Badges with the directory search pre-filled. */
  onFindClient(email: string): void;
}

export function MessageDialog({
  message,
  staff,
  open,
  onOpenChange,
  onFindClient,
}: MessageDialogProps) {
  const triage = useTriageMessage();
  const [status, setStatus] = useState<ContactStatus>('new');
  const [assignedTo, setAssignedTo] = useState<string>('');

  // Seed from the row each time it opens; never carry the last edit over.
  useEffect(() => {
    if (!open || message === null) return;
    setStatus(message.status);
    setAssignedTo(message.assignedTo?.id ?? '');
  }, [open, message]);

  if (message === null) return null;

  const isVerification = message.category === 'journalist_blogger_profile_request';

  const onSave = (): void => {
    const parsed = ContactTriageBody.safeParse({
      status,
      assignedTo: assignedTo === '' ? null : assignedTo,
    });
    if (!parsed.success) {
      toast({ kind: 'warn', title: 'Nothing to save', message: parsed.error.issues[0]?.message });
      return;
    }
    triage.mutate(
      { id: message.id, body: parsed.data },
      {
        onSuccess: () => {
          toast({ kind: 'ok', title: 'Message updated', message: 'The request was saved.' });
          onOpenChange(false);
        },
        onError: (error) =>
          toast({
            kind: 'crit',
            title: 'Could not save the request',
            message: isApiError(error) ? error.message : 'Please try again.',
          }),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && triage.isPending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent
        size="lg"
        className="ct-modal-content"
        dismissible={!triage.isPending}
        aria-labelledby="ct-message-title"
      >
        <div className="ct-modal-head">
          <div>
            <span className="ct-modal-eyebrow">
              <ShieldAlert size={13} aria-hidden="true" />
              {message.categoryLabel}
            </span>
            <DialogTitle className="ct-modal-title" id="ct-message-title">
              {message.subject}
            </DialogTitle>
            <DialogDescription className="ct-modal-sub">
              {message.name} · {message.email} · received{' '}
              {formatQueueStamp(new Date(message.createdAt))}
            </DialogDescription>
          </div>
        </div>

        <div className="ct-modal-body">
          {isVerification ? (
            <div className="ct-banner" role="status">
              <BadgeCheck size={14} aria-hidden="true" />
              <span>{VERIFICATION_BANNER}</span>
              <button
                type="button"
                className="adm-mini-btn ct-find-client"
                onClick={() => {
                  onOpenChange(false);
                  onFindClient(message.email);
                }}
              >
                Find client
              </button>
            </div>
          ) : null}

          <div className="ct-field">
            <span className="ct-field-label">Message</span>
            {/* Text node only — never dangerouslySetInnerHTML. */}
            <p className="ct-message">{message.message}</p>
          </div>

          <div className="ct-controls">
            <div className="ct-field">
              <label className="ct-field-label" htmlFor="ct-status">
                Status
              </label>
              <select
                id="ct-status"
                className={cn('ct-select')}
                value={status}
                disabled={triage.isPending}
                onChange={(event) => setStatus(event.target.value as ContactStatus)}
              >
                {CONTACT_STATUSES.map((option) => (
                  <option key={option} value={option}>
                    {CONTACT_STATUS_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>
            <div className="ct-field">
              <label className="ct-field-label" htmlFor="ct-assignee">
                Assigned to
              </label>
              <select
                id="ct-assignee"
                className={cn('ct-select')}
                value={assignedTo}
                disabled={triage.isPending}
                onChange={(event) => setAssignedTo(event.target.value)}
              >
                <option value="">Unassigned</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="ct-modal-foot">
          <span className="ct-modal-foot-note">
            Triage changes are written to the audit log against your identity.
          </span>
          <div className="ct-modal-foot-actions">
            <DialogClose asChild>
              <button type="button" className="adm-btn adm-btn-ghost" disabled={triage.isPending}>
                Cancel
              </button>
            </DialogClose>
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              id="ct-save-message"
              disabled={triage.isPending}
              onClick={onSave}
            >
              <Save size={15} aria-hidden="true" />
              <span>Save</span>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

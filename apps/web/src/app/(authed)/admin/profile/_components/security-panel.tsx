'use client';

import { useState } from 'react';
import { KeyRound, ShieldAlert, ShieldCheck, ShieldOff } from 'lucide-react';
import { DeactivationRequestBody } from '@vunvault/contracts';
import { cn, isApiError } from '@vunvault/lib';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Switch,
  toast,
} from '@vunvault/ui';
import {
  useSecurityInvalidator,
  useSecurityStatus,
} from '../../../portal/security/_hooks/use-security';
// REUSED, not copied (the spec's rule): the client Password Manager already
// owns these four surfaces, and a second implementation would be a second
// source of truth for the password rules, the TOTP enrolment flow and the
// recovery-code batch.
import { ChangePasswordCard } from '../../../portal/security/_components/change-password-card';
import { RecoveryKeysCard } from '../../../portal/security/_components/recovery-keys-card';
import { SecurityKeyPanel } from '../../../portal/security/_components/security-key-panel';
import { TotpPanel } from '../../../portal/security/_components/totp-panel';
import { useRequestDeactivation } from '../_hooks/use-admin-security';
import { PostureCard } from './posture-card';
import { SessionsList } from './sessions-list';

/**
 * Security & Credentials panel (Task 83d) — overwrites the Task 83c stub.
 *
 * Composition, not duplication: the posture card and the session list are this
 * task's own (the client Password Manager has neither), while the password
 * card, the authenticator panel, the hardware-key panel and the recovery-code
 * card are IMPORTED from `portal/security/_components`. The imported
 * `ChangePasswordCard` already switches its minimum length by role, so the
 * staff 14-character rule needs no local copy.
 *
 * `Require 2FA` is rendered as a disabled, checked switch: every staff role is
 * required to hold a second factor and the API enforces it, so offering a
 * toggle here would advertise a choice the platform does not allow.
 *
 * The danger zone asks for a reason of at least ten characters — the contract's
 * `DeactivationRequestBody` floor — and maps `409 already_requested` to its own
 * verbatim line.
 */

/** The contract's floor (`reason.min(10)`), surfaced before the request. */
const REASON_MIN = 10;

const REASON_TOO_SHORT = `Add a reason of at least ${REASON_MIN} characters.`;

export function SecurityPanel() {
  const status = useSecurityStatus();
  const invalidate = useSecurityInvalidator();
  const deactivation = useRequestDeactivation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  const data = status.data;

  const submitDeactivation = (): void => {
    const parsed = DeactivationRequestBody.safeParse({ reason: reason.trim() });
    if (!parsed.success) {
      setReasonError(REASON_TOO_SHORT);
      return;
    }
    deactivation.mutate(parsed.data, {
      onSuccess: () => {
        setDialogOpen(false);
        setReason('');
        setReasonError('');
        toast({
          kind: 'ok',
          title: 'Request sent',
          message: 'A super administrator will review your deactivation request.',
        });
      },
      onError: (error) => {
        if (isApiError(error) && error.status === 409 && error.code === 'already_requested') {
          setDialogOpen(false);
          toast({ kind: 'warn', title: 'You already have a pending request.' });
          return;
        }
        toast({
          kind: 'crit',
          title: 'Could not send request',
          message: isApiError(error) ? error.message : 'Please try again.',
        });
      },
    });
  };

  return (
    <section
      className="adm-card ps-panel"
      id="ps-panel-security"
      role="tabpanel"
      aria-labelledby="ps-tab-security"
      tabIndex={0}
    >
      <div className="adm-card-head">
        <div>
          <h2 className="adm-card-title">
            <KeyRound size={15} aria-hidden="true" />
            Password &amp; Two-Factor Authentication
          </h2>
          <p className="adm-card-note">
            Update your password and manage the authentication factors protecting your administrator
            account. All credential changes immediately invalidate other active sessions.
          </p>
        </div>
        {data === undefined ? null : (
          <span className={cn('adm-tag', data.require2fa ? 'adm-tag--ok' : undefined)}>
            {data.require2fa ? '2FA Active' : '2FA Off'}
          </span>
        )}
      </div>

      <div className="adm-card-body ps-security-body">
        <div className="ps-section">
          <span className="ps-panel-label">
            <ShieldCheck size={13} aria-hidden="true" />
            Security Posture
          </span>
          <PostureCard posture={data?.posture ?? null} isLoading={status.isLoading} />
        </div>

        {/* The imported card owns the password rules, the strength meter and its
            own success toast; wrapping it in a test-id keeps the reuse assertable. */}
        <div data-testid="ps-imported-change-password">
          <ChangePasswordCard />
        </div>

        <div className="ps-section">
          <span className="ps-panel-label">
            <ShieldCheck size={13} aria-hidden="true" />
            Two-Factor Authentication
          </span>
          <div className="ps-require2fa">
            <span className="ps-require2fa-text">
              <span className="ps-require2fa-title">Require 2FA at every sign-in</span>
              <span className="ps-note">Required for all staff accounts.</span>
            </span>
            {/* Staff cannot opt out: the switch is checked and inert. */}
            <Switch
              id="ps-require-2fa"
              checked
              disabled
              aria-label="Require 2FA at every sign-in"
            />
          </div>
          <TotpPanel enabled={data?.totp.enabled ?? false} onChanged={invalidate} />
          <SecurityKeyPanel keys={data?.webauthn.keys ?? []} onChanged={invalidate} />
          <RecoveryKeysCard />
        </div>

        <SessionsList />

        <div className="ps-danger-zone">
          <span className="ps-panel-label ps-panel-label--danger">
            <ShieldAlert size={13} aria-hidden="true" />
            Danger Zone
          </span>
          <p className="ps-note">
            Requesting deactivation removes your access to the Command Center. A super administrator
            must approve the request before it takes effect.
          </p>
          <button
            type="button"
            className="adm-btn adm-btn-dark ps-deactivate"
            id="ps-request-deactivation"
            onClick={() => setDialogOpen(true)}
          >
            <ShieldOff size={15} aria-hidden="true" />
            <span>Request Account Deactivation</span>
          </button>
        </div>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(next) => {
          if (!next) {
            setReason('');
            setReasonError('');
          }
          setDialogOpen(next);
        }}
      >
        <DialogContent size="sm">
          <DialogTitle>Request account deactivation</DialogTitle>
          <DialogDescription>
            Your reason is recorded in the audit log and routed to a super administrator for review.
          </DialogDescription>
          <div className="ps-field">
            <label className="ps-label" htmlFor="ps-deactivation-reason">
              <span>
                Reason
                <span className="ps-label-req" aria-hidden="true">
                  *
                </span>
              </span>
            </label>
            <textarea
              id="ps-deactivation-reason"
              className={cn('ps-textarea', reasonError === '' ? undefined : 'is-invalid')}
              rows={3}
              value={reason}
              aria-invalid={reasonError === '' ? undefined : true}
              aria-describedby={reasonError === '' ? undefined : 'ps-deactivation-error'}
              onChange={(event) => {
                setReason(event.target.value);
                if (reasonError !== '') setReasonError('');
              }}
            />
            {reasonError === '' ? null : (
              <span className="ps-error" id="ps-deactivation-error" role="alert">
                {reasonError}
              </span>
            )}
          </div>
          <div className="ps-form-actions">
            <DialogClose asChild>
              <button type="button" className="adm-btn adm-btn-ghost">
                Cancel
              </button>
            </DialogClose>
            <button
              type="button"
              className="adm-btn adm-btn-dark"
              disabled={deactivation.isPending}
              onClick={submitDeactivation}
            >
              Send request
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

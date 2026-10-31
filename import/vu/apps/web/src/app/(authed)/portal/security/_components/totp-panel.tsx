'use client';

import { useState } from 'react';
import { Copy, Smartphone } from 'lucide-react';
import { isApiError } from '@vunvault/lib';
import { toast } from '@vunvault/ui';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@vunvault/ui';
import type { TotpEnrollStart } from '@vunvault/contracts';
import { useDisableTotp, useTotpEnroll, useTotpVerify } from '../_hooks/use-security';
import { qrCodeSrc } from '../../../../(auth)/signup/_hooks/use-verify-signup';

/**
 * Authenticator-app (TOTP) panel .
 *
 * Enabling runs the an earlier iteration ceremony: `POST …/totp/enroll` → the QR rendered
 * through an `<img>` data-URI (NEVER `innerHTML`), the setup key grouped in
 * 4s with Copy, then `POST …/totp/verify`. Disabling asks for confirmation
 * first; `422 last_factor` keeps the factor standing with the spec's
 * verbatim sentence. The secret lives in component state only — cleared on
 * cancel/verify/unmount, never stored or logged.
 */

/** The design's `JBSWY3DPEHPK3PXP` display: base32 grouped in 4s. */
export function groupSetupKey(secret: string): string {
  return (secret.match(/.{1,4}/g) ?? []).join(' ');
}

export interface TotpPanelProps {
  enabled: boolean;
  /** Refetches `GET /account/security` after a successful enable/disable. */
  onChanged: () => void;
}

export function TotpPanel({ enabled, onChanged }: TotpPanelProps) {
  const enroll = useTotpEnroll();
  const verify = useTotpVerify();
  const disable = useDisableTotp();
  const [enrolment, setEnrolment] = useState<TotpEnrollStart['data'] | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const busy = enroll.isPending || verify.isPending || disable.isPending;

  const startEnroll = async () => {
    setError('');
    try {
      setEnrolment(await enroll.mutateAsync());
    } catch {
      setError('Enrolment could not start. Please try again.');
    }
  };

  const cancelEnroll = () => {
    setEnrolment(null);
    setCode('');
    setError('');
  };

  const submitVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (enrolment === null || verify.isPending) return;
    if (code.replace(/\D/g, '').length !== 6) {
      setError('Enter the 6-digit code');
      return;
    }
    setError('');
    try {
      await verify.mutateAsync({ factorId: enrolment.factorId, code: code.replace(/\D/g, '') });
      toast({ kind: 'ok', title: 'Authenticator app enabled' });
      cancelEnroll();
      onChanged();
    } catch (verifyError) {
      if (isApiError(verifyError) && verifyError.status === 401) {
        setError('Incorrect code.');
        return;
      }
      setError('Verification failed. Please try again.');
    }
  };

  const submitDisable = async () => {
    setConfirmOpen(false);
    setError('');
    try {
      await disable.mutateAsync();
      toast({ kind: 'ok', title: 'Authenticator app disabled' });
      onChanged();
    } catch (disableError) {
      if (isApiError(disableError) && disableError.status === 422) {
        setError('You cannot remove your only second factor.');
        return;
      }
      setError('Could not disable the authenticator app. Please try again.');
    }
  };

  const onToggle = () => {
    if (busy) return;
    if (enabled) {
      setConfirmOpen(true);
      return;
    }
    if (enrolment === null) void startEnroll();
    else cancelEnroll();
  };

  const copySecret = async () => {
    if (enrolment === null) return;
    try {
      await navigator.clipboard?.writeText(enrolment.secret);
    } catch {
      // Clipboard permission denied — the key stays visible on screen.
    }
    toast({ kind: 'ok', title: 'Copied to clipboard' });
  };

  return (
    <div className="vpm-2fa-panel">
      <div className="vpm-2fa-head">
        <div>
          <h3 className="vpm-2fa-title">Authenticator App (TOTP)</h3>
          <span className={enabled ? 'vpm-status vpm-status--on' : 'vpm-status'}>
            <span className="vpm-status-dot" aria-hidden="true" />
            {enabled ? 'Enabled' : 'Not enabled'}
          </span>
        </div>
        <div className="vpm-2fa-controls">
          <button
            type="button"
            className="vpm-switch"
            role="switch"
            aria-checked={enabled}
            aria-label="Authenticator app (TOTP)"
            disabled={busy}
            onClick={onToggle}
          >
            <span className="vpm-switch-track" aria-hidden="true" />
            {enabled ? 'On' : 'Off'}
          </button>
        </div>
      </div>
      <p className="vpm-2fa-sub">
        Use Google Authenticator, Authy, 1Password or any TOTP-compatible app. Generates a fresh
        6-digit code every 30 seconds.
      </p>

      {error !== '' ? (
        <p className="vpm-error" role="alert" aria-live="polite">
          {error}
        </p>
      ) : null}

      {enrolment !== null ? (
        <div className="vpm-totp">
          <div className="vpm-qr">
            {/* eslint-disable-next-line @next/next/no-img-element -- data-URI SVG, not an optimisable asset */}
            <img alt="Authenticator QR code" src={qrCodeSrc(enrolment.qrCodeSvg)} />
          </div>
          <div>
            <ol className="vpm-steps">
              <li className="vpm-step">
                <span>
                  Open your authenticator app and choose <strong>“Add account”</strong> →{' '}
                  <strong>“Scan QR code”</strong>.
                </span>
              </li>
              <li className="vpm-step">
                <span>
                  Point your camera at the QR code on the left. Can’t scan? Enter the setup key
                  manually below.
                </span>
              </li>
              <li className="vpm-step">
                <span>
                  Enter the <strong>6-digit code</strong> your app generates to confirm setup.
                </span>
              </li>
            </ol>
            <div className="vpm-secret">
              <code>{groupSetupKey(enrolment.secret)}</code>
              <button
                type="button"
                className="vpm-btn vpm-btn--ghost vpm-btn--sm"
                onClick={() => void copySecret()}
              >
                <Copy size={13} aria-hidden="true" />
                Copy
              </button>
            </div>
            <form className="vpm-verify" onSubmit={(event) => void submitVerify(event)}>
              <div className="vpm-field">
                <label htmlFor="vpm-totp-code">Verification Code</label>
                <input
                  id="vpm-totp-code"
                  className="vpm-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  value={code}
                  disabled={busy}
                  aria-invalid={error !== ''}
                  onChange={(event) => {
                    setCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                    if (error !== '') setError('');
                  }}
                />
              </div>
              <button
                type="submit"
                className="vpm-btn vpm-btn--primary"
                disabled={busy}
                aria-busy={busy}
              >
                {verify.isPending ? <span className="vpm-btn-spinner" aria-hidden="true" /> : null}
                <span>Verify & Enable</span>
              </button>
              <button type="button" className="vpm-btn vpm-btn--ghost" onClick={cancelEnroll}>
                Cancel
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent size="sm" className="vpm-modal-card">
          <DialogTitle className="vpm-modal-title">Disable authenticator app?</DialogTitle>
          <DialogDescription className="vpm-modal-text">
            You will rely on your other methods to sign in.
          </DialogDescription>
          <div className="vpm-modal-actions">
            <button
              type="button"
              className="vpm-btn vpm-btn--ghost"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="vpm-btn vpm-btn--danger"
              disabled={disable.isPending}
              onClick={() => void submitDisable()}
            >
              <Smartphone size={15} aria-hidden="true" />
              <span>Disable</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

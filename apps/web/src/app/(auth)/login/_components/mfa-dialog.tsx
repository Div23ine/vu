'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, ShieldCheck, X } from 'lucide-react';
import type { SessionUser } from '@vunvault/contracts';
import { queryKeys } from '@vunvault/lib';
import { cn, isApiError } from '@vunvault/lib';
import { toast } from '@vunvault/ui';
import { homeFor } from '../../../../lib/permissions';
import {
  useMfaEmailOtp,
  useMfaRecovery,
  useMfaVerify,
  useWebAuthnOptions,
} from '../_hooks/use-mfa';
import { isWebAuthnCancel, requestWebAuthnAssertion } from '../_lib/webauthn-client';
import { useMfaDialogStore, type MfaUiMethod } from '../_store/mfa-dialog-store';
import { OtpInput, OTP_LENGTH } from './otp-input';
import '../../_styles/auth.css';

/**
 * MFA verification dialog — mounted by `/login`, driven by the
 * store an earlier iteration fills.
 *
 * Dialog semantics per the spec: `role="dialog"`, `aria-modal`,
 * `aria-labelledby="vvOtpTitle"`, a Tab focus trap, Escape closes (and
 * clears the store — nothing is called on the API; the challenge cookie
 * simply expires). Default method order: `webauthn` (auto-prompted once),
 * else `totp`, else `email_otp`; recovery is always offered in the switcher.
 *
 * Success view copy is the spec's verbatim pair (`Verification
 * successful` / `Redirecting to VUNVAULT…`), which supersedes the
 * design's strings — as the Behaviour section explicitly dictates. The
 * design's dev scaffolding (test-OTP toasts, console logging) is gone.
 *
 * A staff session that verified with a RECOVERY code stays at `aal1`, so it
 * is sent to `/login?error=mfa_required` instead of the admin home (the
 * an earlier iteration guard would bounce it anyway).
 */

const RESEND_SECONDS = 60;
const SUCCESS_NAV_DELAY_MS = 1400; // matches the vvSuccessBar animation
const FOCUS_DELAY_MS = 180; // the design's openOtpModal focus delay
const RECOVERY_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

const INCORRECT_CODE = 'Incorrect code. Please check the digits and try again.';
const INCOMPLETE_CODE = 'Please enter all 6 digits.';
const CANCELLED_KEY = 'Security key request was cancelled.';
const NETWORK_FAILURE = 'Verification failed. Please try again.';

/** Ported from the design JS: `re•••@example.com`. */
export function maskEmail(value: string): string {
  const at = value.indexOf('@');
  if (at < 1) return value;
  const name = value.slice(0, at);
  const domain = value.slice(at);
  const head = name.slice(0, Math.min(2, name.length));
  return head + '•'.repeat(Math.max(1, name.length - 2)) + domain;
}

const EMPTY_DIGITS = (): string[] => Array<string>(OTP_LENGTH).fill('');

export function MfaDialog() {
  const open = useMfaDialogStore((state) => state.open);
  const email = useMfaDialogStore((state) => state.email);
  const methods = useMfaDialogStore((state) => state.methods);
  const next = useMfaDialogStore((state) => state.next);
  const close = useMfaDialogStore((state) => state.close);

  const router = useRouter();
  const queryClient = useQueryClient();
  const verify = useMfaVerify();
  const emailOtp = useMfaEmailOtp();
  const recovery = useMfaRecovery();
  const webauthnOptions = useWebAuthnOptions();

  const [mounted, setMounted] = useState(false);
  const [method, setMethod] = useState<MfaUiMethod>('totp');
  const [digits, setDigits] = useState<string[]>(EMPTY_DIGITS);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [error, setError] = useState('');
  const [boxState, setBoxState] = useState<'idle' | 'error' | 'ok'>('idle');
  const [shake, setShake] = useState(false);
  const [phase, setPhase] = useState<'form' | 'success'>('form');
  const [cooldown, setCooldown] = useState(0);

  const cardRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  const webauthnPrompted = useRef(false);
  const emailSent = useRef(false);
  const pendingNav = useRef<{ user: SessionUser; via: MfaUiMethod } | null>(null);

  const pending =
    verify.isPending || recovery.isPending || webauthnOptions.isPending || emailOtp.isPending;

  // ——— open/close lifecycle ———
  useEffect(() => {
    if (!open) {
      setMounted(false);
      return;
    }
    lastFocused.current = document.activeElement as HTMLElement | null;
    document.body.classList.add('vv-modal-open');
    setPhase('form');
    setError('');
    setBoxState('idle');
    setDigits(EMPTY_DIGITS());
    setRecoveryCode('');
    setCooldown(0);
    webauthnPrompted.current = false;
    emailSent.current = false;
    setMethod(
      methods.includes('webauthn')
        ? 'webauthn'
        : methods.includes('totp')
          ? 'totp'
          : methods.includes('email_otp')
            ? 'email_otp'
            : 'recovery',
    );
    setMounted(true);
    const focusTimer = setTimeout(() => {
      const firstBox = cardRef.current?.querySelector<HTMLInputElement>('.vv-otp-digit');
      if (firstBox !== null && firstBox !== undefined) {
        firstBox.focus();
        return;
      }
      cardRef.current?.querySelector<HTMLButtonElement>('.vv-otp-close')?.focus();
    }, FOCUS_DELAY_MS);
    return () => {
      clearTimeout(focusTimer);
      document.body.classList.remove('vv-modal-open');
    };
  }, [open, methods]);

  // Restore focus to the element that opened the dialog.
  useEffect(() => {
    if (open) return;
    lastFocused.current?.focus();
    lastFocused.current = null;
  }, [open]);

  // Escape closes; Tab cycles inside the card (focus trap).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab' || cardRef.current === null) return;
      const focusables = Array.from(
        cardRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (first === undefined || last === undefined) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  // ——— resend cooldown ticker ———
  // One interval for the whole countdown (keyed on the boolean, not the
  // number) so the tick chain never depends on effect re-runs — deterministic
  // under fake timers and cheaper on the main thread.
  const cooling = cooldown > 0;
  useEffect(() => {
    if (!cooling) return;
    const timer = setInterval(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooling]);

  // ——— per-method side effects ———
  const sendOtp = useCallback(async () => {
    try {
      await emailOtp.mutateAsync();
      setCooldown(RESEND_SECONDS);
    } catch {
      // The dialog stays usable; Resend remains available.
      setError(NETWORK_FAILURE);
    }
  }, [emailOtp]);

  useEffect(() => {
    if (!open || method !== 'email_otp' || emailSent.current) return;
    emailSent.current = true;
    void sendOtp();
  }, [open, method, sendOtp]);

  const handleVerifyError = useCallback(
    (cause: unknown) => {
      if (isApiError(cause) && (cause.status === 410 || cause.code === 'challenge_expired')) {
        close();
        toast({ kind: 'warn', title: 'Session expired', message: 'Please sign in again.' });
        return;
      }
      if (isApiError(cause) && cause.status === 401) {
        setError(INCORRECT_CODE);
        setBoxState('error');
        setShake(true);
        setTimeout(() => setShake(false), 450);
        return;
      }
      if (isApiError(cause)) {
        setError(cause.message ?? cause.code);
        return;
      }
      setError(NETWORK_FAILURE);
    },
    [close],
  );

  const handleSuccess = useCallback(
    (user: SessionUser, via: MfaUiMethod) => {
      pendingNav.current = { user, via };
      setBoxState('ok');
      setPhase('success');
      setTimeout(() => {
        const navigation = pendingNav.current;
        if (navigation === null) return;
        queryClient.setQueryData(queryKeys.session(), navigation.user);
        close();
        const home = homeFor(navigation.user.role);
        if (navigation.via === 'recovery' && home.startsWith('/admin')) {
          router.replace('/login?error=mfa_required');
          return;
        }
        router.replace(next !== '' && next !== '/' ? next : home);
      }, SUCCESS_NAV_DELAY_MS);
    },
    [close, next, queryClient, router],
  );

  const runWebAuthn = useCallback(async () => {
    setError('');
    try {
      const options = await webauthnOptions.mutateAsync();
      const assertion = await requestWebAuthnAssertion(options);
      const user = await verify.mutateAsync({ method: 'webauthn', assertion });
      handleSuccess(user, 'webauthn');
    } catch (cause) {
      if (isWebAuthnCancel(cause)) {
        setError(CANCELLED_KEY);
        return;
      }
      handleVerifyError(cause);
    }
  }, [handleSuccess, handleVerifyError, verify, webauthnOptions]);

  useEffect(() => {
    if (!open || method !== 'webauthn' || webauthnPrompted.current) return;
    webauthnPrompted.current = true;
    void runWebAuthn();
  }, [open, method, runWebAuthn]);

  // ——— submissions ———
  const submitCode = useCallback(
    async (code: string) => {
      if (pending) return;
      if (code.replace(/\D/g, '').length !== OTP_LENGTH) {
        setError(INCOMPLETE_CODE);
        return;
      }
      setError('');
      setBoxState('idle');
      try {
        const user = await verify.mutateAsync({
          method: method === 'email_otp' ? 'email_otp' : 'totp',
          code,
        });
        handleSuccess(user, method);
      } catch (cause) {
        handleVerifyError(cause);
      }
    },
    [handleSuccess, handleVerifyError, method, pending, verify],
  );

  const submitRecovery = useCallback(async () => {
    if (pending) return;
    const normalized = recoveryCode.trim().toUpperCase().replace(/\s+/g, '');
    if (!RECOVERY_PATTERN.test(normalized)) {
      setError(INCORRECT_CODE);
      return;
    }
    setError('');
    try {
      const user = await recovery.mutateAsync(normalized);
      handleSuccess(user, 'recovery');
    } catch (cause) {
      handleVerifyError(cause);
    }
  }, [handleSuccess, handleVerifyError, pending, recovery, recoveryCode]);

  const switchTo = (target: MfaUiMethod) => {
    setMethod(target);
    setError('');
    setBoxState('idle');
    setDigits(EMPTY_DIGITS());
    setRecoveryCode('');
    if (target === 'webauthn') webauthnPrompted.current = false;
    if (target === 'email_otp') emailSent.current = false;
  };

  if (!open) return null;

  const subtitle =
    method === 'email_otp' ? (
      <>
        Enter the 6-digit code we sent to{' '}
        <strong id="vvOtpTarget">{email !== '' ? maskEmail(email) : 'your email'}</strong>
      </>
    ) : method === 'totp' ? (
      'Enter the 6-digit code from your authenticator app.'
    ) : method === 'recovery' ? (
      'Enter one of your 12-character recovery codes (XXXX-XXXX-XXXX).'
    ) : (
      'Insert or tap your security key when prompted.'
    );

  const submitButton = (
    <button
      type="submit"
      className={cn('vv-submit', pending && 'is-loading')}
      id="vvOtpSubmit"
      disabled={pending}
      aria-busy={pending}
    >
      <span className="vv-submit-label">Verify OTP</span>
      <span className="vv-spinner" aria-hidden="true" />
    </button>
  );

  return (
    <div className={cn('vv-otp-overlay', mounted && 'is-open')} id="vvOtpOverlay">
      <div
        className={cn('vv-otp-card', shake && 'vv-shake')}
        id="vvOtpCard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vvOtpTitle"
        ref={cardRef}
      >
        <button
          type="button"
          className="vv-otp-close"
          id="vvOtpClose"
          aria-label="Close verification"
          onClick={close}
          hidden={phase === 'success'}
        >
          <X size={16} aria-hidden="true" />
        </button>

        <div className="vv-otp-view" id="vvOtpView" hidden={phase === 'success'}>
          <span className="vv-otp-icon" aria-hidden="true">
            <ShieldCheck size={26} />
          </span>
          <h2 className="vv-otp-title" id="vvOtpTitle">
            Verify it’s you
          </h2>
          <p className="vv-otp-sub">{subtitle}</p>

          {method === 'webauthn' ? (
            <form
              id="vvOtpForm"
              autoComplete="off"
              onSubmit={(event) => {
                event.preventDefault();
                void runWebAuthn();
              }}
            >
              <p
                className="vv-error vv-error--center"
                id="vvOtpError"
                role="alert"
                aria-live="polite"
              >
                {error}
              </p>
              {submitButton}
            </form>
          ) : method === 'recovery' ? (
            <form
              id="vvOtpForm"
              autoComplete="off"
              onSubmit={(event) => {
                event.preventDefault();
                void submitRecovery();
              }}
            >
              <label className="sr-only" htmlFor="vvRecoveryCode">
                Recovery code
              </label>
              <input
                id="vvRecoveryCode"
                className="vv-input vv-recovery"
                type="text"
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="XXXX-XXXX-XXXX"
                aria-describedby="vvOtpError"
                aria-invalid={error !== ''}
                value={recoveryCode}
                disabled={pending}
                onChange={(event) => {
                  setRecoveryCode(event.target.value);
                  if (error !== '') setError('');
                }}
              />
              <p
                className="vv-error vv-error--center"
                id="vvOtpError"
                role="alert"
                aria-live="polite"
              >
                {error}
              </p>
              {submitButton}
            </form>
          ) : (
            <form
              id="vvOtpForm"
              autoComplete="off"
              onSubmit={(event) => {
                event.preventDefault();
                void submitCode(digits.join(''));
              }}
            >
              <OtpInput
                digits={digits}
                onChange={(nextDigits) => {
                  setDigits(nextDigits);
                  if (error !== '') setError('');
                  if (boxState === 'error') setBoxState('idle');
                }}
                onComplete={(code) => void submitCode(code)}
                state={boxState}
                disabled={pending}
              />
              <p
                className="vv-error vv-error--center"
                id="vvOtpError"
                role="alert"
                aria-live="polite"
              >
                {error}
              </p>
              {submitButton}
            </form>
          )}

          <div className="vv-otp-foot">
            {method === 'email_otp' ? (
              <>
                <span className="vv-otp-foot-text">Didn’t get the code?</span>
                <button
                  type="button"
                  className="vv-link-btn"
                  id="vvResend"
                  disabled={cooldown > 0 || pending}
                  onClick={() => void sendOtp()}
                >
                  Resend code
                </button>
                <span className="vv-otp-timer" id="vvTimer" aria-live="polite">
                  {cooldown > 0 ? `Resend in ${cooldown}s` : ''}
                </span>
              </>
            ) : null}
          </div>

          <div className="vv-otp-foot">
            {methods.includes('totp') && method !== 'totp' ? (
              <button type="button" className="vv-link-btn" onClick={() => switchTo('totp')}>
                Use authenticator app
              </button>
            ) : null}
            {methods.includes('webauthn') && method !== 'webauthn' ? (
              <button type="button" className="vv-link-btn" onClick={() => switchTo('webauthn')}>
                Use security key
              </button>
            ) : null}
            {methods.includes('email_otp') && method !== 'email_otp' ? (
              <button type="button" className="vv-link-btn" onClick={() => switchTo('email_otp')}>
                Email me a code
              </button>
            ) : null}
            {method !== 'recovery' ? (
              <button type="button" className="vv-link-btn" onClick={() => switchTo('recovery')}>
                Use a recovery code
              </button>
            ) : null}
          </div>

          <button type="button" className="vv-back" id="vvBackToLogin" onClick={close}>
            <ArrowLeft size={14} aria-hidden="true" />
            Back to sign in
          </button>
        </div>

        <div className="vv-otp-view vv-otp-success" id="vvOtpSuccess" hidden={phase === 'form'}>
          <span className="vv-success-ring" aria-hidden="true">
            <Check size={30} />
          </span>
          <h2 className="vv-otp-title">Verification successful</h2>
          <p className="vv-otp-sub">Redirecting to VUNVAULT…</p>
          <div className="vv-success-bar">
            <span />
          </div>
        </div>
      </div>
    </div>
  );
}

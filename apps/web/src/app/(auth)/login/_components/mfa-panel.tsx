'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, ShieldCheck } from 'lucide-react';
import type { MfaMethod, SessionUser } from '@vunvault/contracts';
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
import { OtpInput, OTP_LENGTH } from './otp-input';
import '../../_styles/auth.css';

/**
 * MFA verification PANEL (Phase 1 magic-link work order) — the second factor
 * is a standalone PAGE at `/login/mfa`, not a modal over the login card. The
 * API redirects here after a verified magic link (or an OAuth staff sign-in)
 * with `?methods=`, a masked `?to=` and a sanitised `?next=`; the pre-MFA
 * session itself travels in the HttpOnly `vv_mfa` cookie, never in the URL.
 *
 * Method priority: `totp` > `email_otp` > `webauthn`; recovery codes are
 * always offered in the switcher (every MFA-enrolled account has them).
 * WebAuthn is NEVER auto-prompted on a page load — the visitor clicks "Use
 * your security key" (or it is the only method) before a browser prompt may
 * appear. When the default is `email_otp` the code is sent automatically on
 * mount, and switching to it re-sends (mirrors the old dialog behaviour).
 *
 * Success copy is the spec's verbatim pair ("Verification successful" /
 * "Redirecting to VUNVAULT…"). A staff session verified with a RECOVERY code
 * stays at `aal1`, so it is sent to `/login?error=mfa_required` instead of
 * the admin home. A 410 (expired/consumed challenge) toasts and returns the
 * visitor to `/login` to start over.
 */

/** UI-level method: the API enum plus the always-available recovery fallback. */
export type MfaUiMethod = MfaMethod | 'recovery';

const RESEND_SECONDS = 60;
const SUCCESS_NAV_DELAY_MS = 1400; // matches the vvSuccessBar animation
const FOCUS_DELAY_MS = 180;
const RECOVERY_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

const INCORRECT_CODE = 'Incorrect code. Please check the digits and try again.';
const INCOMPLETE_CODE = 'Please enter all 6 digits.';
const CANCELLED_KEY = 'Security key request was cancelled.';
const NETWORK_FAILURE = 'Verification failed. Please try again.';

const EMPTY_DIGITS = (): string[] => Array<string>(OTP_LENGTH).fill('');

function defaultMethod(methods: MfaMethod[]): MfaUiMethod {
  if (methods.includes('totp')) return 'totp';
  if (methods.includes('email_otp')) return 'email_otp';
  if (methods.includes('webauthn')) return 'webauthn';
  return 'recovery';
}

export interface MfaPanelProps {
  /** Methods the API offered in the redirect; an unavailable one fails `mfa_failed`. */
  methods: MfaMethod[];
  /** Server-masked email for the email-OTP copy (`re••••@vunvault.com`), or null. */
  to: string | null;
  /** Open-redirect-safe landing path after success; null → `homeFor(role)`. */
  next: string | null;
}

export function MfaPanel({ methods, to, next }: MfaPanelProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const verify = useMfaVerify();
  const emailOtp = useMfaEmailOtp();
  const recovery = useMfaRecovery();
  const webauthnOptions = useWebAuthnOptions();

  const [method, setMethod] = useState<MfaUiMethod>(() => defaultMethod(methods));
  const [digits, setDigits] = useState<string[]>(EMPTY_DIGITS);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [error, setError] = useState('');
  const [boxState, setBoxState] = useState<'idle' | 'error' | 'ok'>('idle');
  const [shake, setShake] = useState(false);
  const [phase, setPhase] = useState<'form' | 'success'>('form');
  const [cooldown, setCooldown] = useState(0);

  const cardRef = useRef<HTMLElement>(null);
  const emailSent = useRef(false);
  const pendingNav = useRef<{ user: SessionUser; via: MfaUiMethod } | null>(null);

  const pending =
    verify.isPending || recovery.isPending || webauthnOptions.isPending || emailOtp.isPending;

  // Focus the first OTP box once on mount (page mode — no dialog to trap in).
  useEffect(() => {
    const focusTimer = setTimeout(() => {
      cardRef.current?.querySelector<HTMLInputElement>('.vv-otp-digit')?.focus();
    }, FOCUS_DELAY_MS);
    return () => clearTimeout(focusTimer);
  }, []);

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
      // The panel stays usable; Resend remains available.
      setError(NETWORK_FAILURE);
    }
  }, [emailOtp]);

  useEffect(() => {
    if (method !== 'email_otp' || emailSent.current) return;
    emailSent.current = true;
    void sendOtp();
  }, [method, sendOtp]);

  const handleVerifyError = useCallback(
    (cause: unknown) => {
      if (isApiError(cause) && (cause.status === 410 || cause.code === 'challenge_expired')) {
        toast({ kind: 'warn', title: 'Session expired', message: 'Please sign in again.' });
        router.replace('/login');
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
    [router],
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
        const home = homeFor(navigation.user.role);
        if (navigation.via === 'recovery' && home.startsWith('/admin')) {
          router.replace('/login?error=mfa_required');
          return;
        }
        router.replace(next !== null && next !== '/' ? next : home);
      }, SUCCESS_NAV_DELAY_MS);
    },
    [next, queryClient, router],
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
    if (target === 'email_otp') emailSent.current = false;
  };

  const backHref = next !== null ? `/login?next=${encodeURIComponent(next)}` : '/login';

  const subtitle =
    method === 'email_otp' ? (
      <>
        Enter the 6-digit code we sent to <strong id="vvOtpTarget">{to ?? 'your email'}</strong>
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
    <div className="vv-otp-page" id="vvOtpPage">
      <main
        className={cn('vv-otp-card', shake && 'vv-shake')}
        id="vvOtpCard"
        aria-labelledby="vvOtpTitle"
        ref={cardRef}
      >
        <div className="vv-otp-view" id="vvOtpView" hidden={phase === 'success'}>
          <span className="vv-otp-icon" aria-hidden="true">
            <ShieldCheck size={26} />
          </span>
          <h1 className="vv-otp-title" id="vvOtpTitle">
            Verify it’s you
          </h1>
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

          <Link className="vv-back" id="vvBackToLogin" href={backHref}>
            <ArrowLeft size={14} aria-hidden="true" />
            Back to sign in
          </Link>
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
      </main>
    </div>
  );
}

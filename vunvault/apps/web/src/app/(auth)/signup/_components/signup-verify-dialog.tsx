'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Copy, KeyRound, Mail, X } from 'lucide-react';
import { configureApi, getApiConfig, queryKeys } from '@vunvault/lib';
import { cn, isApiError } from '@vunvault/lib';
import { toast } from '@vunvault/ui';
import { OtpInput, OTP_LENGTH } from '../../login/_components/otp-input';
import {
  groupSecret,
  qrCodeSrc,
  useResendSignupCode,
  useTotpEnroll,
  useTotpVerify,
  useVerifySignupEmail,
  type TotpEnroll,
} from '../_hooks/use-verify-signup';
import { useSignupStore } from '../_store/signup-store';
import { StepTracker, type VerifyStep } from './step-tracker';
import '../../_styles/signup.css';

/**
 * Signup verification dialog (Task 62) — mounted by `/signup`, driven by the
 * store Task 61's details form fills on the 202.
 *
 * Three forward-only steps (`Email → 2FA → Done`):
 *  1. the mailbox OTP (`POST /auth/signup/verify-email`); success opens the
 *     aal1 session via HttpOnly cookies and seeds the session cache;
 *  2. mandatory authenticator enrolment (planner decision, as in the
 *     prototype): `POST /account/mfa/totp/enroll` on entry, the QR rendered
 *     through an `<img>` data-URI (NEVER `dangerouslySetInnerHTML`), the
 *     secret grouped in 4s with a Copy button, then `…/totp/verify`;
 *  3. success: the verbatim toast, a 2.5 s redirect bar (instant under
 *     `prefers-reduced-motion`) and `Go now` — both land on `/onboarding`.
 *
 * Dialog semantics per the catalogue: `role="dialog"`, `aria-modal`,
 * `aria-labelledby="verifyTitle"`, a Tab focus trap, and Escape closes ONLY on
 * step 1 (the X button follows the same rule; steps 2–3 are mandatory — the
 * prototype's `Back` closes the dialog from either of the first two steps, so
 * an abandoned aal1 session simply stays unenrolled until the next sign-in).
 *
 * The prototype's "Test mode" hint panels and its fake in-page OTP/secret
 * generators are REMOVED — out of scope per the catalogue.
 *
 * 401 suppression: `apiFetch` fires the global session-expiry redirect on any
 * 401, but on this flow a 401 is the *expected* wrong-code signal
 * (`otp_invalid` / `otp_exhausted` / `mfa_failed`) with verbatim inline copy —
 * the visitor has no session to expire yet. While the dialog is open the
 * global `onUnauthorized` handler is parked (restored on close), the same
 * protection `apiGetQuiet` gives the session probe, scoped to this dialog's
 * lifetime.
 */

const RESEND_SECONDS = 30; // `resendAfterSeconds` — a literal in SignupStartResponse
const REDIRECT_DELAY_MS = 2500; // the spec's 2.5 s progress bar
const FOCUS_DELAY_MS = 180; // the prototype's focus delay (Task 60 precedent)

const OTP_INVALID = 'That code is incorrect. Please try again.';
const OTP_EXHAUSTED = 'Too many incorrect attempts. Request a new code.';
const OTP_EXPIRED = 'That code has expired. Request a new one.';
const OTP_INCOMPLETE = 'Please enter all 6 digits.';
const TOTP_INVALID = 'That authenticator code is incorrect.';
const TOTP_INCOMPLETE = 'Please enter the full 6-digit code.';
const NETWORK_FAILURE = 'Verification failed. Please try again.';
const RATE_LIMITED = {
  kind: 'warn',
  title: 'Too many attempts',
  message: 'Please wait a few minutes before trying again.',
} as const;

const EMPTY_DIGITS = (): string[] => Array<string>(OTP_LENGTH).fill('');

/** `Jane Wanjiru` → `Jane`; the prototype's placeholder covers the empty case. */
export function firstNameOf(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0];
  return first === undefined || first === '' ? 'friend' : first;
}

export function SignupVerifyDialog() {
  const open = useSignupStore((state) => state.open);
  const email = useSignupStore((state) => state.email);
  const fullName = useSignupStore((state) => state.fullName);
  const close = useSignupStore((state) => state.close);

  const router = useRouter();
  const queryClient = useQueryClient();
  const verifyEmail = useVerifySignupEmail();
  const resend = useResendSignupCode();
  const enroll = useTotpEnroll();
  const verifyTotp = useTotpVerify();

  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<VerifyStep>('otp');
  const [digits, setDigits] = useState<string[]>(EMPTY_DIGITS);
  const [boxState, setBoxState] = useState<'idle' | 'error' | 'ok'>('idle');
  const [error, setError] = useState('');
  const [exhausted, setExhausted] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const [enrolment, setEnrolment] = useState<TotpEnroll | null>(null);
  const [enrolError, setEnrolError] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpError, setTotpError] = useState('');

  const cardRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  const enrollStarted = useRef(false);
  const doneFired = useRef(false);

  const pending =
    verifyEmail.isPending || resend.isPending || enroll.isPending || verifyTotp.isPending;
  const codeComplete = digits.every((digit) => digit !== '');

  // ——— open/close lifecycle ———
  useEffect(() => {
    if (!open) {
      setMounted(false);
      return;
    }
    lastFocused.current = document.activeElement as HTMLElement | null;
    setStep('otp');
    setDigits(EMPTY_DIGITS());
    setBoxState('idle');
    setError('');
    setExhausted(false);
    setCooldown(RESEND_SECONDS);
    setEnrolment(null);
    setEnrolError('');
    setTotpCode('');
    setTotpError('');
    enrollStarted.current = false;
    doneFired.current = false;
    setMounted(true);
    const focusTimer = setTimeout(() => {
      cardRef.current?.querySelector<HTMLInputElement>('.vv-otp-digit')?.focus();
    }, FOCUS_DELAY_MS);
    return () => clearTimeout(focusTimer);
  }, [open]);

  // Restore focus to the element that opened the dialog.
  useEffect(() => {
    if (open) return;
    lastFocused.current?.focus();
    lastFocused.current = null;
  }, [open]);

  // Park the global 401 → /login redirect while the dialog owns 401 semantics.
  useEffect(() => {
    if (!open) return;
    const previous = getApiConfig().onUnauthorized;
    configureApi({ onUnauthorized: undefined });
    return () => {
      configureApi({ onUnauthorized: previous });
    };
  }, [open]);

  // Escape closes on step 1 only; Tab cycles inside the card (focus trap).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (step === 'otp') close();
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
  }, [open, step, close]);

  // Focus moves to the step heading on every step change (a11y).
  useEffect(() => {
    if (!open || step === 'otp') return;
    titleRef.current?.focus();
  }, [open, step]);

  // ——— resend cooldown ticker (one interval keyed on the boolean) ———
  const cooling = cooldown > 0;
  useEffect(() => {
    if (!cooling) return;
    const timer = setInterval(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooling]);

  // ——— step 2: enrol on entry (once per opening) ———
  const startEnroll = useCallback(async () => {
    setEnrolError('');
    try {
      setEnrolment(await enroll.mutateAsync());
    } catch {
      setEnrolError(NETWORK_FAILURE);
    }
  }, [enroll]);

  useEffect(() => {
    if (!open || step !== 'totp' || enrollStarted.current) return;
    enrollStarted.current = true;
    void startEnroll();
  }, [open, step, startEnroll]);

  // ——— step 3: success toast once, then the redirect timer ———
  useEffect(() => {
    if (!open || step !== 'done') return;
    if (!doneFired.current) {
      doneFired.current = true;
      toast({
        kind: 'ok',
        title: 'Account Created & Verified!',
        message: 'Two-factor authentication is now active on your account.',
      });
    }
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(
      () => {
        close();
        router.replace('/onboarding');
      },
      reduced ? 0 : REDIRECT_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [open, step, close, router]);

  // ——— submissions ———
  const submitOtp = useCallback(
    async (code: string) => {
      if (pending || exhausted) return;
      if (code.replace(/\D/g, '').length !== OTP_LENGTH) {
        setError(OTP_INCOMPLETE);
        return;
      }
      setError('');
      setBoxState('idle');
      try {
        const user = await verifyEmail.mutateAsync({ email, code });
        // The API set the aal1 session cookies; seed the client cache to match.
        queryClient.setQueryData(queryKeys.session(), user);
        setBoxState('ok');
        toast({
          kind: 'ok',
          title: 'Email verified',
          message: "Now let's set up two-factor authentication.",
        });
        setStep('totp');
      } catch (cause) {
        if (isApiError(cause) && (cause.status === 410 || cause.code === 'otp_expired')) {
          setError(OTP_EXPIRED);
          setBoxState('error');
          return;
        }
        if (isApiError(cause) && cause.code === 'otp_exhausted') {
          setError(OTP_EXHAUSTED);
          setBoxState('error');
          setExhausted(true); // boxes stay disabled until Resend
          return;
        }
        if (isApiError(cause) && cause.status === 401) {
          setError(OTP_INVALID);
          setBoxState('error');
          return;
        }
        if (isApiError(cause) && cause.status === 429) {
          toast(RATE_LIMITED);
          return;
        }
        setError(NETWORK_FAILURE);
        setBoxState('error');
      }
    },
    [email, exhausted, pending, queryClient, verifyEmail],
  );

  const submitResend = useCallback(async () => {
    if (pending) return;
    try {
      await resend.mutateAsync(email);
      setExhausted(false);
      setDigits(EMPTY_DIGITS());
      setBoxState('idle');
      setError('');
      setCooldown(RESEND_SECONDS);
      toast({
        kind: 'ok',
        title: 'Verification code sent',
        message: `A fresh verification code was sent to ${email}`,
      });
    } catch (cause) {
      if (isApiError(cause) && cause.status === 429) {
        toast(RATE_LIMITED);
        return;
      }
      setError(NETWORK_FAILURE);
      setBoxState('error');
    }
  }, [email, pending, resend]);

  const submitTotp = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (pending || enrolment === null) return;
      const code = totpCode.replace(/\D/g, '');
      if (code.length !== OTP_LENGTH) {
        setTotpError(TOTP_INCOMPLETE);
        return;
      }
      setTotpError('');
      try {
        await verifyTotp.mutateAsync({ factorId: enrolment.factorId, code });
        setStep('done');
      } catch (cause) {
        if (isApiError(cause) && cause.status === 401) {
          setTotpError(TOTP_INVALID);
          return;
        }
        if (isApiError(cause) && cause.status === 429) {
          toast(RATE_LIMITED);
          return;
        }
        setTotpError(NETWORK_FAILURE);
      }
    },
    [enrolment, pending, totpCode, verifyTotp],
  );

  const copySecret = useCallback(async () => {
    if (enrolment === null) return;
    try {
      await navigator.clipboard?.writeText(enrolment.secret);
    } catch {
      // Clipboard permission denied — the secret stays visible on screen.
    }
    toast({ kind: 'ok', title: 'Secret copied' });
  }, [enrolment]);

  if (!open) return null;

  return (
    <div className={cn('vv-verify', mounted && 'is-open')} id="vvVerifyModal">
      <div className="vv-verify-backdrop" aria-hidden="true" />
      <div
        className="vv-verify-card"
        id="vvVerifyCard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="verifyTitle"
        ref={cardRef}
      >
        <button
          type="button"
          className="vv-verify-close"
          id="vvVerifyClose"
          aria-label="Close verification"
          onClick={close}
          hidden={step !== 'otp'}
        >
          <X size={17} aria-hidden="true" />
        </button>

        <StepTracker current={step} />

        {step === 'otp' ? (
          <section className="vv-verify-step" data-step="otp">
            <span className="vv-verify-step-icon" aria-hidden="true">
              <Mail size={24} />
            </span>
            <h2
              className="vv-verify-title"
              id="verifyTitle"
              tabIndex={-1}
              ref={(node) => {
                titleRef.current = node;
              }}
            >
              Verify your email
            </h2>
            <p className="vv-verify-step-text">
              We sent a 6-digit verification code to
              <br />
              <strong id="otpTargetEmail">{email}</strong>
            </p>
            <form
              id="vvVerifyOtpForm"
              autoComplete="off"
              onSubmit={(event) => {
                event.preventDefault();
                void submitOtp(digits.join(''));
              }}
            >
              <OtpInput
                digits={digits}
                onChange={(nextDigits) => {
                  setDigits(nextDigits);
                  if (error !== '') setError('');
                  if (boxState === 'error') setBoxState('idle');
                }}
                onComplete={(code) => void submitOtp(code)}
                state={boxState}
                disabled={pending || exhausted}
              />
              <span
                className={cn('vv-signup-err vv-verify-err', error !== '' && 'is-visible')}
                id="otpError"
                role="alert"
                aria-live="polite"
              >
                {error}
              </span>
              <div className="vv-verify-actions">
                <button type="button" className="vv-verify-btn-ghost" onClick={close}>
                  Back
                </button>
                <button
                  type="submit"
                  className={cn('vv-signup-submit', pending && 'is-loading')}
                  id="verifyOtpBtn"
                  disabled={!codeComplete || pending || exhausted}
                  aria-busy={pending}
                >
                  <span>Verify OTP</span>
                  <span className="vv-spinner" aria-hidden="true" />
                </button>
              </div>
            </form>
            <div className="vv-verify-resend-row">
              {"Didn't get the code?"}{' '}
              <button
                type="button"
                className="vv-verify-resend-btn"
                id="resendBtn"
                disabled={cooldown > 0 || pending}
                onClick={() => void submitResend()}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend'}
              </button>
            </div>
          </section>
        ) : null}

        {step === 'totp' ? (
          <section className="vv-verify-step" data-step="totp">
            <span className="vv-verify-step-icon" aria-hidden="true">
              <KeyRound size={24} />
            </span>
            <h2
              className="vv-verify-title"
              id="verifyTitle"
              tabIndex={-1}
              ref={(node) => {
                titleRef.current = node;
              }}
            >
              Two-factor authentication
            </h2>
            <p className="vv-verify-step-text">
              Scan the secret key in your authenticator app, then enter the 6-digit code it
              generates.
            </p>
            {enrolment === null ? (
              <div className="vv-verify-enroll-pending">
                <span
                  className="vv-spinner vv-verify-enroll-spinner"
                  id="vvEnrollSpinner"
                  aria-hidden="true"
                />
                {enrolError !== '' ? (
                  <>
                    <span className="vv-signup-err vv-verify-err is-visible" role="alert">
                      {enrolError}
                    </span>
                    <button
                      type="button"
                      className="vv-verify-btn-ghost"
                      onClick={() => void startEnroll()}
                    >
                      Try again
                    </button>
                  </>
                ) : null}
              </div>
            ) : (
              <form id="vvVerifyTotpForm" autoComplete="off" onSubmit={submitTotp}>
                <div className="vv-verify-qr">
                  {/* eslint-disable-next-line @next/next/no-img-element -- data-URI SVG, not an optimisable asset */}
                  <img alt="Authenticator QR code" src={qrCodeSrc(enrolment.qrCodeSvg)} />
                </div>
                <div className="vv-verify-secret">
                  <span className="vv-verify-secret-label" id="vvSecretLabel">
                    Your 2FA secret key
                  </span>
                  <span className="vv-verify-secret-row">
                    <code id="vvTotpSecret" aria-labelledby="vvSecretLabel">
                      {groupSecret(enrolment.secret)}
                    </code>
                    <button
                      type="button"
                      className="vv-verify-copy"
                      onClick={() => void copySecret()}
                    >
                      <Copy size={13} aria-hidden="true" />
                      Copy
                    </button>
                  </span>
                </div>
                <div className="vv-signup-field vv-verify-totp-field">
                  <label className="vv-signup-label" htmlFor="vvTotpCode">
                    Authenticator code
                  </label>
                  <input
                    className={cn(
                      'vv-signup-input vv-verify-totp-input',
                      totpError !== '' && 'is-invalid',
                    )}
                    id="vvTotpCode"
                    type="text"
                    inputMode="numeric"
                    maxLength={OTP_LENGTH}
                    autoComplete="off"
                    placeholder="000000"
                    aria-describedby="totpError"
                    aria-invalid={totpError !== ''}
                    value={totpCode}
                    disabled={pending}
                    onChange={(event) => {
                      setTotpCode(event.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH));
                      if (totpError !== '') setTotpError('');
                    }}
                  />
                  <span
                    className={cn('vv-signup-err vv-verify-err', totpError !== '' && 'is-visible')}
                    id="totpError"
                    role="alert"
                    aria-live="polite"
                  >
                    {totpError}
                  </span>
                </div>
                <div className="vv-verify-actions">
                  <button type="button" className="vv-verify-btn-ghost" onClick={close}>
                    Back
                  </button>
                  <button
                    type="submit"
                    className={cn('vv-signup-submit', pending && 'is-loading')}
                    id="verifyTotpBtn"
                    disabled={pending}
                    aria-busy={pending}
                  >
                    <span>Verify &amp; Create Account</span>
                    <span className="vv-spinner" aria-hidden="true" />
                  </button>
                </div>
              </form>
            )}
          </section>
        ) : null}

        {step === 'done' ? (
          <section className="vv-verify-step" data-step="done">
            <span className="vv-verify-step-icon vv-verify-step-icon--ok" aria-hidden="true">
              <Check size={24} />
            </span>
            <h2
              className="vv-verify-title"
              id="verifyTitle"
              tabIndex={-1}
              ref={(node) => {
                titleRef.current = node;
              }}
            >
              Account Created &amp; Verified!
            </h2>
            <p className="vv-verify-step-text">
              Welcome to VUNVAULT, <strong id="vvSuccessName">{firstNameOf(fullName)}</strong>. Your
              email and two-factor authentication are now active.
            </p>
            <p className="vv-verify-step-text">Redirecting to your dashboard…</p>
            <div className="vv-verify-redirect-bar" aria-hidden="true">
              <span />
            </div>
            <div className="vv-verify-actions">
              <button
                type="button"
                className="vv-signup-submit"
                id="vvGoNow"
                onClick={() => {
                  close();
                  router.replace('/onboarding');
                }}
              >
                <span>Go now</span>
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

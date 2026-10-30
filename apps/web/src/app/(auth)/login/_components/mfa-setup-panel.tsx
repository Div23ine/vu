'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, ShieldCheck } from 'lucide-react';
import type { SessionUser } from '@vunvault/contracts';
import { cn, isApiError, queryKeys } from '@vunvault/lib';
import { toast } from '@vunvault/ui';
import { homeFor } from '../../../../lib/permissions';
import { groupSecret, qrCodeSrc } from '../../signup/_hooks/use-verify-signup';
import {
  useMfaSetupAbandon,
  useMfaSetupOptions,
  useMfaSetupVerify,
  type MfaSetupOptions,
} from '../_hooks/use-mfa-setup';
import { OtpInput, OTP_LENGTH } from './otp-input';
import '../../_styles/auth.css';

/**
 * Forced first-sign-in MFA SETUP panel (Phase 2). Reached from the magic-link
 * redirect for unenrolled accounts (`/login/mfa/setup`), with the pre-MFA
 * session riding the HttpOnly `vv_mfa` cookie — the URL only carries a masked
 * `to`, the admin window `deadline` (epoch ms) and a sanitised `next`.
 *
 * Administrators get a visible mm:ss countdown of their 5-minute window
 * (rendered from `deadline`, never trusting client clocks for enforcement —
 * the API closes the window itself). When it runs out, or they press Abandon,
 * the account moves to `blocked_mfa_setup` and this panel switches to the
 * blocked notice: a super administrator must unblock it, after which the next
 * sign-in restarts the window. Normal users get the same enrolment form
 * WITHOUT a timer or abandon control — they are routed here, never blocked,
 * never bypassed. The first correct code opens the FULL session and lands on
 * `next` (or `homeFor(role)`).
 */

const EMPTY_DIGITS = Array.from({ length: OTP_LENGTH }, () => '');
const SUCCESS_NAV_DELAY_MS = 1400; // matches the vvSuccessBar animation
const FOCUS_DELAY_MS = 180;

const INCORRECT_SETUP_CODE = 'Incorrect code. Please check the digits and try again.';
const INCOMPLETE_CODE = 'Please enter all 6 digits.';
const OPTIONS_FAILURE = 'We could not prepare your enrolment. Please try again.';
const NETWORK_FAILURE = 'Network error. Please try again.';

type SetupPhase = 'loading' | 'form' | 'success' | 'blocked' | 'failed';

function formatCountdown(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const minutes = Math.floor(clamped / 60);
  const rest = clamped % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export interface MfaSetupPanelProps {
  /**
   * Absolute window deadline in epoch milliseconds for TIMED (administrator)
   * setups; `null` for untimed (normal-user) enrolment — the countdown and
   * the abandon control only render when a deadline exists.
   */
  deadlineEpochMs: number | null;
  /** Server-masked email carried from the magic-link redirect (display only). */
  to: string | null;
  /** Open-redirect-safe landing path after success; null → `homeFor(role)`. */
  next: string | null;
}

export function MfaSetupPanel({ deadlineEpochMs, to, next }: MfaSetupPanelProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const options = useMfaSetupOptions();
  const verify = useMfaSetupVerify();
  const abandon = useMfaSetupAbandon();

  const [enrolment, setEnrolment] = useState<MfaSetupOptions | null>(null);
  const [phase, setPhase] = useState<SetupPhase>('loading');
  const [digits, setDigits] = useState<string[]>(EMPTY_DIGITS);
  const [error, setError] = useState('');
  const [boxState, setBoxState] = useState<'idle' | 'error' | 'ok'>('idle');
  const [shake, setShake] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);
  const [remaining, setRemaining] = useState<number>(() =>
    deadlineEpochMs === null ? 0 : Math.max(0, Math.ceil((deadlineEpochMs - Date.now()) / 1000)),
  );

  const cardRef = useRef<HTMLElement>(null);
  /** The window closes exactly once (expiry OR the abandon button). */
  const closedRef = useRef(false);

  const timed = deadlineEpochMs !== null;
  const pending = options.isPending || verify.isPending || abandon.isPending;
  const qr = useMemo(
    () => (enrolment === null ? null : qrCodeSrc(enrolment.qrCodeSvg)),
    [enrolment],
  );

  // ——— open the setup window (POST options on mount) ———
  useEffect(() => {
    let cancelled = false;
    options.mutate(undefined, {
      onSuccess: (data) => {
        if (cancelled) return;
        setEnrolment(data);
        setPhase('form');
      },
      onError: (cause) => {
        if (cancelled) return;
        if (isApiError(cause) && cause.code === 'setup_expired') {
          // Window already closed — the account was blocked (lazily).
          setPhase('blocked');
          return;
        }
        if (isApiError(cause) && (cause.status === 410 || cause.code === 'challenge_expired')) {
          toast({ kind: 'warn', title: 'Session expired', message: 'Please sign in again.' });
          router.replace('/login');
          return;
        }
        setError(isApiError(cause) ? (cause.message ?? OPTIONS_FAILURE) : OPTIONS_FAILURE);
        setPhase('failed');
      },
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ——— close the window: expiry or the abandon control ———
  const closeWindow = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    abandon.mutate(undefined, {
      onSuccess: (data) => {
        if (data.blocked) {
          setPhase('blocked');
        } else {
          // Untimed enrolment: abandoning simply returns to sign-in.
          router.replace('/login');
        }
      },
      onError: () => {
        // Cannot reach the API to record the abandonment — show the blocked
        // notice anyway; the server blocks lazily on the next touch.
        setPhase('blocked');
      },
    });
  }, [abandon, router]);

  // ——— visible mm:ss countdown (timed/admin windows only) ———
  useEffect(() => {
    if (deadlineEpochMs === null) return undefined;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadlineEpochMs - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) closeWindow();
    };
    tick();
    const handle = setInterval(tick, 1000);
    return () => clearInterval(handle);
  }, [deadlineEpochMs, closeWindow]);

  // Stop the countdown-driven close once the flow is over (session open,
  // blocked notice up, or the options leg failed outright).
  useEffect(() => {
    if (phase === 'success' || phase === 'blocked' || phase === 'failed') {
      closedRef.current = true;
    }
  }, [phase]);

  // Focus the first OTP box once the form renders.
  useEffect(() => {
    if (phase !== 'form') return undefined;
    const timer = setTimeout(() => {
      cardRef.current?.querySelector<HTMLInputElement>('.vv-otp-digit')?.focus();
    }, FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  // ——— submissions ———
  const submitCode = useCallback(
    (code: string) => {
      if (pending || enrolment === null) return;
      if (code.replace(/\D/g, '').length !== OTP_LENGTH) {
        setError(INCOMPLETE_CODE);
        return;
      }
      setError('');
      verify.mutate(
        { factorId: enrolment.factorId, code },
        {
          onSuccess: (user: SessionUser) => {
            setBoxState('ok');
            setPhase('success');
            setTimeout(() => {
              queryClient.setQueryData(queryKeys.session(), user);
              const home = homeFor(user.role);
              router.replace(next !== null && next !== '/' ? next : home);
            }, SUCCESS_NAV_DELAY_MS);
          },
          onError: (cause) => {
            if (isApiError(cause) && cause.code === 'setup_expired') {
              closeWindow();
              return;
            }
            if (isApiError(cause) && (cause.status === 410 || cause.code === 'challenge_expired')) {
              toast({ kind: 'warn', title: 'Session expired', message: 'Please sign in again.' });
              router.replace('/login');
              return;
            }
            setDigits(EMPTY_DIGITS);
            setBoxState('error');
            setShake(true);
            setTimeout(() => setShake(false), 450);
            if (isApiError(cause) && cause.status === 401) {
              setError(INCORRECT_SETUP_CODE);
            } else if (isApiError(cause)) {
              setError(cause.message ?? cause.code ?? NETWORK_FAILURE);
            } else {
              setError(NETWORK_FAILURE);
            }
          },
        },
      );
    },
    [closeWindow, enrolment, next, pending, queryClient, router, verify],
  );

  const copySecret = useCallback(() => {
    if (enrolment === null) return;
    navigator.clipboard
      ?.writeText(enrolment.secret)
      .then(() => {
        setSecretCopied(true);
        setTimeout(() => setSecretCopied(false), 2000);
      })
      .catch(() => undefined);
  }, [enrolment]);

  const backHref = next !== null ? `/login?next=${encodeURIComponent(next)}` : '/login';

  const subtitle = timed ? (
    <>
      Scan the QR code with your authenticator app, then enter the 6-digit code it shows — before
      the timer runs out.
      {to === null ? '' : ` Account: ${to}.`}
    </>
  ) : (
    <>
      Scan the QR code with your authenticator app, then enter the 6-digit code it shows. This step
      is required once — after it you will be asked for a code at every sign-in.
      {to === null ? '' : ` Account: ${to}.`}
    </>
  );

  return (
    <div className="vv-otp-page" id="vvSetupPage">
      <main
        className={cn('vv-otp-card', shake && 'vv-shake')}
        id="vvSetupCard"
        aria-labelledby="vvSetupTitle"
        ref={cardRef}
      >
        {/* ——— blocked notice (window expired or abandoned) ——— */}
        {phase === 'blocked' ? (
          <div className="vv-otp-view" id="vvSetupBlocked" aria-live="polite">
            <span className="vv-otp-icon" aria-hidden="true">
              <ShieldCheck size={26} />
            </span>
            <h1 className="vv-otp-title" id="vvSetupTitle">
              Setup window expired
            </h1>
            <p className="vv-otp-sub">
              Two-factor setup was not completed within the 5-minute window, so this administrator
              account is now blocked. Ask a super administrator to unblock it — your next sign-in
              will restart the setup window.
            </p>
            <Link className="vv-back" id="vvSetupBlockedBack" href={backHref}>
              <ArrowLeft size={14} aria-hidden="true" />
              Back to sign in
            </Link>
          </div>
        ) : phase === 'failed' ? (
          <div className="vv-otp-view" id="vvSetupFailed" aria-live="polite">
            <span className="vv-otp-icon" aria-hidden="true">
              <ShieldCheck size={26} />
            </span>
            <h1 className="vv-otp-title" id="vvSetupTitle">
              Setup unavailable
            </h1>
            <p className="vv-otp-sub">{error === '' ? OPTIONS_FAILURE : error}</p>
            <Link className="vv-back" id="vvSetupFailedBack" href={backHref}>
              <ArrowLeft size={14} aria-hidden="true" />
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            {/* ——— enrolment form (and the loading state before options land) ——— */}
            <div
              className="vv-otp-view"
              id="vvSetupView"
              hidden={phase !== 'form' && phase !== 'loading'}
            >
              <span className="vv-otp-icon" aria-hidden="true">
                <ShieldCheck size={26} />
              </span>
              <h1 className="vv-otp-title" id="vvSetupTitle">
                {phase === 'loading'
                  ? 'Preparing your enrolment'
                  : 'Set up two-factor authentication'}
              </h1>
              {timed && phase === 'form' ? (
                <p
                  className={cn('vv-setup-timer', remaining <= 60 && 'is-low')}
                  id="vvSetupTimer"
                  role="timer"
                  aria-live="polite"
                >
                  {formatCountdown(remaining)}
                </p>
              ) : null}
              <p className="vv-otp-sub">
                {phase === 'loading' ? 'Generating your QR code…' : subtitle}
              </p>

              {phase === 'form' && enrolment !== null ? (
                <>
                  <div className="vv-setup-qr">
                    {qr === null ? null : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={qr} alt="Authenticator QR code" id="vvSetupQr" />
                    )}
                  </div>

                  <div className="vv-setup-secret">
                    <span className="vv-setup-secret-label" id="vvSetupSecretLabel">
                      Or enter this secret manually
                    </span>
                    <div className="vv-setup-secret-row">
                      <code
                        className="vv-setup-secret-code"
                        id="vvSetupSecret"
                        aria-labelledby="vvSetupSecretLabel"
                      >
                        {groupSecret(enrolment.secret)}
                      </code>
                      <button
                        className="vv-setup-copy"
                        id="vvSetupCopy"
                        type="button"
                        onClick={copySecret}
                        aria-label={secretCopied ? 'Secret copied' : 'Copy secret'}
                      >
                        {secretCopied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  <form
                    id="vvSetupForm"
                    autoComplete="off"
                    onSubmit={(event) => {
                      event.preventDefault();
                      submitCode(digits.join(''));
                    }}
                  >
                    <OtpInput
                      digits={digits}
                      onChange={(nextDigits) => {
                        setDigits(nextDigits);
                        if (error !== '') setError('');
                        if (boxState === 'error') setBoxState('idle');
                      }}
                      onComplete={(code) => submitCode(code)}
                      state={boxState}
                      disabled={pending}
                    />
                    <p
                      className="vv-error vv-error--center"
                      id="vvSetupError"
                      role="alert"
                      aria-live="polite"
                    >
                      {error}
                    </p>
                    <button
                      type="submit"
                      className={cn('vv-submit', pending && 'is-loading')}
                      id="vvSetupSubmit"
                      disabled={pending}
                      aria-busy={pending}
                    >
                      <span className="vv-submit-label">Verify and sign in</span>
                      <span className="vv-spinner" aria-hidden="true" />
                    </button>
                  </form>

                  <div className="vv-otp-foot">
                    {timed ? (
                      <>
                        <button
                          type="button"
                          className="vv-link-btn"
                          id="vvSetupAbandon"
                          disabled={pending}
                          onClick={closeWindow}
                        >
                          Abandon setup
                        </button>
                        <span className="vv-otp-foot-text" id="vvSetupAbandonHint">
                          Abandoning blocks this account until a super administrator unblocks it.
                        </span>
                      </>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>

            {/* ——— success (spec's verbatim pair, mfa-panel parity) ——— */}
            <div
              className="vv-otp-view vv-otp-success"
              id="vvSetupSuccess"
              hidden={phase !== 'success'}
            >
              <span className="vv-success-ring" aria-hidden="true">
                <Check size={30} />
              </span>
              <h2 className="vv-otp-title">Verification successful</h2>
              <p className="vv-otp-sub">Redirecting to VUNVAULT…</p>
              <div className="vv-success-bar">
                <span />
              </div>
            </div>
          </>
        )}

        {phase === 'form' && !timed ? (
          <Link className="vv-back" id="vvSetupBack" href={backHref}>
            <ArrowLeft size={14} aria-hidden="true" />
            Back to sign in
          </Link>
        ) : null}
      </main>
    </div>
  );
}

export default MfaSetupPanel;

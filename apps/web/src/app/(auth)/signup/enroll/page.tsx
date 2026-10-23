'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isApiError } from '../../../../lib/api';
import { qrCodeSrc } from '../../../../lib/qr';
import {
  useTotpEnroll,
  useTotpVerify,
} from '../../../(authed)/portal/security/_hooks/use-security';

/**
 * Signup step 4 — the QR / long-code onboarding wizard.
 *
 * The flow that lands here: email → mailed confirmation link → six-digit
 * code → this wizard. The account exists and the session is already open;
 * what remains is pairing the second factor. The enrolment challenge is
 * provisioned automatically on arrival and the wizard walks three steps:
 *
 *   1. Scan   — the QR code, plus the Base32 "long code" for manual entry
 *   2. Verify — the six digits currently shown in the authenticator app
 *   3. Done   — the factor is live; on to the dashboard
 *
 * "Set up later" exits to the dashboard; Portal → Security offers the same
 * ceremony any time. Wrong codes answer 401 `mfa_failed`, which the verify
 * hook posts quietly (see lib/api.ts) so the member stays in the wizard
 * instead of being flung to /login by the global session-expiry redirect.
 */

type Step = 'scan' | 'verify' | 'done';

const RAIL: ReadonlyArray<{ id: Step; label: string }> = [
  { id: 'scan', label: 'Scan' },
  { id: 'verify', label: 'Verify' },
  { id: 'done', label: 'Done' },
];

function StepRail({ current }: { current: Step }) {
  const currentIndex = RAIL.findIndex((entry) => entry.id === current);
  return (
    <ol
      className="flex items-center justify-center gap-4 text-[11px] font-bold uppercase tracking-wider"
      aria-label="Enrolment progress"
    >
      {RAIL.map((entry, index) => {
        const reached = index <= currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <li
            key={entry.id}
            aria-current={isCurrent ? 'step' : undefined}
            className={`flex items-center gap-1.5 ${isCurrent ? 'text-cyan-700' : reached ? 'text-neutral-700' : 'text-neutral-400'}`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                isCurrent
                  ? 'bg-cyan-700 text-white'
                  : reached
                    ? 'bg-neutral-800 text-white'
                    : 'border border-neutral-300 bg-white text-neutral-400'
              }`}
            >
              {index + 1}
            </span>
            {entry.label}
          </li>
        );
      })}
    </ol>
  );
}

export default function SignupEnrollPage() {
  const router = useRouter();
  const enroll = useTotpEnroll();
  const verify = useTotpVerify();
  const [step, setStep] = useState<Step>('scan');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const started = useRef(false);

  // The wizard provisions its own challenge — no manual "generate" click.
  useEffect(() => {
    if (started.current || enroll.data !== undefined || enroll.isPending) return;
    started.current = true;
    enroll.mutate(undefined, {
      onError: () =>
        setError('We could not prepare your QR code. Check your connection and try again.'),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire-once guard; mutation identity is unstable
  }, []);

  // Step 3 leaves for the dashboard on its own after a beat.
  useEffect(() => {
    if (step !== 'done') return;
    const timer = setTimeout(() => router.replace('/'), 2000);
    return () => clearTimeout(timer);
  }, [step, router]);

  const enrolment = enroll.data;

  async function copySecret() {
    if (enrolment === undefined) return;
    try {
      await navigator.clipboard?.writeText(enrolment.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function retryProvision() {
    setError(null);
    enroll.mutate(undefined, {
      onError: () =>
        setError('We could not prepare your QR code. Check your connection and try again.'),
    });
  }

  function submitCode(event: FormEvent) {
    event.preventDefault();
    if (enrolment === undefined) return;
    setError(null);
    verify.mutate(
      { factorId: enrolment.factorId, code },
      {
        onSuccess: () => setStep('done'),
        onError: (caught: unknown) => {
          if (isApiError(caught) && caught.code === 'mfa_failed') {
            setError('That code did not match. Read the current six digits and retry.');
          } else {
            setError('Verification failed. Try again in a moment.');
          }
        },
      },
    );
  }

  const provisioning = enrolment === undefined && (enroll.isPending || error === null);

  return (
    <section className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-6 py-12">
      <div className="w-full max-w-md space-y-5 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">
          Set up your authenticator app
        </h1>
        <p className="text-sm leading-relaxed text-neutral-600">
          Your account is created and you are signed in. Last step of onboarding: pair Google
          Authenticator (or any TOTP app) so every future sign-in needs something only your phone
          can produce.
        </p>

        {enrolment === undefined ? (
          <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-8">
            {provisioning ? (
              <p className="text-sm font-semibold text-neutral-600" role="status">
                Preparing your QR code…
              </p>
            ) : (
              <>
                {error !== null && (
                  <p
                    role="alert"
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700"
                  >
                    {error}
                  </p>
                )}
                <button
                  type="button"
                  onClick={retryProvision}
                  disabled={enroll.isPending}
                  className="w-full rounded-xl bg-cyan-700 px-5 py-3 text-sm font-bold text-white hover:bg-cyan-800 disabled:opacity-60"
                >
                  Try again
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-6">
            <StepRail current={step} />

            {step === 'scan' && (
              <div className="space-y-5 text-left">
                <div className="flex flex-col items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- data-URI SVG, not an optimisable asset */}
                  <img
                    src={qrCodeSrc(enrolment.qrCodeSvg)}
                    alt="QR code that adds VUNVAULT to your authenticator app"
                    width={192}
                    height={192}
                    className="rounded-xl border border-neutral-200"
                  />
                  <p className="text-center text-xs text-neutral-500">
                    Open your authenticator app, choose “Add account”, and point the camera here.
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Can’t scan? Enter this setup key instead
                  </p>
                  <div className="mt-1 flex items-stretch gap-2">
                    <code className="flex-1 break-all rounded-lg bg-neutral-100 px-3 py-2 font-mono text-sm text-neutral-900">
                      {enrolment.secret}
                    </code>
                    <button
                      type="button"
                      onClick={() => void copySecret()}
                      className="rounded-lg border border-neutral-300 bg-white px-3 text-xs font-bold text-neutral-700 hover:bg-neutral-50"
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('verify')}
                  className="w-full rounded-xl bg-cyan-700 px-5 py-3 text-sm font-bold text-white hover:bg-cyan-800"
                >
                  I’ve added it — continue
                </button>
              </div>
            )}

            {step === 'verify' && (
              <form onSubmit={submitCode} noValidate className="space-y-3 text-left">
                <label htmlFor="totp-code" className="block text-sm font-bold text-neutral-900">
                  Six digits from your app
                </label>
                <input
                  id="totp-code"
                  inputMode="numeric"
                  maxLength={6}
                  aria-required={true}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-center font-mono text-lg tracking-[0.4em] focus:border-cyan-600 focus:outline-none"
                />
                {error !== null && (
                  <p
                    role="alert"
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700"
                  >
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={verify.isPending || code.length !== 6}
                  className="w-full rounded-xl bg-cyan-700 px-5 py-3 text-sm font-bold text-white hover:bg-cyan-800 disabled:opacity-60"
                >
                  {verify.isPending ? 'Checking…' : 'Verify and enable'}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('scan')}
                  className="w-full text-center text-xs font-bold text-neutral-500 hover:text-neutral-800"
                >
                  Back to the QR code
                </button>
              </form>
            )}

            {step === 'done' && (
              <div className="space-y-4 py-2 text-center" role="status">
                <p className="text-lg font-extrabold text-neutral-900">
                  Two-factor authentication is on
                </p>
                <p className="text-sm leading-relaxed text-neutral-600">
                  Every future sign-in will ask for six digits from your authenticator app after the
                  emailed code. Taking you to your dashboard…
                </p>
                <button
                  type="button"
                  onClick={() => router.replace('/')}
                  className="w-full rounded-xl bg-cyan-700 px-5 py-3 text-sm font-bold text-white hover:bg-cyan-800"
                >
                  Continue to dashboard
                </button>
              </div>
            )}
          </div>
        )}

        {step !== 'done' && (
          <p className="text-xs text-neutral-500">
            No phone handy?{' '}
            <Link className="font-bold text-cyan-700" href="/">
              Set up later
            </Link>{' '}
            — you can enrol any time from Portal → Security.
          </p>
        )}
      </div>
    </section>
  );
}

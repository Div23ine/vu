'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Mail, MailCheck, ShieldCheck } from 'lucide-react';
import { cn } from '@vunvault/lib';
import { toast } from '@vunvault/ui';
import { OAuthButtons } from '../../_components/oauth-buttons';
import { useMagicLink } from '../_hooks/use-magic-link';
import { TurnstileWidget } from './turnstile-widget';
import '../../_styles/auth.css';

/**
 * Magic-link login card (Phase 1) — replaces the password card.
 *
 * The ONLY credential accepted here is an email address: submit requests a
 * single-use sign-in link (`POST /auth/magic-link`), and the card flips to
 * the "Check your email" state. The API answers identically for registered
 * and unregistered addresses, so this view NEVER branches on registration
 * status (an unregistered address gets a signup-invitation email instead —
 * invisible to the browser). No password field exists anywhere on the login
 * surface.
 *
 * RHF + Zod (never `useState` for values); the schema carries the spec's
 * verbatim validation messages. The card is a page-level `<main>`, not a
 * dialog. `?error=` codes (OAuth returns AND magic-link verify refusals)
 * toast once on mount.
 */

const magicLinkFormSchema = z.object({
  email: z.string().min(1, 'Email address is required.').email('Enter a valid email address.'),
});

type MagicLinkFormValues = z.input<typeof magicLinkFormSchema>;

/** `?error=` codes → verbatim toast messages. */
const ERROR_TOASTS: Record<string, string> = {
  oauth_state: 'OAuth sign-in was cancelled or expired. Please try again.',
  oauth_denied: 'OAuth sign-in was cancelled or expired. Please try again.',
  oauth_email_unverified: 'Your provider account has no verified email address.',
  oauth_not_allowed: 'Staff accounts must sign in with their email magic link.',
  oauth_email_in_use: 'An account with this email already exists. Sign in with your magic link.',
  mfa_required: 'Multi-factor authentication is required for this account.',
  magic_link_invalid: 'This sign-in link is invalid. Please request a new one.',
  magic_link_expired: 'This sign-in link has expired. Please request a new one.',
  magic_link_used: 'This sign-in link has already been used. Please request a new one.',
  account_blocked: 'This account is blocked. Please contact your administrator.',
  account_inactive: 'This account is not active yet. Check your inbox to finish signing up.',
  sign_in_unavailable: 'Sign-in is temporarily unavailable. Please try again later.',
};

export interface MagicLinkCardProps {
  /** Sanitised by the route (`safeNextPath`); null → the API's default. */
  next: string | null;
  /** Raw `?error=` code, toasted once on mount. */
  error: string | null;
}

export function MagicLinkCard({ next, error }: MagicLinkCardProps) {
  const magic = useMagicLink();
  const toastFired = useRef(false);
  const [sentEmail, setSentEmail] = useState('');
  // Phase 4: the honeypot lives OUTSIDE RHF (its value is carriage, not form
  // state) and the email awaiting a solved captcha is parked for the retry.
  const honeypotRef = useRef<HTMLInputElement>(null);
  const [captchaEmail, setCaptchaEmail] = useState('');
  const [captchaFailed, setCaptchaFailed] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MagicLinkFormValues>({
    resolver: zodResolver(magicLinkFormSchema),
    defaultValues: { email: '' },
  });

  // `?error=` → toast (once per mount, even under StrictMode double-effects).
  useEffect(() => {
    if (error === null || toastFired.current) return;
    const message = ERROR_TOASTS[error];
    if (message !== undefined) {
      toastFired.current = true;
      toast({ kind: 'warn', title: 'Sign-in', message });
    }
  }, [error]);

  const onSubmit = handleSubmit(async (values) => {
    const email = values.email.trim();
    setCaptchaEmail(email);
    const sent = await magic.request(email, {
      website: honeypotRef.current?.value ?? '',
    });
    if (sent) setSentEmail(email);
  });

  /** Turnstile solved → re-submit the parked email with the token. */
  const resolveCaptcha = async (token: string) => {
    const sent = await magic.request(captchaEmail, {
      website: honeypotRef.current?.value ?? '',
      captchaToken: token,
    });
    if (sent) setSentEmail(captchaEmail);
  };

  const submitting = isSubmitting || magic.phase === 'submitting';

  return (
    <main className="vv-auth-card" id="vvLoginCard" aria-labelledby="vvLoginTitle">
      <header className="vv-auth-head">
        <span className="vv-brand">
          <span className="vv-brand-mark" aria-hidden="true">
            {/* The operator's static brand SVG, same source as the marketing
        header ; `next/image` is not used for it there either. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.svg" alt="" />
          </span>
          <span className="vv-brand-name">VUNVAULT</span>
        </span>
        <h1 className="vv-auth-title" id="vvLoginTitle">
          Welcome back
        </h1>
        <p className="vv-auth-sub">Sign in to access your security console.</p>
      </header>

      <OAuthButtons next={next ?? '/'} />

      <div className="vv-divider" role="separator" aria-label="or">
        <span>OR</span>
      </div>

      {magic.phase === 'captcha' ? (
        <div className="vv-captcha" id="vvCaptchaChallenge" aria-labelledby="vvCaptchaTitle">
          <span className="vv-otp-icon" aria-hidden="true">
            <ShieldCheck size={26} />
          </span>
          <h2 className="vv-auth-title" id="vvCaptchaTitle">
            One more step
          </h2>
          <p className="vv-auth-sub">
            We have seen unusually many sign-in requests from your network. Please confirm you are
            human to continue.
          </p>
          <TurnstileWidget
            onVerify={(token) => void resolveCaptcha(token)}
            onError={() => setCaptchaFailed(true)}
          />
          {captchaFailed ? (
            <p className="vv-error vv-error--center" id="vvCaptchaError" role="alert">
              Human verification is unavailable. Please try again later.
            </p>
          ) : null}
          <button
            type="button"
            className="vv-back"
            id="vvCaptchaCancel"
            onClick={() => {
              setCaptchaFailed(false);
              magic.reset();
            }}
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Back
          </button>
        </div>
      ) : magic.phase === 'sent' ? (
        <div className="vv-sent" id="vvMagicLinkSent" role="status" aria-live="polite">
          <span className="vv-otp-icon" aria-hidden="true">
            <MailCheck size={26} />
          </span>
          <h2 className="vv-auth-title" id="vvSentTitle">
            Check your email
          </h2>
          <p className="vv-auth-sub">
            We sent a sign-in link to <strong>{sentEmail}</strong>. It expires in 15 minutes and can
            only be used once.
          </p>
          {magic.error !== null ? (
            <p className="vv-error vv-error--center" role="alert">
              {magic.error}
            </p>
          ) : null}
          <button
            type="button"
            className="vv-link-btn"
            id="vvResendLink"
            disabled={submitting}
            onClick={() => void magic.request(sentEmail)}
          >
            Resend link
          </button>
          <button type="button" className="vv-back" id="vvUseDifferentEmail" onClick={magic.reset}>
            <ArrowLeft size={14} aria-hidden="true" />
            Use a different email
          </button>
        </div>
      ) : (
        <form className="vv-form" id="vvLoginForm" autoComplete="on" onSubmit={onSubmit} noValidate>
          {/* Honeypot (Phase 4): off-screen, aria-hidden, tab-skipped — a bot
              fills it, a human never sees it, the server silently drops it. */}
          <div className="vv-honeypot" aria-hidden="true">
            <label htmlFor="vvWebsite">Website</label>
            <input
              id="vvWebsite"
              name="website"
              ref={honeypotRef}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>
          <div className="vv-field">
            <label className="vv-label" htmlFor="vvEmail">
              Email address
            </label>
            <div className="vv-input-wrap">
              <span className="vv-input-icon" aria-hidden="true">
                <Mail size={16} />
              </span>
              <input
                className={cn('vv-input', errors.email !== undefined && 'is-invalid')}
                id="vvEmail"
                type="email"
                inputMode="email"
                autoComplete="username"
                placeholder="you@company.com"
                aria-describedby="vvEmailError"
                aria-invalid={errors.email !== undefined}
                {...register('email')}
              />
            </div>
            <p className="vv-error" id="vvEmailError" role="alert" aria-live="polite">
              {errors.email?.message}
            </p>
          </div>

          {magic.error !== null ? (
            <p className="vv-error vv-error--center" role="alert">
              {magic.error}
            </p>
          ) : null}

          <button
            type="submit"
            className={cn('vv-submit', submitting && 'is-loading')}
            id="vvSubmitBtn"
            disabled={submitting}
            aria-busy={submitting}
          >
            <span className="vv-submit-label">Send Sign-In Link</span>
            <span className="vv-spinner" aria-hidden="true" />
          </button>
        </form>
      )}

      <p className="vv-signup">
        Don’t have an account?
        <Link href="/signup" className="vv-signup-link">
          Sign Up
        </Link>
      </p>

      <p className="vv-legal">
        <ShieldCheck size={12} aria-hidden="true" />
        Secured with 256-bit TLS · Zero-knowledge credential handling
      </p>
    </main>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { queryKeys } from '@vunvault/lib';
import { cn, isApiError } from '@vunvault/lib';
import { toast } from '@vunvault/ui';
import { homeFor } from '../../../../lib/permissions';
import { OAuthButtons } from '../../_components/oauth-buttons';
import { useLogin } from '../_hooks/use-login';
import { useMfaDialog } from '../_store/mfa-dialog-store';
import '../../_styles/auth.css';

/**
 * Login card (Task 59).
 *
 * RHF + Zod (never `useState` for values). The form schema carries the
 * planner's verbatim validation messages; the password minimum follows the
 * API contract (8), not the prototype's 6. On success the session cache is
 * seeded (`setQueryData`) and the router replaces to the sanitised `next` or
 * `homeFor(role)`; an `mfaRequired` response hands off to the MFA dialog
 * store (Task 60 renders it). 401/429 toast the planner copy — the 401 text
 * never reveals which credential was wrong.
 *
 * The prototype's `role="dialog" aria-modal="true"` is intentionally NOT
 * reproduced: as a full page the card is `<main aria-labelledby>`, per the
 * planner's note. The eye button toggles type + `aria-pressed` + label.
 */

const loginFormSchema = z.object({
  email: z.string().min(1, 'Email address is required.').email('Enter a valid email address.'),
  password: z
    .string()
    .min(1, 'Password is required.')
    .min(8, 'Password must be at least 8 characters.'),
  remember: z.boolean().optional(),
});

type LoginFormValues = z.input<typeof loginFormSchema>;

/** `?error=` codes → verbatim toast messages. */
const ERROR_TOASTS: Record<string, string> = {
  oauth_state: 'OAuth sign-in was cancelled or expired. Please try again.',
  oauth_denied: 'OAuth sign-in was cancelled or expired. Please try again.',
  oauth_email_unverified: 'Your provider account has no verified email address.',
  oauth_not_allowed: 'Staff accounts must sign in with email and password.',
  oauth_email_in_use: 'An account with this email already exists. Sign in with your password.',
  mfa_required: 'Multi-factor authentication is required for this account.',
};

export interface LoginCardProps {
  /** Sanitised by the route (`safeNextPath`); `null` → `homeFor(role)`. */
  next: string | null;
  /** Raw `?error=` code, toasted once on mount. */
  error: string | null;
  /** `?mfa=1` — an OAuth return that still needs a second factor. */
  mfaRequested: boolean;
}

export function LoginCard({ next, error, mfaRequested }: LoginCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const login = useLogin();
  const mfa = useMfaDialog();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const toastFired = useRef(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: '', password: '', remember: false },
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

  // `?mfa=1` (OAuth return): open the dialog immediately. The API exposes no
  // method-list endpoint, so the catalogue pins ["totp", "webauthn"] — an
  // unavailable method simply fails with `mfa_failed`.
  useEffect(() => {
    if (!mfaRequested) return;
    mfa.open({ email: '', methods: ['totp', 'webauthn'], next: next ?? '/' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once on mount
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    try {
      const response = await login.mutateAsync({
        email: values.email,
        password: values.password,
        remember: values.remember,
      });
      if (response.mfaRequired) {
        mfa.open({
          email: values.email,
          methods: response.mfaMethods,
          next: next ?? '/',
        });
        return;
      }
      if (response.user === null) {
        toast({ kind: 'crit', title: 'Sign-in failed', message: 'Incorrect email or password.' });
        return;
      }
      queryClient.setQueryData(queryKeys.session(), response.user);
      router.replace(next ?? homeFor(response.user.role));
    } catch (submitError) {
      if (isApiError(submitError) && submitError.status === 429) {
        toast({
          kind: 'warn',
          title: 'Too many attempts',
          message: 'Please wait a few minutes before trying again.',
        });
      } else if (isApiError(submitError) && submitError.status === 401) {
        toast({ kind: 'crit', title: 'Sign-in failed', message: 'Incorrect email or password.' });
      } else if (isApiError(submitError)) {
        toast({
          kind: 'crit',
          title: 'Sign-in failed',
          message: submitError.message ?? 'Incorrect email or password.',
        });
      } else {
        toast({ kind: 'crit', title: 'Sign-in failed', message: 'Incorrect email or password.' });
      }
    }
  });

  return (
    <main className="vv-auth-card" id="vvLoginCard" aria-labelledby="vvLoginTitle">
      <header className="vv-auth-head">
        <span className="vv-brand">
          <span className="vv-brand-mark" aria-hidden="true">
            {/* The operator's static brand SVG, same source as the marketing
                header (Task 44); `next/image` is not used for it there either. */}
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

      <form className="vv-form" id="vvLoginForm" autoComplete="on" onSubmit={onSubmit} noValidate>
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

        <div className="vv-field">
          <div className="vv-field-row">
            <label className="vv-label" htmlFor="vvPassword">
              Password
            </label>
            <Link className="vv-link" href="/forgot-password">
              Forgot Password?
            </Link>
          </div>
          <div className="vv-input-wrap">
            <span className="vv-input-icon" aria-hidden="true">
              <Lock size={16} />
            </span>
            <input
              className={cn('vv-input vv-input--pw', errors.password !== undefined && 'is-invalid')}
              id="vvPassword"
              type={passwordVisible ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              aria-describedby="vvPasswordError"
              aria-invalid={errors.password !== undefined}
              {...register('password')}
            />
            <button
              type="button"
              className={cn('vv-eye', passwordVisible && 'is-visible')}
              id="vvTogglePw"
              aria-label={passwordVisible ? 'Hide password' : 'Show password'}
              aria-pressed={passwordVisible}
              aria-controls="vvPassword"
              onClick={() => setPasswordVisible((visible) => !visible)}
            >
              <Eye className="vv-eye-on" size={17} aria-hidden="true" />
              <EyeOff className="vv-eye-off" size={17} aria-hidden="true" />
            </button>
          </div>
          <p className="vv-error" id="vvPasswordError" role="alert" aria-live="polite">
            {errors.password?.message}
          </p>
        </div>

        <label className="vv-checkbox">
          <input type="checkbox" id="vvRemember" {...register('remember')} />
          <span className="vv-checkmark" aria-hidden="true">
            <Check size={11} />
          </span>
          <span className="vv-checkbox-text">Keep me signed in on this device</span>
        </label>

        <button
          type="submit"
          className={cn('vv-submit', isSubmitting && 'is-loading')}
          id="vvSubmitBtn"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          <span className="vv-submit-label">Sign In</span>
          <span className="vv-spinner" aria-hidden="true" />
        </button>
      </form>

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

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { E164_PATTERN, PASSWORD_RULE_TESTS, type SignupBody } from '@vunvault/contracts';
import { cn, isApiError } from '@vunvault/lib';
import { toast } from '@vunvault/ui';
import { OAuthButtons } from '../../_components/oauth-buttons';
import { useSignup, normalizePhone } from '../_hooks/use-signup';
import { useSignupDialog } from '../_store/signup-store';
import { PasswordStrength } from './password-strength';
import '../../_styles/signup.css';

/**
 * Signup card (Task 61) — the details form of the verified three-step flow.
 *
 * RHF + Zod (never `useState` for values). The form schema carries the
 * planner's verbatim validation messages; the password rule follows the API
 * policy (12+ chars, upper, lower, digit, symbol — `PASSWORD_RULE_TESTS` from
 * the contracts), and `Other` maps to the 2-letter `XX` the contract's
 * `country: string(2)` requires. On `202` the response's `{ email }` plus the
 * form's `fullName` are parked in the signup store, which opens Task 62's
 * verification dialog; `409 email_taken` / `422 breached_password` become
 * field errors, `429` the planner's rate-limit toast. A failed client-side
 * validation toasts `Check your details` and RHF focuses the first invalid
 * field (`shouldFocusError` default).
 *
 * The prototype's `role="dialog" aria-modal="true"` is intentionally NOT
 * reproduced (Task 59 planner note for this card family): as a full page the
 * card is `<main aria-labelledby>`. The real dialog is Task 62's.
 *
 * Planner decision: the radio group defaults to `Individual` — the spec pins
 * no required-message for `accountType`, so the group always carries a value
 * (the contract enum has no empty member).
 */

/** Verbatim option list (order fixed by the spec); `Other` → `XX`. */
export const SIGNUP_COUNTRIES = [
  { code: 'KE', label: 'Kenya' },
  { code: 'UG', label: 'Uganda' },
  { code: 'TZ', label: 'Tanzania' },
  { code: 'RW', label: 'Rwanda' },
  { code: 'NG', label: 'Nigeria' },
  { code: 'GH', label: 'Ghana' },
  { code: 'ZA', label: 'South Africa' },
  { code: 'EG', label: 'Egypt' },
  { code: 'ET', label: 'Ethiopia' },
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'CA', label: 'Canada' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'IN', label: 'India' },
  { code: 'AE', label: 'United Arab Emirates' },
  { code: 'AU', label: 'Australia' },
  { code: 'XX', label: 'Other' },
] as const;

const PASSWORD_MESSAGE =
  'Password must be at least 12 characters and include upper and lower case letters, a number and a symbol.';

function satisfiesPasswordRules(password: string): boolean {
  return Object.values(PASSWORD_RULE_TESTS).every((test) => test(password));
}

const signupFormSchema = z
  .object({
    fullName: z.string().min(2, 'Please enter your full name.'),
    phone: z
      .string()
      .optional()
      .refine(
        (value) => value === undefined || value === '' || E164_PATTERN.test(normalizePhone(value)),
        'Enter a valid phone number.',
      ),
    country: z.string().min(1, 'Please select your country.'),
    accountType: z.enum(['individual', 'company']),
    email: z.string().min(1, 'Enter a valid email address.').email('Enter a valid email address.'),
    password: z.string().refine(satisfiesPasswordRules, PASSWORD_MESSAGE),
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });

type SignupFormValues = z.input<typeof signupFormSchema>;

export function SignupCard() {
  const signup = useSignup();
  const dialog = useSignupDialog();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      country: '',
      accountType: 'individual',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const passwordValue = watch('password');

  const onSubmit = handleSubmit(
    async (values) => {
      const phone = normalizePhone(values.phone ?? '');
      try {
        const data = await signup.mutateAsync({
          fullName: values.fullName,
          email: values.email,
          phone: phone === '' ? undefined : phone,
          country: values.country,
          accountType: values.accountType,
          password: values.password,
          confirmPassword: values.confirmPassword,
        } satisfies SignupBody);
        // 202: park the pending account and hand off to Task 62's dialog.
        dialog.open({ email: data.email, fullName: values.fullName });
      } catch (submitError) {
        if (isApiError(submitError) && submitError.status === 409) {
          setError('email', { message: 'An account with this email already exists.' });
        } else if (isApiError(submitError) && submitError.status === 422) {
          setError('password', {
            message: 'This password has appeared in a data breach. Choose a different one.',
          });
        } else if (isApiError(submitError) && submitError.status === 429) {
          toast({
            kind: 'warn',
            title: 'Too many attempts',
            message: 'Please wait a few minutes before trying again.',
          });
        } else {
          // Authored fallback (the spec pins copy for 409/422/429 only): any
          // other API/network failure toasts once, generically.
          toast({ kind: 'crit', title: 'Sign-up failed', message: 'Please try again.' });
        }
      }
    },
    () => {
      // RHF has already focused the first invalid field (shouldFocusError).
      toast({
        kind: 'warn',
        title: 'Check your details',
        message: 'Some fields need your attention before we can continue.',
      });
    },
  );

  return (
    <main className="vv-signup-card" id="vvSignupCard" aria-labelledby="signupTitle">
      <header className="vv-signup-head">
        <div className="vv-signup-brand">
          <span className="vv-signup-brand-tile">
            {/* The operator's static brand SVG, same source as the login card
                (Task 59) and the marketing header (Task 44). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.svg" alt="" />
          </span>
          <span className="vv-signup-brand-name">VUNVAULT</span>
        </div>
        <h1 className="vv-signup-title" id="signupTitle">
          Create your account
        </h1>
        <p className="vv-signup-sub">Join the platform that finds the cracks before they do.</p>
      </header>

      <OAuthButtons next="/onboarding" />

      <div className="vv-signup-divider" role="separator" aria-label="or">
        or
      </div>

      <form
        className="vv-signup-form"
        id="signupForm"
        autoComplete="on"
        onSubmit={onSubmit}
        noValidate
      >
        <div className="vv-signup-field">
          <label className="vv-signup-label" htmlFor="fullName">
            Full name
          </label>
          <input
            className={cn('vv-signup-input', errors.fullName !== undefined && 'is-invalid')}
            type="text"
            id="fullName"
            placeholder="Jane Wanjiru"
            autoComplete="name"
            aria-invalid={errors.fullName !== undefined}
            aria-describedby="fullNameError"
            {...register('fullName')}
          />
          <span
            className={cn('vv-signup-err', errors.fullName !== undefined && 'is-visible')}
            id="fullNameError"
            role="alert"
            aria-live="polite"
          >
            {errors.fullName?.message}
          </span>
        </div>

        <div className="vv-signup-field-row">
          <div className="vv-signup-field">
            <label className="vv-signup-label" htmlFor="phone">
              Phone number
            </label>
            <input
              className={cn('vv-signup-input', errors.phone !== undefined && 'is-invalid')}
              type="tel"
              id="phone"
              placeholder="+254 705 998 032"
              autoComplete="tel"
              aria-invalid={errors.phone !== undefined}
              aria-describedby="phoneError"
              {...register('phone')}
            />
            <span
              className={cn('vv-signup-err', errors.phone !== undefined && 'is-visible')}
              id="phoneError"
              role="alert"
              aria-live="polite"
            >
              {errors.phone?.message}
            </span>
          </div>
          <div className="vv-signup-field">
            <label className="vv-signup-label" htmlFor="country">
              Country
            </label>
            <select
              className={cn('vv-signup-input', errors.country !== undefined && 'is-invalid')}
              id="country"
              required
              aria-invalid={errors.country !== undefined}
              aria-describedby="countryError"
              {...register('country')}
            >
              <option value="" disabled>
                Select country…
              </option>
              {SIGNUP_COUNTRIES.map(({ code, label }) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
            <span
              className={cn('vv-signup-err', errors.country !== undefined && 'is-visible')}
              id="countryError"
              role="alert"
              aria-live="polite"
            >
              {errors.country?.message}
            </span>
          </div>
        </div>

        <fieldset className="vv-signup-field">
          <legend className="vv-signup-label">Account type</legend>
          <div className="vv-signup-radio-row">
            <label className="vv-signup-radio-card">
              <input type="radio" value="individual" {...register('accountType')} />
              <span className="vv-signup-radio-body">
                <span className="vv-signup-radio-dot" aria-hidden="true" />
                <span className="vv-signup-radio-text">
                  <span className="vv-signup-radio-title">Individual</span>
                  <span className="vv-signup-radio-sub">Personal account</span>
                </span>
              </span>
            </label>
            <label className="vv-signup-radio-card">
              <input type="radio" value="company" {...register('accountType')} />
              <span className="vv-signup-radio-body">
                <span className="vv-signup-radio-dot" aria-hidden="true" />
                <span className="vv-signup-radio-text">
                  <span className="vv-signup-radio-title">Company</span>
                  <span className="vv-signup-radio-sub">Team / organisation</span>
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        <div className="vv-signup-field">
          <label className="vv-signup-label" htmlFor="email">
            Email address
          </label>
          <input
            className={cn('vv-signup-input', errors.email !== undefined && 'is-invalid')}
            type="email"
            id="email"
            inputMode="email"
            placeholder="you@company.com"
            autoComplete="email"
            aria-invalid={errors.email !== undefined}
            aria-describedby="emailError"
            {...register('email')}
          />
          <span
            className={cn('vv-signup-err', errors.email !== undefined && 'is-visible')}
            id="emailError"
            role="alert"
            aria-live="polite"
          >
            {errors.email?.message}
          </span>
        </div>

        <div className="vv-signup-field">
          <label className="vv-signup-label" htmlFor="password">
            Password
          </label>
          <div className="vv-signup-pw-wrap">
            <input
              className={cn('vv-signup-input', errors.password !== undefined && 'is-invalid')}
              type={passwordVisible ? 'text' : 'password'}
              id="password"
              placeholder="At least 12 characters"
              autoComplete="new-password"
              aria-invalid={errors.password !== undefined}
              aria-describedby="passwordError"
              {...register('password')}
            />
            <button
              type="button"
              className={cn('vv-signup-eye', passwordVisible && 'is-visible')}
              aria-label={passwordVisible ? 'Hide password' : 'Show password'}
              aria-pressed={passwordVisible}
              aria-controls="password"
              onClick={() => setPasswordVisible((visible) => !visible)}
            >
              <Eye className="vv-signup-eye-on" size={17} aria-hidden="true" />
              <EyeOff className="vv-signup-eye-off" size={17} aria-hidden="true" />
            </button>
          </div>
          <PasswordStrength password={passwordValue ?? ''} />
          <span
            className={cn('vv-signup-err', errors.password !== undefined && 'is-visible')}
            id="passwordError"
            role="alert"
            aria-live="polite"
          >
            {errors.password?.message}
          </span>
        </div>

        <div className="vv-signup-field">
          <label className="vv-signup-label" htmlFor="confirmPassword">
            Confirm password
          </label>
          <div className="vv-signup-pw-wrap">
            <input
              className={cn(
                'vv-signup-input',
                errors.confirmPassword !== undefined && 'is-invalid',
              )}
              type={confirmVisible ? 'text' : 'password'}
              id="confirmPassword"
              placeholder="Re-enter your password"
              autoComplete="new-password"
              aria-invalid={errors.confirmPassword !== undefined}
              aria-describedby="confirmPasswordError"
              {...register('confirmPassword')}
            />
            <button
              type="button"
              className={cn('vv-signup-eye', confirmVisible && 'is-visible')}
              aria-label={confirmVisible ? 'Hide password' : 'Show password'}
              aria-pressed={confirmVisible}
              aria-controls="confirmPassword"
              onClick={() => setConfirmVisible((visible) => !visible)}
            >
              <Eye className="vv-signup-eye-on" size={17} aria-hidden="true" />
              <EyeOff className="vv-signup-eye-off" size={17} aria-hidden="true" />
            </button>
          </div>
          <span
            className={cn('vv-signup-err', errors.confirmPassword !== undefined && 'is-visible')}
            id="confirmPasswordError"
            role="alert"
            aria-live="polite"
          >
            {errors.confirmPassword?.message}
          </span>
        </div>

        <button
          type="submit"
          className={cn('vv-signup-submit', isSubmitting && 'is-loading')}
          id="signupBtn"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          <span>Sign Up</span>
          <ArrowRight aria-hidden="true" />
          <span className="vv-spinner" aria-hidden="true" />
        </button>

        <p className="vv-signup-legal">
          By creating an account you agree to our <a href="/terms">Terms of Service</a> and{' '}
          <a href="/privacy">Privacy Policy</a>.
        </p>
      </form>

      <div className="vv-signup-foot">
        Already have an account? <Link href="/login">Log in</Link>
      </div>

      <div className="vv-signup-secure">
        <ShieldCheck size={12} aria-hidden="true" />
        256-bit encrypted · 2FA protected
      </div>
    </main>
  );
}

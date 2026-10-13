'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail } from 'lucide-react';
import { cn, isApiError } from '@vunvault/lib';
import { AuthCard } from '../../_components/auth-card';
import { useForgotPassword } from '../../_hooks/use-auth-misc';

/**
 * Forgot-password form (Task 63) — enumeration-safe by design: whatever the
 * API answers (202 or any HTTP error), the card ALWAYS ends on the
 * `Check your inbox` state, because a differing outcome would reveal whether
 * the address exists. Only a network failure (no HTTP response at all) leaves
 * the form standing so the visitor can retry — the planner's carve-out.
 *
 * Email validation messages are the login card's (spec: "same email
 * validation messages as login").
 */

const forgotFormSchema = z.object({
  email: z.string().min(1, 'Email address is required.').email('Enter a valid email address.'),
});

type ForgotFormValues = z.input<typeof forgotFormSchema>;

export function ForgotForm() {
  const forgot = useForgotPassword();
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotFormSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await forgot.mutateAsync({ email: values.email });
      setSent(true);
    } catch (submitError) {
      // ANY HTTP answer still ends on the inbox state; only a network
      // failure keeps the form (documented planner carve-out).
      if (isApiError(submitError)) setSent(true);
    }
  });

  if (sent) {
    return (
      <AuthCard
        title="Check your inbox"
        sub="If an account exists for that address, a reset link is on its way. It expires in 30 minutes."
      >
        <Link className="vv-submit" href="/login">
          Back to sign in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      sub="Enter your account email and we will send you a reset link."
    >
      <form className="vv-form" id="vvForgotForm" autoComplete="on" onSubmit={onSubmit} noValidate>
        <div className="vv-field">
          <label className="vv-label" htmlFor="vvForgotEmail">
            Email address
          </label>
          <div className="vv-input-wrap">
            <span className="vv-input-icon" aria-hidden="true">
              <Mail size={16} />
            </span>
            <input
              className={cn('vv-input', errors.email !== undefined && 'is-invalid')}
              id="vvForgotEmail"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@company.com"
              aria-describedby="vvForgotEmailError"
              aria-invalid={errors.email !== undefined}
              {...register('email')}
            />
          </div>
          <p className="vv-error" id="vvForgotEmailError" role="alert" aria-live="polite">
            {errors.email?.message}
          </p>
        </div>

        <button
          type="submit"
          className={cn('vv-submit', isSubmitting && 'is-loading')}
          id="vvForgotSubmit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          <span className="vv-submit-label">Send reset link</span>
          <span className="vv-spinner" aria-hidden="true" />
        </button>
      </form>
    </AuthCard>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { PASSWORD_RULE_TESTS, STAFF_PASSWORD_MIN_LENGTH } from '@vunvault/contracts';
import { cn, isApiError, queryKeys } from '@vunvault/lib';
import { toast, Skeleton } from '@vunvault/ui';
import { AuthCard } from '../../_components/auth-card';
import { useAcceptInvitation, useInvitationPreview } from '../../_hooks/use-auth-misc';
import { PasswordStrength } from '../../signup/_components/password-strength';

/**
 * Accept-invite form — the staff invitation landing. The public
 * preview (`GET /invitations/:token`) drives the states: loading → Skeleton,
 * 404 (unknown / expired / already used — the API answers 404 for all three)
 * → `Invitation not valid`, found → the password form.
 *
 * The password follows the staff minimum (14, `STAFF_PASSWORD_MIN_LENGTH`)
 * with the contract's `NewPassword` rule messages and `AcceptInvitationBody`'s
 * confirm message — nothing is authored here. Success opens the aal1 session
 * (seeded into the query cache like every other login path) and lands on the
 * `Account activated` state whose `Set up MFA` button points at
 * `/admin/profile#security` — the enrolment surface Part 4 ships (until then
 * the an earlier iteration guard bounces unenrolled staff back to the login, which is the
 * documented interim behaviour).
 *
 * Any preview failure other than a still-running query shows the invalid
 * state (a page that cannot load the invitation cannot proceed either).
 */

const acceptFormSchema = z
  .object({
    password: z
      .string()
      .min(STAFF_PASSWORD_MIN_LENGTH)
      .refine(PASSWORD_RULE_TESTS.upper, 'One uppercase letter')
      .refine(PASSWORD_RULE_TESTS.lower, 'One lowercase letter')
      .refine(PASSWORD_RULE_TESTS.digit, 'One number')
      .refine(PASSWORD_RULE_TESTS.symbol, 'One symbol (!@#$…)'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'The passwords do not match',
  });

type AcceptFormValues = z.input<typeof acceptFormSchema>;

export interface AcceptInviteFormProps {
  /** Raw `?token=` — `null` when absent (→ the invalid state). */
  token: string | null;
}

export function AcceptInviteForm({ token }: AcceptInviteFormProps) {
  const queryClient = useQueryClient();
  const preview = useInvitationPreview(token);
  const accept = useAcceptInvitation(token ?? '');
  const [activated, setActivated] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AcceptFormValues>({
    resolver: zodResolver(acceptFormSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const passwordValue = watch('password');

  const onSubmit = handleSubmit(async (values) => {
    try {
      const response = await accept.mutateAsync({
        password: values.password,
        confirmPassword: values.confirmPassword,
      });
      // The API set the aal1 session cookies; seed the client cache to match.
      queryClient.setQueryData(queryKeys.session(), response.data);
      setActivated(true);
    } catch (submitError) {
      if (isApiError(submitError) && submitError.status === 422) {
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
        // Authored fallback (the spec pins copy for 422 only), following the
        // login card's `Sign-in failed` family pattern.
        toast({ kind: 'crit', title: 'Activation failed', message: 'Please try again.' });
      }
    }
  });

  if (token === null || preview.isError) {
    return (
      <AuthCard
        title="Invitation not valid"
        sub="This invitation link is invalid or has expired. Ask an administrator to send a new one."
      />
    );
  }

  if (preview.isLoading || preview.data === undefined) {
    return (
      <AuthCard title="Join VUNVAULT">
        <div className="vv-form" id="vvInviteSkeleton" aria-busy="true">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-12 w-full rounded-full" />
        </div>
      </AuthCard>
    );
  }

  if (activated) {
    return (
      <AuthCard
        title="Account activated"
        sub="Multi-factor authentication is mandatory for staff accounts. Set it up now to continue."
      >
        <Link className="vv-submit" href="/admin/profile#security">
          Set up MFA
        </Link>
      </AuthCard>
    );
  }

  const invitation = preview.data;

  return (
    <AuthCard
      title="Join VUNVAULT"
      sub={
        <>
          {"You've been invited as "}
          <strong>{invitation.roleLabel}</strong>
          {' · '}
          {invitation.teamLabel}.
        </>
      }
    >
      <form className="vv-form" id="vvAcceptForm" autoComplete="off" onSubmit={onSubmit} noValidate>
        <div className="vv-field">
          <label className="vv-label" htmlFor="vvWorkEmail">
            Work email
          </label>
          <div className="vv-input-wrap">
            <span className="vv-input-icon" aria-hidden="true">
              <Mail size={16} />
            </span>
            <input
              className="vv-input"
              id="vvWorkEmail"
              type="email"
              value={invitation.email}
              readOnly
            />
          </div>
        </div>

        <div className="vv-field">
          <label className="vv-label" htmlFor="vvInvitePassword">
            Password
          </label>
          <div className="vv-input-wrap">
            <span className="vv-input-icon" aria-hidden="true">
              <Lock size={16} />
            </span>
            <input
              className={cn('vv-input vv-input--pw', errors.password !== undefined && 'is-invalid')}
              id="vvInvitePassword"
              type={passwordVisible ? 'text' : 'password'}
              autoComplete="new-password"
              aria-describedby="vvInvitePasswordError"
              aria-invalid={errors.password !== undefined}
              {...register('password')}
            />
            <button
              type="button"
              className={cn('vv-eye', passwordVisible && 'is-visible')}
              aria-label={passwordVisible ? 'Hide password' : 'Show password'}
              aria-pressed={passwordVisible}
              aria-controls="vvInvitePassword"
              onClick={() => setPasswordVisible((visible) => !visible)}
            >
              <Eye className="vv-eye-on" size={17} aria-hidden="true" />
              <EyeOff className="vv-eye-off" size={17} aria-hidden="true" />
            </button>
          </div>
          <PasswordStrength password={passwordValue ?? ''} />
          <p className="vv-error" id="vvInvitePasswordError" role="alert" aria-live="polite">
            {errors.password?.message}
          </p>
        </div>

        <div className="vv-field">
          <label className="vv-label" htmlFor="vvInviteConfirmPassword">
            Confirm password
          </label>
          <div className="vv-input-wrap">
            <span className="vv-input-icon" aria-hidden="true">
              <Lock size={16} />
            </span>
            <input
              className={cn(
                'vv-input vv-input--pw',
                errors.confirmPassword !== undefined && 'is-invalid',
              )}
              id="vvInviteConfirmPassword"
              type={confirmVisible ? 'text' : 'password'}
              autoComplete="new-password"
              aria-describedby="vvInviteConfirmPasswordError"
              aria-invalid={errors.confirmPassword !== undefined}
              {...register('confirmPassword')}
            />
            <button
              type="button"
              className={cn('vv-eye', confirmVisible && 'is-visible')}
              aria-label={confirmVisible ? 'Hide password' : 'Show password'}
              aria-pressed={confirmVisible}
              aria-controls="vvInviteConfirmPassword"
              onClick={() => setConfirmVisible((visible) => !visible)}
            >
              <Eye className="vv-eye-on" size={17} aria-hidden="true" />
              <EyeOff className="vv-eye-off" size={17} aria-hidden="true" />
            </button>
          </div>
          <p className="vv-error" id="vvInviteConfirmPasswordError" role="alert" aria-live="polite">
            {errors.confirmPassword?.message}
          </p>
        </div>

        <button
          type="submit"
          className={cn('vv-submit', isSubmitting && 'is-loading')}
          id="vvAcceptSubmit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          <span className="vv-submit-label">Activate account</span>
          <span className="vv-spinner" aria-hidden="true" />
        </button>
      </form>
    </AuthCard>
  );
}

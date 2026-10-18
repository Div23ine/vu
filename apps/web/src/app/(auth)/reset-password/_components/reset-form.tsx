'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { ResetPasswordBody } from '@vunvault/contracts';
import { cn, isApiError } from '@vunvault/lib';
import { toast } from '@vunvault/ui';
import { AuthCard } from '../../_components/auth-card';
import { useResetPassword } from '../../_hooks/use-auth-misc';
import { PasswordStrength } from '../../signup/_components/password-strength';

/**
 * Reset-password form — RHF + the contract's `ResetPasswordBody`
 * (the spec's spec names the schema directly, so its messages are the
 * contract's: the `NewPassword` rule refines and `Both entries must match
 * exactly.` on the confirm field). The token is read from the URL once by the
 * route and lives in form state only — never stored anywhere else.
 *
 * States: `form` → `success` (`Password updated` + `Go to sign in`);
 * a missing `?token=`, or a `410 token_invalid`, swaps the card body for the
 * inline invalid-link alert with `Request a new link`; `422 breached_password`
 * is a field error on `newPassword`.
 */

type ResetFormValues = z.input<typeof ResetPasswordBody>;

type ResetPhase = 'form' | 'success' | 'invalid';

export interface ResetFormProps {
  /** Raw `?token=` — `null` when absent (→ the invalid-link state). */
  token: string | null;
}

export function ResetForm({ token }: ResetFormProps) {
  const reset = useResetPassword();
  const [phase, setPhase] = useState<ResetPhase>(token === null ? 'invalid' : 'form');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(ResetPasswordBody),
    defaultValues: { token: token ?? '', newPassword: '', confirmPassword: '' },
  });

  const newPasswordValue = watch('newPassword');

  const onSubmit = handleSubmit(async (values) => {
    try {
      await reset.mutateAsync(values);
      setPhase('success');
    } catch (submitError) {
      if (
        isApiError(submitError) &&
        (submitError.status === 410 || submitError.code === 'token_invalid')
      ) {
        setPhase('invalid');
      } else if (isApiError(submitError) && submitError.status === 422) {
        setError('newPassword', {
          message: 'This password has appeared in a data breach. Choose a different one.',
        });
      } else if (isApiError(submitError) && submitError.status === 429) {
        toast({
          kind: 'warn',
          title: 'Too many attempts',
          message: 'Please wait a few minutes before trying again.',
        });
      } else {
        // Authored fallback (the spec pins copy for 410/422 only), following
        // the login card's `Sign-in failed` family pattern.
        toast({ kind: 'crit', title: 'Password update failed', message: 'Please try again.' });
      }
    }
  });

  if (phase === 'invalid') {
    return (
      <AuthCard title="Choose a new password">
        <p className="vv-error vv-error--center" id="vvResetInvalid" role="alert">
          This reset link is invalid or has already been used.{' '}
          <Link className="vv-link" href="/forgot-password">
            Request a new link
          </Link>
        </p>
      </AuthCard>
    );
  }

  if (phase === 'success') {
    return (
      <AuthCard
        title="Password updated"
        sub="All other sessions were signed out. Sign in with your new password."
      >
        <Link className="vv-submit" href="/login">
          Go to sign in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      sub="Use at least 12 characters (14 for staff accounts) with upper and lower case letters, a number and a symbol."
    >
      <form className="vv-form" id="vvResetForm" autoComplete="off" onSubmit={onSubmit} noValidate>
        <div className="vv-field">
          <label className="vv-label" htmlFor="vvNewPassword">
            New password
          </label>
          <div className="vv-input-wrap">
            <span className="vv-input-icon" aria-hidden="true">
              <Lock size={16} />
            </span>
            <input
              className={cn(
                'vv-input vv-input--pw',
                errors.newPassword !== undefined && 'is-invalid',
              )}
              id="vvNewPassword"
              type={passwordVisible ? 'text' : 'password'}
              autoComplete="new-password"
              aria-describedby="vvNewPasswordError"
              aria-invalid={errors.newPassword !== undefined}
              {...register('newPassword')}
            />
            <button
              type="button"
              className={cn('vv-eye', passwordVisible && 'is-visible')}
              aria-label={passwordVisible ? 'Hide password' : 'Show password'}
              aria-pressed={passwordVisible}
              aria-controls="vvNewPassword"
              onClick={() => setPasswordVisible((visible) => !visible)}
            >
              <Eye className="vv-eye-on" size={17} aria-hidden="true" />
              <EyeOff className="vv-eye-off" size={17} aria-hidden="true" />
            </button>
          </div>
          <PasswordStrength password={newPasswordValue ?? ''} />
          <p className="vv-error" id="vvNewPasswordError" role="alert" aria-live="polite">
            {errors.newPassword?.message}
          </p>
        </div>

        <div className="vv-field">
          <label className="vv-label" htmlFor="vvConfirmNewPassword">
            Confirm new password
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
              id="vvConfirmNewPassword"
              type={confirmVisible ? 'text' : 'password'}
              autoComplete="new-password"
              aria-describedby="vvConfirmNewPasswordError"
              aria-invalid={errors.confirmPassword !== undefined}
              {...register('confirmPassword')}
            />
            <button
              type="button"
              className={cn('vv-eye', confirmVisible && 'is-visible')}
              aria-label={confirmVisible ? 'Hide password' : 'Show password'}
              aria-pressed={confirmVisible}
              aria-controls="vvConfirmNewPassword"
              onClick={() => setConfirmVisible((visible) => !visible)}
            >
              <Eye className="vv-eye-on" size={17} aria-hidden="true" />
              <EyeOff className="vv-eye-off" size={17} aria-hidden="true" />
            </button>
          </div>
          <p className="vv-error" id="vvConfirmNewPasswordError" role="alert" aria-live="polite">
            {errors.confirmPassword?.message}
          </p>
        </div>

        <button
          type="submit"
          className={cn('vv-submit', isSubmitting && 'is-loading')}
          id="vvResetSubmit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          <span className="vv-submit-label">Update password</span>
          <span className="vv-spinner" aria-hidden="true" />
        </button>
      </form>
    </AuthCard>
  );
}

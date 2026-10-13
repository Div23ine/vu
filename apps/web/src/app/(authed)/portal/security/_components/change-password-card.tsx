'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Eye, EyeOff, Lock } from 'lucide-react';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULES,
  PASSWORD_RULE_TESTS,
  STAFF_PASSWORD_MIN_LENGTH,
  passwordRuleResults,
  scorePassword,
} from '@vunvault/contracts';
import { cn, isApiError } from '@vunvault/lib';
import { toast } from '@vunvault/ui';
import { useSession } from '../../../../../lib/session';
import { PasswordStrength } from '../../../../(auth)/signup/_components/password-strength';
import { useChangePassword } from '../_hooks/use-security';

/**
 * Change-password card (Task 67) — RHF + Zod on the planner's field errors
 * (`Enter your current password`, `New password does not meet the
 * requirements`, `Passwords do not match`, `New password must differ from
 * current`), the live `PASSWORD_RULES` checklist (`is-met` + a visually hidden
 * met/not-met word), Task 61's shared `PasswordStrength` meter and the
 * prototype's per-score hint strings. Staff accounts enforce the 14-character
 * minimum client-side and show the helper line.
 *
 * The card subtitle stays EXACTLY as the markup has it (planner note): it
 * says VUNVAULT stores only a salted hash — Supabase Auth stores a salted
 * one-way hash.
 */

/** Verbatim per-score hints from the prototype script. */
const STRENGTH_HINTS = [
  'Use 12+ characters with mixed cases, numbers and symbols.',
  'Too easy to guess — add length and variety.',
  'Add uppercase letters, numbers and symbols.',
  'Almost there — a few more characters would help.',
  'Excellent. This password resists brute-force well.',
] as const;

export function ChangePasswordCard() {
  const { isStaff } = useSession();
  const change = useChangePassword();
  const [visible, setVisible] = useState({ current: false, next: false, confirm: false });

  const minLength = isStaff ? STAFF_PASSWORD_MIN_LENGTH : PASSWORD_MIN_LENGTH;

  const formSchema = useMemo(
    () =>
      z
        .object({
          currentPassword: z.string().min(1, 'Enter your current password'),
          newPassword: z
            .string()
            .refine(
              (value) =>
                value.length >= minLength &&
                PASSWORD_RULE_TESTS.upper(value) &&
                PASSWORD_RULE_TESTS.lower(value) &&
                PASSWORD_RULE_TESTS.digit(value) &&
                PASSWORD_RULE_TESTS.symbol(value),
              'New password does not meet the requirements',
            ),
          confirmPassword: z.string(),
        })
        .refine((values) => values.newPassword !== values.currentPassword, {
          path: ['newPassword'],
          message: 'New password must differ from current',
        })
        .refine((values) => values.newPassword === values.confirmPassword, {
          path: ['confirmPassword'],
          message: 'Passwords do not match',
        }),
    [minLength],
  );

  type FormValues = z.input<typeof formSchema>;

  const {
    register,
    handleSubmit,
    setError,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const newPassword = watch('newPassword') ?? '';
  const confirmPassword = watch('confirmPassword') ?? '';
  const ruleResults = passwordRuleResults(newPassword);
  const lengthMet = newPassword.length >= minLength;
  const score = scorePassword(newPassword).score;
  const hint = STRENGTH_HINTS[score] ?? STRENGTH_HINTS[0];
  const bothFilled = newPassword !== '' && confirmPassword !== '';
  const matches = newPassword === confirmPassword;

  const onSubmit = handleSubmit(async (values) => {
    try {
      await change.mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      });
      toast({
        kind: 'ok',
        title: 'Password updated successfully',
        message: 'All other sessions were signed out.',
      });
      reset();
    } catch (submitError) {
      if (isApiError(submitError) && submitError.status === 401) {
        setError('currentPassword', { message: 'Current password is incorrect.' });
      } else if (isApiError(submitError) && submitError.status === 422) {
        setError('newPassword', {
          message: 'This password has appeared in a data breach. Choose a different one.',
        });
      } else {
        // Authored fallback (the spec pins copy for 401/422 only).
        toast({ kind: 'crit', title: 'Password update failed', message: 'Please try again.' });
      }
    }
  });

  const toggle = (field: keyof typeof visible) =>
    setVisible((current) => ({ ...current, [field]: !current[field] }));

  return (
    <div className="vpm-card">
      <div className="vpm-card-head">
        <span className="vpm-card-icon" aria-hidden="true">
          <Lock size={20} />
        </span>
        <div>
          <h2 className="vpm-card-title">Change Password</h2>
          <p className="vpm-card-sub">
            Choose a strong, unique passphrase. VUNVAULT stores only a salted hash — we can never
            read your password.
          </p>
        </div>
      </div>

      <form className="vpm-form" id="vpm-password-form" onSubmit={onSubmit} noValidate>
        <div className="vpm-field">
          <label htmlFor="pw-current">Current Password</label>
          <div className="vpm-pw-wrap">
            <input
              id="pw-current"
              className={cn('vpm-input', errors.currentPassword !== undefined && 'is-invalid')}
              type={visible.current ? 'text' : 'password'}
              placeholder="Enter your current password"
              autoComplete="current-password"
              aria-invalid={errors.currentPassword !== undefined}
              aria-describedby="pw-current-error"
              {...register('currentPassword')}
            />
            <button
              type="button"
              className="vpm-pw-toggle"
              aria-label={visible.current ? 'Hide current password' : 'Show current password'}
              aria-pressed={visible.current}
              aria-controls="pw-current"
              onClick={() => toggle('current')}
            >
              {visible.current ? (
                <EyeOff size={16} aria-hidden="true" />
              ) : (
                <Eye size={16} aria-hidden="true" />
              )}
            </button>
          </div>
          {errors.currentPassword !== undefined ? (
            <span className="vpm-error" id="pw-current-error" role="alert">
              {errors.currentPassword.message}
            </span>
          ) : null}
        </div>

        <div className="vpm-field">
          <label htmlFor="pw-next">New Password</label>
          <div className="vpm-pw-wrap">
            <input
              id="pw-next"
              className={cn('vpm-input', errors.newPassword !== undefined && 'is-invalid')}
              type={visible.next ? 'text' : 'password'}
              autoComplete="new-password"
              aria-invalid={errors.newPassword !== undefined}
              aria-describedby="pw-next-error pw-next-hint"
              {...register('newPassword')}
            />
            <button
              type="button"
              className="vpm-pw-toggle"
              aria-label={visible.next ? 'Hide new password' : 'Show new password'}
              aria-pressed={visible.next}
              aria-controls="pw-next"
              onClick={() => toggle('next')}
            >
              {visible.next ? (
                <EyeOff size={16} aria-hidden="true" />
              ) : (
                <Eye size={16} aria-hidden="true" />
              )}
            </button>
          </div>
          <PasswordStrength password={newPassword} />
          <span className="vpm-hint" id="pw-next-hint">
            {hint}
          </span>
          {isStaff ? (
            <span className="vpm-hint">Staff accounts require at least 14 characters.</span>
          ) : null}
          <ul className="vpm-rules" aria-label="Password requirements">
            {PASSWORD_RULES.map((rule) => {
              const met = rule.id === 'len' ? lengthMet : ruleResults[rule.id];
              return (
                <li key={rule.id} className={cn('vpm-rule', met && 'is-met')}>
                  <span className="vpm-rule-dot" aria-hidden="true">
                    <Check size={9} />
                  </span>
                  {rule.label}
                  <span className="sr-only">{met ? 'met' : 'not met'}</span>
                </li>
              );
            })}
          </ul>
          {errors.newPassword !== undefined ? (
            <span className="vpm-error" id="pw-next-error" role="alert">
              {errors.newPassword.message}
            </span>
          ) : null}
        </div>

        <div className="vpm-field">
          <label htmlFor="pw-confirm">Confirm New Password</label>
          <div className="vpm-pw-wrap">
            <input
              id="pw-confirm"
              className={cn('vpm-input', errors.confirmPassword !== undefined && 'is-invalid')}
              type={visible.confirm ? 'text' : 'password'}
              autoComplete="new-password"
              aria-invalid={errors.confirmPassword !== undefined}
              aria-describedby="pw-confirm-error pw-confirm-match"
              {...register('confirmPassword')}
            />
            <button
              type="button"
              className="vpm-pw-toggle"
              aria-label={
                visible.confirm ? 'Hide confirm new password' : 'Show confirm new password'
              }
              aria-pressed={visible.confirm}
              aria-controls="pw-confirm"
              onClick={() => toggle('confirm')}
            >
              {visible.confirm ? (
                <EyeOff size={16} aria-hidden="true" />
              ) : (
                <Eye size={16} aria-hidden="true" />
              )}
            </button>
          </div>
          {bothFilled ? (
            <span
              className={cn('vpm-match', matches ? 'is-ok' : 'is-bad')}
              id="pw-confirm-match"
              role="status"
            >
              {matches ? '✓ Passwords match.' : 'Passwords do not match yet.'}
            </span>
          ) : (
            <span className="vpm-hint" id="pw-confirm-match">
              Both entries must match exactly.
            </span>
          )}
          {errors.confirmPassword !== undefined ? (
            <span className="vpm-error" id="pw-confirm-error" role="alert">
              {errors.confirmPassword.message}
            </span>
          ) : null}
        </div>

        <div className="vpm-modal-actions">
          <button
            type="button"
            className="vpm-btn vpm-btn--ghost"
            id="vpm-pw-reset"
            onClick={() => reset()}
          >
            Clear Fields
          </button>
          <button
            type="submit"
            className="vpm-btn vpm-btn--primary"
            id="vpm-pw-submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <span className="vpm-btn-spinner" aria-hidden="true" />
            ) : (
              <Check size={15} aria-hidden="true" />
            )}
            <span>Update Password</span>
          </button>
        </div>
      </form>
    </div>
  );
}

'use client';

import { cn } from '@vunvault/lib';
import type { UseFormReturn } from 'react-hook-form';
import type { OnboardingFormValues } from './onboarding-wizard';

/**
 * Step 1 — Personal & contact (Task 64). Fields register straight into the
 * ONE wizard form (`step1.*` paths of `OnboardingFormValues`); validation
 * messages come from the contract schema (the planner's verbatim DOB and
 * email-match messages live there). Placeholder and helper text are verbatim
 * from the markup; the phone field is optional per the contract even though
 * the prototype marks every label with its asterisk.
 */

export interface StepPanelProps {
  form: UseFormReturn<OnboardingFormValues>;
}

interface FieldErrorProps {
  message?: string;
  id: string;
}

function FieldError({ message, id }: FieldErrorProps) {
  return (
    <span
      className={cn('ob-err', message !== undefined && 'is-visible')}
      id={id}
      role="alert"
      aria-live="polite"
    >
      {message}
    </span>
  );
}

export function StepPersonal({ form }: StepPanelProps) {
  const {
    register,
    formState: { errors },
  } = form;
  const step1 = errors.step1;

  return (
    <section className="ob-panel" data-step="1" aria-labelledby="obStep1Title">
      <div className="ob-panel-head">
        <div className="ob-panel-index">Step 01 — Personal &amp; contact</div>
        <h2 className="ob-panel-title" id="obStep1Title" tabIndex={-1}>
          Who are we protecting?
        </h2>
        <p className="ob-panel-text">
          Use the name and contact details you want attached to your security reports. We use your
          email for scan notifications and your phone for critical alerts only.
        </p>
      </div>
      <div className="ob-grid">
        <div className="ob-field ob-span-2">
          <label className="ob-label" htmlFor="obFullName">
            Full name <span aria-hidden="true">*</span>
          </label>
          <input
            className={cn('ob-input', step1?.fullName !== undefined && 'is-invalid')}
            type="text"
            id="obFullName"
            placeholder="Jane Wanjiru Kamau"
            autoComplete="name"
            aria-invalid={step1?.fullName !== undefined}
            aria-describedby="obFullNameError"
            {...register('step1.fullName')}
          />
          <FieldError id="obFullNameError" message={step1?.fullName?.message} />
        </div>

        <div className="ob-field">
          <label className="ob-label" htmlFor="obDob">
            Date of birth <span aria-hidden="true">*</span>
          </label>
          <input
            className={cn('ob-input', step1?.dateOfBirth !== undefined && 'is-invalid')}
            type="date"
            id="obDob"
            aria-invalid={step1?.dateOfBirth !== undefined}
            aria-describedby="obDobHint obDobError"
            {...register('step1.dateOfBirth')}
          />
          <span className="ob-hint" id="obDobHint">
            You must be at least 16 years old.
          </span>
          <FieldError id="obDobError" message={step1?.dateOfBirth?.message} />
        </div>

        <div className="ob-field">
          <label className="ob-label" htmlFor="obPhone">
            Phone number <span aria-hidden="true">*</span>
          </label>
          <input
            className={cn('ob-input', step1?.phone !== undefined && 'is-invalid')}
            type="tel"
            id="obPhone"
            autoComplete="tel"
            aria-invalid={step1?.phone !== undefined}
            aria-describedby="obPhoneHint obPhoneError"
            {...register('step1.phone')}
          />
          <span className="ob-hint" id="obPhoneHint">
            Include your country code for SMS alerts.
          </span>
          <FieldError id="obPhoneError" message={step1?.phone?.message} />
        </div>

        <div className="ob-field">
          <label className="ob-label" htmlFor="obEmail">
            Email address <span aria-hidden="true">*</span>
          </label>
          <input
            className={cn('ob-input', step1?.email !== undefined && 'is-invalid')}
            type="email"
            id="obEmail"
            inputMode="email"
            autoComplete="email"
            aria-invalid={step1?.email !== undefined}
            aria-describedby="obEmailError"
            {...register('step1.email')}
          />
          <FieldError id="obEmailError" message={step1?.email?.message} />
        </div>

        <div className="ob-field">
          <label className="ob-label" htmlFor="obEmailConfirm">
            Confirm email address <span aria-hidden="true">*</span>
          </label>
          <input
            className={cn('ob-input', step1?.emailConfirm !== undefined && 'is-invalid')}
            type="email"
            id="obEmailConfirm"
            inputMode="email"
            autoComplete="email"
            aria-invalid={step1?.emailConfirm !== undefined}
            aria-describedby="obEmailConfirmError"
            {...register('step1.emailConfirm')}
          />
          <FieldError id="obEmailConfirmError" message={step1?.emailConfirm?.message} />
        </div>
      </div>
    </section>
  );
}

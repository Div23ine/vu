'use client';

import { Fragment } from 'react';
import { cn } from '@vunvault/lib';
import type { WizardStep } from '../_store/onboarding-store';

/**
 * Wizard stepper (Task 64) — `<ol aria-label="Onboarding progress">` with the
 * panel labels from the markup. State per the spec: `is-active` (brand, with
 * `aria-current="step"`) and `is-done` (green); clicking a PREVIOUS step goes
 * back, future steps are not clickable (plain, non-interactive spans — no
 * disabled-button noise for screen readers).
 */

export const STEP_LABELS = [
  'Personal & contact',
  'Career & account type',
  'Verification & finalisation',
] as const;

export interface StepperProps {
  step: WizardStep;
  /** Only ever called with a step BEFORE the current one. */
  onNavigate: (step: WizardStep) => void;
}

export function Stepper({ step, onNavigate }: StepperProps) {
  return (
    <ol className="ob-stepper" aria-label="Onboarding progress">
      {STEP_LABELS.map((label, index) => {
        const number = (index + 1) as WizardStep;
        const done = number < step;
        const active = number === step;
        return (
          <Fragment key={label}>
            {index > 0 ? (
              <li
                className={cn('ob-stepper-line', number <= step && 'is-done')}
                aria-hidden="true"
              />
            ) : null}
            <li
              className={cn('ob-stepper-item', active && 'is-active', done && 'is-done')}
              aria-current={active ? 'step' : undefined}
            >
              {done ? (
                <button
                  type="button"
                  className="ob-stepper-btn"
                  onClick={() => onNavigate(number)}
                  aria-label={`Go back to step ${number}: ${label}`}
                >
                  <b aria-hidden="true">{number}</b>
                  {label}
                </button>
              ) : (
                <>
                  <b aria-hidden="true">{number}</b>
                  {label}
                </>
              )}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

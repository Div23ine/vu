'use client';

import { cn } from '@vunvault/lib';

/**
 * Verification step tracker — the `Email → 2FA → Done` rail at the
 * top of the signup verification dialog. Numbers 1–3 with the verbatim labels;
 * the active node carries `aria-current="step"`, completed nodes `is-done`
 * (green, per the reference CSS). Non-interactive: unlike the onboarding
 * stepper , the spec gives this tracker no click behaviour —
 * the flow is strictly forward.
 */

export const VERIFY_STEPS = [
  { id: 'otp', label: 'Email' },
  { id: 'totp', label: '2FA' },
  { id: 'done', label: 'Done' },
] as const;

export type VerifyStep = (typeof VERIFY_STEPS)[number]['id'];

export interface StepTrackerProps {
  current: VerifyStep;
}

export function StepTracker({ current }: StepTrackerProps) {
  const currentIndex = VERIFY_STEPS.findIndex((step) => step.id === current);
  return (
    <div className="vv-verify-steps" id="stepTracker">
      {VERIFY_STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <span key={step.id} className="vv-verify-step-slot">
            {index > 0 ? (
              <span className={cn('vv-verify-step-line', done && 'is-done')} aria-hidden="true" />
            ) : null}
            <span
              className={cn('vv-verify-step-node', active && 'is-active', done && 'is-done')}
              aria-current={active ? 'step' : undefined}
            >
              <b aria-hidden="true">{index + 1}</b>
              <span>{step.label}</span>
            </span>
          </span>
        );
      })}
    </div>
  );
}

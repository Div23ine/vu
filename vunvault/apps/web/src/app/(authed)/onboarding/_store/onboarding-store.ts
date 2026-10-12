'use client';

import { create } from 'zustand';

/**
 * Onboarding wizard store (Task 64) — in-memory only.
 *
 * RHF holds the field VALUES (one form for the whole wizard, per the spec);
 * this store holds the piece of state that is not a field: the current
 * `step`. Keeping it outside the form lets the stepper, the action bar and
 * the panels (and Task 65's submit flow, which jumps back to step 1 on
 * `422 email_mismatch`) share one source of truth. No browser storage, ever.
 */

export type WizardStep = 1 | 2 | 3;

export interface OnboardingState {
  step: WizardStep;
  setStep: (step: WizardStep) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  step: 1,
  setStep: (step) => set({ step }),
  reset: () => set({ step: 1 }),
}));

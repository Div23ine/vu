'use client';

import { create } from 'zustand';

/**
 * Signup flow store (Task 61) — the hand-off point between the details form
 * (this task) and the verification dialog (Task 62, which reads and may
 * extend this file, exactly like the MFA dialog store pattern).
 *
 * The `POST /auth/signup` 202 parks `{ email, fullName }` here and flips
 * `open`; the dialog mounted by the route renders from it. In-memory only —
 * no browser storage, ever: a reload loses the pending verification and the
 * user simply signs up again (the API cleans pending accounts up after 24 h).
 */

export interface SignupFlowInput {
  /** The address the 6-digit verification code was sent to. */
  email: string;
  /** Kept for the dialog's greeting ("Welcome to VUNVAULT, <first name>."). */
  fullName: string;
}

export interface SignupState extends SignupFlowInput {
  open: boolean;
  start: (input: SignupFlowInput) => void;
  close: () => void;
}

export const useSignupStore = create<SignupState>((set) => ({
  open: false,
  email: '',
  fullName: '',
  start: (input) => set({ open: true, ...input }),
  close: () => set({ open: false }),
}));

/**
 * Convenience accessor mirroring Task 59's `useMfaDialog()` shape:
 * `useSignupDialog().open({ email, fullName })` / `.close()`.
 */
export function useSignupDialog() {
  const start = useSignupStore((state) => state.start);
  const close = useSignupStore((state) => state.close);
  return { open: start, close };
}

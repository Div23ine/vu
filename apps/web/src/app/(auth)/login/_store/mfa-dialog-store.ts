'use client';

import { create } from 'zustand';
import type { MfaMethod } from '@vunvault/contracts';

/**
 * MFA dialog store — the hand-off point between the login card (Task 59) and
 * the verification dialog (Task 60, which owns and extends this file).
 *
 * `recovery` is a UI-level method: the API enum (`MFA_METHODS`) only carries
 * the three challenge types the login response can offer, while recovery
 * codes are always available to an MFA-enrolled account, so the dialog's
 * switcher offers it as a client-side fallback.
 *
 * In-memory only — no browser storage, ever.
 */

export type MfaUiMethod = MfaMethod | 'recovery';

export interface MfaDialogInput {
  /** The account being verified ('' when arriving via an OAuth return). */
  email: string;
  /** Methods the API offered; an unavailable one simply fails `mfa_failed`. */
  methods: MfaUiMethod[];
  /** Open-redirect-safe path to land on after success. */
  next: string;
}

export interface MfaDialogState extends MfaDialogInput {
  open: boolean;
  openDialog: (input: MfaDialogInput) => void;
  close: () => void;
}

export const useMfaDialogStore = create<MfaDialogState>((set) => ({
  open: false,
  email: '',
  methods: [],
  next: '/',
  openDialog: (input) => set({ open: true, ...input }),
  close: () => set({ open: false }),
}));

/**
 * The call shape the catalogue specifies for Task 59:
 * `useMfaDialog().open({ email, methods, next })`.
 */
export function useMfaDialog() {
  const openDialog = useMfaDialogStore((state) => state.openDialog);
  const close = useMfaDialogStore((state) => state.close);
  return { open: openDialog, close };
}

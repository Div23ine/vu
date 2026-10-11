'use client';

import { create } from 'zustand';

/**
 * Scanner dialog store (Task 48).
 *
 * One boolean plus the two transitions — the marketing layout mounts a single
 * `<ScannerDialog />`, and every opener flips the same store:
 *
 *  - any element carrying `data-vv-open-scanner` (the delegated click
 *    listener below — later tasks just add the attribute),
 *  - the CTA's `Request Free Scan` button (which carries the attribute),
 *  - the `vunvault:open-scanner` window event, dispatched by the marketing
 *    footer's `Free Security Scan` button (Task 44 defines the same event
 *    name on its side).
 */

export const OPEN_SCANNER_EVENT = 'vunvault:open-scanner';

export interface ScannerState {
  open: boolean;
  openDialog(): void;
  closeDialog(): void;
}

export const useScannerStore = create<ScannerState>((set) => ({
  open: false,
  openDialog: () => set({ open: true }),
  closeDialog: () => set({ open: false }),
}));

if (typeof window !== 'undefined') {
  window.addEventListener(OPEN_SCANNER_EVENT, () => {
    useScannerStore.getState().openDialog();
  });

  // Delegated opener: any current or future element with the attribute.
  window.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('[data-vv-open-scanner]') !== null) {
      useScannerStore.getState().openDialog();
    }
  });
}

'use client';

import { create } from 'zustand';
import type { Invoice } from '@vunvault/contracts';

/**
 * Pay-invoice dialog store (created by Task 66; the dialog itself is Task
 * 66b) — the shape the catalogue pins:
 *
 *   interface PayDialogState { invoice: Invoice | null; open(i: Invoice): void; close(): void }
 *
 * `invoice !== null` IS the open state. Openers: the invoice table's
 * `Pay Now` button and the `?invoice=<id>` hand-off from the Products
 * purchase flow (Task 55). In-memory only — no browser storage, ever.
 */

export interface PayDialogState {
  invoice: Invoice | null;
  open: (invoice: Invoice) => void;
  close: () => void;
}

export const usePayDialogStore = create<PayDialogState>((set) => ({
  invoice: null,
  open: (invoice) => set({ invoice }),
  close: () => set({ invoice: null }),
}));

/** Catalogue call shape: `usePayDialog().open(invoice)` / `.close()`. */
export function usePayDialog() {
  const open = usePayDialogStore((state) => state.open);
  const close = usePayDialogStore((state) => state.close);
  return { open, close };
}

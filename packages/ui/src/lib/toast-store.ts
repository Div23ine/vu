/**
 * Toast store.
 *
 * A tiny Zustand store so `toast()` can be called from anywhere — a mutation
 * callback, an API error boundary, a keyboard shortcut — without threading a
 * provider through the tree. `Toaster` is mounted once by the app and renders
 * whatever this store holds.
 */
import { create } from 'zustand';

export type ToastKind = 'ok' | 'warn' | 'crit' | 'info';

export interface ToastInput {
  kind: ToastKind;
  title: string;
  message?: string;
  durationMs?: number;
}

export interface ToastItem {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
  durationMs: number;
  open: boolean;
}

/** Toasts auto-dismiss after 4 s unless the caller says otherwise. */
export const DEFAULT_TOAST_DURATION_MS = 4000;

/** At most four toasts on screen; the oldest is dismissed first. */
export const MAX_VISIBLE_TOASTS = 4;

let sequence = 0;

function nextId(): string {
  sequence += 1;
  return `vv-toast-${sequence}`;
}

interface ToastState {
  toasts: ToastItem[];
  push: (input: ToastInput) => string;
  dismiss: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  push: (input) => {
    const id = nextId();
    const item: ToastItem = {
      id,
      kind: input.kind,
      title: input.title,
      message: input.message,
      durationMs: input.durationMs ?? DEFAULT_TOAST_DURATION_MS,
      open: true,
    };
    set((state) => {
      // Close the oldest still-open toast(s) so the newcomer has room; Radix
      // removes them from the store once their leave animation reports closed.
      const openIds = state.toasts.filter((toast) => toast.open).map((toast) => toast.id);
      const overflow = openIds.length + 1 - MAX_VISIBLE_TOASTS;
      const dismissed = new Set(overflow > 0 ? openIds.slice(0, overflow) : []);
      const toasts = state.toasts.map((toast) =>
        dismissed.has(toast.id) ? { ...toast, open: false } : toast,
      );
      return { toasts: [...toasts, item] };
    });
    return id;
  },

  /** Start the leave animation; `remove` runs when Radix reports the close. */
  dismiss: (id) =>
    set((state) => ({
      toasts: state.toasts.map((toast) => (toast.id === id ? { ...toast, open: false } : toast)),
    })),

  remove: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),

  clear: () => set({ toasts: [] }),
}));

/** Queue a toast. Returns its id so a caller can dismiss it explicitly. */
export function toast(input: ToastInput): string {
  return useToastStore.getState().push(input);
}

/** Close a toast by id. */
export function dismissToast(id: string): void {
  useToastStore.getState().dismiss(id);
}

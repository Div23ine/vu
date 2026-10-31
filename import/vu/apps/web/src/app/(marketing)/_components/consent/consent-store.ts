'use client';

import { useEffect, type ReactNode } from 'react';
import { create } from 'zustand';
import type { ContactCategories } from '@vunvault/contracts';

/**
 * Consent state — IN-MEMORY only (the design used
 * `sessionStorage`; web storage is forbidden here).
 *
 * The decision is durable through the API-set cookie `vv_consent=<version>`
 * (`Max-Age=31536000; SameSite=Lax; Secure`, readable — not HttpOnly): the
 * store initialises from it, and `ConsentProvider` re-checks on mount. The
 * cookie stores the POLICY VERSION the visitor agreed to, not a bare flag:
 * a stored version older than `CONSENT_POLICY_VERSION` means the terms or
 * privacy policy changed since, so the banner returns for a fresh choice.
 * Bump `CONSENT_POLICY_VERSION` whenever the legal pages change materially.
 */

export const CONSENT_POLICY_VERSION = '2';
export const CONSENT_COOKIE = 'vv_consent';

export interface ConsentState {
  decided: boolean;
  prefs: ContactCategories;
  /** Set while the 400 ms leave transition runs; the dialog stays mounted. */
  leaving: boolean;
  markDecided: (prefs: ContactCategories) => void;
  setLeaving: () => void;
}

function cookiePolicyVersion(): string | null {
  if (typeof document === 'undefined') return null;
  const match = /(?:^|;\s*)vv_consent=([^;]+)/.exec(document.cookie);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function cookieSaysDecided(): boolean {
  return cookiePolicyVersion() === CONSENT_POLICY_VERSION;
}

export const useConsentStore = create<ConsentState>((set) => ({
  decided: cookieSaysDecided(),
  prefs: { strictlyNecessary: true, analytics: false, marketing: false, functional: false },
  leaving: false,
  markDecided: (prefs) => set({ decided: true, prefs, leaving: false }),
  setLeaving: () => set({ leaving: true }),
}));

/**
 * Read-only view of the decision for future script gating — v1 ships no
 * analytics or marketing scripts, so nothing consumes the prefs yet.
 */
export function useConsent() {
  const decided = useConsentStore((state) => state.decided);
  const prefs = useConsentStore((state) => state.prefs);
  return { decided, prefs };
}

/**
 * Re-checks the `vv_consent` cookie once on mount (the store's module-level
 * read can predate a cookie set during this page load). A plain function
 * component in a `.ts` file — no JSX needed.
 */
export function ConsentProvider({ children }: { children: ReactNode }): ReactNode {
  useEffect(() => {
    if (cookieSaysDecided() && !useConsentStore.getState().decided) {
      useConsentStore.setState({ decided: true });
    }
  }, []);
  return children;
}

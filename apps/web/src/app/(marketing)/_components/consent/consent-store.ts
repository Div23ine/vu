'use client';

import { useEffect, type ReactNode } from 'react';
import { create } from 'zustand';
import type { ContactCategories } from '@vunvault/contracts';

/**
 * Consent state (Task 58) — IN-MEMORY only (the prototype used
 * `sessionStorage`; web storage is forbidden here).
 *
 * The decision is durable through the API-set cookie `vv_consent=1`
 * (`Max-Age=31536000; SameSite=Lax; Secure`, readable — not HttpOnly): the
 * store initialises from it, and `ConsentProvider` re-checks on mount. Until
 * the API ships that cookie (follow-up noted in the task report), the 204
 * response is the success signal and the decision lives in memory for the
 * page load.
 *
 * `policyVersion` is the string the banner posts — the contracts schema only
 * requires `min(1)`; the catalogue pins `"1"`.
 */

export const CONSENT_POLICY_VERSION = '1';
export const CONSENT_COOKIE = 'vv_consent';

export interface ConsentState {
  decided: boolean;
  prefs: ContactCategories;
  /** Set while the 400 ms leave transition runs; the dialog stays mounted. */
  leaving: boolean;
  markDecided: (prefs: ContactCategories) => void;
  setLeaving: () => void;
}

function cookieSaysDecided(): boolean {
  if (typeof document === 'undefined') return false;
  return /(?:^|;\s*)vv_consent=1(?:;|$)/.test(document.cookie);
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

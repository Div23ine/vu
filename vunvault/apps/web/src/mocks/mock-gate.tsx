'use client';

import { useEffect, useState } from 'react';

/**
 * Gates the app behind the MSW service worker in dev mock mode.
 *
 * Renders `null` until `worker.start()` settles, so no component can fire an
 * API request before the mocks are intercepting. Unhandled requests bypass
 * the worker (`onUnhandledRequest: "bypass"`) — the mock layer covers the
 * endpoints the current tasks have built, and anything else (fonts, images,
 * third parties) flows to the network untouched.
 *
 * `./browser` (and with it `msw/browser`) is imported *inside* the effect,
 * never at module scope: React 19 prerenders lazy components during
 * `next build`, and `setupWorker()` throws outside a browser. The dynamic
 * import keeps the worker strictly client-side — the pattern the MSW Next.js
 * integration documents.
 *
 * If the worker fails to start (typically a missing `public/mockServiceWorker.js`
 * — the operator pre-step), the gate still opens: a working app against the
 * real API beats a permanent blank screen, and MSW has already logged why.
 */
export function MockGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { worker } = await import('./browser');
        await worker.start({ onUnhandledRequest: 'bypass' });
      } catch {
        // Open the gate anyway; MSW logs the underlying failure itself.
      }
      if (active) setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}

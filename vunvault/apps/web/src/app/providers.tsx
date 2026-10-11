'use client';

import { lazy, Suspense, useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@vunvault/lib';
import { Toaster, TooltipProvider } from '@vunvault/ui';
import { API_MOCKING_ENABLED, env } from '../env';
import { ensureCsrf } from '../lib/csrf';

/**
 * The client runtime every route renders through (Task 42).
 *
 * Order of the tree, outermost first:
 *  - `MockGate` (dev mock mode only) — holds rendering until MSW intercepts.
 *  - `QueryClientProvider` — ONE `QueryClient` per browser tab, created in a
 *    state initialiser so re-renders never rebuild the cache (and SSR never
 *    shares one across requests).
 *  - `TooltipProvider` — mounted once, above the app, per the design system.
 *  - `children`, then `<Toaster />` — the toast viewport is app-level chrome,
 *    mounted exactly once at the root.
 *
 * On mount it also performs the CSRF bootstrap (`ensureCsrf`) so the readable
 * `vv_csrf` cookie exists before the first mutation of the page load.
 */

/**
 * Lazy chunk: `env.NEXT_PUBLIC_API_MOCKING` is only known at runtime, so a
 * static import would ship `msw/browser` (and the whole mock layer) inside the
 * production bundle. A dynamic import keeps it in a separate chunk that is
 * never requested unless mock mode is on.
 */
const MockGate = lazy(() =>
  import('../mocks/mock-gate').then((module) => ({ default: module.MockGate })),
);

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  useEffect(() => {
    ensureCsrf().catch(() => {
      // A failed bootstrap must not unmount the app; the API rejects tokenless
      // mutations loudly, which is where the failure becomes visible.
    });
  }, []);

  const tree = (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {children}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );

  if (env.NEXT_PUBLIC_API_MOCKING === API_MOCKING_ENABLED) {
    return (
      <Suspense fallback={null}>
        <MockGate>{tree}</MockGate>
      </Suspense>
    );
  }
  return tree;
}

'use client';

import { Button, Logo } from '@vunvault/ui';

/**
 * Route-level error boundary . Next renders this inside the root
 * layout, so the chrome (styles, fonts, Providers) survives; only the failed
 * segment is replaced. The `Try again` button calls Next's `reset()`, which
 * re-attempts rendering the segment.
 */
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-6 text-center">
      <Logo />
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">Something went wrong</h1>
      <p className="max-w-md text-ink-muted">
        An unexpected error occurred. Try again, and contact support if it keeps happening.
      </p>
      <Button variant="primary" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}

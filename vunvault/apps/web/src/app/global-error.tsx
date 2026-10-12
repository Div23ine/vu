'use client';

import { Button, Logo } from '@vunvault/ui';
import './globals.css';

/**
 * Last-resort error boundary (Task 43): renders when the root layout itself
 * throws, so it must carry its own `<html>`/`<body>` — and its own import of
 * `globals.css`, because the layout that normally loads the stylesheet is the
 * thing that failed. Copy mirrors `error.tsx` verbatim.
 */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper text-ink antialiased font-sans">
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
      </body>
    </html>
  );
}

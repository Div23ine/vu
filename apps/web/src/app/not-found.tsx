import Link from 'next/link';
import { Button, Eyebrow, Logo } from '@vunvault/ui';

/**
 * 404 (Task 43). Planner-authored copy — no prototype exists for the error
 * pages, so the strings below are exactly what the catalogue specifies and
 * the layout is the shared centred column all four of them use.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-6 text-center">
      <Logo />
      <Eyebrow>404</Eyebrow>
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">Page not found</h1>
      <p className="max-w-md text-ink-muted">The page you requested does not exist or has moved.</p>
      <Button asChild variant="primary">
        <Link href="/">Return home</Link>
      </Button>
    </main>
  );
}

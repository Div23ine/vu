'use client';

import Link from 'next/link';
import { Button, Eyebrow, Logo } from '@vunvault/ui';
import { homeFor } from '../../lib/permissions';
import { useSession } from '../../lib/session';

/**
 * 403 . The escape link points at the visitor's own landing route —
 * `homeFor(role)` — because "back" is exactly where they just came from and
 * was denied. A client component: the role comes from the session query.
 * While the session is still unknown (or absent), the client portal is the
 * safe default; staff sessions get `/admin` as soon as the query resolves.
 */
export default function ForbiddenPage() {
  const { user } = useSession();
  const home = homeFor(user?.role ?? 'client');

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-6 text-center">
      <Logo />
      <Eyebrow>403</Eyebrow>
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">Access restricted</h1>
      <p className="max-w-md text-ink-muted">
        Your account does not have permission to view this page.
      </p>
      <Button asChild variant="primary">
        <Link href={home}>Back to my workspace</Link>
      </Button>
    </main>
  );
}

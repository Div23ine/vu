'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from '@vunvault/ui';

/**
 * Unknown route: instead of leaving the visitor on an error page, send them
 * home with the path they wanted — the landing page's coming-soon banner
 * picks it up from `?coming-soon=` and offers the waitlist for it.
 */
export default function NotFound() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const wanted = pathname && pathname !== '/' ? pathname : '/';
    router.replace(`/?coming-soon=${encodeURIComponent(wanted)}`);
  }, [router, pathname]);

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-6 text-center">
      <Logo />
      <p className="text-neutral-500">Taking you back to the landing page…</p>
    </main>
  );
}

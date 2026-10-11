'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AuthCard } from '../../../_components/auth-card';
import { useConfirmNewsletter } from '../../../_hooks/use-auth-misc';

/**
 * Newsletter confirmation card (Task 63) — the double-opt-in landing. The
 * confirm POST fires once on mount (guarded against StrictMode double-effects);
 * the token is read from the URL by the route and kept in props only.
 *
 * States (all planner copy): pending shows the confirmation line as the card
 * heading (the spec gives no separate pending title); `204` → `Subscription
 * confirmed`; `404` — and, documented decision, any other failure, since a
 * confirm that cannot complete has no other honest state — → `Link not valid`.
 * A missing `?token=` is the invalid state from the first render.
 *
 * NOTE (disclosed): the catalogue's deliverables list names only this route's
 * `page.tsx`; a client card component is unavoidable because the page must
 * stay a server component to export `metadata.robots`. Same split as the
 * other three Task 63 routes.
 */

export interface NewsletterConfirmCardProps {
  /** Raw `?token=` — `null` when absent (→ the invalid state). */
  token: string | null;
}

type ConfirmPhase = 'pending' | 'confirmed' | 'invalid';

export function NewsletterConfirmCard({ token }: NewsletterConfirmCardProps) {
  const confirm = useConfirmNewsletter();
  const [phase, setPhase] = useState<ConfirmPhase>(token === null ? 'invalid' : 'pending');
  const fired = useRef(false);

  useEffect(() => {
    if (token === null || fired.current) return;
    fired.current = true;
    confirm
      .mutateAsync(token)
      .then(() => setPhase('confirmed'))
      .catch(() => setPhase('invalid'));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once on mount
  }, []);

  if (phase === 'confirmed') {
    return (
      <AuthCard
        title="Subscription confirmed"
        sub="You will now receive VUNVAULT threat advisories."
      >
        <Link className="vv-submit" href="/blog">
          Back to the blog
        </Link>
      </AuthCard>
    );
  }

  if (phase === 'invalid') {
    return (
      <AuthCard
        title="Link not valid"
        sub="This confirmation link is invalid or has already been used."
      />
    );
  }

  return <AuthCard title="Confirming your subscription…" />;
}

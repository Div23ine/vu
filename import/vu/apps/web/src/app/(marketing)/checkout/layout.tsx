import type { Metadata } from 'next';

/**
 * `(marketing)/checkout` — transactional, per-session, and never content.
 *
 * One group-level `noindex` covers `/checkout`, `/checkout/cancelled` and
 * `/checkout/success/[reference]`; two of those four routes are client components
 * and cannot declare metadata of their own. `/checkout/callback` and
 * `/checkout/success/[reference]` are additionally disallowed in `robots.ts`
 * because they are payment-provider targets keyed to a single order, not pages a
 * crawler has any business fetching.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

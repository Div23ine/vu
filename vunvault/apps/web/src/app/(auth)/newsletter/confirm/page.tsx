import type { Metadata } from 'next';
import { NewsletterConfirmCard } from './_components/newsletter-confirm-card';

/**
 * `/newsletter/confirm?token=` (Task 63) — the double-opt-in link the
 * subscribe flow emails (Task 56). The confirm POST fires once on mount in
 * the client card; the token is read once here and never stored.
 *
 * The card lives in `_components/newsletter-confirm-card.tsx` (disclosed
 * addition — the deliverables list names only this page): the page must stay
 * a server component to export `metadata.robots`, and the confirm-on-mount
 * flow must be a client component, so the route splits like the other three.
 */

export const metadata: Metadata = {
  title: 'Confirming your subscription…',
  robots: { index: false },
};

interface NewsletterConfirmPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function NewsletterConfirmPage({ searchParams }: NewsletterConfirmPageProps) {
  const params = await searchParams;
  return <NewsletterConfirmCard token={params.token ?? null} />;
}

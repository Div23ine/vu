import type { Metadata } from 'next';

/**
 * `/blog` metadata.
 *
 * `blog/page.tsx` is a client component — it owns the filter state (`q`,
 * `category`, `sort`) that the hero, the category pills and the list share — and a
 * client component cannot export `metadata`. The newsroom index still needs a
 * title, description and canonical, so they live here instead.
 *
 * This layout also wraps `/blog/[slug]`, which is exactly why the article route's
 * own `generateMetadata` MUST set `alternates.canonical`: metadata resolves
 * nearest-segment-wins, and without that override every article would canonicalise
 * to `/blog` and the whole newsroom would collapse into a single URL for ranking
 * purposes.
 */
export const metadata: Metadata = {
  title: 'Blog & Advisories',
  description:
    'Published research, vulnerability advisories and security news from the VUNVAULT team, with CVE tracking and zero-day telemetry.',
  alternates: { canonical: '/blog' },
  openGraph: { type: 'website' },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

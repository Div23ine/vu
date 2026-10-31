import type { Metadata } from 'next';
import { ComingSoon } from '../../../components/coming-soon';

/**
 * `/academy` (Task 74) — reserved marketing route: the academy's public
 * landing placeholder until course pages exist.
 */

export const metadata: Metadata = {
  title: 'VUNVAULT Academy',
  // A one-line placeholder is not content — keep it out of the index.
  robots: { index: false },
};

export default function MarketingAcademyPage() {
  return (
    <ComingSoon
      eyebrow="Academy"
      title="VUNVAULT Academy"
      body="Structured, hands-on cyber training with free certificates. Course pages are coming soon."
      cta={{ label: 'Back to home', href: '/' }}
    />
  );
}

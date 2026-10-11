import type { Metadata } from 'next';
import { ComingSoon } from '../../../../components/coming-soon';

/**
 * `/portal/academy` (Task 74) — reserved portal route: an honest placeholder
 * until the Academy lands. The portal layout (Task 45) owns the chrome and
 * the session guard.
 */

export const metadata: Metadata = {
  title: 'Academy Progress',
  // Authed portal page — never indexable (the Task 63 auth-page family rule).
  robots: { index: false },
};

export default function PortalAcademyPage() {
  return (
    <ComingSoon
      eyebrow="Academy"
      title="Academy Progress"
      body="Your learning tracks and certificates will appear here."
      cta={{ label: 'Browse tracks', href: '/academy' }}
    />
  );
}

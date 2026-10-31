import type { Metadata } from 'next';
import { ComingSoon } from '../../../../components/coming-soon';

/**
 * `/portal/scanner` — reserved portal route. The scanner dialog is
 * mounted in the MARKETING layout only, so the CTA deep-links to the public
 * site's `#free-scanner` anchor. The portal layout owns the chrome
 * and the session guard.
 */

export const metadata: Metadata = {
  title: 'Free Vulnerability Scanner',
  // Authed portal page — never indexable (the an earlier iteration auth-page family rule).
  robots: { index: false },
};

export default function PortalScannerPage() {
  return (
    <ComingSoon
      eyebrow="Tools"
      title="Free Vulnerability Scanner"
      body="Run a quick reconnaissance simulation from the public site, or request a full authorised assessment."
      cta={{ label: 'Open the scanner', href: '/#free-scanner' }}
    />
  );
}

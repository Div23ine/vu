import type { Metadata } from 'next';
import { ComingSoon } from '../../../components/coming-soon';

/**
 * `/cookie-policy` (Task 74) — legal placeholder: an honest stub until the
 * operator publishes the document. No invented policy content.
 */

export const metadata: Metadata = {
  title: 'Cookie Policy',
  robots: { index: false },
};

export default function CookiePolicyPage() {
  return (
    <ComingSoon
      eyebrow="Legal"
      title="Cookie Policy"
      body="This document is being finalised. Contact info@vunvault.com for a copy."
    />
  );
}

import type { Metadata } from 'next';
import { ComingSoon } from '../../../components/coming-soon';

/**
 * `/privacy` (Task 74) — legal placeholder: an honest stub until the
 * operator publishes the document. No invented policy content.
 */

export const metadata: Metadata = {
  title: 'Privacy Policy',
  robots: { index: false },
};

export default function PrivacyPolicyPage() {
  return (
    <ComingSoon
      eyebrow="Legal"
      title="Privacy Policy"
      body="This document is being finalised. Contact info@vunvault.com for a copy."
    />
  );
}

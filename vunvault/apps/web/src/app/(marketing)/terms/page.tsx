import type { Metadata } from 'next';
import { ComingSoon } from '../../../components/coming-soon';

/**
 * `/terms` (Task 74) — legal placeholder: an honest stub until the operator
 * publishes the document. No invented policy content.
 */

export const metadata: Metadata = {
  title: 'Terms of Service',
  robots: { index: false },
};

export default function TermsOfServicePage() {
  return (
    <ComingSoon
      eyebrow="Legal"
      title="Terms of Service"
      body="This document is being finalised. Contact info@vunvault.com for a copy."
    />
  );
}

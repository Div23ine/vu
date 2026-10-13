import type { Metadata } from 'next';
import { AdvisoriesHero } from './_components/advisories-hero';
import { AdvisoriesFeed } from './_components/advisory-card';

/**
 * `/portal/advisories` (Task 70) — the client's zero-day advisory feed on
 * the Task 38 API: severity, scope, remediation, safe external references
 * and the idempotent Acknowledge action, newest first with unacknowledged
 * criticals pinned. The portal layout (Task 45) owns the chrome and the
 * session guard; the SSE push arrives in Layer L12.
 */

export const metadata: Metadata = {
  title: 'Security Advisories',
  // Authed portal page — never indexable (the Task 63 auth-page family rule).
  robots: { index: false },
};

export default function AdvisoriesPage() {
  return (
    <>
      <AdvisoriesHero />
      <section className="pt-10 md:pt-12 pb-16 md:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AdvisoriesFeed />
        </div>
      </section>
    </>
  );
}

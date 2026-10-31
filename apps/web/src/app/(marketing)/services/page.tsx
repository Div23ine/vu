import type { Metadata } from 'next';
import { JsonLd } from '../../../lib/json-ld';
import { serviceJsonLd } from '../../../lib/seo';
import { CoreServices } from './_components/core-services';
import { InlineCli } from './_components/inline-cli';
import { RequestBand } from './_components/request-band';
import { ServiceTabs } from './_components/service-tabs';
import { ServicesHero } from './_components/services-hero';
import { ServicesPricing } from './_components/services-pricing';

/**
 * `/services` — hero → sticky section tabs → inline OSINT CLI →
 * core services → pricing → request band. The last three are
 * null stubs until an earlier iteration overwrites them; the route already renders them
 * in their final positions. Header/footer come from the marketing layout
 * (the footer's `company` variant is pathname-derived — an earlier iteration).
 */

// The root layout's template renders this as "Services — VUNVAULT".
export const metadata: Metadata = {
  alternates: { canonical: '/services' },
  description:
    'Scoped penetration testing, vulnerability assessment, SACCO and fintech compliance, M-Pesa and API security review, and continuous monitoring retainers.',
  title: 'Services',
};

export default function ServicesPage() {
  return (
    <>
      {/* `Service` graph for the catalogue index itself. */}
      <JsonLd data={serviceJsonLd('/services')} />
      <ServicesHero />
      <ServiceTabs />
      <InlineCli />
      <CoreServices />
      <ServicesPricing />
      <RequestBand />
    </>
  );
}

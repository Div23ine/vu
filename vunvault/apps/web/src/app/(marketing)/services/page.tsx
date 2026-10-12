import type { Metadata } from 'next';
import { AcademyStrip } from './_components/academy-strip';
import { CoreServices } from './_components/core-services';
import { InlineCli } from './_components/inline-cli';
import { RequestBand } from './_components/request-band';
import { ServiceTabs } from './_components/service-tabs';
import { ServicesHero } from './_components/services-hero';
import { ServicesPricing } from './_components/services-pricing';

/**
 * `/services` (Task 54) — hero → sticky section tabs → inline OSINT CLI →
 * core services → pricing → academy strip → request band. The last three are
 * null stubs until Task 54b overwrites them; the route already renders them
 * in their final positions. Header/footer come from the marketing layout
 * (the footer's `company` variant is pathname-derived — Task 44).
 */

// The root layout's template renders this as "Services — VUNVAULT".
export const metadata: Metadata = {
  title: 'Services',
};

export default function ServicesPage() {
  return (
    <>
      <ServicesHero />
      <ServiceTabs />
      <InlineCli />
      <CoreServices />
      <ServicesPricing />
      <AcademyStrip />
      <RequestBand />
    </>
  );
}

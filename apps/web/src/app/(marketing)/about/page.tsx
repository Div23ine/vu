import type { Metadata } from 'next';
import { AboutHero } from './_components/about-hero';
import { GetStarted } from './_components/get-started';
import { MissionVision } from './_components/mission-vision';
import { Pillars } from './_components/pillars';
import { AboutTeam } from './_components/team';
import { AboutTelemetry } from './_components/telemetry';

/**
 * `/about` — hero → mission → pillars → team → telemetry →
 * get started. `<AboutTeam />` and `<AboutTelemetry />` are null stubs until
 * an earlier iteration overwrites them; the route already renders them in their final
 * positions. The marketing layout supplies header/footer (footer variant
 * `company` is derived from the pathname — an earlier iteration).
 */

export const metadata: Metadata = {
  title: { absolute: 'About VUNVAULT — Africa-Rooted. Worldwide Defense.' },
};

export default function AboutPage() {
  return (
    <>
      <AboutHero />
      <MissionVision />
      <Pillars />
      <AboutTeam />
      <AboutTelemetry />
      <GetStarted />
    </>
  );
}

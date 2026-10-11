'use client';

import { Eye, Target } from 'lucide-react';
import { cn } from '@vunvault/lib';
import { useReveal } from './about-hero';
import '../_styles/about.css';

/**
 * Mission & Vision (Task 53) — the two-card statement section. The vision
 * card is the dark variant; copy is verbatim, both cards scroll-reveal.
 */
export function MissionVision() {
  const mission = useReveal<HTMLElement>();
  const vision = useReveal<HTMLElement>();

  return (
    <section className="vv-section" id="mission">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="max-w-3xl space-y-4">
          <span className="vv-eyebrow">Mission &amp; Vision</span>
          <h2 className="vv-h2">Security work that survives contact with reality.</h2>
          <p className="vv-body max-w-2xl">
            Most assessments are written for auditors. Ours are written for the engineer who has to
            ship the fix before Monday. That single bias shapes everything below.
          </p>
        </div>

        <div className="vv-mv-grid">
          <article ref={mission.ref} className={cn('vv-mv-card', mission.className)}>
            <span className="vv-mv-icon" aria-hidden="true">
              <Target size={22} />
            </span>
            <h3 className="vv-h3">Our mission</h3>
            <p className="vv-body">
              To make advanced offensive security reachable for the institutions that carry African
              economies — SACCOs, fintechs, payment gateways and public infrastructure — by pairing
              adversary-grade tooling with plain-language reporting that a board can actually act
              on.
            </p>
            <p className="vv-body">
              We do not sell fear. We map exposure, prove impact, and hand back a prioritised path
              out of the blast radius.
            </p>
          </article>

          <article ref={vision.ref} className={cn('vv-mv-card vv-mv-card--dark', vision.className)}>
            <span className="vv-mv-icon" aria-hidden="true">
              <Eye size={22} />
            </span>
            <h3 className="vv-h3">Our vision</h3>
            <p className="vv-body">
              A continent where a two-person IT team in Kisumu has the same defensive leverage as a
              Tier-1 bank in Zurich. That means automation, telemetry and continuous validation —
              not annual PDFs.
            </p>
            <p className="vv-body">
              We are building the sensor network, the academy and the tooling to close that gap
              permanently.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}

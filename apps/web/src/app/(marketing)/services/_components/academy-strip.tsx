import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import '../_styles/services.css';

/**
 * Academy strip (Task 54b) — replaces the Task 54 stub. The dark
 * `academy-banner` pitching on-site/remote training; CTA → `/academy`.
 * Server component, copy verbatim.
 */
export function AcademyStrip() {
  return (
    <section id="academy" className="pb-14 md:pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="academy-banner">
          <div>
            <div className="academy-banner-eyebrow">VUNVAULT Academy</div>
            <h2 className="academy-banner-title">Upskill your in-house engineering team</h2>
            <p className="academy-banner-text">
              We train the people who build and defend your systems. Hands-on modules on secure
              coding practice, real-world attack vectors, and the same automated CLI tooling our
              analysts use in live engagements — delivered on-site in Nairobi or remotely for
              distributed teams.
            </p>
          </div>
          <Link href="/academy" className="academy-banner-cta">
            <span>Explore Training Tracks</span>
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

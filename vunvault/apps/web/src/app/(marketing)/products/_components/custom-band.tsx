import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import '../_styles/products.css';

/**
 * Custom tooling band (Task 55b) — replaces the Task 55 stub. The dark CTA
 * closing the Products page; `Start a Conversation` → `/contact`. Copy
 * verbatim; server component.
 */
export function CustomBand() {
  return (
    <section className="py-14 md:py-20 bg-paper border-t border-neutral-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="vv-scan-cta">
          <div className="vv-scan-cta-glow" aria-hidden="true" />
          <div className="vv-scan-cta-body">
            <span className="vv-scan-cta-eyebrow">Need something bespoke?</span>
            <h2 className="vv-scan-cta-title">
              We build custom tooling — <span>Talk to an engineer</span>
            </h2>
            <p className="vv-scan-cta-text">
              Internal scanners, CI security gates, SIEM content or a private red-team arsenal. Tell
              us the workflow and we will scope the build.
            </p>
            <div className="vv-scan-cta-actions">
              <Link href="/contact" className="vv-scan-cta-btn">
                <span>Start a Conversation</span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <span className="vv-scan-cta-note">Nairobi-based · Serving clients worldwide</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

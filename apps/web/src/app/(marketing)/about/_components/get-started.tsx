'use client';

import Link from 'next/link';
import { Phone } from 'lucide-react';
import { cn } from '@vunvault/lib';
import { useReveal } from './about-hero';
import '../_styles/about.css';

/**
 * Closing call-to-action band — the dark `vv-cta` panel. Both
 * buttons route per the spec: `Explore Services` → `/services`,
 * `Book a Scoping Call` → `/contact`.
 */
export function GetStarted() {
  const reveal = useReveal<HTMLDivElement>();

  return (
    <section className="vv-section" id="get-started">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={reveal.ref} className={cn('vv-cta', reveal.className)}>
          <span className="vv-cta-glow" aria-hidden="true" />
          <div className="vv-cta-inner">
            <span className="text-[10px] font-bold uppercase tracking-[0.22em]">
              No cost · No commitment
            </span>
            <h2 className="vv-h2">See your attack surface the way we see it.</h2>
            <p className="vv-body">
              Start with a free external vulnerability scan, or talk to an engineer about a full
              adversary-emulation engagement mapped to your regulator’s framework.
            </p>
            <div className="vv-cta-actions">
              <Link href="/services" className="btn-get-started">
                Explore Services
              </Link>
              <Link href="/contact" className="vv-btn-ghost">
                <Phone size={16} aria-hidden="true" />
                <span>Book a Scoping Call</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

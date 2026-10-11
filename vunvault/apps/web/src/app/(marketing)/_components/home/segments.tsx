import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import '../../_styles/home-mid.css';

/**
 * Organisation segments (Task 49) — "Tailored Defense Strategies".
 *
 * The prototype's cards were anchors without a real destination; the
 * catalogue routes the first three to `/services#pricing` and the SOC card to
 * `/services`. Copy, tags and arrows are verbatim. Server component.
 */

const SEGMENTS = [
  {
    title: 'I run a Small Business',
    tag: 'Starter Scan',
    text: 'Affordable starter vulnerability scans with clear, actionable executive reporting.',
    href: '/services#pricing',
  },
  {
    title: 'I’m in a SACCO or Fintech',
    tag: 'Compliance Ready',
    text: 'Regulation-aware security testing for financial institutions & Central Bank readiness.',
    href: '/services#pricing',
  },
  {
    title: 'I’m in IT / Enterprise',
    tag: 'Retainer Protection',
    text: 'Full-scope retainer testing and board-ready reporting for complex estates.',
    href: '/services#pricing',
  },
  {
    title: 'I run a SOC / Security Team',
    tag: 'Purple Team',
    text: 'Adversary emulation, detection-rule validation and purple-team exercises that harden your SOC.',
    href: '/services',
  },
] as const;

export function Segments() {
  return (
    <section className="py-12 md:py-16 bg-paper">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2 mb-8">
          <span className="text-xs font-bold uppercase tracking-wider text-cyan-600 bg-cyan-50 px-3 py-1 rounded-full border border-cyan-200">
            Tailored Defense Strategies
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-neutral-900 tracking-tight">
            How Can VUNVAULT Help You?
          </h2>
          <p className="text-neutral-500 text-sm md:text-base">
            Select your organization type for customized vulnerability assessments.
          </p>
        </div>
        <div className="vv-seg-grid">
          {SEGMENTS.map((segment) => (
            <Link key={segment.title} href={segment.href} className="vv-seg-card">
              <div className="vv-seg-body">
                <div className="vv-seg-top">
                  <h3 className="vv-seg-title">{segment.title}</h3>
                  <span className="vv-seg-tag">{segment.tag}</span>
                </div>
                <p className="vv-seg-text">{segment.text}</p>
              </div>
              <span className="vv-seg-arrow" aria-hidden="true">
                <ArrowRight size={18} />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

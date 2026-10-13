import Link from 'next/link';
import { Terminal } from 'lucide-react';
import '../_styles/services.css';

/**
 * Services hero (Task 54) — kicker, headline, lead, dual CTAs and the trust
 * line. Server component; copy verbatim. `Try the free OSINT tools` targets
 * the inline CLI's `#free-tools` anchor further down this same page.
 */
export function ServicesHero() {
  return (
    <section className="vv-svc-hero">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <span className="vv-kicker">Enterprise Security Solutions</span>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-neutral-900 tracking-tight leading-[1.1]">
          Application penetration testing, surface reconnaissance and proactive threat mitigation.
        </h1>
        <p className="vv-section-lede max-w-3xl mx-auto">
          VUNVAULT combines manual, human-led penetration testing with continuous automated
          attack-surface reconnaissance. Every engagement is delivered under a mutual NDA, mapped to
          the compliance frameworks your regulator actually audits against, and handed back with
          remediation steps your engineers can ship.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
          <Link href="/contact" className="btn-get-started">
            Request Assessment
          </Link>
          <a
            href="#free-tools"
            className="inline-flex items-center gap-2 px-6 py-4 text-sm font-bold text-neutral-900 bg-white border border-neutral-200 rounded-full hover:border-neutral-400 transition-colors"
          >
            <Terminal size={16} aria-hidden="true" />
            <span>Try the free OSINT tools</span>
          </a>
        </div>
        <div className="pt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">
          <span>NDA-backed</span>
          <span className="w-1 h-1 rounded-full bg-neutral-300" />
          <span>OWASP-aligned</span>
          <span className="w-1 h-1 rounded-full bg-neutral-300" />
          <span>Central Bank ready</span>
          <span className="w-1 h-1 rounded-full bg-neutral-300" />
          <span>Africa-rooted · Worldwide</span>
        </div>
      </div>
    </section>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, LifeBuoy, Network } from 'lucide-react';
import { AttackSurface } from './_components/home/attack-surface';
import { AcademyTracks } from './_components/home/academy-tracks';
import { Contributors } from './_components/home/contributors';
import { ContactStrip } from './_components/home/contact-strip';
import { Hero } from './_components/home/hero';
import { InsightsGrid } from './_components/home/insights-grid';
import { PressMedia } from './_components/home/press-media';
import { Segments } from './_components/home/segments';
import { ZeroDayWidget } from './_components/home/zero-day-widget';
import { CveTicker } from './_components/cve-ticker';
import { PricingPlans } from './_components/pricing-plans';
import { ScannerCta } from './_components/scanner/scanner-cta';

/**
 * The home route (Task 52) — every section assembled in the prototype's
 * exact order: hero → `#get-started` anchor → CVE ticker → scanner CTA →
 * attack-surface mapping → insights grid → segments → the Proactive Security
 * Ecosystem band (zero-day widget + the two side cards + the Soft Protection
 * panel) → academy → pricing → press → contributors → contact.
 *
 * Replaces (and its assembly deletes) Task 41's placeholder `src/app/page.tsx`.
 * The ecosystem band's grid is rebuilt from Task 50's section markup (the
 * extraction's `lg:col-span-*` wrappers imply a 12-column grid); the Soft
 * Protection panel ships WITHOUT the prototype's `soft1.jpg` photograph —
 * "do not add images" is this task's own out-of-scope rule.
 */

export const metadata: Metadata = {
  // `absolute` opts out of the root layout's `%s — VUNVAULT` template, exactly
  // as the catalogue specifies.
  title: { absolute: 'VUNVAULT — We Find The Cracks Before They Do' },
  description:
    'Advanced vulnerability management through intelligent automation and proactive defense strategies.',
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <span id="get-started" className="anchor-offset" aria-hidden="true" />
      <CveTicker />
      <ScannerCta />
      <AttackSurface />
      <InsightsGrid />
      <Segments />

      <section className="py-12 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14 md:mb-18 space-y-3">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-neutral-900 tracking-tight">
              Proactive Security Ecosystem
            </h2>
            <p className="text-neutral-500 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
              Comprehensive tools designed to map, analyze, and secure your infrastructure
              seamlessly.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start">
            <div className="lg:col-span-8 space-y-6 md:space-y-8">
              <ZeroDayWidget />
            </div>

            <div className="lg:col-span-4 space-y-6 md:space-y-8">
              <div className="glass-card rounded-3xl p-6 sm:p-8 border border-neutral-200/90 shadow-sm hover:shadow-md transition-all duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="space-y-3 max-w-xl">
                    <div className="w-12 h-12 rounded-2xl bg-neutral-100 border border-neutral-200/80 flex items-center justify-center text-neutral-800 shadow-xs">
                      <LifeBuoy size={22} aria-hidden="true" />
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
                      Security Advisory
                    </h3>
                    <p className="text-neutral-500 text-sm leading-relaxed">
                      Expert guidance tailored to your risk profile. Actionable steps to remediate
                      identified vulnerabilities swiftly.
                    </p>
                  </div>
                  <div className="shrink-0 pt-2 sm:pt-0">
                    <Link
                      href="/contact"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900 hover:text-neutral-600 transition-colors group cursor-pointer"
                    >
                      <span>Get advice</span>
                      <ArrowRight
                        size={15}
                        aria-hidden="true"
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    </Link>
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-3xl p-6 sm:p-8 border border-neutral-200/90 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between min-h-[580px]">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-neutral-100 border border-neutral-200/80 flex items-center justify-center text-neutral-800 shadow-xs">
                    <Network size={22} aria-hidden="true" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
                    Network Mapping
                  </h3>
                  <p className="text-neutral-500 text-sm leading-relaxed">
                    Visualize your entire attack surface. Automatically discover exposed assets and
                    unmapped connections.
                  </p>
                </div>
                <div className="my-6 rounded-2xl bg-neutral-950/90 p-4 border border-neutral-800 shadow-inner relative overflow-hidden min-h-[260px] flex items-center justify-center">
                  <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-30" />
                  <Network size={56} aria-hidden="true" className="text-neutral-600" />
                  <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[10px] text-neutral-400 bg-neutral-900/90 px-2.5 py-1 rounded border border-neutral-800">
                    <span>
                      Selected Node: <strong className="text-cyan-400">Core-K8s</strong>
                    </span>
                    <span className="text-emerald-400">Auto-Discovered</span>
                  </div>
                </div>
                <div>
                  <Link
                    href="/services"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900 hover:text-neutral-600 transition-colors group cursor-pointer"
                  >
                    <span>Explore mapping</span>
                    <ArrowRight
                      size={15}
                      aria-hidden="true"
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                </div>
              </div>

              <div className="relative rounded-3xl overflow-hidden shadow-lg group border border-neutral-200/80 min-h-[280px] md:min-h-[320px] flex items-end bg-neutral-900">
                <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/30 to-transparent" />
                <div className="relative z-10 p-6 md:p-8">
                  <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-neutral-900 tracking-tight">
                    Soft Protection for Hard Data.
                  </h3>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <AcademyTracks />
      <PricingPlans />
      <PressMedia />
      <Contributors />
      <ContactStrip />
    </>
  );
}

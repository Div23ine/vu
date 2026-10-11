/**
 * Attack Surface Mapping section (Task 49) — the three-step numbered list
 * under the hero. Server component, static copy (verbatim from the
 * prototype).
 */

const STEPS = [
  {
    number: '01',
    text: 'Domains, subdomains and exposed services are enumerated and scored by exposure.',
  },
  {
    number: '02',
    text: 'Each node is cross-referenced against known CVEs and misconfiguration patterns.',
  },
  {
    number: '03',
    text: 'You receive a prioritized map — not a 40-page PDF nobody reads.',
  },
] as const;

export function AttackSurface() {
  return (
    <section className="py-14 md:py-20 bg-paper border-t border-neutral-200/80">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex items-center gap-2">
          <span className="h-[2px] w-6 bg-cyan-600 rounded-full" />
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">
            ATTACK SURFACE MAPPING
          </span>
        </div>
        <div className="space-y-4 max-w-3xl">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.15]">
            Every login page, API and subdomain is a door. We map them all.
          </h2>
          <p className="text-neutral-500 text-base sm:text-lg leading-relaxed">
            Before a single test runs, we build a live picture of your exposed assets — the same
            view an attacker builds during reconnaissance.
          </p>
        </div>
        <div className="pt-4 space-y-0">
          {STEPS.map((step) => (
            <div
              key={step.number}
              className="py-5 sm:py-6 border-b border-neutral-200/80 flex items-start gap-6 sm:gap-10 group hover:bg-white/60 px-3 rounded-xl transition-colors cursor-pointer"
            >
              <span className="text-lg sm:text-xl font-bold font-mono text-cyan-600 group-hover:text-neutral-900 transition-colors shrink-0">
                {step.number}
              </span>
              <p className="text-neutral-700 text-sm sm:text-base font-medium leading-relaxed group-hover:text-neutral-900 transition-colors">
                {step.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

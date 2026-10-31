import Link from 'next/link';
import { HOME_QA } from '../qa-data';

/**
 * Home Q&A band — "Questions buyers actually ask".
 *
 * The retired /pricing page lives on here: its buyer FAQ, its per-plan
 * deliverables and timelines, and its billing facts, re-cut as an accordion
 * of native `<details>` elements (zero JS, keyboard- and screen-reader-
 * friendly out of the box). The plan grid with starting rates stays above
 * this section (`PricingPlans`, `#pricing`); the exact charged amount is
 * confirmed at checkout, and every answer that touches money says so.
 * Server component — nothing here is interactive beyond the disclosure
 * toggles.
 */
export function QaSection() {
  return (
    <section
      id="qa"
      aria-labelledby="qa-heading"
      className="py-14 md:py-20 bg-paper border-t border-neutral-200/80"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-[2px] w-6 bg-cyan-600 rounded-full" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">
              Q&amp;A
            </span>
          </div>
          <h2
            id="qa-heading"
            className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight"
          >
            Questions buyers actually ask
          </h2>
          <p className="text-neutral-500 text-base leading-relaxed">
            Everything a buyer asks us before signing, answered in plain language. For anything
            else, ask Zura — the assistant in the corner — or the team itself.
          </p>
        </header>

        <div className="mt-10 space-y-3">
          {HOME_QA.map((entry) => (
            <details
              key={entry.q}
              className="group rounded-2xl border border-neutral-200 bg-white p-5 open:shadow-sm"
            >
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4 text-sm font-bold text-neutral-900 marker:content-none">
                {entry.q}
                <span
                  aria-hidden="true"
                  className="text-cyan-700 text-lg leading-none transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-neutral-600">{entry.a}</p>
            </details>
          ))}
        </div>

        <p className="mt-8 text-xs leading-relaxed text-neutral-500">
          Prices settle in USD; local-currency figures anywhere on this site are display
          equivalents, and the amount shown at checkout is the amount charged. Ready to buy?{' '}
          <Link className="font-bold text-cyan-700" href="/#pricing">
            See the plan grid
          </Link>{' '}
          or{' '}
          <Link className="font-bold text-cyan-700" href="/contact">
            talk to a human
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

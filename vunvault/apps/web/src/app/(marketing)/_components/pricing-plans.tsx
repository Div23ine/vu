import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { cn, formatUsdWhole } from '@vunvault/lib';
import { PLANS, PLANS_FOOTNOTE } from './pricing-data';
import '../_styles/academy-pricing.css';

/**
 * Plans & Pricing section (Task 51) — data-driven from `pricing-data.ts` and
 * reused verbatim by the Services page (Task 54b). Server component: nothing
 * here is interactive beyond the links.
 *
 * The `#services-plans` span is the prototype's offset anchor (paired with
 * `.anchor-offset` in the stylesheet); the section itself carries `id="pricing"`
 * which is what the footer's `Pricing & Plans` link targets.
 *
 * Prices are rendered with `formatUsdWhole` (cents → `$2,499`) — the string on
 * screen is produced by the same formatter the billing screens use, never
 * hand-typed.
 */
export function PricingPlans() {
  return (
    <section id="pricing" className="py-14 md:py-20 bg-paper border-t border-neutral-200/80">
      <span id="services-plans" className="anchor-offset" aria-hidden="true" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-cyan-600 bg-cyan-50 px-3.5 py-1 rounded-full border border-cyan-200">
            Plans &amp; Pricing
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight">
            Accessible security pricing for African &amp; global tech
          </h2>
          <p className="text-neutral-500 text-sm md:text-base max-w-lg mx-auto">
            High-impact penetration testing and vulnerability assessments at balanced, competitive
            starting rates.
          </p>
        </div>

        <div className="vv-plan-grid">
          {PLANS.map((plan) => (
            <article
              key={plan.code}
              className={cn('vv-plan', plan.featured === true && 'vv-plan--featured')}
            >
              <header className="vv-plan-head">
                <h3 className="vv-plan-name">{plan.name}</h3>
                {plan.tag !== undefined ? <span className="vv-plan-tag">{plan.tag}</span> : null}
              </header>
              <div className="vv-plan-price">
                <span className="vv-plan-amount">{formatUsdWhole(plan.priceUsdCents)}</span>
                <span className="vv-plan-period">/ {plan.unit}</span>
              </div>
              <p className="vv-plan-desc">{plan.description}</p>
              <ul className="vv-plan-list">
                {plan.features.map((feature) => (
                  <li key={feature}>
                    <Check size={14} aria-hidden="true" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link href="/services#pricing" className="vv-plan-cta">
                <span>Learn More</span>
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>

        <p className="text-center text-xs text-neutral-500">{PLANS_FOOTNOTE}</p>
      </div>
    </section>
  );
}

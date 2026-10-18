import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { cn, formatUsdWhole } from '@vunvault/lib';
import { PLANS, type Plan } from '../../_components/pricing-data';
import '../_styles/services.css';

/**
 * Services pricing — replaces the an earlier iteration stub.
 *
 * CATALOG CONFLICT, resolved per its Behaviour + Tests sections (documented
 * in the run report): the embedded design markup shows a four-tier table
 * ($249 / $299 / $1,499 / Custom) whose copy cross-references prices that
 * contradict the shared constants ("Everything in Starter ($249), plus …"),
 * while the Behaviour mandates "prices come from the shared constants of
 * an earlier iteration (`pricing-data.ts`, `formatUsdWhole`)" and the Tests pin "three
 * plans show $299, $899, $2,499". One canonical price set wins: this section
 * renders an earlier iteration's three PLANS in the services styling (the reference
 * `.vv-plan*`/`.vv-price-grid` CSS ships in this task for exactly that), with
 * the services header, the shared footnote and CTAs carrying the
 * penetration-testing category query.
 *
 * CTA labels per the Behaviour text: the starter plan is `Start with
 * Starter`, the other tiers `Request Assessment`; both route to
 * `/contact?category=penetration_testing_request#contact-form`.
 */

const CONTACT_HREF = '/contact?category=penetration_testing_request#contact-form';

function ctaLabel(plan: Plan): string {
  return plan.code === 'starter_scan' ? 'Start with Starter' : 'Request Assessment';
}

export function ServicesPricing() {
  return (
    <section id="pricing" className="py-14 md:py-20 bg-paper border-t border-neutral-200/80">
      <span id="services-plans" className="anchor-offset" aria-hidden="true" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="vv-kicker">Plans &amp; Pricing</span>
          <h2 className="vv-section-title">Transparent scope. Transparent pricing.</h2>
          <p className="vv-section-lede">
            Every tier below lists exactly what is tested, what you receive and how long it takes.
            No hidden line items, no vague &quot;from&quot; pricing.
          </p>
        </div>

        <div className="vv-price-grid">
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
              <div className="vv-plan-scope">
                <span className="vv-plan-scope-label">Scope &amp; deliverables</span>
                <ul className="vv-plan-list vv-plan-list--tight">
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <Check size={14} aria-hidden="true" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link href={CONTACT_HREF} className="vv-plan-cta">
                <span>{ctaLabel(plan)}</span>
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>

        <p className="vv-price-note">
          All tiers include encrypted report delivery, a named engagement lead and a
          rules-of-engagement document signed under mutual NDA. Prices exclude applicable taxes.
          Re-test windows are measured from the date the final report is delivered.
        </p>
      </div>
    </section>
  );
}

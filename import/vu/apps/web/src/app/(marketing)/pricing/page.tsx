import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { PlansResponseSchema, FxRatesResponseSchema } from '@vunvault/contracts';
import { env } from '../../../env';
import { PlansClient, type CurrencyOption } from './plans-client';

export const metadata: Metadata = {
  alternates: { canonical: '/pricing' },
  title: 'Pricing',
  description:
    'Starter assessments, SACCO and fintech compliance assessments and enterprise retainers. Transparent USD pricing with local-currency equivalents.',
};

const UPDATED = '18 October 2026';

const FAQ: readonly { q: string; a: string }[] = [
  {
    q: 'What is included in every engagement?',
    a: 'A written scope and rules of engagement before any testing, manual validation of every automated finding, a prioritised remediation plan, and a closing call with the assessor who did the work — not a salesperson.',
  },
  {
    q: 'What do you need from us?',
    a: 'A technical contact, written authorisation for the scoped systems, and test-environment credentials where authenticated testing is in scope. Nothing leaves your estate without a signed scope.',
  },
  {
    q: 'How long does it take?',
    a: 'Starter assessments run about two weeks door-to-door. Compliance assessments take two to three weeks depending on evidence availability. Retainers begin monitoring in their first week.',
  },
  {
    q: 'What happens after payment?',
    a: 'You receive a receipt immediately, and an engagement coordinator emails you within one business day with a scoping questionnaire and two proposed kickoff slots. Work starts only after you sign the scope.',
  },
];

async function loadPlans() {
  try {
    const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/v1/plans`, {
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    const parsed = PlansResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.data : null;
  } catch {
    return null;
  }
}

async function loadRates(): Promise<Record<string, string> | null> {
  try {
    const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/v1/fx-rates`, {
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    const parsed = FxRatesResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.data.rates : null;
  } catch {
    return null;
  }
}

export default async function PricingPage() {
  const [plans, rates] = await Promise.all([loadPlans(), loadRates()]);
  const head = await headers();
  const cookieCurrency = head
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('vv_currency='))
    ?.slice('vv_currency='.length);
  const country = head.get('x-vv-country');
  const geoDefault: CurrencyOption = country === 'KE' ? 'KES' : 'USD';
  const initial =
    cookieCurrency === 'KES' ||
    cookieCurrency === 'GBP' ||
    cookieCurrency === 'EUR' ||
    cookieCurrency === 'USD'
      ? cookieCurrency
      : geoDefault;

  return (
    <section className="py-14 md:py-20 bg-paper">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="max-w-3xl space-y-4">
          <div className="flex items-center gap-2">
            <span className="h-[2px] w-6 bg-cyan-600 rounded-full" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">
              Pricing
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:5xl font-extrabold text-neutral-900 tracking-tight leading-[1.15]">
            Security pricing without a sales call
          </h1>
          <p className="text-neutral-500 text-base sm:text-lg leading-relaxed">
            Three ways to buy VUNVAULT, priced in USD and shown in your currency at the public rate.
            Pay by card; a human follows up within one business day.
          </p>
        </header>

        <div className="mt-10">
          {plans === null ? (
            <p className="text-neutral-500 text-sm">
              The plan catalogue is unreachable right now — email{' '}
              <code className="font-mono">info@vunvault.com</code> and we will quote you directly.
            </p>
          ) : (
            <PlansClient plans={plans} rates={rates} initialCurrency={initial} />
          )}
        </div>

        <section className="mt-16 max-w-3xl" aria-labelledby="pricing-faq">
          <h2 id="pricing-faq" className="text-2xl font-extrabold text-neutral-900">
            Questions buyers actually ask
          </h2>
          <dl className="mt-6 space-y-6">
            {FAQ.map((entry) => (
              <div key={entry.q}>
                <dt className="text-sm font-bold text-neutral-900">{entry.q}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-neutral-600">{entry.a}</dd>
              </div>
            ))}
          </dl>
        </section>
        <p className="mt-10 text-xs text-neutral-400">Prices reviewed {UPDATED}.</p>
      </div>
    </section>
  );
}

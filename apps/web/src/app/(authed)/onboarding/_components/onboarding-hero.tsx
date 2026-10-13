import { Clock, Lock, ShieldCheck } from 'lucide-react';
import '../_styles/onboarding.css';

/**
 * Onboarding hero (Task 64) — the verbatim eyebrow, two-line title, sub and
 * the three meta chips. Purely presentational: no directive, rendered by the
 * server page above the client wizard. The prototype's three
 * `REPLACE-WITH-LUCIDE` chip icons map to Lock (encrypted submission), Clock
 * (~2 minutes) and ShieldCheck (GDPR & DPA alignment).
 */

const META_CHIPS = [
  { Icon: Lock, label: '256-bit encrypted submission' },
  { Icon: Clock, label: '~2 minutes to complete' },
  { Icon: ShieldCheck, label: 'GDPR & DPA 2019 aligned' },
] as const;

export function OnboardingHero() {
  return (
    <section className="ob-hero">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          <span className="ob-eyebrow">
            <span className="ob-eyebrow-dot" aria-hidden="true" />
            Account setup · 3 steps
          </span>
          <h1 className="ob-title">
            {"Let's finish setting up"}
            <br />
            <span>your VUNVAULT workspace.</span>
          </h1>
          <p className="ob-sub">
            Tell us who you are and how you work. This information shapes your scan scope, your
            compliance mapping and the reporting format you receive. It takes about two minutes —
            and nothing is shared outside VUNVAULT.
          </p>
          <div className="ob-meta-row">
            {META_CHIPS.map(({ Icon, label }) => (
              <span key={label} className="ob-meta-chip">
                <Icon aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

import type { Metadata } from 'next';
import { ChangePasswordCard } from './_components/change-password-card';
import { RecoveryKeysCard } from './_components/recovery-keys-card';
import { SecurityHero } from './_components/security-hero';
import { TwoFactorCard } from './_components/two-factor-card';

/**
 * `/portal/security` — the Password Manager: change password with
 * the live rule checklist and strength meter, authenticator-app enrolment,
 * WebAuthn hardware keys and one-time recovery codes, all on the real
 * account-security API . The portal layout owns the
 * chrome and the session guard.
 */

export const metadata: Metadata = {
  title: 'Password Manager & Security',
  // Authed portal page — never indexable (the an earlier iteration auth-page family rule).
  robots: { index: false },
};

export default function SecurityPage() {
  return (
    <>
      <SecurityHero />
      <section className="pt-10 md:pt-12 pb-16 md:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="vpm-stack">
            <ChangePasswordCard />
            <TwoFactorCard />
            <RecoveryKeysCard />
          </div>
        </div>
      </section>
    </>
  );
}

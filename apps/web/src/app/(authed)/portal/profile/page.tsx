import type { Metadata } from 'next';
import { ProfileForm } from './_components/profile-form';
import { ProfileHero } from './_components/profile-hero';

/**
 * `/portal/profile` — the client profile: identity header with the
 * account stats, the four shortcut tiles and the personal/company details
 * form saved through `PATCH /api/v1/profile`. The portal layout
 * owns the chrome and the session guard.
 */

export const metadata: Metadata = {
  title: 'Client Profile',
  // Authed portal page — never indexable (the an earlier iteration auth-page family rule).
  robots: { index: false },
};

export default function ClientProfilePage() {
  return (
    <section className="pt-10 pb-16 md:pt-14 md:pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <ProfileHero />
        <ProfileForm />
      </div>
    </section>
  );
}

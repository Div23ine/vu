import type { Metadata } from 'next';
import { LicencesTable } from './_components/licences-table';
import './_styles/licences.css';

/**
 * `/portal/licences` — the client's purchased product licences:
 * key copy, the twelve-month update window and the secure download on the
 * an earlier iteration entitlements API. The portal layout owns the chrome
 * and the session guard.
 */

export const metadata: Metadata = {
  title: 'Your Licences',
  // Authed portal page — never indexable (the an earlier iteration auth-page family rule).
  robots: { index: false },
};

export default function LicencesPage() {
  return (
    <>
      <section className="pt-10 md:pt-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-4">
            <span className="vbl-eyebrow">Products</span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.15]">
              Your Licences
            </h1>
            <p className="text-neutral-500 text-base sm:text-lg leading-relaxed">
              Licence keys and downloads for the tools you have purchased. Updates are included for
              twelve months from purchase.
            </p>
          </div>
        </div>
      </section>

      <section className="pt-10 md:pt-12 pb-16 md:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <LicencesTable />
        </div>
      </section>
    </>
  );
}

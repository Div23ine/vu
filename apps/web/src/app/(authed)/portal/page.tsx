import type { Metadata } from 'next';
import { ScanSummaryCards } from './_components/scan-summary-cards';
import { ScansTable } from './_components/scans-table';
import './_styles/scans.css';

/**
 * `/portal` (Task 69) — the client's released scan reports: hero, the three
 * summary cards, the Request-PenTest hint card and the release-locked table.
 * The portal layout (Task 45) owns the chrome and the session guard.
 */

export const metadata: Metadata = {
  title: 'Your Security Reports',
  // Authed portal page — never indexable (the Task 63 auth-page family rule).
  robots: { index: false },
};

export default function PortalHomePage() {
  return (
    <>
      <section className="pt-10 md:pt-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-4">
            <span className="vps-eyebrow">Client Portal</span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.15]">
              Your Security Reports
            </h1>
            <p className="text-neutral-500 text-base sm:text-lg leading-relaxed">
              Released penetration test and vulnerability assessment reports for your organisation.
            </p>
          </div>
        </div>
      </section>

      <section className="pt-10 md:pt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScanSummaryCards />
        </div>
      </section>

      <section className="pt-10 md:pt-12 pb-16 md:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-6">
          <ScansTable />
        </div>
      </section>
    </>
  );
}

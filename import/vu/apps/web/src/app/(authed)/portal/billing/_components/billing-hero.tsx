import Link from 'next/link';
import '../_styles/billing.css';

/**
 * Billing hero — the verbatim eyebrow/title/sub from the design.
 * Purely presentational; no directive, so the server page renders it directly.
 * an earlier iteration adds the `My licences` link button to `/portal/licences`.
 */
export function BillingHero() {
  return (
    <section className="pt-10 md:pt-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl space-y-4">
          <span className="vbb-eyebrow">Billing & Account</span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.15]">
            Billing & Invoices
          </h1>
          <p className="text-neutral-500 text-base sm:text-lg leading-relaxed">
            Manage your subscription, update your payment method and download historical invoices
            for every VUNVAULT engagement.
          </p>
          <div className="pt-2">
            <Link href="/portal/licences" className="vbb-btn vbb-btn--ghost">
              My licences
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

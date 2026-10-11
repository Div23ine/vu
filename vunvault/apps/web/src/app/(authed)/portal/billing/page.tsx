import type { Metadata } from 'next';
import { BillingHero } from './_components/billing-hero';
import { InvoiceTable } from './_components/invoice-table';
import { PayInvoiceDialog } from './_components/pay-invoice-dialog';
import { PaymentMethodCard } from './_components/payment-method-card';
import { SubscriptionCard } from './_components/subscription-card';

/**
 * `/portal/billing` (Task 66; Task 66b mounts the Pay dialog). Subscription,
 * tokenised payment method with the Stripe-hosted Edit dialog, and the
 * invoice history with PDF/CSV downloads. `?invoice=<id>` (the Products
 * purchase hand-off, Task 55) is read once here and handed to the table,
 * which opens the Pay dialog through the store. The portal layout (Task 45)
 * owns the chrome and the session guard.
 */

export const metadata: Metadata = {
  title: 'Billing & Invoices',
  // Authed portal page — never indexable (the Task 63 auth-page family rule).
  robots: { index: false },
};

interface BillingPageProps {
  searchParams: Promise<{ invoice?: string }>;
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const params = await searchParams;
  return (
    <>
      <BillingHero />
      <section className="pt-10 md:pt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="vbb-grid-2">
            <SubscriptionCard />
            <PaymentMethodCard />
          </div>
        </div>
      </section>
      <InvoiceTable initialPayInvoiceId={params.invoice ?? null} />
      <PayInvoiceDialog />
    </>
  );
}

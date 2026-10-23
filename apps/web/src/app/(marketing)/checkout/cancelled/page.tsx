import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Checkout not completed',
  description: 'Your payment did not complete. No order was charged.',
};

export default function CheckoutCancelledPage() {
  return (
    <section className="py-14 md:py-20 bg-paper">
      <div className="max-w-md mx-auto px-4 sm:px-6 text-center space-y-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-700">
          Checkout not completed
        </p>
        <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">
          No payment was taken
        </h1>
        <p className="text-sm leading-relaxed text-neutral-600">
          The Paystack session ended without a successful charge, so no order was created and
          nothing was deducted. You can try again whenever you are ready — your plan selection is
          remembered for this session.
        </p>
        <p className="text-sm text-neutral-600">
          <Link className="font-bold text-cyan-700" href="/#pricing">
            Return to pricing
          </Link>{' '}
          or{' '}
          <Link className="font-bold text-cyan-700" href="/contact">
            ask a question first
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { NEXT_STEPS_AFTER_PAYMENT, OrderStatusResponseSchema } from '@vunvault/contracts';
import { env } from '../../../../../env';

export const metadata: Metadata = {
  title: 'Payment confirmed',
  description: 'Your VUNVAULT order is paid. Here is what happens next.',
};

interface Props {
  params: Promise<{ reference: string }>;
}

async function loadOrder(reference: string) {
  try {
    const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/v1/orders/${reference}`, {
      next: { revalidate: 0 },
    });
    if (!response.ok) return null;
    const parsed = OrderStatusResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.data : null;
  } catch {
    return null;
  }
}

export default async function CheckoutSuccessPage({ params }: Props) {
  const { reference } = await params;
  const order = await loadOrder(reference);

  return (
    <section className="py-14 md:py-20 bg-paper">
      <div className="max-w-lg mx-auto px-4 sm:px-6 text-center space-y-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
          Payment confirmed
        </p>
        <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">
          Thank you — your order is paid
        </h1>
        {order === null ? (
          <p className="text-sm text-neutral-600">
            We could not load the order summary for reference{' '}
            <code className="font-mono">{reference}</code>. Your receipt email has the same details;
            questions to accounts@vunvault.com.
          </p>
        ) : (
          <p className="text-sm text-neutral-600">
            <strong className="text-neutral-900">
              ${(order.usdCents / 100).toLocaleString('en-US')} USD
            </strong>{' '}
            for <strong className="text-neutral-900">{order.planCode.replaceAll('_', ' ')}</strong>{' '}
            — reference <code className="font-mono">{order.reference}</code>. A receipt is on its
            way to your inbox.
          </p>
        )}
        <ol className="mx-auto max-w-md space-y-2 text-left text-sm text-neutral-600 list-decimal pl-5">
          {NEXT_STEPS_AFTER_PAYMENT.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="text-sm text-neutral-600">
          <Link className="font-bold text-cyan-700" href="/">
            Back to the home page
          </Link>
        </p>
      </div>
    </section>
  );
}

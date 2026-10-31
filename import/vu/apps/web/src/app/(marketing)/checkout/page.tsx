'use client';

import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CreateOrderResponseSchema } from '@vunvault/contracts';
import { apiPost } from '../../../lib/api';
import { track } from '../../../lib/analytics';

/**
 * Guest checkout entry: pick nothing here but your email — the plan arrives
 * preselected via `?plan=`. Creating the order returns Paystack's hosted
 * checkout URL and the browser hands over; card data never passes through
 * VUNVAULT servers or this bundle.
 */

function CheckoutForm() {
  const params = useSearchParams();
  const plan = params.get('plan') ?? 'starter_scan';
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address for the receipt.');
      return;
    }
    setBusy(true);
    setError(null);
    track('checkout_start', { plan });
    try {
      const created = await apiPost<unknown>('/api/v1/orders', {
        planCode: plan,
        email,
      });
      const parsed = CreateOrderResponseSchema.safeParse(created);
      if (!parsed.success) throw new Error('Unexpected checkout response');
      window.location.assign(parsed.data.data.authorizationUrl);
    } catch (caught) {
      setBusy(false);
      setError(
        caught instanceof Error && caught.message !== ''
          ? caught.message
          : 'We could not start the checkout. Please try again.',
      );
    }
  }

  return (
    <section className="py-14 md:py-20 bg-paper">
      <div className="max-w-md mx-auto px-4 sm:px-6">
        <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">
          Continue to secure checkout
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          You are buying <strong className="text-neutral-900">{plan.replaceAll('_', ' ')}</strong>.
          Enter the email the receipt and kickoff contact should go to; Paystack handles the card on
          the next step. Charges settle in USD.
        </p>
        <form onSubmit={submit} noValidate className="mt-8 space-y-4">
          <div>
            <label htmlFor="checkout-email" className="block text-sm font-bold text-neutral-900">
              Email address
            </label>
            <input
              id="checkout-email"
              type="email"
              aria-required={true}
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-900 focus:border-cyan-600 focus:outline-none"
            />
          </div>
          {error !== null && (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700"
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-cyan-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-cyan-800 disabled:opacity-60"
          >
            {busy ? 'Preparing Paystack…' : 'Pay securely with Paystack'}
          </button>
          <p className="text-xs leading-relaxed text-neutral-500">
            Not ready to pay?{' '}
            <Link className="font-bold text-cyan-700" href="/#pricing">
              Back to pricing
            </Link>{' '}
            or{' '}
            <Link className="font-bold text-cyan-700" href="/contact">
              talk to us
            </Link>{' '}
            first.
          </p>
        </form>
      </div>
    </section>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutForm />
    </Suspense>
  );
}

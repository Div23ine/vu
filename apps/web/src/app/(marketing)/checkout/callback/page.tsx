'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { OrderStatusResponseSchema } from '@vunvault/contracts';
import { apiPost } from '../../../../lib/api';
import { track } from '../../../../lib/analytics';

/**
 * Paystack returns the buyer here. The callback is a rumour: this page
 * immediately asks the SERVER to verify the reference against Paystack, and
 * only the server's answer decides where the visitor goes next.
 */

function CallbackInner() {
  const params = useSearchParams();
  const reference = params.get('reference') ?? '';
  const started = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (reference === '' || started.current) return;
    started.current = true;
    void (async () => {
      try {
        const result = await apiPost<unknown>('/api/v1/orders/verify', { reference });
        const parsed = OrderStatusResponseSchema.safeParse(result);
        const status = parsed.success ? parsed.data.data.status : 'pending';
        if (status === 'paid') track('checkout_success', { reference });
        window.location.replace(
          status === 'paid'
            ? `/checkout/success/${encodeURIComponent(reference)}`
            : `/checkout/cancelled?reference=${encodeURIComponent(reference)}`,
        );
      } catch {
        setFailed(true);
      }
    })();
  }, [reference]);

  return (
    <section className="py-20 bg-paper text-center">
      <div className="max-w-md mx-auto px-4 space-y-3">
        <h1 className="text-2xl font-extrabold text-neutral-900">
          {failed ? 'We could not confirm that payment' : 'Confirming your payment…'}
        </h1>
        <p className="text-sm text-neutral-600">
          {failed
            ? 'Nothing has been charged incorrectly — verification simply could not complete. Try again, or contact accounts@vunvault.com with your reference.'
            : 'This takes a second. We verify every payment server-side before confirming.'}
        </p>
        {failed && reference !== '' && (
          <p className="text-xs font-mono text-neutral-500">Reference: {reference}</p>
        )}
      </div>
    </section>
  );
}

export default function CheckoutCallbackPage() {
  return (
    <Suspense fallback={null}>
      <CallbackInner />
    </Suspense>
  );
}

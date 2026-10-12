import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { env } from '../env';

/**
 * Lazy `loadStripe` singleton (Task 66).
 *
 * `@stripe/stripe-js` injects Stripe's script on first call — nothing loads
 * until a page actually opens the card dialog, and the promise is memoised so
 * the script is never fetched twice. No publishable key means stored-card
 * updates are unavailable: `getStripe()` resolves `null` and the dialog shows
 * the planner's copy instead of a broken form.
 *
 * The publishable key is public by design (it tokenises in the browser);
 * VUNVAULT never sees a raw card number — the API only ever receives the
 * PaymentMethod id (`UpdatePaymentMethodBody.providerPaymentMethodToken`).
 */

let stripePromise: Promise<Stripe | null> | null = null;

/** True when a publishable key is configured (browser or test env). */
export function stripeKeyConfigured(): boolean {
  const key = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  return key !== undefined && key !== '';
}

/** Resolves the Stripe instance, or `null` when no key is configured. */
export function getStripe(): Promise<Stripe | null> {
  if (!stripeKeyConfigured()) return Promise.resolve(null);
  if (stripePromise === null) {
    // Non-null assertion avoided: stripeKeyConfigured() just proved the key.
    stripePromise = loadStripe(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '');
  }
  return stripePromise;
}

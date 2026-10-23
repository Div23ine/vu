import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import type { SecretProvider } from '../../lib/secrets/provider';
import { StripeClient } from './stripe';
import { PaystackClient } from './paystack';

/**
 * Payment providers.
 *
 * Both clients are constructed here from secrets, so no route or service ever
 * touches a provider key. Tests inject `providers` instead and stub `fetch`.
 */

export interface PaymentProviders {
  stripe: StripeClient;
  paystack: PaystackClient;
}

export interface PaymentsPluginOptions {
  /** Test seam: inject clients instead of building them from secrets. */
  providers?: PaymentProviders;
  secrets?: SecretProvider;
}

const paymentsPlugin: FastifyPluginAsync<PaymentsPluginOptions> = async (app, options) => {
  if (options.providers !== undefined) {
    app.decorate('payments', options.providers);
    return;
  }

  const secrets = options.secrets ?? app.secrets;
  const [stripeKey, stripeWebhookSecret, paystackKey] = await Promise.all([
    secrets.get('STRIPE_SECRET_KEY'),
    secrets.get('STRIPE_WEBHOOK_SECRET'),
    secrets.get('PAYSTACK_SECRET_KEY'),
  ]);

  app.decorate('payments', {
    stripe: new StripeClient({ secretKey: stripeKey, webhookSecret: stripeWebhookSecret }),
    paystack: new PaystackClient({ secretKey: paystackKey }),
  });
};

export default fp(paymentsPlugin, { name: 'payments', dependencies: ['secrets'] });

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { z } from 'zod';
import {
  CreateOrderBodySchema,
  CreateOrderResponseSchema,
  FxRatesResponseSchema,
  NEXT_STEPS_AFTER_PAYMENT,
  OrderStatusResponseSchema,
  PlansResponseSchema,
  VerifyOrderBodySchema,
  type OrderSummary,
} from '@vunvault/contracts';
import { AUDITED, audited } from '../../../audit/audited';
import { asExecutor, type SqlExecutor } from '../../../audit/repo';
import { HttpFxRateSource, type FxCache, type FxRateSource } from '../../../billing/fx-rates';
import type { PaystackClient } from '../../../billing/providers/paystack';
import { resolveFxConfig } from '../../../config/env';
import { HttpError } from '../../../lib/http-error';
import type { Tx } from '../../../plugins/db';
import { SqlOrdersRepo, type OrdersRepo } from './repo';
import { OrdersService } from './service';

/**
 * Guest checkout: public plan catalogue, display rates, order creation,
 * server-side verification and order status.
 *
 * The card never touches VUNVAULT: creation returns Paystack's hosted
 * checkout URL, and money is believed only after `verifyTransaction` (or a
 * signature-valid webhook) confirms status, currency and the exact USD
 * amount against the stored order.
 */

export interface OrdersRoutesOptions {
  /** Test seams. */
  repo?: OrdersRepo;
  paystack?: PaystackClient;
  rates?: FxRateSource;
  sendEmail?: (input: { to: string; subject: string; text: string; html: string }) => Promise<void>;
  now?: () => Date;
}

function toSummary(row: {
  reference: string;
  plan_code: string;
  status: 'pending' | 'paid' | 'failed' | 'expired';
  usd_cents: number;
  display_currency: string;
  rate_local_per_usd: string | null;
  display_minor: number | null;
  paid_at: string | null;
  created_at: string;
}): OrderSummary {
  return {
    reference: row.reference,
    planCode: row.plan_code,
    status: row.status,
    usdCents: row.usd_cents,
    display:
      row.rate_local_per_usd === null || row.display_minor === null
        ? null
        : {
            currency: row.display_currency as OrderSummary['display'] extends null
              ? never
              : NonNullable<OrderSummary['display']>['currency'],
            rateLocalPerUsd: row.rate_local_per_usd,
            localMinor: row.display_minor,
          },
    paidAt: row.paid_at === null ? null : new Date(row.paid_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

const ordersRoutes: FastifyPluginAsync<OrdersRoutesOptions> = async (fastify, options) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  function repoFor(executor?: SqlExecutor): OrdersRepo {
    if (options.repo !== undefined) return options.repo;
    if (executor === undefined && !app.hasDecorator('db')) {
      throw new HttpError(503, 'service_unavailable', 'Orders are not available right now');
    }
    return new SqlOrdersRepo(executor ?? app.db);
  }

  let rates: FxRateSource | undefined;
  function rateSource(): FxRateSource {
    if (options.rates !== undefined) return options.rates;
    if (rates === undefined) {
      const fx = resolveFxConfig(app.env);
      rates = new HttpFxRateSource({
        url: fx.url,
        ttlSeconds: fx.ttlSeconds,
        cache: app.hasDecorator('redis') ? (app.redis as unknown as FxCache) : undefined,
        log: app.log,
      });
    }
    return rates;
  }

  function paystack(): PaystackClient {
    if (options.paystack !== undefined) return options.paystack;
    if (!app.hasDecorator('payments')) {
      throw new HttpError(503, 'payment_provider_unavailable', 'Payments are not configured');
    }
    return (app.payments as { paystack: PaystackClient }).paystack;
  }

  function serviceFor(executor?: SqlExecutor): OrdersService {
    return new OrdersService({
      repo: repoFor(executor),
      paystack: paystack(),
      fx: rateSource(),
      now: options.now,
      webOrigin: app.env.WEB_ORIGIN,
    });
  }

  interface ReceiptMessage {
    to: string;
    subject: string;
    text: string;
    html: string;
  }
  function receiptMessage(email: string, summary: OrderSummary): ReceiptMessage {
    const dollars = (summary.usdCents / 100).toFixed(2);
    return {
      to: email,
      subject: `VUNVAULT receipt — order ${summary.reference}`,
      text: [
        `Payment received: USD ${dollars} for plan ${summary.planCode}.`,
        `Reference: ${summary.reference}`,
        '',
        'What happens next:',
        ...NEXT_STEPS_AFTER_PAYMENT.map((step) => ` - ${step}`),
        '',
        'Questions about this payment? accounts@vunvault.com.',
      ].join('\n'),
      html: `<p>Payment received: <strong>USD ${dollars}</strong> for plan <strong>${summary.planCode}</strong> (reference <code>${summary.reference}</code>).</p><p>What happens next:</p><ul>${NEXT_STEPS_AFTER_PAYMENT.map((step) => `<li>${step}</li>`).join('')}</ul>`,
    };
  }
  async function sendReceipt(email: string, summary: OrderSummary): Promise<void> {
    const message = receiptMessage(email, summary);
    if (options.sendEmail !== undefined) {
      await options.sendEmail(message);
      return;
    }
    if (!app.hasDecorator('email')) return;
    const mailer = app as unknown as { email: { send: (input: ReceiptMessage) => Promise<void> } };
    await mailer.email.send(message);
  }

  // ------------------------------------------------------------------ plans
  app.get('/plans', {
    schema: { response: { 200: PlansResponseSchema } },
    handler: async (_request, reply) => {
      const plans = await repoFor().listActivePlans();
      return reply.status(200).send({
        data: plans.map((plan) => ({
          code: plan.code,
          name: plan.name,
          description: plan.description,
          unit: plan.unit,
          usdCents: plan.monthly_usd_cents,
        })),
      });
    },
  });

  // --------------------------------------------------------------- fx rates
  app.get('/fx-rates', {
    schema: { response: { 200: FxRatesResponseSchema } },
    handler: async (_request, reply) => {
      const table = await rateSource().getRateTable();
      const ratesOut: Record<string, string> = { USD: '1.00000000' };
      for (const [currency, value] of Object.entries(table.rates)) {
        ratesOut[currency] = String(value);
      }
      return reply.status(200).send({ data: { rates: ratesOut, fetchedAt: table.fetchedAt } });
    },
  });

  // ------------------------------------------------------------ create order
  app.post(
    '/orders',
    {
      config: { rateLimitPolicy: 'public_form' },
      schema: {
        body: CreateOrderBodySchema,
        response: { 201: CreateOrderResponseSchema },
      },
    },
    audited<FastifyRequest, z.infer<typeof CreateOrderResponseSchema>>(
      {
        eventType: 'PAYMENT_ATTEMPT_CREATED',
        subject: (_req, res) => res.data.reference,
        message: (_req, res) =>
          `Guest order ${res.data.reference} created for plan ${res.data.planCode} at ${res.data.usdCents} USD cents`,
        details: (_req, res) => ({
          planCode: res.data.planCode,
          usdCents: res.data.usdCents,
          displayCurrency: res.data.display?.currency ?? 'USD',
        }),
      },
      async (request, reply, ctx) => {
        const body = CreateOrderBodySchema.parse(request.body);
        const created = await serviceFor(asExecutor(ctx.tx)).createOrder(body);
        reply.status(201);
        return CreateOrderResponseSchema.parse({
          data: {
            ...toSummary(created.order),
            authorizationUrl: created.authorizationUrl,
          },
        });
      },
    ),
  );

  // ------------------------------------------------------------ verify order
  /**
   * Conditionally audited (same pattern as checkout): the audit entry is
   * appended by hand only when the state actually flips, so a replayed
   * verify writes nothing to the chain.
   */
  const verifyHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = VerifyOrderBodySchema.parse(request.body);
    const result = await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      const verified = await serviceFor(executor).verifyOrder(body.reference);
      if (verified.transitioned) {
        await app.audit.append(executor, {
          eventType: 'PAYMENT_CAPTURED',
          actor: { id: null, label: 'external' },
          subject: verified.order.reference,
          message: `Guest order ${verified.order.reference} verified success for ${verified.order.usd_cents} USD cents`,
          details: { planCode: verified.order.plan_code, source: 'verify' },
          ip: request.clientIp === '' ? request.ip : request.clientIp,
        });
      }
      return verified;
    });
    if (result.transitioned) {
      await sendReceipt(result.order.email, toSummary(result.order)).catch(() => undefined);
    }
    return reply
      .status(200)
      .send(OrderStatusResponseSchema.parse({ data: toSummary(result.order) }));
  };
  (verifyHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post('/orders/verify', {
    config: { rateLimitPolicy: 'sensitive' },
    schema: {
      body: VerifyOrderBodySchema,
      response: { 200: OrderStatusResponseSchema },
    },
    handler: verifyHandler,
  });

  // ----------------------------------------------------------- order status
  app.get('/orders/:reference', {
    config: { rateLimitPolicy: 'public_form' },
    schema: {
      response: { 200: OrderStatusResponseSchema },
    },
    handler: async (request, reply) => {
      const { reference } = request.params as { reference: string };
      const order = await repoFor().findGuestOrder(reference);
      if (order === null) {
        throw new HttpError(404, 'order_not_found', `No order with reference ${reference}`);
      }
      return reply.status(200).send(OrderStatusResponseSchema.parse({ data: toSummary(order) }));
    },
  });
};

export default fp(ordersRoutes, { name: 'orders-routes' });

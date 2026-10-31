import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { CheckoutBody, CheckoutResponse, FxQuote, FxQuoteRequest } from '@vunvault/contracts';
import { actorLabelFor, AUDITED, audited } from '../../../audit/audited.js';
import { asExecutor, type SqlExecutor } from '../../../audit/repo.js';
import type { Tx } from '../../../plugins/db.js';
import { HttpError } from '../../../lib/http-error.js';
import { resolveFxConfig } from '../../../config/env.js';
import type { PaymentProviders } from '../../../billing/providers/index.js';
import { HttpFxRateSource, type FxCache, type FxRateSource } from '../../../billing/fx-rates.js';
import { SqlCheckoutRepo, type CheckoutRepo } from './repo.js';
import { CheckoutService, FxService, type CheckoutResponseData } from './service.js';

/**
 * FX quotes and USD checkout (Task 33).
 *
 * Both routes need `billing:manage` and are scoped to the caller's organisation.
 * Neither accepts an amount: the charge is the invoice's outstanding USD cents,
 * read from the ledger-derived balance at checkout time. A quote changes what a
 * client is SHOWN and nothing else.
 *
 * The ledger is not written here. Only the signature-verified webhook (Task 34)
 * posts the capture entry — not even when a provider answers `succeeded` inside
 * this request.
 */

export interface CheckoutRoutesOptions {
  /** Test seams: in-memory fakes instead of the live database, Redis and network. */
  repo?: CheckoutRepo;
  rates?: FxRateSource;
  payments?: PaymentProviders;
}

function orgIdOf(request: FastifyRequest): string {
  const user = request.user;
  if (user === undefined) throw new HttpError(401, 'unauthorized');
  if (user.orgId === null || user.orgId === undefined) {
    throw new HttpError(403, 'no_org', 'This account is not attached to an organisation');
  }
  return user.orgId;
}

function actorOf(request: FastifyRequest): { id: string; label: string } {
  const user = request.user;
  if (user === undefined) throw new HttpError(401, 'unauthorized');
  return { id: user.id, label: actorLabelFor(user.email) };
}

const checkoutRoutes: FastifyPluginAsync<CheckoutRoutesOptions> = async (fastify, options) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  /** One repo per executor: the pool for reads, the route's transaction for writes. */
  function repoFor(executor?: SqlExecutor): CheckoutRepo {
    if (options.repo !== undefined) return options.repo;
    if (executor === undefined && !app.hasDecorator('db')) {
      throw new HttpError(503, 'service_unavailable', 'Checkout is not available');
    }
    return new SqlCheckoutRepo(executor ?? app.db);
  }

  /** Built once: the rate feed is stateless apart from its Redis cache. */
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

  function fxServiceFor(executor?: SqlExecutor): FxService {
    return new FxService({
      repo: repoFor(executor),
      rates: rateSource(),
      ttlSeconds: resolveFxConfig(app.env).ttlSeconds,
    });
  }

  function checkoutServiceFor(executor?: SqlExecutor): CheckoutService {
    const payments = options.payments ?? (app.hasDecorator('payments') ? app.payments : undefined);
    return new CheckoutService({ repo: repoFor(executor), payments });
  }

  // ------------------------------------------------------------- fx quotes
  app.post(
    '/billing/fx-quotes',
    {
      preHandler: [app.authenticate, app.requirePermission('billing:manage')],
      config: { rateLimitPolicy: 'sensitive' },
      schema: { body: FxQuoteRequest, response: { 201: z.object({ data: FxQuote }) } },
    },
    audited<FastifyRequest, { data: FxQuote }>(
      {
        eventType: 'FX_QUOTE_LOCKED',
        subject: (_req, res) => res.data.invoiceId,
        message: (_req, res) =>
          `Display rate locked for invoice ${res.data.invoiceId} in ${res.data.displayCurrency} at ${res.data.rateLocalPerUsd}`,
        // The locked rate and the DISPLAY amount. `usdCents` is the amount that will
        // be charged, recorded so a later dispute can be answered from the chain.
        details: (_req, res) => ({
          displayCurrency: res.data.displayCurrency,
          rateLocalPerUsd: res.data.rateLocalPerUsd,
          localMinor: res.data.localMinor,
          usdCents: res.data.usdCents,
        }),
      },
      async (request, reply, ctx) => {
        const body = FxQuoteRequest.parse(request.body);
        const data = await fxServiceFor(asExecutor(ctx.tx)).quote(orgIdOf(request), body);
        reply.status(201);
        return { data };
      },
    ),
  );

  // --------------------------------------------------------------- checkout
  /**
   * Audited conditionally rather than through `audited()`, so a replay of an
   * idempotency key writes nothing: no attempt was created, and a second
   * `PAYMENT_ATTEMPT_CREATED` entry would be a lie in an append-only log. The
   * write and the entry still commit in ONE transaction.
   */
  const checkoutHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = CheckoutBody.parse(request.body);
    const orgId = orgIdOf(request);
    const actor = actorOf(request);

    const outcome = await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      const result = await checkoutServiceFor(executor).checkout(orgId, actor.id, body);

      if (result.kind === 'created' && result.attempt !== undefined) {
        await app.audit.append(executor, {
          eventType: 'PAYMENT_ATTEMPT_CREATED',
          actor: { id: actor.id, label: actor.label },
          subject: result.attempt.id,
          message: `${actor.label} started a ${result.attempt.provider} ${result.attempt.channel} payment of ${result.attempt.usdCents} USD cents against invoice ${result.attempt.invoiceId}`,
          details: {
            provider: body.provider,
            channel: body.channel,
            usdCents: result.attempt.usdCents,
          },
          ip: request.clientIp === '' ? request.ip : request.clientIp,
        });
      }
      return result;
    });

    reply.status(outcome.kind === 'replay' ? 200 : 201);
    const data: CheckoutResponseData = outcome.data;
    return CheckoutResponse.parse({ data });
  };
  (checkoutHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post('/billing/checkout', {
    preHandler: [app.authenticate, app.requirePermission('billing:manage')],
    config: { rateLimitPolicy: 'sensitive' },
    schema: {
      body: CheckoutBody,
      // 200 is the idempotent replay of an attempt that already exists.
      response: { 200: CheckoutResponse, 201: CheckoutResponse },
    },
    handler: checkoutHandler,
  });
};

export default fp(checkoutRoutes, { name: 'checkout-routes' });

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { WebhookAck } from '@vunvault/contracts';
import { AUDITED } from '../../../audit/audited.js';
import { asExecutor, type SqlExecutor } from '../../../audit/repo.js';
import type { Tx } from '../../../plugins/db.js';
import { HttpError } from '../../../lib/http-error.js';
import { LedgerService } from '../../../billing/ledger.js';
import { SqlPaymentsRepo, type PaymentsRepo } from '../payments-admin/repo.js';
import { SYSTEM_ACTOR, WebhookService, type WebhookEvent } from './service.js';

/**
 * Provider webhooks (Task 34).
 *
 * Unauthenticated by design and exempt from CSRF: the signature IS the
 * authentication, and it is computed over the raw bytes, which is why these two
 * routes are the only ones in the API that opt into `config.rawBody`.
 *
 * The response contract is deliberately narrow. `200 { received: true }` for
 * anything we accepted — including events we store and ignore, and replays.
 * `401 { error: "bad_signature" }` when the signature does not verify. `500` when
 * processing fails, because a 500 is what makes the provider send it again, and
 * the event row rolls back with the transaction so the retry is not treated as a
 * replay.
 */

export interface WebhooksRoutesOptions {
  /** Test seams: in-memory fakes instead of the live database and providers. */
  repo?: PaymentsRepo;
  ledger?: Pick<LedgerService, 'post'>;
  service?: WebhookService;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value === '' ? undefined : value;
}

const webhooksRoutes: FastifyPluginAsync<WebhooksRoutesOptions> = async (fastify, options) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  function repoFor(executor?: SqlExecutor): PaymentsRepo {
    if (options.repo !== undefined) return options.repo;
    if (executor === undefined && !app.hasDecorator('db')) {
      throw new HttpError(503, 'service_unavailable', 'Webhooks are not available');
    }
    return new SqlPaymentsRepo(executor ?? app.db);
  }

  function serviceFor(executor?: SqlExecutor): WebhookService {
    if (options.service !== undefined) return options.service;
    return new WebhookService({
      repo: repoFor(executor),
      ledger: options.ledger ?? new LedgerService(),
      audit: app.audit,
      payments: app.payments,
      enqueue: app.hasDecorator('queues')
        ? async (payload) => {
            await app.queues.notify.add(payload.channel, payload);
          }
        : undefined,
      log: app.log,
    });
  }

  /**
   * A rejected signature is a security event, and it is recorded in its own short
   * transaction: there is no domain transaction to join, because nothing was
   * accepted. Never throws — the client is owed the 401.
   */
  async function auditSignatureFailure(
    request: FastifyRequest,
    provider: 'stripe' | 'paystack',
    error: unknown,
  ): Promise<void> {
    try {
      await app.withTx(async (tx: Tx) => {
        await app.audit.append(asExecutor(tx), {
          eventType: 'WEBHOOK_SIGNATURE_INVALID',
          actor: SYSTEM_ACTOR,
          subject: provider,
          message: `${provider} webhook rejected: the signature did not verify`,
          details: {
            provider,
            reason: error instanceof Error ? error.message : String(error),
          },
          ip: request.clientIp === '' ? request.ip : request.clientIp,
        });
      });
    } catch {
      app.log.error({ requestId: request.id }, 'could not record an invalid webhook signature');
    }
  }

  async function receive(
    request: FastifyRequest,
    reply: FastifyReply,
    provider: 'stripe' | 'paystack',
    signatureHeader: string,
  ): Promise<{ received: true }> {
    const signature = headerValue(request.headers[signatureHeader]);
    const verifier = serviceFor();

    let event: WebhookEvent;
    try {
      event =
        provider === 'stripe'
          ? verifier.parseStripe(request.rawBody, signature)
          : verifier.parsePaystack(request.rawBody, signature);
    } catch (error) {
      await auditSignatureFailure(request, provider, error);
      throw error;
    }

    await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      await serviceFor(executor).handle(executor, provider, event);
    });

    return reply.status(200).send({ received: true });
  }

  const stripeHandler = async (request: FastifyRequest, reply: FastifyReply) =>
    receive(request, reply, 'stripe', 'stripe-signature');
  (stripeHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  const paystackHandler = async (request: FastifyRequest, reply: FastifyReply) =>
    receive(request, reply, 'paystack', 'x-paystack-signature');
  (paystackHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post('/webhooks/stripe', {
    config: { rawBody: true, csrf: false, rateLimitPolicy: 'webhook' },
    schema: { response: { 200: WebhookAck } },
    handler: stripeHandler,
  });

  app.post('/webhooks/paystack', {
    config: { rawBody: true, csrf: false, rateLimitPolicy: 'webhook' },
    schema: { response: { 200: WebhookAck } },
    handler: paystackHandler,
  });
};

export default fp(webhooksRoutes, { name: 'webhooks-routes' });

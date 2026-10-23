import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { NewsletterSubscribeBody, NewsletterTokenBody } from '@vunvault/contracts';
import { AUDITED, audited } from '../../../audit/audited';
import { asExecutor, type SqlExecutor } from '../../../audit/repo';
import type { Tx } from '../../../plugins/db';
import { HttpError } from '../../../lib/http-error';
import { SqlNewsletterRepo, type NewsletterRepo } from '../store/repo';
import { NewsletterService, type AuditInstruction } from './service';

/**
 * Newsletter signup, confirmation and unsubscribe (Task 40c).
 *
 * All three are public and all three are rate-limited by the `public_form` policy:
 * this is an anonymous write endpoint that sends email, which makes it a target for
 * both list pollution and mail-bombing somebody's inbox.
 *
 * Subscribe answers `202 {}` and nothing else, for an address nobody has heard of
 * and for one that has been subscribed for years. The confirmation and unsubscribe
 * routes are the audited ones, because that is where a fact about a person changes.
 */

export interface NewsletterRoutesOptions {
  /** Test seams. */
  repo?: NewsletterRepo;
  sendEmail?: (input: { to: string; subject: string; text: string; html: string }) => Promise<void>;
  confirmUrl?: (token: string) => string;
  ipSaltPepper?: string;
}

const newsletterRoutes: FastifyPluginAsync<NewsletterRoutesOptions> = async (fastify, options) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  function repoFor(executor?: SqlExecutor): NewsletterRepo {
    if (options.repo !== undefined) return options.repo;
    if (executor === undefined && !app.hasDecorator('db')) {
      throw new HttpError(503, 'service_unavailable', 'The newsletter is not available');
    }
    return new SqlNewsletterRepo(executor ?? app.db);
  }

  function serviceFor(executor?: SqlExecutor): NewsletterService {
    return new NewsletterService({
      repo: repoFor(executor),
      sendEmail:
        options.sendEmail ??
        (app.hasDecorator('email')
          ? async (input) => {
              await app.email.send(input);
            }
          : undefined),
      confirmUrl:
        options.confirmUrl ??
        ((token: string) => `${app.env.WEB_ORIGIN}/newsletter/confirm?token=${token}`),
      ipSaltPepper: options.ipSaltPepper ?? '',
    });
  }

  function ipOf(request: FastifyRequest): string {
    return request.clientIp === '' ? request.ip : request.clientIp;
  }

  // ------------------------------------------------------------- subscribe
  /**
   * Audited by hand — which here means not at all. A `pending` row is an intention,
   * not a fact about a person, and recording one per form submission would fill the
   * chain with addresses that never confirmed. `NEWSLETTER_SUBSCRIBED` is written on
   * confirm instead.
   */
  const subscribeHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = NewsletterSubscribeBody.parse(request.body);
    await app.withTx(async (tx: Tx) => {
      await serviceFor(asExecutor(tx)).subscribe({
        email: body.email,
        source: body.source,
        ip: ipOf(request),
      });
    });
    // The same answer for every outcome: existence is not public information.
    return reply.status(202).send({});
  };
  (subscribeHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post('/newsletter', {
    config: { rateLimitPolicy: 'public_form' },
    schema: { body: NewsletterSubscribeBody, response: { 202: z.object({}) } },
    handler: subscribeHandler,
  });

  /**
   * A 204 has no body to carry the audit instruction back on, so the handler hands
   * it to the spec through the request. Per request, never a shared variable.
   */
  const instructions = new WeakMap<FastifyRequest, AuditInstruction>();

  function tokenRoute(
    path: '/newsletter/confirm' | '/newsletter/unsubscribe',
    eventType: 'NEWSLETTER_SUBSCRIBED' | 'NEWSLETTER_UNSUBSCRIBED',
    fallbackMessage: string,
    action: 'confirm' | 'unsubscribe',
  ): void {
    app.post(
      path,
      {
        config: { rateLimitPolicy: 'public_form' },
        schema: { body: NewsletterTokenBody, response: { 204: z.null() } },
      },
      audited<FastifyRequest, void>(
        {
          eventType,
          subject: (req) => instructions.get(req)?.subject,
          message: (req) => instructions.get(req)?.message ?? fallbackMessage,
          details: (req) => instructions.get(req)?.details ?? {},
          // Nobody is signed in: the token is the identity, and it is not a person
          // the chain can name.
          actor: () => ({ id: null, label: 'external' }),
        },
        async (request, reply, ctx) => {
          const body = NewsletterTokenBody.parse(request.body);
          const result = await serviceFor(asExecutor(ctx.tx))[action](body.token);
          const instruction = result.audit[0];
          if (instruction !== undefined) instructions.set(request, instruction);
          reply.status(204);
          return reply.send(null);
        },
      ),
    );
  }

  // --------------------------------------------------------------- confirm
  tokenRoute(
    '/newsletter/confirm',
    'NEWSLETTER_SUBSCRIBED',
    'Newsletter subscription confirmed',
    'confirm',
  );

  // ----------------------------------------------------------- unsubscribe
  tokenRoute(
    '/newsletter/unsubscribe',
    'NEWSLETTER_UNSUBSCRIBED',
    'Newsletter subscription removed',
    'unsubscribe',
  );
};

export default fp(newsletterRoutes, { name: 'newsletter-routes' });

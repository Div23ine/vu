import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ContactBody, ConsentBody } from '@vunvault/contracts';
import { AUDITED, audited } from '../../../audit/audited.js';
import { asExecutor, type SqlExecutor } from '../../../audit/repo.js';
import type { Tx } from '../../../plugins/db.js';
import { HttpError } from '../../../lib/http-error.js';
import { HttpTurnstileVerifier, turnstileEnforced, type TurnstileVerifier } from './turnstile.js';
import {
  ANONYMOUS_COOKIE,
  ANONYMOUS_COOKIE_MAX_AGE_SECONDS,
  SqlPublicRepo,
  type PublicRepo,
} from './repo.js';
import {
  ContactService,
  ConsentService,
  type AuditInstruction,
  type ContactOutcome,
} from './service.js';

/**
 * Public intake (Task 40).
 *
 * Two routes with no session behind them, which makes them the most abused surface
 * the API has. Both are rate-limited by the `public_form` policy, both hash the
 * caller's address with a daily salt instead of storing it, and the contact form
 * carries a honeypot field and (optionally) a Turnstile check.
 *
 * The CSRF hook does not apply: it only guards requests carrying a session cookie,
 * and these carry none. Rate limiting is the protection for an anonymous form.
 */

/** `ContactBody` plus the two fields the contract does not model: the honeypot and
 * the bot-check token. Extending keeps every rule the contract enforces. */
const ContactBodyWithBotFields = ContactBody.extend({
  /** Never rendered by the real form. A bot fills it in; we then do nothing. */
  website: z.string().max(200).optional(),
  turnstileToken: z.string().max(2048).optional(),
});

const ConsentBodyWithToken = ConsentBody.extend({
  turnstileToken: z.string().max(2048).optional(),
});

export interface PublicRoutesOptions {
  /** Test seams. */
  repo?: PublicRepo;
  turnstile?: TurnstileVerifier;
  engagementInbox?: string;
  supportInbox?: string;
  ipSaltPepper?: string;
}

const publicRoutes: FastifyPluginAsync<PublicRoutesOptions> = async (fastify, options) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  function repoFor(executor?: SqlExecutor): PublicRepo {
    if (options.repo !== undefined) return options.repo;
    if (executor === undefined && !app.hasDecorator('db')) {
      throw new HttpError(503, 'service_unavailable', 'Public intake is not available');
    }
    return new SqlPublicRepo(executor ?? app.db);
  }

  let turnstile: TurnstileVerifier | undefined;
  async function verifier(): Promise<TurnstileVerifier> {
    if (options.turnstile !== undefined) return options.turnstile;
    if (turnstile === undefined) {
      turnstile = new HttpTurnstileVerifier({
        enforced: turnstileEnforced(),
        secretKey: app.hasDecorator('secrets')
          ? await app.secrets.get('TURNSTILE_SECRET_KEY').catch(() => undefined)
          : undefined,
        log: app.log,
      });
    }
    return turnstile;
  }

  async function contactService(executor?: SqlExecutor): Promise<ContactService> {
    return new ContactService({
      repo: repoFor(executor),
      turnstile: await verifier(),
      engagementInbox: options.engagementInbox ?? process.env.ENGAGEMENT_INBOX ?? '',
      supportInbox: options.supportInbox ?? process.env.SUPPORT_INBOX ?? '',
      ipSaltPepper: options.ipSaltPepper ?? '',
    });
  }

  function consentService(executor?: SqlExecutor): ConsentService {
    return new ConsentService({
      repo: repoFor(executor),
      ipSaltPepper: options.ipSaltPepper ?? '',
    });
  }

  function ipOf(request: FastifyRequest): string {
    return request.clientIp === '' ? request.ip : request.clientIp;
  }

  // ---------------------------------------------------------------- contact
  /**
   * Audited by hand: a honeypot hit answers 201 and must write NOTHING, not even a
   * chain entry, because the point is that the bot cannot tell the difference.
   */
  const contactHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = ContactBodyWithBotFields.parse(request.body);

    const outcome: ContactOutcome = await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      const service = await contactService(executor);
      const result = await service.submit(body, {
        ip: ipOf(request),
        userAgent: request.headers['user-agent'] ?? null,
      });
      for (const instruction of result.audit as AuditInstruction[]) {
        await app.audit.append(executor, {
          eventType: instruction.eventType,
          // An anonymous visitor: no account to name.
          actor: { id: null, label: 'external' },
          subject: instruction.subject,
          message: instruction.message,
          details: instruction.details,
          ip: ipOf(request),
        });
      }
      return result;
    });

    if (outcome.stored && app.hasDecorator('queues')) {
      for (const email of outcome.emails) {
        // Delivery is best-effort: the message is stored either way, and losing a
        // notification must not lose the enquiry.
        await app.queues.notify
          .add('email', { channel: 'email', ...email })
          .catch((error: unknown) =>
            app.log.warn({ err: error }, 'could not queue a contact email'),
          );
      }
    }

    return reply.status(201).send({ data: { id: outcome.id } });
  };
  (contactHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post('/contact', {
    config: { rateLimitPolicy: 'public_form' },
    schema: {
      body: ContactBodyWithBotFields,
      response: { 201: z.object({ data: z.object({ id: z.string().uuid() }) }) },
    },
    handler: contactHandler,
  });

  // ---------------------------------------------------------------- consent
  app.post(
    '/consent',
    {
      // `optionalAuth`: a signed-in user's consent is attached to their account,
      // and a visitor's to the anonymous cookie. It must never reject.
      preHandler: [app.optionalAuth],
      config: { rateLimitPolicy: 'public_form' },
      schema: { body: ConsentBodyWithToken, response: { 204: z.null() } },
    },
    audited<FastifyRequest, void>(
      {
        eventType: 'CONSENT_RECORDED',
        message: (req) =>
          `Consent recorded for policy ${ConsentBodyWithToken.parse(req.body).policyVersion}`,
        details: (req) => {
          const categories = ConsentBodyWithToken.parse(req.body).categories;
          return {
            analytics: categories.analytics,
            marketing: categories.marketing,
            functional: categories.functional,
          };
        },
      },
      async (request, reply, ctx) => {
        const body = ConsentBodyWithToken.parse(request.body);
        const user = request.user;

        let anonymousId = request.cookies?.[ANONYMOUS_COOKIE] ?? null;
        if (user === undefined && (anonymousId === null || anonymousId === '')) {
          anonymousId = crypto.randomUUID();
          // HttpOnly, Secure outside development, Lax, one year: an identifier for
          // consent only. A script-readable cookie would be a tracking vector.
          reply.setCookie(ANONYMOUS_COOKIE, anonymousId, {
            httpOnly: true,
            secure: app.env.NODE_ENV !== 'development',
            sameSite: 'lax',
            path: '/',
            maxAge: ANONYMOUS_COOKIE_MAX_AGE_SECONDS,
            domain: app.env.COOKIE_DOMAIN === '' ? undefined : app.env.COOKIE_DOMAIN,
          });
        }

        await consentService(asExecutor(ctx.tx)).record({
          userId: user?.id ?? null,
          anonymousId,
          categories: body.categories,
          policyVersion: body.policyVersion,
          ip: ipOf(request),
          userAgent: request.headers['user-agent'] ?? null,
        });

        return reply.status(204).send(null);
      },
    ),
  );
};

export default fp(publicRoutes, { name: 'public-routes' });

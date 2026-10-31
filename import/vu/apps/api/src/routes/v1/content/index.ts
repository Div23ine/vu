import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { UserRole } from '@vunvault/contracts';
import {
  ModerationActionBody,
  ModerationItem,
  ModerationQuery,
  PublicContentDetail,
  PublicContentItem,
  PublicContentQuery,
} from '@vunvault/contracts';
import { AUDITED } from '../../../audit/audited.js';
import { asExecutor, type SqlExecutor } from '../../../audit/repo.js';
import type { Tx } from '../../../plugins/db.js';
import { HttpError } from '../../../lib/http-error.js';
import { SqlContentRepo, type ContentRepo } from './repo.js';
import { ModerationService, type AuditInstruction } from './service.js';

/**
 * Content moderation and the public feed (Task 36).
 *
 * The admin queue is staff-only and AAL2. The public feed is the one content route
 * with no authentication at all, and it can only ever return a published item with
 * an author's name on it — no ids, no email, no draft, no risk flag.
 */

const ItemIdParams = z.object({ id: z.string().uuid() });

/** A public slug: the last segment of a `slug_path`, e.g. `accra-soc-hub`. */
const ContentSlugParams = z.object({ slug: z.string().min(1).max(200) });

const ModerationListResponse = z.object({
  data: z.array(ModerationItem),
  total: z.number(),
});

export interface ContentRoutesOptions {
  /** Test seams. */
  repo?: ContentRepo;
  service?: ModerationService;
  notifyAuthor?: (input: {
    to: string;
    template: string;
    vars: Record<string, string>;
  }) => Promise<void>;
}

const contentRoutes: FastifyPluginAsync<ContentRoutesOptions> = async (fastify, options) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  function repoFor(executor?: SqlExecutor): ContentRepo {
    if (options.repo !== undefined) return options.repo;
    if (executor === undefined && !app.hasDecorator('db')) {
      throw new HttpError(503, 'service_unavailable', 'Content is not available');
    }
    return new SqlContentRepo(executor ?? app.db);
  }

  function serviceFor(executor?: SqlExecutor): ModerationService {
    if (options.service !== undefined) return options.service;
    return new ModerationService({
      repo: repoFor(executor),
      notifyAuthor:
        options.notifyAuthor ??
        (app.hasDecorator('queues')
          ? async (input) => {
              await app.queues.notify.add('email', { channel: 'email', ...input });
            }
          : undefined),
    });
  }

  const adminGuard = [
    app.authenticate,
    app.requireStaff,
    app.requirePermission('content:moderate'),
  ];

  // ------------------------------------------------------- admin: the queue
  app.get(
    '/admin/content/summary',
    {
      preHandler: adminGuard,
      schema: {
        response: {
          200: z.object({
            data: z.object({
              awaitingReview: z.number(),
              changesRequested: z.number(),
              approvedToday: z.number(),
              rejectedLast7Days: z.number(),
              avgReviewHours: z.number(),
              publishedLast30Days: z.number(),
            }),
          }),
        },
      },
    },
    async () => ({ data: await serviceFor().summary() }),
  );

  app.get(
    '/admin/content',
    {
      preHandler: adminGuard,
      schema: { querystring: ModerationQuery, response: { 200: ModerationListResponse } },
    },
    async (request) => {
      const query = ModerationQuery.parse(request.query);
      return serviceFor().list(query);
    },
  );

  // ------------------------------------------------------ admin: an action
  /**
   * Audited by hand: the event depends on the action (`CONTENT_PUBLISHED` for a
   * publish, `CONTENT_REVIEWED` for everything else), and the decision row and the
   * entry must commit together.
   */
  const actionHandler = async (request: FastifyRequest, _reply: FastifyReply) => {
    const { id } = ItemIdParams.parse(request.params);
    const body = ModerationActionBody.parse(request.body);
    const user = request.user;
    if (user === undefined) throw HttpError.unauthorized();

    const result = await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      const outcome = await serviceFor(executor).act(
        id,
        { id: user.id, email: user.email, role: user.role as UserRole },
        body,
      );
      for (const instruction of outcome.audit as AuditInstruction[]) {
        await app.audit.append(executor, {
          eventType: instruction.eventType,
          actor: { id: user.id, label: user.email.split('@')[0] ?? user.email },
          subject: instruction.subject,
          message: instruction.message,
          details: instruction.details,
          ip: request.clientIp === '' ? request.ip : request.clientIp,
        });
      }
      return outcome;
    });

    return { data: result.item };
  };
  (actionHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post('/admin/content/:id/actions', {
    preHandler: adminGuard,
    config: { rateLimitPolicy: 'sensitive' },
    schema: {
      params: ItemIdParams,
      body: ModerationActionBody,
      response: { 200: z.object({ data: ModerationItem }) },
    },
    handler: actionHandler,
  });

  // --------------------------------------------------------- public: feed
  /**
   * Public and cacheable. The projection is built in the service, so the list and
   * the article route cannot disagree about what a visitor is allowed to see.
   */
  app.get(
    '/content',
    {
      schema: {
        querystring: PublicContentQuery,
        response: { 200: z.object({ data: z.array(PublicContentItem), total: z.number() }) },
      },
    },
    async (request, reply) => {
      const query = PublicContentQuery.parse(request.query);
      // A minute of edge caching: the feed is public and changes rarely.
      reply.header('Cache-Control', 'public, max-age=60');
      return serviceFor().publicList(query);
    },
  );

  app.get(
    '/content/:slug',
    {
      schema: {
        params: ContentSlugParams,
        response: { 200: z.object({ data: PublicContentDetail }) },
      },
    },
    async (request, reply) => {
      const { slug } = ContentSlugParams.parse(request.params);
      reply.header('Cache-Control', 'public, max-age=60');
      return { data: await serviceFor().publicDetail(slug) };
    },
  );
};

export default fp(contentRoutes, { name: 'content-routes' });

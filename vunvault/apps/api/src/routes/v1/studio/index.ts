import type {
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
  preHandlerHookHandler,
} from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { StudioDraftBody, StudioImageUploadRequest, StudioItem } from '@vunvault/contracts';
import { audited, AUDITED } from '../../../audit/audited';
import { asExecutor, type SqlExecutor } from '../../../audit/repo';
import type { Tx } from '../../../plugins/db';
import { HttpError } from '../../../lib/http-error';
import type { ObjectStorage } from '../../../lib/object-storage';
import { SqlContentRepo, type ContentRepo } from '../content/repo';
import type { AuditInstruction } from '../content/service';
import { StudioService } from './service';

/**
 * The Content Studio (Task 36).
 *
 * `GET /studio/status` is callable by ANY authenticated user and never 403s: the
 * web app needs the answer to decide whether to render the editor or the
 * "Verified Journalist / Blogger badge required" screen. Everything else is behind
 * `requireBlogger`, which reads the badge from the database on every request —
 * there is no browser storage involved anywhere, and no client claim is trusted.
 */

const DraftIdParams = z.object({ id: z.string().uuid() });
const StudioItemResponse = z.object({ data: StudioItem });
const StudioItemListResponse = z.object({ data: z.array(StudioItem), total: z.number() });

export interface StudioRoutesOptions {
  /** Test seams. */
  repo?: ContentRepo;
  storage?: ObjectStorage;
  notify?: (input: { userId: string; title: string; body: string }) => Promise<void>;
}

const studioRoutes: FastifyPluginAsync<StudioRoutesOptions> = async (fastify, options) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  /** Survives the per-request services so the draft-save throttle actually throttles. */
  const draftAuditLog = new Map<string, number>();

  function repoFor(executor?: SqlExecutor): ContentRepo {
    if (options.repo !== undefined) return options.repo;
    if (executor === undefined && !app.hasDecorator('db')) {
      throw new HttpError(503, 'service_unavailable', 'The Studio is not available');
    }
    return new SqlContentRepo(executor ?? app.db);
  }

  function serviceFor(executor?: SqlExecutor): StudioService {
    return new StudioService({
      repo: repoFor(executor),
      draftAuditLog,
      storage: options.storage ?? (app.hasDecorator('storage') ? app.storage : undefined),
      notify:
        options.notify ??
        (app.hasDecorator('notify')
          ? async ({ userId, title, body }) => {
              await app.notify.dispatch({
                userId,
                event: 'content_awaiting_moderation',
                title,
                body,
                critical: false,
              });
            }
          : undefined),
    });
  }

  /** The badge: `profiles.verified_blogger_at` or a role that may author content. */
  const requireBlogger: preHandlerHookHandler = async (request) => {
    const user = request.user;
    if (user === undefined) throw HttpError.unauthorized();
    await serviceFor().requireBlogger(user.id, user.role);
  };

  // ------------------------------------------------------------- status
  app.get(
    '/studio/status',
    {
      preHandler: [app.authenticate],
      schema: {
        response: {
          200: z.object({
            data: z.object({
              verified: z.boolean(),
              verifiedAt: z.string().datetime().nullable(),
              displayName: z.string(),
            }),
          }),
        },
      },
    },
    async (request) => {
      const user = request.user;
      if (user === undefined) throw HttpError.unauthorized();
      return { data: await serviceFor().status(user.id) };
    },
  );

  // --------------------------------------------------------- submissions
  app.get(
    '/studio/submissions',
    {
      preHandler: [app.authenticate, requireBlogger],
      schema: { response: { 200: StudioItemListResponse } },
    },
    async (request) => {
      const user = request.user;
      if (user === undefined) throw HttpError.unauthorized();
      return serviceFor().submissions(user.id);
    },
  );

  /**
   * Drafts audit by hand rather than through `audited()`: a save is written to the
   * chain at most once a minute per item, so an unconditional entry would fill the
   * log with somebody typing.
   */
  function draftHandler(mode: 'create' | 'update') {
    const handler = async (request: FastifyRequest, reply: FastifyReply) => {
      const body = StudioDraftBody.parse(request.body);
      const user = request.user;
      if (user === undefined) throw HttpError.unauthorized();

      const result = await app.withTx(async (tx: Tx) => {
        const executor = asExecutor(tx);
        const service = serviceFor(executor);
        const outcome =
          mode === 'create'
            ? { item: await service.createDraft(user.id, body), audit: [] as AuditInstruction[] }
            : await service.updateDraft(user.id, DraftIdParams.parse(request.params).id, body);

        // The save and its chain entry commit together, or neither happens.
        for (const instruction of outcome.audit) {
          await app.audit.append(executor, {
            eventType: instruction.eventType,
            actor: { id: user.id, label: user.email.split('@')[0] ?? user.email },
            subject: instruction.subject,
            message: instruction.message,
            details: instruction.details,
          });
        }
        return outcome;
      });

      reply.status(mode === 'create' ? 201 : 200);
      return { data: result.item };
    };
    (handler as unknown as Record<symbol, boolean>)[AUDITED] = true;
    return handler;
  }

  app.post('/studio/drafts', {
    preHandler: [app.authenticate, requireBlogger],
    config: { rateLimitPolicy: 'sensitive' },
    schema: { body: StudioDraftBody, response: { 201: StudioItemResponse } },
    handler: draftHandler('create'),
  });

  app.put('/studio/drafts/:id', {
    preHandler: [app.authenticate, requireBlogger],
    config: { rateLimitPolicy: 'sensitive' },
    schema: {
      params: DraftIdParams,
      body: StudioDraftBody,
      response: { 200: StudioItemResponse },
    },
    handler: draftHandler('update'),
  });

  app.delete(
    '/studio/drafts/:id',
    {
      preHandler: [app.authenticate, requireBlogger],
      schema: { params: DraftIdParams, response: { 204: z.null() } },
    },
    async (request, reply) => {
      const { id } = DraftIdParams.parse(request.params);
      const user = request.user;
      if (user === undefined) throw HttpError.unauthorized();
      // A draft is private working copy, not a record of a decision: deleting one
      // writes no chain entry, and the catalogue defines no event for it.
      await serviceFor().deleteDraft(user.id, id);
      return reply.status(204).send(null);
    },
  );

  // -------------------------------------------------------------- submit
  app.post(
    '/studio/drafts/:id/submit',
    {
      preHandler: [app.authenticate, requireBlogger],
      config: { rateLimitPolicy: 'sensitive' },
      schema: { params: DraftIdParams, response: { 200: StudioItemResponse } },
    },
    audited<FastifyRequest, { data: StudioItem; audit: AuditInstruction[] }>(
      {
        eventType: 'CONTENT_SUBMITTED',
        subject: (_req, res) => res.data.id,
        message: (_req, res) => res.audit[0]?.message ?? 'Draft submitted for moderation',
        details: (_req, res) => res.audit[0]?.details ?? {},
      },
      async (request, _reply, ctx) => {
        const { id } = DraftIdParams.parse(request.params);
        const user = request.user;
        if (user === undefined) throw HttpError.unauthorized();
        const result = await serviceFor(asExecutor(ctx.tx)).submit(user.id, id);
        return { data: result.item, audit: result.audit };
      },
    ),
  );

  // --------------------------------------------------------------- images
  app.post(
    '/studio/images/upload-url',
    {
      preHandler: [app.authenticate, requireBlogger],
      schema: {
        body: StudioImageUploadRequest,
        response: {
          200: z.object({
            data: z.object({
              uploadUrl: z.string().url(),
              objectKey: z.string(),
              publicUrl: z.string().url(),
              expiresAt: z.string().datetime(),
            }),
          }),
        },
      },
    },
    async (request) => {
      const body = StudioImageUploadRequest.parse(request.body);
      const user = request.user;
      if (user === undefined) throw HttpError.unauthorized();
      return { data: await serviceFor().imageUploadUrl(user.id, body) };
    },
  );
};

export default fp(studioRoutes, { name: 'studio-routes' });

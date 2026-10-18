import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { audited } from '../../../audit/audited.js';
import { asExecutor, type SqlExecutor } from '../../../audit/repo.js';
import { HttpError } from '../../../lib/http-error.js';
import { SqlPublicRepo, type PublicRepo } from '../public/repo.js';
import { BadgeService, type AuditInstruction } from '../public/service.js';

/**
 * The verified-blogger badge (Task 40).
 *
 * `users:manage` is held by `super_admin` only, which is deliberate: this badge is
 * what lets a non-staff author publish into the platform's editorial pipeline, and
 * the moderation queue is the only thing between them and a client's dashboard.
 */

const UserIdParams = z.object({ id: z.string().uuid() });
const BadgeResponse = z.object({
  data: z.object({ id: z.string().uuid(), verifiedBloggerAt: z.string().datetime().nullable() }),
});

export interface AdminBadgesRoutesOptions {
  repo?: PublicRepo;
}

const adminBadgesRoutes: FastifyPluginAsync<AdminBadgesRoutesOptions> = async (
  fastify,
  options,
) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  function serviceFor(executor?: SqlExecutor): BadgeService {
    const repo: PublicRepo =
      options.repo ??
      (executor === undefined && !app.hasDecorator('db')
        ? (() => {
            throw new HttpError(503, 'service_unavailable', 'Badges are not available');
          })()
        : new SqlPublicRepo(executor ?? app.db));
    return new BadgeService({ repo });
  }

  const guard = [app.authenticate, app.requireStaff, app.requirePermission('users:manage')];

  app.post(
    '/admin/users/:id/blogger-badge',
    {
      preHandler: guard,
      config: { rateLimitPolicy: 'sensitive' },
      schema: { params: UserIdParams, response: { 200: BadgeResponse } },
    },
    audited<
      FastifyRequest,
      { data: { id: string; verifiedBloggerAt: string }; audit: AuditInstruction[] }
    >(
      {
        eventType: 'PERMISSION_CHANGED',
        subject: (_req, res) => res.data.id,
        message: (_req, res) => res.audit[0]?.message ?? 'Verified Blogger badge changed',
        details: (_req, res) => res.audit[0]?.details ?? {},
      },
      async (request, _reply, ctx) => {
        const { id } = UserIdParams.parse(request.params);
        const user = request.user;
        if (user === undefined) throw HttpError.unauthorized();
        const result = await serviceFor(asExecutor(ctx.tx)).grant(id, user.id);
        return {
          data: { id: result.id, verifiedBloggerAt: result.verifiedBloggerAt },
          audit: result.audit,
        };
      },
    ),
  );

  app.delete(
    '/admin/users/:id/blogger-badge',
    {
      preHandler: guard,
      config: { rateLimitPolicy: 'sensitive' },
      schema: { params: UserIdParams, response: { 200: BadgeResponse } },
    },
    audited<
      FastifyRequest,
      { data: { id: string; verifiedBloggerAt: null }; audit: AuditInstruction[] }
    >(
      {
        eventType: 'PERMISSION_CHANGED',
        subject: (_req, res) => res.data.id,
        message: (_req, res) => res.audit[0]?.message ?? 'Verified Blogger badge changed',
        details: (_req, res) => res.audit[0]?.details ?? {},
      },
      async (request, _reply, ctx) => {
        const { id } = UserIdParams.parse(request.params);
        const result = await serviceFor(asExecutor(ctx.tx)).revoke(id);
        return {
          data: { id: result.id, verifiedBloggerAt: result.verifiedBloggerAt },
          audit: result.audit,
        };
      },
    ),
  );
};

export default fp(adminBadgesRoutes, { name: 'admin-badges-routes' });

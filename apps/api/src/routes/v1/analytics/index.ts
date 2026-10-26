import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AnalyticsBodySchema } from '@vunvault/contracts';
import { asExecutor, type SqlExecutor } from '../../../audit/repo.js';
import { HttpError } from '../../../lib/http-error.js';

/**
 * First-party analytics intake. Anonymous by construction: no IP, no
 * user-agent, no cookie — an event name plus tiny meta. The browser only
 * posts after an accepted Analytics consent category; the server rate-limits
 * regardless because anonymous write endpoints get abused.
 */

export interface AnalyticsRoutesOptions {
  executor?: SqlExecutor;
}

const analyticsRoutes: FastifyPluginAsync<AnalyticsRoutesOptions> = async (fastify, options) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.post('/analytics', {
    config: { rateLimitPolicy: 'public_form' },
    schema: { body: AnalyticsBodySchema, response: { 202: z.object({}) } },
    handler: async (request, reply) => {
      const body = AnalyticsBodySchema.parse(request.body);
      const executor =
        options.executor ?? (app.hasDecorator('db') ? asExecutor(app.db) : undefined);
      if (executor === undefined) {
        throw new HttpError(503, 'service_unavailable', 'Analytics intake is not available');
      }
      await executor.unsafe(`insert into analytics_events (event, meta) values ($1, $2::jsonb)`, [
        body.event,
        JSON.stringify(body.meta ?? {}),
      ]);
      return reply.status(202).send({});
    },
  });
};

export default fp(analyticsRoutes, { name: 'analytics-routes' });

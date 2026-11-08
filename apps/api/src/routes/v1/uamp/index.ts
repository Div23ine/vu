import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  CreateUampMonitorBody,
  UpdateUampMonitorBody,
  UampMonitorListQuery,
  UampMonitorListResponse,
  UampMonitorResponse,
  UampMonitorSchema,
} from '@vunvault/contracts';
import { HttpError } from '../../../lib/http-error.js';
import { SqlUampRepo } from './repo.js';
import { toWireMonitor, UampService } from './service.js';

/**
 * UAMP product routes — mounted under `/api/v1/uamp`.
 *
 * Org-scoped via JWT `org_id`. Reuses shared auth, audit, and billing
 * infrastructure. Monitoring workers and AI are separate concerns.
 */

const IdParams = z.object({ id: z.string().uuid() });

function actor(request: FastifyRequest): { id: string; email: string; orgId: string } {
  const user = request.user;
  if (user === undefined) throw new HttpError(401, 'unauthorized');
  if (user.orgId === null || user.orgId === undefined) {
    throw new HttpError(403, 'no_org', 'This account is not attached to an organisation');
  }
  return { id: user.id, email: user.email, orgId: user.orgId };
}

const uampRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  function serviceFor(): UampService {
    if (!app.hasDecorator('db')) {
      throw new HttpError(503, 'service_unavailable', 'UAMP is not available');
    }
    return new UampService(new SqlUampRepo(app.db));
  }

  const auth = [app.authenticate];

  // ------------------------------------------------------------------ monitors
  app.get(
    '/uamp/monitors',
    {
      preHandler: auth,
      schema: {
        querystring: UampMonitorListQuery,
        response: { 200: UampMonitorListResponse },
      },
    },
    async (request) => {
      const user = actor(request);
      const q = request.query as z.infer<typeof UampMonitorListQuery>;
      const { rows, total } = await serviceFor().listMonitors({
        orgId: user.orgId,
        status: q.status,
        type: q.type,
        q: q.q,
        page: q.page,
        pageSize: q.pageSize,
      });
      return { data: rows.map(toWireMonitor), total };
    },
  );

  app.get(
    '/uamp/monitors/:id',
    {
      preHandler: auth,
      schema: {
        params: IdParams,
        response: { 200: UampMonitorResponse },
      },
    },
    async (request) => {
      const user = actor(request);
      const { id } = request.params as z.infer<typeof IdParams>;
      const row = await serviceFor().getMonitor(user.orgId, id);
      return { data: toWireMonitor(row) };
    },
  );

  app.post(
    '/uamp/monitors',
    {
      preHandler: auth,
      schema: {
        body: CreateUampMonitorBody,
        response: { 201: UampMonitorResponse },
      },
    },
    async (request, reply) => {
      const user = actor(request);
      const body = request.body as z.infer<typeof CreateUampMonitorBody>;
      const row = await serviceFor().createMonitor({
        orgId: user.orgId,
        createdBy: user.id,
        name: body.name,
        type: body.type,
        target: body.target,
        method: body.method,
        intervalSeconds: body.intervalSeconds,
        timeoutMs: body.timeoutMs,
        locations: body.locations,
        headers: body.headers,
        requestBody: body.requestBody,
        assertions: body.assertions,
        keyword: body.keyword,
        warnDaysBeforeExpiry: body.warnDaysBeforeExpiry,
      });
      return reply.status(201).send({ data: toWireMonitor(row) });
    },
  );

  app.patch(
    '/uamp/monitors/:id',
    {
      preHandler: auth,
      schema: {
        params: IdParams,
        body: UpdateUampMonitorBody,
        response: { 200: UampMonitorResponse },
      },
    },
    async (request) => {
      const user = actor(request);
      const { id } = request.params as z.infer<typeof IdParams>;
      const body = request.body as z.infer<typeof UpdateUampMonitorBody>;
      const row = await serviceFor().updateMonitor(user.orgId, id, body);
      return { data: toWireMonitor(row) };
    },
  );

  app.delete(
    '/uamp/monitors/:id',
    {
      preHandler: auth,
      schema: {
        params: IdParams,
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      const user = actor(request);
      const { id } = request.params as z.infer<typeof IdParams>;
      await serviceFor().deleteMonitor(user.orgId, id);
      return reply.status(204).send();
    },
  );
};

export default uampRoutes;

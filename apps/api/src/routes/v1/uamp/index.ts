import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  CreateUampAlertRuleBody,
  CreateUampMonitorBody,
  CreateUampStatusPageBody,
  PageQuery,
  UpdateUampIncidentBody,
  UpdateUampMonitorBody,
  UampAlertRuleSchema,
  UampCheckResultListQuery,
  UampCheckResultListResponse,
  UampIncidentListQuery,
  UampIncidentListResponse,
  UampIncidentResponse,
  UampMonitorListQuery,
  UampMonitorListResponse,
  UampMonitorResponse,
  UampMonitorSchema,
  UampStatusPageListResponse,
  UampStatusPageResponse,
  UampStatusPageSchema,
  envelope,
} from '@vunvault/contracts';

import { HttpError } from '../../../lib/http-error.js';
import { resolveUampPlanCode } from './entitlements.js';
import { SqlUampRepo } from './repo.js';
import { toWireAlertRule, toWireCheckResult, toWireIncident, toWireMonitor, toWireStatusPage, UampService } from './service.js';

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

  async function serviceFor(orgId: string): Promise<UampService> {
    if (!app.hasDecorator('db')) {
      throw new HttpError(503, 'service_unavailable', 'UAMP is not available');
    }
    const planCode = await resolveUampPlanCode(app.db, orgId);
    return UampService.fromPlanCode(new SqlUampRepo(app.db), planCode);
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
      const { rows, total } = await (await serviceFor(user.orgId)).listMonitors({
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
      const row = await (await serviceFor(user.orgId)).getMonitor(user.orgId, id);
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
      const row = await (await serviceFor(user.orgId)).createMonitor({
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
      const row = await (await serviceFor(user.orgId)).updateMonitor(user.orgId, id, body);
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
      await (await serviceFor(user.orgId)).deleteMonitor(user.orgId, id);
      return reply.status(204).send();
    },
  );

  // ---------------------------------------------------------------- incidents
  app.get(
    '/uamp/incidents',
    {
      preHandler: auth,
      schema: {
        querystring: UampIncidentListQuery,
        response: { 200: UampIncidentListResponse },
      },
    },
    async (request) => {
      const user = actor(request);
      const q = request.query as z.infer<typeof UampIncidentListQuery>;
      const { rows, total } = await (await serviceFor(user.orgId)).listIncidents({
        orgId: user.orgId,
        status: q.status,
        severity: q.severity,
        monitorId: q.monitorId,
        page: q.page,
        pageSize: q.pageSize,
      });
      return { data: rows.map(toWireIncident), total };
    },
  );

  app.get(
    '/uamp/incidents/:id',
    {
      preHandler: auth,
      schema: {
        params: IdParams,
        response: { 200: UampIncidentResponse },
      },
    },
    async (request) => {
      const user = actor(request);
      const { id } = request.params as z.infer<typeof IdParams>;
      const row = await (await serviceFor(user.orgId)).getIncident(user.orgId, id);
      return { data: toWireIncident(row) };
    },
  );

  app.patch(
    '/uamp/incidents/:id',
    {
      preHandler: auth,
      schema: {
        params: IdParams,
        body: UpdateUampIncidentBody,
        response: { 200: UampIncidentResponse },
      },
    },
    async (request) => {
      const user = actor(request);
      const { id } = request.params as z.infer<typeof IdParams>;
      const body = request.body as z.infer<typeof UpdateUampIncidentBody>;
      const row = await (await serviceFor(user.orgId)).updateIncident(user.orgId, id, user.id, body);
      return { data: toWireIncident(row) };
    },
  );

  // ------------------------------------------------------------ check results
  app.get(
    '/uamp/check-results',
    {
      preHandler: auth,
      schema: {
        querystring: UampCheckResultListQuery,
        response: { 200: UampCheckResultListResponse },
      },
    },
    async (request) => {
      const user = actor(request);
      const q = request.query as z.infer<typeof UampCheckResultListQuery>;
      const { rows, total } = await (await serviceFor(user.orgId)).listCheckResults({
        orgId: user.orgId,
        monitorId: q.monitorId,
        status: q.status,
        page: q.page,
        pageSize: q.pageSize,
      });
      return { data: rows.map(toWireCheckResult), total };
    },
  );


  // ------------------------------------------------------------- status pages
  app.get(
    '/uamp/status-pages',
    {
      preHandler: auth,
      schema: {
        querystring: PageQuery,
        response: { 200: UampStatusPageListResponse },
      },
    },
    async (request) => {
      const user = actor(request);
      const q = request.query as z.infer<typeof PageQuery>;
      const { rows, total } = await (await serviceFor(user.orgId)).listStatusPages(
        user.orgId,
        q.page,
        q.pageSize,
      );
      return { data: rows.map(toWireStatusPage), total };
    },
  );

  app.get(
    '/uamp/status-pages/:id',
    {
      preHandler: auth,
      schema: { params: IdParams, response: { 200: UampStatusPageResponse } },
    },
    async (request) => {
      const user = actor(request);
      const { id } = request.params as z.infer<typeof IdParams>;
      const row = await (await serviceFor(user.orgId)).getStatusPage(user.orgId, id);
      return { data: toWireStatusPage(row) };
    },
  );

  app.post(
    '/uamp/status-pages',
    {
      preHandler: auth,
      schema: { body: CreateUampStatusPageBody, response: { 201: UampStatusPageResponse } },
    },
    async (request, reply) => {
      const user = actor(request);
      const body = request.body as z.infer<typeof CreateUampStatusPageBody>;
      const row = await (await serviceFor(user.orgId)).createStatusPage({
        orgId: user.orgId,
        ...body,
      });
      return reply.status(201).send({ data: toWireStatusPage(row) });
    },
  );

  app.delete(
    '/uamp/status-pages/:id',
    {
      preHandler: auth,
      schema: { params: IdParams, response: { 204: z.null() } },
    },
    async (request, reply) => {
      const user = actor(request);
      const { id } = request.params as z.infer<typeof IdParams>;
      await (await serviceFor(user.orgId)).deleteStatusPage(user.orgId, id);
      return reply.status(204).send();
    },
  );

  // --------------------------------------------------------------- alert rules
  app.get(
    '/uamp/alert-rules',
    {
      preHandler: auth,
      schema: {
        querystring: z.object({ monitorId: z.string().uuid().optional() }),
        response: { 200: z.object({ data: z.array(UampAlertRuleSchema) }) },
      },
    },
    async (request) => {
      const user = actor(request);
      const q = request.query as { monitorId?: string };
      const rows = await (await serviceFor(user.orgId)).listAlertRules(user.orgId, q.monitorId);
      return { data: rows.map(toWireAlertRule) };
    },
  );

  app.post(
    '/uamp/alert-rules',
    {
      preHandler: auth,
      schema: {
        body: CreateUampAlertRuleBody,
        response: { 201: envelope(UampAlertRuleSchema) },
      },
    },
    async (request, reply) => {
      const user = actor(request);
      const body = request.body as z.infer<typeof CreateUampAlertRuleBody>;
      const row = await (await serviceFor(user.orgId)).createAlertRule({
        orgId: user.orgId,
        ...body,
      });
      return reply.status(201).send({ data: toWireAlertRule(row) });
    },
  );

  app.delete(
    '/uamp/alert-rules/:id',
    {
      preHandler: auth,
      schema: { params: IdParams, response: { 204: z.null() } },
    },
    async (request, reply) => {
      const user = actor(request);
      const { id } = request.params as z.infer<typeof IdParams>;
      await (await serviceFor(user.orgId)).deleteAlertRule(user.orgId, id);
      return reply.status(204).send();
    },
  );
};

export default uampRoutes;

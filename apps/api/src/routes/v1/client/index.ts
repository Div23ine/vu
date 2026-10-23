import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  ClientProfile,
  CreatePentestRequestBody,
  OnboardingStatus,
  OnboardingSubmitBody,
  PentestRequest,
  UpdateProfileBody,
} from '@vunvault/contracts';
import { AUDITED } from '../../../audit/audited';
import { asExecutor, type SqlExecutor } from '../../../audit/repo';
import type { Tx } from '../../../plugins/db';
import { HttpError } from '../../../lib/http-error';
import { SqlClientRepo } from './repo';
import { ClientProfileService, OnboardingService, PentestRequestService } from './service';

/**
 * Client intake (Task 30): profile, onboarding and pen-test requests.
 *
 * Every route is scoped to the caller's organisation. A user without one gets
 * `403 no_org` rather than an empty read model — silently showing nothing is how a
 * client ends up believing they have no engagements.
 */

const OnboardingStatusResponse = z.object({ data: OnboardingStatus });

function actor(request: FastifyRequest): { id: string; email: string; orgId: string } {
  const user = request.user;
  if (user === undefined) throw new HttpError(401, 'unauthorized');
  if (user.orgId === null || user.orgId === undefined) {
    throw new HttpError(403, 'no_org', 'This account is not attached to an organisation');
  }
  return { id: user.id, email: user.email, orgId: user.orgId };
}

function label(email: string): string {
  return email.split('@')[0] ?? email;
}

const clientRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  /** Built lazily so registering the group never requires a live database. */
  function repoFor(executor?: SqlExecutor): SqlClientRepo {
    if (executor === undefined && !app.hasDecorator('db')) {
      throw new HttpError(503, 'service_unavailable', 'Client services are not available');
    }
    return new SqlClientRepo(executor ?? app.db);
  }
  function profileFor(executor?: SqlExecutor): ClientProfileService {
    return new ClientProfileService({ repo: repoFor(executor) });
  }
  function onboardingFor(executor?: SqlExecutor): OnboardingService {
    return new OnboardingService({ repo: repoFor(executor) });
  }
  function pentestFor(executor?: SqlExecutor): PentestRequestService {
    return new PentestRequestService({
      repo: repoFor(executor),
      enqueue: async (payload) => {
        await app.queues.notify.add(payload.channel, payload);
      },
    });
  }

  // ---------------------------------------------------------------- profile
  app.get(
    '/profile',
    {
      preHandler: [app.authenticate, app.requirePermission('profile:read')],
      schema: { response: { 200: z.object({ data: ClientProfile }) } },
    },
    async (request) => {
      const user = actor(request);
      return { data: await profileFor().get(user.id, user.orgId) };
    },
  );

  const patchHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = UpdateProfileBody.parse(request.body);
    const user = actor(request);

    const profile = await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      const updated = await profileFor(executor).update(user.id, user.orgId, body);
      await app.audit.append(executor, {
        eventType: 'PROFILE_UPDATED',
        actor: { id: user.id, label: label(user.email) },
        subject: updated.clientCode,
        message: `${user.email} updated their client profile`,
        details: { clientCode: updated.clientCode },
        ip: request.ip,
      });
      return updated;
    });

    return reply.send({ data: profile });
  };
  (patchHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.patch('/profile', {
    preHandler: [app.authenticate, app.requirePermission('profile:write')],
    config: { rateLimitPolicy: 'sensitive' },
    schema: {
      body: UpdateProfileBody,
      response: { 200: z.object({ data: ClientProfile }) },
    },
    handler: patchHandler,
  });

  // ------------------------------------------------------------- onboarding
  app.get(
    '/onboarding',
    {
      preHandler: [app.authenticate, app.requirePermission('profile:read')],
      schema: { response: { 200: OnboardingStatusResponse } },
    },
    async (request) => {
      const user = actor(request);
      return { data: await onboardingFor().status(user.id) };
    },
  );

  const onboardingHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = OnboardingSubmitBody.parse(request.body);
    const user = actor(request);

    const result = await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      const submitted = await onboardingFor(executor).submit(user.id, user.email, {
        step1: body.step1,
        step2: body.step2,
        step3: body.step3,
      });
      await app.audit.append(executor, {
        eventType: 'ONBOARDING_COMPLETED',
        actor: { id: user.id, label: label(user.email) },
        subject: user.email,
        message: `${user.email} completed onboarding`,
        // The recovery answer is hashed in the service and never appears here.
        details: { entity: body.step2.entity, termsVersion: submitted.termsVersion },
        ip: request.ip,
      });
      return submitted;
    });

    return reply
      .status(201)
      .send({ data: { completed: result.completed, completedAt: result.completedAt } });
  };
  (onboardingHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post('/onboarding', {
    preHandler: [app.authenticate, app.requirePermission('profile:write')],
    config: { rateLimitPolicy: 'sensitive' },
    schema: { body: OnboardingSubmitBody, response: { 201: OnboardingStatusResponse } },
    handler: onboardingHandler,
  });

  // -------------------------------------------------------- pen-test intake
  const pentestHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = CreatePentestRequestBody.parse(request.body);
    const user = actor(request);

    const created = await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      const pentest = await pentestFor(executor).create(user.orgId, user.id, user.email, body);
      await app.audit.append(executor, {
        eventType: 'PENTEST_REQUESTED',
        actor: { id: user.id, label: label(user.email) },
        subject: pentest.refCode,
        message: `${user.email} requested a pen-test for ${pentest.targetUrl}`,
        details: { refCode: pentest.refCode, targetType: pentest.targetType },
        ip: request.ip,
      });
      return pentest;
    });

    return reply.status(201).send({ data: created });
  };
  (pentestHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post('/pentest-requests', {
    preHandler: [app.authenticate, app.requirePermission('scans:create')],
    config: { rateLimitPolicy: 'sensitive' },
    schema: {
      body: CreatePentestRequestBody,
      response: { 201: z.object({ data: PentestRequest }) },
    },
    handler: pentestHandler,
  });
};

export default fp(clientRoutes, { name: 'client-routes' });

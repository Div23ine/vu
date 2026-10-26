import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  DeactivationRequestBody,
  NotificationPrefs,
  RevokeOthersResponse,
  SessionsResponse,
} from '@vunvault/contracts';
import { AUDITED } from '../../../audit/audited.js';
import { asExecutor, type SqlExecutor } from '../../../audit/repo.js';
import type { Tx } from '../../../plugins/db.js';
import { HttpError } from '../../../lib/http-error.js';
import { SqlAccountSessionsRepo, SqlNotificationPrefsRepo } from './repo.js';
import {
  AccountSessionsService,
  DeactivationService,
  NotificationPreferencesService,
} from './service.js';

/**
 * Notification preferences, device sessions and the deactivation request (Task 29).
 *
 * Auth is `authenticate` only — these routes act on the caller's own rows, and the
 * deactivation request checks the role itself so the refusal stays in one place.
 */

const SessionIdParams = z.object({ id: z.string().uuid() });

function actorId(request: FastifyRequest): string {
  const user = request.user;
  if (user === undefined) throw new HttpError(401, 'unauthorized');
  return user.id;
}

/** The audit label stays the email local-part — never a display name the user edits. */
function actorLabel(request: FastifyRequest): string {
  const user = request.user as { email?: string } | undefined;
  const email = user?.email ?? '';
  return email.split('@')[0] ?? email;
}

/** The session the caller is standing on; used for `current` and for revoke-others. */
function currentSessionId(request: FastifyRequest): string | null {
  const user = request.user as { sessionId?: string } | undefined;
  return user?.sessionId ?? null;
}

const accountSessionsRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  /** Built lazily so registering the group never requires a live database. */
  function prefsFor(executor?: SqlExecutor): NotificationPreferencesService {
    return new NotificationPreferencesService({
      repo: new SqlNotificationPrefsRepo(executor ?? app.db),
    });
  }
  function sessionsFor(executor?: SqlExecutor): AccountSessionsService {
    return new AccountSessionsService({
      repo: new SqlAccountSessionsRepo(executor ?? app.db),
      supabase: app.supabase,
      invalidate: async (sessionId) => {
        await app.redis.del(`sess:${sessionId}`);
      },
    });
  }
  function deactivationFor(executor?: SqlExecutor): DeactivationService {
    return new DeactivationService({
      repo: new SqlAccountSessionsRepo(executor ?? app.db),
      prefs: new SqlNotificationPrefsRepo(executor ?? app.db),
      notify: app.notify,
    });
  }
  function requireDb(): void {
    if (!app.hasDecorator('db')) {
      throw new HttpError(503, 'service_unavailable', 'Account services are not available');
    }
  }

  // --------------------------------------------------------- notifications
  app.get(
    '/account/notifications',
    {
      preHandler: [app.authenticate],
      schema: { response: { 200: z.object({ data: NotificationPrefs }) } },
    },
    async (request) => {
      requireDb();
      return { data: await prefsFor().get(actorId(request)) };
    },
  );

  const putHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    requireDb();
    const body = NotificationPrefs.parse(request.body);
    const userId = actorId(request);

    const result = await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      const updated = await prefsFor(executor).put(userId, body);
      await app.audit.append(executor, {
        eventType: 'NOTIFICATION_PREFS_UPDATED',
        actor: { id: userId, label: actorLabel(request) },
        subject: userId,
        message: 'Notification preferences updated',
        // Event keys only — channel choices are not sensitive, but the log stays
        // about *what* changed rather than replaying the whole payload.
        details: { changed: updated.changed },
        ip: request.ip,
      });
      return updated;
    });

    return reply.send({ data: result.prefs });
  };
  (putHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.put('/account/notifications', {
    preHandler: [app.authenticate],
    config: { rateLimitPolicy: 'sensitive' },
    schema: {
      body: NotificationPrefs,
      response: { 200: z.object({ data: NotificationPrefs }) },
    },
    handler: putHandler,
  });

  // ------------------------------------------------------------ sessions
  app.get(
    '/account/sessions',
    {
      preHandler: [app.authenticate],
      schema: { response: { 200: SessionsResponse } },
    },
    async (request) => {
      requireDb();
      return {
        data: await sessionsFor().list(actorId(request), currentSessionId(request)),
      };
    },
  );

  const revokeHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    requireDb();
    const { id } = SessionIdParams.parse(request.params);
    const userId = actorId(request);
    const current = currentSessionId(request);

    await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      await sessionsFor(executor).revoke(userId, id, current);
      await app.audit.append(executor, {
        eventType: 'SESSION_REVOKED',
        actor: { id: userId, label: actorLabel(request) },
        subject: id,
        message: 'Ended a device session',
        details: { sessionId: id },
        ip: request.ip,
      });
    });

    return reply.status(204).send();
  };
  (revokeHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.delete('/account/sessions/:id', {
    preHandler: [app.authenticate],
    config: { rateLimitPolicy: 'sensitive' },
    schema: { params: SessionIdParams, response: { 204: z.null() } },
    handler: revokeHandler,
  });

  const revokeOthersHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    requireDb();
    const userId = actorId(request);
    const current = currentSessionId(request);

    const revoked = await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      const count = await sessionsFor(executor).revokeOthers(userId, current);
      await app.audit.append(executor, {
        eventType: 'SESSION_REVOKED',
        actor: { id: userId, label: actorLabel(request) },
        subject: userId,
        message: `Ended ${count} other device ${count === 1 ? 'session' : 'sessions'}`,
        details: { count },
        ip: request.ip,
      });
      return count;
    });

    return reply.send({ data: { revoked } });
  };
  (revokeOthersHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post('/account/sessions/revoke-others', {
    preHandler: [app.authenticate],
    config: { rateLimitPolicy: 'sensitive' },
    schema: { response: { 200: RevokeOthersResponse } },
    handler: revokeOthersHandler,
  });

  // --------------------------------------------------- deactivation request
  const deactivationHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    requireDb();
    const { reason } = DeactivationRequestBody.parse(request.body);
    const userId = actorId(request);

    await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      const result = await deactivationFor(executor).request(userId, reason);
      await app.audit.append(executor, {
        eventType: 'DEACTIVATION_REQUESTED',
        actor: { id: userId, label: actorLabel(request) },
        subject: userId,
        message: 'Requested account deactivation',
        details: { adminsNotified: result.adminsNotified },
        ip: request.ip,
      });
    });

    return reply.status(202).send({ data: { accepted: true } });
  };
  (deactivationHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post('/account/deactivation-request', {
    preHandler: [app.authenticate],
    config: { rateLimitPolicy: 'sensitive' },
    schema: {
      body: DeactivationRequestBody,
      response: { 202: z.object({ data: z.object({ accepted: z.boolean() }) }) },
    },
    handler: deactivationHandler,
  });
};

export default fp(accountSessionsRoutes, { name: 'account-sessions-routes' });

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  ChangeRoleBody,
  Invitation,
  ProvisionInviteBody,
  ROLE_LABELS,
  StaffListQuery,
  StaffMember,
  StaffSummary,
  TEAM_LABELS,
  UserActionBody,
} from '@vunvault/contracts';
import { AUDITED } from '../../../audit/audited.js';
import { asExecutor, type SqlExecutor } from '../../../audit/repo.js';
import type { Tx } from '../../../plugins/db.js';
import { HttpError } from '../../../lib/http-error.js';
import { SqlUsersRepo } from './repo.js';
import { UsersService, type ActorContext } from './service.js';

/**
 * User & Access Management (Task 31).
 *
 * Every route is staff-only, and every mutation needs `users:manage` — a
 * permission held only by `super_admin`. An `admin` can read the roster but cannot
 * suspend, promote or delete anyone: provisioning power and administration power
 * are deliberately not the same grant.
 */

const IdParams = z.object({ id: z.string().uuid() });

function actor(request: FastifyRequest): ActorContext {
  const user = request.user;
  if (user === undefined) throw new HttpError(401, 'unauthorized');
  return { id: user.id, email: user.email, role: user.role };
}

function label(email: string): string {
  return email.split('@')[0] ?? email;
}

const usersRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  /** Built lazily, and per transaction so writes and the audit append share it. */
  function serviceFor(executor?: SqlExecutor): UsersService {
    if (executor === undefined && !app.hasDecorator('db')) {
      throw new HttpError(503, 'service_unavailable', 'User management is not available');
    }
    return new UsersService({
      repo: new SqlUsersRepo(executor ?? app.db),
      supabase: app.supabase,
      email: app.hasDecorator('email') ? app.email : undefined,
      notify: app.hasDecorator('notify') ? app.notify : undefined,
      webOrigin: app.env.WEB_ORIGIN,
      invalidate: async (sessionId) => {
        if (app.hasDecorator('redis')) await app.redis.del(`sess:${sessionId}`);
      },
    });
  }

  const guards = (permission: 'users:read' | 'users:manage') => [
    app.authenticate,
    app.requireStaff,
    app.requirePermission(permission),
  ];

  // ------------------------------------------------------------------ roster
  app.get(
    '/admin/users',
    {
      preHandler: guards('users:read'),
      schema: {
        querystring: StaffListQuery,
        response: { 200: z.object({ data: z.array(StaffMember), total: z.number() }) },
      },
    },
    async (request) => {
      const query = StaffListQuery.parse(request.query);
      const result = await serviceFor().roster(query);
      return { data: result.data, total: result.total };
    },
  );

  app.get(
    '/admin/users/summary',
    {
      preHandler: guards('users:read'),
      schema: { response: { 200: z.object({ data: StaffSummary }) } },
    },
    async () => ({ data: await serviceFor().summary() }),
  );

  // ------------------------------------------------------------- invitations
  const inviteHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = ProvisionInviteBody.parse(request.body);
    const who = actor(request);

    const result = await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      const created = await serviceFor(executor).createInvitation(who, body);
      await app.audit.append(executor, {
        eventType: 'USER_PROVISIONED',
        actor: { id: who.id, label: label(who.email) },
        subject: created.invitation.email,
        message: `Invitation issued to ${created.invitation.email} as ${ROLE_LABELS[created.invitation.role]} — ${TEAM_LABELS[created.invitation.team]} · MFA enrolment required within 72 h`,
        // The token is never logged, never audited and never returned.
        details: {
          role: created.invitation.role,
          team: created.invitation.team,
          draft: created.token === null,
        },
        ip: request.ip,
      });
      return created;
    });

    return reply.status(201).send({ data: result.invitation });
  };
  (inviteHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post('/admin/users/invitations', {
    preHandler: guards('users:manage'),
    config: { rateLimitPolicy: 'sensitive' },
    schema: {
      body: ProvisionInviteBody,
      response: { 201: z.object({ data: Invitation }) },
    },
    handler: inviteHandler,
  });

  const resendHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = IdParams.parse(request.params);
    const who = actor(request);

    const result = await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      const resent = await serviceFor(executor).resendInvitation(id);
      await app.audit.append(executor, {
        eventType: 'INVITATION_RESENT',
        actor: { id: who.id, label: label(who.email) },
        subject: resent.invitation.email,
        message: `Invitation resent to ${resent.invitation.email}`,
        details: { resendCount: resent.invitation.resendCount },
        ip: request.ip,
      });
      return resent;
    });

    return reply.send({ data: result.invitation });
  };
  (resendHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post('/admin/users/invitations/:id/resend', {
    preHandler: guards('users:manage'),
    config: { rateLimitPolicy: 'sensitive' },
    schema: { params: IdParams, response: { 200: z.object({ data: Invitation }) } },
    handler: resendHandler,
  });

  const revokeHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = IdParams.parse(request.params);
    const who = actor(request);

    const email = await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      const service = serviceFor(executor);
      const invitation = await new SqlUsersRepo(executor).findInvitationById(id);
      await service.revokeInvitation(id);
      await app.audit.append(executor, {
        eventType: 'INVITATION_REVOKED',
        actor: { id: who.id, label: label(who.email) },
        subject: invitation?.email ?? id,
        message: `Invitation revoked for ${invitation?.email ?? id}`,
        ip: request.ip,
      });
      return invitation?.email ?? id;
    });
    void email;

    return reply.status(204).send();
  };
  (revokeHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.delete('/admin/users/invitations/:id', {
    preHandler: guards('users:manage'),
    config: { rateLimitPolicy: 'sensitive' },
    schema: { params: IdParams, response: { 204: z.null() } },
    handler: revokeHandler,
  });

  // ---------------------------------------------------------- account actions
  const memberResponse = { 200: z.object({ data: StaffMember }) };

  const suspendHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = IdParams.parse(request.params);
    const { reason } = UserActionBody.parse(request.body ?? {});
    const who = actor(request);

    const member = await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      const updated = await serviceFor(executor).suspend(who, id, reason);
      await app.audit.append(executor, {
        eventType: 'ACCOUNT_SUSPENDED',
        actor: { id: who.id, label: label(who.email) },
        subject: updated.email,
        message: `${updated.email} suspended and all session tokens revoked`,
        details: reason === undefined ? undefined : { reason },
        ip: request.ip,
      });
      return updated;
    });

    return reply.send({ data: member });
  };
  (suspendHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post('/admin/users/:id/suspend', {
    preHandler: guards('users:manage'),
    config: { rateLimitPolicy: 'sensitive' },
    schema: { params: IdParams, body: UserActionBody, response: memberResponse },
    handler: suspendHandler,
  });

  const reactivateHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = IdParams.parse(request.params);
    const who = actor(request);

    const member = await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      const updated = await serviceFor(executor).reactivate(who, id);
      await app.audit.append(executor, {
        eventType: 'ACCOUNT_REACTIVATED',
        actor: { id: who.id, label: label(who.email) },
        subject: updated.email,
        message: `${updated.email} reactivated`,
        ip: request.ip,
      });
      return updated;
    });

    return reply.send({ data: member });
  };
  (reactivateHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post('/admin/users/:id/reactivate', {
    preHandler: guards('users:manage'),
    config: { rateLimitPolicy: 'sensitive' },
    schema: { params: IdParams, body: UserActionBody, response: memberResponse },
    handler: reactivateHandler,
  });

  const enforceMfaHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = IdParams.parse(request.params);
    const who = actor(request);

    const member = await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      const updated = await serviceFor(executor).enforceMfa(who, id);
      await app.audit.append(executor, {
        eventType: 'MFA_ENFORCED',
        actor: { id: who.id, label: label(who.email) },
        subject: updated.email,
        message: `MFA enrolment made mandatory for ${updated.email}`,
        ip: request.ip,
      });
      return updated;
    });

    return reply.send({ data: member });
  };
  (enforceMfaHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post('/admin/users/:id/enforce-mfa', {
    preHandler: guards('users:manage'),
    config: { rateLimitPolicy: 'sensitive' },
    schema: { params: IdParams, body: UserActionBody, response: memberResponse },
    handler: enforceMfaHandler,
  });

  const roleHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = IdParams.parse(request.params);
    const { role } = ChangeRoleBody.parse(request.body);
    const who = actor(request);

    const member = await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      const changed = await serviceFor(executor).changeRole(who, id, role);
      await app.audit.append(executor, {
        eventType: 'PERMISSION_CHANGED',
        actor: { id: who.id, label: label(who.email) },
        subject: changed.member.email,
        message: `Role changed for ${changed.member.email} — ${ROLE_LABELS[changed.previousRole]} → ${ROLE_LABELS[role]}`,
        details: { from: changed.previousRole, to: role },
        ip: request.ip,
      });
      return changed.member;
    });

    return reply.send({ data: member });
  };
  (roleHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.patch('/admin/users/:id/role', {
    preHandler: guards('users:manage'),
    config: { rateLimitPolicy: 'sensitive' },
    schema: { params: IdParams, body: ChangeRoleBody, response: memberResponse },
    handler: roleHandler,
  });

  const deleteHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = IdParams.parse(request.params);
    const { reason } = UserActionBody.parse(request.body ?? {});
    const who = actor(request);

    await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      const service = serviceFor(executor);
      const target = await new SqlUsersRepo(executor).getMember(id);
      if (target === null) throw HttpError.notFound();
      await service.softDelete(who, id, reason);
      await app.audit.append(executor, {
        eventType: 'ACCOUNT_DELETED',
        actor: { id: who.id, label: label(who.email) },
        subject: target.email,
        message: `${target.email} deleted and all session tokens revoked`,
        details: reason === undefined ? undefined : { reason },
        ip: request.ip,
      });
    });

    return reply.status(204).send();
  };
  (deleteHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.delete('/admin/users/:id', {
    preHandler: guards('users:manage'),
    config: { rateLimitPolicy: 'sensitive' },
    schema: { params: IdParams, body: UserActionBody, response: { 204: z.null() } },
    handler: deleteHandler,
  });
};

export default fp(usersRoutes, { name: 'users-routes' });

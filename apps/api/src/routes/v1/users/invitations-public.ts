import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AcceptInvitationBody, InvitationPreview, SessionUser } from '@vunvault/contracts';
import { AUDITED } from '../../../audit/audited';
import { asExecutor, type SqlExecutor } from '../../../audit/repo';
import type { Tx } from '../../../plugins/db';
import { HttpError } from '../../../lib/http-error';
import { setSessionCookies } from '../../../lib/session-cookies';
import { deviceLabel } from '../auth/device';
import { SqlUsersRepo } from './repo';
import { UsersService } from './service';

/**
 * Public invitation acceptance (Task 31).
 *
 * No auth: the token *is* the credential. It is a 32-byte secret delivered to a
 * verified staff mailbox, so the endpoints are rate limited as a public form and
 * answer an identical 404 for anything that is not a live, unexpired invitation.
 */

const TokenParams = z.object({ token: z.string().min(43).max(64) });

const invitationsPublicRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  function serviceFor(executor?: SqlExecutor): UsersService {
    if (executor === undefined && !app.hasDecorator('db')) {
      throw new HttpError(503, 'service_unavailable', 'Invitations are not available');
    }
    return new UsersService({
      repo: new SqlUsersRepo(executor ?? app.db),
      supabase: app.supabase,
      webOrigin: app.env.WEB_ORIGIN,
    });
  }

  app.get(
    '/invitations/:token',
    {
      config: { rateLimitPolicy: 'public_form' },
      schema: {
        params: TokenParams,
        response: { 200: z.object({ data: InvitationPreview }) },
      },
    },
    async (request) => {
      const { token } = TokenParams.parse(request.params);
      return { data: await serviceFor().preview(token) };
    },
  );

  const acceptHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const { token } = TokenParams.parse(request.params);
    const body = AcceptInvitationBody.parse(request.body);

    const issued = await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      const accepted = await serviceFor(executor).accept(
        token,
        { password: body.password, confirmPassword: body.confirmPassword },
        {
          ip: request.ip,
          userAgent: (request.headers['user-agent'] as string | undefined) ?? null,
        },
      );
      await app.audit.append(executor, {
        eventType: 'INVITATION_ACCEPTED',
        actor: {
          id: accepted.user.id,
          label: accepted.user.email.split('@')[0] ?? accepted.user.email,
        },
        subject: accepted.user.email,
        message: `${accepted.user.email} accepted their invitation and joined as ${accepted.user.role}`,
        details: { role: accepted.user.role, mfaEnrolled: false },
        ip: request.ip,
      });
      return accepted;
    });

    // The new session is aal1: `/admin/*` stays closed until a factor is enrolled.
    setSessionCookies(reply, issued.tokens, {
      remember: false,
      secure: app.env.NODE_ENV !== 'development',
      domain: app.env.COOKIE_DOMAIN || undefined,
    });

    return reply.status(201).send({
      data: issued.user,
      mfaEnrolmentRequired: true,
      deviceLabel: deviceLabel((request.headers['user-agent'] as string | undefined) ?? null),
    });
  };
  (acceptHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post('/invitations/:token/accept', {
    config: { rateLimitPolicy: 'public_form' },
    schema: {
      params: TokenParams,
      body: AcceptInvitationBody,
      response: {
        201: z.object({
          data: SessionUser,
          mfaEnrolmentRequired: z.literal(true),
          deviceLabel: z.string(),
        }),
      },
    },
    handler: acceptHandler,
  });
};

export default fp(invitationsPublicRoutes, { name: 'invitations-public-routes' });

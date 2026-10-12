import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  ClientDirectoryItem,
  ClientDirectoryQuery,
  ContactListQuery,
  ContactMessageView,
  ContactTriageBody,
  type ContactStatus,
} from '@vunvault/contracts';
import { audited } from '../../../audit/audited';
import { asExecutor, type SqlExecutor } from '../../../audit/repo';
import { SqlContactAdminRepo, type ContactAdminRepo } from './repo';
import { ContactAdminService } from './service';

/**
 * Admin contact inbox + client directory (Task 40f).
 *
 * `GET/PATCH /admin/contact` sit behind `support:handle` (support engineers,
 * admins) — the full message body is only ever returned to those roles, and
 * triage is audited `CONTACT_TRIAGED` in the same transaction as the write.
 * `GET /admin/clients` sits behind `users:read`: it is how the Verified-Blogger
 * badge flow (Task 40's `/admin/users/:id/blogger-badge`, UI in Task 83e)
 * finds a client account.
 */

const ContactIdParams = z.object({ id: z.string().uuid() });

const ContactListResponse = z.object({
  data: z.array(ContactMessageView),
  total: z.number(),
});
const ContactTriageResponse = z.object({ data: ContactMessageView });
const ClientDirectoryResponse = z.object({
  data: z.array(ClientDirectoryItem),
  total: z.number(),
});

export interface ContactAdminRoutesOptions {
  repo?: ContactAdminRepo;
}

const contactAdminRoutes: FastifyPluginAsync<ContactAdminRoutesOptions> = async (
  fastify,
  options,
) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  function serviceFor(executor?: SqlExecutor): ContactAdminService {
    const repo: ContactAdminRepo = options.repo ?? new SqlContactAdminRepo(executor ?? app.db);
    return new ContactAdminService({ repo });
  }

  const supportGuard = [
    app.authenticate,
    app.requireStaff,
    app.requirePermission('support:handle'),
  ];
  const usersGuard = [app.authenticate, app.requireStaff, app.requirePermission('users:read')];

  // ------------------------------------------------------------ inbox list
  app.get(
    '/admin/contact',
    {
      preHandler: supportGuard,
      schema: { querystring: ContactListQuery, response: { 200: ContactListResponse } },
    },
    async (request) => {
      // The Zod provider already validated AND transformed the query string
      // (`verifiedBlogger` arrives as a boolean) — re-parsing would feed the
      // output back into the input schema.
      return serviceFor().listMessages(request.query);
    },
  );

  // ---------------------------------------------------------------- triage
  app.patch(
    '/admin/contact/:id',
    {
      preHandler: supportGuard,
      config: { rateLimitPolicy: 'sensitive' },
      schema: {
        params: ContactIdParams,
        body: ContactTriageBody,
        response: { 200: ContactTriageResponse },
      },
    },
    audited<
      FastifyRequest,
      {
        data: ContactMessageView;
        requested: { status: ContactStatus | null; assignedTo: string | null };
      }
    >(
      {
        eventType: 'CONTACT_TRIAGED',
        subject: (req) => ContactIdParams.parse(req.params).id,
        message: (_req, res) =>
          res.requested.status !== null
            ? `Contact message triaged → ${res.requested.status}`
            : 'Contact message assignment changed',
        details: (_req, res) => ({
          status: res.requested.status,
          assignedTo: res.requested.assignedTo,
        }),
      },
      async (request, _reply, ctx) => {
        const { id } = ContactIdParams.parse(request.params);
        const body = ContactTriageBody.parse(request.body);
        const view = await serviceFor(asExecutor(ctx.tx)).triage(id, body);
        return {
          data: view,
          requested: { status: body.status ?? null, assignedTo: body.assignedTo ?? null },
        };
      },
    ),
  );

  // ------------------------------------------------------ client directory
  app.get(
    '/admin/clients',
    {
      preHandler: usersGuard,
      schema: { querystring: ClientDirectoryQuery, response: { 200: ClientDirectoryResponse } },
    },
    async (request) => {
      return serviceFor().listClients(request.query);
    },
  );
};

export default fp(contactAdminRoutes, { name: 'contact-admin-routes' });

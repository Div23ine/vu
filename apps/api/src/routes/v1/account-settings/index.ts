import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  AvatarConfirmBody,
  AvatarUploadResponse,
  ProfileSettings,
  UpdateProfileSettingsBody,
} from '@vunvault/contracts';
import { AUDITED } from '../../../audit/audited.js';
import { asExecutor, type SqlExecutor } from '../../../audit/repo.js';
import type { Tx } from '../../../plugins/db.js';
import { HttpError } from '../../../lib/http-error.js';
import { AccountSettingsService } from './service.js';
import { SqlAccountSettingsRepo } from './repo.js';

/**
 * Account settings & avatar (Task 28).
 *
 * Auth is `authenticate` only: any role acts on its own profile, so there is no
 * permission to check — the user id comes from the token, never from the body.
 * Writes are `sensitive` for rate limiting and audited in the same transaction
 * as the domain change.
 */

/**
 * The upload request is validated in the service, not by this schema: the
 * documented failures are `422 file_too_large` and `422 unsupported_type`, and a
 * Zod `max()` would collapse both into a generic `400 validation_failed`.
 */
const AvatarUploadBody = z.object({
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

/** The actor is always the token subject — never anything from the request body. */
function actorId(request: FastifyRequest): string {
  const user = request.user;
  if (user === undefined) throw new HttpError(401, 'unauthorized');
  return user.id;
}

const accountSettingsRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  let cached: AccountSettingsService | undefined;
  /** Built lazily so registering the group never requires a live database. */
  function serviceFor(executor?: SqlExecutor): AccountSettingsService {
    if (executor !== undefined) {
      return new AccountSettingsService({
        repo: new SqlAccountSettingsRepo(executor),
        storage: app.storage,
      });
    }
    if (cached === undefined) {
      if (!app.hasDecorator('db')) {
        throw new HttpError(503, 'service_unavailable', 'Settings are not available');
      }
      cached = new AccountSettingsService({ db: app.db, storage: app.storage });
    }
    return cached;
  }

  app.get(
    '/account/settings',
    {
      preHandler: [app.authenticate],
      schema: { response: { 200: z.object({ data: ProfileSettings }) } },
    },
    async (request) => ({ data: await serviceFor().get(actorId(request)) }),
  );

  const patchHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = UpdateProfileSettingsBody.parse(request.body);
    const userId = actorId(request);

    // The domain write and the audit append commit together.
    const result = await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      const service = serviceFor(executor);
      const updated = await service.update(userId, body);
      await app.audit.append(executor, {
        eventType: 'PROFILE_UPDATED',
        actor: { id: userId, label: AccountSettingsService.usernameFor(updated.settings.email) },
        subject: updated.settings.email,
        message: `${updated.settings.email} updated their profile`,
        // Field names only: a phone number must never reach the audit log.
        details: { fields: updated.changedFields },
        ip: request.ip,
      });
      return updated;
    });

    return reply.send({ data: result.settings });
  };
  (patchHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.patch('/account/settings', {
    preHandler: [app.authenticate],
    config: { rateLimitPolicy: 'sensitive' },
    schema: {
      body: UpdateProfileSettingsBody,
      response: { 200: z.object({ data: ProfileSettings }) },
    },
    handler: patchHandler,
  });

  app.post(
    '/account/avatar/upload-url',
    {
      preHandler: [app.authenticate],
      config: { rateLimitPolicy: 'sensitive' },
      schema: { body: AvatarUploadBody, response: { 200: AvatarUploadResponse } },
    },
    async (request) => ({
      data: await serviceFor().createAvatarUpload(actorId(request), {
        contentType: (request.body as { contentType: string }).contentType,
        sizeBytes: (request.body as { sizeBytes: number }).sizeBytes,
      }),
    }),
  );

  const confirmHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const { objectKey } = AvatarConfirmBody.parse(request.body);
    const userId = actorId(request);

    const settings = await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      const service = serviceFor(executor);
      const updated = await service.confirmAvatar(userId, objectKey);
      await app.audit.append(executor, {
        eventType: 'AVATAR_UPDATED',
        actor: { id: userId, label: AccountSettingsService.usernameFor(updated.email) },
        subject: updated.email,
        message: `${updated.email} changed their avatar`,
        details: { objectKey },
        ip: request.ip,
      });
      return updated;
    });

    return reply.send({ data: settings });
  };
  (confirmHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post('/account/avatar/confirm', {
    preHandler: [app.authenticate],
    config: { rateLimitPolicy: 'sensitive' },
    schema: {
      body: AvatarConfirmBody,
      response: { 200: z.object({ data: ProfileSettings }) },
    },
    handler: confirmHandler,
  });

  const deleteHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = actorId(request);
    const email = (await serviceFor().get(userId)).email;

    await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      await serviceFor(executor).deleteAvatar(userId);
      await app.audit.append(executor, {
        eventType: 'AVATAR_UPDATED',
        actor: { id: userId, label: AccountSettingsService.usernameFor(email) },
        subject: email,
        message: `${email} removed their avatar`,
        details: { removed: true },
        ip: request.ip,
      });
    });

    return reply.status(204).send();
  };
  (deleteHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.delete('/account/avatar', {
    preHandler: [app.authenticate],
    config: { rateLimitPolicy: 'sensitive' },
    schema: { response: { 204: z.null() } },
    handler: deleteHandler,
  });
};

export default fp(accountSettingsRoutes, { name: 'account-settings-routes' });

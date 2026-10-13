import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import {
  audited,
  type AuditSpec,
  type AuditedHandler,
  type AuditedRouteHandler,
} from '../audit/audited';
import { createAuditService, type AuditService } from '../audit/service';

/**
 * Decorates `app.audit` (the chain service) and `app.audited` (the route wrapper).
 *
 * Registered after `auth` so an audit entry can name its actor, and before the
 * routes so every mutating handler can be wrapped.
 */

export interface AuditPluginOptions {
  /** Test seam: an already-built service. */
  service?: AuditService;
  /** Test seam: raw key-ring secrets instead of reading them from `app.secrets`. */
  hmacSecret?: string;
  aesSecret?: string;
}

const auditPlugin: FastifyPluginAsync<AuditPluginOptions> = async (app, options) => {
  let service = options.service;

  if (service === undefined) {
    const hmacSecret = options.hmacSecret ?? (await app.secrets.get('AUDIT_HMAC_KEY'));
    const aesSecret =
      options.aesSecret ?? (await app.secrets.get('AUDIT_AES_KEY').catch(() => undefined));

    service = createAuditService({
      hmacSecret,
      aesSecret,
      log: app.log,
      publish:
        app.redis === undefined
          ? undefined
          : async (channel, payload) => {
              await app.redis.publish(channel, payload);
            },
    });
  }

  app.decorate('audit', service);
  app.decorate(
    'audited',
    <Req extends FastifyRequest, Res>(
      spec: AuditSpec<Req, Res>,
      handler: AuditedHandler<Req, Res>,
    ): AuditedRouteHandler<Req, Res> => audited(spec, handler),
  );
};

export default fp(auditPlugin, { name: 'audit', dependencies: ['auth'] });

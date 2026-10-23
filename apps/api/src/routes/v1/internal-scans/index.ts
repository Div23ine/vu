import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  InternalClaimBody,
  InternalClaimResponse,
  InternalCompleteBody,
  InternalCompleteResponse,
  InternalFindingsBody,
  InternalFailBody,
  InternalLogUrlBody,
  InternalLogUrlResponse,
  InternalProgressBody,
} from '@vunvault/contracts';
import { AUDITED } from '../../../audit/audited';
import { asExecutor, type SqlExecutor } from '../../../audit/repo';
import type { Tx } from '../../../plugins/db';
import { HttpError } from '../../../lib/http-error';
import type { ObjectStorage } from '../../../lib/object-storage';
import { parseCidrList, verifyInternalSignature, type NonceStore } from './hmac-auth';
import { SqlInternalScansRepo, type InternalScansRepo } from './repo';
import { InternalScansService, type NotifyInput } from './service';

/**
 * Internal scan-controller callbacks (Task 40g).
 *
 * No session, no cookies, no CSRF: the HMAC-SHA256 signature over
 * `timestamp.method.path.sha256hex(rawBody)` IS the authentication (see
 * `hmac-auth.ts`), which is why these routes opt into `config.rawBody` and out
 * of CSRF exactly like the provider webhooks. The `webhook` rate policy is
 * unlimited by design; the guard applies its own per-source-IP 600/min cap.
 *
 * claim / complete / fail mutate state AND append their audit entries
 * (`SCAN_STARTED` / `SCAN_COMPLETE` / `SCAN_CANCELLED` / `SCAN_FAILED`, system
 * actor `scan-controller`) inside one transaction — they carry the AUDITED
 * tag by hand, like the webhook handlers, because the `audited()` wrapper's
 * actor model is session-based. progress / findings / log-url are on the
 * conformance AUDIT_EXEMPT list (high-frequency telemetry, no state worth a
 * chain entry — the state changes they accompany are audited).
 *
 * Notifications are dispatched AFTER the commit and are best-effort: a notify
 * outage must never roll back a completed scan.
 */

const JobIdParams = z.object({ id: z.string().uuid() });

export interface InternalScansRoutesOptions {
  /** Test seams: in-memory fakes instead of the live database and providers. */
  repo?: InternalScansRepo;
  nonce?: NonceStore;
  secret?: string;
  clock?: () => Date;
  now?: () => number;
  notify?: (input: NotifyInput) => Promise<void>;
  storage?: Pick<ObjectStorage, 'presignPut'>;
}

function clientIpOf(request: FastifyRequest): string {
  return request.clientIp === '' ? request.ip : request.clientIp;
}

const internalScansRoutes: FastifyPluginAsync<InternalScansRoutesOptions> = async (
  fastify,
  options,
) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  const nonceStore: NonceStore =
    options.nonce ??
    ({
      setIfAbsent: async (key, ttl) => (await app.redis.set(key, '1', 'EX', ttl, 'NX')) === 'OK',
      incrementBucket: async (key, ttl) => {
        const count = await app.redis.incr(key);
        if (count === 1) await app.redis.expire(key, ttl);
        return count;
      },
    } satisfies NonceStore);

  const guard = verifyInternalSignature({
    getSecret: async () => options.secret ?? (await app.secrets.get('SCAN_CONTROLLER_HMAC_KEY')),
    nonce: nonceStore,
    allowedCidrs: parseCidrList(app.env.SCAN_CONTROLLER_CIDRS),
    clientIpOf,
    now: options.now,
    auditFailure: async (request, reason) => {
      try {
        await app.withTx(async (tx: Tx) => {
          await app.audit.append(asExecutor(tx), {
            eventType: 'WEBHOOK_SIGNATURE_INVALID',
            actor: { id: null, label: 'scan-controller' },
            subject: 'internal-scans',
            message: `Internal scan callback rejected: ${reason}`,
            details: { reason, path: request.url },
            ip: clientIpOf(request),
          });
        });
      } catch {
        app.log.error(
          { requestId: request.id },
          'could not record an internal scan signature failure',
        );
      }
    },
  });

  function repoFor(executor?: SqlExecutor): InternalScansRepo {
    if (options.repo !== undefined) return options.repo;
    if (executor === undefined && !app.hasDecorator('db')) {
      throw new HttpError(503, 'service_unavailable', 'Internal scan routes are not available');
    }
    return new SqlInternalScansRepo(executor ?? app.db);
  }

  function serviceFor(executor?: SqlExecutor): InternalScansService {
    return new InternalScansService({
      repo: repoFor(executor),
      audit: app.audit,
      storage: options.storage ?? (app.hasDecorator('storage') ? app.storage : undefined),
      clock: options.clock,
    });
  }

  const notifySeam: (input: NotifyInput) => Promise<void> =
    options.notify ??
    (app.hasDecorator('notify')
      ? async (input) => {
          await app.notify.dispatch(input);
        }
      : async () => undefined);

  async function dispatchAll(notifications: readonly NotifyInput[]): Promise<void> {
    for (const notification of notifications) {
      try {
        await notifySeam(notification);
      } catch (error) {
        app.log.warn({ err: error }, 'could not dispatch an internal-scan notification');
      }
    }
  }

  const routeConfig = { rawBody: true, csrf: false, rateLimitPolicy: 'webhook' } as const;

  // ------------------------------------------------------------------ claim
  const claimHandler = async (request: FastifyRequest, _reply: FastifyReply) => {
    const { id } = JobIdParams.parse(request.params);
    const body = InternalClaimBody.parse(request.body);
    const outcome = await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      return serviceFor(executor).claim(executor, id, body, clientIpOf(request));
    });
    if (outcome.kind === 'authorisation_invalid') {
      // Held in its OWN transaction: the 422 must not roll the status back.
      await app.withTx(async (tx: Tx) => {
        await serviceFor(asExecutor(tx)).hold(id);
      });
      throw new HttpError(
        422,
        'authorisation_invalid',
        'The scan authorisation is missing or expired',
      );
    }
    return { data: outcome.data };
  };
  (claimHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post(
    '/internal/scans/:id/claim',
    {
      preHandler: [guard],
      config: routeConfig,
      schema: {
        params: JobIdParams,
        body: InternalClaimBody,
        response: { 200: InternalClaimResponse },
      },
    },
    claimHandler,
  );

  // --------------------------------------------------------------- progress
  app.post(
    '/internal/scans/:id/progress',
    {
      preHandler: [guard],
      config: routeConfig,
      schema: {
        params: JobIdParams,
        body: InternalProgressBody,
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      const { id } = JobIdParams.parse(request.params);
      const body = InternalProgressBody.parse(request.body);
      await app.withTx(async (tx: Tx) => {
        await serviceFor(asExecutor(tx)).progress(id, body);
      });
      reply.status(204);
      return reply.send(null);
    },
  );

  // --------------------------------------------------------------- findings
  app.post(
    '/internal/scans/:id/findings',
    {
      preHandler: [guard],
      config: routeConfig,
      schema: {
        params: JobIdParams,
        body: InternalFindingsBody,
        response: { 204: z.null() },
      },
    },
    async (request, reply) => {
      const { id } = JobIdParams.parse(request.params);
      const body = InternalFindingsBody.parse(request.body);
      await app.withTx(async (tx: Tx) => {
        await serviceFor(asExecutor(tx)).findings(id, body.findings);
      });
      reply.status(204);
      return reply.send(null);
    },
  );

  // ---------------------------------------------------------------- log-url
  app.post(
    '/internal/scans/:id/log-url',
    {
      preHandler: [guard],
      config: routeConfig,
      schema: {
        params: JobIdParams,
        body: InternalLogUrlBody,
        response: { 200: InternalLogUrlResponse },
      },
    },
    async (request) => {
      const { id } = JobIdParams.parse(request.params);
      const body = InternalLogUrlBody.parse(request.body);
      return { data: await serviceFor().logUrl(id, body) };
    },
  );

  // --------------------------------------------------------------- complete
  const completeHandler = async (request: FastifyRequest, _reply: FastifyReply) => {
    const { id } = JobIdParams.parse(request.params);
    const body = InternalCompleteBody.parse(request.body);
    const outcome = await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      return serviceFor(executor).complete(executor, id, body, clientIpOf(request));
    });
    await dispatchAll(outcome.notifications);
    return { data: outcome.data };
  };
  (completeHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post(
    '/internal/scans/:id/complete',
    {
      preHandler: [guard],
      config: routeConfig,
      schema: {
        params: JobIdParams,
        body: InternalCompleteBody,
        response: { 200: InternalCompleteResponse },
      },
    },
    completeHandler,
  );

  // ------------------------------------------------------------------- fail
  const failHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = JobIdParams.parse(request.params);
    const body = InternalFailBody.parse(request.body);
    const outcome = await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      return serviceFor(executor).fail(executor, id, body, clientIpOf(request));
    });
    if (outcome.notification !== null) await dispatchAll([outcome.notification]);
    reply.status(204);
    return reply.send(null);
  };
  (failHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post(
    '/internal/scans/:id/fail',
    {
      preHandler: [guard],
      config: routeConfig,
      schema: { params: JobIdParams, body: InternalFailBody, response: { 204: z.null() } },
    },
    failHandler,
  );
};

export default fp(internalScansRoutes, { name: 'internal-scans-routes' });

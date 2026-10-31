import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Permission } from '@vunvault/contracts';
import {
  Advisory,
  AdvisoryDraftBody,
  AdvisoryListQuery,
  BroadcastEstimate,
  BroadcastRecord,
  broadcastProgressChannel,
  ClientAdvisory,
  DraftListItem,
  EmergencyBroadcastBody,
  NvdImportQuery,
  NvdImportResult,
  PatchStatusBody,
  RetractBody,
} from '@vunvault/contracts';
import { AUDITED, audited } from '../../../audit/audited.js';
import { asExecutor, type SqlExecutor } from '../../../audit/repo.js';
import type { Tx } from '../../../plugins/db.js';
import { HttpError } from '../../../lib/http-error.js';
import { MAX_STREAMS_PER_USER, SSE_HEADERS, StreamRegistry, type SseWriter } from '../audit/sse.js';
import { HttpNvdClient, type NvdCache, type NvdClient } from './nvd.js';
import { SqlAdvisoriesRepo, type AdvisoriesRepo } from './repo.js';
import { AdvisoriesService, type AdvisoryActor, type AuditInstruction } from './service.js';
import { BroadcastSseSession } from './broadcast-sse.js';

/**
 * Zero-day advisories (Task 38).
 *
 * Admin routes are staff-only and AAL2; the permission differs by consequence —
 * `intel:read` to look, `intel:write` to draft, `intel:broadcast` to page every
 * client in the country. Client routes are the mirror image: a client sees published
 * advisories and nothing else, and can only acknowledge them.
 *
 * Broadcasts are queued, not delivered: this API writes the intent, the audit entry
 * and the `queued` row in one transaction, and hands delivery to the broadcast
 * worker (Layer L11). There is no delete route anywhere in this file.
 */

const AdvisoryIdParams = z.object({ id: z.string().uuid() });

export interface AdvisoriesRoutesOptions {
  /** Test seams. */
  repo?: AdvisoriesRepo;
  nvd?: NvdClient;
  incidentCommanderId?: string | null;
  enqueueBroadcast?: (job: {
    broadcastId: string;
    advisoryId: string;
    kind: string;
  }) => Promise<void>;
  notifyCommander?: (input: { userId: string; title: string; body: string }) => Promise<void>;
  /** Test seams for the Task 94 SSE relay (the audit route's naming). */
  writerFor?: (reply: FastifyReply) => SseWriter;
  progressSubscribe?: (onMessage: (payload: string) => void) => Promise<() => Promise<void>>;
  sessionActive?: (request: FastifyRequest, reply: FastifyReply) => Promise<boolean>;
}

function actorOf(request: FastifyRequest): AdvisoryActor {
  const user = request.user;
  if (user === undefined) throw HttpError.unauthorized();
  return { id: user.id, email: user.email, role: user.role, permissions: user.permissions };
}

function orgIdOf(request: FastifyRequest): string {
  const user = request.user;
  if (user === undefined) throw HttpError.unauthorized();
  if (user.orgId === null || user.orgId === undefined) {
    throw new HttpError(403, 'no_org', 'This account is not attached to an organisation');
  }
  return user.orgId;
}

const advisoriesRoutes: FastifyPluginAsync<AdvisoriesRoutesOptions> = async (fastify, options) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  function repoFor(executor?: SqlExecutor): AdvisoriesRepo {
    if (options.repo !== undefined) return options.repo;
    if (executor === undefined && !app.hasDecorator('db')) {
      throw new HttpError(503, 'service_unavailable', 'Advisories are not available');
    }
    return new SqlAdvisoriesRepo(executor ?? app.db);
  }

  /** Built once: the NVD client is stateless apart from its Redis cache. */
  let nvd: NvdClient | undefined;
  async function nvdClient(): Promise<NvdClient> {
    if (options.nvd !== undefined) return options.nvd;
    if (nvd === undefined) {
      // An absent key is allowed: NVD rate-limits anonymous callers hard, but it
      // still answers, and refusing the import outright would be worse.
      const apiKey = app.hasDecorator('secrets')
        ? await app.secrets.get('NVD_API_KEY').catch(() => undefined)
        : undefined;
      nvd = new HttpNvdClient({
        apiKey,
        cache: app.hasDecorator('redis') ? (app.redis as unknown as NvdCache) : undefined,
        log: app.log,
      });
    }
    return nvd;
  }

  async function serviceFor(executor?: SqlExecutor): Promise<AdvisoriesService> {
    return new AdvisoriesService({
      repo: repoFor(executor),
      audit: app.hasDecorator('audit') ? app.audit : undefined,
      executor,
      nvd: await nvdClient(),
      incidentCommanderId: options.incidentCommanderId ?? null,
    });
  }

  const read = (permission: Permission) => [
    app.authenticate,
    app.requireStaff,
    app.requirePermission(permission),
  ];

  /**
   * Delivery is queued AFTER the transaction commits, and a failure to queue is
   * logged rather than thrown: the advisory is published and audited either way,
   * and a `queued` broadcast row is exactly what the maintenance worker re-enqueues.
   */
  async function enqueueDelivery(job: {
    broadcastId: string;
    advisoryId: string;
    kind: string;
  }): Promise<void> {
    if (options.enqueueBroadcast !== undefined) {
      try {
        await options.enqueueBroadcast(job);
        return;
      } catch (error) {
        app.log.warn(
          { broadcastId: job.broadcastId, err: error },
          'broadcast enqueue failed; the row stays queued',
        );
      }
      return;
    }
    if (!app.hasDecorator('queues')) return;
    try {
      await app.queues.broadcast.add(job.kind, {
        broadcastId: job.broadcastId,
        advisoryId: job.advisoryId,
        kind: job.kind,
      });
    } catch (error) {
      app.log.warn(
        { broadcastId: job.broadcastId, err: error },
        'broadcast enqueue failed; the row stays queued',
      );
    }
  }

  async function notifyCommander(input: {
    userId: string;
    title: string;
    body: string;
  }): Promise<void> {
    try {
      if (options.notifyCommander !== undefined) {
        await options.notifyCommander(input);
        return;
      }
      if (!app.hasDecorator('notify')) return;
      // Critical: a SEV-1 escalation ignores opt-outs and quiet hours.
      await app.notify.dispatch({
        userId: input.userId,
        event: 'advisory_broadcast',
        title: input.title,
        body: input.body,
        critical: true,
      });
    } catch (error) {
      app.log.warn({ err: error }, 'could not page the incident commander');
    }
  }

  // ------------------------------------------------------------ admin reads
  app.get(
    '/admin/advisories/summary',
    {
      preHandler: read('intel:read'),
      schema: {
        response: {
          200: z.object({
            data: z.object({
              activeZeroDays: z.number(),
              criticalSeverity: z.number(),
              unpatchedCritical: z.number(),
              weaponizedInWild: z.number(),
              advisoriesPublished: z.number(),
              broadcastThisMonth: z.number(),
              openDrafts: z.number(),
              escalatedDrafts: z.number(),
              dashboardsReached: z.number(),
              newClientsThisMonth: z.number(),
            }),
          }),
        },
      },
    },
    async () => ({ data: await (await serviceFor()).summary() }),
  );

  app.get(
    '/admin/advisories/drafts',
    {
      preHandler: read('intel:read'),
      schema: {
        response: { 200: z.object({ data: z.array(DraftListItem), total: z.number() }) },
      },
    },
    async () => (await serviceFor()).drafts(),
  );

  app.get(
    '/admin/advisories/nvd',
    {
      preHandler: read('intel:read'),
      schema: {
        querystring: NvdImportQuery,
        response: { 200: z.object({ data: NvdImportResult }) },
      },
    },
    async (request) => {
      const query = NvdImportQuery.parse(request.query);
      return { data: await (await serviceFor()).importFromNvd(query.cveId) };
    },
  );

  app.get(
    '/admin/advisories',
    {
      preHandler: read('intel:read'),
      schema: {
        querystring: AdvisoryListQuery,
        response: { 200: z.object({ data: z.array(Advisory), total: z.number() }) },
      },
    },
    async (request) => {
      const query = AdvisoryListQuery.parse(request.query);
      return (await serviceFor()).list(query);
    },
  );

  app.get(
    '/admin/advisories/:id/broadcasts',
    {
      preHandler: read('intel:read'),
      schema: {
        params: AdvisoryIdParams,
        response: { 200: z.object({ data: z.array(BroadcastRecord) }) },
      },
    },
    async (request) => {
      const { id } = AdvisoryIdParams.parse(request.params);
      return { data: await (await serviceFor()).broadcasts(id) };
    },
  );

  // ------------------------------------------------------- progress stream
  /** Streams this process is holding, per user: the cap is per person, not global. */
  const openBroadcastStreams = new StreamRegistry();

  function defaultBroadcastWriter(reply: FastifyReply): SseWriter {
    const raw = reply.raw;
    return {
      get bufferSize() {
        const stream = raw as unknown as { writableLength?: number };
        return stream.writableLength ?? 0;
      },
      get ended() {
        return (raw as unknown as { writableEnded?: boolean }).writableEnded === true;
      },
      write(chunk: string) {
        return raw.write(chunk);
      },
      end() {
        raw.end();
      },
    };
  }

  async function defaultProgressSubscribe(onMessage: (payload: string) => void) {
    if (!app.hasDecorator('createRedis')) {
      throw new HttpError(503, 'service_unavailable', 'The live broadcast stream needs Redis');
    }
    // A DEDICATED connection: once subscribed, a Redis connection can only
    // receive messages, so it cannot be the app's command connection. The
    // pattern covers EVERY broadcast id — a rebroadcast dispatched after this
    // desk connected gets a fresh id, and the session filters by advisoryId.
    const subscriber = app.createRedis();
    const pattern = broadcastProgressChannel('*');
    await subscriber.psubscribe(pattern);
    const listener = (_pattern: string, _channel: string, payload: string): void =>
      onMessage(payload);
    subscriber.on('pmessage', listener);
    return async () => {
      subscriber.off('pmessage', listener);
      await subscriber.punsubscribe(pattern).catch(() => undefined);
      await subscriber.quit().catch(() => undefined);
    };
  }

  async function defaultBroadcastSessionActive(request: FastifyRequest, reply: FastifyReply) {
    // Re-run the guard: a revoked session stops watching deliveries within one
    // poll (the audit stream's rule).
    try {
      await app.authenticate(request, reply, () => undefined);
      return request.user !== undefined;
    } catch {
      return false;
    }
  }

  app.get(
    '/admin/advisories/:id/broadcasts/stream',
    {
      preHandler: read('intel:read'),
      schema: { params: AdvisoryIdParams },
    },
    async (request, reply) => {
      const { id } = AdvisoryIdParams.parse(request.params);
      const user = request.user;
      if (user === undefined) throw HttpError.unauthorized();

      if (!openBroadcastStreams.reserve(user.id)) {
        throw HttpError.tooManyRequests(
          `At most ${MAX_STREAMS_PER_USER} live broadcast streams per user`,
        );
      }

      const service = await serviceFor();
      const writer = options.writerFor?.(reply) ?? defaultBroadcastWriter(reply);

      reply.hijack();
      reply.raw.writeHead(200, { ...SSE_HEADERS });

      const session = new BroadcastSseSession({
        advisoryId: id,
        writer,
        snapshot: (): Promise<BroadcastRecord[]> => service.broadcasts(id),
        subscribe: options.progressSubscribe ?? defaultProgressSubscribe,
        sessionActive:
          options.sessionActive === undefined
            ? async () => defaultBroadcastSessionActive(request, reply)
            : async () => options.sessionActive?.(request, reply) ?? true,
        log: app.log,
      });

      const onClose = (): void => {
        session.close('client');
        openBroadcastStreams.release(user.id);
      };
      request.raw.on('close', onClose);
      request.raw.on('error', onClose);

      await session.start();
      // The request never resolves: the stream ends when the socket does.
      return reply;
    },
  );

  // ----------------------------------------------------------- admin drafts
  app.post(
    '/admin/advisories',
    {
      preHandler: read('intel:write'),
      config: { rateLimitPolicy: 'sensitive' },
      schema: {
        body: AdvisoryDraftBody,
        response: { 201: z.object({ data: Advisory }) },
      },
    },
    audited<FastifyRequest, { data: Advisory; audit: AuditInstruction[] }>(
      {
        eventType: 'ADVISORY_DRAFT_SAVED',
        subject: (_req, res) => res.data.id,
        message: (_req, res) => res.audit[0]?.message ?? 'Advisory draft saved',
        details: (_req, res) => res.audit[0]?.details ?? {},
      },
      async (request, reply, ctx) => {
        const body = AdvisoryDraftBody.parse(request.body);
        const result = await (
          await serviceFor(asExecutor(ctx.tx))
        ).createDraft(actorOf(request), body);
        reply.status(201);
        return { data: result.advisory, audit: result.audit };
      },
    ),
  );

  app.put(
    '/admin/advisories/:id',
    {
      preHandler: read('intel:write'),
      config: { rateLimitPolicy: 'sensitive' },
      schema: {
        params: AdvisoryIdParams,
        body: AdvisoryDraftBody,
        response: { 200: z.object({ data: Advisory }) },
      },
    },
    audited<FastifyRequest, { data: Advisory; audit: AuditInstruction[] }>(
      {
        eventType: 'ADVISORY_DRAFT_SAVED',
        subject: (_req, res) => res.data.id,
        message: (_req, res) => res.audit[0]?.message ?? 'Advisory draft saved',
        details: (_req, res) => res.audit[0]?.details ?? {},
      },
      async (request, _reply, ctx) => {
        const { id } = AdvisoryIdParams.parse(request.params);
        const body = AdvisoryDraftBody.parse(request.body);
        const result = await (
          await serviceFor(asExecutor(ctx.tx))
        ).updateDraft(actorOf(request), id, body);
        return { data: result.advisory, audit: result.audit };
      },
    ),
  );

  app.post(
    '/admin/advisories/:id/estimate',
    {
      preHandler: read('intel:read'),
      schema: {
        params: AdvisoryIdParams,
        response: { 200: z.object({ data: BroadcastEstimate }) },
      },
    },
    async (request) => {
      const { id } = AdvisoryIdParams.parse(request.params);
      const { estimate } = await (await serviceFor()).estimate(id);
      return { data: estimate };
    },
  );

  // -------------------------------------------------------- admin broadcast
  /**
   * The broadcast routes audit inside their own transaction rather than through
   * the `audited()` wrapper, and the wrapper's symbol is set by hand so the
   * route-table test still sees them as audited. The reason is the chain height:
   * the catalogue requires the SEV-1 entry's `seq` to be written onto the
   * `advisory_broadcasts` row, which only an append performed INSIDE the handler
   * can provide — the wrapper appends after the handler has returned.
   */
  function broadcastHandler(kind: 'initial' | 'rebroadcast') {
    const handler = async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = AdvisoryIdParams.parse(request.params);
      const body = EmergencyBroadcastBody.parse(request.body);
      const actor = actorOf(request);

      const outcome = await app.withTx(async (tx: Tx) => {
        const executor = asExecutor(tx);
        return (await serviceFor(executor)).broadcast(id, actor, body, kind);
      });

      // Committed: publish, then deliver.
      await enqueueDelivery(outcome.job);
      if (outcome.commander !== null) await notifyCommander(outcome.commander);

      return reply.status(202).send({ data: outcome.record });
    };
    (handler as unknown as Record<symbol, boolean>)[AUDITED] = true;
    return handler;
  }

  const broadcastSchema = {
    params: AdvisoryIdParams,
    body: EmergencyBroadcastBody,
    response: { 202: z.object({ data: BroadcastRecord }) },
  } as const;

  app.post('/admin/advisories/:id/broadcast', {
    preHandler: read('intel:broadcast'),
    config: { rateLimitPolicy: 'sensitive' },
    schema: broadcastSchema,
    handler: broadcastHandler('initial'),
  });

  app.post('/admin/advisories/:id/rebroadcast', {
    preHandler: read('intel:broadcast'),
    config: { rateLimitPolicy: 'sensitive' },
    schema: broadcastSchema,
    handler: broadcastHandler('rebroadcast'),
  });

  // ---------------------------------------------------------- admin retract
  const retractInner = audited<FastifyRequest, { data: Advisory }>(
    {
      eventType: 'ADVISORY_RETRACTED',
      subject: (req) => AdvisoryIdParams.parse(req.params).id,
      message: (req) =>
        `${AdvisoryIdParams.parse(req.params).id} retracted: ${RetractBody.parse(req.body).note}`,
      details: (req) => ({ note: RetractBody.parse(req.body).note }),
    },
    async (request, _reply, ctx) => {
      const { id } = AdvisoryIdParams.parse(request.params);
      const body = RetractBody.parse(request.body);
      const result = await (
        await serviceFor(asExecutor(ctx.tx))
      ).retract(id, actorOf(request), body);
      if (result.job !== null) pendingRetractions.set(request, result.job);
      return { data: result.advisory };
    },
  );

  /**
   * The retraction notice is queued after the commit, so the audited handler hands
   * the job out per request rather than through state two requests could share.
   */
  const pendingRetractions = new WeakMap<
    FastifyRequest,
    { broadcastId: string; advisoryId: string; kind: string }
  >();

  const retractHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await retractInner(request, reply);
    const job = pendingRetractions.get(request);
    if (job !== undefined) await enqueueDelivery(job);
    return result;
  };
  (retractHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post('/admin/advisories/:id/retract', {
    preHandler: read('intel:broadcast'),
    config: { rateLimitPolicy: 'sensitive' },
    schema: {
      params: AdvisoryIdParams,
      body: RetractBody,
      response: { 200: z.object({ data: Advisory }) },
    },
    handler: retractHandler,
  });

  app.patch(
    '/admin/advisories/:id/patch-status',
    {
      preHandler: read('intel:write'),
      config: { rateLimitPolicy: 'sensitive' },
      schema: {
        params: AdvisoryIdParams,
        body: PatchStatusBody,
        response: { 200: z.object({ data: Advisory }) },
      },
    },
    audited<FastifyRequest, { data: Advisory; audit: AuditInstruction[] }>(
      {
        eventType: 'ADVISORY_PATCH_STATUS_CHANGED',
        subject: (_req, res) => res.data.id,
        message: (_req, res) => res.audit[0]?.message ?? 'Patch status changed',
        details: (_req, res) => res.audit[0]?.details ?? {},
      },
      async (request, _reply, ctx) => {
        const { id } = AdvisoryIdParams.parse(request.params);
        const body = PatchStatusBody.parse(request.body);
        const result = await (await serviceFor(asExecutor(ctx.tx))).setPatchStatus(id, body);
        return { data: result.advisory, audit: result.audit };
      },
    ),
  );

  // --------------------------------------------------------- client facing
  app.get(
    '/advisories',
    {
      preHandler: [app.authenticate, app.requirePermission('profile:read')],
      schema: {
        response: { 200: z.object({ data: z.array(ClientAdvisory), total: z.number() }) },
      },
    },
    async (request) => (await serviceFor()).clientList(orgIdOf(request)),
  );

  app.post(
    '/advisories/:id/acknowledge',
    {
      preHandler: [app.authenticate, app.requirePermission('profile:read')],
      schema: { params: AdvisoryIdParams, response: { 204: z.null() } },
    },
    audited<FastifyRequest, void>(
      {
        eventType: 'ADVISORY_ACKNOWLEDGED',
        subject: (req) => AdvisoryIdParams.parse(req.params).id,
        message: (req) => `${req.user?.email ?? 'A client'} acknowledged an advisory`,
      },
      async (request, reply, ctx) => {
        const { id } = AdvisoryIdParams.parse(request.params);
        const user = request.user;
        if (user === undefined) throw HttpError.unauthorized();
        await (await serviceFor(asExecutor(ctx.tx))).acknowledge(id, orgIdOf(request), user.id);
        reply.status(204);
        return reply.send(null);
      },
    ),
  );
};

export default fp(advisoriesRoutes, { name: 'advisories-routes' });

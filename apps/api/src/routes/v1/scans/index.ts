import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Permission } from '@vunvault/contracts';
import {
  BulkScanActionBody,
  CreateScanBody,
  GateDecisionBody,
  ScanFinding,
  ScanJob,
  ScanListQuery,
  ScanQueueSummary,
} from '@vunvault/contracts';
import { actorLabelFor, AUDITED, audited } from '../../../audit/audited.js';
import { asExecutor, type SqlExecutor } from '../../../audit/repo.js';
import type { Tx } from '../../../plugins/db.js';
import { HttpError } from '../../../lib/http-error.js';
import type { ObjectStorage } from '../../../lib/object-storage.js';
import { InvoiceIssuer } from '../../../billing/invoice-issuer.js';
import { SqlScansRepo, type ScansRepo } from './repo.js';
import {
  ScansService,
  workerSlotsTotal,
  type AuditInstruction,
  type ScanActor,
  type ScansServiceDeps,
} from './service.js';
import { AUTHORISATION_CONTENT_TYPE, AUTHORISATION_MAX_BYTES } from './authorisation.js';

/**
 * Scans: client intake and the admin queue (Task 35).
 *
 * Client routes are org-scoped AND release-locked; the lock itself lives in
 * `visibility.ts` and is applied by the repository, not here. Admin routes are
 * staff-only and AAL2 — `requireStaff` refuses a first-factor session, which is
 * the point of a gate that decides whether a penetration-test report is handed to
 * a customer.
 *
 * Creating a job enqueues work; it never runs a scan. The API has no path to scan
 * infrastructure.
 */

const JobIdParams = z.object({ id: z.string().uuid() });

const AuthorisationUrlBody = z.object({
  contentType: z.literal(AUTHORISATION_CONTENT_TYPE),
  sizeBytes: z.number().int().positive().max(AUTHORISATION_MAX_BYTES),
});

const AuthorisationUrlResponse = z.object({
  uploadUrl: z.string().url(),
  objectKey: z.string(),
  expiresAt: z.string().datetime(),
});

const ScanJobResponse = z.object({ data: ScanJob });
const ScanJobListResponse = z.object({ data: z.array(ScanJob), total: z.number() });
const FindingsResponse = z.object({ data: z.array(ScanFinding) });
const SummaryResponse = z.object({ data: ScanQueueSummary });
const BulkResponse = z.object({
  data: z.object({ updated: z.number().int().nonnegative(), skippedIds: z.array(z.string()) }),
});

export interface ScansRoutesOptions {
  /** Test seams: in-memory fakes instead of the live database, storage and queues. */
  repo?: ScansRepo;
  storage?: ObjectStorage;
  issuer?: Pick<InvoiceIssuer, 'issue'>;
  seams?: Partial<
    Pick<
      ScansServiceDeps,
      'enqueueScan' | 'enqueuePdf' | 'enqueueEmail' | 'notify' | 'removeQueued' | 'publishAbort'
    >
  >;
  workerSlotsTotal?: number;
}

function orgIdOf(request: FastifyRequest): string {
  const user = request.user;
  if (user === undefined) throw HttpError.unauthorized();
  if (user.orgId === null || user.orgId === undefined) {
    throw new HttpError(403, 'no_org', 'This account is not attached to an organisation');
  }
  return user.orgId;
}

function actorOf(request: FastifyRequest): ScanActor {
  const user = request.user;
  if (user === undefined) throw HttpError.unauthorized();
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    permissions: user.permissions,
  };
}

/** The guard set every admin scan route carries: session, second factor, permission. */
type GuardSource = Pick<FastifyInstance, 'authenticate' | 'requireStaff' | 'requirePermission'>;

function staffGuard(
  app: GuardSource,
  permission: Extract<Permission, 'scans:read' | 'scans:review' | 'scans:release'>,
) {
  return [app.authenticate, app.requireStaff, app.requirePermission(permission)];
}

const scansRoutes: FastifyPluginAsync<ScansRoutesOptions> = async (fastify, options) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  function repoFor(executor?: SqlExecutor): ScansRepo {
    if (options.repo !== undefined) return options.repo;
    if (executor === undefined && !app.hasDecorator('db')) {
      throw new HttpError(503, 'service_unavailable', 'Scans are not available');
    }
    return new SqlScansRepo(executor ?? app.db);
  }

  function serviceFor(executor?: SqlExecutor): ScansService {
    const seams = options.seams ?? {};
    return new ScansService({
      repo: repoFor(executor),
      executor,
      storage: options.storage ?? (app.hasDecorator('storage') ? app.storage : undefined),
      issuer: options.issuer ?? new InvoiceIssuer(),
      enqueueScan:
        seams.enqueueScan ??
        (app.hasDecorator('queues')
          ? async (payload, queueJobId) => {
              await app.queues.scan.add(payload.scanType, payload, { jobId: queueJobId });
            }
          : undefined),
      enqueuePdf:
        seams.enqueuePdf ??
        (app.hasDecorator('queues')
          ? async (payload) => {
              await app.queues.pdf.add(payload.kind, payload);
            }
          : undefined),
      enqueueEmail:
        seams.enqueueEmail ??
        (app.hasDecorator('queues')
          ? async (payload) => {
              await app.queues.notify.add('email', { channel: 'email', ...payload });
            }
          : undefined),
      notify:
        seams.notify ??
        (app.hasDecorator('notify')
          ? async ({ userId, title, body }) => {
              await app.notify.dispatch({
                userId,
                event: 'scan_completed',
                title,
                body,
                // Non-critical: it respects the client's own preferences.
                critical: false,
              });
            }
          : undefined),
      removeQueued:
        seams.removeQueued ??
        (app.hasDecorator('queues')
          ? async (queueJobId) => {
              const job = await app.queues.scan.getJob(queueJobId);
              await job?.remove();
            }
          : undefined),
      publishAbort:
        seams.publishAbort ??
        (app.hasDecorator('redis')
          ? async (channel, payload) => {
              await app.redis.publish(channel, JSON.stringify(payload));
            }
          : undefined),
      workerSlotsTotal: options.workerSlotsTotal ?? workerSlotsTotal(),
    });
  }

  /** Append every entry a service asked for, in the caller's transaction. */
  async function appendAll(
    executor: SqlExecutor,
    request: FastifyRequest,
    actor: ScanActor,
    instructions: AuditInstruction[],
  ): Promise<void> {
    for (const instruction of instructions) {
      await app.audit.append(executor, {
        eventType: instruction.eventType,
        actor: { id: actor.id, label: actorLabelFor(actor.email) },
        subject: instruction.subject,
        message: instruction.message,
        details: instruction.details,
        ip: request.clientIp === '' ? request.ip : request.clientIp,
      });
    }
  }

  // ------------------------------------------------------- client: uploads
  app.post(
    '/scans/authorisation-url',
    {
      preHandler: [app.authenticate, app.requirePermission('scans:create')],
      schema: {
        body: AuthorisationUrlBody,
        response: { 200: z.object({ data: AuthorisationUrlResponse }) },
      },
    },
    async (request) => {
      AuthorisationUrlBody.parse(request.body);
      return { data: await serviceFor().authorisationUpload(orgIdOf(request)) };
    },
  );

  // -------------------------------------------------------- client: create
  app.post(
    '/scans',
    {
      preHandler: [app.authenticate, app.requirePermission('scans:create')],
      config: { rateLimitPolicy: 'sensitive' },
      schema: { body: CreateScanBody, response: { 201: ScanJobResponse } },
    },
    audited<FastifyRequest, { data: ScanJob; audit: AuditInstruction[] }>(
      {
        eventType: 'SCAN_REQUESTED',
        subject: (_req, res) => res.data.id,
        message: (_req, res) => res.audit[0]?.message ?? 'Scan requested',
        details: (_req, res) => res.audit[0]?.details ?? {},
      },
      async (request, reply, ctx) => {
        const body = CreateScanBody.parse(request.body);
        const result = await serviceFor(asExecutor(ctx.tx)).createScan(
          orgIdOf(request),
          actorOf(request),
          body,
        );
        reply.status(201);
        return { data: result.job, audit: result.audit };
      },
    ),
  );

  // --------------------------------------------------------- client: reads
  app.get(
    '/scans',
    {
      preHandler: [app.authenticate, app.requirePermission('scans:read')],
      schema: { querystring: ScanListQuery, response: { 200: ScanJobListResponse } },
    },
    async (request) => {
      const query = ScanListQuery.parse(request.query);
      return serviceFor().clientList(orgIdOf(request), query);
    },
  );

  app.get(
    '/scans/:id',
    {
      preHandler: [app.authenticate, app.requirePermission('scans:read')],
      schema: { params: JobIdParams, response: { 200: ScanJobResponse } },
    },
    async (request) => {
      const { id } = JobIdParams.parse(request.params);
      // A job this caller may not see is a 404: the release lock does not admit
      // that the job exists.
      return { data: await serviceFor().clientJob(orgIdOf(request), id) };
    },
  );

  app.get(
    '/scans/:id/findings',
    {
      preHandler: [app.authenticate, app.requirePermission('scans:read')],
      schema: { params: JobIdParams, response: { 200: FindingsResponse } },
    },
    async (request) => {
      const { id } = JobIdParams.parse(request.params);
      return { data: await serviceFor().clientFindings(orgIdOf(request), id) };
    },
  );

  // --------------------------------------------------------- admin: reads
  app.get(
    '/admin/scans/summary',
    {
      preHandler: staffGuard(app, 'scans:read'),
      schema: { response: { 200: SummaryResponse } },
    },
    async () => ({ data: await serviceFor().summary() }),
  );

  app.get(
    '/admin/scans',
    {
      preHandler: staffGuard(app, 'scans:read'),
      schema: { querystring: ScanListQuery, response: { 200: ScanJobListResponse } },
    },
    async (request) => {
      const query = ScanListQuery.parse(request.query);
      return serviceFor().adminList(query);
    },
  );

  // ------------------------------------------------------ admin: the gate
  /**
   * Audited by hand rather than through `audited()`: a decision writes more than
   * one entry, and the payment lock has to COMMIT the decision and the
   * `RELEASE_LOCK_VIOLATION` entry before it answers 409. Throwing inside the
   * transaction would roll back the very record that explains the refusal.
   */
  const gateHandler = async (request: FastifyRequest, _reply: FastifyReply) => {
    const { id } = JobIdParams.parse(request.params);
    const body = GateDecisionBody.parse(request.body);
    const actor = actorOf(request);

    const result = await app.withTx(async (tx: Tx) => {
      const executor = asExecutor(tx);
      const outcome = await serviceFor(executor).gateDecision(id, actor, body);
      await appendAll(executor, request, actor, outcome.audit);
      return outcome;
    });

    // Committed. Now the client is told the release did not happen.
    if (result.outcome === 'blocked_payment') {
      throw new HttpError(
        409,
        'payment_outstanding',
        'The report is approved but cannot be released until this invoice is paid',
      );
    }
    return { data: result.job };
  };
  (gateHandler as unknown as Record<symbol, boolean>)[AUDITED] = true;

  app.post('/admin/scans/:id/gate-decision', {
    preHandler: staffGuard(app, 'scans:review'),
    config: { rateLimitPolicy: 'sensitive' },
    schema: {
      params: JobIdParams,
      body: GateDecisionBody,
      response: { 200: ScanJobResponse },
    },
    handler: gateHandler,
  });

  // ---------------------------------------------------------- admin: bulk
  app.post(
    '/admin/scans/bulk',
    {
      preHandler: staffGuard(app, 'scans:review'),
      config: { rateLimitPolicy: 'sensitive' },
      schema: { body: BulkScanActionBody, response: { 200: BulkResponse } },
    },
    audited<
      FastifyRequest,
      { data: { updated: number; skippedIds: string[] }; audit: AuditInstruction[] }
    >(
      {
        eventType: 'BULK_SCAN_ACTION',
        message: (_req, res) => res.audit[0]?.message ?? 'Bulk scan action',
        details: (_req, res) => res.audit[0]?.details ?? {},
      },
      async (request, _reply, ctx) => {
        const body = BulkScanActionBody.parse(request.body);
        const result = await serviceFor(asExecutor(ctx.tx)).bulk(body);
        return {
          data: { updated: result.updated, skippedIds: result.skippedIds },
          audit: result.audit,
        };
      },
    ),
  );

  // ----------------------------------------------- admin: payment + cancel
  app.post(
    '/admin/scans/:id/request-payment',
    {
      preHandler: staffGuard(app, 'scans:review'),
      config: { rateLimitPolicy: 'sensitive' },
      schema: { params: JobIdParams, response: { 200: ScanJobResponse } },
    },
    audited<FastifyRequest, { data: ScanJob; audit: AuditInstruction[] }>(
      {
        eventType: 'SCAN_PAYMENT_REQUESTED',
        subject: (_req, res) => res.data.id,
        message: (_req, res) => res.audit[0]?.message ?? 'Payment requested',
        details: (_req, res) => res.audit[0]?.details ?? {},
      },
      async (request, _reply, ctx) => {
        const { id } = JobIdParams.parse(request.params);
        const result = await serviceFor(asExecutor(ctx.tx)).requestPayment(id);
        return { data: result.job, audit: result.audit };
      },
    ),
  );

  app.post(
    '/admin/scans/:id/cancel',
    {
      preHandler: staffGuard(app, 'scans:review'),
      config: { rateLimitPolicy: 'sensitive' },
      schema: { params: JobIdParams, response: { 200: ScanJobResponse } },
    },
    audited<FastifyRequest, { data: ScanJob; audit: AuditInstruction[] }>(
      {
        eventType: 'SCAN_CANCELLED',
        subject: (_req, res) => res.data.id,
        message: (_req, res) => res.audit[0]?.message ?? 'Scan cancelled',
        details: (_req, res) => res.audit[0]?.details ?? {},
      },
      async (request, _reply, ctx) => {
        const { id } = JobIdParams.parse(request.params);
        const result = await serviceFor(asExecutor(ctx.tx)).cancel(id);
        return { data: result.job, audit: result.audit };
      },
    ),
  );
};

export default fp(scansRoutes, { name: 'scans-routes' });

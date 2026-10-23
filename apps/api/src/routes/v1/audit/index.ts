import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { ChainStatus } from '@vunvault/contracts';
import { AuditQuery } from '@vunvault/contracts';
import { actorLabelFor, audited } from '../../../audit/audited';
import { asExecutor, type SqlExecutor } from '../../../audit/repo';
import {
  AUDIT_STREAM_CHANNEL,
  type AuditEntryView,
  type AuditService,
} from '../../../audit/service';
import { HttpError } from '../../../lib/http-error';
import { auditCsvFilename, auditCsvHeaderLine, auditCsvRow, EXPORT_MAX_ROWS } from './csv';
import {
  MAX_STREAMS_PER_USER,
  parseLastEventId,
  SseSession,
  SSE_HEADERS,
  StreamRegistry,
  type SseWriter,
} from './sse';
import { SqlAuditReadRepo, type AuditReadRepo } from './repo';
import { AuditReadService, RedisVerifyLock, type VerifyLock } from './service';

/**
 * The audit trail, read-only (Task 39).
 *
 * Every route here is GET except `POST …/verify`, which runs a verification — it
 * changes no entry, and the only row it writes is a checkpoint recording that the
 * chain was checked. `audit-routes.test.ts` walks the route table and fails if a
 * PUT, PATCH or DELETE ever appears under this prefix.
 *
 * The list projection excludes `details`, `sealed_details`, `nonce`, `signature`
 * and `key_id`: the panel shows who did what and when, and the hashes that let
 * anybody prove it. It does not hand over the material needed to forge a proof.
 */

const VerifyBody = z.object({ incremental: z.boolean().optional() });

export interface AuditRoutesOptions {
  /** Test seams. */
  repo?: AuditReadRepo;
  verifier?: Pick<AuditService, 'verify'>;
  lock?: VerifyLock;
  node?: string;
  now?: () => Date;
  /** Subscribes to `audit:stream`; resolves to a teardown. */
  subscribe?: (onMessage: (payload: string) => void) => Promise<() => Promise<void>>;
  /** Wraps `reply.raw` as an `SseWriter`; overridden in tests. */
  writerFor?: (reply: FastifyReply) => SseWriter;
  sessionActive?: (request: FastifyRequest, reply: FastifyReply) => Promise<boolean>;
}

/** What an export wrote, handed from the handler to the audit spec. */
interface ExportStats {
  rows: number;
  filters: Record<string, unknown>;
}

const auditRoutes: FastifyPluginAsync<AuditRoutesOptions> = async (fastify, options) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  function repoFor(executor?: SqlExecutor): AuditReadRepo {
    if (options.repo !== undefined) return options.repo;
    if (executor === undefined && !app.hasDecorator('db')) {
      throw new HttpError(503, 'service_unavailable', 'The audit log is not available');
    }
    return new SqlAuditReadRepo(executor ?? app.db);
  }

  function serviceFor(executor?: SqlExecutor): AuditReadService {
    return new AuditReadService({
      repo: repoFor(executor),
      verifier: options.verifier ?? app.audit,
      lock: options.lock ?? (app.hasDecorator('redis') ? redisLock() : undefined),
      node: options.node,
      now: options.now,
    });
  }

  let lock: VerifyLock | undefined;
  function redisLock(): VerifyLock {
    lock ??= new RedisVerifyLock(
      app.redis as unknown as ConstructorParameters<typeof RedisVerifyLock>[0],
      // A token per process: releasing somebody else's lock would let two
      // verifications run at once, which is the thing the lock prevents.
      crypto.randomUUID(),
    );
    return lock;
  }

  const guard = [app.authenticate, app.requireStaff, app.requirePermission('audit:read')];

  // ------------------------------------------------------------------ list
  app.get(
    '/admin/audit',
    {
      preHandler: guard,
      schema: {
        querystring: AuditQuery,
        response: { 200: z.object({ data: z.array(AuditEntryViewSchema()), total: z.number() }) },
      },
    },
    async (request) => {
      const query = AuditQuery.parse(request.query);
      return serviceFor().list(query);
    },
  );

  app.get(
    '/admin/audit/summary',
    {
      preHandler: guard,
      schema: {
        response: {
          200: z.object({
            data: z.object({
              events24h: z.number(),
              authAttempts: z.number(),
              failedAuth: z.number(),
              lockedOut: z.number(),
              scanCompletions: z.number(),
              reportReleases: z.number(),
              chainIntegrityPercent: z.number(),
              hashMismatches: z.number(),
              retentionYears: z.number(),
            }),
          }),
        },
      },
    },
    async () => ({ data: await serviceFor().summary() }),
  );

  app.get(
    '/admin/audit/chain',
    {
      preHandler: guard,
      schema: {
        response: {
          200: z.object({
            data: z.object({
              state: z.enum(['intact', 'broken']),
              totalEntries: z.number(),
              genesisDate: z.string(),
              lastVerifiedAt: z.string().datetime().nullable(),
              hashMismatches: z.number(),
              headHash: z.string(),
              node: z.string(),
              encryption: z.literal('AES-256-GCM'),
            }),
          }),
        },
      },
    },
    async () => ({ data: await serviceFor().chain() }),
  );

  // ---------------------------------------------------------------- verify
  app.post(
    '/admin/audit/verify',
    {
      preHandler: [app.authenticate, app.requireStaff, app.requirePermission('audit:verify')],
      config: { rateLimitPolicy: 'sensitive' },
      schema: {
        body: VerifyBody,
        response: {
          200: z.object({
            data: z.object({
              checkedFromSeq: z.number(),
              checkedToSeq: z.number(),
              entries: z.number(),
              mismatches: z.number(),
              firstMismatchSeq: z.number().nullable(),
              verifiedAt: z.string().datetime(),
            }),
          }),
        },
      },
    },
    audited<
      FastifyRequest,
      { data: unknown; broken: boolean; entries: number; mismatches: number }
    >(
      {
        eventType: 'CHAIN_VERIFIED',
        // A chain that does not verify is the worst thing this log can report, so
        // the message and the details both say so plainly. (`AuditSpec` carries no
        // severity field, so the catalogue's `ok` for CHAIN_VERIFIED stands; the
        // breakage is in the text an auditor reads.)
        message: (_req, res) =>
          res.broken
            ? `Chain verification found ${res.mismatches} mismatched entries`
            : `Chain verified: ${res.entries} entries, no mismatches`,
        details: (_req, res) => ({
          entries: res.entries,
          mismatches: res.mismatches,
          state: res.broken ? 'broken' : 'intact',
        }),
      },
      async (request, _reply, ctx) => {
        const body = VerifyBody.parse(request.body ?? {});
        const user = request.user;
        if (user === undefined) throw HttpError.unauthorized();
        const outcome = await serviceFor(asExecutor(ctx.tx)).verify(
          asExecutor(ctx.tx),
          { id: user.id, label: actorLabelFor(user.email) },
          { incremental: body.incremental },
        );
        return {
          data: outcome.result,
          broken: outcome.broken,
          entries: outcome.result.entries,
          mismatches: outcome.result.mismatches,
        };
      },
    ),
  );

  // ---------------------------------------------------------------- export
  /** Written by the handler, read by the audit spec: one export, one entry. */
  const exportStats = new WeakMap<FastifyRequest, ExportStats>();

  app.get(
    '/admin/audit/export',
    {
      preHandler: guard,
      config: { rateLimitPolicy: 'sensitive' },
    },
    audited<FastifyRequest, FastifyReply>(
      {
        eventType: 'LOG_BACKUP',
        message: () => 'Audit log export generated',
        details: (req) => {
          const stats = exportStats.get(req);
          return { rows: stats?.rows ?? 0, filters: stats?.filters ?? {} };
        },
      },
      async (request, reply, ctx) => {
        const query = AuditQuery.parse(request.query);
        const service = serviceFor(asExecutor(ctx.tx));

        // Count first: refusing before any byte is written is the only way to
        // answer 422 rather than truncating a file somebody will trust.
        const probe = await service.list({ ...query, page: 1, pageSize: 1 });
        if (probe.total > EXPORT_MAX_ROWS) {
          throw new HttpError(
            422,
            'range_too_large',
            `Narrow the filter: an export is capped at ${EXPORT_MAX_ROWS} rows`,
          );
        }

        const filters = {
          range: query.range,
          category: query.category ?? null,
          severity: query.severity ?? null,
          actor: query.actor ?? null,
          q: query.q ?? null,
        };
        exportStats.set(request, { rows: 0, filters });

        reply.hijack();
        reply.raw.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${auditCsvFilename(service.currentDate())}"`,
          'Cache-Control': 'private, no-store',
        });
        reply.raw.write(auditCsvHeaderLine());

        let rows = 0;
        for await (const batch of service.exportRows(query)) {
          for (const entry of batch) {
            reply.raw.write(auditCsvRow(entry));
            rows += 1;
          }
        }
        exportStats.set(request, { rows, filters });
        reply.raw.end();
        return reply;
      },
    ),
  );

  // ---------------------------------------------------------------- stream
  /** Streams this process is holding, per user: the cap is per person, not global. */
  const openStreams = new StreamRegistry();

  function defaultWriter(reply: FastifyReply): SseWriter {
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

  async function defaultSubscribe(onMessage: (payload: string) => void) {
    if (!app.hasDecorator('createRedis')) {
      throw new HttpError(503, 'service_unavailable', 'The live audit stream needs Redis');
    }
    // A DEDICATED connection: once subscribed, a Redis connection can only
    // receive messages, so it cannot be the app's command connection.
    const subscriber = app.createRedis();
    await subscriber.subscribe(AUDIT_STREAM_CHANNEL);
    const listener = (_channel: string, payload: string): void => onMessage(payload);
    subscriber.on('message', listener);
    return async () => {
      subscriber.off('message', listener);
      await subscriber.unsubscribe(AUDIT_STREAM_CHANNEL).catch(() => undefined);
      await subscriber.quit().catch(() => undefined);
    };
  }

  async function defaultSessionActive(request: FastifyRequest, reply: FastifyReply) {
    // Re-run the guard: it re-verifies the cookie and re-reads the session
    // registry, so a revoked session stops seeing the log within one poll.
    try {
      await app.authenticate(request, reply, () => undefined);
      return request.user !== undefined;
    } catch {
      return false;
    }
  }

  app.get('/admin/audit/stream', { preHandler: guard }, async (request, reply) => {
    const user = request.user;
    if (user === undefined) throw HttpError.unauthorized();

    if (!openStreams.reserve(user.id)) {
      throw HttpError.tooManyRequests(
        `At most ${MAX_STREAMS_PER_USER} live audit streams per user`,
      );
    }

    const service = serviceFor();
    const writer = options.writerFor?.(reply) ?? defaultWriter(reply);

    reply.hijack();
    reply.raw.writeHead(200, { ...SSE_HEADERS });

    const session = new SseSession({
      writer,
      chain: async (): Promise<ChainStatus> => service.chain(),
      replay: (afterSeq, limit): Promise<AuditEntryView[]> => service.replay(afterSeq, limit),
      subscribe: options.subscribe ?? defaultSubscribe,
      sessionActive:
        options.sessionActive === undefined
          ? async () => defaultSessionActive(request, reply)
          : async () => options.sessionActive?.(request, reply) ?? true,
      log: app.log,
    });

    const onClose = (): void => {
      session.close('client');
      openStreams.release(user.id);
    };
    request.raw.on('close', onClose);
    request.raw.on('error', onClose);

    await session.start(parseLastEventId(request.headers['last-event-id']));
    // The request never resolves: the stream ends when the socket does.
    return reply;
  });
};

/** The list projection, redeclared so the response cannot widen by accident. */
function AuditEntryViewSchema() {
  return z.object({
    seq: z.number(),
    id: z.string(),
    category: z.string(),
    eventType: z.string(),
    severity: z.string(),
    sevLevel: z.number().nullable(),
    actorLabel: z.string(),
    message: z.string(),
    ip: z.string().nullable(),
    subject: z.string().nullable(),
    hash: z.string(),
    prevHash: z.string(),
    createdAt: z.string(),
  });
}

export default fp(auditRoutes, { name: 'audit-routes' });

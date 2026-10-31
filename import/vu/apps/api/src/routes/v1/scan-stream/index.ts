import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import websocketPlugin from '@fastify/websocket';
import type { WebSocket } from 'ws';
import { asExecutor } from '../../../audit/repo.js';
import { HttpError } from '../../../lib/http-error.js';
import type { Tx } from '../../../plugins/db.js';
import { SqlScansRepo, type ScansRepo } from '../scans/repo.js';
import { liveChannel, replayBufferKey } from './channels.js';
import { ScanStreamSession, type RelaySocket } from './session.js';
import { ScanStreamService, type ScanStreamActor, type ScanStreamTarget } from './service.js';

/**
 * `GET /api/v1/scans/:id/stream` — the scan terminal relay (Task 95).
 *
 * Everything dangerous about this route is decided BEFORE the upgrade: the
 * guard chain (session → staff → `scans:read`), the exact-Origin check, the
 * job load and the socket caps all run as preHandlers, which `@fastify/
 * websocket` executes before hijacking the socket — so every refusal is a
 * plain HTTP status. That matters: the browser WebSocket API cannot read an
 * HTTP error body, so a post-upgrade rejection is a rejection no client can
 * diagnose.
 *
 * The Origin check is the CSRF defence. Cookies authenticate the handshake,
 * and the only thing between a malicious page and a live scan feed (plus four
 * control verbs) is that `Origin` equals `WEB_ORIGIN` exactly. A mismatch is
 * audited as `CSRF_REJECTED`: someone just tried.
 *
 * Clients (role `client`) are refused by `requireStaff` — the release lock
 * means a customer NEVER sees live scan output, only the released report.
 */

const JobIdParams = z.object({ id: z.string().uuid() });
const StreamQuery = z.object({
  after: z.coerce.number().int().positive().optional(),
});

/** Hard caps. In-process registries: the audit `StreamRegistry` precedent. */
const MAX_SOCKETS_PER_USER_PER_JOB = 3;
const MAX_SOCKETS_PER_PROCESS = 400;

/** Client frames are ≤ 1 KB: the plugin's `maxPayload` is the first defence. */
export const CLIENT_PAYLOAD_MAX_BYTES = 1_024;

interface Handshake {
  target: ScanStreamTarget;
  actor: ScanStreamActor;
  after: number | null;
  /** Null when the request was not an upgrade (no slot was taken). */
  capKey: string | null;
}

export interface ScanStreamRoutesOptions {
  /** Test seams. */
  repo?: ScansRepo;
  /** Replaces the Redis replay read (`LRANGE scan:buf:<jobId> 0 -1`). */
  replay?: (jobId: string) => Promise<string[]>;
  /** Replaces the dedicated-connection Pub/Sub subscription. */
  subscribe?: (jobId: string, onMessage: (payload: string) => void) => Promise<() => Promise<void>>;
  /** Replaces the control publish (the audit transaction still runs). */
  publish?: (channel: string, payload: string) => Promise<unknown>;
  sessionActive?: (request: FastifyRequest) => Promise<boolean>;
  /** Test seam: pre-counted per-(user, job) sockets for route-level 429s. */
  openSockets?: Map<string, number>;
  /** Test seam: the per-process counter. */
  processSocketCount?: { value: number };
}

/** The narrow `ws` surface the session drives. */
function relaySocketOf(socket: WebSocket): RelaySocket {
  return {
    send: (payload) => socket.send(payload),
    close: (code, reason) => socket.close(code, reason),
    ping: () => {
      socket.ping();
    },
    get bufferedAmount() {
      return socket.bufferedAmount;
    },
  };
}

const scanStreamRoutes: FastifyPluginAsync<ScanStreamRoutesOptions> = async (fastify, options) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  await app.register(websocketPlugin, {
    options: { maxPayload: CLIENT_PAYLOAD_MAX_BYTES },
  });

  /** `${userId}:${jobId}` → open sockets. A crashed process takes its counts with it. */
  const openSockets = options.openSockets ?? new Map<string, number>();
  const processCount = options.processSocketCount ?? { value: 0 };
  /** preHandler → ws handler, per request (the audit route's `exportStats` pattern). */
  const handshakes = new WeakMap<FastifyRequest, Handshake>();

  function releaseCap(capKey: string): void {
    const current = openSockets.get(capKey) ?? 0;
    if (current <= 1) openSockets.delete(capKey);
    else openSockets.set(capKey, current - 1);
    processCount.value = Math.max(0, processCount.value - 1);
  }

  function repoFor(): ScansRepo {
    if (options.repo !== undefined) return options.repo;
    if (!app.hasDecorator('db')) {
      throw new HttpError(503, 'service_unavailable', 'The scan stream needs the database');
    }
    return new SqlScansRepo(app.db);
  }

  function serviceFor(): ScanStreamService {
    return new ScanStreamService({
      repo: repoFor(),
      audit: app.audit,
      withTx: (work: (tx: Tx) => Promise<void>) => app.withTx(work),
      publish:
        options.publish ??
        ((channel, payload) => {
          if (!app.hasDecorator('redis')) {
            throw new HttpError(503, 'service_unavailable', 'The scan stream needs Redis');
          }
          return app.redis.publish(channel, payload);
        }),
    });
  }

  function actorOf(request: FastifyRequest): ScanStreamActor {
    const user = request.user;
    if (user === undefined) throw HttpError.unauthorized();
    return { id: user.id, email: user.email, role: user.role, permissions: user.permissions };
  }

  function clientIpOf(request: FastifyRequest): string {
    return (request.clientIp as string | undefined) ?? request.ip ?? '';
  }

  async function defaultReplay(jobId: string): Promise<string[]> {
    if (!app.hasDecorator('redis')) {
      throw new HttpError(503, 'service_unavailable', 'The scan stream needs Redis');
    }
    return app.redis.lrange(replayBufferKey(jobId), 0, -1);
  }

  async function defaultSubscribe(
    jobId: string,
    onMessage: (payload: string) => void,
  ): Promise<() => Promise<void>> {
    if (!app.hasDecorator('createRedis')) {
      throw new HttpError(503, 'service_unavailable', 'The scan stream needs Redis');
    }
    // A DEDICATED connection per viewer: a subscribed Redis connection can
    // only receive, and one open terminal must not monopolise the command
    // connection every other route shares.
    const subscriber = app.createRedis();
    const channel = liveChannel(jobId);
    await subscriber.subscribe(channel);
    const listener = (_channel: string, payload: string): void => onMessage(payload);
    subscriber.on('message', listener);
    return async () => {
      subscriber.off('message', listener);
      await subscriber.unsubscribe(channel).catch(() => undefined);
      await subscriber.quit().catch(() => undefined);
    };
  }

  /**
   * The whole pre-upgrade gate. Runs AFTER the guard chain, so `request.user`
   * exists; every failure is a normal HTTP error the browser can report.
   */
  async function handshakeGate(request: FastifyRequest): Promise<void> {
    const origin = request.headers.origin;
    if (origin !== app.env.WEB_ORIGIN) {
      const user = request.user;
      // Fire-and-forget: the evidence is recorded, but a rejected handshake
      // must not wait on (or fail because of) the chain write.
      void app
        .withTx(async (tx: Tx) => {
          await app.audit.append(asExecutor(tx), {
            eventType: 'CSRF_REJECTED',
            actor:
              user === undefined
                ? { id: null, label: 'anonymous' }
                : { id: user.id, label: user.email },
            subject: 'scan-stream',
            message: 'WebSocket origin rejected for scan stream',
            details: { origin: origin ?? null, path: request.url },
            ip: clientIpOf(request),
          });
        })
        .catch((error: unknown) => {
          app.log.warn({ err: error }, 'could not record the rejected scan stream origin');
        });
      throw HttpError.forbidden();
    }

    const { id } = JobIdParams.parse(request.params);
    const query = StreamQuery.parse(request.query);
    const actor = actorOf(request);
    const target = await serviceFor().targetFor(id);

    // Slots are only TAKEN for real upgrades; a plain GET to this route (a
    // scanner, a misconfigured client) is answered by the plugin and must not
    // consume a terminal slot it will never release.
    const isUpgrade = String(request.headers.upgrade ?? '').toLowerCase() === 'websocket';
    const capKey = `${actor.id}:${target.jobId}`;
    const perUser = openSockets.get(capKey) ?? 0;
    if (perUser >= MAX_SOCKETS_PER_USER_PER_JOB || processCount.value >= MAX_SOCKETS_PER_PROCESS) {
      throw HttpError.tooManyRequests(
        `At most ${MAX_SOCKETS_PER_USER_PER_JOB} scan terminal sockets per user and job`,
      );
    }
    if (isUpgrade) {
      openSockets.set(capKey, perUser + 1);
      processCount.value += 1;
    }

    handshakes.set(request, {
      target,
      actor,
      after: query.after ?? null,
      capKey: isUpgrade ? capKey : null,
    });
  }

  app.get(
    '/scans/:id/stream',
    {
      websocket: true,
      preHandler: [
        app.authenticate,
        app.requireStaff,
        app.requirePermission('scans:read'),
        async (request) => handshakeGate(request),
      ],
      schema: { params: JobIdParams, querystring: StreamQuery },
    },
    async (socket: WebSocket, request: FastifyRequest) => {
      const handshake = handshakes.get(request);
      if (handshake === undefined) {
        // Unreachable in practice: the ws handler only runs after preHandlers
        // succeeded. Closed rather than left hanging if it ever happens.
        socket.close(1_011, 'handshake lost');
        return;
      }
      const { target, actor, after, capKey } = handshake;
      const service = serviceFor();

      const session = new ScanStreamSession({
        socket: relaySocketOf(socket),
        target,
        after,
        replay: () => (options.replay ?? defaultReplay)(target.jobId),
        subscribe: (onMessage) => (options.subscribe ?? defaultSubscribe)(target.jobId, onMessage),
        sessionActive:
          options.sessionActive === undefined
            ? async () => {
                // Re-run the session half of the guard: a revoked session
                // stops watching the scan within one poll.
                try {
                  await app.authenticate(request, undefined as never, () => undefined);
                  return request.user !== undefined;
                } catch {
                  return false;
                }
              }
            : async () => options.sessionActive?.(request) ?? true,
        control: {
          canExecute: ScanStreamService.canExecute(actor),
          canKill: ScanStreamService.canKill(actor),
          send: (type) => service.sendControl({ actor, target, type, ip: clientIpOf(request) }),
        },
        log: app.log,
      });

      let released = false;
      const release = (): void => {
        session.onSocketClose();
        if (!released && capKey !== null) {
          released = true;
          releaseCap(capKey);
        }
      };
      socket.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
        session.onClientMessage(String(data));
      });
      socket.on('pong', () => session.onPong());
      socket.on('close', release);
      socket.on('error', release);

      await session.start();
    },
  );
};

export default fp(scanStreamRoutes, { name: 'scan-stream-routes' });

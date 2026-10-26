import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { NodeHeartbeatBody } from '@vunvault/contracts';
import { HttpError } from '../../../lib/http-error.js';
import {
  MemoryRateCounter,
  NodesService,
  SqlNodesRepo,
  type NodesRepo,
  type RateCounter,
} from './service.js';

/**
 * Sensor-node ingest (Task 37).
 *
 * No session, no CSRF token — a node in a client's network has neither. Identity is
 * the Ed25519 signature in the body, and the generic rate-limit policies do not
 * apply: the control that matters is six heartbeats a minute PER NODE, counted in
 * Redis, so one runaway agent cannot spend the budget of the whole fleet.
 */

export interface NodesRoutesOptions {
  /** Test seams. */
  repo?: NodesRepo;
  counter?: RateCounter;
  now?: () => Date;
}

/** Redis `INCR` + a window that starts on the first hit. */
interface RedisCounter {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
}

function redisCounter(redis: RedisCounter): RateCounter {
  return {
    async increment(key: string, windowSeconds: number) {
      const count = await redis.incr(key);
      // Set the expiry only on the first hit, so the window is fixed rather than
      // sliding: a node that keeps talking does not extend its own timeout.
      if (count === 1) await redis.expire(key, windowSeconds);
      return count;
    },
  };
}

const nodesRoutes: FastifyPluginAsync<NodesRoutesOptions> = async (fastify, options) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  function repoFor(): NodesRepo {
    if (options.repo !== undefined) return options.repo;
    if (!app.hasDecorator('db')) {
      throw new HttpError(503, 'service_unavailable', 'Node ingest is not available');
    }
    return new SqlNodesRepo(app.db);
  }

  function counterFor(): RateCounter {
    if (options.counter !== undefined) return options.counter;
    if (app.hasDecorator('redis')) return redisCounter(app.redis as unknown as RedisCounter);
    return new MemoryRateCounter();
  }

  let service: NodesService | undefined;
  function serviceFor(): NodesService {
    service ??= new NodesService({
      repo: repoFor(),
      counter: counterFor(),
      now: options.now,
      log: app.log,
    });
    return service;
  }

  app.post(
    '/nodes/heartbeat',
    {
      // Exempt from the shared rate-limit policies: the per-node counter below is
      // the control, and a fleet-wide limiter would punish healthy nodes for a
      // single broken one.
      config: { csrf: false, rateLimitPolicy: 'webhook' },
      schema: { body: NodeHeartbeatBody, response: { 204: z.null() } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = NodeHeartbeatBody.parse(request.body);
      await serviceFor().heartbeat(body);
      // The node needs no payload: 204 means "accepted, keep going".
      return reply.status(204).send(null);
    },
  );
};

export default fp(nodesRoutes, { name: 'nodes-routes' });

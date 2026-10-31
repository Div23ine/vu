import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

/** Per-check budget for `GET /readyz`. */
const CHECK_TIMEOUT_MS = 2000;

/**
 * `GET /health` — the Redis-mode report required by addendum A3.4.
 *
 * Deliberately a SEPARATE route from the catalog's `/healthz` and `/readyz`
 * (Task 21 defines exactly those two, and Task 40's conformance suite pins the
 * route table): an orchestrator's liveness/readiness contract must not change
 * shape because an operator wants to read the degraded-mode state. Both existing
 * routes stay byte-identical.
 *
 * The schema is declared locally rather than in `@vunvault/contracts` because
 * health is infrastructure, not an API contract consumers code against — the
 * same reason `/healthz` and `/readyz` carry no contract schema. It IS declared
 * (unlike its two siblings) because the conformance suite exempts those two by
 * name and requires a response schema everywhere else.
 */
export const HealthReportSchema = z.object({
  redis: z.enum(['up', 'down']),
  store: z.enum(['redis', 'memory']),
});

export type HealthReport = z.infer<typeof HealthReportSchema>;

type CheckState = 'ok' | 'fail';

async function withTimeout(check: () => Promise<void>, timeoutMs: number): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('readiness check timed out')), timeoutMs);
  });
  try {
    await Promise.race([check(), deadline]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Liveness and readiness.
 *
 * `/healthz` answers from the process alone — it must keep succeeding while a
 * dependency is down, or the orchestrator would restart a pod that cannot help.
 * `/readyz` runs every registered probe (`app.readiness`) and takes traffic away
 * when one fails. Both are hidden from OpenAPI and exempt from rate limits.
 */
const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/healthz',
    { schema: { hide: true }, config: { hidden: true, rateLimit: false } },
    async () => ({ status: 'ok' }),
  );

  // Addendum A3.4: the Redis-mode report. Answers from boot-resolved state, so it
  // is fast and has no failure mode of its own; `/readyz` remains the live probe
  // (it PINGs Redis on every call and 503s when a dependency is actually down).
  // A3.5: with Redis offline this reads `{ redis: "down", store: "memory" }`, and
  // with Redis reachable `{ redis: "up", store: "redis" }` — no code change between
  // the two, only `UPSTASH_REDIS_URL`.
  app.get(
    '/health',
    {
      schema: { hide: true, response: { 200: HealthReportSchema } },
      config: { hidden: true, rateLimit: false },
    },
    async (request): Promise<HealthReport> => {
      // `infra: false` harnesses register no Redis plugin at all: report the
      // honest state (nothing is backing the store) rather than throwing.
      const mode = request.server.redisMode ?? { status: 'down', store: 'memory', reason: null };
      if (mode.store === 'memory' && mode.reason !== null) {
        request.log.debug({ reason: mode.reason }, 'health: serving from the in-memory store');
      }
      return HealthReportSchema.parse({ redis: mode.status, store: mode.store });
    },
  );

  app.get(
    '/readyz',
    { schema: { hide: true }, config: { hidden: true, rateLimit: false } },
    async (request, reply) => {
      const checks: Record<string, CheckState> = {};
      let ready = true;

      for (const [name, check] of app.readiness) {
        try {
          await withTimeout(check, CHECK_TIMEOUT_MS);
          checks[name] = 'ok';
        } catch (error) {
          ready = false;
          checks[name] = 'fail';
          request.log.warn({ check: name, err: error }, 'readiness check failed');
        }
      }

      if (ready) return reply.send({ status: 'ready', checks });
      return reply.status(503).send({ status: 'not_ready', checks });
    },
  );
};

export default healthRoutes;

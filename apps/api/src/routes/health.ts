import type { FastifyPluginAsync } from 'fastify';

/** Per-check budget for `GET /readyz`. */
const CHECK_TIMEOUT_MS = 2000;

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

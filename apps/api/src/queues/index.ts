import fp from 'fastify-plugin';
import { Queue, type DefaultJobOptions } from 'bullmq';
import { QUEUE_NAMES, type QueueName } from '@vunvault/contracts';
import type { FastifyPluginAsync } from 'fastify';
import { redisOptionsFromUrl } from '../plugins/redis.js';

/** Three attempts with exponential backoff, then a week of failure history. */
export const DEFAULT_JOB_OPTIONS: DefaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { age: 86400, count: 1000 },
  removeOnFail: { age: 604800 },
};

/**
 * A scan is never auto-retried: re-running a scanner against a client target
 * without an operator deciding is exactly what the authorisation document does not
 * cover. A failed scan is re-queued deliberately, with a new `attempt`.
 */
export const QUEUE_JOB_OPTIONS: Record<QueueName, DefaultJobOptions> = {
  scan: { ...DEFAULT_JOB_OPTIONS, attempts: 1 },
  broadcast: DEFAULT_JOB_OPTIONS,
  maintenance: DEFAULT_JOB_OPTIONS,
  pdf: DEFAULT_JOB_OPTIONS,
  notify: DEFAULT_JOB_OPTIONS,
};

export type QueueRegistry = Record<QueueName, Queue>;

/**
 * Decorates `app.queues` with one BullMQ producer per queue name.
 *
 * Each queue gets its own connection: BullMQ producers issue blocking commands and
 * must not share the app's command connection. All of them are closed on shutdown.
 */
const queuesPlugin: FastifyPluginAsync = async (app) => {
  const connection = redisOptionsFromUrl(await app.secrets.get('UPSTASH_REDIS_URL'));
  const queues = {} as QueueRegistry;

  for (const name of Object.values(QUEUE_NAMES)) {
    queues[name] = new Queue(name, {
      connection,
      defaultJobOptions: QUEUE_JOB_OPTIONS[name],
    });
  }

  app.decorate('queues', queues);

  app.addHook('onClose', async () => {
    await Promise.all(Object.values(queues).map((queue) => queue.close()));
  });
};

export default fp(queuesPlugin, { name: 'queues', dependencies: ['secrets'] });

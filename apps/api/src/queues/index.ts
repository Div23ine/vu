import fp from 'fastify-plugin';
import { Queue, type DefaultJobOptions, type Job } from 'bullmq';
import { QUEUE_NAMES, type QueueName } from '@vunvault/contracts';
import type { FastifyBaseLogger, FastifyPluginAsync } from 'fastify';
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

// ---------------------------------------------------------------------------
// Revision 2 addendum, A3 — queue behaviour with Redis offline.
//
// BullMQ is Redis: there is no in-memory equivalent, and pretending otherwise
// would be the exact silent-success failure the addendum was written about (A2).
// So in offline mode `app.queues` is a registry that REFUSES jobs loudly:
//
//   · every `add()` logs a `warn` naming the queue and the job, and is counted;
//   · nothing is reported as enqueued, and no job id is invented;
//   · the counts are readable, so an operator can see exactly what was dropped.
//
// The auth email paths do NOT go through here — magic-link and signup-OTP mail is
// sent inline with `await app.email.send(...)`, so offline mode does not stop
// authentication mail. What degrades is the asynchronous fan-out (notification
// digests, PDF rendering, broadcasts, scans), which is recorded in Known Gaps.
// ---------------------------------------------------------------------------

/** How many jobs each disabled queue refused. Exported for `/health`-adjacent ops and tests. */
export type QueueDropCounts = Record<QueueName, number>;

/** The message every refused job logs. Greppable on purpose. */
export const QUEUE_DISABLED_MESSAGE =
  'job NOT enqueued: Redis is offline, so this queue has no backing store';

export class DisabledQueue {
  readonly name: QueueName;
  drops = 0;

  constructor(
    name: QueueName,
    private readonly log: FastifyBaseLogger,
  ) {
    this.name = name;
  }

  /**
   * Refuse the job, log it, count it. Never resolves to a job that exists.
   *
   * The payload is accepted (callers pass one) but deliberately NOT logged:
   * `notify` jobs carry a userId and an email address, and a warn-level line is
   * not the place for personal data. The queue name, job name and running tally
   * are enough for an operator to see what was dropped.
   */
  async add(jobName: string, _data?: unknown): Promise<Job | undefined> {
    this.drops += 1;
    this.log.warn(
      { queue: this.name, job: jobName, store: 'memory', drops: this.drops },
      QUEUE_DISABLED_MESSAGE,
    );
    return undefined;
  }

  async addBulk(jobs: { name: string }[]): Promise<Job[]> {
    for (const job of jobs) await this.add(job.name);
    return [];
  }

  /** There is no store to look a job up in. */
  async getJob(): Promise<undefined> {
    return undefined;
  }

  async getJobCounts(): Promise<Record<string, number>> {
    return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
  }

  async drain(): Promise<void> {
    // Nothing was ever accepted, so there is nothing to drain.
  }

  async close(): Promise<void> {
    // No connection was opened.
  }
}

/**
 * A registry of refusing queues, shaped exactly like the real one so no consumer
 * needs a branch. `dropCounts()` reads the refusal tally back out.
 */
export function disabledQueueRegistry(log: FastifyBaseLogger): QueueRegistry & {
  dropCounts: () => QueueDropCounts;
} {
  const queues = {} as Record<QueueName, DisabledQueue>;
  for (const name of Object.values(QUEUE_NAMES)) {
    queues[name] = new DisabledQueue(name, log);
  }
  return Object.assign(queues as unknown as QueueRegistry, {
    dropCounts: (): QueueDropCounts => {
      const counts = {} as QueueDropCounts;
      for (const name of Object.values(QUEUE_NAMES)) counts[name] = queues[name].drops;
      return counts;
    },
  });
}

/**
 * Decorates `app.queues` with one BullMQ producer per queue name.
 *
 * Each queue gets its own connection: BullMQ producers issue blocking commands and
 * must not share the app's command connection. All of them are closed on shutdown.
 *
 * With Redis offline (`app.redisMode.store === "memory"`) no producer is built —
 * the URL secret is absent by definition — and the disabled registry above takes
 * its place, so boot still succeeds.
 */
const queuesPlugin: FastifyPluginAsync = async (app) => {
  if (app.redisMode?.store === 'memory') {
    app.decorate('queues', disabledQueueRegistry(app.log));
    app.log.warn(
      { store: 'memory', queues: Object.values(QUEUE_NAMES) },
      'BullMQ queues are DISABLED: Redis is offline, so asynchronous jobs are refused and logged. ' +
        'Inline auth mail (magic link, signup OTP) is unaffected. Set UPSTASH_REDIS_URL and restart to enable.',
    );
    return;
  }

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

export default fp(queuesPlugin, { name: 'queues', dependencies: ['secrets', 'redis'] });

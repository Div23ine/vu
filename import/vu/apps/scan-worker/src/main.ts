import Redis from 'ioredis';
import pino from 'pino';
import { IoRedisBus } from './adapters/redis-bus';
import { SignedApiClient } from './adapters/signed-api-client';
import { loadEnv } from './config/env';
import { JobRunner } from './domain/job-runner';
import { LogArchive } from './domain/log-archive';
import { createOutputChannel, type OutputChannel, type OutputRedis } from './domain/output-channel';
import { FindingCollector } from './output/findings';
import { makeRunHooks } from './domain/run-hooks';
import { createSlotSemaphore, type SlotRedis } from './domain/slots';
import { K8sPodRunner } from './k8s/k8s-pod-runner';
import { createKubeClient } from './k8s/kube';
import { SCAN_NAMESPACE } from './k8s/pod-manifest';
import { startConsumer } from './queue/consumer';
import type { Clock, Logger, PodRunner, PodSpec, RunHooks, RunResult } from './ports';

/**
 * Scan-controller bootstrap (Task 84).
 *
 * Wires the real adapters to the domain and starts the BullMQ consumer. Nothing
 * here does work itself: `loadEnv()` validates configuration, the adapters are
 * constructed, and the runner is handed to the consumer.
 *
 * Two Redis connections are opened on purpose. A connection in subscriber mode
 * cannot issue ordinary commands, so the control-channel bus needs its own; the
 * semaphore and BullMQ use the other.
 *
 * Graceful shutdown matters because a pod may be mid-scan: SIGTERM stops the
 * worker accepting new jobs, `worker.close()` drains the in-flight one, and only
 * then are the connections closed.
 *
 * The `PodRunner` is a placeholder until Task 86 supplies the Kubernetes one. It
 * FAILS every job rather than pretending to scan, so a controller started early
 * reports honestly instead of marking targets as assessed.
 */

const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/** Task 86 replaces this with the Kubernetes pod runner. */
export const unimplementedPodRunner: PodRunner = {
  async run(spec: PodSpec, _hooks: RunHooks, _signal: AbortSignal): Promise<RunResult> {
    throw new Error(`pod runner not implemented (jobId=${spec.jobId})`);
  },
};

function createLogger(level: string): Logger {
  const log = pino({ level, base: { service: 'scan-worker' } });
  return {
    info: (message, fields) => log.info(fields ?? {}, message),
    warn: (message, fields) => log.warn(fields ?? {}, message),
    error: (message, fields) => log.error(fields ?? {}, message),
    debug: (message, fields) => log.debug(fields ?? {}, message),
  };
}

/** The four Redis commands the semaphore needs, over one connection. */
function slotRedisOf(connection: Redis): SlotRedis {
  return {
    incr: (key) => connection.incr(key),
    decr: (key) => connection.decr(key),
    expire: (key, seconds) => connection.expire(key, seconds),
  };
}

export interface BootstrapOptions {
  /** Test seam: replace the pod runner (Task 86 supplies the real one). */
  podRunner?: PodRunner;
  clock?: Clock;
}

export interface RunningController {
  stop(): Promise<void>;
}

export async function bootstrap(options: BootstrapOptions = {}): Promise<RunningController> {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL);
  const clock = options.clock ?? realClock;

  const commandConnection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

  // The output channel needs its own command connection (publish + the replay
  // list); the bus needs a subscriber-mode connection and makes its own.
  const outputRedis: OutputRedis = {
    publish: (channel, payload) => commandConnection.publish(channel, payload),
    rpush: (key, value) => commandConnection.rpush(key, value),
    ltrim: (key, start, stop) => commandConnection.ltrim(key, start, stop),
    expire: (key, seconds) => commandConnection.expire(key, seconds),
  };

  const api = new SignedApiClient({
    baseUrl: env.API_INTERNAL_URL,
    hmacKey: env.SCAN_CONTROLLER_HMAC_KEY,
    clock,
    logger,
    timeoutMs: env.API_TIMEOUT_MS,
  });

  // Task 86's Kubernetes runner is the real one; `options.podRunner` is the test
  // seam that replaces it.
  const kube = await createKubeClient({ namespace: SCAN_NAMESPACE, logger });
  const pods: PodRunner =
    options.podRunner ??
    new K8sPodRunner({
      kube,
      clock,
      logger,
      env: { runnerImage: process.env.RUNNER_IMAGE ?? '' },
    });

  const runner = new JobRunner({
    api,
    pods,
    bus: new IoRedisBus({ url: env.REDIS_URL, logger }),
    slots: createSlotSemaphore({
      redis: slotRedisOf(commandConnection),
      total: env.WORKER_SLOTS_TOTAL,
    }),
    clock,
    logger,
    // Per-job wiring: one output channel, one archive, one finding collector.
    // The channel is registered so the terminal `status` message can be sent on
    // the SAME channel the lines went out on.
    createHooks: (jobId) => {
      const channel = createOutputChannel({ redis: outputRedis, jobId }, (error) =>
        logger.warn('scan stream publish failed', {
          jobId,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      channels.set(jobId, channel);
      return makeRunHooks({
        jobId,
        api,
        channel,
        clock,
        logger,
        archive: new LogArchive(),
        collector: new FindingCollector(),
      });
    },
    // The status message goes out on the SAME channel the lines used, so the
    // viewer's terminal ends where it started. The entry is dropped afterwards:
    // a finished job must not keep a channel alive.
    publishStatus: async (jobId, status, reason) => {
      const channel = channels.get(jobId);
      if (channel === undefined) return;
      await channel.send({
        type: 'status',
        status,
        ...(reason === undefined ? {} : { reason }),
      });
      channels.delete(jobId);
    },
  });

  const worker = startConsumer({
    runner,
    redisUrl: env.REDIS_URL,
    concurrency: env.WORKER_SLOTS_TOTAL,
    logger,
  });

  // Per-job channels, so the terminal status message reaches the right stream.
  const channels = new Map<string, OutputChannel>();

  logger.info('scan controller started', {
    queue: 'scan',
    slots: env.WORKER_SLOTS_TOTAL,
    nodeEnv: env.NODE_ENV,
  });

  let stopping = false;
  return {
    async stop(): Promise<void> {
      if (stopping) return;
      stopping = true;
      logger.info('shutting down; draining in-flight scans');
      await worker.close();
      await commandConnection.quit().catch(() => undefined);
      logger.info('scan controller stopped');
    },
  };
}

async function main(): Promise<void> {
  const controller = await bootstrap();
  const onSignal = (signal: string): void => {
    console.warn(`received ${signal}, shutting down`);
    void controller.stop().then(() => process.exit(0));
  };
  process.on('SIGTERM', () => onSignal('SIGTERM'));
  process.on('SIGINT', () => onSignal('SIGINT'));
}

// Only run when executed directly, so tests can import `bootstrap` freely.
const entryName = process.argv[1]?.split('/').pop();
if (entryName !== undefined && import.meta.url.endsWith(`/${entryName}`)) {
  main().catch((error: unknown) => {
    console.error('scan controller failed to start', error);
    process.exit(1);
  });
}

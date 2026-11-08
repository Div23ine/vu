import { Queue, Worker, type Job } from 'bullmq';
import { QUEUE_NAMES, UampCheckJobPayload } from '@vunvault/contracts';
import type IORedis from 'ioredis';
import type { CheckHandler } from '../domain/check-handler.js';
import type { SqlUampWorkerRepo } from '../adapters/sql-repo.js';

export interface RunningConsumers {
  worker: Worker;
  schedulerTimer: ReturnType<typeof setInterval>;
  close: () => Promise<void>;
}

export function startConsumers(options: {
  connection: IORedis;
  handler: CheckHandler;
  repo: SqlUampWorkerRepo;
  concurrency: number;
  schedulerIntervalMs: number;
  log: { info: (m: string, f?: object) => void; warn: (m: string, f?: object) => void; error: (m: string, f?: object) => void };
}): RunningConsumers {
  const queue = new Queue(QUEUE_NAMES.uamp, { connection: options.connection });

  const worker = new Worker(
    QUEUE_NAMES.uamp,
    async (job: Job) => {
      const payload = UampCheckJobPayload.parse(job.data);
      await options.handler.handle(payload);
    },
    {
      connection: options.connection,
      concurrency: options.concurrency,
    },
  );

  worker.on('failed', (job, err) => {
    options.log.error('uamp check failed', {
      jobId: job?.id,
      err: err.message,
    });
  });

  const schedulerTimer = setInterval(() => {
    void (async () => {
      try {
        const due = await options.repo.findDueMonitors(50);
        for (const m of due) {
          await queue.add(
            'check',
            { monitorId: m.id, orgId: m.orgId },
            {
              jobId: `uamp-${m.id}-${Math.floor(Date.now() / (m.intervalSeconds * 1000))}`,
              removeOnComplete: 100,
              removeOnFail: 50,
            },
          );
        }
        if (due.length > 0) {
          options.log.info('uamp scheduler enqueued due monitors', { count: due.length });
        }
      } catch (err) {
        options.log.error('uamp scheduler tick failed', {
          err: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  }, options.schedulerIntervalMs);

  return {
    worker,
    schedulerTimer,
    close: async () => {
      clearInterval(schedulerTimer);
      await worker.close();
      await queue.close();
    },
  };
}

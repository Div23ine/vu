import { Worker, type Job } from 'bullmq';
import { QUEUE_NAMES, UampCheckJobPayload } from '@vunvault/contracts';
import type IORedis from 'ioredis';
import type { CheckHandler } from '../domain/check-handler.js';

export interface RunningConsumers {
  worker: Worker;
  close: () => Promise<void>;
}

/** The UAMP worker only consumes checks; maintenance-worker owns scheduling. */
export function startConsumers(options: {
  connection: IORedis;
  handler: CheckHandler;
  concurrency: number;
  prefix: string;
  log: {
    info: (m: string, f?: object) => void;
    warn: (m: string, f?: object) => void;
    error: (m: string, f?: object) => void;
  };
}): RunningConsumers {
  const worker = new Worker(
    QUEUE_NAMES.uamp,
    async (job: Job) => {
      const payload = UampCheckJobPayload.parse(job.data);
      await options.handler.handle({
        ...payload,
        checkKey: payload.checkKey ?? String(job.id ?? 'uamp-legacy-' + payload.monitorId),
      });
    },
    {
      connection: options.connection,
      concurrency: options.concurrency,
      prefix: options.prefix,
    },
  );

  worker.on('failed', (job, err) => {
    options.log.error('uamp check failed', {
      jobId: job?.id,
      err: err.message,
    });
  });

  return {
    worker,
    close: async () => {
      await worker.close();
    },
  };
}

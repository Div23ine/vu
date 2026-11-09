import type { Queue } from 'bullmq';
import { UampCheckJobPayload } from '@vunvault/contracts';
import type { UampCheckProducer, UampDueMonitor } from '../ports';

/** BullMQ producer with a deterministic id per monitor's current check generation. */
export class BullUampCheckProducer implements UampCheckProducer {
  constructor(private readonly queue: Queue) {}

  async enqueue(monitor: UampDueMonitor): Promise<void> {
    const payload = UampCheckJobPayload.parse({
      monitorId: monitor.id,
      orgId: monitor.orgId,
    });
    const generation = monitor.lastCheckedAt?.getTime().toString() ?? 'initial';
    await this.queue.add('check', payload, {
      jobId: 'uamp-' + monitor.id + '-' + generation,
      attempts: 3,
      backoff: { type: 'exponential', delay: 1_000 },
      removeOnComplete: 100,
      removeOnFail: true,
    });
  }
}

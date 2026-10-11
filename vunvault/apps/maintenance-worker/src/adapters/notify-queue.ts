import type { Queue } from 'bullmq';
import type { NotifyJobPayload } from '@vunvault/contracts';
import type { NotifyEnqueuer } from '../ports';

/**
 * E-mail enqueue onto the `notify` queue (consumed by Task 90's worker).
 *
 * The stable `jobId` makes re-registration harmless: BullMQ ignores an add
 * whose id already exists, so two replicas racing on the same scheduled
 * publish produce exactly one author e-mail.
 */
export class BullNotifyEnqueuer implements NotifyEnqueuer {
  constructor(private readonly queue: Queue) {}

  async enqueueEmail(
    payload: { to: string; template: string; vars: Record<string, string> },
    jobId: string,
  ): Promise<void> {
    const job: NotifyJobPayload = { channel: 'email', ...payload };
    await this.queue.add('email', job, { jobId });
  }
}

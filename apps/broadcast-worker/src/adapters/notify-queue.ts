import type { Queue } from 'bullmq';
import type { NotificationEvent, NotifyJobPayload } from '@vunvault/contracts';
import type { NotifyEnqueuer } from '../ports.js';

/**
 * In-app notifications are enqueued for the notify worker (Task 90), not
 * written to the inbox here: one writer per table, and the broadcast row's
 * `sent_dashboards` counts orgs whose enqueues all succeeded.
 *
 * The stable `jobId` is the dedupe guarantee — BullMQ ignores an add whose id
 * already exists, so a redelivered broadcast job cannot double-post to an
 * inbox. (Duplicates are still possible in principle if the first job was
 * completed AND removed before the retry; the notify worker's inbox insert is
 * append-only and a second tile is a cosmetic, not a correctness, problem.)
 */
export class BullNotifyEnqueuer implements NotifyEnqueuer {
  constructor(private readonly queue: Queue) {}

  async enqueueInApp(
    payload: { userId: string; event: NotificationEvent; title: string; body: string },
    jobId: string,
  ): Promise<void> {
    const job: NotifyJobPayload = { channel: 'in_app', ...payload };
    await this.queue.add('in_app', job, { jobId });
  }
}

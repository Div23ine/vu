import type { Queue } from 'bullmq';
import type { BroadcastJobPayload } from '@vunvault/contracts';
import type { BroadcastProducer, StuckBroadcastRow } from '../ports.js';

/**
 * Re-enqueue stuck broadcasts onto the `broadcast` queue (Task 92).
 *
 * The jobId `broadcast:<id>` is the SAME stable id the API used when it first
 * enqueued (and the same one this sweep may have used two minutes ago): BullMQ
 * ignores an add whose id already exists, which is exactly the dedupe the
 * every-two-minutes sweep needs — including the case where the original job is
 * still sitting in the failed history (removeOnFail keeps it for a week).
 */
export class BullBroadcastProducer implements BroadcastProducer {
  constructor(private readonly queue: Queue) {}

  async requeue(job: StuckBroadcastRow): Promise<void> {
    const payload: BroadcastJobPayload = {
      broadcastId: job.broadcastId,
      advisoryId: job.advisoryId,
      kind: job.kind,
    };
    await this.queue.add(job.kind, payload, { jobId: `broadcast:${job.broadcastId}` });
  }
}

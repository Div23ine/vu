import type { BroadcastProducer, Logger, MaintenanceRepo, Summary } from '../ports.js';

/**
 * `outbox_reenqueue` (Task 92) — every 2 minutes.
 *
 * The advisory service writes the broadcast row as `queued` and THEN enqueues
 * (Task 82); if the enqueue fails — Redis down, deploy mid-request — the row
 * is the outbox record: "delivery was decided but never handed to a worker".
 * This sweep closes that gap: any row still `queued` older than
 * `OUTBOX_STUCK_MINUTES` is re-added to the `broadcast` queue with the stable
 * jobId `broadcast:<id>`, which BullMQ dedupes, so the sweep is safe to run
 * every two minutes from every replica.
 *
 * Scope note: the `broadcast_jobs` table (content bulletins) has NO producer
 * in the current tree, so there is nothing of its kind to re-enqueue; when a
 * producer appears, its outbox sweep belongs here too.
 *
 * Rows the delivery worker already moved to `sending` are NOT touched: that is
 * an in-flight delivery under Task 89's own at-least-once guard, and poking it
 * would race a live run.
 */

export interface OutboxReenqueueDeps {
  repo: Pick<MaintenanceRepo, 'listStuckBroadcasts'>;
  broadcast: BroadcastProducer;
  clock: { now(): Date };
  stuckMinutes: number;
  logger: Logger;
}

export async function runOutboxReenqueue(deps: OutboxReenqueueDeps): Promise<Summary> {
  const cutoff = new Date(deps.clock.now().getTime() - deps.stuckMinutes * 60 * 1000);
  const stuck = await deps.repo.listStuckBroadcasts(cutoff);

  let requeued = 0;
  let skipped = 0;
  for (const row of stuck) {
    try {
      await deps.broadcast.requeue({
        broadcastId: row.broadcastId,
        advisoryId: row.advisoryId,
        kind: row.kind,
      });
      requeued += 1;
    } catch (error) {
      // Redis still down: leave the row `queued`; the next sweep retries.
      skipped += 1;
      deps.logger.warn('outbox re-enqueue failed; will retry next sweep', {
        broadcastId: row.broadcastId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (requeued > 0) {
    deps.logger.info('stuck broadcasts re-enqueued', { requeued, skipped });
  }
  return { task: 'outbox_reenqueue', affected: requeued, detail: { requeued, skipped } };
}

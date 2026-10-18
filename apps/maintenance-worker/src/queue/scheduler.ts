import type { MaintenanceTask } from '@vunvault/contracts';
import type { Logger } from '../ports.js';

/**
 * The repeatable-job scheduler (Tasks 91–92).
 *
 * The worker registers its own cron — no external scheduler infrastructure,
 * no crontab on a host, nothing to forget when the cluster is rebuilt. BullMQ
 * job schedulers are keyed by a stable id, so registration is idempotent:
 * every replica may call it at boot and the schedule stays singular.
 *
 * Patterns are UTC (the BullMQ/Redis convention) and deliberately offset from
 * each other: five workers all waking at :00 is a self-inflicted latency
 * spike on the database.
 */

export interface ScheduleEntry {
  task: MaintenanceTask;
  /** Cron pattern, UTC. */
  pattern: string;
}

/** Stable BullMQ job-scheduler id — changing one orphans the old schedule. */
export function schedulerId(task: MaintenanceTask): string {
  return `maintenance:${task}`;
}

/** The full twelve-schedule catalogue (Task 91's four + Task 92's eight). */
export const SCHEDULES: readonly ScheduleEntry[] = [
  // ---- Task 91 ----
  { task: 'metrics_rollup', pattern: '5 * * * *' },
  { task: 'node_health', pattern: '*/5 * * * *' },
  { task: 'threat_level', pattern: '*/15 * * * *' },
  { task: 'scheduled_publish', pattern: '*/5 * * * *' },
  // ---- Task 92 ----
  // The outbox sweep is the tightest loop: a decided-but-undelivered SEV-1
  // broadcast is the one stuck row an operator measures in minutes.
  { task: 'outbox_reenqueue', pattern: '*/2 * * * *' },
  { task: 'verify_chain', pattern: '0 */6 * * *' },
  { task: 'expire_invitations', pattern: '17 * * * *' },
  { task: 'media_scan', pattern: '23 * * * *' },
  { task: 'audit_snapshot', pattern: '0 2 * * *' },
  { task: 'purge_login_attempts', pattern: '0 3 * * *' },
  { task: 'flag_dormant_accounts', pattern: '30 3 * * *' },
  { task: 'stale_signups', pattern: '0 4 * * *' },
] as const;

/** The slice of a BullMQ `Queue` the scheduler needs (test seam). */
export interface SchedulerQueue {
  upsertJobScheduler(
    id: string,
    repeat: { pattern: string },
    template: { name: string; data: { task: MaintenanceTask } },
  ): Promise<unknown>;
}

/** Register (idempotently) every schedule. Returns how many were upserted. */
export async function registerSchedulers(
  queue: SchedulerQueue,
  logger: Logger,
  schedules: readonly ScheduleEntry[] = SCHEDULES,
): Promise<number> {
  let registered = 0;
  for (const entry of schedules) {
    await queue.upsertJobScheduler(
      schedulerId(entry.task),
      { pattern: entry.pattern },
      { name: entry.task, data: { task: entry.task } },
    );
    registered += 1;
  }
  logger.info('maintenance schedules registered', { registered });
  return registered;
}

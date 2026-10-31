import { Worker, type Job } from 'bullmq';
import { MaintenanceJobPayload, QUEUE_NAMES, type MaintenanceTask } from '@vunvault/contracts';
import { runAuditSnapshot } from '../domain/audit-snapshot';
import { runExpireInvitations } from '../domain/expire-invitations';
import { runFlagDormantAccounts } from '../domain/flag-dormant';
import { runMediaScan } from '../domain/media-scan';
import { runMetricsRollup } from '../domain/metrics-rollup';
import { runNodeHealth } from '../domain/node-health';
import { runOutboxReenqueue } from '../domain/outbox-reenqueue';
import { runPurgeLoginAttempts } from '../domain/purge-login-attempts';
import { runScheduledPublish } from '../domain/scheduled-publish';
import { runStaleSignups } from '../domain/stale-signups';
import { runThreatLevel } from '../domain/threat-level';
import { runVerifyChain } from '../domain/verify-chain';
import type {
  BroadcastProducer,
  Clock,
  Logger,
  MaintenanceRepo,
  NotifyEnqueuer,
  ObjectWriter,
  Summary,
} from '../ports';

/**
 * BullMQ consumer (Task 91) — the `maintenance` queue.
 *
 * A dispatch table, not a switch: one registry entry per `MAINTENANCE_TASKS`
 * name, each a small handler over the ports. The registry is total over the
 * contract enum — adding a task to the enum without a handler here is a
 * COMPILE error, which is exactly when you want to find out.
 *
 * A handler throw propagates to BullMQ (three attempts, exponential backoff):
 * maintenance tasks are idempotent by construction (upserts, conditional
 * updates, deletes-by-cutoff), so a retry is safe by design, not by luck.
 */

export const MAINTENANCE_QUEUE_NAME = QUEUE_NAMES.maintenance;

/** BullMQ lock renewal window. */
export const LOCK_DURATION_MS = 30_000;

export interface HandlerDeps {
  repo: MaintenanceRepo;
  notify: NotifyEnqueuer;
  broadcast: BroadcastProducer;
  storage: ObjectWriter;
  /** Audit chain VERIFICATION key lookup (the worker never appends). */
  hmacKeyFor: (keyId: string) => Buffer | undefined;
  clock: Clock;
  logger: Logger;
  tunables: {
    heartbeatStaleMs: number;
    heartbeatMissLimit: number;
    loginAttemptRetentionDays: number;
    invitationGraceHours: number;
    dormantAfterDays: number;
    signupStaleDays: number;
    outboxStuckMinutes: number;
    r2PublicBaseUrl: string;
    auditAlertEmail: string | null;
  };
}

export type MaintenanceHandler = (deps: HandlerDeps) => Promise<Summary>;

/** The full twelve-task catalogue (Tasks 91 + 92). Total over the enum. */
export const HANDLERS: Record<MaintenanceTask, MaintenanceHandler> = {
  // ---- Task 91 ----
  metrics_rollup: (deps) => runMetricsRollup(deps),
  node_health: (deps) =>
    runNodeHealth({
      repo: deps.repo,
      clock: deps.clock,
      staleMs: deps.tunables.heartbeatStaleMs,
      missLimit: deps.tunables.heartbeatMissLimit,
      logger: deps.logger,
    }),
  threat_level: (deps) => runThreatLevel(deps),
  scheduled_publish: (deps) => runScheduledPublish(deps),

  // ---- Task 92 ----
  purge_login_attempts: (deps) =>
    runPurgeLoginAttempts({
      repo: deps.repo,
      clock: deps.clock,
      retentionDays: deps.tunables.loginAttemptRetentionDays,
      logger: deps.logger,
    }),
  expire_invitations: (deps) =>
    runExpireInvitations({
      repo: deps.repo,
      clock: deps.clock,
      graceHours: deps.tunables.invitationGraceHours,
      logger: deps.logger,
    }),
  flag_dormant_accounts: (deps) =>
    runFlagDormantAccounts({
      repo: deps.repo,
      clock: deps.clock,
      dormantAfterDays: deps.tunables.dormantAfterDays,
      logger: deps.logger,
    }),
  stale_signups: (deps) =>
    runStaleSignups({
      repo: deps.repo,
      clock: deps.clock,
      staleDays: deps.tunables.signupStaleDays,
      logger: deps.logger,
    }),
  verify_chain: (deps) =>
    runVerifyChain({
      repo: deps.repo,
      notify: deps.notify,
      hmacKeyFor: deps.hmacKeyFor,
      alertEmail: deps.tunables.auditAlertEmail,
      clock: deps.clock,
      logger: deps.logger,
    }),
  outbox_reenqueue: (deps) =>
    runOutboxReenqueue({
      repo: deps.repo,
      broadcast: deps.broadcast,
      clock: deps.clock,
      stuckMinutes: deps.tunables.outboxStuckMinutes,
      logger: deps.logger,
    }),
  media_scan: (deps) =>
    runMediaScan({
      repo: deps.repo,
      r2PublicBaseUrl: deps.tunables.r2PublicBaseUrl,
      logger: deps.logger,
    }),
  audit_snapshot: (deps) =>
    runAuditSnapshot({
      repo: deps.repo,
      storage: deps.storage,
      clock: deps.clock,
      logger: deps.logger,
    }),
};

export interface ConsumerDeps {
  handlers: HandlerDeps;
  redisUrl: string;
  concurrency: number;
  logger: Logger;
  /** Test seam: inject a Worker stand-in. */
  createWorker?: (options: CreateWorkerOptions) => WorkerLike;
}

export interface CreateWorkerOptions {
  name: string;
  concurrency: number;
  lockDuration: number;
  connection: { url: string };
}

export interface WorkerLike {
  close(): Promise<void>;
}

/** The queue processor, exported for tests. */
export function makeProcessor(deps: Pick<ConsumerDeps, 'handlers' | 'logger'>) {
  const { handlers, logger } = deps;
  return async (job: Job<unknown>): Promise<Summary | undefined> => {
    const parsed = MaintenanceJobPayload.safeParse(job.data);
    if (!parsed.success) {
      logger.error('discarding a malformed maintenance job payload', {
        queueJobId: job.id,
        issues: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      });
      await job.moveToFailed(
        { message: 'invalid_maintenance_payload', name: 'InvalidPayload' },
        'malformed-payload',
      );
      return undefined;
    }

    const summary = await HANDLERS[parsed.data.task](handlers);
    logger.info('maintenance task finished', {
      queueJobId: job.id,
      task: summary.task,
      affected: summary.affected,
      ...(summary.detail ?? {}),
    });
    return summary;
  };
}

export function startConsumer(deps: ConsumerDeps): WorkerLike {
  const { logger } = deps;
  const processor = makeProcessor(deps);

  if (deps.createWorker !== undefined) {
    return deps.createWorker({
      name: MAINTENANCE_QUEUE_NAME,
      concurrency: deps.concurrency,
      lockDuration: LOCK_DURATION_MS,
      connection: { url: deps.redisUrl },
    });
  }

  const worker = new Worker(MAINTENANCE_QUEUE_NAME, processor, {
    connection: { url: deps.redisUrl },
    concurrency: deps.concurrency,
    lockDuration: LOCK_DURATION_MS,
  });

  worker.on('failed', (job, error) => {
    logger.warn('maintenance job failed in the queue', {
      queueJobId: job?.id,
      message: error.message,
    });
  });
  worker.on('error', (error) => {
    logger.error('maintenance worker error', { message: error.message });
  });

  return worker;
}

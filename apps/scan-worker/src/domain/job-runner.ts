import type { ScanType } from '@vunvault/contracts';
import { uploadLog } from './log-archive.js';
import type { RunHooksHandle } from './run-hooks.js';
import type {
  ApiClient,
  Clock,
  Logger,
  PodRunner,
  PodSpec,
  RedisBus,
  RunHooks,
  RunResult,
  SlotSemaphore,
} from '../ports.js';
import { NOOP_HOOKS } from '../ports.js';
import { resolveTarget, validateTarget, type Resolver } from './target-guard.js';

/**
 * Job runner (Task 84) — the orchestration around one scan.
 *
 * Pure sequencing over injected ports: no Redis, HTTP or Kubernetes client is
 * constructed here, which is why the whole flow (including its failure paths)
 * is testable with fakes.
 *
 * The invariants that matter:
 *  - **The slot is always released.** Every exit path runs through `finally`,
 *    including a thrown `podRunner.run` and an abort. A leaked slot permanently
 *    reduces cluster capacity.
 *  - **The control subscription is always torn down**, for the same reason.
 *  - **A claim conflict is a success.** The job was already taken; the BullMQ
 *    job finishes without running a pod, and nothing is reported to the API
 *    (the API already holds the job in the right state).
 *  - **Only the four control types are honoured.** Anything else on the channel
 *    is dropped and logged — an unvalidated message from Redis must not be able
 *    to drive the runner.
 *  - **A controller bug never looks like a scan failure.** An unexpected
 *    exception is reported as `controller_error` with the message truncated to
 *    300 characters and no stack, so a target's output can never be blamed for
 *    our own crash — and our internals never reach the client-facing record.
 */

/** The API's own ceiling for `InternalFailBody.reason`. */
export const FAIL_REASON_MAX = 300;

export interface JobRunnerDeps {
  api: ApiClient;
  pods: PodRunner;
  bus: RedisBus;
  slots: SlotSemaphore;
  clock: Clock;
  logger: Logger;
  /** Hooks are Task 88's; the foundation runs with no-ops. */
  hooks?: RunHooks;
  /**
   * Builds the per-job run hooks (Task 88) — the stream, the archive and the
   * finding collector. Absent means no-op hooks, which is how Tasks 84–87 were
   * testable before this wiring existed.
   */
  createHooks?(jobId: string): RunHooksHandle;
  /**
   * DNS seam. Production resolves with `node:dns/promises`; tests inject a fake,
   * because the guard's whole job is deciding what a name resolves to.
   */
  resolver?: Resolver;
  /** Publishes the terminal `status` message when the run ends (Task 88). */
  publishStatus?(
    jobId: string,
    status: 'completed' | 'failed' | 'cancelled',
    reason?: string,
  ): Promise<void>;
}

/** What the consumer hands over from the queue payload. */
export interface QueuedJob {
  /** BullMQ's own job id — the claim correlates the queue job with the scan. */
  queueJobId: string;
  jobId: string;
  attempt: number;
  targetHost: string;
  scanType: ScanType;
  podName?: string;
}

export type HandleOutcome =
  | { kind: 'completed' }
  | { kind: 'failed'; reason: string; abortReason: 'abort' | 'kill' | 'deadline' | 'error' }
  | { kind: 'skipped'; why: 'conflict' | 'authorisation_invalid' | 'no_slot' };

export class JobRunner {
  private readonly deps: JobRunnerDeps;

  constructor(deps: JobRunnerDeps) {
    this.deps = deps;
  }

  async handle(job: QueuedJob): Promise<HandleOutcome> {
    const { api, pods, bus, slots, logger } = this.deps;
    const fallbackHooks = this.deps.hooks ?? NOOP_HOOKS;

    // 1. Reserve capacity first — a job we cannot run must go back to the queue
    //    rather than be claimed and then dropped.
    const acquired = await slots.acquire();
    if (!acquired) {
      logger.info('no worker slot available; requeueing', { queueJobId: job.queueJobId });
      return { kind: 'skipped', why: 'no_slot' };
    }

    let unsubscribe: (() => Promise<void>) | null = null;
    try {
      // 2. Claim. A conflict or an invalid authorisation ends the job here.
      const claim = await api.claim(job.queueJobId, job.podName);
      if (claim.kind === 'conflict') {
        logger.info('job already claimed elsewhere', { queueJobId: job.queueJobId });
        return { kind: 'skipped', why: 'conflict' };
      }
      if (claim.kind === 'authorisation_invalid') {
        logger.info('authorisation invalid; the API held the job', {
          queueJobId: job.queueJobId,
        });
        return { kind: 'skipped', why: 'authorisation_invalid' };
      }
      const claimed = claim.data;

      // 3. Re-validate the target. The API authorised the request, but the
      //    controller is the last thing between a pod and a forbidden address.
      const validated = validateTarget(claimed.targetHost, claimed.scanType);
      if (!validated.ok) {
        return await this.reportFailure(claimed.jobId, validated.reason, 'error');
      }
      const resolved = await resolveTarget(
        validated,
        this.deps.resolver === undefined ? {} : { resolver: this.deps.resolver },
      );
      if (!resolved.ok) {
        return await this.reportFailure(claimed.jobId, resolved.reason, 'error');
      }

      // 4. Control channel. Only the four known types survive validation.
      const abort = new AbortController();
      let paused = false;
      unsubscribe = await bus.subscribe(`scan:ctl:${claimed.jobId}`, (message) => {
        switch (message.type) {
          case 'abort':
            logger.info('abort requested', { jobId: claimed.jobId });
            abort.abort();
            return;
          case 'kill':
            logger.warn('kill requested', { jobId: claimed.jobId });
            abort.abort();
            return;
          case 'pause':
            // DECISION(v1): pausing needs pods/exec, which the controller's RBAC
            // deliberately lacks (Task 86), so pause/resume are accepted and
            // recorded but are no-ops.
            paused = true;
            logger.info('pause requested (no-op in v1)', { jobId: claimed.jobId });
            return;
          case 'resume':
            paused = false;
            logger.info('resume requested (no-op in v1)', { jobId: claimed.jobId });
            return;
        }
      });

      // 4b. Build this job's hooks now that the claim gave us the real job id.
      const hooks: RunHooks =
        this.deps.createHooks === undefined ? fallbackHooks : this.deps.createHooks(claimed.jobId);
      const handle = 'finish' in hooks ? (hooks as RunHooksHandle) : null;

      // 5. Run the pod.
      const spec: PodSpec = {
        jobId: claimed.jobId,
        jobCode: claimed.jobCode,
        attempt: claimed.attempt,
        scanType: claimed.scanType,
        host: resolved.host,
        ips: resolved.ips,
        ...(resolved.cidr === undefined ? {} : { cidr: resolved.cidr }),
        deadlineSeconds: claimed.deadlineSeconds,
      };
      let result: RunResult;
      try {
        result = await pods.run(spec, hooks, abort.signal);
      } catch (error) {
        return await this.reportFailure(
          claimed.jobId,
          `controller_error: ${truncate(messageOf(error), FAIL_REASON_MAX - 18)}`,
          'error',
        );
      }
      void paused;

      // 6. Map the outcome.
      const lineCount = handle === null ? result.lineCount : handle.lineCount();
      const bytesStreamed = handle === null ? result.bytesStreamed : handle.archive.bytes;

      if (result.reason === 'completed') {
        // Findings first: a job must never complete with findings still buffered.
        if (handle !== null) {
          const flushed = await handle.finish();
          if (!flushed) {
            return await this.reportFailure(
              claimed.jobId,
              'findings could not be recorded',
              'error',
            );
          }
        }
        const redactedLogKey =
          handle === null ? undefined : await this.archiveLog(claimed.jobId, handle);
        await api.complete(claimed.jobId, {
          exitCode: result.exitCode,
          lineCount,
          bytesStreamed,
          ...(redactedLogKey === undefined ? {} : { redactedLogKey }),
        });
        await this.publishStatus(handle, claimed.jobId, 'completed');
        return { kind: 'completed' };
      }

      // A deadline keeps its partial findings; so does every other abort path.
      if (handle !== null) await handle.finish();
      const outcome = await this.reportFailure(
        claimed.jobId,
        `run ended: ${result.reason} (exit ${result.exitCode})`,
        result.reason === 'abort' || result.reason === 'kill' || result.reason === 'deadline'
          ? result.reason
          : 'error',
      );
      await this.publishStatus(
        handle,
        claimed.jobId,
        result.reason === 'abort' || result.reason === 'kill' ? 'cancelled' : 'failed',
        result.reason,
      );
      return outcome;
    } catch (error) {
      // 6b. Anything unexpected is OUR failure, not the target's.
      logger.error('controller error', {
        queueJobId: job.queueJobId,
        message: truncate(messageOf(error), FAIL_REASON_MAX),
      });
      return { kind: 'failed', reason: 'controller_error', abortReason: 'error' };
    } finally {
      // 7. Always unsubscribe and always release the slot.
      if (unsubscribe !== null) {
        try {
          await unsubscribe();
        } catch (error) {
          logger.warn('failed to unsubscribe from the control channel', {
            message: messageOf(error),
          });
        }
      }
      await slots.release();
    }
  }

  /**
   * Upload the sanitised archive.
   *
   * Failure is NOT fatal: the findings are already recorded, and losing the
   * transcript must not lose the scan. The key is simply omitted, and the report
   * shows no log download.
   */
  private async archiveLog(jobId: string, handle: RunHooksHandle): Promise<string | undefined> {
    const text = handle.archive.render();
    if (text === '') return undefined;
    try {
      const { uploadUrl, objectKey } = await this.deps.api.logUrl(
        jobId,
        Buffer.byteLength(text, 'utf8'),
      );
      const uploaded = await uploadLog(uploadUrl, text);
      return uploaded ? objectKey : undefined;
    } catch (error) {
      this.deps.logger.warn('could not archive the scan log', {
        jobId,
        message: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  /**
   * Tell the stream the run is over, so a watching terminal can stop spinning.
   *
   * Only published when the hooks exist: without them there is no channel bound
   * to this job, and the API's own status transition is already authoritative.
   */
  private async publishStatus(
    handle: RunHooksHandle | null,
    jobId: string,
    status: 'completed' | 'failed' | 'cancelled',
    reason?: string,
  ): Promise<void> {
    if (handle === null || this.deps.publishStatus === undefined) return;
    await this.deps.publishStatus(jobId, status, reason);
  }

  private async reportFailure(
    jobId: string,
    reason: string,
    abortReason: 'abort' | 'kill' | 'deadline' | 'error',
  ): Promise<HandleOutcome> {
    const truncated = truncate(reason, FAIL_REASON_MAX);
    try {
      await this.deps.api.fail(jobId, { reason: truncated, abortReason });
    } catch (error) {
      this.deps.logger.error('could not report the failure to the API', {
        jobId,
        message: messageOf(error),
      });
    }
    return { kind: 'failed', reason: truncated, abortReason };
  }
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Hard truncation — the API caps `reason` at 300 characters. */
export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1))}…`;
}

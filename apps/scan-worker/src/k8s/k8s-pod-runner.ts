import type { Clock, Logger, PodRunner, PodSpec, RunHooks, RunResult } from '../ports.js';
import { consumeLogStream, type TerminalLine } from './log-stream.js';
import { buildJobManifest, jobResourceName, type ManifestEnv } from './pod-manifest.js';
import { buildNetworkPolicy, networkPolicyName } from './network-policy.js';
import { RUNNER_CONTAINER, isNotFound, type KubeClient, type PodPhase } from './kube.js';

/**
 * Kubernetes pod runner (Task 86) — one locked-down Job per scan.
 *
 * The ordering of operations is the safety property, so it is worth stating
 * plainly:
 *
 *  1. **NetworkPolicy first, then Job.** A pod that exists before its egress
 *     policy does has a window in which it can reach anything. Creating the
 *     policy first means there is no such window — and if the policy cannot be
 *     created, the Job is never created at all and the scan fails closed.
 *  2. **Both are deleted in `finally`.** Every exit path — success, deadline,
 *     abort, kill, exception — tears down both objects. A leaked Job is a pod
 *     pointed at a customer's host with no controller watching it; a leaked
 *     policy is clutter that eventually collides on name. 404s on delete are
 *     swallowed, because "already gone" is the desired end state.
 *
 * Pause and resume are NO-OPS that publish an explanatory line. Suspending a
 * container needs `pods/exec`, which the controller's Role deliberately does not
 * grant: a controller that can exec into a scan pod can also be used to pivot
 * into it, which is exactly the capability the isolation model removes. The UI
 * says so rather than pretending.
 */

/** Published when a pause or resume is requested. */
export const PAUSE_UNSUPPORTED_LINE = '[~] Pause is not supported in this environment.';

/** How long a pod may take to reach Running before the scan is abandoned. */
export const POD_READY_TIMEOUT_MS = 120_000;

/** Poll interval while waiting for the pod. */
export const POD_POLL_INTERVAL_MS = 1_000;

/** A waiting reason that means the image will never start. */
const FATAL_WAITING_REASONS = new Set(['ImagePullBackOff', 'ErrImagePull', 'InvalidImageName']);

export interface K8sPodRunnerOptions {
  kube: KubeClient;
  clock: Clock;
  logger: Logger;
  env: ManifestEnv;
  /** Terminal lines are handed here; the caller publishes them to Redis. */
  onTerminalLine?(line: TerminalLine): void;
  maxOutputBytes?: number;
}

export class K8sPodRunner implements PodRunner {
  private readonly options: K8sPodRunnerOptions;
  private readonly deletedJobs = new Set<string>();

  constructor(options: K8sPodRunnerOptions) {
    this.options = options;
  }

  async run(spec: PodSpec, hooks: RunHooks, signal: AbortSignal): Promise<RunResult> {
    const { kube, clock, logger } = this.options;
    const jobName = jobResourceName(spec.jobCode, spec.attempt);
    const policyName = networkPolicyName(spec.jobCode, spec.attempt);

    let jobCreated = false;
    let jobDeleted = false;
    let policyCreated = false;
    let abortedBy: 'abort' | 'kill' | null = null;
    let deadlineHit = false;

    // The runner cannot tell abort from kill from the signal alone, so the
    // controller records which control arrived. Task 88 wires the bus to it.
    const onAbort = (): void => {
      abortedBy = abortedBy ?? 'abort';
    };
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });

    // The controller-side deadline. Kubernetes also enforces
    // `activeDeadlineSeconds` on the Job, so this is the backstop for a pod that
    // hangs in a way the kubelet does not notice (a wedged log stream, say).
    const deadlineTimer = clock
      .sleep(spec.deadlineSeconds * 1_000)
      .then(() => {
        deadlineHit = true;
      })
      .catch(() => undefined);

    try {
      // 1. Policy first — a pod must never exist without its egress rules.
      try {
        await kube.createNetworkPolicy(buildNetworkPolicy(spec));
        policyCreated = true;
      } catch (error) {
        // Fail closed: no policy, no scan.
        logger.error('could not create the egress policy; refusing to start the scan', {
          jobName,
          message: messageOf(error),
        });
        return { exitCode: -1, reason: 'error', lineCount: 0, bytesStreamed: 0 };
      }

      // 2. Then the Job.
      await kube.createJob(buildJobManifest(spec, this.options.env));
      jobCreated = true;

      // 3. Wait for the pod to exist and start running.
      const pod = await this.waitForPod(spec.jobId, signal);
      if (pod === null) {
        // Same exit-code convention as the post-stream path: 130 for an abort,
        // 137 for a kill, 124 for the deadline.
        if (abortedBy !== null) {
          return {
            exitCode: abortedBy === 'kill' ? 137 : 130,
            reason: abortedBy,
            lineCount: 0,
            bytesStreamed: 0,
          };
        }
        return {
          exitCode: deadlineHit ? 124 : -1,
          reason: deadlineHit ? 'deadline' : 'error',
          lineCount: 0,
          bytesStreamed: 0,
        };
      }

      // 4. Stream and sanitise its output, bounded by the deadline.
      let lineCount = 0;
      let bytesStreamed = 0;
      try {
        const stream = await kube.followLogs(pod.name, {
          follow: true,
          timestamps: false,
          container: RUNNER_CONTAINER,
        });
        const streaming = consumeLogStream(stream, {
          logger,
          hooks,
          onTerminalLine: this.options.onTerminalLine ?? (() => undefined),
          ...(this.options.maxOutputBytes === undefined
            ? {}
            : { maxOutputBytes: this.options.maxOutputBytes }),
        });
        // Whichever finishes first wins; if the deadline wins, `deadlineHit` is
        // already set and the Job is deleted below, which ends the stream too.
        const result = await Promise.race([streaming, deadlineTimer.then(() => null)]);
        if (result !== null) {
          lineCount = result.lineCount;
          bytesStreamed = result.bytesStreamed;
        }
      } catch (error) {
        // A broken log stream is not necessarily a failed scan; the pod's own
        // terminated state decides that below.
        logger.warn('log stream ended early', { jobName, message: messageOf(error) });
      }

      if (deadlineHit) {
        await this.deleteJobNow(jobName);
        return { exitCode: 124, reason: 'deadline', lineCount, bytesStreamed };
      }
      if (abortedBy !== null) {
        await this.deleteJobNow(jobName);
        return {
          exitCode: abortedBy === 'kill' ? 137 : 130,
          reason: abortedBy,
          lineCount,
          bytesStreamed,
        };
      }

      // 5. The exit code comes from the pod's terminated state, never from
      //    stdout — a target that prints `@@VV@@ {"t":"done","exit":0}` must not
      //    be able to declare itself successful.
      const final = await this.readFinalState(spec.jobId);
      if (final === null || final.exitCode === null) {
        return { exitCode: -1, reason: 'error', lineCount, bytesStreamed };
      }
      return {
        exitCode: final.exitCode,
        reason: final.exitCode === 0 ? 'completed' : 'error',
        lineCount,
        bytesStreamed,
      };
    } catch (error) {
      logger.error('pod run failed', { jobName, message: messageOf(error) });
      return { exitCode: -1, reason: 'error', lineCount: 0, bytesStreamed: 0 };
    } finally {
      signal.removeEventListener('abort', onAbort);
      // 6. Always tear down, in reverse order of creation, swallowing 404s.
      if (jobCreated && !jobDeleted) {
        jobDeleted = true;
        await this.deleteJobNow(jobName);
      }
      if (policyCreated) {
        try {
          await kube.deleteNetworkPolicy(policyName);
        } catch (error) {
          if (!isNotFound(error)) {
            logger.warn('could not delete the egress policy', {
              policyName,
              message: messageOf(error),
            });
          }
        }
      }
    }
  }

  /**
   * Publish the pause/resume explanation.
   *
   * DECISION(v1): pause needs `pods/exec`, which the controller's Role does not
   * grant, so pause and resume cannot be honoured. Rather than silently ignoring
   * the operator, the controller publishes this line to the terminal.
   */
  publishPauseUnsupported(hooks: RunHooks): void {
    hooks.onLine(PAUSE_UNSUPPORTED_LINE);
  }

  private async deleteJobNow(jobName: string): Promise<void> {
    // Idempotent: the deadline and abort paths delete eagerly, and `finally`
    // always deletes. Two DELETEs would be harmless (404s are swallowed) but
    // they read as a bug in the audit log.
    if (this.deletedJobs.has(jobName)) return;
    this.deletedJobs.add(jobName);
    try {
      await this.options.kube.deleteJob(jobName, {
        propagationPolicy: 'Foreground',
        gracePeriodSeconds: 0,
      });
    } catch (error) {
      if (!isNotFound(error)) {
        this.options.logger.warn('could not delete the scan job', {
          jobName,
          message: messageOf(error),
        });
      }
    }
  }

  /** Poll until a pod exists and is Running, or the window expires. */
  private async waitForPod(jobId: string, signal: AbortSignal): Promise<PodPhase | null> {
    const { kube, clock, logger } = this.options;
    const startedAt = clock.now();

    for (;;) {
      if (signal.aborted) return null;
      if (clock.now() - startedAt > POD_READY_TIMEOUT_MS) {
        logger.error('pod did not reach Running in time', { jobId });
        return null;
      }

      const pods = await kube.listPodsForJob(jobId);
      const pod = pods[0];
      if (pod !== undefined) {
        if (pod.waiting !== null && FATAL_WAITING_REASONS.has(pod.waiting)) {
          logger.error('pod image could not start', { jobId, reason: pod.waiting });
          return null;
        }
        if (pod.phase === 'Running' || pod.phase === 'Succeeded' || pod.phase === 'Failed') {
          return pod;
        }
      }
      await clock.sleep(POD_POLL_INTERVAL_MS);
    }
  }

  /** The terminated container state, or null while it is still unknown. */
  private async readFinalState(jobId: string): Promise<PodPhase | null> {
    const pods = await this.options.kube.listPodsForJob(jobId);
    const pod = pods[0];
    if (pod === undefined) return null;
    return pod.exitCode === null && pod.phase !== 'Succeeded' && pod.phase !== 'Failed'
      ? null
      : pod;
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

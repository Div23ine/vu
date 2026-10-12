import type { InternalFinding } from '@vunvault/contracts';
import { classifyLine } from '../output/classify';
import { FindingCollector, MAX_FINDINGS_PER_CALL } from '../output/findings';
import { sanitiseLine } from '../output/sanitise';
import type { ApiClient, Clock, Logger, RunHooks } from '../ports';
import { LogArchive } from './log-archive';
import type { OutputChannel } from './output-channel';

/**
 * Run hooks (Task 88) — the wiring between a scan pod and everything that
 * observes it.
 *
 * One sanitised string feeds three destinations: the live Redis channel, the
 * replay buffer, and the archive. They are written from the SAME value, so a
 * viewer watching live, a viewer joining late, and an auditor reading the
 * archived log all see identical text. That is the property that makes the
 * transcript defensible as evidence.
 *
 * Failure policy, deliberately asymmetric:
 *  - **A publish failure never aborts a scan.** Losing one line to a
 *    disconnected viewer is recoverable (the replay buffer exists); killing a
 *    15-minute scan because Redis blipped is not.
 *  - **A lost finding DOES fail the run.** Findings are the product. If the
 *    final flush cannot land after five attempts, the job is marked `error`
 *    rather than `completed` — a report that silently dropped findings is worse
 *    than no report, because a client would act on its completeness.
 *
 * Progress is throttled to one API call per 2 s but published every time: the
 * API stores a number nobody reads between updates, while the terminal should
 * move as fast as the tool reports.
 */

/** At most one `api.progress` call per this many milliseconds. */
export const PROGRESS_THROTTLE_MS = 2_000;

/** Findings are flushed at least this often, and always at the end. */
export const FINDING_FLUSH_MS = 5_000;

/** Attempts to land the final findings batch before the run is failed. */
export const FINAL_FLUSH_ATTEMPTS = 5;

export interface RunHooksDeps {
  jobId: string;
  api: ApiClient;
  channel: OutputChannel;
  clock: Clock;
  logger: Logger;
  archive?: LogArchive;
  collector?: FindingCollector;
}

export interface RunHooksHandle extends RunHooks {
  /** The archive, so the finish sequence can upload it. */
  archive: LogArchive;
  /** The collector, so the finish sequence can flush and count it. */
  collector: FindingCollector;
  /** Flush everything outstanding. Resolves false if findings were lost. */
  finish(): Promise<boolean>;
  /** Lines published to the stream. */
  lineCount(): number;
}

/**
 * The collector normalises the POD protocol shape (`evidence`, `remediation`),
 * while the hooks receive the contract shape (`evidenceRedacted`,
 * `remediationGuidance`) — `log-stream.ts` converts on the way in. Converting
 * back here keeps both modules honest about which shape they own, instead of a
 * cast that would let the two drift.
 */
function toProtocolFinding(finding: InternalFinding) {
  return {
    t: 'finding' as const,
    severity: finding.severity,
    title: finding.title,
    description: finding.description,
    ...(finding.evidenceRedacted === undefined ? {} : { evidence: finding.evidenceRedacted }),
    ...(finding.cvss === undefined ? {} : { cvss: finding.cvss }),
    ...(finding.cwe === undefined ? {} : { cwe: finding.cwe }),
    ...(finding.remediationGuidance === undefined
      ? {}
      : { remediation: finding.remediationGuidance }),
  };
}

export function makeRunHooks(deps: RunHooksDeps): RunHooksHandle {
  const archive = deps.archive ?? new LogArchive();
  const collector = deps.collector ?? new FindingCollector();

  let seq = 0;
  // -Infinity so the FIRST progress update always reaches the API; a 0 start
  // would swallow it whenever the clock also starts at 0.
  let lastProgressAt = Number.NEGATIVE_INFINITY;
  /** Batches that failed to post. Retried before the collector is drained. */
  const retryBuffer: InternalFinding[] = [];
  let lastFlushAt = deps.clock.now();
  let finalFlushFailed = false;

  const logPublishFailure = (error: unknown): void => {
    deps.logger.warn('could not publish to the scan stream', {
      jobId: deps.jobId,
      message: error instanceof Error ? error.message : String(error),
    });
  };

  /**
   * Post whatever is outstanding, in batches of at most 100.
   *
   * A failed batch goes to `retryBuffer`, NOT back through `collector.add` — the
   * collector dedupes on (title, cwe), so re-adding would silently discard the
   * very findings we are trying to save and the job would complete with a short
   * report.
   */
  const flushFindings = async (): Promise<void> => {
    for (;;) {
      const batch =
        retryBuffer.length > 0
          ? retryBuffer.splice(0, MAX_FINDINGS_PER_CALL)
          : collector.drain(MAX_FINDINGS_PER_CALL);
      if (batch.length === 0) return;
      try {
        await deps.api.findings(deps.jobId, batch);
      } catch (error) {
        retryBuffer.unshift(...batch);
        deps.logger.warn('could not post a findings batch', {
          jobId: deps.jobId,
          count: batch.length,
          message: error instanceof Error ? error.message : String(error),
        });
        return;
      }
    }
  };

  /** Outstanding = still in the collector plus anything awaiting a retry. */
  const outstanding = (): number => collector.size + retryBuffer.length;

  const maybeFlush = async (): Promise<void> => {
    const now = deps.clock.now();
    if (now - lastFlushAt < FINDING_FLUSH_MS) return;
    lastFlushAt = now;
    await flushFindings();
  };

  const handle: RunHooksHandle = {
    archive,
    collector,

    onLine(line: string): void {
      // Sanitise ONCE, then use that exact string everywhere.
      const clean = sanitiseLine(line);
      if (clean === null) return;

      seq += 1;
      archive.append(clean);

      const message = {
        type: 'line' as const,
        seq,
        ts: new Date(deps.clock.now()).toISOString(),
        kind: classifyLine(clean),
        msg: clean,
      };
      void deps.channel.send(message).catch(logPublishFailure);
    },

    onProgress(progress: number, etaSeconds: number | null): void {
      // Publish every time; call the API at most once per throttle window.
      void deps.channel
        .send({ type: 'progress', progress, etaSeconds })
        .catch(logPublishFailure);

      const now = deps.clock.now();
      if (now - lastProgressAt < PROGRESS_THROTTLE_MS) return;
      lastProgressAt = now;
      void deps.api.progress(deps.jobId, progress, etaSeconds).catch((error: unknown) => {
        deps.logger.warn('could not post progress', {
          jobId: deps.jobId,
          message: error instanceof Error ? error.message : String(error),
        });
      });
    },

    onPhase(name: string): void {
      void deps.channel.send({ type: 'phase', name }).catch(logPublishFailure);
    },

    onFinding(finding: InternalFinding): void {
      // The collector normalises, dedupes and caps; a rejected finding is
      // counted there rather than logged per item.
      collector.add(toProtocolFinding(finding));
      void maybeFlush();
    },

    lineCount: () => seq,

    async finish(): Promise<boolean> {
      // The final flush retries, because these are the findings the report is
      // built from. It must land EVERYTHING: a job that completes with findings
      // still buffered has silently under-reported.
      for (let attempt = 1; attempt <= FINAL_FLUSH_ATTEMPTS; attempt += 1) {
        if (outstanding() === 0) return !finalFlushFailed;
        const before = outstanding();
        await flushFindings();
        if (outstanding() === 0) return !finalFlushFailed;
        finalFlushFailed = true;
        deps.logger.error('findings could not be posted', {
          jobId: deps.jobId,
          attempt,
          remaining: outstanding(),
          before,
        });
        if (attempt < FINAL_FLUSH_ATTEMPTS) await deps.clock.sleep(250 * attempt);
      }
      return false;
    },
  };

  return handle;
}

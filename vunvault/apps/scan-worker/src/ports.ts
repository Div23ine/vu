import { z } from 'zod';
import type { InternalCompleteBody, InternalFailBody, InternalFinding, ScanType } from '@vunvault/contracts';

/**
 * Ports (Task 84) — the seams the scan controller depends on.
 *
 * Everything behind an interface here is either untrusted, external or both, so
 * the domain (`job-runner.ts`, `target-guard.ts`, `slots.ts`) is testable with
 * fakes and never touches Redis, HTTP or Kubernetes directly. Task 86 supplies
 * the real `PodRunner` (one unprivileged pod per scan); until then the consumer
 * is wired with the interface alone.
 *
 * The controller runs where untrusted targets are scanned, so it holds no
 * database credentials: `ApiClient` is the ONLY way state reaches the platform,
 * and every call is HMAC-signed (Task 40g).
 */

/** What the pod is told to scan. `ips` are the PINNED addresses it may reach. */
export interface PodSpec {
  jobId: string;
  jobCode: string;
  attempt: number;
  scanType: ScanType;
  host: string;
  /**
   * Resolved by the controller, never by the pod — the DNS-rebinding defence.
   * A CIDR target carries the range in `cidr` instead.
   */
  ips: string[];
  cidr?: string;
  deadlineSeconds: number;
}

/** Why a run ended. Only `completed` is a success. */
export type RunReason = 'completed' | 'abort' | 'kill' | 'deadline' | 'error';

export interface RunResult {
  exitCode: number;
  reason: RunReason;
  lineCount: number;
  bytesStreamed: number;
}

/** Streaming callbacks. Task 88 supplies the real ones; these default to no-ops. */
export interface RunHooks {
  onLine(line: string): void;
  onProgress(progress: number, etaSeconds: number | null): void;
  onFinding(finding: InternalFinding): void;
  /** Optional: a phase boundary, published to the stream but never archived. */
  onPhase?(name: string): void;
}

export interface PodRunner {
  run(spec: PodSpec, hooks: RunHooks, signal: AbortSignal): Promise<RunResult>;
}

/** The four — and only four — control signals the controller accepts. */
export const ControlMessage = z.object({
  type: z.enum(['abort', 'pause', 'resume', 'kill']),
});
export type ControlMessage = z.infer<typeof ControlMessage>;

export type Unsubscribe = () => Promise<void>;

/** Pub/sub for `scan:ctl:<jobId>`. */
export interface RedisBus {
  subscribe(channel: string, onMessage: (message: ControlMessage) => void): Promise<Unsubscribe>;
}

/** Test seam for time, so deadlines and backoff do not need real waiting. */
export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

/** Outcome of a claim attempt. */
export type ClaimOutcome =
  | { kind: 'claimed'; data: ClaimedJob }
  | { kind: 'conflict' }
  | { kind: 'authorisation_invalid' };

/** The API's answer to a successful claim (`InternalClaimResponse['data']`). */
export interface ClaimedJob {
  jobId: string;
  jobCode: string;
  targetHost: string;
  scanType: ScanType;
  attempt: number;
  deadlineSeconds: number;
}

/**
 * The signed callback surface (Task 40g routes).
 *
 * `complete` and `fail` are idempotent on the API — a repeat returns
 * `409 invalid_state`, which the client treats as success — so they may be
 * retried on a 5xx. Nothing else is retried: a 4xx is an answer, not a hiccup.
 */
export interface ApiClient {
  claim(queueJobId: string, podName?: string): Promise<ClaimOutcome>;
  progress(jobId: string, progress: number, etaSeconds: number | null): Promise<void>;
  findings(jobId: string, findings: readonly InternalFinding[]): Promise<void>;
  logUrl(jobId: string, sizeBytes: number): Promise<{ uploadUrl: string; objectKey: string }>;
  complete(jobId: string, body: InternalCompleteBody): Promise<void>;
  fail(jobId: string, body: InternalFailBody): Promise<void>;
}

/** Counting semaphore over the worker slots. */
export interface SlotSemaphore {
  /** False when the ceiling is reached — the caller must requeue, not wait. */
  acquire(): Promise<boolean>;
  release(): Promise<void>;
}

/** The subset of pino the domain uses, so tests can pass a recorder. */
export interface Logger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  debug(message: string, fields?: Record<string, unknown>): void;
}

/** No-op hooks, so the foundation is testable before Task 88 lands. */
export const NOOP_HOOKS: RunHooks = {
  onLine: () => undefined,
  onProgress: () => undefined,
  onFinding: () => undefined,
};

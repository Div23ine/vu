import { describe, expect, it, vi } from 'vitest';
import type { InternalCompleteBody, InternalFailBody, InternalFinding } from '@vunvault/contracts';
import type {
  ApiClient,
  ClaimOutcome,
  Clock,
  Logger,
  PodRunner,
  PodSpec,
  RedisBus,
  RunHooks,
  RunResult,
  SlotSemaphore,
  Unsubscribe,
} from '../ports';
import { JobRunner, truncate } from './job-runner';

/**
 * Job-runner tests (Task 84) — the orchestration invariants, all with fakes:
 * the slot is released on EVERY path, a claim conflict never runs a pod, an
 * unknown control message is ignored, `abort` trips the runner's signal, the
 * target guard is enforced after the claim, and a controller exception is
 * reported as `controller_error` rather than as a scan failure.
 */

interface Recorded {
  complete: { jobId: string; body: InternalCompleteBody }[];
  fail: { jobId: string; body: InternalFailBody }[];
  claims: string[];
  runs: PodSpec[];
  acquires: number;
  releases: number;
  unsubscribes: number;
  logs: string[];
}

function fixture(recorded: Recorded, overrides: Partial<Fixture> = {}) {
  const api: ApiClient = {
    async claim(queueJobId) {
      recorded.claims.push(queueJobId);
      return overrides.claim ?? { kind: 'claimed', data: CLAIMED };
    },
    async progress() {
      /* not exercised here */
    },
    async findings() {
      /* not exercised here */
    },
    async logUrl() {
      return { uploadUrl: 'https://storage.test/x', objectKey: 'k' };
    },
    async complete(jobId, body) {
      recorded.complete.push({ jobId, body });
    },
    async fail(jobId, body) {
      recorded.fail.push({ jobId, body });
    },
  };

  const pods: PodRunner = {
    async run(spec, hooks, signal) {
      recorded.runs.push(spec);
      if (overrides.onRun !== undefined) return overrides.onRun(spec, hooks, signal);
      return (
        overrides.result ?? {
          exitCode: 0,
          reason: 'completed',
          lineCount: 12,
          bytesStreamed: 4096,
        }
      );
    },
  };

  let deliver: ((message: Record<string, unknown>) => void) | null = null;
  const bus: RedisBus = {
    async subscribe(_channel, onMessage) {
      deliver = onMessage as (message: Record<string, unknown>) => void;
      return (async () => {
        recorded.unsubscribes += 1;
        deliver = null;
      }) satisfies Unsubscribe;
    },
  };

  const slots: SlotSemaphore = {
    async acquire() {
      recorded.acquires += 1;
      return overrides.slotAvailable ?? true;
    },
    async release() {
      recorded.releases += 1;
    },
  };

  const clock: Clock = { now: () => 1_700_000_000_000, sleep: async () => undefined };
  const logger: Logger = {
    info: (message) => recorded.logs.push(`info:${message}`),
    warn: (message) => recorded.logs.push(`warn:${message}`),
    error: (message) => recorded.logs.push(`error:${message}`),
    debug: (message) => recorded.logs.push(`debug:${message}`),
  };

  const runner = new JobRunner({
    api,
    pods,
    bus,
    slots,
    clock,
    logger,
    // A fake resolver: the guard decides what a name resolves to, and no test
    // may touch the network.
    resolver: async () => ['93.184.216.34'],
    ...(overrides.hooks === undefined ? {} : { hooks: overrides.hooks }),
  });

  return { runner, emit: (message: Record<string, unknown>) => deliver?.(message) };
}

interface Fixture {
  claim?: ClaimOutcome;
  result?: RunResult;
  slotAvailable?: boolean;
  hooks?: RunHooks;
  onRun?: (spec: PodSpec, hooks: RunHooks, signal: AbortSignal) => Promise<RunResult>;
}

const CLAIMED = {
  jobId: '11111111-1111-4111-8111-111111111111',
  jobCode: 'JOB-4471',
  targetHost: 'api.example.com',
  scanType: 'external' as const,
  attempt: 1,
  deadlineSeconds: 900 as const,
};

const QUEUED = {
  queueJobId: 'queue-1',
  jobId: CLAIMED.jobId,
  attempt: 1,
  targetHost: CLAIMED.targetHost,
  scanType: CLAIMED.scanType,
};

function emptyRecorded(): Recorded {
  return {
    complete: [],
    fail: [],
    claims: [],
    runs: [],
    acquires: 0,
    releases: 0,
    unsubscribes: 0,
    logs: [],
  };
}

describe('JobRunner — the happy path', () => {
  it('claims, pins the resolved IPs, runs and reports complete', async () => {
    const recorded = emptyRecorded();
    const { runner } = fixture(recorded);

    const outcome = await runner.handle(QUEUED);

    expect(outcome).toEqual({ kind: 'completed' });
    expect(recorded.claims).toEqual(['queue-1']);
    expect(recorded.complete).toHaveLength(1);
    expect(recorded.complete[0]?.body).toEqual({
      exitCode: 0,
      lineCount: 12,
      bytesStreamed: 4096,
    });
    expect(recorded.fail).toHaveLength(0);

    // The pod receives PINNED IPs — the DNS-rebinding defence.
    expect(recorded.runs).toHaveLength(1);
    expect(recorded.runs[0]).toMatchObject({
      jobId: CLAIMED.jobId,
      jobCode: 'JOB-4471',
      host: 'api.example.com',
      deadlineSeconds: 900,
    });
    expect(recorded.runs[0]?.ips.length).toBeGreaterThan(0);
  });

  it('releases the slot and unsubscribes exactly once', async () => {
    const recorded = emptyRecorded();
    const { runner } = fixture(recorded);

    await runner.handle(QUEUED);

    expect(recorded.acquires).toBe(1);
    expect(recorded.releases).toBe(1);
    expect(recorded.unsubscribes).toBe(1);
  });
});

describe('JobRunner — slot pressure', () => {
  it('requeues without claiming when no slot is free', async () => {
    const recorded = emptyRecorded();
    const { runner } = fixture(recorded, { slotAvailable: false });

    const outcome = await runner.handle(QUEUED);

    expect(outcome).toEqual({ kind: 'skipped', why: 'no_slot' });
    // Nothing was claimed, run or reported — and the slot we never held is not
    // released either.
    expect(recorded.claims).toHaveLength(0);
    expect(recorded.runs).toHaveLength(0);
    expect(recorded.complete).toHaveLength(0);
    expect(recorded.fail).toHaveLength(0);
    expect(recorded.acquires).toBe(1);
    expect(recorded.releases).toBe(0);
  });
});

describe('JobRunner — claim outcomes', () => {
  it('a conflict finishes the job WITHOUT running a pod', async () => {
    const recorded = emptyRecorded();
    const { runner } = fixture(recorded, { claim: { kind: 'conflict' } });

    const outcome = await runner.handle(QUEUED);

    expect(outcome).toEqual({ kind: 'skipped', why: 'conflict' });
    expect(recorded.runs).toHaveLength(0);
    expect(recorded.complete).toHaveLength(0);
    expect(recorded.fail).toHaveLength(0);
    expect(recorded.logs.some((line) => line.startsWith('info:'))).toBe(true);
    // The slot is still released on this path.
    expect(recorded.releases).toBe(1);
  });

  it('an invalid authorisation finishes without reporting', async () => {
    const recorded = emptyRecorded();
    const { runner } = fixture(recorded, { claim: { kind: 'authorisation_invalid' } });

    const outcome = await runner.handle(QUEUED);

    expect(outcome).toEqual({ kind: 'skipped', why: 'authorisation_invalid' });
    expect(recorded.runs).toHaveLength(0);
    expect(recorded.fail).toHaveLength(0);
    expect(recorded.releases).toBe(1);
  });
});

describe('JobRunner — the target guard runs after the claim', () => {
  it('a private target fails the job and never runs a pod', async () => {
    const recorded = emptyRecorded();
    const { runner } = fixture(recorded, {
      claim: {
        kind: 'claimed',
        data: { ...CLAIMED, targetHost: '10.24.8.9' },
      },
    });

    const outcome = await runner.handle({ ...QUEUED, targetHost: '10.24.8.9' });

    expect(outcome).toMatchObject({ kind: 'failed', reason: 'target_not_allowed' });
    expect(recorded.runs).toHaveLength(0);
    expect(recorded.fail).toHaveLength(1);
    expect(recorded.fail[0]?.body.abortReason).toBe('error');
    expect(recorded.releases).toBe(1);
  });

  it('a malformed target reports invalid_target', async () => {
    const recorded = emptyRecorded();
    const { runner } = fixture(recorded, {
      claim: { kind: 'claimed', data: { ...CLAIMED, targetHost: 'not a host' } },
    });

    const outcome = await runner.handle({ ...QUEUED, targetHost: 'not a host' });

    expect(outcome).toMatchObject({ kind: 'failed', reason: 'invalid_target' });
    expect(recorded.runs).toHaveLength(0);
  });
});

describe('JobRunner — control messages', () => {
  it('abort trips the runner signal and reports the abort', async () => {
    const recorded = emptyRecorded();
    let sawAbort = false;
    const { runner, emit } = fixture(recorded, {
      onRun: async (_spec, _hooks, signal) => {
        emit({ type: 'abort' });
        sawAbort = signal.aborted;
        return { exitCode: 130, reason: 'abort', lineCount: 3, bytesStreamed: 90 };
      },
    });

    const outcome = await runner.handle(QUEUED);

    expect(sawAbort).toBe(true);
    expect(outcome).toMatchObject({ kind: 'failed', abortReason: 'abort' });
    expect(recorded.complete).toHaveLength(0);
    expect(recorded.fail[0]?.body.abortReason).toBe('abort');
  });

  it('kill trips the signal too', async () => {
    const recorded = emptyRecorded();
    const { runner, emit } = fixture(recorded, {
      onRun: async (_spec, _hooks, signal) => {
        emit({ type: 'kill' });
        return {
          exitCode: 137,
          reason: signal.aborted ? 'kill' : 'completed',
          lineCount: 1,
          bytesStreamed: 10,
        };
      },
    });

    const outcome = await runner.handle(QUEUED);

    expect(outcome).toMatchObject({ kind: 'failed', abortReason: 'kill' });
  });

  it('pause and resume are accepted no-ops in v1', async () => {
    const recorded = emptyRecorded();
    const { runner, emit } = fixture(recorded, {
      onRun: async () => {
        emit({ type: 'pause' });
        emit({ type: 'resume' });
        return { exitCode: 0, reason: 'completed', lineCount: 1, bytesStreamed: 1 };
      },
    });

    const outcome = await runner.handle(QUEUED);

    expect(outcome).toEqual({ kind: 'completed' });
    expect(recorded.logs.some((line) => line.includes('no-op in v1'))).toBe(true);
  });

  it('an unknown control message is dropped and logged, never acted on', async () => {
    const recorded = emptyRecorded();
    const { runner, emit } = fixture(recorded, {
      onRun: async (_spec, _hooks, signal) => {
        emit({ type: 'self_destruct' });
        emit({ type: 'abort', extra: 'ignored' });
        return {
          exitCode: 0,
          reason: signal.aborted ? 'abort' : 'completed',
          lineCount: 1,
          bytesStreamed: 1,
        };
      },
    });

    const outcome = await runner.handle(QUEUED);

    // The unknown type did not abort anything; the known one did.
    expect(outcome).toMatchObject({ kind: 'failed', abortReason: 'abort' });
  });
});

describe('JobRunner — failure reporting', () => {
  it('a deadline maps to the deadline abort reason', async () => {
    const recorded = emptyRecorded();
    const { runner } = fixture(recorded, {
      result: { exitCode: 124, reason: 'deadline', lineCount: 40, bytesStreamed: 900 },
    });

    const outcome = await runner.handle(QUEUED);

    expect(outcome).toMatchObject({ kind: 'failed', abortReason: 'deadline' });
    expect(recorded.complete).toHaveLength(0);
  });

  it('a throwing pod runner is reported as controller_error', async () => {
    const recorded = emptyRecorded();
    const { runner } = fixture(recorded, {
      onRun: async () => {
        throw new Error('pod exploded');
      },
    });

    const outcome = await runner.handle(QUEUED);

    expect(outcome).toMatchObject({ kind: 'failed', abortReason: 'error' });
    expect(recorded.fail[0]?.body.reason).toContain('controller_error');
    expect(recorded.fail[0]?.body.reason).toContain('pod exploded');
    // The slot is still released.
    expect(recorded.releases).toBe(1);
  });

  it('a throwing API claim still releases the slot', async () => {
    const recorded = emptyRecorded();
    const api: ApiClient = {
      async claim() {
        throw new Error('api down');
      },
      async progress() {},
      async findings() {},
      async logUrl() {
        return { uploadUrl: 'https://x', objectKey: 'k' };
      },
      async complete() {},
      async fail() {},
    };
    const runner = new JobRunner({
      api,
      pods: { run: vi.fn() as unknown as PodRunner['run'] },
      resolver: async () => ['93.184.216.34'],
      bus: { subscribe: async () => async () => undefined },
      slots: {
        async acquire() {
          recorded.acquires += 1;
          return true;
        },
        async release() {
          recorded.releases += 1;
        },
      },
      clock: { now: () => 0, sleep: async () => undefined },
      logger: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
        debug: () => undefined,
      },
    });

    const outcome = await runner.handle(QUEUED);

    expect(outcome).toMatchObject({ kind: 'failed', reason: 'controller_error' });
    expect(recorded.releases).toBe(1);
  });

  it('truncate keeps a reason inside the API ceiling', () => {
    expect(truncate('short', 300)).toBe('short');
    const long = 'x'.repeat(500);
    const cut = truncate(long, 300);
    expect(cut.length).toBeLessThanOrEqual(300);
    expect(cut.endsWith('…')).toBe(true);
  });
});

describe('JobRunner — hooks', () => {
  it('forwards the injected hooks to the pod runner', async () => {
    const recorded = emptyRecorded();
    const seen: string[] = [];
    const hooks: RunHooks = {
      onLine: (line) => seen.push(`line:${line}`),
      onProgress: (progress) => seen.push(`progress:${progress}`),
      onFinding: (finding: InternalFinding) => seen.push(`finding:${finding.title}`),
    };
    const { runner } = fixture(recorded, {
      hooks,
      onRun: async (_spec, received) => {
        received.onLine('hello');
        received.onProgress(42, null);
        received.onFinding({
          severity: 'high',
          title: 'Open SSH',
          description: 'Port 22 reachable from the internet.',
        });
        return { exitCode: 0, reason: 'completed', lineCount: 1, bytesStreamed: 5 };
      },
    });

    await runner.handle(QUEUED);

    expect(seen).toEqual(['line:hello', 'progress:42', 'finding:Open SSH']);
  });
});

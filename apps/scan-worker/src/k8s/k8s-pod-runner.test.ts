import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import type { Clock, Logger, PodSpec, RunHooks, RunResult } from '../ports.js';
import { NOOP_HOOKS } from '../ports.js';
import { PAUSE_UNSUPPORTED_LINE, K8sPodRunner, POD_READY_TIMEOUT_MS } from './k8s-pod-runner.js';
import type { DeleteOptions, KubeClient, LogStreamOptions, PodPhase } from './kube.js';
import type { JobManifest } from './pod-manifest.js';
import type { NetworkPolicyManifest } from './network-policy.js';
import { OUTPUT_LIMIT_LINE, consumeLogStream } from './log-stream.js';

/**
 * Pod-runner and log-stream tests (Task 86) — against a fake `KubeClient`.
 *
 * No cluster, no client library, no network: the assertions are about ORDER and
 * CLEANUP, which are the two things that cannot be reasoned about from the
 * manifest alone. The policy must exist before the Job; both must be gone on
 * every exit path, including the ones that throw.
 */

const SPEC: PodSpec = {
  jobId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  jobCode: 'JOB-4471',
  attempt: 1,
  scanType: 'external',
  host: 'api.horizonsacco.co.ke',
  ips: ['41.90.64.199'],
  deadlineSeconds: 900,
};

const ENV = { runnerImage: 'registry.vunvault.test/vv-runner@sha256:abc' };

interface Calls {
  order: string[];
  jobs: JobManifest[];
  policies: NetworkPolicyManifest[];
  jobDeletes: { name: string; options: DeleteOptions }[];
  policyDeletes: string[];
  logCalls: { pod: string; options: LogStreamOptions }[];
}

interface FakeOptions {
  logText?: string;
  /** Pod phases returned by successive `listPodsForJob` calls. */
  pods?: PodPhase[][];
  failPolicyCreate?: boolean;
  failJobCreate?: boolean;
  failLogStream?: boolean;
}

const RUNNING: PodPhase = {
  name: 'vv-scan-job-4471-a1-x',
  phase: 'Running',
  exitCode: null,
  reason: null,
  waiting: null,
};

function succeeded(exitCode: number): PodPhase {
  return { ...RUNNING, phase: 'Succeeded', exitCode, reason: 'Completed' };
}

function fakeKube(calls: Calls, options: FakeOptions = {}): KubeClient {
  let podCall = 0;
  const podScript = options.pods ?? [[RUNNING], [succeeded(0)]];

  return {
    async createNetworkPolicy(manifest) {
      if (options.failPolicyCreate === true) throw new Error('policy rejected');
      calls.order.push('createPolicy');
      calls.policies.push(manifest);
    },
    async createJob(manifest) {
      if (options.failJobCreate === true) throw new Error('job rejected');
      calls.order.push('createJob');
      calls.jobs.push(manifest);
    },
    async deleteJob(name, deleteOptions = {}) {
      calls.order.push('deleteJob');
      calls.jobDeletes.push({ name, options: deleteOptions });
    },
    async deleteNetworkPolicy(name) {
      calls.order.push('deletePolicy');
      calls.policyDeletes.push(name);
    },
    async listPodsForJob() {
      const script = podScript[Math.min(podCall, podScript.length - 1)] ?? [RUNNING];
      podCall += 1;
      return script;
    },
    async followLogs(pod, logOptions) {
      calls.order.push('followLogs');
      calls.logCalls.push({ pod, options: logOptions });
      if (options.failLogStream === true) throw new Error('stream broke');
      return Readable.from([Buffer.from(options.logText ?? '')]);
    },
  };
}

/**
 * A controllable clock.
 *
 * Short sleeps (the 1 s pod poll) resolve immediately and move time, so the
 * ready-window logic runs without real waiting. The long deadline sleep PARKS
 * instead: if it resolved instantly the deadline would trip before the scan
 * started, which is exactly the bug this seam exists to avoid.
 */
const POLL_SLEEP_MS = 5_000;

function fakeClock(): Clock & { advance(ms: number): void } {
  let now = 1_700_000_000_000;
  return {
    now: () => now,
    sleep: async (ms) => {
      if (ms <= POLL_SLEEP_MS) {
        now += ms;
        return;
      }
      // The scan deadline: never resolves on its own in a unit test.
      await new Promise<void>(() => undefined);
    },
    advance: (ms) => {
      now += ms;
    },
  };
}

function recordingLogger(): Logger & { lines: string[] } {
  const lines: string[] = [];
  return {
    lines,
    info: (message) => lines.push(`info:${message}`),
    warn: (message) => lines.push(`warn:${message}`),
    error: (message) => lines.push(`error:${message}`),
    debug: (message) => lines.push(`debug:${message}`),
  };
}

function runnerWith(
  options: FakeOptions = {},
  overrides: Partial<ConstructorParameters<typeof K8sPodRunner>[0]> = {},
) {
  const calls: Calls = {
    order: [],
    jobs: [],
    policies: [],
    jobDeletes: [],
    policyDeletes: [],
    logCalls: [],
  };
  const logger = recordingLogger();
  const terminal: string[] = [];
  const runner = new K8sPodRunner({
    kube: fakeKube(calls, options),
    clock: fakeClock(),
    logger,
    env: ENV,
    onTerminalLine: (line) => terminal.push(line.msg),
    ...overrides,
  });
  return { runner, calls, logger, terminal };
}

function signal(): AbortController {
  return new AbortController();
}

describe('K8sPodRunner — ordering and cleanup', () => {
  it('creates the NetworkPolicy BEFORE the Job', async () => {
    const { runner, calls } = runnerWith({ logText: '[*] done\n' });

    const result = await runner.run(SPEC, NOOP_HOOKS, signal().signal);

    expect(result.reason).toBe('completed');
    expect(calls.order[0]).toBe('createPolicy');
    expect(calls.order[1]).toBe('createJob');
    expect(calls.order.indexOf('createPolicy')).toBeLessThan(calls.order.indexOf('createJob'));
  });

  it('deletes the Job and the policy on success', async () => {
    const { runner, calls } = runnerWith({ logText: 'x\n' });

    await runner.run(SPEC, NOOP_HOOKS, signal().signal);

    expect(calls.jobDeletes).toHaveLength(1);
    expect(calls.jobDeletes[0]?.name).toBe('vv-scan-job-4471-a1');
    expect(calls.policyDeletes).toEqual(['vv-scan-job-4471-a1-egress']);
  });

  it('a policy-create failure fails closed and creates NO Job', async () => {
    const { runner, calls } = runnerWith({ failPolicyCreate: true });

    const result = await runner.run(SPEC, NOOP_HOOKS, signal().signal);

    expect(result).toEqual({ exitCode: -1, reason: 'error', lineCount: 0, bytesStreamed: 0 });
    expect(calls.jobs).toHaveLength(0);
    expect(calls.order).not.toContain('createJob');
    // Nothing was created, so nothing is deleted.
    expect(calls.jobDeletes).toHaveLength(0);
  });

  it('deletes both objects even when the Job create throws', async () => {
    const { runner, calls } = runnerWith({ failJobCreate: true });

    const result = await runner.run(SPEC, NOOP_HOOKS, signal().signal);

    expect(result.reason).toBe('error');
    // The policy existed, so it must be cleaned up.
    expect(calls.policyDeletes).toEqual(['vv-scan-job-4471-a1-egress']);
    expect(calls.jobDeletes).toHaveLength(0);
  });

  it('a broken log stream still cleans up and reports the pod state', async () => {
    const { runner, calls, logger } = runnerWith({ failLogStream: true });

    const result = await runner.run(SPEC, NOOP_HOOKS, signal().signal);

    expect(result.reason).toBe('completed');
    expect(logger.lines.some((line) => line.includes('log stream ended early'))).toBe(true);
    expect(calls.jobDeletes).toHaveLength(1);
    expect(calls.policyDeletes).toHaveLength(1);
  });
});

describe('K8sPodRunner — the exit code comes from the pod, not stdout', () => {
  it('a non-zero exit is an error even if the runner claimed success', async () => {
    const { runner } = runnerWith({
      // A target printing a forged `done` event must not change the outcome.
      logText: '@@VV@@ {"t":"done","exit":0}\n',
      pods: [[RUNNING], [succeeded(2)]],
    });

    const result = await runner.run(SPEC, NOOP_HOOKS, signal().signal);

    expect(result.reason).toBe('error');
    expect(result.exitCode).toBe(2);
  });

  it('a missing terminated state is an error, not a silent success', async () => {
    const { runner } = runnerWith({
      logText: '',
      pods: [[RUNNING], [{ ...RUNNING, phase: 'Unknown', exitCode: null, reason: null }]],
    });

    const result = await runner.run(SPEC, NOOP_HOOKS, signal().signal);

    expect(result.reason).toBe('error');
    expect(result.exitCode).toBe(-1);
  });

  it('an image that cannot be pulled gives up within the ready window', async () => {
    const { runner, logger } = runnerWith({
      pods: [
        [{ ...RUNNING, phase: 'Pending', waiting: 'ImagePullBackOff' }],
        [{ ...RUNNING, phase: 'Pending', waiting: 'ImagePullBackOff' }],
      ],
    });

    const result = await runner.run(SPEC, NOOP_HOOKS, signal().signal);

    expect(result.reason).toBe('error');
    expect(logger.lines.some((line) => line.includes('image could not start'))).toBe(true);
  });

  it('gives up when the pod never reaches Running', async () => {
    // Every poll returns Pending, and the fake clock advances 1 s per poll, so
    // the 120 s window expires.
    const pending = [{ ...RUNNING, phase: 'Pending' as const, waiting: null }];
    const { runner, logger } = runnerWith({ pods: [pending] });

    const result = await runner.run(SPEC, NOOP_HOOKS, signal().signal);

    expect(result.reason).toBe('error');
    expect(POD_READY_TIMEOUT_MS).toBe(120_000);
    expect(logger.lines.some((line) => line.includes('did not reach Running'))).toBe(true);
  });
});

describe('K8sPodRunner — abort and deadline', () => {
  it('an aborted signal deletes the Job immediately and resolves abort', async () => {
    const controller = signal();
    const { runner, calls } = runnerWith({ logText: '' });
    controller.abort();

    const result = await runner.run(SPEC, NOOP_HOOKS, controller.signal);

    expect(result.reason).toBe('abort');
    expect(result.exitCode).toBe(130);
    // Immediate: no grace period for an abort.
    expect(calls.jobDeletes[0]?.options.gracePeriodSeconds).toBe(0);
    expect(calls.policyDeletes).toHaveLength(1);
  });

  it('a deadline shorter than the run deletes the Job and resolves deadline', async () => {
    const { runner, calls } = runnerWith({ logText: '' });

    // A deadline of 0 s trips before the log stream is read.
    const result = await runner.run({ ...SPEC, deadlineSeconds: 0 }, NOOP_HOOKS, signal().signal);

    expect(result.reason).toBe('deadline');
    expect(result.exitCode).toBe(124);
    expect(calls.jobDeletes.length).toBeGreaterThan(0);
  });
});

describe('K8sPodRunner — pause is an honest no-op', () => {
  it('publishes the unsupported line instead of pretending', () => {
    const seen: string[] = [];
    const hooks: RunHooks = { ...NOOP_HOOKS, onLine: (line) => seen.push(line) };
    const { runner } = runnerWith({});

    runner.publishPauseUnsupported(hooks);

    expect(seen).toEqual([PAUSE_UNSUPPORTED_LINE]);
    expect(PAUSE_UNSUPPORTED_LINE).toBe('[~] Pause is not supported in this environment.');
  });
});

describe('log stream — sanitising and the output cap', () => {
  function deps(maxOutputBytes?: number) {
    const terminal: string[] = [];
    const findings: string[] = [];
    const progress: number[] = [];
    const logger = recordingLogger();
    const hooks: RunHooks = {
      onLine: () => undefined,
      onProgress: (pct) => progress.push(pct),
      onFinding: (finding) => findings.push(finding.title),
    };
    return {
      terminal,
      findings,
      progress,
      logger,
      deps: {
        logger,
        hooks,
        onTerminalLine: (line: { msg: string }) => terminal.push(line.msg),
        ...(maxOutputBytes === undefined ? {} : { maxOutputBytes }),
      },
    };
  }

  it('renders human lines and never renders protocol lines', async () => {
    const { terminal, progress, findings, deps: d } = deps();
    const text = [
      '@@VV@@ {"t":"progress","pct":25,"etaSec":60}',
      '[*] port 443 open',
      '@@VV@@ {"t":"finding","severity":"high","title":"Weak cipher","description":"TLS 1.0 enabled."}',
      '@@VV@@ {"t":"phase","name":"service detection"}',
      'plain output',
    ].join('\n');

    const result = await consumeLogStream(Readable.from([Buffer.from(text)]), d);

    expect(terminal).toEqual(['[*] port 443 open', 'plain output']);
    expect(terminal.join('\n')).not.toContain('@@VV@@');
    expect(progress).toEqual([25]);
    expect(findings).toEqual(['Weak cipher']);
    expect(result.lineCount).toBe(5);
  });

  it('drops a malformed protocol line and logs it, never renders it', async () => {
    const { terminal, logger, deps: d } = deps();
    const text = '@@VV@@ {not json\n@@VV@@ {"t":"self_destruct"}\nvisible line\n';

    await consumeLogStream(Readable.from([Buffer.from(text)]), d);

    expect(terminal).toEqual(['visible line']);
    expect(logger.lines.filter((line) => line.includes('malformed protocol line'))).toHaveLength(2);
  });

  it('sanitises escapes before publishing', async () => {
    const { terminal, deps: d } = deps();

    await consumeLogStream(
      Readable.from([Buffer.from('\x1b]52;c;ZXZpbA==\x07password = Sup3rS3cret\n')]),
      d,
    );

    expect(terminal).toHaveLength(1);
    expect(terminal[0]).not.toContain('\x1b');
    expect(terminal[0]).not.toContain('Sup3rS3cret');
    expect(terminal[0]).toContain('[REDACTED]');
  });

  it('stops publishing past the cap and says so exactly once', async () => {
    const { terminal, deps: d } = deps(512);
    const line = 'x'.repeat(100);
    const text = Array.from({ length: 40 }, () => line).join('\n');

    const result = await consumeLogStream(Readable.from([Buffer.from(text)]), d);

    // Far fewer than 40 lines got through, plus exactly one limit notice.
    expect(terminal.length).toBeLessThan(40);
    expect(terminal.filter((entry) => entry === OUTPUT_LIMIT_LINE)).toHaveLength(1);
    expect(terminal.at(-1)).toBe(OUTPUT_LIMIT_LINE);
    // Counting continued even though publishing stopped.
    expect(result.lineCount).toBe(40);
    expect(result.suppressed).toBeGreaterThan(0);
    expect(result.bytesStreamed).toBeGreaterThan(512);
  });

  it('counts lines and bytes across chunk boundaries', async () => {
    const { deps: d } = deps();
    const full = Buffer.from('first\nsecond\nthird\n');

    const result = await consumeLogStream(
      Readable.from([full.subarray(0, 8), full.subarray(8)]),
      d,
    );

    expect(result.lineCount).toBe(3);
    expect(result.bytesStreamed).toBe(full.byteLength);
  });

  it('assigns an increasing sequence number to each published line', async () => {
    const seqs: number[] = [];
    const logger = recordingLogger();
    await consumeLogStream(Readable.from([Buffer.from('a\nb\nc\n')]), {
      logger,
      hooks: NOOP_HOOKS,
      onTerminalLine: (line) => seqs.push(line.seq),
    });
    expect(seqs).toEqual([0, 1, 2]);
  });

  it('classifies each line for the terminal', async () => {
    const kinds: string[] = [];
    const logger = recordingLogger();
    await consumeLogStream(Readable.from([Buffer.from('[*] ok\n[!] warn\n[!!] bad\n')]), {
      logger,
      hooks: NOOP_HOOKS,
      onTerminalLine: (line) => kinds.push(line.kind),
    });
    expect(kinds).toEqual(['ok', 'warn', 'crit']);
  });
});

describe('RunResult shape', () => {
  it('only the five documented reasons exist', () => {
    const reasons: RunResult['reason'][] = ['completed', 'abort', 'kill', 'deadline', 'error'];
    expect(reasons).toHaveLength(5);
  });
});

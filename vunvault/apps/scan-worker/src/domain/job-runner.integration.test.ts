import { describe, expect, it } from 'vitest';
import type { ScanStreamMessage } from '@vunvault/contracts';
import type {
  ApiClient,
  ClaimedJob,
  Clock,
  Logger,
  PodRunner,
  RedisBus,
  SlotSemaphore,
} from '../ports';
import { LogArchive } from './log-archive';
import { makeRunHooks } from './run-hooks';
import { JobRunner } from './job-runner';
import type { OutputChannel } from './output-channel';

/**
 * Job-runner integration tests (Task 88) — the whole flow with fakes.
 *
 * These are the end-to-end guarantees the earlier unit tests cannot make on
 * their own: lines come out ordered, the log is uploaded and its key passed to
 * `complete`, `complete` is called exactly once, findings land before it, and a
 * lost-findings failure stops the job completing at all.
 */

const CLAIMED: ClaimedJob = {
  jobId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  jobCode: 'JOB-4471',
  targetHost: 'api.example.com',
  scanType: 'external',
  attempt: 1,
  deadlineSeconds: 900,
};

const QUEUED = {
  queueJobId: 'queue-1',
  jobId: CLAIMED.jobId,
  attempt: 1,
  targetHost: CLAIMED.targetHost,
  scanType: CLAIMED.scanType,
};

interface Recorded {
  complete: { jobId: string; body: Record<string, unknown> }[];
  fail: { jobId: string; body: Record<string, unknown> }[];
  findings: unknown[][];
  logUrls: number[];
  uploads: { url: string; body: string }[];
  published: ScanStreamMessage[];
}

function harness(options: {
  pod?: PodRunner;
  failFindings?: boolean;
  /** Records the order of API calls so "before/after" can be asserted. */
  onApiCall?: (label: string) => void;
  /** Delivered on the control channel as soon as the runner subscribes. */
  control?: { type: 'abort' | 'pause' | 'resume' | 'kill' };
} = {}) {
  const recorded: Recorded = {
    complete: [],
    fail: [],
    findings: [],
    logUrls: [],
    uploads: [],
    published: [],
  };
  let now = 1_700_000_000_000;

  const clock: Clock = {
    now: () => now,
    sleep: async (ms) => {
      now += ms;
    },
  };
  const logger: Logger = {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
  };
  const api: ApiClient = {
    async claim() {
      return { kind: 'claimed', data: CLAIMED };
    },
    async progress() {},
    async findings(_id, batch) {
      options.onApiCall?.('findings');
      if (options.failFindings === true) throw new Error('api down');
      recorded.findings.push([...batch]);
    },
    async logUrl(_id, sizeBytes) {
      recorded.logUrls.push(sizeBytes);
      return { uploadUrl: 'https://storage.test/put?sig=1', objectKey: 'logs/job-4471.txt' };
    },
    async complete(jobId, body) {
      options.onApiCall?.('complete');
      recorded.complete.push({ jobId, body: body as unknown as Record<string, unknown> });
    },
    async fail(jobId, body) {
      options.onApiCall?.('fail');
      recorded.fail.push({ jobId, body: body as unknown as Record<string, unknown> });
    },
  };
  const bus: RedisBus = {
    subscribe: async (_channel, onMessage) => {
      if (options.control !== undefined) {
        // Deliver asynchronously, as a real subscription would.
        setTimeout(() => onMessage(options.control as never), 0);
      }
      return async () => undefined;
    },
  };
  const slots: SlotSemaphore = { acquire: async () => true, release: async () => undefined };

  const channels = new Map<string, OutputChannel>();

  const pod: PodRunner =
    options.pod ??
    ({
      async run(_spec, hooks) {
        hooks.onLine('[*] starting scan');
        hooks.onProgress(25, 60);
        hooks.onLine('[!] weak cipher on 443');
        hooks.onFinding({
          severity: 'high',
          title: 'Weak TLS cipher',
          description: 'A 64-bit block cipher is offered.',
        });
        hooks.onLine('[+] scan finished');
        return { exitCode: 0, reason: 'completed', lineCount: 3, bytesStreamed: 90 };
      },
    }) as PodRunner;

  const runner = new JobRunner({
    api,
    pods: pod,
    bus,
    slots,
    clock,
    logger,
    resolver: async () => ['93.184.216.34'],
    createHooks: (jobId) => {
      const channel: OutputChannel = {
        async send(message) {
          recorded.published.push(message);
        },
      };
      channels.set(jobId, channel);
      return makeRunHooks({ jobId, api, channel, clock, logger, archive: new LogArchive() });
    },
    publishStatus: async (jobId, status, reason) => {
      await channels
        .get(jobId)
        ?.send({ type: 'status', status, ...(reason === undefined ? {} : { reason }) });
    },
  });

  return { runner, recorded, clock };
}

/** The real PUT is intercepted so no test reaches the network. */
function stubUpload(recorded: Recorded) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    recorded.uploads.push({ url: String(url), body: String(init.body ?? '') });
    return new Response(null, { status: 200 });
  }) as unknown as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

describe('JobRunner — the happy path end to end', () => {
  it('publishes ordered lines, uploads the log and completes once', async () => {
    const { runner, recorded } = harness();
    const restore = stubUpload(recorded);
    try {
      const outcome = await runner.handle(QUEUED);
      expect(outcome).toEqual({ kind: 'completed' });

      // Ordered, monotonic seq starting at 1.
      const lines = recorded.published.filter(
        (message): message is Extract<ScanStreamMessage, { type: 'line' }> =>
          message.type === 'line',
      );
      expect(lines.map((line) => line.seq)).toEqual([1, 2, 3]);
      expect(lines.map((line) => line.msg)).toEqual([
        '[*] starting scan',
        '[!] weak cipher on 443',
        '[+] scan finished',
      ]);

      // The archive was minted, uploaded, and its key passed to complete.
      expect(recorded.logUrls).toHaveLength(1);
      expect(recorded.uploads).toHaveLength(1);
      expect(recorded.uploads[0]?.url).toBe('https://storage.test/put?sig=1');
      expect(recorded.uploads[0]?.body).toContain('[*] starting scan');

      expect(recorded.complete).toHaveLength(1);
      expect(recorded.complete[0]?.jobId).toBe(CLAIMED.jobId);
      expect(recorded.complete[0]?.body).toMatchObject({
        exitCode: 0,
        lineCount: 3,
        redactedLogKey: 'logs/job-4471.txt',
      });
      expect(recorded.fail).toHaveLength(0);

      // The terminal is told the run is over.
      expect(recorded.published.at(-1)).toMatchObject({ type: 'status', status: 'completed' });
    } finally {
      restore();
    }
  });

  it('findings are flushed BEFORE complete', async () => {
    const order: string[] = [];
    const { runner, recorded } = harness({
      onApiCall: (label) => order.push(label),
    });
    const restore = stubUpload(recorded);
    try {
      await runner.handle(QUEUED);

      expect(recorded.findings).toHaveLength(1);
      expect(recorded.findings[0]).toHaveLength(1);
      expect(recorded.complete).toHaveLength(1);
      // The ordering is the guarantee: findings land, then the job completes.
      expect(order.indexOf('findings')).toBeLessThan(order.indexOf('complete'));
    } finally {
      restore();
    }
  });

  it('lost findings prevent completion and fail the job', async () => {
    const { runner, recorded } = harness({ failFindings: true });
    const restore = stubUpload(recorded);
    try {
      const outcome = await runner.handle(QUEUED);

      expect(outcome).toMatchObject({ kind: 'failed', abortReason: 'error' });
      // The job must NOT complete with findings still buffered.
      expect(recorded.complete).toHaveLength(0);
      expect(recorded.fail).toHaveLength(1);
      expect(recorded.fail[0]?.body.reason).toContain('findings could not be recorded');
    } finally {
      restore();
    }
  });
});

describe('JobRunner — cancellation', () => {
  it('a kill publishes cancelled and fails with abortReason kill', async () => {
    // The runner owns the AbortController, so a kill has to arrive the way it
    // does in production: over the control channel.
    const { runner, recorded } = harness({
      control: { type: 'kill' },
      pod: {
        async run(_spec, hooks, signal) {
          hooks.onLine('[*] running');
          // Let the bus deliver the control message.
          await new Promise((resolve) => setTimeout(resolve, 0));
          return {
            exitCode: signal.aborted ? 137 : 0,
            reason: signal.aborted ? 'kill' : 'completed',
            lineCount: 1,
            bytesStreamed: 12,
          };
        },
      } as PodRunner,
    });

    const outcome = await runner.handle(QUEUED);

    expect(outcome).toMatchObject({ kind: 'failed', abortReason: 'kill' });
    expect(recorded.complete).toHaveLength(0);
    expect(recorded.fail).toHaveLength(1);
    // Partial findings and lines survive a cancellation.
    expect(
      recorded.published.filter((message) => message.type === 'line').length,
    ).toBeGreaterThan(0);
    expect(recorded.published.at(-1)).toMatchObject({ type: 'status' });
  });

  it('a deadline keeps its partial findings and reports failed', async () => {
    const { runner, recorded } = harness({
      pod: {
        async run(_spec, hooks) {
          hooks.onLine('[*] partial output');
          hooks.onFinding({
            severity: 'medium',
            title: 'Partial finding',
            description: 'Found before the deadline.',
          });
          return { exitCode: 124, reason: 'deadline', lineCount: 1, bytesStreamed: 20 };
        },
      } as PodRunner,
    });

    const outcome = await runner.handle(QUEUED);

    expect(outcome).toMatchObject({ kind: 'failed', abortReason: 'deadline' });
    // The partial finding was still flushed.
    expect(recorded.findings.flat()).toHaveLength(1);
    expect(recorded.complete).toHaveLength(0);
    expect(recorded.published.at(-1)).toMatchObject({ type: 'status', status: 'failed' });
  });
});

describe('JobRunner — archive failure is not fatal', () => {
  it('completes without a log key when the upload fails', async () => {
    const { runner, recorded } = harness();
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error('storage down');
    }) as unknown as typeof fetch;
    try {
      const outcome = await runner.handle(QUEUED);

      expect(outcome).toEqual({ kind: 'completed' });
      expect(recorded.complete).toHaveLength(1);
      // The key is omitted rather than pointing at an object that does not exist.
      expect(recorded.complete[0]?.body).not.toHaveProperty('redactedLogKey');
    } finally {
      globalThis.fetch = original;
    }
  });
});

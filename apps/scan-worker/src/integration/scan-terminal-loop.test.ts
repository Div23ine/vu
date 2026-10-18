import { describe, expect, it } from 'vitest';
import type { ScanStreamFrame, ScanStreamMessage } from '@vunvault/contracts';
import type {
  ApiClient,
  ClaimedJob,
  Clock,
  Logger,
  PodRunner,
  RedisBus,
  RunResult,
  SlotSemaphore,
} from '../ports.js';
import { LogArchive } from '../domain/log-archive.js';
import { makeRunHooks } from '../domain/run-hooks.js';
import { JobRunner, type QueuedJob } from '../domain/job-runner.js';
import { createOutputChannel, type OutputRedis } from '../domain/output-channel.js';
// The relay (Task 95) and the terminal reducer (Task 96), imported across app
// boundaries: this suite is the contract between three processes, and only the
// REAL modules on both ends can prove it.
import { ScanStreamSession } from '../../../api/src/routes/v1/scan-stream/session.js';
import type { RelaySocket } from '../../../api/src/routes/v1/scan-stream/session.js';
import {
  initialStreamState,
  scanStreamReducer,
  type StreamState,
} from '../../../web/src/app/(authed)/admin/scan-queue/_lib/scan-stream-reducer.js';

/**
 * Integration suite B (Task 106): scan queue → controller → relay → terminal.
 *
 * The wire is real at every hop: the controller writes through the REAL
 * `createOutputChannel` over a fake Redis (publish fans out to live
 * subscribers; rpush fills the replay buffer exactly as production does,
 * LTRIM/EXPIRE included); the relay is the REAL `ScanStreamSession` reading
 * that buffer and those publishes; the browser side is the REAL
 * `scanStreamReducer`. Fakes exist only where INFRASTRUCTURE exists — never
 * where a contract does.
 */

const JOB_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const JOB_CODE = 'JOB-4471';

const CLAIMED: ClaimedJob = {
  jobId: JOB_ID,
  jobCode: JOB_CODE,
  targetHost: 'api.example.com',
  scanType: 'external',
  attempt: 1,
  deadlineSeconds: 900,
};

const QUEUED: QueuedJob = {
  queueJobId: 'queue-1',
  jobId: JOB_ID,
  attempt: 1,
  targetHost: CLAIMED.targetHost,
  scanType: CLAIMED.scanType,
};

// ------------------------------------------------------------ fake plumbing

interface FakeRedisState {
  /** Raw payloads published to `scan:out:<job>` (live listeners receive these). */
  live: string[];
  /** The replay buffer, exactly as RPUSH+LTRIM would leave it. */
  buffer: string[];
  /** Messages published to `scan:ctl:<job>`. */
  control: Array<{ type: string }>;
}

function fakeRedis(state: FakeRedisState) {
  const liveListeners: Array<(payload: string) => void> = [];
  const redis: OutputRedis = {
    async publish(_channel, payload) {
      state.live.push(payload);
      for (const listener of liveListeners) listener(payload);
      return liveListeners.length;
    },
    async rpush(_key, value) {
      state.buffer.push(value);
      return state.buffer.length;
    },
    async ltrim(_key, start, stop) {
      // Only the production shape is used (−2000, −1); emulate it honestly.
      const length = state.buffer.length;
      const from = start < 0 ? Math.max(0, length + start) : start;
      const to = stop < 0 ? length + stop : Math.min(stop, length - 1);
      state.buffer.splice(0, length, ...state.buffer.slice(from, to + 1));
      return length;
    },
    async expire() {
      return 1;
    },
  };
  return { redis, liveListeners };
}

function fakeControlBus(state: FakeRedisState) {
  const listeners: Array<(message: { type: string }) => void> = [];
  const bus: RedisBus = {
    async subscribe(_channel, onMessage) {
      listeners.push(onMessage as never);
      return async () => undefined;
    },
  };
  return {
    bus,
    /** What the relay's control.send publishes. */
    publish(message: { type: string }) {
      state.control.push(message);
      for (const listener of listeners) listener(message as never);
    },
  };
}

function makeLogger(): Logger {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

function makeApi(recorded: { complete: number; fail: number }): ApiClient {
  return {
    async claim() {
      return { kind: 'claimed', data: CLAIMED };
    },
    async progress() {},
    async findings() {},
    async logUrl() {
      return { uploadUrl: 'https://storage.test/put?sig=1', objectKey: 'logs/job.txt' };
    },
    async complete() {
      recorded.complete += 1;
    },
    async fail() {
      recorded.fail += 1;
    },
  } as unknown as ApiClient;
}

const CLOCK: Clock = {
  now: () => 1_700_000_000_000,
  sleep: async () => undefined,
};

const SLOTS: SlotSemaphore = { acquire: async () => true, release: async () => undefined };

/** The pod that finishes: three lines, a phase, two progress frames. */
const COMPLETING_POD: PodRunner = {
  async run(_spec, hooks) {
    hooks.onPhase?.('enumeration');
    hooks.onLine('[*] starting scan');
    hooks.onProgress(25, 60);
    hooks.onLine('[!] weak cipher on 443');
    hooks.onPhase?.('exploitation checks');
    hooks.onProgress(70, 20);
    hooks.onLine('[+] scan finished');
    return { exitCode: 0, reason: 'completed', lineCount: 3, bytesStreamed: 90 };
  },
};

/** A pod that stays alive until its signal aborts. */
function gatedPod(): { pod: PodRunner; started: Promise<void> } {
  let markStarted: () => void = () => undefined;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const pod: PodRunner = {
    run(_spec, hooks, signal) {
      hooks.onLine('[*] long-running scan');
      markStarted();
      return new Promise<RunResult>((resolve) => {
        if (signal.aborted) {
          resolve({ exitCode: 137, reason: 'abort', lineCount: 1, bytesStreamed: 24 });
          return;
        }
        signal.addEventListener('abort', () => {
          resolve({ exitCode: 137, reason: 'abort', lineCount: 1, bytesStreamed: 24 });
        });
      });
    },
  };
  return { pod, started };
}

// ------------------------------------------------------------- the harness

function collectingSocket(): RelaySocket & { frames: ScanStreamFrame[] } {
  const frames: ScanStreamFrame[] = [];
  return {
    frames,
    bufferedAmount: 0,
    send(payload: string) {
      frames.push(JSON.parse(payload) as ScanStreamFrame);
    },
    close() {},
    ping() {},
  };
}

interface LoopOptions {
  pod?: PodRunner;
  /** Relay opened with `after` (late-joiner replay filter). */
  after?: number | null;
  canKill?: boolean;
  canExecute?: boolean;
}

function buildLoop(options: LoopOptions = {}) {
  const state: FakeRedisState = { live: [], buffer: [], control: [] };
  const { redis, liveListeners } = fakeRedis(state);
  const ctl = fakeControlBus(state);
  const recorded = { complete: 0, fail: 0 };

  const channels = new Map<string, ReturnType<typeof createOutputChannel>>();
  const runner = new JobRunner({
    api: makeApi(recorded),
    pods: options.pod ?? COMPLETING_POD,
    bus: ctl.bus,
    slots: SLOTS,
    clock: CLOCK,
    logger: makeLogger(),
    resolver: async () => ['93.184.216.34'],
    createHooks: (jobId) => {
      const channel = createOutputChannel({ redis, jobId }, () => undefined);
      channels.set(jobId, channel);
      return makeRunHooks({
        jobId,
        api: makeApi(recorded),
        channel,
        clock: CLOCK,
        logger: makeLogger(),
        archive: new LogArchive(),
      });
    },
    publishStatus: async (jobId, status, reason) => {
      await channels
        .get(jobId)
        ?.send({ type: 'status', status, ...(reason === undefined ? {} : { reason }) });
    },
  });

  const socket = collectingSocket();
  const session = new ScanStreamSession({
    socket,
    target: {
      jobId: JOB_ID,
      jobCode: JOB_CODE,
      dbStatus: 'running',
      status: 'running',
      terminal: false,
    },
    after: options.after ?? null,
    replay: async () => [...state.buffer],
    subscribe: async (onMessage) => {
      liveListeners.push(onMessage);
      return async () => {
        const index = liveListeners.indexOf(onMessage);
        if (index >= 0) liveListeners.splice(index, 1);
      };
    },
    control: {
      canExecute: options.canExecute ?? true,
      canKill: options.canKill ?? true,
      send: async (type) => {
        ctl.publish({ type });
      },
    },
    heartbeatMs: 60_000, // keep timers out of the loop under real-timer tests
    sessionPollMs: 60_000,
  });

  /** Fold every relay frame into the real terminal reducer. */
  function reduceAll(): StreamState {
    let state2 = initialStreamState;
    for (const frame of socket.frames) {
      state2 = scanStreamReducer(state2, { type: 'message', frame });
    }
    return state2;
  }

  return { runner, session, socket, state, recorded, reduceAll };
}

/** Let every pending microtask/promise settle (the loop is all async glue). */
async function flush(times = 12): Promise<void> {
  for (let i = 0; i < times; i += 1) await Promise.resolve();
}

// ------------------------------------------------------------------ suites

describe('scan loop — live full path', () => {
  it('controller frames cross the relay into the terminal, ordered and complete', async () => {
    const loop = buildLoop();
    await loop.session.start();

    await loop.runner.handle(QUEUED);
    await flush();

    // The buffer holds exactly the replayable frames — progress never enters it.
    const buffered = loop.state.buffer.map((raw) => JSON.parse(raw) as ScanStreamMessage);
    expect(buffered.some((message) => message.type === 'progress')).toBe(false);
    expect(buffered.filter((message) => message.type === 'line')).toHaveLength(3);

    // The reducer — the real browser-side state machine — saw the whole run.
    const terminal = loop.reduceAll();
    expect(terminal.lines.map((line) => line.msg)).toEqual([
      '[*] starting scan',
      '[!] weak cipher on 443',
      '[+] scan finished',
    ]);
    expect(terminal.lines.map((line) => line.seq)).toEqual([1, 2, 3]);
    expect(terminal.phase).toBe('exploitation checks');
    expect(terminal.status).toBe('completed');
    expect(terminal.progress).toBe(100); // the status frame, not the stale 70
    expect(terminal.ended).toBe(true);
    expect(loop.recorded.complete).toBe(1);
  });
});

describe('scan loop — late joiners', () => {
  it('replays the finished run exactly once, in order', async () => {
    const run = buildLoop();
    await run.runner.handle(QUEUED); // controller finishes BEFORE any viewer
    await flush();

    const viewer = buildLoop(); // fresh relay, but the SAME captured buffer
    viewer.state.buffer.push(...run.state.buffer);
    await viewer.session.start();
    await flush();

    const terminal = viewer.reduceAll();
    expect(terminal.lines.map((line) => line.seq)).toEqual([1, 2, 3]);
    expect(terminal.status).toBe('completed');
    expect(terminal.ended).toBe(true);
  });

  it('after=<seq> skips older lines but keeps phases and statuses', async () => {
    const run = buildLoop();
    await run.runner.handle(QUEUED);
    await flush();

    const viewer = buildLoop({ after: 2 });
    viewer.state.buffer.push(...run.state.buffer);
    await viewer.session.start();
    await flush();

    const terminal = viewer.reduceAll();
    expect(terminal.lines.map((line) => line.seq)).toEqual([3]);
    // The DB-derived opening status plus the buffered phase/status frames.
    expect(terminal.status).toBe('completed');
  });
});

describe('scan loop — the control round trip', () => {
  it('abort travels terminal → relay → bus → controller and cancels the run', async () => {
    const { pod, started } = gatedPod();
    const loop = buildLoop({ pod });
    await loop.session.start();

    const running = loop.runner.handle(QUEUED);
    await started;
    await flush();
    expect(loop.socket.frames.some((frame) => frame.type === 'line')).toBe(true);

    loop.session.onClientMessage(JSON.stringify({ type: 'abort' }));
    const outcome = await running;
    await flush();

    // Exactly one validated verb reached the controller — nothing else ever does.
    expect(loop.state.control).toEqual([{ type: 'abort' }]);
    expect(outcome).toMatchObject({ kind: 'failed', abortReason: 'abort' });

    // The acknowledgement went back to the browser…
    expect(
      loop.socket.frames.filter(
        (frame) => frame.type === 'control_ack' && frame.control === 'abort',
      ),
    ).toHaveLength(1);
    // …and so did the cancelled status, ending the terminal.
    const terminal = loop.reduceAll();
    expect(terminal.status).toBe('cancelled');
    expect(terminal.ended).toBe(true);
  });

  it('off-whitelist messages die at the relay and never reach the controller', async () => {
    const { pod, started } = gatedPod();
    const loop = buildLoop({ pod });
    await loop.session.start();
    void loop.runner.handle(QUEUED);
    await started;

    loop.session.onClientMessage(JSON.stringify({ type: 'exec', cmd: 'rm -rf /' }));
    loop.session.onClientMessage(JSON.stringify({ type: 'abort', extra: 1 }));
    await flush();

    expect(loop.state.control).toEqual([]);
    const errors = loop.socket.frames.filter((frame) => frame.type === 'error');
    expect(errors).toHaveLength(2);
    expect(
      errors.every((frame) => frame.type === 'error' && frame.code === 'invalid_message'),
    ).toBe(true);
  });

  it('an analyst may abort but not kill — enforced before the bus', async () => {
    const { pod, started } = gatedPod();
    const loop = buildLoop({ pod, canKill: false });
    await loop.session.start();
    void loop.runner.handle(QUEUED);
    await started;

    loop.session.onClientMessage(JSON.stringify({ type: 'kill' }));
    await flush();
    expect(loop.state.control).toEqual([]);
    expect(
      loop.socket.frames.some((frame) => frame.type === 'error' && frame.code === 'forbidden'),
    ).toBe(true);

    loop.session.onClientMessage(JSON.stringify({ type: 'abort' }));
    await flush();
    expect(loop.state.control).toEqual([{ type: 'abort' }]);
  });
});

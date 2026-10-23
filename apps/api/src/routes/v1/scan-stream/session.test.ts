import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScanStreamFrame, ScanStreamMessage } from '@vunvault/contracts';
import {
  CLOSE_CODES,
  ScanStreamSession,
  type RelaySocket,
  type ScanStreamSessionDeps,
  type ScanStreamTarget,
} from './session';
import { controlChannel, liveChannel, replayBufferKey } from './channels';

/**
 * The scan terminal relay's state machine (Task 95).
 *
 * A fake socket, a fake Redis (replay list + pub/sub callback) and injected
 * time: the assertions are about the frames a browser would receive, the
 * ordering guarantee across the replay seam, the four-verb control whitelist
 * and what is released when any of it ends.
 */

const JOB_ID = 'b1000000-0000-4000-8000-0000000000a1';

const TARGET: ScanStreamTarget = {
  jobId: JOB_ID,
  jobCode: 'JOB-4472',
  dbStatus: 'running',
  status: 'running',
  terminal: false,
};

class FakeSocket implements RelaySocket {
  sent: string[] = [];
  pings = 0;
  closedWith: { code: number; reason: string } | null = null;
  bufferedAmount = 0;

  send(payload: string): void {
    this.sent.push(payload);
  }

  close(code: number, reason: string): void {
    this.closedWith = { code, reason };
  }

  ping(): void {
    this.pings += 1;
  }

  frames(): ScanStreamFrame[] {
    return this.sent.map((payload) => JSON.parse(payload) as ScanStreamFrame);
  }
}

interface FakeBus {
  listeners: Array<(payload: string) => void>;
  teardowns: number;
  subscribe: (onMessage: (payload: string) => void) => Promise<() => Promise<void>>;
  publish: (message: ScanStreamMessage | string) => void;
}

function fakeBus(): FakeBus {
  const bus: FakeBus = {
    listeners: [],
    teardowns: 0,
    async subscribe(onMessage) {
      bus.listeners.push(onMessage);
      return async () => {
        bus.teardowns += 1;
      };
    },
    publish(message) {
      const raw = typeof message === 'string' ? message : JSON.stringify(message);
      for (const listener of bus.listeners) listener(raw);
    },
  };
  return bus;
}

function line(seq: number, msg = `step ${seq}`): ScanStreamMessage {
  return { type: 'line', seq, ts: '2026-10-08T12:00:00.000Z', kind: 'info', msg };
}

function status(status: 'running' | 'completed' | 'failed' | 'cancelled'): ScanStreamMessage {
  return { type: 'status', status };
}

interface SessionOverrides {
  socket?: FakeSocket;
  bus?: FakeBus;
  target?: ScanStreamTarget;
  after?: number | null;
  buffer?: string[];
  replayError?: Error;
  subscribeError?: Error;
  sessionActive?: () => Promise<boolean>;
  control?: Partial<ScanStreamSessionDeps['control']>;
  now?: () => number;
  heartbeatMs?: number;
  pongTimeoutMs?: number;
  sessionPollMs?: number;
  maxBufferedBytes?: number;
}

interface Harness {
  session: ScanStreamSession;
  socket: FakeSocket;
  bus: FakeBus;
  controls: Array<{ type: string }>;
}

function makeSession(overrides: SessionOverrides = {}): Harness {
  const socket = overrides.socket ?? new FakeSocket();
  const bus = overrides.bus ?? fakeBus();
  const controls: Array<{ type: string }> = [];
  const control: ScanStreamSessionDeps['control'] = {
    canExecute: true,
    canKill: true,
    send: async (type) => {
      controls.push({ type });
    },
    ...overrides.control,
  };
  const harness: Harness = { session: null as never, socket, bus, controls };
  const session = new ScanStreamSession({
    socket,
    target: overrides.target ?? TARGET,
    after: overrides.after ?? null,
    replay: async () => {
      if (overrides.replayError !== undefined) throw overrides.replayError;
      return overrides.buffer ?? [];
    },
    subscribe: async (onMessage) => {
      if (overrides.subscribeError !== undefined) throw overrides.subscribeError;
      return bus.subscribe(onMessage);
    },
    ...(overrides.sessionActive !== undefined ? { sessionActive: overrides.sessionActive } : {}),
    control,
    heartbeatMs: overrides.heartbeatMs ?? 20_000,
    pongTimeoutMs: overrides.pongTimeoutMs ?? 45_000,
    sessionPollMs: overrides.sessionPollMs ?? 30_000,
    maxBufferedBytes: overrides.maxBufferedBytes ?? 1_048_576,
    now: overrides.now ?? Date.now,
  });
  harness.session = session;
  return harness;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('channel naming — the API side of the Task 88 wire', () => {
  it('pins the exact strings the controller uses', () => {
    expect(liveChannel(JOB_ID)).toBe(`scan:out:${JOB_ID}`);
    expect(replayBufferKey(JOB_ID)).toBe(`scan:buf:${JOB_ID}`);
    expect(controlChannel(JOB_ID)).toBe(`scan:ctl:${JOB_ID}`);
  });
});

describe('ScanStreamSession — handshake sequence', () => {
  it('sends the DB-derived status first, then replayed frames in order', async () => {
    const { session, socket } = makeSession({
      buffer: [JSON.stringify(line(1)), JSON.stringify(line(2)), JSON.stringify(status('running'))],
    });
    await session.start();

    expect(socket.frames()).toEqual([status('running'), line(1), line(2), status('running')]);
    expect(session.stats.replayed).toBe(3);
  });

  it('subscribes BEFORE reading the buffer: a mid-replay arrival is flushed after, once', async () => {
    const bus = fakeBus();
    let resolveReplay: (value: string[]) => void = () => undefined;
    const replayGate = new Promise<string[]>((resolve) => {
      resolveReplay = resolve;
    });
    const socket = new FakeSocket();
    const session = new ScanStreamSession({
      socket,
      target: TARGET,
      after: null,
      replay: () => replayGate,
      subscribe: (onMessage) => bus.subscribe(onMessage),
      control: { canExecute: true, canKill: true, send: async () => undefined },
    });

    const started = session.start();
    // The subscription exists while the replay read is still in flight...
    await vi.advanceTimersByTimeAsync(0);
    expect(bus.listeners).toHaveLength(1);
    bus.publish(line(8));
    bus.publish(line(9));
    resolveReplay([JSON.stringify(line(7)), JSON.stringify(line(8))]);
    await started;

    // ...so nothing is lost and nothing is duplicated: 8 arrived live AND sits
    // in the buffer; the high-water mark sends it exactly once.
    expect(socket.frames()).toEqual([status('running'), line(7), line(8), line(9)]);
    expect(session.stats.droppedStale).toBe(1);
  });

  it('`after` skips older lines but never phases or statuses', async () => {
    const { session, socket } = makeSession({
      after: 7,
      buffer: [
        JSON.stringify(line(6)),
        JSON.stringify(line(7)),
        JSON.stringify(line(8)),
        JSON.stringify({ type: 'phase', name: 'enumeration' }),
        JSON.stringify(status('running')),
      ],
    });
    await session.start();

    const frames = socket.frames();
    expect(frames).toEqual([
      status('running'),
      line(8),
      { type: 'phase', name: 'enumeration' },
      status('running'),
    ]);
  });

  it('drops unparsable replay and live payloads without dying', async () => {
    const { session, socket, bus } = makeSession({ buffer: ['{truncated', 'null'] });
    await session.start();
    bus.publish('{"type":"line"}'); // fails the contract: no seq/ts/kind/msg
    bus.publish(line(3));

    expect(socket.frames()).toEqual([status('running'), line(3)]);
    expect(session.stats.droppedUnparsable).toBe(3);
  });

  it('a failing replay read degrades to live-only', async () => {
    const { session, socket, bus } = makeSession({ replayError: new Error('redis down') });
    await session.start();
    bus.publish(line(1));

    expect(session.isClosed).toBe(false);
    expect(socket.frames()).toEqual([status('running'), line(1)]);
  });

  it('a failing subscribe closes with 1011 and never half-streams', async () => {
    const { session, socket } = makeSession({ subscribeError: new Error('no redis') });
    await session.start();

    expect(session.isClosed).toBe(true);
    expect(socket.closedWith).toEqual({ code: 1_011, reason: 'relay unavailable' });
  });
});

describe('ScanStreamSession — terminal jobs', () => {
  const TERMINAL: ScanStreamTarget = {
    ...TARGET,
    dbStatus: 'completed',
    status: 'completed',
    terminal: true,
  };

  it('terminal + empty buffer: status frame, close 1000 finished, never subscribes', async () => {
    const { session, socket, bus } = makeSession({ target: TERMINAL, buffer: [] });
    await session.start();

    expect(socket.frames()).toEqual([status('completed')]);
    expect(socket.closedWith).toEqual(CLOSE_CODES.finished);
    expect(bus.listeners).toHaveLength(0);
  });

  it('terminal + buffer: replays the tail and stays open without subscribing', async () => {
    const { session, socket, bus } = makeSession({
      target: TERMINAL,
      buffer: [JSON.stringify(line(1)), JSON.stringify(status('completed'))],
    });
    await session.start();

    expect(socket.frames()).toEqual([status('completed'), line(1), status('completed')]);
    expect(socket.closedWith).toBeNull();
    expect(bus.listeners).toHaveLength(0);
    expect(session.isClosed).toBe(false);
  });

  it('held and rejected jobs arrive as cancelled', () => {
    // The mapping itself lives in service.ts; the session only sees the wire
    // status. Pin the session-side behaviour: a cancelled terminal target
    // says `cancelled` and closes on an empty buffer.
    const held: ScanStreamTarget = {
      ...TARGET,
      dbStatus: 'held',
      status: 'cancelled',
      terminal: true,
    };
    const { session, socket } = makeSession({ target: held });
    return session.start().then(() => {
      expect(socket.frames()).toEqual([status('cancelled')]);
      expect(socket.closedWith).toEqual(CLOSE_CODES.finished);
    });
  });
});

describe('ScanStreamSession — live forwarding', () => {
  it('forwards live frames contract-checked, and a status frame moves the control gate', async () => {
    const { session, socket, bus, controls } = makeSession();
    await session.start();

    bus.publish(line(1));
    expect(socket.frames().at(-1)).toEqual(line(1));

    // Once the controller reports completion, controls are refused.
    bus.publish(status('completed'));
    socket.sent.length = 0;
    session.onClientMessage(JSON.stringify({ type: 'abort' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(controls).toHaveLength(0);
    expect(socket.frames()).toEqual([{ type: 'error', code: 'not_running' }]);
  });

  it('stale lines at or below the high-water mark are never re-sent', async () => {
    const { session, socket, bus } = makeSession({ buffer: [JSON.stringify(line(5))] });
    await session.start();

    bus.publish(line(5));
    bus.publish(line(4));
    bus.publish(line(6));
    expect(socket.frames().slice(2)).toEqual([line(6)]);
    expect(session.stats.droppedStale).toBe(2);
  });
});

describe('ScanStreamSession — the client control whitelist', () => {
  it('rejects anything but the four verbs, and closes 4400 on the fifth rejection', async () => {
    const { session, socket, controls } = makeSession();
    await session.start();
    socket.sent.length = 0;

    for (const raw of [
      '{bad json',
      '{"type":"exec"}',
      '{"type":"abort","cmd":"x"}',
      '"abort"',
      '{"type":"KILL"}',
    ]) {
      session.onClientMessage(raw);
    }
    await vi.advanceTimersByTimeAsync(0);

    expect(controls).toHaveLength(0);
    expect(socket.frames().filter((f) => f.type === 'error')).toHaveLength(5);
    expect(socket.closedWith).toEqual(CLOSE_CODES.invalid);
  });

  it('rate-limits to 5/s: excess drops silently, 20 consecutive close 4429', async () => {
    let clock = 1_000_000;
    const { session, socket, controls } = makeSession({ now: () => clock });
    await session.start();
    socket.sent.length = 0;

    const abort = JSON.stringify({ type: 'abort' });
    for (let i = 0; i < 5; i += 1) session.onClientMessage(abort);
    await vi.advanceTimersByTimeAsync(0);
    expect(controls).toHaveLength(5);
    expect(session.stats.rateDropped).toBe(0);
    socket.sent.length = 0; // the five acks are asserted; clear for the drop phase

    // The 6th inside the same second is dropped without a frame.
    session.onClientMessage(abort);
    expect(session.stats.rateDropped).toBe(1);
    expect(socket.frames()).toHaveLength(0);

    // 19 more consecutive drops hit the limit and close the socket.
    for (let i = 0; i < 19; i += 1) session.onClientMessage(abort);
    expect(socket.closedWith).toEqual(CLOSE_CODES.rate);

    // A new second resets the window (socket is closed, so nothing is sent).
    clock += 1_000;
    session.onClientMessage(abort);
    expect(session.stats.rateDropped).toBe(20);
  });

  it('an accepted control publishes EXACTLY the validated verb and acks', async () => {
    const published: Array<Record<string, unknown>> = [];
    const { session, socket } = makeSession({
      control: {
        canExecute: true,
        canKill: true,
        send: async (type) => {
          published.push({ type });
        },
      },
    });
    await session.start();
    socket.sent.length = 0;

    session.onClientMessage('{"type":"pause","ignored":true}'); // strict: extra prop → invalid
    expect(socket.frames()).toEqual([{ type: 'error', code: 'invalid_message' }]);

    session.onClientMessage('{"type":"pause"}');
    await vi.advanceTimersByTimeAsync(0);
    expect(published).toEqual([{ type: 'pause' }]);
    expect(socket.frames().at(-1)).toEqual({ type: 'control_ack', control: 'pause' });
    expect(session.stats.controlsSent).toBe(1);
  });

  it('kill is for administrators; abort is for anyone who may execute', async () => {
    const published: string[] = [];
    const { session, socket } = makeSession({
      control: {
        canExecute: true,
        canKill: false,
        send: async (type) => {
          published.push(type);
        },
      },
    });
    await session.start();
    socket.sent.length = 0;

    session.onClientMessage('{"type":"kill"}');
    await vi.advanceTimersByTimeAsync(0);
    expect(published).toEqual([]);
    expect(socket.frames()).toEqual([{ type: 'error', code: 'forbidden' }]);

    session.onClientMessage('{"type":"abort"}');
    await vi.advanceTimersByTimeAsync(0);
    expect(published).toEqual(['abort']);
    expect(socket.frames().at(-1)).toEqual({ type: 'control_ack', control: 'abort' });
  });

  it('without scans:execute every verb is refused', async () => {
    const published: string[] = [];
    const { session, socket } = makeSession({
      control: {
        canExecute: false,
        canKill: true,
        send: async (type) => {
          published.push(type);
        },
      },
    });
    await session.start();
    socket.sent.length = 0;

    for (const type of ['abort', 'pause', 'resume', 'kill']) {
      session.onClientMessage(JSON.stringify({ type }));
    }
    await vi.advanceTimersByTimeAsync(0);
    expect(published).toEqual([]);
    expect(socket.frames()).toEqual([
      { type: 'error', code: 'forbidden' },
      { type: 'error', code: 'forbidden' },
      { type: 'error', code: 'forbidden' },
      { type: 'error', code: 'forbidden' },
    ]);
  });

  it('a failing publish acks nothing (silence, never a false receipt)', async () => {
    const { session, socket } = makeSession({
      control: {
        canExecute: true,
        canKill: true,
        send: async () => {
          throw new Error('redis down');
        },
      },
    });
    await session.start();
    socket.sent.length = 0;

    session.onClientMessage('{"type":"abort"}');
    await vi.advanceTimersByTimeAsync(0);
    expect(socket.frames()).toEqual([]);
    expect(session.stats.controlsSent).toBe(0);
    expect(session.isClosed).toBe(false);
  });
});

describe('ScanStreamSession — heartbeat, session and backpressure', () => {
  it('pings every 20 s and closes 4408 when no pong answers within 45 s', async () => {
    let clock = 0;
    const { session, socket } = makeSession({ now: () => clock });
    await session.start();

    vi.advanceTimersByTime(20_000);
    expect(socket.pings).toBe(1);

    // A pong resets the deadline.
    clock = 20_000;
    session.onPong();
    clock = 40_000;
    vi.advanceTimersByTime(20_000);
    expect(socket.pings).toBe(2);

    // 45 s without a pong: the next heartbeat check hangs up.
    clock = 90_000;
    vi.advanceTimersByTime(20_000);
    expect(socket.closedWith).toEqual(CLOSE_CODES.heartbeat);
    session.close();
  });

  it('a revoked session closes 4401 within one poll', async () => {
    const { session, socket } = makeSession({ sessionActive: async () => false });
    await session.start();

    await vi.advanceTimersByTimeAsync(30_000);
    expect(socket.closedWith).toEqual(CLOSE_CODES.sessionEnded);
  });

  it('an unreachable session registry ends the stream rather than guessing', async () => {
    const { session, socket } = makeSession({
      sessionActive: async () => {
        throw new Error('registry down');
      },
    });
    await session.start();

    await vi.advanceTimersByTimeAsync(30_000);
    expect(socket.closedWith).toEqual(CLOSE_CODES.sessionEnded);
  });

  it('a slow consumer is dropped with 1013, not buffered', async () => {
    const socket = new FakeSocket();
    const bus = fakeBus();
    const { session } = makeSession({ socket, bus, maxBufferedBytes: 100 });
    await session.start();

    socket.bufferedAmount = 101;
    bus.publish(line(1));
    expect(socket.closedWith).toEqual(CLOSE_CODES.slowConsumer);
    expect(session.isClosed).toBe(true);
  });
});

describe('ScanStreamSession — cleanup', () => {
  it('close releases the subscriber and clears timers exactly once', async () => {
    const { session, bus, socket } = makeSession();
    await session.start();

    const pingsAtClose = socket.pings;
    session.close(CLOSE_CODES.finished);
    session.close(CLOSE_CODES.finished);
    await vi.advanceTimersByTimeAsync(0);
    expect(bus.teardowns).toBe(1);
    expect(session.stats.closedReason).toBe('finished');

    // Timers are gone: advancing past two heartbeats pings nothing.
    vi.advanceTimersByTime(60_000);
    expect(socket.pings).toBe(pingsAtClose);
  });

  it('a socket dying underneath releases the same resources', async () => {
    const { session, bus, socket } = makeSession();
    await session.start();

    session.onSocketClose();
    await vi.advanceTimersByTimeAsync(0);
    expect(bus.teardowns).toBe(1);
    expect(session.stats.closedReason).toBe('client');
    // The session does not close the socket back — it already went.
    expect(socket.closedWith).toBeNull();
  });

  it('a close while subscribing still releases the connection', async () => {
    const bus = fakeBus();
    let releaseSubscribe: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      releaseSubscribe = resolve;
    });
    const session = new ScanStreamSession({
      socket: new FakeSocket(),
      target: TARGET,
      after: null,
      replay: async () => [],
      subscribe: async (onMessage) => {
        await gate;
        return bus.subscribe(onMessage);
      },
      control: { canExecute: true, canKill: true, send: async () => undefined },
    });

    const started = session.start();
    await vi.advanceTimersByTimeAsync(0);
    session.close(CLOSE_CODES.finished);
    releaseSubscribe();
    await started;

    expect(bus.teardowns).toBe(1);
  });
});

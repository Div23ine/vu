import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BroadcastRecord } from '@vunvault/contracts';
import { BroadcastProgressEvent, BroadcastStreamEvent } from '@vunvault/contracts';
import { collectingWriter, type SseWriter } from '../audit/sse.js';
import {
  BroadcastSseSession,
  broadcastHeartbeatFrame,
  progressFrame,
  snapshotFrame,
  type BroadcastSseDeps,
} from './broadcast-sse.js';

/**
 * The broadcast progress relay (Task 94).
 *
 * Timers are fake, the socket is a collector and Redis is a callback — the same
 * discipline as `audit/sse.test.ts`. The assertions are about the frames a
 * browser would receive (each one re-parsed with the contract the desk uses)
 * and about what is released when the socket goes away.
 */

const ADVISORY_ID = '9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d';
const OTHER_ADVISORY_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const BROADCAST_ID = '3f2b8c1e-9d4a-4e7b-8c2f-1a5d6e7f8090';

function record(overrides: Partial<BroadcastRecord> = {}): BroadcastRecord {
  return {
    id: BROADCAST_ID,
    advisoryId: ADVISORY_ID,
    kind: 'initial',
    status: 'sending',
    triggeredByLabel: 'e.reed',
    audienceDashboards: 12,
    emailContacts: 34,
    smsContacts: 5,
    sentDashboards: 7,
    sentEmail: 20,
    sentSms: 3,
    failed: 1,
    createdAt: '2026-09-24T09:12:00.000Z',
    finishedAt: null,
    ...overrides,
  };
}

function progress(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'progress',
    broadcastId: BROADCAST_ID,
    advisoryId: ADVISORY_ID,
    kind: 'initial',
    status: 'sending',
    audience: { dashboards: 12, email: 34, sms: 5 },
    sent: { dashboards: 9, email: 24, sms: 4 },
    failed: 1,
    updatedAt: '2026-09-24T09:14:00.000Z',
    ...overrides,
  };
}

interface FakeBus {
  listeners: Array<(payload: string) => void>;
  teardowns: number;
  subscribe: (onMessage: (payload: string) => void) => Promise<() => Promise<void>>;
  publish: (payload: unknown) => void;
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
    publish(payload) {
      const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
      for (const listener of bus.listeners) listener(raw);
    },
  };
  return bus;
}

interface SessionOverrides {
  writer?: SseWriter & { frames: string[] };
  bus?: FakeBus;
  records?: BroadcastRecord[];
  snapshotError?: Error;
  subscribeError?: Error;
  sessionActive?: () => Promise<boolean>;
  heartbeatMs?: number;
  sessionPollMs?: number;
  maxBufferBytes?: number;
  warn?: (message: string, error?: unknown) => void;
}

function makeSession(overrides: SessionOverrides = {}) {
  const writer = overrides.writer ?? collectingWriter();
  const bus = overrides.bus ?? fakeBus();
  const deps: BroadcastSseDeps = {
    advisoryId: ADVISORY_ID,
    writer,
    snapshot: async () => {
      if (overrides.snapshotError !== undefined) throw overrides.snapshotError;
      return overrides.records ?? [record()];
    },
    subscribe: async (onMessage) => {
      if (overrides.subscribeError !== undefined) throw overrides.subscribeError;
      return bus.subscribe(onMessage);
    },
    ...(overrides.sessionActive !== undefined ? { sessionActive: overrides.sessionActive } : {}),
    heartbeatMs: overrides.heartbeatMs ?? 20_000,
    sessionPollMs: overrides.sessionPollMs ?? 30_000,
    maxBufferBytes: overrides.maxBufferBytes ?? 1_048_576,
    log: { warn: overrides.warn ?? ((): undefined => undefined) },
  };
  const session = new BroadcastSseSession(deps);
  return { session, writer: writer as SseWriter & { frames: string[] }, bus };
}

/** Parse every `data:` line of a frame with the desk's own contract. */
function dataOf(frame: string): unknown {
  const line = frame.split('\n').find((entry) => entry.startsWith('data: '));
  if (line === undefined) throw new Error(`Frame has no data line: ${JSON.stringify(frame)}`);
  return JSON.parse(line.slice('data: '.length));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('BroadcastSseSession — opening frames', () => {
  it('sends retry then a contract-valid snapshot before subscribing', async () => {
    const { session, writer, bus } = makeSession();
    await session.start();

    expect(writer.frames[0]).toBe('retry: 5000\n\n');
    expect(BroadcastStreamEvent.safeParse(dataOf(writer.frames[1] ?? ''))).toMatchObject({
      success: true,
      data: { type: 'snapshot', records: [record()] },
    });
    expect(bus.listeners).toHaveLength(1);
  });

  it('a failing snapshot is logged and the stream still goes live', async () => {
    const warnings: string[] = [];
    const { session, bus } = makeSession({
      snapshotError: new Error('db down'),
      warn: (message) => warnings.push(message),
    });
    await session.start();

    expect(warnings).toHaveLength(1);
    expect(bus.listeners).toHaveLength(1);
    expect(session.isClosed).toBe(false);
  });

  it('a failing subscribe closes the session and ends the socket', async () => {
    const frames: string[] = [];
    let ended = false;
    const writer: SseWriter & { frames: string[] } = {
      frames,
      bufferSize: 0,
      get ended() {
        return ended;
      },
      write(chunk: string) {
        frames.push(chunk);
        return true;
      },
      end() {
        ended = true;
      },
    };
    const { session } = makeSession({ writer, subscribeError: new Error('no redis') });
    await session.start();

    expect(session.isClosed).toBe(true);
    expect(session.stats.closedReason).toBe('error');
    expect(ended).toBe(true);
  });
});

describe('BroadcastSseSession — progress frames', () => {
  it('forwards a frame for this advisory, contract-checked', async () => {
    const { session, writer, bus } = makeSession();
    await session.start();
    writer.frames.length = 0;

    bus.publish(progress());
    expect(writer.frames).toHaveLength(1);
    expect(writer.frames[0]).toMatch(/^event: progress\n/);
    expect(BroadcastStreamEvent.safeParse(dataOf(writer.frames[0] ?? '')).success).toBe(true);
    expect(session.stats.forwarded).toBe(1);
  });

  it('drops frames for another advisory without forwarding', async () => {
    const { session, writer, bus } = makeSession();
    await session.start();
    writer.frames.length = 0;

    bus.publish(progress({ advisoryId: OTHER_ADVISORY_ID }));
    expect(writer.frames).toHaveLength(0);
    expect(session.stats.droppedOtherAdvisory).toBe(1);
  });

  it('drops unparsable and contract-violating payloads', async () => {
    const warnings: string[] = [];
    const { session, writer, bus } = makeSession({ warn: (message) => warnings.push(message) });
    await session.start();
    writer.frames.length = 0;

    bus.publish('{truncated');
    bus.publish(progress({ status: 'partial' }));
    bus.publish(progress({ podName: 'scan-1' }));
    expect(writer.frames).toHaveLength(0);
    expect(session.stats.droppedUnparsable).toBe(3);
    expect(warnings).toHaveLength(3);
  });

  it('carries no id: lines — a reconnect re-snapshots instead of replaying', async () => {
    const { writer, bus, session } = makeSession();
    await session.start();
    bus.publish(progress());
    for (const frame of writer.frames) {
      expect(frame).not.toMatch(/^id: /m);
    }
    expect(session.stats.sent).toBeGreaterThan(0);
  });
});

describe('BroadcastSseSession — heartbeat and session poll', () => {
  it('heartbeats on the interval with the contract frame', async () => {
    const { writer, session } = makeSession({ heartbeatMs: 20_000 });
    await session.start();
    writer.frames.length = 0;

    vi.advanceTimersByTime(20_000);
    expect(writer.frames).toEqual([broadcastHeartbeatFrame()]);
    expect(BroadcastStreamEvent.safeParse(dataOf(writer.frames[0] ?? '')).success).toBe(true);

    session.close();
  });

  it('ends the stream when the session poll reports revocation', async () => {
    const { session, bus } = makeSession({
      sessionActive: async () => false,
      sessionPollMs: 30_000,
    });
    await session.start();

    await vi.advanceTimersByTimeAsync(30_000);
    expect(session.isClosed).toBe(true);
    expect(session.stats.closedReason).toBe('session');
    expect(bus.teardowns).toBe(1);
  });

  it('an unreachable session registry ends the stream rather than guessing', async () => {
    const { session } = makeSession({
      sessionActive: async () => {
        throw new Error('registry down');
      },
      sessionPollMs: 30_000,
    });
    await session.start();

    await vi.advanceTimersByTimeAsync(30_000);
    expect(session.stats.closedReason).toBe('error');
  });
});

describe('BroadcastSseSession — lifecycle', () => {
  it('drops a slow reader instead of buffering for it', async () => {
    const slow = collectingWriter();
    // The socket starts healthy, subscribes, and THEN falls behind: the drop
    // must release the subscriber it already holds.
    let pending = 0;
    delete (slow as { bufferSize?: number }).bufferSize;
    Object.defineProperty(slow, 'bufferSize', { get: () => pending, configurable: true });
    const bus = fakeBus();
    const { session } = makeSession({ writer: slow, bus, maxBufferBytes: 100 });
    await session.start();
    expect(session.isClosed).toBe(false);

    pending = 101;
    bus.publish(progress());
    expect(session.isClosed).toBe(true);
    expect(session.stats.droppedForBackpressure).toBe(true);
    expect(session.stats.closedReason).toBe('backpressure');
    expect(bus.teardowns).toBe(1);
  });

  it('closes exactly once and releases the subscriber', async () => {
    const { session, bus } = makeSession();
    await session.start();

    session.close('client');
    session.close('client');
    expect(bus.teardowns).toBe(1);
    expect(session.stats.closedReason).toBe('client');
  });

  it('a close while subscribing still releases the connection', async () => {
    const bus = fakeBus();
    let releaseSubscribe: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      releaseSubscribe = resolve;
    });
    const session = new BroadcastSseSession({
      advisoryId: ADVISORY_ID,
      writer: collectingWriter(),
      snapshot: async () => [],
      subscribe: async (onMessage) => {
        await gate;
        return bus.subscribe(onMessage);
      },
    });

    const startPromise = session.start();
    // Let the session reach the subscribe await, then close mid-flight.
    await vi.advanceTimersByTimeAsync(0);
    session.close('client');
    releaseSubscribe();
    await startPromise;

    expect(bus.teardowns).toBe(1);
  });
});

describe('frame builders', () => {
  it('snapshotFrame and progressFrame produce contract-valid data', () => {
    expect(BroadcastStreamEvent.safeParse(dataOf(snapshotFrame([record()]))).success).toBe(true);
    const event = BroadcastProgressEvent.parse(progress());
    const parsed = BroadcastStreamEvent.safeParse(dataOf(progressFrame(event)));
    expect(parsed.success).toBe(true);
    expect(progressFrame(event)).toMatch(/^event: progress\n/);
  });
});

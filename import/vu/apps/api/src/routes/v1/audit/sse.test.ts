import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChainStatus } from '@vunvault/contracts';
import type { AuditEntryView } from '../../../audit/service.js';
import {
  collectingWriter,
  HEARTBEAT_INTERVAL_MS,
  MAX_BUFFER_BYTES,
  MAX_STREAMS_PER_USER,
  parseLastEventId,
  REPLAY_LIMIT,
  SESSION_POLL_INTERVAL_MS,
  SseSession,
  SSE_HEADERS,
  SSE_RETRY_MS,
  StreamRegistry,
  chainFrame,
  entryFrame,
  heartbeatFrame,
  retryFrame,
  sseFrame,
  type SseWriter,
} from './sse.js';

/**
 * The live audit tail.
 *
 * Timers are fake, the socket is a collector and Redis is a callback, so the
 * assertions are about the frames a browser would actually receive and about what
 * is released when it goes away.
 */

const CHAIN: ChainStatus = {
  state: 'intact',
  totalEntries: 4211,
  genesisDate: '2024-03-01',
  lastVerifiedAt: '2026-10-06T12:00:00.000Z',
  hashMismatches: 0,
  headHash: '0x9f2c1a4b7e8d3c60',
  node: 'node-nbo-01 · NBO-CORE',
  encryption: 'AES-256-GCM',
};

function entry(seq: number, overrides: Partial<AuditEntryView> = {}): AuditEntryView {
  return {
    seq,
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    category: 'authentication',
    eventType: 'AUTH_SUCCESS',
    severity: 'ok',
    sevLevel: null,
    actorLabel: 'e.reed',
    message: `e.reed@vunvault.com signed in from 41.90.32.10`,
    ip: '41.90.32.10',
    subject: 'e.reed@vunvault.com',
    hash: 'a'.repeat(64),
    prevHash: 'b'.repeat(64),
    createdAt: '2026-10-06T12:00:00.000Z',
    ...overrides,
  };
}

interface FakeStream {
  published: Array<(payload: string) => void>;
  teardowns: number;
  subscribe: (onMessage: (payload: string) => void) => Promise<() => Promise<void>>;
  publish: (view: AuditEntryView) => void;
}

function fakeStream(): FakeStream {
  const published: Array<(payload: string) => void> = [];
  const state = {
    teardowns: 0,
    published,
    async subscribe(onMessage: (payload: string) => void) {
      published.push(onMessage);
      return async () => {
        state.teardowns += 1;
      };
    },
    publish(view: AuditEntryView) {
      for (const listener of published) listener(JSON.stringify(view));
    },
  };
  return state;
}

function session(overrides: {
  writer?: SseWriter & { frames: string[] };
  stream?: FakeStream;
  replayed?: AuditEntryView[];
  sessionActive?: () => Promise<boolean>;
  maxBufferBytes?: number;
}) {
  const writer = overrides.writer ?? collectingWriter();
  const stream = overrides.stream ?? fakeStream();
  const replayed = overrides.replayed ?? [];
  const replayCalls: Array<{ afterSeq: number; limit: number }> = [];

  const session = new SseSession({
    writer,
    chain: async () => CHAIN,
    replay: async (afterSeq, limit) => {
      replayCalls.push({ afterSeq, limit });
      return replayed;
    },
    subscribe: stream.subscribe,
    sessionActive: overrides.sessionActive,
    maxBufferBytes: overrides.maxBufferBytes,
  });

  return { session, writer, stream, replayCalls };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ------------------------------------------------------------------- frames

describe('the wire format', () => {
  it('writes a frame per event, with an id only where one exists', () => {
    expect(retryFrame()).toBe(`retry: ${SSE_RETRY_MS}\n\n`);
    expect(heartbeatFrame()).toBe('event: heartbeat\ndata: {}\n\n');
    expect(chainFrame(CHAIN)).toBe(
      `event: chain\ndata: ${JSON.stringify({ type: 'chain', chain: CHAIN })}\n\n`,
    );
    expect(entryFrame(entry(7))).toContain('event: entry');
    expect(entryFrame(entry(7))).toContain('id: 7');
    expect(sseFrame('entry', { a: 1 }, 3)).toBe(`event: entry\nid: 3\ndata: {"a":1}\n\n`);
  });

  it('sets the headers that keep proxies out of the way', () => {
    expect(SSE_HEADERS).toEqual({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
  });

  it('reads Last-Event-ID and ignores anything that is not a positive integer', () => {
    expect(parseLastEventId('4211')).toBe(4211);
    expect(parseLastEventId(['4211', '1'])).toBe(4211);
    expect(parseLastEventId(' 42 ')).toBe(42);
    expect(parseLastEventId(undefined)).toBeNull();
    expect(parseLastEventId('')).toBeNull();
    expect(parseLastEventId('abc')).toBeNull();
    expect(parseLastEventId('-3')).toBeNull();
  });
});

// -------------------------------------------------------------- the session

describe('SseSession', () => {
  it('opens with a retry hint and the chain status', async () => {
    const { session: stream, writer } = session({});
    await stream.start(null);

    expect(writer.frames[0]).toBe(retryFrame());
    expect(writer.frames[1]).toBe(chainFrame(CHAIN));
    expect(writer.ended).toBe(false);
    stream.close();
  });

  it('delivers a published entry with its seq as the event id', async () => {
    const fake = fakeStream();
    const { session: stream, writer } = session({ stream: fake });
    await stream.start(null);

    fake.publish(entry(4212));
    const frame = writer.frames.at(-1) ?? '';
    expect(frame).toContain('event: entry');
    expect(frame).toContain('id: 4212');
    expect(frame).toContain('"eventType":"AUTH_SUCCESS"');
    expect(frame.endsWith('\n\n')).toBe(true);
    stream.close();
  });

  it('drops an unparsable payload instead of closing the stream', async () => {
    const fake = fakeStream();
    const { session: stream, writer } = session({ stream: fake });
    await stream.start(null);
    const before = writer.frames.length;
    for (const listener of fake.published) listener('not json');
    expect(writer.frames).toHaveLength(before);
    expect(stream.isClosed).toBe(false);
    stream.close();
  });

  it('sends a heartbeat every twenty seconds', async () => {
    expect(HEARTBEAT_INTERVAL_MS).toBe(20_000);
    const { session: stream, writer } = session({});
    await stream.start(null);
    const opened = writer.frames.length;

    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS - 1);
    expect(writer.frames).toHaveLength(opened);

    await vi.advanceTimersByTimeAsync(1);
    expect(writer.frames.at(-1)).toBe(heartbeatFrame());

    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
    expect(writer.frames.filter((frame) => frame === heartbeatFrame())).toHaveLength(2);
    stream.close();
  });

  it('replays what a reconnecting client missed, then goes live', async () => {
    expect(REPLAY_LIMIT).toBe(200);
    const fake = fakeStream();
    const {
      session: stream,
      writer,
      replayCalls,
    } = session({
      stream: fake,
      replayed: [entry(4210), entry(4211)],
    });
    await stream.start(4209);

    expect(replayCalls).toEqual([{ afterSeq: 4209, limit: REPLAY_LIMIT }]);
    expect(writer.frames[2]).toBe(entryFrame(entry(4210)));
    expect(writer.frames[3]).toBe(entryFrame(entry(4211)));

    // And the live stream continues from there.
    fake.publish(entry(4212));
    expect(writer.frames.at(-1)).toBe(entryFrame(entry(4212)));
    stream.close();
  });

  it('does not replay when the client sent no Last-Event-ID', async () => {
    const { session: stream, replayCalls } = session({});
    await stream.start(null);
    expect(replayCalls).toEqual([]);
    stream.close();
  });

  it('releases the subscriber and the socket on close, exactly once', async () => {
    const fake = fakeStream();
    const writer = collectingWriter();
    const { session: stream } = session({ stream: fake, writer });
    await stream.start(null);

    stream.close('client');
    stream.close('client');
    await vi.advanceTimersByTimeAsync(0);

    expect(fake.teardowns).toBe(1);
    expect(writer.ended).toBe(true);
    expect(stream.isClosed).toBe(true);
    expect(stream.stats.closedReason).toBe('client');
  });

  it('stops writing after close', async () => {
    const fake = fakeStream();
    const { session: stream, writer } = session({ stream: fake });
    await stream.start(null);
    const before = writer.frames.length;
    stream.close();
    fake.publish(entry(4213));
    expect(writer.frames).toHaveLength(before);
  });

  it('drops a client that is not reading', async () => {
    expect(MAX_BUFFER_BYTES).toBe(1_048_576);
    const fake = fakeStream();
    /** A socket that accepts everything and flushes nothing. */
    interface SlowWriter extends SseWriter {
      frames: string[];
      bufferSize: number;
      ended: boolean;
    }
    const slow: SlowWriter = {
      frames: [],
      bufferSize: 0,
      ended: false,
      write(chunk: string): boolean {
        slow.frames.push(chunk);
        return true;
      },
      end(): void {
        slow.ended = true;
      },
    };
    const { session: stream } = session({ stream: fake, writer: slow });
    await stream.start(null);
    expect(slow.ended).toBe(false);

    // The client stops reading; the next frame finds a full buffer.
    slow.bufferSize = MAX_BUFFER_BYTES + 1;
    fake.publish(entry(4212));
    expect(stream.isClosed).toBe(true);
    expect(stream.stats.droppedForBackpressure).toBe(true);
    expect(stream.stats.closedReason).toBe('backpressure');
    expect(slow.ended).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    // The subscriber is released even though the client, not the server, misbehaved.
    expect(fake.teardowns).toBe(1);
    expect(slow.frames.filter((frame) => frame.includes('id: 4212'))).toHaveLength(0);
  });

  it('ends the stream when the session behind it is revoked', async () => {
    expect(SESSION_POLL_INTERVAL_MS).toBe(30_000);
    const fake = fakeStream();
    let active = true;
    const { session: stream } = session({
      stream: fake,
      sessionActive: async () => active,
    });
    await stream.start(null);

    await vi.advanceTimersByTimeAsync(SESSION_POLL_INTERVAL_MS);
    expect(stream.isClosed).toBe(false);

    active = false;
    await vi.advanceTimersByTimeAsync(SESSION_POLL_INTERVAL_MS);
    expect(stream.isClosed).toBe(true);
    expect(stream.stats.closedReason).toBe('session');
    await vi.advanceTimersByTimeAsync(0);
    expect(fake.teardowns).toBe(1);
  });

  it('survives a chain lookup that fails at connect time', async () => {
    const writer = collectingWriter();
    const stream = fakeStream();
    const sessionUnderTest = new SseSession({
      writer,
      chain: async () => {
        throw new Error('database down');
      },
      replay: async () => [],
      subscribe: stream.subscribe,
    });
    await sessionUnderTest.start(null);
    // The retry hint went out, the chain frame did not, and the stream is live.
    expect(writer.frames).toEqual([retryFrame()]);
    expect(sessionUnderTest.isClosed).toBe(false);
    sessionUnderTest.close();
  });
});

// ------------------------------------------------------- the per-user limit

describe('StreamRegistry', () => {
  it('allows five streams per user and refuses the sixth', () => {
    expect(MAX_STREAMS_PER_USER).toBe(5);
    const registry = new StreamRegistry();
    for (let stream = 1; stream <= MAX_STREAMS_PER_USER; stream += 1) {
      expect(registry.reserve('user-1'), `stream ${stream}`).toBe(true);
    }
    expect(registry.reserve('user-1')).toBe(false);
    expect(registry.count('user-1')).toBe(5);

    // Another user is unaffected: the cap is per person.
    expect(registry.reserve('user-2')).toBe(true);
    expect(registry.total).toBe(6);

    registry.release('user-1');
    expect(registry.reserve('user-1')).toBe(true);
    for (let stream = 0; stream < 5; stream += 1) registry.release('user-1');
    registry.release('user-1');
    expect(registry.count('user-1')).toBe(0);
  });
});

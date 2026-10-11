import type { AuditStreamEvent, ChainStatus } from '@vunvault/contracts';
import type { AuditEntryView } from '../../../audit/service';

/**
 * Server-Sent Events for the live audit tail (Task 39).
 *
 * SSE and not WebSockets: the stream is one-way, it is plain HTTP so every proxy
 * and WAF in front of the API already handles it, and it reconnects on its own —
 * which matters, because the thing being watched is the security log.
 *
 * Three rules shape this module.
 *
 *  1. `Last-Event-ID` is honoured. Every frame carries `id: <seq>`, so a client
 *     that was disconnected for a minute replays what it missed (up to
 *     `REPLAY_LIMIT` entries) before going live. A security console with a silent
 *     gap in it is worse than no console.
 *  2. A slow reader is dropped, not buffered. If more than `MAX_BUFFER_BYTES` is
 *     waiting to be written, the connection is closed: holding entries in memory
 *     for a client that is not reading them is how an API runs out of memory.
 *  3. Everything is cleaned up. The dedicated Redis subscriber, the heartbeat
 *     timer and the session poll are all released on close, abort or error —
 *     a leaked subscriber connection is a leaked file descriptor per browser tab.
 */

export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  // Tells nginx (and Cloudflare) not to buffer a stream it cannot understand.
  'X-Accel-Buffering': 'no',
} as const;

/** How long a browser waits before reconnecting on its own. */
export const SSE_RETRY_MS = 5_000;
/** A heartbeat every twenty seconds keeps intermediaries from closing an idle stream. */
export const HEARTBEAT_INTERVAL_MS = 20_000;
/** How often the stream re-checks that the session behind it is still valid. */
export const SESSION_POLL_INTERVAL_MS = 30_000;
/** More than this much unwritten data means the client is not keeping up. */
export const MAX_BUFFER_BYTES = 1_048_576;
/** Entries replayed for a `Last-Event-ID` reconnect. */
export const REPLAY_LIMIT = 200;
/** Concurrent streams one user may hold. */
export const MAX_STREAMS_PER_USER = 5;

export type SseEventName = AuditStreamEvent['type'];

/** One SSE frame. `data` is JSON on a single line, as the format requires. */
export function sseFrame(event: SseEventName, data: unknown, id?: number): string {
  const lines = [`event: ${event}`];
  if (id !== undefined) lines.push(`id: ${id}`);
  lines.push(`data: ${JSON.stringify(data)}`);
  return `${lines.join('\n')}\n\n`;
}

export function retryFrame(milliseconds: number = SSE_RETRY_MS): string {
  return `retry: ${milliseconds}\n\n`;
}

/** The heartbeat carries an empty object: its purpose is to keep the pipe open. */
export function heartbeatFrame(): string {
  return sseFrame('heartbeat', {});
}

export function chainFrame(chain: ChainStatus): string {
  return sseFrame('chain', { type: 'chain', chain });
}

export function entryFrame(entry: AuditEntryView): string {
  return sseFrame('entry', { type: 'entry', entry }, entry.seq);
}

/** The narrow socket surface this module needs; `reply.raw` satisfies it. */
export interface SseWriter {
  write(chunk: string): boolean;
  /** Bytes accepted but not yet flushed. */
  readonly bufferSize: number;
  end(): void;
  readonly ended: boolean;
}

export interface SseSessionDeps {
  writer: SseWriter;
  chain: () => Promise<ChainStatus>;
  replay: (afterSeq: number, limit: number) => Promise<AuditEntryView[]>;
  /** Subscribes to `audit:stream`; resolves to a teardown that unsubscribes and quits. */
  subscribe: (onMessage: (payload: string) => void) => Promise<() => Promise<void>>;
  /** False ends the stream: a revoked session stops seeing the log. */
  sessionActive?: () => Promise<boolean>;
  heartbeatMs?: number;
  sessionPollMs?: number;
  maxBufferBytes?: number;
  replayLimit?: number;
  log?: { warn: (message: string, error?: unknown) => void };
}

export interface SseSessionStats {
  sent: number;
  replayed: number;
  droppedForBackpressure: boolean;
  closedReason: 'client' | 'backpressure' | 'session' | 'error' | null;
}

/**
 * One connected client. `start()` resolves immediately after the initial frames and
 * the subscription are in place; the stream then lives until `close()` or a drop.
 */
export class SseSession {
  private readonly deps: SseSessionDeps;
  private readonly heartbeatMs: number;
  private readonly sessionPollMs: number;
  private readonly maxBufferBytes: number;
  private readonly replayLimit: number;
  private readonly warn: (message: string, error?: unknown) => void;

  private teardown: (() => Promise<void>) | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private sessionPoll: ReturnType<typeof setInterval> | null = null;
  private closed = false;

  readonly stats: SseSessionStats = {
    sent: 0,
    replayed: 0,
    droppedForBackpressure: false,
    closedReason: null,
  };

  constructor(deps: SseSessionDeps) {
    this.deps = deps;
    this.heartbeatMs = deps.heartbeatMs ?? HEARTBEAT_INTERVAL_MS;
    this.sessionPollMs = deps.sessionPollMs ?? SESSION_POLL_INTERVAL_MS;
    this.maxBufferBytes = deps.maxBufferBytes ?? MAX_BUFFER_BYTES;
    this.replayLimit = deps.replayLimit ?? REPLAY_LIMIT;
    this.warn = deps.log?.warn.bind(deps.log) ?? ((): undefined => undefined);
  }

  get isClosed(): boolean {
    return this.closed;
  }

  /**
   * Send the opening frames, catch the client up, then go live.
   *
   * Every stage re-checks `closed` first: a client can be dropped for
   * backpressure while an `await` is in flight, and continuing would subscribe a
   * Redis connection nobody is going to release.
   */
  async start(lastEventId: number | null): Promise<void> {
    this.write(retryFrame());
    if (this.closed) return;

    try {
      this.write(chainFrame(await this.deps.chain()));
    } catch (error) {
      // A client that cannot be told the chain state should not be told nothing.
      this.warn('could not send the initial chain status', error);
    }
    if (this.closed) return;

    if (lastEventId !== null && Number.isFinite(lastEventId)) {
      try {
        const missed = await this.deps.replay(lastEventId, this.replayLimit);
        for (const entry of missed) {
          if (!this.write(entryFrame(entry))) return;
          this.stats.replayed += 1;
        }
      } catch (error) {
        this.warn('could not replay missed audit entries', error);
      }
    }
    if (this.closed) return;

    try {
      this.teardown = await this.deps.subscribe((payload) => this.onMessage(payload));
    } catch (error) {
      this.warn('could not subscribe to the audit stream', error);
      this.close('error');
      return;
    }
    if (this.closed) {
      // Dropped while subscribing: release what was just acquired.
      const teardown = this.teardown;
      this.teardown = null;
      if (teardown !== null) await teardown().catch(() => undefined);
      return;
    }

    this.heartbeat = setInterval(() => {
      this.write(heartbeatFrame());
    }, this.heartbeatMs);

    if (this.deps.sessionActive !== undefined) {
      this.sessionPoll = setInterval(() => {
        void this.checkSession();
      }, this.sessionPollMs);
    }
  }

  private async checkSession(): Promise<void> {
    const active = this.deps.sessionActive;
    if (active === undefined) return;
    try {
      if (!(await active())) this.close('session');
    } catch (error) {
      // An unreachable session registry is not a reason to keep streaming.
      this.warn('could not re-check the session; ending the stream', error);
      this.close('error');
    }
  }

  private onMessage(payload: string): void {
    let entry: AuditEntryView;
    try {
      entry = JSON.parse(payload) as AuditEntryView;
    } catch {
      this.warn('dropping an unparsable audit stream payload');
      return;
    }
    if (typeof entry.seq !== 'number') return;
    this.write(entryFrame(entry));
  }

  /** False when the write did not happen, because the client is too slow. */
  private write(frame: string): boolean {
    if (this.closed) return false;
    if (this.deps.writer.bufferSize > this.maxBufferBytes) {
      this.stats.droppedForBackpressure = true;
      this.close('backpressure');
      return false;
    }
    this.deps.writer.write(frame);
    this.stats.sent += 1;
    return true;
  }

  /** Release the subscriber, both timers and the socket, exactly once. */
  close(reason: SseSessionStats['closedReason'] = 'client'): void {
    if (this.closed) return;
    this.closed = true;
    this.stats.closedReason = reason;

    if (this.heartbeat !== null) clearInterval(this.heartbeat);
    if (this.sessionPoll !== null) clearInterval(this.sessionPoll);
    this.heartbeat = null;
    this.sessionPoll = null;

    const teardown = this.teardown;
    this.teardown = null;
    if (teardown !== null) {
      teardown().catch((error: unknown) =>
        this.warn('could not release the audit subscriber', error),
      );
    }
    if (!this.deps.writer.ended) this.deps.writer.end();
  }
}

/** `Last-Event-ID: 4211` → `4211`; anything else is "start from now". */
export function parseLastEventId(header: string | string[] | undefined): number | null {
  const raw = Array.isArray(header) ? header[0] : header;
  if (raw === undefined || raw.trim() === '') return null;
  const value = Number(raw.trim());
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

/**
 * How many live streams each user holds.
 *
 * The cap is per person, not global: five administrators watching the log at once
 * is normal, and one browser that reconnects in a loop must not be able to take
 * the stream away from everybody else.
 */
export class StreamRegistry {
  private readonly open = new Map<string, number>();

  constructor(private readonly limit: number = MAX_STREAMS_PER_USER) {}

  /** False when the caller already holds the maximum. */
  reserve(userId: string): boolean {
    const current = this.open.get(userId) ?? 0;
    if (current >= this.limit) return false;
    this.open.set(userId, current + 1);
    return true;
  }

  release(userId: string): void {
    const current = this.open.get(userId) ?? 0;
    if (current <= 1) this.open.delete(userId);
    else this.open.set(userId, current - 1);
  }

  count(userId: string): number {
    return this.open.get(userId) ?? 0;
  }

  get total(): number {
    return [...this.open.values()].reduce((sum, count) => sum + count, 0);
  }
}

/** A writer that collects frames in memory: tests, and nothing else. */
export function collectingWriter(): SseWriter & { frames: string[] } {
  const frames: string[] = [];
  let ended = false;
  return {
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
}

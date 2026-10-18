import type { BroadcastRecord } from '@vunvault/contracts';
import { BroadcastProgressEvent, type BroadcastStreamEvent } from '@vunvault/contracts';
import {
  HEARTBEAT_INTERVAL_MS,
  MAX_BUFFER_BYTES,
  SESSION_POLL_INTERVAL_MS,
  retryFrame,
  SSE_HEADERS,
  type SseWriter,
} from '../audit/sse.js';

/**
 * Broadcast delivery progress relay (Task 94).
 *
 * The broadcast worker publishes `BroadcastProgressEvent` frames to the Redis
 * Pub/Sub channel `broadcast:progress:<broadcastId>` (Task 89). This session
 * turns that channel into an SSE stream for ONE advisory, so the Zero-Day desk
 * watching a SEV-1 go out sees real counters instead of a 3 s poll.
 *
 * It is deliberately a sibling of the audit `SseSession`, not a generalisation
 * of it: the audit stream is a replayable LOG (`Last-Event-ID`, entry ids), and
 * this one is idempotent STATE — a reconnect re-snapshots from the database
 * rather than replaying frames, so nothing here carries `id:` lines. The shared
 * pieces (headers, framing, backpressure, timers) are imported from the audit
 * module, which stays untouched.
 *
 * The same three lifecycle rules apply: a slow reader is dropped rather than
 * buffered, everything is released exactly once on close/abort/error, and no
 * frame leaves the relay that has not been parsed by the contract.
 */

export { SSE_HEADERS };

/**
 * One SSE frame — the audit module's `sseFrame` shape, retyped for THIS
 * stream's event names (the audit one is bound to `AuditStreamEvent`, and
 * widening it would touch a file this task must not modify).
 */
function frame(event: BroadcastStreamEvent['type'], data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** The relay's wire frames — `BroadcastStreamEvent` members, one per event name. */
export function snapshotFrame(records: readonly BroadcastRecord[]): string {
  return frame('snapshot', { type: 'snapshot', records });
}

export function progressFrame(event: BroadcastProgressEvent): string {
  return frame('progress', event);
}

/** The heartbeat is a contract member here: `{ type: 'heartbeat' }`. */
export function broadcastHeartbeatFrame(): string {
  return frame('heartbeat', { type: 'heartbeat' });
}

export interface BroadcastSseDeps {
  /** Frames for any OTHER advisory are dropped — one relay, one advisory. */
  advisoryId: string;
  writer: SseWriter;
  /** The current `BroadcastRecord[]`, sent once on connect. */
  snapshot: () => Promise<BroadcastRecord[]>;
  /** Subscribes to the progress channel(s); resolves to a teardown. */
  subscribe: (onMessage: (payload: string) => void) => Promise<() => Promise<void>>;
  /** False ends the stream: a revoked session stops watching deliveries. */
  sessionActive?: () => Promise<boolean>;
  heartbeatMs?: number;
  sessionPollMs?: number;
  maxBufferBytes?: number;
  log?: { warn: (message: string, error?: unknown) => void };
}

export interface BroadcastSseStats {
  sent: number;
  forwarded: number;
  droppedUnparsable: number;
  droppedOtherAdvisory: number;
  droppedForBackpressure: boolean;
  closedReason: 'client' | 'backpressure' | 'session' | 'error' | null;
}

export class BroadcastSseSession {
  private readonly deps: BroadcastSseDeps;
  private readonly heartbeatMs: number;
  private readonly sessionPollMs: number;
  private readonly maxBufferBytes: number;
  private readonly warn: (message: string, error?: unknown) => void;

  private teardown: (() => Promise<void>) | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private sessionPoll: ReturnType<typeof setInterval> | null = null;
  private closed = false;

  readonly stats: BroadcastSseStats = {
    sent: 0,
    forwarded: 0,
    droppedUnparsable: 0,
    droppedOtherAdvisory: 0,
    droppedForBackpressure: false,
    closedReason: null,
  };

  constructor(deps: BroadcastSseDeps) {
    this.deps = deps;
    this.heartbeatMs = deps.heartbeatMs ?? HEARTBEAT_INTERVAL_MS;
    this.sessionPollMs = deps.sessionPollMs ?? SESSION_POLL_INTERVAL_MS;
    this.maxBufferBytes = deps.maxBufferBytes ?? MAX_BUFFER_BYTES;
    this.warn = deps.log?.warn.bind(deps.log) ?? ((): undefined => undefined);
  }

  get isClosed(): boolean {
    return this.closed;
  }

  /**
   * Send the opening frames, then go live. Every stage re-checks `closed`
   * first: the socket can die while an `await` is in flight, and continuing
   * would subscribe a Redis connection nobody is going to release.
   */
  async start(): Promise<void> {
    this.write(retryFrame());
    if (this.closed) return;

    try {
      this.write(snapshotFrame(await this.deps.snapshot()));
    } catch (error) {
      // A desk that cannot be told the current state must still get the live
      // frames: the snapshot is a convenience, the stream is the product.
      this.warn('could not send the initial broadcast snapshot', error);
    }
    if (this.closed) return;

    try {
      this.teardown = await this.deps.subscribe((payload) => this.onMessage(payload));
    } catch (error) {
      this.warn('could not subscribe to the broadcast progress channel', error);
      this.close('error');
      return;
    }
    if (this.closed) {
      const teardown = this.teardown;
      this.teardown = null;
      if (teardown !== null) await teardown().catch(() => undefined);
      return;
    }

    this.heartbeat = setInterval(() => {
      this.write(broadcastHeartbeatFrame());
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
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      this.stats.droppedUnparsable += 1;
      this.warn('dropping an unparsable broadcast progress payload');
      return;
    }
    const result = BroadcastProgressEvent.safeParse(parsed);
    if (!result.success) {
      this.stats.droppedUnparsable += 1;
      this.warn('dropping a broadcast progress payload that failed the contract');
      return;
    }
    if (result.data.advisoryId !== this.deps.advisoryId) {
      // The relay psubscribes to the whole namespace and filters here: a
      // rebroadcast dispatched after connect gets a NEW broadcastId, and a
      // per-broadcast subscription would have missed it.
      this.stats.droppedOtherAdvisory += 1;
      return;
    }
    if (this.write(progressFrame(result.data))) this.stats.forwarded += 1;
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
  close(reason: BroadcastSseStats['closedReason'] = 'client'): void {
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
        this.warn('could not release the broadcast progress subscriber', error),
      );
    }
    if (!this.deps.writer.ended) this.deps.writer.end();
  }
}

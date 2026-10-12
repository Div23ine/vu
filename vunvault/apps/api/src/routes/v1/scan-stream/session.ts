import type {
  ScanControlType,
  ScanStreamFrame,
  ScanStreamMessage,
  ScanStreamStatus,
} from '@vunvault/contracts';
import {
  ScanClientMessage,
  ScanStreamMessage as ScanStreamMessageSchema,
} from '@vunvault/contracts';

/**
 * The per-socket scan stream session (Task 95).
 *
 * A pure state machine over injected ports — no Fastify, no ioredis, no `ws`
 * imports — so the whole protocol is testable with a fake socket and a fake
 * Redis. The route in `index.ts` owns the platform and hands it over here.
 *
 * The ordering rule is the one that matters: SUBSCRIBE FIRST, replay second.
 * A viewer who joins mid-scan must see a continuous tail; reading the buffer
 * before subscribing would lose every line the controller emitted in between,
 * and a security console with a silent gap in it is worse than no console.
 * Buffered live frames are then deduplicated against the replay's high-water
 * `seq` — lines carry one, so gaps and repeats are both detectable.
 *
 * The client→server direction is the security surface: raw input is parsed
 * with the `.strict()` `ScanClientMessage` (four types, no extra properties),
 * rate-limited, permission-checked and status-gated, and only the VALIDATED
 * object is ever published onward. Nothing a client sends is echoed back —
 * the `error` frames carry a fixed vocabulary of codes.
 */

/** The close-code table the spec pins. Reason strings go on the wire. */
export const CLOSE_CODES = {
  finished: { code: 1_000, reason: 'finished' },
  slowConsumer: { code: 1_013, reason: 'slow consumer' },
  invalid: { code: 4_400, reason: 'invalid' },
  sessionEnded: { code: 4_401, reason: 'session ended' },
  heartbeat: { code: 4_408, reason: 'heartbeat' },
  rate: { code: 4_429, reason: 'rate' },
} as const;

export const HEARTBEAT_INTERVAL_MS = 20_000;
export const PONG_TIMEOUT_MS = 45_000;
export const SESSION_POLL_INTERVAL_MS = 30_000;
export const MAX_BUFFERED_BYTES = 1_048_576;
export const MAX_INVALID_MESSAGES = 5;
export const MAX_MESSAGES_PER_SECOND = 5;
export const MAX_CONSECUTIVE_DROPS = 20;

/** The slice of a `ws` WebSocket the session drives; the route adapts it. */
export interface RelaySocket {
  send(payload: string): void;
  close(code: number, reason: string): void;
  ping(): void;
  /** Bytes accepted but not yet flushed — the backpressure gauge. */
  readonly bufferedAmount: number;
}

/**
 * The handshake's authorisation result. Defined HERE so this module stays
 * contracts-only: the Task 106 integration suite imports it from another app,
 * and a type import of `./service` would drag the whole Fastify graph along.
 */
export interface ScanStreamTarget {
  jobId: string;
  jobCode: string;
  /** The raw DB status — informational; the gate tracks the wire status. */
  dbStatus: string;
  status: ScanStreamStatus;
  terminal: boolean;
}

export interface ScanStreamSessionDeps {
  socket: RelaySocket;
  target: ScanStreamTarget;
  /** `?after=<seq>` — replay only lines newer than this. Null replays all. */
  after: number | null;
  /** `LRANGE scan:buf:<jobId> 0 -1` — raw payloads, oldest first. */
  replay: () => Promise<string[]>;
  /** Subscribes to `scan:out:<jobId>`; resolves to a teardown that quits. */
  subscribe: (onMessage: (payload: string) => void) => Promise<() => Promise<void>>;
  /** False ends the stream: a revoked session stops watching a scan. */
  sessionActive?: () => Promise<boolean>;
  control: {
    /** `scans:execute` on the actor's permission set. */
    canExecute: boolean;
    /** `admin` or `super_admin` — the only roles that may kill a node. */
    canKill: boolean;
    /** Publishes `{ type }` to `scan:ctl:<jobId>` and appends the audit entry. */
    send: (type: ScanControlType) => Promise<void>;
  };
  heartbeatMs?: number;
  pongTimeoutMs?: number;
  sessionPollMs?: number;
  maxBufferedBytes?: number;
  now?: () => number;
  log?: {
    warn: (message: string, error?: unknown) => void;
    error: (message: string, error?: unknown) => void;
  };
}

export interface ScanStreamSessionStats {
  sent: number;
  replayed: number;
  droppedUnparsable: number;
  droppedStale: number;
  invalidMessages: number;
  rateDropped: number;
  controlsSent: number;
  closedReason: string | null;
}

/** Serialize one outbound frame. Every call site passes a contract member. */
function framePayload(frame: ScanStreamFrame): string {
  return JSON.stringify(frame);
}

export class ScanStreamSession {
  private readonly deps: ScanStreamSessionDeps;
  private readonly heartbeatMs: number;
  private readonly pongTimeoutMs: number;
  private readonly sessionPollMs: number;
  private readonly maxBufferedBytes: number;
  private readonly now: () => number;
  private readonly warn: (message: string, error?: unknown) => void;
  private readonly error: (message: string, error?: unknown) => void;

  private teardown: (() => Promise<void>) | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private sessionPoll: ReturnType<typeof setInterval> | null = null;
  private closed = false;
  private live = false;
  /** Live frames parked while the replay read is in flight. */
  private pending: string[] = [];
  /** Highest line `seq` forwarded so far — the dedupe mark. */
  private highWaterSeq: number;
  private currentStatus: ScanStreamStatus;
  private lastPongAt: number;

  // Client-input budgets.
  private windowStart = 0;
  private windowCount = 0;
  private consecutiveDrops = 0;

  readonly stats: ScanStreamSessionStats = {
    sent: 0,
    replayed: 0,
    droppedUnparsable: 0,
    droppedStale: 0,
    invalidMessages: 0,
    rateDropped: 0,
    controlsSent: 0,
    closedReason: null,
  };

  constructor(deps: ScanStreamSessionDeps) {
    this.deps = deps;
    this.heartbeatMs = deps.heartbeatMs ?? HEARTBEAT_INTERVAL_MS;
    this.pongTimeoutMs = deps.pongTimeoutMs ?? PONG_TIMEOUT_MS;
    this.sessionPollMs = deps.sessionPollMs ?? SESSION_POLL_INTERVAL_MS;
    this.maxBufferedBytes = deps.maxBufferedBytes ?? MAX_BUFFERED_BYTES;
    this.now = deps.now ?? Date.now;
    this.warn = deps.log?.warn.bind(deps.log) ?? ((): undefined => undefined);
    this.error = deps.log?.error.bind(deps.log) ?? ((): undefined => undefined);
    this.highWaterSeq = deps.after ?? 0;
    this.currentStatus = deps.target.status;
    this.lastPongAt = this.now();
  }

  get isClosed(): boolean {
    return this.closed;
  }

  /** Run the handshake sequence: status → (subscribe) → replay → flush → live. */
  async start(): Promise<void> {
    // 1. The DB-derived status frame goes first: before any tail scrolls by,
    //    the viewer knows what state the job is actually in.
    this.sendFrame({ type: 'status', status: this.currentStatus });
    if (this.closed) return;

    if (this.deps.target.terminal) {
      // A finished job: replay what the buffer still holds (1 h TTL) and stay
      // open so the viewer can read it — but never subscribe, because there is
      // no live future to receive. An EMPTY buffer means there is nothing to
      // show at all: say `finished` and hang up.
      const buffered = await this.readReplay();
      if (this.closed) return;
      if (buffered.length === 0) {
        this.close(CLOSE_CODES.finished);
        return;
      }
      for (const payload of buffered) this.forwardReplayPayload(payload);
      this.startTimers();
      return;
    }

    // 2. Subscribe BEFORE reading the buffer: anything published mid-replay is
    //    parked in `pending` and flushed after, deduped by line seq.
    try {
      this.teardown = await this.deps.subscribe((payload) => this.onLivePayload(payload));
    } catch (subscribeError) {
      this.error('could not subscribe to the scan output channel', subscribeError);
      this.close({ code: 1_011, reason: 'relay unavailable' });
      return;
    }
    if (this.closed) {
      await this.releaseSubscriber();
      return;
    }

    const buffered = await this.readReplay();
    if (this.closed) {
      await this.releaseSubscriber();
      return;
    }
    for (const payload of buffered) this.forwardReplayPayload(payload);

    // 3. Flush what arrived while the replay read was in flight.
    const parked = this.pending;
    this.pending = [];
    for (const payload of parked) this.forwardLivePayload(payload);
    if (this.closed) return;

    this.live = true;
    this.startTimers();
  }

  private async readReplay(): Promise<string[]> {
    try {
      return await this.deps.replay();
    } catch (replayError) {
      // A viewer with no history is still served live; log and carry on.
      this.warn('could not read the scan replay buffer', replayError);
      return [];
    }
  }

  private startTimers(): void {
    this.heartbeat = setInterval(() => {
      if (this.closed) return;
      if (this.now() - this.lastPongAt > this.pongTimeoutMs) {
        this.close(CLOSE_CODES.heartbeat);
        return;
      }
      this.deps.socket.ping();
    }, this.heartbeatMs);

    if (this.deps.sessionActive !== undefined) {
      this.sessionPoll = setInterval(() => {
        void this.checkSession();
      }, this.sessionPollMs);
    }
  }

  private async checkSession(): Promise<void> {
    const active = this.deps.sessionActive;
    if (active === undefined || this.closed) return;
    try {
      if (!(await active())) this.close(CLOSE_CODES.sessionEnded);
    } catch (sessionError) {
      // An unreachable session registry is not a reason to keep streaming.
      this.warn('could not re-check the session; ending the stream', sessionError);
      this.close(CLOSE_CODES.sessionEnded);
    }
  }

  /** One frame from the replay buffer: filtered by `after`, then forwarded. */
  private forwardReplayPayload(payload: string): void {
    const message = this.parseStreamPayload(payload);
    if (message === null) return;
    // Only line/phase/status are ever IN the buffer (the controller's own
    // rule), but the relay re-checks rather than trusting the list.
    if (message.type === 'progress') {
      this.stats.droppedStale += 1;
      return;
    }
    if (message.type === 'line' && message.seq <= this.highWaterSeq) {
      this.stats.droppedStale += 1;
      return;
    }
    this.track(message);
    if (this.sendFrame(message)) this.stats.replayed += 1;
  }

  /** One frame from Pub/Sub: parked before the flush, forwarded after. */
  private onLivePayload(payload: string): void {
    if (this.closed) return;
    if (!this.live) {
      this.pending.push(payload);
      return;
    }
    this.forwardLivePayload(payload);
  }

  private forwardLivePayload(payload: string): void {
    const message = this.parseStreamPayload(payload);
    if (message === null) return;
    // Lines are deduped against everything already sent (the replay overlap);
    // a stale repeat would scroll the terminal backwards.
    if (message.type === 'line' && message.seq <= this.highWaterSeq) {
      this.stats.droppedStale += 1;
      return;
    }
    this.track(message);
    this.sendFrame(message);
  }

  private parseStreamPayload(payload: string): ScanStreamMessage | null {
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      this.stats.droppedUnparsable += 1;
      this.warn('dropping an unparsable scan stream payload');
      return null;
    }
    const result = ScanStreamMessageSchema.safeParse(parsed);
    if (!result.success) {
      this.stats.droppedUnparsable += 1;
      this.warn('dropping a scan stream payload that failed the contract');
      return null;
    }
    return result.data;
  }

  /** Status frames move the control gate; line frames move the dedupe mark. */
  private track(message: ScanStreamMessage): void {
    if (message.type === 'status') {
      this.currentStatus = message.status;
      return;
    }
    if (message.type === 'line' && message.seq > this.highWaterSeq) {
      this.highWaterSeq = message.seq;
    }
  }

  /**
   * One client frame. The route hands over the raw text; everything after this
   * point is budget, contract, permission, status — in that order.
   */
  onClientMessage(raw: string): void {
    if (this.closed) return;

    // Rate budget first: a flooding socket must not get free parsing.
    const now = this.now();
    if (now - this.windowStart >= 1_000) {
      this.windowStart = now;
      this.windowCount = 0;
    }
    this.windowCount += 1;
    if (this.windowCount > MAX_MESSAGES_PER_SECOND) {
      this.stats.rateDropped += 1;
      this.consecutiveDrops += 1;
      if (this.consecutiveDrops >= MAX_CONSECUTIVE_DROPS) this.close(CLOSE_CODES.rate);
      return;
    }
    this.consecutiveDrops = 0;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.rejectInvalid();
      return;
    }
    const message = ScanClientMessage.safeParse(parsed);
    if (!message.success) {
      this.rejectInvalid();
      return;
    }

    void this.handleControl(message.data.type);
  }

  private rejectInvalid(): void {
    this.stats.invalidMessages += 1;
    this.sendFrame({ type: 'error', code: 'invalid_message' });
    if (this.stats.invalidMessages >= MAX_INVALID_MESSAGES) this.close(CLOSE_CODES.invalid);
  }

  private async handleControl(type: ScanControlType): Promise<void> {
    if (!this.deps.control.canExecute) {
      this.sendFrame({ type: 'error', code: 'forbidden' });
      return;
    }
    if (type === 'kill' && !this.deps.control.canKill) {
      // Analysts may stop a scan; only administrators may destroy its node.
      this.sendFrame({ type: 'error', code: 'forbidden' });
      return;
    }
    if (this.currentStatus !== 'running') {
      this.sendFrame({ type: 'error', code: 'not_running' });
      return;
    }
    try {
      await this.deps.control.send(type);
    } catch (controlError) {
      // The audit entry rolls back with the transaction; nothing was published
      // and nothing is acked. The operator retries or reads the log.
      this.error('could not publish the scan control message', controlError);
      return;
    }
    this.stats.controlsSent += 1;
    this.sendFrame({ type: 'control_ack', control: type });
  }

  /** The browser answered a ping. */
  onPong(): void {
    this.lastPongAt = this.now();
  }

  /** Backpressure-checked write. False when the socket is gone or too slow. */
  private sendFrame(frame: ScanStreamFrame): boolean {
    if (this.closed) return false;
    if (this.deps.socket.bufferedAmount > this.maxBufferedBytes) {
      this.close(CLOSE_CODES.slowConsumer);
      return false;
    }
    this.deps.socket.send(framePayload(frame));
    this.stats.sent += 1;
    return true;
  }

  /** Release the subscriber exactly once. */
  private async releaseSubscriber(): Promise<void> {
    const teardown = this.teardown;
    this.teardown = null;
    if (teardown === null) return;
    try {
      await teardown();
    } catch (teardownError) {
      this.warn('could not release the scan stream subscriber', teardownError);
    }
  }

  /** Idempotent close: timers, subscriber, socket — in that order. */
  close(reason: { code: number; reason: string } = CLOSE_CODES.finished): void {
    if (this.closed) return;
    this.closed = true;
    this.stats.closedReason = reason.reason;

    if (this.heartbeat !== null) clearInterval(this.heartbeat);
    if (this.sessionPoll !== null) clearInterval(this.sessionPoll);
    this.heartbeat = null;
    this.sessionPoll = null;
    this.pending = [];

    void this.releaseSubscriber();
    this.deps.socket.close(reason.code, reason.reason);
  }

  /** The socket died underneath us (client tab closed, network drop). */
  onSocketClose(): void {
    if (this.closed) {
      // Timers are already down; make sure the subscriber is too.
      void this.releaseSubscriber();
      return;
    }
    this.closed = true;
    this.stats.closedReason = 'client';
    if (this.heartbeat !== null) clearInterval(this.heartbeat);
    if (this.sessionPoll !== null) clearInterval(this.sessionPoll);
    this.heartbeat = null;
    this.sessionPoll = null;
    this.pending = [];
    void this.releaseSubscriber();
  }
}

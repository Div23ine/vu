import { z } from 'zod';

/**
 * Scan terminal stream contract (Task 88).
 *
 * These two schemas are the wire format between the scan controller and the
 * browser, with the API's WebSocket relay (Layer L12) in the middle. They live
 * in `@vunvault/contracts` because three processes must agree on them: the
 * controller publishes `ScanStreamMessage`, the relay forwards it, and the relay
 * validates inbound `ScanClientMessage` before acting on it.
 *
 * The security property worth stating: **the client may send exactly four
 * message types** — `abort`, `pause`, `resume`, `kill` — and nothing else. The
 * schema is `.strict()`, so an extra property is a rejection rather than
 * something silently carried into the control channel. A browser that could
 * send `{ "type": "exec" }`, or `{ "type": "abort", "cmd": "…" }`, would have a
 * path onto the scan infrastructure; it does not.
 *
 * Nothing here carries a target, a credential or a pod name. The stream is
 * output and control, and the relay is the only thing that knows both sides.
 */

/** The terminal colour classes the controller assigns to each line. */
export const SCAN_LINE_KINDS = ['sys', 'muted', 'info', 'ok', 'warn', 'crit'] as const;
export type ScanLineKind = (typeof SCAN_LINE_KINDS)[number];

/** Job states the stream may report. */
export const SCAN_STREAM_STATUSES = ['running', 'completed', 'failed', 'cancelled'] as const;
export type ScanStreamStatus = (typeof SCAN_STREAM_STATUSES)[number];

/** A sanitised terminal line. `seq` is monotonic from 1 so gaps are detectable. */
export const ScanStreamLine = z
  .object({
    type: z.literal('line'),
    seq: z.number().int().positive(),
    ts: z.string().datetime(),
    kind: z.enum(SCAN_LINE_KINDS),
    /** Already sanitised and redacted by the controller; never raw tool output. */
    msg: z.string(),
  })
  .strict();
export type ScanStreamLine = z.infer<typeof ScanStreamLine>;

export const ScanStreamProgress = z
  .object({
    type: z.literal('progress'),
    /** 0–99 while running; `complete` is what moves a job to 100. */
    progress: z.number().int().min(0).max(99),
    etaSeconds: z.number().int().min(0).nullable(),
  })
  .strict();
export type ScanStreamProgress = z.infer<typeof ScanStreamProgress>;

export const ScanStreamPhase = z
  .object({
    type: z.literal('phase'),
    name: z.string().min(1).max(80),
  })
  .strict();
export type ScanStreamPhase = z.infer<typeof ScanStreamPhase>;

export const ScanStreamStatusMessage = z
  .object({
    type: z.literal('status'),
    status: z.enum(SCAN_STREAM_STATUSES),
    reason: z.string().max(300).optional(),
  })
  .strict();
export type ScanStreamStatusMessage = z.infer<typeof ScanStreamStatusMessage>;

/** Controller → relay → browser. */
export const ScanStreamMessage = z.discriminatedUnion('type', [
  ScanStreamLine,
  ScanStreamProgress,
  ScanStreamPhase,
  ScanStreamStatusMessage,
]);
export type ScanStreamMessage = z.infer<typeof ScanStreamMessage>;

/** The four control signals a client may send. Mirrors the controller's own. */
export const SCAN_CONTROL_TYPES = ['abort', 'pause', 'resume', 'kill'] as const;
export type ScanControlType = (typeof SCAN_CONTROL_TYPES)[number];

/**
 * Browser → relay → control channel.
 *
 * `.strict()` is the point: an unknown property is rejected, so no caller can
 * smuggle an extra field through the relay into the controller.
 */
export const ScanClientMessage = z
  .object({
    type: z.enum(SCAN_CONTROL_TYPES),
  })
  .strict();
export type ScanClientMessage = z.infer<typeof ScanClientMessage>;

/**
 * Relay → browser only (Task 95): the acknowledgement that a whitelisted
 * control message was published to the controller's channel. It is NOT a
 * controller message and is never replayed — an ack for a pause that happened
 * ten minutes ago would misdescribe the present.
 */
export const ScanStreamControlAck = z
  .object({
    type: z.literal('control_ack'),
    control: z.enum(SCAN_CONTROL_TYPES),
  })
  .strict();
export type ScanStreamControlAck = z.infer<typeof ScanStreamControlAck>;

/**
 * Relay → browser only (Task 95): why a client message was refused. The code is
 * a fixed vocabulary, never the echoed input — the relay repeats nothing a
 * client sent.
 */
export const SCAN_STREAM_ERROR_CODES = [
  'invalid_message',
  'forbidden',
  'not_running',
  'rate_limited',
] as const;
export type ScanStreamErrorCode = (typeof SCAN_STREAM_ERROR_CODES)[number];

export const ScanStreamError = z
  .object({
    type: z.literal('error'),
    code: z.enum(SCAN_STREAM_ERROR_CODES),
  })
  .strict();
export type ScanStreamError = z.infer<typeof ScanStreamError>;

/** Every frame a browser may receive on the scan stream. */
export const ScanStreamFrame = z.discriminatedUnion('type', [
  ScanStreamLine,
  ScanStreamProgress,
  ScanStreamPhase,
  ScanStreamStatusMessage,
  ScanStreamControlAck,
  ScanStreamError,
]);
export type ScanStreamFrame = z.infer<typeof ScanStreamFrame>;

/**
 * Only `line`, `phase` and `status` are replayed to a late joiner.
 *
 * A `progress` value is stale by definition — the job has moved on — so
 * replaying it would show a reconnecting viewer an old percentage until the next
 * update arrives.
 */
export const REPLAYED_STREAM_TYPES = ['line', 'phase', 'status'] as const;

/** Structural on purpose: relay-only frames (`control_ack`, `error`) are never replayed either. */
export function isReplayed(message: { type: string }): boolean {
  return (REPLAYED_STREAM_TYPES as readonly string[]).includes(message.type);
}

/** Replay buffer length and TTL — the relay and the controller must agree. */
export const SCAN_REPLAY_BUFFER_LENGTH = 2_000;
export const SCAN_REPLAY_TTL_SECONDS = 3_600;

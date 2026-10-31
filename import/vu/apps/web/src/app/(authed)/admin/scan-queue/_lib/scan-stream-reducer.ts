import type { ScanLineKind, ScanStreamFrame, ScanStreamStatus } from '@vunvault/contracts';

/**
 * The scan terminal's protocol reducer — pure, so the whole wire
 * behaviour is testable without a socket.
 *
 * Two invariants carry the security story of the feature. Lines are deduped by
 * `seq`, because a reconnect replays from `after=<lastSeq>` and the relay's own
 * high-water mark already drops repeats — a second line of defence that costs
 * one comparison. And nothing in here ever interprets a message body: `msg` is
 * stored as a string and rendered as a React text node, so a controller that
 * was somehow talked into emitting markup cannot reach the DOM.
 *
 * `control_ack` and `error` frames are deliberately NOT reducer input: they are
 * the relay talking to the operator, not scan output, and the hook turns them
 * into toasts.
 */

export interface ScanLine {
  seq: number;
  ts: string;
  kind: ScanLineKind;
  msg: string;
}

/** The chip's vocabulary — the wire's four plus the two socket-level states. */
export type TerminalStatus = ScanStreamStatus | 'connecting' | 'disconnected';

export interface StreamState {
  lines: ScanLine[];
  /** Highest line `seq` seen — the reconnect's `after`. */
  lastSeq: number;
  progress: number;
  etaSeconds: number | null;
  phase: string | null;
  status: TerminalStatus;
  /** A reconnect is scheduled: the chip reads `Reconnecting…`. */
  reconnecting: boolean;
  /** A terminal status or a close code that must not be retried. */
  ended: boolean;
  /** Session-ended / access-denied copy, or null. */
  notice: string | null;
  /** Consecutive failed connects — indexes the backoff schedule. */
  attempt: number;
}

export type StreamAction =
  | { type: 'reset' }
  | { type: 'connecting' }
  | { type: 'open' }
  | { type: 'message'; frame: ScanStreamFrame }
  | { type: 'close'; code: number }
  | { type: 'reconnecting' };

/** The terminal keeps the last 5 000 lines and drops the OLDEST beyond that. */
export const LINE_CAP = 5_000;

/** Reconnect backoff: 1 s → 30 s, clamped past the end of the schedule. */
export const BACKOFF_SCHEDULE_MS: readonly number[] = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000];

export function backoffDelayMs(attempt: number): number {
  const index = Math.min(Math.max(attempt, 0), BACKOFF_SCHEDULE_MS.length - 1);
  return BACKOFF_SCHEDULE_MS[index] ?? 30_000;
}

/** The copy under the log once a job has ended (verbatim, per the spec). */
export const ENDED_COPY: Readonly<Record<'completed' | 'cancelled' | 'failed', string>> = {
  completed: 'Scan finished. Results are awaiting the review gate.',
  cancelled: 'Scan cancelled.',
  failed: 'Scan did not complete.',
};

export const SESSION_ENDED_NOTICE = 'Your session ended — sign in again.';
export const ACCESS_DENIED_NOTICE = 'You do not have access to live scan output.';

/** Close codes that must NOT be retried, and what each means on screen. */
const FINAL_CLOSE_NOTICES: Readonly<Record<number, string | null>> = {
  1_000: null,
  4_401: SESSION_ENDED_NOTICE,
  4_403: ACCESS_DENIED_NOTICE,
};

export const initialStreamState: StreamState = {
  lines: [],
  lastSeq: 0,
  progress: 0,
  etaSeconds: null,
  phase: null,
  status: 'connecting',
  reconnecting: false,
  ended: false,
  notice: null,
  attempt: 0,
};

/** True once a `status` frame says the job will produce no more output. */
export function isTerminalStatus(status: ScanStreamStatus): boolean {
  return status === 'completed' || status === 'cancelled' || status === 'failed';
}

function withLine(state: StreamState, line: ScanLine): StreamState {
  // The relay already dedupes against its high-water mark; this is the second
  // line of defence, and it is what makes `after=<lastSeq>` reconnects safe.
  if (line.seq <= state.lastSeq) return state;
  const lines = [...state.lines, line];
  const overflow = lines.length - LINE_CAP;
  return {
    ...state,
    lines: overflow > 0 ? lines.slice(overflow) : lines,
    lastSeq: line.seq,
  };
}

function withMessage(state: StreamState, frame: ScanStreamFrame): StreamState {
  switch (frame.type) {
    case 'line':
      return withLine(state, {
        seq: frame.seq,
        ts: frame.ts,
        kind: frame.kind,
        msg: frame.msg,
      });
    case 'progress':
      return { ...state, progress: frame.progress, etaSeconds: frame.etaSeconds };
    case 'phase':
      return { ...state, phase: frame.name };
    case 'status': {
      const terminal = isTerminalStatus(frame.status);
      return {
        ...state,
        status: frame.status,
        // `complete` is what moves a job to 100: progress frames stop at 99.
        progress: frame.status === 'completed' ? 100 : state.progress,
        ended: terminal || state.ended,
        reconnecting: false,
        ...(frame.reason !== undefined && terminal ? { notice: null } : {}),
      };
    }
    // Relay-to-operator frames: the hook toasts them, the log ignores them.
    case 'control_ack':
    case 'error':
      return state;
  }
}

function withClose(state: StreamState, code: number): StreamState {
  if (code in FINAL_CLOSE_NOTICES) {
    const notice = FINAL_CLOSE_NOTICES[code];
    return {
      ...state,
      reconnecting: false,
      ended: true,
      status: state.status === 'connecting' ? 'disconnected' : state.status,
      ...(notice === null ? {} : { notice }),
    };
  }
  // 1006 (transport), 1013 (slow consumer), 4400/4408/4429 (budgets): the log
  // stays on screen and the hook retries with `after=<lastSeq>`.
  return { ...state, status: 'disconnected', reconnecting: true, attempt: state.attempt + 1 };
}

export function scanStreamReducer(state: StreamState, action: StreamAction): StreamState {
  switch (action.type) {
    case 'reset':
      // The dialog reopened (or on another job): a fresh terminal, and the
      // relay's own replay buffer supplies the history.
      return initialStreamState;
    case 'connecting':
      return { ...state, status: 'connecting', reconnecting: false };
    case 'open':
      // A successful open resets the backoff — the schedule punishes a streak,
      // not a long session.
      return { ...state, attempt: 0, reconnecting: false };
    case 'message':
      return withMessage(state, action.frame);
    case 'close':
      return withClose(state, action.code);
    case 'reconnecting':
      return { ...state, status: 'disconnected', reconnecting: true };
  }
}

/** The chip's verbatim label. */
export const TERMINAL_STATUS_LABELS: Readonly<Record<TerminalStatus, string>> = {
  connecting: 'Connecting',
  running: 'Running',
  completed: 'Completed',
  cancelled: 'Cancelled',
  failed: 'Failed',
  disconnected: 'Disconnected',
};

export function terminalChipLabel(state: StreamState): string {
  if (state.reconnecting) return 'Reconnecting…';
  return TERMINAL_STATUS_LABELS[state.status];
}

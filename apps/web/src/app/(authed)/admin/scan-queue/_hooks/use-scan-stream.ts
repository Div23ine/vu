import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { ScanControlType, ScanStreamFrame } from '@vunvault/contracts';
import { ScanClientMessage, ScanStreamFrame as ScanStreamFrameSchema } from '@vunvault/contracts';
import { env } from '../../../../../env';
import {
  backoffDelayMs,
  scanStreamReducer,
  initialStreamState,
  type StreamState,
} from '../_lib/scan-stream-reducer';

/**
 * The scan terminal's WebSocket client (Task 96), talking to the Task 95 relay.
 *
 * Three rules, all inherited from the relay's contract:
 *
 *  1. Cookies authenticate the handshake — the URL carries the job id and (on
 *     reconnect) `after=<lastSeq>`, and NEVER a token.
 *  2. Every inbound frame is parsed with `ScanStreamFrame` before the reducer
 *     sees it; an invalid frame is ignored, not thrown on.
 *  3. The outbound direction is `sendControl` and nothing else: the hook
 *     exposes no generic send, so no caller can put an un-whitelisted frame on
 *     the wire even by accident. The JSON is built from a value that has
 *     already passed `ScanClientMessage`.
 *
 * Reconnection is the client's job here (unlike the audit SSE, where the
 * browser's `EventSource` owns it): a raw `WebSocket` does not retry, so the
 * backoff schedule lives in the reducer's world and the timer lives here.
 *
 * No `'use client'` directive (the `use-login.ts` pattern).
 */

/** `https://api.x` → `wss://api.x` (and `http:` → `ws:`). */
export function wsBaseOf(apiUrl: string): string {
  const url = new URL(apiUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  // No trailing slash: callers append the path.
  return url.toString().replace(/\/$/, '');
}

export function scanStreamUrl(jobId: string, after: number): string {
  const base = `${wsBaseOf(env.NEXT_PUBLIC_API_URL)}/api/v1/scans/${jobId}/stream`;
  return after > 0 ? `${base}?after=${after}` : base;
}

/** The narrow `WebSocket` surface the hook uses — the test seam. */
export interface ScanSocket {
  send(payload: string): void;
  close(): void;
  readonly readyState: number;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code: number }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export type ScanSocketFactory = (url: string) => ScanSocket;

export interface UseScanStreamOptions {
  /** Test seam; defaults to the global `WebSocket`. */
  socketFactory?: ScanSocketFactory;
  /** Test seam for the backoff timers. */
  scheduleTimeout?: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearScheduled?: (handle: ReturnType<typeof setTimeout>) => void;
  /** Relay frames aimed at the operator (the hook does not toast by itself). */
  onControlAck?: (control: ScanControlType) => void;
  onStreamError?: (code: string) => void;
}

export interface UseScanStreamResult {
  state: StreamState;
  /** Sends exactly `{ type }` — validated on the way out as well as in. */
  sendControl(control: ScanControlType): boolean;
  /** Tears the socket down for good (the dialog closing). */
  stop(): void;
}

const SOCKET_OPEN = 1;

function defaultFactory(url: string): ScanSocket | null {
  if (typeof WebSocket === 'undefined') return null;
  return new WebSocket(url) as unknown as ScanSocket;
}

export function useScanStream(
  jobId: string | null,
  active: boolean,
  options: UseScanStreamOptions = {},
): UseScanStreamResult {
  const [state, dispatch] = useReducer(scanStreamReducer, initialStreamState);

  const socket = useRef<ScanSocket | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopped = useRef(false);
  /** The reconnect's `after` — a ref so the effect below never re-runs on it. */
  const lastSeq = useRef(0);
  lastSeq.current = state.lastSeq;
  const attempt = useRef(0);

  const optionsRef = useRef(options);
  optionsRef.current = options;
  const scheduleRef = useRef({
    schedule: options.scheduleTimeout ?? setTimeout,
    clear: options.clearScheduled ?? clearTimeout,
  });
  scheduleRef.current = {
    schedule: options.scheduleTimeout ?? setTimeout,
    clear: options.clearScheduled ?? clearTimeout,
  };

  const clearTimer = useCallback((): void => {
    if (timer.current !== null) {
      scheduleRef.current.clear(timer.current);
      timer.current = null;
    }
  }, []);

  const connect = useCallback((): void => {
    if (stopped.current || jobId === null) return;
    const factory = optionsRef.current.socketFactory;
    const url = scanStreamUrl(jobId, lastSeq.current);
    const next = factory !== undefined ? factory(url) : defaultFactory(url);
    if (next === null) {
      // No WebSocket in this environment: nothing to show, nothing to retry.
      dispatch({ type: 'close', code: 1_000 });
      return;
    }
    socket.current = next;
    dispatch({ type: 'connecting' });

    next.onopen = () => {
      attempt.current = 0;
      dispatch({ type: 'open' });
    };
    next.onmessage = (event) => {
      let data: unknown;
      try {
        data = JSON.parse(String(event.data));
      } catch {
        return;
      }
      const parsed = ScanStreamFrameSchema.safeParse(data);
      if (!parsed.success) return;
      const frame: ScanStreamFrame = parsed.data;
      if (frame.type === 'control_ack') {
        optionsRef.current.onControlAck?.(frame.control);
        return;
      }
      if (frame.type === 'error') {
        optionsRef.current.onStreamError?.(frame.code);
        return;
      }
      dispatch({ type: 'message', frame });
    };
    next.onclose = (event) => {
      socket.current = null;
      dispatch({ type: 'close', code: event.code });
    };
    next.onerror = () => {
      // `onclose` always follows `onerror`; the close carries the code.
    };
  }, [jobId]);

  // (Re)connect whenever the dialog opens on a job. The reducer decides whether
  // a close deserves a retry; this effect owns the timer that carries it out.
  useEffect(() => {
    stopped.current = false;
    if (!active || jobId === null) return;
    // A fresh terminal per activation: the relay replays the buffer, so the
    // history arrives over the wire rather than lingering from a previous job.
    lastSeq.current = 0;
    attempt.current = 0;
    dispatch({ type: 'reset' });
    connect();
    return () => {
      clearTimer();
      const current = socket.current;
      socket.current = null;
      if (current !== null) {
        current.onopen = null;
        current.onmessage = null;
        current.onclose = null;
        current.onerror = null;
        current.close();
      }
    };
  }, [active, jobId, connect, clearTimer]);

  // The retry timer: one pending reconnect at a time, cancelled on unmount.
  useEffect(() => {
    if (!active || !state.reconnecting || state.ended) return;
    clearTimer();
    timer.current = scheduleRef.current.schedule(() => {
      timer.current = null;
      attempt.current += 1;
      connect();
    }, backoffDelayMs(attempt.current));
    return clearTimer;
  }, [state.reconnecting, state.ended, active, state.attempt, connect, clearTimer]);

  const sendControl = useCallback((control: ScanControlType): boolean => {
    const current = socket.current;
    if (current === null || current.readyState !== SOCKET_OPEN) return false;
    // Parse on the way OUT as well: the whitelist holds even if a future
    // caller passes a string that merely looks like a verb.
    const message = ScanClientMessage.parse({ type: control });
    current.send(JSON.stringify(message));
    return true;
  }, []);

  const stop = useCallback((): void => {
    stopped.current = true;
    clearTimer();
    const current = socket.current;
    socket.current = null;
    if (current !== null) current.close();
  }, [clearTimer]);

  return { state, sendControl, stop };
}

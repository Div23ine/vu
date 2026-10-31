import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuditEntryView, ChainStatus } from '@vunvault/contracts';
import { AuditStreamEvent } from '@vunvault/contracts';
import { queryKeys } from '@vunvault/lib';
import { env } from '../../../../../env';

/**
 * The browser half of the live audit tail .
 *
 * The server side shipped in an earlier iteration: `GET /api/v1/admin/audit/stream` sends
 * `retry: 5000`, an initial `chain` frame, a `Last-Event-ID` replay of up to
 * 200 missed entries and then the live `entry` stream with a 20 s heartbeat.
 * This hook owns exactly one `EventSource`, parses every frame with the
 * `AuditStreamEvent` contract before anything renders, and exposes the small
 * surface the Audit Logs console needs: a status for the `LIVE` pill, the
 * entry delivery callback, a capped pause buffer and a resync.
 *
 * Three rules shape it.
 *
 * 1. Reconnection is the BROWSER's job. Every frame carries `id: <seq>`, so a
 *  native `EventSource` reconnect replays what was missed server-side. This
 *  hook therefore never builds its own retry loop — it only reports state.
 * 2. Cookies are the credential (`withCredentials: true`). No token ever
 *  travels in a header or a query string (the lib/api.ts rule).
 * 3. `offline` is an honest fallback, not an error: when `EventSource` does
 *  not exist (SSR, jsdom) or the browser gave up (a closed socket after a
 *  fatal response — a revoked session, for instance), the page falls back
 *  to the an earlier iteration poll. A security console that silently stops is worse
 *  than one that says POLLING.
 *
 * No `'use client'` directive (the `use-audit.ts` pattern).
 */

/** What the console chrome's pill renders: one label per state. */
export type AuditStreamStatus = 'connecting' | 'live' | 'reconnecting' | 'paused' | 'offline';

/** Entries a paused ticker buffers before it starts dropping the OLDEST. */
export const PAUSE_BUFFER_LIMIT = 200;

/** The slice of `EventSource` this hook uses — the test seam. */
export interface AuditEventSource {
  addEventListener(
    type: 'open' | 'error' | 'entry' | 'chain' | 'heartbeat',
    listener: (event: MessageEvent) => void,
  ): void;
  close(): void;
  readonly readyState: number;
}

export type AuditEventSourceFactory = (
  url: string,
  init: { withCredentials: boolean },
) => AuditEventSource;

/** `EventSource.CONNECTING` / `CLOSED` without depending on the global. */
const READY_STATE_CONNECTING = 0;
const READY_STATE_CLOSED = 2;

export const AUDIT_STREAM_PATH = '/api/v1/admin/audit/stream';

export interface UseAuditStreamOptions {
  /** False closes (and never opens) the socket — the page passes `can(user, 'audit:read')`. */
  enabled: boolean;
  /** Delivered for every entry that arrives while NOT paused, and for the whole buffer on resume. */
  onEntry(entry: AuditEntryView): void;
  /** Overrides `env.NEXT_PUBLIC_API_URL` (tests). */
  baseUrl?: string;
  /** Overrides the native `EventSource` (tests). Absent AND no global → `offline`. */
  eventSourceFactory?: AuditEventSourceFactory | null;
}

export interface UseAuditStreamResult {
  status: AuditStreamStatus;
  paused: boolean;
  /** Buffer depth while paused — the resume button's `<n> new` count. */
  bufferedCount: number;
  pause(): void;
  resume(): void;
  /** Closes and reopens the socket; the server replays from `Last-Event-ID`. */
  resync(): void;
}

interface LiveState {
  /** The connection truth, independent of the pause flag. */
  connection: 'connecting' | 'live' | 'reconnecting' | 'offline';
}

export function useAuditStream(options: UseAuditStreamOptions): UseAuditStreamResult {
  const { enabled, onEntry, baseUrl = env.NEXT_PUBLIC_API_URL } = options;
  const queryClient = useQueryClient();

  // Callbacks and the factory live in refs: the socket must not reopen because
  // a render produced a new function identity.
  const onEntryRef = useRef(onEntry);
  onEntryRef.current = onEntry;
  const factoryRef = useRef(options.eventSourceFactory);
  factoryRef.current = options.eventSourceFactory;

  const resolveFactory = useCallback((): AuditEventSourceFactory | null => {
    const explicit = factoryRef.current;
    if (explicit !== undefined) return explicit;
    if (typeof EventSource === 'undefined') return null;
    return (url, init) => new EventSource(url, init) as unknown as AuditEventSource;
  }, []);

  const [connection, setConnection] = useState<LiveState['connection']>(() => {
    if (!enabled) return 'offline';
    return resolveFactory() === null ? 'offline' : 'connecting';
  });
  const [paused, setPaused] = useState(false);
  const [bufferedCount, setBufferedCount] = useState(0);
  /** Bumped by `resync()` to retrigger the open effect. */
  const [generation, setGeneration] = useState(0);

  const buffer = useRef<AuditEntryView[]>([]);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const socket = useRef<AuditEventSource | null>(null);

  const deliver = useCallback((entry: AuditEntryView): void => {
    if (pausedRef.current) {
      buffer.current.push(entry);
      // Drop the OLDEST beyond the cap: the console shows the head of the
      // chain, and a reviewer who paused for an hour must not OOM the tab.
      if (buffer.current.length > PAUSE_BUFFER_LIMIT) {
        buffer.current.splice(0, buffer.current.length - PAUSE_BUFFER_LIMIT);
      }
      setBufferedCount(buffer.current.length);
      return;
    }
    onEntryRef.current(entry);
  }, []);

  const handleFrame = useCallback(
    (event: MessageEvent): void => {
      // Every payload is parsed with its contract schema before use — an
      // unparsable or wrong-shaped frame is dropped, never thrown on.
      let data: unknown;
      try {
        data = JSON.parse(String(event.data));
      } catch {
        return;
      }
      const parsed = AuditStreamEvent.safeParse(data);
      if (!parsed.success) return;
      const frame = parsed.data;
      if (frame.type === 'entry' && frame.entry !== undefined) {
        deliver(frame.entry);
        return;
      }
      if (frame.type === 'chain' && frame.chain !== undefined) {
        // One cache write moves the ChainPanel, the chain pill and every
        // `useChainStatus` consumer together.
        const chain: ChainStatus = frame.chain;
        queryClient.setQueryData(queryKeys.audit.chain(), chain);
      }
      // 'heartbeat' keeps the pipe warm; nothing to render.
    },
    [deliver, queryClient],
  );

  useEffect(() => {
    if (!enabled) {
      setConnection('offline');
      return;
    }
    const factory = resolveFactory();
    if (factory === null) {
      setConnection('offline');
      return;
    }

    let closed = false;
    const source = factory(`${baseUrl}${AUDIT_STREAM_PATH}`, { withCredentials: true });
    socket.current = source;
    setConnection('connecting');

    source.addEventListener('open', () => {
      if (!closed) setConnection('live');
    });
    source.addEventListener('error', () => {
      if (closed) return;
      // CONNECTING means the browser is already retrying (and the server will
      // replay via Last-Event-ID). CLOSED means it gave up — a fatal response
      // such as a revoked session — and the honest state is the poll fallback.
      setConnection(source.readyState === READY_STATE_CLOSED ? 'offline' : 'reconnecting');
    });
    source.addEventListener('entry', handleFrame);
    source.addEventListener('chain', handleFrame);
    source.addEventListener('heartbeat', handleFrame);

    return () => {
      closed = true;
      socket.current = null;
      source.close();
    };
    // `generation` is the resync trigger; the factory is ref-stable per mount.
  }, [enabled, generation, baseUrl, handleFrame, resolveFactory]);

  const pause = useCallback((): void => {
    setPaused(true);
  }, []);

  const resume = useCallback((): void => {
    setPaused(false);
    pausedRef.current = false;
    const buffered = buffer.current;
    buffer.current = [];
    setBufferedCount(0);
    // Oldest first: the page merges by seq, but delivery order keeps the
    // highlight diff honest.
    for (const entry of buffered) onEntryRef.current(entry);
  }, []);

  const resync = useCallback((): void => {
    setGeneration((current) => current + 1);
  }, []);

  const status: AuditStreamStatus = paused ? 'paused' : connection;

  return { status, paused, bufferedCount, pause, resume, resync };
}

/** The pill's verbatim label per status. */
export const STREAM_STATUS_LABELS: Record<AuditStreamStatus, string> = {
  connecting: 'RECONNECTING',
  live: 'LIVE',
  reconnecting: 'RECONNECTING',
  paused: 'PAUSED',
  offline: 'POLLING',
};

/** Socket-ready guard for the fake `readyState` check (`EventSource.CONNECTING`). */
export const READY_STATE = {
  connecting: READY_STATE_CONNECTING,
  closed: READY_STATE_CLOSED,
} as const;

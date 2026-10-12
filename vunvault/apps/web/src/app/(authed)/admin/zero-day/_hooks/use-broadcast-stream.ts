import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { BroadcastRecord, BroadcastProgressEvent } from '@vunvault/contracts';
import { BroadcastStreamEvent } from '@vunvault/contracts';
import { env } from '../../../../../env';
import { broadcastProgressKey } from './use-broadcast';

/**
 * Broadcast delivery progress stream (Task 94) — the push half of the desk's
 * delivery strip.
 *
 * The API relay (`GET …/admin/advisories/:id/broadcasts/stream`) sends a
 * `snapshot` frame on connect and then the broadcast worker's `progress`
 * frames filtered to this advisory. This hook writes both into the SAME
 * React Query cache slot the Task 82 poll uses (`broadcastProgressKey`), so
 * `progressOf(...)` and the strip render live numbers without knowing which
 * transport fed them — and when the stream is offline the poll simply resumes.
 *
 * Rules inherited from the audit stream hook (Task 93): reconnection is the
 * browser's job (the relay re-snapshots on connect, so nothing is lost),
 * cookies are the only credential, every frame is parsed with its contract
 * schema before it touches the cache, and `offline` is an honest state, not an
 * error.
 *
 * No `'use client'` directive (the `use-broadcast.ts` pattern).
 */

export type BroadcastStreamStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

/** The slice of `EventSource` this hook uses — the test seam. */
export interface BroadcastEventSource {
  addEventListener(
    type: 'open' | 'error' | 'snapshot' | 'progress' | 'heartbeat',
    listener: (event: MessageEvent) => void,
  ): void;
  close(): void;
  readonly readyState: number;
}

export type BroadcastEventSourceFactory = (
  url: string,
  init: { withCredentials: boolean },
) => BroadcastEventSource;

/** `EventSource.CLOSED` without depending on the global. */
const READY_STATE_CLOSED = 2;

export function broadcastStreamPath(advisoryId: string): string {
  return `/api/v1/admin/advisories/${advisoryId}/broadcasts/stream`;
}

/** True once the worker will send no more counters for this record. */
export function isSettled(status: BroadcastRecord['status']): boolean {
  return status === 'sent' || status === 'failed';
}

/**
 * Fold one worker frame into the cached records.
 *
 * Pure so the merge rule is testable without a socket: counters move, the
 * audience never does (the estimate was made pre-flight), and `finishedAt` is
 * stamped from the frame that settled the delivery. An unknown `broadcastId`
 * returns the cache untouched — the caller refetches instead, because a
 * rebroadcast dispatched from another tab is a fact this cache does not have.
 */
export function applyProgress(
  records: readonly BroadcastRecord[] | undefined,
  event: BroadcastProgressEvent,
): { records: BroadcastRecord[]; known: boolean } {
  if (records === undefined) return { records: [], known: false };
  let known = false;
  const next = records.map((record) => {
    if (record.id !== event.broadcastId) return record;
    known = true;
    return {
      ...record,
      status: event.status,
      sentDashboards: event.sent.dashboards,
      sentEmail: event.sent.email,
      sentSms: event.sent.sms,
      failed: event.failed,
      finishedAt: isSettled(event.status) ? event.updatedAt : record.finishedAt,
    };
  });
  return { records: next, known };
}

export interface UseBroadcastStreamOptions {
  /** Overrides the native `EventSource` (tests). `null` forces the offline fallback. */
  eventSourceFactory?: BroadcastEventSourceFactory | null;
}

export function useBroadcastStream(
  advisoryId: string | null,
  enabled: boolean,
  options: UseBroadcastStreamOptions = {},
): BroadcastStreamStatus {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<BroadcastStreamStatus>('offline');

  // Refs, so a render never reopens the socket: the factory is a test seam and
  // the invalidation guard must outlive renders without retriggering effects.
  const factoryRef = useRef(options.eventSourceFactory);
  factoryRef.current = options.eventSourceFactory;
  const invalidated = useRef<Set<string>>(new Set());

  const resolveFactory = useCallback((): BroadcastEventSourceFactory | null => {
    const explicit = factoryRef.current;
    if (explicit !== undefined) return explicit;
    if (typeof EventSource === 'undefined') return null;
    return (url, init) => new EventSource(url, init) as unknown as BroadcastEventSource;
  }, []);

  useEffect(() => {
    invalidated.current = new Set();
    if (!enabled || advisoryId === null) {
      setStatus('offline');
      return;
    }
    const factory = resolveFactory();
    if (factory === null) {
      setStatus('offline');
      return;
    }

    const key = broadcastProgressKey(advisoryId);
    let closed = false;

    const onFrame = (event: MessageEvent): void => {
      let data: unknown;
      try {
        data = JSON.parse(String(event.data));
      } catch {
        return;
      }
      const parsed = BroadcastStreamEvent.safeParse(data);
      if (!parsed.success) return;
      const frame = parsed.data;

      if (frame.type === 'snapshot') {
        queryClient.setQueryData(key, frame.records);
        return;
      }
      if (frame.type === 'progress') {
        const applied = applyProgress(queryClient.getQueryData<BroadcastRecord[]>(key), frame);
        if (applied.known) {
          queryClient.setQueryData(key, applied.records);
          return;
        }
        // A broadcast this cache has never seen: a rebroadcast dispatched from
        // another tab, or a snapshot missed while reconnecting. One refetch —
        // guarded per broadcast id, because frames arrive faster than fetches.
        if (!invalidated.current.has(frame.broadcastId)) {
          invalidated.current.add(frame.broadcastId);
          void queryClient.invalidateQueries({ queryKey: key });
        }
      }
      // 'heartbeat' keeps the pipe warm; nothing to render.
    };

    const source = factory(`${env.NEXT_PUBLIC_API_URL}${broadcastStreamPath(advisoryId)}`, {
      withCredentials: true,
    });
    setStatus('connecting');

    source.addEventListener('open', () => {
      if (!closed) setStatus('live');
    });
    source.addEventListener('error', () => {
      if (closed) return;
      // CLOSED means the browser gave up (a revoked session, a fatal status):
      // the honest state is `offline`, and the Task 82 poll resumes.
      setStatus(source.readyState === READY_STATE_CLOSED ? 'offline' : 'reconnecting');
    });
    source.addEventListener('snapshot', onFrame);
    source.addEventListener('progress', onFrame);
    source.addEventListener('heartbeat', onFrame);

    return () => {
      closed = true;
      source.close();
      setStatus('offline');
    };
  }, [advisoryId, enabled, queryClient, resolveFactory]);

  return status;
}

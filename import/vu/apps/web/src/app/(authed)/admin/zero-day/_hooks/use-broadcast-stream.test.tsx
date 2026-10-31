import type { ReactNode } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BroadcastRecord } from '@vunvault/contracts';
import { BroadcastProgressEvent } from '@vunvault/contracts';
import { createQueryClient } from '@vunvault/lib';
import { broadcastProgressKey } from './use-broadcast';
import {
  applyProgress,
  broadcastStreamPath,
  useBroadcastStream,
  type BroadcastEventSource,
  type BroadcastEventSourceFactory,
} from './use-broadcast-stream';

/**
 * `useBroadcastStream` tests — the desk half of the delivery
 * progress relay. The socket is faked at its narrowest seam; the assertions
 * are about the CACHE (the strip renders from it, whichever transport fed it),
 * the status the live dot reads, and the socket lifecycle.
 */

const ADVISORY_ID = '9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d';
const BROADCAST_ID = '3f2b8c1e-9d4a-4e7b-8c2f-1a5d6e7f8090';
const OTHER_BROADCAST_ID = '7c1e5a9d-2b8f-4e6a-9c3d-1f0e2d4c6b8a';

type Listener = (event: MessageEvent) => void;

class FakeEventSource implements BroadcastEventSource {
  static instances: FakeEventSource[] = [];

  readyState = 0;
  closed = false;
  readonly url: string;
  readonly withCredentials: boolean;
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(url: string, init?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = init?.withCredentials ?? false;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  close(): void {
    this.closed = true;
    this.readyState = 2;
  }

  emit(type: string, payload: unknown): void {
    this.emitRaw(type, JSON.stringify(payload));
  }

  emitRaw(type: string, raw: string): void {
    const event = { data: raw } as unknown as MessageEvent;
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  open(): void {
    this.readyState = 1;
    this.emitRaw('open', '');
  }

  fail(readyState: 0 | 2 = 0): void {
    this.readyState = readyState;
    this.emitRaw('error', '');
  }
}

const factory: BroadcastEventSourceFactory = (url, init) => new FakeEventSource(url, init);

function socket(index = FakeEventSource.instances.length - 1): FakeEventSource {
  const instance = FakeEventSource.instances[index];
  if (instance === undefined) throw new Error('No EventSource instance was created.');
  return instance;
}

function record(overrides: Partial<BroadcastRecord> = {}): BroadcastRecord {
  return {
    id: BROADCAST_ID,
    advisoryId: ADVISORY_ID,
    kind: 'initial',
    status: 'sending',
    triggeredByLabel: 'e.reed',
    audienceDashboards: 312,
    emailContacts: 486,
    smsContacts: 74,
    sentDashboards: 0,
    sentEmail: 0,
    sentSms: 0,
    failed: 0,
    createdAt: '2026-09-24T09:12:00.000Z',
    finishedAt: null,
    ...overrides,
  };
}

function progressEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'progress',
    broadcastId: BROADCAST_ID,
    advisoryId: ADVISORY_ID,
    kind: 'initial',
    status: 'sending',
    audience: { dashboards: 312, email: 486, sms: 74 },
    sent: { dashboards: 140, email: 220, sms: 31 },
    failed: 2,
    updatedAt: '2026-09-24T09:14:00.000Z',
    ...overrides,
  };
}

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

interface RenderOptions {
  advisoryId?: string | null;
  enabled?: boolean;
  eventSourceFactory?: BroadcastEventSourceFactory | null;
}

function renderBroadcastStream(options: RenderOptions = {}) {
  return renderHook(
    () =>
      useBroadcastStream(
        options.advisoryId === undefined ? ADVISORY_ID : options.advisoryId,
        options.enabled ?? true,
        options.eventSourceFactory === undefined
          ? { eventSourceFactory: factory }
          : { eventSourceFactory: options.eventSourceFactory },
      ),
    { wrapper },
  );
}

beforeEach(() => {
  queryClient = createQueryClient();
  FakeEventSource.instances = [];
});

describe('useBroadcastStream — connection', () => {
  it('opens the advisory stream with credentials and reports connecting → live', () => {
    const { result } = renderBroadcastStream();

    expect(socket().url).toBe(`https://api.vunvault.test${broadcastStreamPath(ADVISORY_ID)}`);
    expect(socket().withCredentials).toBe(true);
    expect(result.current).toBe('connecting');

    act(() => socket().open());
    expect(result.current).toBe('live');
  });

  it('disabled or id-less callers never open a socket', () => {
    const disabled = renderBroadcastStream({ enabled: false });
    expect(disabled.result.current).toBe('offline');

    const idless = renderBroadcastStream({ advisoryId: null });
    expect(idless.result.current).toBe('offline');
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it('a null factory (no EventSource) stays offline — the poll fallback', () => {
    const { result } = renderBroadcastStream({ eventSourceFactory: null });
    expect(result.current).toBe('offline');
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it('error while retrying reports reconnecting; a CLOSED socket reports offline', () => {
    const { result } = renderBroadcastStream();
    act(() => socket().open());

    act(() => socket().fail(0));
    expect(result.current).toBe('reconnecting');

    act(() => socket().open());
    expect(result.current).toBe('live');

    act(() => socket().fail(2));
    expect(result.current).toBe('offline');
  });

  it('unmount closes the socket', () => {
    const { unmount } = renderBroadcastStream();
    unmount();
    expect(socket().closed).toBe(true);
  });

  it('a new advisory id swaps the socket', () => {
    const { rerender } = renderHook(
      ({ id }: { id: string }) => useBroadcastStream(id, true, { eventSourceFactory: factory }),
      { wrapper, initialProps: { id: ADVISORY_ID } },
    );
    const first = socket(0);

    rerender({ id: OTHER_BROADCAST_ID });
    expect(first.closed).toBe(true);
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(socket(1).url).toContain(broadcastStreamPath(OTHER_BROADCAST_ID));
  });
});

describe('useBroadcastStream — cache writes', () => {
  it('a snapshot frame seeds the records the strip renders from', () => {
    renderBroadcastStream();
    act(() => socket().open());

    const records = [record({ sentDashboards: 7 })];
    act(() => socket().emit('snapshot', { type: 'snapshot', records }));
    expect(queryClient.getQueryData(broadcastProgressKey(ADVISORY_ID))).toEqual(records);
  });

  it('a progress frame patches only the counters, never the audience', () => {
    queryClient.setQueryData(broadcastProgressKey(ADVISORY_ID), [record()]);
    renderBroadcastStream();
    act(() => socket().open());

    act(() => socket().emit('progress', progressEvent()));
    const cached = queryClient.getQueryData<BroadcastRecord[]>(broadcastProgressKey(ADVISORY_ID));
    expect(cached?.[0]).toMatchObject({
      sentDashboards: 140,
      sentEmail: 220,
      sentSms: 31,
      failed: 2,
      status: 'sending',
      audienceDashboards: 312,
      finishedAt: null,
    });
  });

  it('the settling frame stamps finishedAt from updatedAt', () => {
    queryClient.setQueryData(broadcastProgressKey(ADVISORY_ID), [record()]);
    renderBroadcastStream();
    act(() => socket().open());

    act(() =>
      socket().emit(
        'progress',
        progressEvent({ status: 'sent', updatedAt: '2026-09-24T09:20:00.000Z' }),
      ),
    );
    const cached = queryClient.getQueryData<BroadcastRecord[]>(broadcastProgressKey(ADVISORY_ID));
    expect(cached?.[0]).toMatchObject({
      status: 'sent',
      finishedAt: '2026-09-24T09:20:00.000Z',
    });
  });

  it('an unknown broadcast invalidates ONCE, and twice for two ids', () => {
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    queryClient.setQueryData(broadcastProgressKey(ADVISORY_ID), [record()]);
    renderBroadcastStream();
    act(() => socket().open());

    const unknown = progressEvent({ broadcastId: OTHER_BROADCAST_ID });
    act(() => socket().emit('progress', unknown));
    act(() => socket().emit('progress', unknown));
    expect(invalidate).toHaveBeenCalledTimes(1);

    act(() =>
      socket().emit(
        'progress',
        progressEvent({ broadcastId: BROADCAST_ID.replace('3f2b', 'aaaa') }),
      ),
    );
    // Same shape, third id — but the guard is per broadcast id, so one more.
    expect(invalidate).toHaveBeenCalledTimes(2);
    invalidate.mockRestore();
  });

  it('unparsable and wrong-shaped frames never touch the cache', () => {
    queryClient.setQueryData(broadcastProgressKey(ADVISORY_ID), [record()]);
    renderBroadcastStream();
    act(() => socket().open());

    act(() => socket().emitRaw('progress', '{truncated'));
    act(() => socket().emit('progress', progressEvent({ status: 'partial' })));
    act(() => socket().emit('snapshot', { type: 'snapshot' }));
    const cached = queryClient.getQueryData<BroadcastRecord[]>(broadcastProgressKey(ADVISORY_ID));
    expect(cached?.[0]).toMatchObject({ sentDashboards: 0 });
  });
});

/** Through the contract, exactly as the hook receives it. */
function event(overrides: Record<string, unknown> = {}) {
  return BroadcastProgressEvent.parse(progressEvent(overrides));
}

describe('applyProgress — the pure merge rule', () => {
  it('leaves other records untouched', () => {
    const other = record({ id: OTHER_BROADCAST_ID, sentDashboards: 5 });
    const { records, known } = applyProgress([other, record()], event());
    expect(known).toBe(true);
    expect(records[0]).toBe(other);
    expect(records[1]).toMatchObject({ sentDashboards: 140 });
  });

  it('reports unknown ids without rewriting the cache', () => {
    const cached = [record()];
    const { records, known } = applyProgress(cached, event({ broadcastId: OTHER_BROADCAST_ID }));
    expect(known).toBe(false);
    expect(records).toEqual(cached);
  });

  it('an empty cache is unknown, not an error', () => {
    expect(applyProgress(undefined, event())).toEqual({ records: [], known: false });
  });
});

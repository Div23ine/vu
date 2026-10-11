import type { ReactNode } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditEntryView, ChainStatus } from '@vunvault/contracts';
import { auditEntries, chainStatus } from '@vunvault/contracts/fixtures/audit';
import { createQueryClient, queryKeys } from '@vunvault/lib';
import {
  AUDIT_STREAM_PATH,
  PAUSE_BUFFER_LIMIT,
  useAuditStream,
  type AuditEventSource,
  type AuditEventSourceFactory,
} from './use-audit-stream';

/**
 * `useAuditStream` tests (Task 93) — the browser half of the live audit tail.
 *
 * The socket is faked at its narrowest seam (`AuditEventSource`): the tests
 * drive `open` / `error` / frame delivery by hand and assert the status
 * machine, the contract parsing, the cache write for `chain` frames, the
 * capped pause buffer and the cleanup rules. No real network, no timers.
 */

type Listener = (event: MessageEvent) => void;

class FakeEventSource implements AuditEventSource {
  static instances: FakeEventSource[] = [];

  /** 0 CONNECTING · 1 OPEN · 2 CLOSED — the browser constants. */
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

  /** Fires a frame whose `data` is `JSON.stringify(payload)`. */
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

function resetSockets(): void {
  FakeEventSource.instances = [];
}

const factory: AuditEventSourceFactory = (url, init) => new FakeEventSource(url, init);

function socket(index = 0): FakeEventSource {
  const instance = FakeEventSource.instances[index];
  if (instance === undefined) throw new Error(`No EventSource instance #${index} was created.`);
  return instance;
}

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/** A contract-valid entry built from the fixture head, keyed by `seq`. */
function entryAt(seq: number, overrides: Partial<AuditEntryView> = {}): AuditEntryView {
  const base = auditEntries[0] as AuditEntryView;
  return {
    ...base,
    seq,
    id: `a0000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

interface RenderOptions {
  enabled?: boolean;
  eventSourceFactory?: AuditEventSourceFactory | null;
  baseUrl?: string;
}

function renderStream(options: RenderOptions = {}) {
  const onEntry = vi.fn();
  const hook = renderHook(
    ({ callback }: { callback: (entry: AuditEntryView) => void }) =>
      useAuditStream({
        enabled: options.enabled ?? true,
        baseUrl: options.baseUrl ?? 'https://api.test',
        onEntry: callback,
        ...(options.eventSourceFactory !== undefined
          ? { eventSourceFactory: options.eventSourceFactory }
          : { eventSourceFactory: factory }),
      }),
    {
      wrapper,
      initialProps: { callback: onEntry },
    },
  );
  return { ...hook, onEntry };
}

beforeEach(() => {
  queryClient = createQueryClient();
  resetSockets();
});

describe('useAuditStream — connection', () => {
  it('opens the stream URL with credentials and reports connecting → live', () => {
    const { result } = renderStream();

    expect(socket().url).toBe(`https://api.test${AUDIT_STREAM_PATH}`);
    expect(socket().withCredentials).toBe(true);
    expect(result.current.status).toBe('connecting');

    act(() => socket().open());
    expect(result.current.status).toBe('live');
  });

  it('an error while the browser retries reports reconnecting, and open recovers', () => {
    const { result } = renderStream();
    act(() => socket().open());

    act(() => socket().fail(0));
    expect(result.current.status).toBe('reconnecting');

    act(() => socket().open());
    expect(result.current.status).toBe('live');
  });

  it('an error on a CLOSED socket falls back to offline (the poll resumes)', () => {
    const { result } = renderStream();
    act(() => socket().open());

    act(() => socket().fail(2));
    expect(result.current.status).toBe('offline');
  });

  it('enabled: false never opens a socket and stays offline', () => {
    const { result } = renderStream({ enabled: false });

    expect(FakeEventSource.instances).toHaveLength(0);
    expect(result.current.status).toBe('offline');
  });

  it('a null factory (no EventSource in the environment) stays offline', () => {
    const { result } = renderStream({ eventSourceFactory: null });

    expect(FakeEventSource.instances).toHaveLength(0);
    expect(result.current.status).toBe('offline');
  });

  it('unmount closes the socket', () => {
    const { unmount } = renderStream();
    act(() => socket().open());

    unmount();
    expect(socket().closed).toBe(true);
  });

  it('resync closes the old socket and opens a new one', () => {
    const { result } = renderStream();
    act(() => socket(0).open());

    act(() => result.current.resync());
    expect(socket(0).closed).toBe(true);
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(result.current.status).toBe('connecting');

    act(() => socket(1).open());
    expect(result.current.status).toBe('live');
  });

  it('a new onEntry identity does not reopen the socket', () => {
    const { rerender } = renderStream();
    act(() => socket().open());

    rerender({ callback: vi.fn() });
    expect(FakeEventSource.instances).toHaveLength(1);
  });
});

describe('useAuditStream — frames', () => {
  it('delivers a contract-valid entry', () => {
    const { onEntry } = renderStream();
    act(() => socket().open());

    const entry = entryAt(1_482_905);
    act(() => socket().emit('entry', { type: 'entry', entry }));
    expect(onEntry).toHaveBeenCalledWith(entry);
  });

  it('drops unparsable and wrong-shaped payloads without throwing', () => {
    const { onEntry, result } = renderStream();
    act(() => socket().open());

    act(() => socket().emitRaw('entry', '{not json'));
    act(() => socket().emit('entry', { type: 'nonsense' }));
    act(() => socket().emit('entry', { type: 'entry' })); // no entry field
    expect(onEntry).not.toHaveBeenCalled();
    expect(result.current.status).toBe('live');
  });

  it('writes a chain frame into the query cache', () => {
    renderStream();
    act(() => socket().open());

    const broken: ChainStatus = { ...chainStatus, state: 'broken' };
    act(() => socket().emit('chain', { type: 'chain', chain: broken }));
    expect(queryClient.getQueryData(queryKeys.audit.chain())).toEqual(broken);
  });

  it('ignores heartbeats', () => {
    const { onEntry, result } = renderStream();
    act(() => socket().open());

    act(() => socket().emit('heartbeat', { type: 'heartbeat' }));
    expect(onEntry).not.toHaveBeenCalled();
    expect(result.current.status).toBe('live');
  });
});

describe('useAuditStream — pause buffer', () => {
  it('buffers while paused and flushes oldest-first on resume', () => {
    const { result, onEntry } = renderStream();
    act(() => socket().open());

    act(() => result.current.pause());
    expect(result.current.status).toBe('paused');

    const first = entryAt(10);
    const second = entryAt(11);
    act(() => socket().emit('entry', { type: 'entry', entry: first }));
    act(() => socket().emit('entry', { type: 'entry', entry: second }));
    expect(onEntry).not.toHaveBeenCalled();
    expect(result.current.bufferedCount).toBe(2);

    act(() => result.current.resume());
    expect(onEntry.mock.calls.map(([entry]) => entry)).toEqual([first, second]);
    expect(result.current.bufferedCount).toBe(0);
    expect(result.current.status).toBe('live');
  });

  it('caps the buffer and drops the OLDEST beyond the cap', () => {
    const { result, onEntry } = renderStream();
    act(() => socket().open());
    act(() => result.current.pause());

    const overflow = PAUSE_BUFFER_LIMIT + 5;
    act(() => {
      for (let seq = 1; seq <= overflow; seq += 1) {
        socket().emit('entry', { type: 'entry', entry: entryAt(seq) });
      }
    });
    expect(result.current.bufferedCount).toBe(PAUSE_BUFFER_LIMIT);

    act(() => result.current.resume());
    // The five oldest were dropped; delivery starts at seq 6.
    expect(onEntry).toHaveBeenCalledTimes(PAUSE_BUFFER_LIMIT);
    expect(onEntry.mock.calls[0]?.[0]).toMatchObject({ seq: 6 });
  });

  it('chain frames still update the cache while paused', () => {
    const { result } = renderStream();
    act(() => socket().open());
    act(() => result.current.pause());

    act(() => socket().emit('chain', { type: 'chain', chain: chainStatus }));
    expect(queryClient.getQueryData(queryKeys.audit.chain())).toEqual(chainStatus);
  });
});

describe('useAuditStream — environment fallback', () => {
  it('uses the global EventSource when no factory is injected', async () => {
    const opened: string[] = [];
    class GlobalFake extends FakeEventSource {
      constructor(url: string, init?: { withCredentials?: boolean }) {
        super(url, init);
        opened.push(url);
      }
    }
    vi.stubGlobal('EventSource', GlobalFake);
    try {
      const { result } = renderHook(
        () =>
          useAuditStream({
            enabled: true,
            baseUrl: 'https://api.test',
            onEntry: () => undefined,
            eventSourceFactory: undefined,
          }),
        { wrapper },
      );
      expect(opened).toEqual([`https://api.test${AUDIT_STREAM_PATH}`]);
      await waitFor(() => expect(result.current.status).toBe('connecting'));
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

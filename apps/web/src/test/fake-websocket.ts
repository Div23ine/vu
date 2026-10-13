/**
 * A hand-driven `WebSocket` stand-in for tests (Task 96).
 *
 * Stub it with `vi.stubGlobal('WebSocket', FakeWebSocket)`. Every instance
 * records what it was constructed with and everything written to it, and the
 * test fires the browser's four events by hand — so assertions are about the
 * frames that would actually cross the wire and about the URL a reconnect asks
 * for (`after=<lastSeq>`), with no socket library and no timers other than the
 * ones the test controls.
 */

export const FAKE_SOCKET_STATES = {
  connecting: 0,
  open: 1,
  closing: 2,
  closed: 3,
} as const;

export type FakeSocketState = (typeof FAKE_SOCKET_STATES)[keyof typeof FAKE_SOCKET_STATES];

export interface FakeSocketCloseEvent {
  code: number;
  reason: string;
}

export class FakeWebSocket {
  /** Every socket constructed, in order. Reset with `FakeWebSocket.reset()`. */
  static instances: FakeWebSocket[] = [];

  static reset(): void {
    FakeWebSocket.instances = [];
  }

  /** The most recently constructed socket. Throws when there is none. */
  static latest(): FakeWebSocket {
    const socket = FakeWebSocket.instances.at(-1);
    if (socket === undefined) throw new Error('No FakeWebSocket was constructed.');
    return socket;
  }

  readonly url: string;
  readonly protocols: string | string[] | undefined;
  readyState: FakeSocketState = FAKE_SOCKET_STATES.connecting;
  /** Raw strings written by the code under test. */
  readonly sent: string[] = [];
  closeCode: number | null = null;
  closeReason: string | null = null;

  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: FakeSocketCloseEvent) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;

  constructor(url: string | URL, protocols?: string | string[]) {
    this.url = String(url);
    this.protocols = protocols;
    FakeWebSocket.instances.push(this);
  }

  send(payload: string): void {
    if (this.readyState !== FAKE_SOCKET_STATES.open) {
      throw new Error(`FakeWebSocket.send on a socket in state ${this.readyState}`);
    }
    this.sent.push(payload);
  }

  /** What the code under test sent, parsed. Throws on a non-JSON frame. */
  sentFrames(): unknown[] {
    return this.sent.map((payload) => JSON.parse(payload) as unknown);
  }

  close(code = 1_000, reason = ''): void {
    if (this.readyState === FAKE_SOCKET_STATES.closed) return;
    this.readyState = FAKE_SOCKET_STATES.closed;
    this.closeCode = code;
    this.closeReason = reason;
    // A real socket reports its own close back to the handlers.
    this.onclose?.({ code, reason });
  }

  // ------------------------------------------------------------- test drivers

  emitOpen(): void {
    this.readyState = FAKE_SOCKET_STATES.open;
    this.onopen?.({});
  }

  /** Delivers a frame the way the relay sends it: a JSON text message. */
  emitMessage(frame: unknown): void {
    this.onmessage?.({ data: JSON.stringify(frame) });
  }

  /** Delivers raw text — for the "not even JSON" case. */
  emitRaw(data: string): void {
    this.onmessage?.({ data });
  }

  emitClose(code: number, reason = ''): void {
    this.readyState = FAKE_SOCKET_STATES.closed;
    this.onclose?.({ code, reason });
  }

  emitError(): void {
    this.onerror?.({});
  }

  /** The `?after=` value on this socket's URL, or null when absent. */
  afterParam(): string | null {
    const url = new URL(this.url);
    return url.searchParams.get('after');
  }
}

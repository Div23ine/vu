import { describe, expect, it } from 'vitest';
import {
  isReplayed,
  ScanClientMessage,
  ScanStreamControlAck,
  ScanStreamError,
  ScanStreamFrame,
  ScanStreamMessage,
} from './scan-stream';

/**
 * Scan stream contract tests (Task 88 union + the Task 95 relay frames).
 *
 * The relay frames are the security surface worth pinning: `control_ack` and
 * `error` are relay → browser only, they are NOT controller messages, they are
 * strict, and they are never replayed.
 */

const LINE = {
  type: 'line',
  seq: 7,
  ts: '2026-10-08T12:00:00.000Z',
  kind: 'info',
  msg: 'resolving target',
} as const;

describe('ScanStreamMessage (controller frames)', () => {
  it('accepts the four controller message types', () => {
    expect(ScanStreamMessage.safeParse(LINE).success).toBe(true);
    expect(
      ScanStreamMessage.safeParse({ type: 'progress', progress: 42, etaSeconds: 90 }).success,
    ).toBe(true);
    expect(ScanStreamMessage.safeParse({ type: 'phase', name: 'enumeration' }).success).toBe(true);
    expect(ScanStreamMessage.safeParse({ type: 'status', status: 'running' }).success).toBe(true);
  });

  it('rejects the relay-only frames: the controller cannot ack or error', () => {
    expect(ScanStreamMessage.safeParse({ type: 'control_ack', control: 'abort' }).success).toBe(
      false,
    );
    expect(ScanStreamMessage.safeParse({ type: 'error', code: 'forbidden' }).success).toBe(false);
  });
});

describe('ScanStreamControlAck / ScanStreamError (relay frames, Task 95)', () => {
  it.each(['abort', 'pause', 'resume', 'kill'])('acks control %s', (control) => {
    expect(ScanStreamControlAck.safeParse({ type: 'control_ack', control }).success).toBe(true);
  });

  it('rejects an unknown control in an ack', () => {
    expect(
      ScanStreamControlAck.safeParse({ type: 'control_ack', control: 'restart' }).success,
    ).toBe(false);
  });

  it.each(['invalid_message', 'forbidden', 'not_running', 'rate_limited'])(
    'carries the fixed error vocabulary: %s',
    (code) => {
      expect(ScanStreamError.safeParse({ type: 'error', code }).success).toBe(true);
    },
  );

  it('rejects an error frame with an off-vocabulary code or extra field', () => {
    expect(ScanStreamError.safeParse({ type: 'error', code: 'exec' }).success).toBe(false);
    expect(
      ScanStreamError.safeParse({ type: 'error', code: 'forbidden', input: 'x' }).success,
    ).toBe(false);
  });
});

describe('ScanStreamFrame (everything a browser may receive)', () => {
  it('discriminates all six frame types', () => {
    for (const frame of [
      LINE,
      { type: 'progress', progress: 1, etaSeconds: null },
      { type: 'phase', name: 'scan' },
      { type: 'status', status: 'completed' },
      { type: 'control_ack', control: 'pause' },
      { type: 'error', code: 'not_running' },
    ]) {
      expect(ScanStreamFrame.safeParse(frame).success).toBe(true);
    }
  });

  it('rejects anything else', () => {
    expect(ScanStreamFrame.safeParse({ type: 'exec', cmd: 'rm' }).success).toBe(false);
  });
});

describe('ScanClientMessage (browser → relay)', () => {
  it('accepts exactly the four control signals', () => {
    for (const type of ['abort', 'pause', 'resume', 'kill']) {
      expect(ScanClientMessage.safeParse({ type }).success).toBe(true);
    }
  });

  it('is strict: no smuggling an extra field to the controller', () => {
    expect(ScanClientMessage.safeParse({ type: 'abort', cmd: 'x' }).success).toBe(false);
    expect(ScanClientMessage.safeParse({ type: 'exec' }).success).toBe(false);
  });
});

describe('isReplayed', () => {
  it('replays line, phase and status only', () => {
    const frames: ScanStreamFrame[] = [
      LINE,
      { type: 'phase', name: 'scan' },
      { type: 'status', status: 'running' },
      { type: 'progress', progress: 5, etaSeconds: null },
    ];
    expect(frames.map((frame) => isReplayed(frame))).toEqual([true, true, true, false]);
  });

  it('never replays the relay-only frames', () => {
    const frames: ScanStreamFrame[] = [
      { type: 'control_ack', control: 'abort' },
      { type: 'error', code: 'forbidden' },
    ];
    expect(frames.map((frame) => isReplayed(frame))).toEqual([false, false]);
  });
});

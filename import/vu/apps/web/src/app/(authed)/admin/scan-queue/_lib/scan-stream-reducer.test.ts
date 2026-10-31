import { describe, expect, it } from 'vitest';
import type { ScanStreamFrame } from '@vunvault/contracts';
import {
  ACCESS_DENIED_NOTICE,
  BACKOFF_SCHEDULE_MS,
  ENDED_COPY,
  LINE_CAP,
  SESSION_ENDED_NOTICE,
  backoffDelayMs,
  initialStreamState,
  scanStreamReducer,
  terminalChipLabel,
  type StreamState,
} from './scan-stream-reducer';

/**
 * The terminal reducer — the whole wire protocol in pure steps:
 * dedupe, cap, transitions, the close-code table and the backoff schedule.
 */

function line(seq: number, msg = `step ${seq}`): ScanStreamFrame {
  return { type: 'line', seq, ts: '2026-10-08T12:00:00.000Z', kind: 'info', msg };
}

function run(actions: Array<Parameters<typeof scanStreamReducer>[1]>): StreamState {
  return actions.reduce(scanStreamReducer, initialStreamState);
}

describe('scanStreamReducer — lines', () => {
  it('appends lines in order and tracks the high-water seq', () => {
    const state = run([
      { type: 'message', frame: line(1) },
      { type: 'message', frame: line(2) },
      { type: 'message', frame: line(3) },
    ]);
    expect(state.lines.map((entry) => entry.seq)).toEqual([1, 2, 3]);
    expect(state.lastSeq).toBe(3);
  });

  it('dedupes a replayed line (seq at or below the high-water mark)', () => {
    const state = run([
      { type: 'message', frame: line(5) },
      { type: 'message', frame: line(5) },
      { type: 'message', frame: line(4) },
      { type: 'message', frame: line(6) },
    ]);
    expect(state.lines.map((entry) => entry.seq)).toEqual([5, 6]);
  });

  it('caps at LINE_CAP and drops the OLDEST', () => {
    const frames: Array<Parameters<typeof scanStreamReducer>[1]> = [];
    for (let seq = 1; seq <= LINE_CAP + 10; seq += 1)
      frames.push({ type: 'message', frame: line(seq) });
    const state = run(frames);
    expect(state.lines).toHaveLength(LINE_CAP);
    expect(state.lines[0]?.seq).toBe(11);
    expect(state.lines.at(-1)?.seq).toBe(LINE_CAP + 10);
  });
});

describe('scanStreamReducer — progress, phase and status', () => {
  it('progress frames move the bar and the ETA', () => {
    const state = run([
      { type: 'message', frame: { type: 'progress', progress: 42, etaSeconds: 90 } },
    ]);
    expect(state.progress).toBe(42);
    expect(state.etaSeconds).toBe(90);
  });

  it('phase frames move the phase text', () => {
    const state = run([{ type: 'message', frame: { type: 'phase', name: 'enumeration' } }]);
    expect(state.phase).toBe('enumeration');
  });

  it('a running status clears the connecting chip without ending anything', () => {
    const state = run([{ type: 'message', frame: { type: 'status', status: 'running' } }]);
    expect(state.status).toBe('running');
    expect(state.ended).toBe(false);
  });

  it('completed moves the bar to 100 and ends the stream', () => {
    const state = run([
      { type: 'message', frame: { type: 'progress', progress: 99, etaSeconds: 1 } },
      { type: 'message', frame: { type: 'status', status: 'completed' } },
    ]);
    expect(state.progress).toBe(100);
    expect(state.ended).toBe(true);
    expect(state.status).toBe('completed');
  });

  it('cancelled and failed end the stream', () => {
    for (const status of ['cancelled', 'failed'] as const) {
      const state = run([{ type: 'message', frame: { type: 'status', status } }]);
      expect(state.ended).toBe(true);
      expect(state.status).toBe(status);
    }
  });

  it('relay-to-operator frames never become log lines', () => {
    const state = run([
      { type: 'message', frame: { type: 'control_ack', control: 'abort' } },
      { type: 'message', frame: { type: 'error', code: 'invalid_message' } },
    ]);
    expect(state.lines).toEqual([]);
    expect(state).toEqual(initialStreamState);
  });
});

describe('scanStreamReducer — the close-code table', () => {
  it('1000 ends without a notice and never reconnects', () => {
    const state = run([{ type: 'close', code: 1_000 }]);
    expect(state.ended).toBe(true);
    expect(state.reconnecting).toBe(false);
    expect(state.notice).toBeNull();
  });

  it('4401 ends with the session-ended notice', () => {
    const state = run([{ type: 'close', code: 4_401 }]);
    expect(state.ended).toBe(true);
    expect(state.notice).toBe(SESSION_ENDED_NOTICE);
  });

  it('4403 ends with the access-denied notice', () => {
    const state = run([{ type: 'close', code: 4_403 }]);
    expect(state.ended).toBe(true);
    expect(state.notice).toBe(ACCESS_DENIED_NOTICE);
  });

  it.each([1_006, 1_013, 4_400, 4_408, 4_429])(
    '%i schedules a reconnect and keeps the log',
    (code) => {
      const seeded = run([{ type: 'message', frame: line(3) }]);
      const state = scanStreamReducer(seeded, { type: 'close', code });
      expect(state.ended).toBe(false);
      expect(state.reconnecting).toBe(true);
      expect(state.status).toBe('disconnected');
      expect(state.lines).toHaveLength(1);
      expect(state.attempt).toBe(seeded.attempt + 1);
    },
  );

  it('a successful open resets the backoff streak', () => {
    const state = run([
      { type: 'close', code: 1_006 },
      { type: 'close', code: 1_006 },
      { type: 'open' },
    ]);
    expect(state.attempt).toBe(0);
    expect(state.reconnecting).toBe(false);
  });

  it('reset returns to the untouched initial state', () => {
    const dirty = run([
      { type: 'message', frame: line(1) },
      { type: 'close', code: 4_401 },
    ]);
    expect(scanStreamReducer(dirty, { type: 'reset' })).toEqual(initialStreamState);
  });
});

describe('backoffDelayMs — the schedule', () => {
  it('walks 1 s → 30 s and clamps past the end', () => {
    expect(BACKOFF_SCHEDULE_MS).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 30_000]);
    expect(BACKOFF_SCHEDULE_MS.map((_, attempt) => backoffDelayMs(attempt))).toEqual([
      ...BACKOFF_SCHEDULE_MS,
    ]);
    expect(backoffDelayMs(17)).toBe(30_000);
    expect(backoffDelayMs(-1)).toBe(1_000);
  });
});

describe('terminalChipLabel — the verbatim chip', () => {
  it('labels every state, with Reconnecting… winning over the wire status', () => {
    expect(terminalChipLabel(initialStreamState)).toBe('Connecting');
    expect(terminalChipLabel({ ...initialStreamState, status: 'running' })).toBe('Running');
    expect(
      terminalChipLabel({ ...initialStreamState, reconnecting: true, status: 'disconnected' }),
    ).toBe('Reconnecting…');
    expect(terminalChipLabel({ ...initialStreamState, status: 'completed' })).toBe('Completed');
    expect(terminalChipLabel({ ...initialStreamState, status: 'cancelled' })).toBe('Cancelled');
    expect(terminalChipLabel({ ...initialStreamState, status: 'failed' })).toBe('Failed');
    expect(terminalChipLabel({ ...initialStreamState, status: 'disconnected' })).toBe(
      'Disconnected',
    );
  });

  it('carries the verbatim ended copy', () => {
    expect(ENDED_COPY.completed).toBe('Scan finished. Results are awaiting the review gate.');
    expect(ENDED_COPY.cancelled).toBe('Scan cancelled.');
    expect(ENDED_COPY.failed).toBe('Scan did not complete.');
  });
});

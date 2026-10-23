import { describe, expect, it } from 'vitest';
import {
  BroadcastProgressEvent,
  BroadcastStreamEvent,
  broadcastProgressChannel,
} from './broadcast-stream';

const BROADCAST_ID = '3f2b8c1e-9d4a-4e7b-8c2f-1a5d6e7f8090';
const ADVISORY_ID = '9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d';

function validEvent(): Record<string, unknown> {
  return {
    type: 'progress',
    broadcastId: BROADCAST_ID,
    advisoryId: ADVISORY_ID,
    kind: 'initial',
    status: 'sending',
    audience: { dashboards: 12, email: 34, sms: 5 },
    sent: { dashboards: 7, email: 20, sms: 3 },
    failed: 1,
    updatedAt: '2026-09-24T09:14:00.000Z',
  };
}

describe('BroadcastProgressEvent', () => {
  it('accepts a well-formed frame', () => {
    const parsed = BroadcastProgressEvent.safeParse(validEvent());
    expect(parsed.success).toBe(true);
  });

  it('is strict: an unknown property is a rejection, not a pass-through', () => {
    const parsed = BroadcastProgressEvent.safeParse({ ...validEvent(), podName: 'scan-1' });
    expect(parsed.success).toBe(false);
  });

  it.each(['initial', 'rebroadcast', 'retraction'])('accepts kind %s', (kind) => {
    expect(BroadcastProgressEvent.safeParse({ ...validEvent(), kind }).success).toBe(true);
  });

  it('rejects an unknown kind', () => {
    expect(BroadcastProgressEvent.safeParse({ ...validEvent(), kind: 'reminder' }).success).toBe(
      false,
    );
  });

  it.each(['queued', 'sending', 'sent', 'failed'])('accepts status %s', (status) => {
    expect(BroadcastProgressEvent.safeParse({ ...validEvent(), status }).success).toBe(true);
  });

  it('rejects a status outside the broadcast enum', () => {
    expect(BroadcastProgressEvent.safeParse({ ...validEvent(), status: 'partial' }).success).toBe(
      false,
    );
  });

  it('rejects negative counters', () => {
    const event = validEvent();
    (event.sent as Record<string, number>).email = -1;
    expect(BroadcastProgressEvent.safeParse(event).success).toBe(false);
  });

  it('rejects fractional counters', () => {
    const event = validEvent();
    (event.audience as Record<string, number>).dashboards = 1.5;
    expect(BroadcastProgressEvent.safeParse(event).success).toBe(false);
  });

  it('rejects counter objects with extra channels', () => {
    const event = validEvent();
    (event.sent as Record<string, number>).push = 0;
    expect(BroadcastProgressEvent.safeParse(event).success).toBe(false);
  });

  it('rejects a non-datetime updatedAt', () => {
    expect(
      BroadcastProgressEvent.safeParse({ ...validEvent(), updatedAt: 'yesterday' }).success,
    ).toBe(false);
  });

  it('rejects non-uuid identifiers', () => {
    expect(
      BroadcastProgressEvent.safeParse({ ...validEvent(), broadcastId: 'broadcast-1' }).success,
    ).toBe(false);
  });
});

describe('broadcastProgressChannel', () => {
  it('names the channel the Task 94 relay subscribes to', () => {
    expect(broadcastProgressChannel(BROADCAST_ID)).toBe(`broadcast:progress:${BROADCAST_ID}`);
  });
});

function validRecord(): Record<string, unknown> {
  return {
    id: BROADCAST_ID,
    advisoryId: ADVISORY_ID,
    kind: 'initial',
    status: 'sending',
    triggeredByLabel: 'e.reed',
    audienceDashboards: 12,
    emailContacts: 34,
    smsContacts: 5,
    sentDashboards: 7,
    sentEmail: 20,
    sentSms: 3,
    failed: 1,
    createdAt: '2026-09-24T09:12:00.000Z',
    finishedAt: null,
  };
}

describe('BroadcastStreamEvent', () => {
  it('discriminates the snapshot frame', () => {
    const parsed = BroadcastStreamEvent.safeParse({
      type: 'snapshot',
      records: [validRecord()],
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts an empty snapshot (no broadcast has been dispatched yet)', () => {
    expect(BroadcastStreamEvent.safeParse({ type: 'snapshot', records: [] }).success).toBe(true);
  });

  it('discriminates the worker progress frame', () => {
    expect(BroadcastStreamEvent.safeParse(validEvent()).success).toBe(true);
  });

  it('discriminates the heartbeat frame', () => {
    expect(BroadcastStreamEvent.safeParse({ type: 'heartbeat' }).success).toBe(true);
  });

  it('rejects an unknown frame type', () => {
    expect(BroadcastStreamEvent.safeParse({ type: 'command' }).success).toBe(false);
  });

  it('is strict: extra properties are a rejection on every member', () => {
    expect(BroadcastStreamEvent.safeParse({ type: 'heartbeat', seq: 1 }).success).toBe(false);
    expect(
      BroadcastStreamEvent.safeParse({
        type: 'snapshot',
        records: [],
        advisoryId: ADVISORY_ID,
      }).success,
    ).toBe(false);
    expect(BroadcastStreamEvent.safeParse({ ...validEvent(), podName: 'x' }).success).toBe(false);
  });

  it('rejects a snapshot whose records are not BroadcastRecords', () => {
    expect(
      BroadcastStreamEvent.safeParse({
        type: 'snapshot',
        records: [{ ...validRecord(), status: 'partial' }],
      }).success,
    ).toBe(false);
  });
});

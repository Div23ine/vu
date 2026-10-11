import { describe, expect, it } from 'vitest';
import type { ChannelToggles, NotificationEvent, NotifyJobPayload } from '@vunvault/contracts';
import {
  NotificationDispatcher,
  isWithinQuietHours,
  minutesOfDay,
  parseTimeOfDay,
  type NotificationPreferenceReader,
  type NotifyRecipient,
  type QuietHours,
} from './notify';

const USER_ID = 'e0000000-0000-4000-8000-000000000001';
/** 2026-09-24T22:30:00Z is 01:30 the next day in Africa/Nairobi (UTC+3). */
const NIGHT_IN_NAIROBI = new Date('2026-09-24T22:30:00.000Z');

const ALL_ON: ChannelToggles = { inApp: true, email: true, sms: true, push: true };
const ALL_OFF: ChannelToggles = { inApp: false, email: false, sms: false, push: false };

interface Harness {
  dispatcher: NotificationDispatcher;
  jobs: NotifyJobPayload[];
  debug: string[];
  prefs: { toggles: ChannelToggles; quietHours: QuietHours; recipient: NotifyRecipient };
}

function makeDispatcher(
  options: {
    toggles?: ChannelToggles;
    quietHours?: QuietHours;
    phone?: string | null;
    timezone?: string;
    now?: () => Date;
  } = {},
): Harness {
  const jobs: NotifyJobPayload[] = [];
  const debug: string[] = [];
  const prefs = {
    toggles: options.toggles ?? ALL_ON,
    quietHours: options.quietHours ?? { enabled: false, from: null, to: null },
    recipient: {
      userId: USER_ID,
      email: 'e.reed@vunvault.com',
      phone: options.phone === undefined ? '+254712345678' : options.phone,
      timezone: options.timezone ?? 'Africa/Nairobi',
    },
  };
  const reader: NotificationPreferenceReader = {
    recipient: async () => prefs.recipient,
    toggles: async () => prefs.toggles,
    quietHours: async () => prefs.quietHours,
  };
  const dispatcher = new NotificationDispatcher({
    prefs: reader,
    enqueue: async (payload) => {
      jobs.push(payload);
    },
    debug: (message) => {
      debug.push(message);
    },
    now: options.now ?? (() => NIGHT_IN_NAIROBI),
  });
  return { dispatcher, jobs, debug, prefs };
}

const channels = (jobs: NotifyJobPayload[]): string[] => jobs.map((job) => job.channel);

describe('parseTimeOfDay', () => {
  it('reads 24-hour clock times and rejects everything else', () => {
    expect(parseTimeOfDay('00:00')).toBe(0);
    expect(parseTimeOfDay('22:30')).toBe(1350);
    expect(parseTimeOfDay('23:59')).toBe(1439);
    expect(parseTimeOfDay('24:00')).toBeNull();
    expect(parseTimeOfDay('7:30')).toBeNull();
    expect(parseTimeOfDay('22:60')).toBeNull();
    expect(parseTimeOfDay('nonsense')).toBeNull();
  });
});

describe('minutesOfDay', () => {
  it('evaluates the clock in the recipient’s timezone, not UTC', () => {
    expect(minutesOfDay(NIGHT_IN_NAIROBI, 'Africa/Nairobi')).toBe(90); // 01:30
    expect(minutesOfDay(NIGHT_IN_NAIROBI, 'UTC')).toBe(1350); // 22:30
    // An unknown zone must not break delivery.
    expect(minutesOfDay(NIGHT_IN_NAIROBI, 'Not/AZone')).toBe(1350);
  });
});

describe('isWithinQuietHours', () => {
  it('handles an overnight window', () => {
    const from = parseTimeOfDay('22:00') as number;
    const to = parseTimeOfDay('06:00') as number;
    expect(isWithinQuietHours(parseTimeOfDay('23:30') as number, from, to)).toBe(true);
    expect(isWithinQuietHours(parseTimeOfDay('01:30') as number, from, to)).toBe(true);
    expect(isWithinQuietHours(parseTimeOfDay('06:00') as number, from, to)).toBe(false);
    expect(isWithinQuietHours(parseTimeOfDay('12:00') as number, from, to)).toBe(false);
  });

  it('handles a same-day window and treats equal bounds as disabled', () => {
    const from = parseTimeOfDay('09:00') as number;
    const to = parseTimeOfDay('17:00') as number;
    expect(isWithinQuietHours(parseTimeOfDay('12:00') as number, from, to)).toBe(true);
    expect(isWithinQuietHours(parseTimeOfDay('20:00') as number, from, to)).toBe(false);
    expect(isWithinQuietHours(parseTimeOfDay('09:00') as number, from, from)).toBe(false);
  });
});

describe('NotificationDispatcher.dispatch', () => {
  it('enqueues every opted-in channel outside quiet hours', async () => {
    const { dispatcher, jobs } = makeDispatcher({ now: () => new Date('2026-09-24T09:00:00Z') });
    const result = await dispatcher.dispatch({
      userId: USER_ID,
      event: 'scan_completed',
      title: 'Scan finished',
      body: '3 findings',
    });
    expect(channels(jobs)).toEqual(['in_app', 'email', 'sms']);
    expect(result.enqueued).toEqual(['in_app', 'email', 'sms', 'push']);
    expect(result.suppressed).toEqual([]);
    // Push is recorded but has no provider yet: reported, never enqueued.
    expect(channels(jobs)).not.toContain('push');
    expect(result.enqueued).toContain('push');
    expect(result.enqueued).toHaveLength(4);
  });

  it('enqueues no SMS during quiet hours but keeps in-app and email', async () => {
    const { dispatcher, jobs } = makeDispatcher({
      quietHours: { enabled: true, from: '22:00', to: '06:00' },
    });
    const result = await dispatcher.dispatch({
      userId: USER_ID,
      event: 'weekly_digest',
      title: 'Your week',
      body: 'Summary',
    });
    expect(channels(jobs)).toEqual(['in_app', 'email']);
    expect(result.suppressed).toEqual(['sms', 'push']);
  });

  it('ignores quiet hours for a critical notification', async () => {
    const { dispatcher, jobs } = makeDispatcher({
      quietHours: { enabled: true, from: '22:00', to: '06:00' },
    });
    await dispatcher.dispatch({
      userId: USER_ID,
      event: 'credentials_changed',
      title: 'Deactivation requested',
      body: 'A staff member asked to leave',
      critical: true,
    });
    expect(channels(jobs)).toEqual(['in_app', 'email', 'sms']);
  });

  it('ignores channel opt-outs for a critical notification', async () => {
    const { dispatcher, jobs } = makeDispatcher({ toggles: ALL_OFF });
    await dispatcher.dispatch({
      userId: USER_ID,
      event: 'critical_finding',
      title: 'SEV-1',
      body: 'Critical finding',
      critical: true,
    });
    expect(channels(jobs)).toEqual(['in_app', 'email', 'sms']);
  });

  it('still respects opt-outs for an ordinary notification', async () => {
    const { dispatcher, jobs } = makeDispatcher({
      toggles: { inApp: true, email: false, sms: false, push: false },
    });
    const result = await dispatcher.dispatch({
      userId: USER_ID,
      event: 'job_awaiting_review',
      title: 'Needs review',
      body: 'Scan 42',
    });
    expect(channels(jobs)).toEqual(['in_app']);
    expect(result.suppressed).toEqual(['email', 'sms', 'push']);
  });

  it('sends no SMS when there is no phone number, even when critical', async () => {
    const { dispatcher, jobs } = makeDispatcher({ phone: null });
    await dispatcher.dispatch({
      userId: USER_ID,
      event: 'advisory_broadcast',
      title: 'SEV-1 advisory',
      body: 'Zero-day',
      critical: true,
    });
    expect(channels(jobs)).toEqual(['in_app', 'email']);
  });

  it('builds a payload per channel', async () => {
    const { dispatcher, jobs } = makeDispatcher({ now: () => new Date('2026-09-24T09:00:00Z') });
    await dispatcher.dispatch({
      userId: USER_ID,
      event: 'threat_level_change',
      title: 'Threat level raised',
      body: 'Now SEV-2',
    });
    const [inApp, email, sms] = jobs as [
      { channel: 'in_app'; userId: string; event: NotificationEvent; title: string; body: string },
      { channel: 'email'; to: string; template: string; vars: Record<string, string> },
      { channel: 'sms'; to: string; body: string },
    ];
    expect(inApp).toMatchObject({
      channel: 'in_app',
      userId: USER_ID,
      event: 'threat_level_change',
      title: 'Threat level raised',
      body: 'Now SEV-2',
    });
    expect(email).toMatchObject({
      channel: 'email',
      to: 'e.reed@vunvault.com',
      template: 'threat_level_change',
      vars: { title: 'Threat level raised', body: 'Now SEV-2' },
    });
    expect(sms).toMatchObject({ channel: 'sms', to: '+254712345678' });
    expect(sms.body).toBe('Threat level raised: Now SEV-2');
    expect(sms.body.length).toBeLessThanOrEqual(480);
  });

  it('does not treat a disabled quiet window as active', async () => {
    const { dispatcher, jobs } = makeDispatcher({
      quietHours: { enabled: false, from: '22:00', to: '06:00' },
    });
    await dispatcher.dispatch({
      userId: USER_ID,
      event: 'signin_new_device',
      title: 'New sign-in',
      body: 'Chrome on Mac',
    });
    expect(channels(jobs)).toContain('sms');
    expect(await dispatcher.isQuietHours(USER_ID, 'Africa/Nairobi')).toBe(false);
  });
});

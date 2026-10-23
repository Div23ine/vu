import { describe, expect, it } from 'vitest';
import {
  formatDayMonth,
  formatEta,
  formatLongDate,
  formatMonthYear,
  formatQueueStamp,
  formatRelativeActive,
  formatUtcClock,
  formatUtcStamp,
} from './format';

const utc = (iso: string): Date => new Date(iso);

describe('formatUtcClock', () => {
  it('renders HH:MM:SS with a UTC suffix', () => {
    expect(formatUtcClock(utc('2026-09-24T09:41:12Z'))).toBe('09:41:12 UTC');
  });

  it('zero-pads single-digit components', () => {
    expect(formatUtcClock(utc('2026-01-05T01:02:03Z'))).toBe('01:02:03 UTC');
  });
});

describe('formatUtcStamp', () => {
  it('renders the full UTC stamp', () => {
    expect(formatUtcStamp(utc('2026-09-24T09:41:12Z'))).toBe('2026-09-24 09:41:12 UTC');
  });
});

describe('formatDayMonth', () => {
  it('does not zero-pad the day', () => {
    expect(formatDayMonth(utc('2026-09-24T06:12:00Z'))).toBe('24 Sep');
    expect(formatDayMonth(utc('2026-09-04T06:12:00Z'))).toBe('4 Sep');
  });
});

describe('formatQueueStamp', () => {
  it('joins day, month and UTC clock with a middle dot', () => {
    expect(formatQueueStamp(utc('2026-09-24T06:12:00Z'))).toBe('24 Sep · 06:12 UTC');
  });
});

describe('formatLongDate', () => {
  it('renders day, month and year', () => {
    expect(formatLongDate(utc('2026-08-18T09:14:00Z'))).toBe('18 Aug 2026');
  });
});

describe('formatMonthYear', () => {
  it('renders month and year', () => {
    expect(formatMonthYear(utc('2024-03-01T00:00:00Z'))).toBe('Mar 2024');
  });
});

describe('formatEta', () => {
  it('splits minutes and zero-padded seconds', () => {
    expect(formatEta(252)).toBe('4m 12s');
    expect(formatEta(785)).toBe('13m 05s');
    expect(formatEta(107)).toBe('1m 47s');
    expect(formatEta(45)).toBe('0m 45s');
  });

  it('clamps negative and fractional input', () => {
    expect(formatEta(0)).toBe('0m 00s');
    expect(formatEta(-30)).toBe('0m 00s');
    expect(formatEta(60.9)).toBe('1m 00s');
  });
});

describe('formatRelativeActive', () => {
  const now = utc('2026-09-24T12:00:00Z');

  it('reads "Now · HH:MM" under two minutes', () => {
    expect(formatRelativeActive(utc('2026-09-24T11:59:12Z'), now)).toBe('Now · 11:59');
    expect(formatRelativeActive(now, now)).toBe('Now · 12:00');
  });

  it('reads minutes under an hour', () => {
    expect(formatRelativeActive(utc('2026-09-24T11:48:00Z'), now)).toBe('12 min ago');
    expect(formatRelativeActive(utc('2026-09-24T11:00:01Z'), now)).toBe('59 min ago');
  });

  it('reads hours under a day', () => {
    expect(formatRelativeActive(utc('2026-09-24T11:00:00Z'), now)).toBe('1 h ago');
    expect(formatRelativeActive(utc('2026-09-24T00:30:00Z'), now)).toBe('11 h ago');
  });

  it('reads "Yesterday · HH:MM" for the previous UTC calendar day', () => {
    // Only reachable once 24 h have elapsed: the "< 24 h" rule is evaluated first.
    expect(formatRelativeActive(utc('2026-09-23T11:00:00Z'), now)).toBe('Yesterday · 11:00');
  });

  it('prefers hours over "Yesterday" inside the 24 h window', () => {
    expect(formatRelativeActive(utc('2026-09-23T17:22:00Z'), now)).toBe('18 h ago');
  });

  it('reads days beyond yesterday', () => {
    expect(formatRelativeActive(utc('2026-09-22T11:00:00Z'), now)).toBe('2 days ago');
    expect(formatRelativeActive(utc('2026-07-26T12:00:00Z'), now)).toBe('60 days ago');
  });
});

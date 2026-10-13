/**
 * Date, time and ETA formatting.
 *
 * Every function is pure and every function reads UTC fields only: VUNVAULT
 * stores `timestamptz` and renders queue, audit and scan timestamps in UTC so
 * that an analyst in Nairobi and a client in Lagos read the same wall clock.
 */

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

/** Middle dot separator used across queue, audit and roster timestamps. */
const SEPARATOR = '·';

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function monthName(date: Date): string {
  const month = MONTHS[date.getUTCMonth()];
  if (month === undefined) {
    throw new RangeError(`Month index out of range: ${date.getUTCMonth()}`);
  }
  return month;
}

/** UTC start of the calendar day, used to detect "yesterday". */
function utcDayStart(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** `"09:41:12 UTC"` */
export function formatUtcClock(date: Date): string {
  return `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())} UTC`;
}

/** `"2026-09-24 09:41:12 UTC"` */
export function formatUtcStamp(date: Date): string {
  const day = `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
  return `${day} ${formatUtcClock(date)}`;
}

/** `"24 Sep"` — day is not zero-padded. */
export function formatDayMonth(date: Date): string {
  return `${date.getUTCDate()} ${monthName(date)}`;
}

/** `"24 Sep · 06:12 UTC"` */
export function formatQueueStamp(date: Date): string {
  const clock = `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;
  return `${formatDayMonth(date)} ${SEPARATOR} ${clock} UTC`;
}

/** `"18 Aug 2026"` */
export function formatLongDate(date: Date): string {
  return `${date.getUTCDate()} ${monthName(date)} ${date.getUTCFullYear()}`;
}

/** `"Mar 2024"` */
export function formatMonthYear(date: Date): string {
  return `${monthName(date)} ${date.getUTCFullYear()}`;
}

/**
 * Scan ETA: whole minutes plus zero-padded seconds.
 * `252 → "4m 12s"` · `785 → "13m 05s"` · `107 → "1m 47s"` · `45 → "0m 45s"`
 */
export function formatEta(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(total / 60)}m ${pad2(total % 60)}s`;
}

/**
 * Relative timestamp for a live queue row. Rules are evaluated in order:
 * under 2 minutes → `"Now · HH:MM"`; under an hour → `"N min ago"`;
 * under a day → `"N h ago"`; the previous UTC calendar day → `"Yesterday · HH:MM"`;
 * anything older → `"N days ago"`.
 */
export function formatRelativeActive(date: Date, now: Date): string {
  const elapsed = now.getTime() - date.getTime();
  const clock = `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}`;

  if (elapsed < 2 * MS_PER_MINUTE) {
    return `Now ${SEPARATOR} ${clock}`;
  }
  if (elapsed < 60 * MS_PER_MINUTE) {
    return `${Math.floor(elapsed / MS_PER_MINUTE)} min ago`;
  }
  if (elapsed < 24 * MS_PER_HOUR) {
    return `${Math.floor(elapsed / MS_PER_HOUR)} h ago`;
  }
  if (utcDayStart(now) - utcDayStart(date) === MS_PER_DAY) {
    return `Yesterday ${SEPARATOR} ${clock}`;
  }
  return `${Math.floor(elapsed / MS_PER_DAY)} days ago`;
}

import type { Severity } from './emit.js';

/**
 * Severity mapping (Task 87).
 *
 * One place decides what a finding's severity is, because four tools each speak
 * their own dialect: nuclei says `critical`, testssl says `HIGH`, nmap says
 * nothing at all (a risky open port is OUR judgement), and any of them may
 * supply a CVSS score instead.
 *
 * CVSS wins when present — a number beats a label — and the bands are the same
 * ones the platform uses everywhere else (`CVSS_BANDS` in the contracts):
 * ≥9.0 critical, ≥7.0 high, ≥4.0 medium, else low.
 */

export function severityFromCvss(cvss: number): Severity {
  if (!Number.isFinite(cvss)) return 'low';
  if (cvss >= 9.0) return 'critical';
  if (cvss >= 7.0) return 'high';
  if (cvss >= 4.0) return 'medium';
  return 'low';
}

/** Normalise a tool's own word. Anything unrecognised degrades to `info`. */
export function severityFromLabel(label: string | undefined | null): Severity {
  const value = (label ?? '').trim().toLowerCase();
  switch (value) {
    case 'critical':
    case 'crit':
      return 'critical';
    case 'high':
      return 'high';
    case 'medium':
    case 'med':
      return 'medium';
    case 'low':
      return 'low';
    case 'info':
    case 'informational':
      return 'info';
    default:
      return 'info';
  }
}

/**
 * Pick the worse of a label and a score.
 *
 * A tool that says `medium` about a CVSS 9.8 is wrong, and the score is the more
 * precise claim — but a tool that says `critical` with no score must not be
 * downgraded to `low`, so the answer is whichever ranks higher.
 */
const RANK: Record<Severity, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };

export function severityOf(
  label: string | undefined | null,
  cvss: number | undefined | null,
): Severity {
  const fromLabel = severityFromLabel(label);
  if (cvss === undefined || cvss === null || !Number.isFinite(cvss)) return fromLabel;
  const fromScore = severityFromCvss(cvss);
  return RANK[fromScore] > RANK[fromLabel] ? fromScore : fromLabel;
}

/** Parse a CVSS string from tool output; null when absent or malformed. */
export function parseCvss(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(0, Math.min(10, raw));
  }
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(10, value));
}

/** `CWE-319` stays; anything else is dropped rather than guessed at. */
export function normaliseCwe(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const match = /^CWE-\d+$/.exec(raw.trim());
  return match === null ? undefined : match[0];
}

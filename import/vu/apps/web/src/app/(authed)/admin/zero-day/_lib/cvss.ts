import type { FindingSeverity } from '@vunvault/contracts';
import { CVSS_BANDS, SEVERITY_CVSS_HINTS } from '@vunvault/contracts';

/**
 * CVSS helpers for the Zero-Day desk .
 *
 * The bands themselves live in `@vunvault/contracts` (`CVSS_BANDS`) because the
 * database enforces the same rule as a CHECK constraint — nothing here may
 * disagree with the API. This module only adds the two things the editor needs
 * on top: a score → severity projection for the auto-select, and a tolerant
 * parser for the free-text score input (`maxlength=4`, `inputmode=decimal`).
 *
 * Severity order is fixed (worst first) so `severityFromCvss` returns the most
 * severe band a score falls in, and so the picker renders the design's order.
 */

/** Worst first — the picker's display order and the projection's scan order. */
export const SEVERITY_ORDER: readonly FindingSeverity[] = [
  'critical',
  'high',
  'medium',
  'low',
] as const;

/** Title-case pill labels, verbatim from the reference markup. */
export const SEVERITY_LABELS: Record<FindingSeverity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

/**
 * The CVSS band a score falls in, or `null` when it falls in none.
 *
 * `null` is a real state, not an error: the bands deliberately leave gaps
 * (`0.0`, and the rounding seam between `8.9` and `9.0`), and a score in a gap
 * must NOT auto-select a severity — the operator picks one and the mismatch
 * warning stays quiet because there is no band to mismatch.
 */
export function severityFromCvss(cvss: number): FindingSeverity | null {
  if (!Number.isFinite(cvss)) return null;
  for (const severity of SEVERITY_ORDER) {
    const [min, max] = CVSS_BANDS[severity];
    if (cvss >= min && cvss <= max) return severity;
  }
  return null;
}

/** The `CVSS 9.0 – 10.0` hint line under each picker option. */
export function cvssBandHint(severity: FindingSeverity): string {
  return SEVERITY_CVSS_HINTS[severity];
}

/**
 * Parse the score input.
 *
 * Accepts only what the contract accepts — one optional decimal place, `0`–`10`
 * — so the editor never offers the API a value `AdvisoryDraftBody` would reject.
 * An empty string is `null` (the field is optional on a draft), and anything
 * malformed is `null` too: the caller decides whether that is "not filled in"
 * or "invalid" by looking at the raw string.
 */
export function parseCvss(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (!/^\d{1,2}(\.\d)?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || value > 10) return null;
  return value;
}

/** True when the raw input is a well-formed score (used to gate auto-select). */
export function isParsableCvss(raw: string): boolean {
  return parseCvss(raw) !== null;
}

/**
 * The platform threat level, as a pure function.
 *
 * FORMULA (documented because it is a policy decision, not an implementation
 * detail):
 *
 *   score = min(100, unpatchedCritical × 3
 *                    + weaponizedInWild × 1.2
 *                    + max(0, 100 − patchCoveragePercent) × 0.4)
 *
 *   level = 1 if score < 20
 *           2 if score < 40
 *           3 if score < 60
 *           4 if score < 80
 *           5 otherwise
 *
 * `activeZeroDays` is carried in the snapshot and shown on the dashboard, but it
 * does NOT move the score: a zero-day that is neither weaponised nor unpatched
 * against our clients is interest, not exposure. Changing that is a policy change
 * and belongs in this file, in one place.
 *
 * Worked example (the fixture the prototype shipped):
 *   unpatchedCritical 9, weaponizedInWild 37, patchCoveragePercent 62
 *   → 27 + 44.4 + 15.2 = 86.6 → LEVEL 5.
 * The prototype's "Level 4 / High" card is fixture data, not a formula output; the
 * formula wins.
 *
 * The maintenance worker (Layer L11) runs this hourly and writes a
 * `threat_level_snapshots` row. This API only reads snapshots and can compute the
 * level for tests and for a "what if" view.
 */

import {
  THREAT_ESCALATION_LEVEL,
  THREAT_LEVEL_LABELS,
  type ThreatLevelValue,
} from '@vunvault/contracts';

export interface ThreatInputs {
  unpatchedCritical: number;
  weaponizedInWild: number;
  /** Shown on the dashboard; deliberately not part of the score. */
  activeZeroDays: number;
  patchCoveragePercent: number;
}

export interface ThreatAssessment {
  /** 0–100, one decimal place. */
  score: number;
  level: ThreatLevelValue;
  label: string;
  /** At or above `THREAT_ESCALATION_LEVEL` the incident commander is paged. */
  escalates: boolean;
}

/** Points added per unpatched critical CVE we track. */
export const WEIGHT_UNPATCHED_CRITICAL = 3;
/** Points added per advisory seen weaponised in the wild. */
export const WEIGHT_WEAPONIZED = 1.2;
/** Points added per percentage point of missing patch coverage. */
export const WEIGHT_PATCH_GAP = 0.4;
/** The score is capped: a worse world cannot read as worse than the worst. */
export const SCORE_CAP = 100;

/** The level boundaries, as `< upper bound → level`. */
export const LEVEL_BOUNDS: ReadonlyArray<readonly [number, ThreatLevelValue]> = [
  [20, 1],
  [40, 2],
  [60, 3],
  [80, 4],
];

export function threatScore(inputs: ThreatInputs): number {
  const patchGap = Math.max(0, 100 - inputs.patchCoveragePercent);
  const raw =
    inputs.unpatchedCritical * WEIGHT_UNPATCHED_CRITICAL +
    inputs.weaponizedInWild * WEIGHT_WEAPONIZED +
    patchGap * WEIGHT_PATCH_GAP;
  const capped = Math.min(SCORE_CAP, raw);
  // One decimal place: the score is displayed, and a float's tail is noise.
  return Math.round(capped * 10) / 10;
}

export function levelForScore(score: number): ThreatLevelValue {
  for (const [bound, level] of LEVEL_BOUNDS) {
    if (score < bound) return level;
  }
  return 5;
}

export function computeThreatLevel(inputs: ThreatInputs): ThreatAssessment {
  const score = threatScore(inputs);
  const level = levelForScore(score);
  return {
    score,
    level,
    label: THREAT_LEVEL_LABELS[level],
    escalates: level >= THREAT_ESCALATION_LEVEL,
  };
}

/** `patchCoveragePercent` is clamped: a bad feed must not invert the level. */
export function normalisePatchCoverage(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.min(100, Math.max(0, percent));
}

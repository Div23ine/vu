import { describe, expect, it } from 'vitest';
import { THREAT_ESCALATION_LEVEL } from '@vunvault/contracts';
import {
  computeThreatLevel,
  levelForScore,
  normalisePatchCoverage,
  SCORE_CAP,
  threatScore,
  WEIGHT_PATCH_GAP,
  WEIGHT_UNPATCHED_CRITICAL,
  WEIGHT_WEAPONIZED,
  type ThreatInputs,
} from './threat-level.js';

/**
 * The threat-level formula.
 *
 * The fixture the prototype shipped — nine unpatched criticals, thirty-seven
 * weaponised, 62 % patch coverage — is LEVEL 5, not the "Level 4 / High" the card
 * showed. These tests pin the formula so that discrepancy can never come back.
 */

function inputs(overrides: Partial<ThreatInputs> = {}): ThreatInputs {
  return {
    unpatchedCritical: 0,
    weaponizedInWild: 0,
    activeZeroDays: 0,
    patchCoveragePercent: 100,
    ...overrides,
  };
}

describe('the documented example', () => {
  it('scores 27 + 44.4 + 15.2 = 86.6 and lands on level 5', () => {
    const result = computeThreatLevel(
      inputs({ unpatchedCritical: 9, weaponizedInWild: 37, patchCoveragePercent: 62 }),
    );
    expect(9 * WEIGHT_UNPATCHED_CRITICAL).toBe(27);
    expect(37 * WEIGHT_WEAPONIZED).toBeCloseTo(44.4, 10);
    expect((100 - 62) * WEIGHT_PATCH_GAP).toBeCloseTo(15.2, 10);
    expect(result.score).toBe(86.6);
    expect(result.level).toBe(5);
    expect(result.label).toBe('Severe');
    expect(result.escalates).toBe(true);
  });
});

describe('level boundaries', () => {
  const cases: Array<[number, 1 | 2 | 3 | 4 | 5]> = [
    [0, 1],
    [19.9, 1],
    [20, 2],
    [39.9, 2],
    [40, 3],
    [59.9, 3],
    [60, 4],
    [79.9, 4],
    [80, 5],
    [100, 5],
  ];
  for (const [score, level] of cases) {
    it(`score ${score} → level ${level}`, () => {
      expect(levelForScore(score)).toBe(level);
    });
  }

  it('escalates from level 4 upwards, and not below', () => {
    expect(THREAT_ESCALATION_LEVEL).toBe(4);
    expect(computeThreatLevel(inputs({ unpatchedCritical: 20 })).escalates).toBe(true); // 60 → 4
    expect(computeThreatLevel(inputs({ unpatchedCritical: 19 })).escalates).toBe(false); // 57 → 3
  });
});

describe('the score itself', () => {
  it('caps at 100, however bad the inputs get', () => {
    expect(SCORE_CAP).toBe(100);
    expect(threatScore(inputs({ unpatchedCritical: 1000 }))).toBe(100);
    expect(threatScore(inputs({ weaponizedInWild: 1000, patchCoveragePercent: 0 }))).toBe(100);
  });

  it('counts a patch gap only up to 100 points', () => {
    expect(threatScore(inputs({ patchCoveragePercent: 0 }))).toBe(40);
    expect(threatScore(inputs({ patchCoveragePercent: 100 }))).toBe(0);
    // Coverage above 100 is a bad feed, not negative exposure.
    expect(threatScore(inputs({ patchCoveragePercent: 150 }))).toBe(0);
  });

  it('is not moved by the number of active zero-days', () => {
    const without = computeThreatLevel(inputs({ unpatchedCritical: 3, activeZeroDays: 0 }));
    const withMany = computeThreatLevel(inputs({ unpatchedCritical: 3, activeZeroDays: 40 }));
    expect(without.score).toBe(withMany.score);
    expect(without.level).toBe(withMany.level);
  });

  it('rounds to one decimal place', () => {
    // 7 × 1.2 = 8.4 exactly in decimal, 8.399999… in binary.
    expect(threatScore(inputs({ weaponizedInWild: 7 }))).toBe(8.4);
  });

  it('clamps a nonsense coverage figure instead of inverting the level', () => {
    expect(normalisePatchCoverage(Number.NaN)).toBe(0);
    expect(normalisePatchCoverage(-20)).toBe(0);
    expect(normalisePatchCoverage(120)).toBe(100);
    expect(normalisePatchCoverage(62)).toBe(62);
  });
});

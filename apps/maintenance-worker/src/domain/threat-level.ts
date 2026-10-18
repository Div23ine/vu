import type { Logger, MaintenanceRepo, Summary, ThreatCounts } from '../ports.js';

/**
 * `threat_level` (Task 91) — the hourly threat posture snapshot.
 *
 * Every input is counted from PUBLISHED advisories only: a draft on an
 * analyst's desk is not a threat to a client, and a retracted advisory stops
 * counting immediately. The counts map 1:1 onto `threat_level_snapshots`,
 * which backs the Command Center threat gauge and its history sparkline.
 *
 * `threatsBlockedYtd` has no producer table in v1 and is stored as 0 with a
 * TODO(backend-contract) marker — the Command Center fixture number is
 * prototype copy and must not be invented here (Task 76).
 *
 * The level formula is a deliberate, documented planner decision — the whole
 * point of a snapshot history is that the same inputs always produce the same
 * level, so an operator can read a jump in the chart as a change in the world,
 * not a change in the algorithm:
 *
 *   level = 1
 *         + 2 if any published advisory is weaponized in the wild
 *         + 1 if any critical CVE is unpatched
 *         + 1 if ten or more critical CVEs are tracked
 *   clamped to [1, 5]
 */

export function computeThreatLevel(counts: ThreatCounts): number {
  let level = 1;
  if (counts.weaponizedInWild > 0) level += 2;
  if (counts.unpatchedCritical > 0) level += 1;
  if (counts.criticalCves >= 10) level += 1;
  return Math.min(5, Math.max(1, level));
}

export interface ThreatLevelDeps {
  repo: Pick<MaintenanceRepo, 'countAdvisoryThreats' | 'insertThreatSnapshot'>;
  clock: { now(): Date };
  logger: Logger;
}

export async function runThreatLevel(deps: ThreatLevelDeps): Promise<Summary> {
  const counts = await deps.repo.countAdvisoryThreats();
  const level = computeThreatLevel(counts);
  const computedAt = deps.clock.now();

  await deps.repo.insertThreatSnapshot({
    level,
    ...counts,
    // TODO(backend-contract): no producer table exists for blocked threats.
    threatsBlockedYtd: 0,
    computedAt,
  });

  deps.logger.info('threat level snapshot written', { level, ...counts });
  return { task: 'threat_level', affected: 1, detail: { level, ...counts } };
}

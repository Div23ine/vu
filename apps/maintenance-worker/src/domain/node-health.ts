import type { Logger, MaintenanceRepo, Summary } from '../ports.js';

/**
 * `node_health` (Task 91) — the sensor-fleet heartbeat sweep.
 *
 * Nodes beat through the API (`/api/v1/nodes/heartbeat`, 30 s max skew, at
 * most 6 beats/minute). The sweep is the OTHER half: a node that stops beating
 * must stop being shown as operational on the Command Center.
 *
 * Rules:
 *  - stale = `last_heartbeat_at` older than the cutoff (or never beat and
 *    created before the cutoff);
 *  - each stale sweep increments `missed_heartbeats`; at `HEARTBEAT_MISS_LIMIT`
 *    consecutive misses the node goes `offline` — one missed window is a
 *    network blip, not an outage;
 *  - a node that is `offline` and beats again recovers to `operational` with
 *    the counter reset — recovery is automatic, demotion is graduated;
 *  - nodes already `offline` are NOT swept again: their counter is frozen at
 *    the limit, so `missed_heartbeats` stays meaningful ("how long since we
 *    gave up" is answered by `last_heartbeat_at`, not by this number).
 */

export interface NodeHealthDeps {
  repo: Pick<MaintenanceRepo, 'sweepStaleNodes' | 'recoverNodes'>;
  clock: { now(): Date };
  staleMs: number;
  missLimit: number;
  logger: Logger;
}

export async function runNodeHealth(deps: NodeHealthDeps): Promise<Summary> {
  const cutoff = new Date(deps.clock.now().getTime() - deps.staleMs);

  const swept = await deps.repo.sweepStaleNodes(cutoff, deps.missLimit);
  const recovered = await deps.repo.recoverNodes(cutoff);

  deps.logger.info('node health swept', {
    degraded: swept.degraded,
    offline: swept.offline,
    recovered,
  });
  return {
    task: 'node_health',
    affected: swept.degraded + swept.offline + recovered,
    detail: { degraded: swept.degraded, offline: swept.offline, recovered },
  };
}

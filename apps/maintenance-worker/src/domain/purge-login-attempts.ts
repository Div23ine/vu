import type { Logger, MaintenanceRepo, Summary } from '../ports.js';

/**
 * `purge_login_attempts` (Task 92) — privacy retention, run nightly.
 *
 * `login_attempts` is operational telemetry behind the 5-failure lockout, not
 * the audit log: the AUDIT entries about authentication live in the hash chain
 * forever (7-year WORM), while the raw attempt rows — which carry IP addresses
 * — are deleted after the retention window. The schema comment promises 30
 * days; the env default matches it.
 */

export interface PurgeLoginAttemptsDeps {
  repo: Pick<MaintenanceRepo, 'purgeLoginAttempts'>;
  clock: { now(): Date };
  retentionDays: number;
  logger: Logger;
}

export async function runPurgeLoginAttempts(deps: PurgeLoginAttemptsDeps): Promise<Summary> {
  const cutoff = new Date(deps.clock.now().getTime() - deps.retentionDays * 24 * 60 * 60 * 1000);
  const deleted = await deps.repo.purgeLoginAttempts(cutoff);
  deps.logger.info('login attempts purged', { deleted, cutoff: cutoff.toISOString() });
  return { task: 'purge_login_attempts', affected: deleted };
}

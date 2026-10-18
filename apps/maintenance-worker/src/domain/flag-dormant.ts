import type { Logger, MaintenanceRepo, Summary } from '../ports.js';

/**
 * `flag_dormant_accounts` (Task 92) — nightly.
 *
 * A CLIENT account with no activity for `DORMANT_AFTER_DAYS` (default 90) is
 * flagged `dormant`: the seat stops counting as active for access reviews, and
 * the account can be restored by a single sign-in review.
 *
 * Staff are deliberately NEVER auto-flagged. Staff access is governed by the
 * human access-review cycle (`access_review_due`), and silently dormating an
 * analyst who is between engagements would hide them from the review queue —
 * the opposite of the control's purpose.
 */

export interface FlagDormantDeps {
  repo: Pick<MaintenanceRepo, 'flagDormantClients'>;
  clock: { now(): Date };
  dormantAfterDays: number;
  logger: Logger;
}

export async function runFlagDormantAccounts(deps: FlagDormantDeps): Promise<Summary> {
  const cutoff = new Date(deps.clock.now().getTime() - deps.dormantAfterDays * 24 * 60 * 60 * 1000);
  const flagged = await deps.repo.flagDormantClients(cutoff);
  deps.logger.info('dormant client accounts flagged', { flagged });
  return { task: 'flag_dormant_accounts', affected: flagged };
}

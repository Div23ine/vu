import type { Logger, MaintenanceRepo, Summary } from '../ports';

/**
 * `stale_signups` (Task 92) — nightly.
 *
 * Signup is a verified flow (Task 40d): the mailbox OTP activates the profile.
 * A `pending_verification` profile older than `SIGNUP_STALE_DAYS` (default 7)
 * is an abandoned signup — the address was never proven — and decays to
 * `dormant` so it stops counting against active-user metrics.
 *
 * Planner decision: the enum has no `expired` state and the worker holds no
 * Supabase service-role key, so the auth user itself is left to the provider's
 * own cleanup; the profile row is the platform's record and it decays here.
 * Nothing is deleted: an audit trail entry may still resolve its actor.
 */

export interface StaleSignupsDeps {
  repo: Pick<MaintenanceRepo, 'flagStaleSignups'>;
  clock: { now(): Date };
  staleDays: number;
  logger: Logger;
}

export async function runStaleSignups(deps: StaleSignupsDeps): Promise<Summary> {
  const cutoff = new Date(deps.clock.now().getTime() - deps.staleDays * 24 * 60 * 60 * 1000);
  const flagged = await deps.repo.flagStaleSignups(cutoff);
  deps.logger.info('stale signups decayed to dormant', { flagged });
  return { task: 'stale_signups', affected: flagged };
}

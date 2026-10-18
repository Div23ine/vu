import type { Logger, MaintenanceRepo, Summary } from '../ports.js';

/**
 * `expire_invitations` (Task 92) — hourly.
 *
 * A staff invitation is valid for 72 hours (the API sets `expires_at`); this
 * sweep flips the row to `expired` so the roster and the accept route agree
 * with reality even though the accept route ALSO checks the deadline. The
 * sweep is what makes the stored status trustworthy for humans reading it.
 */

export interface ExpireInvitationsDeps {
  repo: Pick<MaintenanceRepo, 'expireInvitations'>;
  clock: { now(): Date };
  graceHours: number;
  logger: Logger;
}

export async function runExpireInvitations(deps: ExpireInvitationsDeps): Promise<Summary> {
  const cutoff = new Date(deps.clock.now().getTime() - deps.graceHours * 60 * 60 * 1000);
  const expired = await deps.repo.expireInvitations(cutoff);
  deps.logger.info('invitations expired', { expired });
  return { task: 'expire_invitations', affected: expired };
}

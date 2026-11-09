import type {
  Clock,
  Logger,
  MaintenanceRepo,
  Summary,
  UampCheckProducer,
} from '../ports';

/** Queue due UAMP monitors; the producer's stable job id makes repeated ticks safe. */
export async function runUampChecks(deps: {
  repo: MaintenanceRepo;
  uamp: UampCheckProducer;
  clock: Clock;
  logger: Logger;
}): Promise<Summary> {
  const findDue = deps.repo.listDueUampMonitors;
  if (findDue === undefined) {
    throw new Error('maintenance_repo_missing_uamp_scheduler_query');
  }

  const due = await findDue.call(deps.repo, 100);
  let enqueued = 0;
  for (const monitor of due) {
    await deps.uamp.enqueue(monitor);
    enqueued += 1;
  }

  deps.logger.info('uamp due monitors enqueued', {
    count: enqueued,
    scheduledAt: deps.clock.now().toISOString(),
  });
  return { task: 'uamp_checks', affected: enqueued };
}

import type { Logger, MaintenanceRepo, NotifyEnqueuer, Summary } from '../ports.js';

/**
 * `scheduled_publish` (Task 91) — content that was approved and scheduled goes
 * live on time, without a human clicking at 06:00.
 *
 * The flip is one UPDATE … RETURNING in the repo (`status='scheduled' AND
 * scheduled_for <= now` → `published`, `published_at = now`), which makes the
 * transition atomic and the worker horizontally safe: two replicas racing on
 * the same minute each get a disjoint RETURNING set, so no item is published
 * twice and no author is e-mailed twice for the same item — the notify jobId
 * `scheduled_publish:<itemId>` is the belt to that brace (BullMQ ignores a
 * duplicate id).
 *
 * Authors with a known e-mail get the `content_publish` template — the SAME
 * template the API's moderation routes use when a human publishes, so an
 * author cannot tell (and does not need to tell) which path published their
 * piece.
 */

export interface ScheduledPublishDeps {
  repo: Pick<MaintenanceRepo, 'publishScheduledContent'>;
  notify: NotifyEnqueuer;
  clock: { now(): Date };
  logger: Logger;
}

export async function runScheduledPublish(deps: ScheduledPublishDeps): Promise<Summary> {
  const published = await deps.repo.publishScheduledContent(deps.clock.now());

  let notified = 0;
  for (const item of published) {
    if (item.authorEmail === null) continue;
    try {
      await deps.notify.enqueueEmail(
        {
          to: item.authorEmail,
          template: 'content_publish',
          vars: { title: item.title, slugPath: item.slugPath, action: 'publish' },
        },
        `scheduled_publish:${item.id}`,
      );
      notified += 1;
    } catch (error) {
      // The item IS published — the queue being down must not roll that back,
      // and the next sweep will not re-publish it either (status already
      // moved). The missed courtesy mail is logged, not retried.
      deps.logger.warn('scheduled-publish notification could not be queued', {
        contentItemId: item.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  deps.logger.info('scheduled content published', { published: published.length, notified });
  return {
    task: 'scheduled_publish',
    affected: published.length,
    detail: { published: published.length, notified },
  };
}

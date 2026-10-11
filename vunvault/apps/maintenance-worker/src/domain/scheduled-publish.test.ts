import { describe, expect, it, vi } from 'vitest';
import { runScheduledPublish } from './scheduled-publish';
import type { Logger, MaintenanceRepo, NotifyEnqueuer, PublishedContentRow } from '../ports';

function makeLogger(): Logger & { warnings: string[] } {
  const warnings: string[] = [];
  return {
    warnings,
    info: () => undefined,
    warn: (message) => warnings.push(message),
    error: () => undefined,
    debug: () => undefined,
  };
}

const ITEM_A: PublishedContentRow = {
  id: 'aaaaaaaa-0000-4000-8000-000000000001',
  title: 'Zero-trust in SACCOs',
  slugPath: 'zero-trust-in-saccos',
  authorEmail: 'author@vunvault.com',
};
const ITEM_B: PublishedContentRow = {
  id: 'bbbbbbbb-0000-4000-8000-000000000002',
  title: 'Threat intel Q3',
  slugPath: 'threat-intel-q3',
  authorEmail: null,
};

function makeHarness(options: { published?: PublishedContentRow[]; enqueueFails?: boolean } = {}) {
  const published = options.published ?? [];
  const publishCalls: Date[] = [];
  const enqueued: Array<{ payload: { to: string; template: string; vars: Record<string, string> }; jobId: string }> = [];

  const repo = {
    async publishScheduledContent(now: Date) {
      publishCalls.push(now);
      return published;
    },
  } as Pick<MaintenanceRepo, 'publishScheduledContent'>;

  const notify: NotifyEnqueuer = {
    async enqueueEmail(payload, jobId) {
      if (options.enqueueFails === true) throw new Error('queue down');
      enqueued.push({ payload, jobId });
    },
  };

  return { repo, notify, publishCalls, enqueued };
}

const NOW = new Date('2026-09-24T09:05:00.000Z');

describe('runScheduledPublish', () => {
  it('publishes what is due and e-mails only authors with an address', async () => {
    const h = makeHarness({ published: [ITEM_A, ITEM_B] });
    const summary = await runScheduledPublish({
      repo: h.repo,
      notify: h.notify,
      clock: { now: () => NOW },
      logger: makeLogger(),
    });

    expect(h.publishCalls).toEqual([NOW]);
    expect(h.enqueued).toHaveLength(1);
    expect(h.enqueued[0]?.payload).toEqual({
      to: 'author@vunvault.com',
      template: 'content_publish',
      vars: { title: 'Zero-trust in SACCOs', slugPath: 'zero-trust-in-saccos', action: 'publish' },
    });
    // The stable jobId is the double-publish guard.
    expect(h.enqueued[0]?.jobId).toBe(`scheduled_publish:${ITEM_A.id}`);
    expect(summary).toEqual({
      task: 'scheduled_publish',
      affected: 2,
      detail: { published: 2, notified: 1 },
    });
  });

  it('does nothing on an empty sweep', async () => {
    const h = makeHarness();
    const summary = await runScheduledPublish({
      repo: h.repo,
      notify: h.notify,
      clock: { now: () => NOW },
      logger: makeLogger(),
    });
    expect(summary.affected).toBe(0);
    expect(h.enqueued).toEqual([]);
  });

  it('keeps the publish when the notification queue is down', async () => {
    const h = makeHarness({ published: [ITEM_A], enqueueFails: true });
    const logger = makeLogger();
    const summary = await runScheduledPublish({
      repo: h.repo,
      notify: h.notify,
      clock: { now: () => NOW },
      logger,
    });

    // Published (the repo call happened), courtesy mail lost, run succeeded.
    expect(summary).toEqual({ task: 'scheduled_publish', affected: 1, detail: { published: 1, notified: 0 } });
    expect(logger.warnings).toContain('scheduled-publish notification could not be queued');
  });

  it('propagates a repo failure so the queue retries the sweep', async () => {
    const repo = {
      publishScheduledContent: vi.fn(async () => {
        throw new Error('db down');
      }),
    } as unknown as Pick<MaintenanceRepo, 'publishScheduledContent'>;

    await expect(
      runScheduledPublish({
        repo,
        notify: { enqueueEmail: vi.fn() },
        clock: { now: () => NOW },
        logger: makeLogger(),
      }),
    ).rejects.toThrow('db down');
  });
});

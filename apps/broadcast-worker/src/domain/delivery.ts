import { matchClients } from '@vunvault/lib/advisory-matching';
import type { BroadcastKind, BroadcastProgressEvent, BroadcastStatus } from '@vunvault/contracts';
import { broadcastProgressChannel } from '@vunvault/contracts';
import { emailFor, inAppNotification, smsFor } from './templates';
import type {
  BroadcastRepo,
  Clock,
  CounterDelta,
  EmailSender,
  Logger,
  NotifyEnqueuer,
  OrgContact,
  ProgressBus,
  SmsSender,
} from '../ports';

/**
 * Broadcast delivery (Task 89).
 *
 * One job = one `advisory_broadcasts` row. The service resolves the audience
 * with the SAME matching the editor's estimate used (`@vunvault/lib/
 * advisory-matching` — one copy of "who is affected", not two), then delivers:
 *
 *  - **dashboards** — an in-app notification per contact, enqueued onto the
 *    `notify` queue with a stable job id (`broadcast:<id>:in_app:<userId>`), so
 *    a redelivered broadcast job cannot double-post to an inbox. An org counts
 *    as delivered when every one of its users enqueued cleanly.
 *  - **e-mail** — sent directly (Resend) so the row's counters report actual
 *    deliveries, not enqueues. Every kind delivers e-mail.
 *  - **SMS** — sent directly (Africa's Talking / Twilio router), INITIAL
 *    broadcasts only: a rebroadcast must not re-page phones, and a retraction
 *    is e-mail/in-app. (Planner decision, spec-task89.)
 *
 * Failure policy: a per-contact delivery failure increments `failed` and the
 * batch continues — one dead mailbox must not stop a SEV-1 reaching everyone
 * else. Only infrastructure failures (repo unreachable) throw, which lets
 * BullMQ retry the job; delivery is therefore at-least-once, with the row
 * status (`sent`/`failed`) as the idempotency guard against a full re-run.
 *
 * Progress: counters are flushed to the row every `flushEvery` deliveries (and
 * at the end), and a `BroadcastProgressEvent` is published at most every
 * `throttleMs` — except the first and the final frame, which always go out,
 * because Task 94's UI treats the final frame as the completion signal.
 */

export interface DeliveryDeps {
  repo: BroadcastRepo;
  notify: NotifyEnqueuer;
  email: EmailSender;
  sms: SmsSender;
  bus: ProgressBus;
  clock: Clock;
  logger: Logger;
  throttleMs: number;
  flushEvery: number;
}

export interface DeliveryJob {
  broadcastId: string;
  advisoryId: string;
  kind: BroadcastKind;
}

export interface DeliverySummary {
  broadcastId: string;
  kind: BroadcastKind;
  /** `skipped` = the row was missing or already terminal; nothing was sent. */
  status: BroadcastStatus | 'skipped';
  audienceOrgs: number;
  contacts: number;
  sent: { dashboards: number; email: number; sms: number };
  failed: number;
}

/** Per-contact sends run with this bounded concurrency (no new dependency). */
export const SEND_CONCURRENCY = 5;

/** Run `fn` over `items` with at most `limit` promises in flight. `fn` must not throw. */
export async function mapPool<T>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const current = index;
      index += 1;
      if (current >= items.length) return;
      await fn(items[current] as T);
    }
  });
  await Promise.all(lanes);
}

/** Dedupe by user, then a deterministic order so progress and tests agree. */
export function dedupeContacts(contacts: readonly OrgContact[]): OrgContact[] {
  const seen = new Set<string>();
  const unique: OrgContact[] = [];
  for (const contact of contacts) {
    if (seen.has(contact.userId)) continue;
    seen.add(contact.userId);
    unique.push(contact);
  }
  unique.sort((a, b) =>
    a.orgId === b.orgId ? a.email.localeCompare(b.email) : a.orgId.localeCompare(b.orgId),
  );
  return unique;
}

export class BroadcastDeliveryService {
  private readonly deps: DeliveryDeps;

  constructor(deps: DeliveryDeps) {
    this.deps = deps;
  }

  async deliver(job: DeliveryJob): Promise<DeliverySummary> {
    const { repo, logger, clock } = this.deps;

    const row = await repo.getBroadcast(job.broadcastId);
    if (row === null) {
      logger.warn('broadcast row is missing; nothing to deliver', {
        broadcastId: job.broadcastId,
      });
      return emptySummary(job, 'skipped');
    }
    if (row.status === 'sent' || row.status === 'failed') {
      // Idempotency guard: BullMQ may redeliver a job whose row already
      // finished (a crash after `finish` but before the queue ack, say).
      logger.info('broadcast already finished; skipping', {
        broadcastId: row.id,
        status: row.status,
      });
      return emptySummary(job, 'skipped');
    }

    const advisory = await repo.getAdvisory(row.advisoryId);
    if (advisory === null) {
      // A missing advisory is a data bug, not a contact-level failure. Throw so
      // the queue retries; do NOT mark the row failed — after the attempts are
      // exhausted the job rests in failed history and the row stays visible to
      // the outbox sweep.
      logger.error('advisory row is missing for a queued broadcast', {
        broadcastId: row.id,
      });
      throw new Error('advisory_missing');
    }

    const startedAt = clock.now();
    await repo.markSending(row.id, startedAt);

    // A retraction takes the advisory off the portal FIRST: a client who clicks
    // through from the retraction e-mail must not find it still published.
    if (job.kind === 'retraction') {
      await repo.retractAdvisory(row.advisoryId, clock.now());
    }

    // ------------------------------------------------------------- audience
    const assets = await repo.listClientAssets();
    const { orgIds } = matchClients(advisory.scope, assets);
    const contacts = dedupeContacts(await repo.listOrgContacts(orgIds));

    const run = this.beginRun(row, job.kind);
    await run.publish('sending', true);

    const kind = job.kind;
    const notification = inAppNotification(advisory, kind);
    const email = emailFor(advisory, kind);

    // ------------------------------------------------- in-app (all kinds)
    // Group by org preserving match order; an org counts once every user
    // enqueued cleanly.
    const byOrg = new Map<string, OrgContact[]>();
    for (const orgId of orgIds) byOrg.set(orgId, []);
    for (const contact of contacts) {
      byOrg.get(contact.orgId)?.push(contact);
    }
    for (const [orgId, members] of byOrg) {
      let orgClean = members.length > 0;
      for (const member of members) {
        try {
          await this.deps.notify.enqueueInApp(
            {
              userId: member.userId,
              event: 'advisory_broadcast',
              title: notification.title,
              body: notification.body,
            },
            `broadcast:${row.id}:in_app:${member.userId}`,
          );
        } catch (error) {
          orgClean = false;
          run.count('failed', 1);
          this.deps.logger.warn('in-app enqueue failed', {
            broadcastId: row.id,
            orgId,
            message: error instanceof Error ? error.message : String(error),
          });
        }
        await run.tick();
      }
      if (orgClean) run.count('sentDashboards', 1);
    }

    // ------------------------------------------------------ e-mail (all kinds)
    await mapPool(contacts, SEND_CONCURRENCY, async (contact) => {
      try {
        await this.deps.email.send({ to: contact.email, subject: email.subject, text: email.text });
        run.count('sentEmail', 1);
      } catch (error) {
        run.count('failed', 1);
        this.deps.logger.warn('broadcast e-mail failed', {
          broadcastId: row.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
      await run.tick();
    });

    // ------------------------------------------- SMS (initial broadcasts only)
    if (kind === 'initial') {
      const smsBody = smsFor(advisory);
      const reachable = contacts.filter((contact) => contact.phone !== null);
      await mapPool(reachable, SEND_CONCURRENCY, async (contact) => {
        try {
          await this.deps.sms.send({ to: contact.phone as string, body: smsBody });
          run.count('sentSms', 1);
        } catch (error) {
          run.count('failed', 1);
          this.deps.logger.warn('broadcast SMS failed', {
            broadcastId: row.id,
            message: error instanceof Error ? error.message : String(error),
          });
        }
        await run.tick();
      });
    }

    // A retraction flips the advisory before delivery (see above).

    // ---------------------------------------------------------------- finish
    await run.flush(true);
    const sentTotal = run.totals.sentDashboards + run.totals.sentEmail + run.totals.sentSms;
    const finalStatus: 'sent' | 'failed' =
      sentTotal === 0 && run.totals.failed > 0 ? 'failed' : 'sent';
    await repo.finish(row.id, finalStatus, clock.now());
    await run.publish(finalStatus, true);

    const summary: DeliverySummary = {
      broadcastId: row.id,
      kind,
      status: finalStatus,
      audienceOrgs: orgIds.length,
      contacts: contacts.length,
      sent: {
        dashboards: run.totals.sentDashboards,
        email: run.totals.sentEmail,
        sms: run.totals.sentSms,
      },
      failed: run.totals.failed,
    };
    this.deps.logger.info('broadcast delivered', {
      broadcastId: summary.broadcastId,
      kind: summary.kind,
      status: summary.status,
      ...summary.sent,
      failed: summary.failed,
    });
    return summary;
  }

  /**
   * Per-delivery mutable state: counters, the unflushed delta, and the publish
   * throttle. One instance per `deliver()` call — two broadcasts may deliver
   * concurrently (`BROADCAST_CONCURRENCY` > 1) and must not share counters.
   */
  private beginRun(
    row: {
      id: string;
      advisoryId: string;
      audienceDashboards: number;
      emailContacts: number;
      smsContacts: number;
    },
    kind: BroadcastKind,
  ): RunState {
    const deps = this.deps;
    const totals: Required<CounterDelta> = {
      sentDashboards: 0,
      sentEmail: 0,
      sentSms: 0,
      failed: 0,
    };
    let pending: CounterDelta = {};
    let sinceFlush = 0;
    let lastPublish = Number.NEGATIVE_INFINITY;

    const publish = async (status: BroadcastStatus, force: boolean): Promise<void> => {
      const now = deps.clock.now().getTime();
      if (!force && now - lastPublish < deps.throttleMs) return;
      lastPublish = now;
      const event: BroadcastProgressEvent = {
        type: 'progress',
        broadcastId: row.id,
        advisoryId: row.advisoryId,
        kind,
        status,
        audience: {
          dashboards: row.audienceDashboards,
          email: row.emailContacts,
          sms: row.smsContacts,
        },
        sent: {
          dashboards: totals.sentDashboards,
          email: totals.sentEmail,
          sms: totals.sentSms,
        },
        failed: totals.failed,
        updatedAt: deps.clock.now().toISOString(),
      };
      try {
        await deps.bus.publish(event);
      } catch (error) {
        // Progress is telemetry: a dead Pub/Sub must never stop a delivery.
        deps.logger.warn('progress publish failed', {
          broadcastId: row.id,
          channel: broadcastProgressChannel(row.id),
          message: error instanceof Error ? error.message : String(error),
        });
      }
    };

    const flush = async (force: boolean): Promise<void> => {
      if (!force && sinceFlush < deps.flushEvery) return;
      sinceFlush = 0;
      const delta = pending;
      pending = {};
      const hasDelta = Object.values(delta).some((value) => value !== undefined && value > 0);
      if (!hasDelta) return;
      await deps.repo.incrementCounters(row.id, delta);
    };

    return {
      totals,
      count(field: keyof CounterDelta, by: number): void {
        totals[field] += by;
        pending[field] = (pending[field] ?? 0) + by;
      },
      async tick(): Promise<void> {
        sinceFlush += 1;
        await flush(false);
        await publish('sending', false);
      },
      flush,
      publish,
    };
  }
}

interface RunState {
  totals: Required<CounterDelta>;
  count(field: keyof CounterDelta, by: number): void;
  tick(): Promise<void>;
  flush(force: boolean): Promise<void>;
  publish(status: BroadcastStatus, force: boolean): Promise<void>;
}

function emptySummary(job: DeliveryJob, status: DeliverySummary['status']): DeliverySummary {
  return {
    broadcastId: job.broadcastId,
    kind: job.kind,
    status,
    audienceOrgs: 0,
    contacts: 0,
    sent: { dashboards: 0, email: 0, sms: 0 },
    failed: 0,
  };
}

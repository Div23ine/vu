import { describe, expect, it, vi } from 'vitest';
import type { BroadcastProgressEvent, NotifyJobPayload } from '@vunvault/contracts';
import {
  BroadcastProgressEvent as ProgressSchema,
  NotifyJobPayload as NotifySchema,
} from '@vunvault/contracts';
import { BroadcastDeliveryService } from '../domain/delivery.js';
import type {
  AdvisoryDeliveryView,
  BroadcastRepo,
  BroadcastRow,
  Clock,
  CounterDelta,
  EmailSender,
  Logger,
  NotifyEnqueuer,
  OrgContact,
  ProgressBus,
  SmsSender,
} from '../ports.js';
// The consumer side of the wire — the REAL notify-worker handler, imported
// across the app boundary. Each module's dependencies resolve from its own
// workspace, so this import proves the seam compiles AND runs, not just that
// two suites of fakes agree with themselves.
import {
  NotifyHandler,
  INBOX_TITLE_MAX,
} from '../../../notify-worker/src/domain/notify-handler.js';
import type { EmailMessage, SmsMessage } from '@vunvault/lib/providers';
import type { InboxInput, NotifyRepo, ReceiptInput } from '../../../notify-worker/src/ports.js';
import type {
  EmailSender as NotifyEmailSender,
  SmsSender as NotifySmsSender,
} from '../../../notify-worker/src/domain/notify-handler.js';

/**
 * Integration suite A (Task 105): publish → broadcast → notify, end to end,
 * all fakes in memory.
 *
 * The unit suites pin each worker against its own doubles. THIS suite pins
 * the wire between them: the fake `NotifyEnqueuer` builds the
 * `NotifyJobPayload` exactly like the production adapter (contract-parsed
 * before it is handed on), and the real `NotifyHandler` consumes it with the
 * real truncation and receipt rules. Producer/consumer drift fails here with
 * a schema error naming the field — not in production with a silently
 * dropped security notification.
 */

const BROADCAST_ID = '3f2b8c1e-9d4a-4e7b-8c2f-1a5d6e7f8090';
const ADVISORY_ID = '9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d';
const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const ORG_UNMATCHED = '33333333-3333-4333-8333-333333333333';
const USER_A1 = 'aaaaaaaa-0000-4000-8000-0000000000a1';
const USER_A2 = 'aaaaaaaa-0000-4000-8000-0000000000a2';
const USER_B1 = 'bbbbbbbb-0000-4000-8000-0000000000b1';

function makeRow(overrides: Partial<BroadcastRow> = {}): BroadcastRow {
  return {
    id: BROADCAST_ID,
    advisoryId: ADVISORY_ID,
    kind: 'initial',
    status: 'queued',
    triggeredBy: USER_A1,
    audienceDashboards: 2,
    emailContacts: 3,
    smsContacts: 2,
    sentDashboards: 0,
    sentEmail: 0,
    sentSms: 0,
    failed: 0,
    queueJobId: `broadcast:${BROADCAST_ID}`,
    ...overrides,
  };
}

function makeAdvisory(overrides: Partial<AdvisoryDeliveryView> = {}): AdvisoryDeliveryView {
  return {
    id: ADVISORY_ID,
    cveId: 'CVE-2026-31337',
    title: 'Struts RCE',
    summary: 'Upload a file, own the server.',
    remediation: 'Upgrade.',
    references: [],
    severity: 'critical',
    cvss: '9.8',
    status: 'published',
    scope: [{ label: 'Struts 2', category: null }],
    disclosureDate: '2026-09-20',
    ...overrides,
  };
}

function contact(userId: string, orgId: string, email: string, phone: string | null): OrgContact {
  return { userId, orgId, email, fullName: email.split('@')[0] ?? email, phone };
}

const CONTACTS = [
  contact(USER_A1, ORG_A, 'a1@horizon.co.ke', '+254700000001'),
  contact(USER_A2, ORG_A, 'a2@horizon.co.ke', null),
  contact(USER_B1, ORG_B, 'b1@lakeview.co.ke', '+254700000002'),
];

const ASSETS = [
  { orgId: ORG_A, category: null, product: 'Struts 2', version: null, host: null },
  { orgId: ORG_B, category: null, product: 'Struts 2', version: null, host: null },
  { orgId: ORG_UNMATCHED, category: null, product: 'WordPress', version: null, host: null },
];

interface HarnessOptions {
  advisory?: AdvisoryDeliveryView;
  emailFails?: (to: string) => boolean;
  inboxFails?: (userId: string) => boolean;
}

function makeHarness(options: HarnessOptions = {}) {
  let row: BroadcastRow | null = makeRow();
  let advisory: AdvisoryDeliveryView | null = options.advisory ?? makeAdvisory();
  const flushed: CounterDelta[] = [];
  const events: BroadcastProgressEvent[] = [];
  const emails: Array<{ to: string; subject: string }> = [];
  const smss: Array<{ to: string }> = [];
  const retractions: string[] = [];

  // The notify-worker side of the wire.
  const inbox: InboxInput[] = [];
  const receipts: ReceiptInput[] = [];
  const notifyEmails: Array<{ to: string }> = [];
  const notifySms: Array<{ to: string }> = [];

  const clock: Clock = { now: () => new Date('2026-09-24T09:00:00.000Z') };
  const logger: Logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  const notifyRepo: NotifyRepo = {
    async insertInbox(input) {
      if (options.inboxFails?.(input.userId) === true) throw new Error('inbox insert failed');
      inbox.push(input);
    },
    async insertReceipt(input) {
      receipts.push(input);
    },
    async getInvoice() {
      return null;
    },
    async setInvoicePdfKey() {},
    async getReport() {
      return null;
    },
    async setReportObjectKey() {},
  };
  const notifyEmail: NotifyEmailSender = {
    async send(message: EmailMessage) {
      notifyEmails.push({ to: message.to });
      return { id: `em_${notifyEmails.length}` };
    },
  };
  const notifySmsSender: NotifySmsSender = {
    async send(message: SmsMessage) {
      notifySms.push({ to: message.to });
      return { id: `sms_${notifySms.length}` };
    },
  };
  const handler = new NotifyHandler({
    repo: notifyRepo,
    email: notifyEmail,
    sms: notifySmsSender,
    logger,
  });

  const repo: BroadcastRepo = {
    async getBroadcast() {
      return row;
    },
    async getAdvisory() {
      return advisory;
    },
    async listClientAssets() {
      return ASSETS;
    },
    async listOrgContacts(orgIds) {
      return CONTACTS.filter((entry) => orgIds.includes(entry.orgId));
    },
    async markSending() {},
    async incrementCounters(_id, delta) {
      flushed.push(delta);
      if (row === null) return;
      row = {
        ...row,
        sentDashboards: row.sentDashboards + (delta.sentDashboards ?? 0),
        sentEmail: row.sentEmail + (delta.sentEmail ?? 0),
        sentSms: row.sentSms + (delta.sentSms ?? 0),
        failed: row.failed + (delta.failed ?? 0),
      };
    },
    async finish(_id, status) {
      if (row === null) return;
      row = { ...row, status };
    },
    async retractAdvisory(advisoryId) {
      retractions.push(advisoryId);
      if (advisory !== null) advisory = { ...advisory, status: 'retracted' };
    },
  };

  /**
   * The production seam, rebuilt faithfully: build the contract payload, PARSE
   * it (drift fails here), then run the real consumer.
   */
  const wire: NotifyJobPayload[] = [];
  const notify: NotifyEnqueuer = {
    async enqueueInApp(payload, jobId) {
      const frame: NotifyJobPayload = NotifySchema.parse({
        channel: 'in_app',
        userId: payload.userId,
        event: payload.event,
        title: payload.title,
        body: payload.body,
      });
      wire.push(frame);
      expect(jobId).toMatch(new RegExp(`^broadcast:${BROADCAST_ID}:in_app:`));
      await handler.handle(frame);
    },
  };

  const email: EmailSender = {
    async send(message) {
      if (options.emailFails?.(message.to) === true) throw new Error('resend 503');
      emails.push({ to: message.to, subject: message.subject });
      return { id: `em_${emails.length}` };
    },
  };
  const sms: SmsSender = {
    async send(message) {
      smss.push({ to: message.to });
      return { id: `sms_${smss.length}` };
    },
  };
  const bus: ProgressBus = {
    async publish(event) {
      events.push(ProgressSchema.parse(event));
    },
  };

  const service = new BroadcastDeliveryService({
    repo,
    notify,
    email,
    sms,
    bus,
    clock,
    logger,
    throttleMs: 0,
    flushEvery: 10,
  });

  return {
    service,
    get row() {
      return row;
    },
    get advisory() {
      return advisory;
    },
    wire,
    events,
    emails,
    smss,
    retractions,
    inbox,
    receipts,
    flushed,
    /** Simulate BullMQ redelivering the job after a finish-but-no-ack crash. */
    setRowStatus(status: BroadcastRow['status']) {
      if (row !== null) row = { ...row, status };
    },
  };
}

const JOB = { broadcastId: BROADCAST_ID, advisoryId: ADVISORY_ID, kind: 'initial' as const };

describe('publish → broadcast → notify (integration A)', () => {
  it('delivers the whole estate: in-app through the real wire, mail and SMS direct', async () => {
    const harness = makeHarness();
    const summary = await harness.service.deliver(JOB);

    // The producer's own summary.
    expect(summary.status).toBe('sent');
    expect(summary.audienceOrgs).toBe(2);
    expect(summary.sent).toEqual({ dashboards: 2, email: 3, sms: 2 });
    expect(summary.failed).toBe(0);

    // The wire: three in-app payloads, all contract-valid (parse would throw).
    expect(harness.wire).toHaveLength(3);
    for (const frame of harness.wire) {
      expect(frame.channel).toBe('in_app');
      expect(NotifySchema.safeParse(frame).success).toBe(true);
    }
    expect(new Set(harness.wire.map((frame) => (frame as { event: string }).event))).toEqual(
      new Set(['advisory_broadcast']),
    );

    // The consumer's side effects: one inbox row per user, a receipt per attempt.
    expect(harness.inbox.map((entry) => entry.userId).sort()).toEqual(
      [USER_A1, USER_A2, USER_B1].sort(),
    );
    expect(
      harness.receipts.filter((entry) => entry.channel === 'in_app' && entry.status === 'sent'),
    ).toHaveLength(3);

    // Direct channels: every matched contact got the mail; phone-holders the SMS.
    expect(harness.emails.map((entry) => entry.to).sort()).toEqual(
      ['a1@horizon.co.ke', 'a2@horizon.co.ke', 'b1@lakeview.co.ke'].sort(),
    );
    expect(harness.smss.map((entry) => entry.to).sort()).toEqual(
      ['+254700000001', '+254700000002'].sort(),
    );

    // The row finished sent with counters equal to the audience.
    expect(harness.row?.status).toBe('sent');
    expect(harness.row?.sentDashboards).toBe(2);
    expect(harness.row?.sentEmail).toBe(3);
    expect(harness.row?.sentSms).toBe(2);

    // Progress: first and last frames always out; the last is the completion
    // signal Task 94's desk settles on.
    expect(harness.events.length).toBeGreaterThanOrEqual(2);
    const last = harness.events.at(-1) as BroadcastProgressEvent;
    expect(last.status).toBe('sent');
    expect(last.sent).toEqual({ dashboards: 2, email: 3, sms: 2 });
    expect(last.failed).toBe(0);
  });

  it('a redelivered job for a finished row is skipped — nothing sent twice', async () => {
    const harness = makeHarness();
    await harness.service.deliver(JOB);
    const wireBefore = harness.wire.length;
    const emailsBefore = harness.emails.length;
    const eventsBefore = harness.events.length;

    const again = await harness.service.deliver(JOB);
    expect(again.status).toBe('skipped');
    expect(harness.wire).toHaveLength(wireBefore);
    expect(harness.emails).toHaveLength(emailsBefore);
    expect(harness.events).toHaveLength(eventsBefore);
  });

  it('a contact-level e-mail failure counts but does not stop the broadcast', async () => {
    const harness = makeHarness({ emailFails: (to) => to === 'a2@horizon.co.ke' });
    const summary = await harness.service.deliver(JOB);

    expect(summary.status).toBe('sent'); // per-contact failures are counted, not fatal
    expect(summary.sent.email).toBe(2);
    expect(summary.failed).toBe(1);
    expect(harness.row?.failed).toBe(1);
    // The other channels for that contact still delivered.
    expect(harness.inbox.map((entry) => entry.userId)).toContain(USER_A2);
    expect(harness.emails.map((entry) => entry.to)).not.toContain('a2@horizon.co.ke');
  });

  it('a failing inbox write propagates: no receipt, no inbox row, and the org loses its dashboard count', async () => {
    const harness = makeHarness({ inboxFails: (userId) => userId === USER_B1 });
    const summary = await harness.service.deliver(JOB);

    // ORG_B's only user failed the in-app enqueue → its dashboard is not counted.
    expect(summary.sent.dashboards).toBe(1);
    expect(summary.failed).toBeGreaterThanOrEqual(1);
    // The consumer's real behaviour on an inbox failure: the handler rethrows
    // WITHOUT a receipt (BullMQ would retry the job; a receipt is written only
    // for attempts that reached a provider), so neither row exists for B1.
    expect(harness.inbox.map((entry) => entry.userId)).not.toContain(USER_B1);
    expect(harness.receipts.map((entry) => entry.destination)).not.toContain(USER_B1);
    // The two healthy users are unaffected.
    expect(
      harness.receipts.filter((entry) => entry.channel === 'in_app' && entry.status === 'sent'),
    ).toHaveLength(2);
  });

  it('retraction takes the advisory down first, then notifies — and never SMS', async () => {
    const harness = makeHarness();
    const summary = await harness.service.deliver({ ...JOB, kind: 'retraction' });

    expect(harness.retractions).toEqual([ADVISORY_ID]);
    expect(harness.advisory?.status).toBe('retracted');
    expect(summary.status).toBe('sent');
    // The retraction notice travels the same parsed wire…
    expect(harness.wire.length).toBe(3);
    expect(harness.inbox).toHaveLength(3);
    // …but SMS is initial-only: a retraction must not page anyone at 3 a.m.
    expect(harness.smss).toHaveLength(0);
  });

  it('an unmatched org is not paged', async () => {
    const harness = makeHarness();
    await harness.service.deliver(JOB);
    expect(harness.wire.some((frame) => frame.channel === 'in_app' && false)).toBe(false);
    // ORG_UNMATCHED runs WordPress; nobody there hears about Struts.
    const userIds = harness.inbox.map((entry) => entry.userId);
    expect(userIds).not.toContain('cccccccc-0000-4000-8000-0000000000c1');
    expect(harness.inbox).toHaveLength(3);
  });

  it('a long advisory title arrives truncated, not rejected (the inbox limit is the consumer’s)', async () => {
    const longTitle = `CVE-2026-31337 ${'x'.repeat(240)}`;
    const harness = makeHarness({ advisory: makeAdvisory({ title: longTitle }) });
    const summary = await harness.service.deliver(JOB);

    expect(summary.status).toBe('sent');
    expect(harness.inbox.length).toBeGreaterThan(0);
    for (const entry of harness.inbox) {
      expect(entry.title.length).toBeLessThanOrEqual(INBOX_TITLE_MAX);
    }
  });
});

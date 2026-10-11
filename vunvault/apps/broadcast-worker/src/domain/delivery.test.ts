import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BroadcastProgressEvent } from '@vunvault/contracts';
import { BroadcastDeliveryService, dedupeContacts, mapPool } from './delivery';
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
} from '../ports';

const BROADCAST_ID = '3f2b8c1e-9d4a-4e7b-8c2f-1a5d6e7f8090';
const ADVISORY_ID = '9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d';
const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const USER_A1 = 'aaaaaaaa-0000-4000-8000-0000000000a1';
const USER_A2 = 'aaaaaaaa-0000-4000-8000-0000000000a2';
const USER_B1 = 'bbbbbbbb-0000-4000-8000-0000000000b1';

// --------------------------------------------------------------------- fakes

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

interface HarnessOptions {
  row?: BroadcastRow | null;
  advisory?: AdvisoryDeliveryView | null;
  contacts?: OrgContact[];
  assets?: Array<{ orgId: string; category: string | null; product: string; version: string | null; host: string | null }>;
  emailFails?: (to: string) => boolean;
  smsFails?: (to: string) => boolean;
  inAppFails?: (userId: string) => boolean;
  busFails?: boolean;
  throttleMs?: number;
  flushEvery?: number;
  /** Deterministic fake latency: every provider call advances the clock. */
  advancePerSend?: number;
}

function makeHarness(options: HarnessOptions = {}) {
  const row = options.row === undefined ? makeRow() : options.row;
  const advisory = options.advisory === undefined ? makeAdvisory() : options.advisory;
  const assets =
    options.assets ?? [
      { orgId: ORG_A, category: null, product: 'Struts 2', version: null, host: null },
      { orgId: ORG_B, category: null, product: 'Struts 2', version: null, host: null },
    ];
  const contacts =
    options.contacts ?? [
      contact(USER_A1, ORG_A, 'a1@horizon.co.ke', '+254700000001'),
      contact(USER_A2, ORG_A, 'a2@horizon.co.ke', null),
      contact(USER_B1, ORG_B, 'b1@lakeview.co.ke', '+254700000002'),
    ];

  const calls: string[] = [];
  /** One ordered timeline across repo, providers and the bus. */
  const timeline: string[] = [];
  const flushed: CounterDelta[] = [];
  const events: BroadcastProgressEvent[] = [];
  const inApp: Array<{ payload: { userId: string; title: string; body: string }; jobId: string }> = [];
  const emails: Array<{ to: string; subject: string }> = [];
  const smss: Array<{ to: string; body: string }> = [];
  const finishes: Array<{ status: 'sent' | 'failed'; at: Date }> = [];
  const retractions: string[] = [];
  const warnings: string[] = [];

  // A clock the fakes advance explicitly: sends take 0 ms unless a test says so.
  let currentMs = Date.parse('2026-09-24T09:00:00.000Z');
  const clock: Clock = { now: () => new Date(currentMs) };

  const repo: BroadcastRepo = {
    async getBroadcast() {
      calls.push('getBroadcast');
      return row;
    },
    async getAdvisory() {
      calls.push('getAdvisory');
      return advisory;
    },
    async listClientAssets() {
      calls.push('listClientAssets');
      return assets;
    },
    async listOrgContacts(orgIds) {
      calls.push(`listOrgContacts:${orgIds.length}`);
      return contacts.filter((c) => orgIds.includes(c.orgId));
    },
    async markSending() {
      calls.push('markSending');
      timeline.push('markSending');
    },
    async incrementCounters(_id, delta) {
      flushed.push(delta);
    },
    async finish(_id, status, at) {
      finishes.push({ status, at });
    },
    async retractAdvisory(advisoryId) {
      retractions.push(advisoryId);
      timeline.push('retractAdvisory');
    },
  };

  const notify: NotifyEnqueuer = {
    async enqueueInApp(payload, jobId) {
      currentMs += options.advancePerSend ?? 0;
      if (options.inAppFails?.(payload.userId) === true) {
        throw new Error('queue down');
      }
      timeline.push(`in_app:${payload.userId}`);
      inApp.push({ payload, jobId });
    },
  };

  const email: EmailSender = {
    async send(message) {
      currentMs += options.advancePerSend ?? 0;
      if (options.emailFails?.(message.to) === true) throw new Error('resend 503');
      timeline.push(`email:${message.to}`);
      emails.push({ to: message.to, subject: message.subject });
      return { id: `em_${emails.length}` };
    },
  };

  const sms: SmsSender = {
    async send(message) {
      currentMs += options.advancePerSend ?? 0;
      if (options.smsFails?.(message.to) === true) throw new Error('at 500');
      timeline.push(`sms:${message.to}`);
      smss.push({ to: message.to, body: message.body });
      return { id: `sms_${smss.length}` };
    },
  };

  const bus: ProgressBus = {
    async publish(event) {
      if (options.busFails === true) throw new Error('pubsub down');
      events.push(event);
    },
  };

  const logger: Logger = {
    info: () => undefined,
    warn: (message) => warnings.push(message),
    error: () => undefined,
    debug: () => undefined,
  };

  const service = new BroadcastDeliveryService({
    repo,
    notify,
    email,
    sms,
    bus,
    clock,
    logger,
    throttleMs: options.throttleMs ?? 2000,
    flushEvery: options.flushEvery ?? 25,
  });

  return {
    service,
    clock: { advance: (ms: number) => (currentMs += ms) },
    calls,
    timeline,
    flushed,
    events,
    inApp,
    emails,
    smss,
    finishes,
    retractions,
    warnings,
  };
}

const JOB = { broadcastId: BROADCAST_ID, advisoryId: ADVISORY_ID, kind: 'initial' as const };

// --------------------------------------------------------------------- tests

describe('BroadcastDeliveryService — happy path', () => {
  let h: ReturnType<typeof makeHarness>;
  beforeEach(async () => {
    h = makeHarness();
  });

  it('delivers to dashboards, e-mail and SMS with exact counters', async () => {
    const summary = await h.service.deliver(JOB);

    expect(summary.status).toBe('sent');
    expect(summary.audienceOrgs).toBe(2);
    expect(summary.contacts).toBe(3);
    expect(summary.sent).toEqual({ dashboards: 2, email: 3, sms: 2 });
    expect(summary.failed).toBe(0);

    // One in-app enqueue per contact, with the stable dedupe jobId.
    expect(h.inApp.map((entry) => entry.jobId)).toEqual([
      `broadcast:${BROADCAST_ID}:in_app:${USER_A1}`,
      `broadcast:${BROADCAST_ID}:in_app:${USER_A2}`,
      `broadcast:${BROADCAST_ID}:in_app:${USER_B1}`,
    ]);
    expect(h.inApp[0]?.payload.title).toBe('Emergency advisory: CVE-2026-31337');

    // Every contact gets the e-mail; only contacts with phones get the SMS.
    expect(h.emails.map((entry) => entry.to).sort()).toEqual([
      'a1@horizon.co.ke',
      'a2@horizon.co.ke',
      'b1@lakeview.co.ke',
    ]);
    expect(h.smss.map((entry) => entry.to).sort()).toEqual(['+254700000001', '+254700000002']);
    expect(h.smss[0]?.body.startsWith('VUNVAULT: CVE-2026-31337')).toBe(true);
  });

  it('walks the row through queued → sending → sent', async () => {
    await h.service.deliver(JOB);
    expect(h.calls).toContain('markSending');
    expect(h.finishes).toHaveLength(1);
    expect(h.finishes[0]?.status).toBe('sent');
    // The flushed deltas sum to the summary counters.
    const totals = h.flushed.reduce<{
      sentDashboards: number;
      sentEmail: number;
      sentSms: number;
      failed: number;
    }>(
      (acc, delta) => ({
        sentDashboards: acc.sentDashboards + (delta.sentDashboards ?? 0),
        sentEmail: acc.sentEmail + (delta.sentEmail ?? 0),
        sentSms: acc.sentSms + (delta.sentSms ?? 0),
        failed: acc.failed + (delta.failed ?? 0),
      }),
      { sentDashboards: 0, sentEmail: 0, sentSms: 0, failed: 0 },
    );
    expect(totals).toEqual({ sentDashboards: 2, sentEmail: 3, sentSms: 2, failed: 0 });
  });

  it('publishes the first and the final progress frame even under throttling', async () => {
    await h.service.deliver(JOB);
    expect(h.events.length).toBeGreaterThanOrEqual(2);
    expect(h.events[0]?.status).toBe('sending');
    expect(h.events[0]?.sent).toEqual({ dashboards: 0, email: 0, sms: 0 });
    const last = h.events[h.events.length - 1];
    expect(last?.status).toBe('sent');
    expect(last?.sent).toEqual({ dashboards: 2, email: 3, sms: 2 });
    expect(last?.audience).toEqual({ dashboards: 2, email: 3, sms: 2 });
  });

  it('throttles intermediate frames to at most one per throttle window', async () => {
    // 8 deliveries × 1 s each, a 10 s window: no intermediate frame may pass
    // the throttle, so only the forced first and final frames go out.
    const harness = makeHarness({ throttleMs: 10_000, advancePerSend: 1000 });
    await harness.service.deliver(JOB);
    expect(harness.events).toHaveLength(2);
    expect(harness.events[0]?.status).toBe('sending');
    expect(harness.events[1]?.status).toBe('sent');
  });

  it('does not retract the advisory for an initial broadcast', async () => {
    await h.service.deliver(JOB);
    expect(h.retractions).toEqual([]);
  });
});

describe('BroadcastDeliveryService — kinds', () => {
  it('sends NO SMS for a rebroadcast but keeps e-mail and in-app', async () => {
    const h = makeHarness();
    const summary = await h.service.deliver({ ...JOB, kind: 'rebroadcast' });
    expect(h.smss).toEqual([]);
    expect(h.emails).toHaveLength(3);
    expect(h.inApp).toHaveLength(3);
    expect(summary.sent).toEqual({ dashboards: 2, email: 3, sms: 0 });
    expect(h.emails[0]?.subject).toContain('Reminder:');
  });

  it('retracts the advisory BEFORE delivering a retraction, e-mail + in-app only', async () => {
    const h = makeHarness();
    const summary = await h.service.deliver({ ...JOB, kind: 'retraction' });
    expect(h.retractions).toEqual([ADVISORY_ID]);
    // Timeline order: the advisory comes off the portal before anybody is told.
    const retractAt = h.timeline.indexOf('retractAdvisory');
    const firstDelivery = h.timeline.findIndex((entry) => entry.startsWith('in_app:'));
    expect(retractAt).toBeGreaterThanOrEqual(0);
    expect(retractAt).toBeLessThan(firstDelivery);
    expect(h.smss).toEqual([]);
    expect(h.emails).toHaveLength(3);
    expect(h.emails[0]?.subject).toBe('[VUNVAULT] RETRACTED: CVE-2026-31337 — Struts RCE');
    expect(h.inApp[0]?.payload.title).toBe('Advisory retracted: CVE-2026-31337');
    expect(summary.status).toBe('sent');
  });
});

describe('BroadcastDeliveryService — idempotency and missing rows', () => {
  it.each(['sent', 'failed'] as const)('skips a row already %s with zero provider calls', async (status) => {
    const h = makeHarness({ row: makeRow({ status }) });
    const summary = await h.service.deliver(JOB);
    expect(summary.status).toBe('skipped');
    expect(h.emails).toEqual([]);
    expect(h.smss).toEqual([]);
    expect(h.inApp).toEqual([]);
    expect(h.finishes).toEqual([]);
    expect(h.calls).not.toContain('markSending');
  });

  it('skips a missing broadcast row', async () => {
    const h = makeHarness({ row: null });
    const summary = await h.service.deliver(JOB);
    expect(summary.status).toBe('skipped');
    expect(h.calls).toEqual(['getBroadcast']);
  });

  it('throws on a missing advisory without marking the row failed', async () => {
    const h = makeHarness({ advisory: null });
    await expect(h.service.deliver(JOB)).rejects.toThrow('advisory_missing');
    expect(h.finishes).toEqual([]);
    expect(h.calls).not.toContain('markSending');
  });
});

describe('BroadcastDeliveryService — failure handling', () => {
  it('counts one failing mailbox as failed and still delivers to everyone else', async () => {
    const h = makeHarness({ emailFails: (to) => to === 'a2@horizon.co.ke' });
    const summary = await h.service.deliver(JOB);
    expect(summary.sent.email).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.status).toBe('sent');
    expect(h.emails.map((entry) => entry.to)).toContain('b1@lakeview.co.ke');
    expect(h.warnings.some((message) => message === 'broadcast e-mail failed')).toBe(true);
  });

  it('does not count an org whose in-app enqueue failed', async () => {
    const h = makeHarness({ inAppFails: (userId) => userId === USER_B1 });
    const summary = await h.service.deliver(JOB);
    expect(summary.sent.dashboards).toBe(1); // ORG_A only
    expect(summary.failed).toBe(1);
    expect(h.warnings.some((message) => message === 'in-app enqueue failed')).toBe(true);
  });

  it('finishes failed when nothing at all got through', async () => {
    const h = makeHarness({
      emailFails: () => true,
      smsFails: () => true,
      inAppFails: () => true,
    });
    const summary = await h.service.deliver(JOB);
    expect(summary.status).toBe('failed');
    expect(summary.sent).toEqual({ dashboards: 0, email: 0, sms: 0 });
    // 3 in-app + 3 e-mail + 2 SMS attempts, all failed.
    expect(summary.failed).toBe(8);
    expect(h.finishes[0]?.status).toBe('failed');
    expect(h.events[h.events.length - 1]?.status).toBe('failed');
  });

  it('finishes sent with zero counters for an empty audience', async () => {
    const h = makeHarness({ assets: [] });
    const summary = await h.service.deliver(JOB);
    expect(summary.status).toBe('sent');
    expect(summary.contacts).toBe(0);
    expect(summary.sent).toEqual({ dashboards: 0, email: 0, sms: 0 });
    expect(summary.failed).toBe(0);
  });

  it('never aborts delivery when the progress bus is down', async () => {
    const h = makeHarness({ busFails: true });
    const summary = await h.service.deliver(JOB);
    expect(summary.status).toBe('sent');
    expect(h.warnings.filter((message) => message === 'progress publish failed').length).toBeGreaterThan(0);
  });
});

describe('BroadcastDeliveryService — flushing and ordering', () => {
  it('flushes counters incrementally and the totals always match', async () => {
    const h = makeHarness({ flushEvery: 2 });
    await h.service.deliver(JOB);
    // 8 successful deliveries (3 in-app + 3 email + 2 sms) with flushEvery=2:
    // at least one intermediate flush plus the final one. The EXACT count is
    // schedule-dependent (pool lanes batch counts before their ticks flush),
    // so the contract asserted here is: totals exact, more than a single
    // end-of-run write.
    const totalEmail = h.flushed.reduce((sum, delta) => sum + (delta.sentEmail ?? 0), 0);
    const totalSms = h.flushed.reduce((sum, delta) => sum + (delta.sentSms ?? 0), 0);
    const totalDash = h.flushed.reduce((sum, delta) => sum + (delta.sentDashboards ?? 0), 0);
    expect({ totalEmail, totalSms, totalDash }).toEqual({ totalEmail: 3, totalSms: 2, totalDash: 2 });
    expect(h.flushed.length).toBeGreaterThanOrEqual(2);
  });

  it('publishes intermediate frames as the clock advances past the throttle', async () => {
    // 8 deliveries × 500 ms with a 1 s throttle: roughly every second tick
    // passes the window, so intermediate frames appear between the forced ones.
    const h = makeHarness({ throttleMs: 1000, advancePerSend: 500 });
    const summary = await h.service.deliver(JOB);
    expect(summary.status).toBe('sent');
    expect(h.events.length).toBeGreaterThan(2);
    // Frames are ordered and never go backwards in time.
    const stamps = h.events.map((event) => Date.parse(event.updatedAt));
    expect(stamps).toEqual([...stamps].sort((a, b) => a - b));
    expect(h.events[h.events.length - 1]?.status).toBe('sent');
  });

  it('dedupes a contact who appears in two matched orgs and sorts deterministically', () => {
    const deduped = dedupeContacts([
      contact(USER_B1, ORG_B, 'b1@lakeview.co.ke', null),
      contact(USER_A1, ORG_A, 'z@horizon.co.ke', null),
      contact(USER_A1, ORG_B, 'z@horizon.co.ke', null),
      contact(USER_A2, ORG_A, 'a@horizon.co.ke', null),
    ]);
    expect(deduped.map((entry) => entry.userId)).toEqual([USER_A2, USER_A1, USER_B1]);
  });
});

describe('mapPool', () => {
  it('runs every item exactly once with bounded concurrency', async () => {
    let inFlight = 0;
    let peak = 0;
    const seen: number[] = [];
    await mapPool([1, 2, 3, 4, 5, 6, 7], 3, async (item) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      seen.push(item);
      inFlight -= 1;
    });
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(peak).toBeLessThanOrEqual(3);
  });

  it('handles an empty list', async () => {
    const fn = vi.fn();
    await mapPool([], 3, fn);
    expect(fn).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CHANNEL_TOGGLES,
  NOTIFICATION_EVENT_ORDER,
  type ChannelToggles,
  type NotificationEvent,
} from '@vunvault/contracts';
import { HttpError } from '../../../lib/http-error.js';
import { NotificationDispatcher } from '../../../lib/notify.js';
import type {
  AccountSessionsRepo,
  DeactivationRow,
  NotificationPrefsRepo,
  SessionRow,
  SuperAdminRow,
  ToggleRow,
} from './repo.js';
import {
  AccountSessionsService,
  DEACTIVATION_COOLDOWN_MS,
  DeactivationService,
  NotificationPreferencesService,
} from './service.js';

const USER_ID = 'f0000000-0000-4000-8000-000000000001';
const OTHER_ID = 'f0000000-0000-4000-8000-000000000002';
const ADMIN_ID = 'f0000000-0000-4000-8000-000000000003';
const CURRENT = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-09-24T12:00:00.000Z');

// --------------------------------------------------------------------- fakes

class FakePrefsRepo implements NotificationPrefsRepo {
  toggles: ToggleRow[] = [];
  quiet: { enabled: boolean; from: string | null; to: string | null } = {
    enabled: false,
    from: null,
    to: null,
  };
  replaceCalls: Array<Record<NotificationEvent, ChannelToggles>> = [];
  quietCalls: (typeof this.quiet)[] = [];
  admins: SuperAdminRow[] = [
    {
      userId: ADMIN_ID,
      email: 'admin@vunvault.com',
      phone: '+254700000001',
      timezone: 'Africa/Nairobi',
    },
  ];

  async listToggles() {
    return this.toggles;
  }
  async replaceToggles(_userId: string, toggles: Record<NotificationEvent, ChannelToggles>) {
    this.replaceCalls.push(toggles);
    this.toggles = NOTIFICATION_EVENT_ORDER.map((event) => ({ event, ...toggles[event] }));
  }
  async getQuietHours() {
    return this.quiet;
  }
  /** The dispatcher reads quiet hours through this name. */
  async quietHours() {
    return this.quiet;
  }
  async putQuietHours(_userId: string, quietHours: typeof this.quiet) {
    this.quietCalls.push(quietHours);
    this.quiet = quietHours;
  }
  async recipient(userId: string) {
    return {
      userId,
      email: 'e.reed@vunvault.com',
      phone: '+254712345678',
      timezone: 'Africa/Nairobi',
    };
  }
  async listActiveSuperAdmins() {
    return this.admins;
  }
}

function sessionRow(id: string, overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id,
    userId: USER_ID,
    deviceLabel: 'Mac · Safari',
    userAgent: null,
    ip: '41.90.0.1',
    geoCity: 'Nairobi',
    geoCountry: 'KE',
    mfaMethod: 'totp',
    startedAt: '2026-09-20T08:00:00.000Z',
    lastSeenAt: '2026-09-24T11:00:00.000Z',
    revokedAt: null,
    ...overrides,
  };
}

class FakeSessionsRepo implements AccountSessionsRepo {
  sessions: SessionRow[] = [
    sessionRow(CURRENT),
    sessionRow('22222222-2222-4222-8222-222222222222'),
  ];
  role = 'super_admin';
  requestedAt: string | null = null;
  deactivationWrites: Date[] = [];

  async listSessions(userId: string) {
    return this.sessions.filter((row) => row.userId === userId && row.revokedAt === null);
  }
  async findSession(sessionId: string) {
    return this.sessions.find((row) => row.id === sessionId) ?? null;
  }
  async revokeSessions(sessionIds: string[], at: Date) {
    let count = 0;
    for (const row of this.sessions) {
      if (sessionIds.includes(row.id) && row.revokedAt === null) {
        row.revokedAt = at.toISOString();
        count += 1;
      }
    }
    return count;
  }
  async getDeactivation(userId: string): Promise<DeactivationRow> {
    return { userId, role: this.role, requestedAt: this.requestedAt, email: 'e.reed@vunvault.com' };
  }
  async requestDeactivation(_userId: string, at: Date) {
    this.deactivationWrites.push(at);
    this.requestedAt = at.toISOString();
  }
}

function fakeSupabase() {
  const deleted: string[] = [];
  return {
    deleted,
    createUser: async () => ({ id: USER_ID }),
    signInWithPassword: async () => {
      throw new Error('unused');
    },
    refresh: async () => {
      throw new Error('unused');
    },
    signOut: async () => undefined,
    updatePassword: async () => undefined,
    deleteSession: async (sessionId: string) => {
      deleted.push(sessionId);
    },
    mfa: {
      enrollTotp: async () => ({ factorId: 'f', qrSvg: '', secret: '', uri: '' }),
      challengeAndVerify: async () => {
        throw new Error('unused');
      },
      unenroll: async () => undefined,
      listFactors: async () => [],
    },
  };
}

// --------------------------------------------------------- notification prefs

describe('notification preferences', () => {
  it('fills the planner defaults for events with no stored row', async () => {
    const repo = new FakePrefsRepo();
    repo.toggles = [{ event: 'scan_completed', inApp: false, email: false, sms: true, push: true }];
    const service = new NotificationPreferencesService({ repo });

    const prefs = await service.get(USER_ID);
    expect(Object.keys(prefs.events)).toHaveLength(NOTIFICATION_EVENT_ORDER.length);
    expect(prefs.events.scan_completed).toEqual({
      inApp: false,
      email: false,
      sms: true,
      push: true,
    });
    // Every other event gets the defaults, not `false`.
    expect(prefs.events.weekly_digest).toEqual(DEFAULT_CHANNEL_TOGGLES);
    expect(prefs.events.weekly_digest).toEqual({
      inApp: true,
      email: true,
      sms: false,
      push: false,
    });
    expect(prefs.quietHours).toEqual({ enabled: false, from: null, to: null });
  });

  it('replaces every row and reports which events changed', async () => {
    const repo = new FakePrefsRepo();
    const service = new NotificationPreferencesService({ repo });
    const body = {
      events: Object.fromEntries(
        NOTIFICATION_EVENT_ORDER.map((event) => [
          event,
          event === 'weekly_digest'
            ? { inApp: false, email: false, sms: false, push: false }
            : { ...DEFAULT_CHANNEL_TOGGLES },
        ]),
      ) as Record<NotificationEvent, ChannelToggles>,
      quietHours: { enabled: false, from: null, to: null },
    };

    const result = await service.put(USER_ID, body);
    expect(result.changed).toEqual(['weekly_digest']);
    expect(Object.keys(repo.replaceCalls[0] ?? {})).toHaveLength(NOTIFICATION_EVENT_ORDER.length);
    expect(repo.quietCalls).toHaveLength(1);
  });

  it('refuses quiet hours that are enabled without times, or with equal times', async () => {
    const repo = new FakePrefsRepo();
    const service = new NotificationPreferencesService({ repo });
    const base = {
      events: Object.fromEntries(
        NOTIFICATION_EVENT_ORDER.map((event) => [event, { ...DEFAULT_CHANNEL_TOGGLES }]),
      ) as Record<NotificationEvent, ChannelToggles>,
    };

    const noTimes = await service
      .put(USER_ID, { ...base, quietHours: { enabled: true, from: null, to: null } })
      .catch((caught: unknown) => caught);
    expect(noTimes).toBeInstanceOf(HttpError);
    expect((noTimes as HttpError).status).toBe(400);
    expect((noTimes as HttpError).code).toBe('validation_failed');
    expect((noTimes as HttpError).details).toEqual([
      { path: ['quietHours'], message: 'Set both a start and an end time' },
    ]);

    const halfSet = await service
      .put(USER_ID, { ...base, quietHours: { enabled: true, from: '22:00', to: null } })
      .catch((caught: unknown) => caught);
    expect((halfSet as HttpError).status).toBe(400);

    const equal = await service
      .put(USER_ID, { ...base, quietHours: { enabled: true, from: '22:00', to: '22:00' } })
      .catch((caught: unknown) => caught);
    expect((equal as HttpError).details).toEqual([
      { path: ['quietHours'], message: 'The start and end time must differ' },
    ]);

    // Nothing was written by any of the refusals.
    expect(repo.replaceCalls).toHaveLength(0);
    expect(repo.quietCalls).toHaveLength(0);

    // A valid overnight window is accepted.
    const ok = await service.put(USER_ID, {
      ...base,
      quietHours: { enabled: true, from: '22:00', to: '06:00' },
    });
    expect(ok.prefs.quietHours).toEqual({ enabled: true, from: '22:00', to: '06:00' });
    expect(repo.quietCalls).toHaveLength(1);
  });
});

// ------------------------------------------------------------------- sessions

describe('sessions', () => {
  it('lists the caller’s live sessions newest first and marks the current one', async () => {
    const repo = new FakeSessionsRepo();
    repo.sessions = [
      sessionRow('33333333-3333-4333-8333-333333333333', {
        startedAt: '2026-09-24T10:00:00.000Z',
        geoCity: null,
      }),
      sessionRow(CURRENT, { startedAt: '2026-09-20T08:00:00.000Z' }),
    ];
    const service = new AccountSessionsService({
      repo,
      supabase: fakeSupabase() as never,
      now: () => NOW,
    });

    const views = await service.list(USER_ID, CURRENT);
    expect(views.map((view) => view.id)).toEqual(['33333333-3333-4333-8333-333333333333', CURRENT]);
    expect(views[0]?.location).toBeNull();
    expect(views[1]).toMatchObject({
      location: 'Nairobi, KE',
      mfaMethod: 'totp',
      current: true,
      deviceLabel: 'Mac · Safari',
    });
    expect(views[0]?.current).toBe(false);
  });

  it('refuses to revoke the session the caller is standing on', async () => {
    const repo = new FakeSessionsRepo();
    const supabase = fakeSupabase();
    const service = new AccountSessionsService({
      repo,
      supabase: supabase as never,
      now: () => NOW,
    });

    const error = await service
      .revoke(USER_ID, CURRENT, CURRENT)
      .catch((caught: unknown) => caught);
    expect((error as HttpError).status).toBe(409);
    expect((error as HttpError).code).toBe('use_logout');
    expect(supabase.deleted).toHaveLength(0);
    expect(repo.sessions.every((row) => row.revokedAt === null)).toBe(true);
  });

  it('answers 404 for another user’s session id', async () => {
    const repo = new FakeSessionsRepo();
    repo.sessions = [sessionRow('44444444-4444-4444-8444-444444444444', { userId: OTHER_ID })];
    const service = new AccountSessionsService({
      repo,
      supabase: fakeSupabase() as never,
      now: () => NOW,
    });

    const foreign = await service
      .revoke(USER_ID, '44444444-4444-4444-8444-444444444444', CURRENT)
      .catch((caught: unknown) => caught);
    expect((foreign as HttpError).status).toBe(404);
    expect((foreign as HttpError).code).toBe('not_found');

    // An id that does not exist at all is indistinguishable.
    const missing = await service
      .revoke(USER_ID, '55555555-5555-4555-8555-555555555555', CURRENT)
      .catch((caught: unknown) => caught);
    expect((missing as HttpError).status).toBe(404);
  });

  it('revokes another device, deletes it upstream and drops the registry key', async () => {
    const repo = new FakeSessionsRepo();
    const supabase = fakeSupabase();
    const invalidated: string[] = [];
    const service = new AccountSessionsService({
      repo,
      supabase: supabase as never,
      invalidate: async (sessionId) => {
        invalidated.push(sessionId);
      },
      now: () => NOW,
    });

    await service.revoke(USER_ID, '22222222-2222-4222-8222-222222222222', CURRENT);
    expect(supabase.deleted).toEqual(['22222222-2222-4222-8222-222222222222']);
    expect(invalidated).toEqual(['22222222-2222-4222-8222-222222222222']);
    expect(repo.sessions.find((row) => row.id === CURRENT)?.revokedAt).toBeNull();
  });

  it('never touches the current session when revoking the others', async () => {
    const repo = new FakeSessionsRepo();
    const supabase = fakeSupabase();
    const service = new AccountSessionsService({
      repo,
      supabase: supabase as never,
      now: () => NOW,
    });

    const revoked = await service.revokeOthers(USER_ID, CURRENT);
    expect(revoked).toBe(1);
    expect(supabase.deleted).toEqual(['22222222-2222-4222-8222-222222222222']);
    expect(repo.sessions.find((row) => row.id === CURRENT)?.revokedAt).toBeNull();
    expect(
      repo.sessions.find((row) => row.id === '22222222-2222-4222-8222-222222222222')?.revokedAt,
    ).toBe(NOW.toISOString());

    // Running it again has nothing left to do.
    expect(await service.revokeOthers(USER_ID, CURRENT)).toBe(0);
  });
});

// --------------------------------------------------------------- deactivation

function makeDeactivation(role: string, requestedAt: string | null = null) {
  const repo = new FakeSessionsRepo();
  repo.role = role;
  repo.requestedAt = requestedAt;
  const prefs = new FakePrefsRepo();
  const dispatched: Array<{ userId: string; title: string; critical?: boolean }> = [];
  const notify = new NotificationDispatcher({
    // The repo stores rows; the dispatcher wants a per-event lookup.
    prefs: {
      recipient: (userId) => prefs.recipient(userId),
      toggles: async (_userId, event) => {
        const row = prefs.toggles.find((stored) => stored.event === event);
        return row ?? { inApp: true, email: true, sms: false, push: false };
      },
      quietHours: () => prefs.quietHours(),
    },
    enqueue: async (payload) => {
      if (payload.channel === 'in_app') {
        dispatched.push({ userId: payload.userId, title: payload.title });
      }
    },
    now: () => NOW,
  });
  const service = new DeactivationService({ repo, prefs, notify, now: () => NOW });
  return { service, repo, prefs, dispatched };
}

describe('deactivation request', () => {
  it('is refused for a client account', async () => {
    const { service, repo } = makeDeactivation('client');
    const error = await service
      .request(USER_ID, 'We are closing the company')
      .catch((caught: unknown) => caught);
    expect((error as HttpError).status).toBe(403);
    expect((error as HttpError).code).toBe('forbidden');
    expect(repo.deactivationWrites).toHaveLength(0);
  });

  it('records the request and pages the active super admins', async () => {
    const { service, repo, dispatched } = makeDeactivation('security_analyst');
    const result = await service.request(USER_ID, 'Leaving VUNVAULT at the end of the month');
    expect(repo.deactivationWrites).toEqual([NOW]);
    expect(result.adminsNotified).toBe(1);
    expect(dispatched).toEqual([{ userId: ADMIN_ID, title: 'Deactivation requested' }]);
  });

  it('refuses a repeat request inside 24 hours', async () => {
    const recent = new Date(NOW.getTime() - (DEACTIVATION_COOLDOWN_MS - 60_000)).toISOString();
    const { service, repo } = makeDeactivation('super_admin', recent);
    const error = await service
      .request(USER_ID, 'Asking again already')
      .catch((caught: unknown) => caught);
    expect((error as HttpError).status).toBe(409);
    expect((error as HttpError).code).toBe('already_requested');
    expect(repo.deactivationWrites).toHaveLength(0);

    // After the window it is accepted again.
    const old = new Date(NOW.getTime() - (DEACTIVATION_COOLDOWN_MS + 60_000)).toISOString();
    const { service: later, repo: laterRepo } = makeDeactivation('super_admin', old);
    await later.request(USER_ID, 'Asking again after a day');
    expect(laterRepo.deactivationWrites).toEqual([NOW]);
  });

  it('does not deactivate anything', async () => {
    const { service, repo } = makeDeactivation('super_admin');
    await service.request(USER_ID, 'Retiring from the platform for good');
    // Only the request timestamp moved; the account is untouched.
    expect(repo.deactivationWrites).toEqual([NOW]);
    expect(repo.sessions.every((row) => row.revokedAt === null)).toBe(true);
  });
});

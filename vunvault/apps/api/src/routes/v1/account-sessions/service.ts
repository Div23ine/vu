import {
  DEFAULT_CHANNEL_TOGGLES,
  NOTIFICATION_EVENT_ORDER,
  type ChannelToggles,
  type NotificationEvent,
  type NotificationPrefs,
  type SessionView,
} from '@vunvault/contracts';
import { HttpError } from '../../../lib/http-error';
import { isStaff } from '../../../lib/staff';
import type { NotificationDispatcher } from '../../../lib/notify';
import { parseTimeOfDay } from '../../../lib/notify';
import type { SupabaseAdmin } from '../../../lib/supabase-admin';
import type { AccountSessionsRepo, NotificationPrefsRepo } from './repo';

/**
 * Notification preferences, device sessions and the deactivation request.
 *
 * Every method acts on the caller's own rows: the user id comes from the token
 * and is never read from the body or the path.
 */

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
/** A repeat deactivation request inside this window is refused. */
export const DEACTIVATION_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export interface PrefsUpdateResult {
  prefs: NotificationPrefs;
  /** Event keys whose channel toggles actually changed. */
  changed: NotificationEvent[];
}

export class NotificationPreferencesService {
  constructor(private readonly deps: { repo: NotificationPrefsRepo }) {}

  /** Missing rows are filled with the planner defaults, never with `false`. */
  async get(userId: string): Promise<NotificationPrefs> {
    const [rows, quietHours] = await Promise.all([
      this.deps.repo.listToggles(userId),
      this.deps.repo.getQuietHours(userId),
    ]);
    const stored = new Map(rows.map((row) => [row.event, row]));

    const events = {} as Record<NotificationEvent, ChannelToggles>;
    for (const event of NOTIFICATION_EVENT_ORDER) {
      const row = stored.get(event);
      events[event] =
        row === undefined
          ? { ...DEFAULT_CHANNEL_TOGGLES }
          : { inApp: row.inApp, email: row.email, sms: row.sms, push: row.push };
    }
    return { events, quietHours };
  }

  /** Replaces every row atomically and reports which events changed. */
  async put(userId: string, body: NotificationPrefs): Promise<PrefsUpdateResult> {
    validateQuietHours(body.quietHours);

    const before = await this.get(userId);
    const changed: NotificationEvent[] = [];
    for (const event of NOTIFICATION_EVENT_ORDER) {
      const next = body.events[event] ?? DEFAULT_CHANNEL_TOGGLES;
      const previous = before.events[event] ?? DEFAULT_CHANNEL_TOGGLES;
      if (
        next.inApp !== previous.inApp ||
        next.email !== previous.email ||
        next.sms !== previous.sms ||
        next.push !== previous.push
      ) {
        changed.push(event);
      }
    }

    const events = {} as Record<NotificationEvent, ChannelToggles>;
    for (const event of NOTIFICATION_EVENT_ORDER) {
      events[event] = body.events[event] ?? DEFAULT_CHANNEL_TOGGLES;
    }
    await this.deps.repo.replaceToggles(userId, events);
    await this.deps.repo.putQuietHours(userId, body.quietHours);

    return { prefs: { events, quietHours: body.quietHours }, changed };
  }
}

function validateQuietHours(quietHours: NotificationPrefs['quietHours']): void {
  const { enabled, from, to } = quietHours;
  if (!enabled) return;
  if (from === null || to === null) {
    throw HttpError.badRequest('validation_failed', [
      { path: ['quietHours'], message: 'Set both a start and an end time' },
    ]);
  }
  if (!TIME_PATTERN.test(from) || !TIME_PATTERN.test(to)) {
    throw HttpError.badRequest('validation_failed', [
      { path: ['quietHours'], message: 'Use the 24-hour form HH:MM' },
    ]);
  }
  if (parseTimeOfDay(from) === parseTimeOfDay(to)) {
    throw HttpError.badRequest('validation_failed', [
      { path: ['quietHours'], message: 'The start and end time must differ' },
    ]);
  }
}

export interface AccountSessionsServiceDeps {
  repo: AccountSessionsRepo;
  supabase: SupabaseAdmin;
  /** Drops `sess:<id>` from Redis so the next request is rejected immediately. */
  invalidate?: (sessionId: string) => Promise<void>;
  now?: () => Date;
}

export class AccountSessionsService {
  private readonly repo: AccountSessionsRepo;
  private readonly supabase: SupabaseAdmin;
  private readonly invalidate: (sessionId: string) => Promise<void>;
  private readonly now: () => Date;

  constructor(deps: AccountSessionsServiceDeps) {
    this.repo = deps.repo;
    this.supabase = deps.supabase;
    this.invalidate = deps.invalidate ?? (async () => undefined);
    this.now = deps.now ?? (() => new Date());
  }

  async list(userId: string, currentSessionId: string | null): Promise<SessionView[]> {
    const rows = await this.repo.listSessions(userId);
    return rows.map((row) => ({
      id: row.id,
      deviceLabel: row.deviceLabel,
      ip: row.ip,
      location:
        row.geoCity === null || row.geoCountry === null
          ? null
          : `${row.geoCity}, ${row.geoCountry}`,
      mfaMethod: row.mfaMethod,
      startedAt: row.startedAt,
      current: row.id === currentSessionId,
    }));
  }

  /**
   * Revoking the session you are standing on is refused: sign out instead, so the
   * client never ends up holding a cookie for a dead session.
   */
  async revoke(userId: string, sessionId: string, currentSessionId: string | null): Promise<void> {
    const row = await this.repo.findSession(sessionId);
    // Someone else's session id is indistinguishable from a session that does not
    // exist: both are 404.
    if (row === null || row.userId !== userId || row.revokedAt !== null) {
      throw HttpError.notFound();
    }
    if (sessionId === currentSessionId) {
      throw new HttpError(409, 'use_logout', 'Sign out to end this session');
    }
    await this.revokeAll([sessionId]);
  }

  async revokeOthers(userId: string, currentSessionId: string | null): Promise<number> {
    const rows = await this.repo.listSessions(userId);
    const others = rows
      .filter((row) => row.id !== currentSessionId && row.revokedAt === null)
      .map((row) => row.id);
    return this.revokeAll(others);
  }

  private async revokeAll(sessionIds: string[]): Promise<number> {
    if (sessionIds.length === 0) return 0;
    const revoked = await this.repo.revokeSessions(sessionIds, this.now());
    for (const sessionId of sessionIds) {
      // Supabase first: if that fails the row stays live and the user can retry.
      await this.supabase.deleteSession(sessionId).catch(() => undefined);
      await this.invalidate(sessionId).catch(() => undefined);
    }
    return revoked;
  }
}

export interface DeactivationServiceDeps {
  repo: AccountSessionsRepo;
  prefs: NotificationPrefsRepo;
  notify: NotificationDispatcher;
  now?: () => Date;
}

export class DeactivationService {
  private readonly repo: AccountSessionsRepo;
  private readonly prefs: NotificationPrefsRepo;
  private readonly notify: NotificationDispatcher;
  private readonly now: () => Date;

  constructor(deps: DeactivationServiceDeps) {
    this.repo = deps.repo;
    this.prefs = deps.prefs;
    this.notify = deps.notify;
    this.now = deps.now ?? (() => new Date());
  }

  /**
   * Records the request and pages the super admins. It deactivates nothing:
   * removing a staff account is an administrator's decision, made elsewhere.
   */
  async request(userId: string, reason: string): Promise<{ adminsNotified: number }> {
    const profile = await this.repo.getDeactivation(userId);
    if (!isStaff(profile.role)) {
      throw new HttpError(403, 'forbidden', 'Only staff accounts can request deactivation');
    }
    if (profile.requestedAt !== null) {
      const elapsed = this.now().getTime() - new Date(profile.requestedAt).getTime();
      if (elapsed < DEACTIVATION_COOLDOWN_MS) {
        throw new HttpError(409, 'already_requested', 'A request is already pending');
      }
    }

    const at = this.now();
    await this.repo.requestDeactivation(userId, at);

    const admins = await this.prefs.listActiveSuperAdmins();
    for (const admin of admins) {
      if (admin.userId === userId) continue;
      await this.notify.dispatch({
        userId: admin.userId,
        event: 'credentials_changed',
        title: 'Deactivation requested',
        body: `${profile.email} requested account deactivation. Reason: ${reason}`,
        critical: true,
      });
    }
    return { adminsNotified: admins.filter((admin) => admin.userId !== userId).length };
  }
}

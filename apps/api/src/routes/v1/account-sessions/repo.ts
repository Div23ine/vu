import { asExecutor, type SqlExecutor } from '../../../audit/repo.js';
import {
  NOTIFICATION_EVENT_ORDER,
  type ChannelToggles,
  type MfaMethod,
  type NotificationEvent,
} from '@vunvault/contracts';
import type { NotifyRecipient, QuietHours } from '../../../lib/notify.js';

/**
 * Data access for notification preferences, device sessions and the deactivation
 * request. Two repos in one file: they read the same identity tables and are
 * always constructed together.
 */

export interface ToggleRow extends ChannelToggles {
  event: NotificationEvent;
}

export interface SessionRow {
  id: string;
  userId: string;
  deviceLabel: string;
  userAgent: string | null;
  ip: string | null;
  geoCity: string | null;
  geoCountry: string | null;
  mfaMethod: MfaMethod | null;
  startedAt: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
}

export interface DeactivationRow {
  userId: string;
  role: string;
  requestedAt: string | null;
  email: string;
}

export type SuperAdminRow = NotifyRecipient;

export interface NotificationPrefsRepo {
  listToggles(userId: string): Promise<ToggleRow[]>;
  /** Replaces all eleven rows in one statement: the PUT is atomic. */
  replaceToggles(userId: string, toggles: Record<NotificationEvent, ChannelToggles>): Promise<void>;
  getQuietHours(userId: string): Promise<QuietHours>;
  putQuietHours(userId: string, quietHours: QuietHours): Promise<void>;
  recipient(userId: string): Promise<NotifyRecipient>;
  listActiveSuperAdmins(): Promise<SuperAdminRow[]>;
}

export interface AccountSessionsRepo {
  listSessions(userId: string): Promise<SessionRow[]>;
  findSession(sessionId: string): Promise<SessionRow | null>;
  revokeSessions(sessionIds: string[], at: Date): Promise<number>;
  getDeactivation(userId: string): Promise<DeactivationRow>;
  requestDeactivation(userId: string, at: Date): Promise<void>;
}

interface SqlToggleRow {
  event: NotificationEvent;
  in_app: boolean;
  email: boolean;
  sms: boolean;
  push: boolean;
}

interface SqlSessionRow {
  id: string;
  user_id: string;
  device_label: string | null;
  user_agent: string | null;
  ip: string | null;
  geo_city: string | null;
  geo_country: string | null;
  mfa_method: MfaMethod | null;
  started_at: string;
  last_seen_at: string | null;
  revoked_at: string | null;
}

const SESSION_COLUMNS = `select id::text as id, user_id::text as user_id, device_label, user_agent,
       ip::text as ip, geo_city, geo_country, mfa_method::text as mfa_method,
       started_at, last_seen_at, revoked_at
  from user_sessions`;

export class SqlNotificationPrefsRepo implements NotificationPrefsRepo {
  private readonly executor: SqlExecutor;

  constructor(connection: unknown) {
    this.executor = asExecutor(connection);
  }

  async listToggles(userId: string): Promise<ToggleRow[]> {
    const rows = await this.executor.unsafe<SqlToggleRow[]>(
      `select event::text as event, in_app, email, sms, push
         from notification_preferences
        where user_id = $1::uuid`,
      [userId],
    );
    return rows.map((row) => ({
      event: row.event,
      inApp: row.in_app,
      email: row.email,
      sms: row.sms,
      push: row.push,
    }));
  }

  async replaceToggles(
    userId: string,
    toggles: Record<NotificationEvent, ChannelToggles>,
  ): Promise<void> {
    // One multi-row upsert: either every event is written or none is.
    const values: unknown[] = [userId];
    const tuples: string[] = [];
    for (const event of NOTIFICATION_EVENT_ORDER) {
      const channels: ChannelToggles = toggles[event];
      const base = values.length;
      values.push(event, channels.inApp, channels.email, channels.sms, channels.push);
      tuples.push(
        `($1::uuid, $${base}::notification_event, $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`,
      );
    }
    await this.executor.unsafe(
      `insert into notification_preferences (user_id, event, in_app, email, sms, push)
       values ${tuples.join(', ')}
       on conflict (user_id, event) do update
          set in_app = excluded.in_app,
              email = excluded.email,
              sms = excluded.sms,
              push = excluded.push,
              updated_at = now()`,
      values,
    );
  }

  async getQuietHours(userId: string): Promise<QuietHours> {
    const rows = await this.executor.unsafe<
      Array<{ quiet_hours_enabled: boolean; quiet_from: string | null; quiet_to: string | null }>
    >(
      `select quiet_hours_enabled, quiet_from::text as quiet_from, quiet_to::text as quiet_to
         from notification_settings
        where user_id = $1::uuid
        limit 1`,
      [userId],
    );
    const row = rows[0];
    if (row === undefined) return { enabled: false, from: null, to: null };
    return {
      enabled: row.quiet_hours_enabled,
      from: row.quiet_from === null ? null : row.quiet_from.slice(0, 5),
      to: row.quiet_to === null ? null : row.quiet_to.slice(0, 5),
    };
  }

  async putQuietHours(userId: string, quietHours: QuietHours): Promise<void> {
    await this.executor.unsafe(
      `insert into notification_settings (user_id, quiet_hours_enabled, quiet_from, quiet_to)
       values ($1::uuid, $2, $3::time, $4::time)
       on conflict (user_id) do update
          set quiet_hours_enabled = excluded.quiet_hours_enabled,
              quiet_from = excluded.quiet_from,
              quiet_to = excluded.quiet_to,
              updated_at = now()`,
      [userId, quietHours.enabled, quietHours.from, quietHours.to],
    );
  }

  async recipient(userId: string): Promise<NotifyRecipient> {
    const rows = await this.executor.unsafe<
      Array<{ id: string; email: string; phone: string | null; timezone: string }>
    >(
      `select id::text as id, email::text as email, phone, timezone
         from profiles
        where id = $1::uuid and deleted_at is null
        limit 1`,
      [userId],
    );
    const row = rows[0];
    if (row === undefined) throw new Error(`profile not found: ${userId}`);
    return { userId: row.id, email: row.email, phone: row.phone, timezone: row.timezone };
  }

  async listActiveSuperAdmins(): Promise<SuperAdminRow[]> {
    const rows = await this.executor.unsafe<
      Array<{ id: string; email: string; phone: string | null; timezone: string }>
    >(
      `select id::text as id, email::text as email, phone, timezone
         from profiles
        where role = 'super_admin'
          and account_status = 'active'
          and deleted_at is null
          and suspended_at is null`,
      [],
    );
    return rows.map((row) => ({
      userId: row.id,
      email: row.email,
      phone: row.phone,
      timezone: row.timezone,
    }));
  }
}

export class SqlAccountSessionsRepo implements AccountSessionsRepo {
  private readonly executor: SqlExecutor;

  constructor(connection: unknown) {
    this.executor = asExecutor(connection);
  }

  async listSessions(userId: string): Promise<SessionRow[]> {
    const rows = await this.executor.unsafe<SqlSessionRow[]>(
      `${SESSION_COLUMNS}
        where user_id = $1::uuid and revoked_at is null
        order by started_at desc`,
      [userId],
    );
    return rows.map(mapSessionRow);
  }

  async findSession(sessionId: string): Promise<SessionRow | null> {
    const rows = await this.executor.unsafe<SqlSessionRow[]>(
      `${SESSION_COLUMNS}
        where id = $1::uuid
        limit 1`,
      [sessionId],
    );
    const row = rows[0];
    return row === undefined ? null : mapSessionRow(row);
  }

  async revokeSessions(sessionIds: string[], at: Date): Promise<number> {
    if (sessionIds.length === 0) return 0;
    const rows = await this.executor.unsafe<Array<{ id: string }>>(
      `update user_sessions
          set revoked_at = $2
        where id = any($1::uuid[]) and revoked_at is null
        returning id::text as id`,
      [sessionIds, at],
    );
    return rows.length;
  }

  async getDeactivation(userId: string): Promise<DeactivationRow> {
    const rows = await this.executor.unsafe<
      Array<{ id: string; role: string; deactivation_requested_at: string | null; email: string }>
    >(
      `select id::text as id, role::text as role, deactivation_requested_at, email::text as email
         from profiles
        where id = $1::uuid and deleted_at is null
        limit 1`,
      [userId],
    );
    const row = rows[0];
    if (row === undefined) throw new Error(`profile not found: ${userId}`);
    return {
      userId: row.id,
      role: row.role,
      requestedAt:
        row.deactivation_requested_at === null
          ? null
          : new Date(row.deactivation_requested_at).toISOString(),
      email: row.email,
    };
  }

  async requestDeactivation(userId: string, at: Date): Promise<void> {
    await this.executor.unsafe(
      `update profiles set deactivation_requested_at = $2, updated_at = now() where id = $1::uuid`,
      [userId, at],
    );
  }
}

function mapSessionRow(row: SqlSessionRow): SessionRow {
  return {
    id: row.id,
    userId: row.user_id,
    deviceLabel: row.device_label ?? 'Unknown device',
    userAgent: row.user_agent,
    ip: row.ip,
    geoCity: row.geo_city,
    geoCountry: row.geo_country,
    mfaMethod: row.mfa_method,
    startedAt: new Date(row.started_at).toISOString(),
    lastSeenAt: row.last_seen_at === null ? null : new Date(row.last_seen_at).toISOString(),
    revokedAt: row.revoked_at === null ? null : new Date(row.revoked_at).toISOString(),
  };
}

import { asExecutor, type SqlExecutor } from '../../../audit/repo.js';

/**
 * Profile-settings data access.
 *
 * The route file never touches SQL; the service never builds a query. `username`
 * is derived from the email local-part in the service rather than stored, so it
 * cannot drift from the address Supabase authenticates against.
 */

export interface SettingsRow {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  displayName: string;
  jobTitle: string | null;
  email: string;
  phone: string | null;
  timezone: string;
  language: string;
  bio: string | null;
  avatarKey: string | null;
  role: string;
  team: string | null;
  memberSince: string;
  require2fa: boolean;
  mfaEnrolled: boolean;
  mfaMethods: string[];
  lastSignInAt: string | null;
}

export interface SettingsPatch {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  jobTitle?: string | null;
  phone?: string | null;
  timezone?: string;
  language?: string;
  bio?: string | null;
  /** Kept equal to `firstName + " " + lastName` by the service. */
  fullName?: string;
}

export interface AccountSettingsRepo {
  getSettings(userId: string): Promise<SettingsRow>;
  updateSettings(userId: string, patch: SettingsPatch): Promise<void>;
  setAvatarKey(userId: string, avatarKey: string | null): Promise<void>;
  countActiveSessions(userId: string): Promise<number>;
  countWebauthnCredentials(userId: string): Promise<number>;
}

interface SqlProfileRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  display_name: string | null;
  job_title: string | null;
  phone: string | null;
  timezone: string;
  language: string;
  bio: string | null;
  avatar_key: string | null;
  role: string;
  team: string | null;
  joined_at: string;
  require_2fa: boolean;
  mfa_enrolled: boolean;
  mfa_methods: string[] | null;
  last_active_at: string | null;
}

const SELECT_SETTINGS = `select p.id::text as id,
       p.email::text as email,
       p.first_name, p.last_name, p.full_name, p.display_name,
       p.job_title, p.phone, p.timezone, p.language, p.bio, p.avatar_key,
       p.role::text as role, p.team::text as team, p.joined_at, p.require_2fa,
       p.mfa_enrolled, p.mfa_methods::text[] as mfa_methods, p.last_active_at
  from profiles p
 where p.id = $1::uuid and p.deleted_at is null
 limit 1`;

export class SqlAccountSettingsRepo implements AccountSettingsRepo {
  private readonly executor: SqlExecutor;

  constructor(connection: unknown) {
    this.executor = asExecutor(connection);
  }

  async getSettings(userId: string): Promise<SettingsRow> {
    const rows = await this.executor.unsafe<SqlProfileRow[]>(SELECT_SETTINGS, [userId]);
    const row = rows[0];
    if (row === undefined) throw new Error(`profile not found: ${userId}`);

    const [firstName, lastName] = splitFullName(row.full_name);
    return {
      id: row.id,
      firstName: row.first_name ?? firstName,
      lastName: row.last_name ?? lastName,
      fullName: row.full_name,
      displayName: row.display_name ?? row.full_name,
      jobTitle: row.job_title,
      email: row.email,
      phone: row.phone,
      timezone: row.timezone,
      language: row.language,
      bio: row.bio,
      avatarKey: row.avatar_key,
      role: row.role,
      team: row.team,
      memberSince: new Date(row.joined_at).toISOString(),
      require2fa: row.require_2fa,
      mfaEnrolled: row.mfa_enrolled,
      mfaMethods: row.mfa_methods ?? [],
      lastSignInAt: row.last_active_at === null ? null : new Date(row.last_active_at).toISOString(),
    };
  }

  async updateSettings(userId: string, patch: SettingsPatch): Promise<void> {
    const assignments: string[] = [];
    const values: unknown[] = [];
    const add = (column: string, value: unknown): void => {
      values.push(value);
      assignments.push(`${column} = $${values.length}`);
    };

    if (patch.firstName !== undefined) add('first_name', patch.firstName);
    if (patch.lastName !== undefined) add('last_name', patch.lastName);
    if (patch.fullName !== undefined) add('full_name', patch.fullName);
    if (patch.displayName !== undefined) add('display_name', patch.displayName);
    if (patch.jobTitle !== undefined) add('job_title', patch.jobTitle);
    if (patch.phone !== undefined) add('phone', patch.phone);
    if (patch.timezone !== undefined) add('timezone', patch.timezone);
    if (patch.language !== undefined) add('language', patch.language);
    if (patch.bio !== undefined) add('bio', patch.bio);
    if (assignments.length === 0) return;

    values.push(userId);
    await this.executor.unsafe(
      `update profiles
          set ${assignments.join(', ')}, updated_at = now()
        where id = $${values.length}::uuid`,
      values,
    );
  }

  async setAvatarKey(userId: string, avatarKey: string | null): Promise<void> {
    await this.executor.unsafe(
      `update profiles set avatar_key = $2, updated_at = now() where id = $1::uuid`,
      [userId, avatarKey],
    );
  }

  async countActiveSessions(userId: string): Promise<number> {
    const rows = await this.executor.unsafe<Array<{ count: string }>>(
      `select count(*)::text as count
         from user_sessions
        where user_id = $1::uuid and revoked_at is null`,
      [userId],
    );
    return Number(rows[0]?.count ?? '0');
  }

  async countWebauthnCredentials(userId: string): Promise<number> {
    const rows = await this.executor.unsafe<Array<{ count: string }>>(
      `select count(*)::text as count from webauthn_credentials where user_id = $1::uuid`,
      [userId],
    );
    return Number(rows[0]?.count ?? '0');
  }
}

/** `full_name` predates the split columns, so derive the halves when they are null. */
function splitFullName(fullName: string): [string, string] {
  const index = fullName.indexOf(' ');
  if (index === -1) return [fullName, ''];
  return [fullName.slice(0, index), fullName.slice(index + 1)];
}

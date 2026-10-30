import { createHash } from 'node:crypto';
import type { AccountStatus, MfaMethod, UserRole } from '@vunvault/contracts';
import { asExecutor, type SqlExecutor } from '../../../audit/repo.js';

/**
 * Auth data access.
 *
 * Repos take a Drizzle `Db | Tx` and return plain objects; routes never touch SQL
 * and services never see a row shape. Statements go through the driver so the API
 * does not need `drizzle-orm` as a direct dependency (it arrives via
 * `@vunvault/db`).
 */

export interface AuthProfileRow {
  id: string;
  email: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  orgId: string | null;
  accountStatus: AccountStatus;
  deletedAt: string | null;
  mfaEnrolled: boolean;
}

export interface NewOrganization {
  name: string;
  clientCode: string;
  country: string | null;
}

export interface NewProfile {
  id: string;
  orgId: string | null;
  email: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  country: string | null;
  accountType: 'individual' | 'company';
  role: UserRole;
  /** Task 40d: signup writes `pending_verification`; the OTP activates it. */
  accountStatus?: AccountStatus;
  /** Task 40d: every self-service signup must enrol an authenticator. */
  require2fa?: boolean;
}

export interface NewSession {
  id: string;
  userId: string;
  deviceLabel: string;
  userAgent: string | null;
  ip: string | null;
  geoCity: string | null;
  geoCountry: string | null;
  mfaMethod: MfaMethod | null;
}

export interface AuthRepo {
  findProfileByEmail(email: string): Promise<AuthProfileRow | null>;
  findProfileById(id: string): Promise<AuthProfileRow | null>;
  nextClientCode(): Promise<string>;
  createOrganization(input: NewOrganization): Promise<string>;
  createProfile(input: NewProfile): Promise<void>;
  countWebauthnCredentials(userId: string): Promise<number>;
  recordLoginAttempt(input: {
    emailHash: string;
    ip: string;
    succeeded: boolean;
    reason: string | null;
  }): Promise<void>;
  countRecentFailuresByEmail(emailHash: string, since: Date): Promise<number>;
  countRecentFailuresByIp(ip: string, since: Date): Promise<number>;
  createSession(input: NewSession): Promise<void>;
  revokeSession(sessionId: string, at: Date): Promise<void>;
  touchSession(sessionId: string, at: Date): Promise<void>;
  touchProfileLastActive(profileId: string, at: Date): Promise<void>;

  // --- forced MFA setup (Phase 2) -------------------------------------------
  /** Move the account status (e.g. `active` → `blocked_mfa_setup` and back). */
  setAccountStatus(profileId: string, status: AccountStatus): Promise<void>;
  /** Persist the `mfa_enrolled` flag once a factor has been verified. */
  setMfaEnrolled(profileId: string, enrolled: boolean): Promise<void>;

  // --- pending signups (Task 40d) -------------------------------------------
  /** Flip `pending_verification` → `active`. False when the profile moved on. */
  activatePendingSignup(profileId: string): Promise<boolean>;
  /**
   * Delete an unverified signup: the profile row and the organisation the signup
   * created. The Supabase auth user is deleted by the service, not here.
   */
  deletePendingSignup(profileId: string): Promise<boolean>;
  /**
   * The cleanup contract for the maintenance worker (Layer L11): pending signups
   * older than 24 h are deleted — profile, organization, Supabase user. This
   * query finds them; the worker task implements the schedule.
   */
  listStalePendingSignups(
    olderThan: Date,
  ): Promise<Array<{ id: string; email: string; orgId: string | null }>>;

  // --- password reset (Task 40d) --------------------------------------------
  /** Revoke every live session of the user and return the revoked session ids. */
  revokeAllSessions(userId: string, at: Date): Promise<string[]>;
  setLastPasswordChangeAt(userId: string, at: Date): Promise<void>;
}

/** Login attempts are keyed by a digest — the address itself is never stored. */
export function emailHash(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase(), 'utf8').digest('hex');
}

const PROFILE_COLUMNS = `
  p.id::text as id,
  p.email::text as email,
  p.full_name,
  p.first_name,
  p.last_name,
  p.role::text as role,
  p.org_id::text as org_id,
  p.account_status::text as account_status,
  p.deleted_at,
  p.mfa_enrolled
`;

interface ProfileSqlRow {
  id: string;
  email: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  org_id: string | null;
  account_status: AccountStatus;
  deleted_at: Date | string | null;
  mfa_enrolled: boolean;
}

function toProfile(row: ProfileSqlRow): AuthProfileRow {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    orgId: row.org_id,
    accountStatus: row.account_status,
    deletedAt: row.deleted_at === null ? null : new Date(row.deleted_at).toISOString(),
    mfaEnrolled: row.mfa_enrolled,
  };
}

export class SqlAuthRepo implements AuthRepo {
  private readonly executor: SqlExecutor;

  constructor(connection: unknown) {
    this.executor = asExecutor(connection);
  }

  async findProfileByEmail(email: string): Promise<AuthProfileRow | null> {
    const rows = await this.executor.unsafe<ProfileSqlRow[]>(
      `select ${PROFILE_COLUMNS} from profiles p where p.email = $1::citext limit 1`,
      [email.trim().toLowerCase()],
    );
    const row = rows[0];
    return row === undefined ? null : toProfile(row);
  }

  async findProfileById(id: string): Promise<AuthProfileRow | null> {
    const rows = await this.executor.unsafe<ProfileSqlRow[]>(
      `select ${PROFILE_COLUMNS} from profiles p where p.id = $1::uuid limit 1`,
      [id],
    );
    const row = rows[0];
    return row === undefined ? null : toProfile(row);
  }

  async nextClientCode(): Promise<string> {
    const rows = await this.executor.unsafe<Array<{ code: string }>>(
      'select next_client_code() as code',
    );
    return rows[0]?.code ?? '';
  }

  async createOrganization(input: NewOrganization): Promise<string> {
    const rows = await this.executor.unsafe<Array<{ id: string }>>(
      `insert into organizations (name, client_code, country)
       values ($1, $2, $3)
       returning id::text as id`,
      [input.name, input.clientCode, input.country],
    );
    return rows[0]?.id ?? '';
  }

  async createProfile(input: NewProfile): Promise<void> {
    await this.executor.unsafe(
      `insert into profiles (
         id, org_id, email, full_name, first_name, last_name, phone, country,
         account_type, role, account_status, require_2fa
       ) values ($1::uuid, $2::uuid, $3::citext, $4, $5, $6, $7, $8, $9::account_type, $10::user_role, $11::account_status, $12)`,
      [
        input.id,
        input.orgId,
        input.email,
        input.fullName,
        input.firstName,
        input.lastName,
        input.phone,
        input.country,
        input.accountType,
        input.role,
        input.accountStatus ?? 'active',
        input.require2fa ?? true,
      ],
    );
  }

  async countWebauthnCredentials(userId: string): Promise<number> {
    const rows = await this.executor.unsafe<Array<{ count: string | number }>>(
      'select count(*)::text as count from webauthn_credentials where user_id = $1::uuid',
      [userId],
    );
    return Number(rows[0]?.count ?? 0);
  }

  async recordLoginAttempt(input: {
    emailHash: string;
    ip: string;
    succeeded: boolean;
    reason: string | null;
  }): Promise<void> {
    await this.executor.unsafe(
      `insert into login_attempts (email_hash, ip, succeeded, reason)
       values ($1, $2::inet, $3, $4)`,
      [input.emailHash, input.ip, input.succeeded, input.reason],
    );
  }

  async countRecentFailuresByEmail(emailHashValue: string, since: Date): Promise<number> {
    const rows = await this.executor.unsafe<Array<{ count: string | number }>>(
      `select count(*)::text as count from login_attempts
        where email_hash = $1 and succeeded = false and created_at >= $2`,
      [emailHashValue, since],
    );
    return Number(rows[0]?.count ?? 0);
  }

  async countRecentFailuresByIp(ip: string, since: Date): Promise<number> {
    const rows = await this.executor.unsafe<Array<{ count: string | number }>>(
      `select count(*)::text as count from login_attempts
        where ip = $1::inet and succeeded = false and created_at >= $2`,
      [ip, since],
    );
    return Number(rows[0]?.count ?? 0);
  }

  async createSession(input: NewSession): Promise<void> {
    await this.executor.unsafe(
      `insert into user_sessions (
         id, user_id, device_label, user_agent, ip, geo_city, geo_country, mfa_method
       ) values ($1::uuid, $2::uuid, $3, $4, $5::inet, $6, $7, $8::mfa_method)`,
      [
        input.id,
        input.userId,
        input.deviceLabel,
        input.userAgent,
        input.ip,
        input.geoCity,
        input.geoCountry,
        input.mfaMethod,
      ],
    );
  }

  async revokeSession(sessionId: string, at: Date): Promise<void> {
    await this.executor.unsafe('update user_sessions set revoked_at = $2 where id = $1::uuid', [
      sessionId,
      at,
    ]);
  }

  async touchSession(sessionId: string, at: Date): Promise<void> {
    await this.executor.unsafe('update user_sessions set last_seen_at = $2 where id = $1::uuid', [
      sessionId,
      at,
    ]);
  }

  async touchProfileLastActive(profileId: string, at: Date): Promise<void> {
    await this.executor.unsafe('update profiles set last_active_at = $2 where id = $1::uuid', [
      profileId,
      at,
    ]);
  }

  async setAccountStatus(profileId: string, status: AccountStatus): Promise<void> {
    await this.executor.unsafe(
      'update profiles set account_status = $2::account_status where id = $1::uuid',
      [profileId, status],
    );
  }

  async setMfaEnrolled(profileId: string, enrolled: boolean): Promise<void> {
    await this.executor.unsafe('update profiles set mfa_enrolled = $2 where id = $1::uuid', [
      profileId,
      enrolled,
    ]);
  }

  async activatePendingSignup(profileId: string): Promise<boolean> {
    // Guarded by the status so a suspended or deleted account can never be
    // activated by a leftover OTP.
    const rows = await this.executor.unsafe<Array<{ id: string }>>(
      `update profiles set account_status = 'active'
        where id = $1::uuid and account_status = 'pending_verification'
        returning id::text as id`,
      [profileId],
    );
    return rows.length > 0;
  }

  async deletePendingSignup(profileId: string): Promise<boolean> {
    // One statement: the profile goes only if it is still pending, and the
    // organisation the signup created goes with it.
    const rows = await this.executor.unsafe<Array<{ removed: string | number }>>(
      `with removed as (
         delete from profiles
          where id = $1::uuid and account_status = 'pending_verification'
          returning org_id
       ), orgs as (
         delete from organizations
          where id in (select org_id from removed)
          returning id
       ) select (select count(*) from removed)::text as removed`,
      [profileId],
    );
    return Number(rows[0]?.removed ?? 0) > 0;
  }

  async listStalePendingSignups(
    olderThan: Date,
  ): Promise<Array<{ id: string; email: string; orgId: string | null }>> {
    const rows = await this.executor.unsafe<
      Array<{ id: string; email: string; org_id: string | null }>
    >(
      `select p.id::text as id, p.email::text as email, p.org_id::text as org_id
         from profiles p
        where p.account_status = 'pending_verification'
          and p.created_at < $1
        order by p.created_at asc`,
      [olderThan],
    );
    return rows.map((row) => ({ id: row.id, email: row.email, orgId: row.org_id }));
  }

  async revokeAllSessions(userId: string, at: Date): Promise<string[]> {
    const rows = await this.executor.unsafe<Array<{ id: string }>>(
      `with revoked as (
         update user_sessions set revoked_at = $2
          where user_id = $1::uuid and revoked_at is null
          returning id::text as id
       ) select id from revoked`,
      [userId, at],
    );
    return rows.map((row) => row.id);
  }

  async setLastPasswordChangeAt(userId: string, at: Date): Promise<void> {
    await this.executor.unsafe(
      'update profiles set last_password_change_at = $2 where id = $1::uuid',
      [userId, at],
    );
  }
}

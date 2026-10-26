import { asExecutor, type SqlExecutor } from '../../../audit/repo.js';
import type { MfaMethod, Team, UserRole } from '@vunvault/contracts';

/**
 * User & Access Management data access.
 *
 * The roster reads `profiles` and `staff_invitations` separately: an invitation
 * that has not been accepted has no profile row yet, but it still has to appear in
 * the roster so an administrator can see who is outstanding.
 */

export interface StaffRow {
  id: string;
  fullName: string;
  email: string;
  jobTitle: string | null;
  role: UserRole;
  team: Team | null;
  accountStatus: string;
  accessTier: string;
  baseLocation: string | null;
  scopeSummary: string | null;
  mfaEnrolled: boolean;
  mfaMethods: MfaMethod[];
  joinedAt: string;
  lastActiveAt: string | null;
  suspendedAt: string | null;
  accessReviewDue: string | null;
}

export interface InvitationRow {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string | null;
  baseLocation: string | null;
  role: UserRole;
  team: Team;
  accessTier: string;
  scopeNotes: string | null;
  accessReviewDue: string | null;
  status: 'draft' | 'pending' | 'accepted' | 'revoked' | 'expired';
  tokenHash: string | null;
  expiresAt: string;
  resendCount: number;
  checklist: Record<string, boolean>;
}

export interface RosterQuery {
  q?: string;
  role?: UserRole;
  status?: string;
  mfa?: 'enrolled' | 'not_enrolled';
  page: number;
  pageSize: number;
}

export interface SummaryCounts {
  activeMembers: number;
  securityAnalysts: number;
  operators: number;
  pendingInvitations: number;
  activeWithMfa: number;
  dormantAccounts: number;
  onboardedThisMonth: number;
}

export interface CreateInvitationInput {
  email: string;
  fullName: string;
  jobTitle: string | null;
  baseLocation: string | null;
  role: UserRole;
  team: Team;
  accessTier: string;
  scopeNotes: string | null;
  accessReviewDue: string | null;
  checklist: Record<string, boolean>;
  status: 'draft' | 'pending';
  tokenHash: string | null;
  expiresAt: Date;
  invitedBy: string;
}

export interface CreateProfileInput {
  userId: string;
  email: string;
  fullName: string;
  jobTitle: string | null;
  baseLocation: string | null;
  role: UserRole;
  team: Team;
  accessTier: string;
  scopeNotes: string | null;
  accessReviewDue: string | null;
  joinedAt: Date;
}

export interface RecordSessionInput {
  sessionId: string;
  userId: string;
  deviceLabel: string;
  userAgent: string | null;
  ip: string | null;
  mfaMethod: MfaMethod | null;
  startedAt: Date;
}

export interface UsersRepo {
  // --- roster -------------------------------------------------------------
  listStaff(query: RosterQuery): Promise<{ rows: StaffRow[]; total: number }>;
  listPendingInvitations(now: Date): Promise<InvitationRow[]>;
  getMember(userId: string): Promise<StaffRow | null>;
  findByEmail(email: string): Promise<StaffRow | null>;
  countActiveSuperAdmins(exceptUserId?: string): Promise<number>;
  /** Active super administrators as notification recipients. */
  findSuperAdminRecipients(): Promise<
    Array<{ userId: string; email: string; phone: string | null; timezone: string }>
  >;

  // --- summary ------------------------------------------------------------
  summaryCounts(now: Date): Promise<SummaryCounts>;

  // --- invitations --------------------------------------------------------
  emailInUse(email: string): Promise<boolean>;
  findInvitationByEmail(email: string): Promise<InvitationRow | null>;
  findInvitationById(id: string): Promise<InvitationRow | null>;
  findInvitationByTokenHash(tokenHash: string): Promise<InvitationRow | null>;
  insertInvitation(input: CreateInvitationInput): Promise<InvitationRow>;
  updateInvitation(
    id: string,
    patch: Partial<
      Pick<InvitationRow, 'status' | 'tokenHash' | 'resendCount'> & { expiresAt: Date | string }
    >,
  ): Promise<InvitationRow>;

  // --- accounts -----------------------------------------------------------
  createProfile(input: CreateProfileInput): Promise<void>;
  updateMember(
    userId: string,
    patch: Partial<
      Pick<StaffRow, 'role' | 'accountStatus' | 'accessTier'> & {
        require2fa: boolean;
        suspendedAt: Date | null;
        suspendedReason: string | null;
        deletedAt: Date;
      }
    >,
  ): Promise<void>;
  listSessionIds(userId: string): Promise<string[]>;
  revokeSessions(sessionIds: string[], at: Date): Promise<number>;
  recordSession(input: RecordSessionInput): Promise<void>;
}

interface SqlStaffRow {
  id: string;
  full_name: string;
  email: string;
  job_title: string | null;
  role: UserRole;
  team: Team | null;
  account_status: string;
  access_tier: string;
  base_location: string | null;
  scope_summary: string | null;
  mfa_enrolled: boolean;
  mfa_methods: MfaMethod[] | null;
  joined_at: string;
  last_active_at: string | null;
  suspended_at: string | null;
  access_review_due: string | null;
}

interface SqlInvitationRow {
  id: string;
  email: string;
  full_name: string;
  job_title: string | null;
  base_location: string | null;
  role: UserRole;
  team: Team;
  access_tier: string;
  scope_notes: string | null;
  access_review_due: string | null;
  status: InvitationRow['status'];
  token_hash: string | null;
  expires_at: string;
  resend_count: number;
  checklist: Record<string, boolean> | null;
}

const STAFF_COLUMNS = `select p.id::text as id, p.full_name, p.email::text as email, p.job_title,
       p.role::text as role, p.team::text as team, p.account_status::text as account_status,
       p.access_tier::text as access_tier, p.base_location, p.scope_summary,
       p.mfa_enrolled, p.mfa_methods::text[] as mfa_methods, p.joined_at, p.last_active_at,
       p.suspended_at, p.access_review_due::text as access_review_due
  from profiles p`;

const INVITATION_COLUMNS = `select id::text as id, email::text as email, full_name, job_title,
       base_location, role::text as role, team::text as team, access_tier::text as access_tier,
       scope_notes, access_review_due::text as access_review_due, status::text as status,
       token_hash, expires_at, resend_count, checklist
  from staff_invitations`;

export class SqlUsersRepo implements UsersRepo {
  private readonly executor: SqlExecutor;

  constructor(connection: unknown) {
    this.executor = asExecutor(connection);
  }

  async listStaff(query: RosterQuery): Promise<{ rows: StaffRow[]; total: number }> {
    const conditions: string[] = ['p.deleted_at is null', "p.role <> 'client'"];
    const values: unknown[] = [];
    const add = (fragment: string, value: unknown): void => {
      values.push(value);
      conditions.push(fragment.replace('?', `$${values.length}`));
    };

    if (query.q !== undefined && query.q !== '') {
      // One ILIKE across the three searchable columns.
      add(
        `(p.full_name ilike ? or p.email::text ilike ? or p.scope_summary ilike ?)`,
        `%${query.q}%`,
      );
      values.push(`%${query.q}%`, `%${query.q}%`);
    }
    if (query.role !== undefined) add('p.role::text = ?', query.role);
    if (query.status !== undefined && query.status !== 'pending_invite') {
      add('p.account_status::text = ?', query.status);
    }
    if (query.mfa === 'enrolled') conditions.push('p.mfa_enrolled = true');
    if (query.mfa === 'not_enrolled') conditions.push('p.mfa_enrolled = false');

    const where = conditions.join(' and ');
    const offset = (query.page - 1) * query.pageSize;

    const totalRows = await this.executor.unsafe<Array<{ count: string }>>(
      `select count(*)::text as count from profiles p where ${where}`,
      values,
    );
    const rows = await this.executor.unsafe<SqlStaffRow[]>(
      `${STAFF_COLUMNS}
        where ${where}
        order by p.last_active_at desc nulls last, p.joined_at desc
        limit $${values.length + 1} offset $${values.length + 2}`,
      [...values, query.pageSize, offset],
    );
    return { rows: rows.map(mapStaffRow), total: Number(totalRows[0]?.count ?? '0') };
  }

  async listPendingInvitations(now: Date): Promise<InvitationRow[]> {
    const rows = await this.executor.unsafe<SqlInvitationRow[]>(
      `${INVITATION_COLUMNS}
        where status = 'pending' and expires_at > $1
        order by created_at desc`,
      [now],
    );
    return rows.map(mapInvitationRow);
  }

  async getMember(userId: string): Promise<StaffRow | null> {
    const rows = await this.executor.unsafe<SqlStaffRow[]>(
      `${STAFF_COLUMNS}
        where p.id = $1::uuid and p.deleted_at is null
        limit 1`,
      [userId],
    );
    const row = rows[0];
    return row === undefined ? null : mapStaffRow(row);
  }

  async findByEmail(email: string): Promise<StaffRow | null> {
    const rows = await this.executor.unsafe<SqlStaffRow[]>(
      `${STAFF_COLUMNS}
        where lower(p.email::text) = lower($1)
        limit 1`,
      [email],
    );
    const row = rows[0];
    return row === undefined ? null : mapStaffRow(row);
  }

  async countActiveSuperAdmins(exceptUserId?: string): Promise<number> {
    const rows = await this.executor.unsafe<Array<{ count: string }>>(
      `select count(*)::text as count
         from profiles
        where role = 'super_admin'
          and account_status = 'active'
          and deleted_at is null
          and ($1::uuid is null or id <> $1::uuid)`,
      [exceptUserId ?? null],
    );
    return Number(rows[0]?.count ?? '0');
  }

  async findSuperAdminRecipients() {
    const rows = await this.executor.unsafe<
      Array<{ id: string; email: string; phone: string | null; timezone: string }>
    >(
      `select id::text as id, email::text as email, phone, timezone
         from profiles
        where role = 'super_admin'
          and account_status = 'active'
          and deleted_at is null`,
      [],
    );
    return rows.map((row) => ({
      userId: row.id,
      email: row.email,
      phone: row.phone,
      timezone: row.timezone,
    }));
  }

  async summaryCounts(now: Date): Promise<SummaryCounts> {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const rows = await this.executor.unsafe<
      Array<{
        active_members: string;
        security_analysts: string;
        operators: string;
        active_with_mfa: string;
        dormant_accounts: string;
        onboarded_this_month: string;
      }>
    >(
      `select
         count(*) filter (where account_status = 'active')::text as active_members,
         count(*) filter (where account_status = 'active' and role = 'security_analyst')::text
           as security_analysts,
         count(*) filter (where account_status = 'active' and role = 'soc_operator')::text
           as operators,
         count(*) filter (where account_status = 'active' and mfa_enrolled)::text as active_with_mfa,
         count(*) filter (where account_status = 'dormant')::text as dormant_accounts,
         count(*) filter (where joined_at >= $2)::text as onboarded_this_month
        from profiles
       where role <> 'client' and deleted_at is null`,
      [null, monthStart],
    );
    const invitations = await this.executor.unsafe<Array<{ count: string }>>(
      `select count(*)::text as count
         from staff_invitations
        where status = 'pending' and expires_at > $1`,
      [now],
    );
    const row = rows[0];
    return {
      activeMembers: Number(row?.active_members ?? '0'),
      securityAnalysts: Number(row?.security_analysts ?? '0'),
      operators: Number(row?.operators ?? '0'),
      pendingInvitations: Number(invitations[0]?.count ?? '0'),
      activeWithMfa: Number(row?.active_with_mfa ?? '0'),
      dormantAccounts: Number(row?.dormant_accounts ?? '0'),
      onboardedThisMonth: Number(row?.onboarded_this_month ?? '0'),
    };
  }

  async emailInUse(email: string): Promise<boolean> {
    const rows = await this.executor.unsafe<Array<{ count: string }>>(
      `select
         (select count(*) from profiles where lower(email::text) = lower($1))
         + (select count(*) from staff_invitations
             where lower(email::text) = lower($1) and status in ('draft', 'pending'))
         as count`,
      [email],
    );
    return Number(rows[0]?.count ?? '0') > 0;
  }

  async findInvitationByEmail(email: string): Promise<InvitationRow | null> {
    const rows = await this.executor.unsafe<SqlInvitationRow[]>(
      `${INVITATION_COLUMNS}
        where lower(email::text) = lower($1) and status in ('draft', 'pending')
        limit 1`,
      [email],
    );
    const row = rows[0];
    return row === undefined ? null : mapInvitationRow(row);
  }

  async findInvitationById(id: string): Promise<InvitationRow | null> {
    const rows = await this.executor.unsafe<SqlInvitationRow[]>(
      `${INVITATION_COLUMNS} where id = $1::uuid limit 1`,
      [id],
    );
    const row = rows[0];
    return row === undefined ? null : mapInvitationRow(row);
  }

  async findInvitationByTokenHash(tokenHash: string): Promise<InvitationRow | null> {
    const rows = await this.executor.unsafe<SqlInvitationRow[]>(
      `${INVITATION_COLUMNS} where token_hash = $1 limit 1`,
      [tokenHash],
    );
    const row = rows[0];
    return row === undefined ? null : mapInvitationRow(row);
  }

  async insertInvitation(input: CreateInvitationInput): Promise<InvitationRow> {
    const rows = await this.executor.unsafe<SqlInvitationRow[]>(
      `insert into staff_invitations
         (email, full_name, job_title, base_location, role, team, access_tier, scope_notes,
          access_review_due, checklist, status, token_hash, expires_at, invited_by)
       values ($1, $2, $3, $4, $5::user_role, $6::team, $7::access_tier, $8, $9::date, $10::jsonb,
               $11::staff_invitation_status, $12, $13, $14::uuid)
       returning id::text as id, email::text as email, full_name, job_title, base_location,
                 role::text as role, team::text as team, access_tier::text as access_tier,
                 scope_notes, access_review_due::text as access_review_due, status::text as status,
                 token_hash, expires_at, resend_count, checklist`,
      [
        input.email,
        input.fullName,
        input.jobTitle,
        input.baseLocation,
        input.role,
        input.team,
        input.accessTier,
        input.scopeNotes,
        input.accessReviewDue,
        JSON.stringify(input.checklist),
        input.status,
        input.tokenHash,
        input.expiresAt,
        input.invitedBy,
      ],
    );
    const row = rows[0];
    if (row === undefined) throw new Error('invitation was not created');
    return mapInvitationRow(row);
  }

  async updateInvitation(
    id: string,
    patch: Partial<
      Pick<InvitationRow, 'status' | 'tokenHash' | 'resendCount'> & { expiresAt: Date | string }
    >,
  ): Promise<InvitationRow> {
    const assignments: string[] = [];
    const values: unknown[] = [];
    const add = (column: string, value: unknown): void => {
      values.push(value);
      assignments.push(`${column} = $${values.length}`);
    };
    if (patch.status !== undefined) add('status', `${patch.status}::staff_invitation_status`);
    if (patch.tokenHash !== undefined) add('token_hash', patch.tokenHash);
    if (patch.expiresAt !== undefined) add('expires_at', patch.expiresAt);
    if (patch.resendCount !== undefined) add('resend_count', patch.resendCount);
    if (assignments.length === 0) {
      const existing = await this.findInvitationById(id);
      if (existing === null) throw new Error(`invitation not found: ${id}`);
      return existing;
    }

    values.push(id);
    const rows = await this.executor.unsafe<SqlInvitationRow[]>(
      `update staff_invitations
          set ${assignments.join(', ')}, updated_at = now()
        where id = $${values.length}::uuid
        returning id::text as id, email::text as email, full_name, job_title, base_location,
                  role::text as role, team::text as team, access_tier::text as access_tier,
                  scope_notes, access_review_due::text as access_review_due, status::text as status,
                  token_hash, expires_at, resend_count, checklist`,
      values,
    );
    const row = rows[0];
    if (row === undefined) throw new Error(`invitation not found: ${id}`);
    return mapInvitationRow(row);
  }

  async createProfile(input: CreateProfileInput): Promise<void> {
    await this.executor.unsafe(
      `insert into profiles
         (id, email, full_name, first_name, last_name, job_title, base_location, account_type,
          role, team, access_tier, scope_notes, access_review_due, account_status,
          mfa_enrolled, mfa_methods, joined_at)
       values ($1::uuid, $2, $3, $4, $5, $6, $7, 'staff', $8::user_role, $9::team,
               $10::access_tier, $11, $12::date, 'active', false, '{}', $13)`,
      [
        input.userId,
        input.email,
        input.fullName,
        splitName(input.fullName)[0],
        splitName(input.fullName)[1],
        input.jobTitle,
        input.baseLocation,
        input.role,
        input.team,
        input.accessTier,
        input.scopeNotes,
        input.accessReviewDue,
        input.joinedAt,
      ],
    );
  }

  async updateMember(
    userId: string,
    patch: Partial<
      Pick<StaffRow, 'role' | 'accountStatus'> & {
        require2fa: boolean;
        suspendedAt: Date | null;
        suspendedReason: string | null;
        deletedAt: Date;
      }
    >,
  ): Promise<void> {
    const assignments: string[] = [];
    const values: unknown[] = [];
    const add = (column: string, value: unknown): void => {
      values.push(value);
      assignments.push(`${column} = $${values.length}`);
    };
    if (patch.role !== undefined) add('role', `${patch.role}::user_role`);
    if (patch.accountStatus !== undefined)
      add('account_status', `${patch.accountStatus}::account_status`);
    if (patch.require2fa !== undefined) add('require_2fa', patch.require2fa);
    if (patch.suspendedAt !== undefined) add('suspended_at', patch.suspendedAt);
    if (patch.suspendedReason !== undefined) add('suspended_reason', patch.suspendedReason);
    if (patch.deletedAt !== undefined) add('deleted_at', patch.deletedAt);
    if (assignments.length === 0) return;

    values.push(userId);
    await this.executor.unsafe(
      `update profiles set ${assignments.join(', ')}, updated_at = now()
        where id = $${values.length}::uuid`,
      values,
    );
  }

  async listSessionIds(userId: string): Promise<string[]> {
    const rows = await this.executor.unsafe<Array<{ id: string }>>(
      `select id::text as id from user_sessions where user_id = $1::uuid and revoked_at is null`,
      [userId],
    );
    return rows.map((row) => row.id);
  }

  async revokeSessions(sessionIds: string[], at: Date): Promise<number> {
    if (sessionIds.length === 0) return 0;
    const rows = await this.executor.unsafe<Array<{ id: string }>>(
      `update user_sessions set revoked_at = $2
        where id = any($1::uuid[]) and revoked_at is null
        returning id::text as id`,
      [sessionIds, at],
    );
    return rows.length;
  }

  async recordSession(input: RecordSessionInput): Promise<void> {
    await this.executor.unsafe(
      `insert into user_sessions (id, user_id, device_label, user_agent, ip, mfa_method, started_at)
       values ($1::uuid, $2::uuid, $3, $4, $5::inet, $6::mfa_method, $7)`,
      [
        input.sessionId,
        input.userId,
        input.deviceLabel,
        input.userAgent,
        input.ip,
        input.mfaMethod,
        input.startedAt,
      ],
    );
  }
}

function mapStaffRow(row: SqlStaffRow): StaffRow {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    jobTitle: row.job_title,
    role: row.role,
    team: row.team,
    accountStatus: row.account_status,
    accessTier: row.access_tier,
    baseLocation: row.base_location,
    scopeSummary: row.scope_summary,
    mfaEnrolled: row.mfa_enrolled,
    mfaMethods: row.mfa_methods ?? [],
    joinedAt: new Date(row.joined_at).toISOString(),
    lastActiveAt: row.last_active_at === null ? null : new Date(row.last_active_at).toISOString(),
    suspendedAt: row.suspended_at === null ? null : new Date(row.suspended_at).toISOString(),
    accessReviewDue: row.access_review_due,
  };
}

function mapInvitationRow(row: SqlInvitationRow): InvitationRow {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    jobTitle: row.job_title,
    baseLocation: row.base_location,
    role: row.role,
    team: row.team,
    accessTier: row.access_tier,
    scopeNotes: row.scope_notes,
    accessReviewDue: row.access_review_due,
    status: row.status,
    tokenHash: row.token_hash,
    expiresAt: new Date(row.expires_at).toISOString(),
    resendCount: row.resend_count,
    checklist: row.checklist ?? {},
  };
}

function splitName(fullName: string): [string, string] {
  const index = fullName.indexOf(' ');
  if (index === -1) return [fullName, ''];
  return [fullName.slice(0, index), fullName.slice(index + 1)];
}

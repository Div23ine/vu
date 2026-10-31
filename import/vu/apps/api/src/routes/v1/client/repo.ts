import { asExecutor, type SqlExecutor } from '../../../audit/repo.js';
import type { Industry, PentestTargetType } from '@vunvault/contracts';

/**
 * Client intake data access: the person and their organisation, the onboarding
 * record, and pen-test request intake.
 *
 * Every read is scoped by `org_id` — a client can never see another client's
 * engagements, findings or schedule.
 */

export interface PersonRow {
  id: string;
  fullName: string;
  jobTitle: string | null;
  email: string;
  phone: string | null;
  accountType: string | null;
  updatedAt: string;
}

export interface OrganizationRow {
  id: string;
  name: string;
  clientCode: string;
  primaryDomain: string | null;
  industry: Industry | null;
}

export interface PlanRow {
  name: string;
  status: string;
}

export interface OnboardingRow {
  completed: boolean;
  completedAt: string | null;
}

export interface CompleteOnboardingInput {
  userId: string;
  dateOfBirth: string;
  phone: string | null;
  career: string;
  entity: string;
  accountType: 'individual' | 'company';
  recoveryQuestion: string;
  recoveryAnswerHash: string;
  declarations: Record<string, boolean>;
  termsVersion: string;
  completedAt: Date;
}

export interface PentestRequestRow {
  id: string;
  refCode: string;
  targetUrl: string;
  targetType: PentestTargetType;
  status: string;
  createdAt: string;
}

export interface InsertPentestRequestInput {
  orgId: string;
  requestedBy: string;
  targetUrl: string;
  targetType: PentestTargetType;
  preferredSchedule: Date | null;
  notes: string | null;
}

export interface ClientRepo extends ClientProfileRepo, OnboardingRepo, PentestRequestRepo {}

export interface ClientProfileRepo {
  getPerson(userId: string): Promise<PersonRow>;
  updatePerson(
    userId: string,
    patch: { fullName?: string; jobTitle?: string | null; phone?: string | null },
  ): Promise<void>;
  getOrganization(orgId: string): Promise<OrganizationRow | null>;
  updateOrganization(
    orgId: string,
    patch: { name?: string; primaryDomain?: string | null; industry?: Industry | null },
  ): Promise<void>;
  getActivePlan(orgId: string): Promise<PlanRow | null>;
  countEngagements(orgId: string): Promise<number>;
  countOpenFindings(orgId: string): Promise<number>;
  /** The nearest requested assessment still in the future, or null. */
  nextAssessmentAt(orgId: string, from: Date): Promise<string | null>;
}

export interface OnboardingRepo {
  onboardingStatus(userId: string): Promise<OnboardingRow>;
  completeOnboarding(input: CompleteOnboardingInput): Promise<void>;
}

export interface PentestRequestRepo {
  insertPentestRequest(input: InsertPentestRequestInput): Promise<PentestRequestRow>;
}

interface SqlPersonRow {
  id: string;
  full_name: string;
  job_title: string | null;
  email: string;
  phone: string | null;
  account_type: string | null;
  updated_at: string;
}

interface SqlOrgRow {
  id: string;
  name: string;
  client_code: string;
  primary_domain: string | null;
  industry: Industry | null;
}

interface SqlPentestRow {
  id: string;
  ref_code: string;
  target_url: string;
  target_type: PentestTargetType;
  status: string;
  created_at: string;
}

export class SqlClientRepo implements ClientRepo {
  private readonly executor: SqlExecutor;

  constructor(connection: unknown) {
    this.executor = asExecutor(connection);
  }

  async getPerson(userId: string): Promise<PersonRow> {
    const rows = await this.executor.unsafe<SqlPersonRow[]>(
      `select id::text as id, full_name, job_title, email::text as email, phone,
              account_type::text as account_type, updated_at
         from profiles
        where id = $1::uuid and deleted_at is null
        limit 1`,
      [userId],
    );
    const row = rows[0];
    if (row === undefined) throw new Error(`profile not found: ${userId}`);
    return {
      id: row.id,
      fullName: row.full_name,
      jobTitle: row.job_title,
      email: row.email,
      phone: row.phone,
      accountType: row.account_type,
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  async updatePerson(
    userId: string,
    patch: { fullName?: string; jobTitle?: string | null; phone?: string | null },
  ): Promise<void> {
    const { assignments, values } = buildUpdate(patch, {
      fullName: 'full_name',
      jobTitle: 'job_title',
      phone: 'phone',
    });
    if (assignments.length === 0) return;
    values.push(userId);
    await this.executor.unsafe(
      `update profiles set ${assignments.join(', ')}, updated_at = now()
        where id = $${values.length}::uuid`,
      values,
    );
  }

  async getOrganization(orgId: string): Promise<OrganizationRow | null> {
    const rows = await this.executor.unsafe<SqlOrgRow[]>(
      `select id::text as id, name, client_code, primary_domain, industry::text as industry
         from organizations
        where id = $1::uuid
        limit 1`,
      [orgId],
    );
    const row = rows[0];
    if (row === undefined) return null;
    return {
      id: row.id,
      name: row.name,
      clientCode: row.client_code,
      primaryDomain: row.primary_domain,
      industry: row.industry,
    };
  }

  async updateOrganization(
    orgId: string,
    patch: { name?: string; primaryDomain?: string | null; industry?: Industry | null },
  ): Promise<void> {
    const { assignments, values } = buildUpdate(patch, {
      name: 'name',
      primaryDomain: 'primary_domain',
      industry: 'industry',
    });
    if (assignments.length === 0) return;
    values.push(orgId);
    await this.executor.unsafe(
      `update organizations set ${assignments.join(', ')}, updated_at = now()
        where id = $${values.length}::uuid`,
      values,
    );
  }

  async getActivePlan(orgId: string): Promise<PlanRow | null> {
    const rows = await this.executor.unsafe<Array<{ name: string; status: string }>>(
      `select p.name, s.status::text as status
         from subscriptions s
         join plans p on p.id = s.plan_id
        where s.org_id = $1::uuid and s.status = 'active'
        order by s.created_at desc
        limit 1`,
      [orgId],
    );
    const row = rows[0];
    return row === undefined ? null : { name: row.name, status: row.status };
  }

  async countEngagements(orgId: string): Promise<number> {
    return count(
      await this.executor.unsafe<Array<{ count: string }>>(
        `select count(*)::text as count from scan_jobs where org_id = $1::uuid`,
        [orgId],
      ),
    );
  }

  async countOpenFindings(orgId: string): Promise<number> {
    // Only findings on a released job are shown to a client: an unreviewed scan
    // is not theirs to see yet.
    return count(
      await this.executor.unsafe<Array<{ count: string }>>(
        `select count(*)::text as count
           from scan_findings f
           join scan_jobs j on j.id = f.job_id
          where j.org_id = $1::uuid
            and j.review_gate_state = 'approved_released'
            and f.status in ('open', 'validated')`,
        [orgId],
      ),
    );
  }

  async nextAssessmentAt(orgId: string, from: Date): Promise<string | null> {
    const rows = await this.executor.unsafe<Array<{ preferred_schedule: string }>>(
      `select min(preferred_schedule) as preferred_schedule
         from pentest_requests
        where org_id = $1::uuid and preferred_schedule > $2`,
      [orgId, from],
    );
    const value = rows[0]?.preferred_schedule;
    return value === null || value === undefined ? null : new Date(value).toISOString();
  }

  async onboardingStatus(userId: string): Promise<OnboardingRow> {
    const rows = await this.executor.unsafe<Array<{ completed_at: string | null }>>(
      `select completed_at from onboarding_profiles where user_id = $1::uuid limit 1`,
      [userId],
    );
    const row = rows[0];
    if (row === undefined) return { completed: false, completedAt: null };
    return {
      completed: row.completed_at !== null,
      completedAt: row.completed_at === null ? null : new Date(row.completed_at).toISOString(),
    };
  }

  async completeOnboarding(input: CompleteOnboardingInput): Promise<void> {
    await this.executor.unsafe(
      `insert into onboarding_profiles
         (user_id, date_of_birth, career, entity, recovery_question, recovery_answer_hash,
          declarations, terms_version, completed_at)
       values ($1::uuid, $2::date, $3::career_role, $4::entity_type, $5, $6, $7::jsonb, $8, $9)`,
      [
        input.userId,
        input.dateOfBirth,
        input.career,
        input.entity,
        input.recoveryQuestion,
        input.recoveryAnswerHash,
        JSON.stringify(input.declarations),
        input.termsVersion,
        input.completedAt,
      ],
    );
    // The person's own contact details and the entity they onboarded as.
    await this.executor.unsafe(
      `update profiles
          set date_of_birth = $2::date,
              phone = coalesce($3, phone),
              account_type = $4::account_type,
              updated_at = now()
        where id = $1::uuid`,
      [input.userId, input.dateOfBirth, input.phone, input.accountType],
    );
  }

  async insertPentestRequest(input: InsertPentestRequestInput): Promise<PentestRequestRow> {
    // `ref_code` is generated by the database from the `ref_number` sequence, so it
    // is read back rather than composed here.
    const rows = await this.executor.unsafe<SqlPentestRow[]>(
      `insert into pentest_requests
         (org_id, requested_by, target_url, target_type, preferred_schedule, notes, status)
       values ($1::uuid, $2::uuid, $3, $4::pentest_target_type, $5, $6, 'received')
       returning id::text as id, ref_code, target_url, target_type::text as target_type,
                 status::text as status, created_at`,
      [
        input.orgId,
        input.requestedBy,
        input.targetUrl,
        input.targetType,
        input.preferredSchedule,
        input.notes,
      ],
    );
    const row = rows[0];
    if (row === undefined) throw new Error('pentest request was not created');
    return {
      id: row.id,
      refCode: row.ref_code,
      targetUrl: row.target_url,
      targetType: row.target_type,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }
}

function count(rows: Array<{ count: string }>): number {
  return Number(rows[0]?.count ?? '0');
}

/** Builds `set a = $1, b = $2` from a patch, skipping keys that were not sent. */
function buildUpdate<T extends Record<string, unknown>>(
  patch: T,
  columns: { [K in keyof T]?: string },
): { assignments: string[]; values: unknown[] } {
  const assignments: string[] = [];
  const values: unknown[] = [];
  for (const [key, column] of Object.entries(columns) as Array<[keyof T & string, string]>) {
    const value = patch[key];
    if (value === undefined) continue;
    values.push(value);
    assignments.push(`${column} = $${values.length}`);
  }
  return { assignments, values };
}

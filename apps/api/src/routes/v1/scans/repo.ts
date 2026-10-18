import { asExecutor, type SqlExecutor } from '../../../audit/repo.js';
import type { ReviewCheckKey } from '@vunvault/db/enum-values';
import { clientVisibleWhere, SCAN_JOBS_ALIAS } from './visibility.js';

/**
 * Scan queue data access (Task 35).
 *
 * Two rules are structural rather than conventional here.
 *
 * 1. Every CLIENT read goes through `clientVisibleWhere`, which binds the caller's
 *    organisation AND the released gate state. There is no client query in this
 *    file that filters on `review_gate_state` by hand, and `scans.test.ts` fails
 *    if one ever appears.
 * 2. `review_decisions` has an INSERT and nothing else. No update, no delete: a
 *    decision is a record of what a named person approved, and the gate's value
 *    depends on that record being immutable.
 */

export interface ScanJobRow {
  id: string;
  jobCode: string;
  orgId: string;
  orgName: string;
  contactEmail: string | null;
  requestedBy: string | null;
  requesterEmail: string | null;
  targetHost: string;
  targetIp: string | null;
  targetLabel: string | null;
  environment: string | null;
  scopeNotes: string | null;
  scanType: string;
  priority: string;
  status: string;
  progress: number;
  etaSeconds: number | null;
  paymentStatus: string;
  reviewGateState: string;
  analystId: string | null;
  assignedReviewerId: string | null;
  authorisationDocKey: string | null;
  releasedAt: string | null;
  releasedBy: string | null;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
}

export interface NewScanJob {
  id: string;
  orgId: string;
  requestedBy: string | null;
  requesterEmail: string | null;
  targetHost: string;
  targetIp: string | null;
  targetLabel: string | null;
  environment: string | null;
  scanType: string;
  priority: string;
  scopeNotes: string | null;
  authorisationDocKey: string;
}

export interface FindingRow {
  id: string;
  severity: string;
  title: string;
  description: string;
  cvss: number | null;
  cwe: string | null;
  status: string;
  remediationGuidance: string | null;
}

export interface SummaryCounts {
  jobsInQueue: number;
  addedToday: number;
  runningScans: number;
  awaitingAdminReview: number;
  approvedReleased: number;
  releasedThisWeek: number;
  paymentOutstanding: number;
  overdueOver14Days: number;
  heldRejected: number;
}

export interface ScanListFilters {
  page: number;
  pageSize: number;
  status?: string;
  gate?: string;
  payment?: string;
  type?: string;
  /** Admin only: ILIKE over job code, target host, org name and requester email. */
  q?: string;
}

export interface JobPatch {
  status?: string;
  reviewGateState?: string;
  paymentStatus?: string;
  releasedAt?: Date | null;
  releasedBy?: string | null;
  analystId?: string | null;
  assignedReviewerId?: string | null;
  cancelledAt?: Date | null;
  progress?: number;
}

export interface ReviewerRow {
  id: string;
  role: string;
  accountStatus: string;
  deletedAt: string | null;
}

export interface PlanRow {
  code: string;
  name: string;
  monthlyUsdCents: number;
}

export interface ScansRepo {
  createJob(input: NewScanJob): Promise<ScanJobRow>;
  getJobById(jobId: string): Promise<ScanJobRow | null>;
  /** Release-locked read: null unless the job is the caller's AND released. */
  getVisibleJob(orgId: string, jobId: string): Promise<ScanJobRow | null>;
  listForClient(
    orgId: string,
    filters: ScanListFilters,
  ): Promise<{ rows: ScanJobRow[]; total: number }>;
  listForAdmin(filters: ScanListFilters): Promise<{ rows: ScanJobRow[]; total: number }>;
  getJobsByIds(ids: string[]): Promise<ScanJobRow[]>;
  listFindings(jobId: string): Promise<FindingRow[]>;

  summary(bounds: {
    startOfToday: Date;
    weekAgo: Date;
    olderThan14Days: Date;
  }): Promise<SummaryCounts>;

  upsertChecks(
    jobId: string,
    checks: Record<ReviewCheckKey, boolean>,
    checkedBy: string,
    at: Date,
  ): Promise<void>;
  insertDecision(input: {
    jobId: string;
    decision: string;
    reviewerId: string;
    reviewerRole: string;
    note: string;
    at: Date;
  }): Promise<string>;
  updateJob(jobId: string, patch: JobPatch): Promise<void>;

  getReviewer(reviewerId: string): Promise<ReviewerRow | null>;
  planByCode(code: string): Promise<PlanRow | null>;
  orgUsers(orgId: string): Promise<Array<{ userId: string; email: string }>>;

  recordQueueRun(jobId: string, attempt: number, queueJobId: string): Promise<void>;
  queueJobIdFor(jobId: string): Promise<string | null>;
}

const JOB_COLUMNS = `
  sj.id::text as id,
  sj.job_code,
  sj.org_id::text as org_id,
  o.name as org_name,
  coalesce(
    sj.requester_email,
    (select p.email::text from profiles p
      where p.org_id = sj.org_id and p.deleted_at is null
      order by p.joined_at asc limit 1)
  ) as contact_email,
  sj.requested_by::text as requested_by,
  sj.requester_email,
  sj.target_host, sj.target_ip, sj.target_label,
  sj.environment::text as environment,
  sj.scope_notes,
  sj.scan_type::text as scan_type,
  sj.priority::text as priority,
  sj.status::text as status,
  sj.progress, sj.eta_seconds,
  sj.payment_status::text as payment_status,
  sj.review_gate_state::text as review_gate_state,
  sj.analyst_id::text as analyst_id,
  sj.assigned_reviewer_id::text as assigned_reviewer_id,
  sj.authorisation_doc_key,
  sj.released_at, sj.released_by::text as released_by,
  sj.requested_at, sj.started_at, sj.completed_at, sj.cancelled_at,
  inv.id::text as invoice_id, inv.number as invoice_number`;

const JOB_FROM = `
  from scan_jobs ${SCAN_JOBS_ALIAS}
  join organizations o on o.id = ${SCAN_JOBS_ALIAS}.org_id
  left join invoices inv on inv.scan_job_id = ${SCAN_JOBS_ALIAS}.id`;

interface SqlJobRow {
  id: string;
  job_code: string;
  org_id: string;
  org_name: string;
  contact_email: string | null;
  requested_by: string | null;
  requester_email: string | null;
  target_host: string;
  target_ip: string | null;
  target_label: string | null;
  environment: string | null;
  scope_notes: string | null;
  scan_type: string;
  priority: string;
  status: string;
  progress: number;
  eta_seconds: number | null;
  payment_status: string;
  review_gate_state: string;
  analyst_id: string | null;
  assigned_reviewer_id: string | null;
  authorisation_doc_key: string | null;
  released_at: Date | string | null;
  released_by: string | null;
  requested_at: Date | string;
  started_at: Date | string | null;
  completed_at: Date | string | null;
  cancelled_at: Date | string | null;
  invoice_id: string | null;
  invoice_number: string | null;
}

export class SqlScansRepo implements ScansRepo {
  private readonly executor: SqlExecutor;

  constructor(connection: unknown) {
    this.executor = asExecutor(connection);
  }

  async createJob(input: NewScanJob): Promise<ScanJobRow> {
    const rows = await this.executor.unsafe<SqlJobRow[]>(
      `insert into scan_jobs
         (id, org_id, requested_by, requester_email, target_host, target_ip, target_label,
          environment, scan_type, priority, scope_notes, authorisation_doc_key,
          status, payment_status, review_gate_state)
       values ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8::scan_environment, $9::scan_type,
               $10::scan_priority, $11, $12, 'queued', 'pending', 'not_eligible')
       returning ${jobReturning()}`,
      [
        input.id,
        input.orgId,
        input.requestedBy,
        input.requesterEmail,
        input.targetHost,
        input.targetIp,
        input.targetLabel,
        input.environment,
        input.scanType,
        input.priority,
        input.scopeNotes,
        input.authorisationDocKey,
      ],
    );
    const row = rows[0];
    if (row === undefined) throw new Error('scan job was not created');
    return mapJob(row);
  }

  async getJobById(jobId: string): Promise<ScanJobRow | null> {
    const rows = await this.executor.unsafe<SqlJobRow[]>(
      `select ${JOB_COLUMNS} ${JOB_FROM} where ${SCAN_JOBS_ALIAS}.id = $1::uuid limit 1`,
      [jobId],
    );
    const row = rows[0];
    return row === undefined ? null : mapJob(row);
  }

  async getVisibleJob(orgId: string, jobId: string): Promise<ScanJobRow | null> {
    // THE RELEASE LOCK. One predicate, from one module, for every client read.
    const visible = clientVisibleWhere(orgId);
    const rows = await this.executor.unsafe<SqlJobRow[]>(
      `select ${JOB_COLUMNS} ${JOB_FROM}
        where ${visible.fragment} and ${SCAN_JOBS_ALIAS}.id = $2::uuid
        limit 1`,
      [...visible.values, jobId],
    );
    const row = rows[0];
    return row === undefined ? null : mapJob(row);
  }

  async listForClient(
    orgId: string,
    filters: ScanListFilters,
  ): Promise<{ rows: ScanJobRow[]; total: number }> {
    const visible = clientVisibleWhere(orgId);
    const { where, values } = buildFilters(filters, visible.fragment, visible.values);
    return this.runList(where, values, filters);
  }

  async listForAdmin(filters: ScanListFilters): Promise<{ rows: ScanJobRow[]; total: number }> {
    const { where, values } = buildFilters(filters, 'true', []);
    return this.runList(where, values, filters);
  }

  private async runList(
    where: string,
    values: unknown[],
    filters: ScanListFilters,
  ): Promise<{ rows: ScanJobRow[]; total: number }> {
    const totalRows = await this.executor.unsafe<Array<{ count: string }>>(
      `select count(*)::text as count ${JOB_FROM} where ${where}`,
      values,
    );
    const offset = (filters.page - 1) * filters.pageSize;
    const rows = await this.executor.unsafe<SqlJobRow[]>(
      `select ${JOB_COLUMNS} ${JOB_FROM}
        where ${where}
        order by ${SCAN_JOBS_ALIAS}.requested_at desc
        limit $${values.length + 1} offset $${values.length + 2}`,
      [...values, filters.pageSize, offset],
    );
    return { rows: rows.map(mapJob), total: Number(totalRows[0]?.count ?? '0') };
  }

  async getJobsByIds(ids: string[]): Promise<ScanJobRow[]> {
    if (ids.length === 0) return [];
    const rows = await this.executor.unsafe<SqlJobRow[]>(
      `select ${JOB_COLUMNS} ${JOB_FROM}
        where ${SCAN_JOBS_ALIAS}.id = any($1::uuid[])
        order by ${SCAN_JOBS_ALIAS}.requested_at desc`,
      [ids],
    );
    return rows.map(mapJob);
  }

  async listFindings(jobId: string): Promise<FindingRow[]> {
    // `evidence_redacted` only. Raw scanner output is not in this database at all.
    const rows = await this.executor.unsafe<
      Array<{
        id: string;
        severity: string;
        title: string;
        description: string;
        cvss: string | null;
        cwe: string | null;
        status: string;
        remediation_guidance: string | null;
      }>
    >(
      `select id::text as id, severity::text as severity, title, description,
              cvss::text as cvss, cwe, status::text as status, remediation_guidance
         from scan_findings
        where job_id = $1::uuid
        order by array_position(array['critical','high','medium','low'], severity::text), created_at asc`,
      [jobId],
    );
    return rows.map((row) => ({
      id: row.id,
      severity: row.severity,
      title: row.title,
      description: row.description,
      cvss: row.cvss === null ? null : Number(row.cvss),
      cwe: row.cwe,
      status: row.status,
      remediationGuidance: row.remediation_guidance,
    }));
  }

  async summary(bounds: {
    startOfToday: Date;
    weekAgo: Date;
    olderThan14Days: Date;
  }): Promise<SummaryCounts> {
    const rows = await this.executor.unsafe<Array<Record<string, string | number>>>(
      `select
         count(*) filter (where sj.status in ('queued','running','awaiting_review'))::text as jobs_in_queue,
         count(*) filter (where sj.requested_at >= $1)::text as added_today,
         count(*) filter (where sj.status = 'running')::text as running_scans,
         count(*) filter (where sj.review_gate_state = 'in_review')::text as awaiting_admin_review,
         count(*) filter (where sj.review_gate_state = 'approved_released')::text as approved_released,
         count(*) filter (where sj.released_at >= $2)::text as released_this_week,
         count(*) filter (where sj.payment_status <> 'paid')::text as payment_outstanding,
         count(*) filter (where sj.payment_status = 'overdue' and sj.requested_at < $3)::text as overdue_over_14_days,
         count(*) filter (where sj.status in ('held','rejected'))::text as held_rejected
       from scan_jobs sj`,
      [bounds.startOfToday, bounds.weekAgo, bounds.olderThan14Days],
    );
    const row = rows[0] ?? {};
    return {
      jobsInQueue: Number(row.jobs_in_queue ?? 0),
      addedToday: Number(row.added_today ?? 0),
      runningScans: Number(row.running_scans ?? 0),
      awaitingAdminReview: Number(row.awaiting_admin_review ?? 0),
      approvedReleased: Number(row.approved_released ?? 0),
      releasedThisWeek: Number(row.released_this_week ?? 0),
      paymentOutstanding: Number(row.payment_outstanding ?? 0),
      overdueOver14Days: Number(row.overdue_over_14_days ?? 0),
      heldRejected: Number(row.held_rejected ?? 0),
    };
  }

  async upsertChecks(
    jobId: string,
    checks: Record<ReviewCheckKey, boolean>,
    checkedBy: string,
    at: Date,
  ): Promise<void> {
    for (const [key, passed] of Object.entries(checks)) {
      // Unique per (job, check key): a re-check overwrites the tick, never adds a
      // second row that would let a job look checked when it is not.
      await this.executor.unsafe(
        `insert into review_gate_checks (job_id, check_key, passed, checked_by, checked_at)
         values ($1::uuid, $2::review_check_key, $3, $4::uuid, $5)
         on conflict (job_id, check_key)
         do update set passed = excluded.passed, checked_by = excluded.checked_by,
                       checked_at = excluded.checked_at`,
        [jobId, key, passed, checkedBy, at],
      );
    }
  }

  async insertDecision(input: {
    jobId: string;
    decision: string;
    reviewerId: string;
    reviewerRole: string;
    note: string;
    at: Date;
  }): Promise<string> {
    const rows = await this.executor.unsafe<Array<{ id: string }>>(
      `insert into review_decisions (job_id, decision, reviewer_id, reviewer_role, note, gate_timestamp)
       values ($1::uuid, $2::review_decision, $3::uuid, $4::user_role, $5, $6)
       returning id::text as id`,
      [input.jobId, input.decision, input.reviewerId, input.reviewerRole, input.note, input.at],
    );
    return rows[0]?.id ?? '';
  }

  async updateJob(jobId: string, patch: JobPatch): Promise<void> {
    const sets: string[] = ['updated_at = now()'];
    const values: unknown[] = [jobId];
    const add = (column: string, value: unknown, cast?: string): void => {
      values.push(value);
      sets.push(`${column} = $${values.length}${cast === undefined ? '' : `::${cast}`}`);
    };

    if (patch.status !== undefined) add('status', patch.status, 'scan_status');
    if (patch.reviewGateState !== undefined) {
      add('review_gate_state', patch.reviewGateState, 'review_gate_state');
    }
    if (patch.paymentStatus !== undefined) {
      add('payment_status', patch.paymentStatus, 'payment_status');
    }
    if (patch.releasedAt !== undefined) add('released_at', patch.releasedAt);
    if (patch.releasedBy !== undefined) add('released_by', patch.releasedBy, 'uuid');
    if (patch.analystId !== undefined) add('analyst_id', patch.analystId, 'uuid');
    if (patch.assignedReviewerId !== undefined) {
      add('assigned_reviewer_id', patch.assignedReviewerId, 'uuid');
    }
    if (patch.cancelledAt !== undefined) add('cancelled_at', patch.cancelledAt);
    if (patch.progress !== undefined) add('progress', patch.progress);

    await this.executor.unsafe(
      `update scan_jobs set ${sets.join(', ')} where id = $1::uuid`,
      values,
    );
  }

  async getReviewer(reviewerId: string): Promise<ReviewerRow | null> {
    const rows = await this.executor.unsafe<
      Array<{ id: string; role: string; account_status: string; deleted_at: string | null }>
    >(
      `select id::text as id, role::text as role, account_status::text as account_status, deleted_at
         from profiles
        where id = $1::uuid
        limit 1`,
      [reviewerId],
    );
    const row = rows[0];
    if (row === undefined) return null;
    return {
      id: row.id,
      role: row.role,
      accountStatus: row.account_status,
      deletedAt: row.deleted_at === null ? null : new Date(row.deleted_at).toISOString(),
    };
  }

  async planByCode(code: string): Promise<PlanRow | null> {
    const rows = await this.executor.unsafe<
      Array<{ code: string; name: string; monthly_usd_cents: string | number }>
    >(
      `select code, name, monthly_usd_cents::text as monthly_usd_cents
         from plans
        where code = $1 and active = true
        limit 1`,
      [code],
    );
    const row = rows[0];
    if (row === undefined) return null;
    return {
      code: row.code,
      name: row.name,
      monthlyUsdCents: Number(row.monthly_usd_cents),
    };
  }

  async orgUsers(orgId: string): Promise<Array<{ userId: string; email: string }>> {
    const rows = await this.executor.unsafe<Array<{ id: string; email: string }>>(
      `select p.id::text as id, p.email::text as email
         from profiles p
        where p.org_id = $1::uuid and p.deleted_at is null and p.account_status = 'active'
        order by p.joined_at asc`,
      [orgId],
    );
    return rows.map((row) => ({ userId: row.id, email: row.email }));
  }

  async recordQueueRun(jobId: string, attempt: number, queueJobId: string): Promise<void> {
    await this.executor.unsafe(
      `insert into scan_runs (job_id, attempt, queue_job_id)
       values ($1::uuid, $2, $3)
       on conflict (job_id, attempt) do update set queue_job_id = excluded.queue_job_id`,
      [jobId, attempt, queueJobId],
    );
  }

  async queueJobIdFor(jobId: string): Promise<string | null> {
    const rows = await this.executor.unsafe<Array<{ queue_job_id: string | null }>>(
      `select queue_job_id from scan_runs
        where job_id = $1::uuid
        order by attempt desc
        limit 1`,
      [jobId],
    );
    return rows[0]?.queue_job_id ?? null;
  }
}

/** The insert's RETURNING list, joined to the same columns every read selects. */
function jobReturning(): string {
  return `id::text as id, job_code, org_id::text as org_id, '' as org_name,
          null::text as contact_email, requested_by::text as requested_by, requester_email,
          target_host, target_ip, target_label, environment::text as environment, scope_notes,
          scan_type::text as scan_type, priority::text as priority, status::text as status,
          progress, eta_seconds, payment_status::text as payment_status,
          review_gate_state::text as review_gate_state, analyst_id::text as analyst_id,
          assigned_reviewer_id::text as assigned_reviewer_id, authorisation_doc_key,
          released_at, released_by::text as released_by, requested_at, started_at, completed_at,
          cancelled_at, null::uuid as invoice_id, null::text as invoice_number`;
}

function buildFilters(
  filters: ScanListFilters,
  baseFragment: string,
  baseValues: unknown[],
): { where: string; values: unknown[] } {
  const values = [...baseValues];
  const clauses = [baseFragment];
  const add = (clause: string, value: unknown, cast?: string): void => {
    values.push(value);
    clauses.push(clause.replace('?', `$${values.length}${cast === undefined ? '' : `::${cast}`}`));
  };

  if (filters.status !== undefined) add('sj.status = ?', filters.status, 'scan_status');
  if (filters.gate !== undefined) {
    add('sj.review_gate_state = ?', filters.gate, 'review_gate_state');
  }
  if (filters.payment !== undefined) {
    add('sj.payment_status = ?', filters.payment, 'payment_status');
  }
  if (filters.type !== undefined) add('sj.scan_type = ?', filters.type, 'scan_type');
  if (filters.q !== undefined && filters.q !== '') {
    values.push(`%${filters.q}%`);
    const like = `$${values.length}`;
    clauses.push(
      `(sj.job_code ilike ${like} or sj.target_host ilike ${like} or o.name ilike ${like}
        or coalesce(sj.requester_email, '') ilike ${like})`,
    );
  }

  return { where: clauses.join(' and '), values };
}

function iso(value: Date | string | null): string | null {
  return value === null ? null : new Date(value).toISOString();
}

function mapJob(row: SqlJobRow): ScanJobRow {
  return {
    id: row.id,
    jobCode: row.job_code,
    orgId: row.org_id,
    orgName: row.org_name,
    contactEmail: row.contact_email,
    requestedBy: row.requested_by,
    requesterEmail: row.requester_email,
    targetHost: row.target_host,
    targetIp: row.target_ip,
    targetLabel: row.target_label,
    environment: row.environment,
    scopeNotes: row.scope_notes,
    scanType: row.scan_type,
    priority: row.priority,
    status: row.status,
    progress: Number(row.progress),
    etaSeconds: row.eta_seconds === null ? null : Number(row.eta_seconds),
    paymentStatus: row.payment_status,
    reviewGateState: row.review_gate_state,
    analystId: row.analyst_id,
    assignedReviewerId: row.assigned_reviewer_id,
    authorisationDocKey: row.authorisation_doc_key,
    releasedAt: iso(row.released_at),
    releasedBy: row.released_by,
    requestedAt: new Date(row.requested_at).toISOString(),
    startedAt: iso(row.started_at),
    completedAt: iso(row.completed_at),
    cancelledAt: iso(row.cancelled_at),
    invoiceId: row.invoice_id,
    invoiceNumber: row.invoice_number,
  };
}

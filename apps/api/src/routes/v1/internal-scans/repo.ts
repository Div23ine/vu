import { asExecutor, type SqlExecutor } from '../../../audit/repo';
import type { ScanAbortReason } from '@vunvault/contracts';

/**
 * Internal scan-callback data access (Task 40g).
 *
 * Every read that gates a state transition takes the row lock
 * (`for update`) — the claim especially: two controllers dequeueing the same
 * job must serialise, and the loser sees `running` and answers 409.
 */

export interface InternalJobRow {
  id: string;
  jobCode: string;
  targetHost: string;
  scanType: string;
  priority: string;
  environment: string | null;
  status: string;
  progress: number;
  authorisationDocKey: string | null;
  authorisationExpiresAt: string | null;
  requestedBy: string | null;
  startedAt: string | null;
}

export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface NewInternalFinding {
  severity: string;
  title: string;
  description: string;
  evidenceRedacted: string | null;
  cvss: number | null;
  cwe: string | null;
  remediationGuidance: string | null;
}

export interface InternalScansRepo {
  /** `select … for update` — null when the job does not exist. */
  lockJob(jobId: string): Promise<InternalJobRow | null>;
  nextAttempt(jobId: string): Promise<number>;
  markRunning(input: {
    jobId: string;
    queueJobId: string;
    podName: string | null;
    attempt: number;
    now: Date;
  }): Promise<void>;
  /** status='held' with no other change (the claim's authorisation failure). */
  markHeld(jobId: string): Promise<void>;
  /** Monotonic: only applied while running AND strictly greater. */
  updateProgress(jobId: string, progress: number, etaSeconds: number | null): Promise<void>;
  countFindings(jobId: string): Promise<number>;
  insertFindings(jobId: string, findings: NewInternalFinding[]): Promise<number>;
  severityCounts(jobId: string): Promise<SeverityCounts>;
  markCompleted(input: {
    jobId: string;
    now: Date;
    exitCode: number;
    lineCount: number;
    bytesStreamed: number;
    redactedLogKey: string | null;
  }): Promise<void>;
  markFailed(input: {
    jobId: string;
    now: Date;
    cancelled: boolean;
    abortReason: ScanAbortReason;
  }): Promise<void>;
  latestRun(jobId: string): Promise<{ attempt: number } | null>;
  /** Active admin / super_admin profiles — the `scans:review` holders. */
  reviewerIds(): Promise<string[]>;
}

const JOB_COLUMNS = `
  select sj.id::text as id, sj.job_code, sj.target_host,
         sj.scan_type::text as scan_type, sj.priority::text as priority,
         sj.environment::text as environment, sj.status::text as status,
         sj.progress::int as progress,
         sj.authorisation_doc_key, sj.authorisation_expires_at::text as authorisation_expires_at,
         sj.requested_by::text as requested_by, sj.started_at::text as started_at
  from scan_jobs sj`;

interface SqlJobRow {
  id: string;
  job_code: string;
  target_host: string;
  scan_type: string;
  priority: string;
  environment: string | null;
  status: string;
  progress: number;
  authorisation_doc_key: string | null;
  authorisation_expires_at: string | null;
  requested_by: string | null;
  started_at: string | null;
}

function mapJob(row: SqlJobRow): InternalJobRow {
  return {
    id: row.id,
    jobCode: row.job_code,
    targetHost: row.target_host,
    scanType: row.scan_type,
    priority: row.priority,
    environment: row.environment,
    status: row.status,
    progress: row.progress,
    authorisationDocKey: row.authorisation_doc_key,
    authorisationExpiresAt: row.authorisation_expires_at,
    requestedBy: row.requested_by,
    startedAt: row.started_at,
  };
}

export class SqlInternalScansRepo implements InternalScansRepo {
  private readonly executor: SqlExecutor;

  constructor(connection: unknown) {
    this.executor = asExecutor(connection);
  }

  async lockJob(jobId: string): Promise<InternalJobRow | null> {
    const rows = await this.executor.unsafe<SqlJobRow[]>(
      `${JOB_COLUMNS} where sj.id = $1::uuid for update of sj`,
      [jobId],
    );
    const row = rows[0];
    return row === undefined ? null : mapJob(row);
  }

  async nextAttempt(jobId: string): Promise<number> {
    const rows = await this.executor.unsafe<Array<{ attempt: number }>>(
      `select coalesce(max(attempt), 0) + 1 as attempt from scan_runs where job_id = $1::uuid`,
      [jobId],
    );
    return Number(rows[0]?.attempt ?? 1);
  }

  async markRunning(input: {
    jobId: string;
    queueJobId: string;
    podName: string | null;
    attempt: number;
    now: Date;
  }): Promise<void> {
    await this.executor.unsafe(
      `update scan_jobs
       set status = 'running', started_at = $2, progress = 0, eta_seconds = null,
           updated_at = now()
       where id = $1::uuid`,
      [input.jobId, input.now],
    );
    await this.executor.unsafe(
      `insert into scan_runs (job_id, attempt, queue_job_id, pod_name, started_at)
       values ($1::uuid, $2, $3, $4, $5)`,
      [input.jobId, input.attempt, input.queueJobId, input.podName, input.now],
    );
  }

  async markHeld(jobId: string): Promise<void> {
    await this.executor.unsafe(
      `update scan_jobs set status = 'held', updated_at = now() where id = $1::uuid`,
      [jobId],
    );
  }

  async updateProgress(jobId: string, progress: number, etaSeconds: number | null): Promise<void> {
    await this.executor.unsafe(
      `update scan_jobs
       set progress = $2, eta_seconds = $3, updated_at = now()
       where id = $1::uuid and status = 'running' and progress < $2`,
      [jobId, progress, etaSeconds],
    );
  }

  async countFindings(jobId: string): Promise<number> {
    const rows = await this.executor.unsafe<Array<{ count: string }>>(
      `select count(*)::text as count from scan_findings where job_id = $1::uuid`,
      [jobId],
    );
    return Number(rows[0]?.count ?? '0');
  }

  async insertFindings(jobId: string, findings: NewInternalFinding[]): Promise<number> {
    if (findings.length === 0) return 0;
    const values: unknown[] = [jobId];
    const rows: string[] = [];
    for (const finding of findings) {
      const base = values.length;
      rows.push(
        `($1::uuid, $${base + 1}::finding_severity, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}::numeric, $${base + 6}, $${base + 7})`,
      );
      values.push(
        finding.severity,
        finding.title,
        finding.description,
        finding.evidenceRedacted,
        finding.cvss,
        finding.cwe,
        finding.remediationGuidance,
      );
    }
    // The dedupe index (migration 0040g) makes a repeated (title, cwe) pair a
    // no-op instead of a duplicate row.
    const inserted = await this.executor.unsafe<Array<{ id: string }>>(
      `insert into scan_findings
         (job_id, severity, title, description, evidence_redacted, cvss, cwe, remediation_guidance)
       values ${rows.join(', ')}
       on conflict (job_id, md5(title || coalesce(cwe, ''))) do nothing
       returning id::text as id`,
      values,
    );
    return inserted.length;
  }

  async severityCounts(jobId: string): Promise<SeverityCounts> {
    const rows = await this.executor.unsafe<Array<{ severity: string; count: string }>>(
      `select severity::text as severity, count(*)::text as count
       from scan_findings where job_id = $1::uuid
       group by severity`,
      [jobId],
    );
    const counts: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const row of rows) {
      if (row.severity in counts) {
        counts[row.severity as keyof SeverityCounts] = Number(row.count);
      }
    }
    return counts;
  }

  async markCompleted(input: {
    jobId: string;
    now: Date;
    exitCode: number;
    lineCount: number;
    bytesStreamed: number;
    redactedLogKey: string | null;
  }): Promise<void> {
    await this.executor.unsafe(
      `update scan_jobs
       set status = 'completed', progress = 100, completed_at = $2, eta_seconds = null,
           review_gate_state = 'in_review', updated_at = now()
       where id = $1::uuid`,
      [input.jobId, input.now],
    );
    await this.executor.unsafe(
      `update scan_runs
       set finished_at = $2, exit_code = $3, line_count = $4, bytes_streamed = $5,
           redacted_log_key = $6
       where job_id = $1::uuid
         and attempt = (select max(attempt) from scan_runs where job_id = $1::uuid)`,
      [
        input.jobId,
        input.now,
        input.exitCode,
        input.lineCount,
        input.bytesStreamed,
        input.redactedLogKey,
      ],
    );
  }

  async markFailed(input: {
    jobId: string;
    now: Date;
    cancelled: boolean;
    abortReason: ScanAbortReason;
  }): Promise<void> {
    await this.executor.unsafe(
      input.cancelled
        ? `update scan_jobs
           set status = 'cancelled', cancelled_at = $2, eta_seconds = null, updated_at = now()
           where id = $1::uuid`
        : `update scan_jobs
           set status = 'held', review_gate_state = 'not_eligible', eta_seconds = null,
               updated_at = now()
           where id = $1::uuid`,
      [input.jobId, input.now],
    );
    await this.executor.unsafe(
      `update scan_runs
       set finished_at = $2, abort_reason = $3
       where job_id = $1::uuid
         and attempt = (select max(attempt) from scan_runs where job_id = $1::uuid)`,
      [input.jobId, input.now, input.abortReason],
    );
  }

  async latestRun(jobId: string): Promise<{ attempt: number } | null> {
    const rows = await this.executor.unsafe<Array<{ attempt: number }>>(
      `select attempt from scan_runs where job_id = $1::uuid order by attempt desc limit 1`,
      [jobId],
    );
    return rows[0] ?? null;
  }

  async reviewerIds(): Promise<string[]> {
    const rows = await this.executor.unsafe<Array<{ id: string }>>(
      `select p.id::text as id from profiles p
       where p.role in ('admin', 'super_admin')
         and p.account_status = 'active' and p.deleted_at is null`,
      [],
    );
    return rows.map((row) => row.id);
  }
}

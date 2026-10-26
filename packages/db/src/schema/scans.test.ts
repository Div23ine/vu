import { SQL } from 'drizzle-orm';
import { getTableConfig, type PgColumn } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import {
  pentestRequests,
  reviewDecisions,
  reviewGateChecks,
  scanFindings,
  scanJobs,
  scanRuns,
} from './scans.js';

/** Render a `SQL` fragment to its literal text so expressions can be asserted. */
function renderSql(value: unknown): string {
  if (!(value instanceof SQL)) return String(value);
  return value.queryChunks
    .map((chunk) => {
      if (typeof chunk === 'string') return chunk;
      if (chunk instanceof SQL) return renderSql(chunk);
      if (chunk !== null && typeof chunk === 'object' && 'value' in chunk) {
        return String((chunk as { value: unknown }).value);
      }
      return '';
    })
    .join('');
}

function columnNames(table: Parameters<typeof getTableConfig>[0]): string[] {
  return getTableConfig(table).columns.map((column) => column.name);
}

function column(table: Parameters<typeof getTableConfig>[0], name: string): PgColumn {
  const found = getTableConfig(table).columns.find((candidate) => candidate.name === name);
  if (found === undefined) throw new Error(`column ${name} is missing`);
  return found;
}

/**
 * Drizzle records an identity sequence on `generatedIdentity` at runtime; the
 * property is not part of the public column type, so read it through this shape.
 */
interface IdentityColumn {
  generatedIdentity?: { type?: string; sequenceOptions?: { startWith?: number } };
}

function identityOf(table: Parameters<typeof getTableConfig>[0], name: string): IdentityColumn {
  return column(table, name) as unknown as IdentityColumn;
}

const TABLES = [
  ['scan_jobs', scanJobs],
  ['scan_runs', scanRuns],
  ['scan_findings', scanFindings],
  ['review_gate_checks', reviewGateChecks],
  ['review_decisions', reviewDecisions],
  ['pentest_requests', pentestRequests],
] as const;

describe('scan tables', () => {
  it.each(TABLES)('%s exists with RLS enabled and no permissive policy', (_name, table) => {
    const config = getTableConfig(table);
    expect(config.name).toBe(_name);
    expect(config.enableRLS).toBe(true);
    expect(config.policies).toHaveLength(0);
  });
});

describe('scan_jobs', () => {
  it('declares the queue columns', () => {
    expect(columnNames(scanJobs)).toEqual([
      'id',
      'job_number',
      'job_code',
      'org_id',
      'requested_by',
      'requester_email',
      'target_host',
      'target_ip',
      'target_label',
      'environment',
      'scan_type',
      'priority',
      'scope_notes',
      'status',
      'progress',
      'eta_seconds',
      'payment_status',
      'review_gate_state',
      'analyst_id',
      'assigned_reviewer_id',
      'released_at',
      'released_by',
      'authorisation_doc_key',
      'authorisation_expires_at',
      'requested_at',
      'started_at',
      'completed_at',
      'cancelled_at',
      'report_object_key',
      'created_at',
      'updated_at',
    ]);
  });

  it('derives job_code from the identity sequence as a stored generated column', () => {
    expect(identityOf(scanJobs, 'job_number').generatedIdentity?.type).toBe('always');

    const jobCode = column(scanJobs, 'job_code');
    expect(jobCode.generated?.type).toBe('always');
    expect(jobCode.isUnique).toBe(true);
    const expression = renderSql(jobCode.generated?.as);
    expect(expression).toContain("'JOB-'");
    expect(expression).toContain('lpad(job_number::text');
  });

  it('starts the identity sequence at 4472', () => {
    expect(identityOf(scanJobs, 'job_number').generatedIdentity?.sequenceOptions?.startWith).toBe(
      4472,
    );
  });

  it('locks release behind the review gate and bounds progress', () => {
    const checks = getTableConfig(scanJobs).checks;
    const names = checks.map((constraint) => constraint.name);
    expect(names).toContain('scan_jobs_progress_range');
    expect(names).toContain('scan_jobs_release_lock_check');

    const releaseLock = checks.find((c) => c.name === 'scan_jobs_release_lock_check');
    expect(renderSql(releaseLock?.value)).toContain('approved_released');
    expect(renderSql(releaseLock?.value)).toContain('IS NULL');

    const progress = checks.find((c) => c.name === 'scan_jobs_progress_range');
    expect(renderSql(progress?.value)).toContain('>= 0');
    expect(renderSql(progress?.value)).toContain('<= 100');
  });

  it('indexes the queue, the gate and the payment state', () => {
    expect(getTableConfig(scanJobs).indexes.map((idx) => idx.config.name)).toEqual([
      'scan_jobs_status_idx',
      'scan_jobs_review_gate_state_idx',
      'scan_jobs_payment_status_idx',
      'scan_jobs_analyst_id_idx',
      'scan_jobs_org_requested_idx',
      'scan_jobs_requested_at_idx',
    ]);
  });
});

describe('scan_runs', () => {
  it('keeps one row per attempt and stores no raw scanner output', () => {
    expect(columnNames(scanRuns)).toEqual([
      'id',
      'job_id',
      'attempt',
      'queue_job_id',
      'pod_name',
      'started_at',
      'finished_at',
      'exit_code',
      'abort_reason',
      'line_count',
      'bytes_streamed',
      'redacted_log_key',
      'created_at',
    ]);
    const unique = getTableConfig(scanRuns).indexes.find(
      (idx) => idx.config.name === 'scan_runs_job_id_attempt_idx',
    );
    expect(unique?.config.unique).toBe(true);
    expect(unique?.config.columns).toHaveLength(2);
  });
});

describe('scan_findings', () => {
  it('stores severity, validation and remediation', () => {
    expect(columnNames(scanFindings)).toEqual([
      'id',
      'job_id',
      'severity',
      'title',
      'description',
      'evidence_redacted',
      'cvss',
      'cwe',
      'status',
      'validated_by',
      'validated_at',
      'remediation_guidance',
      'created_at',
      'updated_at',
    ]);
    expect(getTableConfig(scanFindings).indexes.map((idx) => idx.config.name)).toEqual([
      'scan_findings_job_id_severity_idx',
    ]);
  });
});

describe('review_gate_checks', () => {
  it('allows exactly one row per job and check key', () => {
    expect(columnNames(reviewGateChecks)).toEqual([
      'id',
      'job_id',
      'check_key',
      'passed',
      'checked_by',
      'checked_at',
    ]);
    const unique = getTableConfig(reviewGateChecks).indexes.find(
      (idx) => idx.config.name === 'review_gate_checks_job_id_check_key_idx',
    );
    expect(unique?.config.unique).toBe(true);
    expect(unique?.config.columns).toHaveLength(2);
    const names = (unique?.config.columns ?? [])
      .map((entry) => ('name' in entry ? String(entry.name) : renderSql(entry)))
      .join(',');
    expect(names).toContain('job_id');
    expect(names).toContain('check_key');
  });
});

describe('review_decisions', () => {
  it('is append-only and demands a substantive note', () => {
    expect(columnNames(reviewDecisions)).toEqual([
      'id',
      'job_id',
      'decision',
      'reviewer_id',
      'reviewer_role',
      'note',
      'gate_timestamp',
      'created_at',
    ]);
    expect(columnNames(reviewDecisions)).not.toContain('updated_at');
    const check = getTableConfig(reviewDecisions).checks.find(
      (constraint) => constraint.name === 'review_decisions_note_length',
    );
    expect(renderSql(check?.value)).toContain('char_length(');
    expect(renderSql(check?.value)).toContain('>= 10');
  });
});

describe('pentest_requests', () => {
  it('derives the human reference from its own identity sequence', () => {
    expect(columnNames(pentestRequests)).toEqual([
      'id',
      'ref_number',
      'ref_code',
      'org_id',
      'requested_by',
      'target_url',
      'target_type',
      'preferred_schedule',
      'notes',
      'status',
      'converted_job_id',
      'created_at',
      'updated_at',
    ]);
    const refCode = column(pentestRequests, 'ref_code');
    expect(refCode.generated?.type).toBe('always');
    expect(refCode.isUnique).toBe(true);
    expect(renderSql(refCode.generated?.as)).toContain("'VV-PT-'");
    expect(renderSql(refCode.generated?.as)).toContain('ref_number::text');
    expect(
      identityOf(pentestRequests, 'ref_number').generatedIdentity?.sequenceOptions?.startWith,
    ).toBe(1);
  });
});

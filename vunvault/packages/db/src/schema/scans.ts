import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAtCol, idCol, timestamps, tz } from './_columns';
import {
  findingSeverityEnum,
  findingStatusEnum,
  paymentStatusEnum,
  pentestStatusEnum,
  pentestTargetTypeEnum,
  reviewCheckKeyEnum,
  reviewDecisionEnum,
  reviewGateStateEnum,
  scanEnvironmentEnum,
  scanPriorityEnum,
  scanStatusEnum,
  scanTypeEnum,
  userRoleEnum,
} from './_enums';
import { organizations, profiles } from './identity';

/**
 * Scan queue, the Mandatory Admin Review Gate, and pen-test intake.
 *
 * The release lock is enforced twice:
 *   1. in the database, by the `scan_jobs_release_lock_check` constraint —
 *      `released_at` can only be set once `review_gate_state` is
 *      `approved_released`;
 *   2. in the API, which never returns a job whose gate state is `in_review`,
 *      `held_blocked`, `blocked_payment` or `not_eligible` to the client portal.
 *
 * Raw scanner output is never stored here — `scan_runs.redacted_log_key` points at
 * the sanitised object (ANSI stripped, credentials redacted, lines capped at 8 KB).
 */

/** First job code issued by the platform was `JOB-4471`. */
const JOB_NUMBER_START = 4472;

export const scanJobs = pgTable(
  'scan_jobs',
  {
    id: idCol(),
    jobNumber: bigint('job_number', { mode: 'number' })
      .notNull()
      .generatedAlwaysAsIdentity({ startWith: JOB_NUMBER_START }),
    /** Human queue code, e.g. `JOB-4471`. Derived, stored, unique. */
    jobCode: text('job_code')
      .notNull()
      .unique()
      .generatedAlwaysAs(sql`'JOB-' || lpad(job_number::text, 4, '0')`),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    requestedBy: uuid('requested_by').references(() => profiles.id),
    /** Client contact shown in the queue when the requester is not a platform user. */
    requesterEmail: text('requester_email'),
    /** e.g. `api.horizonsacco.co.ke`, or a CIDR such as `10.24.8.0/24`. */
    targetHost: text('target_host').notNull(),
    /** e.g. `41.90.64.12`. */
    targetIp: text('target_ip'),
    /** e.g. `Internal subnet · 254 hosts`. */
    targetLabel: text('target_label'),
    environment: scanEnvironmentEnum('environment'),
    scanType: scanTypeEnum('scan_type').notNull(),
    priority: scanPriorityEnum('priority').notNull().default('medium'),
    /** e.g. `Scope: external API + auth flow`. */
    scopeNotes: text('scope_notes'),
    status: scanStatusEnum('status').notNull().default('queued'),
    progress: smallint('progress').notNull().default(0),
    etaSeconds: integer('eta_seconds'),
    paymentStatus: paymentStatusEnum('payment_status').notNull().default('pending'),
    reviewGateState: reviewGateStateEnum('review_gate_state').notNull().default('not_eligible'),
    /** The analyst running the job. */
    analystId: uuid('analyst_id').references(() => profiles.id),
    assignedReviewerId: uuid('assigned_reviewer_id').references(() => profiles.id),
    releasedAt: tz('released_at'),
    releasedBy: uuid('released_by').references(() => profiles.id),
    /** Object-storage key of the signed authorisation document. */
    authorisationDocKey: text('authorisation_doc_key'),
    authorisationExpiresAt: tz('authorisation_expires_at'),
    requestedAt: tz('requested_at').notNull().defaultNow(),
    startedAt: tz('started_at'),
    completedAt: tz('completed_at'),
    cancelledAt: tz('cancelled_at'),
    /**
     * Object-storage key of the released report PDF, written by the notify
     * worker's `pdf` consumer (Task 90) after it renders and uploads. Null
     * until the first successful render, exactly like the invoice PDF key.
     */
    reportObjectKey: text('report_object_key'),
    ...timestamps,
  },
  (table) => [
    index('scan_jobs_status_idx').on(table.status),
    index('scan_jobs_review_gate_state_idx').on(table.reviewGateState),
    index('scan_jobs_payment_status_idx').on(table.paymentStatus),
    index('scan_jobs_analyst_id_idx').on(table.analystId),
    index('scan_jobs_org_requested_idx').on(table.orgId, sql`${table.requestedAt} DESC`),
    index('scan_jobs_requested_at_idx').on(sql`${table.requestedAt} DESC`),
    check('scan_jobs_progress_range', sql`${table.progress} >= 0 AND ${table.progress} <= 100`),
    check(
      'scan_jobs_release_lock_check',
      sql`${table.releasedAt} IS NULL OR ${table.reviewGateState} = 'approved_released'`,
    ),
  ],
).enableRLS();

/** One row per worker attempt. The scan pod is unprivileged and ephemeral. */
export const scanRuns = pgTable(
  'scan_runs',
  {
    id: idCol(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => scanJobs.id, { onDelete: 'cascade' }),
    attempt: integer('attempt').notNull().default(1),
    /** BullMQ job id. */
    queueJobId: text('queue_job_id'),
    podName: text('pod_name'),
    startedAt: tz('started_at'),
    finishedAt: tz('finished_at'),
    exitCode: integer('exit_code'),
    /** One of `abort`, `kill`, `deadline`, `error`. */
    abortReason: text('abort_reason'),
    lineCount: integer('line_count').notNull().default(0),
    bytesStreamed: bigint('bytes_streamed', { mode: 'number' }).notNull().default(0),
    /**
     * Object-storage key of the sanitised log: ANSI stripped, credentials
     * redacted, lines capped at 8 KB. Raw scanner output never reaches the database.
     */
    redactedLogKey: text('redacted_log_key'),
    createdAt: createdAtCol(),
  },
  (table) => [uniqueIndex('scan_runs_job_id_attempt_idx').on(table.jobId, table.attempt)],
).enableRLS();

export const scanFindings = pgTable(
  'scan_findings',
  {
    id: idCol(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => scanJobs.id, { onDelete: 'cascade' }),
    severity: findingSeverityEnum('severity').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    /** Evidence after redaction — never a raw payload capture. */
    evidenceRedacted: text('evidence_redacted'),
    cvss: numeric('cvss', { precision: 3, scale: 1 }),
    cwe: text('cwe'),
    status: findingStatusEnum('status').notNull().default('open'),
    validatedBy: uuid('validated_by').references(() => profiles.id),
    validatedAt: tz('validated_at'),
    remediationGuidance: text('remediation_guidance'),
    ...timestamps,
  },
  (table) => [index('scan_findings_job_id_severity_idx').on(table.jobId, table.severity)],
).enableRLS();

/** The five checklist rows behind the Mandatory Admin Review Gate. */
export const reviewGateChecks = pgTable(
  'review_gate_checks',
  {
    id: idCol(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => scanJobs.id, { onDelete: 'cascade' }),
    checkKey: reviewCheckKeyEnum('check_key').notNull(),
    passed: boolean('passed').notNull().default(false),
    checkedBy: uuid('checked_by').references(() => profiles.id),
    checkedAt: tz('checked_at'),
  },
  (table) => [
    uniqueIndex('review_gate_checks_job_id_check_key_idx').on(table.jobId, table.checkKey),
  ],
).enableRLS();

/** Append-only: a decision is never edited, a new row supersedes it. */
export const reviewDecisions = pgTable(
  'review_decisions',
  {
    id: idCol(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => scanJobs.id),
    decision: reviewDecisionEnum('decision').notNull(),
    reviewerId: uuid('reviewer_id')
      .notNull()
      .references(() => profiles.id),
    reviewerRole: userRoleEnum('reviewer_role').notNull(),
    /** A reviewer must say why — ten characters is the floor. */
    note: text('note').notNull(),
    gateTimestamp: tz('gate_timestamp').notNull().defaultNow(),
    createdAt: createdAtCol(),
  },
  (table) => [check('review_decisions_note_length', sql`char_length(${table.note}) >= 10`)],
).enableRLS();

export const pentestRequests = pgTable('pentest_requests', {
  id: idCol(),
  refNumber: bigint('ref_number', { mode: 'number' })
    .notNull()
    .generatedAlwaysAsIdentity({ startWith: 1 }),
  /** Human reference, e.g. `VV-PT-000123`. Derived, stored, unique. */
  refCode: text('ref_code')
    .notNull()
    .unique()
    .generatedAlwaysAs(sql`'VV-PT-' || lpad(ref_number::text, 6, '0')`),
  orgId: uuid('org_id').references(() => organizations.id),
  requestedBy: uuid('requested_by').references(() => profiles.id),
  targetUrl: text('target_url').notNull(),
  targetType: pentestTargetTypeEnum('target_type').notNull(),
  preferredSchedule: tz('preferred_schedule'),
  notes: text('notes'),
  status: pentestStatusEnum('status').notNull().default('received'),
  /** Set when intake converts the request into a queued scan job. */
  convertedJobId: uuid('converted_job_id').references(() => scanJobs.id),
  ...timestamps,
}).enableRLS();

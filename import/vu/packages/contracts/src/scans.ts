import { z } from 'zod';
import { IsoDateTime, PageQuery, Uuid, UsdCents } from './common';
import {
  FindingSeveritySchema,
  FindingStatusSchema,
  PaymentStatusSchema,
  PentestStatusSchema,
  PentestTargetTypeSchema,
  ReviewCheckKeySchema,
  ReviewDecisionSchema,
  ReviewGateStateSchema,
  ScanEnvironmentSchema,
  ScanPrioritySchema,
  ScanStatusSchema,
  ScanTypeSchema,
} from './enums';
import { REVIEW_CHECK_KEYS } from '@vunvault/db/enum-values';

/**
 * Scan queue, the Mandatory Admin Review Gate, findings and pen-test intake.
 *
 * Release lock: a job whose `reviewGateState` is `in_review`, `held_blocked`,
 * `blocked_payment` or `not_eligible` is never returned to the client portal.
 */

export const ScanClient = z.object({
  orgId: Uuid,
  name: z.string(),
  contactEmail: z.string().email().nullable(),
});
export type ScanClient = z.infer<typeof ScanClient>;

/** One row of the admin scan queue. */
export const ScanJob = z.object({
  id: Uuid,
  jobCode: z.string().regex(/^JOB-\d{4,}$/),
  requestedAt: IsoDateTime,
  targetHost: z.string().min(1),
  targetIp: z.string().nullable(),
  targetLabel: z.string().nullable(),
  environment: ScanEnvironmentSchema.nullable(),
  client: ScanClient,
  scopeNotes: z.string().nullable(),
  scanType: ScanTypeSchema,
  priority: ScanPrioritySchema,
  status: ScanStatusSchema,
  progress: z.number().int().min(0).max(100),
  etaSeconds: z.number().int().nonnegative().nullable(),
  completedAt: IsoDateTime.nullable(),
  reviewGateState: ReviewGateStateSchema,
  paymentStatus: PaymentStatusSchema,
});
export type ScanJob = z.infer<typeof ScanJob>;

export const ScanListQuery = PageQuery.extend({
  status: ScanStatusSchema.optional(),
  gate: ReviewGateStateSchema.optional(),
  payment: PaymentStatusSchema.optional(),
  type: ScanTypeSchema.optional(),
});
export type ScanListQuery = z.infer<typeof ScanListQuery>;

export const ScanQueueSummary = z.object({
  jobsInQueue: z.number().int().nonnegative(),
  addedToday: z.number().int().nonnegative(),
  runningScans: z.number().int().nonnegative(),
  workerSlotsUsed: z.number().int().nonnegative(),
  workerSlotsTotal: z.number().int().nonnegative(),
  awaitingAdminReview: z.number().int().nonnegative(),
  approvedReleased: z.number().int().nonnegative(),
  releasedThisWeek: z.number().int().nonnegative(),
  paymentOutstanding: z.number().int().nonnegative(),
  overdueOver14Days: z.number().int().nonnegative(),
  heldRejected: z.number().int().nonnegative(),
});
export type ScanQueueSummary = z.infer<typeof ScanQueueSummary>;

/** The API rejects a scan request without a signed authorisation reference. */
export const CreateScanBody = z.object({
  orgId: Uuid.optional(),
  targetHost: z.string().min(3),
  scanType: ScanTypeSchema,
  priority: ScanPrioritySchema.default('medium'),
  environment: ScanEnvironmentSchema.optional(),
  scopeNotes: z.string().max(1000).optional(),
  authorisationDocKey: z.string().min(1),
});
export type CreateScanBody = z.infer<typeof CreateScanBody>;

export const GateChecks = z.record(ReviewCheckKeySchema, z.boolean());
export type GateChecks = z.infer<typeof GateChecks>;

export const GATE_RELEASE_MESSAGE = 'All five verification steps must pass before release';

/**
 * A gate decision. `approve_release` requires all five checks to pass; a hold or a
 * rejection may be recorded with checks still outstanding.
 */
export const GateDecisionBody = z
  .object({
    decision: ReviewDecisionSchema,
    checks: GateChecks,
    note: z.string().min(10),
  })
  .superRefine((value, ctx) => {
    if (value.decision !== 'approve_release') return;
    const allPassed = REVIEW_CHECK_KEYS.every((key) => value.checks[key] === true);
    if (allPassed) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['checks'],
      message: GATE_RELEASE_MESSAGE,
    });
  });
export type GateDecisionBody = z.infer<typeof GateDecisionBody>;

export const BulkScanActionBody = z.object({
  action: z.enum(['open_review_gate', 'assign_reviewer', 'place_on_hold', 'reject_batch']),
  ids: z.array(Uuid).min(1).max(100),
  reviewerId: Uuid.optional(),
});
export type BulkScanActionBody = z.infer<typeof BulkScanActionBody>;

export const ScanFinding = z.object({
  id: Uuid,
  severity: FindingSeveritySchema,
  title: z.string(),
  description: z.string(),
  cvss: z.number().min(0).max(10).nullable(),
  cwe: z.string().nullable(),
  status: FindingStatusSchema,
  remediationGuidance: z.string().nullable(),
});
export type ScanFinding = z.infer<typeof ScanFinding>;

export const CreatePentestRequestBody = z.object({
  targetUrl: z.string().min(3),
  targetType: PentestTargetTypeSchema,
  preferredSchedule: IsoDateTime.optional(),
  notes: z.string().max(2000).optional(),
});
export type CreatePentestRequestBody = z.infer<typeof CreatePentestRequestBody>;

export const PentestRequest = z.object({
  id: Uuid,
  refCode: z.string().regex(/^VV-PT-\d{6,}$/),
  targetUrl: z.string(),
  targetType: PentestTargetTypeSchema,
  status: PentestStatusSchema,
  createdAt: IsoDateTime,
});
export type PentestRequest = z.infer<typeof PentestRequest>;

/** Re-exported so a caller can compute an invoice total from a settled amount. */
export const SettledUsdCents = UsdCents;

/**
 * Internal scan-controller callbacks (Task 40g).
 *
 * The scan controller (L10) runs where untrusted targets are scanned, so it
 * holds NO database credentials: it reports claim / progress / findings /
 * log-url / complete / fail through these routes, authenticated by an
 * HMAC-SHA256 over `timestamp + "." + method + "." + path + "." +
 * sha256hex(rawBody)` with the `SCAN_CONTROLLER_HMAC_KEY` secret, replay-
 * guarded by nonce and optionally IP-restricted by `SCAN_CONTROLLER_CIDRS`.
 */

export const InternalClaimBody = z.object({
  /** BullMQ job id the controller was handed by the queue. */
  queueJobId: z.string().min(1),
  podName: z.string().min(1).max(253).optional(),
});
export type InternalClaimBody = z.infer<typeof InternalClaimBody>;

/** The pod's deadline is fixed by the platform, never negotiated. */
export const INTERNAL_SCAN_DEADLINE_SECONDS = 900 as const;

export const InternalClaimResponse = z.object({
  data: z.object({
    jobId: Uuid,
    jobCode: z.string(),
    targetHost: z.string(),
    scanType: ScanTypeSchema,
    priority: ScanPrioritySchema,
    environment: ScanEnvironmentSchema.nullable(),
    attempt: z.number().int().positive(),
    deadlineSeconds: z.literal(INTERNAL_SCAN_DEADLINE_SECONDS),
  }),
});
export type InternalClaimResponse = z.infer<typeof InternalClaimResponse>;

export const InternalProgressBody = z.object({
  /** 0–99 while running; `complete` is what moves a job to 100. */
  progress: z.number().int().min(0).max(99),
  etaSeconds: z.number().int().min(0).nullable(),
});
export type InternalProgressBody = z.infer<typeof InternalProgressBody>;

export const InternalFinding = z.object({
  severity: FindingSeveritySchema,
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
  evidenceRedacted: z.string().max(2000).optional(),
  cvss: z.number().min(0).max(10).multipleOf(0.1).optional(),
  cwe: z
    .string()
    .regex(/^CWE-\d+$/)
    .optional(),
  remediationGuidance: z.string().max(2000).optional(),
});
export type InternalFinding = z.infer<typeof InternalFinding>;

/** At most 100 findings per call; the API caps a job at 500 total. */
export const INTERNAL_FINDINGS_MAX_PER_CALL = 100 as const;
export const INTERNAL_FINDINGS_MAX_PER_JOB = 500 as const;

export const InternalFindingsBody = z.object({
  findings: z.array(InternalFinding).max(INTERNAL_FINDINGS_MAX_PER_CALL),
});
export type InternalFindingsBody = z.infer<typeof InternalFindingsBody>;

/** Sanitised log archives are at most 5 MB of plain text. */
export const INTERNAL_LOG_MAX_BYTES = 5 * 1024 * 1024;

export const InternalLogUrlBody = z.object({
  contentType: z.literal('text/plain'),
  sizeBytes: z.number().int().min(0).max(INTERNAL_LOG_MAX_BYTES),
});
export type InternalLogUrlBody = z.infer<typeof InternalLogUrlBody>;

export const InternalLogUrlResponse = z.object({
  data: z.object({
    uploadUrl: z.string().url(),
    objectKey: z.string(),
    expiresAt: IsoDateTime,
  }),
});
export type InternalLogUrlResponse = z.infer<typeof InternalLogUrlResponse>;

export const InternalCompleteBody = z.object({
  exitCode: z.number().int(),
  lineCount: z.number().int().min(0),
  bytesStreamed: z.number().int().min(0),
  redactedLogKey: z.string().optional(),
});
export type InternalCompleteBody = z.infer<typeof InternalCompleteBody>;

export const InternalCompleteResponse = z.object({
  data: z.object({
    jobCode: z.string(),
    findings: z.object({
      critical: z.number().int().nonnegative(),
      high: z.number().int().nonnegative(),
      medium: z.number().int().nonnegative(),
      low: z.number().int().nonnegative(),
    }),
  }),
});
export type InternalCompleteResponse = z.infer<typeof InternalCompleteResponse>;

export const SCAN_ABORT_REASONS = ['abort', 'kill', 'deadline', 'error'] as const;
export type ScanAbortReason = (typeof SCAN_ABORT_REASONS)[number];

export const InternalFailBody = z.object({
  reason: z.string().min(1).max(300),
  abortReason: z.enum(SCAN_ABORT_REASONS),
});
export type InternalFailBody = z.infer<typeof InternalFailBody>;

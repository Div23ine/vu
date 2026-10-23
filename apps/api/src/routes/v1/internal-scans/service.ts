import type {
  InternalClaimBody,
  InternalClaimResponse,
  InternalCompleteBody,
  InternalFailBody,
  InternalFinding,
  InternalLogUrlBody,
  InternalProgressBody,
  ScanAbortReason,
} from '@vunvault/contracts';
import { INTERNAL_SCAN_DEADLINE_SECONDS } from '@vunvault/contracts';
import type { AuditService } from '../../../audit/service';
import type { SqlExecutor } from '../../../audit/repo';
import { HttpError } from '../../../lib/http-error';
import type { ObjectStorage } from '../../../lib/object-storage';
import { PRESIGN_PUT_SECONDS } from '../../../lib/object-storage';
import type { InternalScansRepo, NewInternalFinding, SeverityCounts } from './repo';

/**
 * Internal scan-callback operations (Task 40g).
 *
 * State transitions run inside the caller's transaction together with their
 * audit append (system actor `scan-controller`) — the claim especially: the
 * row lock, the `queued` precondition, the authorisation check, the
 * `scan_runs` attempt and `SCAN_STARTED` all commit or roll back as one.
 * Notifications are dispatched by the ROUTE after the commit (best effort):
 * a notification failure must never roll back a completed scan.
 *
 * Finding text passes through `redactSecrets` — the credential shapes the
 * audit redactor drops by KEY, re-applied by VALUE as a second line of
 * defence (the first is the worker's own sanitiser, Task 85).
 */

export const SCAN_CONTROLLER_ACTOR = { id: null, label: 'scan-controller' } as const;

/** The log archive key layout the worker and the portal both rely on. */
export function scanLogObjectKey(jobId: string, attempt: number): string {
  return `scan-logs/${jobId}/${attempt}.log`;
}

/**
 * Value-based credential redaction. The patterns mirror the audit redactor's
 * `REDACTED_KEY_PATTERN` families (authorization / token / secret / password /
 * key material) for free text, plus the cloud key shapes the scanners
 * routinely echo.
 */
const REDACTION_PATTERNS: ReadonlyArray<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\b(authorization\s*:\s*bearer\s+)\S+/gi, replacement: '$1[REDACTED]' },
  { pattern: /\bbearer\s+[A-Za-z0-9\-._~+/]{8,}=*/g, replacement: 'Bearer [REDACTED]' },
  {
    pattern:
      /\b((?:x[-_]?api[-_]?key|api[-_]?key|secret|token|pass(?:word)?|pwd|cookie|cvc)\s*[:=]\s*)\S+/gi,
    replacement: '$1[REDACTED]',
  },
  { pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, replacement: '[REDACTED]' },
  {
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g,
    replacement: '[REDACTED]',
  },
];

export function redactSecrets(text: string): string {
  let out = text;
  for (const { pattern, replacement } of REDACTION_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/** `4m 07s` duration part of the SCAN_COMPLETE message. */
export function formatDuration(startedAt: Date | null, completedAt: Date): string {
  if (startedAt === null) return '0 m 00 s';
  const seconds = Math.max(0, Math.round((completedAt.getTime() - startedAt.getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  return `${minutes} m ${rest} s`;
}

/**
 * `<JOB-code> against <target> finished in <m> m <ss> s · <n> findings
 * (<c> critical, <h> high, <m> medium)` — zero-count severities omitted,
 * `0 findings` (no parentheses) when none. `low` follows the same rule when
 * non-zero (the template shows the three; the omission rule is general).
 */
export function formatScanCompleteMessage(
  jobCode: string,
  targetHost: string,
  startedAt: Date | null,
  completedAt: Date,
  counts: SeverityCounts,
): string {
  const total = counts.critical + counts.high + counts.medium + counts.low;
  const parts = (
    [
      ['critical', counts.critical],
      ['high', counts.high],
      ['medium', counts.medium],
      ['low', counts.low],
    ] as const
  )
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${count} ${label}`);
  const findings = total === 0 ? '0 findings' : `${total} findings (${parts.join(', ')})`;
  return `${jobCode} against ${targetHost} finished in ${formatDuration(startedAt, completedAt)} · ${findings}`;
}

export interface NotifyInput {
  userId: string;
  event: 'job_awaiting_review' | 'critical_finding' | 'scan_completed';
  title: string;
  body: string;
  critical?: boolean;
}

export interface InternalScansServiceDeps {
  repo: InternalScansRepo;
  audit: Pick<AuditService, 'append'>;
  /** Presigns the log upload; wired to `app.storage` by the route. */
  storage?: Pick<ObjectStorage, 'presignPut'>;
  clock?: () => Date;
}

export type ClaimOutcome =
  | { kind: 'claimed'; data: InternalClaimResponse['data'] }
  /** Authorisation missing/expired: the route holds the job and answers 422. */
  | { kind: 'authorisation_invalid' };

export interface CompleteOutcome {
  data: { jobCode: string; findings: SeverityCounts };
  /** Dispatched by the route AFTER the transaction committed. */
  notifications: NotifyInput[];
  message: string;
}

export interface FailOutcome {
  notification: NotifyInput | null;
}

export class InternalScansService {
  private readonly repo: InternalScansRepo;
  private readonly audit: Pick<AuditService, 'append'>;
  private readonly storage: Pick<ObjectStorage, 'presignPut'> | undefined;
  private readonly clock: () => Date;

  constructor(deps: InternalScansServiceDeps) {
    this.repo = deps.repo;
    this.audit = deps.audit;
    this.storage = deps.storage;
    this.clock = deps.clock ?? ((): Date => new Date());
  }

  async claim(
    executor: SqlExecutor,
    jobId: string,
    body: InternalClaimBody,
    ip: string,
  ): Promise<ClaimOutcome> {
    const job = await this.repo.lockJob(jobId);
    if (job === null) throw new HttpError(404, 'not_found', 'Scan job not found');
    if (job.status !== 'queued') throw new HttpError(409, 'not_claimable', 'Job is not queued');

    const now = this.clock();
    const expiresAt =
      job.authorisationExpiresAt === null ? null : new Date(job.authorisationExpiresAt);
    if (job.authorisationDocKey === null || (expiresAt !== null && expiresAt <= now)) {
      // The route persists `held` in its OWN transaction — this one only read.
      return { kind: 'authorisation_invalid' };
    }

    const attempt = await this.repo.nextAttempt(jobId);
    await this.repo.markRunning({
      jobId,
      queueJobId: body.queueJobId,
      podName: body.podName ?? null,
      attempt,
      now,
    });
    await this.audit.append(executor, {
      eventType: 'SCAN_STARTED',
      actor: SCAN_CONTROLLER_ACTOR,
      subject: job.jobCode,
      message: `${job.jobCode} claimed by the scan controller (attempt ${attempt})`,
      details: { jobId, attempt, queueJobId: body.queueJobId, podName: body.podName ?? null },
      ip,
    });

    return {
      kind: 'claimed',
      data: {
        jobId: job.id,
        jobCode: job.jobCode,
        targetHost: job.targetHost,
        scanType: job.scanType as InternalClaimResponse['data']['scanType'],
        priority: job.priority as InternalClaimResponse['data']['priority'],
        environment: job.environment as InternalClaimResponse['data']['environment'],
        attempt,
        deadlineSeconds: INTERNAL_SCAN_DEADLINE_SECONDS,
      },
    };
  }

  /** Persist the `held` status after a rejected claim (own transaction). */
  async hold(jobId: string): Promise<void> {
    await this.repo.markHeld(jobId);
  }

  async progress(jobId: string, body: InternalProgressBody): Promise<void> {
    const job = await this.repo.lockJob(jobId);
    if (job === null) throw new HttpError(404, 'not_found', 'Scan job not found');
    if (job.status !== 'running') {
      throw new HttpError(409, 'invalid_state', 'Job is not running');
    }
    // Monotonic: the SQL ignores values that are not strictly greater.
    await this.repo.updateProgress(jobId, body.progress, body.etaSeconds);
  }

  async findings(jobId: string, findings: InternalFinding[]): Promise<void> {
    const job = await this.repo.lockJob(jobId);
    if (job === null) throw new HttpError(404, 'not_found', 'Scan job not found');
    if (job.status !== 'running') {
      throw new HttpError(409, 'invalid_state', 'Job is not running');
    }
    const existing = await this.repo.countFindings(jobId);
    if (existing + findings.length > 500) {
      throw new HttpError(422, 'too_many_findings', 'A job cannot carry more than 500 findings');
    }
    const rows: NewInternalFinding[] = findings.map((finding) => ({
      severity: finding.severity,
      title: redactSecrets(finding.title).slice(0, 200),
      description: redactSecrets(finding.description).slice(0, 4000),
      evidenceRedacted:
        finding.evidenceRedacted === undefined
          ? null
          : redactSecrets(finding.evidenceRedacted).slice(0, 2000),
      cvss: finding.cvss ?? null,
      cwe: finding.cwe ?? null,
      remediationGuidance:
        finding.remediationGuidance === undefined
          ? null
          : redactSecrets(finding.remediationGuidance).slice(0, 2000),
    }));
    await this.repo.insertFindings(jobId, rows);
  }

  async logUrl(
    jobId: string,
    body: InternalLogUrlBody,
  ): Promise<{ uploadUrl: string; objectKey: string; expiresAt: string }> {
    if (this.storage === undefined) {
      throw new HttpError(503, 'service_unavailable', 'Object storage is not configured');
    }
    const job = await this.repo.lockJob(jobId);
    if (job === null) throw new HttpError(404, 'not_found', 'Scan job not found');
    if (job.status !== 'running') {
      throw new HttpError(409, 'invalid_state', 'Job is not running');
    }
    const run = await this.repo.latestRun(jobId);
    const attempt = run?.attempt ?? 1;
    const objectKey = scanLogObjectKey(jobId, attempt);
    const { url } = await this.storage.presignPut({
      key: objectKey,
      contentType: body.contentType,
      maxBytes: body.sizeBytes,
      expiresSec: PRESIGN_PUT_SECONDS,
    });
    const expiresAt = new Date(this.clock().getTime() + PRESIGN_PUT_SECONDS * 1000);
    return { uploadUrl: url, objectKey, expiresAt: expiresAt.toISOString() };
  }

  async complete(
    executor: SqlExecutor,
    jobId: string,
    body: InternalCompleteBody,
    ip: string,
  ): Promise<CompleteOutcome> {
    const job = await this.repo.lockJob(jobId);
    if (job === null) throw new HttpError(404, 'not_found', 'Scan job not found');
    if (job.status !== 'running') {
      throw new HttpError(409, 'invalid_state', 'Job is not running');
    }
    const now = this.clock();
    const startedAt = job.startedAt === null ? null : new Date(job.startedAt);

    await this.repo.markCompleted({
      jobId,
      now,
      exitCode: body.exitCode,
      lineCount: body.lineCount,
      bytesStreamed: body.bytesStreamed,
      redactedLogKey: body.redactedLogKey ?? null,
    });
    const counts = await this.repo.severityCounts(jobId);
    const message = formatScanCompleteMessage(job.jobCode, job.targetHost, startedAt, now, counts);
    await this.audit.append(executor, {
      eventType: 'SCAN_COMPLETE',
      actor: SCAN_CONTROLLER_ACTOR,
      subject: job.jobCode,
      message,
      details: {
        jobId,
        exitCode: body.exitCode,
        lineCount: body.lineCount,
        bytesStreamed: body.bytesStreamed,
        redactedLogKey: body.redactedLogKey ?? null,
        findings: counts,
      },
      ip,
    });

    // The payment lock is NOT touched here — the review gate owns it (Task 35).
    const reviewerIds = await this.repo.reviewerIds();
    const notifications: NotifyInput[] = reviewerIds.map((userId) => ({
      userId,
      event: 'job_awaiting_review' as const,
      title: 'Scan awaiting review',
      body: `${job.jobCode} against ${job.targetHost} finished and is waiting at the review gate.`,
      critical: false,
    }));
    if (counts.critical > 0) {
      for (const userId of reviewerIds) {
        notifications.push({
          userId,
          event: 'critical_finding' as const,
          title: 'Critical finding',
          body: `${job.jobCode} against ${job.targetHost} reported ${counts.critical} critical finding(s).`,
          critical: true,
        });
      }
    }
    return {
      data: { jobCode: job.jobCode, findings: counts },
      notifications,
      message,
    };
  }

  async fail(
    executor: SqlExecutor,
    jobId: string,
    body: InternalFailBody,
    ip: string,
  ): Promise<FailOutcome> {
    const job = await this.repo.lockJob(jobId);
    if (job === null) throw new HttpError(404, 'not_found', 'Scan job not found');
    if (job.status !== 'running' && job.status !== 'queued') {
      throw new HttpError(409, 'invalid_state', 'Job is not running or queued');
    }
    const now = this.clock();
    const cancelled = body.abortReason === 'abort' || body.abortReason === 'kill';
    await this.repo.markFailed({
      jobId,
      now,
      cancelled,
      abortReason: body.abortReason as ScanAbortReason,
    });
    await this.audit.append(executor, {
      eventType: cancelled ? 'SCAN_CANCELLED' : 'SCAN_FAILED',
      actor: SCAN_CONTROLLER_ACTOR,
      subject: job.jobCode,
      message: `${job.jobCode} ${cancelled ? 'was cancelled' : 'could not be completed'}: ${body.reason}`,
      details: { jobId, reason: body.reason, abortReason: body.abortReason },
      ip,
    });

    const notification: NotifyInput | null =
      job.requestedBy === null
        ? null
        : {
            userId: job.requestedBy,
            event: 'scan_completed',
            title: 'Scan could not be completed',
            body: body.reason,
            critical: false,
          };
    return { notification };
  }
}

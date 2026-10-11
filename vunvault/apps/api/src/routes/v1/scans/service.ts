import type {
  BulkScanActionBody,
  CreateScanBody,
  GateDecisionBody,
  Permission,
  ReviewDecision,
  ScanFinding,
  ScanJob,
  ScanListQuery,
  ScanQueueSummary,
} from '@vunvault/contracts';
import { ROLE_PERMISSIONS } from '@vunvault/contracts';
import type { PdfJobPayload, ScanJobPayload } from '@vunvault/contracts';
import type { ReviewCheckKey, ReviewGateState, ScanStatus } from '@vunvault/db/enum-values';
import type { SqlExecutor } from '../../../audit/repo';
import type { AuditEventType } from '../../../audit/events';
import { HttpError } from '../../../lib/http-error';
import type { ObjectStorage } from '../../../lib/object-storage';
import type { InvoiceIssuer } from '../../../billing/invoice-issuer';
import {
  allChecksPassed,
  canDecide,
  failingChecks,
  isEligibleForBulk,
  isReleased,
  mayDecide,
  noteIsLongEnough,
  decide,
  type GateOutcome,
} from './gate';
import { assertAuthorisationPresent, issueAuthorisationUpload } from './authorisation';
import type { ScanJobRow, ScansRepo } from './repo';

/**
 * Scans: client intake, the admin queue, and the Mandatory Admin Review Gate.
 *
 * Creating a job does not run a scan. It writes a row and puts a job on the
 * BullMQ `scan` queue; an unprivileged pod picks it up later (Layer L10). This
 * service never talks to scan infrastructure, and it never marks a job completed
 * itself — only the worker does, which is what makes the gate meaningful.
 *
 * The release lock lives in `visibility.ts` and the gate rules in `gate.ts`; this
 * module is the only place that turns a rule into a write.
 */

/** Total worker slots across the fleet; used for the queue-summary gauge. */
export const WORKER_SLOTS_TOTAL_DEFAULT = 24;

/** BullMQ job ids are namespaced so a scan job id is never ambiguous in Redis. */
export function queueJobIdFor(scanJobId: string): string {
  return `scan:${scanJobId}`;
}

/** Redis channel a running worker listens on for an abort. */
export function abortChannelFor(scanJobId: string): string {
  return `scan:ctl:${scanJobId}`;
}

/** A target that must never be scanned, whatever the authorisation says. */
const BLOCKED_HOSTS = ['localhost', 'metadata.google.internal'];
const BLOCKED_PREFIXES = ['127.', '169.254.', 'metadata.', '0.'];
const BLOCKED_EXACT = ['::1', '::'];

const HOSTNAME_PATTERN =
  /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.?$/i;
const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const CIDR_PATTERN = /^(.+)\/(\d{1,3})$/;

export interface ParsedTarget {
  /** What is stored and scanned. */
  host: string;
  /** Set when the target is a bare IPv4 address. */
  ip: string | null;
}

/**
 * Validate a scan target.
 *
 * Accepts a hostname, the host of an http(s) URL, an IPv4 address or a CIDR
 * range. Refuses loopback, link-local (which is where every cloud's metadata
 * service lives), `localhost` and the metadata hostnames — scanning those is
 * never in scope, and an authorisation letter does not make it so.
 */
export function parseTarget(raw: string): ParsedTarget {
  const trimmed = raw.trim();
  if (trimmed.length < 3) throw targetNotAllowed();

  let host = trimmed.toLowerCase();

  if (host.includes('://')) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      throw targetNotAllowed();
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw targetNotAllowed();
    host = url.hostname.toLowerCase();
  }

  if (host === '') throw targetNotAllowed();
  // From here on the target is the host itself: a URL's scheme and path are not
  // part of what gets scanned, and storing them would let `https://a.test/x` and
  // `a.test` look like two different authorisations.
  const cidr = CIDR_PATTERN.exec(host);
  const bare = cidr?.[1] ?? host;
  const prefix = cidr?.[2];

  if (BLOCKED_HOSTS.includes(bare) || BLOCKED_EXACT.includes(bare)) throw targetNotAllowed();
  if (BLOCKED_PREFIXES.some((blocked) => bare.startsWith(blocked))) throw targetNotAllowed();
  if (bare.endsWith('.localhost')) throw targetNotAllowed();

  const ipv4 = IPV4_PATTERN.exec(bare);
  if (ipv4 !== null) {
    const octets = ipv4.slice(1).map((part) => Number(part));
    if (octets.some((octet) => octet > 255)) throw targetNotAllowed();
    if (prefix !== undefined && Number(prefix) > 32) throw targetNotAllowed();
    return { host, ip: cidr === null ? bare : null };
  }

  if (bare.includes(':')) {
    // An IPv6 literal: only the blocked ones above are refused here.
    if (prefix !== undefined && Number(prefix) > 128) throw targetNotAllowed();
    return { host, ip: null };
  }

  if (!HOSTNAME_PATTERN.test(bare)) throw targetNotAllowed();
  if (prefix !== undefined) throw targetNotAllowed();
  return { host, ip: null };
}

function targetNotAllowed(): HttpError {
  return new HttpError(
    422,
    'target_not_allowed',
    'That target cannot be scanned. Check the host, and note that loopback, link-local and cloud metadata addresses are never in scope.',
  );
}

/** Plan codes tried for a scan type, in order. */
export function planCodesFor(scanType: string): string[] {
  return [`${scanType}_scan`, 'starter_scan'];
}

export interface ScanActor {
  id: string;
  email: string;
  role: string;
  permissions: Permission[];
}

export interface AuditInstruction {
  eventType: AuditEventType;
  message: string;
  subject?: string;
  details?: Record<string, unknown>;
}

export interface GateDecisionResult {
  job: ScanJob;
  outcome: GateOutcome;
  /** Appended by the route inside the same transaction, in this order. */
  audit: AuditInstruction[];
}

export interface ScansServiceDeps {
  repo: ScansRepo;
  /** The transaction every write in this service belongs to. */
  executor?: SqlExecutor;
  storage?: ObjectStorage;
  issuer?: Pick<InvoiceIssuer, 'issue'>;
  /** Enqueues the scan job under its deterministic BullMQ id. */
  enqueueScan?: (payload: ScanJobPayload, queueJobId: string) => Promise<void>;
  enqueuePdf?: (payload: PdfJobPayload) => Promise<void>;
  enqueueEmail?: (payload: {
    to: string;
    template: string;
    vars: Record<string, string>;
  }) => Promise<void>;
  /** Notifies the client org's users through their own preferences. */
  notify?: (input: { userId: string; title: string; body: string }) => Promise<void>;
  /** Removes a queued BullMQ job, or publishes an abort for a running one. */
  removeQueued?: (queueJobId: string) => Promise<void>;
  publishAbort?: (channel: string, payload: { type: 'abort'; jobId: string }) => Promise<void>;
  now?: () => Date;
  randomUuid?: () => string;
  workerSlotsTotal?: number;
}

export class ScansService {
  private readonly repo: ScansRepo;
  private readonly executor: SqlExecutor | undefined;
  private readonly storage: ObjectStorage | undefined;
  private readonly issuer: Pick<InvoiceIssuer, 'issue'> | undefined;
  private readonly deps: ScansServiceDeps;
  private readonly now: () => Date;
  private readonly randomUuid: () => string;

  constructor(deps: ScansServiceDeps) {
    this.deps = deps;
    this.repo = deps.repo;
    this.executor = deps.executor;
    this.storage = deps.storage;
    this.issuer = deps.issuer;
    this.now = deps.now ?? (() => new Date());
    this.randomUuid = deps.randomUuid ?? (() => crypto.randomUUID());
  }

  // ----------------------------------------------------------- client intake

  async authorisationUpload(orgId: string): Promise<{
    uploadUrl: string;
    objectKey: string;
    expiresAt: string;
  }> {
    if (this.storage === undefined) {
      throw new HttpError(503, 'service_unavailable', 'Object storage is not configured');
    }
    return issueAuthorisationUpload({ storage: this.storage, orgId, now: this.now });
  }

  async createScan(
    orgId: string,
    actor: ScanActor,
    body: CreateScanBody,
  ): Promise<{ job: ScanJob; audit: AuditInstruction[] }> {
    if (this.storage === undefined) {
      throw new HttpError(503, 'service_unavailable', 'Object storage is not configured');
    }
    // The document must exist, and must be this organisation's.
    await assertAuthorisationPresent({
      storage: this.storage,
      key: body.authorisationDocKey,
      orgId,
    });

    const target = parseTarget(body.targetHost);
    const jobId = this.randomUuid();
    const created = await this.repo.createJob({
      id: jobId,
      orgId,
      requestedBy: actor.id,
      requesterEmail: actor.email,
      targetHost: target.host,
      targetIp: target.ip,
      targetLabel: null,
      environment: body.environment ?? null,
      scanType: body.scanType,
      priority: body.priority,
      scopeNotes: body.scopeNotes ?? null,
      authorisationDocKey: body.authorisationDocKey,
    });

    // Queue it, and record the queue id against attempt 1 so a cancel can find it.
    const queueJobId = queueJobIdFor(jobId);
    const payload: ScanJobPayload = {
      jobId,
      attempt: 1,
      targetHost: target.host,
      scanType: body.scanType,
      requestedBy: actor.id,
    };
    await this.repo.recordQueueRun(jobId, 1, queueJobId);
    if (this.deps.enqueueScan !== undefined) {
      await this.deps.enqueueScan(payload, queueJobId);
    }

    const job = await this.view(jobId, created);
    return {
      job,
      audit: [
        {
          eventType: 'SCAN_REQUESTED',
          subject: job.id,
          message: `${job.jobCode} requested against ${job.targetHost}`,
          details: { scanType: job.scanType, priority: job.priority, jobCode: job.jobCode },
        },
      ],
    };
  }

  // ----------------------------------------------------------- client reads

  async clientList(
    orgId: string,
    query: ScanListQuery,
  ): Promise<{ data: ScanJob[]; total: number }> {
    const { rows, total } = await this.repo.listForClient(orgId, {
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
      gate: query.gate,
      payment: query.payment,
      type: query.type,
    });
    return { data: rows.map(toScanJob), total };
  }

  /** A job the caller may not see does not exist: 404, never 403. */
  async clientJob(orgId: string, jobId: string): Promise<ScanJob> {
    const row = await this.repo.getVisibleJob(orgId, jobId);
    if (row === null) throw HttpError.notFound();
    return toScanJob(row);
  }

  async clientFindings(orgId: string, jobId: string): Promise<ScanFinding[]> {
    // Visibility is checked first, so findings inherit the release lock.
    const row = await this.repo.getVisibleJob(orgId, jobId);
    if (row === null) throw HttpError.notFound();
    const findings = await this.repo.listFindings(row.id);
    return findings.map(toFinding);
  }

  // ------------------------------------------------------------ admin reads

  async adminList(query: ScanListQuery): Promise<{ data: ScanJob[]; total: number }> {
    const { rows, total } = await this.repo.listForAdmin({
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
      gate: query.gate,
      payment: query.payment,
      type: query.type,
      q: query.q,
    });
    return { data: rows.map(toScanJob), total };
  }

  async adminJob(jobId: string): Promise<ScanJob> {
    const row = await this.repo.getJobById(jobId);
    if (row === null) throw HttpError.notFound();
    return toScanJob(row);
  }

  async summary(): Promise<ScanQueueSummary> {
    const now = this.now();
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
    );
    const counts = await this.repo.summary({
      startOfToday,
      weekAgo: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      olderThan14Days: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
    });
    return {
      ...counts,
      workerSlotsUsed: counts.runningScans,
      workerSlotsTotal: this.deps.workerSlotsTotal ?? WORKER_SLOTS_TOTAL_DEFAULT,
    };
  }

  // -------------------------------------------------------------- the gate

  /**
   * Apply a review-gate decision.
   *
   * The decision row and the checklist are written for EVERY outcome, including
   * the payment lock: the reviewer did the work and said why, and that is part of
   * the record even when the report cannot be handed over. The route commits all
   * of it and only then answers `409 payment_outstanding`.
   */
  async gateDecision(
    jobId: string,
    actor: ScanActor,
    body: GateDecisionBody,
  ): Promise<GateDecisionResult> {
    const row = await this.repo.getJobById(jobId);
    if (row === null) throw HttpError.notFound();

    // Release is final. Retracting a report means issuing a new job.
    if (
      isReleased({
        reviewGateState: row.reviewGateState as ReviewGateState,
        releasedAt: row.releasedAt,
      })
    ) {
      throw new HttpError(
        409,
        'already_released',
        'This report has been released. Issue a new job to supersede it.',
      );
    }
    if (!canDecide({ status: row.status as ScanStatus })) {
      throw new HttpError(
        409,
        'not_reviewable',
        'Only a completed scan can be reviewed at the gate',
      );
    }
    if (!mayDecide(body.decision as ReviewDecision, actor.permissions)) {
      throw HttpError.forbidden();
    }
    if (!noteIsLongEnough(body.note)) {
      throw HttpError.badRequest('validation_failed', [
        { path: ['note'], message: 'A reviewer must say why, in at least ten characters' },
      ]);
    }
    const checks = body.checks as Record<ReviewCheckKey, boolean>;
    if (body.decision === 'approve_release' && !allChecksPassed(checks)) {
      throw HttpError.badRequest('validation_failed', [
        { path: ['checks'], message: `Outstanding: ${failingChecks(checks).join(', ')}` },
      ]);
    }

    const at = this.now();
    const result = decide({
      job: {
        id: row.id,
        status: row.status as ScanStatus,
        reviewGateState: row.reviewGateState as ReviewGateState,
        paymentStatus: row.paymentStatus,
        releasedAt: row.releasedAt,
      },
      decision: body.decision as ReviewDecision,
      checks,
      note: body.note,
      actorId: actor.id,
      actorRole: actor.role,
      actorPermissions: actor.permissions,
      now: at,
    });

    await this.repo.upsertChecks(jobId, checks, actor.id, at);
    await this.repo.insertDecision({
      jobId,
      decision: body.decision,
      reviewerId: actor.id,
      reviewerRole: actor.role,
      note: body.note,
      at,
    });
    await this.repo.updateJob(jobId, result.next);

    const audit: AuditInstruction[] = [
      {
        eventType: 'GATE_DECISION',
        subject: jobId,
        message: `${body.decision} recorded at the Mandatory Admin Review Gate for ${row.jobCode}`,
        details: { decision: body.decision, jobCode: row.jobCode, outcome: result.outcome },
      },
    ];

    if (result.outcome === 'released') {
      audit.push({
        eventType: 'REPORT_RELEASED',
        subject: jobId,
        message: `Report approved at the Mandatory Admin Review Gate and released to ${row.orgName} client portal · reviewer note attached`,
        details: { jobCode: row.jobCode, reviewerRole: actor.role },
      });
      await this.announceRelease(row);
    }

    if (result.outcome === 'blocked_payment') {
      // Critical, SEV-2: someone approved a report the platform has not been paid
      // for. The attempt is recorded even though the release did not happen.
      audit.push({
        eventType: 'RELEASE_LOCK_VIOLATION',
        subject: jobId,
        message: `Release blocked for ${row.jobCode}: payment status is ${row.paymentStatus}`,
        details: { jobCode: row.jobCode, paymentStatus: row.paymentStatus },
      });
    }

    if (result.outcome === 'held' || result.outcome === 'rejected') {
      audit.push({
        eventType: 'SCAN_HELD',
        subject: jobId,
        message: `${row.jobCode} ${result.outcome === 'held' ? 'held for remediation' : 'rejected and archived'}`,
        details: { jobCode: row.jobCode, decision: body.decision },
      });
    }

    const job = await this.view(jobId, row);
    return { job, outcome: result.outcome, audit };
  }

  /** Tell the client their report is in the portal, and render the PDF. */
  private async announceRelease(row: ScanJobRow): Promise<void> {
    const title = `${row.jobCode} report released`;
    const bodyText = `${row.jobCode} for ${row.targetHost} is available in your portal.`;

    if (this.deps.notify !== undefined) {
      const users = await this.repo.orgUsers(row.orgId);
      for (const user of users) {
        // Non-critical: a released report is good news, and it respects opt-outs
        // and quiet hours like any other notification.
        await this.deps
          .notify({ userId: user.userId, title, body: bodyText })
          .catch(() => undefined);
      }
    }
    if (this.deps.enqueuePdf !== undefined) {
      await this.deps.enqueuePdf({ kind: 'report', refId: row.id }).catch(() => undefined);
    }
  }

  // ------------------------------------------------------------------ bulk

  /**
   * Bulk queue actions. Skips rows that are not eligible rather than failing the
   * batch, and can never release a report: no bulk path sets `released_at`.
   */
  async bulk(
    body: BulkScanActionBody,
  ): Promise<{ updated: number; skippedIds: string[]; audit: AuditInstruction[] }> {
    const rows = await this.repo.getJobsByIds(body.ids);
    const byId = new Map(rows.map((row) => [row.id, row]));
    const skippedIds: string[] = [];
    let updated = 0;

    if (body.action === 'assign_reviewer') {
      await this.assertReviewerEligible(body.reviewerId);
    }

    for (const id of body.ids) {
      const row = byId.get(id);
      if (row === undefined) {
        skippedIds.push(id);
        continue;
      }
      const eligible = isEligibleForBulk(
        {
          status: row.status as ScanStatus,
          reviewGateState: row.reviewGateState as ReviewGateState,
        },
        body.action,
      );
      if (!eligible) {
        skippedIds.push(id);
        continue;
      }

      switch (body.action) {
        case 'open_review_gate':
          await this.repo.updateJob(id, { reviewGateState: 'in_review' });
          break;
        case 'assign_reviewer':
          await this.repo.updateJob(id, { assignedReviewerId: body.reviewerId ?? null });
          break;
        case 'place_on_hold':
          await this.repo.updateJob(id, { status: 'held' });
          break;
        case 'reject_batch':
          await this.repo.updateJob(id, { status: 'rejected', reviewGateState: 'held_blocked' });
          break;
      }
      updated += 1;
    }

    return {
      updated,
      skippedIds,
      audit: [
        {
          eventType: 'BULK_SCAN_ACTION',
          message: `${body.action} applied to ${updated} of ${body.ids.length} scan jobs`,
          details: { action: body.action, ids: body.ids },
        },
      ],
    };
  }

  /** A reviewer must be an active staff member who holds `scans:review`. */
  private async assertReviewerEligible(reviewerId: string | undefined): Promise<void> {
    if (reviewerId === undefined) {
      throw HttpError.badRequest('validation_failed', [
        { path: ['reviewerId'], message: 'assign_reviewer needs a reviewer' },
      ]);
    }
    const reviewer = await this.repo.getReviewer(reviewerId);
    const permissions = ROLE_PERMISSIONS[reviewer?.role as keyof typeof ROLE_PERMISSIONS] ?? [];
    if (
      reviewer === null ||
      reviewer.accountStatus !== 'active' ||
      reviewer.deletedAt !== null ||
      !permissions.includes('scans:review')
    ) {
      throw HttpError.badRequest('validation_failed', [
        {
          path: ['reviewerId'],
          message: 'That reviewer is not an active member with scan review rights',
        },
      ]);
    }
  }

  // -------------------------------------------------------- payment + cancel

  /**
   * Ask the client for the money. Issues an invoice from the plan that matches the
   * scan type when the job does not already have one; issuing twice would bill a
   * client twice, so an existing link ends the operation.
   */
  async requestPayment(
    jobId: string,
  ): Promise<{ job: ScanJob; invoiceNumber: string | null; audit: AuditInstruction[] }> {
    const row = await this.repo.getJobById(jobId);
    if (row === null) throw HttpError.notFound();

    if (row.invoiceId !== null) {
      return {
        job: toScanJob(row),
        invoiceNumber: row.invoiceNumber,
        audit: [
          {
            eventType: 'SCAN_PAYMENT_REQUESTED',
            subject: jobId,
            message: `Payment requested again for ${row.jobCode}; ${row.invoiceNumber} is already issued`,
            details: { jobCode: row.jobCode, invoiceId: row.invoiceId },
          },
        ],
      };
    }

    if (this.issuer === undefined) {
      throw new HttpError(503, 'service_unavailable', 'Invoicing is not configured');
    }
    const plan = await this.findPlan(row.scanType);
    await this.issuer.issue(this.executor, {
      orgId: row.orgId,
      title: `${plan.name} — ${row.jobCode}`,
      detail: `${row.scanType} scan of ${row.targetHost}`,
      scanJobId: row.id,
      lines: [
        {
          description: `${plan.name} — ${row.jobCode}`,
          quantity: 1,
          unitUsdCents: plan.monthlyUsdCents,
          planCode: plan.code,
        },
      ],
    });

    const issued = await this.repo.getJobById(jobId);
    const current = issued ?? row;
    const job = toScanJob(current);
    await this.emailInvoiceLink(current, plan.name);

    return {
      job,
      invoiceNumber: current.invoiceNumber,
      audit: [
        {
          eventType: 'SCAN_PAYMENT_REQUESTED',
          subject: jobId,
          message: `Payment requested for ${row.jobCode}`,
          details: { jobCode: row.jobCode, scanType: row.scanType },
        },
      ],
    };
  }

  private async findPlan(
    scanType: string,
  ): Promise<{ code: string; name: string; monthlyUsdCents: number }> {
    for (const code of planCodesFor(scanType)) {
      const plan = await this.repo.planByCode(code);
      if (plan !== null) return plan;
    }
    throw new HttpError(422, 'plan_missing', `No active plan is priced for a ${scanType} scan`);
  }

  private async emailInvoiceLink(row: ScanJobRow, planName: string): Promise<void> {
    if (this.deps.enqueueEmail === undefined) return;
    const contacts = await this.repo.orgUsers(row.orgId);
    for (const contact of contacts) {
      await this.deps
        .enqueueEmail({
          to: contact.email,
          template: 'invoice_issued',
          vars: {
            jobCode: row.jobCode,
            planName,
            invoiceNumber: row.invoiceNumber ?? '',
            targetHost: row.targetHost,
          },
        })
        .catch(() => undefined);
    }
  }

  /**
   * Cancel a job that has not finished. A queued job is removed from the queue; a
   * running one is told to stop over its control channel, because pulling a job
   * out from under a running pod would leave the pod scanning with nobody
   * listening.
   */
  async cancel(jobId: string): Promise<{ job: ScanJob; audit: AuditInstruction[] }> {
    const row = await this.repo.getJobById(jobId);
    if (row === null) throw HttpError.notFound();
    if (row.status !== 'queued' && row.status !== 'running') {
      throw new HttpError(409, 'not_cancellable', 'Only a queued or running scan can be cancelled');
    }

    const wasRunning = row.status === 'running';
    const queueJobId = await this.repo.queueJobIdFor(jobId);
    if (wasRunning) {
      if (this.deps.publishAbort !== undefined) {
        await this.deps.publishAbort(abortChannelFor(jobId), { type: 'abort', jobId });
      }
    } else if (queueJobId !== null && this.deps.removeQueued !== undefined) {
      await this.deps.removeQueued(queueJobId);
    }

    await this.repo.updateJob(jobId, { status: 'cancelled', cancelledAt: this.now() });
    const updated = await this.repo.getJobById(jobId);
    const job = toScanJob(updated ?? row);

    return {
      job,
      audit: [
        {
          eventType: 'SCAN_CANCELLED',
          subject: jobId,
          message: `${row.jobCode} cancelled while ${wasRunning ? 'running' : 'queued'}`,
          details: { jobCode: row.jobCode, wasRunning },
        },
      ],
    };
  }

  /** Re-read after a write so the response reflects the database, not the patch. */
  private async view(jobId: string, fallback: ScanJobRow): Promise<ScanJob> {
    const row = await this.repo.getJobById(jobId);
    return toScanJob(row ?? fallback);
  }
}

export function toScanJob(row: ScanJobRow): ScanJob {
  return {
    id: row.id,
    jobCode: row.jobCode,
    requestedAt: row.requestedAt,
    targetHost: row.targetHost,
    targetIp: row.targetIp,
    targetLabel: row.targetLabel,
    environment: row.environment as ScanJob['environment'],
    client: {
      orgId: row.orgId,
      name: row.orgName,
      contactEmail: row.contactEmail,
    },
    scopeNotes: row.scopeNotes,
    scanType: row.scanType as ScanJob['scanType'],
    priority: row.priority as ScanJob['priority'],
    status: row.status as ScanJob['status'],
    progress: row.progress,
    etaSeconds: row.etaSeconds,
    completedAt: row.completedAt,
    reviewGateState: row.reviewGateState as ScanJob['reviewGateState'],
    paymentStatus: row.paymentStatus as ScanJob['paymentStatus'],
  };
}

export function toFinding(row: {
  id: string;
  severity: string;
  title: string;
  description: string;
  cvss: number | null;
  cwe: string | null;
  status: string;
  remediationGuidance: string | null;
}): ScanFinding {
  return {
    id: row.id,
    severity: row.severity as ScanFinding['severity'],
    title: row.title,
    description: row.description,
    cvss: row.cvss,
    cwe: row.cwe,
    status: row.status as ScanFinding['status'],
    remediationGuidance: row.remediationGuidance,
  };
}

/** Read `WORKER_SLOTS_TOTAL` without owning the env schema (Task 21's file). */
export function workerSlotsTotal(source: NodeJS.ProcessEnv = process.env): number {
  const raw = source.WORKER_SLOTS_TOTAL;
  if (raw === undefined || raw === '') return WORKER_SLOTS_TOTAL_DEFAULT;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : WORKER_SLOTS_TOTAL_DEFAULT;
}

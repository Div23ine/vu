import type {
  Advisory,
  AdvisoryDraftBody,
  AdvisoryListQuery,
  AdvisorySummary,
  BroadcastEstimate,
  BroadcastRecord,
  ClientAdvisory,
  DraftListItem,
  EmergencyBroadcastBody,
  NvdImportResult,
  PatchStatusBody,
  Permission,
  RetractBody,
} from '@vunvault/contracts';
import { BROADCAST_CONFIRM_PHRASE } from '@vunvault/contracts';
import type { AuditEventType } from '../../../audit/events';
import type { AuditService } from '../../../audit/service';
import type { SqlExecutor } from '../../../audit/repo';
import { HttpError } from '../../../lib/http-error';
import { assertBroadcastable } from './validation';
import { estimateAudience, matchClients, type ClientAsset } from './matching';
import type { NvdClient } from './nvd';
import type { AdvisoryRow, AdvisoriesRepo, BroadcastRow } from './repo';

/**
 * The Zero-Day Intel desk (Task 38).
 *
 * An emergency broadcast is the most consequential write in the platform: it pages
 * clients, it cannot be undone, and it is the reason the audit chain exists. So the
 * order of operations here is deliberate.
 *
 *   1. `assertBroadcastable` — the advisory must be complete and internally
 *      consistent (a severity that contradicts its own CVSS is refused).
 *   2. The five acknowledgements and the typed phrase, enforced by the contract.
 *   3. `intel:broadcast`, held only by administrators.
 *   4. One broadcast per advisory per minute, so a double-click cannot page every
 *      client twice.
 *
 * Only then does anything happen, and it happens in ONE transaction: the advisory
 * is published, the broadcast row is written as `queued`, and the SEV-1 audit entry
 * is appended — with its chain height copied onto the broadcast row, so a broadcast
 * can always be tied to the entry that authorises it.
 *
 * Delivery is NOT done here. The row goes on the `broadcast` queue and the worker
 * (Layer L11) sends it. The enqueue happens AFTER the commit and its failure is
 * logged, never thrown: an advisory that is published and audited must stay that
 * way, and a `queued` row is exactly what the maintenance worker looks for.
 */

/** One broadcast per advisory per minute. */
export const BROADCAST_THROTTLE_MS = 60_000;

/** The fixed source line on every client-facing advisory. */
export const ADVISORY_SOURCE = 'VUNVAULT Intelligence';

/** The note values the editor's draft list can show. */
export const NOTE_AWAITING_REVIEWER = 'Awaiting reviewer';
export const NOTE_NEEDS_SCOPE = 'Needs scope entries';

export interface AuditInstruction {
  eventType: AuditEventType;
  message: string;
  subject?: string;
  details?: Record<string, unknown>;
  /** Only ever raised, never lowered: a broadcast is SEV-1, a re-broadcast SEV-2. */
  sevLevel?: 1 | 2 | 3;
}

export interface AdvisoryActor {
  id: string;
  email: string;
  role: string;
  permissions: Permission[];
}

export interface BroadcastOutcome {
  record: BroadcastRecord;
  advisory: Advisory;
  audit: AuditInstruction;
  /** Enqueued by the route AFTER the transaction commits. */
  job: { broadcastId: string; advisoryId: string; kind: 'initial' | 'rebroadcast' | 'retraction' };
  /** A SEV-1 broadcast pages the on-duty incident commander. */
  commander: { userId: string; title: string; body: string } | null;
}

export interface AdvisoriesServiceDeps {
  repo: AdvisoriesRepo;
  audit?: Pick<AuditService, 'append'>;
  executor?: SqlExecutor;
  nvd?: NvdClient;
  /** `INCIDENT_COMMANDER_ID`: who a SEV-1 escalation pages. */
  incidentCommanderId?: string | null;
  now?: () => Date;
  randomUuid?: () => string;
}

export class AdvisoriesService {
  private readonly repo: AdvisoriesRepo;
  private readonly deps: AdvisoriesServiceDeps;
  private readonly now: () => Date;
  private readonly randomUuid: () => string;

  constructor(deps: AdvisoriesServiceDeps) {
    this.deps = deps;
    this.repo = deps.repo;
    this.now = deps.now ?? (() => new Date());
    this.randomUuid = deps.randomUuid ?? (() => crypto.randomUUID());
  }

  // ------------------------------------------------------------------ drafts

  async createDraft(
    actor: AdvisoryActor,
    body: AdvisoryDraftBody,
  ): Promise<{ advisory: Advisory; audit: AuditInstruction[] }> {
    const existing = await this.repo.findByCveId(body.cveId.toUpperCase());
    if (existing !== null) {
      throw new HttpError(409, 'cve_exists', `${body.cveId.toUpperCase()} is already tracked`);
    }
    const at = this.now();
    const row = await this.repo.createDraft({
      id: this.randomUuid(),
      authorId: actor.id,
      cveId: body.cveId.toUpperCase(),
      vendor: body.vendor ?? null,
      cvss: body.cvss ?? null,
      disclosureDate: body.disclosureDate ?? null,
      severity: body.severity ?? null,
      weaponized: body.weaponized,
      publicPoc: body.publicPoc,
      preAuth: body.preAuth,
      patchAvailable: body.patchAvailable,
      title: body.title ?? null,
      summary: body.summary ?? null,
      remediation: body.remediation ?? null,
      references: body.references,
      scope: body.scope,
      lastSavedAt: at,
    });
    return { advisory: toAdvisory(row), audit: [draftAudit(row)] };
  }

  /** A published advisory is corrected by retracting it and writing a new one. */
  async updateDraft(
    actor: AdvisoryActor,
    advisoryId: string,
    body: AdvisoryDraftBody,
  ): Promise<{ advisory: Advisory; audit: AuditInstruction[] }> {
    const row = await this.mustFind(advisoryId);
    if (row.status !== 'draft') {
      throw new HttpError(
        409,
        'not_editable',
        'A published advisory cannot be edited. Retract it and issue a new one.',
      );
    }
    // The author, or somebody who could broadcast it anyway.
    if (row.authorId !== actor.id && !actor.permissions.includes('intel:broadcast')) {
      throw HttpError.forbidden();
    }

    await this.repo.updateDraft(advisoryId, {
      vendor: body.vendor ?? null,
      cvss: body.cvss ?? null,
      disclosureDate: body.disclosureDate ?? null,
      severity: body.severity ?? null,
      weaponized: body.weaponized,
      publicPoc: body.publicPoc,
      preAuth: body.preAuth,
      patchAvailable: body.patchAvailable,
      title: body.title ?? null,
      summary: body.summary ?? null,
      remediation: body.remediation ?? null,
      references: body.references,
      scope: body.scope,
      lastSavedAt: this.now(),
    });
    const updated = await this.mustFind(advisoryId);
    return { advisory: toAdvisory(updated), audit: [draftAudit(updated)] };
  }

  async list(query: AdvisoryListQuery): Promise<{ data: Advisory[]; total: number }> {
    const { rows, total } = await this.repo.listAdmin({
      page: query.page,
      pageSize: query.pageSize,
      q: query.q,
      status: query.status,
      severity: query.severity,
    });
    return { data: rows.map(toAdvisory), total };
  }

  async drafts(): Promise<{ data: DraftListItem[]; total: number }> {
    const rows = await this.repo.listDrafts();
    const data = rows.map((row) => ({
      id: row.id,
      cveId: row.cveId,
      title: row.title,
      authorLabel: row.authorLabel,
      // A draft always has a save time; the column is only null for a row that was
      // inserted by hand.
      lastSavedAt: row.lastSavedAt ?? new Date(0).toISOString(),
      note: draftNote(row),
    }));
    return { data, total: data.length };
  }

  async summary(): Promise<AdvisorySummary> {
    const now = this.now();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const counts = await this.repo.summary({ startOfMonth });
    const [dashboards, newClients] = await Promise.all([
      this.repo.orgsWithAcknowledgementSince(monthAgo),
      this.repo.orgsCreatedSince(startOfMonth),
    ]);
    return { ...counts, dashboardsReached: dashboards, newClientsThisMonth: newClients };
  }

  async get(advisoryId: string): Promise<Advisory> {
    return toAdvisory(await this.mustFind(advisoryId));
  }

  async broadcasts(advisoryId: string): Promise<BroadcastRecord[]> {
    const rows = await this.repo.listBroadcasts(advisoryId);
    return rows.map(toBroadcastRecord);
  }

  // ------------------------------------------------------------- NVD import

  /** Pre-fills the editor. Nothing is saved by this call. */
  async importFromNvd(cveId: string): Promise<NvdImportResult> {
    if (this.deps.nvd === undefined) {
      throw new HttpError(503, 'service_unavailable', 'The NVD import is not configured');
    }
    const result = await this.deps.nvd.getCve(cveId);
    if (result === null) throw HttpError.notFound();
    return result;
  }

  // --------------------------------------------------------------- audience

  async estimate(
    advisoryId: string,
  ): Promise<{ estimate: BroadcastEstimate; assets: ClientAsset[] }> {
    const row = await this.mustFind(advisoryId);
    return { estimate: await this.audienceFor(row), assets: await this.repo.assets() };
  }

  private async audienceFor(row: AdvisoryRow): Promise<BroadcastEstimate> {
    const assets = await this.repo.assets();
    const { orgIds } = matchClients(row.scope, assets);
    const contacts = await this.repo.contactsFor(orgIds);
    return estimateAudience({
      matchedOrgIds: orgIds,
      emailContacts: contacts.emailContacts,
      smsContacts: contacts.smsContacts,
      // One on-duty commander, whatever the size of the estate.
      incidentCommanders: this.deps.incidentCommanderId === null ? 0 : 1,
    });
  }

  // -------------------------------------------------------------- broadcast

  /**
   * Publish and queue an emergency broadcast, or a re-broadcast of a published one.
   *
   * The audit entry is appended here rather than by the route wrapper because the
   * broadcast row stores the entry's chain height (`audit_seq`): the row and the
   * entry have to be written in the same transaction, in that order.
   */
  async broadcast(
    advisoryId: string,
    actor: AdvisoryActor,
    body: EmergencyBroadcastBody,
    kind: 'initial' | 'rebroadcast',
  ): Promise<BroadcastOutcome> {
    const row = await this.mustFind(advisoryId);

    // (1) The advisory itself.
    assertBroadcastable(
      {
        status: row.status,
        title: row.title,
        severity: row.severity as Advisory['severity'],
        summary: row.summary,
        remediation: row.remediation,
        scope: row.scope,
        cvss: row.cvss,
      },
      kind,
    );

    // (2) The contract has already checked the five acknowledgements and the
    // phrase; this is the belt to its braces, because the cost of being wrong is
    // a page to every client.
    if (body.confirmPhrase.trim().toUpperCase() !== BROADCAST_CONFIRM_PHRASE) {
      throw HttpError.badRequest('validation_failed', [
        { path: ['confirmPhrase'], message: 'Type BROADCAST to confirm.' },
      ]);
    }

    // (3) Permission.
    if (!actor.permissions.includes('intel:broadcast')) throw HttpError.forbidden();

    // (4) One broadcast a minute per advisory.
    const lastBroadcastAt = await this.repo.lastBroadcastAt(advisoryId);
    if (
      lastBroadcastAt !== null &&
      this.now().getTime() - new Date(lastBroadcastAt).getTime() < BROADCAST_THROTTLE_MS
    ) {
      throw new HttpError(
        409,
        'broadcast_in_progress',
        'A broadcast for this advisory is already under way',
      );
    }

    const estimate = await this.audienceFor(row);
    const at = this.now();
    if (kind === 'initial') await this.repo.markPublished(advisoryId, at);

    const broadcastId = this.randomUuid();
    const stored = await this.repo.insertBroadcast({
      id: broadcastId,
      advisoryId,
      kind,
      triggeredBy: actor.id,
      ack: { ...body.ack },
      audienceDashboards: estimate.dashboards,
      emailContacts: estimate.emailContacts,
      smsContacts: estimate.smsContacts,
      queueJobId: `broadcast:${broadcastId}`,
    });

    const audit: AuditInstruction = {
      eventType: 'ADVISORY_BROADCAST',
      // SEV-1 for the first broadcast, SEV-2 for a reminder: the catalogue sets
      // both, and `append` only ever raises a severity.
      sevLevel: kind === 'initial' ? 1 : 2,
      subject: advisoryId,
      message:
        kind === 'initial'
          ? `${row.cveId} emergency advisory pushed to ${estimate.dashboards} client dashboards`
          : `${row.cveId} emergency advisory re-broadcast to ${estimate.dashboards} client dashboards`,
      details: {
        cveId: row.cveId,
        kind,
        severity: row.severity,
        dashboards: estimate.dashboards,
        emailContacts: estimate.emailContacts,
        smsContacts: estimate.smsContacts,
      },
    };

    if (this.deps.audit !== undefined && this.deps.executor !== undefined) {
      const entry = await this.deps.audit.append(this.deps.executor, {
        eventType: audit.eventType,
        actor: { id: actor.id, label: actor.email.split('@')[0] ?? actor.email },
        subject: advisoryId,
        message: audit.message,
        details: audit.details,
        ...(audit.sevLevel === undefined ? {} : { sevLevel: audit.sevLevel }),
      });
      // The chain height that authorises this broadcast, on the row itself.
      await this.repo.setBroadcastAuditSeq(stored.id, entry.seq);
    }

    const published = await this.repo.findById(advisoryId);
    const commanderId = this.deps.incidentCommanderId ?? null;

    return {
      record: toBroadcastRecord(stored),
      advisory: toAdvisory(published ?? row),
      audit,
      job: { broadcastId: stored.id, advisoryId, kind },
      commander:
        kind === 'initial' && commanderId !== null
          ? {
              userId: commanderId,
              title: `${row.cveId} emergency advisory broadcast`,
              body: `${row.cveId} was pushed to ${estimate.dashboards} client dashboards.`,
            }
          : null,
    };
  }

  // --------------------------------------------------------------- retract

  async retract(
    advisoryId: string,
    actor: AdvisoryActor,
    body: RetractBody,
  ): Promise<{
    advisory: Advisory;
    audit: AuditInstruction[];
    job: BroadcastOutcome['job'] | null;
  }> {
    const row = await this.mustFind(advisoryId);
    if (row.status !== 'published') {
      throw new HttpError(409, 'not_retractable', 'Only a published advisory can be retracted');
    }
    if (!actor.permissions.includes('intel:broadcast')) throw HttpError.forbidden();

    const at = this.now();
    await this.repo.retract(advisoryId, at, body.note);

    // Clients who received the advisory get a follow-up notice: a retraction that
    // nobody hears is worse than no retraction.
    const broadcastId = this.randomUuid();
    const stored = await this.repo.insertBroadcast({
      id: broadcastId,
      advisoryId,
      kind: 'retraction',
      triggeredBy: actor.id,
      ack: { authorised: true },
      audienceDashboards: 0,
      emailContacts: 0,
      smsContacts: 0,
      queueJobId: `broadcast:${broadcastId}`,
    });

    const updated = await this.mustFind(advisoryId);
    return {
      advisory: toAdvisory(updated),
      audit: [
        {
          eventType: 'ADVISORY_RETRACTED',
          sevLevel: 2,
          subject: advisoryId,
          message: `${row.cveId} retracted: ${body.note}`,
          details: { cveId: row.cveId, note: body.note },
        },
      ],
      job: { broadcastId: stored.id, advisoryId, kind: 'retraction' },
    };
  }

  async setPatchStatus(
    advisoryId: string,
    body: PatchStatusBody,
  ): Promise<{ advisory: Advisory; audit: AuditInstruction[] }> {
    const row = await this.mustFind(advisoryId);
    await this.repo.setPatchStatus(advisoryId, body.patchStatus);
    const updated = await this.mustFind(advisoryId);
    return {
      advisory: toAdvisory(updated),
      audit: [
        {
          eventType: 'ADVISORY_PATCH_STATUS_CHANGED',
          subject: advisoryId,
          message: `${row.cveId} patch status set to ${body.patchStatus}`,
          details: { cveId: row.cveId, patchStatus: body.patchStatus },
        },
      ],
    };
  }

  // ---------------------------------------------------------- client facing

  async clientList(orgId: string): Promise<{ data: ClientAdvisory[]; total: number }> {
    const rows = await this.repo.listForClient(orgId);
    const data = rows.map(toClientAdvisory);
    return { data, total: data.length };
  }

  /** Idempotent: acknowledging twice is still one acknowledgement. */
  async acknowledge(
    advisoryId: string,
    orgId: string,
    userId: string,
  ): Promise<{ cveId: string; audit: AuditInstruction[] }> {
    const row = await this.mustFind(advisoryId);
    if (row.status !== 'published' || row.retractedAt !== null) {
      // A draft or a retracted advisory is not something a client can acknowledge,
      // and saying so would admit it exists.
      throw HttpError.notFound();
    }
    await this.repo.acknowledge(advisoryId, orgId, userId, this.now());
    return {
      cveId: row.cveId,
      audit: [
        {
          eventType: 'ADVISORY_ACKNOWLEDGED',
          subject: advisoryId,
          message: `${orgId} acknowledged ${row.cveId}`,
          details: { cveId: row.cveId },
        },
      ],
    };
  }

  private async mustFind(advisoryId: string): Promise<AdvisoryRow> {
    const row = await this.repo.findById(advisoryId);
    if (row === null) throw HttpError.notFound();
    return row;
  }
}

/** The draft list's one-line status, computed rather than stored. */
export function draftNote(row: AdvisoryRow): DraftListItem['note'] {
  if (
    row.contentItemId !== null &&
    (row.contentItemStatus === 'pending_review' || row.contentItemStatus === 'in_review')
  ) {
    return NOTE_AWAITING_REVIEWER;
  }
  if (row.scope.length === 0) return NOTE_NEEDS_SCOPE;
  // "Unsaved changes" is the editor's own business; the API has no opinion.
  return null;
}

function draftAudit(row: AdvisoryRow): AuditInstruction {
  return {
    eventType: 'ADVISORY_DRAFT_SAVED',
    subject: row.id,
    message: `Advisory draft saved for ${row.cveId}`,
    details: { cveId: row.cveId, scopeEntries: row.scope.length },
  };
}

export function toAdvisory(row: AdvisoryRow): Advisory {
  return {
    id: row.id,
    cveId: row.cveId,
    vendor: row.vendor,
    cvss: row.cvss,
    disclosureDate: row.disclosureDate,
    severity: row.severity as Advisory['severity'],
    weaponized: row.weaponized,
    publicPoc: row.publicPoc,
    preAuth: row.preAuth,
    patchAvailable: row.patchAvailable,
    title: row.title,
    summary: row.summary,
    remediation: row.remediation,
    references: row.references,
    scope: row.scope,
    status: row.status as Advisory['status'],
    patchStatus: row.patchStatus as Advisory['patchStatus'],
    author: { id: row.authorId, label: row.authorLabel },
    lastSavedAt: row.lastSavedAt,
    publishedAt: row.publishedAt,
    lastBroadcastAt: row.lastBroadcastAt,
    reach: row.reach,
  };
}

export function toBroadcastRecord(row: BroadcastRow): BroadcastRecord {
  return {
    id: row.id,
    advisoryId: row.advisoryId,
    kind: row.kind as BroadcastRecord['kind'],
    status: row.status as BroadcastRecord['status'],
    triggeredByLabel: row.triggeredByLabel,
    audienceDashboards: row.audienceDashboards,
    emailContacts: row.emailContacts,
    smsContacts: row.smsContacts,
    sentDashboards: row.sentDashboards,
    sentEmail: row.sentEmail,
    sentSms: row.sentSms,
    failed: row.failed,
    createdAt: row.createdAt,
    finishedAt: row.finishedAt,
  };
}

/** The client projection: no author, no ids beyond the advisory's, no delivery. */
export function toClientAdvisory(row: {
  id: string;
  cveId: string;
  title: string;
  severity: string;
  scope: Advisory['scope'];
  summary: string;
  remediation: string;
  references: string[];
  patchStatus: string;
  publishedAt: string;
  acknowledged: boolean;
}): ClientAdvisory {
  return {
    id: row.id,
    cveId: row.cveId,
    title: row.title,
    severity: row.severity as ClientAdvisory['severity'],
    scope: row.scope,
    summary: row.summary,
    remediation: row.remediation,
    references: row.references,
    patchStatus: row.patchStatus as ClientAdvisory['patchStatus'],
    publishedAt: row.publishedAt,
    source: ADVISORY_SOURCE,
    acknowledged: row.acknowledged,
  };
}

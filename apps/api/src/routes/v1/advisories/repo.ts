import type { AdvisoryScopeEntry } from '@vunvault/contracts';
import { asExecutor, type SqlExecutor } from '../../../audit/repo.js';
import type { ClientAsset } from './matching.js';

/**
 * Advisory storage (Task 38).
 *
 * Append-only where it matters: `advisory_broadcasts` rows are inserted and their
 * delivery counters advanced by the broadcast worker, and nothing here deletes a
 * broadcast or an acknowledgement. A mistaken broadcast is retracted, in the open,
 * with a note — never removed.
 */

export interface AdvisoryRow {
  id: string;
  cveId: string;
  vendor: string | null;
  cvss: number | null;
  disclosureDate: string | null;
  severity: string | null;
  weaponized: boolean;
  publicPoc: boolean;
  preAuth: boolean;
  patchAvailable: boolean;
  title: string | null;
  summary: string | null;
  remediation: string | null;
  references: string[];
  scope: AdvisoryScopeEntry[];
  status: string;
  patchStatus: string;
  authorId: string;
  authorLabel: string;
  contentItemId: string | null;
  contentItemStatus: string | null;
  lastSavedAt: string | null;
  publishedAt: string | null;
  retractedAt: string | null;
  retractionNote: string | null;
  lastBroadcastAt: string | null;
  /** Distinct organisations that acknowledged within 24 h of the first broadcast. */
  reach: number | null;
}

export interface BroadcastRow {
  id: string;
  advisoryId: string;
  kind: string;
  status: string;
  triggeredByLabel: string;
  ack: Record<string, boolean>;
  audienceDashboards: number;
  emailContacts: number;
  smsContacts: number;
  sentDashboards: number;
  sentEmail: number;
  sentSms: number;
  failed: number;
  auditSeq: number | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface ClientAdvisoryRow {
  id: string;
  cveId: string;
  title: string;
  severity: string;
  scope: AdvisoryScopeEntry[];
  summary: string;
  remediation: string;
  references: string[];
  patchStatus: string;
  publishedAt: string;
  acknowledged: boolean;
}

export interface NewAdvisory {
  id: string;
  authorId: string;
  cveId: string;
  vendor: string | null;
  cvss: number | null;
  disclosureDate: string | null;
  severity: string | null;
  weaponized: boolean;
  publicPoc: boolean;
  preAuth: boolean;
  patchAvailable: boolean;
  title: string | null;
  summary: string | null;
  remediation: string | null;
  references: string[];
  scope: AdvisoryScopeEntry[];
  lastSavedAt: Date;
}

export type AdvisoryPatch = Partial<Omit<NewAdvisory, 'id' | 'authorId' | 'cveId'>>;

export interface NewBroadcast {
  id: string;
  advisoryId: string;
  kind: 'initial' | 'rebroadcast' | 'retraction';
  triggeredBy: string;
  ack: Record<string, boolean>;
  audienceDashboards: number;
  emailContacts: number;
  smsContacts: number;
  queueJobId: string | null;
}

export interface AdvisoryListFilters {
  page: number;
  pageSize: number;
  q?: string;
  status?: string;
  severity?: string;
}

export interface AdvisorySummaryCounts {
  activeZeroDays: number;
  criticalSeverity: number;
  unpatchedCritical: number;
  weaponizedInWild: number;
  advisoriesPublished: number;
  broadcastThisMonth: number;
  openDrafts: number;
  escalatedDrafts: number;
}

export interface AdvisoriesRepo {
  findByCveId(cveId: string): Promise<AdvisoryRow | null>;
  findById(advisoryId: string): Promise<AdvisoryRow | null>;
  createDraft(input: NewAdvisory): Promise<AdvisoryRow>;
  updateDraft(advisoryId: string, patch: AdvisoryPatch): Promise<void>;
  listAdmin(filters: AdvisoryListFilters): Promise<{ rows: AdvisoryRow[]; total: number }>;
  listDrafts(): Promise<AdvisoryRow[]>;
  summary(bounds: { startOfMonth: Date }): Promise<AdvisorySummaryCounts>;

  markPublished(advisoryId: string, at: Date): Promise<void>;
  insertBroadcast(input: NewBroadcast): Promise<BroadcastRow>;
  setBroadcastAuditSeq(broadcastId: string, seq: number): Promise<void>;
  listBroadcasts(advisoryId: string): Promise<BroadcastRow[]>;
  firstBroadcastAt(advisoryId: string): Promise<string | null>;
  lastBroadcastAt(advisoryId: string): Promise<string | null>;
  retract(advisoryId: string, at: Date, note: string): Promise<void>;
  setPatchStatus(advisoryId: string, patchStatus: string): Promise<void>;

  listForClient(orgId: string): Promise<ClientAdvisoryRow[]>;
  acknowledge(advisoryId: string, orgId: string, userId: string | null, at: Date): Promise<void>;

  assets(): Promise<ClientAsset[]>;
  /** Active users of the matched orgs, split by the channel they can be reached on. */
  contactsFor(orgIds: readonly string[]): Promise<{ emailContacts: number; smsContacts: number }>;
  orgsWithAcknowledgementSince(since: Date): Promise<number>;
  orgsCreatedSince(since: Date): Promise<number>;
}

const ADVISORY_COLUMNS = `
  a.id::text as id, a.cve_id, a.vendor, a.cvss::text as cvss, a.disclosure_date::text as disclosure_date,
  a.severity::text as severity, a.weaponized, a.public_poc, a.pre_auth, a.patch_available,
  a.title, a.summary, a.remediation, a.references, a.scope,
  a.status::text as status, a.patch_status::text as patch_status,
  a.author_id::text as author_id,
  coalesce(p.full_name, p.display_name, p.email::text) as author_name,
  a.content_item_id::text as content_item_id,
  ci.status::text as content_item_status,
  a.last_saved_at, a.published_at, a.retracted_at, a.retraction_note,
  (select max(b.created_at) from advisory_broadcasts b
    where b.advisory_id = a.id and b.kind in ('initial','rebroadcast')) as last_broadcast_at,
  -- Reach: distinct organisations that acknowledged inside 24 hours of the FIRST
  -- broadcast. Computed here, in one pass, rather than per row in the service.
  (select count(distinct ak.org_id)::text
     from advisory_acknowledgements ak
    where ak.advisory_id = a.id
      and exists (select 1 from advisory_broadcasts fb
                   where fb.advisory_id = a.id and fb.kind = 'initial')
      and ak.acknowledged_at >= (select min(fb.created_at) from advisory_broadcasts fb
                                  where fb.advisory_id = a.id and fb.kind = 'initial')
      and ak.acknowledged_at <= (select min(fb.created_at) from advisory_broadcasts fb
                                  where fb.advisory_id = a.id and fb.kind = 'initial')
                                + interval '24 hours')::text as reach`;

const ADVISORY_FROM = `
  from advisories a
  join profiles p on p.id = a.author_id
  left join content_items ci on ci.id = a.content_item_id`;

interface SqlAdvisoryRow {
  id: string;
  cve_id: string;
  vendor: string | null;
  cvss: string | null;
  disclosure_date: string | null;
  severity: string | null;
  weaponized: boolean;
  public_poc: boolean;
  pre_auth: boolean;
  patch_available: boolean;
  title: string | null;
  summary: string | null;
  remediation: string | null;
  references: string[] | null;
  scope: AdvisoryScopeEntry[] | null;
  status: string;
  patch_status: string;
  author_id: string;
  author_name: string | null;
  content_item_id: string | null;
  content_item_status: string | null;
  last_saved_at: Date | string | null;
  published_at: Date | string | null;
  retracted_at: Date | string | null;
  retraction_note: string | null;
  last_broadcast_at: Date | string | null;
  reach: string | number | null;
}

interface SqlBroadcastRow {
  id: string;
  advisory_id: string;
  kind: string;
  status: string;
  triggered_by_label: string | null;
  ack: Record<string, boolean> | null;
  audience_dashboards: number;
  email_contacts: number;
  sms_contacts: number;
  sent_dashboards: number;
  sent_email: number;
  sent_sms: number;
  failed: number;
  audit_seq: string | number | null;
  created_at: Date | string;
  finished_at: Date | string | null;
}

function iso(value: Date | string | null): string | null {
  return value === null || value === undefined ? null : new Date(value).toISOString();
}

function mapAdvisory(row: SqlAdvisoryRow): AdvisoryRow {
  return {
    id: row.id,
    cveId: row.cve_id,
    vendor: row.vendor,
    cvss: row.cvss === null ? null : Number(row.cvss),
    disclosureDate: row.disclosure_date,
    severity: row.severity,
    weaponized: row.weaponized,
    publicPoc: row.public_poc,
    preAuth: row.pre_auth,
    patchAvailable: row.patch_available,
    title: row.title,
    summary: row.summary,
    remediation: row.remediation,
    references: row.references ?? [],
    scope: row.scope ?? [],
    status: row.status,
    patchStatus: row.patch_status,
    authorId: row.author_id,
    authorLabel: row.author_name ?? '',
    contentItemId: row.content_item_id,
    contentItemStatus: row.content_item_status,
    lastSavedAt: iso(row.last_saved_at),
    publishedAt: iso(row.published_at),
    retractedAt: iso(row.retracted_at),
    retractionNote: row.retraction_note,
    lastBroadcastAt: iso(row.last_broadcast_at),
    reach: row.reach === null || row.reach === undefined ? null : Number(row.reach),
  };
}

function mapBroadcast(row: SqlBroadcastRow): BroadcastRow {
  return {
    id: row.id,
    advisoryId: row.advisory_id,
    kind: row.kind,
    status: row.status,
    triggeredByLabel: row.triggered_by_label ?? '',
    ack: row.ack ?? {},
    audienceDashboards: Number(row.audience_dashboards),
    emailContacts: Number(row.email_contacts),
    smsContacts: Number(row.sms_contacts),
    sentDashboards: Number(row.sent_dashboards),
    sentEmail: Number(row.sent_email),
    sentSms: Number(row.sent_sms),
    failed: Number(row.failed),
    auditSeq: row.audit_seq === null ? null : Number(row.audit_seq),
    createdAt: new Date(row.created_at).toISOString(),
    finishedAt: iso(row.finished_at),
  };
}

const BROADCAST_COLUMNS = `
  b.id::text as id, b.advisory_id::text as advisory_id, b.kind::text as kind,
  b.status::text as status,
  coalesce(p.full_name, p.display_name, p.email::text) as triggered_by_label,
  b.ack, b.audience_dashboards, b.email_contacts, b.sms_contacts, b.sent_dashboards,
  b.sent_email, b.sent_sms, b.failed, b.audit_seq, b.created_at, b.finished_at`;

const BROADCAST_FROM = `
  from advisory_broadcasts b
  join profiles p on p.id = b.triggered_by`;

export class SqlAdvisoriesRepo implements AdvisoriesRepo {
  private readonly executor: SqlExecutor;

  constructor(connection: unknown) {
    this.executor = asExecutor(connection);
  }

  async findByCveId(cveId: string): Promise<AdvisoryRow | null> {
    const rows = await this.executor.unsafe<SqlAdvisoryRow[]>(
      `select ${ADVISORY_COLUMNS} ${ADVISORY_FROM} where a.cve_id = $1 limit 1`,
      [cveId],
    );
    const row = rows[0];
    return row === undefined ? null : mapAdvisory(row);
  }

  async findById(advisoryId: string): Promise<AdvisoryRow | null> {
    const rows = await this.executor.unsafe<SqlAdvisoryRow[]>(
      `select ${ADVISORY_COLUMNS} ${ADVISORY_FROM} where a.id = $1::uuid limit 1`,
      [advisoryId],
    );
    const row = rows[0];
    return row === undefined ? null : mapAdvisory(row);
  }

  async createDraft(input: NewAdvisory): Promise<AdvisoryRow> {
    await this.executor.unsafe(
      `insert into advisories
         (id, cve_id, vendor, cvss, disclosure_date, severity, weaponized, public_poc, pre_auth,
          patch_available, title, summary, remediation, references, scope, status, author_id,
          last_saved_at)
       values ($1::uuid, $2, $3, $4::numeric, $5::date, $6::finding_severity, $7, $8, $9, $10,
               $11, $12, $13, $14::text[], $15::jsonb, 'draft', $16::uuid, $17)`,
      [
        input.id,
        input.cveId,
        input.vendor,
        input.cvss,
        input.disclosureDate,
        input.severity,
        input.weaponized,
        input.publicPoc,
        input.preAuth,
        input.patchAvailable,
        input.title,
        input.summary,
        input.remediation,
        input.references,
        JSON.stringify(input.scope),
        input.authorId,
        input.lastSavedAt,
      ],
    );
    const created = await this.findById(input.id);
    if (created === null) throw new Error('advisory was not created');
    return created;
  }

  async updateDraft(advisoryId: string, patch: AdvisoryPatch): Promise<void> {
    const sets: string[] = ['updated_at = now()'];
    const values: unknown[] = [advisoryId];
    const add = (column: string, value: unknown, cast?: string): void => {
      values.push(value);
      sets.push(`${column} = $${values.length}${cast === undefined ? '' : `::${cast}`}`);
    };

    if (patch.vendor !== undefined) add('vendor', patch.vendor);
    if (patch.cvss !== undefined) add('cvss', patch.cvss, 'numeric');
    if (patch.disclosureDate !== undefined) add('disclosure_date', patch.disclosureDate, 'date');
    if (patch.severity !== undefined) add('severity', patch.severity, 'finding_severity');
    if (patch.weaponized !== undefined) add('weaponized', patch.weaponized);
    if (patch.publicPoc !== undefined) add('public_poc', patch.publicPoc);
    if (patch.preAuth !== undefined) add('pre_auth', patch.preAuth);
    if (patch.patchAvailable !== undefined) add('patch_available', patch.patchAvailable);
    if (patch.title !== undefined) add('title', patch.title);
    if (patch.summary !== undefined) add('summary', patch.summary);
    if (patch.remediation !== undefined) add('remediation', patch.remediation);
    if (patch.references !== undefined) add('references', patch.references, 'text[]');
    if (patch.scope !== undefined) add('scope', JSON.stringify(patch.scope), 'jsonb');
    if (patch.lastSavedAt !== undefined) add('last_saved_at', patch.lastSavedAt);

    await this.executor.unsafe(
      `update advisories set ${sets.join(', ')} where id = $1::uuid`,
      values,
    );
  }

  async listAdmin(filters: AdvisoryListFilters): Promise<{ rows: AdvisoryRow[]; total: number }> {
    const values: unknown[] = [];
    const clauses: string[] = [];
    if (filters.status !== undefined) {
      values.push(filters.status);
      clauses.push(`a.status::text = $${values.length}`);
    }
    if (filters.severity !== undefined) {
      values.push(filters.severity);
      clauses.push(`a.severity::text = $${values.length}`);
    }
    if (filters.q !== undefined && filters.q !== '') {
      values.push(`%${filters.q}%`);
      clauses.push(`(a.cve_id ilike $${values.length} or coalesce(a.title, '') ilike $${values.length}
                    or coalesce(a.vendor, '') ilike $${values.length})`);
    }
    const where = clauses.length === 0 ? 'true' : clauses.join(' and ');

    const totalRows = await this.executor.unsafe<Array<{ count: string }>>(
      `select count(*)::text as count ${ADVISORY_FROM} where ${where}`,
      values,
    );
    const offset = (filters.page - 1) * filters.pageSize;
    const rows = await this.executor.unsafe<SqlAdvisoryRow[]>(
      `select ${ADVISORY_COLUMNS} ${ADVISORY_FROM}
        where ${where}
        order by a.published_at desc nulls last, a.updated_at desc
        limit $${values.length + 1} offset $${values.length + 2}`,
      [...values, filters.pageSize, offset],
    );
    return { rows: rows.map(mapAdvisory), total: Number(totalRows[0]?.count ?? '0') };
  }

  async listDrafts(): Promise<AdvisoryRow[]> {
    const rows = await this.executor.unsafe<SqlAdvisoryRow[]>(
      `select ${ADVISORY_COLUMNS} ${ADVISORY_FROM}
        where a.status = 'draft'
        order by a.last_saved_at desc nulls last`,
    );
    return rows.map(mapAdvisory);
  }

  async summary(bounds: { startOfMonth: Date }): Promise<AdvisorySummaryCounts> {
    const rows = await this.executor.unsafe<Array<Record<string, string | number>>>(
      `select
         count(*) filter (where a.status = 'published' and a.retracted_at is null)::text as active_zero_days,
         count(*) filter (where a.status = 'published' and a.retracted_at is null
                          and a.severity = 'critical')::text as critical_severity,
         count(*) filter (where a.status = 'published' and a.retracted_at is null
                          and a.severity = 'critical' and a.patch_status <> 'patched')::text as unpatched_critical,
         count(*) filter (where a.status = 'published' and a.retracted_at is null
                          and a.weaponized)::text as weaponized_in_wild,
         count(*) filter (where a.status = 'published')::text as advisories_published,
         count(*) filter (where a.status = 'draft')::text as open_drafts,
         count(*) filter (where a.status = 'draft' and ci.status in ('pending_review','in_review'))::text as escalated_drafts
       from advisories a
       left join content_items ci on ci.id = a.content_item_id`,
    );
    const broadcasts = await this.executor.unsafe<Array<{ count: string }>>(
      `select count(*)::text as count from advisory_broadcasts
        where kind = 'initial' and created_at >= $1`,
      [bounds.startOfMonth],
    );
    const row = rows[0] ?? {};
    return {
      activeZeroDays: Number(row.active_zero_days ?? 0),
      criticalSeverity: Number(row.critical_severity ?? 0),
      unpatchedCritical: Number(row.unpatched_critical ?? 0),
      weaponizedInWild: Number(row.weaponized_in_wild ?? 0),
      advisoriesPublished: Number(row.advisories_published ?? 0),
      broadcastThisMonth: Number(broadcasts[0]?.count ?? 0),
      openDrafts: Number(row.open_drafts ?? 0),
      escalatedDrafts: Number(row.escalated_drafts ?? 0),
    };
  }

  async markPublished(advisoryId: string, at: Date): Promise<void> {
    await this.executor.unsafe(
      `update advisories
          set status = 'published', published_at = $2, updated_at = now()
        where id = $1::uuid`,
      [advisoryId, at],
    );
  }

  async insertBroadcast(input: NewBroadcast): Promise<BroadcastRow> {
    await this.executor.unsafe(
      `insert into advisory_broadcasts
         (id, advisory_id, kind, status, triggered_by, ack, audience_dashboards, email_contacts,
          sms_contacts, queue_job_id)
       values ($1::uuid, $2::uuid, $3::broadcast_kind, 'queued', $4::uuid, $5::jsonb, $6, $7, $8, $9)`,
      [
        input.id,
        input.advisoryId,
        input.kind,
        input.triggeredBy,
        JSON.stringify(input.ack),
        input.audienceDashboards,
        input.emailContacts,
        input.smsContacts,
        input.queueJobId,
      ],
    );
    const rows = await this.executor.unsafe<SqlBroadcastRow[]>(
      `select ${BROADCAST_COLUMNS} ${BROADCAST_FROM} where b.id = $1::uuid limit 1`,
      [input.id],
    );
    const row = rows[0];
    if (row === undefined) throw new Error('broadcast was not created');
    return mapBroadcast(row);
  }

  async setBroadcastAuditSeq(broadcastId: string, seq: number): Promise<void> {
    await this.executor.unsafe(
      `update advisory_broadcasts set audit_seq = $2 where id = $1::uuid`,
      [broadcastId, seq],
    );
  }

  async listBroadcasts(advisoryId: string): Promise<BroadcastRow[]> {
    const rows = await this.executor.unsafe<SqlBroadcastRow[]>(
      `select ${BROADCAST_COLUMNS} ${BROADCAST_FROM}
        where b.advisory_id = $1::uuid
        order by b.created_at desc`,
      [advisoryId],
    );
    return rows.map(mapBroadcast);
  }

  async firstBroadcastAt(advisoryId: string): Promise<string | null> {
    const rows = await this.executor.unsafe<Array<{ first_at: Date | string | null }>>(
      `select min(created_at) as first_at from advisory_broadcasts
        where advisory_id = $1::uuid and kind = 'initial'`,
      [advisoryId],
    );
    return iso(rows[0]?.first_at ?? null);
  }

  async lastBroadcastAt(advisoryId: string): Promise<string | null> {
    const rows = await this.executor.unsafe<Array<{ last_at: Date | string | null }>>(
      `select max(created_at) as last_at from advisory_broadcasts where advisory_id = $1::uuid`,
      [advisoryId],
    );
    return iso(rows[0]?.last_at ?? null);
  }

  async retract(advisoryId: string, at: Date, note: string): Promise<void> {
    await this.executor.unsafe(
      `update advisories
          set status = 'retracted', retracted_at = $2, retraction_note = $3, updated_at = now()
        where id = $1::uuid`,
      [advisoryId, at, note],
    );
  }

  async setPatchStatus(advisoryId: string, patchStatus: string): Promise<void> {
    await this.executor.unsafe(
      `update advisories set patch_status = $2::advisory_patch_status, updated_at = now()
        where id = $1::uuid`,
      [advisoryId, patchStatus],
    );
  }

  async listForClient(orgId: string): Promise<ClientAdvisoryRow[]> {
    // Published and not retracted: a client never sees a draft, an author id, or
    // anything about how a broadcast was delivered.
    const rows = await this.executor.unsafe<
      Array<{
        id: string;
        cve_id: string;
        title: string | null;
        severity: string | null;
        scope: AdvisoryScopeEntry[] | null;
        summary: string | null;
        remediation: string | null;
        references: string[] | null;
        patch_status: string;
        published_at: Date | string;
        acknowledged: boolean;
      }>
    >(
      `select a.id::text as id, a.cve_id, a.title, a.severity::text as severity, a.scope,
              a.summary, a.remediation, a.references, a.patch_status::text as patch_status,
              a.published_at,
              exists (select 1 from advisory_acknowledgements ak
                       where ak.advisory_id = a.id and ak.org_id = $1::uuid) as acknowledged
         from advisories a
        where a.status = 'published' and a.retracted_at is null
        order by a.published_at desc`,
      [orgId],
    );
    return rows.flatMap((row) =>
      row.title === null ||
      row.severity === null ||
      row.summary === null ||
      row.remediation === null
        ? []
        : [
            {
              id: row.id,
              cveId: row.cve_id,
              title: row.title,
              severity: row.severity,
              scope: row.scope ?? [],
              summary: row.summary,
              remediation: row.remediation,
              references: row.references ?? [],
              patchStatus: row.patch_status,
              publishedAt: new Date(row.published_at).toISOString(),
              acknowledged: row.acknowledged,
            },
          ],
    );
  }

  async acknowledge(
    advisoryId: string,
    orgId: string,
    userId: string | null,
    at: Date,
  ): Promise<void> {
    // Idempotent: acknowledging twice is one acknowledgement.
    await this.executor.unsafe(
      `insert into advisory_acknowledgements (advisory_id, org_id, user_id, acknowledged_at)
       values ($1::uuid, $2::uuid, $3::uuid, $4)
       on conflict (advisory_id, org_id) do update set acknowledged_at = excluded.acknowledged_at`,
      [advisoryId, orgId, userId, at],
    );
  }

  async assets(): Promise<ClientAsset[]> {
    const rows = await this.executor.unsafe<
      Array<{
        org_id: string;
        category: string;
        product: string;
        version: string | null;
        host: string | null;
      }>
    >(
      `select org_id::text as org_id, category::text as category, product, version, host
         from client_assets`,
    );
    return rows.map((row) => ({
      orgId: row.org_id,
      category: row.category,
      product: row.product,
      version: row.version,
      host: row.host,
    }));
  }

  async contactsFor(
    orgIds: readonly string[],
  ): Promise<{ emailContacts: number; smsContacts: number }> {
    if (orgIds.length === 0) return { emailContacts: 0, smsContacts: 0 };
    const rows = await this.executor.unsafe<Array<{ emails: string; sms: string }>>(
      `select count(*) filter (where p.email is not null)::text as emails,
              count(*) filter (where p.phone is not null and np.sms)::text as sms
         from profiles p
         left join notification_preferences np
           on np.user_id = p.id and np.event = 'advisory_broadcast'
        where p.org_id = any($1::uuid[])
          and p.account_status = 'active' and p.deleted_at is null`,
      [[...orgIds]],
    );
    return {
      emailContacts: Number(rows[0]?.emails ?? 0),
      smsContacts: Number(rows[0]?.sms ?? 0),
    };
  }

  async orgsWithAcknowledgementSince(since: Date): Promise<number> {
    const rows = await this.executor.unsafe<Array<{ count: string }>>(
      `select count(distinct org_id)::text as count from advisory_acknowledgements
        where acknowledged_at >= $1`,
      [since],
    );
    return Number(rows[0]?.count ?? 0);
  }

  async orgsCreatedSince(since: Date): Promise<number> {
    const rows = await this.executor.unsafe<Array<{ count: string }>>(
      `select count(*)::text as count from organizations where created_at >= $1`,
      [since],
    );
    return Number(rows[0]?.count ?? 0);
  }
}

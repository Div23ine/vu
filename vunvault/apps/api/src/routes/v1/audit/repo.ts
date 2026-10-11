import type { AuditCategory, AuditSeverity } from '@vunvault/contracts';
import type { AuditEntryView } from '../../../audit/service';
import { asExecutor, type SqlExecutor } from '../../../audit/repo';

/**
 * Audit READ queries (Task 39).
 *
 * There is no write in this module except the verification checkpoint, which is a
 * record OF a verification and not a change to the chain. No UPDATE and no DELETE
 * of `audit_entries` exists here or anywhere else in the API, and the database
 * refuses both (`packages/db/sql/0018_audit_chain.sql`).
 *
 * The list projection is explicit: `details`, `sealed_details`, `nonce`,
 * `signature` and `key_id` are never selected, so they cannot leak through a view
 * that someone widens later.
 */

/** The columns a reader is allowed to see, in the order the view declares them. */
const VIEW_COLUMNS = `
  seq, id::text as id, category::text as category, event_type, severity::text as severity,
  sev_level, actor_label, message, ip::text as ip, subject, hash, prev_hash, created_at`;

export interface AuditReadFilters {
  page: number;
  pageSize: number;
  q?: string;
  category?: AuditCategory;
  severity?: AuditSeverity;
  /** Exact match on `actor_label`. */
  actor?: string;
  since: Date;
}

export interface CheckpointRow {
  verifiedAt: string;
  fromSeq: number;
  toSeq: number;
  entries: number;
  mismatches: number;
  headHash: string;
  verifiedBy: string;
}

export interface SummaryCounts {
  events24h: number;
  authAttempts: number;
  failedAuth: number;
  lockedOut: number;
  scanCompletions: number;
  reportReleases: number;
}

export interface ChainHead {
  totalEntries: number;
  headHash: string | null;
  /** `YYYY-MM-DD` of the genesis entry. */
  genesisDate: string | null;
}

export interface AuditReadRepo {
  list(filters: AuditReadFilters): Promise<{ rows: AuditEntryView[]; total: number }>;
  counts(since: Date): Promise<SummaryCounts>;
  head(): Promise<ChainHead>;
  latestCheckpoint(): Promise<CheckpointRow | null>;
  insertCheckpoint(input: {
    verifiedAt: Date;
    fromSeq: number;
    toSeq: number;
    entries: number;
    mismatches: number;
    headHash: string;
    verifiedBy: string;
  }): Promise<void>;
  /** Replay for a reconnecting stream: everything after `afterSeq`, oldest first. */
  sinceSeq(afterSeq: number, limit: number): Promise<AuditEntryView[]>;
  /** One cursor batch for the CSV export. */
  exportBatch(
    filters: AuditReadFilters,
    afterSeq: number,
    limit: number,
  ): Promise<AuditEntryView[]>;
}

interface SqlViewRow {
  seq: string | number;
  id: string;
  category: string;
  event_type: string;
  severity: string;
  sev_level: number | null;
  actor_label: string;
  message: string;
  ip: string | null;
  subject: string | null;
  hash: string;
  prev_hash: string;
  created_at: Date | string;
}

function mapView(row: SqlViewRow): AuditEntryView {
  return {
    seq: Number(row.seq),
    id: row.id,
    category: row.category as AuditEntryView['category'],
    eventType: row.event_type,
    severity: row.severity as AuditEntryView['severity'],
    sevLevel: row.sev_level as AuditEntryView['sevLevel'],
    actorLabel: row.actor_label,
    message: row.message,
    ip: row.ip,
    subject: row.subject,
    hash: row.hash,
    prevHash: row.prev_hash,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export class SqlAuditReadRepo implements AuditReadRepo {
  private readonly executor: SqlExecutor;

  constructor(connection: unknown) {
    this.executor = asExecutor(connection);
  }

  private where(filters: AuditReadFilters): { clause: string; values: unknown[] } {
    const values: unknown[] = [filters.since];
    const clauses = ['created_at >= $1'];
    const add = (sql: string, value: unknown, cast?: string): void => {
      values.push(value);
      clauses.push(sql.replace('?', `$${values.length}${cast === undefined ? '' : `::${cast}`}`));
    };

    if (filters.category !== undefined) add('category = ?', filters.category, 'audit_category');
    if (filters.severity !== undefined) add('severity = ?', filters.severity, 'audit_severity');
    if (filters.actor !== undefined) add('actor_label = ?', filters.actor);
    if (filters.q !== undefined && filters.q !== '') {
      values.push(`%${filters.q}%`);
      const like = `$${values.length}`;
      clauses.push(
        `(message ilike ${like} or coalesce(subject, '') ilike ${like}
          or actor_label ilike ${like} or event_type ilike ${like})`,
      );
    }
    return { clause: clauses.join(' and '), values };
  }

  async list(filters: AuditReadFilters): Promise<{ rows: AuditEntryView[]; total: number }> {
    const { clause, values } = this.where(filters);
    const totals = await this.executor.unsafe<Array<{ count: string }>>(
      `select count(*)::text as count from audit_entries where ${clause}`,
      values,
    );
    const offset = (filters.page - 1) * filters.pageSize;
    const rows = await this.executor.unsafe<SqlViewRow[]>(
      `select ${VIEW_COLUMNS} from audit_entries
        where ${clause}
        order by seq desc
        limit $${values.length + 1} offset $${values.length + 2}`,
      [...values, filters.pageSize, offset],
    );
    return { rows: rows.map(mapView), total: Number(totals[0]?.count ?? '0') };
  }

  async counts(since: Date): Promise<SummaryCounts> {
    const rows = await this.executor.unsafe<Array<Record<string, string | number>>>(
      `select
         count(*)::text as events_24h,
         count(*) filter (where event_type in ('AUTH_SUCCESS','AUTH_FAILURE','AUTH_MFA_FAILURE'))::text as auth_attempts,
         count(*) filter (where event_type in ('AUTH_FAILURE','AUTH_MFA_FAILURE'))::text as failed_auth,
         count(*) filter (where event_type = 'AUTH_RATE_LIMIT')::text as locked_out,
         count(*) filter (where event_type = 'SCAN_COMPLETE')::text as scan_completions,
         count(*) filter (where event_type = 'REPORT_RELEASED')::text as report_releases
       from audit_entries
      where created_at >= $1`,
      [since],
    );
    const row = rows[0] ?? {};
    return {
      events24h: Number(row.events_24h ?? 0),
      authAttempts: Number(row.auth_attempts ?? 0),
      failedAuth: Number(row.failed_auth ?? 0),
      lockedOut: Number(row.locked_out ?? 0),
      scanCompletions: Number(row.scan_completions ?? 0),
      reportReleases: Number(row.report_releases ?? 0),
    };
  }

  async head(): Promise<ChainHead> {
    const rows = await this.executor.unsafe<
      Array<{
        max_seq: string | number | null;
        head_hash: string | null;
        genesis: Date | string | null;
      }>
    >(
      `select
         (select max(seq) from audit_entries)::text as max_seq,
         (select hash from audit_entries order by seq desc limit 1) as head_hash,
         (select created_at from audit_entries where seq = 1 limit 1) as genesis`,
    );
    const row = rows[0];
    return {
      totalEntries: Number(row?.max_seq ?? 0),
      headHash: row?.head_hash ?? null,
      genesisDate:
        row?.genesis === null || row?.genesis === undefined
          ? null
          : new Date(row.genesis).toISOString().slice(0, 10),
    };
  }

  async latestCheckpoint(): Promise<CheckpointRow | null> {
    const rows = await this.executor.unsafe<
      Array<{
        verified_at: Date | string;
        from_seq: string | number;
        to_seq: string | number;
        entries: string | number;
        mismatches: number;
        head_hash: string;
        verified_by: string;
      }>
    >(
      `select verified_at, from_seq::text as from_seq, to_seq::text as to_seq,
              entries::text as entries, mismatches, head_hash, verified_by
         from audit_checkpoints
        order by verified_at desc
        limit 1`,
    );
    const row = rows[0];
    if (row === undefined) return null;
    return {
      verifiedAt: new Date(row.verified_at).toISOString(),
      fromSeq: Number(row.from_seq),
      toSeq: Number(row.to_seq),
      entries: Number(row.entries),
      mismatches: Number(row.mismatches),
      headHash: row.head_hash,
      verifiedBy: row.verified_by,
    };
  }

  async insertCheckpoint(input: {
    verifiedAt: Date;
    fromSeq: number;
    toSeq: number;
    entries: number;
    mismatches: number;
    headHash: string;
    verifiedBy: string;
  }): Promise<void> {
    await this.executor.unsafe(
      `insert into audit_checkpoints
         (verified_at, from_seq, to_seq, entries, mismatches, head_hash, verified_by)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        input.verifiedAt,
        input.fromSeq,
        input.toSeq,
        input.entries,
        input.mismatches,
        input.headHash,
        input.verifiedBy,
      ],
    );
  }

  async sinceSeq(afterSeq: number, limit: number): Promise<AuditEntryView[]> {
    const rows = await this.executor.unsafe<SqlViewRow[]>(
      `select ${VIEW_COLUMNS} from audit_entries
        where seq > $1
        order by seq asc
        limit $2`,
      [afterSeq, limit],
    );
    return rows.map(mapView);
  }

  async exportBatch(
    filters: AuditReadFilters,
    afterSeq: number,
    limit: number,
  ): Promise<AuditEntryView[]> {
    const { clause, values } = this.where(filters);
    const rows = await this.executor.unsafe<SqlViewRow[]>(
      `select ${VIEW_COLUMNS} from audit_entries
        where ${clause} and seq > $${values.length + 1}
        order by seq asc
        limit $${values.length + 2}`,
      [...values, afterSeq, limit],
    );
    return rows.map(mapView);
  }
}

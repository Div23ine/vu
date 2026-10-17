import type { AuditCategory, AuditSeverity } from '@vunvault/contracts';

/**
 * Audit storage.
 *
 * Read-only plus one INSERT: there is deliberately no UPDATE and no DELETE
 * anywhere in this module, and the database refuses both
 * (`packages/db/sql/0018_audit_chain.sql`).
 */

/** The narrow driver surface — a connection or a transaction both satisfy it. */
export interface SqlExecutor {
  unsafe: <T = unknown>(query: string, params?: unknown[]) => Promise<T>;
}

/**
 * Extract a driver executor from a Drizzle connection or transaction.
 *
 * Drizzle's postgres-js wrapper hides the raw `Sql` under different keys
 * depending on what you hand us:
 *
 *   1. a raw `postgres` client                          → `value.unsafe`
 *   2. the top-level `drizzle(client)` database         → `value.$client.unsafe`
 *   3. a `PostgresJsTransaction` (`db.transaction(tx)`) → `value.session.client.unsafe`
 *   4. anything that just exposes `client.unsafe`       → `value.client.unsafe`
 */
export function asExecutor(value: unknown): SqlExecutor {
  const candidate = value as {
    unsafe?: unknown;
    $client?: { unsafe?: unknown };
    client?: { unsafe?: unknown };
    session?: { client?: { unsafe?: unknown } };
  };

  if (typeof candidate?.unsafe === 'function') {
    return {
      unsafe: (candidate.unsafe as SqlExecutor['unsafe']).bind(value),
    };
  }

  const topClient = candidate?.$client;
  if (topClient !== undefined && typeof topClient.unsafe === 'function') {
    return {
      unsafe: (topClient.unsafe as SqlExecutor['unsafe']).bind(topClient),
    };
  }

  const midClient = candidate?.client;
  if (midClient !== undefined && typeof midClient.unsafe === 'function') {
    return {
      unsafe: (midClient.unsafe as SqlExecutor['unsafe']).bind(midClient),
    };
  }

  const sessionClient = candidate?.session?.client;
  if (sessionClient !== undefined && typeof sessionClient.unsafe === 'function') {
    return {
      unsafe: (sessionClient.unsafe as SqlExecutor['unsafe']).bind(sessionClient),
    };
  }

  throw new Error('no SQL executor available on this connection');
}

export interface AuditEntryRow {
  seq: number;
  id: string;
  category: AuditCategory;
  eventType: string;
  severity: AuditSeverity;
  sevLevel: 1 | 2 | 3 | null;
  actorId: string | null;
  actorLabel: string;
  ip: string | null;
  subject: string | null;
  message: string;
  details: Record<string, unknown>;
  sealedDetails: Buffer | null;
  nonce: Buffer | null;
  prevHash: string;
  hash: string;
  signature: string;
  keyId: string;
  createdAt: Date;
}

export interface AuditEntryInsert {
  id: string;
  category: AuditCategory;
  eventType: string;
  severity: AuditSeverity;
  sevLevel: 1 | 2 | 3 | null;
  actorId: string | null;
  actorLabel: string;
  ip: string | null;
  subject: string | null;
  message: string;
  details: Record<string, unknown>;
  sealedDetails: Buffer | null;
  nonce: Buffer | null;
  prevHash: string;
  hash: string;
  signature: string;
  keyId: string;
  createdAt: Date;
}

interface RawRow {
  seq: string | number;
  id: string;
  category: AuditCategory;
  event_type: string;
  severity: AuditSeverity;
  sev_level: number | null;
  actor_id: string | null;
  actor_label: string;
  ip: string | null;
  subject: string | null;
  message: string;
  details: Record<string, unknown> | string | null;
  sealed_details: Buffer | null;
  nonce: Buffer | null;
  prev_hash: string;
  hash: string;
  signature: string;
  key_id: string;
  created_at: Date | string;
}

const SELECT_COLUMNS = `
  seq, id::text as id, category::text as category, event_type, severity::text as severity,
  sev_level, actor_id::text as actor_id, actor_label, host(ip) as ip, subject, message,
  details, sealed_details, nonce, prev_hash, hash, signature, key_id, created_at
`;

function toRow(raw: RawRow): AuditEntryRow {
  const details =
    typeof raw.details === 'string'
      ? (JSON.parse(raw.details) as Record<string, unknown>)
      : (raw.details ?? {});
  return {
    seq: Number(raw.seq),
    id: raw.id,
    category: raw.category,
    eventType: raw.event_type,
    severity: raw.severity,
    sevLevel: raw.sev_level as 1 | 2 | 3 | null,
    actorId: raw.actor_id,
    actorLabel: raw.actor_label,
    ip: raw.ip,
    subject: raw.subject,
    message: raw.message,
    details,
    sealedDetails: raw.sealed_details,
    nonce: raw.nonce,
    prevHash: raw.prev_hash.trim(),
    hash: raw.hash.trim(),
    signature: raw.signature.trim(),
    keyId: raw.key_id,
    createdAt: new Date(raw.created_at),
  };
}

// CHANGED: `$18` now has an explicit `::timestamptz` cast. Without it, the
// server tells postgres-js the param is text (OID 25) and the driver tries
// Buffer.byteLength(new Date()) → ERR_INVALID_ARG_TYPE.
const INSERT_SQL = `
  insert into audit_entries (
    id, category, event_type, severity, sev_level, actor_id, actor_label, ip, subject,
    message, details, sealed_details, nonce, prev_hash, hash, signature, key_id, created_at
  ) values (
    $1::uuid, $2::audit_category, $3, $4::audit_severity, $5::smallint, $6::uuid, $7, $8::inet, $9,
    $10, $11::jsonb, $12::bytea, $13::bytea, $14, $15, $16, $17, $18::timestamptz
  ) returning seq
`;

export interface AuditRangeOptions {
  fromSeq?: number;
  toSeq?: number;
  limit?: number;
  offset?: number;
}

/** Verification batches; large enough to be efficient, small enough to stream. */
export const VERIFY_BATCH_SIZE = 1000;

export class AuditRepo {
  /** The current chain head, or `null` when the table is empty. */
  async head(executor: SqlExecutor): Promise<{ seq: number; hash: string } | null> {
    const rows = await executor.unsafe<Array<{ seq: string | number; hash: string }>>(
      'select seq, hash from audit_entries order by seq desc limit 1',
    );
    const row = rows[0];
    if (row === undefined) return null;
    return { seq: Number(row.seq), hash: String(row.hash).trim() };
  }

  /** The row immediately before `seq`, used to anchor a partial verification. */
  async predecessor(executor: SqlExecutor, seq: number): Promise<AuditEntryRow | null> {
    const rows = await executor.unsafe<RawRow[]>(
      `select ${SELECT_COLUMNS} from audit_entries where seq < $1 order by seq desc limit 1`,
      [seq],
    );
    const row = rows[0];
    return row === undefined ? null : toRow(row);
  }

  async insert(executor: SqlExecutor, entry: AuditEntryInsert): Promise<AuditEntryRow> {
    const rows = await executor.unsafe<Array<{ seq: string | number }>>(INSERT_SQL, [
      entry.id,
      entry.category,
      entry.eventType,
      entry.severity,
      entry.sevLevel,
      entry.actorId,
      entry.actorLabel,
      entry.ip,
      entry.subject,
      entry.message,
      JSON.stringify(entry.details),
      entry.sealedDetails,
      entry.nonce,
      entry.prevHash,
      entry.hash,
      entry.signature,
      entry.keyId,
      entry.createdAt.toISOString(),
    ]);
    const seq = Number(rows[0]?.seq ?? 0);
    return { ...entry, seq };
  }

  /** Entries in `seq` order, one batch at a time. */
  async batch(
    executor: SqlExecutor,
    options: { afterSeq: number; toSeq?: number; limit: number },
  ): Promise<AuditEntryRow[]> {
    const params: unknown[] = [options.afterSeq];
    let sql = `select ${SELECT_COLUMNS} from audit_entries where seq > $1`;
    if (options.toSeq !== undefined) {
      params.push(options.toSeq);
      sql += ` and seq <= $${params.length}`;
    }
    params.push(options.limit);
    sql += ` order by seq asc limit $${params.length}`;
    const rows = await executor.unsafe<RawRow[]>(sql, params);
    return rows.map(toRow);
  }
}

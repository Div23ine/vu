import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  uampCheckResults,
  uampIncidents,
  uampMonitors,
  type UampHeader,
  type UampResponseAssertion,
} from '@vunvault/db';
import type { SqlExecutor } from '../../../audit/repo.js';

export interface MonitorRow {
  id: string;
  orgId: string;
  createdBy: string | null;
  name: string;
  type: string;
  status: string;
  target: string;
  method: string | null;
  intervalSeconds: number;
  timeoutMs: number;
  locations: string[];
  headers: UampHeader[];
  requestBody: string | null;
  assertions: UampResponseAssertion | null;
  keyword: string | null;
  warnDaysBeforeExpiry: number | null;
  lastStatus: string | null;
  lastCheckedAt: Date | null;
  lastLatencyMs: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMonitorInput {
  orgId: string;
  createdBy: string;
  name: string;
  type: string;
  target: string;
  method?: string;
  intervalSeconds?: number;
  timeoutMs?: number;
  locations?: string[];
  headers?: UampHeader[];
  requestBody?: string;
  assertions?: UampResponseAssertion;
  keyword?: string;
  warnDaysBeforeExpiry?: number;
}

export interface ListMonitorsFilter {
  orgId: string;
  status?: string;
  type?: string;
  q?: string;
  page: number;
  pageSize: number;
}

export interface IncidentRow {
  id: string;
  orgId: string;
  monitorId: string;
  status: string;
  severity: string;
  title: string;
  summary: string | null;
  startedAt: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CheckResultRow {
  id: string;
  orgId: string;
  monitorId: string;
  status: string;
  httpStatus: number | null;
  latencyMs: number | null;
  location: string | null;
  errorMessage: string | null;
  responseSnippet: string | null;
  checkedAt: Date;
  createdAt: Date;
}

export interface ListIncidentsFilter {
  orgId: string;
  status?: string;
  severity?: string;
  monitorId?: string;
  page: number;
  pageSize: number;
}

export interface ListCheckResultsFilter {
  orgId: string;
  monitorId?: string;
  status?: string;
  page: number;
  pageSize: number;
}

export interface UampRepo {
  listMonitors(filter: ListMonitorsFilter): Promise<{ rows: MonitorRow[]; total: number }>;
  getMonitor(orgId: string, id: string): Promise<MonitorRow | null>;
  createMonitor(input: CreateMonitorInput): Promise<MonitorRow>;
  updateMonitor(
    orgId: string,
    id: string,
    patch: Partial<CreateMonitorInput> & { status?: string },
  ): Promise<MonitorRow | null>;
  softDeleteMonitor(orgId: string, id: string): Promise<boolean>;
  countActiveMonitors(orgId: string): Promise<number>;
  listIncidents(filter: ListIncidentsFilter): Promise<{ rows: IncidentRow[]; total: number }>;
  getIncident(orgId: string, id: string): Promise<IncidentRow | null>;
  updateIncident(
    orgId: string,
    id: string,
    patch: { status?: string; severity?: string; summary?: string; acknowledgedBy?: string; resolvedBy?: string },
  ): Promise<IncidentRow | null>;
  listCheckResults(filter: ListCheckResultsFilter): Promise<{ rows: CheckResultRow[]; total: number }>;
}

function mapMonitor(row: typeof uampMonitors.$inferSelect): MonitorRow {
  return {
    id: row.id,
    orgId: row.orgId,
    createdBy: row.createdBy,
    name: row.name,
    type: row.type,
    status: row.status,
    target: row.target,
    method: row.method,
    intervalSeconds: row.intervalSeconds,
    timeoutMs: row.timeoutMs,
    locations: row.locations ?? [],
    headers: (row.headers as UampHeader[]) ?? [],
    requestBody: row.requestBody,
    assertions: (row.assertions as UampResponseAssertion | null) ?? null,
    keyword: row.keyword,
    warnDaysBeforeExpiry: row.warnDaysBeforeExpiry,
    lastStatus: row.lastStatus,
    lastCheckedAt: row.lastCheckedAt,
    lastLatencyMs: row.lastLatencyMs,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class SqlUampRepo implements UampRepo {
  constructor(private readonly db: SqlExecutor) {}

  async listMonitors(filter: ListMonitorsFilter): Promise<{ rows: MonitorRow[]; total: number }> {
    const conditions = [eq(uampMonitors.orgId, filter.orgId), isNull(uampMonitors.deletedAt)];
    if (filter.status) conditions.push(eq(uampMonitors.status, filter.status as never));
    if (filter.type) conditions.push(eq(uampMonitors.type, filter.type as never));
    if (filter.q) {
      conditions.push(
        sql`(${uampMonitors.name} ilike ${'%' + filter.q + '%'} or ${uampMonitors.target} ilike ${'%' + filter.q + '%'})`,
      );
    }
    const where = and(...conditions);
    const offset = (filter.page - 1) * filter.pageSize;

    const [rows, totalRow] = await Promise.all([
      this.db
        .select()
        .from(uampMonitors)
        .where(where)
        .orderBy(desc(uampMonitors.createdAt))
        .limit(filter.pageSize)
        .offset(offset),
      this.db.select({ value: count() }).from(uampMonitors).where(where),
    ]);

    return {
      rows: rows.map(mapMonitor),
      total: Number(totalRow[0]?.value ?? 0),
    };
  }

  async getMonitor(orgId: string, id: string): Promise<MonitorRow | null> {
    const rows = await this.db
      .select()
      .from(uampMonitors)
      .where(
        and(eq(uampMonitors.id, id), eq(uampMonitors.orgId, orgId), isNull(uampMonitors.deletedAt)),
      )
      .limit(1);
    return rows[0] ? mapMonitor(rows[0]) : null;
  }

  async createMonitor(input: CreateMonitorInput): Promise<MonitorRow> {
    const [row] = await this.db
      .insert(uampMonitors)
      .values({
        orgId: input.orgId,
        createdBy: input.createdBy,
        name: input.name,
        type: input.type as never,
        target: input.target,
        method: (input.method as never) ?? 'GET',
        intervalSeconds: input.intervalSeconds ?? 300,
        timeoutMs: input.timeoutMs ?? 10_000,
        locations: input.locations ?? [],
        headers: input.headers ?? [],
        requestBody: input.requestBody,
        assertions: input.assertions,
        keyword: input.keyword,
        warnDaysBeforeExpiry: input.warnDaysBeforeExpiry,
      })
      .returning();
    return mapMonitor(row!);
  }

  async updateMonitor(
    orgId: string,
    id: string,
    patch: Partial<CreateMonitorInput> & { status?: string },
  ): Promise<MonitorRow | null> {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.name !== undefined) updates.name = patch.name;
    if (patch.type !== undefined) updates.type = patch.type;
    if (patch.target !== undefined) updates.target = patch.target;
    if (patch.method !== undefined) updates.method = patch.method;
    if (patch.intervalSeconds !== undefined) updates.intervalSeconds = patch.intervalSeconds;
    if (patch.timeoutMs !== undefined) updates.timeoutMs = patch.timeoutMs;
    if (patch.locations !== undefined) updates.locations = patch.locations;
    if (patch.headers !== undefined) updates.headers = patch.headers;
    if (patch.requestBody !== undefined) updates.requestBody = patch.requestBody;
    if (patch.assertions !== undefined) updates.assertions = patch.assertions;
    if (patch.keyword !== undefined) updates.keyword = patch.keyword;
    if (patch.warnDaysBeforeExpiry !== undefined)
      updates.warnDaysBeforeExpiry = patch.warnDaysBeforeExpiry;
    if (patch.status !== undefined) updates.status = patch.status;

    const rows = await this.db
      .update(uampMonitors)
      .set(updates)
      .where(
        and(eq(uampMonitors.id, id), eq(uampMonitors.orgId, orgId), isNull(uampMonitors.deletedAt)),
      )
      .returning();
    return rows[0] ? mapMonitor(rows[0]) : null;
  }

  async softDeleteMonitor(orgId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .update(uampMonitors)
      .set({ deletedAt: new Date(), status: 'disabled', updatedAt: new Date() })
      .where(
        and(eq(uampMonitors.id, id), eq(uampMonitors.orgId, orgId), isNull(uampMonitors.deletedAt)),
      )
      .returning({ id: uampMonitors.id });
    return rows.length > 0;
  }


  async listIncidents(filter: ListIncidentsFilter): Promise<{ rows: IncidentRow[]; total: number }> {
    const conditions = [eq(uampIncidents.orgId, filter.orgId)];
    if (filter.status) conditions.push(eq(uampIncidents.status, filter.status as never));
    if (filter.severity) conditions.push(eq(uampIncidents.severity, filter.severity as never));
    if (filter.monitorId) conditions.push(eq(uampIncidents.monitorId, filter.monitorId));
    const where = and(...conditions);
    const offset = (filter.page - 1) * filter.pageSize;
    const [rows, totalRow] = await Promise.all([
      this.db
        .select()
        .from(uampIncidents)
        .where(where)
        .orderBy(desc(uampIncidents.startedAt))
        .limit(filter.pageSize)
        .offset(offset),
      this.db.select({ value: count() }).from(uampIncidents).where(where),
    ]);
    return {
      rows: rows.map((r) => ({
        id: r.id,
        orgId: r.orgId,
        monitorId: r.monitorId,
        status: r.status,
        severity: r.severity,
        title: r.title,
        summary: r.summary,
        startedAt: r.startedAt,
        acknowledgedAt: r.acknowledgedAt,
        resolvedAt: r.resolvedAt,
        failureCount: r.failureCount,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      total: Number(totalRow[0]?.value ?? 0),
    };
  }

  async getIncident(orgId: string, id: string): Promise<IncidentRow | null> {
    const rows = await this.db
      .select()
      .from(uampIncidents)
      .where(and(eq(uampIncidents.id, id), eq(uampIncidents.orgId, orgId)))
      .limit(1);
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      orgId: r.orgId,
      monitorId: r.monitorId,
      status: r.status,
      severity: r.severity,
      title: r.title,
      summary: r.summary,
      startedAt: r.startedAt,
      acknowledgedAt: r.acknowledgedAt,
      resolvedAt: r.resolvedAt,
      failureCount: r.failureCount,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async updateIncident(
    orgId: string,
    id: string,
    patch: { status?: string; severity?: string; summary?: string; acknowledgedBy?: string; resolvedBy?: string },
  ): Promise<IncidentRow | null> {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.status !== undefined) {
      updates.status = patch.status;
      if (patch.status === 'acknowledged') {
        updates.acknowledgedAt = new Date();
        if (patch.acknowledgedBy) updates.acknowledgedBy = patch.acknowledgedBy;
      }
      if (patch.status === 'resolved' || patch.status === 'false_positive') {
        updates.resolvedAt = new Date();
        if (patch.resolvedBy) updates.resolvedBy = patch.resolvedBy;
      }
    }
    if (patch.severity !== undefined) updates.severity = patch.severity;
    if (patch.summary !== undefined) updates.summary = patch.summary;
    const rows = await this.db
      .update(uampIncidents)
      .set(updates)
      .where(and(eq(uampIncidents.id, id), eq(uampIncidents.orgId, orgId)))
      .returning();
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      orgId: r.orgId,
      monitorId: r.monitorId,
      status: r.status,
      severity: r.severity,
      title: r.title,
      summary: r.summary,
      startedAt: r.startedAt,
      acknowledgedAt: r.acknowledgedAt,
      resolvedAt: r.resolvedAt,
      failureCount: r.failureCount,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  async listCheckResults(filter: ListCheckResultsFilter): Promise<{ rows: CheckResultRow[]; total: number }> {
    const conditions = [eq(uampCheckResults.orgId, filter.orgId)];
    if (filter.monitorId) conditions.push(eq(uampCheckResults.monitorId, filter.monitorId));
    if (filter.status) conditions.push(eq(uampCheckResults.status, filter.status as never));
    const where = and(...conditions);
    const offset = (filter.page - 1) * filter.pageSize;
    const [rows, totalRow] = await Promise.all([
      this.db
        .select()
        .from(uampCheckResults)
        .where(where)
        .orderBy(desc(uampCheckResults.checkedAt))
        .limit(filter.pageSize)
        .offset(offset),
      this.db.select({ value: count() }).from(uampCheckResults).where(where),
    ]);
    return {
      rows: rows.map((r) => ({
        id: r.id,
        orgId: r.orgId,
        monitorId: r.monitorId,
        status: r.status,
        httpStatus: r.httpStatus,
        latencyMs: r.latencyMs,
        location: r.location,
        errorMessage: r.errorMessage,
        responseSnippet: r.responseSnippet,
        checkedAt: r.checkedAt,
        createdAt: r.createdAt,
      })),
      total: Number(totalRow[0]?.value ?? 0),
    };
  }

  async countActiveMonitors(orgId: string): Promise<number> {
    const rows = await this.db
      .select({ value: count() })
      .from(uampMonitors)
      .where(
        and(
          eq(uampMonitors.orgId, orgId),
          isNull(uampMonitors.deletedAt),
          sql`${uampMonitors.status} <> 'disabled'`,
        ),
      );
    return Number(rows[0]?.value ?? 0);
  }
}

// Re-export table refs so tests can import from one place if needed.
export { uampMonitors, uampCheckResults, uampIncidents };

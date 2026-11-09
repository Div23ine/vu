import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';
import {
  uampCheckResults,
  uampIncidents,
  uampMonitors,
  type Db,
} from '@vunvault/db';
import type { CheckOutcome } from '../domain/checker.js';

export interface DueMonitor {
  id: string;
  orgId: string;
  name: string;
  type: string;
  target: string;
  method: string | null;
  intervalSeconds: number;
  timeoutMs: number;
  headers: unknown;
  requestBody: string | null;
  assertions: unknown;
  keyword: string | null;
  lastStatus: string | null;
  warnDaysBeforeExpiry: number | null;
}

export class SqlUampWorkerRepo {
  constructor(private readonly db: Db) {}

  /** Monitors that are active and due for a check. */
  async findDueMonitors(limit = 50): Promise<DueMonitor[]> {
    const rows = await this.db
      .select({
        id: uampMonitors.id,
        orgId: uampMonitors.orgId,
        name: uampMonitors.name,
        type: uampMonitors.type,
        target: uampMonitors.target,
        method: uampMonitors.method,
        intervalSeconds: uampMonitors.intervalSeconds,
        timeoutMs: uampMonitors.timeoutMs,
        headers: uampMonitors.headers,
        requestBody: uampMonitors.requestBody,
        assertions: uampMonitors.assertions,
        keyword: uampMonitors.keyword,
        lastStatus: uampMonitors.lastStatus,
        warnDaysBeforeExpiry: uampMonitors.warnDaysBeforeExpiry,
      })
      .from(uampMonitors)
      .where(
        and(
          eq(uampMonitors.status, 'active'),
          isNull(uampMonitors.deletedAt),
          or(
            sql`${uampMonitors.lastCheckedAt} IS NULL`,
            sql`extract(epoch from (now() - ${uampMonitors.lastCheckedAt})) >= ${uampMonitors.intervalSeconds}`,
          ),
        ),
      )
      .limit(limit);
    return rows as DueMonitor[];
  }

  async getMonitor(monitorId: string, orgId: string): Promise<DueMonitor | null> {
    const rows = await this.db
      .select({
        id: uampMonitors.id,
        orgId: uampMonitors.orgId,
        name: uampMonitors.name,
        type: uampMonitors.type,
        target: uampMonitors.target,
        method: uampMonitors.method,
        intervalSeconds: uampMonitors.intervalSeconds,
        timeoutMs: uampMonitors.timeoutMs,
        headers: uampMonitors.headers,
        requestBody: uampMonitors.requestBody,
        assertions: uampMonitors.assertions,
        keyword: uampMonitors.keyword,
        lastStatus: uampMonitors.lastStatus,
      })
      .from(uampMonitors)
      .where(
        and(
          eq(uampMonitors.id, monitorId),
          eq(uampMonitors.orgId, orgId),
          isNull(uampMonitors.deletedAt),
        ),
      )
      .limit(1);
    return (rows[0] as DueMonitor | undefined) ?? null;
  }

  async recordResult(
    monitor: DueMonitor,
    outcome: CheckOutcome,
    location: string | null,
  ): Promise<void> {
    await this.db.insert(uampCheckResults).values({
      orgId: monitor.orgId,
      monitorId: monitor.id,
      status: outcome.status as never,
      httpStatus: outcome.httpStatus,
      latencyMs: outcome.latencyMs,
      location,
      errorMessage: outcome.errorMessage,
      responseSnippet: outcome.responseSnippet,
      checkedAt: new Date(),
    });

    await this.db
      .update(uampMonitors)
      .set({
        lastStatus: outcome.status as never,
        lastCheckedAt: new Date(),
        lastLatencyMs: outcome.latencyMs,
        updatedAt: new Date(),
      })
      .where(eq(uampMonitors.id, monitor.id));

    const isDown = outcome.status === 'down' || outcome.status === 'timeout' || outcome.status === 'error';
    if (isDown) {
      await this.openOrBumpIncident(monitor, outcome);
    } else if (outcome.status === 'up') {
      await this.resolveOpenIncidents(monitor);
    }
  }

  private async openOrBumpIncident(monitor: DueMonitor, outcome: CheckOutcome): Promise<void> {
    const open = await this.db
      .select({ id: uampIncidents.id, failureCount: uampIncidents.failureCount })
      .from(uampIncidents)
      .where(
        and(
          eq(uampIncidents.monitorId, monitor.id),
          eq(uampIncidents.orgId, monitor.orgId),
          sql`${uampIncidents.status} IN ('open', 'acknowledged', 'investigating')`,
        ),
      )
      .limit(1);

    if (open[0]) {
      await this.db
        .update(uampIncidents)
        .set({
          failureCount: open[0].failureCount + 1,
          updatedAt: new Date(),
          summary: outcome.errorMessage,
        })
        .where(eq(uampIncidents.id, open[0].id));
      return;
    }

    await this.db.insert(uampIncidents).values({
      orgId: monitor.orgId,
      monitorId: monitor.id,
      status: 'open',
      severity: outcome.status === 'timeout' ? 'major' : 'major',
      title: `${monitor.name} is ${outcome.status}`,
      summary: outcome.errorMessage,
      failureCount: 1,
    });
  }

  private async resolveOpenIncidents(monitor: DueMonitor): Promise<void> {
    await this.db
      .update(uampIncidents)
      .set({
        status: 'resolved',
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(uampIncidents.monitorId, monitor.id),
          eq(uampIncidents.orgId, monitor.orgId),
          sql`${uampIncidents.status} IN ('open', 'acknowledged', 'investigating')`,
        ),
      );
  }
}

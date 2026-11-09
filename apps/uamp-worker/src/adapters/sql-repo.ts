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
    checkKey: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const checkedAt = new Date();
      const inserted = await tx
        .insert(uampCheckResults)
        .values({
          orgId: monitor.orgId,
          monitorId: monitor.id,
          checkKey,
          status: outcome.status as never,
          httpStatus: outcome.httpStatus,
          latencyMs: outcome.latencyMs,
          location,
          errorMessage: outcome.errorMessage,
          responseSnippet: outcome.responseSnippet,
          checkedAt,
        })
        .onConflictDoNothing()
        .returning({ id: uampCheckResults.id });

      // BullMQ is at-least-once. A duplicate delivery with the same check key
      // must not duplicate history, increment incidents, or move monitor state.
      if (inserted.length === 0) return;

      await tx
        .update(uampMonitors)
        .set({
          lastStatus: outcome.status as never,
          lastCheckedAt: checkedAt,
          lastLatencyMs: outcome.latencyMs,
          updatedAt: checkedAt,
        })
        .where(and(eq(uampMonitors.id, monitor.id), eq(uampMonitors.orgId, monitor.orgId)));

      const isDown =
        outcome.status === 'down' || outcome.status === 'timeout' || outcome.status === 'error';
      if (isDown) {
        const open = await tx
          .select({ id: uampIncidents.id, failureCount: uampIncidents.failureCount })
          .from(uampIncidents)
          .where(
            and(
              eq(uampIncidents.monitorId, monitor.id),
              eq(uampIncidents.orgId, monitor.orgId),
              sql.raw("uamp_incidents.status IN ('open', 'acknowledged', 'investigating')"),
            ),
          )
          .limit(1);

        if (open[0]) {
          await tx
            .update(uampIncidents)
            .set({
              failureCount: open[0].failureCount + 1,
              updatedAt: checkedAt,
              summary: outcome.errorMessage,
            })
            .where(
              and(
                eq(uampIncidents.id, open[0].id),
                eq(uampIncidents.orgId, monitor.orgId),
              ),
            );
        } else {
          await tx.insert(uampIncidents).values({
            orgId: monitor.orgId,
            monitorId: monitor.id,
            status: 'open',
            severity: 'major',
            title: monitor.name + ' is ' + outcome.status,
            summary: outcome.errorMessage,
            failureCount: 1,
          });
        }
      } else if (outcome.status === 'up') {
        await tx
          .update(uampIncidents)
          .set({
            status: 'resolved',
            resolvedAt: checkedAt,
            updatedAt: checkedAt,
          })
          .where(
            and(
              eq(uampIncidents.monitorId, monitor.id),
              eq(uampIncidents.orgId, monitor.orgId),
              sql.raw("uamp_incidents.status IN ('open', 'acknowledged', 'investigating')"),
            ),
          );
      }
    });
  }
}

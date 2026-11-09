import { HttpError } from '../../../lib/http-error.js';
import {
  DEFAULT_UAMP_ENTITLEMENTS,
  entitlementsForPlan,
  type UampEntitlements,
} from './entitlements.js';

import type {
  AlertRuleRow,
  CheckResultRow,
  CreateAlertRuleInput,
  CreateMonitorInput,
  CreateStatusPageInput,
  IncidentRow,
  ListCheckResultsFilter,
  ListIncidentsFilter,
  ListMonitorsFilter,
  MonitorRow,
  StatusPageRow,
  UampRepo,
} from './repo.js';

/**
 * UAMP application service.
 *
 * Entitlement checks (monitor limits, interval floors) are applied here so the
 * route layer stays thin. Billing plan codes for UAMP are resolved via the
 * existing subscription system; limits are configurable and not hard-coded.
 */

export type { UampEntitlements };
export { DEFAULT_UAMP_ENTITLEMENTS };

export class UampService {
  constructor(
    private readonly repo: UampRepo,
    private readonly entitlements: UampEntitlements = DEFAULT_UAMP_ENTITLEMENTS,
  ) {}

  static fromPlanCode(repo: UampRepo, planCode: string | null | undefined): UampService {
    return new UampService(repo, entitlementsForPlan(planCode));
  }

  async listMonitors(filter: ListMonitorsFilter) {
    return this.repo.listMonitors(filter);
  }

  async getMonitor(orgId: string, id: string): Promise<MonitorRow> {
    const row = await this.repo.getMonitor(orgId, id);
    if (!row) throw new HttpError(404, 'not_found', 'Monitor not found');
    return row;
  }

  async createMonitor(input: CreateMonitorInput): Promise<MonitorRow> {
    const active = await this.repo.countActiveMonitors(input.orgId);
    if (active >= this.entitlements.maxMonitors) {
      throw new HttpError(
        402,
        'monitor_limit_reached',
        `Your plan allows at most ${this.entitlements.maxMonitors} active monitors`,
      );
    }
    const interval = input.intervalSeconds ?? 300;
    if (interval < this.entitlements.minIntervalSeconds) {
      throw new HttpError(
        402,
        'interval_not_allowed',
        `Your plan requires a minimum check interval of ${this.entitlements.minIntervalSeconds}s`,
      );
    }
    this.assertSafeTarget(input.target);
    return this.repo.createMonitor(input);
  }

  async updateMonitor(
    orgId: string,
    id: string,
    patch: Partial<CreateMonitorInput> & { status?: string },
  ): Promise<MonitorRow> {
    if (patch.target) this.assertSafeTarget(patch.target);
    if (
      patch.intervalSeconds !== undefined &&
      patch.intervalSeconds < this.entitlements.minIntervalSeconds
    ) {
      throw new HttpError(
        402,
        'interval_not_allowed',
        `Your plan requires a minimum check interval of ${this.entitlements.minIntervalSeconds}s`,
      );
    }
    const row = await this.repo.updateMonitor(orgId, id, patch);
    if (!row) throw new HttpError(404, 'not_found', 'Monitor not found');
    return row;
  }

  async deleteMonitor(orgId: string, id: string): Promise<void> {
    const ok = await this.repo.softDeleteMonitor(orgId, id);
    if (!ok) throw new HttpError(404, 'not_found', 'Monitor not found');
  }

  /**
   * Basic SSRF guard: block obvious private / loopback / link-local targets.
   * Workers apply a stricter network policy at check time.
   */

  async listIncidents(filter: ListIncidentsFilter) {
    return this.repo.listIncidents(filter);
  }

  async getIncident(orgId: string, id: string): Promise<IncidentRow> {
    const row = await this.repo.getIncident(orgId, id);
    if (!row) throw new HttpError(404, 'not_found', 'Incident not found');
    return row;
  }

  async updateIncident(
    orgId: string,
    id: string,
    actorId: string,
    patch: { status?: string; severity?: string; summary?: string },
  ): Promise<IncidentRow> {
    const extra: { acknowledgedBy?: string; resolvedBy?: string } = {};
    if (patch.status === 'acknowledged') extra.acknowledgedBy = actorId;
    if (patch.status === 'resolved' || patch.status === 'false_positive') extra.resolvedBy = actorId;
    const row = await this.repo.updateIncident(orgId, id, { ...patch, ...extra });
    if (!row) throw new HttpError(404, 'not_found', 'Incident not found');
    return row;
  }

  async listCheckResults(filter: ListCheckResultsFilter) {
    return this.repo.listCheckResults(filter);
  }


  async listStatusPages(orgId: string, page: number, pageSize: number) {
    return this.repo.listStatusPages(orgId, page, pageSize);
  }

  async getStatusPage(orgId: string, id: string): Promise<StatusPageRow> {
    const row = await this.repo.getStatusPage(orgId, id);
    if (!row) throw new HttpError(404, 'not_found', 'Status page not found');
    return row;
  }

  async createStatusPage(input: CreateStatusPageInput): Promise<StatusPageRow> {
    await this.assertOwnedMonitors(input.orgId, input.monitorIds ?? []);
    const count = await this.repo.countStatusPages(input.orgId);
    if (count >= this.entitlements.maxStatusPages) {
      throw new HttpError(
        402,
        'status_page_limit_reached',
        `Your plan allows at most ${this.entitlements.maxStatusPages} status pages`,
      );
    }
    return this.repo.createStatusPage(input);
  }

  async updateStatusPage(
    orgId: string,
    id: string,
    patch: Partial<CreateStatusPageInput> & { isActive?: boolean },
  ): Promise<StatusPageRow> {
    if (patch.monitorIds !== undefined) await this.assertOwnedMonitors(orgId, patch.monitorIds);
    const row = await this.repo.updateStatusPage(orgId, id, patch);
    if (!row) throw new HttpError(404, 'not_found', 'Status page not found');
    return row;
  }

  async deleteStatusPage(orgId: string, id: string): Promise<void> {
    const ok = await this.repo.deleteStatusPage(orgId, id);
    if (!ok) throw new HttpError(404, 'not_found', 'Status page not found');
  }

  async listAlertRules(orgId: string, monitorId?: string) {
    return this.repo.listAlertRules(orgId, monitorId);
  }

  async createAlertRule(input: CreateAlertRuleInput): Promise<AlertRuleRow> {
    if (input.monitorId) await this.assertOwnedMonitors(input.orgId, [input.monitorId]);
    return this.repo.createAlertRule(input);
  }

  async updateAlertRule(
    orgId: string,
    id: string,
    patch: Partial<CreateAlertRuleInput> & { enabled?: boolean },
  ): Promise<AlertRuleRow> {
    if (patch.monitorId) await this.assertOwnedMonitors(orgId, [patch.monitorId]);
    const row = await this.repo.updateAlertRule(orgId, id, patch);
    if (!row) throw new HttpError(404, 'not_found', 'Alert rule not found');
    return row;
  }

  async deleteAlertRule(orgId: string, id: string): Promise<void> {
    const ok = await this.repo.deleteAlertRule(orgId, id);
    if (!ok) throw new HttpError(404, 'not_found', 'Alert rule not found');
  }

  private async assertOwnedMonitors(orgId: string, monitorIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(monitorIds)];
    if (uniqueIds.length === 0) return;
    const ownedCount = await this.repo.countOwnedMonitors(orgId, uniqueIds);
    if (ownedCount !== uniqueIds.length) {
      throw new HttpError(404, 'not_found', 'One or more monitors were not found');
    }
  }

  private assertSafeTarget(target: string): void {
    let host: string;
    try {
      const url = target.includes('://') ? new URL(target) : new URL(`https://${target}`);
      host = url.hostname.toLowerCase();
    } catch {
      throw new HttpError(400, 'invalid_target', 'Target must be a valid URL or hostname');
    }
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      host.startsWith('169.254.') ||
      host.startsWith('0.')
    ) {
      throw new HttpError(400, 'private_target', 'Monitoring private or loopback targets is not allowed');
    }
  }
}

export function toWireMonitor(row: MonitorRow) {
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
    locations: row.locations,
    headers: row.headers,
    requestBody: row.requestBody,
    assertions: row.assertions,
    keyword: row.keyword,
    warnDaysBeforeExpiry: row.warnDaysBeforeExpiry,
    lastStatus: row.lastStatus,
    lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
    lastLatencyMs: row.lastLatencyMs,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toWireIncident(row: IncidentRow) {
  return {
    id: row.id,
    orgId: row.orgId,
    monitorId: row.monitorId,
    status: row.status,
    severity: row.severity,
    title: row.title,
    summary: row.summary,
    startedAt: row.startedAt.toISOString(),
    acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    failureCount: row.failureCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toWireCheckResult(row: CheckResultRow) {
  return {
    id: row.id,
    orgId: row.orgId,
    monitorId: row.monitorId,
    status: row.status,
    httpStatus: row.httpStatus,
    latencyMs: row.latencyMs,
    location: row.location,
    errorMessage: row.errorMessage,
    responseSnippet: row.responseSnippet,
    checkedAt: row.checkedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export function toWireStatusPage(row: StatusPageRow) {
  return {
    id: row.id,
    orgId: row.orgId,
    name: row.name,
    slug: row.slug,
    visibility: row.visibility,
    customDomain: row.customDomain,
    monitorIds: row.monitorIds,
    headline: row.headline,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toWireAlertRule(row: AlertRuleRow) {
  return {
    id: row.id,
    orgId: row.orgId,
    monitorId: row.monitorId,
    channel: row.channel,
    destination: row.destination,
    enabled: row.enabled,
    failureThreshold: row.failureThreshold,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

import { HttpError } from '../../../lib/http-error.js';
import type {
  CheckResultRow,
  CreateMonitorInput,
  IncidentRow,
  ListCheckResultsFilter,
  ListIncidentsFilter,
  ListMonitorsFilter,
  MonitorRow,
  UampRepo,
} from './repo.js';

/**
 * UAMP application service.
 *
 * Entitlement checks (monitor limits, interval floors) are applied here so the
 * route layer stays thin. Billing plan codes for UAMP are resolved via the
 * existing subscription system; limits are configurable and not hard-coded.
 */

export interface UampEntitlements {
  maxMonitors: number;
  minIntervalSeconds: number;
}

/** Default free-tier entitlements until billing wiring lands. */
export const DEFAULT_UAMP_ENTITLEMENTS: UampEntitlements = {
  maxMonitors: 5,
  minIntervalSeconds: 300,
};

export class UampService {
  constructor(
    private readonly repo: UampRepo,
    private readonly entitlements: UampEntitlements = DEFAULT_UAMP_ENTITLEMENTS,
  ) {}

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

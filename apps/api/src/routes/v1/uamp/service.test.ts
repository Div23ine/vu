import { describe, expect, it } from 'vitest';
import { HttpError } from '../../../lib/http-error.js';
import type { MonitorRow, UampRepo } from './repo.js';
import { UampService } from './service.js';
import { entitlementsForPlan } from './entitlements.js';

function baseMonitor(over: Partial<MonitorRow> = {}): MonitorRow {
  return {
    id: 'm1000000-0000-4000-8000-000000000001',
    orgId: 'o1000000-0000-4000-8000-000000000001',
    createdBy: null,
    name: 'Home',
    type: 'https',
    status: 'active',
    target: 'https://example.com',
    method: 'GET',
    intervalSeconds: 300,
    timeoutMs: 10000,
    locations: [],
    headers: [],
    requestBody: null,
    assertions: null,
    keyword: null,
    warnDaysBeforeExpiry: null,
    lastStatus: null,
    lastCheckedAt: null,
    lastLatencyMs: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

function mockRepo(over: Partial<UampRepo> = {}): UampRepo {
  return {
    listMonitors: async () => ({ rows: [], total: 0 }),
    getMonitor: async () => null,
    createMonitor: async (input) => baseMonitor({ name: input.name, target: input.target, orgId: input.orgId }),
    updateMonitor: async () => null,
    softDeleteMonitor: async () => false,
    countActiveMonitors: async () => 0,
    listIncidents: async () => ({ rows: [], total: 0 }),
    getIncident: async () => null,
    updateIncident: async () => null,
    listCheckResults: async () => ({ rows: [], total: 0 }),
    listStatusPages: async () => ({ rows: [], total: 0 }),
    getStatusPage: async () => null,
    createStatusPage: async (input) => ({
      id: 's1000000-0000-4000-8000-000000000001',
      orgId: input.orgId,
      name: input.name,
      slug: input.slug,
      visibility: input.visibility ?? 'public',
      customDomain: input.customDomain ?? null,
      monitorIds: input.monitorIds ?? [],
      headline: input.headline ?? null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    updateStatusPage: async () => null,
    deleteStatusPage: async () => false,
    countStatusPages: async () => 0,
    countOwnedMonitors: async (_orgId, monitorIds) => monitorIds.length,
    listAlertRules: async () => [],
    createAlertRule: async (input) => ({
      id: 'a1000000-0000-4000-8000-000000000001',
      orgId: input.orgId,
      monitorId: input.monitorId ?? null,
      channel: input.channel,
      destination: input.destination,
      enabled: input.enabled ?? true,
      failureThreshold: input.failureThreshold ?? 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    updateAlertRule: async () => null,
    deleteAlertRule: async () => false,
    ...over,
  };
}

describe('UampService entitlements', () => {
  it('rejects private targets', async () => {
    const svc = new UampService(mockRepo());
    await expect(
      svc.createMonitor({
        orgId: 'o1000000-0000-4000-8000-000000000001',
        createdBy: 'c1000000-0000-4000-8000-000000000001',
        name: 'Bad',
        type: 'http',
        target: 'http://127.0.0.1/admin',
      }),
    ).rejects.toMatchObject({ status: 400, code: 'private_target' });
  });

  it('enforces free-tier monitor limit', async () => {
    const svc = new UampService(mockRepo({ countActiveMonitors: async () => 5 }));
    await expect(
      svc.createMonitor({
        orgId: 'o1000000-0000-4000-8000-000000000001',
        createdBy: 'c1000000-0000-4000-8000-000000000001',
        name: 'Sixth',
        type: 'https',
        target: 'https://example.com',
      }),
    ).rejects.toMatchObject({ status: 402, code: 'monitor_limit_reached' });
  });

  it('enforces min interval from plan', async () => {
    const svc = UampService.fromPlanCode(mockRepo(), 'uamp_free');
    await expect(
      svc.createMonitor({
        orgId: 'o1000000-0000-4000-8000-000000000001',
        createdBy: 'c1000000-0000-4000-8000-000000000001',
        name: 'Fast',
        type: 'https',
        target: 'https://example.com',
        intervalSeconds: 30,
      }),
    ).rejects.toMatchObject({ status: 402, code: 'interval_not_allowed' });
  });

  it('allows starter plan shorter interval', async () => {
    const created: unknown[] = [];
    const svc = UampService.fromPlanCode(
      mockRepo({
        createMonitor: async (input) => {
          created.push(input);
          return baseMonitor({ intervalSeconds: input.intervalSeconds ?? 60 });
        },
      }),
      'uamp_starter',
    );
    const row = await svc.createMonitor({
      orgId: 'o1000000-0000-4000-8000-000000000001',
      createdBy: 'c1000000-0000-4000-8000-000000000001',
      name: 'Fast',
      type: 'https',
      target: 'https://example.com',
      intervalSeconds: 60,
    });
    expect(row.intervalSeconds).toBe(60);
    expect(created).toHaveLength(1);
  });

  it('enforces status page limit', async () => {
    const svc = new UampService(mockRepo({ countStatusPages: async () => 1 }));
    await expect(
      svc.createStatusPage({
        orgId: 'o1000000-0000-4000-8000-000000000001',
        name: 'Public',
        slug: 'public',
      }),
    ).rejects.toMatchObject({ status: 402, code: 'status_page_limit_reached' });
  });

  it('rejects status pages that reference another organisation\'s monitors', async () => {
    const svc = new UampService(mockRepo({ countOwnedMonitors: async () => 0 }));
    await expect(
      svc.createStatusPage({
        orgId: 'o1000000-0000-4000-8000-000000000001',
        name: 'Public',
        slug: 'public',
        monitorIds: ['m2000000-0000-4000-8000-000000000001'],
      }),
    ).rejects.toMatchObject({ status: 404, code: 'not_found' });
  });

  it('rejects alert rules attached to another organisation\'s monitors', async () => {
    const svc = new UampService(mockRepo({ countOwnedMonitors: async () => 0 }));
    await expect(
      svc.createAlertRule({
        orgId: 'o1000000-0000-4000-8000-000000000001',
        monitorId: 'm2000000-0000-4000-8000-000000000001',
        channel: 'email',
        destination: 'ops@example.com',
      }),
    ).rejects.toMatchObject({ status: 404, code: 'not_found' });
  });
});

describe('entitlementsForPlan', () => {
  it('defaults unknown plans to free', () => {
    expect(entitlementsForPlan(null).planCode).toBe('uamp_free');
    expect(entitlementsForPlan('nope').maxMonitors).toBe(5);
  });

  it('returns agency limits', () => {
    const e = entitlementsForPlan('uamp_agency');
    expect(e.maxMonitors).toBe(2000);
    expect(e.minIntervalSeconds).toBe(30);
  });
});

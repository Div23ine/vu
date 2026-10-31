import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it } from 'vitest';
import type { UserRole } from '@vunvault/contracts';
import { ROLE_PERMISSIONS } from '@vunvault/contracts';
import type { Env } from '../../../config/env.js';
import errorHandler from '../../../plugins/error-handler.js';
import type { AuthUser } from '../../../plugins/auth.js';
import { HttpError } from '../../../lib/http-error.js';
import dashboardRoutes from './index.js';
import { memoryCache } from './cache.js';
import {
  boundsFor,
  changePerDayPercent,
  DashboardService,
  formatUsdWhole,
  largestRemainderShares,
  periodLabel,
  trailingWeekdays,
} from './service.js';
import type {
  DashboardRepo,
  DateBounds,
  KpiRaw,
  NodesRaw,
  PipelineRaw,
  RevenueRaw,
  ThreatSnapshotRow,
  TrafficRaw,
  TransactionRow,
} from './repo.js';

/**
 * The Command Center.
 *
 * The interesting assertions are the arithmetic ones — shares that sum to 100, a
 * quarter-on-quarter change normalised per day, revenue net of refunds — and the
 * cache, because a panel that never refreshes is a panel nobody trusts.
 */

const STAFF_ID = 'c1000000-0000-4000-8000-00000000ad01';
const NOW = new Date('2026-10-06T14:30:00.000Z');

const TEST_ENV: Env = {
  NODE_ENV: 'test',
  PORT: 8080,
  LOG_LEVEL: 'fatal',
  WEB_ORIGIN: 'https://www.vunvault.test',
  COOKIE_DOMAIN: '',
  API_PUBLIC_URL: 'https://api.vunvault.test',
  SECRETS_PROVIDER: 'env',
  SUPABASE_URL: 'https://project.supabase.co',
  WEBAUTHN_RP_ID: 'vunvault.test',
  WEBAUTHN_RP_NAME: 'VUNVAULT',
  R2_ACCOUNT_ID: 'r2-account',
  R2_BUCKET: 'vunvault-media',
  R2_PUBLIC_BASE_URL: 'https://cdn.vunvault.test',
  SENTRY_DSN: undefined,
  OCI_SECRET_MAP: undefined,
};

// --------------------------------------------------------------------- fakes

class FakeDashboardRepo implements DashboardRepo {
  calls: string[] = [];
  kpiFixture: KpiRaw = {
    totalPaidClients: 48,
    newPaidClientsThisMonth: 6,
    revenueYtdUsdCents: 4_200_000,
    refundsYtdUsdCents: 200_000,
    quarterToDateUsdCents: 900_000,
    previousQuarterUsdCents: 2_400_000,
    completedJobs: 312,
    closedThisWeek: 9,
    pendingReview: 4,
    activeRunningScans: 3,
    criticalCvesTracked: 27,
    unpatchedCritical: 9,
  };
  revenueFixture: RevenueRaw = {
    grossYtdUsdCents: 4_200_000,
    revenueThisMonthUsdCents: 640_000,
    paidClients: { sme: 21, sacco: 12, enterprise: 15 },
    trailingRevenueUsdCents: 1_500_000,
    trailingPaidInvoices: 60,
    plans: [
      {
        code: 'enterprise_retainer',
        name: 'Enterprise Retainer',
        unit: 'month',
        monthlyUsdCents: 249_900,
        grossUsdCents: 900_000,
      },
      {
        code: 'sacco_fintech_compliance',
        name: 'SACCOS Compliance',
        unit: 'assessment',
        monthlyUsdCents: 89_900,
        grossUsdCents: 400_000,
      },
      {
        code: 'starter_scan',
        name: 'Starter Scan',
        unit: 'scan',
        monthlyUsdCents: 29_900,
        grossUsdCents: 200_000,
      },
    ],
  };
  transactionFixture: TransactionRow[] = [
    {
      txnCode: 'VX-90241',
      occurredAt: '2026-10-06T09:12:00.000Z',
      client: 'Acme Fintech',
      packageName: 'Enterprise Retainer · 12 endpoints',
      channel: 'card',
      amountUsdCents: 249_900,
      status: 'succeeded',
      refundedUsdCents: 0,
    },
    {
      txnCode: 'VX-90242',
      occurredAt: '2026-10-06T10:02:00.000Z',
      client: 'Zenith Sacco',
      packageName: 'Compliance Assessment',
      channel: 'mpesa',
      amountUsdCents: 89_900,
      status: 'requires_action',
      refundedUsdCents: 0,
    },
    {
      txnCode: 'VX-90243',
      occurredAt: '2026-10-05T18:40:00.000Z',
      client: 'Horizon Bank',
      packageName: 'Starter Scan',
      channel: 'bank_transfer',
      amountUsdCents: 29_900,
      status: 'succeeded',
      refundedUsdCents: 29_900,
    },
  ];
  trafficFixture: TrafficRaw = {
    siteSessions: 12_400,
    previousSiteSessions: 10_000,
    apiRequests: 48_000_000,
    avgResponseMs: 122,
    p95ResponseMs: 480,
    endpointCount: 34,
    hourly: [0, 4, 8, 12, 16, 20, 24].map((hourUtc, index) => ({
      hourUtc,
      apiRequests: index === 6 ? 0 : 8_000_000,
    })),
  };
  nodesFixture: NodesRaw = {
    featured: Array.from({ length: 6 }, (_, index) => ({
      code: `VV-NODE-${index + 1}`,
      label: `Nairobi POP ${index + 1}`,
      country: 'KE',
      status: 'operational',
      reqPerMin: 1200 - index * 100,
      loadPercent: 40 + index,
      heartbeatLatencyMs: 12,
      clockDriftMs: 2,
    })),
    online: 401,
    total: 412,
  };
  pipelineFixture: PipelineRaw = {
    pendingJobs: 5,
    unreviewedJobs: 4,
    running: 3,
    completed: 312,
    closedLast7Days: 9,
  };
  threatFixture: ThreatSnapshotRow | null = {
    level: 5,
    activeZeroDays: 3,
    criticalCves: 27,
    unpatchedCritical: 9,
    weaponizedInWild: 37,
    threatsBlockedYtd: 1_284_903,
    computedAt: '2026-10-06T14:00:00.000Z',
  };
  endpointLimit = 0;
  transactionLimit = 0;
  nodeLimit = 0;
  runningLimit = 0;

  async kpis() {
    this.calls.push('kpis');
    return this.kpiFixture;
  }
  async revenue() {
    this.calls.push('revenue');
    return this.revenueFixture;
  }
  async transactions(_since: Date, limit: number) {
    this.calls.push('transactions');
    this.transactionLimit = limit;
    return this.transactionFixture;
  }
  async traffic() {
    this.calls.push('traffic');
    return this.trafficFixture;
  }
  async endpoints(_since: Date, limit: number) {
    this.calls.push('endpoints');
    this.endpointLimit = limit;
    return [
      { endpoint: 'POST /api/v1/scans', requests: 18_400, avgLatencyMs: 210, errorRatio: 0.0021 },
    ];
  }
  async nodes(limit: number) {
    this.calls.push('nodes');
    this.nodeLimit = limit;
    return this.nodesFixture;
  }
  async pipeline() {
    this.calls.push('pipeline');
    return this.pipelineFixture;
  }
  async runningScans(limit: number) {
    this.calls.push('running-scans');
    this.runningLimit = limit;
    return [
      {
        jobCode: 'JOB-4471',
        targetHost: 'api.acmefintech.co.ke',
        scanType: 'external',
        analystEmail: 'e.reed@vunvault.com',
        progress: 62,
        etaSeconds: 480,
      },
    ];
  }
  async threatSnapshot() {
    this.calls.push('threat-snapshot');
    return this.threatFixture;
  }
  async threatsBlockedByDay() {
    this.calls.push('threats-blocked');
    return [
      { day: '2026-10-05', count: 4200 },
      { day: '2026-10-06', count: 5100 },
    ];
  }
}

interface Harness {
  app: FastifyInstance;
  repo: FakeDashboardRepo;
  cache: ReturnType<typeof memoryCache>;
  user: { current: AuthUser | null };
}

function staffUser(role: UserRole = 'admin', aal: 'aal1' | 'aal2' = 'aal2'): AuthUser {
  return {
    id: STAFF_ID,
    email: 'a.mwangi@vunvault.com',
    role,
    orgId: null,
    permissions: [...ROLE_PERMISSIONS[role]],
    aal,
    sessionId: '20000000-0000-4000-8000-000000000001',
  };
}

async function makeHarness(): Promise<Harness> {
  const repo = new FakeDashboardRepo();
  const cache = memoryCache(() => NOW.getTime());
  const user: Harness['user'] = { current: staffUser() };

  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('env', TEST_ENV);
  app.decorateRequest('clientIp', '');
  app.decorateRequest('requestId', '');
  app.decorate('authenticate', (async (request: FastifyRequest) => {
    if (user.current === null) throw HttpError.unauthorized();
    request.user = user.current;
  }) as unknown as FastifyInstance['authenticate']);
  app.decorate('requireStaff', (async (request: FastifyRequest) => {
    const current = request.user;
    if (current === undefined) throw HttpError.unauthorized();
    if (current.role === 'client') throw HttpError.forbidden();
    if (current.aal !== 'aal2') throw new HttpError(403, 'mfa_required');
  }) as unknown as FastifyInstance['requireStaff']);
  app.decorate('requirePermission', ((...required: string[]) =>
    async (request: FastifyRequest) => {
      const current = request.user;
      if (current === undefined) throw HttpError.unauthorized();
      const granted = new Set(current.permissions);
      for (const permission of required) {
        if (!granted.has(permission as never)) throw HttpError.forbidden();
      }
    }) as unknown as FastifyInstance['requirePermission']);

  await app.register(errorHandler);
  await app.register(
    async (scope) => {
      await scope.register(dashboardRoutes, {
        repo,
        cache,
        workerSlotsTotal: 24,
        now: () => NOW,
      });
    },
    { prefix: '/api/v1' },
  );

  return { app, repo, cache, user };
}

let harness: Harness;

beforeEach(async () => {
  harness = await makeHarness();
});

function get(path: string) {
  return harness.app.inject({ method: 'GET', url: `/api/v1/admin/dashboard/${path}` });
}

// ------------------------------------------------------------------- guards

describe('access', () => {
  it('refuses a client, a staff member on one factor, and an anonymous caller', async () => {
    harness.user.current = staffUser('client' as UserRole);
    expect((await get('kpis')).statusCode).toBe(403);

    harness.user.current = staffUser('admin', 'aal1');
    const oneFactor = await get('kpis');
    expect(oneFactor.statusCode).toBe(403);
    expect(oneFactor.json()).toMatchObject({ error: 'mfa_required' });

    harness.user.current = null;
    expect((await get('kpis')).statusCode).toBe(401);
    expect(harness.repo.calls).toHaveLength(0);
  });

  it('exposes no write endpoint at all', () => {
    const routes = harness.app.printRoutes({ commonPrefix: false });
    for (const line of routes.split('\n')) {
      if (!line.includes('/admin/dashboard')) continue;
      expect(line, line).toContain('(GET');
      expect(line, line).not.toContain('POST');
    }
  });
});

// -------------------------------------------------------------------- cache

describe('the fifteen-second cache', () => {
  it('serves the second read from Redis and bypasses it on refresh=1', async () => {
    const first = await get('kpis');
    const second = await get('kpis');
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    // One computation for two reads.
    expect(harness.repo.calls.filter((call) => call === 'kpis')).toHaveLength(1);
    expect(harness.cache.entries.get('dash:kpis')).toBeDefined();

    const refreshed = await get('kpis?refresh=1');
    expect(refreshed.statusCode).toBe(200);
    expect(harness.repo.calls.filter((call) => call === 'kpis')).toHaveLength(2);
  });

  it('recomputes once the entry has expired', async () => {
    await get('pipeline');
    expect(harness.repo.calls.filter((call) => call === 'pipeline')).toHaveLength(1);
    const entry = harness.cache.entries.get('dash:pipeline');
    if (entry === undefined) throw new Error('nothing was cached');
    expect(entry.expiresAt - NOW.getTime()).toBe(15_000);
    // Age the entry out and read again.
    entry.expiresAt = NOW.getTime();
    await get('pipeline');
    expect(harness.repo.calls.filter((call) => call === 'pipeline')).toHaveLength(2);
  });

  it('still answers when the cache is unreadable', async () => {
    const broken = memoryCache();
    broken.get = async () => {
      throw new Error('redis down');
    };
    broken.set = async () => {
      throw new Error('redis down');
    };
    const local = await makeHarness();
    await local.app.register(
      async (scope) => {
        await scope.register(dashboardRoutes, {
          repo: local.repo,
          cache: broken,
          workerSlotsTotal: 24,
          now: () => NOW,
        });
      },
      { prefix: '/api/v2' },
    );
    const response = await local.app.inject({
      method: 'GET',
      url: '/api/v2/admin/dashboard/kpis',
    });
    expect(response.statusCode).toBe(200);
  });
});

// --------------------------------------------------------------------- kpis

describe('GET …/kpis', () => {
  it('nets refunds out of revenue and normalises the quarter per day', async () => {
    const response = await get('kpis');
    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: Record<string, number> };
    expect(body.data.totalRevenueUsdCents).toBe(4_000_000);
    expect(body.data.workerSlotsUsed).toBe(3);
    expect(body.data.workerSlotsTotal).toBe(24);
    expect(body.data.criticalCvesTracked).toBe(27);
    expect(body.data.unpatchedCritical).toBe(9);

    // Quarter to date: 900,000 over 6 days = 150,000/day.
    // Previous full quarter: 2,400,000 over 92 days ≈ 26,087/day.
    const bounds = boundsFor(NOW);
    expect(
      changePerDayPercent(900_000, bounds.quarterDays, 2_400_000, bounds.previousQuarterDays),
    ).toBe(body.data.revenueChangeVsLastQuarterPercent);
    expect(body.data.revenueChangeVsLastQuarterPercent).toBeGreaterThan(400);
  });
});

// ------------------------------------------------------------------ revenue

describe('GET …/revenue', () => {
  it('renders tier shares that sum to exactly 100', async () => {
    const response = await get('revenue');
    const body = response.json() as {
      data: {
        tiers: Array<{ code: string; unitLabel: string; sharePercent: number }>;
        periodLabel: string;
        averageOrderValueUsdCents: number;
        paidClients: Record<string, number>;
      };
    };
    const total = body.data.tiers.reduce((sum, tier) => sum + tier.sharePercent, 0);
    expect(total).toBe(100);
    expect(body.data.tiers[0]).toMatchObject({
      code: 'enterprise_retainer',
      unitLabel: '$2,499 / month',
    });
    expect(body.data.tiers[1]?.unitLabel).toBe('$899 / assessment');
    expect(body.data.tiers[2]?.unitLabel).toBe('$299 / scan');
    expect(body.data.periodLabel).toBe('01 – 06 Oct 2026');
    expect(body.data.averageOrderValueUsdCents).toBe(25_000);
    expect(body.data.paidClients).toEqual({ sme: 21, sacco: 12, enterprise: 15 });
  });

  it('rounds by largest remainder, never by truncation', () => {
    // Three equal shares: 33 + 33 + 34, and the first takes the extra point.
    expect(largestRemainderShares([1, 1, 1])).toEqual([34, 33, 33]);
    expect(largestRemainderShares([1, 1, 1]).reduce((a, b) => a + b)).toBe(100);
    expect(largestRemainderShares([2, 3, 5]).reduce((a, b) => a + b)).toBe(100);
    expect(largestRemainderShares([])).toEqual([]);
    // No revenue: no invented shares.
    expect(largestRemainderShares([0, 0])).toEqual([0, 0]);
  });

  it('formats whole dollars with thousands separators', () => {
    expect(formatUsdWhole(249_900)).toBe('$2,499');
    expect(formatUsdWhole(89_900)).toBe('$899');
    expect(formatUsdWhole(29_900)).toBe('$299');
    expect(formatUsdWhole(0)).toBe('$0');
  });
});

// ------------------------------------------------------------- transactions

describe('GET …/transactions', () => {
  it('maps provider states onto the panel’s three and totals the rows shown', async () => {
    const response = await get('transactions');
    const body = response.json() as {
      data: Array<{ txnCode: string; method: string; status: string }>;
      totals: Record<string, number>;
    };
    expect(body.data.map((row) => row.status)).toEqual(['settled', 'pending', 'refunded']);
    expect(body.data.map((row) => row.method)).toEqual(['card', 'mpesa', 'bank_transfer']);
    expect(body.totals).toEqual({
      totalUsdCents: 369_700,
      settled: 1,
      pending: 1,
      refunded: 1,
    });
    expect(harness.repo.transactionLimit).toBe(6);
  });

  it('honours an explicit limit', async () => {
    await get('transactions?limit=2');
    expect(harness.repo.transactionLimit).toBe(2);
  });
});

// ------------------------------------------------------------------ traffic

describe('GET …/traffic', () => {
  it('reports seven hourly points that add up to the window total', async () => {
    const response = await get('traffic');
    const body = response.json() as {
      data: {
        hourly: Array<{ hourUtc: number; apiRequestsMillions: number }>;
        apiRequests: number;
        sessionsChangePercent: number;
        endpointCount: number;
      };
    };
    expect(body.data.hourly.map((point) => point.hourUtc)).toEqual([0, 4, 8, 12, 16, 20, 24]);
    const millions = body.data.hourly.reduce((sum, point) => sum + point.apiRequestsMillions, 0);
    expect(Math.round(millions * 1_000_000)).toBe(body.data.apiRequests);
    expect(body.data.sessionsChangePercent).toBe(24);
    expect(body.data.endpointCount).toBe(34);
  });
});

describe('GET …/endpoints', () => {
  it('asks for six and passes the error ratio through as a fraction', async () => {
    const response = await get('endpoints');
    const body = response.json() as { data: Array<{ errorRatio: number }> };
    expect(harness.repo.endpointLimit).toBe(6);
    expect(body.data[0]?.errorRatio).toBe(0.0021);
  });
});

// -------------------------------------------------------------------- nodes

describe('GET …/nodes', () => {
  it('features the busiest six but counts the whole fleet', async () => {
    const response = await get('nodes');
    const body = response.json() as {
      data: Array<{ code: string }>;
      online: number;
      total: number;
    };
    expect(body.data).toHaveLength(6);
    expect(harness.repo.nodeLimit).toBe(6);
    expect(body.online).toBe(401);
    expect(body.total).toBe(412);
  });
});

// ----------------------------------------------------------------- pipeline

describe('GET …/pipeline and …/running-scans', () => {
  it('reports the distribution and the slot gauge', async () => {
    const response = await get('pipeline');
    expect(response.json()).toMatchObject({
      data: {
        pendingJobs: 5,
        unreviewedJobs: 4,
        running: 3,
        workerSlotsUsed: 3,
        workerSlotsTotal: 24,
        distribution: { completed: 312, pending: 5, unreviewed: 4, running: 3 },
        closedLast7Days: 9,
      },
    });
  });

  it('labels the analyst by the local part of their address', async () => {
    const response = await get('running-scans');
    const body = response.json() as {
      data: Array<{ jobCode: string; analystLabel: string }>;
      shown: number;
      total: number;
    };
    expect(body.data[0]).toMatchObject({ jobCode: 'JOB-4471', analystLabel: 'e.reed' });
    expect(body.data[0]?.analystLabel).not.toContain('@');
    expect(body.shown).toBe(1);
    expect(body.total).toBe(1);
    expect(harness.repo.runningLimit).toBe(5);
  });
});

// -------------------------------------------------------------- threat level

describe('GET …/threat-level', () => {
  it('pairs the latest snapshot with seven labelled days', async () => {
    const response = await get('threat-level');
    const body = response.json() as {
      data: {
        level: number;
        label: string;
        blockedLast7Days: Array<{ day: string; count: number }>;
        recalculatedAt: string;
      };
    };
    expect(body.data.level).toBe(5);
    expect(body.data.label).toBe('Severe');
    expect(body.data.blockedLast7Days).toHaveLength(7);
    expect(body.data.blockedLast7Days.map((entry) => entry.day)).toEqual([
      'Wed',
      'Thu',
      'Fri',
      'Sat',
      'Sun',
      'Mon',
      'Tue',
    ]);
    // 2026-10-06 is a Tuesday, and it is the last day in the window.
    expect(body.data.blockedLast7Days[6]).toEqual({ day: 'Tue', count: 5100 });
    expect(body.data.blockedLast7Days[5]).toEqual({ day: 'Mon', count: 4200 });
    // Days with no rollup yet read as zero rather than disappearing.
    expect(body.data.blockedLast7Days[0]).toEqual({ day: 'Wed', count: 0 });
    expect(body.data.recalculatedAt).toBe('2026-10-06T14:00:00.000Z');
  });

  it('still answers when no snapshot has been computed yet', async () => {
    harness.repo.threatFixture = null;
    harness.cache.entries.clear();
    const response = await get('threat-level?refresh=1');
    expect(response.statusCode).toBe(200);
    expect((response.json() as { data: { level: number } }).data.level).toBe(1);
  });
});

// ------------------------------------------------------------ pure helpers

describe('date helpers', () => {
  it('labels the trailing seven UTC days, oldest first', () => {
    const days = trailingWeekdays(NOW);
    expect(days).toHaveLength(7);
    expect(days[0]?.date).toBe('2026-09-30');
    expect(days[6]?.date).toBe('2026-10-06');
  });

  it('builds the period label from the first of the month', () => {
    expect(periodLabel(NOW)).toBe('01 – 06 Oct 2026');
    expect(periodLabel(new Date('2026-01-31T23:59:59.000Z'))).toBe('01 – 31 Jan 2026');
  });

  it('computes the bounds for the current quarter', () => {
    const bounds: DateBounds = boundsFor(NOW);
    expect(bounds.quarterStart.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(bounds.previousQuarterStart.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(bounds.quarterDays).toBe(6);
    expect(bounds.previousQuarterDays).toBe(92);
    expect(bounds.startOfYear.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('reports no change when the previous period was empty', () => {
    expect(changePerDayPercent(100, 1, 0, 90)).toBe(0);
    expect(changePerDayPercent(0, 1, 100, 1)).toBe(-100);
  });
});

describe('the service reads through the repository only', () => {
  it('never writes', async () => {
    const service = new DashboardService({ repo: harness.repo, now: () => NOW });
    await Promise.all([
      service.kpis(),
      service.revenue(),
      service.transactions(6),
      service.traffic(),
      service.endpoints(6),
      service.nodes(6),
      service.pipeline(),
      service.runningScans(5),
      service.threatLevel(),
    ]);
    // Every repository method this service can call is a read.
    expect(harness.repo.calls.length).toBeGreaterThan(8);
  });
});

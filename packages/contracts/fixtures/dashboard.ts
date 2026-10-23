import type {
  DashboardKpis,
  EndpointStat,
  NodesResponse,
  PipelineSummary,
  RecentTransaction,
  RevenueSummary,
  RunningScansResponse,
  ThreatLevel,
  TrafficSummary,
  TransactionsResponse,
} from '../src/dashboard';

/**
 * Command Center fixtures, all as at 2026-09-24T12:00:00Z.
 *
 * Amounts are integer USD cents. `grossRevenueYtdUsdCents` is the fixture-only
 * value the catalogue nominates (18 472 000 cents = $184,720.00), matching
 * `dashboardKpis.totalRevenueUsdCents`.
 */

export const dashboardKpis: DashboardKpis = {
  totalPaidClients: 312,
  newPaidClientsThisMonth: 18,
  totalRevenueUsdCents: 18472000,
  revenueChangeVsLastQuarterPercent: 12.4,
  completedJobs: 1842,
  closedThisWeek: 96,
  pendingReview: 37,
  activeRunningScans: 12,
  workerSlotsUsed: 12,
  workerSlotsTotal: 24,
  criticalCvesTracked: 46,
  unpatchedCritical: 9,
};

export const revenueSummary: RevenueSummary = {
  grossRevenueYtdUsdCents: 18472000,
  revenueThisMonthUsdCents: 2245000,
  periodLabel: '01 – 24 Sep 2026',
  paidClients: { sme: 284, sacco: 22, enterprise: 6 },
  averageOrderValueUsdCents: 59200,
  tiers: [
    { code: 'starter_scan', name: 'Starter Scan', unitLabel: '$299 / scan', sharePercent: 41 },
    {
      code: 'sacco_fintech_compliance',
      name: 'SACCO & Fintech',
      unitLabel: '$899 / assessment',
      sharePercent: 34,
    },
    {
      code: 'enterprise_retainer',
      name: 'Enterprise Retainer',
      unitLabel: '$2,499 / month',
      sharePercent: 25,
    },
  ],
};

export const trafficSummary: TrafficSummary = {
  siteSessions: 48392,
  sessionsChangePercent: 6.2,
  apiRequests: 2140000,
  endpointCount: 41,
  avgResponseMs: 142,
  p95ResponseMs: 384,
  hourly: [
    { hourUtc: 0, apiRequestsMillions: 0.31 },
    { hourUtc: 4, apiRequestsMillions: 0.22 },
    { hourUtc: 8, apiRequestsMillions: 0.29 },
    { hourUtc: 12, apiRequestsMillions: 0.27 },
    { hourUtc: 16, apiRequestsMillions: 0.24 },
    { hourUtc: 20, apiRequestsMillions: 0.21 },
    { hourUtc: 24, apiRequestsMillions: 0.3 },
  ],
};

export const endpointStats: EndpointStat[] = [
  { endpoint: '/api/v1/scan/submit', requests: 412880, avgLatencyMs: 168, errorRatio: 0.21 },
  { endpoint: '/api/v1/auth/token', requests: 388214, avgLatencyMs: 92, errorRatio: 0.08 },
  { endpoint: '/api/v1/report/export', requests: 121540, avgLatencyMs: 431, errorRatio: 0.64 },
  { endpoint: '/api/v1/cve/feed', requests: 96772, avgLatencyMs: 74, errorRatio: 0.02 },
  { endpoint: '/api/v1/nodes/heartbeat', requests: 84318, avgLatencyMs: 41, errorRatio: 0.01 },
  { endpoint: '/admin (dashboard)', requests: 51204, avgLatencyMs: 210, errorRatio: 0.33 },
];

export const nodes: NodesResponse = {
  data: [
    {
      code: 'node-nbo-01',
      label: 'Nairobi Core',
      country: 'Kenya',
      status: 'operational',
      reqPerMin: 41200,
      loadPercent: 62,
      heartbeatLatencyMs: 18,
      clockDriftMs: 2,
    },
    {
      code: 'node-nbo-02',
      label: 'Nairobi Edge',
      country: 'Kenya',
      status: 'operational',
      reqPerMin: 28940,
      loadPercent: 48,
      heartbeatLatencyMs: 24,
      clockDriftMs: 3,
    },
    {
      code: 'node-acc-01',
      label: 'Accra Relay',
      country: 'Ghana',
      status: 'high_load',
      reqPerMin: 36410,
      loadPercent: 88,
      heartbeatLatencyMs: 142,
      clockDriftMs: 11,
    },
    {
      code: 'node-lag-01',
      label: 'Lagos Relay',
      country: 'Nigeria',
      status: 'operational',
      reqPerMin: 31880,
      loadPercent: 55,
      heartbeatLatencyMs: 96,
      clockDriftMs: 5,
    },
    {
      code: 'node-jnb-01',
      label: 'Johannesburg Vault',
      country: 'South Africa',
      status: 'operational',
      reqPerMin: 19220,
      loadPercent: 33,
      heartbeatLatencyMs: 112,
      clockDriftMs: 4,
    },
    {
      code: 'node-fra-01',
      label: 'Frankfurt Mirror',
      country: 'Germany',
      status: 'drift_warning',
      reqPerMin: 44600,
      loadPercent: 79,
      heartbeatLatencyMs: 38,
      clockDriftMs: 19,
    },
  ],
  online: 412,
  total: 412,
};

export const pipelineSummary: PipelineSummary = {
  pendingJobs: 96,
  unreviewedJobs: 37,
  running: 12,
  workerSlotsUsed: 12,
  workerSlotsTotal: 24,
  distribution: { completed: 1842, pending: 96, unreviewed: 37, running: 12 },
  closedLast7Days: 96,
};

export const runningScans: RunningScansResponse = {
  data: [
    {
      jobCode: 'JOB-4471',
      target: 'api.horizonsacco.co.ke',
      scanType: 'external',
      analystLabel: 'e.reed',
      progress: 78,
      etaSeconds: 252,
    },
    {
      jobCode: 'JOB-4470',
      target: 'pay.nairobifintech.com',
      scanType: 'api',
      analystLabel: 'a.njoroge',
      progress: 64,
      etaSeconds: 458,
    },
    {
      jobCode: 'JOB-4469',
      target: 'vault.lakeviewlogistics.com',
      scanType: 'internal',
      analystLabel: 'd.mwangi',
      progress: 41,
      etaSeconds: 785,
    },
    {
      jobCode: 'JOB-4468',
      target: '10.24.8.0/24',
      scanType: 'network',
      analystLabel: 'b.otieno',
      progress: 89,
      etaSeconds: 107,
    },
    {
      jobCode: 'JOB-4467',
      target: 'mobile.mwananchi.co.ke',
      scanType: 'mobile',
      analystLabel: 'f.hassan',
      progress: 22,
      etaSeconds: 1110,
    },
  ],
  shown: 5,
  total: 12,
};

export const threatLevel: ThreatLevel = {
  level: 4,
  label: 'High',
  activeZeroDays: 1284,
  criticalCves: 46,
  unpatchedCritical: 9,
  weaponizedInWild: 37,
  threatsBlockedYtd: 12904,
  blockedLast7Days: [
    { day: 'Mon', count: 1640 },
    { day: 'Tue', count: 1982 },
    { day: 'Wed', count: 1410 },
    { day: 'Thu', count: 2240 },
    { day: 'Fri', count: 1880 },
    { day: 'Sat', count: 1502 },
    { day: 'Sun', count: 2250 },
  ],
  recalculatedAt: '2026-09-24T12:00:00Z',
};

export const recentTransactions: RecentTransaction[] = [
  {
    txnCode: 'VX-90241',
    occurredAt: '2026-09-24T09:14:00Z',
    client: 'Horizon SACCO',
    package: 'Enterprise Retainer',
    method: 'mpesa',
    amountUsdCents: 249900,
    status: 'settled',
  },
  {
    txnCode: 'VX-90240',
    occurredAt: '2026-09-24T08:02:00Z',
    client: 'Nairobi Fintech Group',
    package: 'SACCO & Fintech Compliance',
    method: 'card',
    amountUsdCents: 89900,
    status: 'settled',
  },
  {
    txnCode: 'VX-90239',
    occurredAt: '2026-09-23T17:41:00Z',
    client: 'Kijani Agri Co-op',
    package: 'Starter Scan',
    method: 'card',
    amountUsdCents: 29900,
    status: 'settled',
  },
  {
    // Fixture-only package: the catalogue names the client and channel only.
    txnCode: 'VX-90238',
    occurredAt: '2026-09-23T14:20:00Z',
    client: 'Lakeview Logistics',
    package: 'Enterprise Retainer',
    method: 'bank_transfer',
    amountUsdCents: 249900,
    status: 'pending',
  },
  {
    txnCode: 'VX-90237',
    occurredAt: '2026-09-23T11:05:00Z',
    client: 'Mwananchi Microfinance',
    package: 'Starter Scan',
    method: 'mpesa',
    amountUsdCents: 29900,
    status: 'settled',
  },
  {
    txnCode: 'VX-90236',
    occurredAt: '2026-09-22T19:33:00Z',
    client: 'TechBridge Solutions',
    package: 'SACCO & Fintech Compliance',
    method: 'card',
    amountUsdCents: 89900,
    status: 'refunded',
  },
];

export const transactions: TransactionsResponse = {
  data: recentTransactions,
  totals: {
    totalUsdCents: recentTransactions.reduce((sum, row) => sum + row.amountUsdCents, 0),
    settled: recentTransactions.filter((row) => row.status === 'settled').length,
    pending: recentTransactions.filter((row) => row.status === 'pending').length,
    refunded: recentTransactions.filter((row) => row.status === 'refunded').length,
  },
};

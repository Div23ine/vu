import { z } from 'zod';
import { IsoDateTime, UsdCents } from './common.js';
import { NodeStatusSchema, ScanTypeSchema } from './enums.js';
import type { NodeStatus } from './enums.js';

/**
 * Admin Command Center: KPIs, revenue, transactions, traffic, endpoints, the
 * sensor fleet, the scan pipeline and the threat level.
 *
 * Permission: `dashboard:read`. The node heartbeat endpoint is the exception —
 * it carries no session and is authenticated by an Ed25519 signature instead.
 */

/** Threat level names. `THREAT_ESCALATION_LEVEL` and above pages the commander. */
export const THREAT_LEVEL_LABELS = {
  1: 'Low',
  2: 'Guarded',
  3: 'Elevated',
  4: 'High',
  5: 'Severe',
} as const;

export type ThreatLevelValue = keyof typeof THREAT_LEVEL_LABELS;

/** At this level the incident commander on duty is escalated to. */
export const THREAT_ESCALATION_LEVEL = 4;

export const NODE_STATUS_LABELS: Record<NodeStatus, string> = {
  operational: 'Operational',
  high_load: 'High Load',
  drift_warning: 'Drift Warning',
  degraded: 'Degraded',
  offline: 'Offline',
};

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const DashboardKpis = z.object({
  totalPaidClients: z.number().int().nonnegative(),
  newPaidClientsThisMonth: z.number().int().nonnegative(),
  totalRevenueUsdCents: UsdCents,
  revenueChangeVsLastQuarterPercent: z.number(),
  completedJobs: z.number().int().nonnegative(),
  closedThisWeek: z.number().int().nonnegative(),
  pendingReview: z.number().int().nonnegative(),
  activeRunningScans: z.number().int().nonnegative(),
  workerSlotsUsed: z.number().int().nonnegative(),
  workerSlotsTotal: z.number().int().nonnegative(),
  criticalCvesTracked: z.number().int().nonnegative(),
  unpatchedCritical: z.number().int().nonnegative(),
});
export type DashboardKpis = z.infer<typeof DashboardKpis>;

export const RevenueTier = z.object({
  code: z.string(),
  name: z.string(),
  /** Rendered price line, e.g. `$2,499 / month`. */
  unitLabel: z.string(),
  sharePercent: z.number().min(0).max(100),
});
export type RevenueTier = z.infer<typeof RevenueTier>;

export const RevenueSummary = z.object({
  grossRevenueYtdUsdCents: UsdCents,
  revenueThisMonthUsdCents: UsdCents,
  /** e.g. `01 – 24 Sep 2026`. */
  periodLabel: z.string(),
  paidClients: z.object({
    sme: z.number().int().nonnegative(),
    sacco: z.number().int().nonnegative(),
    enterprise: z.number().int().nonnegative(),
  }),
  averageOrderValueUsdCents: UsdCents,
  tiers: z.array(RevenueTier),
});
export type RevenueSummary = z.infer<typeof RevenueSummary>;

export const TXN_CODE_PATTERN = /^VX-\d+$/;

export const RecentTransaction = z.object({
  txnCode: z.string().regex(TXN_CODE_PATTERN),
  occurredAt: IsoDateTime,
  client: z.string(),
  /** Plan or package name as printed on the invoice line. */
  package: z.string(),
  method: z.enum(['mpesa', 'card', 'bank_transfer']),
  amountUsdCents: UsdCents,
  status: z.enum(['settled', 'pending', 'refunded']),
});
export type RecentTransaction = z.infer<typeof RecentTransaction>;

export const TransactionsResponse = z.object({
  data: z.array(RecentTransaction),
  totals: z.object({
    totalUsdCents: UsdCents,
    settled: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    refunded: z.number().int().nonnegative(),
  }),
});
export type TransactionsResponse = z.infer<typeof TransactionsResponse>;

export const TrafficSummary = z.object({
  siteSessions: z.number().int().nonnegative(),
  sessionsChangePercent: z.number(),
  apiRequests: z.number().int().nonnegative(),
  endpointCount: z.number().int().nonnegative(),
  avgResponseMs: z.number().int().nonnegative(),
  p95ResponseMs: z.number().int().nonnegative(),
  hourly: z.array(
    z.object({
      hourUtc: z.number().int().min(0).max(24),
      apiRequestsMillions: z.number().nonnegative(),
    }),
  ),
});
export type TrafficSummary = z.infer<typeof TrafficSummary>;

export const EndpointStat = z.object({
  endpoint: z.string(),
  requests: z.number().int().nonnegative(),
  avgLatencyMs: z.number().int().nonnegative(),
  /** Percentage, e.g. `0.21` for 0.21 %. */
  errorRatio: z.number().nonnegative(),
});
export type EndpointStat = z.infer<typeof EndpointStat>;

export const NodeView = z.object({
  code: z.string(),
  label: z.string(),
  country: z.string(),
  status: NodeStatusSchema,
  reqPerMin: z.number().int().nonnegative(),
  loadPercent: z.number().int().min(0).max(100),
  heartbeatLatencyMs: z.number().int().nonnegative().nullable(),
  clockDriftMs: z.number().int().nullable(),
});
export type NodeView = z.infer<typeof NodeView>;

export const NodesResponse = z.object({
  data: z.array(NodeView),
  online: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});
export type NodesResponse = z.infer<typeof NodesResponse>;

export const PipelineSummary = z.object({
  pendingJobs: z.number().int().nonnegative(),
  unreviewedJobs: z.number().int().nonnegative(),
  running: z.number().int().nonnegative(),
  workerSlotsUsed: z.number().int().nonnegative(),
  workerSlotsTotal: z.number().int().nonnegative(),
  distribution: z.object({
    completed: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    unreviewed: z.number().int().nonnegative(),
    running: z.number().int().nonnegative(),
  }),
  closedLast7Days: z.number().int().nonnegative(),
});
export type PipelineSummary = z.infer<typeof PipelineSummary>;

export const RunningScan = z.object({
  jobCode: z.string().regex(/^JOB-\d{4,}$/),
  target: z.string(),
  scanType: ScanTypeSchema,
  analystLabel: z.string(),
  progress: z.number().int().min(0).max(100),
  etaSeconds: z.number().int().nonnegative().nullable(),
});
export type RunningScan = z.infer<typeof RunningScan>;

export const RunningScansResponse = z.object({
  data: z.array(RunningScan),
  shown: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});
export type RunningScansResponse = z.infer<typeof RunningScansResponse>;

export const ThreatLevel = z.object({
  level: z.number().int().min(1).max(5),
  label: z.string(),
  activeZeroDays: z.number().int().nonnegative(),
  criticalCves: z.number().int().nonnegative(),
  unpatchedCritical: z.number().int().nonnegative(),
  weaponizedInWild: z.number().int().nonnegative(),
  threatsBlockedYtd: z.number().int().nonnegative(),
  blockedLast7Days: z.array(
    z.object({
      day: z.enum(WEEKDAYS),
      count: z.number().int().nonnegative(),
    }),
  ),
  recalculatedAt: IsoDateTime,
});
export type ThreatLevel = z.infer<typeof ThreatLevel>;

/**
 * Signed node heartbeat. There is no session: the node proves identity with an
 * Ed25519 signature over `nodeCode|sentAt|reqPerMin|loadPercent|clockDriftMs`,
 * verified against `sensor_nodes.public_key`.
 */
export const NodeHeartbeatBody = z.object({
  nodeCode: z.string().min(1),
  sentAt: IsoDateTime,
  reqPerMin: z.number().int().nonnegative(),
  loadPercent: z.number().int().min(0).max(100),
  clockDriftMs: z.number().int(),
  signature: z.string().min(1),
});
export type NodeHeartbeatBody = z.infer<typeof NodeHeartbeatBody>;

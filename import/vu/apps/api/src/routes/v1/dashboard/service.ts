import type {
  DashboardKpis,
  EndpointStat,
  NodesResponse,
  PipelineSummary,
  RevenueSummary,
  RevenueTier,
  RunningScansResponse,
  ThreatLevel,
  TransactionsResponse,
  TrafficSummary,
  Weekday,
} from '@vunvault/contracts';
import { THREAT_LEVEL_LABELS, WEEKDAYS } from '@vunvault/contracts';
import type { DateBounds, DashboardRepo, HourlyPoint, TransactionRow } from './repo.js';

/**
 * The Command Center's numbers.
 *
 * Two habits keep this module honest. Every window boundary comes from `bounds()`
 * in one place, so "this month" means the same thing on every panel. And every
 * derived figure — a percentage change, a share of revenue, an average order value
 * — is computed from integer cents with an explicit rounding rule, because a
 * dashboard that shows shares summing to 99 % or 101 % is a dashboard an operator
 * stops believing.
 *
 * Money fields are USD cents. Nothing here charges anything: the Command Center
 * is read-only.
 */

/** Plan code → the paid-client tier the dashboard reports. */
export const TIER_FOR_PLAN: Record<string, 'sme' | 'sacco' | 'enterprise'> = {
  starter_scan: 'sme',
  sacco_fintech_compliance: 'sacco',
  enterprise_retainer: 'enterprise',
};

/** The transactions panel covers the last 48 hours. */
export const TRANSACTION_WINDOW_MS = 48 * 60 * 60 * 1000;

/** Seven points across the traffic window. */
export const TRAFFIC_POINTS = 7;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface DashboardServiceDeps {
  repo: DashboardRepo;
  now?: () => Date;
  workerSlotsTotal?: number;
}

/** `249900 → "$2,499"`: whole dollars, thousands-separated. */
export function formatUsdWhole(cents: number): string {
  const dollars = Math.trunc(cents / 100);
  return `$${dollars.toLocaleString('en-US')}`;
}

/**
 * Whole-percent shares that sum to exactly 100 (largest-remainder rounding).
 * Zero input is all zeros: there is no revenue to share out.
 */
export function largestRemainderShares(values: readonly number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return values.map(() => 0);

  const exact = values.map((value) => (value / total) * 100);
  const floors = exact.map((value) => Math.floor(value));
  let remaining = 100 - floors.reduce((sum, value) => sum + value, 0);

  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);

  for (const entry of order) {
    if (remaining <= 0) break;
    floors[entry.index] = (floors[entry.index] ?? 0) + 1;
    remaining -= 1;
  }
  return floors;
}

/** `01 – 24 Sep 2026`: the first of the UTC month to today. */
export function periodLabel(now: Date): string {
  // The window always opens on the first of the UTC month.
  const start = '01';
  const day = String(now.getUTCDate()).padStart(2, '0');
  const month = MONTHS[now.getUTCMonth()] ?? '';
  return `${start} – ${day} ${month} ${now.getUTCFullYear()}`;
}

/** The seven trailing UTC days, oldest first, labelled Mon…Sun. */
export function trailingWeekdays(now: Date): Array<{ day: Weekday; date: string }> {
  const days: Array<{ day: Weekday; date: string }> = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset, 0, 0, 0, 0),
    );
    // getUTCDay(): 0 = Sunday; WEEKDAYS starts on Monday.
    const index = (date.getUTCDay() + 6) % 7;
    days.push({ day: WEEKDAYS[index] as Weekday, date: date.toISOString().slice(0, 10) });
  }
  return days;
}

/** `e.reed@vunvault.com` → `e.reed`. */
export function analystLabel(email: string | null): string {
  if (email === null) return 'unassigned';
  const at = email.indexOf('@');
  return at === -1 ? email : email.slice(0, at);
}

export function boundsFor(now: Date): DateBounds {
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const quarter = Math.floor(now.getUTCMonth() / 3);
  const quarterStart = new Date(Date.UTC(now.getUTCFullYear(), quarter * 3, 1));
  const previousQuarterStart = new Date(Date.UTC(now.getUTCFullYear(), quarter * 3 - 3, 1));
  const dayMs = 24 * 60 * 60 * 1000;
  return {
    now,
    startOfYear,
    startOfMonth,
    startOfToday,
    quarterStart,
    previousQuarterStart,
    weekAgo: new Date(now.getTime() - 7 * dayMs),
    dayAgo: new Date(now.getTime() - dayMs),
    twoDaysAgo: new Date(now.getTime() - 2 * dayMs),
    ninetyDaysAgo: new Date(now.getTime() - 90 * dayMs),
    quarterDays: Math.max(1, Math.round((now.getTime() - quarterStart.getTime()) / dayMs)),
    previousQuarterDays: Math.max(
      1,
      Math.round((quarterStart.getTime() - previousQuarterStart.getTime()) / dayMs),
    ),
  };
}

/** Percentage change per day, one decimal place. */
export function changePerDayPercent(
  currentTotal: number,
  currentDays: number,
  previousTotal: number,
  previousDays: number,
): number {
  const current = currentTotal / Math.max(1, currentDays);
  const previous = previousTotal / Math.max(1, previousDays);
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** `succeeded → settled`, `created|requires_action → pending`, fully refunded → `refunded`. */
export function transactionStatus(row: TransactionRow): 'settled' | 'pending' | 'refunded' {
  if (row.refundedUsdCents >= row.amountUsdCents && row.amountUsdCents > 0) return 'refunded';
  if (row.status === 'succeeded') return 'settled';
  return 'pending';
}

export function transactionMethod(channel: string): 'mpesa' | 'card' | 'bank_transfer' {
  return channel === 'mpesa' || channel === 'bank_transfer' ? channel : 'card';
}

export class DashboardService {
  private readonly repo: DashboardRepo;
  private readonly now: () => Date;
  private readonly workerSlotsTotal: number;

  constructor(deps: DashboardServiceDeps & { workerSlotsTotal?: number }) {
    this.repo = deps.repo;
    this.now = deps.now ?? (() => new Date());
    this.workerSlotsTotal = deps.workerSlotsTotal ?? 24;
  }

  private bounds(): DateBounds {
    return boundsFor(this.now());
  }

  async kpis(): Promise<DashboardKpis> {
    const bounds = this.bounds();
    const raw = await this.repo.kpis(bounds);
    const running = raw.activeRunningScans;
    return {
      totalPaidClients: raw.totalPaidClients,
      newPaidClientsThisMonth: raw.newPaidClientsThisMonth,
      // Revenue less what came back out: a refund is not revenue.
      totalRevenueUsdCents: Math.max(0, raw.revenueYtdUsdCents - raw.refundsYtdUsdCents),
      revenueChangeVsLastQuarterPercent: changePerDayPercent(
        raw.quarterToDateUsdCents,
        bounds.quarterDays,
        raw.previousQuarterUsdCents,
        bounds.previousQuarterDays,
      ),
      completedJobs: raw.completedJobs,
      closedThisWeek: raw.closedThisWeek,
      pendingReview: raw.pendingReview,
      activeRunningScans: running,
      workerSlotsUsed: Math.min(running, this.workerSlotsTotal),
      workerSlotsTotal: this.workerSlotsTotal,
      criticalCvesTracked: raw.criticalCvesTracked,
      unpatchedCritical: raw.unpatchedCritical,
    };
  }

  async revenue(): Promise<RevenueSummary> {
    const bounds = this.bounds();
    const raw = await this.repo.revenue(bounds);
    const shares = largestRemainderShares(raw.plans.map((plan) => plan.grossUsdCents));

    const tiers: RevenueTier[] = raw.plans.map((plan, index) => ({
      code: plan.code,
      name: plan.name,
      // `$299 / scan`, `$899 / assessment`, `$2,499 / month`.
      unitLabel: `${formatUsdWhole(plan.monthlyUsdCents)} / ${plan.unit}`,
      sharePercent: shares[index] ?? 0,
    }));

    return {
      grossRevenueYtdUsdCents: raw.grossYtdUsdCents,
      revenueThisMonthUsdCents: raw.revenueThisMonthUsdCents,
      periodLabel: periodLabel(this.now()),
      paidClients: raw.paidClients,
      averageOrderValueUsdCents:
        raw.trailingPaidInvoices === 0
          ? 0
          : Math.round(raw.trailingRevenueUsdCents / raw.trailingPaidInvoices),
      tiers,
    };
  }

  async transactions(limit: number): Promise<TransactionsResponse> {
    const since = new Date(this.now().getTime() - TRANSACTION_WINDOW_MS);
    const rows = await this.repo.transactions(since, limit);
    const data = rows.map((row) => ({
      txnCode: row.txnCode,
      occurredAt: row.occurredAt,
      client: row.client,
      package: row.packageName,
      method: transactionMethod(row.channel),
      amountUsdCents: row.amountUsdCents,
      status: transactionStatus(row),
    }));

    const totals = {
      totalUsdCents: data.reduce((sum, row) => sum + row.amountUsdCents, 0),
      settled: data.filter((row) => row.status === 'settled').length,
      pending: data.filter((row) => row.status === 'pending').length,
      refunded: data.filter((row) => row.status === 'refunded').length,
    };
    return { data, totals };
  }

  async traffic(): Promise<TrafficSummary> {
    const raw = await this.repo.traffic(this.bounds());
    return {
      siteSessions: raw.siteSessions,
      sessionsChangePercent: changePerDayPercent(raw.siteSessions, 1, raw.previousSiteSessions, 1),
      apiRequests: raw.apiRequests,
      endpointCount: raw.endpointCount,
      avgResponseMs: raw.avgResponseMs,
      p95ResponseMs: raw.p95ResponseMs,
      hourly: raw.hourly.map(toMillions),
    };
  }

  async endpoints(limit: number): Promise<EndpointStat[]> {
    const rows = await this.repo.endpoints(this.bounds().dayAgo, limit);
    // `error_ratio` is stored as a fraction (0.0021 = 0.21 %) and passed through
    // unchanged: the panel formats it.
    return rows.map((row) => ({
      endpoint: row.endpoint,
      requests: row.requests,
      avgLatencyMs: row.avgLatencyMs,
      errorRatio: row.errorRatio,
    }));
  }

  async nodes(limit: number): Promise<NodesResponse> {
    const raw = await this.repo.nodes(limit);
    return {
      data: raw.featured.map((node) => ({
        code: node.code,
        label: node.label,
        country: node.country,
        status: node.status as NodesResponse['data'][number]['status'],
        reqPerMin: node.reqPerMin,
        loadPercent: node.loadPercent,
        heartbeatLatencyMs: node.heartbeatLatencyMs,
        clockDriftMs: node.clockDriftMs,
      })),
      online: raw.online,
      total: raw.total,
    };
  }

  async pipeline(): Promise<PipelineSummary> {
    const raw = await this.repo.pipeline(this.bounds());
    return {
      pendingJobs: raw.pendingJobs,
      unreviewedJobs: raw.unreviewedJobs,
      running: raw.running,
      workerSlotsUsed: Math.min(raw.running, this.workerSlotsTotal),
      workerSlotsTotal: this.workerSlotsTotal,
      distribution: {
        completed: raw.completed,
        pending: raw.pendingJobs,
        unreviewed: raw.unreviewedJobs,
        running: raw.running,
      },
      closedLast7Days: raw.closedLast7Days,
    };
  }

  async runningScans(limit: number): Promise<RunningScansResponse> {
    const rows = await this.repo.runningScans(limit);
    const total = rows.length;
    const data = rows.slice(0, limit).map((row) => ({
      jobCode: row.jobCode,
      target: row.targetHost,
      scanType: row.scanType as RunningScansResponse['data'][number]['scanType'],
      analystLabel: analystLabel(row.analystEmail),
      progress: row.progress,
      etaSeconds: row.etaSeconds,
    }));
    return { data, shown: data.length, total };
  }

  async threatLevel(): Promise<ThreatLevel> {
    const now = this.now();
    const snapshot = await this.repo.threatSnapshot();
    const days = trailingWeekdays(now);
    const blocked = await this.repo.threatsBlockedByDay(
      days[0] === undefined ? now : new Date(`${days[0].date}T00:00:00.000Z`),
    );
    const byDate = new Map(blocked.map((row) => [row.day, row.count]));

    const level = (snapshot?.level ?? 1) as ThreatLevel['level'];
    return {
      level,
      label: THREAT_LEVEL_LABELS[level as keyof typeof THREAT_LEVEL_LABELS] ?? 'Low',
      activeZeroDays: snapshot?.activeZeroDays ?? 0,
      criticalCves: snapshot?.criticalCves ?? 0,
      unpatchedCritical: snapshot?.unpatchedCritical ?? 0,
      weaponizedInWild: snapshot?.weaponizedInWild ?? 0,
      threatsBlockedYtd: snapshot?.threatsBlockedYtd ?? 0,
      blockedLast7Days: days.map((day) => ({ day: day.day, count: byDate.get(day.date) ?? 0 })),
      recalculatedAt: snapshot?.computedAt ?? now.toISOString(),
    };
  }
}

/** Requests → millions, two decimals. */
function toMillions(point: HourlyPoint): { hourUtc: number; apiRequestsMillions: number } {
  return {
    hourUtc: point.hourUtc,
    apiRequestsMillions: Math.round((point.apiRequests / 1_000_000) * 100) / 100,
  };
}

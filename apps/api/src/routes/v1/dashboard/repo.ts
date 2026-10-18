import { asExecutor, type SqlExecutor } from '../../../audit/repo.js';

/**
 * Command Center aggregates (Task 37).
 *
 * Read-only, without exception: this repo has one `select` shape per panel and no
 * writes at all. Every window boundary is passed in by the service, so the same
 * query is testable against a fixed clock and cannot drift between panels.
 *
 * Money is USD cents throughout, and revenue is read from the LEDGER (credits to
 * `revenue_*` accounts, less `refund` debits) rather than from invoices, because
 * the ledger is what the platform actually collected.
 */

export interface DateBounds {
  now: Date;
  startOfYear: Date;
  startOfMonth: Date;
  startOfToday: Date;
  quarterStart: Date;
  previousQuarterStart: Date;
  weekAgo: Date;
  dayAgo: Date;
  twoDaysAgo: Date;
  ninetyDaysAgo: Date;
  /** How many days have elapsed in the current quarter, at least one. */
  quarterDays: number;
  /** Days in the previous full quarter. */
  previousQuarterDays: number;
}

export interface KpiRaw {
  totalPaidClients: number;
  newPaidClientsThisMonth: number;
  revenueYtdUsdCents: number;
  refundsYtdUsdCents: number;
  quarterToDateUsdCents: number;
  previousQuarterUsdCents: number;
  completedJobs: number;
  closedThisWeek: number;
  pendingReview: number;
  activeRunningScans: number;
  criticalCvesTracked: number;
  unpatchedCritical: number;
}

export interface PlanGrossRow {
  code: string;
  name: string;
  unit: string;
  monthlyUsdCents: number;
  grossUsdCents: number;
}

export interface RevenueRaw {
  grossYtdUsdCents: number;
  revenueThisMonthUsdCents: number;
  paidClients: { sme: number; sacco: number; enterprise: number };
  trailingRevenueUsdCents: number;
  trailingPaidInvoices: number;
  plans: PlanGrossRow[];
}

export interface TransactionRow {
  txnCode: string;
  occurredAt: string;
  client: string;
  packageName: string;
  channel: string;
  amountUsdCents: number;
  status: string;
  refundedUsdCents: number;
}

export interface HourlyPoint {
  /** 0, 4, 8, 12, 16, 20, 24 — the block boundary inside the window. */
  hourUtc: number;
  apiRequests: number;
}

export interface TrafficRaw {
  siteSessions: number;
  previousSiteSessions: number;
  apiRequests: number;
  avgResponseMs: number;
  p95ResponseMs: number;
  endpointCount: number;
  hourly: HourlyPoint[];
}

export interface EndpointRow {
  endpoint: string;
  requests: number;
  avgLatencyMs: number;
  /** A fraction, e.g. `0.0021`. */
  errorRatio: number;
}

export interface NodeRow {
  code: string;
  label: string;
  country: string;
  status: string;
  reqPerMin: number;
  loadPercent: number;
  heartbeatLatencyMs: number | null;
  clockDriftMs: number | null;
}

export interface NodesRaw {
  /** The busiest nodes: the panel is a highlight reel, the counts are the truth. */
  featured: NodeRow[];
  online: number;
  total: number;
}

export interface PipelineRaw {
  pendingJobs: number;
  unreviewedJobs: number;
  running: number;
  completed: number;
  closedLast7Days: number;
}

export interface RunningScanRow {
  jobCode: string;
  targetHost: string;
  scanType: string;
  analystEmail: string | null;
  progress: number;
  etaSeconds: number | null;
}

export interface ThreatSnapshotRow {
  level: number;
  activeZeroDays: number;
  criticalCves: number;
  unpatchedCritical: number;
  weaponizedInWild: number;
  threatsBlockedYtd: number;
  computedAt: string;
}

export interface BlockedDayRow {
  /** ISO date, e.g. `2026-10-06`; the service turns it into a weekday label. */
  day: string;
  count: number;
}

export interface DashboardRepo {
  kpis(bounds: DateBounds): Promise<KpiRaw>;
  revenue(bounds: DateBounds): Promise<RevenueRaw>;
  transactions(since: Date, limit: number): Promise<TransactionRow[]>;
  traffic(bounds: DateBounds): Promise<TrafficRaw>;
  endpoints(since: Date, limit: number): Promise<EndpointRow[]>;
  nodes(limit: number): Promise<NodesRaw>;
  pipeline(bounds: DateBounds): Promise<PipelineRaw>;
  runningScans(limit: number): Promise<RunningScanRow[]>;
  threatSnapshot(): Promise<ThreatSnapshotRow | null>;
  threatsBlockedByDay(since: Date): Promise<BlockedDayRow[]>;
}

function num(value: unknown): number {
  return Number(value ?? 0);
}

function iso(value: unknown): string {
  return value === null || value === undefined ? '' : new Date(String(value)).toISOString();
}

export class SqlDashboardRepo implements DashboardRepo {
  private readonly executor: SqlExecutor;

  constructor(connection: unknown) {
    this.executor = asExecutor(connection);
  }

  async kpis(bounds: DateBounds): Promise<KpiRaw> {
    const [money] = await this.executor.unsafe<Array<Record<string, string | number>>>(
      `select
         (select count(distinct je.org_id)::text from journal_entries je
           where je.kind = 'payment_captured') as total_paid_clients,
         (select count(*)::text from (
            select je.org_id, min(je.occurred_at) as first_capture
              from journal_entries je
             where je.kind = 'payment_captured'
             group by je.org_id) first_captures
           where first_captures.first_capture >= $2) as new_paid_clients_this_month,
         coalesce(sum(ll.amount_usd_cents) filter (
           where la.code like 'revenue\\_%' and ll.direction = 'credit' and je.occurred_at >= $1
         ), 0)::text as revenue_ytd,
         coalesce(sum(ll.amount_usd_cents) filter (
           where je.kind = 'refund' and ll.direction = 'debit' and je.occurred_at >= $1
         ), 0)::text as refunds_ytd,
         coalesce(sum(ll.amount_usd_cents) filter (
           where la.code like 'revenue\\_%' and ll.direction = 'credit' and je.occurred_at >= $3
         ), 0)::text as quarter_to_date,
         coalesce(sum(ll.amount_usd_cents) filter (
           where la.code like 'revenue\\_%' and ll.direction = 'credit'
             and je.occurred_at >= $4 and je.occurred_at < $3
         ), 0)::text as previous_quarter
       from journal_entries je
       join ledger_lines ll on ll.entry_id = je.id
       join ledger_accounts la on la.id = ll.account_id`,
      [bounds.startOfYear, bounds.startOfMonth, bounds.quarterStart, bounds.previousQuarterStart],
    );

    const [jobs] = await this.executor.unsafe<Array<Record<string, string | number>>>(
      `select
         count(*) filter (where status = 'completed')::text as completed_jobs,
         count(*) filter (where status = 'completed' and completed_at >= $1)::text as closed_this_week,
         count(*) filter (where review_gate_state = 'in_review')::text as pending_review,
         count(*) filter (where status = 'running')::text as active_running_scans
       from scan_jobs`,
      [bounds.weekAgo],
    );

    const [advisories] = await this.executor.unsafe<Array<Record<string, string | number>>>(
      `select
         count(*) filter (where severity = 'critical')::text as critical_tracked,
         count(*) filter (where severity = 'critical' and patch_status <> 'patched')::text as unpatched_critical
       from advisories
      where status = 'published' and retracted_at is null`,
    );

    return {
      totalPaidClients: num(money?.total_paid_clients),
      newPaidClientsThisMonth: num(money?.new_paid_clients_this_month),
      revenueYtdUsdCents: num(money?.revenue_ytd),
      refundsYtdUsdCents: num(money?.refunds_ytd),
      quarterToDateUsdCents: num(money?.quarter_to_date),
      previousQuarterUsdCents: num(money?.previous_quarter),
      completedJobs: num(jobs?.completed_jobs),
      closedThisWeek: num(jobs?.closed_this_week),
      pendingReview: num(jobs?.pending_review),
      activeRunningScans: num(jobs?.active_running_scans),
      criticalCvesTracked: num(advisories?.critical_tracked),
      unpatchedCritical: num(advisories?.unpatched_critical),
    };
  }

  async revenue(bounds: DateBounds): Promise<RevenueRaw> {
    const [totals] = await this.executor.unsafe<Array<Record<string, string | number>>>(
      `select
         coalesce(sum(ll.amount_usd_cents) filter (
           where la.code like 'revenue\\_%' and ll.direction = 'credit' and je.occurred_at >= $1
         ), 0)::text as gross_ytd,
         coalesce(sum(ll.amount_usd_cents) filter (
           where la.code like 'revenue\\_%' and ll.direction = 'credit' and je.occurred_at >= $2
         ), 0)::text as this_month,
         coalesce(sum(ll.amount_usd_cents) filter (
           where je.kind = 'payment_captured' and ll.direction = 'debit' and je.occurred_at >= $3
         ), 0)::text as trailing_revenue,
         (select count(distinct je.reference_id)::text from journal_entries je
           where je.kind = 'payment_captured' and je.occurred_at >= $3) as trailing_paid_invoices
       from journal_entries je
       join ledger_lines ll on ll.entry_id = je.id
       join ledger_accounts la on la.id = ll.account_id`,
      [bounds.startOfYear, bounds.startOfMonth, bounds.ninetyDaysAgo],
    );

    const tiers = await this.executor.unsafe<Array<Record<string, string | number>>>(
      `with paid as (
         select distinct org_id from journal_entries where kind = 'payment_captured'
       ), latest_plan as (
         select distinct on (s.org_id) s.org_id, p.code
           from subscriptions s
           join plans p on p.id = s.plan_id
          where s.org_id in (select org_id from paid)
          order by s.org_id, (s.status = 'active') desc, s.created_at desc
       )
       select
         count(*) filter (where latest_plan.code = 'starter_scan')::text as sme,
         count(*) filter (where latest_plan.code = 'sacco_fintech_compliance')::text as sacco,
         count(*) filter (where latest_plan.code = 'enterprise_retainer')::text as enterprise
       from paid
       join latest_plan on latest_plan.org_id = paid.org_id`,
    );

    const planRows = await this.executor.unsafe<
      Array<{
        code: string | null;
        name: string;
        unit: string;
        monthly_usd_cents: string;
        gross: string;
      }>
    >(
      `select p.code, p.name, p.unit, p.monthly_usd_cents::text as monthly_usd_cents,
              coalesce(sum(il.quantity * il.unit_usd_cents), 0)::text as gross
         from invoices i
         join invoice_lines il on il.invoice_id = i.id
         left join plans p on p.code = il.plan_code
        where i.issued_at >= $1 and p.code is not null
        group by p.code, p.name, p.unit, p.monthly_usd_cents
        order by sum(il.quantity * il.unit_usd_cents) desc`,
      [bounds.ninetyDaysAgo],
    );

    return {
      grossYtdUsdCents: num(totals?.gross_ytd),
      revenueThisMonthUsdCents: num(totals?.this_month),
      paidClients: {
        sme: num(tiers[0]?.sme),
        sacco: num(tiers[0]?.sacco),
        enterprise: num(tiers[0]?.enterprise),
      },
      trailingRevenueUsdCents: num(totals?.trailing_revenue),
      trailingPaidInvoices: num(totals?.trailing_paid_invoices),
      plans: planRows.map((row) => ({
        code: row.code ?? 'other',
        name: row.name,
        unit: row.unit,
        monthlyUsdCents: num(row.monthly_usd_cents),
        grossUsdCents: num(row.gross),
      })),
    };
  }

  async transactions(since: Date, limit: number): Promise<TransactionRow[]> {
    const rows = await this.executor.unsafe<
      Array<{
        txn_code: string;
        created_at: Date | string;
        org_name: string;
        package_name: string | null;
        channel: string;
        usd_cents: string | number;
        status: string;
        refunded: string | number;
      }>
    >(
      `select pa.txn_code, pa.created_at, o.name as org_name,
              coalesce(il.description, i.title) as package_name,
              pa.channel::text as channel, pa.usd_cents::text as usd_cents,
              pa.status::text as status,
              coalesce((
                select sum(ll.amount_usd_cents)
                  from journal_entries je
                  join ledger_lines ll on ll.entry_id = je.id
                 where je.kind = 'refund'
                   and je.reference_type = 'payment_attempt'
                   and je.reference_id = pa.id
                   and ll.direction = 'debit'
              ), 0)::text as refunded
         from payment_attempts pa
         join invoices i on i.id = pa.invoice_id
         join organizations o on o.id = i.org_id
         left join lateral (
           select il.description from invoice_lines il
            where il.invoice_id = i.id
            order by (il.unit_usd_cents * il.quantity) desc
            limit 1
         ) il on true
        where pa.created_at >= $1 and pa.status <> 'failed'
        order by pa.created_at desc
        limit $2`,
      [since, limit],
    );
    return rows.map((row) => ({
      txnCode: row.txn_code,
      occurredAt: iso(row.created_at),
      client: row.org_name,
      packageName: row.package_name ?? '',
      channel: row.channel,
      amountUsdCents: num(row.usd_cents),
      status: row.status,
      refundedUsdCents: num(row.refunded),
    }));
  }

  async traffic(bounds: DateBounds): Promise<TrafficRaw> {
    const [window] = await this.executor.unsafe<Array<Record<string, string | number>>>(
      `select
         coalesce(sum(site_sessions) filter (where hour >= $1), 0)::text as site_sessions,
         coalesce(sum(site_sessions) filter (where hour >= $2 and hour < $1), 0)::text as previous_sessions,
         coalesce(sum(api_requests) filter (where hour >= $1), 0)::text as api_requests,
         coalesce(avg(avg_response_ms) filter (where hour >= $1), 0)::text as avg_response_ms,
         coalesce(max(p95_response_ms) filter (where hour >= $1), 0)::text as p95_response_ms
       from platform_metrics_hourly
      where hour >= $2`,
      [bounds.dayAgo, bounds.twoDaysAgo],
    );

    const hourlyRows = await this.executor.unsafe<
      Array<{ hour: Date | string; api_requests: string }>
    >(
      `select hour, api_requests::text as api_requests
         from platform_metrics_hourly
        where hour >= $1
        order by hour`,
      [bounds.dayAgo],
    );
    const hourly = bucketHourly(hourlyRows, bounds.dayAgo);

    const [endpoints] = await this.executor.unsafe<Array<{ count: string }>>(
      `select count(distinct endpoint)::text as count from endpoint_stats where window_start >= $1`,
      [bounds.dayAgo],
    );

    return {
      siteSessions: num(window?.site_sessions),
      previousSiteSessions: num(window?.previous_sessions),
      apiRequests: num(window?.api_requests),
      avgResponseMs: Math.round(num(window?.avg_response_ms)),
      p95ResponseMs: Math.round(num(window?.p95_response_ms)),
      endpointCount: num(endpoints?.count),
      hourly,
    };
  }

  async endpoints(since: Date, limit: number): Promise<EndpointRow[]> {
    const rows = await this.executor.unsafe<
      Array<{ endpoint: string; requests: string; avg_latency_ms: string; error_ratio: string }>
    >(
      `select endpoint, sum(requests)::text as requests,
              coalesce(avg(avg_latency_ms), 0)::text as avg_latency_ms,
              coalesce(avg(error_ratio), 0)::text as error_ratio
         from endpoint_stats
        where window_start >= $1
        group by endpoint
        order by sum(requests) desc
        limit $2`,
      [since, limit],
    );
    return rows.map((row) => ({
      endpoint: row.endpoint,
      requests: num(row.requests),
      avgLatencyMs: Math.round(num(row.avg_latency_ms)),
      errorRatio: Number(row.error_ratio),
    }));
  }

  async nodes(limit: number): Promise<NodesRaw> {
    const featured = await this.executor.unsafe<
      Array<{
        code: string;
        label: string;
        country: string;
        status: string;
        req_per_min: string | number;
        load_percent: string | number;
        heartbeat_latency_ms: string | number | null;
        clock_drift_ms: string | number | null;
      }>
    >(
      `select code, label, country, status::text as status, req_per_min, load_percent,
              heartbeat_latency_ms, clock_drift_ms
         from sensor_nodes
        order by req_per_min desc
        limit $1`,
      [limit],
    );
    const [counts] = await this.executor.unsafe<Array<{ online: string; total: string }>>(
      `select count(*) filter (where status <> 'offline')::text as online,
              count(*)::text as total
         from sensor_nodes`,
    );
    return {
      featured: featured.map((row) => ({
        code: row.code,
        label: row.label,
        country: row.country,
        status: row.status,
        reqPerMin: num(row.req_per_min),
        loadPercent: num(row.load_percent),
        heartbeatLatencyMs:
          row.heartbeat_latency_ms === null ? null : num(row.heartbeat_latency_ms),
        clockDriftMs: row.clock_drift_ms === null ? null : num(row.clock_drift_ms),
      })),
      online: num(counts?.online),
      total: num(counts?.total),
    };
  }

  async pipeline(bounds: DateBounds): Promise<PipelineRaw> {
    const [row] = await this.executor.unsafe<Array<Record<string, string | number>>>(
      `select
         count(*) filter (where status = 'queued')::text as pending_jobs,
         count(*) filter (where review_gate_state = 'in_review')::text as unreviewed_jobs,
         count(*) filter (where status = 'running')::text as running,
         count(*) filter (where status = 'completed')::text as completed,
         count(*) filter (where status = 'completed' and completed_at >= $1)::text as closed_last_7_days
       from scan_jobs`,
      [bounds.weekAgo],
    );
    return {
      pendingJobs: num(row?.pending_jobs),
      unreviewedJobs: num(row?.unreviewed_jobs),
      running: num(row?.running),
      completed: num(row?.completed),
      closedLast7Days: num(row?.closed_last_7_days),
    };
  }

  async runningScans(limit: number): Promise<RunningScanRow[]> {
    const rows = await this.executor.unsafe<
      Array<{
        job_code: string;
        target_host: string;
        scan_type: string;
        analyst_email: string | null;
        progress: number;
        eta_seconds: number | null;
      }>
    >(
      `select sj.job_code, sj.target_host, sj.scan_type::text as scan_type,
              p.email::text as analyst_email, sj.progress, sj.eta_seconds
         from scan_jobs sj
         left join profiles p on p.id = sj.analyst_id
        where sj.status = 'running'
        order by sj.started_at asc nulls last
        limit $1`,
      [limit],
    );
    return rows.map((row) => ({
      jobCode: row.job_code,
      targetHost: row.target_host,
      scanType: row.scan_type,
      analystEmail: row.analyst_email,
      progress: num(row.progress),
      etaSeconds: row.eta_seconds === null ? null : num(row.eta_seconds),
    }));
  }

  async threatSnapshot(): Promise<ThreatSnapshotRow | null> {
    const rows = await this.executor.unsafe<
      Array<{
        level: number;
        active_zero_days: number;
        critical_cves: number;
        unpatched_critical: number;
        weaponized_in_wild: number;
        threats_blocked_ytd: string | number;
        computed_at: Date | string;
      }>
    >(
      `select level, active_zero_days, critical_cves, unpatched_critical, weaponized_in_wild,
              threats_blocked_ytd::text as threats_blocked_ytd, computed_at
         from threat_level_snapshots
        order by computed_at desc
        limit 1`,
    );
    const row = rows[0];
    if (row === undefined) return null;
    return {
      level: num(row.level),
      activeZeroDays: num(row.active_zero_days),
      criticalCves: num(row.critical_cves),
      unpatchedCritical: num(row.unpatched_critical),
      weaponizedInWild: num(row.weaponized_in_wild),
      threatsBlockedYtd: num(row.threats_blocked_ytd),
      computedAt: iso(row.computed_at),
    };
  }

  async threatsBlockedByDay(since: Date): Promise<BlockedDayRow[]> {
    const rows = await this.executor.unsafe<Array<{ day: string; blocked: string }>>(
      `select to_char(date_trunc('day', hour), 'YYYY-MM-DD') as day,
              coalesce(sum(threats_blocked), 0)::text as blocked
         from platform_metrics_hourly
        where hour >= $1
        group by 1
        order by 1`,
      [since],
    );
    return rows.map((row) => ({ day: row.day, count: num(row.blocked) }));
  }
}

/**
 * The window as seven points at hours 0, 4, 8, 12, 16, 20 and 24.
 *
 * Point `i` aggregates the four hours STARTING at `i × 4` hours after the window
 * opens; the closing boundary (24) therefore carries nothing, and the seven
 * points sum to the window total. Labelling it anything else would double-count
 * the last block.
 */
export const HOURLY_POINTS = [0, 4, 8, 12, 16, 20, 24] as const;

export function bucketHourly(
  rows: Array<{ hour: Date | string; api_requests: string | number }>,
  windowStart: Date,
): HourlyPoint[] {
  const buckets = new Map<number, number>(HOURLY_POINTS.map((hour) => [hour, 0]));
  for (const row of rows) {
    const offsetHours = (new Date(row.hour).getTime() - windowStart.getTime()) / 3_600_000;
    if (offsetHours < 0 || offsetHours >= 24) continue;
    const boundary = (Math.floor(offsetHours / 4) * 4) as (typeof HOURLY_POINTS)[number];
    buckets.set(boundary, (buckets.get(boundary) ?? 0) + num(row.api_requests));
  }
  return HOURLY_POINTS.map((hour) => ({ hourUtc: hour, apiRequests: buckets.get(hour) ?? 0 }));
}

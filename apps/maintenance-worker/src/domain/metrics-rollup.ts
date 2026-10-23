import type {
  EndpointWindowRow,
  Logger,
  MaintenanceRepo,
  PlatformMetricsInput,
  Summary,
} from '../ports';

/**
 * `metrics_rollup` (Task 91) — the honest hourly rollup behind the Command
 * Center traffic chart.
 *
 * The window is the last COMPLETE hour: a partial hour would render as a
 * traffic collapse on the chart every time the worker runs. Re-runs for the
 * same hour UPSERT, so a retried job converges instead of double-counting.
 *
 * Two fields have no data source in v1 and are stored as 0 with a
 * TODO(backend-contract) marker rather than a plausible-looking invention
 * (Task 76's rule): `siteSessions` arrives with Cloudflare Logpush analytics
 * (Layer L13) and `threatsBlocked` has no producer table.
 *
 * `p95ResponseMs` is the MAX of the per-endpoint averages: `endpoint_stats`
 * stores window averages, not request samples, so a true p95 is not derivable
 * from what exists. The max endpoint-average is the conservative honest
 * approximation and the chart labels it as latency, not as a percentile
 * promise to the client.
 */

/** `[H-1, H)` — the last complete hour before `now`, truncated to the hour. */
export function rollupWindow(now: Date): { from: Date; to: Date } {
  const to = new Date(now);
  to.setUTCMinutes(0, 0, 0);
  const from = new Date(to.getTime() - 60 * 60 * 1000);
  return { from, to };
}

export interface RollupResult {
  siteSessions: number;
  apiRequests: number;
  avgResponseMs: number;
  p95ResponseMs: number;
  threatsBlocked: number;
}

/** Pure: the aggregate over the window's endpoint rows. */
export function computeRollup(rows: readonly EndpointWindowRow[]): RollupResult {
  let requests = 0;
  let latencyWeighted = 0;
  let maxAvgLatency = 0;
  for (const row of rows) {
    requests += row.requests;
    latencyWeighted += row.avgLatencyMs * row.requests;
    maxAvgLatency = Math.max(maxAvgLatency, row.avgLatencyMs);
  }
  return {
    // TODO(backend-contract): Cloudflare Logpush sessions (Layer L13).
    siteSessions: 0,
    apiRequests: requests,
    avgResponseMs: requests === 0 ? 0 : Math.round(latencyWeighted / requests),
    p95ResponseMs: maxAvgLatency,
    // TODO(backend-contract): no producer table exists for blocked threats.
    threatsBlocked: 0,
  };
}

export interface MetricsRollupDeps {
  repo: Pick<MaintenanceRepo, 'listEndpointWindows' | 'upsertPlatformMetrics'>;
  clock: { now(): Date };
  logger: Logger;
}

export async function runMetricsRollup(deps: MetricsRollupDeps): Promise<Summary> {
  const { from, to } = rollupWindow(deps.clock.now());
  const rows = await deps.repo.listEndpointWindows(from, to);
  const rollup: RollupResult = computeRollup(rows);

  const input: PlatformMetricsInput = { hour: from, ...rollup };
  await deps.repo.upsertPlatformMetrics(input);

  deps.logger.info('metrics rollup written', {
    hour: from.toISOString(),
    endpoints: rows.length,
    ...rollup,
  });
  return {
    task: 'metrics_rollup',
    affected: 1,
    detail: { hour: from.toISOString(), endpoints: rows.length, apiRequests: rollup.apiRequests },
  };
}

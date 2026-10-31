/**
 * The Analytics Engine writer (Task 99).
 *
 * Shape fixed by the consumer: the maintenance worker's `metrics_rollup`
 * (Task 91) reads dataset `vv_requests` as index1 = surface, blob1 = route
 * template, blob2 = method, double1 = latency ms, double2 = status. Changing
 * an offset here silently breaks that rollup, so the tests pin the arrays.
 *
 * Metrics are telemetry. A write failure is swallowed: the operator loses a
 * data point, never a response.
 */

export interface AnalyticsSink {
  writeDataPoint(point: { indexes?: string[]; blobs?: string[]; doubles?: number[] }): void;
}

export interface MetricPoint {
  template: string;
  method: string;
  latencyMs: number;
  status: number;
}

export function metricPayload(point: MetricPoint) {
  return {
    indexes: ['api'],
    blobs: [point.template, point.method],
    doubles: [point.latencyMs, point.status],
  };
}

export function writeMetric(sink: AnalyticsSink | undefined, point: MetricPoint): void {
  if (sink === undefined) return;
  try {
    sink.writeDataPoint(metricPayload(point));
  } catch {
    // Telemetry must never take down a response.
  }
}

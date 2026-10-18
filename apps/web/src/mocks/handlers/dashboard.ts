import { http, HttpResponse } from 'msw';
import {
  dashboardKpis,
  endpointStats,
  nodes,
  pipelineSummary,
  revenueSummary,
  runningScans,
  threatLevel,
  trafficSummary,
  transactions,
} from '@vunvault/contracts/fixtures/dashboard';

/**
 * Command Center dashboard mock handlers .
 *
 * Used ONLY by tests (through `mocks/server.ts`) and the opt-in dev mock
 * mode. The an earlier iteration catalog fixtures ARE the dashboard: every section
 * serves its fixture verbatim so the UI's formatting (USD, counts, stamps,
 * ETA, shares) is exercised against the documented values.
 *
 * Envelope rules mirror `apps/api` exactly: `transactions`, `nodes` and
 * `running-scans` carry their own `data` key and answer UNWRAPPED; every
 * other section answers `{ data: … }`. The `?refresh=1` / `?limit=` query
 * parameters do not change the fixture payload (path matching ignores the
 * query string) — they exist so tests can assert the client SENDS them.
 *
 * API contract mirrored here (implemented for real in `apps/api`, an earlier iteration):
 * GET /api/v1/admin/dashboard/{kpis|revenue|transactions|traffic|endpoints|
 *   nodes|pipeline|running-scans|threat-level}[?refresh=1] → 200 | 403
 */

export const dashboardHandlers = [
  http.get('*/api/v1/admin/dashboard/kpis', () => HttpResponse.json({ data: dashboardKpis })),
  http.get('*/api/v1/admin/dashboard/revenue', () => HttpResponse.json({ data: revenueSummary })),
  http.get('*/api/v1/admin/dashboard/transactions', () => HttpResponse.json(transactions)),
  http.get('*/api/v1/admin/dashboard/traffic', () => HttpResponse.json({ data: trafficSummary })),
  http.get('*/api/v1/admin/dashboard/endpoints', () => HttpResponse.json({ data: endpointStats })),
  http.get('*/api/v1/admin/dashboard/nodes', () => HttpResponse.json(nodes)),
  http.get('*/api/v1/admin/dashboard/pipeline', () => HttpResponse.json({ data: pipelineSummary })),
  http.get('*/api/v1/admin/dashboard/running-scans', () => HttpResponse.json(runningScans)),
  http.get('*/api/v1/admin/dashboard/threat-level', () => HttpResponse.json({ data: threatLevel })),
];

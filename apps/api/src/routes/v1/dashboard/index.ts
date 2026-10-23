import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  DashboardKpis,
  EndpointStat,
  NodesResponse,
  PipelineSummary,
  RevenueSummary,
  RunningScansResponse,
  ThreatLevel,
  TransactionsResponse,
  TrafficSummary,
} from '@vunvault/contracts';
import type { SqlExecutor } from '../../../audit/repo';
import { HttpError } from '../../../lib/http-error';
import { SqlDashboardRepo, type DashboardRepo } from './repo';
import { DashboardService } from './service';
import { readThrough, type DashboardCache } from './cache';

/**
 * The Command Center (Task 37).
 *
 * Nine GET endpoints, all staff-only, all AAL2, all `dashboard:read`, all cached
 * for fifteen seconds under `dash:<name>`. There is no write here: the dashboard
 * describes the platform, it does not change it.
 *
 * `?refresh=1` is the "Refresh Metrics" button — it bypasses the cached read and
 * overwrites the entry, so an operator looking at an incident is never staring at
 * a number that is fifteen seconds behind the one they need.
 */

/** `?refresh=1` only: `?refresh=false` is not a thing an operator types. */
const DashboardQuery = z.object({
  refresh: z.union([z.literal('1'), z.literal('true')]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const DEFAULT_TRANSACTION_LIMIT = 6;
export const DEFAULT_ENDPOINT_LIMIT = 6;
export const DEFAULT_NODE_LIMIT = 6;
export const DEFAULT_RUNNING_LIMIT = 5;

export interface DashboardRoutesOptions {
  /** Test seams. */
  repo?: DashboardRepo;
  cache?: DashboardCache;
  workerSlotsTotal?: number;
  now?: () => Date;
}

const dashboardRoutes: FastifyPluginAsync<DashboardRoutesOptions> = async (fastify, options) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  function repoFor(): DashboardRepo {
    if (options.repo !== undefined) return options.repo;
    if (!app.hasDecorator('db')) {
      throw new HttpError(503, 'service_unavailable', 'The dashboard is not available');
    }
    return new SqlDashboardRepo(app.db as unknown as SqlExecutor);
  }

  function serviceFor(): DashboardService {
    return new DashboardService({
      repo: repoFor(),
      workerSlotsTotal: options.workerSlotsTotal,
      now: options.now,
    });
  }

  function cacheFor(): DashboardCache | undefined {
    if (options.cache !== undefined) return options.cache;
    return app.hasDecorator('redis') ? (app.redis as unknown as DashboardCache) : undefined;
  }

  const guard = [app.authenticate, app.requireStaff, app.requirePermission('dashboard:read')];

  /**
   * One panel: parse the query, read through the cache, and answer with the
   * envelope. `wrapped` is false for the one shape (`TransactionsResponse`) that
   * already carries its own `data` key.
   */
  function panel<T>(
    path: string,
    name: string,
    response: z.ZodType<T>,
    load: (service: DashboardService, limit: number | undefined) => Promise<T>,
    wrapped = true,
  ): void {
    app.get(
      path,
      {
        preHandler: guard,
        schema: {
          querystring: DashboardQuery,
          response: { 200: wrapped ? z.object({ data: response }) : response },
        },
      },
      async (request: FastifyRequest) => {
        const query = DashboardQuery.parse(request.query);
        const { data } = await readThrough(
          cacheFor(),
          query.limit === undefined ? name : `${name}:${query.limit}`,
          () => load(serviceFor(), query.limit),
          { refresh: query.refresh !== undefined, log: app.log },
        );
        return wrapped ? { data } : (data as never);
      },
    );
  }

  panel('/admin/dashboard/kpis', 'kpis', DashboardKpis, (service) => service.kpis());
  panel('/admin/dashboard/revenue', 'revenue', RevenueSummary, (service) => service.revenue());
  panel(
    '/admin/dashboard/transactions',
    'transactions',
    TransactionsResponse,
    (service, limit) => service.transactions(limit ?? DEFAULT_TRANSACTION_LIMIT),
    // `TransactionsResponse` is `{ data, totals }` already.
    false,
  );
  panel('/admin/dashboard/traffic', 'traffic', TrafficSummary, (service) => service.traffic());
  panel('/admin/dashboard/endpoints', 'endpoints', z.array(EndpointStat), (service, limit) =>
    service.endpoints(limit ?? DEFAULT_ENDPOINT_LIMIT),
  );
  // `NodesResponse` carries its own `data` alongside the fleet counts.
  panel(
    '/admin/dashboard/nodes',
    'nodes',
    NodesResponse,
    (service, limit) => service.nodes(limit ?? DEFAULT_NODE_LIMIT),
    false,
  );
  panel('/admin/dashboard/pipeline', 'pipeline', PipelineSummary, (service) => service.pipeline());
  // As above: `{ data, shown, total }` is already the envelope.
  panel(
    '/admin/dashboard/running-scans',
    'running-scans',
    RunningScansResponse,
    (service, limit) => service.runningScans(limit ?? DEFAULT_RUNNING_LIMIT),
    false,
  );
  panel('/admin/dashboard/threat-level', 'threat-level', ThreatLevel, (service) =>
    service.threatLevel(),
  );
};

export default fp(dashboardRoutes, { name: 'dashboard-routes' });

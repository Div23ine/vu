/**
 * The dashboard's read-through cache.
 *
 * Every Command Center panel is an aggregate over the ledger, the scan queue and
 * the metrics rollup, and the page reloads itself on a timer. Fifteen seconds of
 * staleness buys the database a lot of quiet, so each panel is cached under
 * `dash:<name>`.
 *
 * `?refresh=1` — the "Refresh Metrics" button — bypasses the read and overwrites
 * the entry, so an operator who wants the current number can always get it.
 *
 * The cache is an optimisation and nothing more: if Redis is down, unreadable or
 * holding corrupt JSON, the panel is computed from the database instead. A
 * dashboard that fails because its cache failed is a dashboard nobody trusts.
 */

export const DASHBOARD_CACHE_PREFIX = 'dash:';
export const DASHBOARD_CACHE_TTL_SECONDS = 15;

/** The narrow Redis surface the cache needs (ioredis satisfies it). */
export interface DashboardCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', seconds: number): Promise<unknown>;
}

export interface ReadThroughOptions {
  /** `?refresh=1`: skip the read, overwrite the entry. */
  refresh?: boolean;
  ttlSeconds?: number;
  log?: { warn: (message: string, error?: unknown) => void };
}

export interface ReadThroughResult<T> {
  data: T;
  /** True when the value came out of Redis rather than being computed. */
  cached: boolean;
}

export function cacheKeyFor(name: string): string {
  return `${DASHBOARD_CACHE_PREFIX}${name}`;
}

/** Read `dash:<name>`, or compute it, store it and return it. */
export async function readThrough<T>(
  cache: DashboardCache | undefined,
  name: string,
  load: () => Promise<T>,
  options: ReadThroughOptions = {},
): Promise<ReadThroughResult<T>> {
  const key = cacheKeyFor(name);
  const ttl = options.ttlSeconds ?? DASHBOARD_CACHE_TTL_SECONDS;
  const warn = options.log?.warn.bind(options.log) ?? ((): undefined => undefined);

  if (cache !== undefined && options.refresh !== true) {
    try {
      const raw = await cache.get(key);
      if (raw !== null) return { data: JSON.parse(raw) as T, cached: true };
    } catch (error) {
      warn('dashboard cache read failed; computing instead', error);
    }
  }

  const data = await load();

  if (cache !== undefined) {
    try {
      await cache.set(key, JSON.stringify(data), 'EX', ttl);
    } catch (error) {
      warn('dashboard cache write failed', error);
    }
  }

  return { data, cached: false };
}

/** An in-memory cache for tests and for `NODE_ENV=test`. */
export function memoryCache(now: () => number = () => Date.now()): DashboardCache & {
  entries: Map<string, { value: string; expiresAt: number }>;
} {
  const entries = new Map<string, { value: string; expiresAt: number }>();
  return {
    entries,
    async get(key) {
      const entry = entries.get(key);
      if (entry === undefined) return null;
      if (entry.expiresAt <= now()) {
        entries.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key, value, _mode, seconds) {
      entries.set(key, { value, expiresAt: now() + seconds * 1000 });
      return 'OK';
    },
  };
}

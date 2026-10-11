import { createHash } from 'node:crypto';
import rateLimit from '@fastify/rate-limit';
import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { Redis } from 'ioredis';

/**
 * Rate limiting.
 *
 * A global 300 req/min per client IP is enforced by `@fastify/rate-limit` against
 * Redis (key prefix `rl:`). On top of that, named policies are enforced per route
 * through `config.rateLimitPolicy`, because each policy has its own window, its own
 * key and — for `login` — a second, coarser counter.
 */

export type RatePolicy = 'login' | 'public_form' | 'sensitive' | 'webhook';

export interface RateWindow {
  max: number;
  windowSeconds: number;
}

export const RATE_POLICIES: Record<RatePolicy, false | RateWindow> = {
  /** 5 attempts per minute per (ip, email) … */
  login: { max: 5, windowSeconds: 60 },
  /** … and 20 per 15 minutes per ip, so a sprayed list cannot rotate emails. */
  public_form: { max: 5, windowSeconds: 600 },
  sensitive: { max: 10, windowSeconds: 60 },
  webhook: false,
};

/** The coarse companion counter for `login`. */
export const LOGIN_IP_POLICY: RateWindow = { max: 20, windowSeconds: 900 };

export const GLOBAL_RATE_LIMIT: RateWindow = { max: 300, windowSeconds: 60 };
/** Namespace for the global limiter's keys and the prefix for policy counters. */
export const RATE_LIMIT_KEY_PREFIX = 'rl:';

/** Cloudflare and our own ingress hand off through these ranges. */
const TRUSTED_PEER_PREFIXES = [
  '10.',
  '127.',
  '172.16.',
  '172.17.',
  '172.18.',
  '172.19.',
  '172.2',
  '172.30.',
  '172.31.',
  '192.168.',
  '::1',
  'fc',
  'fd',
] as const;

export function isTrustedPeer(ip: string | undefined): boolean {
  if (ip === undefined) return false;
  if (ip === '::1' || ip === '127.0.0.1') return true;
  return TRUSTED_PEER_PREFIXES.some((prefix) => ip.startsWith(prefix));
}

/**
 * The client IP for rate-limit keys.
 *
 * `CF-Connecting-IP` is authoritative behind Cloudflare, but it is only trusted
 * when the immediate peer is one of ours — otherwise any client could set it.
 * Fastify's `request.ip` is a read-only getter, so the resolved value is exposed as
 * `request.clientIp` and used as the limiter key.
 */
/**
 * The three states of `request.originVerified` (Task 99): `true` — the edge
 * secret matched; `false` — this build enforces the origin lock and the
 * request did not carry it (it cannot choose its own rate-limit bucket);
 * `undefined` — no origin-verify plugin in this app (unit-test harnesses),
 * where the Task 23 trusted-peer rule stands on its own.
 */
export function resolveClientIp(request: FastifyRequest): string {
  const peer = request.socket?.remoteAddress;
  const cloudflare = request.headers['cf-connecting-ip'];
  if (
    isTrustedPeer(peer) &&
    request.originVerified !== false &&
    typeof cloudflare === 'string' &&
    cloudflare !== ''
  ) {
    return cloudflare;
  }
  return request.ip;
}

export function loginKey(ip: string, email: string): string {
  const digest = createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
  return `login:${ip}:${digest}`;
}

export interface CounterHit {
  count: number;
  resetSeconds: number;
}

export interface CounterStore {
  increment(key: string, windowSeconds: number): Promise<CounterHit>;
}

/** Redis-backed counter: `INCR` plus a first-write `EXPIRE`. */
export function redisCounterStore(redis: Redis, prefix = RATE_LIMIT_KEY_PREFIX): CounterStore {
  return {
    async increment(key, windowSeconds) {
      const fullKey = `${prefix}${key}`;
      const count = await redis.incr(fullKey);
      if (count === 1) await redis.expire(fullKey, windowSeconds);
      const ttl = await redis.ttl(fullKey);
      return { count, resetSeconds: ttl > 0 ? ttl : windowSeconds };
    },
  };
}

/** In-memory counter, used only when `NODE_ENV === "test"`. */
export function memoryCounterStore(now: () => number = () => Date.now()): CounterStore {
  const buckets = new Map<string, { count: number; expiresAt: number }>();
  return {
    async increment(key, windowSeconds) {
      const currentTime = now();
      const existing = buckets.get(key);
      if (existing === undefined || existing.expiresAt <= currentTime) {
        buckets.set(key, { count: 1, expiresAt: currentTime + windowSeconds * 1000 });
        return { count: 1, resetSeconds: windowSeconds };
      }
      existing.count += 1;
      return {
        count: existing.count,
        resetSeconds: Math.max(1, Math.ceil((existing.expiresAt - currentTime) / 1000)),
      };
    },
  };
}

export interface RateLimitPluginOptions {
  /** Test seam. */
  store?: CounterStore;
}

function readEmail(request: FastifyRequest): string | undefined {
  const body = request.body as { email?: unknown } | undefined;
  return typeof body?.email === 'string' ? body.email : undefined;
}

const rateLimitPlugin: FastifyPluginAsync<RateLimitPluginOptions> = async (app, options) => {
  const useRedis = app.env.NODE_ENV !== 'test' && app.redis !== undefined;

  await app.register(rateLimit, {
    global: true,
    max: GLOBAL_RATE_LIMIT.max,
    timeWindow: `${GLOBAL_RATE_LIMIT.windowSeconds} seconds`,
    nameSpace: RATE_LIMIT_KEY_PREFIX,
    keyGenerator: (request) => resolveClientIp(request),
    ...(useRedis ? { redis: app.redis } : {}),
    errorResponseBuilder: (_request, context) => ({
      error: 'rate_limited',
      message: `Too many requests. Try again in ${context.after}.`,
    }),
  });

  const store = options.store ?? (useRedis ? redisCounterStore(app.redis) : memoryCounterStore());

  app.decorateRequest('clientIp', '');
  app.addHook('onRequest', async (request) => {
    request.clientIp = resolveClientIp(request);
  });

  // Body-dependent keys (the login email) need the payload, so this is preHandler.
  app.addHook('preHandler', async (request, reply) => {
    const config = request.routeOptions?.config;
    const policyName = config?.rateLimitPolicy;
    if (policyName === undefined) return;

    const policy = RATE_POLICIES[policyName as RatePolicy];
    if (policy === false) return;

    const ip = request.clientIp === '' ? resolveClientIp(request) : request.clientIp;
    const windows: Array<{ key: string; window: RateWindow }> = [];

    if (policyName === 'login') {
      const email = readEmail(request);
      windows.push({ key: loginKey(ip, email ?? ''), window: policy });
      windows.push({ key: `login-ip:${ip}`, window: LOGIN_IP_POLICY });
    } else if (policyName === 'sensitive') {
      const user = request.user as { id?: string } | undefined;
      windows.push({ key: `sensitive:${user?.id ?? ip}`, window: policy });
    } else {
      windows.push({ key: `${policyName}:${ip}`, window: policy });
    }

    for (const { key, window } of windows) {
      const hit = await store.increment(key, window.windowSeconds);
      if (hit.count > window.max) {
        reply.header('retry-after', String(hit.resetSeconds));
        return reply.status(429).send({
          error: 'rate_limited',
          message: `Too many requests. Try again in ${hit.resetSeconds} seconds.`,
        });
      }
    }
  });
};

export default fp(rateLimitPlugin, { name: 'rate-limit' });

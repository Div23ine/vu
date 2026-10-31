import fp from 'fastify-plugin';
import Redis, { type RedisOptions } from 'ioredis';
import type { FastifyPluginAsync } from 'fastify';
import { REDIS_OPTIONALITY, type RedisOptionality } from '../config/env.js';
import { memoryRedis, MEMORY_STORE_CAVEAT } from '../lib/memory-redis.js';

/**
 * Upstash terminates TLS and BullMQ issues blocking commands, so both of these
 * options are mandatory: `maxRetriesPerRequest: null` lets a blocking call wait
 * indefinitely instead of erroring, and `enableReadyCheck: false` avoids a
 * handshake round trip on every reconnect. TLS follows the URL scheme:
 * `rediss://` (Upstash, production) negotiates it, plain `redis://` (local
 * development, sandbox boot verification) does not.
 */
export function redisOptionsFromUrl(url: string): RedisOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port === '' ? 6379 : Number(parsed.port),
    username: parsed.username === '' ? undefined : decodeURIComponent(parsed.username),
    password: parsed.password === '' ? undefined : decodeURIComponent(parsed.password),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
  };
}

// ---------------------------------------------------------------------------
// Revision 2 addendum, A3 — Redis offline mode.
//
// The catalogs make Redis mandatory (Task 22) and `SecretProvider.get` throws on
// a missing secret, so an absent `UPSTASH_REDIS_URL` used to be an unbootable
// API. A3 requires the system to run correctly with Redis absent AND to come
// back with zero code changes when the user re-enables it — so optionality is a
// single switch, resolved once at boot:
//
//   REDIS_OPTIONAL=never   Redis is required. Missing secret or an unreachable
//                          server is a FATAL boot failure (the catalog posture,
//                          and the safe default for a multi-replica deployment).
//   REDIS_OPTIONAL=always  Redis is always optional: fall back to the in-memory
//                          store in ANY environment, production included.
//   REDIS_OPTIONAL=auto    (default) optional outside production, required in
//                          production — a laptop with Redis switched off boots;
//                          a production deployment still fails loudly rather
//                          than silently degrading to single-instance state.
// ---------------------------------------------------------------------------

export { REDIS_OPTIONALITY };
export type { RedisOptionality };

/** Boot-probe budget. Long enough for a cold TLS handshake, short enough to boot. */
export const REDIS_PROBE_TIMEOUT_MS = 4000;

/** What `/health` reports, and what the boot log states once (A3.4). */
export interface RedisMode {
  /** `up` = a real Redis answered PING at boot. */
  status: 'up' | 'down';
  /** `memory` = the in-process fallback is serving auth state. */
  store: 'redis' | 'memory';
  /** Why we are offline. `null` when Redis is up. */
  reason: string | null;
}

export const REDIS_ONLINE: RedisMode = { status: 'up', store: 'redis', reason: null };

/** Is Redis allowed to be absent? Pure, so the rule is unit-testable. */
export function redisIsOptional(optionality: RedisOptionality, nodeEnv: string): boolean {
  if (optionality === 'always') return true;
  if (optionality === 'never') return false;
  return nodeEnv !== 'production';
}

export function offlineMode(reason: string): RedisMode {
  return { status: 'down', store: 'memory', reason };
}

/** The message a REQUIRED Redis turns into a boot refusal (A3: fail loudly). */
export function redisRequiredMessage(reason: string): string {
  return (
    `FATAL: Redis is required but unavailable (${reason}). Set REDIS_OPTIONAL=always to boot ` +
    `on the in-memory store (single instance only), or fix UPSTASH_REDIS_URL.`
  );
}

async function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Prove a server is really there before trusting it.
 *
 * The connection we intend to KEEP is probed (not a throwaway), so an online boot
 * opens exactly the one connection it always did and an offline boot opens no
 * socket that has to be torn down.
 *
 * `connect()` is valid only from ioredis's `wait` status. ioredis auto-connects
 * in its constructor (`lazyConnect` defaults to false) and queues commands issued
 * while connecting, so `ping()` alone proves the server. Calling `connect()` on an
 * already-connecting instance makes ioredis reject with
 * `Redis is already connecting/connected` — which failed this probe against a
 * perfectly healthy server, silently dropping the API to memory mode (and, in
 * production where Redis is required, refusing to boot). Found by running the
 * plugin against a real `redis-server` rather than the unit-test fake, which
 * implements `ping` alone and so could not exercise the path.
 */
async function probeRedis(connection: Redis, ms: number): Promise<void> {
  const connectable = connection as unknown as { connect?: () => Promise<unknown> };
  const alreadyConnecting = connection.status !== 'wait';
  const connect =
    !alreadyConnecting && typeof connectable.connect === 'function'
      ? connectable.connect()
      : Promise.resolve();
  await withTimeout(connect.then(() => connection.ping()), ms, 'redis probe');
}

export interface RedisPluginOptions {
  /** Test seam: inject the command connection. */
  redis?: Redis;
  /** Test seam: inject the resolved mode instead of probing. */
  mode?: RedisMode;
  /** Test seam: override the probe budget. */
  probeTimeoutMs?: number;
}

/**
 * Decorates `app.redis` (shared command connection), `app.createRedis()` and
 * `app.redisMode`.
 *
 * A pub/sub subscriber cannot share a command connection — once subscribed, the
 * connection only receives messages — so subscribers, BullMQ workers and anything
 * else that blocks must call `createRedis()` for their own. Every connection this
 * plugin hands out is closed on shutdown.
 *
 * Offline behaviour: `app.redis` is the in-memory shim rather than `undefined`, so
 * every existing consumer keeps one type and no call site needs a new branch. The
 * shim implements exactly the commands the auth paths use (see `memory-redis.ts`);
 * anything else throws loudly at the call site instead of pretending to work.
 */
const redisPlugin: FastifyPluginAsync<RedisPluginOptions> = async (app, options) => {
  const connections = new Set<Redis>();
  const probeTimeoutMs = options.probeTimeoutMs ?? REDIS_PROBE_TIMEOUT_MS;

  const optionality: RedisOptionality = app.env?.REDIS_OPTIONAL ?? 'auto';
  const nodeEnv = app.env?.NODE_ENV ?? 'development';
  const optional = redisIsOptional(optionality, nodeEnv);

  const shutdown = async (): Promise<void> => {
    for (const connection of connections) {
      try {
        await connection.quit();
      } catch {
        connection.disconnect();
      }
    }
    connections.clear();
  };

  /** Enter offline mode, or refuse to boot when Redis is not optional. */
  const goOffline = (reason: string): void => {
    if (!optional) throw new Error(redisRequiredMessage(reason));
    app.decorate('redis', memoryRedis());
    app.decorate('createRedis', (): Redis => memoryRedis());
    app.decorate('redisMode', offlineMode(reason));
    // A3.3: the caveat is logged on EVERY offline boot, at warn, with the reason.
    app.log.warn({ redis: 'down', store: 'memory', reason }, MEMORY_STORE_CAVEAT);
    app.addHook('onClose', shutdown);
  };

  // The URL is a secret; a missing one throws by design (Task 22). That throw is
  // the "Redis disabled" signal, not a bug — but only when Redis is optional.
  const url = await app.secrets.get('UPSTASH_REDIS_URL').catch((error: unknown) => {
    if (!optional) throw new Error(redisRequiredMessage(error instanceof Error ? error.message : String(error)));
    return undefined;
  });

  if (url === undefined) {
    goOffline('UPSTASH_REDIS_URL is not set');
    return;
  }

  const connectionOptions = redisOptionsFromUrl(url);

  if (options.redis !== undefined) {
    // Injected connection (tests): trusted as-is, no probe. The mode is recorded
    // honestly from what the caller declared.
    connections.add(options.redis);
    app.decorate('redis', options.redis);
    app.decorate('createRedis', (): Redis => {
      const connection = new Redis(connectionOptions);
      connections.add(connection);
      return connection;
    });
    app.decorate('redisMode', options.mode ?? REDIS_ONLINE);
    app.addHook('onClose', shutdown);
    return;
  }

  // Build the real command connection, then PROVE it answers before trusting it.
  // Probing the connection we intend to keep (rather than a throwaway) means an
  // offline boot opens no socket that has to be torn down, and an online boot
  // opens exactly the one connection it always did.
  const command = new Redis(connectionOptions);
  connections.add(command);

  try {
    await probeRedis(command, probeTimeoutMs);
  } catch (error) {
    connections.delete(command);
    try {
      command.disconnect();
    } catch {
      // Already down; nothing to release.
    }
    goOffline(error instanceof Error ? error.message : String(error));
    return;
  }

  app.decorate('redis', command);
  app.decorate('createRedis', (): Redis => {
    const connection = new Redis(connectionOptions);
    connections.add(connection);
    return connection;
  });
  app.decorate('redisMode', options.mode ?? REDIS_ONLINE);
  app.log.info({ redis: 'up', store: 'redis' }, 'redis online');

  app.addHook('onClose', shutdown);
};

export default fp(redisPlugin, { name: 'redis', dependencies: ['secrets'] });

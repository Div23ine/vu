import fp from 'fastify-plugin';
import Redis, { type RedisOptions } from 'ioredis';
import type { FastifyPluginAsync } from 'fastify';

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

export interface RedisPluginOptions {
  /** Test seam: inject the command connection. */
  redis?: Redis;
}

/**
 * Decorates `app.redis` (shared command connection) and `app.createRedis()`.
 *
 * A pub/sub subscriber cannot share a command connection — once subscribed, the
 * connection only receives messages — so subscribers, BullMQ workers and anything
 * else that blocks must call `createRedis()` for their own. Every connection this
 * plugin hands out is closed on shutdown.
 */
const redisPlugin: FastifyPluginAsync<RedisPluginOptions> = async (app, options) => {
  const connections = new Set<Redis>();

  const connectionOptions = redisOptionsFromUrl(await app.secrets.get('UPSTASH_REDIS_URL'));

  const command = options.redis ?? new Redis(connectionOptions);
  connections.add(command);

  app.decorate('redis', command);
  app.decorate('createRedis', (): Redis => {
    const connection = new Redis(connectionOptions);
    connections.add(connection);
    return connection;
  });

  app.addHook('onClose', async () => {
    for (const connection of connections) {
      try {
        await connection.quit();
      } catch {
        connection.disconnect();
      }
    }
    connections.clear();
  });
};

export default fp(redisPlugin, { name: 'redis', dependencies: ['secrets'] });

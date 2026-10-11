import { timingSafeEqual } from 'node:crypto';
import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { SecretProvider } from '../lib/secrets/provider';

/**
 * Origin verification — the API half of the edge origin lock (Task 99).
 *
 * Cloudflare fronts `api.<zone>` and the edge Worker (apps/edge) stamps every
 * proxied request with `x-origin-verify: <EDGE_ORIGIN_SECRET>`. In production
 * this plugin refuses any other path to the API: a request that reached the
 * load balancer directly — bypassing Cloudflare, its WAF, its rate limits and
 * its TLS posture — is exactly the request a security platform must not
 * serve. Two consequences worth stating:
 *
 *  1. `cf-connecting-ip` becomes trustworthy ONLY after this check passes
 *     (the rate-limit plugin reads `request.originVerified`); without the
 *     lock, a direct-to-LB client could pick its own rate-limit bucket.
 *  2. `GET /healthz` and `GET /readyz` are exempt: Kubernetes probes come
 *     from inside the cluster and will never carry the header.
 *
 * The comparison is constant-time and the failure log carries the request id
 * and nothing else — never a header value, received or expected.
 */

export const ORIGIN_VERIFY_HEADER = 'x-origin-verify';

/** Cluster probes are the only exempt paths (the route manifest's list). */
const EXEMPT: ReadonlySet<string> = new Set(['/healthz', '/readyz']);

/** How long a fetched secret is trusted before re-reading (rotation window). */
const SECRET_CACHE_MS = 5 * 60 * 1000;

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by this plugin when the edge secret matched. */
    originVerified?: boolean;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    originVerify: {
      /** Test seam: drop the cached secret. */
      invalidate(): void;
    };
  }
}

export interface OriginVerifyOptions {
  /** Test seam for the secret source; defaults to `app.secrets`. */
  secrets?: Pick<SecretProvider, 'get'>;
  /** Test seam for time. */
  now?: () => number;
}

function equalSecrets(received: string, expected: string): boolean {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const originVerifyPlugin: FastifyPluginAsync<OriginVerifyOptions> = async (app, options) => {
  const enforce = app.env.NODE_ENV === 'production' && app.env.ORIGIN_VERIFY_ENFORCE !== 'false';
  if (!enforce) {
    // Development/test: the header is meaningless and a hard failure would
    // make local runs impossible. Everything counts as verified here, so the
    // Task 23 IP derivation keeps its trusted-peer behaviour in harnesses.
    app.decorate('originVerify', { invalidate: () => undefined });
    app.decorateRequest('originVerified', true);
    return;
  }

  app.decorateRequest('originVerified', false);

  let cached: { value: string; at: number } | null = null;
  const now = options.now ?? Date.now;

  async function expectedSecret(): Promise<string | null> {
    if (cached !== null && now() - cached.at < SECRET_CACHE_MS) return cached.value;
    const secrets = options.secrets ?? app.secrets;
    try {
      const value = await secrets.get('EDGE_ORIGIN_SECRET');
      cached = { value, at: now() };
      return value;
    } catch (error) {
      // Fail CLOSED: an API that cannot read its origin secret must not
      // silently accept unverified traffic.
      app.log.error({ err: error }, 'could not read EDGE_ORIGIN_SECRET; refusing requests');
      return null;
    }
  }

  app.decorate('originVerify', {
    invalidate: () => {
      cached = null;
    },
  });

  app.addHook('onRequest', async (request: FastifyRequest, reply) => {
    // The query string never matters to the exemption, and a trailing slash
    // must not smuggle a request past it either way — compare the pathname.
    const pathname = request.url.split('?')[0] ?? request.url;
    if (request.method === 'GET' && EXEMPT.has(pathname)) return;

    const expected = await expectedSecret();
    const received = request.headers[ORIGIN_VERIFY_HEADER];
    if (
      expected === null ||
      typeof received !== 'string' ||
      received === '' ||
      !equalSecrets(received, expected)
    ) {
      // The request id is the only context in the log: enough to correlate,
      // never enough to leak either side of the secret.
      app.log.warn({ requestId: request.id }, 'request rejected: origin not verified');
      await reply.code(403).send({ error: 'forbidden' });
      return reply;
    }
    request.originVerified = true;
  });
};

export default fp(originVerifyPlugin, { name: 'origin-verify' });

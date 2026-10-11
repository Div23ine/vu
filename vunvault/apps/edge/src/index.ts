import { isAllowedMethod, isAllowedPath, sizeVerdict } from './policy';
import { routeTemplate } from './route-template';
import { writeMetric, type AnalyticsSink } from './metrics';

/**
 * vv-edge (Task 99) — the API reverse proxy on api.<zone>.
 *
 * The Worker's job is hygiene, not logic: allow-list the paths, cap the
 * declared sizes, scrub the headers a client must never set, stamp the shared
 * origin secret, and hand everything else to the origin UNTOUCHED. Two rules
 * carry the security model:
 *
 *  1. Inbound `x-origin-verify`, `x-forwarded-for`, `x-forwarded-host` and
 *     `x-real-ip` are DELETED before the upstream request is built, and the
 *     edge's own values are added. A client that sends `x-origin-verify` is
 *     trying to look like the edge; a client that sends `x-forwarded-for` is
 *     trying to pick its rate-limit bucket. Neither gets through.
 *  2. WebSocket upgrades and SSE streams are returned exactly as the origin
 *     produced them — no header rewriting, no body reading, no added
 *     timeouts. The audit tail (Task 93) and the scan terminal (Task 96) are
 *     long-lived streams; buffering or "improving" them breaks both.
 *
 * The secret itself lives in `wrangler secret put` (OCI Vault → CI), never in
 * wrangler.jsonc and never in this repository.
 */

export interface Env {
  /** Analytics Engine binding → dataset `vv_requests` (Task 91 reads it). */
  VV_REQUESTS?: AnalyticsSink;
  /** DNS-only hostname of the OKE load balancer. */
  ORIGIN_HOST: string;
  /** Shared with the API's origin-verify plugin. Worker secret. */
  EDGE_ORIGIN_SECRET: string;
}

export interface EdgeContext {
  waitUntil(promise: Promise<unknown>): void;
}

/** Headers a client must never be able to inject towards the origin. */
const STRIPPED_REQUEST_HEADERS = [
  'x-origin-verify',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-real-ip',
] as const;

const HSTS_VALUE = 'max-age=63072000; includeSubDomains; preload';

function jsonResponse(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function isUpgradeRequest(request: Request): boolean {
  return request.headers.get('upgrade')?.toLowerCase() === 'websocket';
}

function isSseRequest(request: Request): boolean {
  return (request.headers.get('accept') ?? '').includes('text/event-stream');
}

export function buildUpstreamRequest(request: Request, env: Env): Request {
  const url = new URL(request.url);
  const upstream = new URL(url.pathname + url.search, `https://${env.ORIGIN_HOST}`);

  const headers = new Headers(request.headers);
  for (const name of STRIPPED_REQUEST_HEADERS) headers.delete(name);
  headers.set('x-origin-verify', env.EDGE_ORIGIN_SECRET);
  headers.set('x-edge-request-id', crypto.randomUUID());

  // GET/HEAD carry no body; anything else is streamed through untouched.
  const init: RequestInit = { method: request.method, headers };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
    // A streamed body cannot be retried or inspected — and must not be.
    (init as RequestInit & { duplex?: string }).duplex = 'half';
  }
  return new Request(upstream, init);
}

export default {
  async fetch(request: Request, env: Env, ctx: EdgeContext): Promise<Response> {
    const startedAt = Date.now();
    const url = new URL(request.url);
    const template = routeTemplate(url.pathname);

    const finish = (response: Response): Response => {
      // Metrics after the response exists, off the critical path: the
      // dataset write must never delay (or break) the answer.
      ctx.waitUntil(
        Promise.resolve(
          writeMetric(env.VV_REQUESTS, {
            template,
            method: request.method,
            latencyMs: Date.now() - startedAt,
            status: response.status,
          }),
        ),
      );
      return response;
    };

    // 1 — the allow-list. Anything else does not exist at the edge.
    if (!isAllowedPath(url.pathname)) return finish(jsonResponse(404, 'not_found'));
    if (!isAllowedMethod(request.method)) {
      return finish(
        new Response(JSON.stringify({ error: 'method_not_allowed' }), {
          status: 405,
          headers: {
            'content-type': 'application/json',
            allow: 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS',
          },
        }),
      );
    }

    // 2 — declared-size caps (the body itself is never read here).
    if (sizeVerdict(url.pathname, request.headers.get('content-length')) === 'too_large') {
      return finish(jsonResponse(413, 'payload_too_large'));
    }

    // 3 — proxy. Network failure is a 502 with the envelope shape the API
    //     would have used; the client's error model keeps working.
    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(buildUpstreamRequest(request, env));
    } catch {
      return finish(jsonResponse(502, 'upstream_unavailable'));
    }

    // 4 — streams pass through EXACTLY as produced.
    if (isUpgradeRequest(request) || isSseRequest(request)) {
      return finish(upstreamResponse);
    }

    // 5 — ordinary responses gain the edge's two headers and nothing else.
    //    CORS stays the API's business; the Worker adds no `access-control-*`.
    const headers = new Headers(upstreamResponse.headers);
    headers.set('x-edge', 'vv');
    headers.set('strict-transport-security', HSTS_VALUE);
    return finish(
      new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers,
      }),
    );
  },
};

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker, { buildUpstreamRequest, type EdgeContext, type Env } from './index.js';
import { metricPayload } from './metrics.js';

/**
 * The edge Worker's behaviour (Task 99) with a fake upstream `fetch`, a fake
 * Analytics Engine sink and a collecting `waitUntil`. The assertions that
 * matter are the negative ones: what a client CANNOT inject, what the Worker
 * never reads, and what a metrics failure cannot do to a response.
 */

const ORIGIN_HOST = 'origin.vunvault.test';
const SECRET = 'edge-shared-secret-value';

function env(sink?: Env['VV_REQUESTS']): Env {
  return { ORIGIN_HOST, EDGE_ORIGIN_SECRET: SECRET, VV_REQUESTS: sink };
}

function context(): EdgeContext & { awaited: Promise<unknown>[] } {
  const awaited: Promise<unknown>[] = [];
  return {
    awaited,
    waitUntil(promise) {
      awaited.push(promise);
    },
  };
}

function request(path: string, init: RequestInit = {}): Request {
  return new Request(`https://api.vunvault.test${path}`, init);
}

let upstreamRequests: Request[] = [];
let upstreamResponse: Response = new Response('{"data":[]}', {
  status: 200,
  headers: { 'content-type': 'application/json' },
});
let upstreamError: Error | null = null;

const fetchMock = vi.fn(async (input: Request | string | URL): Promise<Response> => {
  if (upstreamError !== null) throw upstreamError;
  const req = input instanceof Request ? input : new Request(String(input));
  upstreamRequests.push(req);
  return upstreamResponse;
});

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  upstreamRequests = [];
  upstreamResponse = new Response('{"data":[]}', {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
  upstreamError = null;
  fetchMock.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('vv-edge — routing', () => {
  it('404s everything off the allow-list, /docs included, without touching the origin', async () => {
    for (const path of ['/admin', '/docs', '/docs/index.html', '/']) {
      const response = await worker.fetch(request(path), env(), context());
      expect(response.status, path).toBe(404);
      expect(await response.clone().json()).toEqual({ error: 'not_found' });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('405s a method outside the seven, with an Allow header', async () => {
    // undici refuses to construct a TRACE Request, so the handler gets a
    // structural stand-in — it only reads method/url/headers.
    const trace = {
      method: 'TRACE',
      url: 'https://api.vunvault.test/api/v1/auth/login',
      headers: new Headers(),
    } as unknown as Request;
    const response = await worker.fetch(trace, env(), context());
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toContain('GET');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('413s an oversize declared body, and webhook caps are tighter', async () => {
    const big = await worker.fetch(
      request('/api/v1/contact', { method: 'POST', headers: { 'content-length': '1048577' } }),
      env(),
      context(),
    );
    expect(big.status).toBe(413);

    const webhook = await worker.fetch(
      request('/api/v1/webhooks/stripe', {
        method: 'POST',
        headers: { 'content-length': '300000' },
      }),
      env(),
      context(),
    );
    expect(webhook.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('502s with the envelope shape when the origin is unreachable', async () => {
    upstreamError = new Error('econnrefused');
    const response = await worker.fetch(request('/healthz'), env(), context());
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'upstream_unavailable' });
  });
});

describe('vv-edge — header hygiene', () => {
  it('strips client-sent forwarding headers and stamps the edge secret', async () => {
    await worker.fetch(
      request('/api/v1/scans', {
        headers: {
          'x-origin-verify': 'guessed',
          'x-forwarded-for': '1.2.3.4',
          'x-forwarded-host': 'evil.example',
          'x-real-ip': '1.2.3.4',
        },
      }),
      env(),
      context(),
    );

    const upstream = upstreamRequests[0];
    if (upstream === undefined) throw new Error('no upstream request');
    expect(upstream.headers.get('x-origin-verify')).toBe(SECRET);
    expect(upstream.headers.get('x-forwarded-for')).toBeNull();
    expect(upstream.headers.get('x-forwarded-host')).toBeNull();
    expect(upstream.headers.get('x-real-ip')).toBeNull();
    expect(upstream.headers.get('x-edge-request-id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(new URL(upstream.url).host).toBe(ORIGIN_HOST);
    expect(new URL(upstream.url).protocol).toBe('https:');
  });

  it('adds x-edge and HSTS to ordinary responses and no CORS', async () => {
    const response = await worker.fetch(request('/api/v1/scans'), env(), context());
    expect(response.headers.get('x-edge')).toBe('vv');
    expect(response.headers.get('strict-transport-security')).toBe(
      'max-age=63072000; includeSubDomains; preload',
    );
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('vv-edge — pass-through streams', () => {
  it('returns a WebSocket upgrade response untouched', async () => {
    // undici cannot construct a 101 Response; the identity assertion is the
    // real contract — the handler must hand back the origin object as-is.
    const upgradeResponse = new Response(null, {
      status: 200,
      headers: { upgrade: 'websocket' },
    });
    upstreamResponse = upgradeResponse;
    const response = await worker.fetch(
      request('/api/v1/scans/x/stream', { headers: { upgrade: 'websocket' } }),
      env(),
      context(),
    );
    expect(response).toBe(upgradeResponse); // the SAME object — no rebuilding
    expect(response.headers.get('x-edge')).toBeNull();
  });

  it('returns an SSE response untouched', async () => {
    const sse = new Response('event: entry\ndata: {}\n\n', {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });
    upstreamResponse = sse;
    const response = await worker.fetch(
      request('/api/v1/admin/audit/stream', { headers: { accept: 'text/event-stream' } }),
      env(),
      context(),
    );
    expect(response).toBe(sse);
  });
});

describe('vv-edge — metrics', () => {
  it('writes the Task 91 dataset shape via waitUntil', async () => {
    const writeDataPoint = vi.fn();
    const ctx = context();
    await worker.fetch(
      request('/api/v1/scans/6f1c0a2e-9d4a-4e7b-8c2f-1a5d6e7f8090/stream'),
      env({ writeDataPoint }),
      ctx,
    );
    await Promise.all(ctx.awaited);

    expect(writeDataPoint).toHaveBeenCalledWith(
      metricPayload({
        template: '/api/v1/scans/:id/stream',
        method: 'GET',
        latencyMs: expect.any(Number) as unknown as number,
        status: 200,
      }),
    );
    const point = writeDataPoint.mock.calls[0]?.[0] as { indexes: string[]; blobs: string[] };
    expect(point.indexes).toEqual(['api']);
    expect(point.blobs).toEqual(['/api/v1/scans/:id/stream', 'GET']);
  });

  it('a throwing sink never changes the response', async () => {
    const ctx = context();
    const response = await worker.fetch(
      request('/healthz'),
      env({
        writeDataPoint: () => {
          throw new Error('analytics down');
        },
      }),
      ctx,
    );
    await Promise.all(ctx.awaited);
    expect(response.status).toBe(200);
  });

  it('metrics still record edge refusals (404/405/413)', async () => {
    const writeDataPoint = vi.fn();
    const ctx = context();
    await worker.fetch(request('/admin'), env({ writeDataPoint }), ctx);
    await Promise.all(ctx.awaited);
    expect(writeDataPoint).toHaveBeenCalledWith(
      expect.objectContaining({ doubles: [expect.any(Number), 404] }),
    );
  });
});

describe('buildUpstreamRequest', () => {
  it('preserves method, query and body streaming for mutations', () => {
    const original = request('/api/v1/auth/login?x=1', {
      method: 'POST',
      body: '{"email":"a@b.c"}',
      headers: { 'content-type': 'application/json' },
    });
    const upstream = buildUpstreamRequest(original, env());
    expect(upstream.method).toBe('POST');
    expect(new URL(upstream.url).search).toBe('?x=1');
    expect(upstream.body).not.toBeNull();
    expect(upstream.headers.get('content-type')).toBe('application/json');
  });

  it('never attaches a body to GET or HEAD', () => {
    for (const method of ['GET', 'HEAD']) {
      const upstream = buildUpstreamRequest(request('/healthz', { method }), env());
      expect(upstream.body).toBeNull();
    }
  });
});

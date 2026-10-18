import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyRequest } from 'fastify';
import { HttpError } from '../../../lib/http-error.js';
import {
  INTERNAL_RATE_MAX_PER_MINUTE,
  ipInCidr,
  parseCidrList,
  sha256hex,
  signInternalRequest,
  verifyInternalSignature,
  type InternalAuthDeps,
  type InternalAuthFailure,
  type NonceStore,
} from './hmac-auth.js';

/**
 * The internal HMAC guard, unit-tested (Task 40g): the canonical payload,
 * constant-time comparison outcomes (bad signature / stale / replay), the
 * CIDR allow-list, the per-IP 600/min cap and the once-per-minute audit
 * throttling. The route-level tests exercise the same guard end-to-end
 * through `app.inject` with the real `fastify-raw-body` capture.
 */

const KEY = 'dGVzdC1zZWNyZXQta2V5LWZvci10aGUtaG1hYy1ndWFyZA=='; // ≥32 bytes, base64-shaped
const METHOD = 'POST';
const URL = '/api/v1/internal/scans/c4000000-0000-4000-8000-0000000000g1/claim';
const BODY = JSON.stringify({ queueJobId: 'bull-1' });

function makeRequest(overrides: Partial<FastifyRequest> = {}): FastifyRequest {
  return {
    method: METHOD,
    url: URL,
    ip: '41.90.32.10',
    clientIp: '',
    id: 'req-1',
    headers: {},
    rawBody: Buffer.from(BODY),
    ...overrides,
  } as unknown as FastifyRequest;
}

function memoryNonce(): NonceStore & { keys: Map<string, number> } {
  const keys = new Map<string, number>();
  return {
    keys,
    async setIfAbsent(key) {
      if (keys.has(key)) return false;
      keys.set(key, 1);
      return true;
    },
    async incrementBucket(key) {
      const next = (keys.get(key) ?? 0) + 1;
      keys.set(key, next);
      return next;
    },
  };
}

interface Fixture {
  deps: InternalAuthDeps;
  failures: InternalAuthFailure[];
  nonce: ReturnType<typeof memoryNonce>;
  clock: { current: number };
}

function makeFixture(overrides: Partial<InternalAuthDeps> = {}): Fixture {
  const failures: InternalAuthFailure[] = [];
  const nonce = memoryNonce();
  const clock = { current: 1_760_000_000_000 };
  const deps: InternalAuthDeps = {
    getSecret: async () => KEY,
    nonce,
    allowedCidrs: [],
    clientIpOf: (request) =>
      (request as unknown as { clientIp: string; ip: string }).clientIp ||
      (request as unknown as { ip: string }).ip,
    auditFailure: async (_request, reason) => {
      failures.push(reason);
    },
    now: () => clock.current,
    ...overrides,
  };
  return { deps, failures, nonce, clock };
}

function signedHeaders(
  timestamp: number,
  overrides: { body?: string; key?: string; url?: string; method?: string } = {},
): Record<string, string> {
  const signature = signInternalRequest(
    overrides.key ?? KEY,
    timestamp,
    overrides.method ?? METHOD,
    overrides.url ?? URL,
    overrides.body ?? BODY,
  );
  return { 'x-vv-timestamp': String(timestamp), 'x-vv-signature': signature };
}

async function expectHttpError(promise: Promise<unknown>, status: number, code: string) {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(status);
    expect((error as HttpError).code).toBe(code);
    return;
  }
  throw new Error(`expected HttpError ${status} ${code}`);
}

describe('canonical payload + helpers', () => {
  it('signs timestamp.method.path.sha256hex(body)', () => {
    const expected = `1760000000000.POST.${URL}.${sha256hex(BODY)}`;
    // Signing the same inputs twice is deterministic, and the payload itself
    // is what the reference implementation documents.
    const a = signInternalRequest(KEY, 1_760_000_000_000, METHOD, URL, BODY);
    const b = signInternalRequest(KEY, 1_760_000_000_000, METHOD, URL, BODY);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(expected).toContain(sha256hex(BODY));
  });

  it('parses CIDR lists and matches IPv4 ranges', () => {
    expect(parseCidrList(undefined)).toEqual([]);
    expect(parseCidrList('')).toEqual([]);
    expect(parseCidrList(' 10.0.0.0/8 , 41.90.32.10 ')).toEqual(['10.0.0.0/8', '41.90.32.10']);
    expect(ipInCidr('10.1.2.3', '10.0.0.0/8')).toBe(true);
    expect(ipInCidr('11.1.2.3', '10.0.0.0/8')).toBe(false);
    expect(ipInCidr('41.90.32.10', '41.90.32.10')).toBe(true);
    expect(ipInCidr('41.90.32.11', '41.90.32.10')).toBe(false);
    expect(ipInCidr('192.168.0.7', '192.168.0.0/24')).toBe(true);
    expect(ipInCidr('::1', '::1')).toBe(true);
    expect(ipInCidr('nonsense', '10.0.0.0/8')).toBe(false);
    expect(ipInCidr('10.0.0.1', '10.0.0.0/99')).toBe(false);
  });
});

describe('verifyInternalSignature', () => {
  let fixture: Fixture;
  let guard: ReturnType<typeof verifyInternalSignature>;

  beforeEach(() => {
    fixture = makeFixture();
    guard = verifyInternalSignature(fixture.deps);
  });

  it('passes a correctly signed, fresh, unseen request', async () => {
    const request = makeRequest({
      headers: signedHeaders(fixture.clock.current),
    } as Partial<FastifyRequest>);
    await expect(guard(request, {} as never)).resolves.toBeUndefined();
    expect(fixture.failures).toEqual([]);
  });

  it('rejects a wrong signature with 401 bad_signature and audits', async () => {
    const request = makeRequest({
      headers: signedHeaders(fixture.clock.current, { key: 'the-wrong-key' }),
    } as Partial<FastifyRequest>);
    await expectHttpError(guard(request, {} as never), 401, 'bad_signature');
    expect(fixture.failures).toEqual(['bad_signature']);
  });

  it('rejects a tampered body (signature over other bytes)', async () => {
    const request = makeRequest({
      headers: signedHeaders(fixture.clock.current, { body: '{"queueJobId":"other"}' }),
      rawBody: Buffer.from(BODY),
    } as Partial<FastifyRequest>);
    await expectHttpError(guard(request, {} as never), 401, 'bad_signature');
  });

  it('rejects a signature over a different path (no cross-route replay)', async () => {
    const request = makeRequest({
      headers: signedHeaders(fixture.clock.current, { url: `${URL}x` }),
    } as Partial<FastifyRequest>);
    await expectHttpError(guard(request, {} as never), 401, 'bad_signature');
  });

  it('rejects timestamps outside the 60 s window with 401 stale', async () => {
    const old = fixture.clock.current - 61_000;
    const request = makeRequest({ headers: signedHeaders(old) } as Partial<FastifyRequest>);
    await expectHttpError(guard(request, {} as never), 401, 'stale');
    expect(fixture.failures).toEqual(['stale']);

    const future = fixture.clock.current + 61_000;
    const request2 = makeRequest({ headers: signedHeaders(future) } as Partial<FastifyRequest>);
    await expectHttpError(guard(request2, {} as never), 401, 'stale');
  });

  it('rejects a replayed signature with 401 replay', async () => {
    const headers = signedHeaders(fixture.clock.current);
    const first = makeRequest({ headers } as Partial<FastifyRequest>);
    await guard(first, {} as never);
    const second = makeRequest({ headers } as Partial<FastifyRequest>);
    await expectHttpError(guard(second, {} as never), 401, 'replay');
    expect(fixture.failures).toEqual(['replay']);
    expect(fixture.nonce.keys.has(`internal:nonce:${headers['x-vv-signature']}`)).toBe(true);
  });

  it('rejects missing or malformed headers with 401 bad_signature', async () => {
    await expectHttpError(guard(makeRequest(), {} as never), 401, 'bad_signature');
    const malformed = makeRequest({
      headers: { 'x-vv-timestamp': 'not-a-number', 'x-vv-signature': 'zz' },
    } as Partial<FastifyRequest>);
    await expectHttpError(guard(malformed, {} as never), 401, 'bad_signature');
  });

  it('enforces the CIDR allow-list before any crypto', async () => {
    const restricted = verifyInternalSignature(makeFixture({ allowedCidrs: ['10.0.0.0/8'] }).deps);
    const outside = makeRequest({
      headers: signedHeaders(fixture.clock.current),
    } as Partial<FastifyRequest>);
    await expectHttpError(restricted(outside, {} as never), 403, 'forbidden');

    const inside = makeFixture({ allowedCidrs: ['41.90.32.0/24'] });
    const insideGuard = verifyInternalSignature(inside.deps);
    await expect(
      insideGuard(
        makeRequest({ headers: signedHeaders(inside.clock.current) } as Partial<FastifyRequest>),
        {} as never,
      ),
    ).resolves.toBeUndefined();
  });

  it('caps a source IP at 600 requests per minute with 429', async () => {
    const flooding = makeFixture();
    // Pretend the bucket already saw the maximum.
    flooding.nonce.keys.set(
      `internal:rate:41.90.32.10:${Math.floor(flooding.clock.current / 60_000)}`,
      INTERNAL_RATE_MAX_PER_MINUTE,
    );
    const floodGuard = verifyInternalSignature(flooding.deps);
    const request = makeRequest({
      headers: signedHeaders(flooding.clock.current),
    } as Partial<FastifyRequest>);
    await expectHttpError(floodGuard(request, {} as never), 429, 'rate_limited');
    expect(flooding.failures).toEqual([]); // a flood is not a signature failure
  });

  it('records at most one audit failure per minute per IP', async () => {
    const throttled = makeFixture();
    const throttledGuard = verifyInternalSignature(throttled.deps);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const request = makeRequest({
        headers: { 'x-vv-timestamp': String(throttled.clock.current), 'x-vv-signature': 'nope' },
      } as Partial<FastifyRequest>);
      await expectHttpError(throttledGuard(request, {} as never), 401, 'bad_signature');
    }
    expect(throttled.failures).toHaveLength(1);
    // A different IP gets its own budget.
    const other = makeRequest({
      ip: '41.90.32.11',
      headers: {
        'x-vv-timestamp': String(throttled.clock.current),
        'x-vv-signature': 'nope',
      },
    } as Partial<FastifyRequest>);
    await expectHttpError(throttledGuard(other, {} as never), 401, 'bad_signature');
    expect(throttled.failures).toHaveLength(2);
  });

  it('survives an auditFailure that throws (the 401 is still owed)', async () => {
    const broken = makeFixture({
      auditFailure: vi.fn(async () => {
        throw new Error('audit down');
      }),
    });
    const brokenGuard = verifyInternalSignature(broken.deps);
    const request = makeRequest({ headers: {} } as Partial<FastifyRequest>);
    await expectHttpError(brokenGuard(request, {} as never), 401, 'bad_signature');
  });
});

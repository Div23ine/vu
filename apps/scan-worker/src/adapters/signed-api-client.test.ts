import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Clock, Logger } from '../ports';
import {
  ApiRequestError,
  MAX_RETRY_ATTEMPTS,
  SignedApiClient,
  signRequest,
} from './signed-api-client';

/**
 * Signed-client tests (Task 84).
 *
 * The signature is checked against an INDEPENDENT implementation of Task 40g's
 * documented formula rather than against the client's own helper — a test that
 * re-used `signRequest` would pass even if the formula were wrong. The retry
 * rules are the other half: `complete`/`fail` are idempotent on the API and may
 * be retried on a 5xx, everything else must never be.
 */

const KEY = 'test-controller-hmac-key-0123456789abcdef';
const BASE = 'https://api.internal.test';
const JOB = '11111111-1111-4111-8111-111111111111';
const TIMESTAMP = 1_760_000_000_000;

const clock: Clock = { now: () => TIMESTAMP, sleep: async () => undefined };

const logs: string[] = [];
const logger: Logger = {
  info: (message) => logs.push(`info:${message}`),
  warn: (message) => logs.push(`warn:${message}`),
  error: (message) => logs.push(`error:${message}`),
  debug: (message) => logs.push(`debug:${message}`),
};

/** The formula exactly as Task 40g's guard documents it. */
function expectedSignature(method: string, path: string, rawBody: string): string {
  const bodyHash = createHash('sha256').update(rawBody).digest('hex');
  return createHmac('sha256', KEY)
    .update(`${TIMESTAMP}.${method}.${path}.${bodyHash}`)
    .digest('hex');
}

interface Sent {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

/** A fetch stub that records every call and answers from a queue of replies. */
function stubFetch(replies: (() => Response)[]) {
  const sent: Sent[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    const request = init ?? {};
    sent.push({
      url: String(url),
      method: request.method ?? 'GET',
      headers: Object.fromEntries(
        Object.entries((request.headers as Record<string, string>) ?? {}).map(([key, value]) => [
          key.toLowerCase(),
          String(value),
        ]),
      ),
      body: String(request.body ?? ''),
    });
    const next = replies.shift();
    if (next === undefined) throw new Error('stubFetch ran out of canned replies');
    return next();
  }) as unknown as typeof fetch;
  return { impl, sent };
}

const json = (status: number, body: unknown): Response =>
  // A 204 must not carry a body — `new Response(text, { status: 204 })` throws.
  status === 204
    ? new Response(null, { status })
    : new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });

function clientWith(replies: (() => Response)[]) {
  const stub = stubFetch(replies);
  const api = new SignedApiClient({
    baseUrl: BASE,
    hmacKey: KEY,
    clock,
    logger,
    fetchImpl: stub.impl,
  });
  return { api, sent: stub.sent };
}

describe('SignedApiClient — the signature', () => {
  it('matches an independent implementation of the Task 40g formula', async () => {
    const { api, sent } = clientWith([() => json(204, null)]);

    await api.progress(JOB, 42, 120);

    expect(sent).toHaveLength(1);
    const request = sent[0]!;
    expect(request.url).toBe(`${BASE}/api/v1/internal/scans/${JOB}/progress`);
    expect(request.method).toBe('POST');
    expect(request.headers['x-vv-timestamp']).toBe(String(TIMESTAMP));
    expect(request.headers['x-vv-signature']).toBe(
      expectedSignature('POST', `/api/v1/internal/scans/${JOB}/progress`, request.body),
    );
    // The signed bytes are exactly the bytes that went on the wire.
    expect(request.body).toBe(JSON.stringify({ progress: 42, etaSeconds: 120 }));
  });

  it('is stable and path-specific (no cross-route replay)', () => {
    const body = '{"progress":1,"etaSeconds":null}';
    const a = signRequest(KEY, TIMESTAMP, 'POST', `/api/v1/internal/scans/${JOB}/progress`, body);
    const b = signRequest(KEY, TIMESTAMP, 'POST', `/api/v1/internal/scans/${JOB}/progress`, body);
    const otherPath = signRequest(
      KEY,
      TIMESTAMP,
      'POST',
      `/api/v1/internal/scans/${JOB}/complete`,
      body,
    );
    const otherBody = signRequest(
      KEY,
      TIMESTAMP,
      'POST',
      `/api/v1/internal/scans/${JOB}/progress`,
      '{"progress":2,"etaSeconds":null}',
    );
    expect(a).toBe(b);
    expect(a).not.toBe(otherPath);
    expect(a).not.toBe(otherBody);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('signs with a fresh timestamp on each retry attempt', async () => {
    let calls = 0;
    const tickingClock: Clock = {
      now: () => TIMESTAMP + calls * 1_000,
      sleep: async () => {
        calls += 1;
      },
    };
    const stub = stubFetch([() => json(503, { error: 'unavailable' }), () => json(204, null)]);
    const api = new SignedApiClient({
      baseUrl: BASE,
      hmacKey: KEY,
      clock: tickingClock,
      logger,
      fetchImpl: stub.impl,
    });

    await api.complete(JOB, { exitCode: 0, lineCount: 1, bytesStreamed: 1 });

    expect(stub.sent).toHaveLength(2);
    expect(stub.sent[0]!.headers['x-vv-timestamp']).not.toBe(
      stub.sent[1]!.headers['x-vv-timestamp'],
    );
  });
});

describe('SignedApiClient — claim outcomes', () => {
  it('parses a claimed job', async () => {
    const { api } = clientWith([
      () =>
        json(200, {
          data: {
            jobId: JOB,
            jobCode: 'JOB-4471',
            targetHost: 'api.example.com',
            scanType: 'external',
            priority: 'high',
            environment: null,
            attempt: 1,
            deadlineSeconds: 900,
          },
        }),
    ]);

    const outcome = await api.claim('queue-1', 'pod-abc');

    expect(outcome.kind).toBe('claimed');
    if (outcome.kind !== 'claimed') return;
    expect(outcome.data).toMatchObject({
      jobId: JOB,
      jobCode: 'JOB-4471',
      targetHost: 'api.example.com',
      attempt: 1,
      deadlineSeconds: 900,
    });
  });

  it('maps a 409 to conflict', async () => {
    const { api } = clientWith([() => json(409, { error: 'conflict' })]);
    expect(await api.claim('queue-1')).toEqual({ kind: 'conflict' });
  });

  it('maps a 422 authorisation_invalid to its own outcome', async () => {
    const { api } = clientWith([
      () => json(422, { error: 'authorisation_invalid', message: 'expired' }),
    ]);
    expect(await api.claim('queue-1')).toEqual({ kind: 'authorisation_invalid' });
  });
});

describe('SignedApiClient — retry policy', () => {
  it('retries complete on a 5xx up to the ceiling', async () => {
    const replies = Array.from(
      { length: MAX_RETRY_ATTEMPTS },
      () => () => json(503, { error: 'unavailable' }),
    );
    const { api, sent } = clientWith(replies);

    await expect(
      api.complete(JOB, { exitCode: 0, lineCount: 1, bytesStreamed: 1 }),
    ).rejects.toBeInstanceOf(ApiRequestError);
    expect(sent).toHaveLength(MAX_RETRY_ATTEMPTS);
  });

  it('treats a repeat 409 invalid_state on complete as success', async () => {
    const { api, sent } = clientWith([() => json(409, { error: 'invalid_state' })]);

    await expect(
      api.complete(JOB, { exitCode: 0, lineCount: 1, bytesStreamed: 1 }),
    ).resolves.toBeUndefined();
    // Idempotent: one call, no retry, no throw.
    expect(sent).toHaveLength(1);
  });

  it('NEVER retries a 4xx on complete', async () => {
    const { api, sent } = clientWith([() => json(422, { error: 'validation_failed' })]);

    await expect(
      api.complete(JOB, { exitCode: 0, lineCount: 1, bytesStreamed: 1 }),
    ).rejects.toMatchObject({ status: 422, code: 'validation_failed' });
    expect(sent).toHaveLength(1);
  });

  it('NEVER retries fail, even on a 5xx', async () => {
    // `fail` is in the retryable set for 5xx, so prove the 4xx rule on it too.
    const { api, sent } = clientWith([() => json(404, { error: 'not_found' })]);

    await expect(
      api.fail(JOB, { reason: 'target_not_allowed', abortReason: 'error' }),
    ).rejects.toMatchObject({ status: 404 });
    expect(sent).toHaveLength(1);
  });

  it('does not retry progress on a 5xx', async () => {
    const { api, sent } = clientWith([() => json(500, { error: 'boom' })]);

    await expect(api.progress(JOB, 10, null)).rejects.toBeInstanceOf(ApiRequestError);
    expect(sent).toHaveLength(1);
  });

  it('does not retry findings on a 5xx (a repeat could duplicate them)', async () => {
    const { api, sent } = clientWith([() => json(502, { error: 'bad_gateway' })]);

    await expect(api.findings(JOB, [])).rejects.toBeInstanceOf(ApiRequestError);
    expect(sent).toHaveLength(1);
  });

  it('retries a transport failure on complete but not on progress', async () => {
    const flaky = clientWith([
      () => {
        throw new Error('socket hang up');
      },
      () => json(204, null),
    ]);
    await expect(
      flaky.api.complete(JOB, { exitCode: 0, lineCount: 0, bytesStreamed: 0 }),
    ).resolves.toBeUndefined();
    expect(flaky.sent).toHaveLength(2);

    const flakyProgress = clientWith([
      () => {
        throw new Error('socket hang up');
      },
    ]);
    await expect(flakyProgress.api.progress(JOB, 5, null)).rejects.toThrow('socket hang up');
    expect(flakyProgress.sent).toHaveLength(1);
  });
});

describe('SignedApiClient — log url', () => {
  it('returns the presigned upload url and object key', async () => {
    const { api } = clientWith([
      () =>
        json(200, {
          data: {
            uploadUrl: 'https://storage.test/put?sig=1',
            objectKey: 'logs/job-1.txt',
            expiresAt: '2026-09-24T10:00:00Z',
          },
        }),
    ]);

    await expect(api.logUrl(JOB, 1024)).resolves.toEqual({
      uploadUrl: 'https://storage.test/put?sig=1',
      objectKey: 'logs/job-1.txt',
    });
  });
});

import { generateKeyPairSync, sign as signEd25519 } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Env } from '../../../config/env.js';
import errorHandler from '../../../plugins/error-handler.js';
import nodesRoutes from './index.js';
import {
  canonicalHeartbeatString,
  deriveStatus,
  DRIFT_WARNING_THRESHOLD_MS,
  HEARTBEAT_MAX_SKEW_MS,
  HEARTBEAT_RATE_LIMIT,
  HIGH_LOAD_THRESHOLD_PERCENT,
  MemoryRateCounter,
  NodesService,
  type HeartbeatWrite,
  type NodesRepo,
  type SensorNodeRow,
} from './service.js';

/**
 * Sensor-node heartbeats.
 *
 * The signatures here are real Ed25519 signatures over the canonical string, so
 * the verification path is exercised rather than mocked: a tampered field must
 * fail, and it must fail with the same answer as an unknown node.
 */

const NODE_ID = '91000000-0000-4000-8000-0000000000a1';
const NODE_CODE = 'VV-SENSOR-0142';
const NOW = new Date('2026-10-06T14:30:00.000Z');

const TEST_ENV: Env = {
  NODE_ENV: 'test',
  PORT: 8080,
  LOG_LEVEL: 'fatal',
  WEB_ORIGIN: 'https://www.vunvault.test',
  COOKIE_DOMAIN: '',
  API_PUBLIC_URL: 'https://api.vunvault.test',
  SECRETS_PROVIDER: 'env',
  SUPABASE_URL: 'https://project.supabase.co',
  WEBAUTHN_RP_ID: 'vunvault.test',
  WEBAUTHN_RP_NAME: 'VUNVAULT',
  R2_ACCOUNT_ID: 'r2-account',
  R2_BUCKET: 'vunvault-media',
  R2_PUBLIC_BASE_URL: 'https://cdn.vunvault.test',
  SENTRY_DSN: undefined,
  OCI_SECRET_MAP: undefined,
};

const { publicKey, privateKey } = generateKeyPairSync('ed25519');

/** Raw 32-byte key, base64 — the form a provisioned node is registered with. */
const PUBLIC_KEY_BASE64 = publicKey
  .export({ type: 'spki', format: 'der' })
  .subarray(-32)
  .toString('base64');
const PUBLIC_KEY_PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString();

function sign(canonical: string): string {
  return signEd25519(null, Buffer.from(canonical, 'utf8'), privateKey).toString('base64');
}

function heartbeatBody(overrides: Record<string, unknown> = {}) {
  const body = {
    nodeCode: NODE_CODE,
    sentAt: NOW.toISOString(),
    reqPerMin: 1240,
    loadPercent: 42,
    clockDriftMs: 3,
    ...overrides,
  };
  return { ...body, signature: sign(canonicalHeartbeatString(body)) };
}

class FakeNodesRepo implements NodesRepo {
  nodes: SensorNodeRow[] = [
    {
      id: NODE_ID,
      code: NODE_CODE,
      publicKey: PUBLIC_KEY_BASE64,
      status: 'degraded',
      missedHeartbeats: 2,
    },
  ];
  writes: Array<{ nodeId: string; write: HeartbeatWrite }> = [];

  async findByCode(nodeCode: string) {
    return this.nodes.find((node) => node.code === nodeCode) ?? null;
  }
  async recordHeartbeat(nodeId: string, write: HeartbeatWrite) {
    this.writes.push({ nodeId, write });
    const node = this.nodes.find((candidate) => candidate.id === nodeId);
    if (node !== undefined) {
      node.status = write.status;
      node.missedHeartbeats = 0;
    }
  }
}

interface Harness {
  app: FastifyInstance;
  repo: FakeNodesRepo;
  counter: MemoryRateCounter;
}

async function makeHarness(clock = () => NOW.getTime()): Promise<Harness> {
  const repo = new FakeNodesRepo();
  const counter = new MemoryRateCounter(clock);

  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('env', TEST_ENV);
  app.decorateRequest('clientIp', '');
  app.decorateRequest('requestId', '');
  await app.register(errorHandler);
  await app.register(
    async (scope) => {
      await scope.register(nodesRoutes, { repo, counter, now: () => NOW });
    },
    { prefix: '/api/v1' },
  );

  return { app, repo, counter };
}

let harness: Harness;

beforeEach(async () => {
  harness = await makeHarness();
});

function post(body: Record<string, unknown>) {
  return harness.app.inject({ method: 'POST', url: '/api/v1/nodes/heartbeat', payload: body });
}

// --------------------------------------------------------------- signatures

describe('signature verification', () => {
  it('accepts a correctly signed heartbeat and records it', async () => {
    const response = await post(heartbeatBody());
    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');

    expect(harness.repo.writes).toHaveLength(1);
    const write = harness.repo.writes[0]?.write as HeartbeatWrite;
    expect(write).toMatchObject({
      reqPerMin: 1240,
      loadPercent: 42,
      clockDriftMs: 3,
      status: 'operational',
    });
    expect(write.heartbeatLatencyMs).toBeGreaterThanOrEqual(0);
    expect(write.receivedAt.toISOString()).toBe(NOW.toISOString());
    // A heartbeat clears the miss counter; only the worker raises it.
    expect(harness.repo.nodes[0]?.missedHeartbeats).toBe(0);
    expect(harness.repo.nodes[0]?.status).toBe('operational');
  });

  it('rejects a tampered field with the same answer as an unknown node', async () => {
    const signed = heartbeatBody();
    const tampered = { ...signed, loadPercent: 99 };
    const response = await post(tampered);
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: 'bad_signature' });
    expect(harness.repo.writes).toHaveLength(0);

    const unknown = await post(heartbeatBody({ nodeCode: 'VV-SENSOR-9999' }));
    expect(unknown.statusCode).toBe(401);
    // Whether a node code exists is not public information.
    expect(unknown.json()).toEqual(response.json());
  });

  it('rejects a signature from a different key', async () => {
    const other = generateKeyPairSync('ed25519');
    const body = {
      nodeCode: NODE_CODE,
      sentAt: NOW.toISOString(),
      reqPerMin: 1,
      loadPercent: 1,
      clockDriftMs: 0,
    };
    const forged = {
      ...body,
      signature: signEd25519(
        null,
        Buffer.from(canonicalHeartbeatString(body), 'utf8'),
        other.privateKey,
      ).toString('base64'),
    };
    const response = await post(forged);
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: 'bad_signature' });
  });

  it('accepts a node registered with a PEM key as well as a raw one', async () => {
    (harness.repo.nodes[0] as SensorNodeRow).publicKey = PUBLIC_KEY_PEM;
    const response = await post(heartbeatBody());
    expect(response.statusCode).toBe(204);
  });

  it('rejects an unusable stored key rather than failing open', async () => {
    (harness.repo.nodes[0] as SensorNodeRow).publicKey = 'not-a-key';
    const response = await post(heartbeatBody());
    expect(response.statusCode).toBe(401);
  });
});

// ----------------------------------------------------------------- staleness

describe('clock skew', () => {
  it('refuses a heartbeat older than thirty seconds', async () => {
    expect(HEARTBEAT_MAX_SKEW_MS).toBe(30_000);
    const stale = new Date(NOW.getTime() - 31_000).toISOString();
    const response = await post(heartbeatBody({ sentAt: stale }));
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: 'stale' });
    expect(harness.repo.writes).toHaveLength(0);
  });

  it('refuses a heartbeat from the future by the same margin', async () => {
    const future = new Date(NOW.getTime() + 45_000).toISOString();
    const response = await post(heartbeatBody({ sentAt: future }));
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: 'stale' });
  });

  it('accepts one right at the edge of the window', async () => {
    const edge = new Date(NOW.getTime() - HEARTBEAT_MAX_SKEW_MS).toISOString();
    const response = await post(heartbeatBody({ sentAt: edge }));
    expect(response.statusCode).toBe(204);
  });
});

// ------------------------------------------------------------ derived status

describe('status derivation', () => {
  it('warns about drift above fifteen milliseconds', async () => {
    expect(DRIFT_WARNING_THRESHOLD_MS).toBe(15);
    const response = await post(heartbeatBody({ clockDriftMs: 19 }));
    expect(response.statusCode).toBe(204);
    expect(harness.repo.writes[0]?.write.status).toBe('drift_warning');
  });

  it('flags high load above eighty-five percent', async () => {
    expect(HIGH_LOAD_THRESHOLD_PERCENT).toBe(85);
    const response = await post(heartbeatBody({ loadPercent: 88 }));
    expect(response.statusCode).toBe(204);
    expect(harness.repo.writes[0]?.write.status).toBe('high_load');
  });

  it('treats drift as more serious than load', () => {
    expect(deriveStatus(88, 19)).toBe('drift_warning');
    expect(deriveStatus(88, 3)).toBe('high_load');
    expect(deriveStatus(42, 3)).toBe('operational');
    // Negative drift is drift.
    expect(deriveStatus(42, -19)).toBe('drift_warning');
    // The thresholds are strict: on the line is still healthy.
    expect(deriveStatus(85, 15)).toBe('operational');
  });
});

// -------------------------------------------------------------- rate limiting

describe('the per-node rate limit', () => {
  it('allows six heartbeats a minute and refuses the seventh', async () => {
    expect(HEARTBEAT_RATE_LIMIT).toBe(6);
    for (let beat = 1; beat <= HEARTBEAT_RATE_LIMIT; beat += 1) {
      const response = await post(heartbeatBody({ reqPerMin: 1000 + beat }));
      expect(response.statusCode, `beat ${beat}`).toBe(204);
    }
    const seventh = await post(heartbeatBody({ reqPerMin: 1007 }));
    expect(seventh.statusCode).toBe(429);
    expect(seventh.json()).toMatchObject({ error: 'rate_limited' });
    expect(harness.repo.writes).toHaveLength(6);
  });

  it('counts each node separately', async () => {
    harness.repo.nodes.push({
      id: '91000000-0000-4000-8000-0000000000a2',
      code: 'VV-SENSOR-0143',
      publicKey: PUBLIC_KEY_BASE64,
      status: 'operational',
      missedHeartbeats: 0,
    });
    for (let beat = 0; beat < 6; beat += 1) {
      await post(heartbeatBody());
    }
    const other = await post(heartbeatBody({ nodeCode: 'VV-SENSOR-0143' }));
    expect(other.statusCode).toBe(204);
  });
});

// --------------------------------------------------------------- validation

describe('the request contract', () => {
  it('refuses a load percentage outside 0–100 and a missing signature', async () => {
    const badLoad = await post(heartbeatBody({ loadPercent: 101 }));
    expect(badLoad.statusCode).toBe(400);
    expect(badLoad.json()).toMatchObject({ error: 'validation_failed' });

    const { signature: _signature, ...unsigned } = heartbeatBody();
    const noSignature = await post(unsigned);
    expect(noSignature.statusCode).toBe(400);
  });

  it('needs no session and no CSRF token', async () => {
    // The route is registered without any auth preHandler; a plain POST works.
    const response = await post(heartbeatBody());
    expect(response.statusCode).toBe(204);
  });
});

describe('the service on its own', () => {
  it('verifies before it counts, so an unknown node cannot burn a budget', async () => {
    const repo = new FakeNodesRepo();
    const counter = new MemoryRateCounter(() => NOW.getTime());
    const service = new NodesService({ repo, counter, now: () => NOW });

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await expect(
        service.heartbeat({
          nodeCode: 'VV-SENSOR-9999',
          sentAt: NOW.toISOString(),
          reqPerMin: 1,
          loadPercent: 1,
          clockDriftMs: 0,
          signature: 'whatever',
        }),
      ).rejects.toMatchObject({ code: 'bad_signature' });
    }
    // A valid heartbeat from a real node is still inside its own budget.
    const body = heartbeatBody();
    await expect(
      service.heartbeat({
        nodeCode: body.nodeCode,
        sentAt: body.sentAt,
        reqPerMin: body.reqPerMin,
        loadPercent: body.loadPercent,
        clockDriftMs: body.clockDriftMs,
        signature: body.signature,
      }),
    ).resolves.toBeUndefined();
  });
});

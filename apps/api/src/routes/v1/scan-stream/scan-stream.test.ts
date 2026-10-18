import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Permission, ScanStreamMessage, UserRole } from '@vunvault/contracts';
import type { WebSocket } from 'ws';
import type { Env } from '../../../config/env.js';
import errorHandler from '../../../plugins/error-handler.js';
import type { AuthUser } from '../../../plugins/auth.js';
import { HttpError } from '../../../lib/http-error.js';
import type { AuditEntryRow } from '../../../audit/repo.js';
import type { ScansRepo, ScanJobRow } from '../scans/repo.js';
import scanStreamRoutes from './index.js';
import { controlChannel } from './channels.js';

/**
 * The scan stream relay's HTTP face (Task 95).
 *
 * Two layers of assertion: plain `inject` for the pre-upgrade gate — every
 * refusal must be a real HTTP status, because after `101` a browser cannot
 * read one — and `injectWS` for the upgraded socket: the status frame arrives
 * first, live frames flow from the fake bus, and a whitelisted control verb
 * produces exactly one Redis publish, exactly one audit entry and one ack.
 */

const ORG_A = 'd1000000-0000-4000-8000-0000000000a1';
const JOB_A = 'b1000000-0000-4000-8000-0000000000a1';
const ANALYST = 'c1000000-0000-4000-8000-00000000ad01';
const CLIENT_USER = 'c1000000-0000-4000-8000-0000000000a1';
const WEB_ORIGIN = 'https://www.vunvault.test';

const TEST_ENV: Env = {
  NODE_ENV: 'test',
  PORT: 8080,
  LOG_LEVEL: 'fatal',
  WEB_ORIGIN,
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

interface AuditRecord {
  eventType: string;
  message: string;
  actorLabel: string;
  subject: string | null;
  details: Record<string, unknown>;
}

function userFor(role: 'analyst' | 'client'): AuthUser {
  const permissions: Permission[] =
    role === 'analyst'
      ? ['scans:read', 'scans:create', 'scans:execute', 'dashboard:read']
      : ['scans:read', 'scans:create', 'profile:read'];
  const userRole: UserRole = role === 'analyst' ? 'security_analyst' : 'client';
  return {
    id: role === 'analyst' ? ANALYST : CLIENT_USER,
    email: role === 'analyst' ? 'b.otieno@vunvault.com' : 'billing@acmefintech.co.ke',
    role: userRole,
    orgId: role === 'analyst' ? null : ORG_A,
    permissions,
    aal: 'aal2',
    sessionId: 'session-1',
  };
}

function jobRow(overrides: Partial<ScanJobRow> = {}): ScanJobRow {
  return {
    id: JOB_A,
    jobCode: 'JOB-4472',
    orgId: ORG_A,
    orgName: 'Acme Fintech',
    contactEmail: 'billing@acmefintech.co.ke',
    requestedBy: CLIENT_USER,
    requesterEmail: 'billing@acmefintech.co.ke',
    targetHost: 'api.acmefintech.co.ke',
    targetIp: null,
    targetLabel: null,
    environment: 'production',
    scopeNotes: null,
    scanType: 'external',
    priority: 'medium',
    status: 'running',
    progress: 40,
    etaSeconds: null,
    paymentStatus: 'paid',
    reviewGateState: 'not_eligible',
    analystId: null,
    assignedReviewerId: null,
    authorisationDocKey: null,
    releasedAt: null,
    releasedBy: null,
    ...overrides,
  } as ScanJobRow;
}

interface Harness {
  app: FastifyInstance;
  audits: AuditRecord[];
  published: Array<{ channel: string; payload: string }>;
  user: { current: AuthUser | null };
  openSockets: Map<string, number>;
  processCount: { value: number };
  /** Publishes a frame as if the controller had. */
  push: (message: ScanStreamMessage | string) => void;
  buffer: string[];
  setJob: (row: ScanJobRow | null) => void;
}

async function build(): Promise<Harness> {
  const audits: AuditRecord[] = [];
  const published: Array<{ channel: string; payload: string }> = [];
  const user: Harness['user'] = { current: userFor('analyst') };
  const openSockets = new Map<string, number>();
  const processCount = { value: 0 };
  const listeners: Array<(payload: string) => void> = [];
  const harness: Harness = {
    app: null as never,
    audits,
    published,
    user,
    openSockets,
    processCount,
    push: (message) => {
      const raw = typeof message === 'string' ? message : JSON.stringify(message);
      for (const listener of listeners) listener(raw);
    },
    buffer: [],
    setJob: () => undefined,
  };

  let job: ScanJobRow | null = jobRow();
  harness.setJob = (row) => {
    job = row;
  };

  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('env', TEST_ENV);
  app.decorateRequest('clientIp', '');
  app.decorateRequest('requestId', '');

  const fakeTx = { unsafe: async () => [] };
  app.decorate('withTx', (async (work: (tx: unknown) => Promise<unknown>) =>
    work(fakeTx)) as unknown as FastifyInstance['withTx']);

  app.decorate('audit', {
    append: async (_executor: unknown, input: Record<string, unknown>) => {
      const actor = input.actor as { id: string | null; label: string };
      audits.push({
        eventType: String(input.eventType),
        message: String(input.message),
        actorLabel: actor.label,
        subject: (input.subject as string | undefined) ?? null,
        details: (input.details as Record<string, unknown>) ?? {},
      });
      return { seq: audits.length } as unknown as AuditEntryRow;
    },
    publish: async () => undefined,
  } as unknown as FastifyInstance['audit']);

  app.decorate('authenticate', (async (request: FastifyRequest) => {
    if (user.current === null) throw HttpError.unauthorized();
    request.user = user.current;
  }) as unknown as FastifyInstance['authenticate']);
  app.decorate('requireStaff', (async (request: FastifyRequest) => {
    const current = request.user;
    if (current === undefined) throw HttpError.unauthorized();
    const staff: UserRole[] = [
      'super_admin',
      'admin',
      'security_analyst',
      'soc_operator',
      'compliance_auditor',
      'support_engineer',
    ];
    if (!staff.includes(current.role)) throw HttpError.forbidden();
    if (current.aal !== 'aal2') throw new HttpError(403, 'mfa_required');
  }) as unknown as FastifyInstance['requireStaff']);
  app.decorate('requirePermission', ((...required: Permission[]) =>
    async (request: FastifyRequest) => {
      const current = request.user;
      if (current === undefined) throw HttpError.unauthorized();
      const granted = new Set(current.permissions);
      for (const permission of required) {
        if (!granted.has(permission)) throw HttpError.forbidden();
      }
    }) as unknown as FastifyInstance['requirePermission']);

  await app.register(errorHandler);

  // Only `getJobById` is ever reached through this route; the rest of the repo
  // surface is honestly absent rather than stubbed green.
  const repo = {
    getJobById: async () => job,
  } as unknown as ScansRepo;

  await app.register(scanStreamRoutes, {
    repo,
    replay: async () => harness.buffer,
    subscribe: async (_jobId, onMessage) => {
      listeners.push(onMessage);
      return async () => {
        const index = listeners.indexOf(onMessage);
        if (index >= 0) listeners.splice(index, 1);
      };
    },
    publish: async (channel, payload) => {
      published.push({ channel, payload });
      return 1;
    },
    openSockets,
    processSocketCount: processCount,
  });

  await app.ready();
  harness.app = app;
  return harness;
}

/**
 * A persistent frame collector attached the moment the socket opens — no
 * listener race: the relay's status frame can arrive before any `await`.
 * `take(n)` consumes the next n frames in arrival order.
 */
function collector(socket: WebSocket, timeoutMs = 2_000) {
  const received: ScanStreamMessage[] = [];
  const waiters: Array<() => void> = [];
  let offset = 0;
  socket.on('message', (data: Buffer) => {
    received.push(JSON.parse(data.toString('utf8')) as ScanStreamMessage);
    for (const wake of waiters.splice(0)) wake();
  });
  return {
    async take(count: number): Promise<ScanStreamMessage[]> {
      const deadline = Date.now() + timeoutMs;
      while (received.length < offset + count) {
        if (Date.now() > deadline) {
          throw new Error(`Only ${received.length - offset} of ${count} frames arrived.`);
        }
        await new Promise<void>((resolve) => {
          waiters.push(resolve);
          // A safety net: a message between the check and the push still wakes us.
          setTimeout(resolve, 10);
        });
      }
      const slice = received.slice(offset, offset + count);
      offset += count;
      return slice;
    },
  };
}

let harness: Harness;

/**
 * Open the relay socket with the frame collector attached BEFORE the
 * handshake completes: `injectWS` resolves on `open`, and the session's first
 * status frame can land before any listener attached afterwards would exist.
 */
async function connect(): Promise<{ socket: WebSocket; frames: ReturnType<typeof collector> }> {
  let attached: ReturnType<typeof collector> | undefined;
  const socket = await harness.app.injectWS(
    PATH,
    { headers: { origin: WEB_ORIGIN } },
    {
      onInit: (ws) => {
        attached = collector(ws as unknown as WebSocket);
      },
    },
  );
  if (attached === undefined) throw new Error('injectWS never called onInit.');
  // `injectWS` types its result as the ws module namespace; the runtime value
  // is a client-side ws instance.
  return { socket: socket as unknown as WebSocket, frames: attached };
}

beforeEach(async () => {
  harness = await build();
});

afterEach(async () => {
  await harness.app.close();
});

// The plugin is registered bare (the real app mounts it under /api/v1).
const PATH = `/scans/${JOB_A}/stream`;

describe('scan stream — the pre-upgrade gate (HTTP)', () => {
  it('401 without a session', async () => {
    harness.user.current = null;
    const response = await harness.app.inject({
      method: 'GET',
      url: PATH,
      headers: { origin: WEB_ORIGIN },
    });
    expect(response.statusCode).toBe(401);
  });

  it('403 for a client-role user: the release lock never shows live output', async () => {
    harness.user.current = userFor('client');
    const response = await harness.app.inject({
      method: 'GET',
      url: PATH,
      headers: { origin: WEB_ORIGIN },
    });
    expect(response.statusCode).toBe(403);
  });

  it('403 on a wrong Origin, and the attempt is audited as CSRF_REJECTED', async () => {
    const response = await harness.app.inject({
      method: 'GET',
      url: PATH,
      headers: { origin: 'https://evil.example' },
    });
    expect(response.statusCode).toBe(403);
    // The chain write is fire-and-forget; let its microtasks land.
    await new Promise((resolve) => setImmediate(resolve));
    expect(harness.audits).toEqual([
      {
        eventType: 'CSRF_REJECTED',
        message: 'WebSocket origin rejected for scan stream',
        actorLabel: 'b.otieno@vunvault.com',
        subject: 'scan-stream',
        details: { origin: 'https://evil.example', path: PATH },
      },
    ]);
  });

  it('403 when the Origin header is missing entirely', async () => {
    const response = await harness.app.inject({ method: 'GET', url: PATH });
    expect(response.statusCode).toBe(403);
  });

  it('404 for a job that does not exist', async () => {
    harness.setJob(null);
    const response = await harness.app.inject({
      method: 'GET',
      url: PATH,
      headers: { origin: WEB_ORIGIN },
    });
    expect(response.statusCode).toBe(404);
  });

  it('400 for a malformed id and a malformed after (schema validation)', async () => {
    const badId = await harness.app.inject({
      method: 'GET',
      url: '/scans/not-a-uuid/stream',
      headers: { origin: WEB_ORIGIN },
    });
    expect(badId.statusCode).toBe(400);

    const badAfter = await harness.app.inject({
      method: 'GET',
      url: `${PATH}?after=-3`,
      headers: { origin: WEB_ORIGIN },
    });
    expect(badAfter.statusCode).toBe(400);
  });

  it('429 on the fourth socket for one user and job', async () => {
    harness.openSockets.set(`${ANALYST}:${JOB_A}`, 3);
    const response = await harness.app.inject({
      method: 'GET',
      url: PATH,
      headers: { origin: WEB_ORIGIN },
    });
    expect(response.statusCode).toBe(429);
  });

  it('a non-upgrade GET that passes the gate consumes no slot', async () => {
    const response = await harness.app.inject({
      method: 'GET',
      url: PATH,
      headers: { origin: WEB_ORIGIN },
    });
    // The websocket plugin answers a plain GET on a ws route with 404.
    expect(response.statusCode).toBe(404);
    expect(harness.openSockets.size).toBe(0);
    expect(harness.processCount.value).toBe(0);
  });
});

describe('scan stream — the upgraded socket', () => {
  it('sends the status frame first, then live frames from the bus', async () => {
    const { socket, frames } = await connect();
    try {
      expect(await frames.take(1)).toEqual([{ type: 'status', status: 'running' }]);

      harness.push({
        type: 'line',
        seq: 1,
        ts: '2026-10-08T12:00:00.000Z',
        kind: 'info',
        msg: 'x',
      });
      expect((await frames.take(1))[0]).toMatchObject({ type: 'line', seq: 1 });
    } finally {
      socket.close();
    }
  });

  it('a whitelisted control publishes once, audits once and acks', async () => {
    const { socket, frames: collected } = await connect();
    try {
      await collected.take(1); // the status frame

      socket.send(JSON.stringify({ type: 'pause' }));
      expect(await collected.take(1)).toEqual([{ type: 'control_ack', control: 'pause' }]);

      expect(harness.published).toEqual([
        { channel: controlChannel(JOB_A), payload: JSON.stringify({ type: 'pause' }) },
      ]);
      expect(harness.audits).toEqual([
        {
          eventType: 'SCAN_CONTROL_SENT',
          message: `pause sent to JOB-4472 by b.otieno@vunvault.com`,
          actorLabel: 'b.otieno@vunvault.com',
          subject: JOB_A,
          details: { jobId: JOB_A, type: 'pause' },
        },
      ]);
    } finally {
      socket.close();
    }
  });

  it('an analyst may abort but not kill', async () => {
    const { socket, frames: collected } = await connect();
    try {
      await collected.take(1);

      socket.send(JSON.stringify({ type: 'kill' }));
      expect(await collected.take(1)).toEqual([{ type: 'error', code: 'forbidden' }]);
      expect(harness.published).toEqual([]);

      socket.send(JSON.stringify({ type: 'abort' }));
      expect(await collected.take(1)).toEqual([{ type: 'control_ack', control: 'abort' }]);
      expect(harness.published).toHaveLength(1);
    } finally {
      socket.close();
    }
  });

  it('anything off the whitelist is an error frame and never reaches Redis', async () => {
    const { socket, frames: collected } = await connect();
    try {
      await collected.take(1);

      socket.send(JSON.stringify({ type: 'exec', cmd: 'rm -rf /' }));
      socket.send(JSON.stringify({ type: 'abort', extra: true }));
      expect(await collected.take(2)).toEqual([
        { type: 'error', code: 'invalid_message' },
        { type: 'error', code: 'invalid_message' },
      ]);
      expect(harness.published).toEqual([]);
    } finally {
      socket.close();
    }
  });

  it('closing the socket unsubscribes and releases the slot', async () => {
    const { socket, frames: collected } = await connect();
    await collected.take(1);
    expect(harness.openSockets.get(`${ANALYST}:${JOB_A}`)).toBe(1);
    expect(harness.processCount.value).toBe(1);

    // `terminate()` destroys the injected transport; a graceful `close()`
    // never reaches the server side through light-my-request's duplex.
    socket.terminate();
    // The close round-trip is async on both ends; poll until it lands.
    const deadline = Date.now() + 2_000;
    while (harness.openSockets.size !== 0 && Date.now() < deadline) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    expect(harness.openSockets.size).toBe(0);
    expect(harness.processCount.value).toBe(0);

    // The bus listener is gone: pushing must not throw into a dead socket.
    harness.push({ type: 'line', seq: 9, ts: '2026-10-08T12:00:00.000Z', kind: 'info', msg: 'x' });
  });
});

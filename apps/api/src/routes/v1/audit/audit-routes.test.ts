import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it } from 'vitest';
import type { UserRole } from '@vunvault/contracts';
import { ROLE_PERMISSIONS } from '@vunvault/contracts';
import type { Env } from '../../../config/env.js';
import errorHandler from '../../../plugins/error-handler.js';
import type { AuthUser } from '../../../plugins/auth.js';
import { HttpError } from '../../../lib/http-error.js';
import type { AuditEntryRow, SqlExecutor } from '../../../audit/repo.js';
import type { AuditEntryView } from '../../../audit/service.js';
import auditRoutes from './index.js';
import { AUDIT_CSV_HEADER, EXPORT_MAX_ROWS, auditCsvFilename } from './csv.js';
import {
  AlwaysAvailableLock,
  AuditReadService,
  DEFAULT_NODE_LABEL,
  RANGE_MS,
  RETENTION_YEARS,
  integrityPercent,
  nodeLabel,
  shortHash,
} from './service.js';
import type { AuditReadFilters, AuditReadRepo, CheckpointRow, SummaryCounts } from './repo.js';

/**
 * The audit trail, read-only.
 *
 * The route-table assertion is the one that matters most: it is what stops a
 * future task from adding a PUT to a log whose entire value is that it cannot be
 * edited.
 */

const AUDITOR_ID = 'c1000000-0000-4000-8000-000000000ad1';
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

function view(seq: number, overrides: Partial<AuditEntryView> = {}): AuditEntryView {
  return {
    seq,
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    category: 'authentication',
    eventType: 'AUTH_SUCCESS',
    severity: 'ok',
    sevLevel: null,
    actorLabel: 'e.reed',
    message: 'e.reed@vunvault.com signed in from 41.90.32.10',
    ip: '41.90.32.10',
    subject: 'e.reed@vunvault.com',
    hash: `${String(seq).padStart(2, '0')}${'a'.repeat(62)}`,
    prevHash: 'b'.repeat(64),
    createdAt: '2026-10-06T12:00:00.000Z',
    ...overrides,
  };
}

/**
 * The fake stores its fixtures under property names (`chainHead`, `summaryCounts`)
 * that would collide with the interface's method names, so `repoAdapter` below is
 * what implements `AuditReadRepo`.
 */
class FakeAuditReadRepo {
  rows: AuditEntryView[] = [view(3), view(2), view(1)];
  filtersSeen: AuditReadFilters[] = [];
  summaryCounts: SummaryCounts = {
    events24h: 128,
    authAttempts: 64,
    failedAuth: 5,
    lockedOut: 1,
    scanCompletions: 12,
    reportReleases: 3,
  };
  chainHead = {
    totalEntries: 4211,
    headHash: '9f2c1a4b7e8d3c60'.padEnd(64, '0'),
    genesisDate: '2024-03-01',
  };
  checkpoint: CheckpointRow | null = {
    verifiedAt: '2026-10-06T12:00:00.000Z',
    fromSeq: 1,
    toSeq: 4211,
    entries: 4211,
    mismatches: 0,
    headHash: '9f2c1a4b7e8d3c60'.padEnd(64, '0'),
    verifiedBy: 'system',
  };
  checkpoints: CheckpointRow[] = [];
  exportBatchSize = 0;

  async list(filters: AuditReadFilters) {
    this.filtersSeen.push(filters);
    return { rows: this.rows, total: this.rows.length };
  }
  async counts2(_since: Date) {
    return this.summaryCounts;
  }
  async head2() {
    return this.chainHead;
  }
  async latestCheckpoint() {
    return this.checkpoint;
  }
  async insertCheckpoint(input: Omit<CheckpointRow, 'verifiedAt'> & { verifiedAt: Date }) {
    this.checkpoints.push({ ...input, verifiedAt: input.verifiedAt.toISOString() });
  }
  async sinceSeq(afterSeq: number, limit: number) {
    return this.rows.filter((row) => row.seq > afterSeq).slice(0, limit);
  }
  async exportBatch(filters: AuditReadFilters, afterSeq: number, limit: number) {
    this.filtersSeen.push(filters);
    this.exportBatchSize = limit;
    return this.rows.filter((row) => row.seq > afterSeq).slice(0, limit);
  }
}

/** The interface the service uses, wired to the fake's renamed methods. */
function repoAdapter(repo: FakeAuditReadRepo): AuditReadRepo {
  return {
    list: (filters) => repo.list(filters),
    counts: (since) => repo.counts2(since),
    head: () => repo.head2(),
    latestCheckpoint: () => repo.latestCheckpoint(),
    insertCheckpoint: (input) => repo.insertCheckpoint(input),
    sinceSeq: (afterSeq, limit) => repo.sinceSeq(afterSeq, limit),
    exportBatch: (filters, afterSeq, limit) => repo.exportBatch(filters, afterSeq, limit),
  };
}

interface Harness {
  app: FastifyInstance;
  repo: FakeAuditReadRepo;
  audits: Array<{ eventType: string; message: string; details: Record<string, unknown> }>;
  lock: AlwaysAvailableLock;
  verified: Array<{ fromSeq?: number }>;
  user: { current: AuthUser | null };
}

function auditor(role: UserRole = 'super_admin', permissions?: string[]): AuthUser {
  return {
    id: AUDITOR_ID,
    email: 'a.mwangi@vunvault.com',
    role,
    orgId: null,
    permissions: (permissions ?? [...ROLE_PERMISSIONS[role]]) as AuthUser['permissions'],
    aal: 'aal2',
    sessionId: '20000000-0000-4000-8000-000000000001',
  };
}

async function makeHarness(): Promise<Harness> {
  const repo = new FakeAuditReadRepo();
  const audits: Harness['audits'] = [];
  const verified: Harness['verified'] = [];
  const lock = new AlwaysAvailableLock();
  const user: Harness['user'] = { current: auditor() };

  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('env', TEST_ENV);
  app.decorateRequest('clientIp', '');
  app.decorateRequest('requestId', '');

  const fakeTx = { unsafe: async () => [] } as unknown as SqlExecutor;
  app.decorate('withTx', (async (work: (tx: unknown) => Promise<unknown>) =>
    work(fakeTx)) as unknown as FastifyInstance['withTx']);
  app.decorate('audit', {
    append: async (_executor: unknown, input: Record<string, unknown>) => {
      audits.push({
        eventType: String(input.eventType),
        message: String(input.message),
        details: (input.details as Record<string, unknown>) ?? {},
      });
      return {
        seq: audits.length,
        id: 'entry-id',
        category: 'system',
        eventType: input.eventType,
        severity: 'ok',
        sevLevel: null,
        actorId: 'actor-id',
        actorLabel: 'a.mwangi',
        ip: null,
        subject: null,
        message: String(input.message),
        details: {},
        sealedDetails: null,
        nonce: null,
        prevHash: '0'.repeat(64),
        hash: 'a'.repeat(64),
        signature: 'b'.repeat(64),
        keyId: 'v1',
        createdAt: NOW,
      } as unknown as AuditEntryRow;
    },
    verify: async (_executor: unknown, options: { fromSeq?: number } = {}) => {
      verified.push(options);
      return {
        checkedFromSeq: options.fromSeq ?? 1,
        checkedToSeq: repo.chainHead.totalEntries,
        entries: repo.chainHead.totalEntries,
        mismatches: repo.checkpoint?.mismatches ?? 0,
        firstMismatchSeq: (repo.checkpoint?.mismatches ?? 0) > 0 ? 17 : null,
        verifiedAt: NOW.toISOString(),
      };
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
    if (current.role === 'client') throw HttpError.forbidden();
    if (current.aal !== 'aal2') throw new HttpError(403, 'mfa_required');
  }) as unknown as FastifyInstance['requireStaff']);
  app.decorate('requirePermission', ((...required: string[]) =>
    async (request: FastifyRequest) => {
      const current = request.user;
      if (current === undefined) throw HttpError.unauthorized();
      const granted = new Set(current.permissions);
      for (const permission of required) {
        if (!granted.has(permission as never)) throw HttpError.forbidden();
      }
    }) as unknown as FastifyInstance['requirePermission']);

  await app.register(errorHandler);
  await app.register(
    async (scope) => {
      await scope.register(auditRoutes, {
        repo: repoAdapter(repo),
        lock,
        node: DEFAULT_NODE_LABEL,
        now: () => NOW,
      });
    },
    { prefix: '/api/v1' },
  );

  return { app, repo, audits, lock, verified, user };
}

let harness: Harness;

beforeEach(async () => {
  harness = await makeHarness();
});

// -------------------------------------------------------------------- list

describe('GET /api/v1/admin/audit', () => {
  it('lists the view fields and nothing else', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/api/v1/admin/audit' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: AuditEntryView[]; total: number };
    expect(body.total).toBe(3);
    expect(body.data[0]?.seq).toBe(3);
    expect(Object.keys(body.data[0] ?? {}).sort()).toEqual([
      'actorLabel',
      'category',
      'createdAt',
      'eventType',
      'hash',
      'id',
      'ip',
      'message',
      'prevHash',
      'seq',
      'sevLevel',
      'severity',
      'subject',
    ]);
    // The material that would let somebody forge or read a sealed entry.
    for (const forbidden of ['signature', 'details', 'sealedDetails', 'nonce', 'keyId']) {
      expect(response.body, forbidden).not.toContain(forbidden);
    }
  });

  it('turns the range into a window and passes the filters through', async () => {
    await harness.app.inject({
      method: 'GET',
      url: '/api/v1/admin/audit?range=1h&category=authentication&severity=warning&actor=e.reed&q=signed',
    });
    const filters = harness.repo.filtersSeen.at(-1) as AuditReadFilters;
    expect(filters.since.toISOString()).toBe(
      new Date(NOW.getTime() - RANGE_MS['1h']).toISOString(),
    );
    expect(filters.category).toBe('authentication');
    expect(filters.severity).toBe('warning');
    expect(filters.actor).toBe('e.reed');
    expect(filters.q).toBe('signed');
  });

  it('defaults to the last twenty-four hours and caps the page size', async () => {
    await harness.app.inject({ method: 'GET', url: '/api/v1/admin/audit' });
    const filters = harness.repo.filtersSeen.at(-1) as AuditReadFilters;
    expect(filters.since.toISOString()).toBe(
      new Date(NOW.getTime() - RANGE_MS['24h']).toISOString(),
    );

    const tooBig = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/admin/audit?pageSize=500',
    });
    expect(tooBig.statusCode).toBe(400);
  });

  it('is staff-only', async () => {
    harness.user.current = auditor('client');
    expect(
      (await harness.app.inject({ method: 'GET', url: '/api/v1/admin/audit' })).statusCode,
    ).toBe(403);
    harness.user.current = null;
    expect(
      (await harness.app.inject({ method: 'GET', url: '/api/v1/admin/audit' })).statusCode,
    ).toBe(401);
  });
});

// ----------------------------------------------------------------- summary

describe('GET /api/v1/admin/audit/summary', () => {
  it('reports the trailing day and the chain’s health', async () => {
    const response = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/admin/audit/summary',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: {
        events24h: 128,
        authAttempts: 64,
        failedAuth: 5,
        lockedOut: 1,
        scanCompletions: 12,
        reportReleases: 3,
        chainIntegrityPercent: 100,
        hashMismatches: 0,
        retentionYears: RETENTION_YEARS,
      },
    });
    expect(RETENTION_YEARS).toBe(7);
  });

  it('drops the integrity figure when entries did not verify', async () => {
    harness.repo.checkpoint = { ...(harness.repo.checkpoint as CheckpointRow), mismatches: 42 };
    const response = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/admin/audit/summary',
    });
    expect(response.json()).toMatchObject({
      data: { hashMismatches: 42, chainIntegrityPercent: 99 },
    });
    expect(integrityPercent(4211, 42)).toBe(99);
    expect(integrityPercent(0, 0)).toBe(100);
  });
});

// ------------------------------------------------------------------- chain

describe('GET /api/v1/admin/audit/chain', () => {
  it('describes an intact chain', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/api/v1/admin/audit/chain' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: {
        state: 'intact',
        totalEntries: 4211,
        genesisDate: '2024-03-01',
        lastVerifiedAt: '2026-10-06T12:00:00.000Z',
        hashMismatches: 0,
        headHash: '0x9f2c1a4b7e8d3c60',
        node: DEFAULT_NODE_LABEL,
        encryption: 'AES-256-GCM',
      },
    });
  });

  it('reports a broken chain when the last verification found mismatches', async () => {
    harness.repo.checkpoint = { ...(harness.repo.checkpoint as CheckpointRow), mismatches: 1 };
    const response = await harness.app.inject({ method: 'GET', url: '/api/v1/admin/audit/chain' });
    expect(response.json()).toMatchObject({ data: { state: 'broken', hashMismatches: 1 } });
  });

  it('shortens the head hash to sixteen hex characters', () => {
    expect(shortHash('9f2c1a4b7e8d3c60' + '0'.repeat(48))).toBe('0x9f2c1a4b7e8d3c60');
    expect(shortHash(null)).toBe(`0x${'0'.repeat(16)}`);
  });

  it('falls back to the documented node label', () => {
    expect(nodeLabel({})).toBe('node-nbo-01 · NBO-CORE');
    expect(nodeLabel({ NODE_LABEL: 'node-mba-02 · MBA-EDGE' })).toBe('node-mba-02 · MBA-EDGE');
    expect(DEFAULT_NODE_LABEL).toBe('node-nbo-01 · NBO-CORE');
  });
});

// ------------------------------------------------------------------ verify

describe('POST /api/v1/admin/audit/verify', () => {
  it('verifies the whole chain, writes a checkpoint and audits it', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/admin/audit/verify',
      payload: {},
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: { checkedFromSeq: 1, entries: 4211, mismatches: 0, firstMismatchSeq: null },
    });
    expect(harness.verified).toEqual([{ fromSeq: 1 }]);
    expect(harness.repo.checkpoints).toHaveLength(1);
    expect(harness.repo.checkpoints[0]).toMatchObject({
      fromSeq: 1,
      toSeq: 4211,
      mismatches: 0,
      verifiedBy: 'a.mwangi',
    });
    expect(harness.audits.map((audit) => audit.eventType)).toEqual(['CHAIN_VERIFIED']);
    expect(harness.audits[0]?.message).toBe('Chain verified: 4211 entries, no mismatches');
    // The lock is released, so the next verification can run.
    expect(harness.lock.held).toBe(false);
  });

  it('starts an incremental run after the last checkpoint', async () => {
    await harness.app.inject({
      method: 'POST',
      url: '/api/v1/admin/audit/verify',
      payload: { incremental: true },
    });
    expect(harness.verified).toEqual([{ fromSeq: 4212 }]);
  });

  it('says plainly when the chain did not verify', async () => {
    harness.repo.checkpoint = { ...(harness.repo.checkpoint as CheckpointRow), mismatches: 1 };
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/admin/audit/verify',
      payload: {},
    });
    expect(response.statusCode).toBe(200);
    expect(harness.audits[0]?.message).toBe('Chain verification found 1 mismatched entries');
    expect(harness.audits[0]?.details).toMatchObject({ mismatches: 1, state: 'broken' });
    const chain = await harness.app.inject({ method: 'GET', url: '/api/v1/admin/audit/chain' });
    expect(chain.json()).toMatchObject({ data: { state: 'broken' } });
  });

  it('refuses a second verification while one is running', async () => {
    harness.lock.held = true;
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/admin/audit/verify',
      payload: {},
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'verify_in_progress' });
    expect(harness.verified).toHaveLength(0);
    // Somebody else's lock is not ours to release.
    expect(harness.lock.held).toBe(true);
  });

  it('needs audit:verify, not just audit:read', async () => {
    // A compliance auditor holds `audit:read` and nothing more.
    harness.user.current = auditor('compliance_auditor');
    expect(harness.user.current.permissions).toContain('audit:read');
    expect(harness.user.current.permissions).not.toContain('audit:verify');
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/admin/audit/verify',
      payload: {},
    });
    expect(response.statusCode).toBe(403);
    expect(harness.verified).toHaveLength(0);
  });

  it('releases the lock even when verification throws', async () => {
    const service = new AuditReadService({
      repo: repoAdapter(harness.repo),
      verifier: {
        verify: async () => {
          throw new Error('database gone');
        },
      },
      lock: harness.lock,
      now: () => NOW,
    });
    harness.lock.held = false;
    await expect(
      service.verify({ unsafe: async () => [] } as unknown as SqlExecutor, {
        id: 'x',
        label: 'a.mwangi',
      }),
    ).rejects.toThrow('database gone');
    expect(harness.lock.held).toBe(false);
  });
});

// ------------------------------------------------------------------ export

describe('GET /api/v1/admin/audit/export', () => {
  it('streams the documented header and rows, and logs the export', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/api/v1/admin/audit/export' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toBe(
      `attachment; filename="${auditCsvFilename(NOW)}"`,
    );
    expect(response.headers['cache-control']).toBe('private, no-store');

    const lines = response.body.split('\r\n').filter((line) => line !== '');
    expect(lines[0]).toBe(AUDIT_CSV_HEADER.join(','));
    expect(lines).toHaveLength(1 + harness.repo.rows.length);
    expect(lines[1]).toContain('AUTH_SUCCESS');
    // No signature, no details, no sealed payload.
    expect(response.body).not.toContain('signature');
    expect(response.body).not.toContain('sealed');

    const entry = harness.audits.find((audit) => audit.eventType === 'LOG_BACKUP');
    expect(entry?.message).toBe('Audit log export generated');
    expect(entry?.details).toMatchObject({ rows: 3 });
    expect(harness.repo.exportBatchSize).toBe(1000);
  });

  it('neutralises a formula injected through a message', async () => {
    harness.repo.rows = [
      view(9, { message: '=HYPERLINK("https://evil.test","Click here")' }),
      view(8, { message: '+1200306203' }),
      view(7, { message: '@SUM(A1:A9)' }),
    ];
    const response = await harness.app.inject({ method: 'GET', url: '/api/v1/admin/audit/export' });
    expect(response.body).not.toContain(',"=HYPERLINK');
    // A leading apostrophe makes both Excel and Sheets read the cell as text.
    expect(response.body).toContain(`"'=HYPERLINK(`);
    expect(response.body).toContain(`'+1200306203`);
    expect(response.body).toContain(`'@SUM(A1:A9)`);
  });

  it('refuses a range wider than the row cap before writing a byte', async () => {
    harness.repo.rows = [view(1)];
    const original = harness.repo.list.bind(harness.repo);
    harness.repo.list = async (filters) => {
      const result = await original(filters);
      return { ...result, total: EXPORT_MAX_ROWS + 1 };
    };
    const response = await harness.app.inject({ method: 'GET', url: '/api/v1/admin/audit/export' });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: 'range_too_large' });
    expect(harness.audits).toHaveLength(0);
  });
});

// ------------------------------------------------------- the route table

describe('the audit surface is read-only', () => {
  it('exposes only GET routes and the single POST /verify', () => {
    const table = harness.app.printRoutes({ commonPrefix: false });
    const auditRoutesListed = table
      .split('\n')
      .filter((line) => line.includes('/api/v1/admin/audit'));
    expect(auditRoutesListed.length).toBeGreaterThan(0);
    for (const line of auditRoutesListed) {
      const methods = /\(([^)]*)\)/.exec(line)?.[1] ?? '';
      const allowed = methods
        .split(', ')
        // HEAD comes free with GET, and Fastify prints it alongside.
        .every((method) => method === 'GET' || method === 'HEAD');
      const isVerify = line.includes('/api/v1/admin/audit/verify');
      expect(allowed || (isVerify && methods.includes('POST')), line).toBe(true);
      for (const forbidden of ['PUT', 'PATCH', 'DELETE']) {
        expect(methods, line).not.toContain(forbidden);
      }
    }
  });

  it('has no route that could write an entry', () => {
    const table = harness.app.printRoutes({ commonPrefix: false });
    expect(table).not.toContain('DELETE /api/v1/admin/audit');
    expect(table).not.toContain('PUT /api/v1/admin/audit');
    expect(table).not.toContain('PATCH /api/v1/admin/audit');
  });
});

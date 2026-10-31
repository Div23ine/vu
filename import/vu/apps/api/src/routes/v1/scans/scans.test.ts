import { readFileSync } from 'node:fs';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Permission, UserRole } from '@vunvault/contracts';
import { GATE_RELEASE_MESSAGE, ROLE_PERMISSIONS } from '@vunvault/contracts';
import { REVIEW_CHECK_KEYS, type ReviewCheckKey } from '@vunvault/db/enum-values';
import type { Env } from '../../../config/env.js';
import errorHandler from '../../../plugins/error-handler.js';
import type { AuthUser } from '../../../plugins/auth.js';
import { HttpError } from '../../../lib/http-error.js';
import type { ObjectStorage } from '../../../lib/object-storage.js';
import type { AuditEntryRow } from '../../../audit/repo.js';
import type { InvoiceIssuer } from '../../../billing/invoice-issuer.js';
import scansRoutes from './index.js';
import type {
  FindingRow,
  JobPatch,
  NewScanJob,
  PlanRow,
  ReviewerRow,
  ScanJobRow,
  ScansRepo,
  ScanListFilters,
  SummaryCounts,
} from './repo.js';
import { abortChannelFor, parseTarget, queueJobIdFor } from './service.js';

/**
 * The client portal's release lock, the admin queue and the review gate.
 *
 * The security-critical assertions are the negative ones: a job that has not been
 * released does not exist as far as its own client is concerned, and no bulk or
 * automated path can release one.
 */

const ORG_A = 'd1000000-0000-4000-8000-0000000000a1';
const ORG_B = 'd1000000-0000-4000-8000-0000000000b1';
const CLIENT_USER = 'c1000000-0000-4000-8000-0000000000a1';
const ADMIN_USER = 'c1000000-0000-4000-8000-0000000000ad';
const JOB_A = 'b1000000-0000-4000-8000-0000000000a1';
const JOB_B = 'b1000000-0000-4000-8000-0000000000b2';
const AUTHORISATION_KEY = `authorisations/${ORG_A}/6f1e0f5a-0000-4000-8000-0000000000aa.pdf`;

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

// --------------------------------------------------------------------- fakes

function seedJob(overrides: Partial<ScanJobRow> = {}): ScanJobRow {
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
    scopeNotes: 'External API and auth flow',
    scanType: 'external',
    priority: 'medium',
    status: 'completed',
    progress: 100,
    etaSeconds: null,
    paymentStatus: 'paid',
    reviewGateState: 'in_review',
    analystId: null,
    assignedReviewerId: null,
    authorisationDocKey: AUTHORISATION_KEY,
    releasedAt: null,
    releasedBy: null,
    requestedAt: '2026-10-01T09:00:00.000Z',
    startedAt: '2026-10-01T09:05:00.000Z',
    completedAt: '2026-10-01T10:00:00.000Z',
    cancelledAt: null,
    invoiceId: null,
    invoiceNumber: null,
    ...overrides,
  };
}

class FakeScansRepo implements ScansRepo {
  jobs: ScanJobRow[] = [];
  findings: Record<string, FindingRow[]> = {};
  /** Raw scanner output that must never leave the API. */
  rawEvidence: Record<string, string[]> = {};
  decisions: Array<{
    jobId: string;
    decision: string;
    reviewerId: string;
    reviewerRole: string;
    note: string;
  }> = [];
  checks: Record<string, Record<string, boolean>> = {};
  reviewers: Record<string, ReviewerRow> = {};
  plans: Record<string, PlanRow> = {
    starter_scan: { code: 'starter_scan', name: 'Starter Scan', monthlyUsdCents: 89_900 },
  };
  users: Array<{ orgId: string; userId: string; email: string }> = [
    { orgId: ORG_A, userId: CLIENT_USER, email: 'billing@acmefintech.co.ke' },
  ];
  queueRuns: Array<{ jobId: string; attempt: number; queueJobId: string }> = [];
  patches: Array<{ jobId: string; patch: JobPatch }> = [];
  counts: SummaryCounts = {
    jobsInQueue: 0,
    addedToday: 0,
    runningScans: 0,
    awaitingAdminReview: 0,
    approvedReleased: 0,
    releasedThisWeek: 0,
    paymentOutstanding: 0,
    overdueOver14Days: 0,
    heldRejected: 0,
  };
  private jobSequence = 4472;

  async createJob(input: NewScanJob): Promise<ScanJobRow> {
    const row = seedJob({
      ...input,
      jobCode: `JOB-${this.jobSequence++}`,
      status: 'queued',
      progress: 0,
      paymentStatus: 'pending',
      reviewGateState: 'not_eligible',
      completedAt: null,
      startedAt: null,
      requestedAt: '2026-10-06T12:00:00.000Z',
      orgName: input.orgId === ORG_A ? 'Acme Fintech' : 'Zenith Bank',
    });
    this.jobs.push(row);
    return row;
  }
  async getJobById(jobId: string) {
    return this.jobs.find((row) => row.id === jobId) ?? null;
  }
  /** The release lock, in memory: same predicate the SQL uses. */
  async getVisibleJob(orgId: string, jobId: string) {
    return (
      this.jobs.find(
        (row) =>
          row.id === jobId && row.orgId === orgId && row.reviewGateState === 'approved_released',
      ) ?? null
    );
  }
  async listForClient(orgId: string, filters: ScanListFilters) {
    const rows = this.jobs.filter(
      (row) => row.orgId === orgId && row.reviewGateState === 'approved_released',
    );
    return { rows: applyFilters(rows, filters), total: rows.length };
  }
  async listForAdmin(filters: ScanListFilters) {
    const rows = applyFilters(this.jobs, filters);
    return { rows, total: rows.length };
  }
  async getJobsByIds(ids: string[]) {
    return this.jobs.filter((row) => ids.includes(row.id));
  }
  async listFindings(jobId: string) {
    const rows = this.findings[jobId] ?? [];
    const raw = this.rawEvidence[jobId] ?? [];
    // The repository never selects raw evidence; this proves the RESPONSE schema
    // would strip it even if a future query leaked it.
    return rows.map((row, index) => ({ ...row, evidenceRaw: raw[index] }) as unknown as FindingRow);
  }
  async summary() {
    return this.counts;
  }
  async upsertChecks(jobId: string, checks: Record<ReviewCheckKey, boolean>) {
    this.checks[jobId] = { ...checks };
  }
  async insertDecision(input: {
    jobId: string;
    decision: string;
    reviewerId: string;
    reviewerRole: string;
    note: string;
  }) {
    this.decisions.push(input);
    return `decision-${this.decisions.length}`;
  }
  async updateJob(jobId: string, patch: JobPatch) {
    this.patches.push({ jobId, patch });
    const row = this.jobs.find((candidate) => candidate.id === jobId);
    if (row === undefined) return;
    Object.assign(row, patch);
  }
  async getReviewer(reviewerId: string) {
    return this.reviewers[reviewerId] ?? null;
  }
  async planByCode(code: string) {
    return this.plans[code] ?? null;
  }
  async orgUsers(orgId: string) {
    return this.users
      .filter((row) => row.orgId === orgId)
      .map((row) => ({ userId: row.userId, email: row.email }));
  }
  async recordQueueRun(jobId: string, attempt: number, queueJobId: string) {
    this.queueRuns.push({ jobId, attempt, queueJobId });
  }
  async queueJobIdFor(jobId: string) {
    const run = [...this.queueRuns].reverse().find((row) => row.jobId === jobId);
    return run?.queueJobId ?? null;
  }
}

function applyFilters(rows: ScanJobRow[], filters: ScanListFilters): ScanJobRow[] {
  return rows.filter(
    (row) =>
      (filters.status === undefined || row.status === filters.status) &&
      (filters.gate === undefined || row.reviewGateState === filters.gate) &&
      (filters.payment === undefined || row.paymentStatus === filters.payment) &&
      (filters.type === undefined || row.scanType === filters.type),
  );
}

function fakeStorage(keys: string[] = [AUTHORISATION_KEY]) {
  const objects = new Map(
    keys.map((key) => [key, { size: 204_800, contentType: 'application/pdf' }]),
  );
  const presigned: Array<{ key: string; contentType: string; maxBytes: number }> = [];
  const storage = {
    async presignPut(input: { key: string; contentType: string; maxBytes: number }) {
      presigned.push(input);
      return { url: `https://r2.vunvault.test/${input.key}?sig=test`, headers: {} };
    },
    async head(key: string) {
      return objects.get(key) ?? null;
    },
    async delete(key: string) {
      objects.delete(key);
    },
    async presignGet(input: { key: string }) {
      return `https://cdn.vunvault.test/${input.key}?sig=test`;
    },
    publicUrl(key: string) {
      return `https://cdn.vunvault.test/${key}`;
    },
  } satisfies ObjectStorage;
  return { storage, objects, presigned };
}

function fakeIssuer(repo: FakeScansRepo) {
  const issued: Array<{ orgId: string; title: string; scanJobId?: string | null }> = [];
  const issuer = {
    async issue(_tx: unknown, input: Parameters<InvoiceIssuer['issue']>[1]) {
      issued.push({ orgId: input.orgId, title: input.title, scanJobId: input.scanJobId ?? null });
      const job = repo.jobs.find((row) => row.id === input.scanJobId);
      if (job !== undefined) {
        job.invoiceId = 'e1000000-0000-4000-8000-0000000000e1';
        job.invoiceNumber = 'VV-INV-2026-0843';
      }
      return {
        id: 'e1000000-0000-4000-8000-0000000000e1',
        number: 'VV-INV-2026-0843',
        totalUsdCents: 89_900,
        issuedAt: '2026-10-06T12:00:00.000Z',
        dueAt: '2026-10-20T12:00:00.000Z',
        ledgerEntryId: 'entry-1',
        lineCount: input.lines.length,
      };
    },
  } satisfies Pick<InvoiceIssuer, 'issue'>;
  return { issuer, issued };
}

interface AuditRecord {
  eventType: string;
  message: string;
  actorLabel: string;
  subject: string | null;
  details: Record<string, unknown>;
}

interface Harness {
  app: FastifyInstance;
  repo: FakeScansRepo;
  audits: AuditRecord[];
  user: { current: AuthUser | null };
  storage: ReturnType<typeof fakeStorage>;
  issuer: ReturnType<typeof fakeIssuer>['issued'];
  enqueued: {
    scans: Array<{ payload: { jobId: string }; queueJobId: string }>;
    pdfs: Array<{ kind: string; refId: string }>;
    emails: Array<{ to: string; template: string }>;
    notifications: Array<{ userId: string; title: string }>;
    removed: string[];
    aborts: Array<{ channel: string; payload: unknown }>;
  };
}

function userFor(
  role: UserRole,
  overrides: Partial<AuthUser> = {},
  permissions: Permission[] = [...ROLE_PERMISSIONS[role]],
): AuthUser {
  return {
    id: role === 'client' ? CLIENT_USER : ADMIN_USER,
    email: role === 'client' ? 'billing@acmefintech.co.ke' : 'a.mwangi@vunvault.com',
    role,
    orgId: role === 'client' ? ORG_A : null,
    permissions,
    aal: role === 'client' ? 'aal1' : 'aal2',
    sessionId: '20000000-0000-4000-8000-000000000001',
    ...overrides,
  };
}

async function makeHarness(): Promise<Harness> {
  const repo = new FakeScansRepo();
  const storage = fakeStorage();
  const { issuer, issued } = fakeIssuer(repo);
  const audits: AuditRecord[] = [];
  const enqueued: Harness['enqueued'] = {
    scans: [],
    pdfs: [],
    emails: [],
    notifications: [],
    removed: [],
    aborts: [],
  };
  const user: Harness['user'] = { current: userFor('client') };

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
      return {
        seq: audits.length,
        id: 'entry-id',
        category: 'scan_completion',
        eventType: input.eventType,
        severity: 'info',
        sevLevel: null,
        actorId: actor.id,
        actorLabel: actor.label,
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
        createdAt: new Date('2026-10-06T12:00:00Z'),
      } as unknown as AuditEntryRow;
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
  await app.register(
    async (scope) => {
      await scope.register(scansRoutes, {
        repo,
        storage: storage.storage,
        issuer,
        workerSlotsTotal: 24,
        seams: {
          enqueueScan: async (payload, queueJobId) => {
            enqueued.scans.push({ payload, queueJobId });
          },
          enqueuePdf: async (payload) => {
            enqueued.pdfs.push(payload);
          },
          enqueueEmail: async (payload) => {
            enqueued.emails.push({ to: payload.to, template: payload.template });
          },
          notify: async (input) => {
            enqueued.notifications.push({ userId: input.userId, title: input.title });
          },
          removeQueued: async (queueJobId) => {
            enqueued.removed.push(queueJobId);
          },
          publishAbort: async (channel, payload) => {
            enqueued.aborts.push({ channel, payload });
          },
        },
      });
    },
    { prefix: '/api/v1' },
  );

  return { app, repo, audits, user, storage, issuer: issued, enqueued };
}

let harness: Harness;

beforeEach(async () => {
  harness = await makeHarness();
});

function allChecks(passed = true): Record<string, boolean> {
  return Object.fromEntries(REVIEW_CHECK_KEYS.map((key) => [key, passed]));
}

function asAdmin(permissions?: Permission[]): void {
  harness.user.current = userFor('admin', {}, permissions);
}

function gate(jobId: string, body: Record<string, unknown>) {
  return harness.app.inject({
    method: 'POST',
    url: `/api/v1/admin/scans/${jobId}/gate-decision`,
    payload: body,
  });
}

// ------------------------------------------------------------- client intake

describe('POST /api/v1/scans', () => {
  it('creates a queued job, records the authorisation and enqueues the scan', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/scans',
      payload: {
        targetHost: 'api.acmefintech.co.ke',
        scanType: 'external',
        priority: 'high',
        environment: 'production',
        scopeNotes: 'External API and auth flow',
        authorisationDocKey: AUTHORISATION_KEY,
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as { data: ScanJobRow };
    expect(body.data).toMatchObject({
      status: 'queued',
      paymentStatus: 'pending',
      reviewGateState: 'not_eligible',
      targetHost: 'api.acmefintech.co.ke',
      priority: 'high',
    });
    expect(body.data.jobCode).toMatch(/^JOB-\d{4,}$/);

    // One queue job, under a deterministic id, recorded against attempt 1.
    expect(harness.enqueued.scans).toHaveLength(1);
    expect(harness.enqueued.scans[0]?.queueJobId).toBe(queueJobIdFor(body.data.id));
    expect(harness.enqueued.scans[0]?.payload).toMatchObject({
      jobId: body.data.id,
      attempt: 1,
      scanType: 'external',
    });
    expect(harness.repo.queueRuns[0]).toMatchObject({ attempt: 1 });
    expect(harness.audits.map((audit) => audit.eventType)).toEqual(['SCAN_REQUESTED']);
  });

  it('refuses a scan with no authorisation document behind the key', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/scans',
      payload: {
        targetHost: 'api.acmefintech.co.ke',
        scanType: 'external',
        authorisationDocKey: `authorisations/${ORG_A}/does-not-exist.pdf`,
      },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: 'authorisation_missing' });
    expect(harness.repo.jobs).toHaveLength(0);
    expect(harness.enqueued.scans).toHaveLength(0);
  });

  it('refuses another organisation’s authorisation key', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/scans',
      payload: {
        targetHost: 'api.acmefintech.co.ke',
        scanType: 'external',
        authorisationDocKey: `authorisations/${ORG_B}/6f1e0f5a-0000-4000-8000-0000000000aa.pdf`,
      },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: 'authorisation_missing' });
  });

  it('refuses loopback, link-local, metadata and localhost targets', async () => {
    for (const targetHost of [
      'localhost',
      'sub.localhost',
      '127.0.0.1',
      '127.1.2.3',
      '169.254.169.254',
      'metadata.google.internal',
      'http://169.254.169.254/latest/meta-data/',
      '::1',
    ]) {
      const response = await harness.app.inject({
        method: 'POST',
        url: '/api/v1/scans',
        payload: { targetHost, scanType: 'external', authorisationDocKey: AUTHORISATION_KEY },
      });
      expect(response.statusCode, targetHost).toBe(422);
      expect(response.json(), targetHost).toMatchObject({ error: 'target_not_allowed' });
    }
    expect(harness.repo.jobs).toHaveLength(0);
  });

  it('accepts a hostname, an https URL host, an IPv4 address and a CIDR range', () => {
    expect(parseTarget('api.acmefintech.co.ke')).toEqual({
      host: 'api.acmefintech.co.ke',
      ip: null,
    });
    // The scheme and path are not part of the target: the host is.
    expect(parseTarget('https://portal.acmefintech.co.ke/app')).toEqual({
      host: 'portal.acmefintech.co.ke',
      ip: null,
    });
    expect(parseTarget('41.90.64.12')).toEqual({ host: '41.90.64.12', ip: '41.90.64.12' });
    // An internal range is in scope for an internal scan; it is not blocked.
    expect(parseTarget('10.24.8.0/24')).toEqual({ host: '10.24.8.0/24', ip: null });
  });

  it('issues a presigned upload under the caller’s own prefix', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/scans/authorisation-url',
      payload: { contentType: 'application/pdf', sizeBytes: 2_000_000 },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      data: { uploadUrl: string; objectKey: string; expiresAt: string };
    };
    expect(body.data.objectKey).toMatch(
      new RegExp(`^authorisations/${ORG_A}/[0-9a-f-]{36}\\.pdf$`),
    );
    expect(body.data.uploadUrl).toContain('https://');
    expect(new Date(body.data.expiresAt).toISOString()).toBe(body.data.expiresAt);
    expect(harness.storage.presigned[0]).toMatchObject({
      contentType: 'application/pdf',
      maxBytes: 10_485_760,
    });
  });

  it('refuses an upload that is not a PDF or is over ten megabytes', async () => {
    const notPdf = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/scans/authorisation-url',
      payload: { contentType: 'application/zip', sizeBytes: 1000 },
    });
    expect(notPdf.statusCode).toBe(400);

    const tooBig = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/scans/authorisation-url',
      payload: { contentType: 'application/pdf', sizeBytes: 10_485_761 },
    });
    expect(tooBig.statusCode).toBe(400);
  });
});

// ------------------------------------------------------- the release lock

describe('the client-portal release lock', () => {
  beforeEach(() => {
    harness.repo.jobs.push(
      seedJob({
        id: JOB_A,
        reviewGateState: 'approved_released',
        releasedAt: '2026-10-02T09:00:00.000Z',
      }),
      seedJob({
        id: JOB_B,
        jobCode: 'JOB-4473',
        orgId: ORG_B,
        orgName: 'Zenith Bank',
        reviewGateState: 'approved_released',
        releasedAt: '2026-10-02T09:00:00.000Z',
      }),
      seedJob({
        id: 'b1000000-0000-4000-8000-0000000000c3',
        jobCode: 'JOB-4474',
        reviewGateState: 'in_review',
      }),
    );
  });

  it('lists only the caller’s own released jobs', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/api/v1/scans' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: Array<{ id: string; jobCode: string }>; total: number };
    expect(body.data.map((job) => job.jobCode)).toEqual(['JOB-4472']);
    expect(body.total).toBe(1);
  });

  it('answers 404 for another client’s released job — not 403', async () => {
    harness.user.current = userFor('client', { orgId: ORG_B });
    const response = await harness.app.inject({ method: 'GET', url: `/api/v1/scans/${JOB_A}` });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: 'not_found' });
    // The body must not hint that the job exists.
    expect(response.body).not.toContain('JOB-4472');
    expect(response.body.toLowerCase()).not.toContain('forbidden');
  });

  it('answers 404 to its own client for a completed but un-released job', async () => {
    const unReleased = 'b1000000-0000-4000-8000-0000000000c3';
    const direct = await harness.app.inject({ method: 'GET', url: `/api/v1/scans/${unReleased}` });
    expect(direct.statusCode).toBe(404);

    const findings = await harness.app.inject({
      method: 'GET',
      url: `/api/v1/scans/${unReleased}/findings`,
    });
    expect(findings.statusCode).toBe(404);
  });

  it('lifts the lock the moment the gate releases the report', async () => {
    const inReview = harness.repo.jobs.find((job) => job.reviewGateState === 'in_review');
    if (inReview === undefined) throw new Error('fixture missing');
    inReview.paymentStatus = 'paid';

    asAdmin();
    const released = await gate(inReview.id, {
      decision: 'approve_release',
      checks: allChecks(),
      note: 'All five checks passed with the client on the call.',
    });
    expect(released.statusCode).toBe(200);

    harness.user.current = userFor('client');
    const nowVisible = await harness.app.inject({
      method: 'GET',
      url: `/api/v1/scans/${inReview.id}`,
    });
    expect(nowVisible.statusCode).toBe(200);
    expect((nowVisible.json() as { data: { jobCode: string } }).data.jobCode).toBe('JOB-4474');
  });

  it('builds every client filter from clientVisibleWhere and nowhere else', () => {
    // A hand-written copy of the predicate in a client query would be the bug this
    // task exists to prevent, so the source is checked directly.
    for (const file of ['./index.ts', './service.ts']) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8');
      expect(source, file).not.toContain("review_gate_state = 'approved_released'");
      expect(source, file).not.toContain("reviewGateState === 'approved_released'");
    }
    const repo = readFileSync(new URL('./repo.ts', import.meta.url), 'utf8');
    expect(repo).toContain('clientVisibleWhere');
    // The predicate itself is defined once, in visibility.ts.
    const visibility = readFileSync(new URL('./visibility.ts', import.meta.url), 'utf8');
    expect(visibility).toContain("review_gate_state = '${CLIENT_VISIBLE_GATE}'");
  });

  it('returns findings without raw evidence', async () => {
    harness.repo.findings[JOB_A] = [
      {
        id: 'f1000000-0000-4000-8000-0000000000f1',
        severity: 'critical',
        title: 'SQL injection in /api/v1/login',
        description: 'The login endpoint interpolates user input into a query.',
        cvss: 9.8,
        cwe: 'CWE-89',
        status: 'validated',
        remediationGuidance: 'Use parameterised queries.',
      },
    ];
    harness.repo.rawEvidence[JOB_A] = ['sqlmap -u https://target --data="user=admin\' OR 1=1"'];

    const response = await harness.app.inject({
      method: 'GET',
      url: `/api/v1/scans/${JOB_A}/findings`,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: Array<Record<string, unknown>> };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({ severity: 'critical', cwe: 'CWE-89', cvss: 9.8 });
    expect(response.body).not.toContain('evidenceRaw');
    expect(response.body).not.toContain('sqlmap');
  });
});

// --------------------------------------------------------------- the gate

describe('POST /api/v1/admin/scans/:id/gate-decision', () => {
  beforeEach(() => {
    harness.repo.jobs.push(seedJob({ id: JOB_A }));
    asAdmin();
  });

  it('releases a paid job with all five checks and tells the client', async () => {
    const response = await gate(JOB_A, {
      decision: 'approve_release',
      checks: allChecks(),
      note: 'Evidence sanitised and validated with the analyst.',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: { reviewGateState: string; jobCode: string } };
    expect(body.data.reviewGateState).toBe('approved_released');

    const job = harness.repo.jobs[0] as ScanJobRow;
    expect(job.releasedAt).not.toBeNull();
    expect(job.releasedBy).toBe(ADMIN_USER);
    expect(harness.repo.decisions).toHaveLength(1);
    expect(harness.repo.decisions[0]).toMatchObject({
      jobId: JOB_A,
      decision: 'approve_release',
      reviewerRole: 'admin',
    });
    expect(harness.repo.checks[JOB_A]).toEqual(allChecks());

    // Both entries, in the same transaction.
    expect(harness.audits.map((audit) => audit.eventType)).toEqual([
      'GATE_DECISION',
      'REPORT_RELEASED',
    ]);
    expect(harness.audits[1]?.message).toBe(
      'Report approved at the Mandatory Admin Review Gate and released to Acme Fintech client portal · reviewer note attached',
    );

    // The client is notified through their own preferences, and the PDF is queued.
    expect(harness.enqueued.notifications).toEqual([
      { userId: CLIENT_USER, title: 'JOB-4472 report released' },
    ]);
    expect(harness.enqueued.pdfs).toEqual([{ kind: 'report', refId: JOB_A }]);
  });

  it('blocks the release of an unpaid job, but keeps the decision and the violation', async () => {
    (harness.repo.jobs[0] as ScanJobRow).paymentStatus = 'overdue';

    const response = await gate(JOB_A, {
      decision: 'approve_release',
      checks: allChecks(),
      note: 'Approved on the call, invoice still outstanding.',
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'payment_outstanding' });

    // The gate moved to blocked_payment — it did NOT release.
    const job = harness.repo.jobs[0] as ScanJobRow;
    expect(job.reviewGateState).toBe('blocked_payment');
    expect(job.releasedAt).toBeNull();
    // The reviewer's work is still on the record.
    expect(harness.repo.decisions).toHaveLength(1);
    expect(harness.repo.checks[JOB_A]).toEqual(allChecks());

    const violation = harness.audits.find((audit) => audit.eventType === 'RELEASE_LOCK_VIOLATION');
    expect(violation).toBeDefined();
    expect(violation?.details).toMatchObject({ jobCode: 'JOB-4472', paymentStatus: 'overdue' });
    expect(harness.enqueued.notifications).toHaveLength(0);
    expect(harness.enqueued.pdfs).toHaveLength(0);
  });

  it('refuses a reviewer who can review but not release', async () => {
    asAdmin(['scans:read', 'scans:review'] as Permission[]);
    const response = await gate(JOB_A, {
      decision: 'approve_release',
      checks: allChecks(),
      note: 'Trying to release without the release permission.',
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'forbidden' });
    expect(harness.repo.decisions).toHaveLength(0);
    expect((harness.repo.jobs[0] as ScanJobRow).reviewGateState).toBe('in_review');
  });

  it('lets that same reviewer hold the job', async () => {
    asAdmin(['scans:read', 'scans:review'] as Permission[]);
    const response = await gate(JOB_A, {
      decision: 'hold_remediation',
      checks: allChecks(false),
      note: 'Two critical findings are not validated yet.',
    });
    expect(response.statusCode).toBe(200);
    expect((harness.repo.jobs[0] as ScanJobRow).status).toBe('held');
    expect((harness.repo.jobs[0] as ScanJobRow).reviewGateState).toBe('held_blocked');
    expect(harness.audits.map((audit) => audit.eventType)).toEqual(['GATE_DECISION', 'SCAN_HELD']);
  });

  it('rejects a release with one check outstanding, at the contract', async () => {
    const checks = allChecks();
    checks.evidence_sanitised = false;
    const response = await gate(JOB_A, {
      decision: 'approve_release',
      checks,
      note: 'One check is still outstanding.',
    });
    expect(response.statusCode).toBe(400);
    const body = response.json() as {
      error: string;
      details: Array<{ path: string[]; message: string }>;
    };
    expect(body.error).toBe('validation_failed');
    expect(body.details[0]?.path).toEqual(['checks']);
    expect(body.details[0]?.message).toBe(GATE_RELEASE_MESSAGE);
    expect(harness.repo.decisions).toHaveLength(0);
  });

  it('refuses to decide a job the scanner has not finished', async () => {
    (harness.repo.jobs[0] as ScanJobRow).status = 'running';
    const response = await gate(JOB_A, {
      decision: 'approve_release',
      checks: allChecks(),
      note: 'Trying to release a scan that is still running.',
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'not_reviewable' });
  });

  it('never un-releases a report', async () => {
    const first = await gate(JOB_A, {
      decision: 'approve_release',
      checks: allChecks(),
      note: 'Released after the client call.',
    });
    expect(first.statusCode).toBe(200);

    for (const decision of ['approve_release', 'hold_remediation', 'reject_archive']) {
      // A well-formed request, so the refusal can only come from the release lock.
      const again = await gate(JOB_A, {
        decision,
        checks: allChecks(),
        note: 'Trying to change a released report.',
      });
      expect(again.statusCode, decision).toBe(409);
      expect(again.json(), decision).toMatchObject({ error: 'already_released' });
    }
    expect((harness.repo.jobs[0] as ScanJobRow).reviewGateState).toBe('approved_released');
    expect(harness.repo.decisions).toHaveLength(1);
  });

  it('requires a note of at least ten characters', async () => {
    const response = await gate(JOB_A, {
      decision: 'hold_remediation',
      checks: allChecks(false),
      note: 'short',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'validation_failed' });
  });

  it('is staff-only and needs a second factor', async () => {
    harness.user.current = userFor('client');
    expect(
      (
        await gate(JOB_A, {
          decision: 'hold_remediation',
          checks: allChecks(false),
          note: 'not a member of staff at all',
        })
      ).statusCode,
    ).toBe(403);

    harness.user.current = userFor('admin', { aal: 'aal1' });
    const oneFactor = await gate(JOB_A, {
      decision: 'hold_remediation',
      checks: allChecks(false),
      note: 'Only one factor presented.',
    });
    expect(oneFactor.statusCode).toBe(403);
    expect(oneFactor.json()).toMatchObject({ error: 'mfa_required' });
  });
});

// ------------------------------------------------------------------- bulk

describe('POST /api/v1/admin/scans/bulk', () => {
  beforeEach(() => {
    harness.repo.jobs.push(
      seedJob({ id: JOB_A, status: 'completed', reviewGateState: 'not_eligible' }),
      seedJob({
        id: JOB_B,
        jobCode: 'JOB-4473',
        status: 'running',
        reviewGateState: 'not_eligible',
      }),
      seedJob({
        id: 'b1000000-0000-4000-8000-0000000000c3',
        jobCode: 'JOB-4474',
        status: 'completed',
        reviewGateState: 'approved_released',
        releasedAt: '2026-10-02T09:00:00.000Z',
      }),
    );
    asAdmin();
  });

  function bulk(body: Record<string, unknown>) {
    return harness.app.inject({ method: 'POST', url: '/api/v1/admin/scans/bulk', payload: body });
  }

  it('opens the gate for eligible jobs and skips the rest', async () => {
    const response = await bulk({
      action: 'open_review_gate',
      ids: [
        JOB_A,
        JOB_B,
        'b1000000-0000-4000-8000-0000000000c3',
        'b1000000-0000-4000-8000-0000000000ff',
      ],
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: {
        updated: 1,
        skippedIds: [
          JOB_B,
          'b1000000-0000-4000-8000-0000000000c3',
          'b1000000-0000-4000-8000-0000000000ff',
        ],
      },
    });
    expect(harness.repo.jobs[0]?.reviewGateState).toBe('in_review');
    // One entry for the whole batch.
    expect(harness.audits).toHaveLength(1);
    expect(harness.audits[0]).toMatchObject({ eventType: 'BULK_SCAN_ACTION' });
    expect(harness.audits[0]?.details).toMatchObject({ action: 'open_review_gate' });
  });

  it('can never release a report', async () => {
    for (const action of ['open_review_gate', 'assign_reviewer', 'place_on_hold', 'reject_batch']) {
      const local = await makeHarness();
      local.repo.jobs.push(
        seedJob({
          id: JOB_A,
          status: 'completed',
          reviewGateState: 'approved_released',
          releasedAt: '2026-10-02T09:00:00.000Z',
        }),
        seedJob({
          id: JOB_B,
          jobCode: 'JOB-4473',
          status: 'completed',
          reviewGateState: 'not_eligible',
        }),
      );
      local.user.current = userFor('admin');
      local.repo.reviewers[ADMIN_USER] = {
        id: ADMIN_USER,
        role: 'admin',
        accountStatus: 'active',
        deletedAt: null,
      };
      const response = await local.app.inject({
        method: 'POST',
        url: '/api/v1/admin/scans/bulk',
        payload: {
          action,
          ids: [JOB_A, JOB_B],
          ...(action === 'assign_reviewer' ? { reviewerId: ADMIN_USER } : {}),
        },
      });
      expect(response.statusCode, action).toBe(200);
      const released = local.repo.jobs.find((job) => job.id === JOB_A) as ScanJobRow;
      expect(released.reviewGateState, action).toBe('approved_released');
      expect(released.releasedAt, action).not.toBeNull();
      // No bulk path writes a release.
      expect(
        local.repo.patches.some((entry) => entry.patch.releasedAt !== undefined),
        action,
      ).toBe(false);
    }
  });

  it('rejects a reviewer who is not an active member with review rights', async () => {
    harness.repo.reviewers[ADMIN_USER] = {
      id: ADMIN_USER,
      role: 'security_analyst',
      accountStatus: 'active',
      deletedAt: null,
    };
    const response = await bulk({
      action: 'assign_reviewer',
      ids: [JOB_A],
      reviewerId: ADMIN_USER,
    });
    expect(response.statusCode).toBe(400);
    const body = response.json() as { details: Array<{ path: string[] }> };
    expect(body.details[0]?.path).toEqual(['reviewerId']);

    harness.repo.reviewers[ADMIN_USER] = {
      id: ADMIN_USER,
      role: 'admin',
      accountStatus: 'active',
      deletedAt: null,
    };
    const accepted = await bulk({
      action: 'assign_reviewer',
      ids: [JOB_A],
      reviewerId: ADMIN_USER,
    });
    expect(accepted.statusCode).toBe(200);
    expect(harness.repo.jobs[0]?.assignedReviewerId).toBe(ADMIN_USER);
  });

  it('holds and rejects in bulk', async () => {
    const held = await bulk({ action: 'place_on_hold', ids: [JOB_A, JOB_B] });
    expect((held.json() as { data: { updated: number } }).data.updated).toBe(2);
    expect(harness.repo.jobs[0]?.status).toBe('held');
    expect(harness.repo.jobs[1]?.status).toBe('held');

    const rejected = await bulk({ action: 'reject_batch', ids: [JOB_A] });
    expect(rejected.statusCode).toBe(200);
    expect(harness.repo.jobs[0]?.status).toBe('rejected');
    expect(harness.repo.jobs[0]?.reviewGateState).toBe('held_blocked');
  });

  it('refuses more than a hundred ids', async () => {
    const ids = Array.from(
      { length: 101 },
      (_, index) => `b1000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    );
    const response = await bulk({ action: 'place_on_hold', ids });
    expect(response.statusCode).toBe(400);
  });
});

// ------------------------------------------------------- payment + cancel

describe('admin payment and cancellation', () => {
  beforeEach(() => {
    harness.repo.jobs.push(seedJob({ id: JOB_A, status: 'queued', paymentStatus: 'pending' }));
    asAdmin();
  });

  it('issues an invoice once and emails the client', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: `/api/v1/admin/scans/${JOB_A}/request-payment`,
    });
    expect(response.statusCode).toBe(200);
    expect(harness.issuer).toHaveLength(1);
    expect(harness.issuer[0]).toMatchObject({ orgId: ORG_A, scanJobId: JOB_A });
    expect(harness.enqueued.emails).toEqual([
      { to: 'billing@acmefintech.co.ke', template: 'invoice_issued' },
    ]);
    expect(harness.audits.map((audit) => audit.eventType)).toEqual(['SCAN_PAYMENT_REQUESTED']);

    // A second request does not bill the client twice.
    const again = await harness.app.inject({
      method: 'POST',
      url: `/api/v1/admin/scans/${JOB_A}/request-payment`,
    });
    expect(again.statusCode).toBe(200);
    expect(harness.issuer).toHaveLength(1);
  });

  it('cancels a queued job by removing it from the queue', async () => {
    harness.repo.queueRuns.push({ jobId: JOB_A, attempt: 1, queueJobId: queueJobIdFor(JOB_A) });
    const response = await harness.app.inject({
      method: 'POST',
      url: `/api/v1/admin/scans/${JOB_A}/cancel`,
    });
    expect(response.statusCode).toBe(200);
    expect((response.json() as { data: { status: string } }).data.status).toBe('cancelled');
    expect(harness.enqueued.removed).toEqual([queueJobIdFor(JOB_A)]);
    expect(harness.enqueued.aborts).toHaveLength(0);
    expect(harness.audits.map((audit) => audit.eventType)).toEqual(['SCAN_CANCELLED']);
  });

  it('aborts a running job over its control channel instead of removing it', async () => {
    (harness.repo.jobs[0] as ScanJobRow).status = 'running';
    const response = await harness.app.inject({
      method: 'POST',
      url: `/api/v1/admin/scans/${JOB_A}/cancel`,
    });
    expect(response.statusCode).toBe(200);
    expect(harness.enqueued.aborts).toEqual([
      { channel: abortChannelFor(JOB_A), payload: { type: 'abort', jobId: JOB_A } },
    ]);
    expect(harness.enqueued.removed).toHaveLength(0);
  });

  it('refuses to cancel a finished scan', async () => {
    (harness.repo.jobs[0] as ScanJobRow).status = 'completed';
    const response = await harness.app.inject({
      method: 'POST',
      url: `/api/v1/admin/scans/${JOB_A}/cancel`,
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'not_cancellable' });
  });
});

// ----------------------------------------------------------------- summary

describe('GET /api/v1/admin/scans/summary', () => {
  it('reports the queue numbers the fixtures describe', async () => {
    harness.repo.counts = {
      jobsInQueue: 7,
      addedToday: 2,
      runningScans: 3,
      awaitingAdminReview: 4,
      approvedReleased: 41,
      releasedThisWeek: 6,
      paymentOutstanding: 5,
      overdueOver14Days: 1,
      heldRejected: 2,
    };
    asAdmin();
    const response = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/admin/scans/summary',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: {
        jobsInQueue: 7,
        addedToday: 2,
        runningScans: 3,
        workerSlotsUsed: 3,
        workerSlotsTotal: 24,
        awaitingAdminReview: 4,
        approvedReleased: 41,
        releasedThisWeek: 6,
        paymentOutstanding: 5,
        overdueOver14Days: 1,
        heldRejected: 2,
      },
    });
  });

  it('is staff-only', async () => {
    harness.user.current = userFor('client');
    const response = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/admin/scans/summary',
    });
    expect(response.statusCode).toBe(403);
  });
});

describe('GET /api/v1/admin/scans', () => {
  it('lists every job with its client, newest first', async () => {
    harness.repo.jobs.push(
      seedJob({ id: JOB_A, requestedAt: '2026-10-01T09:00:00.000Z' }),
      seedJob({
        id: JOB_B,
        jobCode: 'JOB-4473',
        orgId: ORG_B,
        orgName: 'Zenith Bank',
        requestedAt: '2026-10-05T09:00:00.000Z',
      }),
    );
    asAdmin();
    const response = await harness.app.inject({ method: 'GET', url: '/api/v1/admin/scans' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      data: Array<{ jobCode: string; client: { name: string } }>;
      total: number;
    };
    expect(body.total).toBe(2);
    expect(body.data[0]?.client).toMatchObject({ orgId: ORG_A, name: 'Acme Fintech' });
    expect(body.data[1]?.client).toMatchObject({ orgId: ORG_B, name: 'Zenith Bank' });
  });
});

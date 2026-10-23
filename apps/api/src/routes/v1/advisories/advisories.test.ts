import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Permission, UserRole } from '@vunvault/contracts';
import {
  BROADCAST_ACK_MESSAGE,
  BROADCAST_CONFIRM_MESSAGE,
  CVE_ID_MESSAGE,
  ROLE_PERMISSIONS,
} from '@vunvault/contracts';
import type { Env } from '../../../config/env';
import errorHandler from '../../../plugins/error-handler';
import type { AuthUser } from '../../../plugins/auth';
import { HttpError } from '../../../lib/http-error';
import type { AuditEntryRow } from '../../../audit/repo';
import { AUDIT_EVENTS } from '../../../audit/events';
import { HttpNvdClient, type NvdCache } from './nvd';
import advisoriesRoutes from './index';
import { countsTowardsReach, type ClientAsset } from './matching';
import type {
  AdvisoryPatch,
  AdvisoryRow,
  AdvisoriesRepo,
  BroadcastRow,
  ClientAdvisoryRow,
  NewAdvisory,
  NewBroadcast,
} from './repo';

/**
 * The Zero-Day desk.
 *
 * The assertions that matter are about consequences: a broadcast that is not
 * authorised must not happen, one that is authorised must be recorded at SEV-1 and
 * queued exactly once, and a client must never see anything that has not been
 * published.
 */

const ADVISORY_ID = 'f1000000-0000-4000-8000-0000000000ad';
const ORG_A = 'd1000000-0000-4000-8000-0000000000a1';
const CLIENT_USER = 'c1000000-0000-4000-8000-0000000000c1';
const ANALYST_ID = 'c1000000-0000-4000-8000-0000000000a2';
const ADMIN_ID = 'c1000000-0000-4000-8000-0000000000ad';
const COMMANDER_ID = 'c1000000-0000-4000-8000-0000000000ff';
const CVE = 'CVE-2026-21447';

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

function advisoryRow(overrides: Partial<AdvisoryRow> = {}): AdvisoryRow {
  return {
    id: ADVISORY_ID,
    cveId: CVE,
    vendor: 'apache',
    cvss: 9.8,
    disclosureDate: '2026-09-30',
    severity: 'critical',
    weaponized: true,
    publicPoc: true,
    preAuth: true,
    patchAvailable: true,
    title: 'Apache Struts remote code execution',
    summary: 'A deserialisation flaw allows unauthenticated remote code execution.',
    remediation: 'Upgrade to Struts 2.5.33.',
    references: ['https://struts.apache.org/announce-2026'],
    scope: [{ label: 'Web & API · Struts 2.0.0 – 2.5.32', category: 'web_api' }],
    status: 'draft',
    patchStatus: 'unpatched',
    authorId: ANALYST_ID,
    authorLabel: 'Brian Otieno',
    contentItemId: null,
    contentItemStatus: null,
    lastSavedAt: '2026-10-06T09:00:00.000Z',
    publishedAt: null,
    retractedAt: null,
    retractionNote: null,
    lastBroadcastAt: null,
    reach: null,
    ...overrides,
  };
}

function jsonResponse(status: number, payload: unknown): Response {
  const text = JSON.stringify(payload);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    json: async () => payload,
  } as unknown as Response;
}

class FakeAdvisoriesRepo implements AdvisoriesRepo {
  rows: AdvisoryRow[] = [advisoryRow()];
  broadcasts: BroadcastRow[] = [];
  acknowledgements: Array<{ advisoryId: string; orgId: string; acknowledgedAt: string }> = [];
  estate: ClientAsset[] = [
    {
      orgId: ORG_A,
      category: 'web_api',
      product: 'Struts 2',
      version: '2.5.30',
      host: 'api.a.test',
    },
  ];
  contacts = { emailContacts: 4, smsContacts: 2 };
  summaryCounts = {
    activeZeroDays: 3,
    criticalSeverity: 9,
    unpatchedCritical: 9,
    weaponizedInWild: 37,
    advisoriesPublished: 41,
    broadcastThisMonth: 5,
    openDrafts: 2,
    escalatedDrafts: 1,
  };
  dashboardsReached = 12;
  newClientsThisMonth = 3;

  async findByCveId(cveId: string) {
    return this.rows.find((row) => row.cveId === cveId) ?? null;
  }
  async findById(advisoryId: string) {
    return this.rows.find((row) => row.id === advisoryId) ?? null;
  }
  async createDraft(input: NewAdvisory) {
    const row = advisoryRow({
      ...input,
      authorLabel: 'Brian Otieno',
      status: 'draft',
      patchStatus: 'unpatched',
      publishedAt: null,
      retractedAt: null,
      retractionNote: null,
      lastBroadcastAt: null,
      reach: null,
      lastSavedAt: input.lastSavedAt.toISOString(),
    });
    this.rows.push(row);
    return row;
  }
  async updateDraft(advisoryId: string, patch: AdvisoryPatch) {
    const row = this.rows.find((candidate) => candidate.id === advisoryId);
    if (row === undefined) return;
    Object.assign(row, patch);
    if (patch.lastSavedAt !== undefined) row.lastSavedAt = patch.lastSavedAt.toISOString();
  }
  async listAdmin(filters: { page: number; pageSize: number; status?: string }) {
    const rows =
      filters.status === undefined
        ? this.rows
        : this.rows.filter((row) => row.status === filters.status);
    return { rows, total: rows.length };
  }
  async listDrafts() {
    return this.rows.filter((row) => row.status === 'draft');
  }
  async summary() {
    return this.summaryCounts;
  }
  async markPublished(advisoryId: string, at: Date) {
    const row = this.rows.find((candidate) => candidate.id === advisoryId);
    if (row === undefined) return;
    row.status = 'published';
    row.publishedAt = at.toISOString();
  }
  async insertBroadcast(input: NewBroadcast) {
    const row: BroadcastRow = {
      id: input.id,
      advisoryId: input.advisoryId,
      kind: input.kind,
      status: 'queued',
      triggeredByLabel: 'a.mwangi',
      ack: input.ack,
      audienceDashboards: input.audienceDashboards,
      emailContacts: input.emailContacts,
      smsContacts: input.smsContacts,
      sentDashboards: 0,
      sentEmail: 0,
      sentSms: 0,
      failed: 0,
      auditSeq: null,
      // The real clock: the one-broadcast-a-minute rule is measured against it.
      createdAt: new Date().toISOString(),
      finishedAt: null,
    };
    this.broadcasts.push(row);
    const advisory = this.rows.find((candidate) => candidate.id === input.advisoryId);
    if (advisory !== undefined) advisory.lastBroadcastAt = row.createdAt;
    return row;
  }
  async setBroadcastAuditSeq(broadcastId: string, seq: number) {
    const row = this.broadcasts.find((candidate) => candidate.id === broadcastId);
    if (row !== undefined) row.auditSeq = seq;
  }
  async listBroadcasts(advisoryId: string) {
    return this.broadcasts.filter((row) => row.advisoryId === advisoryId);
  }
  async firstBroadcastAt(advisoryId: string) {
    const first = this.broadcasts.find(
      (row) => row.advisoryId === advisoryId && row.kind === 'initial',
    );
    return first?.createdAt ?? null;
  }
  async lastBroadcastAt(advisoryId: string) {
    const matching = this.broadcasts.filter((row) => row.advisoryId === advisoryId);
    return matching.length === 0 ? null : (matching[matching.length - 1]?.createdAt ?? null);
  }
  async retract(advisoryId: string, at: Date, note: string) {
    const row = this.rows.find((candidate) => candidate.id === advisoryId);
    if (row === undefined) return;
    row.status = 'retracted';
    row.retractedAt = at.toISOString();
    row.retractionNote = note;
  }
  async setPatchStatus(advisoryId: string, patchStatus: string) {
    const row = this.rows.find((candidate) => candidate.id === advisoryId);
    if (row !== undefined) row.patchStatus = patchStatus;
  }
  async listForClient(orgId: string) {
    const rows: ClientAdvisoryRow[] = [];
    for (const row of this.rows) {
      if (row.status !== 'published' || row.retractedAt !== null) continue;
      if (
        row.title === null ||
        row.severity === null ||
        row.summary === null ||
        row.remediation === null
      ) {
        continue;
      }
      rows.push({
        id: row.id,
        cveId: row.cveId,
        title: row.title,
        severity: row.severity,
        scope: row.scope,
        summary: row.summary,
        remediation: row.remediation,
        references: row.references,
        patchStatus: row.patchStatus,
        publishedAt: row.publishedAt ?? '',
        acknowledged: this.acknowledgements.some(
          (entry) => entry.advisoryId === row.id && entry.orgId === orgId,
        ),
      });
    }
    return rows;
  }
  async acknowledge(advisoryId: string, orgId: string, _userId: string | null, at: Date) {
    const existing = this.acknowledgements.find(
      (entry) => entry.advisoryId === advisoryId && entry.orgId === orgId,
    );
    if (existing !== undefined) {
      existing.acknowledgedAt = at.toISOString();
      return;
    }
    this.acknowledgements.push({ advisoryId, orgId, acknowledgedAt: at.toISOString() });
  }
  async assets() {
    return this.estate;
  }
  async contactsFor() {
    return this.contacts;
  }
  async orgsWithAcknowledgementSince() {
    return this.dashboardsReached;
  }
  async orgsCreatedSince() {
    return this.newClientsThisMonth;
  }
  /** Reach, computed the way the SQL does it: inside 24 h of the first broadcast. */
  reachFor(advisoryId: string): number {
    const first = this.broadcasts.find(
      (row) => row.advisoryId === advisoryId && row.kind === 'initial',
    );
    if (first === undefined) return 0;
    return this.acknowledgements.filter(
      (entry) =>
        entry.advisoryId === advisoryId &&
        countsTowardsReach(first.createdAt, entry.acknowledgedAt),
    ).length;
  }
}

interface AuditRecord {
  eventType: string;
  message: string;
  sevLevel: number | null;
  severity: string | null;
  actorLabel: string;
  subject: string | null;
}

interface Harness {
  app: FastifyInstance;
  repo: FakeAdvisoriesRepo;
  audits: AuditRecord[];
  enqueued: Array<{ broadcastId: string; advisoryId: string; kind: string }>;
  enqueueFails: { value: boolean };
  warnings: string[];
  commanderPages: Array<{ userId: string; title: string }>;
  user: { current: AuthUser | null };
}

function userFor(
  role: UserRole,
  permissions: Permission[],
  overrides: Partial<AuthUser> = {},
): AuthUser {
  return {
    id: role === 'client' ? CLIENT_USER : role === 'admin' ? ADMIN_ID : ANALYST_ID,
    email: role === 'client' ? 'billing@acmefintech.co.ke' : 'a.mwangi@vunvault.com',
    role,
    orgId: role === 'client' ? ORG_A : null,
    permissions,
    aal: role === 'client' ? 'aal1' : 'aal2',
    sessionId: '20000000-0000-4000-8000-000000000001',
    ...overrides,
  };
}

const adminPermissions = [...ROLE_PERMISSIONS.admin] as Permission[];
const analystPermissions = [...ROLE_PERMISSIONS.security_analyst] as Permission[];

async function makeHarness(): Promise<Harness> {
  const repo = new FakeAdvisoriesRepo();
  const audits: AuditRecord[] = [];
  const enqueued: Harness['enqueued'] = [];
  const enqueueFails = { value: false };
  const warnings: string[] = [];
  const commanderPages: Harness['commanderPages'] = [];
  const user: Harness['user'] = { current: userFor('admin', adminPermissions) };

  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('env', TEST_ENV);
  app.decorateRequest('clientIp', '');
  app.decorateRequest('requestId', '');
  // Capture the warnings the route logs when a delivery cannot be queued. Pino is
  // called as `warn(fields, message)`, so every argument is kept.
  (app.log as unknown as { warn: (...args: unknown[]) => void }).warn = (...args: unknown[]) => {
    warnings.push(args.map((arg) => String(arg)).join(' '));
  };

  const fakeTx = { unsafe: async () => [] };
  app.decorate('withTx', (async (work: (tx: unknown) => Promise<unknown>) =>
    work(fakeTx)) as unknown as FastifyInstance['withTx']);
  app.decorate('audit', {
    append: async (_executor: unknown, input: Record<string, unknown>) => {
      const actor = input.actor as { id: string | null; label: string };
      const catalogue = AUDIT_EVENTS[String(input.eventType) as keyof typeof AUDIT_EVENTS];
      audits.push({
        eventType: String(input.eventType),
        message: String(input.message),
        // The catalogue's own severity, raised (never lowered) by the caller.
        sevLevel:
          Math.max(
            (input.sevLevel as number | undefined) ?? 0,
            (catalogue as { sevLevel?: number } | undefined)?.sevLevel ?? 0,
          ) || null,
        severity: catalogue?.severity ?? null,
        actorLabel: actor.label,
        subject: (input.subject as string | undefined) ?? null,
      });
      return {
        seq: audits.length,
        id: 'entry-id',
        category: (catalogue as { category?: string } | undefined)?.category ?? 'administrative',
        eventType: input.eventType,
        severity: (catalogue as { severity?: string } | undefined)?.severity ?? 'info',
        sevLevel: (catalogue as { sevLevel?: number } | undefined)?.sevLevel ?? null,
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
    if (current.role === 'client') throw HttpError.forbidden();
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
      await scope.register(advisoriesRoutes, {
        repo,
        nvd: { getCve: async () => null },
        incidentCommanderId: COMMANDER_ID,
        enqueueBroadcast: async (job) => {
          if (enqueueFails.value) throw new Error('queue unreachable');
          enqueued.push(job);
        },
        notifyCommander: async (input) => {
          commanderPages.push({ userId: input.userId, title: input.title });
        },
      });
    },
    { prefix: '/api/v1' },
  );

  return { app, repo, audits, enqueued, enqueueFails, warnings, commanderPages, user };
}

let harness: Harness;

beforeEach(async () => {
  harness = await makeHarness();
});

const ACK = {
  severityCorrect: true,
  scopeComplete: true,
  contentSafe: true,
  remediationActionable: true,
  authorised: true,
};

function broadcast(kind = 'broadcast', body: Record<string, unknown> = {}) {
  return harness.app.inject({
    method: 'POST',
    url: `/api/v1/admin/advisories/${ADVISORY_ID}/${kind}`,
    payload: { ack: ACK, confirmPhrase: 'BROADCAST', ...body },
  });
}

// ------------------------------------------------------------------ drafts

describe('drafts', () => {
  const DRAFT_BODY = {
    cveId: CVE,
    vendor: 'apache',
    cvss: 9.8,
    severity: 'critical',
    weaponized: true,
    publicPoc: true,
    preAuth: true,
    patchAvailable: true,
    title: 'Apache Struts remote code execution',
    summary: 'A deserialisation flaw allows unauthenticated remote code execution.',
    remediation: 'Upgrade to Struts 2.5.33.',
    references: [],
    scope: [{ label: 'Web & API · Struts 2.0.0 – 2.5.32', category: 'web_api' }],
  };

  it('refuses a malformed CVE id with the editor’s own message', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/admin/advisories',
      payload: { ...DRAFT_BODY, cveId: 'CVE-26-1' },
    });
    expect(response.statusCode).toBe(400);
    const body = response.json() as { details: Array<{ message: string }> };
    expect(body.details[0]?.message).toBe(CVE_ID_MESSAGE);
    expect(CVE_ID_MESSAGE).toBe('Enter a valid CVE identifier in the format CVE-YYYY-NNNNN.');
  });

  it('refuses a duplicate CVE', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/admin/advisories',
      payload: DRAFT_BODY,
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'cve_exists' });
  });

  it('creates a draft as the caller and audits the save', async () => {
    harness.user.current = userFor('security_analyst', analystPermissions, {
      id: 'c1000000-0000-4000-8000-0000000000a9',
    });
    const response = await harness.app.inject({
      method: 'POST',
      url: '/api/v1/admin/advisories',
      payload: { ...DRAFT_BODY, cveId: 'CVE-2026-31337' },
    });
    expect(response.statusCode).toBe(201);
    const created = harness.repo.rows.at(-1) as AdvisoryRow;
    expect(created.status).toBe('draft');
    expect(created.authorId).toBe('c1000000-0000-4000-8000-0000000000a9');
    expect(created.lastSavedAt).not.toBeNull();
    expect(harness.audits.map((audit) => audit.eventType)).toEqual(['ADVISORY_DRAFT_SAVED']);
  });

  it('refuses to edit a published advisory', async () => {
    (harness.repo.rows[0] as AdvisoryRow).status = 'published';
    const response = await harness.app.inject({
      method: 'PUT',
      url: `/api/v1/admin/advisories/${ADVISORY_ID}`,
      payload: DRAFT_BODY,
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'not_editable' });
  });

  it('lets the author edit, and refuses anybody else without broadcast rights', async () => {
    harness.user.current = userFor('security_analyst', analystPermissions, {
      id: 'c1000000-0000-4000-8000-0000000000a9',
    });
    const forbidden = await harness.app.inject({
      method: 'PUT',
      url: `/api/v1/admin/advisories/${ADVISORY_ID}`,
      payload: DRAFT_BODY,
    });
    expect(forbidden.statusCode).toBe(403);

    harness.user.current = userFor('security_analyst', analystPermissions, { id: ANALYST_ID });
    const allowed = await harness.app.inject({
      method: 'PUT',
      url: `/api/v1/admin/advisories/${ADVISORY_ID}`,
      payload: { ...DRAFT_BODY, title: 'Updated title' },
    });
    expect(allowed.statusCode).toBe(200);
    expect((allowed.json() as { data: { title: string } }).data.title).toBe('Updated title');
  });

  it('computes the draft list note', async () => {
    harness.repo.rows = [
      advisoryRow({ id: ADVISORY_ID, scope: [] }),
      advisoryRow({
        id: 'f1000000-0000-4000-8000-0000000000ae',
        cveId: 'CVE-2026-31338',
        contentItemId: 'e1000000-0000-4000-8000-0000000000c1',
        contentItemStatus: 'in_review',
      }),
      advisoryRow({ id: 'f1000000-0000-4000-8000-0000000000af', cveId: 'CVE-2026-31339' }),
    ];
    const response = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/admin/advisories/drafts',
    });
    const body = response.json() as { data: Array<{ cveId: string; note: string | null }> };
    expect(body.data.map((row) => row.note)).toEqual([
      'Needs scope entries',
      'Awaiting reviewer',
      null,
    ]);
  });
});

// --------------------------------------------------------------- broadcast

describe('the emergency broadcast', () => {
  it('publishes, queues one job, and writes a SEV-1 entry with its seq on the row', async () => {
    const response = await broadcast();

    expect(response.statusCode).toBe(202);
    const record = (response.json() as { data: { id: string; status: string; kind: string } }).data;
    expect(record).toMatchObject({ status: 'queued', kind: 'initial' });

    expect((harness.repo.rows[0] as AdvisoryRow).status).toBe('published');
    expect((harness.repo.rows[0] as AdvisoryRow).publishedAt).not.toBeNull();
    expect(harness.repo.broadcasts).toHaveLength(1);
    expect(harness.repo.broadcasts[0]?.audienceDashboards).toBe(1);
    expect(harness.repo.broadcasts[0]?.emailContacts).toBe(4);
    expect(harness.repo.broadcasts[0]?.smsContacts).toBe(2);

    const entry = harness.audits.find((audit) => audit.eventType === 'ADVISORY_BROADCAST');
    expect(entry?.sevLevel).toBe(1);
    expect(entry?.message).toBe(`${CVE} emergency advisory pushed to 1 client dashboards`);
    // The chain height that authorises the broadcast is stored on the row.
    expect(harness.repo.broadcasts[0]?.auditSeq).not.toBeNull();

    // Exactly one delivery job, and the commander is paged.
    expect(harness.enqueued).toHaveLength(1);
    expect(harness.enqueued[0]).toMatchObject({ advisoryId: ADVISORY_ID, kind: 'initial' });
    expect(harness.commanderPages).toEqual([
      { userId: COMMANDER_ID, title: `${CVE} emergency advisory broadcast` },
    ]);
  });

  it('still answers 202 when the queue is unreachable, and leaves the row queued', async () => {
    harness.enqueueFails.value = true;
    const response = await broadcast();

    expect(response.statusCode).toBe(202);
    expect(harness.repo.broadcasts[0]?.status).toBe('queued');
    expect(harness.enqueued).toHaveLength(0);
    // The failure is visible in the logs, so the maintenance worker's backlog is
    // explainable rather than mysterious.
    expect(harness.warnings.join(' ')).toContain('broadcast enqueue failed');
    // Published and audited regardless: the decision stands even if delivery lags.
    expect((harness.repo.rows[0] as AdvisoryRow).status).toBe('published');
    expect(harness.audits.map((audit) => audit.eventType)).toContain('ADVISORY_BROADCAST');
  });

  it('refuses four acknowledgements, and the wrong phrase', async () => {
    const fourAcks = await broadcast('broadcast', {
      ack: { ...ACK, remediationActionable: false },
    });
    expect(fourAcks.statusCode).toBe(400);
    const ackBody = fourAcks.json() as { details: Array<{ path: string[]; message: string }> };
    expect(ackBody.details[0]?.path).toEqual(['ack']);
    expect(ackBody.details[0]?.message).toBe(BROADCAST_ACK_MESSAGE);

    const wrongPhrase = await broadcast('broadcast', { confirmPhrase: 'broadcast!' });
    expect(wrongPhrase.statusCode).toBe(400);
    const phraseBody = wrongPhrase.json() as {
      details: Array<{ path: string[]; message: string }>;
    };
    expect(phraseBody.details[0]?.path).toEqual(['confirmPhrase']);
    expect(phraseBody.details[0]?.message).toBe(BROADCAST_CONFIRM_MESSAGE);

    expect(harness.repo.broadcasts).toHaveLength(0);
    expect((harness.repo.rows[0] as AdvisoryRow).status).toBe('draft');
  });

  it('accepts the phrase in any case', async () => {
    const response = await broadcast('broadcast', { confirmPhrase: ' broadcast ' });
    expect(response.statusCode).toBe(202);
  });

  it('refuses an advisory with no scope, listing what is missing', async () => {
    (harness.repo.rows[0] as AdvisoryRow).scope = [];
    const response = await broadcast();
    expect(response.statusCode).toBe(422);
    const body = response.json() as { error: string; details: Array<{ path: string[] }> };
    expect(body.error).toBe('advisory_incomplete');
    expect(body.details.map((entry) => entry.path)).toEqual([['scope']]);
    expect(harness.repo.broadcasts).toHaveLength(0);
    expect((harness.repo.rows[0] as AdvisoryRow).status).toBe('draft');
  });

  it('refuses an analyst who can write but not broadcast', async () => {
    harness.user.current = userFor('security_analyst', analystPermissions, { id: ANALYST_ID });
    const response = await broadcast();
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'forbidden' });
    expect(harness.repo.broadcasts).toHaveLength(0);
  });

  it('refuses a second broadcast inside a minute', async () => {
    expect((await broadcast()).statusCode).toBe(202);
    // The advisory is published now, so the only broadcast it can take is a
    // reminder — and that is the one the per-minute rule has to stop.
    const again = await broadcast('rebroadcast');
    expect(again.statusCode).toBe(409);
    expect(again.json()).toMatchObject({ error: 'broadcast_in_progress' });
    expect(harness.repo.broadcasts).toHaveLength(1);
    expect(harness.audits.filter((audit) => audit.eventType === 'ADVISORY_BROADCAST')).toHaveLength(
      1,
    );
  });

  it('re-broadcasts a published advisory at SEV-2 and never a draft', async () => {
    (harness.repo.rows[0] as AdvisoryRow).status = 'published';
    (harness.repo.rows[0] as AdvisoryRow).publishedAt = '2026-10-01T09:00:00.000Z';

    const response = await broadcast('rebroadcast');
    expect(response.statusCode).toBe(202);
    expect(harness.repo.broadcasts[0]?.kind).toBe('rebroadcast');
    expect(harness.audits[0]?.sevLevel).toBe(2);
    // A reminder does not page the commander again.
    expect(harness.commanderPages).toHaveLength(0);

    const draft = await makeHarness();
    const refused = await draft.app.inject({
      method: 'POST',
      url: `/api/v1/admin/advisories/${ADVISORY_ID}/rebroadcast`,
      payload: { ack: ACK, confirmPhrase: 'BROADCAST' },
    });
    expect(refused.statusCode).toBe(422);
  });
});

// ---------------------------------------------------------------- retract

describe('retraction and patch status', () => {
  beforeEach(async () => {
    (harness.repo.rows[0] as AdvisoryRow).status = 'published';
    (harness.repo.rows[0] as AdvisoryRow).publishedAt = '2026-10-01T09:00:00.000Z';
  });

  it('retracts a published advisory and queues a follow-up notice', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: `/api/v1/admin/advisories/${ADVISORY_ID}/retract`,
      payload: { note: 'The vendor has confirmed this is not exploitable in the shipped build.' },
    });
    expect(response.statusCode).toBe(200);
    expect((response.json() as { data: { status: string } }).data.status).toBe('retracted');
    expect((harness.repo.rows[0] as AdvisoryRow).retractedAt).not.toBeNull();
    expect(harness.repo.broadcasts).toHaveLength(1);
    expect(harness.repo.broadcasts[0]?.kind).toBe('retraction');
    expect(harness.enqueued).toEqual([
      { broadcastId: harness.repo.broadcasts[0]?.id, advisoryId: ADVISORY_ID, kind: 'retraction' },
    ]);
    expect(harness.audits.map((audit) => audit.eventType)).toEqual(['ADVISORY_RETRACTED']);
    expect(harness.audits[0]?.sevLevel).toBe(2);
  });

  it('refuses to retract a draft, and requires a note', async () => {
    (harness.repo.rows[0] as AdvisoryRow).status = 'draft';
    const draft = await harness.app.inject({
      method: 'POST',
      url: `/api/v1/admin/advisories/${ADVISORY_ID}/retract`,
      payload: { note: 'A note long enough to be a reason.' },
    });
    expect(draft.statusCode).toBe(409);
    expect(draft.json()).toMatchObject({ error: 'not_retractable' });

    (harness.repo.rows[0] as AdvisoryRow).status = 'published';
    const short = await harness.app.inject({
      method: 'POST',
      url: `/api/v1/admin/advisories/${ADVISORY_ID}/retract`,
      payload: { note: 'too short' },
    });
    expect(short.statusCode).toBe(400);
  });

  it('changes the patch status and audits it', async () => {
    const response = await harness.app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/advisories/${ADVISORY_ID}/patch-status`,
      payload: { patchStatus: 'patch_in_progress' },
    });
    expect(response.statusCode).toBe(200);
    expect((harness.repo.rows[0] as AdvisoryRow).patchStatus).toBe('patch_in_progress');
    expect(harness.audits.map((audit) => audit.eventType)).toEqual([
      'ADVISORY_PATCH_STATUS_CHANGED',
    ]);
  });

  it('lists the broadcast history, newest first', async () => {
    await harness.app.inject({
      method: 'POST',
      url: `/api/v1/admin/advisories/${ADVISORY_ID}/retract`,
      payload: { note: 'Superseded by a corrected advisory.' },
    });
    const response = await harness.app.inject({
      method: 'GET',
      url: `/api/v1/admin/advisories/${ADVISORY_ID}/broadcasts`,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: Array<{ kind: string; status: string }> };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({ kind: 'retraction', status: 'queued' });
  });
});

// ----------------------------------------------------------------- estimate

describe('the audience estimate', () => {
  it('counts dashboards from the matched estate and contacts from preferences', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: `/api/v1/admin/advisories/${ADVISORY_ID}/estimate`,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: { dashboards: 1, emailContacts: 4, smsContacts: 2, incidentCommanders: 1 },
    });
  });

  it('reports zero dashboards when no client runs the software', async () => {
    harness.repo.estate = [
      { orgId: ORG_A, category: 'database', product: 'PostgreSQL', version: '16', host: null },
    ];
    const response = await harness.app.inject({
      method: 'POST',
      url: `/api/v1/admin/advisories/${ADVISORY_ID}/estimate`,
    });
    expect((response.json() as { data: { dashboards: number } }).data.dashboards).toBe(0);
  });
});

// --------------------------------------------------------------------- NVD

describe('GET /api/v1/admin/advisories/nvd', () => {
  function nvdHarness(handler: (url: string) => Response | Promise<Response>) {
    const calls: string[] = [];
    const cache = new Map<string, string>();
    const nvdCache: NvdCache = {
      async get(key) {
        return cache.get(key) ?? null;
      },
      async set(key, value) {
        cache.set(key, value);
        return 'OK';
      },
    };
    const client = new HttpNvdClient({
      apiKey: 'nvd-key',
      cache: nvdCache,
      fetchImpl: (async (url: unknown, init?: RequestInit) => {
        calls.push(String(url));
        expect((init?.headers as Record<string, string>).apiKey).toBe('nvd-key');
        return handler(String(url));
      }) as unknown as typeof fetch,
    });
    return { client, calls, cache };
  }

  const DOCUMENT = {
    vulnerabilities: [
      {
        cve: {
          id: CVE,
          published: '2026-09-30T18:15:09.123',
          descriptions: [
            { lang: 'es', value: 'Ignorado' },
            { lang: 'en', value: 'A deserialisation flaw in Apache Struts.' },
          ],
          references: [{ url: 'https://struts.apache.org/announce' }],
          metrics: { cvssMetricV31: [{ cvssData: { baseScore: 9.8 } }] },
          configurations: [
            {
              nodes: [{ cpeMatch: [{ criteria: 'cpe:2.3:a:apache:struts:2.5.30:*:*:*:*:*:*:*' }] }],
            },
          ],
        },
      },
    ],
  };

  it('maps the NVD document onto the editor’s fields', async () => {
    const { client } = nvdHarness(() => jsonResponse(200, DOCUMENT));
    const result = await client.getCve(CVE);
    expect(result).toEqual({
      cveId: CVE,
      vendor: 'apache',
      cvss: 9.8,
      severity: 'critical',
      disclosureDate: '2026-09-30',
      title: null,
      summary: 'A deserialisation flaw in Apache Struts.',
      references: ['https://struts.apache.org/announce'],
    });
  });

  it('caches for an hour and answers a second call from the cache', async () => {
    const { client, calls } = nvdHarness(() => jsonResponse(200, DOCUMENT));
    await client.getCve(CVE);
    await client.getCve(CVE);
    expect(calls).toHaveLength(1);
  });

  it('answers null for a CVE the NVD does not have, either way it says so', async () => {
    // NVD answers 200 with an empty list, and 404 for some paths; both mean "none".
    const empty = nvdHarness(() => jsonResponse(200, { vulnerabilities: [] }));
    expect(await empty.client.getCve('CVE-2026-99999')).toBeNull();

    const missing = nvdHarness(() => jsonResponse(404, {}));
    expect(await missing.client.getCve(CVE)).toBeNull();
  });

  it('answers 502 when the NVD is unreachable or slow', async () => {
    const down = nvdHarness(async () => {
      throw Object.assign(new Error('timeout'), { name: 'TimeoutError' });
    });
    await expect(down.client.getCve(CVE)).rejects.toMatchObject({
      status: 502,
      code: 'nvd_unavailable',
    });

    const serverError = nvdHarness(() => jsonResponse(503, {}));
    await expect(serverError.client.getCve(CVE)).rejects.toMatchObject({
      status: 502,
      code: 'nvd_unavailable',
    });
  });

  it('refuses a malformed CVE id before calling out', async () => {
    const { client, calls } = nvdHarness(() => jsonResponse(200, DOCUMENT));
    await expect(client.getCve('not-a-cve')).rejects.toMatchObject({ status: 400 });
    expect(calls).toHaveLength(0);
  });

  it('routes a 404 through the API envelope', async () => {
    const response = await harness.app.inject({
      method: 'GET',
      url: `/api/v1/admin/advisories/nvd?cveId=${CVE}`,
    });
    // The harness NVD client knows nothing, so nothing is found.
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: 'not_found' });
  });
});

// ------------------------------------------------------------ client routes

describe('the client advisory feed', () => {
  beforeEach(() => {
    harness.user.current = userFor('client', [...ROLE_PERMISSIONS.client] as Permission[]);
  });

  it('never shows a draft', async () => {
    const draft = await harness.app.inject({ method: 'GET', url: '/api/v1/advisories' });
    expect(draft.statusCode).toBe(200);
    expect((draft.json() as { total: number }).total).toBe(0);

    (harness.repo.rows[0] as AdvisoryRow).status = 'published';
    (harness.repo.rows[0] as AdvisoryRow).publishedAt = '2026-10-01T09:00:00.000Z';
    const published = await harness.app.inject({ method: 'GET', url: '/api/v1/advisories' });
    const body = published.json() as { data: Array<Record<string, unknown>>; total: number };
    expect(body.total).toBe(1);
    expect(body.data[0]).toMatchObject({
      cveId: CVE,
      source: 'VUNVAULT Intelligence',
      acknowledged: false,
    });
    // No author, no ids beyond the advisory's, no delivery internals.
    expect(published.body).not.toContain(ANALYST_ID);
    expect(published.body).not.toContain('authorId');
    expect(published.body).not.toContain('broadcast');
    expect(published.body).not.toContain('triggeredByLabel');
  });

  it('hides a retracted advisory again', async () => {
    (harness.repo.rows[0] as AdvisoryRow).status = 'retracted';
    (harness.repo.rows[0] as AdvisoryRow).retractedAt = '2026-10-02T09:00:00.000Z';
    const response = await harness.app.inject({ method: 'GET', url: '/api/v1/advisories' });
    expect((response.json() as { total: number }).total).toBe(0);
  });

  it('acknowledges idempotently and marks the item', async () => {
    (harness.repo.rows[0] as AdvisoryRow).status = 'published';
    (harness.repo.rows[0] as AdvisoryRow).publishedAt = '2026-10-01T09:00:00.000Z';

    const first = await harness.app.inject({
      method: 'POST',
      url: `/api/v1/advisories/${ADVISORY_ID}/acknowledge`,
    });
    expect(first.statusCode).toBe(204);
    const second = await harness.app.inject({
      method: 'POST',
      url: `/api/v1/advisories/${ADVISORY_ID}/acknowledge`,
    });
    expect(second.statusCode).toBe(204);
    expect(harness.repo.acknowledgements).toHaveLength(1);
    expect(harness.repo.acknowledgements[0]?.orgId).toBe(ORG_A);
    expect(harness.audits.map((audit) => audit.eventType)).toEqual([
      'ADVISORY_ACKNOWLEDGED',
      'ADVISORY_ACKNOWLEDGED',
    ]);

    const listed = await harness.app.inject({ method: 'GET', url: '/api/v1/advisories' });
    expect(
      (listed.json() as { data: Array<{ acknowledged: boolean }> }).data[0]?.acknowledged,
    ).toBe(true);
  });

  it('answers 404 for an acknowledgement of something that is not published', async () => {
    const response = await harness.app.inject({
      method: 'POST',
      url: `/api/v1/advisories/${ADVISORY_ID}/acknowledge`,
    });
    expect(response.statusCode).toBe(404);
    expect(harness.repo.acknowledgements).toHaveLength(0);
  });
});

// ----------------------------------------------------------------- summary

describe('GET /api/v1/admin/advisories/summary', () => {
  it('reports the desk’s numbers', async () => {
    const response = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/admin/advisories/summary',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: {
        activeZeroDays: 3,
        criticalSeverity: 9,
        unpatchedCritical: 9,
        weaponizedInWild: 37,
        advisoriesPublished: 41,
        broadcastThisMonth: 5,
        openDrafts: 2,
        escalatedDrafts: 1,
        dashboardsReached: 12,
        newClientsThisMonth: 3,
      },
    });
  });
});

// ------------------------------------------------------------------- reach

describe('reach', () => {
  it('counts only acknowledgements inside 24 hours of the first broadcast', async () => {
    harness.repo.broadcasts.push({
      id: 'b1000000-0000-4000-8000-0000000000b1',
      advisoryId: ADVISORY_ID,
      kind: 'initial',
      status: 'sent',
      triggeredByLabel: 'a.mwangi',
      ack: ACK,
      audienceDashboards: 3,
      emailContacts: 3,
      smsContacts: 1,
      sentDashboards: 3,
      sentEmail: 3,
      sentSms: 1,
      failed: 0,
      auditSeq: 7,
      createdAt: '2026-10-01T09:00:00.000Z',
      finishedAt: '2026-10-01T09:04:00.000Z',
    });
    harness.repo.acknowledgements.push(
      { advisoryId: ADVISORY_ID, orgId: ORG_A, acknowledgedAt: '2026-10-01T10:00:00.000Z' },
      {
        advisoryId: ADVISORY_ID,
        orgId: 'd1000000-0000-4000-8000-0000000000b1',
        acknowledgedAt: '2026-10-03T10:00:00.000Z',
      },
    );
    expect(harness.repo.reachFor(ADVISORY_ID)).toBe(1);
  });
});

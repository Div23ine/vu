import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Permission, UserRole } from '@vunvault/contracts';
import { ROLE_PERMISSIONS } from '@vunvault/contracts';
import { clientDirectory, contactMessages } from '@vunvault/contracts/fixtures/contact';
import { staffMembers } from '@vunvault/contracts/fixtures/users';
import type { Env } from '../../../config/env.js';
import errorHandler from '../../../plugins/error-handler.js';
import cookiesPlugin from '../../../plugins/cookies.js';
import type { AuthUser } from '../../../plugins/auth.js';
import { HttpError } from '../../../lib/http-error.js';
import type { AuditEntryRow } from '../../../audit/repo.js';
import contactAdminRoutes from './index.js';
import type {
  ClientListQueryParams,
  ClientRow,
  ContactAdminRepo,
  ContactListQueryParams,
  ContactMessageRow,
} from './repo.js';

/**
 * Admin contact inbox + client directory (Task 40f).
 *
 * The spec's assertions: a support engineer can list and triage but gets 403
 * on `/admin/clients`; assigning a CLIENT account answers
 * `422 invalid_assignee`; the `q` filter works; triage writes the
 * `CONTACT_TRIAGED` audit entry (details `{ status, assignedTo }`). The
 * conformance suite (route-table.test.ts) covers the guard/audit/schema/drift
 * checks for the new routes.
 *
 * The fake repo is seeded from the contract fixtures, so the fixtures are
 * exercised on every run.
 */

const SUPPORT_ID = 'c1000000-0000-4000-8000-0000000000f1';
const ADMIN_ID = 'c1000000-0000-4000-8000-0000000000ad';
const CLIENT_ACCOUNT_ID = 'c0000000-0000-4000-8000-000000000011'; // Jane (client fixture)

const amara = staffMembers.find((member) => member.fullName === 'Amara Njoroge');
const lucy = staffMembers.find((member) => member.fullName === 'Lucy Achieng');
if (amara === undefined || lucy === undefined) {
  throw new Error('The roster fixture must contain Amara Njoroge and Lucy Achieng.');
}
if (lucy.accountStatus !== 'dormant') {
  throw new Error('The dormant-assignee test relies on Lucy Achieng being dormant.');
}

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

class FakeContactAdminRepo implements ContactAdminRepo {
  messages: ContactMessageRow[] = contactMessages.map((view) => ({
    id: view.id,
    name: view.name,
    email: view.email,
    organization: view.organization,
    category: view.category,
    subject: view.subject,
    message: view.message,
    status: view.status,
    assignedToId: view.assignedTo?.id ?? null,
    assignedToLabel: view.assignedTo?.label ?? null,
    createdAt: view.createdAt,
  }));
  clients: ClientRow[] = clientDirectory.map((item) => ({ ...item }));
  staff = new Map<string, string>(
    staffMembers
      .filter((member) => member.accountStatus === 'active')
      .map((member) => [member.id, member.fullName]),
  );

  async listMessages(
    query: ContactListQueryParams,
  ): Promise<{ rows: ContactMessageRow[]; total: number }> {
    let rows = [...this.messages];
    if (query.q !== undefined && query.q !== '') {
      const needle = query.q.toLowerCase();
      rows = rows.filter((row) =>
        [row.name, row.email, row.organization, row.subject].some(
          (value) => value !== null && value.toLowerCase().includes(needle),
        ),
      );
    }
    if (query.status !== undefined) rows = rows.filter((row) => row.status === query.status);
    if (query.category !== undefined) {
      rows = rows.filter((row) => row.category === query.category);
    }
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
    const total = rows.length;
    const start = (query.page - 1) * query.pageSize;
    return { rows: rows.slice(start, start + query.pageSize), total };
  }

  async findMessage(id: string): Promise<ContactMessageRow | null> {
    return this.messages.find((row) => row.id === id) ?? null;
  }

  async updateMessage(
    id: string,
    patch: { status?: ContactMessageRow['status']; assignedTo?: string | null },
  ): Promise<ContactMessageRow | null> {
    const row = await this.findMessage(id);
    if (row === null) return null;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.assignedTo !== undefined) {
      row.assignedToId = patch.assignedTo;
      row.assignedToLabel =
        patch.assignedTo === null ? null : (this.staff.get(patch.assignedTo) ?? null);
    }
    return { ...row };
  }

  async findStaffAssignee(id: string): Promise<{ id: string; label: string } | null> {
    const label = this.staff.get(id);
    return label === undefined ? null : { id, label };
  }

  async listClients(query: ClientListQueryParams): Promise<{ rows: ClientRow[]; total: number }> {
    let rows = [...this.clients];
    if (query.q !== undefined && query.q !== '') {
      const needle = query.q.toLowerCase();
      rows = rows.filter((row) =>
        [row.fullName, row.email, row.company, row.clientCode].some(
          (value) => value !== null && value.toLowerCase().includes(needle),
        ),
      );
    }
    if (query.verifiedBlogger !== undefined) {
      rows = rows.filter((row) => row.verifiedBlogger === query.verifiedBlogger);
    }
    rows.sort((a, b) => a.fullName.localeCompare(b.fullName));
    const total = rows.length;
    const start = (query.page - 1) * query.pageSize;
    return { rows: rows.slice(start, start + query.pageSize), total };
  }
}

interface Harness {
  app: FastifyInstance;
  repo: FakeContactAdminRepo;
  audits: Array<{
    eventType: string;
    message: string;
    actorLabel: string;
    subject?: string;
    details: Record<string, unknown>;
  }>;
  user: { current: AuthUser | null };
}

function makeUser(id: string, email: string, role: UserRole): AuthUser {
  return {
    id,
    email,
    role,
    orgId: null,
    permissions: [...ROLE_PERMISSIONS[role]] as Permission[],
    aal: 'aal2',
    sessionId: '20000000-0000-4000-8000-000000000002',
  };
}

async function makeHarness(): Promise<Harness> {
  const repo = new FakeContactAdminRepo();
  const audits: Harness['audits'] = [];
  const user: Harness['user'] = { current: null };

  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('env', TEST_ENV);
  app.decorateRequest('clientIp', '41.90.32.10');
  app.decorateRequest('requestId', '');

  const fakeTx = { unsafe: async () => [] };
  app.decorate('withTx', (async (work: (tx: unknown) => Promise<unknown>) =>
    work(fakeTx)) as unknown as FastifyInstance['withTx']);
  app.decorate('audit', {
    append: async (_executor: unknown, input: Record<string, unknown>) => {
      const actor = input.actor as { label: string };
      audits.push({
        eventType: String(input.eventType),
        message: String(input.message),
        actorLabel: actor.label,
        subject: input.subject === undefined ? undefined : String(input.subject),
        details: (input.details as Record<string, unknown>) ?? {},
      });
      return {
        seq: audits.length,
        id: 'entry-id',
        category: 'administrative',
        eventType: input.eventType,
        severity: 'info',
        sevLevel: null,
        actorId: null,
        actorLabel: actor.label,
        ip: null,
        subject: input.subject ?? null,
        message: String(input.message),
        details: {},
        sealedDetails: null,
        nonce: null,
        prevHash: '0'.repeat(64),
        hash: 'a'.repeat(64),
        signature: 'b'.repeat(64),
        keyId: 'v1',
        createdAt: new Date('2026-10-08T12:00:00Z'),
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

  await app.register(cookiesPlugin);
  await app.register(errorHandler);
  await app.register(
    async (scope) => {
      await scope.register(contactAdminRoutes, { repo });
    },
    { prefix: '/api/v1' },
  );

  return { app, repo, audits, user };
}

let harness: Harness;

beforeEach(async () => {
  harness = await makeHarness();
});

const [firstMessage] = contactMessages;
if (firstMessage === undefined) throw new Error('The contact fixtures are empty.');

describe('GET /admin/contact', () => {
  it('rejects anonymous callers', async () => {
    const response = await harness.app.inject({ method: 'GET', url: '/api/v1/admin/contact' });
    expect(response.statusCode).toBe(401);
  });

  it('lists the fixture inbox newest first, in full, for a support engineer', async () => {
    harness.user.current = makeUser(SUPPORT_ID, 'l.achieng@vunvault.com', 'support_engineer');
    const response = await harness.app.inject({ method: 'GET', url: '/api/v1/admin/contact' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: typeof contactMessages; total: number };
    expect(body.total).toBe(6);
    expect(body.data.map((row) => row.id)).toEqual([
      'c3000000-0000-4000-8000-0000000000c1',
      'c3000000-0000-4000-8000-0000000000c2',
      'c3000000-0000-4000-8000-0000000000c3',
      'c3000000-0000-4000-8000-0000000000c4',
      'c3000000-0000-4000-8000-0000000000c5',
      'c3000000-0000-4000-8000-0000000000c6',
    ]);
    expect(body.data[0]).toMatchObject({
      name: 'Wanjiru Kamau',
      category: 'journalist_blogger_profile_request',
      categoryLabel: 'Journalist / Blogger Profile Request',
      status: 'new',
      assignedTo: null,
    });
    // The full body is returned to support:handle holders.
    expect(body.data[0]?.message).toBe(firstMessage.message);
  });

  it('applies the q, status and category filters', async () => {
    harness.user.current = makeUser(SUPPORT_ID, 'l.achieng@vunvault.com', 'support_engineer');

    const byQ = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/admin/contact?q=sacco',
    });
    const qBody = byQ.json() as { data: Array<{ id: string }>; total: number };
    expect(qBody.total).toBe(1);
    expect(qBody.data[0]?.id).toBe('c3000000-0000-4000-8000-0000000000c2');

    const byStatus = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/admin/contact?status=new',
    });
    expect((byStatus.json() as { total: number }).total).toBe(3);

    const byCategory = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/admin/contact?category=penetration_testing_request',
    });
    expect((byCategory.json() as { total: number }).total).toBe(2);
  });
});

describe('PATCH /admin/contact/:id', () => {
  it('triages the status and writes the CONTACT_TRIAGED audit entry', async () => {
    harness.user.current = makeUser(SUPPORT_ID, 'l.achieng@vunvault.com', 'support_engineer');
    const response = await harness.app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/contact/${firstMessage.id}`,
      payload: { status: 'triaged' },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: { id: string; status: string } };
    expect(body.data).toMatchObject({ id: firstMessage.id, status: 'triaged' });

    expect(harness.audits).toHaveLength(1);
    expect(harness.audits[0]).toMatchObject({
      eventType: 'CONTACT_TRIAGED',
      subject: firstMessage.id,
      details: { status: 'triaged', assignedTo: null },
    });
  });

  it('assigns an active staff member and can unassign', async () => {
    harness.user.current = makeUser(ADMIN_ID, 'a.mwangi@vunvault.com', 'super_admin');
    const assign = await harness.app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/contact/${firstMessage.id}`,
      payload: { assignedTo: amara.id },
    });
    expect(assign.statusCode).toBe(200);
    expect((assign.json() as { data: { assignedTo: unknown } }).data).toMatchObject({
      assignedTo: { id: amara.id, label: 'Amara Njoroge' },
    });
    expect(harness.audits.at(-1)?.details).toMatchObject({
      status: null,
      assignedTo: amara.id,
    });

    const unassign = await harness.app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/contact/${firstMessage.id}`,
      payload: { assignedTo: null },
    });
    expect(unassign.statusCode).toBe(200);
    expect((unassign.json() as { data: { assignedTo: null } }).data.assignedTo).toBeNull();
  });

  it('rejects a client account as handler with 422 invalid_assignee', async () => {
    harness.user.current = makeUser(ADMIN_ID, 'a.mwangi@vunvault.com', 'super_admin');
    const response = await harness.app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/contact/${firstMessage.id}`,
      payload: { assignedTo: CLIENT_ACCOUNT_ID },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: 'invalid_assignee' });
    expect(harness.audits).toHaveLength(0);
  });

  it('rejects a dormant staff account as handler (must be ACTIVE staff)', async () => {
    harness.user.current = makeUser(ADMIN_ID, 'a.mwangi@vunvault.com', 'super_admin');
    const response = await harness.app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/contact/${firstMessage.id}`,
      payload: { assignedTo: lucy.id },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: 'invalid_assignee' });
    expect(harness.audits).toHaveLength(0);
  });

  it('answers 404 for an unknown message and 400 for an empty body', async () => {
    harness.user.current = makeUser(SUPPORT_ID, 'l.achieng@vunvault.com', 'support_engineer');
    const missing = await harness.app.inject({
      method: 'PATCH',
      url: '/api/v1/admin/contact/c3000000-0000-4000-8000-0000000000ff',
      payload: { status: 'closed' },
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ error: 'not_found' });

    const empty = await harness.app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/contact/${firstMessage.id}`,
      payload: {},
    });
    expect(empty.statusCode).toBe(400);
    expect(empty.json()).toMatchObject({ error: 'validation_failed' });
  });
});

describe('GET /admin/clients', () => {
  it('is forbidden for a support engineer (no users:read)', async () => {
    harness.user.current = makeUser(SUPPORT_ID, 'l.achieng@vunvault.com', 'support_engineer');
    const response = await harness.app.inject({ method: 'GET', url: '/api/v1/admin/clients' });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'forbidden' });
  });

  it('returns the client directory for users:read holders, with filters', async () => {
    harness.user.current = makeUser(ADMIN_ID, 'a.mwangi@vunvault.com', 'super_admin');
    const all = await harness.app.inject({ method: 'GET', url: '/api/v1/admin/clients' });
    expect(all.statusCode).toBe(200);
    const allBody = all.json() as { data: typeof clientDirectory; total: number };
    expect(allBody.total).toBe(4);
    expect(allBody.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fullName: 'Jane Wanjiru',
          company: 'Acme Fintech Ltd',
          clientCode: 'VV-CL-48210',
          verifiedBlogger: false,
        }),
      ]),
    );

    const bloggers = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/admin/clients?verifiedBlogger=true',
    });
    const bloggerBody = bloggers.json() as { data: Array<{ fullName: string }>; total: number };
    expect(bloggerBody.total).toBe(1);
    expect(bloggerBody.data[0]?.fullName).toBe('Peter Otieno');

    const byQ = await harness.app.inject({
      method: 'GET',
      url: '/api/v1/admin/clients?q=VV-CL-60122',
    });
    const qBody = byQ.json() as { data: Array<{ fullName: string }>; total: number };
    expect(qBody.total).toBe(1);
    expect(qBody.data[0]?.fullName).toBe('Aisha Juma');
  });
});

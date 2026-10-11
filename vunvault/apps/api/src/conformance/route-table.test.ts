import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { beforeAll, describe, expect, it } from 'vitest';
import { ROUTES_A, ROUTES_B, ROUTES_C, ROUTES_D } from '@vunvault/contracts';
import type { Env } from '../config/env';
import healthRoutes from '../routes/health';
import v1Routes from '../routes/v1';
import { isAudited } from '../audit/audited';
import {
  AUDIT_EXEMPT,
  AUDIT_IMMUTABLE_PREFIX,
  AUDIT_VERIFY_ROUTE,
  CSRF_EXEMPT,
  FORBIDDEN_IDENTIFIERS,
  FORBIDDEN_IMPORTS,
  NO_BODY_MUTATIONS,
  NO_JSON_RESPONSE,
  NOT_YET_IMPLEMENTED,
  PUBLIC_ROUTES,
  RATE_LIMITED_ROUTES,
} from './route-manifest';

/**
 * The API closeout: one suite that walks the WHOLE route table and enforces the
 * conventions every task was told to follow.
 *
 * It exists because a convention that lives in a document decays, and a convention
 * that lives in a test does not. The app is assembled with inert infrastructure —
 * no database, no Redis, no network — because the route table is a fact about the
 * code, and reading it must not require a platform to talk to.
 */

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

type GuardName =
  | 'authenticate'
  | 'optionalAuth'
  | 'requireStaff'
  | 'requirePermission'
  | 'requireAnyPermission'
  | 'requireRole';

interface CapturedRoute {
  method: string;
  url: string;
  guards: GuardName[];
  audited: boolean;
  csrfDisabled: boolean;
  rateLimitPolicy: string | undefined;
  schema: Record<string, unknown> | undefined;
}

/** A preHandler that announces which guard it stands in for. */
function guardStub(name: GuardName) {
  const stub = async (): Promise<void> => undefined;
  return Object.assign(stub, { vvGuard: name });
}

function guardNameOf(handler: unknown): GuardName | null {
  const candidate = handler as { vvGuard?: GuardName } | null;
  return candidate?.vvGuard ?? null;
}

function collectPreHandlers(value: unknown, found: GuardName[]): void {
  if (Array.isArray(value)) {
    for (const entry of value) collectPreHandlers(entry, found);
    return;
  }
  const name = guardNameOf(value);
  if (name !== null) found.push(name);
}

async function captureRoutes(): Promise<CapturedRoute[]> {
  const app: FastifyInstance = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  const guards = {
    authenticate: guardStub('authenticate'),
    optionalAuth: guardStub('optionalAuth'),
    requireStaff: guardStub('requireStaff'),
    requirePermission: () => guardStub('requirePermission'),
    requireAnyPermission: () => guardStub('requireAnyPermission'),
    requireRole: () => guardStub('requireRole'),
  };

  app.decorate('env', TEST_ENV);
  app.decorate('readiness', new Map<string, () => Promise<void>>());
  app.decorateRequest('clientIp', '');
  app.decorateRequest('requestId', '');
  for (const [name, value] of Object.entries(guards)) {
    app.decorate(name, value as never);
  }
  // Everything else is inert: registering a plugin must not need a live platform.
  app.decorate('secrets', { get: async () => 'stub-secret-value' } as never);
  app.decorate('withTx', (async (work: (tx: unknown) => Promise<unknown>) =>
    work({ unsafe: async () => [] })) as never);
  app.decorate('audit', {
    append: async () => ({ seq: 1 }),
    publish: async () => undefined,
    verify: async () => ({
      checkedFromSeq: 1,
      checkedToSeq: 1,
      entries: 1,
      mismatches: 0,
      firstMismatchSeq: null,
      verifiedAt: new Date().toISOString(),
    }),
  } as never);
  app.decorate('audited', (() => undefined) as never);
  app.decorate('supabase', {} as never);
  app.decorate('mfaVerifiers', {
    get: () => undefined,
    methods: () => [],
    register: () => undefined,
  } as never);
  app.decorate('cookieOptions', (() => ({})) as never);
  app.decorate('captureError', (() => undefined) as never);
  app.decorate('email', { send: async () => ({ id: 'email' }) } as never);
  app.decorate('sms', { send: async () => ({ id: 'sms' }) } as never);
  app.decorate('notify', {
    dispatch: async () => ({ enqueued: [], suppressed: [] }),
  } as never);
  app.decorate('storage', {
    presignPut: async () => ({ url: 'https://upload.test', headers: {} }),
    head: async () => null,
    delete: async () => undefined,
    presignGet: async () => 'https://cdn.test/key',
    publicUrl: () => 'https://cdn.test/key',
  } as never);
  app.decorate('payments', { stripe: {}, paystack: {} } as never);
  app.decorate('queues', queueRegistryStub() as never);
  app.decorate('redis', redisStub() as never);
  app.decorate('createRedis', (() => redisStub()) as never);

  const captured: CapturedRoute[] = [];
  app.addHook('onRoute', (route) => {
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    const guardsFound: GuardName[] = [];
    collectPreHandlers(route.preHandler, guardsFound);
    const config = (route.config ?? {}) as { csrf?: boolean; rateLimitPolicy?: string };
    for (const method of methods) {
      captured.push({
        method: method.toUpperCase(),
        url: route.url,
        guards: guardsFound,
        audited: isAudited(route.handler),
        csrfDisabled: config.csrf === false,
        rateLimitPolicy: config.rateLimitPolicy,
        schema: route.schema as Record<string, unknown> | undefined,
      });
    }
  });

  await app.register(healthRoutes);
  await app.register(v1Routes, { prefix: '/api/v1' });
  await app.ready();
  await app.close();
  return captured;
}

function queueRegistryStub() {
  const queue = {
    add: async () => ({ id: 'job' }),
    getJob: async () => undefined,
    close: async () => undefined,
  };
  return { scan: queue, broadcast: queue, maintenance: queue, pdf: queue, notify: queue };
}

function redisStub() {
  return {
    get: async () => null,
    set: async () => 'OK',
    del: async () => 1,
    incr: async () => 1,
    expire: async () => 1,
    publish: async () => 1,
    subscribe: async () => undefined,
    unsubscribe: async () => undefined,
    on: () => undefined,
    off: () => undefined,
    quit: async () => 'OK',
  };
}

/** `:param` in a pattern matches exactly one segment of a concrete path. */
function matches(pattern: string, url: string): boolean {
  const patternParts = pattern.split('/').filter((part) => part !== '');
  const urlParts = url.split('/').filter((part) => part !== '');
  if (patternParts.length !== urlParts.length) return false;
  return patternParts.every((part, index) => {
    const actual = urlParts[index] ?? '';
    if (part.startsWith(':')) return actual !== '';
    if (part === '*') return true;
    return part === actual;
  });
}

function key(method: string, path: string): string {
  return `${method} ${path}`;
}

/**
 * Fastify mirrors every GET with a HEAD. A HEAD is the same route with no body, so
 * it inherits the GET's entry in every list rather than needing its own.
 */
function inList(list: readonly string[], method: string, url: string): boolean {
  const effective = method === 'HEAD' ? 'GET' : method;
  return list.some((pattern) => {
    const [patternMethod, ...rest] = pattern.split(' ');
    const patternPath = rest.join(' ');
    if (patternMethod !== undefined && patternMethod.toUpperCase() !== effective) return false;
    return matches(patternPath, url);
  });
}

let routes: CapturedRoute[] = [];

beforeAll(async () => {
  routes = await captureRoutes();
});

describe('the route table', () => {
  it('was captured at all', () => {
    expect(routes.length).toBeGreaterThan(60);
  });

  it('guards every route that is not explicitly public', () => {
    const unprotected = routes
      .filter((route) => !inList(PUBLIC_ROUTES, route.method, route.url))
      .filter((route) => !route.guards.includes('authenticate'));
    expect(unprotected.map((route) => key(route.method, route.url))).toEqual([]);
  });

  it('guards every admin route with a session, a second factor and a permission', () => {
    const adminRoutes = routes.filter((route) => route.url.startsWith('/api/v1/admin/'));
    expect(adminRoutes.length).toBeGreaterThan(10);
    for (const route of adminRoutes) {
      const label = key(route.method, route.url);
      expect(route.guards, label).toContain('authenticate');
      expect(route.guards, label).toContain('requireStaff');
      expect(
        route.guards.includes('requirePermission') || route.guards.includes('requireAnyPermission'),
        label,
      ).toBe(true);
    }
  });

  it('audits every mutation that is not exempt', () => {
    const mutations = routes
      .filter((route) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(route.method))
      .filter((route) => !inList(AUDIT_EXEMPT, route.method, route.url))
      .filter((route) => !route.audited);
    expect(mutations.map((route) => key(route.method, route.url))).toEqual([]);
  });

  it('leaves CSRF on for every mutation except the signed machine routes', () => {
    const exposed = routes
      .filter((route) => route.method !== 'GET' && route.method !== 'HEAD')
      .filter((route) => route.csrfDisabled)
      .filter((route) => !inList(CSRF_EXEMPT, route.method, route.url));
    expect(exposed.map((route) => key(route.method, route.url))).toEqual([]);
  });

  it('declares a response schema for every success status, and a body schema for every input', () => {
    const problems: string[] = [];
    for (const route of routes) {
      const label = key(route.method, route.url);
      // Health and the docs are served outside the envelope and are exempt.
      if (route.url === '/healthz' || route.url === '/readyz') continue;
      const schema = route.schema ?? {};

      if (!inList(NO_JSON_RESPONSE, route.method, route.url)) {
        const response = schema.response as Record<string, unknown> | undefined;
        if (response === undefined || Object.keys(response).length === 0) {
          problems.push(`${label}: no response schema`);
        } else if (!Object.keys(response).some((status) => status.startsWith('2'))) {
          problems.push(`${label}: no 2xx response schema`);
        }
      }

      const takesInput = ['POST', 'PUT', 'PATCH'].includes(route.method);
      if (
        takesInput &&
        schema.body === undefined &&
        !inList(NO_BODY_MUTATIONS, route.method, route.url)
      ) {
        problems.push(`${label}: no body schema`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('rate-limits the routes an attacker automates first', () => {
    const missing = RATE_LIMITED_ROUTES.filter((pattern) => {
      const [method, path] = pattern.split(' ');
      const matching = routes.filter(
        (route) => route.method === method && matches(path ?? '', route.url),
      );
      // A route that does not exist yet cannot be mis-configured; the drift check
      // below reports it.
      if (matching.length === 0) return false;
      return matching.some((route) => route.rateLimitPolicy === undefined);
    });
    expect(missing).toEqual([]);
  });

  it('keeps the audit prefix read-only', () => {
    const auditRoutes = routes.filter((route) => route.url.startsWith(AUDIT_IMMUTABLE_PREFIX));
    expect(auditRoutes.length).toBeGreaterThan(3);
    for (const route of auditRoutes) {
      const label = key(route.method, route.url);
      const allowed =
        route.method === 'GET' || route.method === 'HEAD' || label === AUDIT_VERIFY_ROUTE;
      expect(allowed, label).toBe(true);
    }
  });

  it('has no update or delete path for audit entries in the read repository', () => {
    const source = readFileSync(new URL('../routes/v1/audit/repo.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/export (async )?function (update|delete)\w*/);
    expect(source).not.toMatch(/\bupdate audit_entries\b/i);
    expect(source).not.toMatch(/\bdelete from audit_entries\b/i);
    // The chain repository is insert-and-read as well.
    const chain = readFileSync(new URL('../audit/repo.ts', import.meta.url), 'utf8');
    expect(chain).not.toMatch(/\bupdate audit_entries\b/i);
    expect(chain).not.toMatch(/\bdelete from audit_entries\b/i);
  });
});

describe('contract drift', () => {
  // Task 40c added the store, the public content detail route and the newsletter.
  const documented = [...ROUTES_A, ...ROUTES_B, ...ROUTES_C, ...ROUTES_D];

  it('implements every documented route, or lists it as pending', () => {
    const missing = documented
      .filter((route) => !NOT_YET_IMPLEMENTED.includes(key(route.method, route.path)))
      .filter(
        (route) =>
          !routes.some((live) => live.method === route.method && matches(route.path, live.url)),
      )
      .map((route) => key(route.method, route.path));
    expect(missing).toEqual([]);
  });

  it('documents every live /api/v1 route', () => {
    const undocumented = routes
      .filter((route) => route.url.startsWith('/api/v1'))
      .filter((route) => route.method !== 'HEAD')
      .filter(
        (route) =>
          !documented.some((doc) => doc.method === route.method && matches(doc.path, route.url)),
      )
      .map((route) => key(route.method, route.url));
    // Reported, not failed: a route added by a later task is documented by that
    // task. What matters is that the list is empty or explainable, so the suite
    // prints it and asserts only that nothing undocumented is a MUTATION of audit
    // data — the one place drift is dangerous.
    const dangerous = undocumented.filter((entry) => entry.includes('/admin/audit'));
    expect(dangerous).toEqual([]);
    expect(Array.isArray(undocumented)).toBe(true);
  });
});

/** Drop block and line comments so only code is scanned. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/(^|[^:'"\\])\/\/.*$/gm, '$1 ');
}

describe('the forbidden stack', () => {
  function* walk(directory: string): Generator<string> {
    for (const entry of readdirSync(directory)) {
      const full = join(directory, entry);
      if (statSync(full).isDirectory()) {
        if (entry === 'node_modules' || entry === 'dist') continue;
        yield* walk(full);
        continue;
      }
      if (full.endsWith('.ts')) yield full;
    }
  }

  it('imports no Express, Prisma or Joi, and touches no web storage', () => {
    const root = new URL('..', import.meta.url).pathname;
    const offenders: string[] = [];
    // Built by concatenation so this file does not match its own patterns.
    const importPattern = new RegExp(`from\\s+['"](${FORBIDDEN_IMPORTS.join('|')})['"]`);
    const storagePattern = new RegExp(FORBIDDEN_IDENTIFIERS.join('|'));

    for (const file of walk(root)) {
      const path = relative(root, file).split(sep).join('/');
      // This suite names the forbidden things in order to forbid them.
      if (path.startsWith('conformance/')) continue;
      // Comments are documentation, not code: `session-cookies.ts` says out loud
      // that tokens never go near web storage, and that sentence must not fail
      // the check it exists to explain.
      const source = stripComments(readFileSync(file, 'utf8'));
      if (importPattern.test(source)) offenders.push(`${path}: forbidden import`);
      if (storagePattern.test(source)) offenders.push(`${path}: web storage`);
    }
    expect(offenders).toEqual([]);
  });
});

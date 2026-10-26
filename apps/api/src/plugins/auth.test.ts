import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { PERMISSIONS, ROLE_PERMISSIONS, type Permission, type UserRole } from '@vunvault/contracts';
import { buildApp, type App } from '../app.js';
import type { Env } from '../config/env.js';
import { HttpError } from '../lib/http-error.js';
import { tokenIssuer } from '../lib/jwt.js';
import {
  SESSION_CACHE_TTL_SECONDS,
  SessionRegistry,
  type SessionRecord,
} from '../lib/session-registry.js';
import { isStaff, STAFF_ROLES } from '../lib/staff.js';
import { COOKIE_NAMES } from './cookies.js';

const SECRET = 'test-jwt-secret-that-is-long-enough-to-be-safe';
const USER_ID = 'c0000000-0000-4000-8000-000000000001';
const ORG_ID = 'a0000000-0000-4000-8000-000000000001';
const SESSION_ID = '20000000-0000-4000-8000-000000000001';

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

const ISSUER = tokenIssuer(TEST_ENV.SUPABASE_URL);

interface Claims {
  sub: string;
  email: string;
  role: UserRole;
  org_id: string | null;
  permissions: Permission[];
  session_id: string;
  aal: 'aal1' | 'aal2';
}

function claimsFor(role: UserRole, overrides: Partial<Claims> = {}): Claims {
  return {
    sub: USER_ID,
    email: 'e.reed@vunvault.com',
    role,
    org_id: role === 'client' ? ORG_ID : null,
    permissions: [...ROLE_PERMISSIONS[role]],
    session_id: SESSION_ID,
    aal: 'aal2',
    ...overrides,
  };
}

async function signToken(
  claims: Claims,
  options: { expiresIn?: string; audience?: string; issuer?: string; notBefore?: string } = {},
): Promise<string> {
  const builder = new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setIssuer(options.issuer ?? ISSUER)
    .setAudience(options.audience ?? 'authenticated')
    .setExpirationTime(options.expiresIn ?? '1h');
  if (options.notBefore !== undefined) builder.setNotBefore(options.notBefore);
  return builder.sign(new TextEncoder().encode(SECRET));
}

function recordFor(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    sessionId: SESSION_ID,
    userId: USER_ID,
    revokedAt: null,
    mfaMethod: null,
    accountStatus: 'active',
    deletedAt: null,
    ...overrides,
  };
}

/** An app with the auth guards on, an injected secret and a scriptable registry. */
async function makeApp(record: SessionRecord | null = recordFor()): Promise<App> {
  const lookups: string[] = [];
  const registry = new SessionRegistry({
    lookup: async (sessionId) => {
      lookups.push(sessionId);
      return record;
    },
  });

  const app = await buildApp({
    env: TEST_ENV,
    overrides: { logger: false },
    infra: false,
    auth: true,
    authOptions: { secret: SECRET, registry },
  });

  app.get('/__test/me', { preHandler: app.authenticate }, async (request) => ({
    data: request.user,
  }));
  app.get('/__test/optional', { preHandler: app.optionalAuth }, async (request) => ({
    data: { user: request.user ?? null },
  }));
  app.get('/__test/staff', { preHandler: [app.authenticate, app.requireStaff] }, async () => ({
    data: { ok: true },
  }));
  app.get(
    '/__test/users-manage',
    { preHandler: [app.authenticate, app.requirePermission('users:manage')] },
    async () => ({ data: { ok: true } }),
  );
  app.get(
    '/__test/either',
    { preHandler: [app.authenticate, app.requireAnyPermission('audit:read', 'scans:release')] },
    async () => ({ data: { ok: true } }),
  );
  app.get(
    '/__test/admin-only',
    { preHandler: [app.authenticate, app.requireRole('admin', 'super_admin')] },
    async () => ({ data: { ok: true } }),
  );

  Object.defineProperty(app, 'lookups', { value: lookups });
  return app;
}

function cookieFor(token: string): string {
  return `${COOKIE_NAMES.accessToken}=${token}`;
}

describe('authentication', () => {
  it('rejects a request with no cookie', async () => {
    const app = await makeApp();
    const response = await app.inject({ method: 'GET', url: '/__test/me' });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: 'unauthorized' });
    await app.close();
  });

  it('ignores a valid bearer token in the Authorization header', async () => {
    const app = await makeApp();
    const token = await signToken(claimsFor('super_admin'));
    const response = await app.inject({
      method: 'GET',
      url: '/__test/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('ignores a token smuggled in the query string', async () => {
    const app = await makeApp();
    const token = await signToken(claimsFor('super_admin'));
    const response = await app.inject({
      method: 'GET',
      url: `/__test/me?access_token=${token}`,
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('accepts a valid cookie and exposes the principal', async () => {
    const app = await makeApp();
    const token = await signToken(claimsFor('super_admin'));
    const response = await app.inject({
      method: 'GET',
      url: '/__test/me',
      headers: { cookie: cookieFor(token) },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: { id: string; role: string; aal: string } };
    expect(body.data).toMatchObject({ id: USER_ID, role: 'super_admin', aal: 'aal2' });
    expect(body.data.id).toBe(USER_ID);
    // A token is never echoed back to the client.
    expect(response.body).not.toContain(token);
    await app.close();
  });

  it('rejects an expired token', async () => {
    const app = await makeApp();
    const token = await signToken(claimsFor('super_admin'), { expiresIn: '-1h' });
    const response = await app.inject({
      method: 'GET',
      url: '/__test/me',
      headers: { cookie: cookieFor(token) },
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('rejects a token minted for the wrong audience', async () => {
    const app = await makeApp();
    const token = await signToken(claimsFor('super_admin'), { audience: 'anon' });
    const response = await app.inject({
      method: 'GET',
      url: '/__test/me',
      headers: { cookie: cookieFor(token) },
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('rejects a token from another issuer or signed with another secret', async () => {
    const app = await makeApp();
    const wrongIssuer = await signToken(claimsFor('super_admin'), {
      issuer: 'https://evil.supabase.co/auth/v1',
    });
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/__test/me',
          headers: { cookie: cookieFor(wrongIssuer) },
        })
      ).statusCode,
    ).toBe(401);

    const forged = await new SignJWT({ ...claimsFor('super_admin') })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER_ID)
      .setIssuedAt()
      .setIssuer(ISSUER)
      .setAudience('authenticated')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('a-completely-different-secret'));
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/__test/me',
          headers: { cookie: cookieFor(forged) },
        })
      ).statusCode,
    ).toBe(401);
    await app.close();
  });

  it('rejects a revoked session, a suspended account and a soft-deleted profile', async () => {
    for (const record of [
      recordFor({ revokedAt: '2026-09-24T10:00:00Z' }),
      recordFor({ accountStatus: 'suspended' }),
      recordFor({ accountStatus: 'dormant' }),
      recordFor({ deletedAt: '2026-09-24T10:00:00Z' }),
      null,
      recordFor({ userId: ORG_ID }),
    ]) {
      const app = await makeApp(record);
      const token = await signToken(claimsFor('super_admin'));
      const response = await app.inject({
        method: 'GET',
        url: '/__test/me',
        headers: { cookie: cookieFor(token) },
      });
      expect(response.statusCode, JSON.stringify(record)).toBe(401);
      await app.close();
    }
  });

  it('treats an in-house MFA verification on the session as AAL2', async () => {
    const app = await makeApp(recordFor({ mfaMethod: 'webauthn' }));
    const token = await signToken(claimsFor('super_admin', { aal: 'aal1' }));
    const response = await app.inject({
      method: 'GET',
      url: '/__test/me',
      headers: { cookie: cookieFor(token) },
    });
    expect(response.statusCode).toBe(200);
    expect((response.json() as { data: { aal: string } }).data.aal).toBe('aal2');
    await app.close();
  });
});

describe('optionalAuth', () => {
  it('never rejects, with or without a usable cookie', async () => {
    const app = await makeApp();
    const anonymous = await app.inject({ method: 'GET', url: '/__test/optional' });
    expect(anonymous.statusCode).toBe(200);
    expect(anonymous.json()).toEqual({ data: { user: null } });

    const token = await signToken(claimsFor('client'));
    const identified = await app.inject({
      method: 'GET',
      url: '/__test/optional',
      headers: { cookie: cookieFor(token) },
    });
    expect(identified.statusCode).toBe(200);
    expect((identified.json() as { data: { user: { role: string } } }).data.user.role).toBe(
      'client',
    );

    const stale = await app.inject({
      method: 'GET',
      url: '/__test/optional',
      headers: { cookie: cookieFor('not-a-jwt') },
    });
    expect(stale.statusCode).toBe(200);
    expect(stale.json()).toEqual({ data: { user: null } });
    await app.close();
  });
});

describe('authorisation guards', () => {
  it('requires every permission listed and 403s without one', async () => {
    const app = await makeApp();

    const admin = await signToken(claimsFor('admin'));
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/__test/users-manage',
          headers: { cookie: cookieFor(admin) },
        })
      ).statusCode,
    ).toBe(403);

    const superAdmin = await signToken(claimsFor('super_admin'));
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/__test/users-manage',
          headers: { cookie: cookieFor(superAdmin) },
        })
      ).statusCode,
    ).toBe(200);
    await app.close();
  });

  it('reports a client without the permission as forbidden', async () => {
    const app = await makeApp();
    const client = await signToken(claimsFor('client'));
    const response = await app.inject({
      method: 'GET',
      url: '/__test/users-manage',
      headers: { cookie: cookieFor(client) },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'forbidden' });
    await app.close();
  });

  it('accepts any one of the listed permissions', async () => {
    const app = await makeApp();
    const auditor = await signToken(claimsFor('compliance_auditor'));
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/__test/either',
          headers: { cookie: cookieFor(auditor) },
        })
      ).statusCode,
    ).toBe(200);

    const support = await signToken(claimsFor('support_engineer'));
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/__test/either',
          headers: { cookie: cookieFor(support) },
        })
      ).statusCode,
    ).toBe(403);
    await app.close();
  });

  it('enforces the role list', async () => {
    const app = await makeApp();
    for (const [role, expected] of [
      ['admin', 200],
      ['super_admin', 200],
      ['security_analyst', 403],
      ['client', 403],
    ] as Array<[UserRole, number]>) {
      const token = await signToken(claimsFor(role));
      const response = await app.inject({
        method: 'GET',
        url: '/__test/admin-only',
        headers: { cookie: cookieFor(token) },
      });
      expect(response.statusCode, role).toBe(expected);
    }
    await app.close();
  });

  it('refuses staff on AAL1 with mfa_required, and clients outright', async () => {
    const app = await makeApp();

    const staffNoMfa = await signToken(claimsFor('security_analyst', { aal: 'aal1' }));
    const response = await app.inject({
      method: 'GET',
      url: '/__test/staff',
      headers: { cookie: cookieFor(staffNoMfa) },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'mfa_required' });

    const staffWithMfa = await signToken(claimsFor('security_analyst', { aal: 'aal2' }));
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/__test/staff',
          headers: { cookie: cookieFor(staffWithMfa) },
        })
      ).statusCode,
    ).toBe(200);

    const client = await signToken(claimsFor('client', { aal: 'aal2' }));
    const clientResponse = await app.inject({
      method: 'GET',
      url: '/__test/staff',
      headers: { cookie: cookieFor(client) },
    });
    expect(clientResponse.statusCode).toBe(403);
    expect(clientResponse.json()).toMatchObject({ error: 'forbidden' });
    await app.close();
  });

  it('classifies staff roles', () => {
    expect(STAFF_ROLES).toEqual([
      'super_admin',
      'admin',
      'security_analyst',
      'soc_operator',
      'compliance_auditor',
      'support_engineer',
    ]);
    for (const role of STAFF_ROLES) expect(isStaff(role)).toBe(true);
    expect(isStaff('client')).toBe(false);
    expect(isStaff('owner')).toBe(false);
  });
});

describe('session registry', () => {
  it('caches for 30 seconds and consults the database on a miss', async () => {
    const reads: string[] = [];
    const cache = new Map<string, { value: string; expiresAt: number }>();
    let clock = 0;
    const registry = new SessionRegistry({
      lookup: async (sessionId) => {
        reads.push(sessionId);
        return recordFor({ sessionId });
      },
      cache: {
        async get(key) {
          const entry = cache.get(key);
          if (entry === undefined) return null;
          if (entry.expiresAt <= clock) {
            cache.delete(key);
            return null;
          }
          return entry.value;
        },
        async set(key, value, _mode, seconds) {
          cache.set(key, { value, expiresAt: clock + seconds * 1000 });
          return 'OK';
        },
        async del(key) {
          cache.delete(key);
          return 1;
        },
      },
      ttlSeconds: SESSION_CACHE_TTL_SECONDS,
      now: () => clock,
    });

    expect(SessionRegistry.key(SESSION_ID)).toBe(`sess:${SESSION_ID}`);
    await registry.get(SESSION_ID);
    await registry.get(SESSION_ID);
    expect(reads).toHaveLength(1);

    clock += 29_000;
    await registry.get(SESSION_ID);
    expect(reads).toHaveLength(1);

    clock += 2_000;
    await registry.get(SESSION_ID);
    expect(reads).toHaveLength(2);

    await registry.invalidate(SESSION_ID);
    await registry.get(SESSION_ID);
    expect(reads).toHaveLength(3);
  });

  it('throttles last_seen_at to once per minute and never awaits it', async () => {
    const touched: string[] = [];
    let clock = 0;
    const registry = new SessionRegistry({
      lookup: async () => recordFor(),
      now: () => clock,
      touch: async (sessionId) => {
        touched.push(sessionId);
      },
    });

    registry.noteActivity(SESSION_ID);
    registry.noteActivity(SESSION_ID);
    clock += 30_000;
    registry.noteActivity(SESSION_ID);
    expect(touched).toHaveLength(1);

    clock += 31_000;
    registry.noteActivity(SESSION_ID);
    expect(touched).toHaveLength(2);

    // A failing write must not surface to the request.
    const failing = new SessionRegistry({
      lookup: async () => recordFor(),
      touch: async () => {
        throw new Error('database down');
      },
    });
    expect(() => failing.noteActivity(SESSION_ID)).not.toThrow();
  });
});

describe('0024_auth_hook.sql', () => {
  const sqlDir = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..',
    '..',
    'packages',
    'db',
    'sql',
  );
  const hookSql = readFileSync(join(sqlDir, '0024_auth_hook.sql'), 'utf8');

  function caseBranches(): Map<string, string[]> {
    const start = hookSql.indexOf('CASE v_role');
    const end = hookSql.indexOf("ELSE '[]'::jsonb", start);
    const block = hookSql.slice(start, end);
    const branches = new Map<string, string[]>();
    for (const match of block.matchAll(/WHEN '([a-z_]+)' THEN '\[(.*?)]'::jsonb/gs)) {
      branches.set(
        match[1] as string,
        [...(match[2] as string).matchAll(/"([^"]+)"/g)].map((m) => m[1] as string),
      );
    }
    return branches;
  }

  it('mirrors ROLE_PERMISSIONS exactly for every role', () => {
    const branches = caseBranches();
    expect([...branches.keys()].sort()).toEqual(Object.keys(ROLE_PERMISSIONS).sort());
    for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      expect([...(branches.get(role) ?? [])].sort(), role).toEqual([...permissions].sort());
    }
  });

  it('only grants permissions that exist in the catalogue', () => {
    const known = new Set<string>(PERMISSIONS);
    for (const permissions of caseBranches().values()) {
      for (const permission of permissions) expect(known.has(permission), permission).toBe(true);
    }
  });

  it('fails safe to client with no permissions', () => {
    expect(hookSql).toContain("to_jsonb('client'::text)");
    expect(hookSql).toContain("'[]'::jsonb");
    expect(hookSql).toContain("v_status <> 'active'");
    expect(hookSql).toContain('v_deleted_at IS NOT NULL');
  });

  it('is security definer, stable, and granted only to the auth admin', () => {
    expect(hookSql).toContain(
      'CREATE OR REPLACE FUNCTION public.vv_custom_access_token_hook(event jsonb)',
    );
    expect(hookSql).toContain('SECURITY DEFINER');
    expect(hookSql).toContain('STABLE');
    expect(hookSql).toContain('SET search_path = public');
    expect(hookSql).toContain(
      'GRANT EXECUTE ON FUNCTION public.vv_custom_access_token_hook(jsonb) TO supabase_auth_admin;',
    );
    expect(hookSql).toContain(
      'REVOKE EXECUTE ON FUNCTION public.vv_custom_access_token_hook(jsonb) FROM authenticated, anon, public;',
    );
    expect(hookSql).toContain('GRANT USAGE ON SCHEMA public TO supabase_auth_admin;');
    expect(hookSql).toContain('KEEP IN SYNC with packages/contracts/src/permissions.ts');
  });
});

describe('HttpError guards', () => {
  it('produces the documented codes', () => {
    expect(HttpError.unauthorized().code).toBe('unauthorized');
    expect(HttpError.forbidden('mfa_required').code).toBe('mfa_required');
    expect(HttpError.forbidden('mfa_required').status).toBe(403);
  });
});

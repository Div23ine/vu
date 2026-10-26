/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Public environment validation.
 *
 * `./env` validates at import time and throws when a required variable is missing,
 * which is exactly the behaviour under test — so the module is loaded dynamically
 * with the environment arranged first, rather than imported at the top of the file.
 */

const PUBLIC_NAMES = [
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_SENTRY_DSN',
  'NEXT_PUBLIC_API_MOCKING',
  'NEXT_PUBLIC_R2_HOST',
  'NEXT_PUBLIC_BUILD_LABEL',
  'NEXT_PUBLIC_NODE_LABEL',
  // an earlier iteration: the Stripe publishable key (public by design — browser tokeniser).
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
] as const;

const VALID = {
  NEXT_PUBLIC_API_URL: 'https://api.vunvault.test',
  NEXT_PUBLIC_SITE_URL: 'https://www.vunvault.test',
};

/** Set the public environment, drop module caching, and import `./env` fresh. */
async function loadEnv(values: Record<string, string | undefined>) {
  vi.resetModules();
  for (const name of PUBLIC_NAMES) delete process.env[name];
  for (const [name, value] of Object.entries(values)) {
    if (value !== undefined) process.env[name] = value;
  }
  return import('./env');
}

afterEach(() => {
  for (const name of PUBLIC_NAMES) delete process.env[name];
  vi.resetModules();
});

describe('parseEnv', () => {
  it('accepts a complete configuration', async () => {
    const { parseEnv } = await loadEnv(VALID);
    expect((parseEnv as any)({ ...VALID })).toEqual({
      NEXT_PUBLIC_API_URL: 'https://api.vunvault.test',
      NEXT_PUBLIC_SITE_URL: 'https://www.vunvault.test',
    });
  });

  it('names every missing variable in one readable error', async () => {
    const { parseEnv } = await loadEnv(VALID);
    const error = (() => {
      try {
        (parseEnv as any)({});
        return null;
      } catch (caught) {
        return caught as Error;
      }
    })();
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toContain('Invalid public environment configuration');
    expect(error?.message).toContain('NEXT_PUBLIC_API_URL');
    expect(error?.message).toContain('NEXT_PUBLIC_SITE_URL');
  });

  it('refuses an API origin that is not a URL', async () => {
    const { parseEnv } = await loadEnv(VALID);
    expect(() => (parseEnv as any)({ ...VALID, NEXT_PUBLIC_API_URL: 'api.vunvault.test' })).toThrow(
      /NEXT_PUBLIC_API_URL/,
    );
    expect(() => (parseEnv as any)({ ...VALID, NEXT_PUBLIC_API_URL: '' })).toThrow(
      /NEXT_PUBLIC_API_URL/,
    );
  });

  it('accepts only the literal `enabled` for mocking', async () => {
    const { API_MOCKING_ENABLED, parseEnv } = await loadEnv(VALID);
    expect(API_MOCKING_ENABLED).toBe('enabled');
    expect((parseEnv as any)({ ...VALID, NEXT_PUBLIC_API_MOCKING: 'enabled' })).toMatchObject({
      NEXT_PUBLIC_API_MOCKING: 'enabled',
    });
    // A truthy-but-wrong value must not silently mean "off" or "on".
    expect(() => (parseEnv as any)({ ...VALID, NEXT_PUBLIC_API_MOCKING: 'true' })).toThrow(
      /NEXT_PUBLIC_API_MOCKING/,
    );
    expect(() => (parseEnv as any)({ ...VALID, NEXT_PUBLIC_API_MOCKING: '1' })).toThrow(
      /NEXT_PUBLIC_API_MOCKING/,
    );
  });

  it('keeps the optional variables optional', async () => {
    const { parseEnv } = await loadEnv(VALID);
    const parsed = (parseEnv as any)({
      ...VALID,
      NEXT_PUBLIC_SENTRY_DSN: 'https://key@o1.ingest.sentry.test/1',
      NEXT_PUBLIC_R2_HOST: 'assets.vunvault.test',
      NEXT_PUBLIC_BUILD_LABEL: 'build-42',
      NEXT_PUBLIC_NODE_LABEL: 'node-nbo-01 · NBO-CORE',
    });
    expect(parsed).toMatchObject({
      NEXT_PUBLIC_SENTRY_DSN: 'https://key@o1.ingest.sentry.test/1',
      NEXT_PUBLIC_R2_HOST: 'assets.vunvault.test',
      NEXT_PUBLIC_BUILD_LABEL: 'build-42',
    });
    expect((parseEnv as any)({ ...VALID }).NEXT_PUBLIC_SENTRY_DSN).toBeUndefined();
  });
});

describe('readPublicEnv', () => {
  it('reads the eight public variables field by field, so Next can inline them', async () => {
    const { readPublicEnv } = await loadEnv(VALID);
    const read = (readPublicEnv as any)({
      NEXT_PUBLIC_API_URL: 'https://api.vunvault.test',
      NEXT_PUBLIC_SITE_URL: 'https://www.vunvault.test',
      NEXT_PUBLIC_NODE_LABEL: 'node-nbo-01',
      // A secret that must never be forwarded to the client bundle.
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
      DATABASE_URL: 'postgres://user:pass@host/db',
    });
    expect(Object.keys(read).sort()).toEqual([...PUBLIC_NAMES].sort());
    expect(read.NEXT_PUBLIC_NODE_LABEL).toBe('node-nbo-01');
    expect(JSON.stringify(read)).not.toContain('service-role');
    expect(JSON.stringify(read)).not.toContain('postgres://');
  });

  it('reads process.env by default', async () => {
    await loadEnv(VALID);
    const { readPublicEnv } = await import('./env');
    expect((readPublicEnv as any)().NEXT_PUBLIC_API_URL).toBe('https://api.vunvault.test');
  });
});

describe('the module-level configuration', () => {
  it('is exported, typed and validated at import time', async () => {
    const envModule = await loadEnv(VALID);
    expect(envModule.env).toMatchObject({
      NEXT_PUBLIC_API_URL: 'https://api.vunvault.test',
      NEXT_PUBLIC_SITE_URL: 'https://www.vunvault.test',
    });
  });

  it('throws a readable error at import when the API origin is missing', async () => {
    await expect(loadEnv({ NEXT_PUBLIC_SITE_URL: 'https://www.vunvault.test' })).rejects.toThrow(
      /NEXT_PUBLIC_API_URL/,
    );
  });
});

describe('formatIssues', () => {
  it('renders one indented line per problem', async () => {
    const { PublicEnvSchema, formatIssues } = await loadEnv(VALID);
    const result = PublicEnvSchema.safeParse({});
    expect(result.success).toBe(false);
    if (result.success) return;
    const formatted = formatIssues(result.error);
    expect(formatted.split('\n')).toHaveLength(2);
    expect(formatted).toMatch(/^ {2}- NEXT_PUBLIC_API_URL: /);
  });
});

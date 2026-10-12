import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { peekClaims } from './lib/jwt-peek';
import middleware from './middleware';

const SITE = 'https://www.vunvault.test';

function makeRequest(path: string, cookie?: string): NextRequest {
  return new NextRequest(
    new URL(path, SITE),
    cookie === undefined ? undefined : { headers: { cookie } },
  );
}

function b64url(value: unknown): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** JWT-shaped (unsigned) token whose payload carries `role` — the peek target. */
function tokenFor(role: string): string {
  const header = b64url({ alg: 'none', typ: 'JWT' });
  const payload = b64url({
    sub: 'c0000000-0000-4000-8000-000000000001',
    role,
    exp: 2_000_000_000,
  });
  return `${header}.${payload}.signature`;
}

describe('route guards', () => {
  it('redirects /admin without a session cookie to /login?next=%2Fadmin', () => {
    const response = middleware(makeRequest('/admin'));
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(`${SITE}/login?next=%2Fadmin`);
  });

  it('guards /portal subpaths and preserves path+search in next=', () => {
    const response = middleware(makeRequest('/portal/jobs?status=open'));
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      `${SITE}/login?next=%2Fportal%2Fjobs%3Fstatus%3Dopen`,
    );
  });

  it('guards /onboarding', () => {
    const response = middleware(makeRequest('/onboarding'));
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(`${SITE}/login?next=%2Fonboarding`);
  });

  it('lets /portal pass with a session cookie', () => {
    const response = middleware(makeRequest('/portal', `vv_at=${tokenFor('client')}`));
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('lets /onboarding pass with only a refresh-token cookie', () => {
    const response = middleware(makeRequest('/onboarding', 'vv_rt=opaque-refresh-token'));
    expect(response.status).toBe(200);
  });

  it('redirects /login with a client cookie to /portal', () => {
    const response = middleware(makeRequest('/login', `vv_at=${tokenFor('client')}`));
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(`${SITE}/portal`);
  });

  it('redirects auth pages with staff tokens to homeFor(role)', () => {
    const admin = middleware(makeRequest('/signup', `vv_at=${tokenFor('super_admin')}`));
    expect(admin.headers.get('location')).toBe(`${SITE}/admin`);

    const support = middleware(makeRequest('/login', `vv_at=${tokenFor('support_engineer')}`));
    expect(support.headers.get('location')).toBe(`${SITE}/admin/profile`);
  });

  it('does nothing on /login when the session cookie is present but vv_at is unreadable', () => {
    const response = middleware(makeRequest('/login', 'vv_at=garbage; vv_rt=whatever'));
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('redirects /admin/users with a client token to /forbidden', () => {
    const response = middleware(makeRequest('/admin/users', `vv_at=${tokenFor('client')}`));
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(`${SITE}/forbidden`);
  });

  it('passes /admin/users with a staff token', () => {
    const response = middleware(makeRequest('/admin/users', `vv_at=${tokenFor('admin')}`));
    expect(response.status).toBe(200);
  });

  it('leaves unguarded public paths alone', () => {
    expect(middleware(makeRequest('/')).status).toBe(200);
    expect(middleware(makeRequest('/about')).status).toBe(200);
    expect(middleware(makeRequest('/news/cve-of-the-week')).status).toBe(200);
  });
});

describe('CSP + nonce', () => {
  it('sets the CSP header on pass-through responses, with the request nonce', () => {
    const response = middleware(makeRequest('/portal', `vv_at=${tokenFor('client')}`));
    const csp = response.headers.get('content-security-policy') ?? '';
    expect(csp).toContain("'nonce-");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("'unsafe-eval'"); // NODE_ENV=test, not development

    const override = response.headers.get('x-middleware-override-headers') ?? '';
    expect(override).toContain('x-nonce');
    const nonce = response.headers.get('x-middleware-request-x-nonce') ?? '';
    expect(nonce).not.toBe('');
    expect(csp).toContain(`'nonce-${nonce}'`);
  });

  it('sets the CSP header on redirect responses too', () => {
    const response = middleware(makeRequest('/admin'));
    expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
  });

  it('mints a fresh nonce per request', () => {
    const first = middleware(makeRequest('/'));
    const second = middleware(makeRequest('/'));
    expect(first.headers.get('x-middleware-request-x-nonce')).not.toBe(
      second.headers.get('x-middleware-request-x-nonce'),
    );
  });
});

describe('peekClaims', () => {
  it('never throws on garbage', () => {
    const garbage = [
      '',
      'garbage',
      'a.b',
      'a.b.c.d',
      '.',
      '..',
      'a..c',
      'a.b.c',
      `x.${'!'.repeat(20)}.y`,
      `${b64url({ ok: true })}.${b64url({ role: 'client' })}`, // only two segments
    ];
    for (const token of garbage) {
      expect(() => peekClaims(token)).not.toThrow();
    }
  });

  it('returns null for non-tokens and non-object payloads', () => {
    expect(peekClaims('')).toBeNull();
    expect(peekClaims('not-a-jwt')).toBeNull();
    expect(peekClaims(`x.${b64url([1, 2, 3])}.y`)).toBeNull();
    expect(peekClaims(`x.${b64url('just a string')}.y`)).toBeNull();
    expect(peekClaims('a..c')).toBeNull(); // empty payload segment
  });

  it('extracts role and exp from a valid token', () => {
    expect(peekClaims(tokenFor('client'))).toEqual({ role: 'client', exp: 2_000_000_000 });
  });

  it('drops unknown roles instead of passing them through', () => {
    expect(peekClaims(tokenFor('supreme_overlord'))).toEqual({ exp: 2_000_000_000 });
  });
});

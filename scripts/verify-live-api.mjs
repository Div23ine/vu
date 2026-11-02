/**
 * Live API probe — Task 4 smoke test, read-only half.
 *
 * Mints HS256 access tokens with the real project JWT secret so the request
 * travels the whole live path: cookie -> verifyAccessToken -> session-registry
 * LOOKUP_SQL -> Task 2e enforcement. Nothing here writes to the database.
 *
 * The point of test 4 is specific: a correctly-signed token whose session_id
 * does not exist MUST produce a 401 (fail-closed). If migration 0097 had not
 * been applied, LOOKUP_SQL would throw "column p.mfa_setup_deadline does not
 * exist" and this would come back a 500 — which is exactly the regression that
 * would have taken down every authenticated request in production.
 */
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:8080';

const env = {};
for (const line of readFileSync(new URL('../apps/api/.env', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
}
const SECRET = env.SUPABASE_JWT_SECRET;
const ISSUER = `${env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1`;

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function mint(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: ISSUER,
    aud: 'authenticated',
    sub: crypto.randomUUID(),
    role: 'admin',
    org_id: null,
    permissions: [],
    email: 'probe-nonexistent@example.invalid',
    session_id: crypto.randomUUID(),
    aal: 'aal1',
    iat: now,
    exp: now + 300,
    ...overrides,
  };
  const head = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(claims)}`;
  const sig = crypto.createHmac('sha256', SECRET).update(head).digest('base64url');
  return `${head}.${sig}`;
}

let pass = 0;
let fail = 0;
async function check(name, method, path, { cookie, body, expect } = {}) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  if (body) headers['content-type'] = 'application/json';
  let status;
  let text = '';
  try {
    const res = await fetch(BASE + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(25000),
    });
    status = res.status;
    text = (await res.text()).slice(0, 160).replace(/\s+/g, ' ');
  } catch (error) {
    status = `ERR ${error.message.slice(0, 60)}`;
  }
  const ok = Array.isArray(expect) ? expect.includes(status) : status === expect;
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  console.log(`      ${method} ${path} -> ${status} (expected ${JSON.stringify(expect)})`);
  if (!ok && text) console.log(`      body: ${text}`);
  return status;
}

console.log(`Probing ${BASE}`);
console.log(`  issuer: ${ISSUER}`);
console.log(`  secret: ${SECRET.length} chars, HMAC ready\n`);

const at = (t) => `vv_at=${t}`;

// 1-3: unauthenticated shapes must all fail closed with 401, never 500.
await check('csrf endpoint is public', 'GET', '/api/v1/auth/csrf', { expect: 200 });
await check('no cookie -> 401', 'GET', '/api/v1/auth/session', { expect: 401 });
await check('garbage cookie -> 401', 'GET', '/api/v1/auth/session', {
  cookie: at('not.a.jwt'),
  expect: 401,
});
await check('wrong-signature cookie -> 401', 'GET', '/api/v1/auth/session', {
  cookie: at(mint().slice(0, -4) + 'AAAA'),
  expect: 401,
});
await check('valid sig, wrong issuer -> 401', 'GET', '/api/v1/auth/session', {
  cookie: at(mint({ iss: 'https://evil.example/auth/v1' })),
  expect: 401,
});
await check('valid sig, wrong audience -> 401', 'GET', '/api/v1/auth/session', {
  cookie: at(mint({ aud: 'anon' })),
  expect: 401,
});
await check('expired token -> 401', 'GET', '/api/v1/auth/session', {
  cookie: at(mint({ exp: Math.floor(Date.now() / 1000) - 600 })),
  expect: 401,
});

// 4: THE migration regression test.
const status = await check(
  'valid sig + unknown session_id -> 401 (LOOKUP_SQL ran, NOT a 500)',
  'GET',
  '/api/v1/auth/session',
  { cookie: at(mint()), expect: 401 },
);
if (status === 401) {
  console.log('      => profiles.mfa_setup_deadline is queryable in the live path');
} else if (status >= 500) {
  console.log('      => 5xx: LOOKUP_SQL threw — migration 0097 is NOT applied!');
}

// 5: same token against the Task 3 / F3 surface.
await check('unknown session on /account/security -> 401', 'GET', '/api/v1/account/security', {
  cookie: at(mint()),
  expect: 401,
});
await check('unknown session on /account/sessions -> 401', 'GET', '/api/v1/account/sessions', {
  cookie: at(mint()),
  expect: 401,
});
// A state-changing request carries a session cookie, so the double-submit CSRF
// guard rejects it (403 csrf_failed) before authentication ever runs. Either
// status proves the request was refused with no side effect; 403 is the
// expected one here and is the guard working as designed.
await check(
  'unknown session on TOTP enroll -> refused (403 csrf or 401)',
  'POST',
  '/api/v1/account/mfa/totp/enroll',
  { cookie: at(mint()), body: {}, expect: [401, 403] },
);

// 6: input validation must reject before any side effect.
await check('magic-link with malformed body -> 4xx (no write)', 'POST', '/api/v1/auth/magic-link', {
  body: { email: 'not-an-email' },
  expect: [400, 422],
});
await check('magic-link with empty body -> 4xx (no write)', 'POST', '/api/v1/auth/magic-link', {
  body: {},
  expect: [400, 422],
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

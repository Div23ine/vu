#!/usr/bin/env node
/**
 * Post-deploy smoke (Task 102).
 *
 * Probes the deployed estate for the properties the platform promises — not
 * "is it up" but "is it up the way the tasks built it": the health endpoints,
 * the CSRF cookie, the security headers (and the absence of a `server` leak),
 * the dead `/docs`, the nonce'd CSP on the web root, the Task 95 relay's
 * pre-upgrade refusal of an unauthenticated WebSocket, and the Task 40g HMAC
 * gate on the internal callbacks. Every check names itself; any failure exits
 * non-zero and the deploy workflow's rollback job takes over.
 *
 * Usage: node scripts/deploy/smoke.mjs --api https://api.<zone> --web https://www.<zone>
 */
import process from 'node:process';

function parseArgs(argv) {
  const args = { api: null, web: null };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--api') args.api = argv[i + 1];
    if (argv[i] === '--web') args.web = argv[i + 1];
  }
  if (args.api === null || args.web === null) {
    throw new Error('usage: smoke.mjs --api <url> --web <url>');
  }
  return args;
}

const results = [];

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`ok   — ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error: String(error?.message ?? error) });
    console.error(`FAIL — ${name}: ${error?.message ?? error}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const { api, web } = parseArgs(process.argv);

  await check('GET /healthz → 200', async () => {
    const response = await fetch(`${api}/healthz`);
    assert(response.status === 200, `status ${response.status}`);
  });

  await check('GET /readyz → 200', async () => {
    const response = await fetch(`${api}/readyz`);
    assert(response.status === 200, `status ${response.status}`);
  });

  await check('GET /api/v1/auth/csrf sets vv_csrf and the security headers', async () => {
    const response = await fetch(`${api}/api/v1/auth/csrf`);
    assert(response.ok, `status ${response.status}`);
    const setCookie = response.headers.getSetCookie?.() ?? [];
    assert(
      setCookie.some((cookie) => cookie.startsWith('vv_csrf=')),
      'no vv_csrf cookie',
    );
    assert(response.headers.get('strict-transport-security') !== null, 'no HSTS');
    assert(response.headers.get('x-content-type-options') === 'nosniff', 'no nosniff');
    assert(response.headers.get('server') === null, 'server header leaks');
  });

  await check('GET /docs is dead at the API edge (404)', async () => {
    const response = await fetch(`${api}/docs`, { redirect: 'manual' });
    assert(response.status === 404, `status ${response.status}`);
  });

  await check('web / → 200 with a nonce CSP', async () => {
    const response = await fetch(`${web}/`);
    assert(response.status === 200, `status ${response.status}`);
    const csp = response.headers.get('content-security-policy') ?? '';
    assert(csp.includes('nonce-'), `CSP has no nonce: ${csp.slice(0, 80)}`);
  });

  await check('WS upgrade without a session is refused before 101', async () => {
    // The Task 95 gate answers with plain HTTP: a browser WebSocket would see
    // a failed handshake, fetch sees the status. Anything 1xx/2xx is a bug.
    const response = await fetch(
      `${api.replace(/^http/, 'http')}/api/v1/scans/00000000-0000-4000-8000-000000000000/stream`,
      {
        headers: {
          upgrade: 'websocket',
          connection: 'upgrade',
          'sec-websocket-version': '13',
          'sec-websocket-key': 'Zm9vYmFyZm9vYmFyZm9vYg==',
          origin: web,
        },
      },
    );
    assert(
      response.status === 401 || response.status === 403,
      `status ${response.status} — expected a refusal`,
    );
  });

  await check('unsigned internal callback → 401 (Task 40g HMAC)', async () => {
    const response = await fetch(
      `${api}/api/v1/internal/scans/00000000-0000-4000-8000-000000000001/claim`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' },
    );
    assert(response.status === 401, `status ${response.status}`);
  });

  const failed = results.filter((result) => !result.ok);
  console.log(`\nsmoke: ${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length === 0 ? 0 : 1);
}

await main();

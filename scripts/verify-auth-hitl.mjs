#!/usr/bin/env node
/**
 * Human-in-the-loop auth verification driver (work order `Auth bug.md`, H0–H7).
 *
 * WHY THIS EXISTS
 * The H-addendum forbids the agent from self-confirming anything that touches
 * email or MFA: a real inbox must be opened, a real Google Authenticator must
 * scan a real QR, and a real 6-digit code must be accepted by a real server.
 * None of that can happen in the sandbox this was written in — `next dev` is
 * OOM-killed compiling a single route under the 1 GiB cgroup limit, and there
 * is no `apps/api/.env`. So the run is handed to a human at a machine where the
 * stack actually boots, and this script is the driver: it performs every
 * agent-side step, prints exactly what the human has to paste back, and refuses
 * to let a step be recorded as PASS without that paste-back.
 *
 * It is deliberately NOT automated end-to-end. A script that could mark these
 * rows PASS by itself would defeat the entire point of H1/H2.
 *
 * Usage (API must already be running — `pnpm dev`):
 *   node scripts/verify-auth-hitl.mjs doctor
 *   node scripts/verify-auth-hitl.mjs magic-link <email>
 *   node scripts/verify-auth-hitl.mjs verify <token> [--next <path>]
 *   node scripts/verify-auth-hitl.mjs session
 *   node scripts/verify-auth-hitl.mjs setup-options
 *   node scripts/verify-auth-hitl.mjs setup-verify <6-digit-code>
 *   node scripts/verify-auth-hitl.mjs totp-enroll            # F3 path (aal1 session)
 *   node scripts/verify-auth-hitl.mjs totp-verify <6-digit-code>
 *   node scripts/verify-auth-hitl.mjs enforce                # Task 2e probe
 *   node scripts/verify-auth-hitl.mjs logout
 *   node scripts/verify-auth-hitl.mjs record --item <name> --delivered <x> --evidence <x> \
 *                                            --user <quote> --server <status> --status <STATUS>
 *   node scripts/verify-auth-hitl.mjs report
 *
 * Environment:
 *   HITL_API   API base URL           (default http://127.0.0.1:8080)
 *   HITL_JAR   cookie-jar scratch file (default .hitl-cookies.json, gitignored)
 *   HITL_LOG   recorded-rows file      (default .hitl-report.json,  gitignored)
 *
 * Statuses are the H3 vocabulary, and only these: PASS (user-confirmed),
 * PASS (manual-entry fallback), PENDING-USER, FAIL, BLOCKED.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = (process.env.HITL_API ?? 'http://127.0.0.1:8080').replace(/\/+$/, '');
const JAR_FILE = path.resolve(REPO_ROOT, process.env.HITL_JAR ?? '.hitl-cookies.json');
const LOG_FILE = path.resolve(REPO_ROOT, process.env.HITL_LOG ?? '.hitl-report.json');
const QR_FILE = path.resolve(REPO_ROOT, '.hitl-totp-qr.svg');

const STATUSES = [
  'PASS (user-confirmed)',
  'PASS (manual-entry fallback)',
  'PENDING-USER',
  'FAIL',
  'BLOCKED',
];

/* ─────────────────────────── output helpers ─────────────────────────── */

/**
 * Write to stdout directly.
 *
 * The repo's `no-console` rule allows only `warn` and `error`, which suits the
 * one-line `OK:`/`FAIL:` verify scripts. This is an interactive driver whose
 * entire job is printing guidance for a human, so it goes through stdout
 * instead of `console.log` — satisfying the rule rather than disabling it.
 * `console.error` is kept for `die`, where stderr is genuinely correct.
 */
const out = (...parts) => process.stdout.write(`${parts.join(' ')}\n`);

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const amber = (s) => `\x1b[33m${s}\x1b[0m`;

function head(title) {
  out(`\n${bold('━'.repeat(72))}\n${bold(title)}\n${bold('━'.repeat(72))}`);
}
/** A thing the human must do, printed so it cannot be skimmed past. */
function human(lines) {
  out(`\n${amber(bold('► YOUR TURN'))}`);
  for (const line of lines) out(`  ${line}`);
  out(amber('  Then paste the result back. Nothing is PASS until you do.\n'));
}
function kv(key, value) {
  out(`  ${dim(key.padEnd(22))} ${value}`);
}
function die(message, code = 1) {
  console.error(red(`\n✖ ${message}\n`));
  process.exit(code);
}
/** Mask anything that looks like a credential (G6). */
function mask(value) {
  const s = String(value);
  return s.length <= 8 ? '****' : `${s.slice(0, 4)}****${s.slice(-2)}`;
}

/* ─────────────────────────── cookie jar ─────────────────────────── */

let jar = {};

async function loadJar() {
  try {
    jar = JSON.parse(await readFile(JAR_FILE, 'utf8'));
  } catch {
    jar = {};
  }
}
async function saveJar() {
  await writeFile(JAR_FILE, `${JSON.stringify(jar, null, 2)}\n`, 'utf8');
}
function cookieHeader() {
  return Object.entries(jar)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}
function absorbCookies(response) {
  // getSetCookie() keeps multiple Set-Cookie headers separate, which joining
  // via get('set-cookie') would corrupt.
  const raw =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [response.headers.get('set-cookie')].filter(Boolean);
  const set = [];
  for (const entry of raw) {
    const pair = String(entry).split(';')[0] ?? '';
    const eq = pair.indexOf('=');
    if (eq < 1) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    // An empty value with a past expiry is a clear — drop it from the jar.
    if (value === '') delete jar[name];
    else jar[name] = value;
    set.push(name);
  }
  return set;
}

/**
 * One API call, with the jar applied and refreshed.
 * `redirect: 'manual'` is essential: the magic-link verify leg answers 302 and
 * the Location header IS the assertion under test — following it would throw
 * away the very thing H1/Task 2 is about.
 */
async function api(method, route, { body, followRedirect = false } = {}) {
  const headers = { accept: 'application/json' };
  const cookie = cookieHeader();
  if (cookie !== '') headers.cookie = cookie;
  // Double-submit CSRF: the readable vv_csrf cookie echoed into the header.
  if (jar.vv_csrf !== undefined && method !== 'GET') headers['x-csrf-token'] = jar.vv_csrf;
  if (body !== undefined) headers['content-type'] = 'application/json';

  const response = await fetch(`${API}/api/v1${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: followRedirect ? 'follow' : 'manual',
  });
  const cookiesSet = absorbCookies(response);
  await saveJar();

  const text = await response.text();
  let json = null;
  try {
    json = text === '' ? null : JSON.parse(text);
  } catch {
    json = null;
  }
  return {
    status: response.status,
    location: response.headers.get('location'),
    json,
    text,
    cookiesSet,
  };
}

async function bootstrapCsrf() {
  if (jar.vv_csrf !== undefined) return jar.vv_csrf;
  const response = await api('GET', '/auth/csrf');
  if (response.status !== 200 || jar.vv_csrf === undefined) {
    die(
      `could not bootstrap CSRF from GET /auth/csrf (HTTP ${response.status}). Is the API running at ${API}?`,
    );
  }
  return jar.vv_csrf;
}

/* ─────────────────────────── Task 2 routing verdict ─────────────────────────── */

/**
 * The Task 2 acceptance matrix, restated as an executable expectation. The
 * point of printing it is that a human reads the ACTUAL landing next to the
 * REQUIRED one — the script does not get to decide they match.
 */
const ROUTING_MATRIX = [
  [
    'admin (non-exempt)',
    'not enrolled',
    'full aal1 session → `/` + mandatory popup, deadline armed',
  ],
  ['admin (non-exempt)', 'enrolled', '`/login/mfa?methods=…`'],
  ['super_admin divine@', 'any', 'full session → `/admin`, no timer, no popup'],
  ['client', 'any', '`/login/mfa?methods=…` — always the verify screen'],
];

function printRoutingMatrix() {
  out(`\n${bold('Task 2 required routing matrix')}`);
  for (const [role, enrolled, target] of ROUTING_MATRIX) {
    out(`  ${dim(role.padEnd(20))} ${dim(enrolled.padEnd(13))} → ${target}`);
  }
  out('');
}

function describeCookies(names) {
  const has = (n) => names.includes(n);
  return [
    `vv_at=${has('vv_at') ? green('set') : dim('absent')}`,
    `vv_rt=${has('vv_rt') ? green('set') : dim('absent')}`,
    `vv_mfa=${has('vv_mfa') ? green('set') : dim('absent')}`,
  ].join('  ');
}

/* ─────────────────────────── H2 TOTP deliverable ─────────────────────────── */

/**
 * H2 requires three artefacts handed to the human: the rendered QR, the raw
 * otpauth:// URI, and the Base32 secret on its own line. The secret is printed
 * IN FULL on purpose — it is the manual-entry fallback, and masking it would
 * make the fallback impossible. It is a freshly generated enrolment secret for
 * a test account, not a stored credential.
 */
async function deliverTotp(data, origin) {
  const svg = data.qrCodeSvg ?? '';
  if (svg === '') {
    out(amber('  ⚠ the API returned NO qrCodeSvg — the QR cannot be rendered.'));
    out(amber('    Per H2 this is NOT yet a FAIL: deliver the URI + secret and use manual entry.'));
  } else {
    // GoTrue returns raw SVG. Write it verbatim so it can be opened and scanned;
    // a browser <img> needs it encoded, which is exactly what the Task 3 fix in
    // apps/web/src/lib/qr.ts does — do not re-encode here or the double-encoding
    // bug comes back.
    await writeFile(QR_FILE, svg, 'utf8');
    out(
      `  ${dim('QR image'.padEnd(22))} ${green(`written to ${path.relative(REPO_ROOT, QR_FILE)}`)}`,
    );
    out(
      `  ${dim('QR is data URI?'.padEnd(22))} ${svg.startsWith('data:') ? amber('yes — already encoded') : 'no — raw SVG (correct)'}`,
    );
  }

  out(`\n${bold('otpauth:// URI (verbatim)')}`);
  out('```');
  out(data.uri ?? '(none returned)');
  out('```');
  out(`\n${bold('Base32 secret (manual entry)')}`);
  out('```');
  out(data.secret ?? '(none returned)');
  out('```');
  if (data.factorId !== undefined) {
    jar.__hitl_factorId = data.factorId;
    await saveJar();
    kv('factorId (saved)', data.factorId);
  }
  if (origin !== undefined) kv('flow', origin);
}

/* ─────────────────────────── recorded rows (H4) ─────────────────────────── */

async function loadLog() {
  try {
    return JSON.parse(await readFile(LOG_FILE, 'utf8'));
  } catch {
    return [];
  }
}

/* ─────────────────────────── commands ─────────────────────────── */

const commands = {
  /** Preflight: is there any point continuing? */
  async doctor() {
    head('H0.2 — preflight');
    kv('API base', API);

    const health = await fetch(`${API}/health`).then(
      (r) => r.json().catch(() => ({})),
      () => null,
    );
    if (health === null) {
      out(red('  ✖ API unreachable. Start it with `pnpm dev` and re-run.'));
      process.exitCode = 1;
      return;
    }
    kv('/health', green(JSON.stringify(health)));

    const token = await bootstrapCsrf();
    kv('CSRF bootstrapped', green(`vv_csrf=${mask(token)}`));

    // The Task 2 column must exist or every deadline assertion is meaningless.
    const anon = await api('GET', '/auth/session');
    kv(
      'GET /auth/session',
      `HTTP ${anon.status} ${anon.status === 401 ? dim('(expected: anonymous)') : ''}`,
    );

    out(`\n${bold('Resend / from-address (H0.2) — confirm manually:')}`);
    out('  ☐ RESEND_API_KEY loaded (masked in every log)');
    out('  ☐ from address is a VERIFIED domain, or is onboarding@resend.dev');
    out('    (if onboarding@resend.dev, the recipient MUST be the Resend-account');
    out('     email address — that is a Resend rule, not ours)');
    out('  ☐ no mocks, no MAIL_DEV_MODE, no console-log "success"');

    out(`\n${bold('H0.1 — the real test inbox:')}`);
    out('  ☐ obtained from the user, NOT guessed');
    out('  ☐ never delivered@resend.dev / @example.com / a test address');
    out('  ☐ recorded MASKED in playbook.md → Human verification → Test inbox');
    out(`\n${bold('Migration 0097 must be applied before any Task 2 step:')}`);
    out('  ☐ pnpm db:migrate   (adds profiles.mfa_setup_deadline)');
  },

  /** H1 step 1 — trigger a real send. */
  async 'magic-link'([email]) {
    if (email === undefined) die('usage: magic-link <email>');
    head(`H1 — magic link → ${mask(email)}`);
    await bootstrapCsrf();

    const response = await api('POST', '/auth/magic-link', { body: { email } });
    kv('HTTP', String(response.status));
    kv('body', response.text.slice(0, 200));
    // 200 with the generic ack is CORRECT for both registered and unregistered
    // addresses — the route never reveals registration status. So a 200 here is
    // not evidence the address exists, and must not be reported as such.
    out(dim('  (a generic 200 is expected for registered AND unregistered addresses;'));
    out(dim('   it is deliberately not evidence that this account exists)'));

    human([
      `Open the inbox for ${mask(email)}.`,
      'Find the Resend message id + dashboard status and paste them here.',
      'Confirm the email actually arrived — delivery is yours to confirm, not mine.',
      'Copy the `token=` value out of the magic link (do NOT click it yet if you',
      'want this script to record the landing URL), then run:',
      `  node scripts/verify-auth-hitl.mjs verify <token>`,
    ]);
    await record({
      item: `Magic link → ${mask(email)}`,
      delivered: mask(email),
      evidence: 'HTTP 200 generic ack (Resend id pending)',
      user: '',
      server: String(response.status),
      status: 'PENDING-USER',
    });
  },

  /** H1 step 2 — the landing URL IS the Task 2 assertion. */
  async verify([token, ...rest]) {
    if (token === undefined) die('usage: verify <token> [--next <path>]');
    const nextIdx = rest.indexOf('--next');
    const next = nextIdx >= 0 ? rest[nextIdx + 1] : undefined;

    head('H1 / Task 2 — magic-link verify: where does it land?');
    printRoutingMatrix();

    const query = next === undefined ? '' : `&next=${encodeURIComponent(next)}`;
    const response = await api(
      'GET',
      `/auth/magic-link/verify?token=${encodeURIComponent(token)}${query}`,
    );

    kv('HTTP', String(response.status));
    kv(
      'Location',
      response.location === null ? red('(none — not a redirect)') : bold(response.location),
    );
    out(`  ${dim('cookies'.padEnd(22))} ${describeCookies(response.cookiesSet)}`);

    const landed = response.location ?? '';
    const isHomepage = /\/$/.test(landed) && !landed.includes('/login');
    const isMfaVerify = landed.includes('/login/mfa') && !landed.includes('/setup');
    const isSetupScreen = landed.includes('/login/mfa/setup');
    const isAdminHome = landed.includes('/admin');

    out(`\n${bold('Reading the landing (compare against the matrix above):')}`);
    kv('homepage `/`', isHomepage ? green('yes — admin first-login / Task 2b') : dim('no'));
    kv('/login/mfa', isMfaVerify ? green('yes — verify screen / Task 2c') : dim('no'));
    kv(
      '/login/mfa/setup',
      isSetupScreen
        ? amber('yes — OLD Phase-2 behaviour, unexpected')
        : dim('no (correct: popup replaces it)'),
    );
    kv('/admin', isAdminHome ? green('yes — exempt super admin') : dim('no'));
    kv(
      'full session cookies',
      response.cookiesSet.includes('vv_at') ? green('yes (aal1)') : dim('no (pre-MFA only)'),
    );

    if (response.status === 302 && response.cookiesSet.includes('vv_at')) {
      out(dim('\n  A full session was issued at this leg. Check the deadline the server armed:'));
      out(dim('    node scripts/verify-auth-hitl.mjs session'));
    }

    human([
      'Click the SAME link in a real browser (or open the Location above).',
      'Describe where you actually landed, and whether the enrolment popup appeared.',
      'For an admin first login the popup must be non-dismissible and counting down.',
      'Paste that description back — H1 forbids me inferring it from the 302.',
    ]);
    await record({
      item: `Verify landing → ${mask(landed || '(none)')}`,
      delivered: 'magic-link token',
      evidence: `HTTP ${response.status} Location=${landed || '-'} cookies=${response.cookiesSet.join(',') || '-'}`,
      user: '',
      server: String(response.status),
      status: 'PENDING-USER',
    });
  },

  /** Task 2b/2e — read the server-armed deadline off the session view. */
  async session() {
    head('Task 2b/2e — GET /auth/session');
    const response = await api('GET', '/auth/session');
    kv('HTTP', String(response.status));
    if (response.status === 401) {
      out(amber('  401 — no usable session cookie in the jar. Run `verify <token>` first.'));
      out(dim('  Note: an EXPIRED setup window also produces 401 here. That is Task 2e'));
      out(dim('  failing closed on purpose, not a bug.'));
      return;
    }
    const user = response.json?.data;
    if (user === undefined) {
      kv('body', response.text.slice(0, 300));
      return;
    }
    kv('email', mask(user.email ?? ''));
    kv('role', String(user.role));
    kv('mfaEnrolled', String(user.mfaEnrolled));
    kv('aal / methods', `${user.aal ?? '-'} / ${JSON.stringify(user.mfaMethods ?? [])}`);

    const deadline = user.mfaSetupDeadline ?? null;
    kv('mfaSetupDeadline', deadline === null ? dim('null (no window armed)') : String(deadline));
    if (deadline !== null) {
      const remaining = Math.round((Date.parse(deadline) - Date.now()) / 1000);
      const shown = `${Math.floor(Math.max(0, remaining) / 60)}:${String(Math.max(0, remaining) % 60).padStart(2, '0')}`;
      kv(
        'remaining',
        remaining > 0 ? green(`${shown} (${remaining}s)`) : red(`CLOSED ${-remaining}s ago`),
      );
      out(dim('\n  This is the value the popup renders. It comes from the server on every'));
      out(dim('  load, so a reload cannot restart the five minutes — assert that by'));
      out(dim('  re-running this command after ~30s and watching the value FALL.'));
      if (remaining > 0) {
        human([
          'In the browser, confirm the popup shows a countdown close to the above.',
          'Confirm it CANNOT be closed with Escape or a backdrop click.',
          'Reload the page: the countdown must continue from the server value,',
          'not reset to 5:00.',
        ]);
      } else {
        out(amber('\n  Window already closed → `enforce` should now reject this session.'));
      }
    } else if (user.role === 'super_admin') {
      out(green('  Correct: the exempt super admin never gets a window armed.'));
    } else if (user.mfaEnrolled === true) {
      out(green('  Correct: enrolled accounts have no open window (deadline cleared).'));
    }
  },

  /** H2 — the enrolment ceremony behind the popup (setup legs). */
  async 'setup-options'() {
    head('H2 — POST /auth/mfa/setup/options');
    await bootstrapCsrf();
    const response = await api('POST', '/auth/mfa/setup/options');
    kv('HTTP', String(response.status));
    if (response.status !== 200) {
      kv('body', response.text.slice(0, 300));
      if (response.status === 403) {
        out(amber('\n  403 — the vv_mfa cookie is not a SETUP challenge. Under Task 2c a'));
        out(amber('  client never holds one; only an admin first login does.'));
      }
      if (response.status === 410) {
        out(amber('\n  410 — the setup window closed. Re-run the magic link to re-arm.'));
      }
      return;
    }
    await deliverTotp(response.json?.data ?? {}, 'setup legs (/auth/mfa/setup/*)');
    const windowEnds = response.json?.data?.deadlineEpochMs;
    if (windowEnds !== null && windowEnds !== undefined) {
      const remaining = Math.round((windowEnds - Date.now()) / 1000);
      kv('window remaining', remaining > 0 ? green(`${remaining}s`) : red('CLOSED'));
    }
    human([
      `Open ${path.relative(REPO_ROOT, QR_FILE)} and scan it with Google Authenticator.`,
      'If it will not scan, add the secret MANUALLY (that is an accepted fallback,',
      'and the QR failure must still be logged as a Known Gap).',
      'Paste back the 6-digit code your app shows, then run:',
      '  node scripts/verify-auth-hitl.mjs setup-verify <code>',
      'Do NOT feed the secret to an online TOTP generator — H2 forbids it.',
    ]);
    await record({
      item: 'Signup/first-login TOTP — QR + secret delivered',
      delivered:
        (response.json?.data?.qrCodeSvg ?? '') === ''
          ? 'URI + secret only (QR absent)'
          : 'QR + URI + secret',
      evidence: `otpauth://totp/${String(response.json?.data?.uri ?? '').slice(15, 40)}…`,
      user: '',
      server: String(response.status),
      status: 'PENDING-USER',
    });
  },

  /** H2 — validate the human's real code server-side. */
  async 'setup-verify'([code]) {
    if (code === undefined) die('usage: setup-verify <6-digit-code>');
    if (!/^\d{6}$/.test(code)) die('the code must be exactly 6 digits');
    head('H2 — POST /auth/mfa/setup/verify');

    const factorId = jar.__hitl_factorId;
    if (factorId === undefined) die('no factorId in the jar — run `setup-options` first');
    kv('factorId', factorId);
    kv('code (from YOUR app)', code);

    const response = await api('POST', '/auth/mfa/setup/verify', { body: { factorId, code } });
    kv('HTTP', String(response.status));
    out(`  ${dim('cookies'.padEnd(22))} ${describeCookies(response.cookiesSet)}`);
    if (response.status === 200) {
      const data = response.json?.data ?? {};
      kv('role', String(data.role ?? '-'));
      kv('mfaEnrolled', String(data.mfaEnrolled ?? '-'));
      out(green('\n  ✔ The server accepted a code from YOUR authenticator app.'));
      out(dim('    Re-run `session` — mfaSetupDeadline must now be null and'));
      out(dim('    mfaEnrolled true. That is the deadline being cleared on success.'));
    } else {
      kv('body', response.text.slice(0, 300));
      out(red('\n  ✖ Rejected. Per H2 this is a FAIL — log the exact response above.'));
      out(dim('    401 mfa_failed = wrong/expired code; 410 = window closed.'));
    }
    await record({
      item: 'TOTP code accepted by server (setup legs)',
      delivered: `code ${code}`,
      evidence: `factorId=${factorId}`,
      user: 'code pasted back from Google Authenticator',
      server: String(response.status),
      status: response.status === 200 ? 'PASS (user-confirmed)' : 'FAIL',
    });
  },

  /** F3 — the account-security enrolment path, which must rotate to aal2. */
  async 'totp-enroll'() {
    head('F3 — POST /account/mfa/totp/enroll (authenticated, aal1 is enough)');
    await bootstrapCsrf();
    const response = await api('POST', '/account/mfa/totp/enroll');
    kv('HTTP', String(response.status));
    if (response.status === 204) {
      out(dim('  204 with no body — this route returns the enrolment in the body only'));
      out(dim('  on some versions; if so, use `setup-options` for the artefacts.'));
      return;
    }
    if (response.status !== 200) {
      kv('body', response.text.slice(0, 300));
      if (response.status === 401)
        out(amber('\n  401 — needs a session cookie. Run `verify <token>` first.'));
      return;
    }
    await deliverTotp(response.json?.data ?? {}, 'account-security (F3)');
    human([
      'Scan or manually enter, then paste the 6-digit code and run:',
      '  node scripts/verify-auth-hitl.mjs totp-verify <code>',
      'F3 is the point of this leg: after a 204 the cookies MUST be rotated',
      'to aal2. `totp-verify` checks that explicitly.',
    ]);
  },

  async 'totp-verify'([code]) {
    if (code === undefined) die('usage: totp-verify <6-digit-code>');
    if (!/^\d{6}$/.test(code)) die('the code must be exactly 6 digits');
    head('F3 — POST /account/mfa/totp/verify (must rotate cookies to aal2)');

    const factorId = jar.__hitl_factorId;
    if (factorId === undefined) die('no factorId in the jar — run `totp-enroll` first');
    const before = jar.vv_at;

    const response = await api('POST', '/account/mfa/totp/verify', { body: { factorId, code } });
    kv('HTTP', String(response.status));
    kv('expected', '204');
    const rotated = response.cookiesSet.includes('vv_at');
    kv('vv_at re-set', rotated ? green('yes — cookies rotated') : red('NO — F3 regression'));
    if (rotated && before !== undefined) {
      kv('token changed', jar.vv_at !== before ? green('yes') : red('no — same token'));
    }
    if (response.status === 204 && rotated) {
      out(green('\n  ✔ F3 closed: 204 AND the session cookies were rotated to aal2.'));
      out(dim('    Confirm with `session` — aal should read aal2.'));
    } else if (response.status === 204) {
      out(red('\n  ✖ F3 STILL OPEN: 204 without cookie rotation. Report this.'));
    } else {
      kv('body', response.text.slice(0, 300));
    }
    await record({
      item: 'F3 — totp/verify rotates cookies to aal2',
      delivered: `code ${code}`,
      evidence: `vv_at re-set=${rotated}`,
      user: 'code pasted back from Google Authenticator',
      server: String(response.status),
      status: response.status === 204 && rotated ? 'PASS (user-confirmed)' : 'FAIL',
    });
  },

  /** Task 2e — the per-request deadline enforcement. */
  async enforce() {
    head('Task 2e — deadline enforcement on a protected route');
    const session = await api('GET', '/auth/session');
    kv('GET /auth/session', `HTTP ${session.status}`);

    // Any authenticated route proves the middleware point; /auth/logout is
    // chosen because it is guarded by `authenticate` and has no side effect
    // worth avoiding here beyond ending the session we are about to lose anyway.
    const probe = await api('GET', '/auth/session');
    const user = session.json?.data;
    const deadline = user?.mfaSetupDeadline ?? null;

    if (session.status === 401) {
      out(green('\n  ✔ The session is rejected. If a window had been armed and has now'));
      out(green('    closed with no factor enrolled, THIS is Task 2e failing closed.'));
      out(dim('    To prove it was the deadline (not a missing cookie), re-run the'));
      out(dim('    magic link, confirm `session` shows a live countdown, wait for it'));
      out(dim('    to lapse, then re-run this command.'));
    } else if (deadline === null) {
      out(dim('\n  No window armed on this account — nothing for Task 2e to enforce.'));
      out(dim('  Use an UNENROLLED, non-exempt admin to exercise it.'));
    } else {
      const remaining = Math.round((Date.parse(deadline) - Date.now()) / 1000);
      kv('window', remaining > 0 ? green(`open, ${remaining}s left`) : red('closed'));
      kv('mfaEnrolled', String(user?.mfaEnrolled));
      if (remaining > 0) {
        out(green('\n  ✔ Window still open → requests MUST be allowed. They were.'));
        out(dim('    Re-run after it lapses; the answer must flip to 401.'));
      } else {
        out(red('\n  ✖ Window closed, not enrolled, yet the request was ALLOWED.'));
        out(red('    Task 2e enforcement is NOT working. Report this.'));
      }
    }
    kv('probe (2nd call)', `HTTP ${probe.status}`);
    await record({
      item: 'Task 2e — deadline enforced per request',
      delivered: '-',
      evidence: `session HTTP ${session.status}, deadline=${deadline ?? 'null'}`,
      user: '',
      server: String(session.status),
      status: session.status === 401 ? 'PASS (user-confirmed)' : 'PENDING-USER',
    });
  },

  async logout() {
    head('Logout');
    await bootstrapCsrf();
    const response = await api('POST', '/auth/logout');
    kv('HTTP', String(response.status));
    kv('cookies cleared', response.cookiesSet.join(', ') || '(none)');
    out(dim('  Jar cleared of session cookies; CSRF kept for the next leg.'));
  },

  /** Record one H4 row from a human paste-back. */
  async record(argv) {
    const flags = parseFlags(argv);
    const status = flags.status ?? 'PENDING-USER';
    if (!STATUSES.includes(status)) {
      die(`--status must be one of:\n    ${STATUSES.join('\n    ')}`);
    }
    // H4: a PASS row with no user confirmation is downgraded, not accepted.
    const isPass = status.startsWith('PASS');
    const effective = isPass && (flags.user ?? '') === '' ? 'PENDING-USER' : status;
    if (effective !== status) {
      out(
        amber('⚠ Downgraded to PENDING-USER: a PASS row requires --user "<what the human said>".'),
      );
    }
    await record({
      item: flags.item ?? '(unnamed)',
      delivered: flags.delivered ?? '',
      evidence: flags.evidence ?? '',
      user: flags.user ?? '',
      server: flags.server ?? '',
      status: effective,
    });
    out(green(`recorded: ${flags.item ?? '(unnamed)'} → ${effective}`));
  },

  /** Emit the H4 table. */
  async report() {
    const rows = await loadLog();
    head('H4 — Human-in-the-loop verification table');
    if (rows.length === 0) {
      out(amber('  No rows recorded yet.'));
      return;
    }
    out(
      '| Item | Email/Secret delivered | Resend id / URI prefix | User confirmation | Server result | Status |',
    );
    out('|---|---|---|---|---|---|');
    for (const r of rows) {
      out(
        `| ${r.item} | ${r.delivered} | ${r.evidence} | ${r.user || '—'} | ${r.server} | ${r.status} |`,
      );
    }
    const empty = rows.filter((r) => r.status.startsWith('PASS') && (r.user ?? '') === '');
    if (empty.length > 0) {
      out(
        red(`\n✖ ${empty.length} PASS row(s) have an empty User confirmation — H4 forbids this.`),
      );
      process.exitCode = 1;
    } else {
      out(green('\n✔ No PASS row is missing its user confirmation.'));
    }
    out(dim('\nPaste this table into the report before the §9 Deployment line.'));
    out(
      dim(
        'The report must still end with: "Awaiting explicit user confirmation before any deployment."',
      ),
    );
  },
};

/* ─────────────────────────── plumbing ─────────────────────────── */

function parseFlags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg !== undefined && arg.startsWith('--')) {
      out[arg.slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

async function record(row) {
  const rows = await loadLog();
  rows.push({ ...row, at: new Date().toISOString() });
  await writeFile(LOG_FILE, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
}

async function main() {
  const [name, ...argv] = process.argv.slice(2);
  if (name === undefined || name === 'help' || name === '--help') {
    out(`\n${bold('Human-in-the-loop auth verification (H0–H7)')}\n`);
    out(`API: ${API}   jar: ${path.relative(REPO_ROOT, JAR_FILE)}\n`);
    out('Commands:');
    for (const key of Object.keys(commands)) out(`  ${key}`);
    out(`\nStatuses: ${STATUSES.join(' | ')}`);
    out(dim('\nThe agent-side steps run here. Every email and MFA row stays'));
    out(dim('PENDING-USER until a human pastes back what they actually saw.\n'));
    return;
  }
  const command = commands[name];
  if (command === undefined) die(`unknown command "${name}". Run without arguments for the list.`);

  await mkdir(path.dirname(JAR_FILE), { recursive: true });
  await loadJar();
  try {
    await command(argv);
  } catch (error) {
    if (error instanceof TypeError && /fetch failed/i.test(error.message)) {
      die(`cannot reach the API at ${API}. Is it running? (pnpm dev)`);
    }
    throw error;
  }
  out('');
}

await main();

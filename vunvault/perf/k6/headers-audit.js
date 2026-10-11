// The header and method audit (Task 108), runnable against the DEPLOYED
// estate — source-level checks live in the unit suites; this proves what the
// edge + ingress + app actually put on the wire together.
//
//   k6 run -e API_URL=https://api.<zone> -e WEB_URL=https://www.<zone> \
//     perf/k6/headers-audit.js
import http from 'k6/http';
import { check } from 'k6';

const API_URL = __ENV.API_URL;
const WEB_URL = __ENV.WEB_URL;
if (!API_URL || !WEB_URL) {
  throw new Error('API_URL and WEB_URL are required');
}

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: { checks: ['rate==1.0'] }, // an audit either passes or it does not
};

export default function () {
  // --- the web origin: full security header set + nonce'd CSP on HTML
  const home = http.get(`${WEB_URL}/`);
  check(home, {
    'web 200': (r) => r.status === 200,
    'web HSTS 2y + preload': (r) => {
      const hsts = r.headers['Strict-Transport-Security'] || '';
      return hsts.includes('max-age=63072000') && hsts.includes('preload');
    },
    'web nosniff': (r) => r.headers['X-Content-Type-Options'] === 'nosniff',
    'web frame DENY': (r) => r.headers['X-Frame-Options'] === 'DENY',
    'web referrer-policy': (r) => r.headers['Referrer-Policy'] !== undefined,
    'web permissions-policy': (r) => r.headers['Permissions-Policy'] !== undefined,
    'web CSP carries a nonce': (r) =>
      (r.headers['Content-Security-Policy'] || '').includes('nonce-'),
    'web no server leak': (r) => r.headers['Server'] === undefined,
  });

  // --- the API origin: the same transport headers…
  const api = http.get(`${API_URL}/healthz`);
  check(api, {
    'api HSTS': (r) => (r.headers['Strict-Transport-Security'] || '').includes('max-age='),
    'api nosniff': (r) => r.headers['X-Content-Type-Options'] === 'nosniff',
  });

  // …and a 405 for methods the platform does not speak.
  const trace = http.request('TRACE', `${API_URL}/api/v1/auth/csrf`);
  check(trace, {
    'TRACE refused': (r) => r.status === 405 || r.status === 501 || r.status === 404,
  });

  // The docs explorer is dead at the edge.
  const docs = http.get(`${API_URL}/docs`, { redirects: 0 });
  check(docs, { 'docs 404': (r) => r.status === 404 });
}

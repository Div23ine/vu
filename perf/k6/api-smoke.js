// API smoke profile (Task 108): 1 VU, 2 minutes, the endpoints every deploy
// must answer. This is smoke.mjs's sibling under load-shape-1 — it asserts
// the same properties while k6 measures the latency of proving them.
//
//   k6 run -e API_URL=https://api.<zone> perf/k6/api-smoke.js
import http from 'k6/http';
import { check } from 'k6';

const API_URL = __ENV.API_URL;
if (!API_URL) throw new Error('API_URL is required: k6 run -e API_URL=… api-smoke.js');

export const options = {
  vus: 1,
  duration: '2m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<400'],
  },
};

export default function () {
  const health = http.get(`${API_URL}/healthz`);
  check(health, { 'healthz 200': (r) => r.status === 200 });

  const ready = http.get(`${API_URL}/readyz`);
  check(ready, { 'readyz 200': (r) => r.status === 200 });

  const csrf = http.get(`${API_URL}/api/v1/auth/csrf`);
  check(csrf, {
    'csrf 200': (r) => r.status === 200,
    'csrf sets vv_csrf': (r) =>
      (r.headers['Set-Cookie'] || []).some((c) => c.startsWith('vv_csrf=')),
    'HSTS present': (r) => (r.headers['Strict-Transport-Security'] || '').includes('max-age='),
    'nosniff present': (r) => r.headers['X-Content-Type-Options'] === 'nosniff',
    'no server leak': (r) => r.headers['Server'] === undefined,
  });
}

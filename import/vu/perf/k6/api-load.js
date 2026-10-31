// Load profile (Task 108): the read-heavy shape of a working day — dashboards,
// queue lists, advisory feeds — ramped to 50 VUs and back down. Thresholds are
// the SLO conversation starters, not laws: p(95) < 800 ms, errors < 1%.
//
//   k6 run -e API_URL=https://api.<zone> perf/k6/api-load.js
//
// Reads only: no profile in this directory writes production data. The login
// in setup() uses the k6 load-test account provisioned per environment
// (LOADTEST_EMAIL / LOADTEST_PASSWORD env vars); without it the profile runs
// unauthenticated reads and the authed checks simply skip.
import http from 'k6/http';
import { check } from 'k6';

const API_URL = __ENV.API_URL;
if (!API_URL) throw new Error('API_URL is required');

export const options = {
  stages: [
    { duration: '2m', target: 20 },
    { duration: '5m', target: 50 },
    { duration: '2m', target: 50 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.01'],
  },
};

export function setup() {
  const email = __ENV.LOADTEST_EMAIL;
  const password = __ENV.LOADTEST_PASSWORD;
  if (!email || !password) return { cookie: null };
  const csrfRes = http.get(`${API_URL}/api/v1/auth/csrf`);
  const csrfCookie = (csrfRes.headers['Set-Cookie'] || []).find((c) => c.startsWith('vv_csrf='));
  const token = csrfCookie ? csrfCookie.split(';')[0].split('=')[1] : '';
  const login = http.post(`${API_URL}/api/v1/auth/login`, JSON.stringify({ email, password }), {
    headers: { 'content-type': 'application/json', 'x-csrf-token': token, cookie: csrfCookie },
  });
  if (login.status !== 200) return { cookie: null };
  return { cookie: (login.headers['Set-Cookie'] || []).join('; ') || null };
}

export default function (data) {
  const params = data && data.cookie ? { headers: { cookie: data.cookie } } : {};
  const publicReads = [
    `${API_URL}/healthz`,
    `${API_URL}/api/v1/content/blog?page=1&pageSize=10`,
    `${API_URL}/api/v1/advisories`,
  ];
  for (const url of publicReads) {
    const res = http.get(url, params);
    check(res, { 'public read ok': (r) => r.status < 500 });
  }
  if (data && data.cookie) {
    const authed = http.get(`${API_URL}/api/v1/auth/session`, params);
    check(authed, { 'session ok': (r) => r.status === 200 });
  }
}

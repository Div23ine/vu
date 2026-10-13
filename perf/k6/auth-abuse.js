// Abuse profile (Task 108): the credential-stuffing shape the rate limits
// exist for. ONE ip, 30 login attempts in a minute — far past the API's
// 20/min login policy and the edge's matching rule. The assertion is not
// "all requests are 429"; it is that the limits ENGAGE, that they engage
// with a Retry-After, and that nothing answers 500 under abuse.
//
//   k6 run -e API_URL=https://api.<zone> perf/k6/auth-abuse.js
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const API_URL = __ENV.API_URL;
if (!API_URL) throw new Error('API_URL is required');

const limited = new Counter('rate_limited_responses');
const serverErrors = new Counter('server_errors_under_abuse');

export const options = {
  vus: 1,
  iterations: 30,
  rps: 1, // ~30 attempts spread over 30 s — inside one 1-minute window
  thresholds: {
    rate_limited_responses: ['count>=5'], // the limit must engage well before 30
    server_errors_under_abuse: ['count==0'], // and nothing may break doing it
    http_req_duration: ['p(95)<1000'],
  },
};

export function setup() {
  const res = http.get(`${API_URL}/api/v1/auth/csrf`);
  const csrfCookie = (res.headers['Set-Cookie'] || []).find((c) => c.startsWith('vv_csrf='));
  return {
    csrfCookie: csrfCookie ?? null,
    token: csrfCookie ? csrfCookie.split(';')[0].split('=')[1] : '',
  };
}

export default function (data) {
  const res = http.post(
    `${API_URL}/api/v1/auth/login`,
    JSON.stringify({ email: 'attacker@example.test', password: 'guess(guess1!' }),
    {
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': data.token,
        ...(data.csrfCookie ? { cookie: data.csrfCookie } : {}),
      },
    },
  );
  if (res.status === 429) {
    limited.add(1);
    check(res, { '429 carries Retry-After': (r) => r.headers['Retry-After'] !== undefined });
  }
  if (res.status >= 500) serverErrors.add(1);
  check(res, {
    'abuse is answered 401/429, never 200': (r) =>
      r.status === 401 || r.status === 429 || r.status === 403,
  });
}

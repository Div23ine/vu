# `perf/` — load and abuse profiles (Task 108)

k6 profiles that run against a DEPLOYED estate (staging first, always).
Nothing here writes production data: the load profile reads, the abuse
profile only fails logins for a non-existent account.

```sh
k6 run -e API_URL=https://api.<zone> perf/k6/api-smoke.js
k6 run -e API_URL=https://api.<zone> -e WEB_URL=https://www.<zone> perf/k6/headers-audit.js
k6 run -e API_URL=https://api.<zone> -e LOADTEST_EMAIL=… -e LOADTEST_PASSWORD=… perf/k6/api-load.js
k6 run -e API_URL=https://api.<zone> perf/k6/auth-abuse.js
```

| Profile            | Shape                              | Thresholds (fail the run)                           |
| ------------------ | ---------------------------------- | --------------------------------------------------- |
| `api-smoke.js`     | 1 VU × 2 min on health/readyz/csrf | errors < 1%, p95 < 400 ms                           |
| `headers-audit.js` | one iteration, `checks == 100%`    | every header/method check is a hard pass/fail       |
| `api-load.js`      | 0→20→50→0 VUs over 10 min          | p95 < 800 ms, errors < 1%                           |
| `auth-abuse.js`    | 30 logins in ~30 s, one IP         | ≥ 5 rate-limited (429) with `Retry-After`, ZERO 5xx |

Results: locally, `--out json=results.json`; at go-live, `--out
experimental-cloud` to Grafana Cloud k6 (the `CF_ANALYTICS_TOKEN`-style
credentials live in the CI environment, never here).

**Where the other audits live:** the source-level header assertions are in
`apps/api/src/plugins/security.test.ts` and `apps/web`'s next.config tests;
the route-level rate-limit policy audit is the API conformance suite
(`RATE_LIMITED_ROUTES`); the post-deploy property smoke is
`scripts/deploy/smoke.mjs`. These profiles are the runtime half of the same
ledger.

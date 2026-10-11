# `@vunvault/edge` — vv-edge (Task 99)

The Cloudflare Worker on `api.<zone>`: allow-list routing (`/api/v1/…`,
`/healthz`, `/readyz`, `/openapi.json` — `/docs` is dead at the edge), 405/413
gates, header hygiene (client-sent `x-origin-verify` / `x-forwarded-*` /
`x-real-ip` are stripped; the edge stamps its own secret + request id),
untouched WebSocket/SSE pass-through, and one Analytics Engine data point per
request (`vv_requests`: index1 `api`, blob1 route template, blob2 method,
double1 latency ms, double2 status — the maintenance worker's rollup reads
exactly these slots).

## Deploy

```sh
pnpm --filter @vunvault/edge deploy:staging     # wrangler deploy --env staging
wrangler secret put EDGE_ORIGIN_SECRET --env staging   # value from OCI Vault
```

`EDGE_ORIGIN_SECRET` is the shared secret with the API's origin-verify
plugin; it is NEVER in `wrangler.jsonc` or this repo. `ORIGIN_HOST` is the
DNS-only `origin.<zone>` record (grey-clouded on purpose — proxying it would
loop requests back into this Worker). Routes and vars per environment live in
`wrangler.jsonc`; the Terraform stack (Task 99) owns the zone side.

## Tests

`pnpm --filter @vunvault/edge test` — pure Vitest with a fake upstream
`fetch`, a fake Analytics Engine sink and a collecting `waitUntil`; no
network, no wrangler runtime.

# VUNVAULT

pnpm + Turborepo monorepo for the VUNVAULT security operations platform.

## Workspace map

- `apps/web` — `web` — VUNVAULT marketing, authentication, client portal and admin frontend; deployed independently as its own Cloudflare Worker
- `apps/uamp-web` — `uamp-web` — standalone UAMP HQ Next.js frontend, with its own `.next` / `.open-next` build output, Wrangler Worker and manual staging/production deployment workflow; deployed at `uamp.vunvault.com`
- `apps/api` — `api` — Fastify 5 API (Drizzle + Supabase Postgres)
- `apps/edge` — `@vunvault/edge` — the Cloudflare Worker in front of the API (allow-list, origin lock, metrics)
- `apps/scan-worker` · `apps/broadcast-worker` · `apps/notify-worker` · `apps/maintenance-worker` — background workers
- `packages/ui` — `@vunvault/ui` — design tokens and React primitives
- `packages/lib` — `@vunvault/lib` — helpers, API client, query keys
- `packages/db` — `@vunvault/db` — Drizzle schema, enums, migration runner
- `packages/contracts` — `@vunvault/contracts` — Zod schemas, permissions, fixtures
- `packages/config` — `@vunvault/config` — shared TypeScript / ESLint / Prettier configs

## Commands

`pnpm install` · `pnpm dev` · `pnpm typecheck` · `pnpm lint` · `pnpm test` ·
`pnpm verify` (static policy gates) · `pnpm test:e2e` (Playwright)

Build and deploy the frontends independently:

- VUNVAULT: `pnpm --filter web cf:build`
- UAMP HQ: `pnpm --filter uamp-web cf:build`
- UAMP deployment is manually dispatched through `.github/workflows/deploy-uamp-web.yml`; production requires the protected GitHub Environment approval.

## Documentation map

| Path                                                                        | What lives there                                                   |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `docs/adr/`                                                                 | the six architecture decisions and what enforces each              |
| `docs/conformance-matrix.md`                                                | every gate: scripts, suites, CI jobs                               |
| `docs/ci.md` · `docs/deploy.md`                                             | pipelines, allowed actions, environments, secret NAMES             |
| `docs/env-reference.md` · `docs/vault-map.md`                               | every variable; every secret's consumer, rotation and blast radius |
| `docs/operator-runbook.md`                                                  | day-2: rotations, restores, bastion, scaling                       |
| `docs/go-live-checklist.md`                                                 | the human half — nothing pre-ticked                                |
| `infra/terraform/*/README.md` · `infra/helm/README.md` · `docker/README.md` | the stacks                                                         |
| `perf/README.md`                                                            | k6 load/abuse/header-audit profiles                                |

# VUNVAULT

pnpm + Turborepo monorepo for the VUNVAULT security operations platform.

## Workspace map

- `apps/web` — `web` — Next.js 15 surfaces (marketing, auth, portal, admin), Cloudflare Pages target
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
`pnpm verify` (nine static policy gates) · `pnpm test:e2e` (Playwright)

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

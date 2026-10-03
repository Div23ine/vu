# VUNVAULT

VUNVAULT monorepo root (pnpm workspaces + Turborepo).

## Workspace map

| Directory | Package | Purpose |
| --- | --- | --- |
| `apps/web` | `web` | Next.js frontend |
| `apps/api` | `api` | Fastify backend |
| `apps/scan-worker` | `scan-worker` | Scan worker |
| `apps/broadcast-worker` | `broadcast-worker` | Broadcast worker |
| `apps/maintenance-worker` | `maintenance-worker` | Maintenance worker |
| `packages/ui` | `@vunvault/ui` | UI primitives |
| `packages/lib` | `@vunvault/lib` | Shared library |
| `packages/db` | `@vunvault/db` | Database layer |
| `packages/contracts` | `@vunvault/contracts` | API contracts |

## Commands

- `pnpm install` — install dependencies
- `pnpm dev` — run all dev tasks via Turbo
- `pnpm typecheck` — typecheck all workspaces
- `pnpm lint` — lint all workspaces
- `pnpm test` — run tests in all workspaces

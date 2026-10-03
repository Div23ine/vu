# VUNVAULT

Monorepo for the VUNVAULT platform.

## Requirements

- Node.js >= 20 (see `.nvmrc`)
- pnpm 12 (enabled via Corepack: `corepack enable`)

## Getting started

```bash
pnpm install
pnpm typecheck   # turbo run typecheck across all workspaces
pnpm lint        # turbo run lint across all workspaces
pnpm test        # turbo run test across all workspaces
```

## Workspaces

- `apps/*` — runnable applications (`web`, `api`, workers).
- `packages/*` — internal libraries (`@vunvault/config`, `@vunvault/ui`, `@vunvault/lib`, `@vunvault/db`, `@vunvault/contracts`).

See `packages/config/README.md` for how workspaces extend the shared TypeScript, ESLint and Prettier configs.

# VUNVAULT

VUNVAULT monorepo root (pnpm workspaces + Turborepo).

## Workspace map

- `apps/*` — applications (web, api)
- `packages/*` — shared packages (config, contracts, ui, lib, db)

## Commands

```bash
pnpm install     # install dependencies
pnpm dev         # run all dev servers via turbo
pnpm typecheck   # typecheck every workspace
pnpm lint        # lint every workspace
pnpm test        # run tests
```

Node.js 22 is required (see `.nvmrc`). Copy `.env.example` to `.env` and fill values locally; never commit secrets.

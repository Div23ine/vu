# @vunvault/config

Shared TypeScript, ESLint and Prettier configs for every VUNVAULT workspace.

- **TypeScript:** in a workspace `tsconfig.json`, write
  `{ "extends": "@vunvault/config/tsconfig.react-lib.json" }` (React libs),
  `tsconfig.next.json` (apps/web) or `tsconfig.node.json` (apps/api, workers). All extend `tsconfig.base.json`.
- **ESLint:** in a workspace `eslint.config.mjs`, export a flat array built from
  `@vunvault/config/eslint.base.mjs` (generic), `eslint.next.mjs` (Next.js/React) or `eslint.node.mjs` (Node).
- **Prettier:** the repo-root `prettier.config.mjs` re-exports `@vunvault/config/prettier.config.mjs`;
  workspaces inherit it automatically — do not add per-workspace Prettier configs.

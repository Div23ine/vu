# @vunvault/config

Shared TypeScript, ESLint and Prettier configuration for every VUNVAULT workspace.

## TypeScript

`tsconfig.json` → `{ "extends": "@vunvault/config/tsconfig.<kind>.json", "include": ["src"] }`
where `<kind>` is `next` (`apps/web`), `react-lib` (`packages/ui`, `packages/lib`) or `node`
(`apps/api`, workers, `packages/db`, `packages/contracts`).

## ESLint

`eslint.config.mjs` → `export { default } from "@vunvault/config/eslint.<kind>.mjs";`
where `<kind>` is `next` for React workspaces and `node` for everything else.
Root-level files use `eslint.base.mjs`.

## Prettier

`prettier.config.mjs` → `export { default } from "@vunvault/config/prettier.config.mjs";`

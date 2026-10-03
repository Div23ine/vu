# @vunvault/config
Shared strict TypeScript, ESLint 9 flat-config and Prettier configs for every VUNVAULT workspace.
TypeScript — web: `extends: "@vunvault/config/tsconfig.next.json"`; UI lib: `.../tsconfig.react-lib.json`; Node: `.../tsconfig.node.json` (all chain to `tsconfig.base.json`).
ESLint — `apps/web/eslint.config.mjs`: `import config from "@vunvault/config/eslint.next.mjs"; export default config;`.
ESLint — API/workers/scripts: re-export `@vunvault/config/eslint.node.mjs`; other TS code uses `@vunvault/config/eslint.base.mjs`.
Prettier — root `prettier.config.mjs` re-exports `@vunvault/config/prettier.config.mjs`; workspaces need none (it is discovered upward).
The base config enforces the stack guardrails: importing `express`, `@prisma/client`, `prisma`, `joi` or `@hapi/joi` is an error (Fastify 5 + Drizzle + Zod only), as are the globals `localStorage` and `sessionStorage` (HttpOnly cookie sessions only).
Exports map: four tsconfigs, three ESLint flat configs, one Prettier config — import by subpath only, never by relative path.
Changed here? Run `pnpm --filter @vunvault/config lint typecheck` plus each dependent workspace's `typecheck` before committing.

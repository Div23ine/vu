# @vunvault/config

Shared TypeScript, ESLint and Prettier configs for the VUNVAULT monorepo.

- TypeScript: in a workspace `tsconfig.json`, set `"extends": "@vunvault/config/tsconfig.<kind>.json"` where `<kind>` is `base`, `react-lib`, `next`, or `node`.
- ESLint: in a workspace `eslint.config.mjs`, `export { default } from '@vunvault/config/eslint.<kind>.mjs';` with `<kind>` = `base`, `next`, or `node`.
- Prettier: in a config file, `export { default } from '@vunvault/config/prettier.config.mjs';`.
- `tsconfig.react-lib.json` targets React component libraries (`jsx: react-jsx`); `tsconfig.next.json` targets the Next.js app; `tsconfig.node.json` targets servers and workers.
- The base TS config is strict everywhere: `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `noUnusedLocals/Parameters`, `noEmit`.
- The base config restricts imports of non-stack packages and web-storage globals via ESLint rules.

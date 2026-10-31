# VUNVAULT — Task Catalogue for coder.qwen.ai

## Part 1 of 5 — Layers L0, L1, L2 (Tasks 1–20)

## Sequence Overview

| # | Layer | Task title | Depends on | Files touched |
|---|---|---|---|---|
| 1 | L0 | Monorepo root (pnpm + Turborepo) | None | 10 |
| 2 | L0 | Shared TypeScript, ESLint and Prettier configs | Task 1 | 12 |
| 3 | L0 | Workspace package scaffolds (9 workspaces) | Task 1, Task 2 | 36 |
| 4 | L0 | Test harness, git hooks, and stack-guard scripts | Task 1, Task 2, Task 3 | 16 |
| 5 | L1 | Design tokens, Tailwind v4 theme, base and motion stylesheets | Task 3, Task 4 | 9 |
| 6 | L1 | Shared lib core: cn, date/ID/money formatters | Task 3, Task 4 | 9 |
| 7 | L1 | Shared lib: API client, error model, query keys, QueryClient factory | Task 6 | 7 |
| 8 | L1 | UI primitives: Button, Badge, StatusPill, Spinner | Task 5, Task 6 | 8 |
| 9 | L1 | UI primitives: Card family, KpiCard, Eyebrow, ProgressBar, Skeleton, EmptyState | Task 5, Task 6, Task 8 | 9 |
| 10 | L1 | UI primitives: form controls and React Hook Form wiring | Task 5, Task 6, Task 8 | 12 |
| 11 | L1 | UI primitives: Dialog, Toast system, Tooltip | Task 5, Task 6, Task 8 | 9 |
| 12 | L1 | UI primitive: DataTable (TanStack Table v8 headless) and Pagination | Task 5, Task 6, Task 8, Task 9, Task 10 | 7 |
| 13 | L1 | Brand components: Logo lockup and Preloader | Task 5, Task 6, Task 8 | 6 |
| 14 | L2 | Database foundation: Drizzle config, Supavisor client, enums, column helpers, SQL migration runner | Task 3, Task 4 | 12 |
| 15 | L2 | Schema: identity, organisations, invitations, WebAuthn, consent | Task 14 | 3 |
| 16 | L2 | Schema: scan jobs, runs, findings, review gate, pen-test requests | Task 14, Task 15 | 3 |
| 17 | L2 | Schema: double-entry billing ledger, invoices (derived), FX quotes, USD-only payments | Task 14, Task 15, Task 16 | 4 |
| 18 | L2 | Schema: content moderation, contact, broadcasts, append-only audit hash chain | Task 14, Task 15 | 4 |
| 19 | L2 | Contracts A: common envelopes, auth, roles & permissions, users, scans, pen-test requests (+ fixtures) | Task 6, Task 14 | 14 |
| 20 | L2 | Contracts B: billing & FX, content moderation, audit, contact, consent (+ fixtures) | Task 6, Task 14, Task 19 | 11 |

**Reserved numbering for the remaining parts (102 tasks total):**

| Reserved | Layer | Scope | Part |
|---|---|---|---|
| 21–25 | L3 | Backend foundation (Fastify bootstrap, plugins, audit chain, crypto) | 2 |
| 26–40 | L4 | Backend domain modules (one task per route group) | 2 |
| 41–46 | L5 | Frontend foundation (Next.js skeleton, providers, shared layouts) | 3 |
| 47–54 | L6 | Frontend marketing surface | 3 |
| 55–59 | L7 | Frontend auth surface | 3 |
| 60–67 | L8 | Frontend client portal | 4 |
| 68–75 | L9 | Frontend admin surface | 4 |
| 76–80 | L10 | Scan worker | 4 |
| 81–84 | L11 | Background workers | 5 |
| 85–88 | L12 | Real-time wiring | 5 |
| 89–96 | L13 | DevOps | 5 |
| 97–102 | L14 | Integration, E2E, hardening | 5 |

> **Operator pre-step (one-time, not a coder.qwen.ai task):** the logo is a binary asset the coder cannot see. Before Task 41, copy `logo.svg` to `apps/web/public/brand/logo.svg`. Tasks 13 and later reference it as `/brand/logo.svg` and never create it.

---

### TASK 1 — Monorepo root (pnpm + Turborepo)

**Layer:** L0

**Prerequisites:** None

**Estimated files touched:** 10

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Monorepo root (pnpm + Turborepo)**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Create the root of the pnpm + Turborepo monorepo: workspace file, root package.json, Turbo pipeline, Node pin, git/editor hygiene, and a names-only env template.

**Deliverables:**
- `package.json` — private root; `packageManager: "pnpm@9.15.0"`; `engines.node: ">=22 <23"`; scripts `dev`, `build`, `lint`, `typecheck`, `test`, `format`, `format:check` (all delegate to `turbo run <task>` except `format*` which call prettier).
- `pnpm-workspace.yaml` — `packages: ["apps/*", "packages/*"]` plus a `catalog:` block (see below).
- `turbo.json` — task graph (see below).
- `.nvmrc` — contents `22`.
- `.npmrc` — `auto-install-peers=true`, `strict-peer-dependencies=false`, `engine-strict=true`.
- `.gitignore` — node_modules, .next, .turbo, dist, coverage, .env, .env.*, !.env.example, *.log, .DS_Store, playwright-report, test-results, .terraform, *.tfstate*, *.tfvars.
- `.editorconfig` — utf-8, lf, 2-space indent, final newline, trim trailing whitespace.
- `.env.example` — NAMES ONLY with empty values (see list below). No real values, ever.
- `README.md` — 20-line stub: project name "VUNVAULT", the workspace map, and the commands `pnpm install`, `pnpm dev`, `pnpm typecheck`, `pnpm lint`, `pnpm test`.
- `docs/.gitkeep` — empty file so the docs folder exists.

**Dependencies allowed:**
- Root devDependencies only: `turbo`, `typescript`, `prettier`.
- Do NOT install any framework package (no next, react, fastify, drizzle) in this task.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

N/A — no UI.

**Workspace catalog (`pnpm-workspace.yaml` → `catalog:`)** — pin majors only; resolve to the latest stable within the major:
- `typescript: ~5.5.4`
- `zod: ^3.25.0`
- `react: ^19.0.0`, `react-dom: ^19.0.0`
- `next: ^15.0.0`
- `tailwindcss: ^4.0.0`
- `vitest: ^3.0.0`
- `eslint: ^9.0.0`
- `fastify: ^5.0.0`
- `drizzle-orm: latest`, `drizzle-kit: latest`

**`turbo.json` tasks:**
- `build`: `dependsOn: ["^build"]`, `outputs: [".next/**", "!.next/cache/**", "dist/**"]`.
- `dev`: `cache: false`, `persistent: true`.
- `lint`: `dependsOn: ["^lint"]`.
- `typecheck`: no `dependsOn` — internal packages are consumed as TypeScript source (just-in-time packages), so no build is needed before typechecking.
- `test`: `dependsOn: ["^build"]`, `outputs: ["coverage/**"]`.
- `globalEnv`: `["NODE_ENV"]`; `globalDependencies`: `[".env.example"]`.

**`.env.example` names (all values empty):**
```
# web (public)
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SENTRY_DSN=
# api
DATABASE_URL=            # Supavisor transaction pooler, port 6543
DIRECT_URL=              # direct connection, port 5432, migrations only
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
UPSTASH_REDIS_URL=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
PAYSTACK_SECRET_KEY=
RESEND_API_KEY=
AFRICASTALKING_API_KEY=
AFRICASTALKING_USERNAME=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
AUDIT_HMAC_KEY_ID=
AUDIT_HMAC_KEY=
SENTRY_DSN=
```
Add a first-line comment in the file: `# Names only. Production secrets are loaded from OCI Vault at runtime. Never commit values.`

---

**Data shape (TypeScript):**
N/A — no entities.

**API contract (as comments only — do NOT implement the backend):**
N/A — no API.

---

**Out of scope:**
- Do not create any workspace package (that is Task 3).
- Do not create tsconfig, ESLint, or Prettier config files (Task 2).
- Do not create Dockerfiles, CI workflows, or Terraform.
- Do not add any `.html` file anywhere.
- Do not touch files outside the Deliverables list.

---

**Definition of done:**
☐ `pnpm --filter vunvault typecheck` passes with zero errors.
☐ `pnpm --filter vunvault lint` passes with zero errors.
☐ `pnpm install` succeeds at the repo root and `pnpm exec turbo --version` prints a version.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 1 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 2 — Shared TypeScript, ESLint and Prettier configs

**Layer:** L0

**Prerequisites:** Task 1

**Estimated files touched:** 12

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Shared TypeScript, ESLint and Prettier configs**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Create the `@vunvault/config` workspace package that exports strict TypeScript base configs, ESLint 9 flat configs (base / next / node), and the Prettier config.

**Deliverables:**
- `packages/config/package.json` — name `@vunvault/config`, private, `type: "module"`, `exports` for every file below.
- `packages/config/tsconfig.base.json` — strict base (see below).
- `packages/config/tsconfig.react-lib.json` — extends base; `jsx: "react-jsx"`, `lib: ["ES2023","DOM","DOM.Iterable"]`.
- `packages/config/tsconfig.next.json` — extends base; `jsx: "preserve"`, `lib: ["ES2023","DOM","DOM.Iterable"]`, `plugins: [{"name":"next"}]`, `allowJs: false`, `incremental: true`.
- `packages/config/tsconfig.node.json` — extends base; `lib: ["ES2023"]`, `types: ["node"]`.
- `packages/config/eslint.base.mjs` — flat config array.
- `packages/config/eslint.next.mjs` — base + react, react-hooks, jsx-a11y, next.
- `packages/config/eslint.node.mjs` — base + node globals.
- `packages/config/prettier.config.mjs` — Prettier config.
- `packages/config/README.md` — 10 lines: how a workspace extends each config.
- `eslint.config.mjs` (repo root) — re-exports `@vunvault/config/eslint.base.mjs` for root-level files.
- `prettier.config.mjs` (repo root) — re-exports `@vunvault/config/prettier.config.mjs`.

**Dependencies allowed:**
- In `packages/config`: `typescript-eslint`, `eslint` (catalog), `@eslint/js`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `@next/eslint-plugin-next`, `eslint-config-prettier`, `globals`.
- Nothing else.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

N/A — no UI.

**`tsconfig.base.json` compilerOptions (exact):**
```
target: ES2023
module: ESNext
moduleResolution: Bundler
strict: true
noUncheckedIndexedAccess: true
noImplicitOverride: true
noFallthroughCasesInSwitch: true
noUnusedLocals: true
noUnusedParameters: true
verbatimModuleSyntax: true
isolatedModules: true
resolveJsonModule: true
skipLibCheck: true
forceConsistentCasingInFileNames: true
noEmit: true
```

**ESLint rules (base):**
- `@typescript-eslint/no-explicit-any: error`
- `@typescript-eslint/consistent-type-imports: error` (`prefer: type-imports`)
- `@typescript-eslint/no-unused-vars: error` (ignore args matching `^_`)
- `eqeqeq: error`
- `no-console: warn` (allow `warn`, `error`)
- `no-restricted-imports` with patterns: `express`, `express/*`, `@prisma/client`, `prisma`, `joi`, `@hapi/joi` — message: `"Forbidden by VUNVAULT stack: use Fastify 5 + Drizzle + Zod."`
- `no-restricted-globals`: `localStorage`, `sessionStorage` — message: `"Sessions live in HttpOnly cookies; do not use web storage."`
- Ignore: `**/node_modules/**`, `**/.next/**`, `**/dist/**`, `**/coverage/**`, `**/.turbo/**`.

**ESLint (next) additions:** `react-hooks/rules-of-hooks: error`, `react-hooks/exhaustive-deps: error`, jsx-a11y `recommended` set, `@next/next/recommended`.

**Prettier:** `semi: true`, `singleQuote: true`, `trailingComma: "all"`, `printWidth: 100`, `tabWidth: 2`, `arrowParens: "always"`.

---

**Data shape (TypeScript):**
N/A — no entities.

**API contract (as comments only — do NOT implement the backend):**
N/A — no API.

---

**Out of scope:**
- Do not create or edit any workspace other than `packages/config` and the two root re-export files.
- Do not add Tailwind, Next.js, or Fastify config.
- Do not add CI workflows.

---

**Definition of done:**
☐ `pnpm --filter @vunvault/config typecheck` passes with zero errors.
☐ `pnpm --filter @vunvault/config lint` passes with zero errors.
☐ `pnpm --filter @vunvault/config exec tsc -p tsconfig.base.json --showConfig` prints the resolved config with `strict` and `noUncheckedIndexedAccess` both `true`, and `pnpm exec eslint --print-config eslint.config.mjs` runs without error.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 2 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 3 — Workspace package scaffolds (9 workspaces)

**Layer:** L0

**Prerequisites:** Task 1, Task 2

**Estimated files touched:** 36

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Workspace package scaffolds (9 workspaces)**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Create empty, typecheck-clean scaffolds for all nine workspaces so that every later task has a package to land in.

**Deliverables:**
- For each of the 9 workspaces in the table below, create exactly four files: `<dir>/package.json`, `<dir>/tsconfig.json`, `<dir>/eslint.config.mjs`, `<dir>/src/index.ts`.
- `src/index.ts` content is exactly `export {};` in every workspace.
- Internal packages (`packages/*`) use `"main": "./src/index.ts"`, `"types": "./src/index.ts"`, and `"exports": { ".": "./src/index.ts" }` (just-in-time TypeScript packages, no build step).
- Every `package.json` has: `name` (from the table), `version: "0.0.0"`, `private: true`, `type: "module"`, and scripts `typecheck` (`tsc --noEmit`), `lint` (`eslint .`), `test` (`vitest run --passWithNoTests`). Apps get NO `dev` or `build` script yet.
- Every `tsconfig.json` extends the matching `@vunvault/config/tsconfig.<kind>.json` and sets `include: ["src"]`.
- Every `eslint.config.mjs` default-exports the matching `@vunvault/config/eslint.<kind>.mjs`.

**Dependencies allowed:**
- Each workspace: devDependencies `@vunvault/config` (`workspace:*`), `typescript` (catalog), `eslint` (catalog), `vitest` (catalog).
- Do NOT add runtime dependencies in this task.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

N/A — no UI.

**Workspace table:**

| Directory | `name` | tsconfig extends | ESLint config |
|---|---|---|---|
| `apps/web` | `web` | `tsconfig.next.json` | `eslint.next.mjs` |
| `apps/api` | `api` | `tsconfig.node.json` | `eslint.node.mjs` |
| `apps/scan-worker` | `scan-worker` | `tsconfig.node.json` | `eslint.node.mjs` |
| `apps/broadcast-worker` | `broadcast-worker` | `tsconfig.node.json` | `eslint.node.mjs` |
| `apps/maintenance-worker` | `maintenance-worker` | `tsconfig.node.json` | `eslint.node.mjs` |
| `packages/ui` | `@vunvault/ui` | `tsconfig.react-lib.json` | `eslint.next.mjs` |
| `packages/lib` | `@vunvault/lib` | `tsconfig.react-lib.json` | `eslint.next.mjs` |
| `packages/db` | `@vunvault/db` | `tsconfig.node.json` | `eslint.node.mjs` |
| `packages/contracts` | `@vunvault/contracts` | `tsconfig.node.json` | `eslint.node.mjs` |

(`apps/web` and `packages/ui`/`packages/lib` use `eslint.next.mjs` because they contain React; every other workspace uses `eslint.node.mjs`.)

**Cross-package dependencies to declare (all `workspace:*`):**
- `web` → `@vunvault/ui`, `@vunvault/lib`, `@vunvault/contracts`
- `api` → `@vunvault/db`, `@vunvault/contracts`
- `scan-worker`, `broadcast-worker`, `maintenance-worker` → `@vunvault/contracts`
- `@vunvault/ui` → `@vunvault/lib`
- `@vunvault/lib` → `@vunvault/contracts`
- `@vunvault/contracts` → `@vunvault/db` (only for the pure `enum-values` subpath added in a later task)

---

**Data shape (TypeScript):**
N/A — no entities.

**API contract (as comments only — do NOT implement the backend):**
N/A — no API.

---

**Out of scope:**
- Do not install Next.js, React, Fastify, Drizzle, Tailwind, or any runtime dependency.
- Do not create routes, components, or any file beyond the four per workspace.
- Do not edit root files from Task 1 or config files from Task 2.

---

**Definition of done:**
☐ `pnpm --filter vunvault typecheck` passes with zero errors.
☐ `pnpm --filter vunvault lint` passes with zero errors.
☐ `pnpm install && pnpm typecheck && pnpm lint && pnpm test` all exit 0 from the repo root, with Turbo reporting all 10 packages (9 here + `@vunvault/config`).
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 3 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 4 — Test harness, git hooks, and stack-guard scripts

**Layer:** L0

**Prerequisites:** Task 1, Task 2, Task 3

**Estimated files touched:** 16

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Test harness, git hooks, and stack-guard scripts**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Add the Vitest workspace config, Husky + lint-staged + commitlint, and two guard scripts that mechanically enforce the stack rules (no `.html` files; no forbidden dependencies or CI systems).

**Deliverables:**
- `vitest.shared.ts` — exports `nodeConfig` (environment `node`) and `domConfig` (environment `jsdom`, `setupFiles: ["./vitest.setup.dom.ts"]`).
- `vitest.setup.dom.ts` — imports `@testing-library/jest-dom/vitest`; runs `cleanup` after each test.
- `vitest.workspace.ts` — lists `apps/*` and `packages/*` vitest configs.
- `packages/ui/vitest.config.ts` and `packages/lib/vitest.config.ts` — merge `domConfig`.
- `packages/db/vitest.config.ts` and `packages/contracts/vitest.config.ts` — merge `nodeConfig`.
- `scripts/verify-no-html.mjs` — exits 1 and prints offending paths if any `*.html` / `*.htm` file exists in the repo outside `node_modules`, `.next`, `dist`, `coverage`, `.turbo`.
- `scripts/verify-forbidden-stack.mjs` — exits 1 if (a) any `package.json` lists `express`, `prisma`, `@prisma/client`, `joi`, `@hapi/joi` in any dependency block, or (b) any of `Jenkinsfile`, `.gitlab-ci.yml`, `.circleci/` exists at the repo root.
- `.husky/pre-commit` — runs `pnpm exec lint-staged`.
- `.husky/commit-msg` — runs `pnpm exec commitlint --edit "$1"`.
- `.lintstagedrc.json` — `*.{ts,tsx,mjs,json,md,css}` → `prettier --write`; `*.{ts,tsx}` → `eslint --fix`.
- `commitlint.config.mjs` — extends `@commitlint/config-conventional`.
- `.github/pull_request_template.md` — a checklist mirroring the Definition-of-done items (typecheck, lint, tests, no hard-coded design values, reduced-motion, a11y, no files outside scope).
- `packages/ui/src/smoke.test.ts`, `packages/lib/src/smoke.test.ts`, `packages/db/src/smoke.test.ts`, `packages/contracts/src/smoke.test.ts` — one trivial test each.

**Dependencies allowed:**
- Root devDependencies: `vitest` (catalog), `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `husky`, `lint-staged`, `@commitlint/cli`, `@commitlint/config-conventional`.
- Modify root `package.json` only to add: scripts `prepare: "husky"`, `verify: "node scripts/verify-no-html.mjs && node scripts/verify-forbidden-stack.mjs"`; and the devDependencies above.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

N/A — no UI.

**Script output format (both guard scripts):** on success print exactly `OK: <script-name>`; on failure print `FAIL: <script-name>` followed by one offending path or package per line, then exit code 1.

**PR template body (verbatim headings):**
```
## What this PR does
## Task number
## Definition of done
- [ ] typecheck passes
- [ ] lint passes
- [ ] tests pass
- [ ] no hard-coded hex / radius / easing values
- [ ] every animation has a reduced-motion fallback
- [ ] keyboard + focus + aria checked
- [ ] no files changed outside the task's Deliverables
```

---

**Data shape (TypeScript):**
N/A — no entities.

**API contract (as comments only — do NOT implement the backend):**
N/A — no API.

---

**Out of scope:**
- Do not create GitHub Actions workflows (Layer L13).
- Do not write real tests beyond a trivial smoke test proving each Vitest config loads (`expect(1).toBe(1)` in `src/smoke.test.ts` of each of the four packages — add these four files).
- Do not edit any workspace `src/index.ts`.

---

**Definition of done:**
☐ `pnpm --filter vunvault typecheck` passes with zero errors.
☐ `pnpm --filter vunvault lint` passes with zero errors.
☐ `pnpm test` and `pnpm verify` both exit 0 from the repo root.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ `pnpm verify` prints `OK: verify-no-html` and `OK: verify-forbidden-stack`.
☐ `pnpm test` runs the four smoke tests and passes.
☐ Report at the end: `Task 4 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 5 — Design tokens, Tailwind v4 theme, base and motion stylesheets

**Layer:** L1

**Prerequisites:** Task 3, Task 4

**Estimated files touched:** 9

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Design tokens, Tailwind v4 theme, base and motion stylesheets**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Create the single source of truth for VUNVAULT's design tokens in `packages/ui`: raw CSS variables, a Tailwind v4 `@theme inline` mapping, base styles, and all keyframes with a reduced-motion fallback.

**Deliverables:**
- `packages/ui/src/styles/tokens.css` — one `:root { … }` block containing every token from BOTH token lists above, verbatim, EXCEPT `--font-sans` and `--font-mono` (those live in `theme.css`).
- `packages/ui/src/styles/theme.css` — Tailwind v4 theme mapping (exact mapping below).
- `packages/ui/src/styles/base.css` — base styles (exact rules below).
- `packages/ui/src/styles/motion.css` — all keyframes, the reduced-motion block (exact below).
- `packages/ui/src/styles/index.css` — `@import "tailwindcss"; @import "./tokens.css"; @import "./theme.css"; @import "./base.css"; @import "./motion.css";` in that order.
- `packages/ui/src/tokens.ts` — `export const tokens` (typed `as const`) mirroring colours, radii and motion for non-CSS consumers (Recharts, canvas). This file is the ONLY TypeScript file allowed to contain hex literals.
- `packages/ui/src/tokens.test.ts` — reads `tokens.css` with `node:fs`, asserts every colour in `tokens.ts` appears in `tokens.css`, and asserts `index.css` import order.
- MODIFY `packages/ui/src/index.ts` — `export { tokens } from "./tokens";`.
- MODIFY `packages/ui/package.json` — add `"exports": { ".": "./src/index.ts", "./styles.css": "./src/styles/index.css" }` and `tailwindcss` as a `peerDependency`.

**Dependencies allowed:**
- `tailwindcss` (catalog) as peerDependency + devDependency in `packages/ui` only.
- Nothing else.

---

**Design tokens to use (verbatim):**
```css
--brand: #3B99FC;
--brand-strong: #1E7BE0;
--brand-soft: #6FB6FF;
--brand-tint: rgba(59,153,252,0.12);
--brand-line: rgba(59,153,252,0.28);
--brand-glow: rgba(59,153,252,0.45);
--dark: #0A0D12;
--dark-2: #10151D;
--dark-3: #161C26;
--black: #000000;
--paper: #fcfbf9;
--white: #ffffff;
--ink: #171717;
--ink-soft: #525252;
--ink-muted: #737373;
--ink-faint: #a3a3a3;
--line: #e5e5e5;
--line-soft: rgba(229,229,229,0.8);
--line-dark: #262626;
--critical: #f43f5e;
--high: #f59e0b;
--medium: #eab308;
--low: #3B99FC;
--ok: #10b981;
--r-sm: 10px; --r-md: 14px; --r-lg: 18px; --r-xl: 24px; --r-2xl: 28px; --r-full: 9999px;
--ease: cubic-bezier(0.4,0,0.2,1);
--ease-out: cubic-bezier(0,0,0.2,1);
--dur: 200ms;
```

**Additional semantic tokens (verbatim — Task 5 defines them; this task consumes them):**
```css
/* Semantic tokens promoted from literals used by prototype components */
--dark-deep: #070b11;          /* second stop of dark gradients */
--dark-abyss: #05070a;         /* modal backdrop base, dark button end stop */
--brand-bright: #44A7FC;       /* preloader wordmark + caption */
--ok-ink: #065f46;  --ok-bg: #ecfdf5;  --ok-line: #a7f3d0;
--warn-ink: #92400e; --warn-bg: #fffbeb; --warn-line: #fde68a;
--danger-ink: #9f1239; --danger-bg: #fff1f2; --danger-line: #fecdd3;
--pill-ok-ink: #0f766e;        /* status pill text */
--table-head: #f6f8fb;         /* table header background */
--slate-text: #e2e8f0;         /* text on dark toast */
--slate-muted: #93a2b5;        /* muted text / icon on dark panels */
--r-field: 12px; --r-toast: 13px; --r-kpi: 16px; --r-tile: 12px;
/* Font stacks — defined inside @theme (not :root) as --font-sans / --font-mono */
--font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
--font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
--sh-card: 0 18px 44px -38px rgba(10,13,18,0.55);
--sh-kpi: 0 12px 30px -26px rgba(10,13,18,0.5);
--sh-btn-brand: 0 14px 30px -16px var(--brand-glow), inset 0 1px 0 rgba(255,255,255,0.24);
--sh-ghost: 0 6px 18px -16px rgba(10,13,18,0.6);
--sh-toast: 0 22px 44px -24px rgba(0,0,0,0.85);
--sh-tile: 0 0 0 1px rgba(59,153,252,0.08), 0 6px 18px -10px var(--brand-glow);
--grad-brand: linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%);
--grad-dark: linear-gradient(160deg, var(--dark) 0%, var(--dark-deep) 100%);
--grad-tile: linear-gradient(145deg, var(--dark), var(--black));
```

**Design rules for this task:**
- Use Tailwind classes mapped to the tokens above (`bg-brand`, `text-ink-muted`, `rounded-2xl`, `duration-200`, `ease-vv`).
- **Never hard-code a hex value, radius, or easing string** outside the token files this task is explicitly told to create.
- Every animation must include a `@media (prefers-reduced-motion: reduce)` fallback that disables motion without breaking layout.
- Every dialog must have `role="dialog"`, `aria-modal="true"`, an `aria-labelledby`, a focus trap, and Escape-to-close.
- Every icon-only button must have an `aria-label`.
- Never use `localStorage` / `sessionStorage`. Session state lives in HttpOnly cookies set by the API.

---

**Visual specification (embedded copy + layout):**

N/A — no visual component. This task produces stylesheets.

**`theme.css` — exact content structure:**
```css
@theme inline {
  /* colours: every colour token → --color-<name>: var(--<name>); */
  --color-brand: var(--brand);  --color-brand-strong: var(--brand-strong);  --color-brand-soft: var(--brand-soft);
  --color-brand-tint: var(--brand-tint);  --color-brand-line: var(--brand-line);  --color-brand-glow: var(--brand-glow);
  --color-brand-bright: var(--brand-bright);
  --color-dark: var(--dark); --color-dark-2: var(--dark-2); --color-dark-3: var(--dark-3);
  --color-dark-deep: var(--dark-deep); --color-dark-abyss: var(--dark-abyss);
  --color-black: var(--black); --color-white: var(--white); --color-paper: var(--paper);
  --color-ink: var(--ink); --color-ink-soft: var(--ink-soft); --color-ink-muted: var(--ink-muted); --color-ink-faint: var(--ink-faint);
  --color-line: var(--line); --color-line-soft: var(--line-soft); --color-line-dark: var(--line-dark);
  --color-critical: var(--critical); --color-high: var(--high); --color-medium: var(--medium); --color-low: var(--low); --color-ok: var(--ok);
  --color-ok-ink: var(--ok-ink); --color-ok-bg: var(--ok-bg); --color-ok-line: var(--ok-line);
  --color-warn-ink: var(--warn-ink); --color-warn-bg: var(--warn-bg); --color-warn-line: var(--warn-line);
  --color-danger-ink: var(--danger-ink); --color-danger-bg: var(--danger-bg); --color-danger-line: var(--danger-line);
  --color-pill-ok-ink: var(--pill-ok-ink); --color-table-head: var(--table-head);
  --color-slate-text: var(--slate-text); --color-slate-muted: var(--slate-muted);
  /* radii */
  --radius-sm: var(--r-sm); --radius-md: var(--r-md); --radius-lg: var(--r-lg); --radius-xl: var(--r-xl);
  --radius-2xl: var(--r-2xl); --radius-full: var(--r-full);
  --radius-field: var(--r-field); --radius-toast: var(--r-toast); --radius-kpi: var(--r-kpi); --radius-tile: var(--r-tile);
  /* motion */
  --ease-vv: var(--ease); --ease-vv-out: var(--ease-out);
  --default-transition-duration: var(--dur);
  --default-transition-timing-function: var(--ease);
  /* shadows */
  --shadow-card: var(--sh-card); --shadow-kpi: var(--sh-kpi); --shadow-btn-brand: var(--sh-btn-brand);
  --shadow-ghost: var(--sh-ghost); --shadow-toast: var(--sh-toast); --shadow-tile: var(--sh-tile);
}
@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
@utility bg-grad-brand { background-image: var(--grad-brand); }
@utility bg-grad-dark  { background-image: var(--grad-dark); }
@utility bg-grad-tile  { background-image: var(--grad-tile); }
```
Also add to `theme.css`, inside `@theme inline`, the animation tokens listed in `motion.css` below (one `--animate-<name>` each).

**`base.css` — exact rules (use var() references, no literals):**
- `html`: `-webkit-text-size-adjust: 100%; tab-size: 4; scroll-behavior: smooth; font-family: var(--font-sans); line-height: 1.5;`
- `body`: `margin: 0; line-height: inherit; background-color: var(--paper); color: var(--ink); -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; overflow-x: hidden;`
- `body.nav-open { overflow: hidden; }`
- `::selection { background-color: var(--brand); color: var(--white); }`
- Scrollbar: `::-webkit-scrollbar { width: 10px; height: 10px; }`, `::-webkit-scrollbar-track { background: transparent; }`, `::-webkit-scrollbar-thumb { background: rgba(23,23,23,0.18); border-radius: var(--r-full); border: 3px solid transparent; background-clip: padding-box; }`, `::-webkit-scrollbar-thumb:hover { background: rgba(59,153,252,0.55); background-clip: padding-box; }`
- `:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }`

**`motion.css` — keyframes (exact):**
```css
@keyframes vv-grid-drift { from { background-position: 0 0, 0 0; } to { background-position: 0 64px, 64px 0; } }
@keyframes vv-mark-float { 0%,100% { transform: translateY(0) rotateX(0deg); } 50% { transform: translateY(-10px) rotateX(6deg); } }
@keyframes vv-ring-x { from { transform: rotateX(72deg) rotateZ(0deg); } to { transform: rotateX(72deg) rotateZ(360deg); } }
@keyframes vv-ring-y { from { transform: rotateY(74deg) rotateZ(0deg); } to { transform: rotateY(74deg) rotateZ(-360deg); } }
@keyframes vv-ring-z { from { transform: rotateX(18deg) rotateY(-24deg) rotateZ(0deg); } to { transform: rotateX(18deg) rotateY(-24deg) rotateZ(360deg); } }
@keyframes vv-halo { 0%,100% { opacity: 0.45; transform: scale(0.88); } 50% { opacity: 1; transform: scale(1.12); } }
@keyframes vv-logo-stroke {
  0%,100% { filter: drop-shadow(0 0 1px rgba(111,182,255,0.60)) drop-shadow(0 0 6px rgba(59,153,252,0.45)) drop-shadow(0 0 16px rgba(59,153,252,0.25)); transform: translateZ(40px) scale(1); }
  50% { filter: drop-shadow(0 0 2px rgba(190,226,255,1)) drop-shadow(0 0 12px rgba(59,153,252,0.95)) drop-shadow(0 0 34px rgba(59,153,252,0.60)); transform: translateZ(56px) scale(1.07); }
}
@keyframes vv-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes vv-progress { 0% { width: 0%; } 15% { width: 22%; } 35% { width: 44%; } 55% { width: 61%; } 75% { width: 79%; } 90% { width: 91%; } 100% { width: 100%; } }
@keyframes vv-shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
@keyframes vv-spin { to { transform: rotate(360deg); } }
@keyframes vv-ping { 75%,100% { transform: scale(2); opacity: 0; } }
@keyframes vv-pulse { 50% { opacity: 0.5; } }
@keyframes vv-bounce { 0%,100% { transform: translateY(-25%); animation-timing-function: cubic-bezier(0.8,0,1,1); } 50% { transform: translateY(0); animation-timing-function: cubic-bezier(0,0,0.2,1); } }
@keyframes vv-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes vv-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
@keyframes vv-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes vv-modal-pop { from { opacity: 0; transform: translateY(14px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes vv-toast-in { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes vv-toast-out { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(10px) scale(0.98); } }
```
**Animation theme tokens (`--animate-*`, put in `theme.css`):**
`--animate-vv-spin: vv-spin 1s linear infinite;` · `--animate-vv-ping: vv-ping 1s cubic-bezier(0,0,0.2,1) infinite;` · `--animate-vv-pulse: vv-pulse 2s cubic-bezier(0.4,0,0.6,1) infinite;` · `--animate-vv-bounce: vv-bounce 1s infinite;` · `--animate-vv-fade-in: vv-fade-in 0.6s ease-out both;` · `--animate-vv-float: vv-float 5s ease-in-out infinite;` · `--animate-vv-float-delayed: vv-float 5s ease-in-out 1.5s infinite;` · `--animate-vv-marquee: vv-marquee 30s linear infinite;` · `--animate-vv-fade-up: vv-fade-up 0.8s var(--ease) forwards;` · `--animate-vv-overlay-in: vv-fade-in 0.25s var(--ease-out) both;` · `--animate-vv-modal-pop: vv-modal-pop 0.3s var(--ease) both;` · `--animate-vv-toast-in: vv-toast-in 0.3s var(--ease) both;` · `--animate-vv-toast-out: vv-toast-out 0.28s var(--ease) both;`

**Reduced-motion block (end of `motion.css`):**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    animation-delay: 0ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**`tokens.ts` shape:**
```ts
export const tokens = {
  color: { brand: "#3B99FC", brandStrong: "#1E7BE0", brandSoft: "#6FB6FF", dark: "#0A0D12", paper: "#fcfbf9", ink: "#171717", inkSoft: "#525252", inkMuted: "#737373", inkFaint: "#a3a3a3", line: "#e5e5e5", critical: "#f43f5e", high: "#f59e0b", medium: "#eab308", low: "#3B99FC", ok: "#10b981" },
  radius: { sm: 10, md: 14, lg: 18, xl: 24, "2xl": 28, full: 9999 },
  motion: { ease: "cubic-bezier(0.4,0,0.2,1)", easeOut: "cubic-bezier(0,0,0.2,1)", durMs: 200 },
} as const;
```

---

**Data shape (TypeScript):**
N/A — no entities.

**API contract (as comments only — do NOT implement the backend):**
N/A — no API.

---

**Out of scope:**
- Do not create any React component.
- Do not create or edit `apps/web` (it does not import this CSS yet).
- Do not add dark-mode variants; the prototype is light-first with dark panels as components.
- Do not load the Inter web font here (the Next.js app loads it later); only declare the stack.
- Do not touch files outside the Deliverables list.

---

**Definition of done:**
☐ `pnpm --filter @vunvault/ui typecheck` passes with zero errors.
☐ `pnpm --filter @vunvault/ui lint` passes with zero errors.
☐ `pnpm --filter @vunvault/ui test` passes (the token-consistency test), and `index.css` imports resolve in order.
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 5 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 6 — Shared lib core: cn, date/ID/money formatters

**Layer:** L1

**Prerequisites:** Task 3, Task 4

**Estimated files touched:** 9

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Shared lib core: cn, date/ID/money formatters**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Create the pure, framework-free helper functions every screen reuses: class merging, UTC date formatting, human IDs, ETA formatting, and USD/display-currency money helpers.

**Deliverables:**
- `packages/lib/src/cn.ts` — `cn(...inputs: ClassValue[]): string` using `clsx` + `tailwind-merge`.
- `packages/lib/src/format.ts` — date/time/ETA formatters (spec below).
- `packages/lib/src/ids.ts` — human-readable ID builders and parsers (spec below).
- `packages/lib/src/money.ts` — USD cents helpers and display-only FX conversion (spec below).
- `packages/lib/src/format.test.ts`, `ids.test.ts`, `money.test.ts` — Vitest tests with the exact expectations listed below.
- `packages/lib/src/assert.ts` — `assertNever(x: never): never`.
- MODIFY `packages/lib/src/index.ts` — re-export everything from the files above.
- MODIFY `packages/lib/package.json` — add dependencies.

**Dependencies allowed:**
- `clsx`, `tailwind-merge` (runtime, `packages/lib` only).
- Nothing else.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

N/A — no UI.

**`format.ts` — all functions are pure, take a `Date`, and use UTC only:**
- `formatUtcClock(d)` → `"09:41:12 UTC"` (HH:MM:SS, zero-padded, suffix ` UTC`).
- `formatUtcStamp(d)` → `"2026-09-24 09:41:12 UTC"`.
- `formatDayMonth(d)` → `"24 Sep"` (day without padding, 3-letter English month).
- `formatQueueStamp(d)` → `"24 Sep · 06:12 UTC"` (note: middle dot with spaces).
- `formatLongDate(d)` → `"18 Aug 2026"`.
- `formatMonthYear(d)` → `"Mar 2024"`.
- `formatEta(seconds: number)` → minutes and zero-padded seconds: `252 → "4m 12s"`, `785 → "13m 05s"`, `107 → "1m 47s"`, `45 → "0m 45s"`.
- `formatRelativeActive(d: Date, now: Date)` → rules, evaluated in order: `< 2 min` → `"Now · HH:MM"` (UTC clock of `d`); `< 60 min` → `"N min ago"`; `< 24 h` → `"N h ago"` (floor); previous UTC calendar day → `"Yesterday · HH:MM"`; otherwise `"N days ago"` (floor of days).

**`ids.ts`:**
- `formatJobCode(n)` → `"JOB-4471"` (at least 4 digits, zero-padded); `parseJobCode(s)` → number | null.
- `formatInvoiceNumber(year, n)` → `"VV-INV-2026-0841"` (n padded to 4); `parseInvoiceNumber(s)` → `{ year, n } | null`.
- `formatPentestRef(n)` → `"VV-PT-000123"` (n padded to 6); `parsePentestRef(s)`.
- `formatClientCode(n)` → `"VV-CL-48210"` (n padded to 5); `parseClientCode(s)`.

**`money.ts` — rules:** USD is the ONLY settlement currency. Amounts are integer cents (`number`, safe up to 2^53). Local currency is DISPLAY-ONLY.
- `export type DisplayCurrency = "USD" | "KES" | "NGN" | "GHS" | "ZAR";`
- `formatUsd(cents: number): string` → `"$2,499.00"` (en-US, 2 decimals).
- `formatUsdWhole(cents: number): string` → `"$2,499"` (no decimals; used for subscription amount).
- `usdCentsToLocalMinor(usdCents: number, rate: string): number` — `rate` is a decimal string of local-major-units per 1 USD (e.g. `"129.50000000"`). Use BigInt arithmetic with 1e8 scale, round half up to local minor units (cents). NEVER use floating-point multiplication.
- `formatLocalDisplay(localMinor: number, currency: DisplayCurrency): string` — `Intl.NumberFormat("en-US", { style: "currency", currency })`. Add a JSDoc line: `Display only. Never use to charge. Cards are always charged in USD.`

**Test expectations (must be asserted verbatim):**
- `formatUsd(249900) === "$2,499.00"`, `formatUsd(89900) === "$899.00"`, `formatUsdWhole(249900) === "$2,499"`.
- `usdCentsToLocalMinor(249900, "129.50000000") === 32362050` (that is 323,620.50 in major units).
- `formatQueueStamp(new Date("2026-09-24T06:12:00Z")) === "24 Sep · 06:12 UTC"`.
- `formatLongDate(new Date("2026-08-18T09:14:00Z")) === "18 Aug 2026"`.
- `formatInvoiceNumber(2026, 841) === "VV-INV-2026-0841"`; `formatJobCode(4471) === "JOB-4471"`; `formatPentestRef(0) === "VV-PT-000000"`; `formatClientCode(48210) === "VV-CL-48210"`.
- `parseJobCode("JOB-4471") === 4471`, `parseJobCode("nope") === null`.

---

**Data shape (TypeScript):**
```ts
type DisplayCurrency = "USD" | "KES" | "NGN" | "GHS" | "ZAR";
type UsdCents = number; // integer
type LocalMinor = number; // integer, display-only
```

**API contract (as comments only — do NOT implement the backend):**
N/A — no API.

---

**Out of scope:**
- Do not add React, hooks, or any DOM code to `@vunvault/lib`.
- Do not implement fetch/API helpers (Task 7).
- Do not implement FX quote fetching or locking — only the display conversion helper above.
- Do not touch files outside the Deliverables list.

---

**Definition of done:**
☐ `pnpm --filter @vunvault/lib typecheck` passes with zero errors.
☐ `pnpm --filter @vunvault/lib lint` passes with zero errors.
☐ `pnpm --filter @vunvault/lib test` passes with every exported function covered by at least one test.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 6 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 7 — Shared lib: API client, error model, query keys, QueryClient factory

**Layer:** L1

**Prerequisites:** Task 6

**Estimated files touched:** 7

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Shared lib: API client, error model, query keys, QueryClient factory**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Create the typed fetch client (cookie-credentialed, CSRF-aware), the `ApiError` model, the canonical TanStack Query key factory, and the QueryClient factory with sane defaults.

**Deliverables:**
- `packages/lib/src/api/errors.ts` — `ApiError` class and `isApiError` guard.
- `packages/lib/src/api/client.ts` — `apiFetch<T>()`, `apiGet`, `apiPost`, `apiPut`, `apiPatch`, `apiDelete`, and `configureApi({ baseUrl, onUnauthorized })`.
- `packages/lib/src/api/query-keys.ts` — `queryKeys` factory (below).
- `packages/lib/src/api/query-client.ts` — `createQueryClient()`.
- `packages/lib/src/api/client.test.ts` — Vitest tests with `vi.stubGlobal('fetch', …)`.
- MODIFY `packages/lib/src/index.ts` — re-export the four modules.
- MODIFY `packages/lib/package.json` — add dependency.

**Dependencies allowed:**
- `@tanstack/react-query` (v5) in `packages/lib`.
- Nothing else.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

N/A — no UI.

**Behaviour of `apiFetch<T>(path, init?)`:**
1. URL = `baseUrl + path`; `baseUrl` is set once via `configureApi` (the web app passes `process.env.NEXT_PUBLIC_API_URL`).
2. Always `credentials: "include"`. Never read or write `localStorage` / `sessionStorage`. Never attach an `Authorization` header — the session is an HttpOnly cookie.
3. Default headers: `Accept: application/json`; add `Content-Type: application/json` when `init.body` is a plain object (serialise with `JSON.stringify`).
4. CSRF (double-submit): for methods other than GET/HEAD/OPTIONS, read the NON-HttpOnly cookie named `vv_csrf` from `document.cookie` (skip if `document` is undefined) and send it as header `x-csrf-token`.
5. Parse JSON on 2xx. On 204 return `undefined as T`.
6. On non-2xx, parse the error envelope `{ error: string; message?: string; details?: unknown[] }` and throw `ApiError(status, error, message, details, requestId)` where `requestId` comes from response header `x-request-id`.
7. On 401, call `onUnauthorized()` (if configured) before throwing.
8. Support `AbortSignal` via `init.signal`.

**`ApiError` fields:** `status: number`, `code: string` (the `error` string, e.g. `"unauthorized"`, `"validation_failed"`, `"forbidden"`, `"not_found"`, `"rate_limited"`), `message: string`, `details?: unknown[]`, `requestId?: string`.

**`queryKeys` (exact shape — later tasks depend on it):**
```ts
export const queryKeys = {
  session: () => ["session"] as const,
  profile: () => ["profile"] as const,
  users: {
    all: () => ["users"] as const,
    list: (f: object) => ["users", "list", f] as const,
    invitations: () => ["users", "invitations"] as const,
  },
  scans: {
    all: () => ["scans"] as const,
    list: (f: object) => ["scans", "list", f] as const,
    detail: (id: string) => ["scans", "detail", id] as const,
    adminQueue: (f: object) => ["scans", "admin-queue", f] as const,
    summary: () => ["scans", "summary"] as const,
  },
  billing: {
    subscription: () => ["billing", "subscription"] as const,
    invoices: (f: object) => ["billing", "invoices", f] as const,
    paymentMethod: () => ["billing", "payment-method"] as const,
    fxQuote: (invoiceId: string, currency: string) => ["billing", "fx-quote", invoiceId, currency] as const,
  },
  content: {
    all: () => ["content"] as const,
    moderation: (f: object) => ["content", "moderation", f] as const,
    published: (f: object) => ["content", "published", f] as const,
  },
  audit: {
    all: () => ["audit"] as const,
    list: (f: object) => ["audit", "list", f] as const,
    chain: () => ["audit", "chain"] as const,
  },
} as const;
```

**`createQueryClient()` defaults:** `staleTime: 30_000`, `gcTime: 300_000`, `refetchOnWindowFocus: false`, `retry: (count, err) => !(isApiError(err) && err.status >= 400 && err.status < 500) && count < 2`; mutations `retry: false`.

**Tests (assert):** cookie header attached on POST but not GET; 401 triggers `onUnauthorized` and still throws; error envelope maps to `ApiError` with `code`/`requestId`; 204 returns undefined; `credentials` is `"include"` on every call.

---

**Data shape (TypeScript):**
```ts
interface ErrorEnvelope { error: string; message?: string; details?: unknown[] }
class ApiError extends Error { status: number; code: string; details?: unknown[]; requestId?: string }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// Every endpoint returns either:
//   2xx  → { data: T }  (lists: { data: T[]; total: number })
//   4xx/5xx → { error: string; message?: string; details?: unknown[] }
// 401 { error: "unauthorized" } · 403 { error: "forbidden" } · 404 { error: "not_found" }
// 400 { error: "validation_failed"; details: ZodIssue[] } · 429 { error: "rate_limited" }
```

---

**Out of scope:**
- Do not create React hooks or components (they live in `apps/web`).
- Do not implement SSE or WebSocket helpers (Layer L12).
- Do not call any real endpoint.

---

**Definition of done:**
☐ `pnpm --filter @vunvault/lib typecheck` passes with zero errors.
☐ `pnpm --filter @vunvault/lib lint` passes with zero errors.
☐ `pnpm --filter @vunvault/lib test` passes with every exported function covered by at least one test.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 7 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 8 — UI primitives: Button, Badge, StatusPill, Spinner

**Layer:** L1

**Prerequisites:** Task 5, Task 6

**Estimated files touched:** 8

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **UI primitives: Button, Badge, StatusPill, Spinner**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the Button, Badge, StatusPill and Spinner primitives with the exact prototype styling, using class-variance-authority and the Radix Slot.

**Deliverables:**
- `packages/ui/src/components/button.tsx` — `Button` (variants `primary | ghost | dark | danger`, sizes `md | sm | icon`, `loading`, `asChild`).
- `packages/ui/src/components/badge.tsx` — `Badge` with `tone`.
- `packages/ui/src/components/status-pill.tsx` — `StatusPill`.
- `packages/ui/src/components/spinner.tsx` — `Spinner`.
- `packages/ui/src/components/button.test.tsx`, `badge.test.tsx`, `status-pill.test.tsx` — tests.
- MODIFY `packages/ui/src/index.ts` — export the four components and their prop types.
- MODIFY `packages/ui/package.json` — add dependencies.

**Dependencies allowed:**
- `class-variance-authority`, `@radix-ui/react-slot` in `packages/ui`.
- `@vunvault/lib` (already a workspace dependency) for `cn`.
- Nothing else.

---

**Design tokens to use (verbatim):**
```css
--brand: #3B99FC;
--brand-strong: #1E7BE0;
--brand-soft: #6FB6FF;
--brand-tint: rgba(59,153,252,0.12);
--brand-line: rgba(59,153,252,0.28);
--brand-glow: rgba(59,153,252,0.45);
--dark: #0A0D12;
--dark-2: #10151D;
--dark-3: #161C26;
--black: #000000;
--paper: #fcfbf9;
--white: #ffffff;
--ink: #171717;
--ink-soft: #525252;
--ink-muted: #737373;
--ink-faint: #a3a3a3;
--line: #e5e5e5;
--line-soft: rgba(229,229,229,0.8);
--line-dark: #262626;
--critical: #f43f5e;
--high: #f59e0b;
--medium: #eab308;
--low: #3B99FC;
--ok: #10b981;
--r-sm: 10px; --r-md: 14px; --r-lg: 18px; --r-xl: 24px; --r-2xl: 28px; --r-full: 9999px;
--ease: cubic-bezier(0.4,0,0.2,1);
--ease-out: cubic-bezier(0,0,0.2,1);
--dur: 200ms;
```

**Additional semantic tokens (verbatim — Task 5 defines them; this task consumes them):**
```css
/* Semantic tokens promoted from literals used by prototype components */
--dark-deep: #070b11;          /* second stop of dark gradients */
--dark-abyss: #05070a;         /* modal backdrop base, dark button end stop */
--brand-bright: #44A7FC;       /* preloader wordmark + caption */
--ok-ink: #065f46;  --ok-bg: #ecfdf5;  --ok-line: #a7f3d0;
--warn-ink: #92400e; --warn-bg: #fffbeb; --warn-line: #fde68a;
--danger-ink: #9f1239; --danger-bg: #fff1f2; --danger-line: #fecdd3;
--pill-ok-ink: #0f766e;        /* status pill text */
--table-head: #f6f8fb;         /* table header background */
--slate-text: #e2e8f0;         /* text on dark toast */
--slate-muted: #93a2b5;        /* muted text / icon on dark panels */
--r-field: 12px; --r-toast: 13px; --r-kpi: 16px; --r-tile: 12px;
/* Font stacks — defined inside @theme (not :root) as --font-sans / --font-mono */
--font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
--font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
--sh-card: 0 18px 44px -38px rgba(10,13,18,0.55);
--sh-kpi: 0 12px 30px -26px rgba(10,13,18,0.5);
--sh-btn-brand: 0 14px 30px -16px var(--brand-glow), inset 0 1px 0 rgba(255,255,255,0.24);
--sh-ghost: 0 6px 18px -16px rgba(10,13,18,0.6);
--sh-toast: 0 22px 44px -24px rgba(0,0,0,0.85);
--sh-tile: 0 0 0 1px rgba(59,153,252,0.08), 0 6px 18px -10px var(--brand-glow);
--grad-brand: linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%);
--grad-dark: linear-gradient(160deg, var(--dark) 0%, var(--dark-deep) 100%);
--grad-tile: linear-gradient(145deg, var(--dark), var(--black));
```

**Design rules for this task:**
- Use Tailwind classes mapped to the tokens above (`bg-brand`, `text-ink-muted`, `rounded-2xl`, `duration-200`, `ease-vv`).
- **Never hard-code a hex value, radius, or easing string** outside the token files this task is explicitly told to create.
- Every animation must include a `@media (prefers-reduced-motion: reduce)` fallback that disables motion without breaking layout.
- Every dialog must have `role="dialog"`, `aria-modal="true"`, an `aria-labelledby`, a focus trap, and Escape-to-close.
- Every icon-only button must have an `aria-label`.
- Never use `localStorage` / `sessionStorage`. Session state lives in HttpOnly cookies set by the API.

---

**Visual specification (embedded copy + layout):**

**Button — base (all variants):**
- `display: inline-flex; align-items: center; justify-content: center; gap: 9px; font-weight: 800; letter-spacing: 0.01em; border-radius: 9999px (rounded-full); border: 1px solid transparent; white-space: nowrap; cursor: pointer;`
- Transition on `transform, filter, box-shadow, background-color, border-color, color` at 200ms `ease-vv`.
- `:active` → `transform: translateY(1px) scale(0.985)`.
- Disabled → `opacity: 0.5; cursor: not-allowed; pointer-events: none;`, no transform.
- Focus-visible → the global 2px brand outline (from `base.css`).
- `loading` → renders `Spinner` (16px) before the label, sets `aria-busy="true"` and disables the button.

**Sizes:** `md` → `padding: 12px 20px; font-size: 0.78rem;` · `sm` → `padding: 8px 14px; font-size: 0.72rem;` · `icon` → `width: 36px; height: 36px; padding: 0;` (an `aria-label` prop is REQUIRED by the TypeScript type when `size="icon"`).

**Variants:**
- `primary`: text white; `background: var(--grad-brand)` (`bg-grad-brand`); `border-color: brand at 50%` (`border-brand/50`); `shadow-btn-brand`. Hover: `brightness(1.08)` and `translateY(-2px)`.
- `ghost`: text `ink`; background white; `border-color: line`; `shadow-ghost`. Hover: `translateY(-2px)`, `border-color: brand-line`, text `brand-strong`, shadow `0 14px 30px -20px var(--brand-glow)`.
- `dark`: text white; `bg-grad-dark` using stops `dark → dark-abyss`; `border-color: brand at 32%`. Hover: `translateY(-2px)`, `border-color: brand`, shadow `0 18px 34px -20px var(--brand-glow)`.
- `danger`: text white; background `critical`; `border-color: critical at 50%`. Hover: `brightness(1.08)`.

**Badge (`tone` prop) — base:** `display: inline-block; padding: 4px 11px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; border-radius: 9999px; white-space: nowrap; border: 1px solid transparent;`
- `ok` and `settled`: text `ok-ink`, bg `ok-bg`, border `ok-line`.
- `pending`: text `warn-ink`, bg `warn-bg`, border `warn-line`.
- `refunded` and `danger`: text `danger-ink`, bg `danger-bg`, border `danger-line`.
- `critical` / `high` / `medium` / `low`: text = that severity colour; bg = that colour at 10% opacity; border = that colour at 30% opacity (`text-critical bg-critical/10 border-critical/30`, etc.).
- `info`: text `brand-strong`, bg `brand-tint`, border `brand-line`.
- `neutral`: text `ink-muted`, bg `table-head`, border `line`.

**StatusPill:** `display: inline-flex; align-items: center; gap: 8px; padding: 7px 14px; font-family: mono; font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: pill-ok-ink; background: ok at 10%; border: 1px solid ok at 35%; border-radius: 9999px; white-space: nowrap;` Contains a 6×6px round dot (`bg-ok`) with an outer ring that uses `animate-vv-ping` (the ring is `aria-hidden`). Default text: `"SYS: OPERATIONAL"`. Prop `label` overrides it. Root has `role="status"`.

**Spinner:** 16×16 (size prop: `sm` 12 / `md` 16 / `lg` 24), `border: 2px solid currentColor; border-top-color: transparent; border-radius: 9999px; animation: animate-vv-spin`. `role="status"` with `aria-label="Loading"` (prop `label` overrides). Reduced motion: handled by the global block, spinner stays visible as a static ring.

**Copy used in tests only:** Button label `"Provision New Member"`; Badge labels `"Paid"`, `"Pending"`, `"Critical"`; StatusPill default `"SYS: OPERATIONAL"`.

---

**Data shape (TypeScript):**
```ts
type ButtonVariant = "primary" | "ghost" | "dark" | "danger";
type ButtonSize = "md" | "sm" | "icon";
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { variant?: ButtonVariant; size?: ButtonSize; loading?: boolean; asChild?: boolean }
type BadgeTone = "ok" | "settled" | "pending" | "refunded" | "danger" | "critical" | "high" | "medium" | "low" | "info" | "neutral";
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> { tone?: BadgeTone }
interface StatusPillProps { label?: string; className?: string }
```

**API contract (as comments only — do NOT implement the backend):**
N/A — presentational components, no API.

---

**Out of scope:**
- Do not create Card, Input, Dialog, or Table components.
- Do not edit `packages/ui/src/styles/*` (Task 5 owns them).
- Do not hard-code colours; use the Tailwind token classes.

---

**Definition of done:**
☐ `pnpm --filter @vunvault/ui typecheck` passes with zero errors.
☐ `pnpm --filter @vunvault/ui lint` passes with zero errors.
☐ `pnpm --filter @vunvault/ui test` passes: every new component has a Vitest + Testing Library test, and a `console.error` spy asserts zero React warnings during render.
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 8 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 9 — UI primitives: Card family, KpiCard, Eyebrow, ProgressBar, Skeleton, EmptyState

**Layer:** L1

**Prerequisites:** Task 5, Task 6, Task 8

**Estimated files touched:** 9

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **UI primitives: Card family, KpiCard, Eyebrow, ProgressBar, Skeleton, EmptyState**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the surface primitives used by every admin and portal page: Card, CardHead/CardTitle, DarkCard, KpiCard, Eyebrow, ProgressBar, Skeleton and EmptyState.

**Deliverables:**
- `packages/ui/src/components/card.tsx` — `Card`, `DarkCard`, `CardHead`, `CardTitle`, `CardBody`.
- `packages/ui/src/components/kpi-card.tsx` — `KpiCard` and `KpiGrid`.
- `packages/ui/src/components/eyebrow.tsx` — `Eyebrow`.
- `packages/ui/src/components/progress-bar.tsx` — `ProgressBar`.
- `packages/ui/src/components/skeleton.tsx` — `Skeleton`.
- `packages/ui/src/components/empty-state.tsx` — `EmptyState`.
- `packages/ui/src/components/surfaces.test.tsx` — tests for all of the above.
- MODIFY `packages/ui/src/index.ts` — export all components and prop types.

**Dependencies allowed:**
- None — use only existing (`class-variance-authority`, `@vunvault/lib`).
- `lucide-react` may be added to `packages/ui` for icons if not already present.

---

**Design tokens to use (verbatim):**
```css
--brand: #3B99FC;
--brand-strong: #1E7BE0;
--brand-soft: #6FB6FF;
--brand-tint: rgba(59,153,252,0.12);
--brand-line: rgba(59,153,252,0.28);
--brand-glow: rgba(59,153,252,0.45);
--dark: #0A0D12;
--dark-2: #10151D;
--dark-3: #161C26;
--black: #000000;
--paper: #fcfbf9;
--white: #ffffff;
--ink: #171717;
--ink-soft: #525252;
--ink-muted: #737373;
--ink-faint: #a3a3a3;
--line: #e5e5e5;
--line-soft: rgba(229,229,229,0.8);
--line-dark: #262626;
--critical: #f43f5e;
--high: #f59e0b;
--medium: #eab308;
--low: #3B99FC;
--ok: #10b981;
--r-sm: 10px; --r-md: 14px; --r-lg: 18px; --r-xl: 24px; --r-2xl: 28px; --r-full: 9999px;
--ease: cubic-bezier(0.4,0,0.2,1);
--ease-out: cubic-bezier(0,0,0.2,1);
--dur: 200ms;
```

**Additional semantic tokens (verbatim — Task 5 defines them; this task consumes them):**
```css
/* Semantic tokens promoted from literals used by prototype components */
--dark-deep: #070b11;          /* second stop of dark gradients */
--dark-abyss: #05070a;         /* modal backdrop base, dark button end stop */
--brand-bright: #44A7FC;       /* preloader wordmark + caption */
--ok-ink: #065f46;  --ok-bg: #ecfdf5;  --ok-line: #a7f3d0;
--warn-ink: #92400e; --warn-bg: #fffbeb; --warn-line: #fde68a;
--danger-ink: #9f1239; --danger-bg: #fff1f2; --danger-line: #fecdd3;
--pill-ok-ink: #0f766e;        /* status pill text */
--table-head: #f6f8fb;         /* table header background */
--slate-text: #e2e8f0;         /* text on dark toast */
--slate-muted: #93a2b5;        /* muted text / icon on dark panels */
--r-field: 12px; --r-toast: 13px; --r-kpi: 16px; --r-tile: 12px;
/* Font stacks — defined inside @theme (not :root) as --font-sans / --font-mono */
--font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
--font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
--sh-card: 0 18px 44px -38px rgba(10,13,18,0.55);
--sh-kpi: 0 12px 30px -26px rgba(10,13,18,0.5);
--sh-btn-brand: 0 14px 30px -16px var(--brand-glow), inset 0 1px 0 rgba(255,255,255,0.24);
--sh-ghost: 0 6px 18px -16px rgba(10,13,18,0.6);
--sh-toast: 0 22px 44px -24px rgba(0,0,0,0.85);
--sh-tile: 0 0 0 1px rgba(59,153,252,0.08), 0 6px 18px -10px var(--brand-glow);
--grad-brand: linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%);
--grad-dark: linear-gradient(160deg, var(--dark) 0%, var(--dark-deep) 100%);
--grad-tile: linear-gradient(145deg, var(--dark), var(--black));
```

**Design rules for this task:**
- Use Tailwind classes mapped to the tokens above (`bg-brand`, `text-ink-muted`, `rounded-2xl`, `duration-200`, `ease-vv`).
- **Never hard-code a hex value, radius, or easing string** outside the token files this task is explicitly told to create.
- Every animation must include a `@media (prefers-reduced-motion: reduce)` fallback that disables motion without breaking layout.
- Every dialog must have `role="dialog"`, `aria-modal="true"`, an `aria-labelledby`, a focus trap, and Escape-to-close.
- Every icon-only button must have an `aria-label`.
- Never use `localStorage` / `sessionStorage`. Session state lives in HttpOnly cookies set by the API.

---

**Visual specification (embedded copy + layout):**

**Card:** `display: flex; flex-direction: column; border-radius: 18px (rounded-lg); background: white; border: 1px solid line; box-shadow: shadow-card; overflow: hidden;`
**CardHead:** `display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 14px; padding: 20px 22px 16px; border-bottom: 1px solid line-soft;`
**CardTitle:** `display: flex; align-items: center; gap: 10px; font-size: 1rem; font-weight: 800; letter-spacing: -0.01em; color: ink;` An optional `icon` slot renders a `brand`-coloured, non-shrinking icon before the text. Renders as `<h2>` by default (`as` prop allows `h3`).
**CardBody:** `padding: 20px 22px`.
**DarkCard:** Card with `background: radial-gradient(80% 120% at 100% 0%, brand at 16%, transparent 62%), linear-gradient(160deg, dark 0%, dark-deep 100%); border-color: brand at 26%; box-shadow: 0 26px 56px -34px rgba(0,0,0,0.7); color: white;`.

**KpiCard:**
- Container: `position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 7px; padding: 18px 18px 16px; border-radius: 16px (rounded-kpi); background: white; border: 1px solid line; box-shadow: shadow-kpi; transition: transform .25s, border-color .25s, box-shadow .25s (ease-vv).` Hover: `translateY(-3px)`, `border-color: brand-line`.
- A 2px top accent line: `position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, brand, transparent); opacity: 0.75;`.
- Label (`<p>`): `font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: ink-faint;`
- Value: mono font; `font-size: clamp(1.5rem, 2.6vw, 1.95rem); font-weight: 800; letter-spacing: -0.035em; line-height: 1; color: ink;` Optional `unit` renders as `<small>` with `font-size: 0.62em; font-weight: 700; color: ink-muted; margin-left: 2px`.
- Delta line (optional, `delta: { tone: "up" | "dot" | "down" | "warn"; text: string }`): `font-size: 0.7rem; font-weight: 600;` colour `ok` for `up`/`dot`, `high` for `warn`, `critical` for `down`. Text is passed in verbatim by the caller.
- `KpiGrid`: `display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px; margin-bottom: 30px;` at `xl+`; 3 columns at `md`; 2 columns below `md`. Has `role="group"` and a required `aria-label`.

**Eyebrow:** `display: inline-flex; align-items: center; gap: 8px; font-size: 10px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: brand-strong;` with a `::before` bar `width: 22px; height: 2px; border-radius: 2px; background: brand;`.

**ProgressBar:** track `height: 6px; border-radius: 9999px; background: line; overflow: hidden;`; fill `background: grad-brand; width: {value}%; transition: width 400ms ease-vv;`. Props `value` (0–100, clamped), `label`. Markup `role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label={label}`.

**Skeleton:** `position: relative; overflow: hidden; border-radius: 10px (rounded-sm); background: line-soft;` with a `::after` shimmer: `inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.65), transparent); animation: vv-shimmer 1.4s linear infinite;` (use the `vv-shimmer` keyframe from Task 5). `aria-hidden="true"`.

**EmptyState:** centred column, `padding: 40px 24px; gap: 8px; text-align: center;` Title `font-size: 0.95rem; font-weight: 800; color: ink;` Description `font-size: 0.78rem; color: ink-muted; max-width: 28rem;` Optional action slot (renders below, gap 12px). Root `role="status"`.

**Copy used in tests / reference usage (verbatim from the product):**
- KpiCard: label `"Active Team Members"`, value `"24"`, delta `{ tone: "up", text: "▲ 3 onboarded this month" }`; label `"MFA Enrolment"`, value `"92"`, unit `"%"`, delta `{ tone: "warn", text: "2 accounts without MFA" }`.
- CardTitle: `"Active Staff Roster — Security Analysts & Operators"`.
- Eyebrow: `"Identity, Access & Provisioning"`.
- EmptyState title `"No team members match the current filters"`; description `"Adjust your search terms or reset the filters to see the full staff roster."`; action label `"Reset Filters"`.

---

**Data shape (TypeScript):**
```ts
interface KpiCardProps { label: string; value: string; unit?: string; delta?: { tone: "up" | "dot" | "down" | "warn"; text: string } }
interface EmptyStateProps { title: string; description?: string; action?: React.ReactNode }
interface ProgressBarProps { value: number; label: string; className?: string }
```

**API contract (as comments only — do NOT implement the backend):**
N/A — presentational components, no API.

---

**Out of scope:**
- Do not create tables, forms, dialogs, or toasts.
- Do not edit Task 5 stylesheets or Task 8 components.
- Do not fetch data.

---

**Definition of done:**
☐ `pnpm --filter @vunvault/ui typecheck` passes with zero errors.
☐ `pnpm --filter @vunvault/ui lint` passes with zero errors.
☐ `pnpm --filter @vunvault/ui test` passes: every new component has a Vitest + Testing Library test, and a `console.error` spy asserts zero React warnings during render.
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 9 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 10 — UI primitives: form controls and React Hook Form wiring

**Layer:** L1

**Prerequisites:** Task 5, Task 6, Task 8

**Estimated files touched:** 12

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **UI primitives: form controls and React Hook Form wiring**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build Label, Input, Textarea, Select, Checkbox, Switch and the shadcn-style Form components that bind them to React Hook Form + Zod.

**Deliverables:**
- `packages/ui/src/components/label.tsx` — `Label`.
- `packages/ui/src/components/input.tsx` — `Input` (with optional leading icon) and `Textarea`.
- `packages/ui/src/components/select.tsx` — `Select` family on `@radix-ui/react-select`.
- `packages/ui/src/components/checkbox.tsx` — `Checkbox`.
- `packages/ui/src/components/switch.tsx` — `Switch`.
- `packages/ui/src/components/form.tsx` — `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`, `useFormField`.
- `packages/ui/src/components/form-controls.test.tsx` — tests incl. an RHF + Zod integration test.
- MODIFY `packages/ui/src/index.ts` — export everything.
- MODIFY `packages/ui/package.json` — add dependencies.

**Dependencies allowed:**
- `@radix-ui/react-label`, `@radix-ui/react-select`, `@radix-ui/react-checkbox`, `@radix-ui/react-switch`, `@radix-ui/react-slot`.
- `react-hook-form`, `@hookform/resolvers`, `zod` (catalog).
- `lucide-react` (icons), if not already present.

---

**Design tokens to use (verbatim):**
```css
--brand: #3B99FC;
--brand-strong: #1E7BE0;
--brand-soft: #6FB6FF;
--brand-tint: rgba(59,153,252,0.12);
--brand-line: rgba(59,153,252,0.28);
--brand-glow: rgba(59,153,252,0.45);
--dark: #0A0D12;
--dark-2: #10151D;
--dark-3: #161C26;
--black: #000000;
--paper: #fcfbf9;
--white: #ffffff;
--ink: #171717;
--ink-soft: #525252;
--ink-muted: #737373;
--ink-faint: #a3a3a3;
--line: #e5e5e5;
--line-soft: rgba(229,229,229,0.8);
--line-dark: #262626;
--critical: #f43f5e;
--high: #f59e0b;
--medium: #eab308;
--low: #3B99FC;
--ok: #10b981;
--r-sm: 10px; --r-md: 14px; --r-lg: 18px; --r-xl: 24px; --r-2xl: 28px; --r-full: 9999px;
--ease: cubic-bezier(0.4,0,0.2,1);
--ease-out: cubic-bezier(0,0,0.2,1);
--dur: 200ms;
```

**Additional semantic tokens (verbatim — Task 5 defines them; this task consumes them):**
```css
/* Semantic tokens promoted from literals used by prototype components */
--dark-deep: #070b11;          /* second stop of dark gradients */
--dark-abyss: #05070a;         /* modal backdrop base, dark button end stop */
--brand-bright: #44A7FC;       /* preloader wordmark + caption */
--ok-ink: #065f46;  --ok-bg: #ecfdf5;  --ok-line: #a7f3d0;
--warn-ink: #92400e; --warn-bg: #fffbeb; --warn-line: #fde68a;
--danger-ink: #9f1239; --danger-bg: #fff1f2; --danger-line: #fecdd3;
--pill-ok-ink: #0f766e;        /* status pill text */
--table-head: #f6f8fb;         /* table header background */
--slate-text: #e2e8f0;         /* text on dark toast */
--slate-muted: #93a2b5;        /* muted text / icon on dark panels */
--r-field: 12px; --r-toast: 13px; --r-kpi: 16px; --r-tile: 12px;
/* Font stacks — defined inside @theme (not :root) as --font-sans / --font-mono */
--font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
--font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
--sh-card: 0 18px 44px -38px rgba(10,13,18,0.55);
--sh-kpi: 0 12px 30px -26px rgba(10,13,18,0.5);
--sh-btn-brand: 0 14px 30px -16px var(--brand-glow), inset 0 1px 0 rgba(255,255,255,0.24);
--sh-ghost: 0 6px 18px -16px rgba(10,13,18,0.6);
--sh-toast: 0 22px 44px -24px rgba(0,0,0,0.85);
--sh-tile: 0 0 0 1px rgba(59,153,252,0.08), 0 6px 18px -10px var(--brand-glow);
--grad-brand: linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%);
--grad-dark: linear-gradient(160deg, var(--dark) 0%, var(--dark-deep) 100%);
--grad-tile: linear-gradient(145deg, var(--dark), var(--black));
```

**Design rules for this task:**
- Use Tailwind classes mapped to the tokens above (`bg-brand`, `text-ink-muted`, `rounded-2xl`, `duration-200`, `ease-vv`).
- **Never hard-code a hex value, radius, or easing string** outside the token files this task is explicitly told to create.
- Every animation must include a `@media (prefers-reduced-motion: reduce)` fallback that disables motion without breaking layout.
- Every dialog must have `role="dialog"`, `aria-modal="true"`, an `aria-labelledby`, a focus trap, and Escape-to-close.
- Every icon-only button must have an `aria-label`.
- Never use `localStorage` / `sessionStorage`. Session state lives in HttpOnly cookies set by the API.

---

**Visual specification (embedded copy + layout):**

**Label:** `font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: ink-faint;`. A `required` prop appends a ` *` in `critical` colour with `aria-hidden="true"`.

**Input / Textarea (field surface):** `width: 100%; padding: 11px 14px; font-size: 0.8rem; color: ink; background: white; border: 1px solid line; border-radius: 12px (rounded-field); outline: none; transition: border-color 200ms, box-shadow 200ms (ease-vv);` Placeholder colour `ink-faint`.
- Focus: `border-color: brand; box-shadow: 0 0 0 3px brand-tint`.
- Invalid (`aria-invalid="true"`): `border-color: critical; box-shadow: 0 0 0 3px critical at 20%`.
- Disabled: `opacity: 0.55; cursor: not-allowed; background: table-head`.
- `Input` prop `icon?: React.ReactNode` renders a wrapper `position: relative; display: flex; align-items: center;` and places the icon at `position: absolute; left: 13px; color: ink-faint; pointer-events: none;` and adds `padding-left: 38px` to the input. The icon is `aria-hidden`.
- `Textarea`: `min-height: 96px; resize: vertical;`.

**Select** (Radix): trigger uses the field surface above with `appearance: none`, a trailing 14px chevron icon coloured `brand` at right 12px, and `padding-right: 34px`. Content panel: white, `border: 1px solid line`, `border-radius: 12px`, `box-shadow: shadow-card`, `padding: 6px`, `z-index: 350`, max-height 18rem scrollable. Item: `padding: 9px 12px; font-size: 0.8rem; border-radius: 10px;` highlighted/hover → `background: brand-tint; color: brand-strong`; selected item shows a trailing check icon in `brand`. Exports: `Select, SelectTrigger, SelectValue, SelectContent, SelectItem`.

**Checkbox:** 18×18, `border-radius: 6px; border: 1px solid line; background: white;` checked → `background: brand; border-color: brand;` with a white check icon; focus-visible global outline; supports `indeterminate` (dash icon). Hit area padded to 24px.

**Switch:** track 40×22 `rounded-full`, off `background: line`, on `background: brand`; thumb 18px white with a 2px inset and `transition: transform 200ms ease-vv`.

**Form wiring (shadcn pattern):**
- `Form` = `FormProvider` re-export. `FormField` wraps RHF `Controller` and provides a field context. `FormItem` is a `div` with `display: grid; gap: 6px;` and a generated `id`.
- `FormLabel` uses `Label` with `htmlFor` = field id and turns `critical` when the field has an error.
- `FormControl` is a `Slot` that injects `id`, `aria-invalid`, and `aria-describedby` (description id + message id when an error exists).
- `FormDescription`: `font-size: 0.72rem; color: ink-muted;`.
- `FormMessage`: `font-size: 0.72rem; font-weight: 600; color: critical;` rendered with `role="alert"` only when there is an error message; renders nothing otherwise.

**Copy used in tests / reference usage (verbatim from the product):**
- Label `"Full Name"` (required), Input placeholder none; Label `"Work Email"` with helper `"@vunvault.com domain"`; Label `"Job Title"`; Label `"Base / Location"`; Label `"Scope Notes"` with helper `"Visible to reviewers only"`.
- Select placeholder-free example options: `"Offensive Security"`, `"SOC — Detection & Response"`, `"Threat Intelligence"`, `"Security Automation"`, `"Compliance & Audit"`, `"Client Support"`.
- Search Input with icon, accessible name `"Search"`.
- RHF + Zod test schema: `z.object({ fullName: z.string().min(2, "Enter the member's full name"), email: z.string().email("Enter a valid work email") })`; submitting empty shows both messages with `role="alert"`.

---

**Data shape (TypeScript):**
```ts
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { icon?: React.ReactNode }
interface LabelProps extends React.ComponentPropsWithoutRef<"label"> { required?: boolean }
```

**API contract (as comments only — do NOT implement the backend):**
N/A — presentational components, no API.

---

**Out of scope:**
- Do not create any page-specific form (login, signup, provision-member).
- Do not implement password-visibility toggles or file uploads.
- Do not use `useState` to hold form values anywhere; RHF only.

---

**Definition of done:**
☐ `pnpm --filter @vunvault/ui typecheck` passes with zero errors.
☐ `pnpm --filter @vunvault/ui lint` passes with zero errors.
☐ `pnpm --filter @vunvault/ui test` passes: every new component has a Vitest + Testing Library test, and a `console.error` spy asserts zero React warnings during render.
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 10 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 11 — UI primitives: Dialog, Toast system, Tooltip

**Layer:** L1

**Prerequisites:** Task 5, Task 6, Task 8

**Estimated files touched:** 9

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **UI primitives: Dialog, Toast system, Tooltip**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the accessible overlay primitives: a Radix-based Dialog with the VUNVAULT dark header, a toast system (Radix Toast + Zustand store), and a Tooltip.

**Deliverables:**
- `packages/ui/src/components/dialog.tsx` — `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogBody`, `DialogFooter`, `DialogClose`.
- `packages/ui/src/components/toast.tsx` — `Toaster` (provider + viewport + renderer).
- `packages/ui/src/lib/toast-store.ts` — Zustand store + `toast()` function.
- `packages/ui/src/components/tooltip.tsx` — `TooltipProvider`, `Tooltip`.
- `packages/ui/src/components/overlays.test.tsx` — tests.
- MODIFY `packages/ui/src/index.ts` — export all of the above plus `toast`.
- MODIFY `packages/ui/package.json` — add dependencies.

**Dependencies allowed:**
- `@radix-ui/react-dialog`, `@radix-ui/react-toast`, `@radix-ui/react-tooltip`, `zustand`, `lucide-react`.

---

**Design tokens to use (verbatim):**
```css
--brand: #3B99FC;
--brand-strong: #1E7BE0;
--brand-soft: #6FB6FF;
--brand-tint: rgba(59,153,252,0.12);
--brand-line: rgba(59,153,252,0.28);
--brand-glow: rgba(59,153,252,0.45);
--dark: #0A0D12;
--dark-2: #10151D;
--dark-3: #161C26;
--black: #000000;
--paper: #fcfbf9;
--white: #ffffff;
--ink: #171717;
--ink-soft: #525252;
--ink-muted: #737373;
--ink-faint: #a3a3a3;
--line: #e5e5e5;
--line-soft: rgba(229,229,229,0.8);
--line-dark: #262626;
--critical: #f43f5e;
--high: #f59e0b;
--medium: #eab308;
--low: #3B99FC;
--ok: #10b981;
--r-sm: 10px; --r-md: 14px; --r-lg: 18px; --r-xl: 24px; --r-2xl: 28px; --r-full: 9999px;
--ease: cubic-bezier(0.4,0,0.2,1);
--ease-out: cubic-bezier(0,0,0.2,1);
--dur: 200ms;
```

**Additional semantic tokens (verbatim — Task 5 defines them; this task consumes them):**
```css
/* Semantic tokens promoted from literals used by prototype components */
--dark-deep: #070b11;          /* second stop of dark gradients */
--dark-abyss: #05070a;         /* modal backdrop base, dark button end stop */
--brand-bright: #44A7FC;       /* preloader wordmark + caption */
--ok-ink: #065f46;  --ok-bg: #ecfdf5;  --ok-line: #a7f3d0;
--warn-ink: #92400e; --warn-bg: #fffbeb; --warn-line: #fde68a;
--danger-ink: #9f1239; --danger-bg: #fff1f2; --danger-line: #fecdd3;
--pill-ok-ink: #0f766e;        /* status pill text */
--table-head: #f6f8fb;         /* table header background */
--slate-text: #e2e8f0;         /* text on dark toast */
--slate-muted: #93a2b5;        /* muted text / icon on dark panels */
--r-field: 12px; --r-toast: 13px; --r-kpi: 16px; --r-tile: 12px;
/* Font stacks — defined inside @theme (not :root) as --font-sans / --font-mono */
--font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
--font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
--sh-card: 0 18px 44px -38px rgba(10,13,18,0.55);
--sh-kpi: 0 12px 30px -26px rgba(10,13,18,0.5);
--sh-btn-brand: 0 14px 30px -16px var(--brand-glow), inset 0 1px 0 rgba(255,255,255,0.24);
--sh-ghost: 0 6px 18px -16px rgba(10,13,18,0.6);
--sh-toast: 0 22px 44px -24px rgba(0,0,0,0.85);
--sh-tile: 0 0 0 1px rgba(59,153,252,0.08), 0 6px 18px -10px var(--brand-glow);
--grad-brand: linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%);
--grad-dark: linear-gradient(160deg, var(--dark) 0%, var(--dark-deep) 100%);
--grad-tile: linear-gradient(145deg, var(--dark), var(--black));
```

**Design rules for this task:**
- Use Tailwind classes mapped to the tokens above (`bg-brand`, `text-ink-muted`, `rounded-2xl`, `duration-200`, `ease-vv`).
- **Never hard-code a hex value, radius, or easing string** outside the token files this task is explicitly told to create.
- Every animation must include a `@media (prefers-reduced-motion: reduce)` fallback that disables motion without breaking layout.
- Every dialog must have `role="dialog"`, `aria-modal="true"`, an `aria-labelledby`, a focus trap, and Escape-to-close.
- Every icon-only button must have an `aria-label`.
- Never use `localStorage` / `sessionStorage`. Session state lives in HttpOnly cookies set by the API.

---

**Visual specification (embedded copy + layout):**

**Dialog overlay:** `position: fixed; inset: 0; z-index: 300; background: dark-abyss at 76% opacity; backdrop-filter: blur(7px);` animation `animate-vv-overlay-in` (fade, 0.25s ease-out).
**Dialog content (panel):** centred (`fixed`, `inset: 0`, flex centre, `padding: 24px`, scrollable overlay); panel `width: 100%; max-width: 40rem` (prop `size`: `sm` 28rem, `md` 40rem, `lg` 56rem); `max-height: 90vh; overflow: auto; background: white; border: 1px solid line; border-radius: 24px (rounded-xl); box-shadow: 0 40px 80px -40px rgba(0,0,0,0.8);` animation `animate-vv-modal-pop` (0.3s). Must render `role="dialog"`, `aria-modal="true"`, `aria-labelledby` (title id) and `aria-describedby` (description id, when present). Focus is trapped; Escape closes; clicking the overlay closes (prop `dismissible` default true); focus returns to the trigger on close; `body` gets class `nav-open` while open.
**DialogHeader:** `display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 20px 22px 16px; background: radial-gradient(90% 140% at 100% 0%, brand at 18%, transparent 62%), linear-gradient(160deg, dark, dark-deep); color: white;`
**DialogTitle:** `font-size: 1.05rem; font-weight: 800; letter-spacing: -0.01em; color: white;`. **DialogDescription:** `font-size: 0.76rem; line-height: 1.55; color: slate-muted; margin-top: 4px;`.
**Close button (in header):** 34×34 circle, `color: slate-muted; background: white at 7%; border: 1px solid white at 14%;` hover → `color: white; background: critical at 30%; border-color: critical at 50%;` transition 200ms; icon `X` 16px; `aria-label="Close dialog"`.
**DialogBody:** `padding: 22px;`. **DialogFooter:** `display: flex; justify-content: flex-end; gap: 10px; padding: 16px 22px; border-top: 1px solid line-soft;` (stacks column-reverse below 480px).

**Toast system:**
- `toast({ kind, title, message?, durationMs? })` where `kind: "ok" | "warn" | "crit" | "info"`; default `durationMs: 4000`. Store holds an array of `{ id, kind, title, message, durationMs, open }`; max 4 visible (oldest dismissed first).
- Viewport: `position: fixed; left: 20px; bottom: 20px; z-index: 400; display: flex; flex-direction: column; gap: 10px; max-width: min(360px, calc(100vw - 40px)); pointer-events: none;` (individual toasts `pointer-events: auto`).
- Toast: `display: flex; align-items: flex-start; gap: 11px; padding: 13px 16px; border-radius: 13px (rounded-toast); background: linear-gradient(160deg, dark, dark-deep); border: 1px solid brand at 32%; box-shadow: shadow-toast; color: slate-text; font-size: 0.76rem; line-height: 1.55;` enter animation `animate-vv-toast-in`; leave animation `animate-vv-toast-out` (data-state="closed").
- Kind accents: `ok` → border `ok` at 40%, icon `Check` coloured emerald-300 (`#34d399` — implement as `text-ok` at 80% opacity, do not add a new hex); `warn` → border `high` at 40%, icon `TriangleAlert` in `high`; `crit` → border `critical` at 40%, icon `CircleAlert` in `critical`; `info` → default border, icon `Info` in `brand-soft`.
- Title: `font-weight: 800; color: white;` Message: `color: slate-text;`.
- A11y: `crit` and `warn` use Radix `type="foreground"` (announced assertively); `ok` and `info` use `type="background"`. Each toast has a close button (icon `X`, `aria-label="Dismiss notification"`). Pause on hover/focus.
- `Toaster` is mounted once by the app; export it so `apps/web` can render it.

**Tooltip:** content `background: dark; color: white; font-size: 0.7rem; font-weight: 600; padding: 6px 10px; border-radius: 10px (rounded-sm); box-shadow: shadow-toast; z-index: 350;` delay 200ms; animation `animate-vv-fade-in` at 0.15s. Trigger must stay keyboard-focusable.

**Copy used in tests (verbatim from the product):**
- Dialog title `"Provision New Team Member"`; description `"Issue a scoped invitation to a security analyst, operator or auditor. Permissions are applied only after the invitee completes MFA enrolment and accepts the invitation."`; footer buttons `"Save Draft"`, `"Send Secure Invitation"`.
- Toast examples: `{ kind: "ok", title: "Invitation sent", message: "Secure invitation issued." }` — and `{ kind: "crit", title: "Release locked", message: "Complete the review gate first." }`.

---

**Data shape (TypeScript):**
```ts
type ToastKind = "ok" | "warn" | "crit" | "info";
interface ToastInput { kind: ToastKind; title: string; message?: string; durationMs?: number }
interface ToastItem extends Required<Omit<ToastInput, "message">> { id: string; message?: string; open: boolean }
```

**API contract (as comments only — do NOT implement the backend):**
N/A — presentational components, no API.

---

**Out of scope:**
- Do not create the mobile navigation drawer (Layer L5).
- Do not create confirm-dialogs for specific features.
- Do not mount `Toaster` anywhere (the app does that later).

---

**Definition of done:**
☐ `pnpm --filter @vunvault/ui typecheck` passes with zero errors.
☐ `pnpm --filter @vunvault/ui lint` passes with zero errors.
☐ `pnpm --filter @vunvault/ui test` passes: every new component has a Vitest + Testing Library test, and a `console.error` spy asserts zero React warnings during render.
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ A test proves Escape closes the Dialog and focus returns to the trigger.
☐ A test proves a `crit` toast renders with `role="alert"` semantics (foreground) and an `ok` toast with `role="status"`.
☐ Report at the end: `Task 11 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 12 — UI primitive: DataTable (TanStack Table v8 headless) and Pagination

**Layer:** L1

**Prerequisites:** Task 5, Task 6, Task 8, Task 9, Task 10

**Estimated files touched:** 7

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **UI primitive: DataTable (TanStack Table v8 headless) and Pagination**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the one shared DataTable used by every admin and portal table, styled like the prototype's admin table, with sorting, optional row selection, loading skeletons, an empty state, and a result-count/pagination footer.

**Deliverables:**
- `packages/ui/src/components/data-table.tsx` — generic `DataTable<TData>`.
- `packages/ui/src/components/table-footer.tsx` — `ResultCount` and `Pagination`.
- `packages/ui/src/components/select-column.tsx` — `selectColumn<TData>()` helper that returns a checkbox column def.
- `packages/ui/src/components/data-table.test.tsx` — tests.
- MODIFY `packages/ui/src/index.ts` — export all of the above.
- MODIFY `packages/ui/package.json` — add dependency.
- `packages/ui/src/components/data-table.types.ts` — exported prop types.

**Dependencies allowed:**
- `@tanstack/react-table` (v8) in `packages/ui`.
- `lucide-react` if not present.

---

**Design tokens to use (verbatim):**
```css
--brand: #3B99FC;
--brand-strong: #1E7BE0;
--brand-soft: #6FB6FF;
--brand-tint: rgba(59,153,252,0.12);
--brand-line: rgba(59,153,252,0.28);
--brand-glow: rgba(59,153,252,0.45);
--dark: #0A0D12;
--dark-2: #10151D;
--dark-3: #161C26;
--black: #000000;
--paper: #fcfbf9;
--white: #ffffff;
--ink: #171717;
--ink-soft: #525252;
--ink-muted: #737373;
--ink-faint: #a3a3a3;
--line: #e5e5e5;
--line-soft: rgba(229,229,229,0.8);
--line-dark: #262626;
--critical: #f43f5e;
--high: #f59e0b;
--medium: #eab308;
--low: #3B99FC;
--ok: #10b981;
--r-sm: 10px; --r-md: 14px; --r-lg: 18px; --r-xl: 24px; --r-2xl: 28px; --r-full: 9999px;
--ease: cubic-bezier(0.4,0,0.2,1);
--ease-out: cubic-bezier(0,0,0.2,1);
--dur: 200ms;
```

**Additional semantic tokens (verbatim — Task 5 defines them; this task consumes them):**
```css
/* Semantic tokens promoted from literals used by prototype components */
--dark-deep: #070b11;          /* second stop of dark gradients */
--dark-abyss: #05070a;         /* modal backdrop base, dark button end stop */
--brand-bright: #44A7FC;       /* preloader wordmark + caption */
--ok-ink: #065f46;  --ok-bg: #ecfdf5;  --ok-line: #a7f3d0;
--warn-ink: #92400e; --warn-bg: #fffbeb; --warn-line: #fde68a;
--danger-ink: #9f1239; --danger-bg: #fff1f2; --danger-line: #fecdd3;
--pill-ok-ink: #0f766e;        /* status pill text */
--table-head: #f6f8fb;         /* table header background */
--slate-text: #e2e8f0;         /* text on dark toast */
--slate-muted: #93a2b5;        /* muted text / icon on dark panels */
--r-field: 12px; --r-toast: 13px; --r-kpi: 16px; --r-tile: 12px;
/* Font stacks — defined inside @theme (not :root) as --font-sans / --font-mono */
--font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
--font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
--sh-card: 0 18px 44px -38px rgba(10,13,18,0.55);
--sh-kpi: 0 12px 30px -26px rgba(10,13,18,0.5);
--sh-btn-brand: 0 14px 30px -16px var(--brand-glow), inset 0 1px 0 rgba(255,255,255,0.24);
--sh-ghost: 0 6px 18px -16px rgba(10,13,18,0.6);
--sh-toast: 0 22px 44px -24px rgba(0,0,0,0.85);
--sh-tile: 0 0 0 1px rgba(59,153,252,0.08), 0 6px 18px -10px var(--brand-glow);
--grad-brand: linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%);
--grad-dark: linear-gradient(160deg, var(--dark) 0%, var(--dark-deep) 100%);
--grad-tile: linear-gradient(145deg, var(--dark), var(--black));
```

**Design rules for this task:**
- Use Tailwind classes mapped to the tokens above (`bg-brand`, `text-ink-muted`, `rounded-2xl`, `duration-200`, `ease-vv`).
- **Never hard-code a hex value, radius, or easing string** outside the token files this task is explicitly told to create.
- Every animation must include a `@media (prefers-reduced-motion: reduce)` fallback that disables motion without breaking layout.
- Every dialog must have `role="dialog"`, `aria-modal="true"`, an `aria-labelledby`, a focus trap, and Escape-to-close.
- Every icon-only button must have an `aria-label`.
- Never use `localStorage` / `sessionStorage`. Session state lives in HttpOnly cookies set by the API.

---

**Visual specification (embedded copy + layout):**

**Wrapper:** `width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch;` (class `overflow-x-auto`).
**Table:** `width: 100%; min-width: 720px; border-collapse: collapse; font-size: 0.78rem;`
**`<th>`:** `position: sticky; top: 0; z-index: 2; padding: 12px 16px; text-align: left; font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: ink-muted; background: table-head; border-bottom: 1px solid line; white-space: nowrap;`
**`<td>`:** `padding: 13px 16px; vertical-align: middle; color: ink; border-bottom: 1px solid line-soft;`
**Row hover:** `background: brand-tint` (transition 200ms). Selected row: `background: brand-tint` plus a 2px `brand` inset left border.
**Sortable header:** the header cell contains a `<button>` (`inline-flex; gap: 6px;`, no extra padding) with a trailing 12px chevron icon (`ChevronUp`/`ChevronDown`; `ChevronsUpDown` when unsorted, coloured `ink-faint`; active direction coloured `brand`). The `<th>` has `aria-sort="ascending" | "descending" | "none"`.
**Loading:** when `isLoading`, render 6 skeleton rows using the `Skeleton` component from Task 9 (one skeleton bar per column, widths varied 50–90%).
**Empty:** when not loading and `data.length === 0`, render a single full-width row containing the `EmptyState` from Task 9, fed by the `empty` prop (`{ title, description, action }`).
**Row selection (optional, `enableRowSelection`):** first column from `selectColumn()` — header `Checkbox` with `aria-label="Select all rows"` (indeterminate when partially selected) and per-row `Checkbox` with `aria-label="Select row"`. Selection state is controlled via `rowSelection` / `onRowSelectionChange` props.
**Row click (optional `onRowClick`):** the row gets `cursor: pointer` and is activatable by Enter/Space only when `onRowClick` exists (`tabIndex=0`, `role="button"` on the row is NOT allowed — instead put the interaction on a designated cell button; keep rows as `<tr>`). Interactive controls inside rows stop propagation.
**Sorting:** controlled (`sorting`, `onSortingChange`) with `manualSorting` default `true` (server-side); `manualPagination` default `true`.
**Caption:** a visually hidden `<caption>` taken from the required `caption` prop (screen-reader description of the table).

**ResultCount:** `font-size: 0.72rem; color: ink-muted;` renders `Showing <strong mono>{shown}</strong> of <strong mono>{total}</strong> {noun}` — e.g. `Showing 10 of 24 members`.
**Pagination:** a nav (`aria-label="Pagination"`) with two `Button size="icon" variant="ghost"` controls: previous (`aria-label="Previous page"`, `ChevronLeft`) and next (`aria-label="Next page"`, `ChevronRight`), plus the text `Page {page} of {pageCount}` in mono 0.72rem. Disabled at the ends.

**Copy used in tests (verbatim from the product):**
- Caption `"Active staff roster of security analysts and operators with role, scope, MFA status and account state"`.
- Column headers `"Member"`, `"Scope & Team"`, `"MFA / Access"`, `"Last Active"`, `"Status"`, `"Actions"`.
- Empty: title `"No team members match the current filters"`, description `"Adjust your search terms or reset the filters to see the full staff roster."`, action `"Reset Filters"`.
- Result count: `shown=10, total=24, noun="members"`.

---

**Data shape (TypeScript):**
```ts
interface DataTableProps<TData> {
  caption: string;
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  isLoading?: boolean;
  empty: { title: string; description?: string; action?: React.ReactNode };
  getRowId?: (row: TData) => string;
  sorting?: SortingState; onSortingChange?: OnChangeFn<SortingState>;
  enableRowSelection?: boolean; rowSelection?: RowSelectionState; onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  onRowClick?: (row: TData) => void;
}
interface PaginationProps { page: number; pageCount: number; onPageChange: (page: number) => void }
interface ResultCountProps { shown: number; total: number; noun: string }
```

**API contract (as comments only — do NOT implement the backend):**
N/A — presentational component; data is passed in by the caller. Consumers fetch with TanStack Query (`// TODO(backend-contract)`).

---

**Out of scope:**
- Do not implement client-side filtering UI (filter bars are page-level).
- Do not implement column resizing, virtualisation, or CSV export.
- Do not edit Task 8/9/10/11 components.

---

**Definition of done:**
☐ `pnpm --filter @vunvault/ui typecheck` passes with zero errors.
☐ `pnpm --filter @vunvault/ui lint` passes with zero errors.
☐ `pnpm --filter @vunvault/ui test` passes: every new component has a Vitest + Testing Library test, and a `console.error` spy asserts zero React warnings during render.
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 12 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 13 — Brand components: Logo lockup and Preloader

**Layer:** L1

**Prerequisites:** Task 5, Task 6, Task 8

**Estimated files touched:** 6

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Brand components: Logo lockup and Preloader**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the `Logo` lockup and the 3D-orbital `Preloader` exactly as in the prototype.

**Deliverables:**
- `packages/ui/src/components/logo.tsx` — `Logo` (tile + wordmark) and `LogoMark` (tile only).
- `packages/ui/src/components/preloader.tsx` — `Preloader`.
- `packages/ui/src/components/preloader.css` — component CSS (exact rules below).
- `packages/ui/src/components/brand.test.tsx` — tests.
- MODIFY `packages/ui/src/index.ts` — export `Logo`, `LogoMark`, `Preloader`.
- MODIFY `packages/ui/src/styles/index.css` — append `@import "../components/preloader.css";` as the LAST import.

**Dependencies allowed:**
- None — use only existing.

---

**Design tokens to use (verbatim):**
```css
--brand: #3B99FC;
--brand-strong: #1E7BE0;
--brand-soft: #6FB6FF;
--brand-tint: rgba(59,153,252,0.12);
--brand-line: rgba(59,153,252,0.28);
--brand-glow: rgba(59,153,252,0.45);
--dark: #0A0D12;
--dark-2: #10151D;
--dark-3: #161C26;
--black: #000000;
--paper: #fcfbf9;
--white: #ffffff;
--ink: #171717;
--ink-soft: #525252;
--ink-muted: #737373;
--ink-faint: #a3a3a3;
--line: #e5e5e5;
--line-soft: rgba(229,229,229,0.8);
--line-dark: #262626;
--critical: #f43f5e;
--high: #f59e0b;
--medium: #eab308;
--low: #3B99FC;
--ok: #10b981;
--r-sm: 10px; --r-md: 14px; --r-lg: 18px; --r-xl: 24px; --r-2xl: 28px; --r-full: 9999px;
--ease: cubic-bezier(0.4,0,0.2,1);
--ease-out: cubic-bezier(0,0,0.2,1);
--dur: 200ms;
```

**Additional semantic tokens (verbatim — Task 5 defines them; this task consumes them):**
```css
/* Semantic tokens promoted from literals used by prototype components */
--dark-deep: #070b11;          /* second stop of dark gradients */
--dark-abyss: #05070a;         /* modal backdrop base, dark button end stop */
--brand-bright: #44A7FC;       /* preloader wordmark + caption */
--ok-ink: #065f46;  --ok-bg: #ecfdf5;  --ok-line: #a7f3d0;
--warn-ink: #92400e; --warn-bg: #fffbeb; --warn-line: #fde68a;
--danger-ink: #9f1239; --danger-bg: #fff1f2; --danger-line: #fecdd3;
--pill-ok-ink: #0f766e;        /* status pill text */
--table-head: #f6f8fb;         /* table header background */
--slate-text: #e2e8f0;         /* text on dark toast */
--slate-muted: #93a2b5;        /* muted text / icon on dark panels */
--r-field: 12px; --r-toast: 13px; --r-kpi: 16px; --r-tile: 12px;
/* Font stacks — defined inside @theme (not :root) as --font-sans / --font-mono */
--font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
--font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
--sh-card: 0 18px 44px -38px rgba(10,13,18,0.55);
--sh-kpi: 0 12px 30px -26px rgba(10,13,18,0.5);
--sh-btn-brand: 0 14px 30px -16px var(--brand-glow), inset 0 1px 0 rgba(255,255,255,0.24);
--sh-ghost: 0 6px 18px -16px rgba(10,13,18,0.6);
--sh-toast: 0 22px 44px -24px rgba(0,0,0,0.85);
--sh-tile: 0 0 0 1px rgba(59,153,252,0.08), 0 6px 18px -10px var(--brand-glow);
--grad-brand: linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%);
--grad-dark: linear-gradient(160deg, var(--dark) 0%, var(--dark-deep) 100%);
--grad-tile: linear-gradient(145deg, var(--dark), var(--black));
```

**Design rules for this task:**
- Use Tailwind classes mapped to the tokens above (`bg-brand`, `text-ink-muted`, `rounded-2xl`, `duration-200`, `ease-vv`).
- **Never hard-code a hex value, radius, or easing string** outside the token files this task is explicitly told to create.
- Every animation must include a `@media (prefers-reduced-motion: reduce)` fallback that disables motion without breaking layout.
- Every dialog must have `role="dialog"`, `aria-modal="true"`, an `aria-labelledby`, a focus trap, and Escape-to-close.
- Every icon-only button must have an `aria-label`.
- Never use `localStorage` / `sessionStorage`. Session state lives in HttpOnly cookies set by the API.

---

**Visual specification (embedded copy + layout):**

**Asset note:** the logo SVG is a binary asset supplied by the operator at `apps/web/public/brand/logo.svg` (served at `/brand/logo.svg`). Do NOT create, copy, edit or inline it. The components take `src` (default `"/brand/logo.svg"`).

**Logo lockup:**
- Root `<a>` (when `href` is set; default `"/"`) with `aria-label="VUNVAULT home"`, `display: inline-flex; align-items: center; gap: 12px;` (class `group`).
- Tile `<span>`: `width: 2.35rem; height: 2.35rem; border-radius: 12px (rounded-tile); background: grad-tile; border: 1px solid brand at 35%; box-shadow: shadow-tile; display: inline-flex; align-items: center; justify-content: center; transition: box-shadow 200ms ease-vv;` Hover (group) → `box-shadow: 0 0 0 1px brand at 25%, 0 10px 26px -12px brand-glow`.
- Inside tile: `<img src alt="VUNVAULT">` 24×24, `object-fit: contain`.
- Wordmark `<span>`: text `"VUNVAULT"`; `font-weight: 800; font-size: 1.25rem (1.5rem from md up); letter-spacing: 0.14em; color: ink` (prop `tone="light"` switches to white for dark headers). Hover (group) → `opacity: 0.8`.
- `LogoMark` renders only the tile (no wordmark) and has `aria-label="VUNVAULT"` when used without a link.

**Preloader component:**
- Props: `durationMs` (default 4000), `onDone?: () => void`, `src` (default `"/brand/logo.svg"`).
- Root: `<div class="vv-preloader" role="status" aria-live="polite" aria-label="Loading VUNVAULT">`.
- Markup (in order): `.vv-preloader__inner` → `.vv-preloader__mark` → (`.vv-preloader__stage[aria-hidden]` → three `span.vv-preloader__ring.vv-preloader__ring--1|2|3` + `span.vv-preloader__halo`) + `<img class="vv-preloader__logo" alt="VUNVAULT Logo">`; then `.vv-preloader__wordmark` text `"VUNVAULT"`; then `.vv-preloader__bar[role=progressbar aria-valuemin=0 aria-valuemax=100 aria-valuenow=100 aria-label="Page loading progress"]` → `span.vv-preloader__fill`; then `span.vv-preloader__caption` text `"Establishing secure channel"`.
- Behaviour: after `durationMs` add class `is-hidden` (fade-out 0.6s), then 700ms later unmount (render `null`) and call `onDone`. Under `prefers-reduced-motion: reduce` the component uses `durationMs = 800` regardless of the prop (read via `window.matchMedia`, SSR-safe).

**`preloader.css` — exact rules (write these, replacing the prototype's `#preloader` id selectors with `.vv-preloader`):**
```css
.vv-preloader { position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; overflow: hidden;
  background: radial-gradient(circle at 50% 44%, rgba(59,153,252,0.20), transparent 58%), radial-gradient(circle at 50% 110%, rgba(59,153,252,0.12), transparent 62%), linear-gradient(165deg, #0a0d12 0%, #05070a 55%, #000000 100%);
  transition: opacity 0.6s var(--ease), visibility 0.6s var(--ease); }
.vv-preloader::before { content: ""; position: absolute; inset: -20%;
  background-image: linear-gradient(to right, rgba(59,153,252,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(59,153,252,0.10) 1px, transparent 1px);
  background-size: 64px 64px; transform: rotateX(62deg) translateZ(-120px) scale(1.6); transform-origin: 50% 60%;
  -webkit-mask-image: radial-gradient(60% 55% at 50% 50%, #000 0%, transparent 78%); mask-image: radial-gradient(60% 55% at 50% 50%, #000 0%, transparent 78%);
  opacity: 0.55; pointer-events: none; animation: vv-grid-drift 4s linear infinite; }
.vv-preloader.is-hidden { opacity: 0; visibility: hidden; pointer-events: none; }
.vv-preloader__inner { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 26px; padding: 0 24px; }
.vv-preloader__mark { position: relative; display: grid; place-items: center; width: 230px; height: 230px; perspective: 900px; transform-style: preserve-3d; animation: vv-mark-float 4s var(--ease) infinite; }
.vv-preloader__stage { position: absolute; inset: 0; transform-style: preserve-3d; }
.vv-preloader__ring { position: absolute; top: 50%; left: 50%; border-radius: 50%; border: 1px solid transparent; transform-style: preserve-3d; will-change: transform; }
.vv-preloader__ring--1 { width: 210px; height: 210px; margin: -105px 0 0 -105px; border-top-color: rgba(111,182,255,0.85); border-right-color: rgba(59,153,252,0.30); border-bottom-color: rgba(59,153,252,0.08); border-left-color: rgba(59,153,252,0.30); box-shadow: 0 0 22px -6px rgba(59,153,252,0.45); animation: vv-ring-x 4s linear infinite; }
.vv-preloader__ring--2 { width: 168px; height: 168px; margin: -84px 0 0 -84px; border-top-color: rgba(59,153,252,0.20); border-right-color: rgba(111,182,255,0.75); border-bottom-color: rgba(59,153,252,0.20); border-left-color: rgba(59,153,252,0.10); box-shadow: 0 0 18px -6px rgba(59,153,252,0.40); animation: vv-ring-y 3.2s linear infinite; }
.vv-preloader__ring--3 { width: 126px; height: 126px; margin: -63px 0 0 -63px; border-top-color: rgba(59,153,252,0.55); border-right-color: rgba(59,153,252,0.12); border-bottom-color: rgba(111,182,255,0.80); border-left-color: rgba(59,153,252,0.12); box-shadow: 0 0 16px -4px rgba(59,153,252,0.50); animation: vv-ring-z 2.6s linear infinite; }
.vv-preloader__halo { position: absolute; top: 50%; left: 50%; width: 150px; height: 150px; margin: -75px 0 0 -75px; border-radius: 50%; background: radial-gradient(closest-side, rgba(59,153,252,0.42), transparent 72%); filter: blur(18px); pointer-events: none; animation: vv-halo 2s ease-in-out infinite; }
.vv-preloader__logo { position: relative; z-index: 2; width: 84px; height: 84px; object-fit: contain; will-change: filter, transform; animation: vv-logo-stroke 2s var(--ease) infinite; }
.vv-preloader__wordmark { font-size: 20px; font-weight: 800; letter-spacing: 0.42em; text-indent: 0.42em; color: var(--brand-bright); text-transform: uppercase; opacity: 0; text-shadow: 0 0 24px rgba(59,153,252,0.55); animation: vv-fade-up 0.8s var(--ease) 0.35s forwards; }
.vv-preloader__caption { margin-top: -8px; font-family: var(--font-mono); font-size: 10.5px; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase; color: var(--brand-bright); opacity: 0; animation: vv-fade-up 0.8s var(--ease) 0.6s forwards; }
.vv-preloader__bar { position: relative; width: 240px; height: 3px; border-radius: var(--r-full); background: rgba(255,255,255,0.08); box-shadow: inset 0 0 0 1px rgba(59,153,252,0.12); overflow: hidden; }
.vv-preloader__fill { position: absolute; inset: 0 auto 0 0; z-index: 1; display: block; width: 0; border-radius: var(--r-full); background: linear-gradient(90deg, var(--brand-strong), var(--brand-soft)); box-shadow: 0 0 14px var(--brand-glow); overflow: hidden; animation: vv-progress 4s linear forwards; }
.vv-preloader__fill::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.65), transparent); animation: vv-shimmer 1.4s linear infinite; }
@media (prefers-reduced-motion: reduce) {
  .vv-preloader::before, .vv-preloader__mark, .vv-preloader__ring, .vv-preloader__halo, .vv-preloader__logo, .vv-preloader__fill::after { animation: none; }
  .vv-preloader__halo { opacity: 0.7; }
  .vv-preloader__wordmark, .vv-preloader__caption { animation: none; opacity: 1; }
  .vv-preloader__fill { animation: none; width: 100%; }
}
```
(The gradient stops in `.vv-preloader` that use hex literals are the ONLY hex literals permitted in this task, because they are the prototype's literal background; every other colour must be a `var()`.)

---

**Data shape (TypeScript):**
```ts
interface LogoProps { href?: string; src?: string; tone?: "dark" | "light"; className?: string }
interface PreloaderProps { durationMs?: number; onDone?: () => void; src?: string }
```

**API contract (as comments only — do NOT implement the backend):**
N/A — presentational components, no API.

---

**Out of scope:**
- Do not create, copy, or inline the logo SVG file.
- Do not mount the Preloader in any app (Layer L5 decides where).
- Do not use `sessionStorage` to remember whether the preloader was shown.

---

**Definition of done:**
☐ `pnpm --filter @vunvault/ui typecheck` passes with zero errors.
☐ `pnpm --filter @vunvault/ui lint` passes with zero errors.
☐ `pnpm --filter @vunvault/ui test` passes: every new component has a Vitest + Testing Library test, and a `console.error` spy asserts zero React warnings during render.
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ A test proves `role="status"` and `aria-label="Loading VUNVAULT"` exist and the caption reads `Establishing secure channel`.
☐ A fake-timer test proves the preloader unmounts 4700ms after mount (4000 + 700) and calls `onDone`.
☐ Report at the end: `Task 13 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 14 — Database foundation: Drizzle config, Supavisor client, enums, column helpers, SQL migration runner

**Layer:** L2

**Prerequisites:** Task 3, Task 4

**Estimated files touched:** 12

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Database foundation: Drizzle config, Supavisor client, enums, column helpers, SQL migration runner**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Set up `@vunvault/db`: Drizzle config, a Supavisor-safe Postgres client, the single source of truth for every enum, shared column helpers, and a migration runner that applies Drizzle migrations followed by ordered raw-SQL files.

**Deliverables:**
- `packages/db/drizzle.config.ts` — dialect `postgresql`, `schema: "./src/schema/index.ts"`, `out: "./drizzle"`, `dbCredentials.url` from `process.env.DIRECT_URL`.
- `packages/db/src/enum-values.ts` — PURE module (no drizzle import) exporting each enum below as a `readonly` tuple plus its union type (e.g. `export const USER_ROLES = [...] as const; export type UserRole = (typeof USER_ROLES)[number];`).
- `packages/db/src/schema/_enums.ts` — builds every `pgEnum` from `enum-values.ts` (e.g. `export const userRoleEnum = pgEnum("user_role", USER_ROLES)`).
- `packages/db/src/schema/_columns.ts` — column helpers (spec below).
- `packages/db/src/schema/index.ts` — re-exports `_enums` and `_columns` (later tasks append their table modules).
- `packages/db/src/client.ts` — `createDb(url = process.env.DATABASE_URL)` using `postgres` + `drizzle-orm/postgres-js` with `prepare: false`, `max: 10`, `ssl: "require"`; also exports `type Db`.
- `packages/db/src/migrate.ts` — runner (behaviour below). Executable via `tsx src/migrate.ts`.
- `packages/db/sql/.gitkeep` — folder for raw SQL migrations added by later tasks.
- `packages/db/src/enum-values.test.ts` — asserts the tuple counts and a few values.
- MODIFY `packages/db/src/index.ts` — export `createDb`, `Db`, and `export * from "./schema"` and `export * from "./enum-values"`.
- MODIFY `packages/db/package.json` — add dependencies; scripts `db:generate`, `db:migrate`; `exports` map `"."` → `./src/index.ts` and `"./enum-values"` → `./src/enum-values.ts`.
- `packages/db/sql/0000_extensions.sql` — extensions migration.

**Dependencies allowed:**
- `drizzle-orm`, `postgres` (runtime).
- `drizzle-kit`, `tsx` (dev).
- Nothing else.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

N/A — no UI.

**Connection rules (put these as comments at the top of `client.ts`):**
- App traffic uses `DATABASE_URL` → Supabase **Supavisor transaction pooler on port 6543** → therefore `prepare: false` is mandatory.
- Migrations use `DIRECT_URL` → direct Postgres on port 5432 (session features, DDL).
- Supabase Postgres 15 is the only database. Supabase Auth owns identity (`auth.users`).

**Enum values — create one tuple per line below (name → values), exactly:**
```ts
user_role:          "super_admin" | "admin" | "security_analyst" | "soc_operator" | "compliance_auditor" | "support_engineer" | "client"
account_status:     "active" | "pending_invite" | "suspended" | "dormant"
access_tier:        "standard" | "elevated" | "restricted"
team:               "offensive_security" | "soc_detection_response" | "threat_intelligence" | "security_automation" | "compliance_audit" | "client_support" | "curriculum_product" | "compliance_comms"
mfa_method:         "totp" | "webauthn" | "email_otp"
account_type:       "individual" | "company"
industry:           "financial_services_fintech" | "sacco_microfinance" | "banking" | "insurance" | "healthcare" | "telecommunications" | "government_public_sector" | "education" | "retail_ecommerce" | "technology_saas" | "other"
invitation_status:  "draft" | "pending" | "accepted" | "revoked" | "expired"
scan_type:          "external" | "api" | "internal" | "network" | "mobile"
scan_priority:      "critical" | "high" | "medium" | "low"
scan_environment:   "production" | "staging"
scan_status:        "queued" | "running" | "awaiting_review" | "completed" | "held" | "rejected" | "cancelled"
review_gate_state:  "not_eligible" | "in_review" | "approved_released" | "held_blocked" | "blocked_payment"
review_decision:    "approve_release" | "hold_remediation" | "reject_archive"
review_check_key:   "scope_authorisation_verified" | "evidence_sanitised" | "critical_high_validated" | "remediation_guidance_attached" | "client_redaction_approved"
finding_severity:   "critical" | "high" | "medium" | "low"
finding_status:     "open" | "validated" | "false_positive" | "remediated"
pentest_target_type:"web_application" | "network_infrastructure" | "api" | "mobile_app"
pentest_status:     "received" | "scoping" | "scheduled" | "converted" | "declined"
payment_status:     "paid" | "pending" | "overdue"
invoice_status:     "draft" | "pending" | "paid" | "overdue" | "void"
subscription_status:"active" | "past_due" | "canceled" | "incomplete"
billing_cycle:      "monthly" | "annual"
payment_provider:   "stripe" | "paystack"
payment_channel:    "card" | "mpesa" | "bank_transfer"
payment_attempt_status: "created" | "requires_action" | "succeeded" | "failed" | "canceled"
display_currency:   "USD" | "KES" | "NGN" | "GHS" | "ZAR"
ledger_direction:   "debit" | "credit"
ledger_account_type:"asset" | "liability" | "revenue" | "expense" | "equity"
journal_kind:       "invoice_issued" | "payment_captured" | "refund" | "adjustment" | "reversal"
content_type:       "blog_post" | "news_announcement" | "threat_advisory" | "product_listing"
content_status:     "draft" | "pending_review" | "in_review" | "changes_requested" | "approved" | "rejected" | "scheduled" | "published"
risk_flag:          "legal_review_required" | "contains_pii" | "unverified_claim" | "brand_sensitive"
content_review_action: "approve" | "request_changes" | "reject" | "publish" | "schedule" | "remind_author"
contact_category:   "penetration_testing_request" | "vulnerability_report" | "journalist_blogger_profile_request" | "whistleblower_tip" | "general_support"
contact_status:     "new" | "triaged" | "closed"
broadcast_status:   "queued" | "sending" | "sent" | "failed"
audit_category:     "authentication" | "scan_completion" | "report_release" | "administrative" | "security_event" | "system"
audit_severity:     "ok" | "info" | "warning" | "critical"
```

**`_columns.ts` helpers (exact):**
- `idCol()` → `uuid("id").primaryKey().defaultRandom()`.
- `createdAtCol()` → `timestamp("created_at", { withTimezone: true }).notNull().defaultNow()`.
- `updatedAtCol()` → `timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()`.
- `timestamps` → `{ createdAt, updatedAt }` object spread.
- `usdCents(name)` → `bigint(name, { mode: "number" })` (integer USD cents; never a float).
- `tz(name)` → `timestamp(name, { withTimezone: true })`.

**`migrate.ts` behaviour:**
1. Connect with `DIRECT_URL`, `max: 1`.
2. Run Drizzle's migrator over `./drizzle`.
3. Ensure table `_vv_sql_migrations (name text primary key, applied_at timestamptz not null default now())`.
4. Read `./sql/*.sql` sorted lexicographically; for each file whose name is not in `_vv_sql_migrations`, run it inside a transaction and insert its name. Log `applied <name>` / `skipped <name>`.
5. Exit non-zero on any error.
6. Create the first SQL file `packages/db/sql/0000_extensions.sql` with: `CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS citext;` (add this file to the deliverables count).

**Row-level security policy for the whole schema (state this in a comment in `_columns.ts`):** every table later tasks create calls `.enableRLS()` and defines NO permissive policies — so Supabase's PostgREST roles (`anon`, `authenticated`) get zero access. All access goes through the API, which connects with a server-side role. This is defence in depth, not the primary authorisation layer.

---

**Data shape (TypeScript):**
```ts
// Pure enum module — safe to import from any package (no drizzle runtime).
import { USER_ROLES, type UserRole } from "@vunvault/db/enum-values";
```

**API contract (as comments only — do NOT implement the backend):**
N/A — no API.

---

**Out of scope:**
- Do not define any table (Tasks 15–18 do).
- Do not connect to a real database in tests.
- Do not add Prisma, Knex, or any other ORM.
- Do not create Fastify code.

---

**Definition of done:**
☐ `pnpm --filter @vunvault/db typecheck` passes with zero errors.
☐ `pnpm --filter @vunvault/db lint` passes with zero errors.
☐ `pnpm --filter @vunvault/db typecheck` passes and `pnpm --filter @vunvault/db test` passes (schema-shape tests that import each table and assert column names and enum values).
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ `@vunvault/db/enum-values` can be imported from `packages/contracts` without pulling in `drizzle-orm` (verify by grep: `enum-values.ts` has no import of `drizzle-orm`).
☐ Report at the end: `Task 14 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 15 — Schema: identity, organisations, invitations, WebAuthn, consent

**Layer:** L2

**Prerequisites:** Task 14

**Estimated files touched:** 3

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Schema: identity, organisations, invitations, WebAuthn, consent**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Define the Drizzle tables for organisations, user profiles (mirroring Supabase Auth), staff invitations, WebAuthn credentials, and cookie-consent records.

**Deliverables:**
- `packages/db/src/schema/identity.ts` — all tables below.
- MODIFY `packages/db/src/schema/index.ts` — append `export * from "./identity";`.
- `packages/db/src/schema/identity.test.ts` — asserts table names, key columns, and that RLS is enabled via `getTableConfig`.

**Dependencies allowed:**
- None — use only existing (`drizzle-orm`).

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

N/A — no UI.

**Use the enums from Task 14** (import from `./_enums`): `userRoleEnum`, `accountStatusEnum`, `accessTierEnum`, `teamEnum`, `mfaMethodEnum`, `accountTypeEnum`, `industryEnum`, `invitationStatusEnum`. For `auth.users` use `import { authUsers } from "drizzle-orm/supabase"`.

**Tables (all call `.enableRLS()`; all use `idCol()`/`timestamps` from `_columns.ts` unless stated):**

1. `organizations`
   - `id` uuid pk; `name` text not null; `client_code` text not null unique (human ID, format `VV-CL-48210`); `primary_domain` text null; `industry` industry null; `country` char(2) null; `created_at`, `updated_at`.
   - Index on `lower(name)`.

2. `profiles` — one row per Supabase auth user (identity itself lives in `auth.users`)
   - `id` uuid pk, **references `authUsers.id` on delete cascade** (no `defaultRandom`).
   - `org_id` uuid null → `organizations.id` (clients have an org; staff may not).
   - `email` citext not null unique (lower-cased by the API).
   - `full_name` text not null; `job_title` text null; `phone` text null; `country` char(2) null; `account_type` account_type null.
   - `role` user_role not null default `'client'`.
   - `account_status` account_status not null default `'active'`.
   - `team` team null; `access_tier` access_tier not null default `'standard'`.
   - `base_location` text null (e.g. "Nairobi HQ", "Remote — Mombasa"); `scope_summary` text null (e.g. "Full platform · All modules"); `scope_notes` text null (reviewer-only).
   - `mfa_enrolled` boolean not null default false; `mfa_methods` mfa_method[] not null default `'{}'`.
   - `joined_at` timestamptz not null default now(); `last_active_at` timestamptz null; `access_review_due` date null.
   - `suspended_at` timestamptz null; `suspended_reason` text null; `deleted_at` timestamptz null (soft delete — audit entries must keep resolving actors).
   - `created_at`, `updated_at`.
   - Indexes: `(role)`, `(account_status)`, `(org_id)`, `(last_active_at)`.

3. `staff_invitations`
   - `id`; `email` citext not null; `full_name` text not null; `job_title` text null; `base_location` text null.
   - `role` user_role not null (API validates it is a staff role); `team` team not null; `access_tier` access_tier not null default `'standard'`; `scope_notes` text null; `access_review_due` date null.
   - `invited_by` uuid not null → `profiles.id`.
   - `token_hash` text not null unique (SHA-256 hex of the one-time token; the raw token is never stored).
   - `status` invitation_status not null default `'pending'`.
   - `expires_at` timestamptz not null (API sets now()+72 hours); `accepted_at`, `revoked_at` timestamptz null; `resend_count` integer not null default 0.
   - `checklist` jsonb not null default `'{"mfaEnrolmentMandatory":true,"ndaOnFile":false,"backgroundVerified":false,"trainingAcknowledged":false}'`.
   - `created_at`, `updated_at`. Indexes: `(status, expires_at)`, `(email)`.

4. `webauthn_credentials`
   - `id`; `user_id` uuid not null → `profiles.id` on delete cascade; `credential_id` text not null unique; `public_key` bytea not null; `counter` bigint not null default 0; `transports` text[] not null default `'{}'`; `device_name` text null; `created_at`; `last_used_at` timestamptz null.

5. `consent_records` (append-only by convention)
   - `id`; `user_id` uuid null → `profiles.id` on delete set null; `anonymous_id` uuid null; `categories` jsonb not null — shape `{ strictlyNecessary: true, analytics: boolean, marketing: boolean, functional: boolean }`; `policy_version` text not null; `ip_hash` text null; `user_agent` text null; `created_at`.
   - Check: `(user_id is not null or anonymous_id is not null)`.

---

**Data shape (TypeScript):**
```ts
interface Organization { id: string; name: string; clientCode: string; primaryDomain: string | null; industry: Industry | null; country: string | null; createdAt: Date; updatedAt: Date }
interface Profile {
  id: string; orgId: string | null; email: string; fullName: string; jobTitle: string | null; phone: string | null; country: string | null;
  accountType: "individual" | "company" | null; role: UserRole; accountStatus: AccountStatus; team: Team | null; accessTier: AccessTier;
  baseLocation: string | null; scopeSummary: string | null; scopeNotes: string | null; mfaEnrolled: boolean; mfaMethods: MfaMethod[];
  joinedAt: Date; lastActiveAt: Date | null; accessReviewDue: string | null; suspendedAt: Date | null; suspendedReason: string | null; deletedAt: Date | null;
}
interface StaffInvitation { id: string; email: string; fullName: string; role: UserRole; team: Team; accessTier: AccessTier; status: InvitationStatus; expiresAt: Date; resendCount: number; checklist: { mfaEnrolmentMandatory: boolean; ndaOnFile: boolean; backgroundVerified: boolean; trainingAcknowledged: boolean } }
```

**API contract (as comments only — do NOT implement the backend):**
N/A — schema only. (Auth Hook note for Layer L3: the Supabase Auth Hook reads `profiles.role` and `profiles.org_id` to mint JWT claims `role`, `org_id`, `permissions[]`.)

---

**Out of scope:**
- Do not generate or apply migrations (the operator runs `pnpm --filter @vunvault/db db:generate` separately).
- Do not define scan, billing, content, or audit tables.
- Do not write seed data.

---

**Definition of done:**
☐ `pnpm --filter @vunvault/db typecheck` passes with zero errors.
☐ `pnpm --filter @vunvault/db lint` passes with zero errors.
☐ `pnpm --filter @vunvault/db typecheck` passes and `pnpm --filter @vunvault/db test` passes (schema-shape tests that import each table and assert column names and enum values).
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 15 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 16 — Schema: scan jobs, runs, findings, review gate, pen-test requests

**Layer:** L2

**Prerequisites:** Task 14, Task 15

**Estimated files touched:** 3

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Schema: scan jobs, runs, findings, review gate, pen-test requests**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Define the tables behind the Scan Queue and the Mandatory Admin Review Gate, including human job codes and the pen-test intake requests.

**Deliverables:**
- `packages/db/src/schema/scans.ts` — all tables below.
- MODIFY `packages/db/src/schema/index.ts` — append `export * from "./scans";`.
- `packages/db/src/schema/scans.test.ts` — asserts table names, generated `job_code` expression, unique `(job_id, check_key)`, RLS enabled.

**Dependencies allowed:**
- None — use only existing.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

N/A — no UI.

**Use enums from Task 14:** `scanTypeEnum`, `scanPriorityEnum`, `scanEnvironmentEnum`, `scanStatusEnum`, `reviewGateStateEnum`, `reviewDecisionEnum`, `reviewCheckKeyEnum`, `findingSeverityEnum`, `findingStatusEnum`, `paymentStatusEnum`, `pentestTargetTypeEnum`, `pentestStatusEnum`, `userRoleEnum`. Import `profiles` and `organizations` from `./identity`.

**Tables (all `.enableRLS()`):**

1. `scan_jobs`
   - `id` uuid pk.
   - `job_number` bigint **generated always as identity (start with 4472)**; `job_code` text **generated always as `'JOB-' || lpad(job_number::text, 4, '0')` stored**, unique. (Example codes: `JOB-4471`.)
   - `org_id` uuid not null → organizations; `requested_by` uuid null → profiles; `requester_email` text null (client contact shown in the queue).
   - `target_host` text not null (e.g. `api.horizonsacco.co.ke`, or a CIDR like `10.24.8.0/24`); `target_ip` text null (e.g. `41.90.64.12`); `target_label` text null (e.g. `Internal subnet · 254 hosts`).
   - `environment` scan_environment null.
   - `scan_type` scan_type not null; `priority` scan_priority not null default `'medium'`; `scope_notes` text null (e.g. `Scope: external API + auth flow`).
   - `status` scan_status not null default `'queued'`; `progress` smallint not null default 0 with check `0..100`; `eta_seconds` integer null.
   - `payment_status` payment_status not null default `'pending'`; `review_gate_state` review_gate_state not null default `'not_eligible'`.
   - `assigned_reviewer_id` uuid null → profiles; `released_at` timestamptz null; `released_by` uuid null → profiles.
   - `authorisation_doc_key` text null (object-storage key of the signed authorisation); `authorisation_expires_at` timestamptz null.
   - `requested_at` timestamptz not null default now(); `started_at`, `completed_at`, `cancelled_at` timestamptz null.
   - `created_at`, `updated_at`.
   - Indexes: `(status)`, `(review_gate_state)`, `(payment_status)`, `(org_id, requested_at desc)`, `(requested_at desc)`.
   - Invariant check: `released_at is null or review_gate_state = 'approved_released'`.

2. `scan_runs` (one row per worker attempt; the scan pod is unprivileged and ephemeral)
   - `id`; `job_id` → scan_jobs on delete cascade; `attempt` integer not null default 1; `queue_job_id` text null (BullMQ id); `pod_name` text null; `started_at`, `finished_at` timestamptz null; `exit_code` integer null; `abort_reason` text null (one of `abort`, `kill`, `deadline`, `error`); `line_count` integer not null default 0; `bytes_streamed` bigint not null default 0; `redacted_log_key` text null (object-storage key of the sanitised log: ANSI stripped, credentials redacted, lines capped at 8 KB); `created_at`. Unique `(job_id, attempt)`.

3. `scan_findings`
   - `id`; `job_id` → scan_jobs on delete cascade; `severity` finding_severity not null; `title` text not null; `description` text not null; `evidence_redacted` text null; `cvss` numeric(3,1) null; `cwe` text null; `status` finding_status not null default `'open'`; `validated_by` uuid null → profiles; `validated_at` timestamptz null; `remediation_guidance` text null; `created_at`, `updated_at`. Index `(job_id, severity)`.

4. `review_gate_checks`
   - `id`; `job_id` → scan_jobs on delete cascade; `check_key` review_check_key not null; `passed` boolean not null default false; `checked_by` uuid null → profiles; `checked_at` timestamptz null. **Unique `(job_id, check_key)`**. The five keys correspond to the gate checklist.

5. `review_decisions` (append-only)
   - `id`; `job_id` → scan_jobs; `decision` review_decision not null; `reviewer_id` uuid not null → profiles; `reviewer_role` user_role not null; `note` text not null with check `char_length(note) >= 10`; `gate_timestamp` timestamptz not null default now(); `created_at`.

6. `pentest_requests`
   - `id`; `ref_number` bigint generated always as identity (start 1); `ref_code` text **generated always as `'VV-PT-' || lpad(ref_number::text, 6, '0')` stored**, unique.
   - `org_id` → organizations; `requested_by` → profiles; `target_url` text not null; `target_type` pentest_target_type not null; `preferred_schedule` timestamptz null; `notes` text null; `status` pentest_status not null default `'received'`; `converted_job_id` uuid null → scan_jobs; `created_at`, `updated_at`.

---

**Data shape (TypeScript):**
```ts
interface ScanJob {
  id: string; jobCode: string; orgId: string; requestedBy: string | null; requesterEmail: string | null;
  targetHost: string; targetIp: string | null; targetLabel: string | null; environment: "production" | "staging" | null;
  scanType: ScanType; priority: ScanPriority; scopeNotes: string | null; status: ScanStatus; progress: number; etaSeconds: number | null;
  paymentStatus: PaymentStatus; reviewGateState: ReviewGateState; assignedReviewerId: string | null; releasedAt: Date | null; releasedBy: string | null;
  authorisationDocKey: string | null; authorisationExpiresAt: Date | null; requestedAt: Date; startedAt: Date | null; completedAt: Date | null; cancelledAt: Date | null;
}
interface ReviewDecisionRow { id: string; jobId: string; decision: ReviewDecision; reviewerId: string; reviewerRole: UserRole; note: string; gateTimestamp: Date }
```

**API contract (as comments only — do NOT implement the backend):**
N/A — schema only. (Release lock rule for later layers: a job whose `review_gate_state` is `in_review`, `held_blocked`, `blocked_payment`, or `not_eligible` is invisible to the client portal.)

---

**Out of scope:**
- Do not generate or apply migrations.
- Do not store raw scanner output in the database (only the object-storage key of the sanitised log).
- Do not define billing, content, or audit tables.

---

**Definition of done:**
☐ `pnpm --filter @vunvault/db typecheck` passes with zero errors.
☐ `pnpm --filter @vunvault/db lint` passes with zero errors.
☐ `pnpm --filter @vunvault/db typecheck` passes and `pnpm --filter @vunvault/db test` passes (schema-shape tests that import each table and assert column names and enum values).
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 16 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 17 — Schema: double-entry billing ledger, invoices (derived), FX quotes, USD-only payments

**Layer:** L2

**Prerequisites:** Task 14, Task 15, Task 16

**Estimated files touched:** 4

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Schema: double-entry billing ledger, invoices (derived), FX quotes, USD-only payments**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Define the billing tables around an immutable double-entry ledger, with invoices as presentation records whose amounts are derived from ledger lines, locked FX display quotes, and USD-only payment attempts.

**Deliverables:**
- `packages/db/src/schema/billing.ts` — all tables and the derived view below.
- `packages/db/sql/0017_ledger_constraints.sql` — raw SQL constraints and triggers below.
- MODIFY `packages/db/src/schema/index.ts` — append `export * from "./billing";`.
- `packages/db/src/schema/billing.test.ts` — asserts table names, that no column anywhere is named `card_number`, `pan`, or `cvc`, and that every `settlement_currency` column has default `'USD'`.

**Dependencies allowed:**
- None — use only existing.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

N/A — no UI.

**Money rules (comment at top of `billing.ts`):**
1. **Settlement currency is USD, always.** Amounts are integer **USD cents** (`usdCents()` helper). Local currencies (`KES`, `NGN`, `GHS`, `ZAR`) are display-only and appear ONLY in `fx_quotes`.
2. **The ledger is the source of truth.** An invoice's total / paid / outstanding are derived from ledger lines through a view. Invoices never store a mutable "amount paid".
3. **Never store card numbers.** Only provider tokens, brand, last four digits, expiry.
4. **No cryptocurrency anywhere.**

**Use enums from Task 14:** `invoiceStatusEnum`, `subscriptionStatusEnum`, `billingCycleEnum`, `paymentProviderEnum`, `paymentChannelEnum`, `paymentAttemptStatusEnum`, `displayCurrencyEnum`, `ledgerDirectionEnum`, `ledgerAccountTypeEnum`, `journalKindEnum`. Import `organizations`, `profiles` from `./identity`.

**Tables (all `.enableRLS()`):**

1. `plans` — `id`; `code` text not null unique (e.g. `enterprise_retainer`); `name` text not null (e.g. `Enterprise Client`); `description` text null; `monthly_usd_cents` bigint not null; `active` boolean not null default true; `created_at`.
2. `subscriptions` — `id`; `org_id` → organizations; `plan_id` → plans; `status` subscription_status not null; `billing_cycle` billing_cycle not null; `amount_usd_cents` bigint not null; `settlement_currency` char(3) not null default `'USD'` **check = 'USD'**; `renews_on` date not null; `provider` payment_provider null; `provider_subscription_id` text null; `canceled_at` timestamptz null; `created_at`, `updated_at`. Index `(org_id)`.
3. `payment_methods` — `id`; `org_id` → organizations; `provider` payment_provider not null; `provider_payment_method_id` text not null; `brand` text not null (e.g. `Mastercard`); `last4` char(4) not null; `exp_month` smallint not null; `exp_year` smallint not null; `cardholder_name` text null; `billing_country` char(2) null; `is_default` boolean not null default true; `created_at`. Unique `(provider, provider_payment_method_id)`.
4. `ledger_accounts` — `id`; `code` text not null unique; `name` text not null; `type` ledger_account_type not null. Seed codes (document in a comment, seeding is not part of this task): `accounts_receivable` (asset), `cash_stripe_clearing` (asset), `cash_paystack_clearing` (asset), `revenue_services` (revenue), `revenue_subscription` (revenue), `revenue_academy` (revenue), `refunds` (expense), `deferred_revenue` (liability).
5. `journal_entries` — `id`; `org_id` → organizations; `kind` journal_kind not null; `memo` text null; `occurred_at` timestamptz not null default now(); `reference_type` text null (`invoice` | `payment_attempt`); `reference_id` uuid null; `idempotency_key` text not null unique; `reverses_entry_id` uuid null → journal_entries; `created_by` uuid null → profiles; `created_at`. **Immutable.**
6. `ledger_lines` — `id`; `entry_id` → journal_entries; `account_id` → ledger_accounts; `direction` ledger_direction not null; `amount_usd_cents` bigint not null **check > 0**; `created_at`. Index `(entry_id)`, `(account_id)`. **Immutable.**
7. `invoices` — presentation record only. `id`; `number` text not null unique (format `VV-INV-2026-0841`); `org_id` → organizations; `status` invoice_status not null default `'pending'`; `issued_at` timestamptz not null; `due_at` timestamptz null; `title` text not null (e.g. `Full Scope API PenTest`); `detail` text null (e.g. `Enterprise Retainer · 12 endpoints · retest included`); `settlement_currency` char(3) not null default `'USD'` check = 'USD'; `pdf_object_key` text null; `scan_job_id` uuid null → scan_jobs; `created_at`, `updated_at`. Index `(org_id, issued_at desc)`.
8. `invoice_lines` — `id`; `invoice_id` → invoices on delete cascade; `description` text not null; `quantity` integer not null default 1 check > 0; `unit_usd_cents` bigint not null check >= 0; `ledger_entry_id` uuid null → journal_entries.
9. `fx_quotes` — display-only locked rate. `id`; `org_id` → organizations; `invoice_id` → invoices; `display_currency` display_currency not null; `rate_local_per_usd` numeric(18,8) not null; `usd_cents` bigint not null; `local_minor` bigint not null; `locked_at` timestamptz not null default now(); `expires_at` timestamptz not null (API sets locked_at + 15 minutes); `consumed_at` timestamptz null. Index `(invoice_id, display_currency)`.
10. `payment_attempts` — `id`; `invoice_id` → invoices; `fx_quote_id` uuid null → fx_quotes; `provider` payment_provider not null; `channel` payment_channel not null; `provider_reference` text null; `status` payment_attempt_status not null default `'created'`; `usd_cents` bigint not null check > 0; `settlement_currency` char(3) not null default `'USD'` **check = 'USD'**; `idempotency_key` text not null unique; `failure_code` text null; `created_by` uuid null → profiles; `created_at`, `updated_at`. **A payment attempt always charges `usd_cents` in USD, even when `fx_quote_id` is set.**
11. `provider_webhook_events` — `id`; `provider` payment_provider not null; `event_id` text not null; `payload` jsonb not null; `received_at` timestamptz not null default now(); `processed_at` timestamptz null. Unique `(provider, event_id)` (idempotent webhook handling).

**Derived view `invoice_balances`** (Drizzle `pgView(...).existing()` or `.as(sql)` — create it in the SQL file and declare it with `.existing()`): columns `invoice_id`, `total_usd_cents` (sum of `invoice_lines.quantity * unit_usd_cents`), `paid_usd_cents` (sum of `ledger_lines.amount_usd_cents` credited to `accounts_receivable` by `payment_captured` entries referencing the invoice), `outstanding_usd_cents` (= total − paid, never negative).

**`0017_ledger_constraints.sql` must contain:**
1. A `CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED` on `ledger_lines` that raises when, for any `entry_id`, `sum(amount) filter (direction='debit') <> sum(amount) filter (direction='credit')`. (Double-entry balance.)
2. `BEFORE UPDATE OR DELETE` triggers on `journal_entries` and `ledger_lines` that `RAISE EXCEPTION 'ledger is immutable; post a reversal entry'`.
3. The `CREATE VIEW invoice_balances AS ...` statement.

---

**Data shape (TypeScript):**
```ts
interface Invoice { id: string; number: string; orgId: string; status: InvoiceStatus; issuedAt: Date; dueAt: Date | null; title: string; detail: string | null; settlementCurrency: "USD" }
interface InvoiceBalance { invoiceId: string; totalUsdCents: number; paidUsdCents: number; outstandingUsdCents: number }
interface FxQuote { id: string; invoiceId: string; displayCurrency: DisplayCurrency; rateLocalPerUsd: string; usdCents: number; localMinor: number; lockedAt: Date; expiresAt: Date; consumedAt: Date | null }
interface PaymentAttempt { id: string; invoiceId: string; fxQuoteId: string | null; provider: "stripe" | "paystack"; channel: "card" | "mpesa" | "bank_transfer"; status: PaymentAttemptStatus; usdCents: number; settlementCurrency: "USD" }
```

**API contract (as comments only — do NOT implement the backend):**
N/A — schema only. (FX quote flow for later layers: quote at display time with a locked rate → customer sees the local amount → the provider charge is created for `usd_cents` in USD.)

---

**Out of scope:**
- Do not generate or apply migrations.
- Do not integrate Stripe or Paystack.
- Do not seed accounts, plans, or invoices.
- Do not add any crypto-related column, enum value, or provider.

---

**Definition of done:**
☐ `pnpm --filter @vunvault/db typecheck` passes with zero errors.
☐ `pnpm --filter @vunvault/db lint` passes with zero errors.
☐ `pnpm --filter @vunvault/db typecheck` passes and `pnpm --filter @vunvault/db test` passes (schema-shape tests that import each table and assert column names and enum values).
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 17 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 18 — Schema: content moderation, contact, broadcasts, append-only audit hash chain

**Layer:** L2

**Prerequisites:** Task 14, Task 15

**Estimated files touched:** 4

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Schema: content moderation, contact, broadcasts, append-only audit hash chain**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Define the tables for editorial moderation, public contact messages, advisory broadcasts, and the append-only hash-chained audit log with database-level immutability.

**Deliverables:**
- `packages/db/src/schema/content.ts` — content, reviews, contact, broadcast tables.
- `packages/db/src/schema/audit.ts` — audit entries and checkpoints.
- `packages/db/sql/0018_audit_chain.sql` — append-only triggers, chain-link trigger, genesis row.
- MODIFY `packages/db/src/schema/index.ts` — append `export * from "./content"; export * from "./audit";`.
- `packages/db/src/schema/content-audit.test.ts` — asserts table names, RLS enabled, and that `audit_entries` has columns `seq, prev_hash, hash, signature, key_id`.

**Dependencies allowed:**
- None — use only existing.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

N/A — no UI.

**Use enums from Task 14:** `contentTypeEnum`, `contentStatusEnum`, `riskFlagEnum`, `contentReviewActionEnum`, `contactCategoryEnum`, `contactStatusEnum`, `broadcastStatusEnum`, `auditCategoryEnum`, `auditSeverityEnum`, `teamEnum`. Import `profiles` from `./identity`.

**`content.ts` tables (all `.enableRLS()`):**
1. `content_items` — `id`; `type` content_type not null; `title` text not null; `summary` text null; `body_md` text null; `slug_path` text not null unique (e.g. `/blog/kenya-state-house-cyber-audit`, `/advisories/cve-2026-21447`, `/products/sentinel`, `/news/accra-soc-hub`); `author_id` uuid not null → profiles; `author_team` team null; `status` content_status not null default `'draft'`; `risk_flags` risk_flag[] not null default `'{}'`; `cve_id` text null (advisories only, e.g. `CVE-2026-21447`); `submitted_at`, `published_at`, `scheduled_for` timestamptz null; `created_at`, `updated_at`. Indexes: `(status)`, `(type)`, `(submitted_at desc)`.
2. `content_reviews` (append-only) — `id`; `item_id` → content_items on delete cascade; `reviewer_id` → profiles; `action` content_review_action not null; `note` text null; `created_at`.
3. `contact_messages` — `id`; `name` text not null; `email` citext not null; `organization` text null; `category` contact_category not null; `subject` text not null; `message` text not null; `consent` boolean not null (must be true — add check); `status` contact_status not null default `'new'`; `assigned_to` uuid null → profiles; `ip_hash` text null; `created_at`, `updated_at`. Index `(status, created_at desc)`.
4. `broadcast_jobs` — `id`; `content_item_id` → content_items; `severity_level` smallint not null check between 1 and 3; `status` broadcast_status not null default `'queued'`; `audience_count` integer not null default 0; `sent_count` integer not null default 0; `failed_count` integer not null default 0; `started_at`, `finished_at` timestamptz null; `created_by` → profiles; `created_at`.

**`audit.ts` tables (all `.enableRLS()`):**
1. `audit_entries` — **append-only, hash-chained**.
   - `seq` bigint **generated always as identity** primary key (chain height; genesis is `seq = 1`).
   - `id` uuid not null unique default random.
   - `category` audit_category not null; `event_type` text not null (e.g. `AUTH_SUCCESS`, `AUTH_FAILURE`, `AUTH_MFA_FAILURE`, `AUTH_RATE_LIMIT`, `SCAN_COMPLETE`, `REPORT_RELEASED`, `USER_PROVISIONED`, `PERMISSION_CHANGED`, `ACCOUNT_SUSPENDED`, `ADVISORY_BROADCAST`, `KEY_ROTATION`, `CHAIN_VERIFIED`, `LOG_BACKUP`); `severity` audit_severity not null; `sev_level` smallint null check between 1 and 3 (renders as `SEV-1`…`SEV-3`).
   - `actor_id` uuid null → profiles; `actor_label` text not null (e.g. `e.reed`, `system`, `external`); `ip` inet null; `subject` text null (target of the action, e.g. a user email or job code); `message` text not null.
   - `details` jsonb not null default `'{}'` (non-secret structured data).
   - `sealed_details` bytea null and `nonce` bytea null (AES-256-GCM ciphertext+tag and 12-byte nonce for sensitive fields).
   - `prev_hash` char(64) not null; `hash` char(64) not null unique; `signature` char(64) not null (hex HMAC-SHA256 over `hash`); `key_id` text not null (identifies the HMAC/AES key version; rotated by `KEY_ROTATION`).
   - `created_at` timestamptz not null default now().
   - Indexes: `(created_at desc)`, `(category, created_at desc)`, `(severity, created_at desc)`, `(actor_id, created_at desc)`, `(event_type)`.
2. `audit_checkpoints` — `id`; `verified_at` timestamptz not null default now(); `from_seq` bigint not null; `to_seq` bigint not null; `entries` bigint not null; `mismatches` integer not null default 0; `head_hash` char(64) not null; `verified_by` text not null (`system` or a user label). (Also append-only: reuse the same triggers.)

**Hash computation is done by the API in a later layer** (do NOT compute it in the database): `hash = sha256_hex(prev_hash || canonical_json({category,event_type,severity,actor_label,subject,message,details,created_at}))`.

**`0018_audit_chain.sql` must contain:**
1. `BEFORE UPDATE OR DELETE OR TRUNCATE` triggers on `audit_entries`, `audit_checkpoints` and `content_reviews` raising `EXCEPTION 'audit records are append-only'`.
2. A `BEFORE INSERT` trigger on `audit_entries` that (a) takes `pg_advisory_xact_lock(7340481)`, (b) loads the current head row (`ORDER BY seq DESC LIMIT 1`), (c) raises unless `NEW.prev_hash = head.hash` (or `NEW.prev_hash` is 64 zeros when the table is empty).
3. A genesis `INSERT` (run once, guarded by `WHERE NOT EXISTS`) with: `category = 'system'`, `event_type = 'CHAIN_GENESIS'`, `severity = 'info'`, `actor_label = 'system'`, `message = 'Genesis block'`, `prev_hash = 64 zeros`, `hash = sha256 hex of the string 'VUNVAULT-GENESIS-2024-03-01'` (use `encode(digest('VUNVAULT-GENESIS-2024-03-01','sha256'),'hex')`), `signature = 64 zeros`, `key_id = 'genesis'`, `created_at = '2024-03-01T00:00:00Z'`.
4. A comment: `-- Retention: 7 years, WORM. Never UPDATE/DELETE. Corrections are new entries.`

---

**Data shape (TypeScript):**
```ts
interface AuditEntry {
  seq: number; id: string; category: AuditCategory; eventType: string; severity: AuditSeverity; sevLevel: 1 | 2 | 3 | null;
  actorId: string | null; actorLabel: string; ip: string | null; subject: string | null; message: string; details: Record<string, unknown>;
  prevHash: string; hash: string; signature: string; keyId: string; createdAt: Date;
}
interface ContentItem { id: string; type: ContentType; title: string; summary: string | null; slugPath: string; authorId: string; authorTeam: Team | null; status: ContentStatus; riskFlags: RiskFlag[]; cveId: string | null; submittedAt: Date | null; publishedAt: Date | null; scheduledFor: Date | null }
```

**API contract (as comments only — do NOT implement the backend):**
N/A — schema only. (There is NO update or delete path for audit entries: the database refuses it.)

---

**Out of scope:**
- Do not generate or apply migrations.
- Do not implement hashing, signing, or encryption (Layer L3 owns the audit chain service).
- Do not write any application code that edits or deletes an audit entry.

---

**Definition of done:**
☐ `pnpm --filter @vunvault/db typecheck` passes with zero errors.
☐ `pnpm --filter @vunvault/db lint` passes with zero errors.
☐ `pnpm --filter @vunvault/db typecheck` passes and `pnpm --filter @vunvault/db test` passes (schema-shape tests that import each table and assert column names and enum values).
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 18 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 19 — Contracts A: common envelopes, auth, roles & permissions, users, scans, pen-test requests (+ fixtures)

**Layer:** L2

**Prerequisites:** Task 6, Task 14

**Estimated files touched:** 14

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Contracts A: common envelopes, auth, roles & permissions, users, scans, pen-test requests (+ fixtures)**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Create the Zod schemas, inferred types, permission map and MSW-ready fixtures for common envelopes, authentication, staff/user management, scan queue + review gate, pen-test requests, and the client profile.

**Deliverables:**
- `packages/contracts/src/common.ts` — envelopes, pagination, ids, money.
- `packages/contracts/src/enums.ts` — Zod enums built from `@vunvault/db/enum-values` (`z.enum(USER_ROLES)` etc.) for every enum in Task 14.
- `packages/contracts/src/permissions.ts` — `PERMISSIONS`, `ROLE_PERMISSIONS`, `ROLE_LABELS`, `ROLE_DESCRIPTIONS`.
- `packages/contracts/src/auth.ts` — session, login, signup, MFA schemas.
- `packages/contracts/src/users.ts` — roster, invitations, user actions.
- `packages/contracts/src/scans.ts` — scan jobs, queue filters, gate decision, bulk actions, findings, pen-test requests.
- `packages/contracts/src/profile.ts` — client profile read/update schemas.
- `packages/contracts/fixtures/users.ts`, `fixtures/scans.ts`, `fixtures/profile.ts` — typed fixtures (data below).
- `packages/contracts/src/contracts-a.test.ts` — parse tests.
- MODIFY `packages/contracts/src/index.ts` — export all modules above (not the fixtures).
- MODIFY `packages/contracts/package.json` — add `exports` for `"."` and `"./fixtures/*"`; add dependency.
- `packages/contracts/fixtures/index.ts` — re-exports the three fixture files.
- `packages/contracts/README.md` — 15 lines: how apps import schemas and fixtures.
- `packages/contracts/src/routes-a.ts` — a `ROUTES_A` const documenting method + path + request/response schema names for the endpoints below (typed `as const`, used by later layers for OpenAPI registration).

**Dependencies allowed:**
- `zod` (catalog) in `packages/contracts`.
- `@vunvault/db` is already a workspace dependency (use ONLY the `@vunvault/db/enum-values` subpath).
- Nothing else.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

N/A — no UI. All user-facing strings below are the product's verbatim copy (used by later UI tasks and by fixtures).

**`common.ts`:**
- `ErrorEnvelope = z.object({ error: z.string(), message: z.string().optional(), details: z.array(z.unknown()).optional() })`.
- `paginated(item)` → `z.object({ data: z.array(item), total: z.number().int().nonnegative() })`.
- `PageQuery = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(10), q: z.string().trim().max(200).optional() })`.
- `Uuid`, `IsoDateTime = z.string().datetime()`, `UsdCents = z.number().int().nonnegative()`.

**`permissions.ts` (exact):**
```ts
export const PERMISSIONS = ["dashboard:read","scans:read","scans:create","scans:execute","scans:review","scans:release","intel:read","intel:write","users:read","users:manage","content:author","content:moderate","audit:read","audit:verify","billing:read","billing:manage","support:handle","profile:read","profile:write"] as const;
```
`ROLE_PERMISSIONS` (role → permissions):
- `super_admin`: ALL.
- `admin`: ALL except `users:manage`.
- `security_analyst`: `dashboard:read, scans:read, scans:create, scans:execute, intel:read, intel:write, content:author, profile:read, profile:write`.
- `soc_operator`: `dashboard:read, scans:read, scans:execute, intel:read, profile:read, profile:write`.
- `compliance_auditor`: `dashboard:read, scans:read, audit:read, profile:read, profile:write`.
- `support_engineer`: `support:handle, profile:read, profile:write`.
- `client`: `scans:read, scans:create, billing:read, billing:manage, profile:read, profile:write`.

`ROLE_LABELS`: super_admin `"Super Administrator"`, admin `"Administrator"`, security_analyst `"Security Analyst"`, soc_operator `"SOC Operator"`, compliance_auditor `"Compliance Auditor"`, support_engineer `"Support Engineer"`, client `"Client"`.
`ROLE_DESCRIPTIONS` (verbatim):
- security_analyst: `"Run scans, review findings and author advisories within an assigned scope."`
- soc_operator: `"Monitor live feeds, triage alerts and escalate incidents. No client release authority."`
- compliance_auditor: `"Read-only access to audit logs, reports and regulatory evidence. No execution rights."`
- admin: `"Full operational control including review-gate approval and client release."`
- support_engineer: `"Client ticketing and triage only. No access to scan data or dashboards."`
- super_admin: `"Unrestricted platform control. Reserved for the security leadership team only."`

`TEAM_LABELS`: offensive_security `"Offensive Security"`, soc_detection_response `"SOC — Detection & Response"`, threat_intelligence `"Threat Intelligence"`, security_automation `"Security Automation"`, compliance_audit `"Compliance & Audit"`, client_support `"Client Support"`, curriculum_product `"Curriculum & Product"`, compliance_comms `"Compliance & Comms"`.
`ACCESS_TIER_LABELS`: standard `"Standard — assigned scope only"`, elevated `"Elevated — cross-client read"`, restricted `"Restricted — single client"`.
`ACCOUNT_STATUS_LABELS`: active `"Active"`, pending_invite `"Pending Invite"`, suspended `"Suspended"`, dormant `"Dormant"`.
`SCAN_TYPE_LABELS`: external `"External"`, api `"API"`, internal `"Internal"`, network `"Network"`, mobile `"Mobile"`.
`SCAN_STATUS_LABELS`: running `"Running"`, awaiting_review `"Awaiting Review"`, completed `"Completed"`, queued `"Queued"`, held `"Held"`, rejected `"Rejected"`, cancelled `"Cancelled"`.
`REVIEW_GATE_LABELS`: in_review `"In Review"`, approved_released `"Approved — Released"`, held_blocked `"Held — Blocked"`, blocked_payment `"Blocked — Payment"`, not_eligible `"Not eligible for review"`.
`PAYMENT_STATUS_LABELS`: paid `"Paid"`, pending `"Pending"`, overdue `"Overdue"`.
`REVIEW_CHECK_LABELS` (key → `{ title, description }`, verbatim):
- scope_authorisation_verified: `"Scope authorisation verified"` / `"Signed authorisation on file covers every host in the target list."`
- evidence_sanitised: `"Evidence sanitised"` / `"No production data, credentials or personal information in the report."`
- critical_high_validated: `"Critical & high findings manually validated"` / `"Each severe finding independently reproduced by the reviewer."`
- remediation_guidance_attached: `"Remediation guidance attached"` / `"Prioritised fixes and a re-test window are included in the report."`
- client_redaction_approved: `"Client-ready redaction approved"` / `"Exploit payloads are safely truncated for the client-facing copy."`
`GATE_DECISION_LABELS`: approve_release `"Approve & Release"` (`"Clears the gate and grants the client portal access to the report."`), hold_remediation `"Hold for Remediation"` (`"Keeps the report locked while the client remediates findings."`), reject_archive `"Reject & Archive"` (`"Marks the job invalid and returns it to the analyst for rework."`).
`INDUSTRY_LABELS`: financial_services_fintech `"Financial Services / Fintech"`, sacco_microfinance `"SACCO / Microfinance"`, banking `"Banking"`, insurance `"Insurance"`, healthcare `"Healthcare"`, telecommunications `"Telecommunications"`, government_public_sector `"Government / Public Sector"`, education `"Education"`, retail_ecommerce `"Retail & E-Commerce"`, technology_saas `"Technology / SaaS"`, other `"Other"`.
`PENTEST_TARGET_LABELS`: web_application `"Web Application"`, network_infrastructure `"Network / Infrastructure"`, api `"API"`, mobile_app `"Mobile App"`.
`COUNTRIES` (code → label): KE Kenya, UG Uganda, TZ Tanzania, RW Rwanda, NG Nigeria, GH Ghana, ZA South Africa, EG Egypt, ET Ethiopia, US United States, GB United Kingdom, CA Canada, DE Germany.

**Schemas to implement:**
- `JwtClaims = { sub: Uuid; role: UserRole; org_id: Uuid | null; permissions: Permission[] }`.
- `SessionUser = { id, email, fullName, role, orgId, permissions, mfaEnrolled }`.
- `LoginBody = { email: string email, password: string min 8, remember?: boolean }`; `LoginResponse = { data: { user: SessionUser | null; mfaRequired: boolean; mfaMethods: MfaMethod[] } }`.
- `MfaVerifyBody = z.discriminatedUnion("method", [ { method: "totp", code: string length 6 digits }, { method: "email_otp", code: string length 6 digits }, { method: "webauthn", assertion: unknown } ])`.
- `SignupBody = { fullName: string min 2, email, phone?: string, country: string length 2, accountType: "individual"|"company", password: string min 12, confirmPassword: string, description?: string max 500 }` with a `.refine` that `password === confirmPassword` (path `confirmPassword`, message `"Passwords do not match"`).
- `StaffMember = { id, fullName, email, initials: string, role, team: Team | null, accountStatus, accessTier, baseLocation: string | null, scopeSummary: string | null, mfa: { enrolled: boolean; methods: MfaMethod[] }, joinedAt: IsoDateTime, lastActiveAt: IsoDateTime | null, suspendedAt: IsoDateTime | null, accessReviewDue: string | null }`.
- `StaffListQuery = PageQuery & { role?: UserRole; status?: AccountStatus; mfa?: "enrolled" | "not_enrolled" }`.
- `StaffSummary = { activeMembers: number; securityAnalysts: number; operators: number; pendingInvitations: number; mfaEnrolmentPercent: number; accountsWithoutMfa: number; dormantAccounts: number; onboardedThisMonth: number }`.
- `ProvisionInviteBody = { fullName: string min 2, email: string email ending with "@vunvault.com", jobTitle?: string, baseLocation?: string, role: UserRole (staff roles only — not "client"), team: Team (only the first six teams), accessTier, accessReviewDue?: string date, scopeNotes?: string max 1000, checklist: { mfaEnrolmentMandatory: true; ndaOnFile: boolean; backgroundVerified: boolean; trainingAcknowledged: boolean }, draft?: boolean }`.
- `Invitation = { id, email, fullName, role, team, status, expiresAt, resendCount }`.
- `UserActionBody = { reason?: string max 500 }`; `ChangeRoleBody = { role: UserRole }`.
- `ScanJob` (queue row) `= { id, jobCode, requestedAt, targetHost, targetIp: string | null, targetLabel: string | null, environment: "production" | "staging" | null, client: { orgId, name, contactEmail: string | null }, scopeNotes: string | null, scanType, priority, status, progress: 0..100, etaSeconds: number | null, completedAt: IsoDateTime | null, reviewGateState, paymentStatus }`.
- `ScanListQuery = PageQuery & { status?, gate?: ReviewGateState, payment?: PaymentStatus, type?: ScanType }`.
- `ScanQueueSummary = { jobsInQueue: number; addedToday: number; runningScans: number; workerSlotsUsed: number; workerSlotsTotal: number; awaitingAdminReview: number; approvedReleased: number; releasedThisWeek: number; paymentOutstanding: number; overdueOver14Days: number; heldRejected: number }`.
- `CreateScanBody = { orgId?: Uuid, targetHost: string min 3, scanType, priority: ScanPriority default "medium", environment?: "production"|"staging", scopeNotes?: string max 1000, authorisationDocKey: string }` (the API rejects scans without a signed authorisation reference).
- `GateDecisionBody = { decision: ReviewDecision, checks: Record<ReviewCheckKey, boolean>, note: string min 10 }` with a `.superRefine`: when `decision === "approve_release"` every one of the five `checks` must be `true` (issue message `"All five verification steps must pass before release"`, path `["checks"]`).
- `BulkScanActionBody = { action: "open_review_gate" | "assign_reviewer" | "place_on_hold" | "reject_batch", ids: Uuid[] min 1 max 100, reviewerId?: Uuid }`.
- `ScanFinding = { id, severity, title, description, cvss: number | null, cwe: string | null, status, remediationGuidance: string | null }`.
- `CreatePentestRequestBody = { targetUrl: string min 3, targetType: PentestTargetType, preferredSchedule?: IsoDateTime, notes?: string max 2000 }`; `PentestRequest = { id, refCode: string, targetUrl, targetType, status, createdAt }`.
- `ClientProfile = { id, fullName, jobTitle: string | null, email, phone: string | null, clientCode: string, company: { name, primaryDomain: string | null, industry: Industry | null }, plan: { name: string; status: "active" | "past_due" | "canceled" | "incomplete" } | null, stats: { engagements: number; openFindings: number; nextAssessmentInDays: number | null }, updatedAt: IsoDateTime }`.
- `UpdateProfileBody = { fullName: string min 2, jobTitle?: string, phone?: string, company: { name: string min 2, primaryDomain?: string, industry?: Industry } }`.

**Fixtures (typed against the schemas above; put them in the named fixture files; use year 2026):**

*`fixtures/users.ts` — `staffMembers: StaffMember[]` from this table (derive `initials` from the name; `joinedAt` ≈ Mar 2024 for Reed, Jun 2024 Njoroge, Aug 2024 Mwangi, Jan 2025 Hassan, Feb 2025 Otieno, Apr 2025 Wanjiru, Jul 2025 Kimani; `accessTier: "standard"` except Reed `"elevated"`), plus `staffSummary: { activeMembers: 24, securityAnalysts: 11, operators: 7, pendingInvitations: 4, mfaEnrolmentPercent: 92, accountsWithoutMfa: 2, dormantAccounts: 2, onboardedThisMonth: 3 }` and three pending `invitations` for `j.kariuki@vunvault.com` (Analyst), `m.ochieng@vunvault.com` (Operator), `a.mohamed@vunvault.com` (Analyst):*

| id | fullName | email | role | team | status | mfa | scopeSummary | baseLocation | lastActive |
|---|---|---|---|---|---|---|---|---|---|
| u-reed | Dr. Evelyn Reed | e.reed@vunvault.com | super_admin | — | active | enrolled · webauthn | Full platform · All modules | Nairobi HQ | now |
| u-njoroge | Amara Njoroge | a.njoroge@vunvault.com | admin | offensive_security | active | enrolled · totp | Offensive Security · Pentest queue | Nairobi HQ | 12 min ago |
| u-mwangi | Daniel Mwangi | d.mwangi@vunvault.com | security_analyst | security_automation | active | enrolled · totp | Security Automation · Scan queue | Nairobi HQ | 38 min ago |
| u-hassan | Fatima Hassan | f.hassan@vunvault.com | security_analyst | threat_intelligence | active | enrolled · totp | Threat Intelligence · Zero-Day desk | Remote — Mombasa | 1 h ago |
| u-otieno | Brian Otieno | b.otieno@vunvault.com | soc_operator | soc_detection_response | active | enrolled · totp | SOC · Detection & triage | Nairobi HQ | 5 min ago |
| u-wanjiru | Grace Wanjiru | g.wanjiru@vunvault.com | compliance_auditor | compliance_audit | active | enrolled · totp | Audit Logs · Compliance reporting | Nairobi HQ | Yesterday 17:22 |
| u-kimani | Kevin Kimani | k.kimani@vunvault.com | soc_operator | soc_detection_response | active | NOT enrolled | SOC · Night shift monitoring | Remote — Kisumu | 2 h ago |
| u-mohamed | Aisha Mohamed | a.mohamed@vunvault.com | security_analyst | offensive_security | pending_invite (invited 22 Sep 2026) | NOT enrolled | Onboarding in progress | — | — |
| u-ndegwa | Peter Ndegwa | p.ndegwa@vunvault.com | support_engineer | client_support | suspended (12 Sep 2026) | tokens revoked | Client Support · Ticketing only | — | 12 Sep 08:10 |
| u-achieng | Lucy Achieng | l.achieng@vunvault.com | support_engineer | client_support | dormant (68 days) | review required | Dormant · Access review due | — | 68 days ago |

*`fixtures/scans.ts` — `scanJobs: ScanJob[]` from this table, `scanQueueSummary: { jobsInQueue: 96, addedToday: 14, runningScans: 12, workerSlotsUsed: 12, workerSlotsTotal: 24, awaitingAdminReview: 37, approvedReleased: 1842, releasedThisWeek: 96, paymentOutstanding: 9, overdueOver14Days: 3, heldRejected: 5 }`, and `gateChecklistDefaults` = all five `ReviewCheckKey` → `false`. Fixture-only values (not in the product copy) may be chosen consistently:*

| jobCode | requestedAt (UTC) | targetHost | targetIp / label | env | client | requesterEmail | scope | type | priority | status | progress | eta | gate | payment |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| JOB-4471 | 2026-09-24T06:12 | api.horizonsacco.co.ke | 41.90.64.12 | production | Horizon SACCO | grace@horizonsacco.co.ke | Scope: external API + auth flow | api | critical | running | 78 | 4m 12s | in_review | pending |
| JOB-4470 | 2026-09-24T05:48 | pay.nairobifintech.com | 102.68.77.14 | — | Nairobi Fintech Group | devops@nairobifintech.com | Scope: payment gateway API | api | high | running | 64 | 7m 38s | in_review | paid |
| JOB-4469 | 2026-09-23T21:30 | vault.lakeviewlogistics.com | 10.24.8.11 | — | Lakeview Logistics | security@lakeviewlogistics.com | Scope: internal credential vault | internal | high | running | 41 | 13m 05s | in_review | paid |
| JOB-4468 | 2026-09-23T18:05 | 10.24.8.0/24 | label: Internal subnet · 254 hosts | — | Lakeview Logistics | security@lakeviewlogistics.com | Scope: internal network sweep | network | medium | running | 89 | 1m 47s | in_review | paid |
| JOB-4467 | 2026-09-23T15:22 | mobile.mwananchi.co.ke | 41.90.12.88 | — | Mwananchi Microfinance | mobile@mwananchi.co.ke | Scope: Android + iOS API surface | mobile | medium | queued | 0 | — | not_eligible | pending |
| JOB-4466 | 2026-09-22T11:14 | core.kijaniagri.co.ke | 41.90.55.21 | — | Kijani Agri Co-op | it@kijaniagri.co.ke | Scope: public web perimeter | external | high | completed (2026-09-22T14:02) | 100 | — | approved_released | paid |
| JOB-4465 | 2026-09-21T09:47 | portal.techbridge.co.ke | 197.248.10.4 | staging | TechBridge Solutions | admin@techbridge.co.ke | Scope: customer portal + SSO | external | medium | held | 100 | — | held_blocked | paid |
| JOB-4464 | 2026-09-21T07:03 | auth.mwananchi.co.ke | 41.90.12.90 | — | Mwananchi Microfinance | security@mwananchi.co.ke | Scope: authentication & token service | api | high | completed (2026-09-21T09:41) | 100 | — | in_review | paid |
| JOB-4463 | 2026-09-20T13:26 | vpn.nairobifintech.com | 102.68.77.20 | — | Nairobi Fintech Group | devops@nairobifintech.com | Scope: VPN concentrator & MFA | network | medium | completed (2026-09-20T16:12) | 100 | — | in_review | overdue |
| JOB-4462 | 2026-09-19T10:58 | shop.kijaniagri.co.ke | 41.90.55.30 | — | Kijani Agri Co-op | it@kijaniagri.co.ke | Scope: e-commerce storefront | external | low | completed (2026-09-19T12:44) | 100 | — | approved_released | paid |

*`fixtures/profile.ts` — `clientProfile`: fullName `"Jane Wanjiru"`, jobTitle `"Head of Information Security"`, email `"jane.wanjiru@acmefintech.co.ke"`, clientCode `"VV-CL-48210"`, company `{ name: "Acme Fintech Ltd", primaryDomain: null, industry: "financial_services_fintech" }`, plan `{ name: "Enterprise Client", status: "active" }`, stats `{ engagements: 7, openFindings: 12, nextAssessmentInDays: 14 }`, updatedAt `"2026-08-18T09:14:00Z"`.*

---

**Data shape (TypeScript):**
```ts
// All types are inferred: export type X = z.infer<typeof X>;  (e.g. type ScanJob, type StaffMember, type GateDecisionBody)
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// Document these in routes-a.ts (method, path, request schema, response schema, error codes). Do NOT implement.
// POST   /api/v1/auth/signup                       body SignupBody            → 201 { data: SessionUser }       | 400 validation_failed | 409 { error: "email_taken" }
// POST   /api/v1/auth/login                        body LoginBody             → 200 LoginResponse               | 401 { error: "invalid_credentials" } | 429 rate_limited
// POST   /api/v1/auth/mfa/verify                   body MfaVerifyBody         → 200 { data: SessionUser }       | 401 { error: "mfa_failed" }
// POST   /api/v1/auth/logout                                                   → 204
// GET    /api/v1/auth/session                                                  → 200 { data: SessionUser }       | 401 unauthorized
// GET    /api/v1/profile                                                       → 200 { data: ClientProfile }
// PATCH  /api/v1/profile                          body UpdateProfileBody     → 200 { data: ClientProfile }
// GET    /api/v1/admin/users                      query StaffListQuery       → 200 { data: StaffMember[]; total }
// GET    /api/v1/admin/users/summary                                           → 200 { data: StaffSummary }
// POST   /api/v1/admin/users/invitations          body ProvisionInviteBody   → 201 { data: Invitation }        | 403 forbidden
// POST   /api/v1/admin/users/invitations/:id/resend                            → 200 { data: Invitation }
// DELETE /api/v1/admin/users/invitations/:id                                   → 204
// POST   /api/v1/admin/users/:id/suspend | /reactivate | /enforce-mfa  body UserActionBody → 200 { data: StaffMember }
// PATCH  /api/v1/admin/users/:id/role             body ChangeRoleBody        → 200 { data: StaffMember }
// DELETE /api/v1/admin/users/:id                                               → 204
// GET    /api/v1/scans                            query ScanListQuery        → 200 { data: ScanJob[]; total }   (clients: only released jobs of their org)
// POST   /api/v1/scans                            body CreateScanBody        → 201 { data: ScanJob }
// GET    /api/v1/admin/scans                      query ScanListQuery        → 200 { data: ScanJob[]; total }
// GET    /api/v1/admin/scans/summary                                           → 200 { data: ScanQueueSummary }
// POST   /api/v1/admin/scans/:id/gate-decision    body GateDecisionBody      → 200 { data: ScanJob }           | 409 { error: "payment_outstanding" }
// POST   /api/v1/admin/scans/bulk                 body BulkScanActionBody    → 200 { data: { updated: number } }
// POST   /api/v1/admin/scans/:id/request-payment | /cancel                     → 200 { data: ScanJob }
// GET    /api/v1/scans/:id/stream                 (WebSocket upgrade; server→client text frames; client→server frames limited to {type:"abort"|"pause"|"resume"|"kill"})
// POST   /api/v1/pentest-requests                 body CreatePentestRequestBody → 201 { data: PentestRequest }
```

---

**Out of scope:**
- Do not implement any endpoint, handler, or MSW handler — only schemas, types, label maps, fixtures and the `ROUTES_A` documentation constant.
- Do not import `drizzle-orm` anywhere in this package.
- Do not add billing, content, audit, or contact schemas (Task 20).
- Do not modify `packages/db`.

---

**Definition of done:**
☐ `pnpm --filter @vunvault/contracts typecheck` passes with zero errors.
☐ `pnpm --filter @vunvault/contracts lint` passes with zero errors.
☐ `pnpm --filter @vunvault/contracts test` passes: every schema has a parse-success test using its fixture and at least one parse-failure test.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Every fixture file type-checks against its schema and has a test that runs `schema.parse(fixture)` for each row.
☐ `GateDecisionBody` test: `approve_release` with one unchecked check fails with path `["checks"]`; `hold_remediation` with unchecked checks passes.
☐ Report at the end: `Task 19 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 20 — Contracts B: billing & FX, content moderation, audit, contact, consent (+ fixtures)

**Layer:** L2

**Prerequisites:** Task 6, Task 14, Task 19

**Estimated files touched:** 11

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Contracts B: billing & FX, content moderation, audit, contact, consent (+ fixtures)**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Create the Zod schemas, inferred types, label maps and fixtures for billing (USD settlement + FX quote flow), content moderation, the audit trail, public contact messages and cookie consent.

**Deliverables:**
- `packages/contracts/src/billing.ts` — subscription, payment method, invoices, FX quote, checkout.
- `packages/contracts/src/content.ts` — moderation queue, actions, public content.
- `packages/contracts/src/audit.ts` — audit entries, filters, chain verification, SSE event.
- `packages/contracts/src/contact.ts` — contact body, consent body.
- `packages/contracts/src/routes-b.ts` — `ROUTES_B` documentation constant for the endpoints below.
- `packages/contracts/fixtures/billing.ts`, `fixtures/content.ts`, `fixtures/audit.ts` — typed fixtures (data below).
- `packages/contracts/src/contracts-b.test.ts` — parse tests.
- MODIFY `packages/contracts/fixtures/index.ts` — re-export the three new fixture files.
- MODIFY `packages/contracts/src/index.ts` — export the four new modules and `ROUTES_B`.
- MODIFY `packages/contracts/src/enums.ts` — no edits unless an enum Zod wrapper is missing; do not change values.

**Dependencies allowed:**
- None — use only existing.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

N/A — no UI. User-facing strings are verbatim product copy for later UI tasks.

**Money rules (comment at the top of `billing.ts`):** USD cents are the ONLY charged amount. Display currencies are `USD | KES | NGN | GHS | ZAR` and are display-only. The FX quote flow is: (1) client requests a quote for an invoice + display currency → (2) server returns a locked rate valid for 15 minutes with `usdCents` and `localMinor` → (3) checkout charges `usdCents` in USD through Stripe (international cards) or Paystack (African cards, M-Pesa, bank). Never accept a charge amount in a non-USD currency. No cryptocurrency.

**Schemas to implement:**
- `Subscription = { id, planName: string, status: "active"|"past_due"|"canceled"|"incomplete", billingCycle: "monthly"|"annual", amountUsdCents: UsdCents, settlementCurrency: z.literal("USD"), renewsOn: string (date), description: string }`.
- `PaymentMethodView = { id, provider: "stripe"|"paystack", brand: string, last4: string length 4, expMonth: 1..12, expYear: number, cardholderName: string | null, billingCountry: string | null }` (never a PAN, never a CVC).
- `UpdatePaymentMethodBody = { provider: "stripe"|"paystack", providerPaymentMethodToken: string, cardholderName: string min 2, billingCountry: string length 2 }` (the browser tokenises the card with the provider; our API never sees raw card data).
- `Invoice = { id, number: string regex ^VV-INV-\d{4}-\d{4,}$, issuedAt: IsoDateTime, title: string, detail: string | null, totalUsdCents, paidUsdCents, outstandingUsdCents, status: InvoiceStatus, settlementCurrency: z.literal("USD"), pdfAvailable: boolean }`.
- `InvoiceListQuery = PageQuery & { status?: InvoiceStatus }`.
- `FxQuoteRequest = { invoiceId: Uuid, displayCurrency: DisplayCurrency }`.
- `FxQuote = { id, invoiceId, displayCurrency, rateLocalPerUsd: string decimal, usdCents, localMinor: number int, lockedAt, expiresAt, settlementCurrency: z.literal("USD") }`.
- `CheckoutBody = { invoiceId: Uuid, fxQuoteId: Uuid.optional(), provider: "stripe"|"paystack", channel: "card"|"mpesa"|"bank_transfer", providerPaymentMethodToken?: string, idempotencyKey: string min 16 }` with `.superRefine`: `channel === "mpesa"` requires `provider === "paystack"`.
- `CheckoutResponse = { data: { paymentAttemptId: Uuid, status: "created"|"requires_action"|"succeeded"|"failed", usdCents: UsdCents, settlementCurrency: "USD", clientSecret?: string, redirectUrl?: string } }`.
- `ContentType`/`ContentStatus`/`RiskFlag` Zod enums come from Task 19 `enums.ts`.
- `ModerationItem = { id, title, summary: string | null, type: ContentType, slugPath: string, author: { id, fullName, initials, team: Team | null }, submittedAt: IsoDateTime, riskFlags: RiskFlag[], status: ContentStatus, cveId: string | null }`.
- `ModerationQuery = PageQuery & { type?: ContentType, status?: ContentStatus, flag?: RiskFlag | "none" }`.
- `ModerationSummary = { awaitingReview: number; changesRequested: number; approvedToday: number; rejectedLast7Days: number; avgReviewHours: number; publishedLast30Days: number }`.
- `ModerationActionBody = { action: ContentReviewAction, note?: string max 1000, scheduledFor?: IsoDateTime }` with `.superRefine`: `reject` and `request_changes` require `note` (min 10); `schedule` requires `scheduledFor`.
- `PublicContentItem = { id, type, title, summary: string | null, slugPath, publishedAt: IsoDateTime, author: { fullName: string } }`.
- `AuditEntryView = { seq: number, id: Uuid, category: AuditCategory, eventType: string, severity: AuditSeverity, sevLevel: 1|2|3|null, actorLabel: string, message: string, ip: string | null, subject: string | null, hash: string length 64, prevHash: string length 64, createdAt: IsoDateTime }`.
- `AuditQuery = PageQuery & { category?: AuditCategory, severity?: AuditSeverity, actor?: string, range?: "1h" | "6h" | "24h" | "7d" | "30d" }` (default range `"24h"`).
- `AuditSummary = { events24h: number, authAttempts: number, failedAuth: number, lockedOut: number, scanCompletions: number, reportReleases: number, chainIntegrityPercent: number, hashMismatches: number, retentionYears: number }`.
- `ChainStatus = { state: "intact" | "broken", totalEntries: number, genesisDate: string, lastVerifiedAt: IsoDateTime | null, hashMismatches: number, headHash: string, node: string, encryption: z.literal("AES-256-GCM") }`.
- `VerifyChainResult = { checkedFromSeq: number, checkedToSeq: number, entries: number, mismatches: number, firstMismatchSeq: number | null, verifiedAt: IsoDateTime }`.
- `AuditStreamEvent = { type: "entry" | "heartbeat" | "chain", entry?: AuditEntryView, chain?: ChainStatus }` (delivered over SSE).
- `AUDIT_CATEGORY_LABELS`: authentication `"Authentication"`, scan_completion `"Scan Completion"`, report_release `"Report Release"`, administrative `"Administrative"`, security_event `"Security Event"`, system `"System"`. `AUDIT_SEVERITY_LABELS`: ok `"Success / OK"`, info `"Informational"`, warning `"Warning"`, critical `"Critical"`. `AUDIT_RANGE_LABELS`: 1h `"Last hour"`, 6h `"Last 6 hours"`, 24h `"Last 24 hours"`, 7d `"Last 7 days"`, 30d `"Last 30 days"`.
- `CONTENT_TYPE_LABELS`: blog_post `"Blog Post"`, news_announcement `"News Announcement"`, threat_advisory `"Threat Advisory"`, product_listing `"Product Listing"`. `CONTENT_STATUS_LABELS`: pending_review `"Pending Review"`, in_review `"In Review"`, approved `"Approved"`, rejected `"Rejected"`, changes_requested `"Changes Requested"`, draft `"Draft"`, scheduled `"Scheduled"`, published `"Published"`. `RISK_FLAG_LABELS`: legal_review_required `"Legal review required"`, contains_pii `"Contains PII"`, unverified_claim `"Unverified claim"`, brand_sensitive `"Brand-sensitive"`.
- `ContactBody = { name: string min 2, email, organization?: string, category: ContactCategory, subject: string min 3, message: string min 10 max 5000, consent: z.literal(true, { message: "Consent is required" }) }`. `CONTACT_CATEGORY_LABELS`: penetration_testing_request `"Penetration Testing Request"`, vulnerability_report `"Vulnerability / Bug Report"`, journalist_blogger_profile_request `"Journalist / Blogger Profile Request"`, whistleblower_tip `"Whistleblower Tip"`, general_support `"General Support"`.
- `ConsentBody = { categories: { strictlyNecessary: z.literal(true), analytics: boolean, marketing: boolean, functional: boolean }, policyVersion: string }`. Presets exported as constants: `CONSENT_ACCEPT_ALL` (all true), `CONSENT_ESSENTIAL_ONLY` (only strictlyNecessary true).

**Fixtures (use year 2026):**

*`fixtures/billing.ts`:* `subscription` = `{ planName: "Enterprise Client", status: "active", billingCycle: "monthly", amountUsdCents: 249900, settlementCurrency: "USD", renewsOn: "2026-10-14", description: "Full-scope retainer protection with 24/7 attack-surface monitoring, quarterly penetration testing and a dedicated security architect." }`; `paymentMethod` = `{ provider: "stripe", brand: "Mastercard", last4: "4290", expMonth: 9, expYear: 2028, cardholderName: "JANE WANJIRU", billingCountry: "KE" }`; `invoices` from the table below (`totalUsdCents` from `usd`; `paidUsdCents` equals total when `paid`, else 0; `pdfAvailable: true`); and `fxQuoteKes` = `{ displayCurrency: "KES", rateLocalPerUsd: "129.50000000", usdCents: 249900, localMinor: 32362050, settlementCurrency: "USD" }`.

| number | issuedAt | title | detail | usd | status |
|---|---|---|---|---|---|
| VV-INV-2026-0902 | 2026-09-18 | Enterprise Retainer — Monthly | 24/7 attack surface monitoring · quarterly pentest credit | $2,499.00 | pending (Awaiting Payment) |
| VV-INV-2026-0841 | 2026-08-18 | Full Scope API PenTest | Enterprise Retainer · 12 endpoints · retest included | $2,499.00 | paid |
| VV-INV-2026-0720 | 2026-07-18 | Enterprise Retainer — Monthly | 24/7 attack surface monitoring · quarterly pentest credit | $2,499.00 | paid |
| VV-INV-2026-0613 | 2026-06-18 | Enterprise Retainer — Monthly | 24/7 attack surface monitoring · quarterly pentest credit | $2,499.00 | paid |
| VV-INV-2026-0511 | 2026-05-12 | VUNVAULT Academy — Team Subscription | 12 seats · SOC Analyst & Red Team tracks · annual | $1,440.00 | paid |
| VV-INV-2026-0488 | 2026-05-02 | Mobile App PenTest — iOS & Android | M-Pesa gateway integration review · one-off engagement | $899.00 | paid |

*`fixtures/content.ts` — `moderationItems` from this table (summaries: use the first sentence of the product's description for each; for the five lacking a verbatim summary here, write a one-line neutral fixture-only summary), plus `moderationSummary = { awaitingReview: 14, changesRequested: 5, approvedToday: 9, rejectedLast7Days: 3, avgReviewHours: 2.4, publishedLast30Days: 62 }`:*

| title | type | slugPath | author (team) | submittedAt | flags | status |
|---|---|---|---|---|---|---|
| Kenya State House Cyber Security Audit & Risk Analysis | blog_post | /blog/kenya-state-house-cyber-audit | Amara Njoroge (Offensive Security) | 2026-09-24T08:12 | legal_review_required, brand_sensitive | pending_review |
| Apache Struts 2 OGNL Injection — Emergency Client Advisory | threat_advisory | /advisories/cve-2026-21447 | Fatima Hassan (Threat Intelligence) | 2026-09-24T09:02 | — | pending_review |
| VUNVAULT Sentinel — Continuous Attack Surface Monitoring | product_listing | /products/sentinel | Brian Otieno (Curriculum & Product) | 2026-09-23T16:48 | unverified_claim | changes_requested |
| VUNVAULT Partners With East African Fintech Alliance | news_announcement | /news/east-african-fintech-alliance | Grace Wanjiru (Compliance & Comms) | 2026-09-23T11:30 | — | in_review |
| Africa's Cyber Awakening: How the Continent Is Fighting Back | blog_post | /blog/africa-cyber-awakening | Amara Njoroge (Offensive Security) | 2026-09-22T14:20 | unverified_claim | rejected |
| VUNVAULT Opens Regional Security Operations Hub in Accra | news_announcement | /news/accra-soc-hub | Grace Wanjiru (Compliance & Comms) | 2026-09-21T10:15 | — | approved |

*`fixtures/audit.ts` — `auditEntries` from this table (generate stable fake 64-hex `hash`/`prevHash` values that chain correctly in listed order, newest first), `auditSummary = { events24h: 1482, authAttempts: 316, failedAuth: 9, lockedOut: 2, scanCompletions: 96, reportReleases: 23, chainIntegrityPercent: 100, hashMismatches: 0, retentionYears: 7 }`, and `chainStatus = { state: "intact", totalEntries: 1482904, genesisDate: "2024-03-01", lastVerifiedAt: "2026-09-24T06:00:00Z", hashMismatches: 0, headHash: "0x7f3a9c21d48b05e6", node: "node-nbo-01 · NBO-CORE", encryption: "AES-256-GCM" }`:*

| time (UTC, 2026-09-24) | category | eventType | severity | actor | message |
|---|---|---|---|---|---|
| 09:38:04 | security_event | AUTH_RATE_LIMIT | warning | system | 5 failed attempts in 90 s from 41.90.64.199 targeting admin@vunvault.com · source IP temporarily blocked for 15 min |
| 09:36:48 | scan_completion | SCAN_COMPLETE | ok | system | JOB-4471 against api.horizonsacco.co.ke finished in 4 m 12 s · 3 findings (1 critical, 1 high, 1 medium) |
| 09:34:21 | report_release | REPORT_RELEASED | ok | f.hassan | Report approved at the Mandatory Admin Review Gate and released to Horizon SACCO client portal · reviewer note attached |
| 09:32:09 | authentication | AUTH_FAILURE | critical | external | Login attempt from 185.220.101.42 (TOR exit node) against admin@vunvault.com · source denied by geo-block policy |
| 09:28:55 | administrative | USER_PROVISIONED | info | e.reed | Invitation issued to a.mohamed@vunvault.com as Security Analyst — Offensive Security · MFA enrolment required within 72 h |
| 09:24:11 | authentication | AUTH_SUCCESS | ok | a.njoroge | a.njoroge@vunvault.com signed in from 41.90.32.10 · TOTP verified |
| 09:12:04 | administrative | PERMISSION_CHANGED | warning (SEV-2) | e.reed | Role elevated for d.mwangi@vunvault.com — granted Security Automation scope |
| 09:06:47 | administrative | ADVISORY_BROADCAST | critical (SEV-1) | f.hassan | CVE-2026-21447 emergency advisory pushed to 312 client dashboards |
| 08:00:00 | system | KEY_ROTATION | info | system | Audit log encryption key rotated by KMS · previous key archived to cold storage |
| 06:00:00 | system | CHAIN_VERIFIED | ok | system | Hourly hash chain integrity check completed · 1,482 entries · 0 mismatches |

---

**Data shape (TypeScript):**
```ts
// All types are inferred: export type X = z.infer<typeof X>;
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// Document these in routes-b.ts. Do NOT implement.
// GET    /api/v1/billing/subscription                                      → 200 { data: Subscription }
// GET    /api/v1/billing/payment-method                                    → 200 { data: PaymentMethodView }
// PUT    /api/v1/billing/payment-method   body UpdatePaymentMethodBody     → 200 { data: PaymentMethodView }
// GET    /api/v1/billing/invoices         query InvoiceListQuery           → 200 { data: Invoice[]; total }
// GET    /api/v1/billing/invoices/:id/pdf                                  → 200 application/pdf | 404 not_found
// GET    /api/v1/billing/invoices.csv                                      → 200 text/csv
// POST   /api/v1/billing/fx-quotes        body FxQuoteRequest              → 201 { data: FxQuote }              | 422 { error: "unsupported_currency" }
// POST   /api/v1/billing/checkout         body CheckoutBody                → 201 CheckoutResponse               | 409 { error: "quote_expired" } | 409 { error: "already_paid" }
// POST   /api/v1/webhooks/stripe | /api/v1/webhooks/paystack  (raw body, signature-verified, idempotent) → 200 { received: true }
// GET    /api/v1/admin/content            query ModerationQuery            → 200 { data: ModerationItem[]; total }
// GET    /api/v1/admin/content/summary                                     → 200 { data: ModerationSummary }
// POST   /api/v1/admin/content/:id/actions body ModerationActionBody       → 200 { data: ModerationItem }       | 400 validation_failed
// GET    /api/v1/content                  query PageQuery & { type? }      → 200 { data: PublicContentItem[]; total }   (public, published only)
// GET    /api/v1/admin/audit              query AuditQuery                 → 200 { data: AuditEntryView[]; total }
// GET    /api/v1/admin/audit/summary                                       → 200 { data: AuditSummary }
// GET    /api/v1/admin/audit/chain                                         → 200 { data: ChainStatus }
// POST   /api/v1/admin/audit/verify                                        → 200 { data: VerifyChainResult }
// GET    /api/v1/admin/audit/export       query AuditQuery                 → 200 text/csv
// GET    /api/v1/admin/audit/stream       (SSE, text/event-stream; data: AuditStreamEvent)
// NOTE: there is intentionally NO PUT/PATCH/DELETE route for audit entries — the chain is append-only.
// POST   /api/v1/contact                  body ContactBody                 → 201 { data: { id: Uuid } }         | 400 validation_failed | 429 rate_limited
// POST   /api/v1/consent                  body ConsentBody                 → 204
```

---

**Out of scope:**
- Do not implement any endpoint, handler, or MSW handler.
- Do not add any crypto-related currency, provider, or field.
- Do not accept or model a raw card number or CVC anywhere.
- Do not add a schema that permits editing or deleting an audit entry.
- Do not modify files from Task 19 except the two index re-exports listed in Deliverables.

---

**Definition of done:**
☐ `pnpm --filter @vunvault/contracts typecheck` passes with zero errors.
☐ `pnpm --filter @vunvault/contracts lint` passes with zero errors.
☐ `pnpm --filter @vunvault/contracts test` passes: every schema has a parse-success test using its fixture and at least one parse-failure test.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Test: `CheckoutBody` with `channel: "mpesa"` and `provider: "stripe"` fails.
☐ Test: `ModerationActionBody` with `action: "reject"` and no note fails; `schedule` without `scheduledFor` fails.
☐ Test: `FxQuote.settlementCurrency` rejects any value except `"USD"`.
☐ Report at the end: `Task 20 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---


This is Part 1 of 5. Say "continue" to receive Part 2.

# VUNVAULT — Task Catalogue for coder.qwen.ai

## Part 3 of 5 — Backend addenda (40b–40e), L5 frontend foundation, L6 public site, L7 auth & onboarding

## What changed in this part (read first)

Mapping the public site and auth pages against Parts 1–2 exposed **backend gaps**. They are fixed with four lettered tasks that run **after Task 40 and before Task 41**: `40 → 40b → 40c → 40d → 40e → 41`.

| Gap found in the prototype | Task |
|---|---|
| Premium product catalogue ($49–$199 licences), downloads, newsletter signup, blog severity/category/search/detail | 40b (schema + contracts), 40c (routes) |
| Signup is a verified 3-step flow (email code → authenticator → done); Part 2 had skipped email verification | 40d (**modifies Task 26's signup route** and its contract) |
| Forgot / reset password | 40d |
| Google / GitHub / Microsoft sign-in buttons | 40e |

**Splits (size limit):** About, Services and Products were each too large for one session, so they are `53/53b`, `54/54b`, `55/55b` (the first task leaves null stubs, the second overwrites them). Home is five tasks (47–52).

**How these UI prompts are built.** The prototype pages are Tailwind-class HTML. Each prompt embeds the *actual markup* (icons replaced by a placeholder, repeated siblings compressed into a bracketed note that still lists their text) plus the custom CSS for the classes it uses, extracted mechanically from your files, so copy and layout are verbatim rather than paraphrased. Where the markup shows `[+N more sibling … their text content in order: …]`, build N+1 items from that text.

**Deliberate deviations from the prototype (all flagged inside the tasks):**
1. No `localStorage` / `sessionStorage` anywhere. The prototype used them for posts, contact requests, consent and the preloader; the API (or in-memory state) replaces them.
2. Login password minimum is 8 (API contract) not 6; signup password minimum is 12 not 8.
3. Signup keeps the prototype's mandatory authenticator step, but uses a real QR + secret from Supabase MFA; all "Test mode" OTP/secret hints are removed.
4. Login footer says "Zero-knowledge credential handling" — kept verbatim, but it isn't true for this platform; **please decide whether to change it**.
5. M-Pesa/USD limitation (Part 2 note 7) still applies to the Buy Now → billing flow.

**Not built because no prototype was supplied:** the floating "Open AI Security Agent" button (no panel exists in the files), `/team/*` pages, Academy course pages, a News page, `payment.html` (replaced by Task 66), Terms/Privacy pages, portal Academy-progress and Scanner pages (placeholder routes only, Task 74), and the `public/vunvault-pgp.asc` key file (operator adds it).

**Operator pre-steps:** copy `logo.svg` to `apps/web/public/brand/logo.svg` before Task 41; run `pnpm dlx msw init apps/web/public/` after Task 42; set the Cloudflare Turnstile and provider keys later (Layer L13).

## Reserved numbering for remaining parts (updated again)

| Reserved | Layer | Scope | Part |
|---|---|---|---|
| 66–74 | L8 | Client portal: **66** Billing & Invoices with FX quote + USD checkout, **67** Password Manager, **68** Client profile, **69** Scans list/detail/findings (portal home), **70** Advisories feed + acknowledge, **71** Content Studio list + status, **72** Content Studio editor, **73** Licences & downloads, **74** Academy / Scanner placeholder routes | 4 |
| 75–83 | L9 | Admin: Command Center dashboard, Scan Queue, Review Gate dialog, User Management, Zero-Day Editor, Content Moderation, Audit Logs (+ SSE ticker), Profile Settings (security, sessions, notifications), Payments admin | 4 |
| 84–88 | L10 | Scan worker (unprivileged Docker + adapters + WebSocket relay) | 4 |
| 89–92 | L11 | Background workers: broadcast, maintenance (rollups, heartbeats, threat level, purge, scheduled publish, stale signups) | 5 |
| 93–96 | L12 | Real-time wiring: audit SSE, broadcast progress SSE, scan WebSocket terminal | 5 |
| 97–104 | L13 | DevOps: Dockerfiles, Terraform (OCI + Cloudflare), Helm, GitHub Actions | 5 |
| 105–110 | L14 | Integration, E2E, hardening | 5 |

**Plan total:** 20 (Part 1) + 3 + 20 (Part 2) + 4 + 25 (this part's numbered/lettered UI tasks incl. splits) + 45 reserved ≈ **117 tasks**. Part 2's reserved table (L8 onward) is superseded by the one above.

## Sequence Overview (this part)

| # | Layer | Task title | Depends on | Files touched |
|---|---|---|---|---|
| 40b | L4 | Marketing backend addendum A: products, entitlements, newsletter, richer public content (schema + contracts) | Task 15, Task 17, Task 18, Task 20, Task 20c, Task 20d, Task 40 | 11 |
| 40c | L4 | Marketing backend addendum B: public content detail, product catalogue + purchase + entitlements, newsletter (routes) | Task 32, Task 33, Task 34, Task 36, Task 39, Task 40, Task 40b | 14 |
| 40d | L4 | Auth addendum A: signup with email-OTP verification, forgot / reset password | Task 20d, Task 22, Task 24, Task 25, Task 26, Task 27, Task 40 | 16 |
| 40e | L4 | Auth addendum B: OAuth sign-in (Google, GitHub, Microsoft) via Supabase PKCE | Task 24, Task 26, Task 27, Task 40d | 8 |
| 41 | L5 | Next.js 15 app skeleton: config, Tailwind v4 wiring, fonts, root layout, route groups | Task 3, Task 5, Task 13, Task 40c | 14 |
| 42 | L5 | Client runtime: providers, API bootstrap, session store, MSW mock layer | Task 7, Task 11, Task 19, Task 41 | 14 |
| 43 | L5 | Edge middleware (nonce CSP, route guards), permission helpers, server session, error pages | Task 41, Task 42 | 12 |
| 44 | L5 | Marketing layout: header, mobile drawer, auth-aware nav, footer variants, preloader gate | Task 13, Task 41, Task 42, Task 43 | 12 |
| 45 | L5 | Client portal layout: header, mobile drawer, footer, Request PenTest dialog | Task 11, Task 10, Task 30, Task 42, Task 43, Task 44 | 12 |
| 46 | L5 | Admin layout: Command Center header, permission-filtered nav, mobile drawer, footer, staff guard | Task 8, Task 42, Task 43 | 11 |
| 47 | L6 | Home page A: hero with Live Attack Surface panel and CVE ticker | Task 5, Task 8, Task 44 | 8 |
| 48 | L6 | Free Scanner: CTA banner, terminal dialog and simulated scan engine | Task 8, Task 11, Task 44 | 9 |
| 49 | L6 | Home page B: attack-surface mapping, rotating Insights grid, organisation segments | Task 40c, Task 42, Task 44, Task 47 | 10 |
| 50 | L6 | Home page C: Zero-Day Exploit Tracking dashboard widget | Task 8, Task 9, Task 44, Task 47 | 7 |
| 51 | L6 | Home page D: Academy tracks and Plans & Pricing | Task 8, Task 44, Task 47 | 7 |
| 52 | L6 | Home page E: Press, Contributors, Contact — and final home route assembly | Task 44, Task 47, Task 48, Task 49, Task 50, Task 51 | 10 |
| 53 | L6 | About page A: hero, mission & vision, pillars, closing band | Task 8, Task 44, Task 48 | 8 |
| 53b | L6 | About page B: core team and live System Telemetry panel | Task 50, Task 53 | 6 |
| 54 | L6 | Services page A: hero, inline scanner CLI, core services | Task 48, Task 44 | 8 |
| 54b | L6 | Services page B: detailed pricing, academy strip, request-assessment band | Task 51, Task 54 | 6 |
| 55 | L6 | Products page A: hero and API-driven premium catalogue with USD purchase | Task 40c, Task 33, Task 42, Task 44 | 10 |
| 55b | L6 | Products page B: free resources, simulated Toolbox Shell, custom-tooling band | Task 48, Task 55 | 7 |
| 56 | L6 | Blog: news list with search/filters/featured report, article detail route, newsletter | Task 40c, Task 42, Task 44, Task 47, Task 48, Task 49 | 14 |
| 57 | L6 | Contact page with secure request form | Task 40, Task 42, Task 44 | 8 |
| 58 | L6 | Cookie consent banner (server-recorded) | Task 40, Task 42, Task 44 | 8 |
| 59 | L7 | Login page | Task 8, Task 10, Task 11, Task 26, Task 40e, Task 42, Task 43 | 9 |
| 60 | L7 | MFA challenge dialog: authenticator code, security key, email code, recovery code | Task 11, Task 26, Task 27, Task 59 | 10 |
| 61 | L7 | Signup page A: details form, validation, strength meter | Task 10, Task 40d, Task 42, Task 59 | 9 |
| 62 | L7 | Signup page B: email verification, authenticator enrolment, success | Task 27, Task 40d, Task 60, Task 61 | 8 |
| 63 | L7 | Accept-invite, forgot-password, reset-password and newsletter-confirm pages | Task 10, Task 31, Task 40c, Task 40d, Task 59, Task 60 | 12 |
| 64 | L7 | Client onboarding wizard A: hero, stepper, step 1 (personal) and step 2 (career & entity) | Task 10, Task 30, Task 42, Task 44, Task 62 | 10 |
| 65 | L7 | Client onboarding wizard B: step 3 (recovery question, declarations) and submission | Task 30, Task 64 | 7 |

---

### TASK 40b — Marketing backend addendum A: products, entitlements, newsletter, richer public content (schema + contracts)

**Layer:** L4

**Prerequisites:** Task 15, Task 17, Task 18, Task 20, Task 20c, Task 20d, Task 40

**Estimated files touched:** 11

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Marketing backend addendum A: products, entitlements, newsletter, richer public content (schema + contracts)**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Add the schema and contracts the public site needs but Parts 1–2 did not model: a premium product catalogue with licence entitlements, newsletter subscribers, a blog severity column, and richer public content shapes with a detail view.

**Deliverables:**
- MODIFY `packages/db/src/enum-values.ts` — append `newsletter_status: "pending" | "confirmed" | "unsubscribed"`.
- `packages/db/src/schema/store.ts` — `products`, `product_entitlements`, `newsletter_subscribers` (below).
- MODIFY `packages/db/src/schema/content.ts` — add `severity` (finding_severity, null) to `content_items`, with index `(type, severity, published_at desc)`.
- MODIFY `packages/db/src/schema/billing.ts` — add `product_id uuid null → products.id` to `invoice_lines`.
- MODIFY `packages/db/src/schema/index.ts` — append `export * from "./store";`.
- `packages/db/sql/0040_products_seed.sql` — idempotent seed of the six products below.
- `packages/contracts/src/store.ts` — product, purchase, entitlement, download, newsletter schemas.
- MODIFY `packages/contracts/src/content.ts` — extend `PublicContentItem`, add `PublicContentQuery` and `PublicContentDetail` (below); update the Task 20 route doc comment only in `routes-b.ts` by adding a line, do not change other routes.
- `packages/contracts/src/routes-d.ts` — `ROUTES_D` documentation constant for Tasks 40c endpoints.
- `packages/contracts/fixtures/store.ts` — fixtures (six products + sample public content items).
- MODIFY `packages/contracts/fixtures/index.ts` and `packages/contracts/src/index.ts` — re-exports.
- `packages/db/src/schema/store.test.ts` and `packages/contracts/src/contracts-d.test.ts` — tests.

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

**Tables in `store.ts` (all `.enableRLS()`; use `idCol()`, `timestamps`, `usdCents`):**
1. `products` — `id`; `slug` text not null unique; `name` text not null; `category` text not null; `description` text not null; `features` text[] not null default `'{}'`; `price_usd_cents` bigint not null check > 0; `unit_label` text not null (`license` | `year` | `pack`); `active` boolean not null default true; `delivery_object_key` text null (R2 key of the licensed archive); `sort_order` smallint not null default 0; `created_at`, `updated_at`.
2. `product_entitlements` — `id`; `org_id` → organizations; `product_id` → products; `invoice_id` → invoices; `license_key` text not null unique (format `VV-XXXX-XXXX-XXXX-XXXX`, Crockford base32, generated by the API); `granted_at` timestamptz not null default now(); `updates_until` timestamptz not null (granted_at + 12 months — "twelve months of updates"); `revoked_at` timestamptz null. Unique `(org_id, product_id, invoice_id)`. Index `(org_id)`.
3. `newsletter_subscribers` — `id`; `email` citext not null unique; `status` newsletter_status not null default `'pending'`; `token_hash` text not null (SHA-256 of one token used for confirm AND unsubscribe); `source` text null (e.g. `blog`); `ip_hash` text null; `confirmed_at`, `unsubscribed_at` timestamptz null; `created_at`, `updated_at`.

**`0040_products_seed.sql`:** `INSERT … ON CONFLICT (slug) DO NOTHING` for these six products (`price_usd_cents` = dollars × 100; `sort_order` 1…6 in table order; `delivery_object_key` NULL — the operator uploads archives later):

| slug | name | category | $ (USD) | unit | features (3 each, verbatim) |
|---|---|---|---|---|---|
| reconvault-pro | ReconVault Pro | Recon | 49 | license | CT-log & DNS brute subdomain enumeration · Live CVE cross-reference & risk scoring · JSON / SARIF export for CI pipelines |
| vulnscope-api | VulnScope API | Scanning | 129 | year | OWASP Top 10 + API abuse detection · Authenticated & unauthenticated scan modes · Webhook alerts & scheduled runs |
| phishguard-kit | PhishGuard Kit | Human Risk | 79 | license | 40+ compliance-safe email templates · Per-department risk scoring dashboard · Automated awareness training follow-up |
| loghound-siem-pack | LogHound SIEM Pack | Detection | 199 | pack | 412 rules across 14 ATT&CK tactics · False-positive tuning notes per rule · Purple-team validation playbooks |
| payloadforge | PayloadForge | Exploit Dev | 99 | license | Multi-stage encoding chains · AV / EDR evasion scoring · Signed engagement audit log |
| compliancemapper | ComplianceMapper | GRC | 149 | year | CBK / ISO 27001 / GDPR control mapping · Evidence pack & audit trail export · Gap analysis with remediation owners |

Descriptions (verbatim, one per product, same order): 
1. "Continuous attack-surface enumeration engine with subdomain discovery, port fingerprinting and CVE correlation in a single CLI."
2. "Headless vulnerability scanner exposed as a REST API — drop authenticated scans straight into your CI/CD or SOC automation."
3. "Authorised phishing-simulation framework with landing-page templates, campaign tracking and staff-awareness scoring."
4. "412 production-tested detection rules mapped to MITRE ATT&CK, packaged for Splunk, Elastic and Wazuh."
5. "Encoder, obfuscator and payload staging console for authorised red-team engagements and detection-engineering validation."
6. "Map scan findings to Central Bank, ISO 27001 and Data Protection requirements, then export a board-ready evidence pack."

**Contracts — `store.ts`:**
- `ProductView = { id, slug, name, category, description, features: string[], priceUsdCents: UsdCents, unitLabel: "license"|"year"|"pack", settlementCurrency: z.literal("USD") }`.
- `PurchaseBody = { productId: Uuid }`; `PurchaseResponse = { data: { invoiceId: Uuid, invoiceNumber: string, totalUsdCents: UsdCents, settlementCurrency: "USD" } }` (the client then requests an FX quote and checks out via the existing billing routes).
- `EntitlementView = { id, productId, productName, licenseKey, grantedAt, updatesUntil, downloadable: boolean }`.
- `DownloadUrlResponse = { data: { url: string, expiresAt: IsoDateTime } }`.
- `NewsletterSubscribeBody = { email: string email, source?: string max 40 }`; `NewsletterTokenBody = { token: string min 20 }`.
- Copy used by later UI (constants): `NEWSLETTER_COPY = { eyebrow: "Threat Advisory Newsletter", title: "Get zero-day briefings before the exploit drops.", fine: "No spam. Unsubscribe anytime. We only send threat intelligence." }`.

**Contracts — `content.ts` changes:**
- `PublicContentItem = { id, type, title, excerpt: string | null, slug: string, slugPath: string, category: BlogCategory | null, categoryLabel: string | null, severity: Severity | null, tags: string[], readMinutes: number | null, featuredImageUrl: string | null, imageAlt: string | null, publishedAt: IsoDateTime, author: { fullName: string } }` (replaces the Task 20 shape; `summary` is renamed `excerpt`).
- `PublicContentQuery = PageQuery & { type?: ContentType, category?: BlogCategory, severity?: Severity, sort?: "newest" | "priority" }` (`priority` = severity critical→low, then newest — this drives the blog's "Featured Report · Editor's Pick · Highest Priority").
- `PublicContentDetail = PublicContentItem & { bodyMd: string }`.
- `SEVERITY_CHIP_LABELS`: critical `"CRITICAL"`, high `"HIGH"`, medium `"MEDIUM"`, low `"LOW"`.

**Fixtures (`fixtures/store.ts`):** `products` (six, from the table, with the verbatim descriptions); `publicContent` = six items derived from the home page's seed posts (use these titles/excerpts/author/date/readTime/severity verbatim): `"Kenya State House Cyber Security Audit & Risk Analysis"` / `"An investigative analysis of government digital perimeter vulnerabilities and defence protocols."` / author `VUNVAULT Threat Desk` / 2026-08-14 / 7 min / HIGH · `"Africa's Cyber Awakening: How the Continent Is Fighting Back"` / `"An in-depth analysis of evolving threat landscapes across Kenya, Ghana and Nigeria."` / Fatima Hassan / 2026-08-11 / 6 / MEDIUM · `"Cybersecurity Compliance Frameworks for SACCOs & Fintechs"` / `"Step-by-step regulatory readiness guide for Central Bank compliance and data protection."` / Brian Otieno / 2026-08-08 / 8 / MEDIUM · `"Zero-Day Exploit Trends: What 2026 Revealed About API Ingress"` / `"Correlating twelve months of weaponised CVEs to expose where attackers are concentrating next."` / Fatima Hassan / 2026-08-05 / 5 / CRITICAL · `"Ransomware Playbooks Now Targeting East African SACCOs"` / `"A forensic walkthrough of three real intrusion chains and the containment steps that worked."` / Amara Njoroge / 2026-08-02 / 9 / HIGH · `"Inside the VUNVAULT Sensor Network: Catching Memory Exfiltration"` / `"How 412 distributed sensors correlate kernel-level telemetry to stop zero-day exfiltration in flight."` / Daniel Mwangi / 2026-07-29 / 6 / LOW. Map their prototype categories (Cyber News, Cyber Defense, Compliance, Threat Intel, Incident Response, Engineering) onto the closest `BlogCategory` (news, industry_updates, industry_updates, threat_intel, news, blog) — categories in the shipped product come from the Studio enum, not from these prototype labels.

---

**Data shape (TypeScript):**
```ts
type ProductView = { id: string; slug: string; name: string; category: string; description: string; features: string[]; priceUsdCents: number; unitLabel: "license" | "year" | "pack"; settlementCurrency: "USD" };
```

**API contract (as comments only — do NOT implement the backend):**
N/A — schema and contracts only; see `routes-d.ts` documentation constant, implemented in Task 40c.

---

**Out of scope:**
- Do not implement routes.
- Do not generate or apply migrations.
- Do not add a crypto payment option.
- Do not modify Task 19–20d schemas other than those named.

---

**Definition of done:**
☐ `pnpm --filter @vunvault/contracts typecheck` passes with zero errors.
☐ `pnpm --filter @vunvault/contracts lint` passes with zero errors.
☐ `pnpm --filter @vunvault/contracts test` passes: every new schema has a parse-success test using its fixture and at least one parse-failure test.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 40b complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 40c — Marketing backend addendum B: public content detail, product catalogue + purchase + entitlements, newsletter (routes)

**Layer:** L4

**Prerequisites:** Task 32, Task 33, Task 34, Task 36, Task 39, Task 40, Task 40b

**Estimated files touched:** 14

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Marketing backend addendum B: public content detail, product catalogue + purchase + entitlements, newsletter (routes)**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Implement the public content search/detail routes, the product catalogue with USD purchase via the existing invoice/FX/checkout flow, licence entitlements with presigned downloads, and double-opt-in newsletter subscription.

**Deliverables:**
- `apps/api/src/routes/v1/store/index.ts` — products, purchase, entitlements, downloads.
- `apps/api/src/routes/v1/store/service.ts` — `StoreService`, `EntitlementService`.
- `apps/api/src/routes/v1/store/repo.ts` — repos.
- `apps/api/src/routes/v1/store/license-key.ts` — key generator.
- `apps/api/src/routes/v1/newsletter/index.ts` — subscribe / confirm / unsubscribe.
- `apps/api/src/routes/v1/newsletter/service.ts` — `NewsletterService`.
- MODIFY `apps/api/src/routes/v1/content/index.ts`, `service.ts`, `repo.ts` — extend `GET /api/v1/content` and add `GET /api/v1/content/:slug`.
- MODIFY `apps/api/src/routes/v1/webhooks/service.ts` — after an invoice reaches outstanding 0, call `EntitlementService.grantForInvoice(tx, invoiceId)`.
- MODIFY `apps/api/src/audit/events.ts` — add events `PRODUCT_PURCHASE_STARTED` (info), `PRODUCT_DOWNLOADED` (info), `NEWSLETTER_SUBSCRIBED` (info), `NEWSLETTER_UNSUBSCRIBED` (info), `ENTITLEMENT_GRANTED` (ok), all category `administrative`.
- MODIFY `apps/api/src/conformance/route-manifest.ts` and `route-table.test.ts` — register the new public routes, add `ROUTES_D` to the contract-drift check.
- MODIFY `apps/api/src/routes/v1/index.ts` — two `register` lines.
- `apps/api/src/routes/v1/store/store.test.ts` and `apps/api/src/routes/v1/newsletter/newsletter.test.ts` — tests.
- `apps/api/src/routes/v1/content/content-public.test.ts` — tests.
- MODIFY `apps/api/src/audit/events.test.ts` — extend the catalog assertions.

**Dependencies allowed:**
- None — use only existing.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**Backend conventions (identical in every API task — do not deviate):**
- Fastify 5 only. Plugins are `FastifyPluginAsync` exports wrapped with `fastify-plugin` when they decorate. Route plugins use `app.withTypeProvider<ZodTypeProvider>()` and declare `schema: { params, querystring, body, response }` with Zod schemas from `@vunvault/contracts`.
- Layers: `routes → service → repo`. Repos take a `Db | Tx` (Drizzle, from `@vunvault/db`) and return plain objects. Services receive repos through their constructor. Route files contain no Drizzle calls.
- Auth: `preHandler: [app.authenticate, app.requirePermission("<perm>")]`. Public routes omit both.
- Every state-changing route is wrapped with `audited(spec, handler)` — the `@audit(...)` mechanism from the audit-chain task. The handler receives `ctx.tx`; domain writes and the audit append commit in ONE transaction.
- Errors: `throw new HttpError(status, code, message?, details?)`; the envelope is `{ error, message?, details? }`; success is `{ data }` or `{ data, total }`.
- Tests: Vitest + `app.inject()`, in-memory fake repos and fake providers; no live database, Redis, or network.
- Forbidden: Express, Prisma, Joi, `localStorage`, hard-coded secrets.

N/A — no UI.

**Public content (modify Task 36 files):** `GET /api/v1/content` (no auth; `Cache-Control: public, max-age=60`) now accepts `PublicContentQuery`: `q` ILIKE over `title`, `excerpt`, tags, and `cve_id`; `category`; `severity`; `type`; `sort=priority|newest`; ONLY `status='published'` and `published_at <= now()`. Returns the extended `PublicContentItem` (`excerpt` from `content_items.excerpt` falling back to the first 240 chars of `summary`; `slug` = the last path segment of `slug_path`; `author.fullName` only). `GET /api/v1/content/:slug` → `PublicContentDetail` for a published item whose `slug_path` ends in `/<slug>`, else `404 { error: "not_found" }`; `body_md` returned as stored (already sanitised by Task 36; the web app renders it safely).

**Products:** `GET /api/v1/products` → `{ data: ProductView[], total }` active only, ordered by `sort_order`; `GET /api/v1/products/:slug` → `{ data: ProductView }`. Public, cacheable 300 s. `POST /api/v1/products/:id/purchase` (`[authenticate, requirePermission("billing:manage")]`, org required): reuse an existing `pending` invoice for the same org + product created within 24 h (idempotent), else `InvoiceIssuer.issue` with one line (`description` = product name, `unitUsdCents` = product price, `productId`) and `title` = product name, `detail` = `"<category> · <unit label> licence"` for `license`, `"<category> · annual licence"` for `year`, `"<category> · pack"` for `pack`; audit `PRODUCT_PURCHASE_STARTED`; `201 PurchaseResponse`. Payment is then done through `POST /billing/fx-quotes` + `POST /billing/checkout` (Task 33) — USD only.
**Entitlements:** `EntitlementService.grantForInvoice(tx, invoiceId)` (idempotent, called inside the webhook transaction): for each invoice line with `product_id`, insert `product_entitlements` (`license_key` = `VV-` + four groups of four Crockford-base32 characters from `crypto.randomInt`, unique-retry up to 5 times; `updates_until = granted_at + 12 months`); audit `ENTITLEMENT_GRANTED` with the system actor; enqueue a `notify` email with the licence key. `GET /api/v1/entitlements` (`authenticate`, org-scoped) → `{ data: EntitlementView[] }` (`downloadable` = product has `delivery_object_key` and the entitlement is not revoked). `POST /api/v1/entitlements/:id/download-url` (own org only; `409 { error: "not_available" }` when no archive) → presigned GET from `app.storage` valid 300 s with `Content-Disposition: attachment`; audit `PRODUCT_DOWNLOADED`; `{ data: { url, expiresAt } }`. Rate policy `sensitive`.

**Newsletter (public, rate policy `public_form`):**
- `POST /api/v1/newsletter` body `NewsletterSubscribeBody`: ALWAYS answer `202 {}` (never reveal whether the address exists). New or `unsubscribed` → upsert `pending`, new token (`sha256` stored; raw token only in the email), email via `app.email` with link `${WEB_ORIGIN}/newsletter/confirm?token=<token>`; already `confirmed` → send nothing; `pending` → resend at most once per 10 minutes. Store `ip_hash = sha256(ip + daily salt)`. Audit `NEWSLETTER_SUBSCRIBED` on CONFIRM (not here), actor `external`.
- `POST /api/v1/newsletter/confirm` body `{ token }` → `confirmed`, `confirmed_at`; unknown token → `404 { error: "not_found" }`; `204`.
- `POST /api/v1/newsletter/unsubscribe` body `{ token }` → `unsubscribed`; audit `NEWSLETTER_UNSUBSCRIBED`; `204`.

**Tests (assert):** content `q` search matches a tag; `sort=priority` puts a CRITICAL item before a newer MEDIUM item; unpublished item → 404 on detail; purchase twice returns the same invoice; webhook paying the invoice creates exactly one entitlement with key regex `^VV-[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$`; org B cannot download org A's entitlement; newsletter returns 202 for both known and unknown addresses with identical bodies; confirm token is single-purpose-per-subscriber and unknown → 404; the conformance suite passes with the new routes.

---

**Data shape (TypeScript):**
```ts
// ProductView, PurchaseResponse, EntitlementView, DownloadUrlResponse, NewsletterSubscribeBody, PublicContentItem, PublicContentDetail: see contracts (Task 40b).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET  /api/v1/content query PublicContentQuery → 200 { data: PublicContentItem[]; total }
// GET  /api/v1/content/:slug → 200 { data: PublicContentDetail } | 404 not_found
// GET  /api/v1/products → 200 { data: ProductView[]; total } · GET /api/v1/products/:slug → 200 { data: ProductView } | 404
// POST /api/v1/products/:id/purchase → 201 { data: { invoiceId; invoiceNumber; totalUsdCents; settlementCurrency: "USD" } } | 403 no_org | 404
// GET  /api/v1/entitlements → 200 { data: EntitlementView[] } · POST /api/v1/entitlements/:id/download-url → 200 { data: { url; expiresAt } } | 404 | 409 not_available
// POST /api/v1/newsletter body { email; source? } → 202 {} | 400 validation_failed | 429
// POST /api/v1/newsletter/confirm | /unsubscribe body { token } → 204 | 404 not_found
```

---

**Out of scope:**
- Do not implement the checkout UI or any non-USD charge.
- Do not add a cart or multi-product purchase.
- Do not send marketing email other than the confirmation message.

---

**Definition of done:**
☐ `pnpm --filter api typecheck` passes with zero errors.
☐ `pnpm --filter api lint` passes with zero errors.
☐ `pnpm --filter api test` passes and `pnpm --filter api typecheck` passes with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 40c complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 40d — Auth addendum A: signup with email-OTP verification, forgot / reset password

**Layer:** L4

**Prerequisites:** Task 20d, Task 22, Task 24, Task 25, Task 26, Task 27, Task 40

**Estimated files touched:** 16

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Auth addendum A: signup with email-OTP verification, forgot / reset password**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Change signup into the prototype's verified flow (details → email OTP → TOTP enrolment → done) and add forgot/reset password, modifying the Task 26 signup route and its contract.

**Deliverables:**
- MODIFY `packages/db/src/enum-values.ts` — add `"pending_verification"` to `ACCOUNT_STATUSES`; MODIFY `packages/db/src/schema/_enums.ts` accordingly.
- MODIFY `packages/contracts/src/permissions.ts` — add `pending_verification: "Pending Verification"` to `ACCOUNT_STATUS_LABELS`.
- MODIFY `packages/contracts/src/auth.ts` — new signup/verify/reset schemas (below); `SignupBody` password minimum becomes 12 with the Task 26 complexity rules.
- MODIFY `packages/contracts/src/routes-a.ts` — replace the `POST /auth/signup` entry and add the new routes.
- MODIFY `packages/contracts/src/contracts-a.test.ts` — adjust the signup test; add tests for the new schemas.
- MODIFY `apps/api/src/lib/supabase-admin.ts` — add `confirmEmail(userId)`, `issueSession(email)`, `deleteUser(userId)` to the interface and real implementation.
- MODIFY `apps/api/src/routes/v1/auth/service.ts` and `index.ts` — new signup behaviour and the new routes.
- `apps/api/src/routes/v1/auth/email-otp.ts` — shared OTP store (`issue`, `verify`) in Redis.
- `apps/api/src/routes/v1/auth/password-reset.ts` — reset-token store.
- MODIFY `apps/api/src/routes/v1/auth/repo.ts` — pending-signup queries.
- MODIFY `apps/api/src/routes/v1/auth/auth.test.ts` — replace the old signup tests, add new ones.
- `apps/api/src/routes/v1/auth/signup-verify.test.ts` — new flow tests.
- `apps/api/src/routes/v1/auth/password-reset.test.ts` — reset tests.
- MODIFY `apps/api/src/conformance/route-manifest.ts` — add the new public routes to `PUBLIC_ROUTES`; mark them `AUDIT_EXEMPT` only where stated below.
- MODIFY `docs/adr/0002-api-conventions.md` — one paragraph recording the signup decision (replaces the Task 26 `DECISION(v1)` comment, which you must delete).
- MODIFY `.env.example` — no change expected; do not edit unless a new variable name is added (names only).

**Dependencies allowed:**
- None — use only existing.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**Backend conventions (identical in every API task — do not deviate):**
- Fastify 5 only. Plugins are `FastifyPluginAsync` exports wrapped with `fastify-plugin` when they decorate. Route plugins use `app.withTypeProvider<ZodTypeProvider>()` and declare `schema: { params, querystring, body, response }` with Zod schemas from `@vunvault/contracts`.
- Layers: `routes → service → repo`. Repos take a `Db | Tx` (Drizzle, from `@vunvault/db`) and return plain objects. Services receive repos through their constructor. Route files contain no Drizzle calls.
- Auth: `preHandler: [app.authenticate, app.requirePermission("<perm>")]`. Public routes omit both.
- Every state-changing route is wrapped with `audited(spec, handler)` — the `@audit(...)` mechanism from the audit-chain task. The handler receives `ctx.tx`; domain writes and the audit append commit in ONE transaction.
- Errors: `throw new HttpError(status, code, message?, details?)`; the envelope is `{ error, message?, details? }`; success is `{ data }` or `{ data, total }`.
- Tests: Vitest + `app.inject()`, in-memory fake repos and fake providers; no live database, Redis, or network.
- Forbidden: Express, Prisma, Joi, `localStorage`, hard-coded secrets.

N/A — no UI.

**Why this task exists:** the prototype signup is three steps — (1) details, (2) "Verify your email" with a 6-digit code, (3) "Two-factor authentication" with an authenticator code — then "Account Created & Verified!". Task 26 had skipped mailbox verification. This task replaces that behaviour.

**New signup contract:**
- `SignupBody` (unchanged fields: `fullName, email, phone?, country, accountType, password, confirmPassword, description?`) with `password` min 12 and the Task 26 complexity rules.
- `SignupStartResponse = { data: { email: string; verificationRequired: true; resendAfterSeconds: 30; expiresInSeconds: 600 } }`.
- `SignupVerifyBody = { email: string email, code: string regex ^\d{6}$ }`; `SignupResendBody = { email }`.
- `ForgotPasswordBody = { email }`; `ResetPasswordBody = { token: string min 32, newPassword: string, confirmPassword: string }` (same password rules and confirm refine as `ChangePasswordBody`; message `"Both entries must match exactly."`).

**`POST /api/v1/auth/signup` (public, policy `public_form`) — new behaviour:**
1. Validate; `BreachCheck` (422 `breached_password`); an existing profile that is `active` → `409 { error: "email_taken" }`; an existing `pending_verification` profile for the same email is REPLACED (delete the unverified Supabase user + rows, then continue).
2. `supabase.createUser({ email, password, emailConfirm: false, userMetadata: { fullName } })`.
3. In one transaction insert `organizations` + `profiles` exactly as Task 26 does but with `account_status = 'pending_verification'` and `require_2fa = true`.
4. Issue an OTP: 6 random digits (`crypto.randomInt`), Redis `signup:otp:<sha256(lower(email))>` = `{ codeHash: sha256(code), attempts: 0 }` TTL 600 s; email via `app.email` (subject `"Your VUNVAULT verification code"`, body shows the code and says it expires in 10 minutes). In `NODE_ENV=development` ONLY, also log the code at `debug` (the prototype showed a "Test mode" banner; production must never expose it).
5. NO cookies are set. Respond `202 SignupStartResponse`. Audit `ACCOUNT_REGISTERED` (details: `{ stage: "started" }`).

**`POST /api/v1/auth/signup/verify-email` (public, policy `login`):** look up the OTP; compare `sha256(code)` constant-time; at 5 failed attempts delete the OTP and answer `401 { error: "otp_exhausted" }`; wrong code → `401 { error: "otp_invalid" }` and `attempts++`; expired/missing → `410 { error: "otp_expired" }`. On success: `supabase.confirmEmail(userId)`, profile `account_status = 'active'`, delete the OTP, `supabase.issueSession(email)` (implementation: `auth.admin.generateLink({ type: "magiclink", email })` then `auth.verifyOtp({ token_hash, type: "magiclink" })` server-side) → aal1 session; `setSessionCookies` (remember = false) + `user_sessions` row; audit `ACCOUNT_REGISTERED` (details `{ stage: "email_verified" }`); respond `200 { data: SessionUser }` with `mfaEnrolled: false`. The web app then calls the Task 27 TOTP routes (`/account/mfa/totp/enroll`, `/verify`) to complete step 3; the verify route replaces the cookies with the aal2 session.
**`POST /api/v1/auth/signup/resend` (public, `public_form`):** always `202 {}`; if a `pending_verification` profile exists and the last send was ≥ 30 s ago, issue a new OTP (invalidating the old one).
**Cleanup contract:** `pending_verification` profiles older than 24 h are deleted (profile, organization, Supabase user) by the maintenance worker — document this in the repo as `listStalePendingSignups(olderThan)`; the worker task implements the schedule.

**Forgot / reset password:**
- `POST /api/v1/auth/forgot-password` (public, `public_form`) body `{ email }`: ALWAYS `202 {}` with an identical body and similar timing. If an `active` profile exists: token = 32 random bytes base64url; Redis `pwreset:<sha256(token)>` = `{ userId }` TTL 1800 s (single use); at most 3 live tokens per user; email link `${WEB_ORIGIN}/reset-password?token=<token>` (subject `"Reset your VUNVAULT password"`; body says the link expires in 30 minutes and may be ignored if not requested). Nothing is audited at request time (only a `debug` log); the audit entry is written on successful reset.
- `POST /api/v1/auth/reset-password` (public, policy `login`) body `ResetPasswordBody`: look up and DELETE the token atomically (`GETDEL`); invalid/used/expired → `410 { error: "token_invalid" }`; validate the password (staff 14, others 12), breach check, `supabase.updatePassword`, revoke ALL of the user's sessions (Supabase + `user_sessions` + registry), set `last_password_change_at`, email a notice (template `credentials_changed`), audit `PASSWORD_CHANGED` (actor = the user; details `{ via: "reset" }`), `204`. MFA is NOT bypassed: the user must still complete MFA at the next login.

**Tests (assert):** signup returns 202 and sets no cookies; the OTP email job is enqueued and the code is not in the HTTP response; 5 wrong codes lock the OTP; correct code activates the profile and sets `vv_at`; signing up again while `pending_verification` replaces the old record; forgot-password body is identical for known and unknown emails; reset token is single use; reset revokes sessions; staff new password of 13 chars rejected; conformance suite still passes.

---

**Data shape (TypeScript):**
```ts
type SignupStartResponse = { data: { email: string; verificationRequired: true; resendAfterSeconds: 30; expiresInSeconds: 600 } };
interface SupabaseAdminAdditions { confirmEmail(userId: string): Promise<void>; issueSession(email: string): Promise<SupabaseSession>; deleteUser(userId: string): Promise<void> }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/auth/signup body SignupBody → 202 SignupStartResponse | 400 | 409 email_taken | 422 breached_password | 429
// POST /api/v1/auth/signup/verify-email body { email; code: string(6 digits) } → 200 { data: SessionUser } (+ cookies vv_at, vv_rt, vv_csrf) | 401 { error: "otp_invalid" | "otp_exhausted" } | 410 otp_expired | 429
// POST /api/v1/auth/signup/resend body { email } → 202 {}
// POST /api/v1/auth/forgot-password body { email } → 202 {}
// POST /api/v1/auth/reset-password body { token; newPassword; confirmPassword } → 204 | 400 | 410 { error: "token_invalid" } | 422 breached_password
```

---

**Out of scope:**
- Do not implement OAuth (Task 40e).
- Do not implement the maintenance-worker cleanup (Layer L11).
- Do not expose the OTP in any response outside development logging.
- Do not write UI.

---

**Definition of done:**
☐ `pnpm --filter api typecheck` passes with zero errors.
☐ `pnpm --filter api lint` passes with zero errors.
☐ `pnpm --filter api test` passes and `pnpm --filter api typecheck` passes with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 40d complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 40e — Auth addendum B: OAuth sign-in (Google, GitHub, Microsoft) via Supabase PKCE

**Layer:** L4

**Prerequisites:** Task 24, Task 26, Task 27, Task 40d

**Estimated files touched:** 8

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Auth addendum B: OAuth sign-in (Google, GitHub, Microsoft) via Supabase PKCE**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Implement server-side OAuth start and callback routes for Google, GitHub and Microsoft (Supabase `azure`) using PKCE, creating client accounts on first sign-in and honouring MFA.

**Deliverables:**
- `apps/api/src/routes/v1/auth/oauth.ts` — route plugin: start + callback.
- `apps/api/src/routes/v1/auth/oauth-service.ts` — `OAuthService`.
- `apps/api/src/lib/pkce.ts` — verifier/challenge helpers.
- MODIFY `apps/api/src/lib/supabase-admin.ts` — add `buildAuthorizeUrl(...)` and `exchangeCodeForSession(authCode, codeVerifier)`.
- MODIFY `apps/api/src/routes/v1/auth/index.ts` — register the OAuth plugin.
- MODIFY `apps/api/src/conformance/route-manifest.ts` — add both routes to `PUBLIC_ROUTES` and `CSRF_EXEMPT` (they are GET and cookie-bound by `state`).
- `apps/api/src/routes/v1/auth/oauth.test.ts` — tests.
- MODIFY `packages/contracts/src/routes-a.ts` — document the two routes.

**Dependencies allowed:**
- None — use only existing.

---

**Design tokens to use (verbatim):**
N/A — no UI in this task.

**Design rules for this task:**
N/A — no UI in this task.

---

**Visual specification (embedded copy + layout):**

**Backend conventions (identical in every API task — do not deviate):**
- Fastify 5 only. Plugins are `FastifyPluginAsync` exports wrapped with `fastify-plugin` when they decorate. Route plugins use `app.withTypeProvider<ZodTypeProvider>()` and declare `schema: { params, querystring, body, response }` with Zod schemas from `@vunvault/contracts`.
- Layers: `routes → service → repo`. Repos take a `Db | Tx` (Drizzle, from `@vunvault/db`) and return plain objects. Services receive repos through their constructor. Route files contain no Drizzle calls.
- Auth: `preHandler: [app.authenticate, app.requirePermission("<perm>")]`. Public routes omit both.
- Every state-changing route is wrapped with `audited(spec, handler)` — the `@audit(...)` mechanism from the audit-chain task. The handler receives `ctx.tx`; domain writes and the audit append commit in ONE transaction.
- Errors: `throw new HttpError(status, code, message?, details?)`; the envelope is `{ error, message?, details? }`; success is `{ data }` or `{ data, total }`.
- Tests: Vitest + `app.inject()`, in-memory fake repos and fake providers; no live database, Redis, or network.
- Forbidden: Express, Prisma, Joi, `localStorage`, hard-coded secrets.

N/A — no UI.

**Providers:** path param `provider` ∈ `google | github | microsoft`; Supabase provider names `google`, `github`, `azure` (`microsoft` maps to `azure`). Anything else → `404 { error: "not_found" }`. The providers are enabled in the Supabase dashboard (operator step; add a comment).

**`GET /api/v1/auth/oauth/:provider/start?next=<path>` (public, policy `public_form`):**
1. `next` must be a relative path beginning with a single `/` and not `//` or containing `\`; otherwise ignore it and use `/portal`.
2. Generate `state` (24 random bytes base64url) and a PKCE `code_verifier` (43–64 chars) with `code_challenge = base64url(sha256(verifier))`.
3. Redis `oauth:state:<state>` = `{ provider, verifier, next }` TTL 600 s. Set cookie `vv_oauth` = `state` (HttpOnly, Secure, SameSite=Lax, Path `/api/v1/auth`, 600 s).
4. `302` to `${SUPABASE_URL}/auth/v1/authorize?provider=<p>&redirect_to=<API_PUBLIC_URL>/api/v1/auth/oauth/callback&code_challenge=<c>&code_challenge_method=s256&state=<state>` (via `buildAuthorizeUrl`).

**`GET /api/v1/auth/oauth/callback?code=&state=` (public):**
1. `state` query must equal cookie `vv_oauth` AND exist in Redis (`GETDEL`); mismatch → `302 ${WEB_ORIGIN}/login?error=oauth_state`.
2. If the provider sent `error` → `302 /login?error=oauth_denied`.
3. `exchangeCodeForSession(code, verifier)` → Supabase session + user (email, `email_verified`, name, avatar).
4. Reject unverified provider emails: `302 /login?error=oauth_email_unverified` (and delete the just-created Supabase user if it was created by this attempt).
5. Profile lookup by user id: **missing** → create a CLIENT account in one transaction (organization with a `client_code` from `next_client_code()`, profile `role: "client"`, `account_status: "active"`, `full_name` from provider metadata or the email local-part, `require_2fa: false`), audit `ACCOUNT_REGISTERED` (details `{ provider }`). **Existing STAFF role** → refuse: delete the session at Supabase, `302 /login?error=oauth_not_allowed` (staff sign in with password + MFA only), audit `AUTH_FAILURE` (details `{ provider, reason: "staff_oauth_blocked" }`). **Existing profile whose email matches but whose id differs** (identity not linked) → `302 /login?error=oauth_email_in_use`; do not link automatically.
6. If the user has a verified TOTP factor or WebAuthn key → create the MFA challenge exactly as login does (cookie `vv_mfa`, Redis handle) and `302 ${WEB_ORIGIN}/login?mfa=1&next=<next>`; otherwise `setSessionCookies` (remember = false), insert `user_sessions` (device label, ip), audit `AUTH_SUCCESS` (details `{ provider }`), and `302 ${WEB_ORIGIN}<next>` — if the user has no `onboarding_profiles.completed_at` the destination is `/onboarding` regardless of `next`.
7. Always clear `vv_oauth`.
No token ever appears in a URL, a JSON body or the redirect target.

**Tests (assert):** unknown provider → 404; `next=//evil.com` falls back to `/portal`; start sets the cookie and Redis state and returns a Supabase authorize URL containing `code_challenge_method=s256`; callback with a tampered state → `/login?error=oauth_state` and no session; first-time Google user gets a client org + profile + cookies; staff email via OAuth is refused; unverified email refused; MFA-enrolled user is redirected to `/login?mfa=1` with `vv_mfa` set and NO `vv_at`.

---

**Data shape (TypeScript):**
```ts
type OAuthProvider = "google" | "github" | "microsoft";
interface OAuthState { provider: OAuthProvider; verifier: string; next: string }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/auth/oauth/:provider/start?next=/portal → 302 Location: <supabase authorize url> (+ Set-Cookie vv_oauth) | 404 not_found
// GET /api/v1/auth/oauth/callback?code=&state= → 302 to WEB_ORIGIN: /portal | /onboarding | /login?mfa=1 | /login?error=oauth_state|oauth_denied|oauth_email_unverified|oauth_not_allowed|oauth_email_in_use
```

---

**Out of scope:**
- Do not implement OAuth for staff accounts.
- Do not auto-link identities.
- Do not implement UI.

---

**Definition of done:**
☐ `pnpm --filter api typecheck` passes with zero errors.
☐ `pnpm --filter api lint` passes with zero errors.
☐ `pnpm --filter api test` passes and `pnpm --filter api typecheck` passes with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 40e complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 41 — Next.js 15 app skeleton: config, Tailwind v4 wiring, fonts, root layout, route groups

**Layer:** L5

**Prerequisites:** Task 3, Task 5, Task 13, Task 40c

**Estimated files touched:** 14

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Next.js 15 app skeleton: config, Tailwind v4 wiring, fonts, root layout, route groups**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Turn `apps/web` into a runnable Next.js 15 (App Router, React 19) app wired to the shared design system, with security headers, the Inter font, the root layout, and empty route-group layouts.

**Deliverables:**
- MODIFY `apps/web/package.json` — scripts `dev` (`next dev --turbopack -p 3000`), `build`, `start`, `lint`, `typecheck`, `test`; dependencies (below).
- `apps/web/next.config.ts` — config (below).
- `apps/web/postcss.config.mjs` — `{ plugins: { "@tailwindcss/postcss": {} } }`.
- `apps/web/src/app/globals.css` — `@import "@vunvault/ui/styles.css";` then `@source "../../../../packages/ui/src";`.
- `apps/web/src/app/layout.tsx` — root layout.
- `apps/web/src/app/(marketing)/layout.tsx`, `apps/web/src/app/(auth)/layout.tsx`, `apps/web/src/app/(authed)/layout.tsx`, `apps/web/src/app/(authed)/portal/layout.tsx`, `apps/web/src/app/(authed)/admin/layout.tsx` — pass-through layouts (`return <>{children}</>`), to be filled by later tasks.
- `apps/web/src/app/page.tsx` — TEMPORARY placeholder: `<main><h1>VUNVAULT</h1></main>` (Task 52 deletes it when the marketing home page lands).
- `apps/web/src/env.ts` — Zod-validated public env (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SENTRY_DSN?`, `NEXT_PUBLIC_API_MOCKING?`).
- `apps/web/public/brand/.gitkeep` — the operator copies `logo.svg` here before this task; do not create it.
- `apps/web/.env.example` — names only.
- `apps/web/src/lib/fonts.ts` — `next/font/google` Inter.
- `apps/web/next-env.d.ts` is generated; do not commit it (ensure it is gitignored).
- `apps/web/src/env.test.ts` — env validation test.

**Dependencies allowed:**
- `next`, `react`, `react-dom` (catalog) as runtime dependencies.
- `@tailwindcss/postcss`, `tailwindcss` (catalog), `@types/react`, `@types/react-dom`, `@types/node` as devDependencies.
- `lucide-react`, `zod`.
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

N/A — no visible UI in this task beyond the placeholder.

**Conventions to follow in EVERY later web task (state them as a comment block at the top of `layout.tsx`):**
1. App Router only; server components by default; add `"use client"` only where state/effects/browser APIs are needed.
2. **Cloudflare Pages target:** every route handler and dynamic route must be edge-compatible — no Node-only APIs (`fs`, `crypto` from node, `Buffer`), and dynamic routes declare `export const runtime = "edge"`.
3. No `localStorage` / `sessionStorage` / IndexedDB for auth, consent or content (cookies set by the API only). In-memory state and TanStack Query cache only.
4. Every screen is a React route; no `.html` files exist anywhere.
5. Data comes from the API through hooks built on `apiFetch` (Task 7). Each hook has `// TODO(backend-contract)` above it.

**Route map (final; every later task relies on it):**
`(marketing)`: `/`, `/about`, `/services`, `/products`, `/blog`, `/blog/[slug]`, `/contact`, `/academy` (placeholder).
`(auth)`: `/login`, `/signup`, `/accept-invite`, `/forgot-password`, `/reset-password`, `/newsletter/confirm`.
`(authed)/onboarding`: `/onboarding`.
`(authed)/portal`: `/portal` (scans), `/portal/billing`, `/portal/security` (Password Manager), `/portal/profile`, `/portal/advisories`, `/portal/studio`, `/portal/academy`, `/portal/scanner`.
`(authed)/admin`: `/admin`, `/admin/scan-queue`, `/admin/zero-day`, `/admin/users`, `/admin/content`, `/admin/audit`, `/admin/profile`.
`/logout` is a client route that POSTs `/api/v1/auth/logout` then redirects to `/login`.

**`next.config.ts`:** `reactStrictMode: true`; `poweredByHeader: false`; `transpilePackages: ["@vunvault/ui", "@vunvault/lib", "@vunvault/contracts"]`; `images: { remotePatterns: [ { protocol: "https", hostname: process.env.NEXT_PUBLIC_R2_HOST ?? "assets.vunvault.com" } ] }`; `experimental: { optimizePackageImports: ["lucide-react"] }`; `async headers()` returning for `/(.*)`: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(self)`, `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin-allow-popups`. (The nonce-based CSP is added by the edge middleware in Task 43 — do not add a CSP here.) `async redirects()`: none. `async rewrites()`: none (the browser calls the API origin directly, with credentials).

**`layout.tsx`:** `<html lang="en" className={inter.variable}>`; `<body className="min-h-screen bg-paper text-ink antialiased font-sans">{children}</body>`; `export const metadata`: `title: { default: "VUNVAULT — We Find The Cracks Before They Do", template: "%s — VUNVAULT" }`, `description: "Africa-rooted, worldwide penetration testing, vulnerability assessments and cybersecurity education."`, `metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL)`, `openGraph.siteName: "VUNVAULT"`; `export const viewport = { themeColor: "#fcfbf9" }` is NOT allowed (no hex) — instead read the value from `tokens.color.paper` imported from `@vunvault/ui`. `fonts.ts`: `Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" })`; and in `globals.css` map `--font-sans` usage by adding `@theme inline { --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif; }` AFTER the import (this overrides the stack from Task 5 so the self-hosted Inter is used).

**`.env.example` names:** `NEXT_PUBLIC_API_URL=`, `NEXT_PUBLIC_SITE_URL=`, `NEXT_PUBLIC_SENTRY_DSN=`, `NEXT_PUBLIC_API_MOCKING=`, `NEXT_PUBLIC_R2_HOST=`, `NEXT_PUBLIC_BUILD_LABEL=`, `NEXT_PUBLIC_NODE_LABEL=`.

**`env.ts`:** parse `process.env` with Zod; `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SITE_URL` are required URLs; `NEXT_PUBLIC_API_MOCKING` optional `"enabled"`; export a typed `env`. Test: a missing API URL throws a readable error.

---

**Data shape (TypeScript):**
N/A — no entities.

**API contract (as comments only — do NOT implement the backend):**
N/A — no API calls in this task.

---

**Out of scope:**
- Do not build any real page, header, footer, or provider (Tasks 42–58).
- Do not add a Content-Security-Policy (Task 43).
- Do not add Cloudflare/OpenNext build tooling (Layer L13).
- Do not create or edit `logo.svg`.

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm --filter web dev` renders the route(s) in this task with no console errors, and `pnpm --filter web test` passes (a smoke test per new component renders it and asserts the key verbatim strings).
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 41 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 42 — Client runtime: providers, API bootstrap, session store, MSW mock layer

**Layer:** L5

**Prerequisites:** Task 7, Task 11, Task 19, Task 41

**Estimated files touched:** 14

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Client runtime: providers, API bootstrap, session store, MSW mock layer**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Create the client-side runtime every page uses: React Query provider, Tooltip and Toaster mounts, API client configuration with 401 handling, the session hook/store, CSRF bootstrap, and the MSW mocking layer seeded from contract fixtures.

**Deliverables:**
- `apps/web/src/app/providers.tsx` — `Providers` client component.
- `apps/web/src/lib/api.ts` — `configureApi` call + exported `api` helpers.
- `apps/web/src/lib/session.ts` — `useSession()` (TanStack Query) + `useSessionStore` (Zustand) + `sessionQueryOptions`.
- `apps/web/src/lib/csrf.ts` — `ensureCsrf()`.
- `apps/web/src/lib/use-logout.ts` — `useLogout()` mutation.
- `apps/web/src/mocks/browser.ts`, `apps/web/src/mocks/server.ts` — MSW setup.
- `apps/web/src/mocks/handlers/index.ts` — aggregates handler arrays (later tasks append one import + one spread each).
- `apps/web/src/mocks/handlers/auth.ts` — handlers for the auth endpoints below.
- `apps/web/src/mocks/mock-gate.tsx` — `MockGate` that starts the worker only when `NEXT_PUBLIC_API_MOCKING === "enabled"`.
- MODIFY `apps/web/src/app/layout.tsx` — wrap children in `<Providers>`.
- `apps/web/vitest.config.ts`, `apps/web/vitest.setup.ts` — jsdom + MSW node server lifecycle.
- `apps/web/src/lib/session.test.tsx` — tests.
- MODIFY `apps/web/package.json` — dependencies and `msw` config key `{ "workerDirectory": ["public"] }`.

**Dependencies allowed:**
- `@tanstack/react-query`, `zustand`, `@vunvault/ui`, `@vunvault/lib`, `@vunvault/contracts` (workspace).
- `msw` (dev), `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, `vitest` (dev).
- Nothing else. The operator generates `public/mockServiceWorker.js` with `pnpm dlx msw init public/` — do NOT create it.

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

N/A — no visual UI. `Providers` renders: `QueryClientProvider` (client from `createQueryClient()`; create ONE per browser tab via `useState(() => createQueryClient())`), `TooltipProvider` (from `@vunvault/ui`), then `children`, then `<Toaster />` (from `@vunvault/ui`). If `env.NEXT_PUBLIC_API_MOCKING === "enabled"` wrap with `MockGate`, which renders `null` until `worker.start({ onUnhandledRequest: "bypass" })` resolves.

**`api.ts`:** call `configureApi({ baseUrl: env.NEXT_PUBLIC_API_URL, onUnauthorized: () => { if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) window.location.assign("/login?next=" + encodeURIComponent(window.location.pathname + window.location.search)); } })` once (module-level guard). `ensureCsrf()` calls `GET /api/v1/auth/csrf` (credentials included) once per page load, memoised; call it from `Providers` in a `useEffect`.

**`session.ts`:**
- `sessionQueryOptions = { queryKey: queryKeys.session(), queryFn: () => apiGet<{ data: SessionUser }>("/api/v1/auth/session").then(r => r.data), staleTime: 60_000, retry: false }` with `// TODO(backend-contract)`.
- `useSession()` returns `{ user: SessionUser | null, isLoading, isAuthenticated, isStaff, can(permission): boolean, refetch }`; a 401 resolves to `user: null` (NOT an error state and it must not trigger the global `onUnauthorized` redirect — pass a per-call option `skipUnauthorizedHandler: true`; add that option to `apiFetch` ONLY by wrapping: create `apiGetQuiet` in `api.ts` that catches `ApiError` 401 and returns `null`, without modifying `@vunvault/lib`).
- `useSessionStore` (Zustand): `{ user, setUser, clear }`, mirrored from the query result via an effect, so non-React code (nav chips) can read it. `isStaff` = role ∈ `super_admin, admin, security_analyst, soc_operator, compliance_auditor, support_engineer`.
- `useLogout()`: `useMutation` → `POST /api/v1/auth/logout`; on success `queryClient.clear()`, `useSessionStore.getState().clear()`, `router.replace("/login")`.

**Mock handlers (`auth.ts`) — all driven by fixtures from `@vunvault/contracts/fixtures`:** `GET */api/v1/auth/csrf` → `{ data: { csrfToken: "mock" } }` and set cookie `vv_csrf=mock`; `GET */api/v1/auth/session` → `{ data: <SessionUser for staffMembers[0] mapped> }` when the mock cookie `vv_mock_session=1` exists else `401 { error: "unauthorized" }`; `POST */api/v1/auth/login` → accepts `jane.wanjiru@acmefintech.co.ke` / any password ≥ 8 chars (response `{ data: { user: <client SessionUser>, mfaRequired: false, mfaMethods: [] } }`), accepts `e.reed@vunvault.com` (response `mfaRequired: true, mfaMethods: ["totp","webauthn","email_otp"]`), anything else `401 { error: "invalid_credentials" }`; `POST */api/v1/auth/logout` → `204`. The handlers are used ONLY by tests and the opt-in dev mock mode.

**Tests (assert):** `useSession` returns `user: null` and no thrown error on 401; `useSession().can("scans:read")` follows `permissions`; `useLogout` clears the cache and navigates; `Providers` renders a toast container (`Toaster`) exactly once.

---

**Data shape (TypeScript):**
```ts
interface SessionState { user: SessionUser | null; setUser(u: SessionUser | null): void; clear(): void }
interface UseSession { user: SessionUser | null; isLoading: boolean; isAuthenticated: boolean; isStaff: boolean; can(p: Permission): boolean; refetch(): void }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET  /api/v1/auth/csrf → 200 { data: { csrfToken: string } }
// GET  /api/v1/auth/session → 200 { data: SessionUser } | 401 { error: "unauthorized" }
// POST /api/v1/auth/logout → 204
```

---

**Out of scope:**
- Do not build login or any page UI.
- Do not use `localStorage`/`sessionStorage`; the Zustand store is in-memory only.
- Do not modify `packages/lib`.
- Do not create `mockServiceWorker.js`.

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm --filter web dev` renders the route(s) in this task with no console errors, and `pnpm --filter web test` passes (a smoke test per new component renders it and asserts the key verbatim strings).
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 42 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 43 — Edge middleware (nonce CSP, route guards), permission helpers, server session, error pages

**Layer:** L5

**Prerequisites:** Task 41, Task 42

**Estimated files touched:** 12

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Edge middleware (nonce CSP, route guards), permission helpers, server session, error pages**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Add the Cloudflare-compatible edge middleware (per-request CSP nonce, authenticated-route redirects, role-aware landing), the `can()`/`<Can>` permission helpers, a server-side session fetcher, and the 404 / error / 403 pages.

**Deliverables:**
- `apps/web/src/middleware.ts` — edge middleware.
- `apps/web/src/lib/csp.ts` — `buildCsp({ nonce, apiOrigin, r2Origin, dev })`.
- `apps/web/src/lib/jwt-peek.ts` — `peekClaims(token)` (base64url decode of the payload, NO verification).
- `apps/web/src/lib/permissions.ts` — `can`, `canAny`, `STAFF_ROLES`, `isStaffRole`, `homeFor(role)`.
- `apps/web/src/components/can.tsx` — `<Can permission=…>`.
- `apps/web/src/lib/server-session.ts` — `getServerSession()` and `requireSession(opts)`.
- `apps/web/src/app/not-found.tsx`, `apps/web/src/app/error.tsx`, `apps/web/src/app/global-error.tsx`, `apps/web/src/app/forbidden/page.tsx` — error pages.
- `apps/web/src/lib/csp.test.ts`, `apps/web/src/middleware.test.ts`, `apps/web/src/lib/permissions.test.ts` — tests.

**Dependencies allowed:**
- `@sentry/nextjs` is NOT allowed in this task.
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
- **Feature stylesheet exception:** the reference CSS blocks below come from the prototype. Reproduce them in the task's own `.css` file (listed in Deliverables), replacing every value that has a token with `var(--token)`. A colour with NO token (for example a one-off dark gradient stop) may stay as a literal ONLY inside that `.css` file; never in TSX.
- Prefer the Tailwind classes shown in the reference markup. Where the markup uses a custom class (`vv-*`, `hero-*`, `adm-*` …) implement it from the CSS block that follows it.
- Replace every `<svg data-icon="REPLACE-WITH-LUCIDE"/>` with the closest `lucide-react` icon (keep size classes); replace every `<a href>` to an internal route with `next/link`.
- Convert the markup to TSX: `class` → `className`, `for` → `htmlFor`, self-close void tags. Do NOT copy `href` values such as `*.html`; the routes shown (e.g. `/about`) are final.
- Text content is verbatim. Do not rewrite, shorten or "improve" any string.

---

**Visual specification (embedded copy + layout):**

**Middleware (`middleware.ts`, runs on every path except `_next/static`, `_next/image`, `favicon.ico`, `brand/*`, `mockServiceWorker.js`):**
1. Generate `nonce = base64(crypto.getRandomValues(16 bytes))` (Web Crypto only). Set request header `x-nonce` and set the response header `Content-Security-Policy` from `buildCsp`.
2. **CSP (`buildCsp`):** `default-src 'self'`; `script-src 'self' 'nonce-<nonce>' 'strict-dynamic' https://js.stripe.com https://js.paystack.co https://challenges.cloudflare.com` (add `'unsafe-eval'` ONLY when `dev`); `style-src 'self' 'unsafe-inline'`; `img-src 'self' data: blob: https://<r2Origin host>`; `font-src 'self'`; `connect-src 'self' <apiOrigin> wss://<apiOrigin host> https://api.stripe.com https://api.paystack.co https://*.ingest.sentry.io`; `frame-src https://js.stripe.com https://checkout.paystack.com https://challenges.cloudflare.com`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'`; `upgrade-insecure-requests`. Test that each directive string appears and the nonce is interpolated.
3. **Route guards (cookie presence only — the API remains the authority):** paths `/portal`, `/portal/*`, `/admin`, `/admin/*`, `/onboarding` require cookie `vv_at` or `vv_rt`; missing → `302 /login?next=<path+search>`. Paths `/login`, `/signup` with a session cookie present → `302 homeFor(role)` where `role` comes from `peekClaims(vv_at).role` (if no readable `vv_at`, do nothing). `/admin/*` with a peeked role of `client` → `302 /forbidden`. Add a comment: peeking is a routing convenience, never a security decision.
4. Static security headers are already set in `next.config.ts` (Task 41); do not duplicate them.

**`permissions.ts`:** `homeFor(role)`: staff roles → `/admin` (`support_engineer` → `/admin/profile` because they have no dashboard permission), `client` → `/portal`. `can(user, p)` = `user?.permissions.includes(p)`. `<Can permission="scans:release" fallback={…}>` renders children when allowed.

**`server-session.ts`:** `getServerSession()` reads incoming cookies via `next/headers` and calls `GET ${NEXT_PUBLIC_API_URL}/api/v1/auth/session` with a `cookie` header forwarded, `cache: "no-store"`; 401 → `null`. `requireSession({ staff?: boolean, permission?: Permission })` → `redirect("/login")` when null; `redirect("/forbidden")` when staff/permission checks fail; also redirects staff users with `aal1` — the API answers `mfa_required` on admin calls, so instead make `requireSession` check the session payload's `mfaEnrolled` and redirect staff without MFA to `/portal/security` is NOT allowed; use `/admin/profile#security` — keep this as a clearly commented placeholder: staff without MFA are sent to `/login?error=mfa_required`.

**Error pages (planner-authored copy — there is no prototype for these; keep them short):** 
- `not-found.tsx`: eyebrow `"404"`, title `"Page not found"`, body `"The page you requested does not exist or has moved."`, primary link `"Return home"` → `/`.
- `forbidden/page.tsx`: eyebrow `"403"`, title `"Access restricted"`, body `"Your account does not have permission to view this page."`, link `"Back to my workspace"` → `homeFor(role)` (client component using `useSession`).
- `error.tsx` (client): title `"Something went wrong"`, body `"An unexpected error occurred. Try again, and contact support if it keeps happening."`, button `"Try again"` (calls `reset`). `global-error.tsx` mirrors it with its own `<html><body>`.
Layout for all four: centred column, `min-h-[70vh]`, eyebrow in the `Eyebrow` component, `h1` `text-3xl font-extrabold tracking-tight text-ink`, body `text-ink-muted max-w-md`, `Button variant="primary"` / `Button asChild`. Use the `Logo` component above the content.

**Tests:** CSP contains `'nonce-` and `frame-ancestors 'none'` and no `'unsafe-eval'` outside dev; middleware redirects `/admin` without a cookie to `/login?next=%2Fadmin`; `/portal` with a cookie passes; `/login` with a `client` cookie redirects to `/portal`; `/admin/users` with a client token redirects to `/forbidden`; `peekClaims` never throws on garbage.

---

**Data shape (TypeScript):**
```ts
type Role = UserRole;
function homeFor(role: Role): "/admin" | "/admin/profile" | "/portal";
function peekClaims(token: string): { role?: Role; exp?: number } | null;
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/auth/session (server-side, cookie forwarded) → 200 { data: SessionUser } | 401 { error: "unauthorized" }
```

---

**Out of scope:**
- Do not verify JWTs at the edge; the API is the authority.
- Do not add Sentry (Layer L14).
- Do not build layouts for portal/admin (Tasks 45–46).
- Do not use `localStorage`.

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm --filter web dev` renders the route(s) in this task with no console errors, and `pnpm --filter web test` passes (a smoke test per new component renders it and asserts the key verbatim strings).
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 43 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 44 — Marketing layout: header, mobile drawer, auth-aware nav, footer variants, preloader gate

**Layer:** L5

**Prerequisites:** Task 13, Task 41, Task 42, Task 43

**Estimated files touched:** 12

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Marketing layout: header, mobile drawer, auth-aware nav, footer variants, preloader gate**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the shared marketing chrome: sticky header with desktop nav and the mobile drawer, the auth-aware Login / Profile chip, the footer (with per-page link-set variants), and the first-load preloader gate.

**Deliverables:**
- `apps/web/src/app/(marketing)/_components/site-header.tsx` — `SiteHeader` (client).
- `apps/web/src/app/(marketing)/_components/mobile-menu.tsx` — drawer + hamburger.
- `apps/web/src/app/(marketing)/_components/site-footer.tsx` — `SiteFooter` with `variant` prop.
- `apps/web/src/app/(marketing)/_components/footer-data.ts` — link sets per variant (below).
- `apps/web/src/app/(marketing)/_components/preloader-gate.tsx` — `PreloaderGate` (client).
- `apps/web/src/app/(marketing)/_styles/chrome.css` — feature stylesheet (reference CSS below).
- MODIFY `apps/web/src/app/(marketing)/layout.tsx` — `<PreloaderGate/>`, `<SiteHeader/>`, `<main className="flex-1">`, `<SiteFooter/>` inside `<div className="min-h-screen bg-paper text-neutral-900 flex flex-col">`.
- `apps/web/src/app/(marketing)/_components/chrome.test.tsx` — tests.

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
- **Feature stylesheet exception:** the reference CSS blocks below come from the prototype. Reproduce them in the task's own `.css` file (listed in Deliverables), replacing every value that has a token with `var(--token)`. A colour with NO token (for example a one-off dark gradient stop) may stay as a literal ONLY inside that `.css` file; never in TSX.
- Prefer the Tailwind classes shown in the reference markup. Where the markup uses a custom class (`vv-*`, `hero-*`, `adm-*` …) implement it from the CSS block that follows it.
- Replace every `<svg data-icon="REPLACE-WITH-LUCIDE"/>` with the closest `lucide-react` icon (keep size classes); replace every `<a href>` to an internal route with `next/link`.
- Convert the markup to TSX: `class` → `className`, `for` → `htmlFor`, self-close void tags. Do NOT copy `href` values such as `*.html`; the routes shown (e.g. `/about`) are final.
- Text content is verbatim. Do not rewrite, shorten or "improve" any string.

---

**Visual specification (embedded copy + layout):**

**Reference markup (convert to TSX; the nav list is data-driven):**

##### Marketing header (all marketing pages)
Active nav item = the current route (`aria-current="page"`, classes `text-neutral-900 font-bold bg-neutral-200/60`); inactive = `text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100`. The `Login` link is replaced by the profile chip when a session exists.
```html
<header class="sticky top-0 z-50 bg-paper/95 backdrop-blur-md border-b border-neutral-200/80 transition-all duration-200">
 <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
  <a href="/" class="flex items-center gap-3 group shrink-0" aria-label="VUNVAULT home">
   <span class="w-9 h-9 rounded-xl bg-black flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
    <img src="logo.svg" alt="VUNVAULT" class="w-6 h-6 object-contain"/>
   </span>
   <span class="font-extrabold text-xl md:text-2xl tracking-wider text-neutral-900 group-hover:opacity-80 transition-opacity">VUNVAULT</span>
  </a>
  <nav class="hidden md:flex items-center gap-2 md:gap-4 lg:gap-6 min-w-0 overflow-x-auto no-scrollbar py-1" aria-label="Primary">
   <a href="/about" class="relative px-2.5 py-1 text-xs sm:text-sm font-medium transition-all whitespace-nowrap cursor-pointer rounded-full text-neutral-900 font-bold bg-neutral-200/60">About Us</a>
   <a href="/services" class="relative px-2.5 py-1 text-xs sm:text-sm font-medium transition-all whitespace-nowrap cursor-pointer rounded-full text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100">Services</a>
   <a href="/academy" class="relative px-2.5 py-1 text-xs sm:text-sm font-medium transition-all whitespace-nowrap cursor-pointer rounded-full text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100">Academy</a>
   <a href="/blog" class="relative px-2.5 py-1 text-xs sm:text-sm font-medium transition-all whitespace-nowrap cursor-pointer rounded-full text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100">Blog</a>
   <a href="/products" class="relative px-2.5 py-1 text-xs sm:text-sm font-medium transition-all whitespace-nowrap cursor-pointer rounded-full text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100">Products</a>
   <a href="/contact" class="relative px-2.5 py-1 text-xs sm:text-sm font-medium transition-all whitespace-nowrap cursor-pointer rounded-full text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100">Contact</a>
   <a href="/login" id="navLoginLink" class="relative px-2.5 py-1 text-xs sm:text-sm font-medium transition-all whitespace-nowrap cursor-pointer rounded-full text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100">Login</a>
   <a href="/portal/profile" id="navProfileLink" class="nav-profile" hidden>
    <span class="nav-profile-avatar" id="navProfileAvatar" aria-hidden="true">U</span>
    <span class="nav-profile-label" id="navProfileLabel">Profile</span>
   </a>
  </nav>
  <button id="mobile-menu-toggle" class="hamburger" type="button" aria-label="Toggle navigation menu" aria-expanded="false" aria-controls="mobile-menu">
   <span class="hamburger-bar"></span>
   <span class="hamburger-bar"></span>
   <span class="hamburger-bar"></span>
  </button>
 </div>
 <nav id="mobile-menu" class="mobile-menu" aria-label="Mobile">
  <ul class="mobile-menu-list">
   <li>
    <a href="/about">About Us</a>
   </li>
   <li>
    <a href="/services">Services</a>
   </li>
   <li>
    <a href="/academy">Academy</a>
   </li>
   <li>
    <a href="/blog">Blog</a>
   </li>
   <li>
    <a href="/products">Products</a>
   </li>
   <li>
    <a href="/contact">Contact</a>
   </li>
   <li id="mobileLoginItem">
    <a href="/login" class="mobile-menu-login">Login</a>
   </li>
   <li id="mobileProfileItem" hidden>
    <a href="/portal/profile" id="mobileProfileLink" class="mobile-menu-login">Profile</a>
   </li>
  </ul>
 </nav>
</header>
```
Custom CSS for this markup (reference):
```css
.hamburger { display: none; flex-direction: column; justify-content: center; align-items: center; gap: 5px; width: 44px; height: 44px; border-radius: 12px; border: 1px solid var(--line); background: #ffffff; transition: background-color var(--dur) var(--ease), border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
.hamburger:hover { border-color: var(--brand-line); box-shadow: 0 6px 18px -12px var(--brand-glow); }
.hamburger-bar { display: block; width: 20px; height: 2px; border-radius: 2px; background: var(--ink); transition: transform 0.28s var(--ease), opacity 0.2s var(--ease), background-color var(--dur) var(--ease), width 0.28s var(--ease); }
.hamburger.is-active { background: var(--dark); border-color: rgba(59, 153, 252, 0.4); }
.hamburger.is-active .hamburger-bar { background: var(--brand); }
.hamburger.is-active .hamburger-bar:nth-child(1) { transform: translateY(7px) rotate(45deg); }
.hamburger.is-active .hamburger-bar:nth-child(2) { opacity: 0; width: 0; }
.hamburger.is-active .hamburger-bar:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }
.mobile-menu { position: absolute; top: 100%; left: 0; right: 0; background: linear-gradient(180deg, var(--dark) 0%, #05070a 100%); border-top: 1px solid rgba(59, 153, 252, 0.18); border-bottom: 1px solid rgba(59, 153, 252, 0.18); box-shadow: 0 30px 60px -25px rgba(0, 0, 0, 0.7); overflow: hidden; max-height: 0; opacity: 0; visibility: hidden; transform: translateY(-10px); transition: max-height 0.42s var(--ease), opacity 0.3s var(--ease), transform 0.35s var(--ease), visibility 0.42s var(--ease); }
.mobile-menu.is-open { max-height: 520px; opacity: 1; visibility: visible; transform: translateY(0); }
.mobile-menu-list { display: flex; flex-direction: column; padding: 12px 20px 22px; }
.mobile-menu-list li + li { border-top: 1px solid rgba(255, 255, 255, 0.06); }
.mobile-menu-list a { display: flex; align-items: center; justify-content: space-between; padding: 15px 6px; font-size: 0.95rem; font-weight: 500; letter-spacing: 0.01em; color: #d6dde8; transition: color var(--dur) var(--ease), padding-left var(--dur) var(--ease); }
.mobile-menu-list a::after { content: "→"; font-size: 0.85rem; color: var(--brand); opacity: 0; transform: translateX(-6px); transition: opacity var(--dur) var(--ease), transform var(--dur) var(--ease); }
.mobile-menu-list a:hover,
.mobile-menu-list a:focus-visible { color: var(--brand); padding-left: 12px; outline: none; }
.mobile-menu-list a:hover::after,
.mobile-menu-list a:focus-visible::after { opacity: 1; transform: translateX(0); }
.mobile-menu-login { margin-top: 14px; justify-content: center !important; padding: 14px 18px !important; border-radius: var(--r-full); background: linear-gradient(135deg, var(--brand), var(--brand-strong)); color: #ffffff !important; font-weight: 700 !important; box-shadow: 0 12px 28px -14px var(--brand-glow); }
.mobile-menu-login::after { display: none; }
.mobile-menu-login:hover { padding-left: 18px !important; color: #ffffff !important; filter: brightness(1.08); }
@media (max-width: 768px) {
.hamburger { display: flex; }
}
@media (min-width: 768px) {
.hamburger { display: none; }
}
```

##### Marketing footer (home variant — default)
```html
<footer class="mt-20 border-t border-neutral-200/80 bg-paper text-neutral-800">
 <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
  <div class="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-12">
   <div class="md:col-span-4 space-y-4">
    <a href="/" class="flex items-center gap-3" aria-label="VUNVAULT home">
     <span class="w-9 h-9 rounded-xl bg-black flex items-center justify-center shrink-0 shadow-xs">
      <img src="logo.svg" alt="VUNVAULT" class="w-6 h-6 object-contain"/>
      <path></path>
      <path></path>
     </span>
     <span class="font-extrabold text-2xl tracking-wider text-neutral-900">VUNVAULT</span>
    </a>
    <p class="text-neutral-500 text-sm max-w-sm leading-relaxed">Africa-rooted, worldwide penetration testing, vulnerability assessments and cybersecurity education.</p>
    <div class="pt-2 flex items-center gap-3">
     <span class="inline-flex items-center gap-1.5 text-xs text-neutral-600 bg-neutral-200/60 px-3 py-1 rounded-full font-medium">
      <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
      System Operational
     </span>
    </div>
   </div>
   <div class="md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-8">
    <div class="space-y-3.5">
     <h4 class="text-xs font-bold text-neutral-900 tracking-wider uppercase">Resources</h4>
     <ul class="space-y-2 text-sm text-neutral-500">
      <li>
       <a href="/news" class="hover:text-neutral-900 transition-colors">News</a>
      </li>
      <li>
       <a href="/blog" class="hover:text-neutral-900 transition-colors">Blog</a>
      </li>
      <li>
       <button type="button" class="hover:text-neutral-900 transition-colors text-left cursor-pointer">Breach Watch</button>
      </li>
      <li>
       <button type="button" class="hover:text-neutral-900 transition-colors text-left cursor-pointer">Templates</button>
      </li>
     </ul>
    </div>
    <div class="space-y-3.5">
     <h4 class="text-xs font-bold text-neutral-900 tracking-wider uppercase">Company</h4>
     <ul class="space-y-2 text-sm text-neutral-500">
      <li>
       <button type="button" class="hover:text-neutral-900 transition-colors cursor-pointer">About Us</button>
      </li>
      <li>
       <button type="button" class="hover:text-neutral-900 transition-colors cursor-pointer">Careers</button>
      </li>
      <li>
       <button type="button" class="hover:text-neutral-900 transition-colors cursor-pointer">Contact</button>
      </li>
      <li>
       <a href="/news" class="hover:text-neutral-900 transition-colors">Press</a>
      </li>
      <li>
       <button type="button" class="hover:text-neutral-900 transition-colors cursor-pointer">Support</button>
      </li>
     </ul>
    </div>
    <div class="space-y-3.5">
     <h4 class="text-xs font-bold text-neutral-900 tracking-wider uppercase">Solutions</h4>
     <ul class="space-y-2 text-sm text-neutral-500">
      <li>
       <a href="/services" class="hover:text-neutral-900 transition-colors">Small Business</a>
      </li>
      <li>
       <a href="/services" class="hover:text-neutral-900 transition-colors">SACCO & Fintech</a>
      </li>
      <li>
       <a href="/services" class="hover:text-neutral-900 transition-colors">Enterprise</a>
      </li>
      <li>
       <a href="/academy" class="hover:text-neutral-900 transition-colors">Security Training</a>
      </li>
     </ul>
    </div>
    <div class="space-y-3.5">
     <h4 class="text-xs font-bold text-neutral-900 tracking-wider uppercase">Tools</h4>
     <ul class="space-y-2 text-sm text-neutral-500">
      <li>
       <button type="button" class="hover:text-neutral-900 transition-colors text-left cursor-pointer">Free Security Scan</button>
      </li>
      <li>
       <a href="/services" class="hover:text-neutral-900 transition-colors">Pricing & Plans</a>
      </li>
      <li>
       <button type="button" class="hover:text-neutral-900 transition-colors cursor-pointer">Request a Report</button>
      </li>
     </ul>
    </div>
   </div>
  </div>
  <div class="mt-16 pt-8 border-t border-neutral-200/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
   <div>© 2026 VUNVAULT. All rights reserved.</div>
   <div class="flex items-center gap-6">
    <a href="/" class="hover:text-neutral-900 transition-colors">Top</a>
    <a href="/services" class="hover:text-neutral-900 transition-colors">Services</a>
    <a href="/academy" class="hover:text-neutral-900 transition-colors">Academy</a>
    <button type="button" class="hover:text-neutral-900 transition-colors cursor-pointer">Contact</button>
    <button type="button" class="p-1.5 rounded-full hover:bg-neutral-200/60 text-neutral-600 transition-colors cursor-pointer ml-2" aria-label="Scroll to top">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
    </button>
   </div>
  </div>
 </div>
</footer>
```

**Profile chip (reference CSS for `.nav-profile`, shown instead of `Login` when a session exists):**
```css

```
Chip content: a circular avatar with the FIRST LETTER of the user's `fullName` uppercased (initially `U`) and the label `"Profile"`; it links to `/portal/profile` for clients and `/admin/profile` for staff. In the drawer the `Login` item becomes a `Profile` item.

**Primary nav (data):** `About Us` → `/about`, `Services` → `/services`, `Academy` → `/academy`, `Blog` → `/blog`, `Products` → `/products`, `Contact` → `/contact`, then `Login` → `/login`. Drawer items identical (the `Login`/`Profile` item uses the `mobile-menu-login` class). The drawer: `aria-controls="mobile-menu"`, toggles `.is-open` on the drawer and `.is-active` on the hamburger, `aria-expanded` kept in sync, closes on route change and on Escape, and adds `nav-open` to `<body>` while open.

**Preloader gate:** a client component that renders `<Preloader onDone=… />` (Task 13) ONCE per full page load (module-level boolean — NOT `sessionStorage`), and on done dispatches `document.dispatchEvent(new CustomEvent("vunvault:preloader-done"))` (the consent banner listens for it in Task 58). SSR renders the preloader markup so there is no flash of content; under reduced motion the duration is already short (Task 13).

**Footer variants (`variant: "home" | "company" | "products" | "contact"`; `home` is the markup above):** the quick-links bottom row (`Top`, `Services`, `Academy`, `Contact`) and the copyright `© 2026 VUNVAULT. All rights reserved.` exist on all variants; the dark variant (`contact`) uses `bg-dark text-white` with `border-t border-white/10`. Link sets extracted from the prototype pages (verbatim labels; map `Services`→`/services`, `About Us`→`/about`, `Contact`→`/contact`, `Blog`→`/blog`, `News`→`/blog`, `Free Security Scan`→ opens the scanner dialog (button), `Pricing & Plans`→`/services#pricing`, `Request a Report`→ `/contact#contact-form`; labels with no destination (`Breach Watch`, `Templates`, `Careers`, `Press`, `Support`, `Small Business`, `SACCO & Fintech`, `Enterprise`, `Security Training`) are rendered as `<button type="button">` exactly as in the prototype, no navigation):
- **index.html** → Resources: News · Blog · Breach Watch · Templates | Company: About Us · Careers · Contact · Press · Support | Solutions: Small Business · SACCO & Fintech · Enterprise · Security Training | Tools: Free Security Scan · Pricing & Plans · Request a Report
- **about.html** → Company: About Us · Core Team · Mission & Vision · Careers · Contact | Services: Small Business · SACCO & Fintech · Enterprise · Security Training · Products | Resources: Blog · News · Live Telemetry · Free Security Scan · Pricing & Plans | Legal: Privacy Policy · Terms of Service · Responsible Disclosure · Cookie Policy · Press Office
- **services.html** → Resources: Blog · Zero-Day Portal · Free OSINT Tools · Academy | Company: About Us · Contact · Services · Press | Solutions: Starter Audit · Advanced VA · Full-Scope Pen Test · Enterprise Retainer | Legal: Privacy Policy · Terms of Service · NDA Policy
- **product.html** → Resources: News · Blog · Free Tools · Live Console | Company: About Us · Services · Contact · Press | Solutions: Small Business · SACCO & Fintech · Enterprise · Security Training | Products: Premium Catalog · Free Resources · Checkout · My Account
- **contact.html** → Resources: News · Blog · Breach Watch · Templates | Company: About Us · Careers · Contact · Press | Solutions: Small Business · SACCO & Fintech · Enterprise · Security Training | Tools: Free Security Scan · Pricing & Plans · Request a Report

**Behaviour:** the header is `sticky top-0 z-50`; the profile chip subscribes to `useSession()` (Task 42) — while loading render the `Login` link (no layout shift). The `Logo` component from Task 13 may be used for the brand block provided it reproduces the markup above pixel-for-pixel (tile `w-9 h-9 rounded-xl bg-black`, wordmark `font-extrabold text-xl md:text-2xl tracking-wider`); if Task 13's variant differs, use the markup above directly inside `SiteHeader`.

**Tests:** nav renders seven links with the verbatim labels; with a mocked session the `Login` link is replaced by `Profile`; the hamburger toggles `aria-expanded` and Escape closes the drawer; `PreloaderGate` renders the caption `Establishing secure channel` once and unmounts after `onDone`; each footer variant renders its column headings.

---

**Data shape (TypeScript):**
```ts
interface FooterColumn { title: string; links: { label: string; href?: string; action?: "scanner" }[] }
type FooterVariant = "home" | "company" | "products" | "contact";
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/auth/session → 200 { data: SessionUser } | 401   // TODO(backend-contract) via useSession()
```

---

**Out of scope:**
- Do not build any page body.
- Do not implement the scanner dialog (Task 48) — footer 'Free Security Scan' dispatches a `vunvault:open-scanner` window event that Task 48 listens for.
- Do not use `sessionStorage` or `localStorage`.

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm --filter web dev` renders the route(s) in this task with no console errors, and `pnpm --filter web test` passes (a smoke test per new component renders it and asserts the key verbatim strings).
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 44 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 45 — Client portal layout: header, mobile drawer, footer, Request PenTest dialog

**Layer:** L5

**Prerequisites:** Task 11, Task 10, Task 30, Task 42, Task 43, Task 44

**Estimated files touched:** 12

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Client portal layout: header, mobile drawer, footer, Request PenTest dialog**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the client portal chrome and the shared Request PenTest dialog used from the header on every portal page.

**Deliverables:**
- `apps/web/src/app/(authed)/portal/_components/portal-header.tsx`
- `apps/web/src/app/(authed)/portal/_components/portal-footer.tsx`
- `apps/web/src/app/(authed)/portal/_components/request-pentest-dialog.tsx` — dialog + RHF/Zod form.
- `apps/web/src/app/(authed)/portal/_hooks/use-create-pentest.ts` — `useMutation` hook.
- `apps/web/src/app/(authed)/portal/_styles/portal-chrome.css`
- MODIFY `apps/web/src/app/(authed)/portal/layout.tsx` — `requireSession()` (server) then the chrome around `{children}`.
- `apps/web/src/mocks/handlers/pentest.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts` — add the handler.
- `apps/web/src/app/(authed)/portal/_components/portal-chrome.test.tsx` — tests.

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
- **Feature stylesheet exception:** the reference CSS blocks below come from the prototype. Reproduce them in the task's own `.css` file (listed in Deliverables), replacing every value that has a token with `var(--token)`. A colour with NO token (for example a one-off dark gradient stop) may stay as a literal ONLY inside that `.css` file; never in TSX.
- Prefer the Tailwind classes shown in the reference markup. Where the markup uses a custom class (`vv-*`, `hero-*`, `adm-*` …) implement it from the CSS block that follows it.
- Replace every `<svg data-icon="REPLACE-WITH-LUCIDE"/>` with the closest `lucide-react` icon (keep size classes); replace every `<a href>` to an internal route with `next/link`.
- Convert the markup to TSX: `class` → `className`, `for` → `htmlFor`, self-close void tags. Do NOT copy `href` values such as `*.html`; the routes shown (e.g. `/about`) are final.
- Text content is verbatim. Do not rewrite, shorten or "improve" any string.

---

**Visual specification (embedded copy + layout):**

**Reference markup:**

##### Portal header
Active item = current route. `Request PenTest` opens the dialog below. The nav hrefs map: Academy Progress → `/portal/academy`, Free Vulnerability Scanner → `/portal/scanner`, Billing & Invoices → `/portal/billing`, Password Manager → `/portal/security`.
```html
<header class="sticky top-0 z-50 bg-paper/95 backdrop-blur-md border-b border-neutral-200/80 transition-all duration-200">
 <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
  <a href="/" class="flex items-center gap-3 group shrink-0" aria-label="VUNVAULT home">
   <span class="w-9 h-9 rounded-xl bg-black flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
    <img src="logo.svg" alt="VUNVAULT" class="w-6 h-6 object-contain"/>
   </span>
   <span class="font-extrabold text-xl md:text-2xl tracking-wider text-neutral-900 group-hover:opacity-80 transition-opacity">VUNVAULT</span>
  </a>
  <nav class="hidden md:flex items-center gap-1.5 lg:gap-3 min-w-0 no-scrollbar" aria-label="Primary">
   <a href="/portal/academy" class="relative px-2.5 py-1 text-xs sm:text-sm font-medium transition-all whitespace-nowrap cursor-pointer rounded-full text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100">Academy Progress</a>
   <a href="/portal/scanner" class="relative px-2.5 py-1 text-xs sm:text-sm font-medium transition-all whitespace-nowrap cursor-pointer rounded-full text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100">Free Vulnerability Scanner</a>
   <a href="/portal/billing" aria-current="page" class="relative px-2.5 py-1 text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer rounded-full text-neutral-900 bg-neutral-200/60">Billing & Invoices</a>
   <a href="/portal/security" class="relative px-2.5 py-1 text-xs sm:text-sm font-medium transition-all whitespace-nowrap cursor-pointer rounded-full text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100">Password Manager</a>
  </nav>
  <div class="flex items-center gap-2 shrink-0">
   <button type="button" class="vbb-navcta" aria-controls="requestPenTestModal">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Request PenTest</span>
   </button>
   <button id="mobile-menu-toggle" class="hamburger" type="button" aria-label="Toggle navigation menu" aria-expanded="false" aria-controls="mobile-menu">
    <span class="hamburger-bar"></span>
    <span class="hamburger-bar"></span>
    <span class="hamburger-bar"></span>
   </button>
  </div>
 </div>
 <nav id="mobile-menu" class="mobile-menu" aria-label="Mobile">
  <ul class="mobile-menu-list">
   <li>
    <a href="/portal/academy">Academy Progress</a>
   </li>
   <li>
    <a href="/portal/scanner">Free Vulnerability Scanner</a>
   </li>
   <li>
    <a href="/portal/billing">Billing & Invoices</a>
   </li>
   <li>
    <a href="/portal/security">Password Manager</a>
   </li>
   <li>
    <a href="#requestPenTestModal" role="button" class="mobile-menu-login">+ Request PenTest</a>
   </li>
  </ul>
 </nav>
</header>
```
Custom CSS for this markup (reference):
```css
.hamburger { display: none; flex-direction: column; justify-content: center; align-items: center; gap: 5px; width: 44px; height: 44px; border-radius: 12px; border: 1px solid var(--line); background: #ffffff; transition: background-color var(--dur) var(--ease), border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
.hamburger:hover { border-color: var(--brand-line); box-shadow: 0 6px 18px -12px var(--brand-glow); }
.hamburger-bar { display: block; width: 20px; height: 2px; border-radius: 2px; background: var(--ink); transition: transform 0.28s var(--ease), opacity 0.2s var(--ease), background-color var(--dur) var(--ease), width 0.28s var(--ease); }
.hamburger.is-active { background: var(--dark); border-color: rgba(59, 153, 252, 0.4); }
.hamburger.is-active .hamburger-bar { background: var(--brand); }
.hamburger.is-active .hamburger-bar:nth-child(1) { transform: translateY(7px) rotate(45deg); }
.hamburger.is-active .hamburger-bar:nth-child(2) { opacity: 0; width: 0; }
.hamburger.is-active .hamburger-bar:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }
.mobile-menu { position: absolute; top: 100%; left: 0; right: 0; background: linear-gradient(180deg, var(--dark) 0%, #05070a 100%); border-top: 1px solid rgba(59, 153, 252, 0.18); border-bottom: 1px solid rgba(59, 153, 252, 0.18); box-shadow: 0 30px 60px -25px rgba(0, 0, 0, 0.7); overflow: hidden; max-height: 0; opacity: 0; visibility: hidden; transform: translateY(-10px); transition: max-height 0.42s var(--ease), opacity 0.3s var(--ease), transform 0.35s var(--ease), visibility 0.42s var(--ease); }
.mobile-menu.is-open { max-height: 520px; opacity: 1; visibility: visible; transform: translateY(0); }
.mobile-menu-list { display: flex; flex-direction: column; padding: 12px 20px 22px; }
.mobile-menu-list li + li { border-top: 1px solid rgba(255, 255, 255, 0.06); }
.mobile-menu-list a { display: flex; align-items: center; justify-content: space-between; padding: 15px 6px; font-size: 0.95rem; font-weight: 500; letter-spacing: 0.01em; color: #d6dde8; transition: color var(--dur) var(--ease), padding-left var(--dur) var(--ease); }
.mobile-menu-list a::after { content: "→"; font-size: 0.85rem; color: var(--brand); opacity: 0; transform: translateX(-6px); transition: opacity var(--dur) var(--ease), transform var(--dur) var(--ease); }
.mobile-menu-list a:hover,
.mobile-menu-list a:focus-visible { color: var(--brand); padding-left: 12px; outline: none; }
.mobile-menu-list a:hover::after,
.mobile-menu-list a:focus-visible::after { opacity: 1; transform: translateX(0); }
.mobile-menu-login { margin-top: 14px; justify-content: center !important; padding: 14px 18px !important; border-radius: var(--r-full); background: linear-gradient(135deg, var(--brand), var(--brand-strong)); color: #ffffff !important; font-weight: 700 !important; box-shadow: 0 12px 28px -14px var(--brand-glow); }
.mobile-menu-login::after { display: none; }
.mobile-menu-login:hover { padding-left: 18px !important; color: #ffffff !important; filter: brightness(1.08); }
@media (max-width: 768px) {
.hamburger { display: flex; }
}
@media (min-width: 768px) {
.hamburger { display: none; }
}
.vbb-navcta { display: none; align-items: center; gap: 7px; padding: 9px 18px; font-size: 0.76rem; font-weight: 800; letter-spacing: 0.01em; color: #04121f; background: linear-gradient(135deg, var(--brand-soft), var(--brand)); border: 1px solid rgba(59, 153, 252, 0.45); border-radius: var(--r-full); box-shadow: 0 12px 26px -16px var(--brand-glow); cursor: pointer; white-space: nowrap; transition: transform 0.22s var(--ease), filter 0.22s var(--ease), box-shadow 0.22s var(--ease); }
.vbb-navcta:hover { transform: translateY(-1px); filter: brightness(1.06); box-shadow: 0 18px 34px -18px var(--brand-glow); }
@media (min-width: 768px) {
.vbb-navcta { display: inline-flex; }
}
```

##### Portal footer
```html
<footer class="vbb-footer">
 <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <div class="vbb-footer-inner">
   <div>© 2026 VUNVAULT · Client Portal</div>
   <div class="vbb-footer-links">
    <a href="/">Home</a>
    <a href="/services">Services</a>
    <a href="/portal/billing">Billing</a>
    <a href="/contact">Contact</a>
   </div>
  </div>
 </div>
</footer>
```
Custom CSS for this markup (reference):
```css
.vbb-footer { border-top: 1px solid var(--line-soft); background: var(--paper); }
.vbb-footer-inner { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; padding: 26px 0; font-size: 0.74rem; color: var(--ink-muted); }
.vbb-footer-links { display: flex; flex-wrap: wrap; align-items: center; gap: 20px; }
.vbb-footer-links a { transition: color var(--dur) var(--ease); }
.vbb-footer-links a:hover { color: var(--brand-strong); }
@media (max-width: 640px) {
.vbb-footer-inner { flex-direction: column; text-align: center; }
}
```

##### Request PenTest dialog
```html
<form id="vbb-pentest-form">
 <div class="vbb-grid-form">
  <div class="vbb-field vbb-col-span-2">
   <label for="pt-scope">Scope / Target URL</label>
   <input id="pt-scope" name="scope" class="vbb-input" type="text" placeholder="https://app.example.com  or  10.0.0.0/24" autocomplete="off" required/>
   <span class="vbb-hint">One primary asset per request — additional assets can be added after scoping.</span>
  </div>
  <div class="vbb-field">
   <label for="pt-type">Target Type</label>
   <select id="pt-type" name="targetType" class="vbb-select" required>
    <option value="Web Application">Web Application</option>
    <option value="Network / Infrastructure">Network / Infrastructure</option>
    <option value="API">API</option>
    <option value="Mobile App">Mobile App</option>
   </select>
  </div>
  <div class="vbb-field">
   <label for="pt-schedule">Preferred Schedule</label>
   <input id="pt-schedule" name="schedule" class="vbb-input" type="date"/>
  </div>
  <div class="vbb-field vbb-col-span-2">
   <label for="pt-notes">Special Instructions / Notes</label>
   <textarea id="pt-notes" name="notes" class="vbb-input" rows="4" placeholder="Testing windows, out-of-scope hosts, credentials handling, compliance drivers…"></textarea>
  </div>
 </div>
 <div class="vbb-modal-actions">
  <p class="vbb-modal-note">Submissions are encrypted in transit and reviewed by the VUNVAULT engagement team only.</p>
  <button type="button" class="vbb-btn vbb-btn--ghost">Cancel</button>
  <button type="submit" class="vbb-btn vbb-btn--primary" id="vbb-pentest-submit">
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
   <span>Submit Request</span>
  </button>
 </div>
</form>
```
Custom CSS for this markup (reference):
```css
.vbb-btn { display: inline-flex; align-items: center; justify-content: center; gap: 9px; padding: 13px 24px; font-size: 0.8rem; font-weight: 800; letter-spacing: 0.01em; border-radius: var(--r-full); border: 1px solid transparent; cursor: pointer; white-space: nowrap; text-decoration: none; transition: transform 0.22s var(--ease), filter 0.22s var(--ease), box-shadow 0.22s var(--ease), background-color 0.22s var(--ease), border-color 0.22s var(--ease), color 0.22s var(--ease); }
.vbb-btn svg { transition: transform 0.22s var(--ease); }
.vbb-btn:active { transform: translateY(0) scale(0.98); }
.vbb-btn--primary { color: #04121f; background: linear-gradient(135deg, var(--brand-soft), var(--brand)); border-color: rgba(59, 153, 252, 0.45); box-shadow: 0 16px 34px -16px var(--brand-glow); }
.vbb-btn--primary:hover { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 22px 46px -18px var(--brand-glow); }
.vbb-btn--ghost { color: var(--ink-soft); background: #ffffff; border-color: var(--line); }
.vbb-btn--ghost:hover { color: var(--ink); border-color: var(--brand-line); background: var(--brand-tint); transform: translateY(-1px); }
.vbb-modal-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 26px; padding-top: 22px; border-top: 1px solid var(--line-soft); }
.vbb-modal-note { margin-right: auto; font-size: 0.7rem; line-height: 1.5; color: var(--ink-faint); max-width: 32ch; }
.vbb-grid-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.vbb-col-span-2 { grid-column: span 2; }
.vbb-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.vbb-field > label { font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-muted); }
.vbb-input,
    .vbb-select { width: 100%; padding: 12px 14px; font-size: 0.84rem; font-family: inherit; color: var(--ink); background: #ffffff; border: 1px solid var(--line); border-radius: var(--r-md); outline: none; transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
.vbb-input::placeholder { color: var(--ink-faint); }
.vbb-input:focus,
    .vbb-select:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-tint); }
.vbb-input.is-invalid,
    .vbb-select.is-invalid { border-color: var(--critical); box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.16); }
.vbb-select { appearance: none; -webkit-appearance: none; background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%233B99FC' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 38px; cursor: pointer; }
@media (max-width: 768px) {
.vbb-modal-actions { flex-direction: column-reverse; align-items: stretch; }
.vbb-modal-actions .vbb-btn { width: 100%; }
.vbb-modal-note { max-width: none; text-align: center; margin-right: 0; }
}
@media (max-width: 640px) {
.vbb-grid-form { grid-template-columns: 1fr; }
.vbb-col-span-2 { grid-column: auto; }
.vbb-pay-actions .vbb-btn { flex: 1 1 auto; }
}
@media (prefers-reduced-motion: reduce) {
.vbb-modal,
      .vbb-modal-card,
      .vbb-toast,
      .vbb-btn,
      .vbb-dl,
      .vbb-status--pending .vbb-status-dot { transition-duration: 0.001ms !important; animation: none !important; }
}
```

**Dialog:** built on the `Dialog` primitive (Task 11) — `role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap, Escape closes. The prototype modal markup (for the exact title/description/field copy) is:
```html
<div id="requestPenTestModal" class="vbb-modal" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="vbb-pentest-title">
 <div class="vbb-modal-backdrop"></div>
 <div class="vbb-modal-card" role="document">
  <div>
   <div class="vbb-modal-head">
    <div>
     <span class="vbb-eyebrow">Secure engagement intake</span>
     <h2 id="vbb-pentest-title" class="vbb-modal-title">Request a Penetration Test</h2>
     <p class="vbb-modal-text">Tell us what to test and when. A named engagement lead will confirm scope, authorisation and scheduling within one business day.</p>
    </div>
    <button type="button" class="vbb-modal-close" aria-label="Close dialog">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
    </button>
   </div>
   <form id="vbb-pentest-form">
    <div class="vbb-grid-form">
     <div class="vbb-field vbb-col-span-2">
      <label for="pt-scope">Scope / Target URL</label>
      <input id="pt-scope" name="scope" class="vbb-input" type="text" placeholder="https://app.example.com  or  10.0.0.0/24" autocomplete="off" required/>
      <span class="vbb-hint">One primary asset per request — additional assets can be added after scoping.</span>
     </div>
     <div class="vbb-field">
      <label for="pt-type">Target Type</label>
      <select id="pt-type" name="targetType" class="vbb-select" required>
       <option value="Web Application">Web Application</option>
       <option value="Network / Infrastructure">Network / Infrastructure</option>
       <option value="API">API</option>
       <option value="Mobile App">Mobile App</option>
      </select>
     </div>
     <div class="vbb-field">
      <label for="pt-schedule">Preferred Schedule</label>
      <input id="pt-schedule" name="schedule" class="vbb-input" type="date"/>
     </div>
     <div class="vbb-field vbb-col-span-2">
      <label for="pt-notes">Special Instructions / Notes</label>
      <textarea id="pt-notes" name="notes" class="vbb-input" rows="4" placeholder="Testing windows, out-of-scope hosts, credentials handling, compliance drivers…"></textarea>
     </div>
    </div>
    <div class="vbb-modal-actions">
     <p class="vbb-modal-note">Submissions are encrypted in transit and reviewed by the VUNVAULT engagement team only.</p>
     <button type="button" class="vbb-btn vbb-btn--ghost">Cancel</button>
     <button type="submit" class="vbb-btn vbb-btn--primary" id="vbb-pentest-submit">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      <span>Submit Request</span>
     </button>
    </div>
   </form>
  </div>
  <div hidden>
   <span aria-hidden="true">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </span>
   <h3>Request received</h3>
   <p>
    Your penetration test request has been queued for scoping. A VUNVAULT engagement lead will reply to
    <strong>jane.wanjiru@acmefintech.co.ke</strong>
    within one business day.
   </p>
   <span>
    REF
    <span>VV-PT-000000</span>
   </span>
   <div>
    <button type="button" class="vbb-btn vbb-btn--dark">Done</button>
   </div>
  </div>
 </div>
</div>
```
Form fields (RHF + Zod from `CreatePentestRequestBody` in `@vunvault/contracts`): `targetUrl` (required), `targetType` (select with the four `PENTEST_TARGET_LABELS`), `preferredSchedule` (optional datetime-local, must be in the future), `notes` (optional textarea, max 2000). Validation messages: required target → `"Enter the URL or IP range to test."`; past date → `"Choose a date in the future."`. Submit button label and the success toast copy must match the prototype markup above verbatim; on success call `toast({ kind: "ok", title: <prototype success title>, message: <prototype success message, including the returned reference code `VV-PT-######`> })`, reset the form and close the dialog; on `422 target_not_allowed` show the inline error `"Internal and private addresses cannot be requested here. Contact your engagement lead."` (planner-authored).

**Behaviour:** `portal/layout.tsx` is a server component: `await requireSession({})` (Task 43) and render the header/footer around children inside `<div className="min-h-screen bg-paper text-neutral-900 flex flex-col">`. Staff users who open `/portal` are allowed (they can preview) — no redirect. The header's `Request PenTest` button and the drawer's `+ Request PenTest` item both open the same dialog (a tiny Zustand store `usePentestDialog` or React context). Active-link styling from `usePathname()`.

**Tests:** header renders the four nav labels and the CTA; clicking the CTA opens the dialog with a labelled title; submitting an empty form shows the required message with `role="alert"`; a past date is rejected; success path calls the mutation with `{ targetUrl, targetType }` and closes.

---

**Data shape (TypeScript):**
```ts
interface CreatePentestRequestBody { targetUrl: string; targetType: "web_application" | "network_infrastructure" | "api" | "mobile_app"; preferredSchedule?: string; notes?: string }
interface PentestRequest { id: string; refCode: string; targetUrl: string; targetType: PentestTargetType; status: "received"; createdAt: string }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/pentest-requests body CreatePentestRequestBody → 201 { data: PentestRequest } | 400 validation_failed | 422 { error: "target_not_allowed" } | 401
```

---

**Out of scope:**
- Do not build any portal page body.
- Do not implement the scanner or academy pages (reserved routes, no prototype supplied).
- Do not touch the marketing chrome.

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm --filter web dev` renders the route(s) in this task with no console errors, and `pnpm --filter web test` passes (a smoke test per new component renders it and asserts the key verbatim strings).
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 45 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 46 — Admin layout: Command Center header, permission-filtered nav, mobile drawer, footer, staff guard

**Layer:** L5

**Prerequisites:** Task 8, Task 42, Task 43

**Estimated files touched:** 11

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Admin layout: Command Center header, permission-filtered nav, mobile drawer, footer, staff guard**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the admin shell: sticky header with brand, live status pill, session chip, permission-filtered navigation and drawer, the audit-aware footer, and the staff-only server guard.

**Deliverables:**
- `apps/web/src/app/(authed)/admin/_components/admin-header.tsx`
- `apps/web/src/app/(authed)/admin/_components/admin-footer.tsx`
- `apps/web/src/app/(authed)/admin/_components/admin-nav.ts` — nav data + permission map.
- `apps/web/src/app/(authed)/admin/_styles/admin-chrome.css` — shell styles (`.adm-shell`, `.adm-main`, header, drawer, footer — reference below).
- MODIFY `apps/web/src/app/(authed)/admin/layout.tsx` — `requireSession({ staff: true })` then the chrome.
- `apps/web/src/app/(authed)/admin/_components/admin-chrome.test.tsx` — tests.

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
- **Feature stylesheet exception:** the reference CSS blocks below come from the prototype. Reproduce them in the task's own `.css` file (listed in Deliverables), replacing every value that has a token with `var(--token)`. A colour with NO token (for example a one-off dark gradient stop) may stay as a literal ONLY inside that `.css` file; never in TSX.
- Prefer the Tailwind classes shown in the reference markup. Where the markup uses a custom class (`vv-*`, `hero-*`, `adm-*` …) implement it from the CSS block that follows it.
- Replace every `<svg data-icon="REPLACE-WITH-LUCIDE"/>` with the closest `lucide-react` icon (keep size classes); replace every `<a href>` to an internal route with `next/link`.
- Convert the markup to TSX: `class` → `className`, `for` → `htmlFor`, self-close void tags. Do NOT copy `href` values such as `*.html`; the routes shown (e.g. `/about`) are final.
- Text content is verbatim. Do not rewrite, shorten or "improve" any string.

---

**Visual specification (embedded copy + layout):**

**Reference markup:**

##### Admin header
Session chip values come from `useSession()`: avatar = initials (first letters of first and last name, `Dr.` stripped), name = the user's email, role line = `ROLE_LABELS[role]`. Navigation entries are filtered by permission (below).
```html
<header class="sticky top-0 z-50 bg-paper/95 backdrop-blur-md border-b border-neutral-200/80 transition-all duration-200">
 <div class="adm-shell py-3 adm-header-inner">
  <a href="/admin" class="adm-brand" aria-label="VUNVAULT administrative home">
   <span class="adm-brand-tile">
    <img src="logo.svg" alt="VUNVAULT"/>
   </span>
   <span>
    <span class="adm-brand-name">VUNVAULT</span>
    <span class="adm-brand-sub">Command Center</span>
   </span>
  </a>
  <span class="adm-status-pill" role="status" aria-live="polite">
   <span class="adm-status-dot" aria-hidden="true">
    <span></span>
    <span></span>
   </span>
   <span>SYS: OPERATIONAL</span>
  </span>
  <div class="adm-user-chip">
   <span class="adm-avatar" aria-hidden="true">ER</span>
   <span class="adm-user-meta">
    <span class="adm-user-label">Logged in as</span>
    <span class="adm-user-name">e.reed@vunvault.com</span>
    <span class="adm-user-role">Super Administrator</span>
   </span>
  </div>
  <nav class="adm-nav" aria-label="Administrative sections">
   <a href="/admin" aria-current="page">Dashboard Overview</a>
   <a href="/admin/scan-queue">Scan Queue</a>
   <a href="/admin/zero-day">Zero-Day Intel</a>
   <a href="/admin/users">User Management</a>
   <a href="/admin/content">Content Moderation</a>
   <a href="/admin/audit">Audit Logs</a>
   <a href="/admin/profile">Profile Settings</a>
   <a href="/logout" class="adm-nav-signout">Sign Out</a>
  </nav>
  <button id="adm-menu-toggle" class="adm-hamburger" type="button" aria-label="Toggle administrative navigation menu" aria-expanded="false" aria-controls="adm-mobile-menu">
   <span class="adm-hamburger-bar"></span>
   <span class="adm-hamburger-bar"></span>
   <span class="adm-hamburger-bar"></span>
  </button>
 </div>
 <nav id="adm-mobile-menu" class="adm-drawer" aria-label="Administrative sections (mobile)">
  <ul class="adm-drawer-list">
   <li>
    <a href="/admin" aria-current="page">Dashboard Overview</a>
   </li>
   <li>
    <a href="/admin/scan-queue">Scan Queue & Job Assessment</a>
   </li>
   <li>
    <a href="/admin/zero-day">Zero-Day Intel</a>
   </li>
   <li>
    <a href="/admin/users">User & Access Management</a>
   </li>
   <li>
    <a href="/admin/content">Content Moderation</a>
   </li>
   <li>
    <a href="/admin/audit">System Audit Logs</a>
   </li>
   <li>
    <a href="/admin/profile">Profile Settings</a>
   </li>
   <li>
    <a href="/logout" class="adm-drawer-signout">Sign Out</a>
   </li>
  </ul>
 </nav>
</header>
```
Custom CSS for this markup (reference):
```css
.adm-header-inner { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.adm-brand { display: inline-flex; align-items: center; gap: 12px; text-decoration: none; flex: 0 0 auto; }
.adm-brand-tile { width: 2.35rem; height: 2.35rem; border-radius: 12px; background: linear-gradient(145deg, var(--dark), #000000); border: 1px solid rgba(59, 153, 252, 0.35); box-shadow: 0 0 0 1px rgba(59, 153, 252, 0.08), 0 6px 18px -10px var(--brand-glow); display: inline-flex; align-items: center; justify-content: center; transition: box-shadow var(--dur) var(--ease); }
.adm-brand:hover .adm-brand-tile { box-shadow: 0 0 0 1px rgba(59, 153, 252, 0.28), 0 10px 26px -12px var(--brand-glow); }
.adm-brand-tile img { width: 1.5rem; height: 1.5rem; object-fit: contain; }
.adm-brand-name { font-weight: 800; font-size: 1.2rem; letter-spacing: 0.14em; color: var(--ink); }
.adm-brand-sub { display: block; font-size: 9.5px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: var(--brand-strong); margin-top: 1px; }
.adm-status-pill { display: inline-flex; align-items: center; gap: 8px; padding: 7px 14px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #0f766e; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: var(--r-full); white-space: nowrap; }
.adm-status-dot { position: relative; display: inline-flex; width: 8px; height: 8px; }
.adm-status-dot span { position: absolute; inset: 0; border-radius: var(--r-full); background: var(--ok); }
.adm-status-dot span:last-child { animation: ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite; opacity: 0.6; }
.adm-user-chip { display: inline-flex; align-items: center; gap: 10px; padding: 6px 14px 6px 6px; border-radius: var(--r-full); background: #ffffff; border: 1px solid var(--line); box-shadow: 0 6px 18px -14px rgba(10, 13, 18, 0.5); white-space: nowrap; }
.adm-avatar { width: 32px; height: 32px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; letter-spacing: 0.04em; color: #ffffff; background: linear-gradient(135deg, var(--brand), var(--brand-strong)); flex: 0 0 auto; }
.adm-user-meta { display: flex; flex-direction: column; line-height: 1.25; min-width: 0; }
.adm-user-label { font-size: 9px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); }
.adm-user-name { font-size: 0.78rem; font-weight: 800; color: var(--ink); }
.adm-user-role { font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--brand-strong); }
.adm-nav { display: none; align-items: center; gap: 4px; overflow-x: auto; scrollbar-width: none; }
.adm-nav::-webkit-scrollbar { display: none; }
.adm-nav a { position: relative; display: inline-flex; align-items: center; padding: 7px 13px; font-size: 0.74rem; font-weight: 600; letter-spacing: 0.01em; white-space: nowrap; border-radius: var(--r-full); color: var(--ink-soft); transition: color var(--dur) var(--ease), background-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
.adm-nav a:hover { color: var(--brand-strong); background-color: var(--brand-tint); }
.adm-nav a[aria-current="page"] { color: var(--brand-strong); background-color: var(--brand-tint); box-shadow: inset 0 0 0 1px var(--brand-line); font-weight: 800; }
.adm-nav-signout { color: var(--critical) !important; }
.adm-nav-signout:hover { background-color: rgba(244, 63, 94, 0.1) !important; color: #be123c !important; }
.adm-hamburger { display: inline-flex; flex-direction: column; justify-content: center; align-items: center; gap: 5px; width: 44px; height: 44px; border-radius: 12px; border: 1px solid var(--line); background: #ffffff; transition: background-color var(--dur) var(--ease), border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
.adm-hamburger:hover { border-color: var(--brand-line); box-shadow: 0 6px 18px -12px var(--brand-glow); }
.adm-hamburger-bar { display: block; width: 20px; height: 2px; border-radius: 2px; background: var(--ink); transition: transform 0.28s var(--ease), opacity 0.2s var(--ease), background-color var(--dur) var(--ease), width 0.28s var(--ease); }
.adm-hamburger.is-active { background: var(--dark); border-color: rgba(59, 153, 252, 0.4); }
.adm-hamburger.is-active .adm-hamburger-bar { background: var(--brand); }
.adm-hamburger.is-active .adm-hamburger-bar:nth-child(1) { transform: translateY(7px) rotate(45deg); }
.adm-hamburger.is-active .adm-hamburger-bar:nth-child(2) { opacity: 0; width: 0; }
.adm-hamburger.is-active .adm-hamburger-bar:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }
.adm-drawer { position: absolute; top: 100%; left: 0; right: 0; background: linear-gradient(180deg, var(--dark) 0%, #05070a 100%); border-top: 1px solid rgba(59, 153, 252, 0.18); border-bottom: 1px solid rgba(59, 153, 252, 0.18); box-shadow: 0 30px 60px -25px rgba(0, 0, 0, 0.7); overflow: hidden; max-height: 0; opacity: 0; visibility: hidden; transform: translateY(-10px); transition: max-height 0.42s var(--ease), opacity 0.3s var(--ease), transform 0.35s var(--ease), visibility 0.42s var(--ease); }
.adm-drawer.is-open { max-height: 640px; opacity: 1; visibility: visible; transform: translateY(0); }
.adm-drawer-list { display: flex; flex-direction: column; padding: 12px 20px 22px; }
.adm-drawer-list li + li { border-top: 1px solid rgba(255, 255, 255, 0.06); }
.adm-drawer-list a { display: flex; align-items: center; justify-content: space-between; padding: 14px 6px; font-size: 0.9rem; font-weight: 500; color: #d6dde8; transition: color var(--dur) var(--ease), padding-left var(--dur) var(--ease); }
.adm-drawer-list a::after { content: "→"; font-size: 0.85rem; color: var(--brand); opacity: 0; transform: translateX(-6px); transition: opacity var(--dur) var(--ease), transform var(--dur) var(--ease); }
.adm-drawer-list a:hover,
      .adm-drawer-list a:focus-visible { color: var(--brand); padding-left: 12px; outline: none; }
.adm-drawer-list a:hover::after,
      .adm-drawer-list a:focus-visible::after { opacity: 1; transform: translateX(0); }
.adm-drawer-list a[aria-current="page"] { color: var(--brand); font-weight: 800; }
.adm-drawer-signout { margin-top: 14px; justify-content: center !important; padding: 13px 18px !important; border-radius: var(--r-full); background: rgba(244, 63, 94, 0.12); border: 1px solid rgba(244, 63, 94, 0.4); color: #fda4af !important; font-weight: 800 !important; }
.adm-drawer-signout::after { display: none; }
.adm-drawer-signout:hover { padding-left: 18px !important; color: #ffffff !important; background: rgba(244, 63, 94, 0.28) !important; }
@media (min-width: 1080px) {
.adm-nav { display: flex; }
.adm-hamburger { display: none; }
}
.adm-shell { max-width: 88rem; margin-inline: auto; padding-inline: 16px; }
@media (min-width: 640px) {
.adm-shell { padding-inline: 24px; }
}
@media (min-width: 1024px) {
.adm-shell { padding-inline: 32px; }
}
@media (prefers-reduced-motion: reduce) {
.adm-status-dot span:last-child { animation: none !important; }
}
@media print {
.adm-hamburger, .adm-head-actions, .adm-nav, .adm-footer-links { display: none !important; }
}
@keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }
```

##### Admin footer
```html
<footer class="adm-footer">
 <div class="adm-footer-inner">
  <dl class="adm-footer-meta">
   <div>
    <dt>System Build</dt>
    <dd>VUNVAULT Admin Core v4.2.1</dd>
   </div>
   <div>
    <dt>Encryption Standard</dt>
    <dd>AES-256-GCM</dd>
   </div>
   <div>
    <dt>Node Identifier</dt>
    <dd>node-nbo-01 · NBO-CORE</dd>
   </div>
   <div>
    <dt>Session Reference</dt>
    <dd>ADM-2026-0924-7F3A</dd>
   </div>
  </dl>
  <div class="adm-footer-bottom">
   <span>© 2026 VUNVAULT. All rights reserved. Administrative access is logged and audited.</span>
   <nav class="adm-footer-links" aria-label="Administrative footer">
    <a href="/admin/audit">Audit Logs</a>
    <a href="/admin/profile">Profile Settings</a>
    <a href="/admin/users">Access Control</a>
    <a href="/logout">Sign Out</a>
   </nav>
  </div>
 </div>
</footer>
```
Custom CSS for this markup (reference):
```css
.adm-footer { border-top: 1px solid var(--line-soft); background: linear-gradient(180deg, var(--paper), #f6f7f9); }
.adm-footer-inner { max-width: 88rem; margin-inline: auto; padding: 34px 16px 30px; }
@media (min-width: 640px) {
.adm-footer-inner { padding-inline: 24px; }
}
@media (min-width: 1024px) {
.adm-footer-inner { padding-inline: 32px; }
}
.adm-footer-meta { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; margin: 0; }
@media (max-width: 860px) {
.adm-footer-meta { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 480px) {
.adm-footer-meta { grid-template-columns: 1fr; }
}
.adm-footer-meta dt { font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); }
.adm-footer-meta dd { margin: 6px 0 0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.74rem; font-weight: 700; color: var(--ink-soft); }
.adm-footer-bottom { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; margin-top: 26px; padding-top: 20px; border-top: 1px solid var(--line-soft); font-size: 0.72rem; color: var(--ink-muted); }
.adm-footer-links { display: flex; flex-wrap: wrap; align-items: center; gap: 18px; }
.adm-footer-links a { font-weight: 600; transition: color var(--dur) var(--ease); }
.adm-footer-links a:hover { color: var(--brand-strong); }
@media print {
}
```

**Navigation data (label · route · required permission — an entry is hidden when the user lacks the permission):** `Dashboard Overview` · `/admin` · `dashboard:read`; `Scan Queue` · `/admin/scan-queue` · `scans:read`; `Zero-Day Intel` · `/admin/zero-day` · `intel:read`; `User Management` · `/admin/users` · `users:read`; `Content Moderation` · `/admin/content` · `content:moderate`; `Audit Logs` · `/admin/audit` · `audit:read`; `Profile Settings` · `/admin/profile` · (always); `Sign Out` → calls `useLogout()` (not a link). Drawer labels (verbatim, differ from the desktop labels): `Dashboard Overview`, `Scan Queue & Job Assessment`, `Zero-Day Intel`, `User & Access Management`, `Content Moderation`, `System Audit Logs`, `Profile Settings`, `Sign Out`. Active entry gets `aria-current="page"` (match by pathname prefix; `/admin` matches exactly).

**Header pieces:** the status pill is the `StatusPill` component (Task 8) with its default label `SYS: OPERATIONAL` (styled as `adm-status-pill` in the reference); the user chip as in the reference; `Sign Out` styled with `adm-nav-signout`. The hamburger toggles the drawer (`adm-drawer`), `aria-expanded` kept in sync, Escape closes, route change closes.

**Footer values:** `System Build` ← `process.env.NEXT_PUBLIC_BUILD_LABEL ?? "VUNVAULT Admin Core v4.2.1"`; `Encryption Standard` ← `AES-256-GCM` (constant); `Node Identifier` ← `process.env.NEXT_PUBLIC_NODE_LABEL ?? "node-nbo-01 · NBO-CORE"`; `Session Reference` ← `ADM-<YYYY>-<MMDD>-<first 4 hex chars of the session id, uppercased>` computed from the session login date; footer links `Audit Logs` → `/admin/audit`, `Profile Settings` → `/admin/profile`, `Access Control` → `/admin/users`, `Sign Out` (logout action). Footer copy verbatim: `© 2026 VUNVAULT. All rights reserved. Administrative access is logged and audited.`

**Server guard:** `admin/layout.tsx` calls `await requireSession({ staff: true })` (Task 43). Nothing in this layout may assume a permission; each page also checks its own permission with `<Can>` / `requireSession({ permission })`.

**Main region:** wrap children in `<main className="adm-main">` using the reference stylesheet.

**Tests:** a `compliance_auditor` session sees `Dashboard Overview`, `Scan Queue`, `Audit Logs`, `Profile Settings`, `Sign Out` and NOT `User Management`, `Content Moderation`, or `Zero-Day Intel`; a `super_admin` sees all eight; the chip shows `e.reed@vunvault.com` and `Super Administrator`; the pill has `role="status"`; the footer shows the four meta pairs; Escape closes the drawer.

---

**Data shape (TypeScript):**
```ts
interface AdminNavItem { label: string; drawerLabel: string; href: string; permission?: Permission }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/auth/logout → 204   // TODO(backend-contract) via useLogout()
```

---

**Out of scope:**
- Do not build any admin page body.
- Do not fetch dashboard data.
- Do not implement the SSE audit ticker.

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm --filter web dev` renders the route(s) in this task with no console errors, and `pnpm --filter web test` passes (a smoke test per new component renders it and asserts the key verbatim strings).
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 46 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 47 — Home page A: hero with Live Attack Surface panel and CVE ticker

**Layer:** L6

**Prerequisites:** Task 5, Task 8, Task 44

**Estimated files touched:** 8

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Home page A: hero with Live Attack Surface panel and CVE ticker**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the hero section (headline, CTA, animated Live Attack Surface panel with the network map) and the scrolling CVE ticker as reusable components.

**Deliverables:**
- `apps/web/src/app/(marketing)/_components/home/hero.tsx` — `Hero` (server component; the animated bits are CSS only).
- `apps/web/src/app/(marketing)/_components/home/network-map.tsx` — the hero SVG illustration.
- `apps/web/src/app/(marketing)/_components/cve-ticker.tsx` — `CveTicker` (reused by the Blog page).
- `apps/web/src/app/(marketing)/_styles/hero.css` — feature stylesheet (reference CSS below).
- `apps/web/src/app/(marketing)/_components/home/hero.test.tsx` — tests.
- `apps/web/src/app/(marketing)/_components/home/home-data.ts` — constants for hero metrics and ticker items.

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
- **Feature stylesheet exception:** the reference CSS blocks below come from the prototype. Reproduce them in the task's own `.css` file (listed in Deliverables), replacing every value that has a token with `var(--token)`. A colour with NO token (for example a one-off dark gradient stop) may stay as a literal ONLY inside that `.css` file; never in TSX.
- Prefer the Tailwind classes shown in the reference markup. Where the markup uses a custom class (`vv-*`, `hero-*`, `adm-*` …) implement it from the CSS block that follows it.
- Replace every `<svg data-icon="REPLACE-WITH-LUCIDE"/>` with the closest `lucide-react` icon (keep size classes); replace every `<a href>` to an internal route with `next/link`.
- Convert the markup to TSX: `class` → `className`, `for` → `htmlFor`, self-close void tags. Do NOT copy `href` values such as `*.html`; the routes shown (e.g. `/about`) are final.
- Text content is verbatim. Do not rewrite, shorten or "improve" any string.
- **Illustration exception:** SVG illustrations (hero network map, article thumbnails) are artwork, not UI chrome; their literal fill/stroke colours may be kept exactly as in the reference, inside the named illustration component file only.

---

**Visual specification (embedded copy + layout):**

**Reference markup:**

##### Hero section (`#get-started` anchor follows it)
```html
<section class="relative pt-12 pb-16 md:pt-20 md:pb-24 overflow-hidden">
 <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <div class="text-center max-w-4xl mx-auto space-y-6">
   <span class="hero-eyebrow">Africa-rooted · Worldwide defense</span>
   <h1 class="text-4xl sm:text-6xl md:text-7xl font-extrabold text-neutral-900 tracking-tight leading-[1.1]">We Find The Cracks Before They Do</h1>
   <p class="text-lg sm:text-xl text-neutral-500 font-normal max-w-2xl mx-auto leading-relaxed">Advanced vulnerability management through intelligent automation and proactive defense strategies.</p>
   <div class="flex items-center justify-center pt-4">
    <a href="#get-started" class="btn-get-started">Get Started</a>
   </div>
  </div>
  <div class="mt-14 md:mt-18 max-w-5xl mx-auto">
   <div class="hero-visual">
    <div class="hero-visual-glow" aria-hidden="true"></div>
    <div class="hero-grid" aria-hidden="true"></div>
    <div class="hero-visual-inner">
     <div class="hero-visual-head">
      <div>
       <div class="hero-visual-eyebrow">VUNVAULT</div>
       <h2 class="hero-visual-title">Live Attack Surface</h2>
      </div>
      <div class="glass-pill hero-status">
       <span class="hero-status-dot" aria-hidden="true">
        <span></span>
        <span></span>
       </span>
       <span>SYSTEM STATUS: SECURE</span>
      </div>
     </div>
     <div class="hero-visual-stage">
      <svg aria-label="Live map of protected network nodes" class="hero-network" role="img" viewBox="0 0 900 420" xmlns="http://www.w3.org/2000/svg"> <defs> <linearGradient id="vv-link" x1="0" x2="1" y1="0" y2="0"> <stop offset="0" stop-color="#22d3ee" stop-opacity="0.15"></stop> <stop offset="1" stop-color="#22d3ee" stop-opacity="0.75"></stop> </linearGradient> <radialGradient cx="50%" cy="50%" id="vv-node" r="50%"> <stop offset="0" stop-color="#67e8f9"></stop> <stop offset="1" stop-color="#0891b2"></stop> </radialGradient> </defs> <g class="hero-network-links" fill="none" stroke="url(#vv-link)" stroke-width="1.6"> <path d="M150 90 L330 150"></path> <path d="M330 150 L520 80"></path> <path d="M520 80 L740 140"></path> <path d="M150 90 L300 300"></path> <path d="M330 150 L300 300"></path> <path d="M520 80 L620 320"></path> <path d="M300 300 L620 320"></path> <path d="M740 140 L620 320"></path> <path d="M740 140 L520 80" stroke-dasharray="5 6"></path> <path d="M150 90 L520 80" stroke-dasharray="5 6"></path> </g> <g class="hero-network-nodes"> <g class="hero-node"> <circle cx="150" cy="90" fill="rgba(34,211,238,0.10)" r="26"></circle> <circle cx="150" cy="90" fill="url(#vv-node)" r="11"></circle> <text text-anchor="middle" x="150" y="52">API Gateway</text> </g> <g class="hero-node"> <circle cx="330" cy="150" fill="rgba(34,211,238,0.10)" r="24"></circle> <circle cx="330" cy="150" fill="url(#vv-node)" r="10"></circle> <text text-anchor="middle" x="330" y="118">Core K8s</text> </g> <g class="hero-node"> <circle cx="520" cy="80" fill="rgba(34,211,238,0.10)" r="24"></circle> <circle cx="520" cy="80" fill="url(#vv-node)" r="10"></circle> <text text-anchor="middle" x="520" y="46">Identity</text> </g> <g class="hero-node"> <circle cx="740" cy="140" fill="rgba(34,211,238,0.10)" r="22"></circle> <circle cx="740" cy="140" fill="url(#vv-node)" r="9"></circle> <text text-anchor="middle" x="740" y="108">Edge CDN</text> </g> <g class="hero-node"> <circle cx="300" cy="300" fill="rgba(52,211,153,0.10)" r="22"></circle> <circle cx="300" cy="300" fill="#34d399" r="9"></circle> <text text-anchor="middle" x="300" y="336">DB Replica</text> </g> <g class="hero-node"> <circle cx="620" cy="320" fill="rgba(52,211,153,0.10)" r="22"></circle> <circle cx="620" cy="320" fill="#34d399" r="9"></circle> <text text-anchor="middle" x="620" y="356">Backup Vault</text> </g> </g> </svg>
      <span class="hero-scanline" aria-hidden="true"></span>
     </div>
     <div class="hero-visual-foot">
      <div class="hero-metric">
       <span class="hero-metric-label">Nodes Monitored</span>
       <span class="hero-metric-value">1,284</span>
      </div>
      [+2 more sibling <div> elements with the SAME structure as the one above; their text content in order: Threats Blocked ¦ 12,904 || Mean Patch Time ¦ 1.2s]
     </div>
    </div>
   </div>
  </div>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
.glass-pill { background: rgba(255, 255, 255, 0.62); backdrop-filter: blur(10px) saturate(1.4); -webkit-backdrop-filter: blur(10px) saturate(1.4); border: 1px solid rgba(59, 153, 252, 0.2); box-shadow: 0 4px 16px rgba(10, 13, 18, 0.06); border-radius: var(--r-full); }
.hero-eyebrow { display: inline-block; padding: 7px 16px; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); border-radius: var(--r-full); }
.btn-get-started { display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 16px 42px; font-size: 0.95rem; font-weight: 700; letter-spacing: 0.02em; color: #ffffff; background: linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%); border-radius: var(--r-full); border: 1px solid rgba(59, 153, 252, 0.5); box-shadow: 0 14px 34px -14px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.25); transition: transform 0.25s var(--ease), box-shadow 0.25s var(--ease), filter 0.25s var(--ease); }
.btn-get-started::after { content: "→"; font-size: 1rem; transition: transform 0.25s var(--ease); }
.btn-get-started:hover { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 20px 44px -16px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.3); }
.btn-get-started:hover::after { transform: translateX(4px); }
.btn-get-started:active { transform: translateY(0) scale(0.98); }
.hero-visual { position: relative; overflow: hidden; border-radius: var(--r-2xl); background: radial-gradient(120% 90% at 12% 0%, rgba(59, 153, 252, 0.16), transparent 55%), linear-gradient(160deg, var(--dark) 0%, #0c1119 52%, #05070a 100%); border: 1px solid rgba(59, 153, 252, 0.24); box-shadow: 0 40px 90px -40px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.03) inset; transform-style: preserve-3d; transition: transform 0.45s var(--ease), box-shadow 0.45s var(--ease); will-change: transform; }
.hero-visual:hover { box-shadow: 0 50px 110px -44px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(59, 153, 252, 0.12) inset; }
.hero-visual-glow { position: absolute; top: -22%; left: 50%; width: 78%; height: 62%; transform: translateX(-50%); background: radial-gradient(closest-side, var(--brand-glow), transparent 72%); filter: blur(70px); opacity: 0.7; pointer-events: none; }
.hero-grid { position: absolute; inset: 0; background-image: linear-gradient(to right, rgba(59, 153, 252, 0.13) 1px, transparent 1px), linear-gradient(to bottom, rgba(59, 153, 252, 0.13) 1px, transparent 1px); background-size: 46px 46px; -webkit-mask-image: radial-gradient(100% 80% at 50% 30%, #000 25%, transparent 78%); mask-image: radial-gradient(100% 80% at 50% 30%, #000 25%, transparent 78%); pointer-events: none; }
.hero-visual-inner { position: relative; z-index: 2; padding: 30px; }
.hero-visual-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; flex-wrap: wrap; margin-bottom: 26px; }
.hero-visual-eyebrow { font-size: 10px; font-weight: 800; letter-spacing: 0.28em; text-transform: uppercase; color: var(--brand); }
.hero-visual-title { margin-top: 6px; font-size: 1.4rem; font-weight: 800; letter-spacing: -0.01em; color: #ffffff; }
.hero-status { display: inline-flex; align-items: center; gap: 9px; padding: 8px 16px; font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #8ef0c1; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: var(--r-full); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); white-space: nowrap; }
.hero-status-dot { position: relative; display: inline-flex; width: 8px; height: 8px; }
.hero-status-dot span { position: absolute; inset: 0; border-radius: var(--r-full); background: var(--ok); }
.hero-status-dot span:last-child { animation: ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite; opacity: 0.6; }
.hero-visual-stage { position: relative; border-radius: var(--r-lg); background: rgba(0, 0, 0, 0.28); border: 1px solid rgba(59, 153, 252, 0.14); overflow: hidden; }
.hero-network { width: 100%; height: auto; display: block; }
.hero-network text { fill: #93a2b5; font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; letter-spacing: 0.04em; }
.hero-network-links path { stroke-dasharray: 0; }
.hero-network-links path[stroke-dasharray] { animation: vv-dash 3s linear infinite; }
.hero-node circle:first-child { animation: vv-pulse-node 3.2s ease-in-out infinite; transform-origin: center; }
.hero-node:nth-child(2) circle:first-child { animation-delay: 0.4s; }
.hero-node:nth-child(3) circle:first-child { animation-delay: 0.8s; }
.hero-node:nth-child(4) circle:first-child { animation-delay: 1.2s; }
.hero-node:nth-child(5) circle:first-child { animation-delay: 1.6s; }
.hero-node:nth-child(6) circle:first-child { animation-delay: 2s; }
.hero-scanline { position: absolute; left: 0; right: 0; height: 90px; background: linear-gradient( to bottom, transparent, rgba(59, 153, 252, 0.14), transparent ); pointer-events: none; animation: vv-scan 5.5s var(--ease) infinite; }
.hero-visual-foot { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-top: 24px; padding-top: 22px; border-top: 1px solid rgba(255, 255, 255, 0.08); }
.hero-metric { display: flex; flex-direction: column; gap: 6px; }
.hero-metric-label { font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #7d8b9e; }
.hero-metric-value { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em; color: var(--brand); text-shadow: 0 0 22px var(--brand-glow); }
.hero-network { width: 100%; height: auto; max-height: clamp(280px, 42vw, 460px); }
.hero-visual { max-width: 960px; margin-inline: auto; }
@media (max-width: 1024px) {
.hero-visual-inner { padding: 24px; }
}
@media (max-width: 768px) {
.hero-visual-inner { padding: 18px; }
.hero-visual-head { gap: 12px; margin-bottom: 18px; }
.hero-visual-title { font-size: 1.15rem; }
.hero-visual-foot { grid-template-columns: 1fr 1fr; gap: 12px; }
.hero-metric-value { font-size: 1.25rem; }
.hero-metric:last-child { grid-column: span 2; }
.btn-get-started { padding: 15px 34px; font-size: 0.9rem; }
}
@media (max-width: 420px) {
.hero-visual-foot { grid-template-columns: 1fr; }
.hero-metric:last-child { grid-column: auto; }
}
@media (min-width: 1024px) {
}
@keyframes vv-dash { to { stroke-dashoffset: -22; } }
@keyframes vv-pulse-node { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
@keyframes vv-scan { 0% { transform: translateY(-100px); opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { transform: translateY(520px); opacity: 0; } }
@keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }
```

##### CVE ticker (marquee strip below the hero)
```html
<div class="w-full bg-[var(--ticker-bg)] text-white overflow-hidden py-3 border-y border-neutral-800 shadow-md">
 <div class="animate-marquee flex items-center gap-12 text-xs font-mono select-none">
  <div class="flex items-center gap-3 shrink-0 cursor-pointer hover:text-cyan-300 transition-colors group">
   <span class="text-neutral-400 font-bold group-hover:text-white transition-colors">CVE-2025-18820</span>
   <span class="text-neutral-300">– SQL injection in unsanitized search parameter</span>
   <span class="text-[10px] font-bold px-2 py-0.5 rounded tracking-wider bg-blue-600 text-white">MEDIUM</span>
   <span class="text-neutral-600 font-sans mx-2">|</span>
  </div>
  [+7 more sibling <div> elements with the SAME structure as the one above; their text content in order: CVE-2026-9122 ¦ – Critical Remote Code Execution in API Ingress ¦ CRITICAL ¦ | || CVE-2026-4401 ¦ – Directory Traversal in Unauthenticated RMM Agent ¦ HIGH ¦ | || CVE-2026-1104 ¦ – Zero-Day Memory Exfiltration Attempt Intercepted ¦ HIGH ¦ | || CVE-2025-18820 ¦ – SQL injection in unsanitized search parameter ¦ MEDIUM ¦ | || CVE-2026-9122 ¦ – Critical Remote Code Execution in API Ingress ¦ CRITICAL ¦ | || CVE-2026-4401 ¦ – Directory Traversal in Unauthenticated RMM Agent ¦ HIGH ¦ | || CVE-2026-1104 ¦ – Zero-Day Memory Exfiltration Attempt Intercepted ¦ HIGH ¦ |]
 </div>
</div>
```
Custom CSS for this markup (reference):
```css
.animate-marquee { animation: marquee 30s linear infinite; }
@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
```

**Data (constants in `home-data.ts` — the public site has no stats endpoint yet; leave `// TODO(backend-contract): public stats endpoint` above them):** hero metrics `Nodes Monitored 1,284`, `Threats Blocked 12,904`, `Mean Patch Time 1.2s`. Ticker items (rendered twice back-to-back for a seamless loop; the second copy is `aria-hidden`): `CVE-2025-18820` / `– SQL injection in unsanitized search parameter` / `MEDIUM`; `CVE-2026-9122` / `– Critical Remote Code Execution in API Ingress` / `CRITICAL`; `CVE-2026-4401` / `– Directory Traversal in Unauthenticated RMM Agent` / `HIGH`; `CVE-2026-1104` / `– Zero-Day Memory Exfiltration Attempt Intercepted` / `HIGH`. Severity badge colours as in the markup (`MEDIUM` = blue, `CRITICAL` = rose, `HIGH` = amber; keep the Tailwind classes shown).

**Ticker background:** the strip uses `bg-[var(--ticker-bg)]`; define `--ticker-bg: #0a1931;` once at the top of `hero.css` (the prototype's own navy, intentionally not a design token — this is the only hex literal this task may add).

**Behaviour:** the hero CTA `Get Started` scrolls to the `#get-started` anchor (add `scroll-mt-24`). The marquee uses the `animate-marquee` utility — define the keyframe `vv-marquee` already exists in Task 5; map `animate-marquee` to `--animate-vv-marquee` via a `@utility animate-marquee` in `hero.css`; pause on hover (`hover:[animation-play-state:paused]`). `prefers-reduced-motion`: the marquee does not animate and the strip becomes horizontally scrollable (`overflow-x-auto`).

**Tests:** hero renders the verbatim `h1` `We Find The Cracks Before They Do`, the eyebrow, the CTA, the three metrics and the status text `SYSTEM STATUS: SECURE`; the SVG has `role="img"` and its `aria-label`; ticker shows 4 unique CVEs and exposes only one copy to assistive tech.

---

**Data shape (TypeScript):**
```ts
interface TickerItem { cve: string; text: string; severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" }
```

**API contract (as comments only — do NOT implement the backend):**
N/A — static content in this task.

---

**Out of scope:**
- Do not build other home sections (Tasks 48–52).
- Do not assemble the home route (Task 52).
- Do not fetch data.

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm --filter web dev` renders the route(s) in this task with no console errors, and `pnpm --filter web test` passes (a smoke test per new component renders it and asserts the key verbatim strings).
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 47 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 48 — Free Scanner: CTA banner, terminal dialog and simulated scan engine

**Layer:** L6

**Prerequisites:** Task 8, Task 11, Task 44

**Estimated files touched:** 9

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Free Scanner: CTA banner, terminal dialog and simulated scan engine**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the Free Vulnerability Scanner call-to-action and the OS-style terminal dialog that plays a simulated reconnaissance run, shared by the Home, Blog and footer entry points.

**Deliverables:**
- `apps/web/src/app/(marketing)/_components/scanner/scanner-cta.tsx` — `ScannerCta` section.
- `apps/web/src/app/(marketing)/_components/scanner/scanner-dialog.tsx` — `ScannerDialog` (client).
- `apps/web/src/app/(marketing)/_components/scanner/use-scan-simulation.ts` — pure hook/engine (also reused by Services, Task 54).
- `apps/web/src/app/(marketing)/_components/scanner/scanner-store.ts` — Zustand store `{ open, openDialog, closeDialog }` + a `window` listener for the `vunvault:open-scanner` event.
- `apps/web/src/app/(marketing)/_styles/scanner.css` — feature stylesheet.
- `apps/web/src/app/(marketing)/_components/scanner/scanner.test.tsx` — tests.
- MODIFY `apps/web/src/app/(marketing)/layout.tsx` — mount `<ScannerDialog />` once.

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
- **Feature stylesheet exception:** the reference CSS blocks below come from the prototype. Reproduce them in the task's own `.css` file (listed in Deliverables), replacing every value that has a token with `var(--token)`. A colour with NO token (for example a one-off dark gradient stop) may stay as a literal ONLY inside that `.css` file; never in TSX.
- Prefer the Tailwind classes shown in the reference markup. Where the markup uses a custom class (`vv-*`, `hero-*`, `adm-*` …) implement it from the CSS block that follows it.
- Replace every `<svg data-icon="REPLACE-WITH-LUCIDE"/>` with the closest `lucide-react` icon (keep size classes); replace every `<a href>` to an internal route with `next/link`.
- Convert the markup to TSX: `class` → `className`, `for` → `htmlFor`, self-close void tags. Do NOT copy `href` values such as `*.html`; the routes shown (e.g. `/about`) are final.
- Text content is verbatim. Do not rewrite, shorten or "improve" any string.

---

**Visual specification (embedded copy + layout):**

**Reference markup:**

##### Free-scanner CTA section
```html
<section id="free-scanner" class="vv-scan-cta-section">
 <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <div class="vv-scan-cta">
   <div class="vv-scan-cta-glow" aria-hidden="true"></div>
   <div class="vv-scan-cta-body">
    <span class="vv-scan-cta-eyebrow">No cost · No commitment</span>
    <h2 class="vv-scan-cta-title">
     We Offer a Free Vulnerability Scan —
     <span>Scan Now</span>
    </h2>
    <p class="vv-scan-cta-text">Point us at a web application, API gateway or public IP range and watch our reconnaissance engine enumerate live exposure in real time. Evaluate your perimeter before an attacker does.</p>
    <div class="vv-scan-cta-actions">
     <button type="button" class="vv-scan-cta-btn">
      <span>Request Free Scan</span>
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
     </button>
     <span class="vv-scan-cta-note">Runs in your browser · Nothing is stored</span>
    </div>
   </div>
  </div>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
.vv-scan-cta-section { padding: 3.5rem 0; background: var(--paper); }
.vv-scan-cta { position: relative; overflow: hidden; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 26px; padding: 40px 44px; border-radius: var(--r-2xl); color: #ffffff; background: radial-gradient(90% 130% at 100% 0%, rgba(59, 153, 252, 0.30), transparent 60%), linear-gradient(135deg, var(--dark) 0%, #060a10 100%); border: 1px solid rgba(59, 153, 252, 0.32); box-shadow: 0 30px 60px -34px rgba(0, 0, 0, 0.6); }
.vv-scan-cta-glow { position: absolute; top: -40%; right: -10%; width: 46%; height: 180%; background: radial-gradient(closest-side, var(--brand-glow), transparent 72%); filter: blur(70px); opacity: 0.55; pointer-events: none; }
.vv-scan-cta-body { position: relative; z-index: 1; flex: 1 1 420px; min-width: 0; }
.vv-scan-cta-eyebrow { display: inline-block; font-size: 10px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase; color: var(--brand); }
.vv-scan-cta-title { margin-top: 10px; font-size: clamp(1.4rem, 3vw, 2.05rem); font-weight: 800; letter-spacing: -0.02em; line-height: 1.2; color: #ffffff; }
.vv-scan-cta-title span { color: var(--brand-soft); }
.vv-scan-cta-text { margin-top: 12px; max-width: 62ch; font-size: 0.84rem; line-height: 1.75; color: #9aa8ba; }
.vv-scan-cta-actions { position: relative; z-index: 1; display: flex; flex-wrap: wrap; align-items: center; gap: 16px; }
.vv-scan-cta-btn { display: inline-flex; align-items: center; gap: 10px; padding: 16px 30px; font-size: 0.84rem; font-weight: 800; letter-spacing: 0.01em; color: #04121f; background: linear-gradient(135deg, var(--brand-soft), var(--brand)); border-radius: var(--r-full); border: 1px solid rgba(255, 255, 255, 0.18); box-shadow: 0 16px 34px -16px var(--brand-glow); transition: transform 0.25s var(--ease), filter 0.25s var(--ease), box-shadow 0.25s var(--ease); }
.vv-scan-cta-btn:hover { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 22px 46px -18px var(--brand-glow); }
.vv-scan-cta-btn:active { transform: translateY(0) scale(0.98); }
.vv-scan-cta-btn svg { transition: transform 0.25s var(--ease); }
.vv-scan-cta-btn:hover svg { transform: translateX(4px); }
.vv-scan-cta-note { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.04em; color: #6b7a8d; }
@media (max-width: 768px) {
.vv-scan-cta { padding: 28px 22px; }
.vv-scan-cta-btn { width: 100%; justify-content: center; }
}
```

##### Free-scanner modal (terminal window)
```html
<div id="free-scanner-modal" class="vv-scan-modal" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="vv-scan-dialog-title">
 <div class="vv-scan-modal-backdrop"></div>
 <div class="vv-scan-window" role="document">
  <div class="vv-scan-titlebar">
   <div class="vv-scan-controls">
    <button type="button" class="vv-dot vv-dot-close" aria-label="Close scanner"></button>
    <button type="button" class="vv-dot vv-dot-min" aria-label="Minimize scanner"></button>
    <button type="button" class="vv-dot vv-dot-max" aria-label="Maximize scanner"></button>
   </div>
   <div class="vv-scan-title" id="vv-scan-dialog-title">vunvault-scanner-cli v2.4.0 — vvscan --interactive</div>
   <div class="vv-scan-status">
    <span class="vv-scan-status-dot" aria-hidden="true"></span>
    <span>IDLE</span>
   </div>
  </div>
  <div class="vv-scan-body">
   <form class="vv-scan-form">
    <label class="sr-only" for="vv-scan-target">Target IP address or domain name</label>
    <div class="vv-scan-input-wrap">
     <span class="vv-scan-prompt" aria-hidden="true">$</span>
     <input id="vv-scan-target" class="vv-scan-input" type="text" name="target" placeholder="example.com   or   192.168.1.1" autocomplete="off"/>
    </div>
    <button type="submit" class="vv-scan-execute">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     <span>Execute Scan</span>
    </button>
    <button type="button" class="vv-scan-reset">Clear</button>
   </form>
   <div class="vv-scan-chips">
    <span class="vv-scan-chips-label">Try:</span>
    <button type="button" class="vv-chip">example.com</button>
    <button type="button" class="vv-chip">192.168.1.1</button>
    <button type="button" class="vv-chip">api.vunvault.com</button>
   </div>
   <div class="vv-scan-screen" role="log" aria-live="polite" aria-label="Scan output"></div>
   <div class="vv-scan-progress" role="progressbar" aria-label="Scan progress">
    <span></span>
   </div>
   <p class="vv-scan-disclaimer">Simulated reconnaissance for demonstration purposes. Only scan systems you own or have written authorisation to test.</p>
  </div>
 </div>
</div>
```
Custom CSS for this markup (reference):
```css
.vv-scan-modal { position: fixed; inset: 0; z-index: 200; display: flex; align-items: center; justify-content: center; padding: 24px; opacity: 0; transition: opacity 0.22s var(--ease); }
.vv-scan-modal[hidden] { display: none; }
.vv-scan-modal.is-open { opacity: 1; }
.vv-scan-modal-backdrop { position: absolute; inset: 0; background: rgba(5, 7, 10, 0.74); backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px); }
.vv-scan-window { position: relative; z-index: 1; display: flex; flex-direction: column; width: min(920px, 100%); max-height: 90vh; border-radius: 16px; overflow: hidden; background: #0b0f16; border: 1px solid rgba(59, 153, 252, 0.28); box-shadow: 0 40px 90px -40px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.03) inset; transform: translateY(18px) scale(0.985); transition: transform 0.28s var(--ease), width 0.28s var(--ease), max-height 0.28s var(--ease); }
.vv-scan-modal.is-open .vv-scan-window { transform: translateY(0) scale(1); }
.vv-scan-window.is-max { width: 100%; max-height: 94vh; }
.vv-scan-titlebar { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 14px; padding: 11px 14px; background: linear-gradient(180deg, #151b25, #10151d); border-bottom: 1px solid rgba(59, 153, 252, 0.18); }
.vv-scan-controls { display: flex; align-items: center; gap: 8px; }
.vv-dot { width: 12px; height: 12px; padding: 0; border-radius: 50%; border: 1px solid rgba(0, 0, 0, 0.25); cursor: pointer; transition: filter 0.2s var(--ease), transform 0.2s var(--ease); }
.vv-dot:hover { filter: brightness(1.3); transform: scale(1.12); }
.vv-dot-close { background: #ff5f57; }
.vv-dot-min { background: #febc2e; }
.vv-dot-max { background: #28c840; }
.vv-scan-title { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; letter-spacing: 0.02em; color: #8d9aab; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vv-scan-status { display: inline-flex; align-items: center; gap: 7px; padding: 5px 12px; border-radius: var(--r-full); font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10px; font-weight: 800; letter-spacing: 0.14em; border: 1px solid transparent; white-space: nowrap; }
.vv-scan-status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.vv-scan-status[data-state="idle"] { color: #94a3b8; background: rgba(148, 163, 184, 0.1); border-color: rgba(148, 163, 184, 0.3); }
.vv-scan-status[data-state="scanning"] { color: #7dd3fc; background: rgba(59, 153, 252, 0.12); border-color: rgba(59, 153, 252, 0.42); }
.vv-scan-status[data-state="scanning"] .vv-scan-status-dot { animation: pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
.vv-scan-status[data-state="done"] { color: #34d399; background: rgba(16, 185, 129, 0.12); border-color: rgba(16, 185, 129, 0.42); }
.vv-scan-body { display: flex; flex-direction: column; gap: 14px; padding: 18px; overflow-y: auto; }
.vv-scan-form { display: flex; flex-wrap: wrap; gap: 10px; }
.vv-scan-input-wrap { position: relative; display: flex; align-items: center; flex: 1 1 260px; min-width: 0; }
.vv-scan-prompt { position: absolute; left: 14px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; font-weight: 700; color: var(--brand); pointer-events: none; }
.vv-scan-input { width: 100%; padding: 13px 14px 13px 34px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; color: #e2e8f0; background: #070b11; border: 1px solid rgba(59, 153, 252, 0.24); border-radius: 10px; outline: none; transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease); }
.vv-scan-input::placeholder { color: #55637a; }
.vv-scan-input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(59, 153, 252, 0.16); }
.vv-scan-input.is-invalid { border-color: var(--critical); box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.16); }
.vv-scan-execute { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 9px; padding: 13px 22px; font-size: 12.5px; font-weight: 800; color: #04121f; background: linear-gradient(135deg, var(--brand-soft), var(--brand)); border-radius: 10px; transition: transform 0.2s var(--ease), filter 0.2s var(--ease), opacity 0.2s var(--ease); }
.vv-scan-execute:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.06); }
.vv-scan-execute:disabled { opacity: 0.55; cursor: not-allowed; }
.vv-scan-reset { flex: 0 0 auto; padding: 13px 18px; font-size: 12.5px; font-weight: 700; color: #93a2b5; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; transition: color 0.2s var(--ease), border-color 0.2s var(--ease), background-color 0.2s var(--ease); }
.vv-scan-reset:hover { color: #e2e8f0; border-color: rgba(59, 153, 252, 0.4); background: rgba(59, 153, 252, 0.1); }
.vv-scan-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.vv-scan-chips-label { font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #55637a; }
.vv-chip { padding: 6px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; color: #8d9aab; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.09); border-radius: var(--r-full); transition: color 0.2s var(--ease), border-color 0.2s var(--ease), background-color 0.2s var(--ease); }
.vv-chip:hover { color: var(--brand-soft); border-color: rgba(59, 153, 252, 0.45); background: rgba(59, 153, 252, 0.1); }
.vv-scan-screen { height: 340px; overflow-y: auto; padding: 16px 18px; border-radius: 12px; background: radial-gradient(120% 100% at 0% 0%, rgba(59, 153, 252, 0.07), transparent 60%), #05080d; border: 1px solid rgba(59, 153, 252, 0.16); font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; line-height: 1.85; scroll-behavior: smooth; }
.vv-scan-progress { height: 3px; width: 100%; border-radius: var(--r-full); background: rgba(255, 255, 255, 0.07); overflow: hidden; }
.vv-scan-progress > span { display: block; height: 100%; width: 0; border-radius: var(--r-full); background: linear-gradient(90deg, var(--brand-strong), var(--brand-soft)); transition: width 0.3s var(--ease); }
.vv-scan-disclaimer { font-size: 10.5px; line-height: 1.65; color: #55637a; }
@media (max-width: 768px) {
.vv-scan-modal { padding: 12px; }
.vv-scan-screen { height: 260px; font-size: 11px; }
.vv-scan-title { display: none; }
.vv-scan-titlebar { grid-template-columns: auto 1fr; }
.vv-scan-status { justify-self: end; }
.vv-scan-execute,
  .vv-scan-reset { flex: 1 1 auto; justify-content: center; }
}
</style>

.vv-scan-modal-backdrop { background: rgba(5, 7, 10, 0.74); }
.vv-scan-modal[hidden] { display: none !important; }
.vv-scan-modal { pointer-events: auto; }
.vv-scan-screen::-webkit-scrollbar,
.vv-scan-body::-webkit-scrollbar { width: 8px; height: 8px; }
.vv-scan-screen::-webkit-scrollbar-track,
.vv-scan-body::-webkit-scrollbar-track { background: transparent; }
.vv-scan-screen::-webkit-scrollbar-thumb,
.vv-scan-body::-webkit-scrollbar-thumb { background: rgba(59, 153, 252, 0.28); border-radius: 9999px; border: 2px solid transparent; background-clip: padding-box; }
.vv-scan-screen::-webkit-scrollbar-thumb:hover,
.vv-scan-body::-webkit-scrollbar-thumb:hover { background: rgba(59, 153, 252, 0.6); background-clip: padding-box; }
.vv-scan-screen,
.vv-scan-body { scrollbar-width: thin; scrollbar-color: rgba(59, 153, 252, 0.35) transparent; }
.vv-scan-input:focus-visible { outline: none; border-color: var(--brand); box-shadow: 0 0 0 3px rgba(59, 153, 252, 0.22); }
.vv-scan-input.is-invalid { border-color: var(--critical); box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.18); animation: vvShake 0.32s var(--ease); }
.vv-dot:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(59, 153, 252, 0.45); }
@media (max-width: 480px) {
.vv-scan-window { width: 100%; max-height: 94vh; }
.vv-scan-titlebar { padding: 10px 12px; gap: 10px; }
.vv-scan-body { padding: 14px; gap: 10px; }
.vv-scan-screen { height: 220px; }
}
@media (prefers-reduced-motion: reduce) {
.vv-scan-modal,
  .vv-scan-window,
  .vv-line,
  .vv-scan-input.is-invalid { transition-duration: 0.001ms !important; animation-duration: 0.001ms !important; transform: none !important; }
}
@keyframes pulse { 50% { opacity: 0.5; } }
@keyframes vvShake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
```

**Dialog semantics (replace the prototype's hand-rolled modal):** use the `Dialog` primitive (Task 11): `role="dialog"`, `aria-modal="true"`, `aria-labelledby="vv-scan-dialog-title"`, focus trap, Escape closes, focus returns to the opener, `body` gets `nav-open`. The three window-chrome buttons keep their roles: close and minimise both close the dialog; maximise toggles the `is-max` class on `.vv-scan-window`. Openers: any element with `data-vv-open-scanner`, the CTA button `Request Free Scan`, and the window event `vunvault:open-scanner` (footer link `Free Security Scan`).

**Simulation engine — port this reference JS to a typed hook (no DOM access; React state drives the log; do not use `innerHTML`):**
```js
function setStatus(state, text) {
 if (status) status.setAttribute("data-state", state);
 if (statusText) statusText.textContent = text;
 }
 function setProgress(pct) {
 if (bar) bar.style.width = pct + "%";
 if (progress) progress.setAttribute("aria-valuenow", String(pct));
 }
 function logLine(kind, msg) {
 if (!screen) return;
 var ts = new Date().toISOString().substr(11, 8);
 var line = document.createElement("div");
 line.className = "vv-line vv-line--" + kind;
 var tsEl = document.createElement("span");
 tsEl.className = "vv-line-ts";
 tsEl.textContent = "[" + ts + "]";
 var msgEl = document.createElement("span");
 msgEl.className = "vv-line-msg";
 msgEl.textContent = msg;
 line.appendChild(tsEl);
 line.appendChild(msgEl);
 screen.appendChild(line);
 screen.scrollTop = screen.scrollHeight;
 }
 function openModal() {
 lastFocused = document.activeElement;
 modal.hidden = false;
 modal.setAttribute("aria-hidden", "false");
 void modal.offsetWidth; // force reflow so transition fires
 modal.classList.add("is-open");
 document.body.classList.add("nav-open");
 window.setTimeout(function () { if (input) input.focus(); }, 120);
 }
 function closeModal() {
 if (scanTimer) { window.clearInterval(scanTimer); scanTimer = null; }
 modal.classList.remove("is-open");
 modal.setAttribute("aria-hidden", "true");
 document.body.classList.remove("nav-open");
 window.setTimeout(function () {
 modal.hidden = true;
 if (executeBtn) executeBtn.disabled = false;
 if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
 }, 240);
 }
 openers.forEach(function (btn) { btn.addEventListener("click", openModal); });
 closers.forEach(function (btn) { btn.addEventListener("click", closeModal); });
 document.addEventListener("keydown", function (e) {
 if (e.key === "Escape" && modal.classList.contains("is-open")) closeModal();
 });
 suggestions.forEach(function (chip) {
 chip.addEventListener("click", function () {
 if (!input) return;
 input.value = chip.getAttribute("data-vv-scan-suggest") || "";
 input.classList.remove("is-invalid");
 input.focus();
 });
 });
 if (resetBtn) {
 resetBtn.addEventListener("click", function () {
 if (scanTimer) { window.clearInterval(scanTimer); scanTimer = null; }
 if (screen) screen.innerHTML = "";
 setProgress(0);
 if (input) { input.value = ""; input.classList.remove("is-invalid"); }
 if (executeBtn) executeBtn.disabled = false;
 setStatus("idle", "IDLE");
 });
 }
 if (maxBtn) {
 maxBtn.addEventListener("click", function () {
 var win = modal.querySelector(".vv-scan-window");
 if (win) win.classList.toggle("is-max");
 });
 }
 if (minBtn) minBtn.addEventListener("click", closeModal);
 var VALID = /^(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$|^(?:\d{1,3}\.){3}\d{1,3}$/;
 function runScan(target) {
 if (scanTimer) { window.clearInterval(scanTimer); scanTimer = null; }
 if (screen) screen.innerHTML = "";
 setProgress(0);
 setStatus("scanning", "SCANNING");
 if (executeBtn) executeBtn.disabled = true;
 var steps = [
 { kind: "sys", msg: "vunvault-scanner-cli v2.4.0 — initialising reconnaissance engine" },
 { kind: "muted", msg: "> target: " + target },
 { kind: "info", msg: "[*] Resolving DNS records ..." },
 { kind: "ok", msg: "[+] A record resolved → 203.0.113.42" },
 { kind: "info", msg: "[*] Enumerating subdomains (CT logs + DNS brute) ..." },
 { kind: "ok", msg: "[+] 14 subdomains discovered" },
 { kind: "info", msg: "[*] Probing TCP ports 1-1024 ..." },
 { kind: "warn", msg: "[!] Port 22/tcp open — SSH (OpenSSH 8.2p1)" },
 { kind: "warn", msg: "[!] Port 8080/tcp open — HTTP proxy" },
 { kind: "ok", msg: "[+] Port 443/tcp open — TLS 1.3, HSTS enabled" },
 { kind: "info", msg: "[*] Fingerprinting web stack ..." },
 { kind: "ok", msg: "[+] nginx/1.24.0, PHP/8.2, WordPress/6.5.2" },
 { kind: "info", msg: "[*] Cross-referencing CVEs ..." },
 { kind: "crit", msg: "[CRITICAL] CVE-2026-9122 — RCE in API ingress (CVSS 9.8)" },
 { kind: "warn", msg: "[HIGH] CVE-2026-4401 — Directory traversal (CVSS 7.5)" },
 { kind: "warn", msg: "[MEDIUM] CVE-2025-18820 — SQLi in search parameter (CVSS 5.3)" },
 { kind: "info", msg: "[*] Generating prioritised remediation map ..." },
 { kind: "ok", msg: "[+] Report ready. 3 findings — 1 critical, 1 high, 1 medium." },
 { kind: "sys", msg: "scan complete in 4.28s" }
 ];
 var i = 0, total = steps.length;
 scanTimer = window.setInterval(function () {
 if (i >= total) {
 window.clearInterval(scanTimer);
 scanTimer = null;
 setProgress(100);
 setStatus("done", "COMPLETE");
 if (executeBtn) executeBtn.disabled = false;
 return;
 }
 logLine(steps[i].kind, steps[i].msg);
 i++;
 setProgress(Math.round((i / total) * 100));
 }, 260);
 }
 if (form) {
 form.addEventListener("submit", function (e) {
 e.preventDefault();
 var value = (input && input.value || "").trim();
 if (!value || !VALID.test(value)) {
 if (input) input.classList.add("is-invalid");
 logLine("crit", "[!] Invalid target. Enter a domain (example.com) or IPv4 address.");
 return;
 }
 if (input) input.classList.remove("is-invalid");
 runScan(value);
 });
 }
 })();
```
Hook API: `useScanSimulation(): { lines: { id: number; ts: string; kind: "sys"|"muted"|"info"|"ok"|"warn"|"crit"; msg: string }[]; progress: number; status: "idle"|"scanning"|"done"; run(target: string): void; reset(): void; error: string | null }`. Timestamp format `[HH:MM:SS]` (UTC). Validation regex (exact): `^(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$|^(?:\d{1,3}\.){3}\d{1,3}$`; invalid target → append a `crit` line `[!] Invalid target. Enter a domain (example.com) or IPv4 address.` and mark the input invalid (`aria-invalid`, class `is-invalid`). Status labels shown in the title bar: `IDLE`, `SCANNING`, `COMPLETE`. Step cadence 260 ms (when `prefers-reduced-motion` is set, append all lines instantly). Auto-scroll the log to the bottom after each line. Clear/Reset restores the idle state and clears the input. **No network request is ever made; nothing is stored** (the CTA copy says so). Add a visible-only comment `// SIMULATION — no scan is performed` at the top of the engine.

**Tests:** opening via the CTA shows the dialog with the title text from the markup; Escape closes it; an invalid target shows the exact error line; a valid target walks the 19 steps (fake timers) and ends at `COMPLETE` with progress 100; reset returns to `IDLE`; the `vunvault:open-scanner` event opens the dialog.

---

**Data shape (TypeScript):**
```ts
type ScanLineKind = "sys" | "muted" | "info" | "ok" | "warn" | "crit";
interface ScanLine { id: number; ts: string; kind: ScanLineKind; msg: string }
```

**API contract (as comments only — do NOT implement the backend):**
N/A — client-side simulation only.

---

**Out of scope:**
- Do not call any backend or perform a real scan (real scans are authenticated, authorised and queued — Task 35 and Layer L10).
- Do not use `innerHTML`.
- Do not build the Home page assembly.

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm --filter web dev` renders the route(s) in this task with no console errors, and `pnpm --filter web test` passes (a smoke test per new component renders it and asserts the key verbatim strings).
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 48 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 49 — Home page B: attack-surface mapping, rotating Insights grid, organisation segments

**Layer:** L6

**Prerequisites:** Task 40c, Task 42, Task 44, Task 47

**Estimated files touched:** 10

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Home page B: attack-surface mapping, rotating Insights grid, organisation segments**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the three mid-page home sections: Attack Surface Mapping, the Latest Insights grid fed by the public content API with 3-up rotation, and the organisation-segment cards.

**Deliverables:**
- `apps/web/src/app/(marketing)/_components/home/attack-surface.tsx`
- `apps/web/src/app/(marketing)/_components/home/insights-grid.tsx` — client; TanStack Query + rotation.
- `apps/web/src/app/(marketing)/_components/article-card.tsx` and `apps/web/src/app/(marketing)/_components/article-thumb.tsx` — shared with the Blog page (Task 56).
- `apps/web/src/app/(marketing)/_components/home/segments.tsx`
- `apps/web/src/app/(marketing)/_hooks/use-public-content.ts` — query hooks.
- `apps/web/src/app/(marketing)/_styles/home-mid.css`
- `apps/web/src/mocks/handlers/public-content.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- `apps/web/src/app/(marketing)/_components/home/home-mid.test.tsx` — tests.

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
- **Feature stylesheet exception:** the reference CSS blocks below come from the prototype. Reproduce them in the task's own `.css` file (listed in Deliverables), replacing every value that has a token with `var(--token)`. A colour with NO token (for example a one-off dark gradient stop) may stay as a literal ONLY inside that `.css` file; never in TSX.
- Prefer the Tailwind classes shown in the reference markup. Where the markup uses a custom class (`vv-*`, `hero-*`, `adm-*` …) implement it from the CSS block that follows it.
- Replace every `<svg data-icon="REPLACE-WITH-LUCIDE"/>` with the closest `lucide-react` icon (keep size classes); replace every `<a href>` to an internal route with `next/link`.
- Convert the markup to TSX: `class` → `className`, `for` → `htmlFor`, self-close void tags. Do NOT copy `href` values such as `*.html`; the routes shown (e.g. `/about`) are final.
- Text content is verbatim. Do not rewrite, shorten or "improve" any string.
- **Illustration exception:** SVG illustrations (hero network map, article thumbnails) are artwork, not UI chrome; their literal fill/stroke colours may be kept exactly as in the reference, inside the named illustration component file only.

---

**Visual specification (embedded copy + layout):**

**Reference markup:**

##### Attack-surface mapping section
```html
<section class="py-14 md:py-20 bg-paper border-t border-neutral-200/80">
 <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
  <div class="flex items-center gap-2">
   <span class="h-[2px] w-6 bg-cyan-600 rounded-full"></span>
   <span class="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">ATTACK SURFACE MAPPING</span>
  </div>
  <div class="space-y-4 max-w-3xl">
   <h2 class="text-3xl sm:text-4xl md:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.15]">Every login page, API and subdomain is a door. We map them all.</h2>
   <p class="text-neutral-500 text-base sm:text-lg leading-relaxed">Before a single test runs, we build a live picture of your exposed assets — the same view an attacker builds during reconnaissance.</p>
  </div>
  <div class="pt-4 space-y-0">
   <div class="py-5 sm:py-6 border-b border-neutral-200/80 flex items-start gap-6 sm:gap-10 group hover:bg-white/60 px-3 rounded-xl transition-colors cursor-pointer">
    <span class="text-lg sm:text-xl font-bold font-mono text-cyan-600 group-hover:text-neutral-900 transition-colors shrink-0">01</span>
    <p class="text-neutral-700 text-sm sm:text-base font-medium leading-relaxed group-hover:text-neutral-900 transition-colors">Domains, subdomains and exposed services are enumerated and scored by exposure.</p>
   </div>
   [+2 more sibling <div> elements with the SAME structure as the one above; their text content in order: 02 ¦ Each node is cross-referenced against known CVEs and misconfiguration patterns. || 03 ¦ You receive a prioritized map — not a 40-page PDF nobody reads.]
  </div>
 </div>
</section>
```

##### Latest Insights & Intelligence section (cards are rendered from API data)
```html
<section class="py-12 md:py-16 bg-paper border-y border-neutral-200/60">
 <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
   <div>
    <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Latest Insights & Intelligence
    </div>
    <h2 class="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">From the VUNVAULT News & Blog</h2>
   </div>
   <a href="/blog" class="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-900 hover:text-neutral-600 transition-colors group">
    <span>Explore all news & reports</span>
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </a>
  </div>
  <div class="vv-news-grid" id="vv-news-grid" aria-live="polite"></div>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
.vv-news-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px; align-items: stretch; }
@media (min-width: 1024px) {
.vv-news-grid { max-width: 76rem; margin-inline: auto; }
}
@media (max-width: 980px) {
.vv-news-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 680px) {
.vv-news-grid { grid-template-columns: 1fr; gap: 16px; }
}
```

##### Tailored Defense Strategies (organisation segments)
```html
<section class="py-12 md:py-16 bg-paper">
 <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
  <div class="text-center max-w-2xl mx-auto space-y-2 mb-8">
   <span class="text-xs font-bold uppercase tracking-wider text-cyan-600 bg-cyan-50 px-3 py-1 rounded-full border border-cyan-200">Tailored Defense Strategies</span>
   <h2 class="text-2xl sm:text-3xl md:text-4xl font-bold text-neutral-900 tracking-tight">How Can VUNVAULT Help You?</h2>
   <p class="text-neutral-500 text-sm md:text-base">Select your organization type for customized vulnerability assessments.</p>
  </div>
  <div class="vv-seg-grid">
   <a href="/services" class="vv-seg-card">
    <div class="vv-seg-body">
     <div class="vv-seg-top">
      <h3 class="vv-seg-title">I run a Small Business</h3>
      <span class="vv-seg-tag">Starter Scan</span>
     </div>
     <p class="vv-seg-text">Affordable starter vulnerability scans with clear, actionable executive reporting.</p>
    </div>
    <span class="vv-seg-arrow" aria-hidden="true">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
    </span>
   </a>
   [+3 more sibling <a> elements with the SAME structure as the one above; their text content in order: I’m in a SACCO or Fintech ¦ Compliance Ready ¦ Regulation-aware security testing for financial institutions & Central Bank readiness. || I’m in IT / Enterprise ¦ Retainer Protection ¦ Full-scope retainer testing and board-ready reporting for complex estates. || I run a SOC / Security Team ¦ Purple Team ¦ Adversary emulation, detection-rule validation and purple-team exercises that harden your SOC.]
  </div>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
@media (prefers-reduced-motion: reduce) {
.vv-article-card,
.vv-track,
.vv-plan,
.vv-seg-card,
.contributor-card,
.glass-card { max-width: 100%; min-width: 0; }
}
.vv-seg-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.vv-seg-card { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 22px 24px; border-radius: 18px; background: rgba(255, 255, 255, 0.76); backdrop-filter: blur(14px) saturate(1.4); -webkit-backdrop-filter: blur(14px) saturate(1.4); border: 1px solid rgba(59, 153, 252, 0.14); box-shadow: 0 8px 32px rgba(10, 13, 18, 0.06); text-decoration: none; transition: transform 0.25s var(--ease), border-color 0.25s var(--ease), box-shadow 0.25s var(--ease); }
.vv-seg-card:hover,
.vv-seg-card:focus-visible { transform: translateY(-3px); border-color: var(--brand-line); box-shadow: 0 22px 46px -34px rgba(10, 13, 18, 0.45); outline: none; }
.vv-seg-body { min-width: 0; }
.vv-seg-top { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.vv-seg-title { font-size: 1.05rem; font-weight: 800; letter-spacing: -0.01em; color: var(--ink); transition: color 0.25s var(--ease); }
.vv-seg-card:hover .vv-seg-title { color: var(--brand-strong); }
.vv-seg-tag { padding: 4px 10px; font-size: 9.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-muted); background: #f5f7fa; border: 1px solid var(--line); border-radius: var(--r-full); white-space: nowrap; }
.vv-seg-text { margin-top: 8px; font-size: 0.8rem; line-height: 1.65; color: var(--ink-muted); }
.vv-seg-arrow { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; color: var(--ink-soft); background: #f1f3f7; transition: background-color 0.25s var(--ease), color 0.25s var(--ease), transform 0.25s var(--ease); }
.vv-seg-card:hover .vv-seg-arrow { background: linear-gradient(135deg, var(--brand), var(--brand-strong)); color: #ffffff; transform: translateX(3px); }
@media (max-width: 860px) {
.vv-seg-grid { grid-template-columns: 1fr; gap: 12px; }
.vv-seg-card { padding: 18px 18px; }
.vv-seg-arrow { width: 36px; height: 36px; }
}
```

**Article card (the prototype renders it in JS — build it as a component; markup reference):**
```html
<a href="/blog/{slug}" class="vv-article-card">
  <div class="vv-article-thumb">{thumb}<span class="vv-article-thumb-badge">{categoryLabel}</span></div>
  <div class="vv-article-body">
    <div class="vv-article-meta"><span>{formatted date e.g. Aug 14, 2026}</span><span>·</span><span>{readMinutes} min read</span></div>
    <h3 class="vv-article-title">{title}</h3>
    <p class="vv-article-excerpt">{excerpt}</p>
    <span class="vv-article-link"><span>Read Full Article</span>{arrow-right icon 15px}</span>
  </div>
</a>
```
Custom CSS for the card: use the `.vv-article-*` rules in the CSS blocks above (and `.vv-news-grid`, `.is-news-entering`). Thumbnail: when the item has `featuredImageUrl`, render a `next/image` (`alt` = `imageAlt` or the title, `object-cover`); otherwise render a deterministic generated illustration chosen by `index % 6`. Reference for the six generated illustrations (JS in the prototype; port to a JSX component `ArticleThumb({ index })`, using a React `useId()` for gradient ids):
```js
function thumbSVG(index) {
 var uid = "vvN" + index + "_" + Math.random().toString(36).slice(2, 7);
 var variants = [
 '<svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="'+uid+'" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a1931"/><stop offset="1" stop-color="#060a10"/></linearGradient></defs><rect width="400" height="225" fill="url(#'+uid+')"/><g fill="none" stroke="#3B99FC" stroke-opacity=".28" stroke-width="1"><path d="M0 56h400M0 112h400M0 168h400M100 0v225M200 0v225M300 0v225"/></g><path d="M200 62 L246 78 V124 c0 30-46 44-46 44 s-46-14-46-44 V78 z" fill="#3B99FC" fill-opacity=".16" stroke="#6FB6FF" stroke-width="2"/><path d="M182 116 l14 14 26-30" fill="none" stroke="#6FB6FF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
 '<svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="'+uid+'" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a1931"/><stop offset="1" stop-color="#060a10"/></linearGradient></defs><rect width="400" height="225" fill="url(#'+uid+')"/><g fill="none" stroke="#3B99FC" stroke-opacity=".35" stroke-width="1.4"><path d="M70 150 L150 78 L232 132 L318 62"/><path d="M150 78 L232 132"/></g><g fill="#6FB6FF"><circle cx="70" cy="150" r="6"/><circle cx="150" cy="78" r="6"/><circle cx="232" cy="132" r="6"/></g><circle cx="318" cy="62" r="9" fill="#f43f5e" fill-opacity=".2"/><circle cx="318" cy="62" r="5" fill="#f43f5e"/></svg>',
 '<svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="'+uid+'" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a1931"/><stop offset="1" stop-color="#060a10"/></linearGradient></defs><rect width="400" height="225" fill="url(#'+uid+')"/><rect x="120" y="46" width="160" height="134" rx="12" fill="#3B99FC" fill-opacity=".1" stroke="#3B99FC" stroke-opacity=".45" stroke-width="1.6"/><g stroke="#6FB6FF" stroke-opacity=".65" stroke-width="2.4" stroke-linecap="round"><path d="M148 88h104"/><path d="M148 114h104"/><path d="M148 140h62"/></g><path d="M232 148 l12 12 24-28" fill="none" stroke="#34d399" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
 '<svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="'+uid+'" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a1931"/><stop offset="1" stop-color="#060a10"/></linearGradient></defs><rect width="400" height="225" fill="url(#'+uid+')"/><path d="M0 158 L80 118 L160 142 L240 84 L320 112 L400 62 V225 H0 Z" fill="#3B99FC" fill-opacity=".1"/><path d="M0 158 L80 118 L160 142 L240 84 L320 112 L400 62" fill="none" stroke="#3B99FC" stroke-opacity=".45" stroke-width="1.6"/><g fill="#6FB6FF"><circle cx="80" cy="118" r="4"/><circle cx="160" cy="142" r="4"/><circle cx="320" cy="112" r="4"/></g><circle cx="240" cy="84" r="10" fill="#f43f5e" fill-opacity=".2"/><circle cx="240" cy="84" r="5" fill="#f43f5e"/></svg>',
 '<svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="'+uid+'" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a1931"/><stop offset="1" stop-color="#060a10"/></linearGradient></defs><rect width="400" height="225" fill="url(#'+uid+')"/><g fill="none" stroke="#3B99FC" stroke-opacity=".22" stroke-width="1"><path d="M0 56h400M0 112h400M0 168h400M100 0v225M200 0v225M300 0v225"/></g><rect x="168" y="102" width="64" height="54" rx="9" fill="#3B99FC" fill-opacity=".16" stroke="#6FB6FF" stroke-width="2"/><path d="M182 102V86a18 18 0 0 1 36 0v16" fill="none" stroke="#6FB6FF" stroke-width="2" stroke-linecap="round"/><circle cx="200" cy="126" r="5.5" fill="#f43f5e"/><path d="M200 132v9" stroke="#f43f5e" stroke-width="3.2" stroke-linecap="round"/></svg>',
 '<svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="'+uid+'" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a1931"/><stop offset="1" stop-color="#060a10"/></linearGradient></defs><rect width="400" height="225" fill="url(#'+uid+')"/><g fill="none" stroke="#3B99FC" stroke-opacity=".28" stroke-width="1.2"><circle cx="200" cy="112" r="30"/><circle cx="200" cy="112" r="60"/><circle cx="200" cy="112" r="90"/></g><path d="M200 112 L200 22 A90 90 0 0 1 290 112 Z" fill="#3B99FC" fill-opacity=".12"/><path d="M200 112 L200 22" stroke="#3B99FC" stroke-opacity=".5" stroke-width="1.2"/><path d="M200 112 L290 112" stroke="#3B99FC" stroke-opacity=".5" stroke-width="1.2"/><g fill="#6FB6FF"><circle cx="236" cy="80" r="4"/><circle cx="170" cy="150" r="4"/><circle cx="262" cy="142" r="4"/></g><circle cx="200" cy="112" r="6" fill="#6FB6FF"/></svg>'
 ];
 return variants[index % variants.length];
 }

 /* ==================================================================
 NORMALISATION — accept both seed shape and admin-authored shape
 ================================================================== */
```

**Data/behaviour of the grid:** `usePublicContent({ pageSize: 6, sort: "newest" })` → `GET /api/v1/content`. Show 3 cards. When the dataset has more than 3 posts, rotate every `4000` ms replacing the visible window by one position (round-robin through all items), with the `is-news-entering` animation (stagger 70 ms per card); pause rotation on hover and focus-within; `aria-busy` while loading; `prefers-reduced-motion` → no rotation. Loading state: 3 `Skeleton` cards; empty state: a single muted line `No published reports yet.` (planner-authored). Dates formatted `MMM D, YYYY` (e.g. `Aug 14, 2026`) in UTC. The section's link `Explore all news & reports` → `/blog`.

**Segments:** the four cards link to `/services#pricing` (Small Business / SACCO & Fintech / IT-Enterprise) and `/services` (SOC / Security Team) — keep the markup's arrows and tags; the prototype cards are anchors with no real destination, so use these routes.

**Tests:** attack-surface renders the three numbered steps verbatim; segments render the four titles; the grid renders 3 cards from MSW data and rotates after 4 s with fake timers when 6 posts exist; no rotation under reduced motion; card link points to `/blog/<slug>`.

---

**Data shape (TypeScript):**
```ts
interface PublicContentItem { id: string; type: ContentType; title: string; excerpt: string | null; slug: string; slugPath: string; category: BlogCategory | null; categoryLabel: string | null; severity: Severity | null; tags: string[]; readMinutes: number | null; featuredImageUrl: string | null; imageAlt: string | null; publishedAt: string; author: { fullName: string } }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/content?page=1&pageSize=6&sort=newest → 200 { data: PublicContentItem[]; total } (public, cacheable 60s)
```

---

**Out of scope:**
- Do not build other home sections.
- Do not use `localStorage` (the prototype read approved posts from it; the API is the source now).
- Do not implement the blog page.

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm --filter web dev` renders the route(s) in this task with no console errors, and `pnpm --filter web test` passes (a smoke test per new component renders it and asserts the key verbatim strings).
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 49 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 50 — Home page C: Zero-Day Exploit Tracking dashboard widget

**Layer:** L6

**Prerequisites:** Task 8, Task 9, Task 44, Task 47

**Estimated files touched:** 7

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Home page C: Zero-Day Exploit Tracking dashboard widget**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the live-looking Zero-Day Exploit Tracking widget: stat cards, auto-rotating intelligence stream, status panel and quick actions.

**Deliverables:**
- `apps/web/src/app/(marketing)/_components/home/zero-day-widget.tsx` (client)
- `apps/web/src/app/(marketing)/_components/home/zero-day-data.ts` — constants.
- `apps/web/src/app/(marketing)/_components/home/use-utc-clock.ts` — hook.
- `apps/web/src/app/(marketing)/_styles/zero-day-widget.css`
- `apps/web/src/app/(marketing)/_components/home/zero-day-widget.test.tsx`

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
- **Feature stylesheet exception:** the reference CSS blocks below come from the prototype. Reproduce them in the task's own `.css` file (listed in Deliverables), replacing every value that has a token with `var(--token)`. A colour with NO token (for example a one-off dark gradient stop) may stay as a literal ONLY inside that `.css` file; never in TSX.
- Prefer the Tailwind classes shown in the reference markup. Where the markup uses a custom class (`vv-*`, `hero-*`, `adm-*` …) implement it from the CSS block that follows it.
- Replace every `<svg data-icon="REPLACE-WITH-LUCIDE"/>` with the closest `lucide-react` icon (keep size classes); replace every `<a href>` to an internal route with `next/link`.
- Convert the markup to TSX: `class` → `className`, `for` → `htmlFor`, self-close void tags. Do NOT copy `href` values such as `*.html`; the routes shown (e.g. `/about`) are final.
- Text content is verbatim. Do not rewrite, shorten or "improve" any string.

---

**Visual specification (embedded copy + layout):**

**Reference markup:**

##### Zero-Day Exploit Tracking dashboard section (feed trimmed to its first row — rows 2–6 repeat the same structure with the data table below)
```html
<section class="py-12 md:py-20">
 <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <div class="text-center max-w-3xl mx-auto mb-14 md:mb-18 space-y-3">
   <h2 class="text-3xl sm:text-4xl md:text-5xl font-bold text-neutral-900 tracking-tight">Proactive Security Ecosystem</h2>
   <p class="text-neutral-500 text-base md:text-lg max-w-xl mx-auto leading-relaxed">Comprehensive tools designed to map, analyze, and secure your infrastructure seamlessly.</p>
  </div>
  <div class="lg:col-span-8 space-y-6 md:space-y-8">
   <div class="lg:col-span-4 space-y-6 md:space-y-8">
    <div class="lg:col-span-8 space-y-6 md:space-y-8">
     <div class="glass-card rounded-3xl p-6 sm:p-8 border border-neutral-200/90 shadow-sm hover:shadow-md transition-all duration-300">
      <div class="flex items-start gap-4 mb-6">
       <div class="w-12 h-12 rounded-2xl bg-neutral-100 border border-neutral-200/80 flex items-center justify-center text-neutral-800 shadow-xs shrink-0">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
       </div>
       <div class="space-y-1">
        <h3 class="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">Zero-Day Exploit Tracking Dashboard</h3>
        <p class="text-neutral-500 text-sm leading-relaxed max-w-2xl">Continuous coverage of past and active zero-days across cloud, endpoint, network, web, mobile and OT/ICS — with live exploitation status, CVSS severity and patch availability in one view.</p>
       </div>
      </div>
      <div class="rounded-2xl bg-neutral-900/95 text-neutral-100 p-4 sm:p-5 border border-neutral-800 shadow-2xl overflow-hidden font-sans">
       <div class="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-neutral-800 text-xs">
        <div class="flex items-center gap-3">
         <span class="font-extrabold tracking-wider text-white">VUNVAULT</span>
         <span class="text-neutral-600">|</span>
         <span class="text-neutral-300 font-semibold uppercase tracking-wider">Zero-Day Exploit Tracking</span>
         <span class="text-neutral-600 hidden sm:inline">|</span>
         <span id="zdet-clock" class="text-neutral-400 font-mono text-[11px] hidden sm:inline">--:--:-- UTC</span>
        </div>
        <div class="flex items-center gap-2.5">
         <span class="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/50 border border-emerald-800/60 px-2 py-0.5 rounded-full">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Live
         </span>
         <div class="w-6 h-6 rounded-full bg-neutral-700 flex items-center justify-center text-neutral-300 text-[10px] font-bold">ER</div>
         <span class="text-neutral-300 font-medium text-xs hidden sm:inline">Dr. Evelyn Reed</span>
        </div>
       </div>
       <div class="flex items-center gap-1 sm:gap-2 py-3 overflow-x-auto text-xs border-b border-neutral-800/80 no-scrollbar">
        <button type="button" class="px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer bg-neutral-800 text-white font-medium border border-neutral-700">Dashboard</button>
        <button type="button" class="px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50">Live Feed</button>
        [+4 more sibling <button> elements with the SAME structure as the one above; their text content in order: Exploit DB || Patch Status || Vendors || Reports]
       </div>
       <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 pt-4">
        <article class="rounded-xl bg-neutral-800/50 border border-neutral-700/60 p-3 hover:border-neutral-600 transition-colors">
         <div class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
          <svg data-icon="REPLACE-WITH-LUCIDE"/>
          Total Active Zero-Days
         </div>
         <div class="mt-1.5 text-2xl font-extrabold font-mono tracking-tight text-white">1,284</div>
         <div class="mt-1 text-[10px] font-semibold text-rose-400">▲ 62 this week</div>
        </article>
        [+3 more sibling <article> elements with the SAME structure as the one above; their text content in order: Weaponized in the Wild ¦ 37 ¦ ● Active exploitation || Patched Vulnerabilities ¦ 37,910 ¦ ▼ 18% open backlog || Mean Time to Patch ¦ 1.2 ¦ s ¦ Automated validation]
       </div>
       <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
        <div class="md:col-span-2 space-y-2">
         <div class="flex items-center justify-between text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
          <span class="flex items-center gap-1.5">
           <span class="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
           Live Zero-Day Intelligence Stream
          </span>
          <span class="text-neutral-500 font-mono text-[10px] normal-case">
           <span id="zdet-refreshed">Auto-refresh</span>
           ·
           <span id="zdet-countdown">8s</span>
          </span>
         </div>
         <div id="zdet-feed" class="space-y-2 max-h-[340px] overflow-y-auto pr-1">
          <article class="group p-2.5 sm:p-3 rounded-xl bg-neutral-800/60 hover:bg-neutral-800 border border-neutral-700/60 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2">
           <div class="space-y-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
             <span class="text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider bg-rose-500/10 text-rose-300 border-rose-500/30">Critical</span>
             <code class="text-neutral-200 text-[11px] font-mono font-bold">CVE-2026-21447</code>
             <span class="text-neutral-500 text-[11px] font-mono">14:36:45 UTC</span>
            </div>
            <div class="text-xs font-semibold text-neutral-100 group-hover:text-cyan-400 transition-colors truncate">Apache Struts 2 — OGNL injection RCE</div>
            <div class="text-[11px] text-neutral-500 truncate">Web & API · Apache Software Foundation · CVSS 9.8</div>
           </div>
           <div class="flex items-center gap-2 self-start sm:self-center shrink-0">
            <span class="text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-500 text-white">● Unpatched</span>
            <svg data-icon="REPLACE-WITH-LUCIDE"/>
           </div>
          </article>
         </div>
        </div>
        <div class="bg-neutral-800/40 rounded-xl p-3.5 border border-neutral-700/60 space-y-4 flex flex-col justify-between">
         <div class="space-y-4">
          <div>
           <div class="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Tracking System Status</div>
           <div class="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
            <svg data-icon="REPLACE-WITH-LUCIDE"/>
            All Sensors Nominal
           </div>
          </div>
          <div class="space-y-3">
           <div class="flex items-center justify-between text-xs border-b border-neutral-700/60 pb-2">
            <span class="text-neutral-400">Active Zero-Days</span>
            <span class="font-bold font-mono text-rose-400">1,284</span>
           </div>
           [+2 more sibling <div> elements with the SAME structure as the one above; their text content in order: Weaponized in Wild ¦ 37 || Critical Unpatched ¦ 46]
           <div class="flex items-center justify-between text-xs">
            <span class="text-neutral-400">Sensors Online</span>
            <span class="text-emerald-400 text-[10px] font-semibold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">412 / 412</span>
           </div>
          </div>
          <div class="pt-1 space-y-1.5">
           <div class="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            <span>Patch Coverage</span>
            <span class="font-mono text-cyan-400">68%</span>
           </div>
           <div class="relative h-1.5 w-full rounded-full bg-neutral-700/70 overflow-hidden zdet-sweep">
            <span class="absolute inset-y-0 left-0 rounded-full bg-cyan-500"></span>
           </div>
          </div>
         </div>
         <div class="pt-3 border-t border-neutral-700/60">
          <div class="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Quick Actions</div>
          <div class="grid grid-cols-2 gap-1.5 text-[10px]">
           <button type="button" class="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 py-1.5 px-2 rounded font-medium transition-colors text-center cursor-pointer border border-neutral-700/60">Run CVE Scan</button>
           [+3 more sibling <button> elements with the SAME structure as the one above; their text content in order: Isolate Asset || Push Patch || Advisories]
          </div>
         </div>
        </div>
       </div>
       <p class="pt-4 mt-4 border-t border-neutral-800 text-[10px] text-neutral-500 leading-relaxed">Refreshed continuously from NVD, vendor advisories and the VUNVAULT sensor network. Times shown in UTC.</p>
      </div>
     </div>
     <div class="glass-card rounded-3xl p-6 sm:p-8 border border-neutral-200/90 shadow-sm hover:shadow-md transition-all duration-300">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
       <div class="space-y-3 max-w-xl">
        <div class="w-12 h-12 rounded-2xl bg-neutral-100 border border-neutral-200/80 flex items-center justify-center text-neutral-800 shadow-xs">
         <svg data-icon="REPLACE-WITH-LUCIDE"/>
        </div>
        <h3 class="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">Security Advisory</h3>
        <p class="text-neutral-500 text-sm leading-relaxed">Expert guidance tailored to your risk profile. Actionable steps to remediate identified vulnerabilities swiftly.</p>
       </div>
       <div class="shrink-0 pt-2 sm:pt-0">
        <button class="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900 hover:text-neutral-600 transition-colors group cursor-pointer">
         <span>Get advice</span>
         <svg data-icon="REPLACE-WITH-LUCIDE"/>
        </button>
       </div>
      </div>
     </div>
    </div>
    <div class="lg:col-span-4 space-y-6 md:space-y-8">
     <div class="glass-card rounded-3xl p-6 sm:p-8 border border-neutral-200/90 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between min-h-[580px]">
      <div class="space-y-4">
       <div class="w-12 h-12 rounded-2xl bg-neutral-100 border border-neutral-200/80 flex items-center justify-center text-neutral-800 shadow-xs">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
       </div>
       <h3 class="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">Network Mapping</h3>
       <p class="text-neutral-500 text-sm leading-relaxed">Visualize your entire attack surface. Automatically discover exposed assets and unmapped connections.</p>
      </div>
      <div class="my-6 rounded-2xl bg-neutral-950/90 p-4 border border-neutral-800 shadow-inner relative overflow-hidden min-h-[260px] flex items-center justify-center">
       <div class="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-30"></div>
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       <div class="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[10px] text-neutral-400 bg-neutral-900/90 px-2.5 py-1 rounded border border-neutral-800">
        <span>
         Selected Node:
         <strong class="text-cyan-400">Core-K8s</strong>
        </span>
        <span class="text-emerald-400">Auto-Discovered</span>
       </div>
      </div>
      <div>
       <button class="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900 hover:text-neutral-600 transition-colors group cursor-pointer">
        <span>Explore mapping</span>
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
       </button>
      </div>
     </div>
     <div class="relative rounded-3xl overflow-hidden shadow-lg group border border-neutral-200/80 min-h-[280px] md:min-h-[320px] flex items-end">
      <img src="soft1.jpg" alt="Soft Protection for Hard Data Glass Cubes" class="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"/>
      <div class="absolute inset-0 bg-gradient-to-t from-white/90 via-white/30 to-transparent"></div>
      <div class="relative z-10 p-6 md:p-8">
       <h3 class="text-xl sm:text-2xl md:text-3xl font-bold text-neutral-900 tracking-tight">Soft Protection for Hard Data.</h3>
      </div>
     </div>
    </div>
   </div>
  </div>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
.glass-card { background: rgba(255, 255, 255, 0.76); backdrop-filter: blur(14px) saturate(1.4); -webkit-backdrop-filter: blur(14px) saturate(1.4); border: 1px solid rgba(59, 153, 252, 0.14); box-shadow: 0 8px 32px rgba(10, 13, 18, 0.06); }
#services-plans .glass-card { transition: transform 0.3s var(--ease), box-shadow 0.3s var(--ease), border-color 0.3s var(--ease); }
#services-plans .glass-card:hover { transform: translateY(-4px); border-color: var(--brand-line); box-shadow: 0 24px 50px -30px rgba(10, 13, 18, 0.4); }
#contact .glass-card { transition: transform 0.25s var(--ease), border-color 0.25s var(--ease), box-shadow 0.25s var(--ease); }
#contact a.glass-card:hover { transform: translateY(-3px); border-color: var(--brand-line); box-shadow: 0 22px 46px -34px rgba(10, 13, 18, 0.45); }
#contact a.glass-card:hover .font-mono { color: var(--brand-strong); }
@media (prefers-reduced-motion: reduce) {
.vv-article-card,
.vv-track,
.vv-plan,
.vv-seg-card,
.contributor-card,
.glass-card { max-width: 100%; min-width: 0; }
}
```

**Feed rows (data; same structure as the first row; keep the severity chip, the CVE id, the UTC time, title, `scope · vendor · CVSS x.x` line and the patch-status chip):**

| severity | CVE | time (UTC) | title | scope · vendor · CVSS | patch |
|---|---|---|---|---|---|
| Critical | CVE-2026-21447 | 14:36:45 | Apache Struts 2 — OGNL injection RCE | Web & API · Apache Software Foundation · CVSS 9.8 | Unpatched |
| Critical | CVE-2026-0091 | 14:35:12 | Cisco IOS XE — Web UI authentication bypass | Network & Edge · Cisco · CVSS 9.1 | Patch in progress |
| High | CVE-2026-3327 | 14:32:01 | Oracle WebLogic Server — deserialization RCE | Web & API · Oracle · CVSS 8.8 | Unpatched |
| High | CVE-2026-18820 | 14:28:55 | Microsoft Windows Print Spooler — privilege escalation | Endpoint / Desktop · Microsoft · CVSS 8.1 | Patched |
| Critical | CVE-2025-53112 | 14:25:11 | Google Chrome V8 — type confusion in JIT | Endpoint / Desktop · Google · CVSS 9.6 | Patched |
| High | CVE-2026-1104 | 14:21:40 | Linux Kernel io_uring — use-after-free memory corruption | OT / ICS · Linux Kernel · CVSS 7.8 | Patched |

Stat cards (data): `Total Active Zero-Days 1,284 ▲ 62 this week`; `Weaponized in the Wild 37 ● Active exploitation`; `Patched Vulnerabilities 37,910 ▼ 18% open backlog`; `Mean Time to Patch 1.2 s Automated validation`. Status panel: `Tracking System Status` / `All Sensors Nominal`; counters `Active Zero-Days 1,284`, `Weaponized in Wild 37`, `Critical Unpatched 46`, `Sensors Online 412 / 412`, `Patch Coverage 68%`. Quick actions: `Run CVE Scan`, `Isolate Asset`, `Push Patch`, `Advisories` (decorative buttons — no handlers; render as `<button type="button">`). Footnote verbatim: `Refreshed continuously from NVD, vendor advisories and the VUNVAULT sensor network. Times shown in UTC.` Mini tabs `Dashboard | Live Feed | Exploit DB | Patch Status | Vendors | Reports` are presentational (`Dashboard` active). The two small side cards after the widget (`Security Advisory` → `Get advice`, `Network Mapping` → `Explore mapping`, with `Selected Node: Core-K8s`, `Auto-Discovered`) are part of the next section — do NOT build them here.

Constants live in `zero-day-data.ts` with `// TODO(backend-contract): no public zero-day teaser endpoint exists; fixture constants for the marketing page`.

**Behaviour (port this reference JS to hooks; clock ticks every second as `HH:MM:SS UTC`; every 8 s the LAST feed row moves to the top and flashes for 1.2 s with `zdet-flash`; the countdown text shows `8s…1s`; `Updated HH:MM:SS UTC` refreshes on each rotation):**
```js
(function () {
 "use strict";
 var pad = function (n) { return String(n).padStart(2, "0"); };
 var utcStamp = function () {
 var d = new Date();
 return pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + ":" + pad(d.getUTCSeconds());
 };
 var clock = document.getElementById("zdet-clock");
 if (clock) {
 var tick = function () { clock.textContent = utcStamp() + " UTC"; };
 tick();
 window.setInterval(tick, 1000);
 }
 var feed = document.getElementById("zdet-feed");
 var countdown = document.getElementById("zdet-countdown");
 var refreshed = document.getElementById("zdet-refreshed");
 if (feed && feed.children.length > 1) {
 var INTERVAL = 8;
 var remaining = INTERVAL;
 window.setInterval(function () {
 remaining -= 1;
 if (remaining > 0) {
 if (countdown) countdown.textContent = remaining + "s";
 return;
 }
 remaining = INTERVAL;
 if (countdown) countdown.textContent = INTERVAL + "s";
 var last = feed.lastElementChild;
 feed.insertBefore(last, feed.firstElementChild);
 last.classList.add("zdet-flash");
 window.setTimeout(function () { last.classList.remove("zdet-flash"); }, 1200);
 if (refreshed) refreshed.textContent = "Updated " + utcStamp() + " UTC";
 }, 1000);
 }
 })();
```
Under `prefers-reduced-motion` the rotation still happens but without the flash animation. Clean up timers on unmount. The clock must render the SAME text on server and first client render (render `--:--:-- UTC` until mounted) to avoid hydration warnings.

**Tests (fake timers):** clock updates; after 8 ticks the last row becomes first; countdown resets; unmount clears intervals; all six CVE ids are present once.

---

**Data shape (TypeScript):**
```ts
interface FeedRow { severity: "Critical" | "High" | "Medium"; cve: string; time: string; title: string; meta: string; patch: "Unpatched" | "Patch in progress" | "Patched" }
```

**API contract (as comments only — do NOT implement the backend):**
N/A — static constants in this task.

---

**Out of scope:**
- Do not build the sections before/after the widget.
- Do not fetch live data.
- Do not wire the quick-action buttons.

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm --filter web dev` renders the route(s) in this task with no console errors, and `pnpm --filter web test` passes (a smoke test per new component renders it and asserts the key verbatim strings).
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 50 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 51 — Home page D: Academy tracks and Plans & Pricing

**Layer:** L6

**Prerequisites:** Task 8, Task 44, Task 47

**Estimated files touched:** 7

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Home page D: Academy tracks and Plans & Pricing**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the Academy learning-track cards and the three-tier pricing section as reusable components (the pricing section is reused by the Services page).

**Deliverables:**
- `apps/web/src/app/(marketing)/_components/home/academy-tracks.tsx`
- `apps/web/src/app/(marketing)/_components/pricing-plans.tsx` — `PricingPlans` (data-driven; reused in Task 54).
- `apps/web/src/app/(marketing)/_components/pricing-data.ts` — plan constants (USD).
- `apps/web/src/app/(marketing)/_styles/academy-pricing.css`
- `apps/web/src/app/(marketing)/_components/home/academy-pricing.test.tsx`

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
- **Feature stylesheet exception:** the reference CSS blocks below come from the prototype. Reproduce them in the task's own `.css` file (listed in Deliverables), replacing every value that has a token with `var(--token)`. A colour with NO token (for example a one-off dark gradient stop) may stay as a literal ONLY inside that `.css` file; never in TSX.
- Prefer the Tailwind classes shown in the reference markup. Where the markup uses a custom class (`vv-*`, `hero-*`, `adm-*` …) implement it from the CSS block that follows it.
- Replace every `<svg data-icon="REPLACE-WITH-LUCIDE"/>` with the closest `lucide-react` icon (keep size classes); replace every `<a href>` to an internal route with `next/link`.
- Convert the markup to TSX: `class` → `className`, `for` → `htmlFor`, self-close void tags. Do NOT copy `href` values such as `*.html`; the routes shown (e.g. `/about`) are final.
- Text content is verbatim. Do not rewrite, shorten or "improve" any string.
- **Illustration exception:** SVG illustrations (hero network map, article thumbnails) are artwork, not UI chrome; their literal fill/stroke colours may be kept exactly as in the reference, inside the named illustration component file only.

---

**Visual specification (embedded copy + layout):**

**Reference markup:**

##### Academy section
```html
<section id="academy" class="py-14 md:py-20 bg-paper border-t border-neutral-200/80">
 <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
  <div class="text-center max-w-2xl mx-auto space-y-3">
   <span class="text-xs font-bold uppercase tracking-wider text-cyan-600 bg-cyan-50 px-3.5 py-1 rounded-full border border-cyan-200">VUNVAULT Academy</span>
   <h2 class="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight">Learning tracks built for the real threat landscape</h2>
   <p class="text-neutral-500 text-sm md:text-base max-w-xl mx-auto">Structured, hands-on curriculum for defenders, analysts and offensive engineers with free certificate.</p>
  </div>
  <div class="vv-academy-grid">
   <article class="vv-track">
    <div class="vv-track-thumb">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     <span class="vv-track-badge">Foundations</span>
    </div>
    <div class="vv-track-body">
     <h3 class="vv-track-title">Networking & Defense Foundations</h3>
     <p class="vv-track-text">Build the protocol-level intuition every defender needs — from TCP/IP and DNS to firewalls, segmentation and secure architecture.</p>
     <div class="vv-track-skills">
      <span class="vv-skill">TCP/IP</span>
      <span class="vv-skill">DNS & TLS</span>
      <span class="vv-skill">Firewalls</span>
      <span class="vv-skill">Hardening</span>
     </div>
     <a href="/academy" class="vv-track-cta">
      <span>Explore Track</span>
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
     </a>
    </div>
   </article>
   [+2 more sibling <article> elements with the SAME structure as the one above; their text content in order: Blue Team ¦ SOC Analyst & Incident Response ¦ Triage alerts, hunt threats and run structured incident response playbooks inside a live SIEM and EDR lab environment. ¦ SIEM ¦ Threat Hunting ¦ DFIR ¦ MITRE ATT&CK ¦ Explore Track || Red Team ¦ Ethical Hacking & Web Pentesting ¦ Recon, exploit and report. Work through OWASP Top 10 labs, API abuse chains and real-world bug-bounty style scenarios. ¦ OWASP Top 10 ¦ Burp Suite ¦ API Security ¦ Reporting ¦ Explore Track]
  </div>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
.vv-article-thumb,
.vv-track-thumb { max-height: 240px; }
.vv-article-thumb svg,
.vv-track-thumb svg { width: 100%; height: 100%; object-fit: cover; }
@media (min-width: 1024px) {
.vv-article-grid,
  .vv-academy-grid { max-width: 76rem; margin-inline: auto; }
}
@media (prefers-reduced-motion: reduce) {
.vv-article-card,
.vv-track,
.vv-plan,
.vv-seg-card,
.contributor-card,
.glass-card { max-width: 100%; min-width: 0; }
.vv-track-thumb { max-height: 260px; }
.vv-track-thumb svg { display: block; width: 100%; height: 100%; object-fit: cover; }
}
.vv-academy-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px; }
.vv-track { display: flex; flex-direction: column; border-radius: 20px; overflow: hidden; background: #ffffff; border: 1px solid var(--line); transition: transform 0.28s var(--ease), border-color 0.28s var(--ease), box-shadow 0.28s var(--ease); }
.vv-track:hover { transform: translateY(-5px); border-color: var(--brand-line); box-shadow: 0 28px 56px -36px rgba(10, 13, 18, 0.5); }
.vv-track-thumb { position: relative; aspect-ratio: 16 / 9; overflow: hidden; background: linear-gradient(150deg, var(--dark), #060a10); }
.vv-track-thumb svg { position: absolute; inset: 0; width: 100%; height: 100%; transition: transform 0.6s var(--ease); }
.vv-track:hover .vv-track-thumb svg { transform: scale(1.05); }
.vv-track-badge { position: absolute; top: 14px; left: 14px; padding: 5px 11px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--brand-soft); background: rgba(10, 13, 18, 0.6); border: 1px solid rgba(59, 153, 252, 0.35); border-radius: var(--r-full); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
.vv-track-body { display: flex; flex-direction: column; flex: 1 1 auto; padding: 20px 22px 24px; }
.vv-track-title { font-size: 1.02rem; font-weight: 800; letter-spacing: -0.01em; line-height: 1.4; color: var(--ink); }
.vv-track-text { margin-top: 9px; font-size: 0.78rem; line-height: 1.7; color: var(--ink-muted); }
.vv-track-skills { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 16px; }
.vv-skill { padding: 5px 10px; font-size: 9.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-soft); background: #f5f7fa; border: 1px solid var(--line); border-radius: var(--r-full); }
.vv-track-cta { display: inline-flex; align-items: center; gap: 8px; margin-top: auto; padding-top: 20px; font-size: 0.78rem; font-weight: 800; text-decoration: none; color: var(--brand-strong); }
.vv-track-cta svg { transition: transform 0.22s var(--ease); }
.vv-track:hover .vv-track-cta svg { transform: translateX(4px); }
@media (max-width: 980px) {
.vv-academy-grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 680px) {
.vv-academy-grid { grid-template-columns: 1fr; gap: 16px; }
}
```

##### Pricing section
```html
<section id="pricing" class="py-14 md:py-20 bg-paper border-t border-neutral-200/80">
 <span id="services-plans" class="anchor-offset" aria-hidden="true"></span>
 <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
  <div class="text-center max-w-2xl mx-auto space-y-3">
   <span class="text-xs font-bold uppercase tracking-wider text-cyan-600 bg-cyan-50 px-3.5 py-1 rounded-full border border-cyan-200">Plans & Pricing</span>
   <h2 class="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight">Accessible security pricing for African & global tech</h2>
   <p class="text-neutral-500 text-sm md:text-base max-w-lg mx-auto">High-impact penetration testing and vulnerability assessments at balanced, competitive starting rates.</p>
  </div>
  <div class="vv-plan-grid">
   <article class="vv-plan">
    <header class="vv-plan-head">
     <h3 class="vv-plan-name">Small Business / Starter</h3>
     <span class="vv-plan-tag">Starter</span>
    </header>
    <div class="vv-plan-price">
     <span class="vv-plan-amount">$299</span>
     <span class="vv-plan-period">/ scan</span>
    </div>
    <p class="vv-plan-desc">Affordable starter vulnerability scans with clear, actionable executive reporting.</p>
    <ul class="vv-plan-list">
     <li>
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      <span>External IP & domain enumeration</span>
     </li>
     <li>
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      <span>Port & SSL vulnerability check</span>
     </li>
     <li>
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      <span>Executive summary + remediation checklist</span>
     </li>
    </ul>
    <a href="/services" class="vv-plan-cta">
     <span>Learn More</span>
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
    </a>
   </article>
   <article class="vv-plan vv-plan--featured">
    <header class="vv-plan-head">
     <h3 class="vv-plan-name">SACCO & Fintech Compliance</h3>
     <span class="vv-plan-tag">Recommended</span>
    </header>
    <div class="vv-plan-price">
     <span class="vv-plan-amount">$899</span>
     <span class="vv-plan-period">/ assessment</span>
    </div>
    <p class="vv-plan-desc">Regulation-aware testing for financial institutions, M-Pesa gateways and Central Bank readiness.</p>
    <ul class="vv-plan-list">
     <li>
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      <span>Full external & API gateway assessment</span>
     </li>
     <li>
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      <span>Central Bank regulatory audit mapping</span>
     </li>
     <li>
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      <span>Mobile app & M-Pesa security check</span>
     </li>
    </ul>
    <a href="/services" class="vv-plan-cta">
     <span>Learn More</span>
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
    </a>
   </article>
   <article class="vv-plan">
    <header class="vv-plan-head">
     <h3 class="vv-plan-name">IT / Enterprise Retainer</h3>
     <span class="vv-plan-tag">Retainer</span>
    </header>
    <div class="vv-plan-price">
     <span class="vv-plan-amount">$2,499</span>
     <span class="vv-plan-period">/ month</span>
    </div>
    <p class="vv-plan-desc">Full-scope retainer testing, continuous red teaming and board-ready reporting.</p>
    <ul class="vv-plan-list">
     <li>
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      <span>24/7 attack surface monitoring</span>
     </li>
     <li>
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      <span>Quarterly penetration testing</span>
     </li>
     <li>
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      <span>Dedicated security architect</span>
     </li>
    </ul>
    <a href="/services" class="vv-plan-cta">
     <span>Learn More</span>
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
    </a>
   </article>
  </div>
  <p class="text-center text-xs text-neutral-500">All plans include a named engagement lead, encrypted report delivery and a post-remediation re-test window.</p>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
@media (prefers-reduced-motion: reduce) {
}
.vv-plan-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; align-items: stretch; }
.vv-plan { display: flex; flex-direction: column; padding: 26px 24px; border-radius: 18px; background: #ffffff; border: 1px solid var(--line); transition: transform 0.25s var(--ease), border-color 0.25s var(--ease), box-shadow 0.25s var(--ease); }
.vv-plan:hover { transform: translateY(-3px); border-color: var(--brand-line); box-shadow: 0 20px 44px -32px rgba(10, 13, 18, 0.45); }
.vv-plan--featured { background: linear-gradient(160deg, var(--dark), #05070a); border-color: rgba(59, 153, 252, 0.45); }
.vv-plan-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 16px; }
.vv-plan-name { font-size: 0.8rem; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; color: var(--ink); line-height: 1.35; }
.vv-plan--featured .vv-plan-name { color: #ffffff; }
.vv-plan-tag { flex: 0 0 auto; padding: 4px 10px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; border-radius: var(--r-full); color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); white-space: nowrap; }
.vv-plan--featured .vv-plan-tag { color: var(--brand-soft); background: rgba(59, 153, 252, 0.14); border-color: rgba(59, 153, 252, 0.35); }
.vv-plan-price { display: flex; align-items: baseline; gap: 6px; }
.vv-plan-amount { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 2.35rem; font-weight: 800; letter-spacing: -0.03em; line-height: 1; color: var(--ink); }
.vv-plan--featured .vv-plan-amount { color: #ffffff; }
.vv-plan-period { font-size: 0.72rem; font-weight: 600; color: var(--ink-muted); }
.vv-plan--featured .vv-plan-period { color: #93a2b5; }
.vv-plan-desc { margin-top: 12px; font-size: 0.78rem; line-height: 1.65; color: var(--ink-muted); }
.vv-plan--featured .vv-plan-desc { color: #9aa8ba; }
.vv-plan-list { flex: 1 1 auto; display: flex; flex-direction: column; gap: 10px; margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--line-soft); }
.vv-plan--featured .vv-plan-list { border-top-color: rgba(255, 255, 255, 0.1); }
.vv-plan-list li { display: flex; align-items: flex-start; gap: 9px; font-size: 0.76rem; line-height: 1.55; color: var(--ink-soft); }
.vv-plan--featured .vv-plan-list li { color: #c3ccd8; }
.vv-plan-list svg { flex: 0 0 auto; margin-top: 2px; color: var(--brand); }
.vv-plan-cta { display: inline-flex; align-items: center; justify-content: center; gap: 8px; margin-top: 22px; padding: 12px 18px; font-size: 0.78rem; font-weight: 800; text-decoration: none; color: #ffffff; background: linear-gradient(135deg, var(--brand), var(--brand-strong)); border: 1px solid rgba(59, 153, 252, 0.5); border-radius: var(--r-full); transition: transform 0.22s var(--ease), filter 0.22s var(--ease); }
.vv-plan-cta:hover { transform: translateY(-1px); filter: brightness(1.07); }
.vv-plan--featured .vv-plan-cta { color: #04121f; background: linear-gradient(135deg, var(--brand-soft), var(--brand)); border-color: transparent; }
.vv-plan-cta svg { transition: transform 0.22s var(--ease); }
.vv-plan-cta:hover svg { transform: translateX(3px); }
@media (max-width: 900px) {
.vv-plan-grid { grid-template-columns: 1fr; gap: 14px; }
.vv-plan { padding: 22px 20px; }
}
```

**Pricing data (USD; these amounts equal the seeded `plans` rows — display only here, never a charge):** `Small Business / Starter` · `Starter` · `$299` · `/ scan` · desc `Affordable starter vulnerability scans with clear, actionable executive reporting.` · features `External IP & domain enumeration`, `Port & SSL vulnerability check`, `Executive summary + remediation checklist`; `SACCO & Fintech Compliance` · tag `Recommended` · `$899` · `/ assessment` · desc `Regulation-aware testing for financial institutions, M-Pesa gateways and Central Bank readiness.` · features `Full external & API gateway assessment`, `Central Bank regulatory audit mapping`, `Mobile app & M-Pesa security check`; `IT / Enterprise Retainer` · tag `Retainer` · `$2,499` · `/ month` · desc `Full-scope retainer testing, continuous red teaming and board-ready reporting.` · features `24/7 attack surface monitoring`, `Quarterly penetration testing`, `Dedicated security architect`. Footer line verbatim: `All plans include a named engagement lead, encrypted report delivery and a post-remediation re-test window.` Each plan's `Learn More` link → `/services#pricing`. Format prices with `formatUsdWhole` from `@vunvault/lib` (cents → `$2,499`). The featured plan (`--featured`) is the SACCO & Fintech card.

**Academy:** three track cards (`Explore Track` links → `/academy`). Track copy and skill chips are in the markup above — keep verbatim, including the intro `Structured, hands-on curriculum for defenders, analysts and offensive engineers with free certificate.` The decorative thumbnail art is part of the markup (inline SVG in the prototype → write it as a small JSX illustration component inside `academy-tracks.tsx`; literal colours allowed there).

**Tests:** three plan cards with the exact price strings; the featured plan carries the `Recommended` tag; academy renders three tracks and nine skill chips; the `$2,499` string is produced by `formatUsdWhole(249900)`.

---

**Data shape (TypeScript):**
```ts
interface Plan { code: "starter_scan" | "sacco_fintech_compliance" | "enterprise_retainer"; name: string; tag?: string; priceUsdCents: number; unit: "scan" | "assessment" | "month"; description: string; features: string[]; featured?: boolean }
```

**API contract (as comments only — do NOT implement the backend):**
N/A — static constants (a future `GET /api/v1/plans` may replace them).

---

**Out of scope:**
- Do not add checkout or purchase buttons.
- Do not build other home sections.
- Do not accept a non-USD price.

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm --filter web dev` renders the route(s) in this task with no console errors, and `pnpm --filter web test` passes (a smoke test per new component renders it and asserts the key verbatim strings).
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 51 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 52 — Home page E: Press, Contributors, Contact — and final home route assembly

**Layer:** L6

**Prerequisites:** Task 44, Task 47, Task 48, Task 49, Task 50, Task 51

**Estimated files touched:** 10

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Home page E: Press, Contributors, Contact — and final home route assembly**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the last three home sections and assemble the complete home page route in the prototype's section order.

**Deliverables:**
- `apps/web/src/app/(marketing)/_components/home/press-media.tsx`
- `apps/web/src/app/(marketing)/_components/home/contributors.tsx` — circular-avatar cards.
- `apps/web/src/app/(marketing)/_components/home/contact-strip.tsx`
- `apps/web/src/app/(marketing)/_styles/home-end.css`
- `apps/web/src/app/(marketing)/page.tsx` — the home route (replaces the placeholder).
- DELETE `apps/web/src/app/page.tsx` (the Task 41 placeholder) — this is the only deletion permitted.
- `apps/web/src/app/(marketing)/_components/home/home-end.test.tsx` and `apps/web/src/app/(marketing)/page.test.tsx`

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
- **Feature stylesheet exception:** the reference CSS blocks below come from the prototype. Reproduce them in the task's own `.css` file (listed in Deliverables), replacing every value that has a token with `var(--token)`. A colour with NO token (for example a one-off dark gradient stop) may stay as a literal ONLY inside that `.css` file; never in TSX.
- Prefer the Tailwind classes shown in the reference markup. Where the markup uses a custom class (`vv-*`, `hero-*`, `adm-*` …) implement it from the CSS block that follows it.
- Replace every `<svg data-icon="REPLACE-WITH-LUCIDE"/>` with the closest `lucide-react` icon (keep size classes); replace every `<a href>` to an internal route with `next/link`.
- Convert the markup to TSX: `class` → `className`, `for` → `htmlFor`, self-close void tags. Do NOT copy `href` values such as `*.html`; the routes shown (e.g. `/about`) are final.
- Text content is verbatim. Do not rewrite, shorten or "improve" any string.

---

**Visual specification (embedded copy + layout):**

**Reference markup:**

##### Press & Media
```html
<section id="press-media" class="py-14 md:py-20 bg-paper border-t border-neutral-200/80">
 <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
  <div class="flex items-center gap-2">
   <span class="h-[2px] w-6 bg-cyan-600 rounded-full"></span>
   <span class="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">PRESS & MEDIA</span>
  </div>
  <div class="space-y-4 max-w-3xl">
   <h2 class="text-3xl sm:text-4xl md:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.15]">For journalists and partners</h2>
   <p class="text-neutral-600 text-base sm:text-lg leading-relaxed font-normal">
    VUNVAULT is an Africa-rooted cybersecurity firm headquartered in Nairobi, Kenya, providing penetration testing, vulnerability assessments and security education to organizations of every size, across Africa and worldwide.
   </p>
  </div>
  <div class="glass-card rounded-3xl p-6 sm:p-8 border border-neutral-200/90 relative overflow-hidden shadow-xs space-y-4">
   <div class="absolute top-6 left-6 text-neutral-200/60 pointer-events-none">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </div>
   <blockquote class="relative z-10 text-neutral-800 text-sm sm:text-base md:text-lg font-medium leading-relaxed pl-4 border-l-4 border-indigo-600">
    “The Minnesota attacks were not sophisticated, and that is exactly what makes them dangerous. Attackers simply found control systems left connected to the internet, often with default passwords. Every utility should treat perimeter security as mission critical.”
   </blockquote>
   <div class="pt-2 flex items-center justify-between text-xs text-neutral-500 font-mono">
    <span>— VUNVAULT Threat Intelligence Commentary</span>
    <span class="text-cyan-700 font-bold">Featured in Global Tech Press</span>
   </div>
  </div>
  <div class="p-6 rounded-2xl bg-neutral-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
   <div class="space-y-1 text-center sm:text-left">
    <h4 class="font-bold text-sm">Media Inquiries & Interview Requests</h4>
    <p class="text-xs text-neutral-400">
     Direct press contact:
     <code class="text-cyan-400 font-mono">press@vunvault.com</code>
    </p>
   </div>
   <div class="flex items-center gap-3">
    <a href="mailto:press@vunvault.com" class="bg-cyan-400 hover:bg-cyan-300 text-neutral-950 text-xs font-bold px-4 py-2.5 rounded-full transition-colors flex items-center gap-1.5">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     <span>Contact Press Office</span>
    </a>
   </div>
  </div>
 </div>
</section>
```

##### Contributors
```html
<section id="contributors" class="contributors py-14 md:py-20 border-t border-neutral-200/80">
 <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <header class="contributors-header">
   <div class="flex items-center gap-2">
    <span class="h-[2px] w-6 bg-cyan-600 rounded-full"></span>
    <span class="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">CONTRIBUTORS</span>
   </div>
   <h2 class="text-3xl sm:text-4xl md:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.15]">The people behind the defense</h2>
   <p class="text-neutral-500 text-base sm:text-lg leading-relaxed max-w-2xl">Ethical hackers, security engineers and threat researchers building VUNVAULT’s detection, automation and education stack.</p>
  </header>
  <div class="contributors-grid">
   <article class="contributor-card circular">
    <div class="contributor-avatar-wrap">
     <img class="contributor-avatar" src="<data-uri omitted/>" alt="Portrait of Amara Njoroge"/>
    </div>
    <h4 class="contributor-name">Amara Njoroge</h4>
    <p class="contributor-role">Offensive Security Lead</p>
    <p class="contributor-bio">Designs and runs red-team engagements for SACCOs, fintechs and M-Pesa gateway providers across East Africa.</p>
   </article>
   [+3 more sibling <article> elements with the SAME structure as the one above; their text content in order: Daniel Mwangi ¦ Security Automation Engineer ¦ Builds the continuous attack-surface enumeration agents and automated patch-validation CLI behind the VUNVAULT engine. || Fatima Hassan ¦ Threat Intelligence Analyst ¦ Curates the zero-day tracking feed, correlates CVE data with vendor advisories and authors VUNVAULT threat briefings. || Brian Otieno ¦ Compliance & Curriculum Lead ¦ Maps audit findings to Central Bank frameworks and authors the VUNVAULT Academy cybersecurity foundations course.]
  </div>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
.contributors { background: radial-gradient(90% 60% at 50% 0%, rgba(59, 153, 252, 0.06), transparent 60%), var(--paper); border-top: 1px solid var(--line-soft); }
.contributors-header { display: flex; flex-direction: column; gap: 14px; max-width: 60rem; }
.contributors-header h2 { color: var(--ink); }
.contributors-header p { max-width: 60ch; }
.contributors-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 34px 26px; margin-top: 54px; }
.contributor-card { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; padding: 8px; }
.contributor-card.circular .contributor-avatar-wrap { position: relative; width: 156px; height: 156px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 50% 30%, rgba(59, 153, 252, 0.22), transparent 70%), linear-gradient(160deg, var(--dark), #05070a); border: 1px solid rgba(59, 153, 252, 0.28); box-shadow: 0 0 0 6px rgba(59, 153, 252, 0.06), 0 24px 48px -28px rgba(0, 0, 0, 0.65); transition: transform 0.35s var(--ease), box-shadow 0.35s var(--ease), border-color 0.35s var(--ease); overflow: hidden; }
.contributor-card.circular:hover .contributor-avatar-wrap { transform: translateY(-6px) scale(1.02); border-color: var(--brand); box-shadow: 0 0 0 8px rgba(59, 153, 252, 0.1), 0 30px 60px -26px var(--brand-glow); }
.contributor-avatar { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block; transition: transform 0.5s var(--ease); }
.contributor-card.circular:hover .contributor-avatar { transform: scale(1.06); }
.contributor-card.circular .contributor-avatar-wrap::after { content: ""; position: absolute; inset: 6px; border-radius: 50%; border: 1px solid rgba(255, 255, 255, 0.14); pointer-events: none; }
.contributor-name { margin-top: 18px; font-size: 1rem; font-weight: 800; letter-spacing: -0.01em; color: var(--ink); }
.contributor-role { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--brand-strong); }
.contributor-bio { margin-top: 8px; font-size: 0.78rem; line-height: 1.7; color: var(--ink-muted); max-width: 30ch; }
.contributor-card.circular .contributor-avatar-wrap { max-width: 156px; max-height: 156px; }
@media (max-width: 1180px) {
.contributors-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 900px) {
.contributors-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px 20px; }
.contributor-card.circular .contributor-avatar-wrap { width: 138px; height: 138px; }
}
@media (max-width: 640px) {
.contributors-grid { grid-template-columns: 1fr; gap: 30px; }
.contributor-card.circular .contributor-avatar-wrap { width: 148px; height: 148px; }
.contributor-bio { max-width: 40ch; }
}
@media (prefers-reduced-motion: reduce) {
.vv-article-card,
.vv-track,
.vv-plan,
.vv-seg-card,
.contributor-card,
.glass-card { max-width: 100%; min-width: 0; }
}
```

##### Contact & Partnerships
```html
<section id="contact" class="py-14 md:py-20 bg-paper border-t border-neutral-200/80">
 <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
  <div class="space-y-3">
   <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-600">
    <span class="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>
    Contact & Partnerships
   </div>
   <h2 class="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight">Get in Touch with VUNVAULT</h2>
   <p class="text-neutral-500 text-base sm:text-lg max-w-2xl leading-relaxed">Reach the team directly to discuss an assessment, ask a question or become a partner.</p>
  </div>
  <div class="space-y-4 max-w-3xl">
   <a href="https://wa.me/254705998032" target="_blank" rel="noopener noreferrer" class="p-5 sm:p-6 rounded-2xl glass-card border border-neutral-200/80 hover:border-neutral-900 transition-all duration-200 flex items-center gap-5 group cursor-pointer">
    <div class="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs group-hover:scale-105 transition-transform">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
    </div>
    <div class="space-y-0.5">
     <div class="text-[11px] font-bold uppercase tracking-widest text-neutral-400">WHATSAPP</div>
     <div class="text-lg sm:text-xl font-extrabold text-neutral-900 group-hover:text-indigo-600 transition-colors font-mono">+254 705 998 032</div>
    </div>
   </a>
   <a href="mailto:support@vunvault.com" class="p-5 sm:p-6 rounded-2xl glass-card border border-neutral-200/80 hover:border-neutral-900 transition-all duration-200 flex items-center gap-5 group cursor-pointer">
    <div class="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs group-hover:scale-105 transition-transform">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
    </div>
    <div class="space-y-0.5">
     <div class="text-[11px] font-bold uppercase tracking-widest text-neutral-400">EMAIL</div>
     <div class="text-lg sm:text-xl font-extrabold text-neutral-900 group-hover:text-indigo-600 transition-colors font-mono">info@vunvault.com</div>
    </div>
   </a>
   <div class="p-5 sm:p-6 rounded-2xl glass-card border border-neutral-200/80 flex items-start gap-5">
    <div class="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs mt-0.5">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
    </div>
    <div class="space-y-0.5">
     <div class="text-[11px] font-bold uppercase tracking-widest text-neutral-400">BASED IN</div>
     <div class="text-base sm:text-lg font-bold text-neutral-900 leading-snug">Nairobi, Kenya — serving clients across Africa and worldwide.</div>
    </div>
   </div>
   <div class="pt-4 flex items-center gap-3" aria-label="VUNVAULT social profiles">
    <a class="social-link" href="https://x.com/vunvault" target="_blank" rel="noopener noreferrer" aria-label="VUNVAULT on X (Twitter)">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
    </a>
    [+3 more sibling <a> elements with the SAME structure as the one above; their text content in order: || || ]
   </div>
  </div>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
.glass-card { background: rgba(255, 255, 255, 0.76); backdrop-filter: blur(14px) saturate(1.4); -webkit-backdrop-filter: blur(14px) saturate(1.4); border: 1px solid rgba(59, 153, 252, 0.14); box-shadow: 0 8px 32px rgba(10, 13, 18, 0.06); }
#services-plans .glass-card { transition: transform 0.3s var(--ease), box-shadow 0.3s var(--ease), border-color 0.3s var(--ease); }
#services-plans .glass-card:hover { transform: translateY(-4px); border-color: var(--brand-line); box-shadow: 0 24px 50px -30px rgba(10, 13, 18, 0.4); }
#contact .glass-card { transition: transform 0.25s var(--ease), border-color 0.25s var(--ease), box-shadow 0.25s var(--ease); }
#contact a.glass-card:hover { transform: translateY(-3px); border-color: var(--brand-line); box-shadow: 0 22px 46px -34px rgba(10, 13, 18, 0.45); }
#contact a.glass-card:hover .font-mono { color: var(--brand-strong); }
.social-link { display: inline-flex; align-items: center; justify-content: center; width: 42px; height: 42px; border-radius: var(--r-full); color: var(--ink-soft); background: #ffffff; border: 1px solid var(--line); box-shadow: 0 6px 16px -14px rgba(10, 13, 18, 0.6); transition: color 0.25s var(--ease), border-color 0.25s var(--ease), background-color 0.25s var(--ease), transform 0.25s var(--ease), box-shadow 0.25s var(--ease); }
.social-link svg { width: 18px; height: 18px; transition: transform 0.25s var(--ease); }
.social-link:hover,
.social-link:focus-visible { color: var(--brand); border-color: var(--brand); background: var(--brand-tint); transform: translateY(-3px); box-shadow: 0 14px 30px -16px var(--brand-glow); outline: none; }
.social-link:hover svg { transform: scale(1.1); }
.social-link:active { transform: translateY(-1px) scale(0.97); }
@media (max-width: 640px) {
.social-link { width: 40px; height: 40px; }
}
@media (prefers-reduced-motion: reduce) {
}
```

**Contributor cards:** four people, in order — `Amara Njoroge` / `Offensive Security Lead`; `Daniel Mwangi` / `Security Automation Engineer`; `Fatima Hassan` / `Threat Intelligence Analyst`; `Brian Otieno` / `Compliance & Curriculum Lead` — bios verbatim from the markup. Avatars are circular initials tiles (`AN`, `DM`, `FH`, `BO`) built from the name; no photographs.

**Contact strip:** `WHATSAPP +254 705 998 032` → `https://wa.me/254705998032`; `EMAIL info@vunvault.com` → `mailto:`; `BASED IN Nairobi, Kenya — serving clients across Africa and worldwide.`; social links as in the markup. The press block's `Contact Press Office` → `mailto:press@vunvault.com`; the `Request a Report` button → `/contact?category=penetration_testing_request#contact-form`.

**Home route assembly (`page.tsx`, server component) — exact order:** `Hero` (47) → anchor `<span id="get-started" class="anchor-offset"/>` → `CveTicker` (47) → `ScannerCta` (48) → `AttackSurface` (49) → `InsightsGrid` (49) → `Segments` (49) → Zero-Day widget (50) followed by the two side cards `Security Advisory` (`Expert guidance tailored to your risk profile. Actionable steps to remediate identified vulnerabilities swiftly.` · button `Get advice` → `/contact`) and `Network Mapping` (`Visualize your entire attack surface. Automatically discover exposed assets and unmapped connections.` · `Selected Node: Core-K8s` · `Auto-Discovered` · button `Explore mapping` → `/services`) → `AcademyTracks` (51) → the line `Soft Protection for Hard Data.` as in the prototype between the cards and the academy (render it where it appears in the markup of Task 50's section tail) → `PricingPlans` (51) → `PressMedia` → `Contributors` → `ContactStrip`. Export `metadata` with `title: "VUNVAULT — We Find The Cracks Before They Do"` (absolute) and a description from the hero paragraph.

**Tests:** the page renders all sections in order (assert by headings: `We Find The Cracks Before They Do` … `Get in Touch with VUNVAULT`); four contributor cards; no duplicate `id`s; the placeholder file no longer exists.

---

**Data shape (TypeScript):**
```ts
interface Contributor { name: string; role: string; bio: string; initials: string }
```

**API contract (as comments only — do NOT implement the backend):**
N/A — static content; home data hooks come from Task 49.

---

**Out of scope:**
- Do not edit the components of Tasks 47–51 except to import them.
- Do not build the footer or header.
- Do not add images.

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm --filter web dev` renders the route(s) in this task with no console errors, and `pnpm --filter web test` passes (a smoke test per new component renders it and asserts the key verbatim strings).
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 52 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 53 — About page A: hero, mission & vision, pillars, closing band

**Layer:** L6

**Prerequisites:** Task 8, Task 44, Task 48

**Estimated files touched:** 8

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **About page A: hero, mission & vision, pillars, closing band**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the About route shell and its static sections: hero, Mission & Vision, three Core Pillars and the closing call-to-action band.

**Deliverables:**
- `apps/web/src/app/(marketing)/about/page.tsx` — route; renders the sections of this task plus the two placeholders `<AboutTeam/>` and `<AboutTelemetry/>` imported from `./_components/team` and `./_components/telemetry` (Task 53b creates them; until then create each as `export function X() { return null; }` in its own file — Task 53b overwrites them).
- `apps/web/src/app/(marketing)/about/_components/about-hero.tsx`, `mission-vision.tsx`, `pillars.tsx`, `get-started.tsx`
- `apps/web/src/app/(marketing)/about/_components/team.tsx`, `apps/web/src/app/(marketing)/about/_components/telemetry.tsx` — null stubs as described.
- `apps/web/src/app/(marketing)/about/_styles/about.css`
- `apps/web/src/app/(marketing)/about/about-a.test.tsx`

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
- **Feature stylesheet exception:** the reference CSS blocks below come from the prototype. Reproduce them in the task's own `.css` file (listed in Deliverables), replacing every value that has a token with `var(--token)`. A colour with NO token (for example a one-off dark gradient stop) may stay as a literal ONLY inside that `.css` file; never in TSX.
- Prefer the Tailwind classes shown in the reference markup. Where the markup uses a custom class (`vv-*`, `hero-*`, `adm-*` …) implement it from the CSS block that follows it.
- Replace every `<svg data-icon="REPLACE-WITH-LUCIDE"/>` with the closest `lucide-react` icon (keep size classes); replace every `<a href>` to an internal route with `next/link`.
- Convert the markup to TSX: `class` → `className`, `for` → `htmlFor`, self-close void tags. Do NOT copy `href` values such as `*.html`; the routes shown (e.g. `/about`) are final.
- Text content is verbatim. Do not rewrite, shorten or "improve" any string.
- **Illustration exception:** SVG illustrations (hero network map, article thumbnails) are artwork, not UI chrome; their literal fill/stroke colours may be kept exactly as in the reference, inside the named illustration component file only.

---

**Visual specification (embedded copy + layout):**

**Reference markup (page body; header/footer come from the marketing layout; footer variant `company`). Section order on the page: hero → mission → pillars → `<AboutTeam/>` → `<AboutTelemetry/>` → get started.**

##### About hero
```html
<section class="vv-hero">
 <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 vv-hero-inner">
  <div class="text-center max-w-4xl mx-auto space-y-6">
   <span class="hero-eyebrow">Africa-rooted · Worldwide defense</span>
   <h1 class="vv-h1">We were built where the internet is hardest to defend.</h1>
   <p class="vv-lead max-w-3xl mx-auto">
    VUNVAULT is a Nairobi-headquartered offensive security firm. We run adversary emulation, penetration testing and continuous attack-surface mapping for SACCOs, fintechs, M-Pesa gateway providers and enterprises — teams whose uptime is measured in livelihoods, not service credits.
   </p>
   <div class="vv-hero-actions">
    <a href="/services" class="btn-get-started">Explore Our Services</a>
    <a href="/contact" class="vv-btn-ghost">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     <span>Talk to an Engineer</span>
    </a>
   </div>
  </div>
  <div class="vv-stat-strip vv-reveal">
   <div class="vv-stat">
    <span class="vv-stat-value">412</span>
    <span class="vv-stat-label">Sensors Online</span>
   </div>
   <div class="vv-stat">
    <span class="vv-stat-value">1,284</span>
    <span class="vv-stat-label">Assets Monitored</span>
   </div>
   <div class="vv-stat">
    <span class="vv-stat-value">12,904</span>
    <span class="vv-stat-label">Threats Blocked</span>
   </div>
   <div class="vv-stat">
    <span class="vv-stat-value">1.2s</span>
    <span class="vv-stat-label">Mean Patch Time</span>
   </div>
  </div>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
.hero-eyebrow { display: inline-block; padding: 7px 16px; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); border-radius: var(--r-full); }
.btn-get-started { display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 16px 42px; font-size: 0.95rem; font-weight: 700; letter-spacing: 0.02em; color: #ffffff; background: linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%); border-radius: var(--r-full); border: 1px solid rgba(59, 153, 252, 0.5); box-shadow: 0 14px 34px -14px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.25); transition: transform 0.25s var(--ease), box-shadow 0.25s var(--ease), filter 0.25s var(--ease); }
.btn-get-started::after { content: "→"; font-size: 1rem; transition: transform 0.25s var(--ease); }
.btn-get-started:hover { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 20px 44px -16px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.3); }
.btn-get-started:hover::after { transform: translateX(4px); }
.btn-get-started:active { transform: translateY(0) scale(0.98); }
@media (max-width: 768px) {
.btn-get-started { padding: 15px 34px; font-size: 0.9rem; }
}
.vv-h1 { font-size: clamp(2.05rem, 5.4vw, 3.6rem); font-weight: 800; letter-spacing: -0.03em; line-height: 1.08; color: var(--ink); }
.vv-lead { font-size: clamp(1rem, 1.5vw, 1.14rem); line-height: 1.72; color: var(--ink-muted); }
.vv-hero { position: relative; overflow: hidden; padding-top: 3.4rem; padding-bottom: 3rem; }
.vv-hero::before { content: ""; position: absolute; top: -30%; left: 50%; width: min(880px, 120%); height: 620px; transform: translateX(-50%); background: radial-gradient(closest-side, rgba(59, 153, 252, 0.16), transparent 72%); filter: blur(70px); pointer-events: none; }
.vv-hero-inner { position: relative; z-index: 1; }
.vv-hero-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 14px; padding-top: 10px; }
.vv-btn-ghost { display: inline-flex; align-items: center; gap: 9px; padding: 15px 30px; font-size: 0.88rem; font-weight: 700; color: var(--ink); background: #ffffff; border: 1px solid var(--line); border-radius: var(--r-full); transition: border-color 0.25s var(--ease), color 0.25s var(--ease), transform 0.25s var(--ease), box-shadow 0.25s var(--ease); }
.vv-btn-ghost:hover,
      .vv-btn-ghost:focus-visible { color: var(--brand-strong); border-color: var(--brand-line); transform: translateY(-2px); box-shadow: 0 18px 36px -26px var(--brand-glow); outline: none; }
.vv-stat-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; margin-top: 3rem; border-radius: var(--r-xl); overflow: hidden; background: var(--line-soft); border: 1px solid var(--line-soft); box-shadow: 0 24px 50px -42px rgba(10, 13, 18, 0.5); }
.vv-stat { padding: 22px 20px; background: #ffffff; text-align: center; }
.vv-stat-value { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: clamp(1.35rem, 2.6vw, 1.85rem); font-weight: 800; letter-spacing: -0.03em; line-height: 1; color: var(--brand-strong); }
.vv-stat-label { display: block; margin-top: 8px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-faint); }
@media (max-width: 760px) {
.vv-stat-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
.vv-reveal { opacity: 0; transform: translateY(16px); transition: opacity 0.6s var(--ease), transform 0.6s var(--ease); }
.vv-reveal.is-in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
.vv-reveal { opacity: 1; transform: none; transition: none; }
}
```

##### Mission & Vision
```html
<section class="vv-section" id="mission">
 <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
  <div class="max-w-3xl space-y-4">
   <span class="vv-eyebrow">Mission & Vision</span>
   <h2 class="vv-h2">Security work that survives contact with reality.</h2>
   <p class="vv-body max-w-2xl">Most assessments are written for auditors. Ours are written for the engineer who has to ship the fix before Monday. That single bias shapes everything below.</p>
  </div>
  <div class="vv-mv-grid">
   <article class="vv-mv-card vv-reveal">
    <span class="vv-mv-icon" aria-hidden="true">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
    </span>
    <h3 class="vv-h3">Our mission</h3>
    <p class="vv-body">
     To make advanced offensive security reachable for the institutions that carry African economies — SACCOs, fintechs, payment gateways and public infrastructure — by pairing adversary-grade tooling with plain-language reporting that a board can actually act on.
    </p>
    <p class="vv-body">We do not sell fear. We map exposure, prove impact, and hand back a prioritised path out of the blast radius.</p>
   </article>
   <article class="vv-mv-card vv-mv-card--dark vv-reveal">
    <span class="vv-mv-icon" aria-hidden="true">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
    </span>
    <h3 class="vv-h3">Our vision</h3>
    <p class="vv-body">
     A continent where a two-person IT team in Kisumu has the same defensive leverage as a Tier-1 bank in Zurich. That means automation, telemetry and continuous validation — not annual PDFs.
    </p>
    <p class="vv-body">We are building the sensor network, the academy and the tooling to close that gap permanently.</p>
   </article>
  </div>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
.vv-h2 { font-size: clamp(1.55rem, 3.4vw, 2.35rem); font-weight: 800; letter-spacing: -0.022em; line-height: 1.15; color: var(--ink); }
.vv-h3 { font-size: clamp(1.05rem, 1.8vw, 1.25rem); font-weight: 800; letter-spacing: -0.015em; line-height: 1.35; color: var(--ink); }
.vv-body { font-size: 0.86rem; line-height: 1.75; color: var(--ink-muted); }
.vv-section { padding-top: 3.6rem; padding-bottom: 3.6rem; border-top: 1px solid var(--line-soft); }
@media (max-width: 768px) {
.vv-section { padding-top: 2.6rem; padding-bottom: 2.6rem; }
}
.vv-eyebrow { display: inline-flex; align-items: center; gap: 10px; font-size: 10.5px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase; color: var(--brand-strong); }
.vv-eyebrow::before { content: ""; width: 24px; height: 2px; border-radius: 9999px; background: var(--brand); }
.vv-mv-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
@media (max-width: 860px) {
.vv-mv-grid { grid-template-columns: 1fr; }
}
.vv-mv-card { position: relative; padding: 30px 30px 32px; border-radius: var(--r-2xl); background: rgba(255, 255, 255, 0.76); backdrop-filter: blur(14px) saturate(1.4); -webkit-backdrop-filter: blur(14px) saturate(1.4); border: 1px solid rgba(59, 153, 252, 0.14); box-shadow: 0 8px 32px rgba(10, 13, 18, 0.06); overflow: hidden; transition: transform 0.28s var(--ease), border-color 0.28s var(--ease), box-shadow 0.28s var(--ease); }
.vv-mv-card:hover { transform: translateY(-4px); border-color: var(--brand-line); box-shadow: 0 26px 54px -38px rgba(10, 13, 18, 0.5); }
.vv-mv-card--dark { background: radial-gradient(90% 80% at 100% 0%, rgba(59, 153, 252, 0.20), transparent 60%), linear-gradient(160deg, var(--dark), #05070a); border-color: rgba(59, 153, 252, 0.32); color: #ffffff; }
.vv-mv-card--dark .vv-h3 { color: #ffffff; }
.vv-mv-card--dark .vv-body { color: #9aa8ba; }
.vv-mv-icon { display: inline-flex; align-items: center; justify-content: center; width: 46px; height: 46px; border-radius: 14px; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); margin-bottom: 18px; }
.vv-mv-card--dark .vv-mv-icon { color: var(--brand-soft); background: rgba(59, 153, 252, 0.14); border-color: rgba(59, 153, 252, 0.35); }
@media (prefers-reduced-motion: reduce) {
}
```

##### Core Pillars
```html
<section class="vv-section" id="pillars">
 <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
  <div class="max-w-3xl space-y-4">
   <span class="vv-eyebrow">Core Pillars</span>
   <h2 class="vv-h2">Three disciplines. One engagement.</h2>
   <p class="vv-body max-w-2xl">Every VUNVAULT engagement is delivered against the same three pillars — the technical, the regulatory and the human. Drop one and the other two collapse.</p>
  </div>
  <div class="vv-pillar-grid">
   <article class="vv-pillar vv-reveal">
    <div class="flex items-center gap-3">
     <span class="vv-pillar-icon" aria-hidden="true">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
     </span>
     <span class="vv-pillar-num">01</span>
    </div>
    <h3 class="vv-h3">Precision Offense</h3>
    <p class="vv-body">Adversary emulation that mirrors the tradecraft actually landing on East African targets — not a generic scanner dump.</p>
    <ul class="vv-pillar-list">
     <li>
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      <span>Web, API and mobile penetration testing</span>
     </li>
     <li>
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      <span>Custom fuzzing pipelines & zero-day research</span>
     </li>
     <li>
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      <span>Purple-team validation against your SIEM rules</span>
     </li>
    </ul>
   </article>
   [+2 more sibling <article> elements with the SAME structure as the one above; their text content in order: 02 ¦ Regulatory Mastery ¦ Findings mapped to the framework your regulator actually cites — so remediation doubles as evidence. ¦ Central Bank of Kenya cyber requirements ¦ Kenya Data Protection Act & GDPR alignment ¦ ISO 27001 / SOC 2 control evidence || 03 ¦ Capacity Building ¦ A finding you can't reproduce is a finding you can't fix. We train your team to hold the line after we leave. ¦ VUNVAULT Academy learning tracks ¦ Developer secure-coding workshops ¦ Incident-response tabletop exercises]
  </div>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
@media (max-width: 768px) {
}
.vv-pillar-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
@media (max-width: 980px) {
.vv-pillar-grid { grid-template-columns: 1fr; gap: 16px; }
}
.vv-pillar { position: relative; display: flex; flex-direction: column; padding: 28px 26px 30px; border-radius: 20px; background: #ffffff; border: 1px solid var(--line); overflow: hidden; transition: transform 0.28s var(--ease), border-color 0.28s var(--ease), box-shadow 0.28s var(--ease); }
.vv-pillar::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, var(--brand), transparent); opacity: 0.85; }
.vv-pillar:hover { transform: translateY(-5px); border-color: var(--brand-line); box-shadow: 0 28px 56px -38px rgba(10, 13, 18, 0.5); }
.vv-pillar-icon { display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 15px; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); }
.vv-pillar-num { margin-left: auto; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; font-weight: 800; letter-spacing: 0.14em; color: var(--ink-faint); }
.vv-pillar-list { display: flex; flex-direction: column; gap: 9px; margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--line-soft); }
.vv-pillar-list li { display: flex; align-items: flex-start; gap: 9px; font-size: 0.78rem; line-height: 1.6; color: var(--ink-soft); }
.vv-pillar-list svg { flex: 0 0 auto; margin-top: 3px; color: var(--brand); }
@media (prefers-reduced-motion: reduce) {
}
```

##### Get started band
```html
<section class="vv-section" id="get-started">
 <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
  <div class="vv-cta vv-reveal">
   <span class="vv-cta-glow" aria-hidden="true"></span>
   <div class="vv-cta-inner">
    <span class="text-[10px] font-bold uppercase tracking-[0.22em]">No cost · No commitment</span>
    <h2 class="vv-h2">See your attack surface the way we see it.</h2>
    <p class="vv-body">Start with a free external vulnerability scan, or talk to an engineer about a full adversary-emulation engagement mapped to your regulator's framework.</p>
    <div class="vv-cta-actions">
     <a href="/services" class="btn-get-started">Explore Services</a>
     <a href="/contact" class="vv-btn-ghost">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      <span>Book a Scoping Call</span>
     </a>
    </div>
   </div>
  </div>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
@media (max-width: 768px) {
}
@media (max-width: 768px) {
}
.vv-cta { position: relative; overflow: hidden; border-radius: var(--r-2xl); padding: 44px 40px; text-align: center; color: #ffffff; background: radial-gradient(90% 130% at 100% 0%, rgba(59, 153, 252, 0.30), transparent 60%), linear-gradient(135deg, var(--dark) 0%, #060a10 100%); border: 1px solid rgba(59, 153, 252, 0.32); box-shadow: 0 30px 60px -34px rgba(0, 0, 0, 0.6); }
.vv-cta-glow { position: absolute; top: -40%; left: 50%; width: 60%; height: 180%; transform: translateX(-50%); background: radial-gradient(closest-side, var(--brand-glow), transparent 72%); filter: blur(70px); opacity: 0.5; pointer-events: none; }
.vv-cta-inner { position: relative; z-index: 1; }
.vv-cta-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 14px; margin-top: 26px; }
@media (max-width: 640px) {
.vv-cta { padding: 32px 22px; }
.vv-cta-actions > * { width: 100%; justify-content: center; }
}
@media (prefers-reduced-motion: reduce) {
}
```

**Behaviour:** CTA buttons: `Explore Our Services` → `/services`, `Talk to an Engineer` → `/contact`, `Book a Scoping Call` → `/contact`. Page `metadata`: title `About VUNVAULT — Africa-Rooted. Worldwide Defense.` (absolute). The `vv-reveal` class in the markup is a scroll-reveal: implement as a tiny client hook `useReveal()` using `IntersectionObserver` that adds `is-visible`; without JS or under reduced motion the content is visible immediately.

**Tests:** mission and vision headings render verbatim; three pillars each show their bullet lists; the page includes the two stubs without crashing; CTA hrefs correct.

---

**Data shape (TypeScript):**
N/A — static content.

**API contract (as comments only — do NOT implement the backend):**
N/A — static content.

---

**Out of scope:**
- Do not build the team or telemetry sections (Task 53b).
- Do not edit the layout.
- Do not fetch data.

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm --filter web dev` renders the route(s) in this task with no console errors, and `pnpm --filter web test` passes (a smoke test per new component renders it and asserts the key verbatim strings).
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 53 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 53b — About page B: core team and live System Telemetry panel

**Layer:** L6

**Prerequisites:** Task 50, Task 53

**Estimated files touched:** 6

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **About page B: core team and live System Telemetry panel**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the Core Team section and the System Telemetry panel, replacing the two stubs from Task 53.

**Deliverables:**
- `apps/web/src/app/(marketing)/about/_components/team.tsx` — overwrites the stub.
- `apps/web/src/app/(marketing)/about/_components/telemetry.tsx` — overwrites the stub (client).
- `apps/web/src/app/(marketing)/about/_data/about-data.ts` — team + telemetry constants.
- MODIFY `apps/web/src/app/(marketing)/about/_styles/about.css` — append the rules of this task.
- `apps/web/src/app/(marketing)/about/about-b.test.tsx`

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
- **Feature stylesheet exception:** the reference CSS blocks below come from the prototype. Reproduce them in the task's own `.css` file (listed in Deliverables), replacing every value that has a token with `var(--token)`. A colour with NO token (for example a one-off dark gradient stop) may stay as a literal ONLY inside that `.css` file; never in TSX.
- Prefer the Tailwind classes shown in the reference markup. Where the markup uses a custom class (`vv-*`, `hero-*`, `adm-*` …) implement it from the CSS block that follows it.
- Replace every `<svg data-icon="REPLACE-WITH-LUCIDE"/>` with the closest `lucide-react` icon (keep size classes); replace every `<a href>` to an internal route with `next/link`.
- Convert the markup to TSX: `class` → `className`, `for` → `htmlFor`, self-close void tags. Do NOT copy `href` values such as `*.html`; the routes shown (e.g. `/about`) are final.
- Text content is verbatim. Do not rewrite, shorten or "improve" any string.
- **Illustration exception:** SVG illustrations (hero network map, article thumbnails) are artwork, not UI chrome; their literal fill/stroke colours may be kept exactly as in the reference, inside the named illustration component file only.

---

**Visual specification (embedded copy + layout):**

**Reference markup:**

##### Contributors & Core Team (long bios — verbatim)
```html
<section class="vv-section" id="contributors">
 <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
  <div class="max-w-3xl space-y-4">
   <span class="vv-eyebrow">Contributors & Core Team</span>
   <h2 class="vv-h2">The people behind the defense.</h2>
   <p class="vv-body max-w-2xl">Four disciplines, one floor. Every engagement is staffed by the people below — not subcontracted, not anonymised behind a logo.</p>
  </div>
  <div class="vv-team-grid">
   <article class="vv-team-card vv-reveal">
    <div class="vv-team-head">
     <div class="vv-team-avatar">
      <img src="<data-uri omitted/>" alt="Portrait of Amara Njoroge"/>
     </div>
     <div class="vv-team-id">
      <h3 class="vv-team-name">Amara Njoroge</h3>
      <p class="vv-team-role">Lead Offensive Security Engineer</p>
     </div>
    </div>
    <div class="vv-team-badges">
     <span class="vv-team-badge vv-team-badge--brand">OSCP</span>
     <span class="vv-team-badge vv-team-badge--brand">CRTO</span>
     <span class="vv-team-badge">9+ yrs</span>
     <span class="vv-team-badge vv-team-badge--dark">Nairobi, KE</span>
    </div>
    <p class="vv-team-bio">
     Leads VUNVAULT's red-team engagements across SACCOs, fintechs and M-Pesa gateway providers. Amara specialises in web application penetration testing, custom parameter fuzzing pipelines and zero-day research — the kind of work that finds the bug a scanner's signature list will never reach. She has disclosed seven responsibly-handled vulnerabilities in payment and identity platforms operating in East Africa, and runs the internal exploit-development review that every VUNVAULT finding passes through before it reaches a client report.
    </p>
    <div class="vv-team-skills">
     <span class="vv-team-skill">Web Pentesting</span>
     <span class="vv-team-skill">Parameter Fuzzing</span>
     <span class="vv-team-skill">Zero-Day Research</span>
     <span class="vv-team-skill">Burp Suite</span>
     <span class="vv-team-skill">API Security</span>
     <span class="vv-team-skill">Exploit Dev</span>
    </div>
    <div class="vv-team-foot">
     <span class="vv-team-meta">/team/amara-njoroge</span>
     <div class="vv-team-socials">
      <a class="social-link" href="https://github.com/vunvault" target="_blank" rel="noopener noreferrer" aria-label="Amara Njoroge on GitHub">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
      </a>
      <a class="social-link" href="https://www.linkedin.com/company/vunvault" target="_blank" rel="noopener noreferrer" aria-label="Amara Njoroge on LinkedIn">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
      </a>
     </div>
    </div>
   </article>
   [+3 more sibling <article> elements with the SAME structure as the one above; their text content in order: Daniel Mwangi ¦ Security Automation & Recon Architect ¦ Automation ¦ Recon ¦ 7+ yrs ¦ Remote · KE ¦ Builds the reconnaissance and validation engine underneath every VUNVAULT engagement. Daniel owns the multi-threaded SSL/TLS validation tooling, the endpoint-crawling pipeline that turns a single domain into a scored asset map, and the Python and Bash automation that keeps the whole stack reproducible. His rule is blunt: if a check cannot run unattended at 03:00 against a 4,000-host estate and return the same result twice, it does not ship. He also maintains the internal patch-validation CLI used to confirm remediation before we close an engagement. ¦ SSL/TLS Validation ¦ Endpoint Crawling ¦ Python ¦ Bash ¦ Multi-threading ¦ CI Automation ¦ /team/daniel-mwangi || Fatima Hassan ¦ Threat Intelligence Analyst ¦ Threat Intel ¦ OSINT ¦ 6+ yrs ¦ Mombasa · KE ¦ Owns the zero-day tracking feed and the attack-surface mapping methodology that opens every engagement. Fatima spends her week correlating NVD entries, vendor advisories and VUNVAULT sensor telemetry into a single exploitation-status view, and profiling how WAFs actually behave against the payloads we throw at them. Her briefings on ransomware playbooks targeting East African SACCOs are now read by security teams in four countries. She writes the weekly threat note that goes to every retainer client. ¦ Attack Surface Mapping ¦ WAF Analysis ¦ CVE Correlation ¦ MITRE ATT&CK ¦ OSINT ¦ Threat Briefings ¦ /team/fatima-hassan || Brian Otieno ¦ Compliance & Governance Lead ¦ ISO 27001 ¦ GDPR ¦ 10+ yrs ¦ Nairobi, KE ¦ Translates raw technical findings into the language regulators and boards actually use. Brian owns the Central Bank cybersecurity standards mapping, GDPR and Kenya Data Protection Act framework alignment, and the rules-of-engagement and non-disclosure agreements that govern every engagement VUNVAULT accepts. He also authors the Academy compliance curriculum and sits in on every scope call, because the fastest way to break a client is to test something nobody authorised you to touch. ¦ CBK Standards ¦ GDPR Mapping ¦ ISO 27001 ¦ NDAs & RoE ¦ Policy Design ¦ Curriculum ¦ /team/brian-otieno]
  </div>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
.social-link { display: inline-flex; align-items: center; justify-content: center; width: 42px; height: 42px; border-radius: var(--r-full); color: var(--ink-soft); background: #ffffff; border: 1px solid var(--line); box-shadow: 0 6px 16px -14px rgba(10, 13, 18, 0.6); transition: color 0.25s var(--ease), border-color 0.25s var(--ease), background-color 0.25s var(--ease), transform 0.25s var(--ease), box-shadow 0.25s var(--ease); }
.social-link svg { width: 18px; height: 18px; transition: transform 0.25s var(--ease); }
.social-link:hover,
.social-link:focus-visible { color: var(--brand); border-color: var(--brand); background: var(--brand-tint); transform: translateY(-3px); box-shadow: 0 14px 30px -16px var(--brand-glow); outline: none; }
.social-link:hover svg { transform: scale(1.1); }
.social-link:active { transform: translateY(-1px) scale(0.97); }
@media (max-width: 640px) {
.social-link { width: 40px; height: 40px; }
}
.vv-h2 { font-size: clamp(1.55rem, 3.4vw, 2.35rem); font-weight: 800; letter-spacing: -0.022em; line-height: 1.15; color: var(--ink); }
.vv-body { font-size: 0.86rem; line-height: 1.75; color: var(--ink-muted); }
.vv-section { padding-top: 3.6rem; padding-bottom: 3.6rem; border-top: 1px solid var(--line-soft); }
@media (max-width: 768px) {
.vv-section { padding-top: 2.6rem; padding-bottom: 2.6rem; }
}
.vv-eyebrow { display: inline-flex; align-items: center; gap: 10px; font-size: 10.5px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase; color: var(--brand-strong); }
.vv-eyebrow::before { content: ""; width: 24px; height: 2px; border-radius: 9999px; background: var(--brand); }
.vv-mv-card--dark .vv-body { color: #9aa8ba; }
.vv-team-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px; align-items: stretch; }
@media (max-width: 900px) {
.vv-team-grid { grid-template-columns: 1fr; gap: 16px; }
}
.vv-team-card { display: flex; flex-direction: column; padding: 26px 24px 24px; border-radius: 22px; background: #ffffff; border: 1px solid var(--line); transition: transform 0.28s var(--ease), border-color 0.28s var(--ease), box-shadow 0.28s var(--ease); }
.vv-team-card:hover { transform: translateY(-5px); border-color: var(--brand-line); box-shadow: 0 30px 58px -38px rgba(10, 13, 18, 0.5); }
.vv-team-head { display: flex; align-items: center; gap: 16px; min-width: 0; }
.vv-team-avatar { position: relative; flex: 0 0 auto; width: 76px; height: 76px; border-radius: 20px; overflow: hidden; background: radial-gradient(circle at 50% 30%, rgba(59, 153, 252, 0.22), transparent 70%), linear-gradient(160deg, var(--dark), #05070a); border: 1px solid rgba(59, 153, 252, 0.28); box-shadow: 0 14px 30px -20px rgba(10, 13, 18, 0.7); }
.vv-team-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.5s var(--ease); }
.vv-team-card:hover .vv-team-avatar img { transform: scale(1.07); }
.vv-team-id { min-width: 0; }
.vv-team-name { font-size: 1.02rem; font-weight: 800; letter-spacing: -0.012em; color: var(--ink); line-height: 1.3; }
.vv-team-role { margin-top: 5px; font-size: 0.68rem; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; color: var(--brand-strong); line-height: 1.5; }
.vv-team-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 16px; }
.vv-team-badge { padding: 4px 10px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.09em; text-transform: uppercase; border-radius: var(--r-full); color: var(--ink-muted); background: #f5f7fa; border: 1px solid var(--line); white-space: nowrap; }
.vv-team-badge--brand { color: var(--brand-strong); background: var(--brand-tint); border-color: var(--brand-line); }
.vv-team-badge--dark { color: #d6dde8; background: var(--dark); border-color: rgba(59, 153, 252, 0.3); }
.vv-team-bio { margin-top: 16px; font-size: 0.8rem; line-height: 1.78; color: var(--ink-muted); }
.vv-team-skills { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 16px; }
.vv-team-skill { padding: 5px 10px; font-size: 9.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-soft); background: #f5f7fa; border: 1px solid var(--line); border-radius: var(--r-full); transition: color 0.22s var(--ease), border-color 0.22s var(--ease), background-color 0.22s var(--ease); }
.vv-team-card:hover .vv-team-skill { color: var(--brand-strong); border-color: var(--brand-line); background: var(--brand-tint); }
.vv-team-foot { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: auto; padding-top: 18px; margin-top: 20px; border-top: 1px solid var(--line-soft); }
.vv-team-meta { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.06em; color: var(--ink-faint); }
.vv-team-socials { display: flex; align-items: center; gap: 8px; }
.vv-team-socials .social-link { width: 36px; height: 36px; }
.vv-team-socials .social-link svg { width: 16px; height: 16px; }
.vv-reveal { opacity: 0; transform: translateY(16px); transition: opacity 0.6s var(--ease), transform 0.6s var(--ease); }
.vv-reveal.is-in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
.vv-reveal { opacity: 1; transform: none; transition: none; }
}
```

##### System Telemetry (live panel; the alert rows are compressed — their text is listed in the bracketed note)
```html
<section class="vv-section" id="telemetry">
 <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
  <div class="max-w-3xl space-y-4">
   <span class="vv-eyebrow">System Telemetry</span>
   <h2 class="vv-h2">What our sensors are seeing right now.</h2>
   <p class="vv-body max-w-2xl">A live slice of the VUNVAULT sensor network — the same telemetry that feeds client dashboards and our weekly threat note.</p>
  </div>
  <div class="vv-telemetry vv-reveal">
   <div class="vv-telemetry-inner">
    <div class="vv-tel-head">
     <div class="flex items-center gap-3">
      <span class="vv-tel-title">VUNVAULT Sensor Network</span>
      <span class="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded-full">
       <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
       Live
      </span>
     </div>
     <span class="vv-tel-clock" id="vv-tel-clock">--:--:-- UTC</span>
    </div>
    <div class="vv-tel-metrics">
     <article class="vv-tel-metric">
      <div class="vv-tel-metric-label">Sensors Online</div>
      <div class="vv-tel-metric-value">
       412
       <span class="text-sm text-neutral-400 ml-0.5">/412</span>
      </div>
      <div class="vv-tel-metric-delta vv-tel-metric-delta--ok">All nodes nominal</div>
     </article>
     [+3 more sibling <article> elements with the SAME structure as the one above; their text content in order: Assets Monitored ¦ 1,284 ¦ ▲ 36 this week || Threats Blocked ¦ 12,904 ¦ Rolling 30-day window || Mean Time to Patch ¦ 1.2 ¦ s ¦ Automated validation]
    </div>
    <div class="vv-tel-split">
     <div class="vv-tel-panel">
      <div class="vv-tel-panel-head">
       <span class="vv-tel-panel-title">
        <span class="vv-pulse-dot" aria-hidden="true"></span>
        Real-Time Security Alerts
       </span>
       <span class="text-neutral-500 font-mono text-[10px]">
        auto-refresh ·
        <span id="vv-tel-countdown">8s</span>
       </span>
      </div>
      <div class="vv-tel-feed" id="vv-tel-feed" role="log" aria-live="polite" aria-label="Live security alerts">
       <article class="vv-tel-item">
        <div class="vv-tel-item-main">
         <div class="vv-tel-item-top">
          <span class="vv-tel-sev vv-tel-sev--crit">Critical</span>
          <span class="text-neutral-500 font-mono text-[10px]">CVE-2026-21447</span>
         </div>
         <div class="vv-tel-item-msg">Apache Struts 2 — OGNL injection RCE</div>
         <div class="vv-tel-item-sub">Web & API · CVSS 9.8 · 14:36:45 UTC</div>
        </div>
        <span class="vv-tel-state vv-tel-state--unpatched">Unpatched</span>
       </article>
       [+5 more sibling <article> elements with the SAME structure as the one above; their text content in order: Critical ¦ CVE-2026-0091 ¦ Cisco IOS XE — Web UI authentication bypass ¦ Network & Edge · CVSS 9.1 · 14:35:12 UTC ¦ In progress || High ¦ CVE-2026-3327 ¦ Oracle WebLogic — deserialization RCE ¦ Web & API · CVSS 8.8 · 14:32:01 UTC ¦ Unpatched || High ¦ CVE-2026-18820 ¦ Windows Print Spooler — privilege escalation ¦ Endpoint · CVSS 8.1 · 14:28:55 UTC ¦ Patched || Critical ¦ CVE-2025-53112 ¦ Google Chrome V8 — type confusion in JIT ¦ Endpoint · CVSS 9.6 · 14:25:11 UTC ¦ Patched || Medium ¦ CVE-2025-18820 ¦ SQL injection in unsanitised search parameter ¦ Web & API · CVSS 5.3 · 14:21:40 UTC ¦ Unpatched]
      </div>
     </div>
     <div class="vv-tel-panel">
      <div class="vv-tel-panel-head">
       <span class="vv-tel-panel-title">Status Counters</span>
      </div>
      <div class="vv-tel-counters">
       <div class="vv-tel-counter">
        <span class="vv-tel-counter-label">Active zero-days</span>
        <span class="vv-tel-counter-value">1,284</span>
       </div>
       [+4 more sibling <div> elements with the SAME structure as the one above; their text content in order: Weaponized in the wild ¦ 37 || Critical unpatched ¦ 46 || Patched (YTD) ¦ 37,910 || Client estates covered ¦ 96]
      </div>
      <div class="vv-tel-bar">
       <div class="vv-tel-bar-head">
        <span>Patch Coverage</span>
        <span class="font-mono">68%</span>
       </div>
       <div class="vv-tel-bar-track" role="progressbar" aria-label="Patch coverage">
        <span class="vv-tel-bar-fill"></span>
       </div>
      </div>
     </div>
    </div>
    <p class="pt-4 mt-4 border-t border-neutral-800 text-[10px] text-neutral-500 leading-relaxed">Refreshed continuously from NVD, vendor advisories and the VUNVAULT sensor network. Times shown in UTC. Telemetry is aggregated and contains no client-identifying data.</p>
   </div>
  </div>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
@media (max-width: 768px) {
}
.vv-telemetry { position: relative; overflow: hidden; border-radius: var(--r-2xl); padding: 30px; color: #ffffff; background: radial-gradient(110% 90% at 8% 0%, rgba(59, 153, 252, 0.18), transparent 55%), linear-gradient(160deg, var(--dark) 0%, #0c1119 52%, #05070a 100%); border: 1px solid rgba(59, 153, 252, 0.24); box-shadow: 0 40px 90px -46px rgba(0, 0, 0, 0.8); }
.vv-telemetry::before { content: ""; position: absolute; inset: 0; background-image: linear-gradient(to right, rgba(59, 153, 252, 0.09) 1px, transparent 1px), linear-gradient(to bottom, rgba(59, 153, 252, 0.09) 1px, transparent 1px); background-size: 48px 48px; -webkit-mask-image: radial-gradient(90% 80% at 50% 0%, #000 20%, transparent 80%); mask-image: radial-gradient(90% 80% at 50% 0%, #000 20%, transparent 80%); pointer-events: none; }
.vv-telemetry-inner { position: relative; z-index: 1; }
.vv-tel-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.09); }
.vv-tel-title { font-size: 0.72rem; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: #7d8b9e; }
.vv-tel-clock { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; color: var(--brand-soft); }
.vv-tel-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 22px; }
@media (max-width: 900px) {
.vv-tel-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 460px) {
.vv-tel-metrics { grid-template-columns: 1fr; }
}
.vv-tel-metric { padding: 16px 16px 14px; border-radius: 14px; background: rgba(255, 255, 255, 0.045); border: 1px solid rgba(255, 255, 255, 0.08); transition: border-color 0.25s var(--ease), background-color 0.25s var(--ease); }
.vv-tel-metric:hover { border-color: rgba(59, 153, 252, 0.42); background: rgba(59, 153, 252, 0.08); }
.vv-tel-metric-label { font-size: 9.5px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; color: #7d8b9e; }
.vv-tel-metric-value { margin-top: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: clamp(1.35rem, 2.6vw, 1.8rem); font-weight: 800; letter-spacing: -0.03em; line-height: 1; color: #ffffff; }
.vv-tel-metric-delta { margin-top: 8px; font-size: 10px; font-weight: 700; letter-spacing: 0.04em; color: #8b98a9; }
.vv-tel-metric-delta--ok { color: #34d399; }
.vv-tel-split { display: grid; grid-template-columns: 1.55fr 1fr; gap: 16px; margin-top: 20px; }
@media (max-width: 900px) {
.vv-tel-split { grid-template-columns: 1fr; }
}
.vv-tel-panel { padding: 18px; border-radius: 16px; background: rgba(0, 0, 0, 0.28); border: 1px solid rgba(59, 153, 252, 0.14); }
.vv-tel-panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.vv-tel-panel-title { display: inline-flex; align-items: center; gap: 8px; font-size: 10px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: #8d9aab; }
.vv-pulse-dot { width: 6px; height: 6px; border-radius: 50%; background: #fb7185; box-shadow: 0 0 0 0 rgba(251, 113, 133, 0.7); animation: vvPulse 1.8s var(--ease) infinite; }
.vv-tel-feed { display: flex; flex-direction: column; gap: 8px; max-height: 320px; overflow-y: auto; padding-right: 4px; }
.vv-tel-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 13px; border-radius: 12px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.07); transition: background-color 0.25s var(--ease), border-color 0.25s var(--ease); }
.vv-tel-item:hover { background: rgba(59, 153, 252, 0.09); border-color: rgba(59, 153, 252, 0.3); }
.vv-tel-item.is-flash { animation: vvFlash 1.2s var(--ease); }
.vv-tel-item-main { min-width: 0; }
.vv-tel-item-top { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.vv-tel-item-msg { margin-top: 5px; font-size: 11.5px; font-weight: 600; color: #dbe3ed; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vv-tel-item-sub { margin-top: 3px; font-size: 10px; color: #6b7a8d; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.vv-tel-sev { padding: 3px 8px; font-size: 9px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; border-radius: var(--r-full); border: 1px solid transparent; white-space: nowrap; }
.vv-tel-sev--crit { color: #fb7185; background: rgba(244, 63, 94, 0.12); border-color: rgba(244, 63, 94, 0.35); }
.vv-tel-state { font-size: 10px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; padding: 4px 10px; border-radius: var(--r-full); white-space: nowrap; }
.vv-tel-state--unpatched { color: #ffffff; background: rgba(244, 63, 94, 0.85); }
.vv-tel-counters { display: flex; flex-direction: column; gap: 12px; }
.vv-tel-counter { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 11.5px; padding-bottom: 11px; border-bottom: 1px solid rgba(255, 255, 255, 0.07); }
.vv-tel-counter:last-child { border-bottom: 0; padding-bottom: 0; }
.vv-tel-counter-label { color: #8d9aab; }
.vv-tel-counter-value { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 800; color: #ffffff; }
.vv-tel-bar { margin-top: 18px; }
.vv-tel-bar-head { display: flex; align-items: center; justify-content: space-between; font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #7d8b9e; margin-bottom: 8px; }
.vv-tel-bar-track { position: relative; height: 6px; border-radius: 9999px; background: rgba(255, 255, 255, 0.09); overflow: hidden; }
.vv-tel-bar-fill { position: absolute; inset: 0 auto 0 0; border-radius: 9999px; background: linear-gradient(90deg, var(--brand-strong), var(--brand-soft)); box-shadow: 0 0 14px var(--brand-glow); }
@media (prefers-reduced-motion: reduce) {
}
@keyframes vvPulse { 0% { box-shadow: 0 0 0 0 rgba(251, 113, 133, 0.6); } 70% { box-shadow: 0 0 0 9px rgba(251, 113, 133, 0); } 100% { box-shadow: 0 0 0 0 rgba(251, 113, 133, 0); } }
@keyframes vvFlash { 0% { background: rgba(59, 153, 252, 0.28); border-color: rgba(59, 153, 252, 0.6); } 100% { background: rgba(255, 255, 255, 0.04); border-color: rgba(255, 255, 255, 0.07); } }
```

**Behaviour:** the Telemetry panel reuses the clock/rotation pattern of the home widget (Task 50): `--:--:-- UTC` placeholder until mounted, then a ticking clock; its alert list (six rows; texts in the bracketed note above) rotates every 8 s exactly like Task 50 (last row moves to the top). Counters shown in the markup (Sensors Online `412 /412`, Assets Monitored `1,284 ▲ 36 this week`, Threats Blocked `12,904`, Mean Time to Patch `1.2 s`, `Client estates covered 96`, `Patch Coverage 68%`) are constants in `about-data.ts` with `// TODO(backend-contract)`. The team cards link to `/team/<slug>` in the prototype — those pages do not exist; render the name as plain text and omit the link. Avatars are initials tiles.

**Tests:** four team members with their credential chips; telemetry rotates after 8 s (fake timers) and cleans up timers on unmount; no anchor points to `/team/*`.

---

**Data shape (TypeScript):**
```ts
interface TeamMember { name: string; title: string; chips: string[]; location: string; bio: string; skills: string[] }
```

**API contract (as comments only — do NOT implement the backend):**
N/A — static content.

---

**Out of scope:**
- Do not create `/team/*` pages.
- Do not edit Task 53 components other than appending CSS.

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm --filter web dev` renders the route(s) in this task with no console errors, and `pnpm --filter web test` passes (a smoke test per new component renders it and asserts the key verbatim strings).
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 53b complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 54 — Services page A: hero, inline scanner CLI, core services

**Layer:** L6

**Prerequisites:** Task 48, Task 44

**Estimated files touched:** 8

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Services page A: hero, inline scanner CLI, core services**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the Services route with its hero, the inline scanner CLI (reusing the Task 48 simulation) and the Core Services section with the sticky service tabs.

**Deliverables:**
- `apps/web/src/app/(marketing)/services/page.tsx` — route; renders hero, CLI, core services, then `<ServicesPricing/>`, `<AcademyStrip/>`, `<RequestBand/>` imported from `./_components/*` (null stubs created here; Task 54b overwrites them).
- `apps/web/src/app/(marketing)/services/_components/services-hero.tsx`, `inline-cli.tsx`, `core-services.tsx`, `service-tabs.tsx`
- `apps/web/src/app/(marketing)/services/_components/services-pricing.tsx`, `academy-strip.tsx`, `request-band.tsx` — null stubs.
- `apps/web/src/app/(marketing)/services/_styles/services.css`
- `apps/web/src/app/(marketing)/services/services-a.test.tsx`

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
- **Feature stylesheet exception:** the reference CSS blocks below come from the prototype. Reproduce them in the task's own `.css` file (listed in Deliverables), replacing every value that has a token with `var(--token)`. A colour with NO token (for example a one-off dark gradient stop) may stay as a literal ONLY inside that `.css` file; never in TSX.
- Prefer the Tailwind classes shown in the reference markup. Where the markup uses a custom class (`vv-*`, `hero-*`, `adm-*` …) implement it from the CSS block that follows it.
- Replace every `<svg data-icon="REPLACE-WITH-LUCIDE"/>` with the closest `lucide-react` icon (keep size classes); replace every `<a href>` to an internal route with `next/link`.
- Convert the markup to TSX: `class` → `className`, `for` → `htmlFor`, self-close void tags. Do NOT copy `href` values such as `*.html`; the routes shown (e.g. `/about`) are final.
- Text content is verbatim. Do not rewrite, shorten or "improve" any string.
- **Illustration exception:** SVG illustrations (hero network map, article thumbnails) are artwork, not UI chrome; their literal fill/stroke colours may be kept exactly as in the reference, inside the named illustration component file only.

---

**Visual specification (embedded copy + layout):**

**Reference markup (footer variant `company`):**

##### Services hero
```html
<section class="vv-svc-hero">
 <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
  <span class="vv-kicker">Enterprise Security Solutions</span>
  <h1 class="text-4xl sm:text-5xl md:text-6xl font-extrabold text-neutral-900 tracking-tight leading-[1.1]">Application penetration testing, surface reconnaissance and proactive threat mitigation.</h1>
  <p class="vv-section-lede max-w-3xl mx-auto">
   VUNVAULT combines manual, human-led penetration testing with continuous automated attack-surface reconnaissance. Every engagement is delivered under a mutual NDA, mapped to the compliance frameworks your regulator actually audits against, and handed back with remediation steps your engineers can ship.
  </p>
  <div class="flex flex-wrap items-center justify-center gap-3 pt-3">
   <a href="/contact" class="btn-get-started">Request Assessment</a>
   <a href="#free-tools" class="inline-flex items-center gap-2 px-6 py-4 text-sm font-bold text-neutral-900 bg-white border border-neutral-200 rounded-full hover:border-neutral-400 transition-colors">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Try the free OSINT tools</span>
   </a>
  </div>
  <div class="pt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">
   <span>NDA-backed</span>
   <span class="w-1 h-1 rounded-full bg-neutral-300"></span>
   <span>OWASP-aligned</span>
   <span class="w-1 h-1 rounded-full bg-neutral-300"></span>
   <span>Central Bank ready</span>
   <span class="w-1 h-1 rounded-full bg-neutral-300"></span>
   <span>Africa-rooted · Worldwide</span>
  </div>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
.btn-get-started { display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 16px 42px; font-size: 0.95rem; font-weight: 700; letter-spacing: 0.02em; color: #ffffff; background: linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%); border-radius: var(--r-full); border: 1px solid rgba(59, 153, 252, 0.5); box-shadow: 0 14px 34px -14px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.25); transition: transform 0.25s var(--ease), box-shadow 0.25s var(--ease), filter 0.25s var(--ease); }
.btn-get-started::after { content: "→"; font-size: 1rem; transition: transform 0.25s var(--ease); }
.btn-get-started:hover { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 20px 44px -16px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.3); }
.btn-get-started:hover::after { transform: translateX(4px); }
.btn-get-started:active { transform: translateY(0) scale(0.98); }
@media (max-width: 768px) {
.btn-get-started { padding: 15px 34px; font-size: 0.9rem; }
}
.vv-svc-hero { position: relative; overflow: hidden; padding: 3.5rem 0 2.5rem; background: radial-gradient(90% 80% at 50% -10%, rgba(59, 153, 252, 0.10), transparent 62%), var(--paper); }
.vv-svc-hero::after { content: ""; position: absolute; inset: 0; background-image: linear-gradient(to right, rgba(59, 153, 252, 0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(59, 153, 252, 0.07) 1px, transparent 1px); background-size: 54px 54px; -webkit-mask-image: radial-gradient(70% 60% at 50% 0%, #000 0%, transparent 76%); mask-image: radial-gradient(70% 60% at 50% 0%, #000 0%, transparent 76%); pointer-events: none; }
.vv-svc-hero > * { position: relative; z-index: 1; }
.vv-kicker { display: inline-block; padding: 6px 15px; font-size: 10px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); border-radius: 9999px; }
.vv-section-lede { font-size: 0.95rem; line-height: 1.75; color: var(--ink-muted); }
```

##### Free tools / inline scanner CLI
```html
<section id="free-tools" class="vv-cli-section">
 <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
  <div class="text-center max-w-2xl mx-auto space-y-3">
   <span class="vv-kicker">Free Security Tools</span>
   <h2 class="vv-section-title">Run OSINT reconnaissance from your browser</h2>
   <p class="vv-section-lede">Three free lookups powered by the same enumeration engine behind our paid assessments. No account, no commitment, nothing stored.</p>
  </div>
  <div class="vv-cli-shell">
   <div class="vv-cli-titlebar">
    <div class="vv-cli-dots" aria-hidden="true">
     <span class="vv-cli-dot vv-cli-dot--r"></span>
     <span class="vv-cli-dot vv-cli-dot--y"></span>
     <span class="vv-cli-dot vv-cli-dot--g"></span>
    </div>
    <div class="vv-cli-title">vunvault-cli v2.4.0 — osint --interactive</div>
    <div class="vv-cli-status">
     <span class="vv-cli-status-dot" aria-hidden="true"></span>
     <span>IDLE</span>
    </div>
   </div>
   <div class="vv-cli-tabs" role="tablist" aria-label="Free OSINT tools">
    <button type="button" class="vv-cli-tab is-active" role="tab" aria-selected="true">1 · IP / Reverse Lookup</button>
    <button type="button" class="vv-cli-tab" role="tab" aria-selected="false">2 · DNS Record Tracer</button>
    <button type="button" class="vv-cli-tab" role="tab" aria-selected="false">3 · IMEI / Device Registry</button>
   </div>
   <div class="vv-cli-body">
    <p class="vv-cli-hint">Resolves reverse DNS, WHOIS ownership and geolocation for a domain or IPv4 address.</p>
    <form class="vv-cli-form">
     <label class="sr-only" for="vv-cli-target">Target value for the selected tool</label>
     <div class="vv-cli-input-wrap">
      <span class="vv-cli-prompt" aria-hidden="true">$</span>
      <input id="vv-cli-target" class="vv-cli-input" type="text" name="target" placeholder="example.com   or   203.0.113.42" autocomplete="off"/>
     </div>
     <button type="submit" class="vv-cli-execute">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      <span>Execute Scan</span>
     </button>
     <button type="button" class="vv-cli-clear">Clear</button>
    </form>
    <div class="vv-cli-chips">
     <span class="vv-cli-chips-label">Try:</span>
     <span></span>
    </div>
    <div class="vv-cli-screen" role="log" aria-live="polite" aria-label="Terminal output"></div>
    <div class="vv-cli-meter" role="progressbar" aria-label="Lookup progress">
     <span></span>
    </div>
    <p class="vv-cli-footnote">Simulated reconnaissance for demonstration purposes. Never query systems, addresses or device identifiers you do not own or have written authorisation to investigate.</p>
   </div>
  </div>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
.vv-cli-section { padding: 3.5rem 0; background: var(--paper); border-top: 1px solid var(--line-soft); }
.vv-cli-shell { border-radius: 20px; overflow: hidden; background: #0b0f16; border: 1px solid rgba(59, 153, 252, 0.28); box-shadow: 0 40px 90px -50px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.03) inset; }
.vv-cli-titlebar { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 14px; padding: 11px 14px; background: linear-gradient(180deg, #151b25, #10151d); border-bottom: 1px solid rgba(59, 153, 252, 0.18); }
.vv-cli-dots { display: flex; align-items: center; gap: 8px; }
.vv-cli-dot { width: 11px; height: 11px; border-radius: 50%; border: 1px solid rgba(0, 0, 0, 0.25); }
.vv-cli-dot--r { background: #ff5f57; }
.vv-cli-dot--y { background: #febc2e; }
.vv-cli-dot--g { background: #28c840; }
.vv-cli-title { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11.5px; letter-spacing: 0.02em; color: #8d9aab; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.vv-cli-status { display: inline-flex; align-items: center; gap: 7px; padding: 5px 12px; border-radius: 9999px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10px; font-weight: 800; letter-spacing: 0.14em; border: 1px solid transparent; white-space: nowrap; }
.vv-cli-status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.vv-cli-status[data-state="idle"] { color: #94a3b8; background: rgba(148, 163, 184, 0.1); border-color: rgba(148, 163, 184, 0.3); }
.vv-cli-status[data-state="running"] { color: #7dd3fc; background: rgba(59, 153, 252, 0.12); border-color: rgba(59, 153, 252, 0.42); }
.vv-cli-status[data-state="running"] .vv-cli-status-dot { animation: pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
.vv-cli-status[data-state="done"] { color: #34d399; background: rgba(16, 185, 129, 0.12); border-color: rgba(16, 185, 129, 0.42); }
.vv-cli-tabs { display: flex; flex-wrap: wrap; gap: 8px; padding: 14px 18px 0; }
.vv-cli-tab { padding: 9px 16px; font-size: 11.5px; font-weight: 700; letter-spacing: 0.01em; color: #8d9aab; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.09); border-radius: 9999px; transition: color 0.2s var(--ease), border-color 0.2s var(--ease), background-color 0.2s var(--ease); }
.vv-cli-tab:hover { color: #e2e8f0; border-color: rgba(59, 153, 252, 0.4); background: rgba(59, 153, 252, 0.1); }
.vv-cli-tab.is-active { color: #04121f; background: linear-gradient(135deg, var(--brand-soft), var(--brand)); border-color: transparent; box-shadow: 0 10px 24px -14px var(--brand-glow); }
.vv-cli-body { display: flex; flex-direction: column; gap: 14px; padding: 18px; }
.vv-cli-hint { font-size: 11.5px; line-height: 1.65; color: #7d8b9e; }
.vv-cli-form { display: flex; flex-wrap: wrap; gap: 10px; }
.vv-cli-input-wrap { position: relative; display: flex; align-items: center; flex: 1 1 260px; min-width: 0; }
.vv-cli-prompt { position: absolute; left: 14px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; font-weight: 700; color: var(--brand); pointer-events: none; }
.vv-cli-input { width: 100%; padding: 13px 14px 13px 34px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; color: #e2e8f0; background: #070b11; border: 1px solid rgba(59, 153, 252, 0.24); border-radius: 10px; outline: none; transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease); }
.vv-cli-input::placeholder { color: #55637a; }
.vv-cli-input:focus,
      .vv-cli-input:focus-visible { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(59, 153, 252, 0.18); }
.vv-cli-input.is-invalid { border-color: var(--critical); box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.18); animation: vvCliShake 0.32s var(--ease); }
.vv-cli-execute { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 9px; padding: 13px 22px; font-size: 12.5px; font-weight: 800; color: #04121f; background: linear-gradient(135deg, var(--brand-soft), var(--brand)); border-radius: 10px; transition: transform 0.2s var(--ease), filter 0.2s var(--ease), opacity 0.2s var(--ease); }
.vv-cli-execute:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.06); }
.vv-cli-execute:disabled { opacity: 0.55; cursor: not-allowed; }
.vv-cli-clear { flex: 0 0 auto; padding: 13px 18px; font-size: 12.5px; font-weight: 700; color: #93a2b5; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; transition: color 0.2s var(--ease), border-color 0.2s var(--ease), background-color 0.2s var(--ease); }
.vv-cli-clear:hover { color: #e2e8f0; border-color: rgba(59, 153, 252, 0.4); background: rgba(59, 153, 252, 0.1); }
.vv-cli-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.vv-cli-chips-label { font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #55637a; }
.vv-cli-screen { height: 300px; overflow-y: auto; padding: 16px 18px; border-radius: 12px; background: radial-gradient(120% 100% at 0% 0%, rgba(59, 153, 252, 0.07), transparent 60%), #05080d; border: 1px solid rgba(59, 153, 252, 0.16); font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; line-height: 1.85; scroll-behavior: smooth; scrollbar-width: thin; scrollbar-color: rgba(59, 153, 252, 0.35) transparent; }
.vv-cli-screen::-webkit-scrollbar { width: 8px; }
.vv-cli-screen::-webkit-scrollbar-track { background: transparent; }
.vv-cli-screen::-webkit-scrollbar-thumb { background: rgba(59, 153, 252, 0.28); border-radius: 9999px; border: 2px solid transparent; background-clip: padding-box; }
.vv-cli-screen::-webkit-scrollbar-thumb:hover { background: rgba(59, 153, 252, 0.6); background-clip: padding-box; }
.vv-cli-meter { height: 3px; width: 100%; border-radius: 9999px; background: rgba(255, 255, 255, 0.07); overflow: hidden; }
.vv-cli-meter > span { display: block; height: 100%; width: 0; border-radius: 9999px; background: linear-gradient(90deg, var(--brand-strong), var(--brand-soft)); transition: width 0.3s var(--ease); }
.vv-cli-footnote { font-size: 10.5px; line-height: 1.65; color: #55637a; }
.vv-section-title { font-size: clamp(1.6rem, 3.4vw, 2.5rem); font-weight: 800; letter-spacing: -0.025em; line-height: 1.15; color: var(--ink); }
@media (max-width: 768px) {
.vv-cli-screen { height: 240px; font-size: 11px; }
.vv-cli-title { display: none; }
.vv-cli-titlebar { grid-template-columns: auto 1fr; }
.vv-cli-status { justify-self: end; }
.vv-cli-execute,
        .vv-cli-clear { flex: 1 1 auto; justify-content: center; }
.vv-cli-body { padding: 14px; gap: 12px; }
}
@keyframes vvCliShake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
```

##### Core services
```html
<section id="core-services" class="vv-svc-section">
 <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
  <div class="text-center max-w-2xl mx-auto space-y-3">
   <span class="vv-kicker">Core Security Services</span>
   <h2 class="vv-section-title">Everything we test, and why it matters</h2>
   <p class="vv-section-lede">Each engagement is scoped, executed and reported by a named lead analyst — never a fully automated scan dressed up as an assessment.</p>
  </div>
  <div class="vv-svc-grid">
   <article class="vv-svc-card">
    <span class="vv-svc-icon" aria-hidden="true">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
    </span>
    <h3 class="vv-svc-title">Web Application Penetration Testing</h3>
    <p class="vv-svc-text">
     Manual testing across the OWASP Top 10 — injection, authentication and session flaws, broken access control, SSRF and insecure deserialisation — plus targeted parameter fuzzing and business-logic abuse that scanners never reach.
    </p>
    <div class="vv-svc-tags">
     <span class="vv-skill">OWASP Top 10</span>
     <span class="vv-skill">Parameter Fuzzing</span>
     <span class="vv-skill">Broken Access Control</span>
    </div>
   </article>
   [+5 more sibling <article> elements with the SAME structure as the one above; their text content in order: Attack Surface Reconnaissance ¦ Subdomain enumeration, certificate-transparency mining, SSL/TLS certificate tracing and service fingerprinting — surfacing the shadow IT, forgotten staging hosts and unmanaged APIs that quietly widen your perimeter. ¦ Subdomain Enumeration ¦ CT Logs ¦ Shadow IT || WAF & Defense Verification ¦ We attack your defences the way an adversary would: rule-evasion encoding, rate-limit and anti-automation validation, payload stress testing and bypass chains that prove whether your WAF, CDN or bot-management layer actually blocks what it claims to. ¦ Rule Evasion ¦ Rate Limiting ¦ Payload Stress || IT & Network Troubleshooting ¦ When something is broken and nobody can explain why: DNS diagnostics, record-consistency audits, connectivity tracing, MTU and routing faults, firewall rule review and misconfiguration hunting across hybrid estates. ¦ DNS Diagnostics ¦ Connectivity ¦ Firewall Checks || Cloud & Mobile Security ¦ API gateway configuration reviews, cloud IAM and storage exposure checks, mobile application testing (Android & iOS) and dedicated M-Pesa / fintech integration audits covering callback validation, replay protection and settlement integrity. ¦ API Gateway ¦ M-Pesa / Fintech ¦ Mobile App Tests || Compliance & Reporting ¦ Executive briefing decks for the board, developer-ready technical remediation guides for the engineering team, and audit evidence packs mapped to GDPR, ISO 27001, ODPC and Central Bank supervisory requirements. ¦ Executive Briefing ¦ Remediation Guide ¦ Audit Evidence]
  </div>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
.vv-skill { padding: 5px 10px; font-size: 9.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-soft); background: #f5f7fa; border: 1px solid var(--line); border-radius: var(--r-full); }
.vv-svc-section { padding: 3.5rem 0; background: var(--paper); border-top: 1px solid var(--line-soft); }
.vv-svc-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px; }
.vv-svc-card { display: flex; flex-direction: column; padding: 26px 24px 24px; border-radius: 20px; background: #ffffff; border: 1px solid var(--line); transition: transform 0.28s var(--ease), border-color 0.28s var(--ease), box-shadow 0.28s var(--ease); }
.vv-svc-card:hover { transform: translateY(-5px); border-color: var(--brand-line); box-shadow: 0 28px 56px -36px rgba(10, 13, 18, 0.5); }
.vv-svc-icon { display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 14px; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); margin-bottom: 18px; }
.vv-svc-title { font-size: 1.02rem; font-weight: 800; letter-spacing: -0.01em; line-height: 1.4; color: var(--ink); }
.vv-svc-text { margin-top: 9px; font-size: 0.78rem; line-height: 1.72; color: var(--ink-muted); }
.vv-svc-tags { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--line-soft); }
@media (max-width: 980px) {
.vv-svc-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 640px) {
.vv-svc-grid { grid-template-columns: 1fr; gap: 16px; }
}
```

**Behaviour:** the inline CLI uses `useScanSimulation` from Task 48 (same validation and the same 19-step script; output renders inside this section's terminal window; form buttons `Execute Scan` / `Clear` and the suggestion chips as in the markup). The service tabs: sticky row, `is-active` follows scroll position (IntersectionObserver over the section ids) and tab click smooth-scrolls (instant under reduced motion). Page metadata title: `Services — VUNVAULT`.

Reference JS for tab/scroll behaviour (port only what the markup needs):
```js
(function () {
 "use strict";
 var shell = document.querySelector(".vv-cli-shell");
 if (!shell) return;
 var tabs = Array.prototype.slice.call(document.querySelectorAll("[data-cli-tool]"));
 var form = shell.querySelector("[data-cli-form]");
 var input = shell.querySelector("[data-cli-input]");
 var executeBtn = shell.querySelector("[data-cli-execute]");
 var clearBtn = shell.querySelector("[data-cli-clear]");
 var screen = shell.querySelector("[data-cli-screen]");
 var meter = shell.querySelector("[data-cli-meter]");
 var meterWrap = shell.querySelector(".vv-cli-meter");
 var status = shell.querySelector("[data-cli-status]");
 var statusText = shell.querySelector("[data-cli-status-text]");
 var hintEl = shell.querySelector("[data-cli-hint]");
 var chipsHost = shell.querySelector("[data-cli-chips]");
 var timer = null;
 var activeTool = "ip";
 function hash(str) {
 var h = 2166136261;
 for (var i = 0; i < str.length; i++) {
 h ^= str.charCodeAt(i);
 h = (h * 16777619) >>> 0;
 }
 return h;
 }
 function octet(seed, shift) {
 return (seed >>> shift) % 254 + 1;
 }
 function luhnValid(digits) {
 var sum = 0, alt = false;
 for (var i = digits.length - 1; i >= 0; i--) {
 var n = parseInt(digits.charAt(i), 10);
 if (alt) { n *= 2; if (n > 9) n -= 9; }
 sum += n;
 alt = !alt;
 }
 return sum % 10 === 0;
 }
 var TOOLS = {
 ip: {
 placeholder: "example.com or 203.0.113.42",
 hint: "Resolves reverse DNS, WHOIS ownership and geolocation for a domain or IPv4 address.",
 chips: ["example.com", "203.0.113.42", "api.vunvault.com"],
 validate: function (v) {
 return /^(?:(?:\d{1,3}\.){3}\d{1,3}|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,})$/.test(v);
 },
 invalid: "Enter a valid domain (example.com) or IPv4 address.",
 build: function (t) {
 var h = hash(t);
 var ip = octet(h, 8) + "." + octet(h, 16) + "." + octet(h, 4) + "." + (h % 200 + 12);
 var ptr = "host-" + (h % 900 + 100) + ".edge-" + (h % 40 + 1) + ".net";
 var asn = "AS" + (30000 + (h % 20000));
 var cities = ["Nairobi, Kenya", "Lagos, Nigeria", "Accra, Ghana", "Cape Town, South Africa", "Frankfurt, Germany"];
 var isps = ["Safaricom Business", "Liquid Intelligent Technologies", "MTN Business", "Jamii Telecom", "Amazon AWS"];
 return [
 { kind: "sys", msg: "vunvault-cli v2.4.0 — module: osint.reverse" },
 { kind: "muted", msg: "$ vvscan reverse --target " + t },
 { kind: "info", msg: "[*] QUERYING REGISTRY: reverse DNS (PTR) ..." },
 { kind: "ok", msg: "[+] SUCCESS — PTR record resolved" },
 { kind: "muted", msg: " ptr → " + ptr },
 { kind: "info", msg: "[*] QUERYING REGISTRY: WHOIS ..." },
 { kind: "ok", msg: "[+] SUCCESS — allocation block found" },
 { kind: "muted", msg: " net → " + ip + "/24" },
 { kind: "muted", msg: " org → Example Holdings Ltd · Country: KE" },
 { kind: "info", msg: "[*] QUERYING REGISTRY: geolocation + ASN ..." },
 { kind: "ok", msg: "[+] SUCCESS — " + cities[h % cities.length] },
 { kind: "muted", msg: " asn → " + asn + " · ISP: " + isps[h % isps.length] },
 { kind: "info", msg: "[*] Cross-referencing 42 threat-intelligence blocklists ..." },
 { kind: "ok", msg: "[+] 0 / 42 feeds returned a hit" },
 { kind: "sys", msg: "RESULT: " + t + " resolves cleanly — no blacklist entries, no abuse reports." }
 ];
 }
 },
 dns: {
 placeholder: "example.com",
 hint: "Checks A, AAAA, MX, TXT and NS records against global registries and flags policy weaknesses.",
 chips: ["example.com", "vunvault.com", "mail.example.com"],
 validate: function (v) {
 return /^(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(v);
 },
 invalid: "Enter a valid hostname (example.com).",
 build: function (t) {
 var h = hash(t);
 var a = octet(h, 8) + "." + octet(h, 16) + "." + octet(h, 4) + "." + (h % 200 + 12);
 var ns = (h % 2 === 0) ? "ns1" : "dns1";
 var mx = 10 + (h % 10);
 return [
 { kind: "sys", msg: "vunvault-cli v2.4.0 — module: osint.dns" },
 { kind: "muted", msg: "$ vvscan dns --host " + t + " --types A,AAAA,MX,TXT,NS" },
 { kind: "info", msg: "[*] Locating authoritative nameservers ..." },
 { kind: "ok", msg: "[+] SOA answered by " + ns + ".registrar.net" },
 { kind: "info", msg: "[*] QUERYING REGISTRY: A record ..." },
 { kind: "ok", msg: "[+] A → " + a + " (TTL 300)" },
 { kind: "info", msg: "[*] QUERYING REGISTRY: AAAA record ..." },
 { kind: "ok", msg: "[+] AAAA → 2001:db8::" + (h % 9000 + 1000).toString(16) + " (TTL 300)" },
 { kind: "info", msg: "[*] QUERYING REGISTRY: MX records ..." },
 { kind: "ok", msg: "[+] MX → " + mx + " mail." + t + " (TTL 3600)" },
 { kind: "info", msg: "[*] QUERYI
/* …truncated by planner… */
```

**Tests:** hero and three core-service blocks render; the CLI rejects an invalid target with the exact message and completes a valid scan with fake timers; tab click sets `is-active`.

---

**Data shape (TypeScript):**
```ts
interface ServiceTab { id: string; label: string }
```

**API contract (as comments only — do NOT implement the backend):**
N/A — static content.

---

**Out of scope:**
- Do not perform real scans.
- Do not duplicate the scan engine.
- Do not build pricing/academy/request sections (Task 54b).

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm --filter web dev` renders the route(s) in this task with no console errors, and `pnpm --filter web test` passes (a smoke test per new component renders it and asserts the key verbatim strings).
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 54 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 54b — Services page B: detailed pricing, academy strip, request-assessment band

**Layer:** L6

**Prerequisites:** Task 51, Task 54

**Estimated files touched:** 6

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Services page B: detailed pricing, academy strip, request-assessment band**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the lower Services sections, replacing the three stubs from Task 54.

**Deliverables:**
- `apps/web/src/app/(marketing)/services/_components/services-pricing.tsx`, `academy-strip.tsx`, `request-band.tsx` — overwrite the stubs.
- MODIFY `apps/web/src/app/(marketing)/services/_styles/services.css` — append.
- `apps/web/src/app/(marketing)/services/services-b.test.tsx`

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
- **Feature stylesheet exception:** the reference CSS blocks below come from the prototype. Reproduce them in the task's own `.css` file (listed in Deliverables), replacing every value that has a token with `var(--token)`. A colour with NO token (for example a one-off dark gradient stop) may stay as a literal ONLY inside that `.css` file; never in TSX.
- Prefer the Tailwind classes shown in the reference markup. Where the markup uses a custom class (`vv-*`, `hero-*`, `adm-*` …) implement it from the CSS block that follows it.
- Replace every `<svg data-icon="REPLACE-WITH-LUCIDE"/>` with the closest `lucide-react` icon (keep size classes); replace every `<a href>` to an internal route with `next/link`.
- Convert the markup to TSX: `class` → `className`, `for` → `htmlFor`, self-close void tags. Do NOT copy `href` values such as `*.html`; the routes shown (e.g. `/about`) are final.
- Text content is verbatim. Do not rewrite, shorten or "improve" any string.
- **Illustration exception:** SVG illustrations (hero network map, article thumbnails) are artwork, not UI chrome; their literal fill/stroke colours may be kept exactly as in the reference, inside the named illustration component file only.

---

**Visual specification (embedded copy + layout):**

**Reference markup:**

##### Pricing (Services variant — more detail than the home version)
```html
<section id="pricing" class="py-14 md:py-20 bg-paper border-t border-neutral-200/80">
 <span id="services-plans" class="anchor-offset" aria-hidden="true"></span>
 <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
  <div class="text-center max-w-2xl mx-auto space-y-3">
   <span class="vv-kicker">Plans & Pricing</span>
   <h2 class="vv-section-title">Transparent scope. Transparent pricing.</h2>
   <p class="vv-section-lede">Every tier below lists exactly what is tested, what you receive and how long it takes. No hidden line items, no vague "from" pricing.</p>
  </div>
  <div class="vv-price-grid">
   <article class="vv-plan">
    <header class="vv-plan-head">
     <h3 class="vv-plan-name">Starter Security Audit</h3>
     <span class="vv-plan-tag">Entry</span>
    </header>
    <div class="vv-plan-price">
     <span class="vv-plan-amount">$249</span>
     <span class="vv-plan-period">/ scan</span>
    </div>
    <p class="vv-plan-desc">For a single web application, micro-site or lightweight API endpoint that needs a fast, honest read on its exposure.</p>
    <div class="vv-plan-scope">
     <span class="vv-plan-scope-label">Scope & deliverables</span>
     <ul class="vv-plan-list vv-plan-list--tight">
      <li>
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       <span>Automated vulnerability scan covering the OWASP Top 10</span>
      </li>
      [+5 more sibling <li> elements with the SAME structure as the one above; their text content in order: Up to 20 endpoints / parameter routes analysed || Standard SSL/TLS and HTTP header misconfiguration checks || Automated PDF report with risk severity ratings (Critical → Low) || Remediation checklist with 7-day email support || 3-day turnaround time]
     </ul>
    </div>
    <p class="vv-plan-meta">Not included: manual exploitation, business-logic testing, re-tests.</p>
    <a href="/contact" class="vv-plan-cta">
     <span>Start with Starter</span>
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
    </a>
   </article>
   <article class="vv-plan vv-plan--featured">
    <header class="vv-plan-head">
     <h3 class="vv-plan-name">Advanced Vulnerability Assessment</h3>
     <span class="vv-plan-tag">Most Popular</span>
    </header>
    <div class="vv-plan-price">
     <span class="vv-plan-amount">$299</span>
     <span class="vv-plan-period">/ scan</span>
    </div>
    <p class="vv-plan-desc">For growing SaaS platforms, e-commerce storefronts and active Web APIs where automated scanning alone leaves real risk on the table.</p>
    <div class="vv-plan-scope">
     <span class="vv-plan-scope-label">Everything in Starter ($249), plus</span>
     <ul class="vv-plan-list vv-plan-list--tight">
      <li>
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       <span>Manual parameter discovery and basic business-logic flaw testing</span>
      </li>
      [+5 more sibling <li> elements with the SAME structure as the one above; their text content in order: Up to 50 endpoints / API routes analysed || WAF behaviour analysis & rate-limiting validation || Proof-of-Concept (PoC) exploit code for every confirmed vulnerability || 1 free re-test verification within 30 days || 5-day turnaround with dedicated analyst communication]
     </ul>
    </div>
    <p class="vv-plan-meta">Best value for teams that need evidence, not just a severity list.</p>
    <a href="/contact" class="vv-plan-cta">
     <span>Choose Advanced</span>
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
    </a>
   </article>
   <article class="vv-plan">
    <header class="vv-plan-head">
     <h3 class="vv-plan-name">Full-Scope Pen Test & Compliance Ready</h3>
     <span class="vv-plan-tag">Regulated</span>
    </header>
    <div class="vv-plan-price">
     <span class="vv-plan-amount">$1,499</span>
     <span class="vv-plan-period">/ project</span>
    </div>
    <p class="vv-plan-desc">For enterprise applications, fintech and M-Pesa integrations, and SACCO platforms that need regulatory sign-off before go-live.</p>
    <div class="vv-plan-scope">
     <span class="vv-plan-scope-label">Scope & deliverables</span>
     <ul class="vv-plan-list vv-plan-list--tight">
      <li>
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       <span>Deep black-box & gray-box manual penetration testing</span>
      </li>
      [+5 more sibling <li> elements with the SAME structure as the one above; their text content in order: Unlimited endpoint coverage within the defined target domain || Authentication bypass, privilege escalation and session-handling testing || Executive briefing PDF + developer-focused technical remediation guide || Full NDA, GDPR and Central Bank / regulatory compliance documentation || 2 free re-tests within 60 days]
     </ul>
    </div>
    <p class="vv-plan-meta">Includes scoping call, rules-of-engagement document and named lead analyst.</p>
    <a href="/contact" class="vv-plan-cta">
     <span>Scope a Pen Test</span>
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
    </a>
   </article>
   <article class="vv-plan">
    <header class="vv-plan-head">
     <h3 class="vv-plan-name">Enterprise Security Retainer</h3>
     <span class="vv-plan-tag">Custom</span>
    </header>
    <div class="vv-plan-price">
     <span class="vv-plan-amount">Custom</span>
     <span class="vv-plan-period">/ annual</span>
    </div>
    <p class="vv-plan-desc">For multi-domain infrastructure that needs continuous threat monitoring rather than a point-in-time report.</p>
    <div class="vv-plan-scope">
     <span class="vv-plan-scope-label">Scope & deliverables</span>
     <ul class="vv-plan-list vv-plan-list--tight">
      <li>
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       <span>Continuous 24/7 attack-surface monitoring & alerting</span>
      </li>
      [+5 more sibling <li> elements with the SAME structure as the one above; their text content in order: Quarterly penetration tests across all in-scope domains || Custom API and integration security audits || Dedicated security architect embedded with your team || Incident-response escalation with defined SLA guarantees || Board-ready quarterly risk reporting]
     </ul>
    </div>
    <p class="vv-plan-meta">Pricing is derived from asset count, domain footprint and required response SLA.</p>
    <a href="/contact" class="vv-plan-cta">
     <span>Talk to an Architect</span>
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
    </a>
   </article>
  </div>
  <p class="vv-price-note">
   All tiers include encrypted report delivery, a named engagement lead and a rules-of-engagement document signed under mutual NDA. Prices exclude applicable taxes. Re-test windows are measured from the date the final report is delivered.
  </p>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
@media (prefers-reduced-motion: reduce) {
.vv-article-card,
.vv-track,
.vv-plan,
.vv-seg-card,
.contributor-card,
.glass-card { max-width: 100%; min-width: 0; }
}
.vv-plan { display: flex; flex-direction: column; padding: 26px 24px; border-radius: 18px; background: #ffffff; border: 1px solid var(--line); transition: transform 0.25s var(--ease), border-color 0.25s var(--ease), box-shadow 0.25s var(--ease); }
.vv-plan:hover { transform: translateY(-3px); border-color: var(--brand-line); box-shadow: 0 20px 44px -32px rgba(10, 13, 18, 0.45); }
.vv-plan--featured { background: linear-gradient(160deg, var(--dark), #05070a); border-color: rgba(59, 153, 252, 0.45); }
.vv-plan-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 16px; }
.vv-plan-name { font-size: 0.8rem; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; color: var(--ink); line-height: 1.35; }
.vv-plan--featured .vv-plan-name { color: #ffffff; }
.vv-plan-tag { flex: 0 0 auto; padding: 4px 10px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; border-radius: var(--r-full); color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); white-space: nowrap; }
.vv-plan--featured .vv-plan-tag { color: var(--brand-soft); background: rgba(59, 153, 252, 0.14); border-color: rgba(59, 153, 252, 0.35); }
.vv-plan-price { display: flex; align-items: baseline; gap: 6px; }
.vv-plan-amount { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 2.35rem; font-weight: 800; letter-spacing: -0.03em; line-height: 1; color: var(--ink); }
.vv-plan--featured .vv-plan-amount { color: #ffffff; }
.vv-plan-period { font-size: 0.72rem; font-weight: 600; color: var(--ink-muted); }
.vv-plan--featured .vv-plan-period { color: #93a2b5; }
.vv-plan-desc { margin-top: 12px; font-size: 0.78rem; line-height: 1.65; color: var(--ink-muted); }
.vv-plan--featured .vv-plan-desc { color: #9aa8ba; }
.vv-plan-list { flex: 1 1 auto; display: flex; flex-direction: column; gap: 10px; margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--line-soft); }
.vv-plan--featured .vv-plan-list { border-top-color: rgba(255, 255, 255, 0.1); }
.vv-plan-list li { display: flex; align-items: flex-start; gap: 9px; font-size: 0.76rem; line-height: 1.55; color: var(--ink-soft); }
.vv-plan--featured .vv-plan-list li { color: #c3ccd8; }
.vv-plan-list svg { flex: 0 0 auto; margin-top: 2px; color: var(--brand); }
.vv-plan-cta { display: inline-flex; align-items: center; justify-content: center; gap: 8px; margin-top: 22px; padding: 12px 18px; font-size: 0.78rem; font-weight: 800; text-decoration: none; color: #ffffff; background: linear-gradient(135deg, var(--brand), var(--brand-strong)); border: 1px solid rgba(59, 153, 252, 0.5); border-radius: var(--r-full); transition: transform 0.22s var(--ease), filter 0.22s var(--ease); }
.vv-plan-cta:hover { transform: translateY(-1px); filter: brightness(1.07); }
.vv-plan--featured .vv-plan-cta { color: #04121f; background: linear-gradient(135deg, var(--brand-soft), var(--brand)); border-color: transparent; }
.vv-plan-cta svg { transition: transform 0.22s var(--ease); }
.vv-plan-cta:hover svg { transform: translateX(3px); }
@media (max-width: 900px) {
.vv-plan { padding: 22px 20px; }
}
.vv-price-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; align-items: stretch; }
@media (max-width: 1240px) {
.vv-price-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 700px) {
.vv-price-grid { grid-template-columns: 1fr; gap: 14px; }
}
.vv-plan-scope { margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--line-soft); }
.vv-plan--featured .vv-plan-scope { border-top-color: rgba(255, 255, 255, 0.1); }
.vv-plan-scope-label { display: block; margin-bottom: 12px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-faint); }
.vv-plan--featured .vv-plan-scope-label { color: #7d8b9e; }
.vv-plan-list--tight { margin-top: 0; padding-top: 0; border-top: 0; }
.vv-plan-meta { margin-top: 18px; padding-top: 14px; font-size: 0.68rem; font-weight: 600; line-height: 1.6; letter-spacing: 0.02em; color: var(--ink-faint); border-top: 1px dashed var(--line); }
.vv-plan--featured .vv-plan-meta { color: #7d8b9e; border-top-color: rgba(255, 255, 255, 0.12); }
.vv-price-note { margin-top: 22px; font-size: 0.72rem; line-height: 1.7; color: var(--ink-faint); text-align: center; }
.vv-kicker { display: inline-block; padding: 6px 15px; font-size: 10px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); border-radius: 9999px; }
.vv-section-title { font-size: clamp(1.6rem, 3.4vw, 2.5rem); font-weight: 800; letter-spacing: -0.025em; line-height: 1.15; color: var(--ink); }
.vv-section-lede { font-size: 0.95rem; line-height: 1.75; color: var(--ink-muted); }
```

##### Academy strip
```html
<section id="academy" class="pb-14 md:pb-20">
 <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
  <div class="academy-banner">
   <div>
    <div class="academy-banner-eyebrow">VUNVAULT Academy</div>
    <h2 class="academy-banner-title">Upskill your in-house engineering team</h2>
    <p class="academy-banner-text">
     We train the people who build and defend your systems. Hands-on modules on secure coding practice, real-world attack vectors, and the same automated CLI tooling our analysts use in live engagements — delivered on-site in Nairobi or remotely for distributed teams.
    </p>
   </div>
   <a href="/academy" class="academy-banner-cta">
    <span>Explore Training Tracks</span>
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </a>
  </div>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
.academy-banner { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 22px; padding: 26px 30px; border-radius: var(--r-2xl); background: radial-gradient(80% 120% at 100% 0%, rgba(59, 153, 252, 0.28), transparent 60%), linear-gradient(135deg, var(--dark) 0%, #060a10 100%); border: 1px solid rgba(59, 153, 252, 0.32); box-shadow: 0 30px 60px -34px rgba(0, 0, 0, 0.6); color: #ffffff; }
.academy-banner > div { flex: 1 1 380px; min-width: 0; }
.academy-banner-eyebrow { font-size: 10px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase; color: var(--brand); }
.academy-banner-title { margin-top: 8px; font-size: 1.1rem; font-weight: 800; letter-spacing: -0.01em; color: #ffffff; }
.academy-banner-text { margin-top: 8px; font-size: 0.8rem; line-height: 1.65; color: #9aa8ba; max-width: 56ch; }
.academy-banner-cta { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 9px; padding: 15px 30px; font-size: 0.82rem; font-weight: 800; color: var(--dark); background: linear-gradient(135deg, var(--brand-soft), var(--brand)); border-radius: var(--r-full); border: 1px solid rgba(255, 255, 255, 0.18); box-shadow: 0 16px 34px -16px var(--brand-glow); transition: transform 0.25s var(--ease), box-shadow 0.25s var(--ease), filter 0.25s var(--ease); }
.academy-banner-cta:hover { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 22px 44px -18px var(--brand-glow); }
.academy-banner-cta:active { transform: translateY(0) scale(0.98); }
@media (max-width: 768px) {
.academy-banner { padding: 22px 22px; }
.academy-banner-cta { width: 100%; justify-content: center; }
}
```

##### Request assessment band
```html
<section id="request-assessment" class="py-14 md:py-20 border-t border-neutral-200/80 bg-paper">
 <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
  <div class="glass-card rounded-3xl p-8 sm:p-12 text-center space-y-5 border border-neutral-200/90">
   <span class="vv-kicker">Next step</span>
   <h2 class="text-2xl sm:text-3xl md:text-4xl font-extrabold text-neutral-900 tracking-tight">Request an assessment under mutual NDA</h2>
   <p class="text-neutral-500 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">Send us your target scope, compliance deadline and preferred timeline. We reply with a written scope, rules-of-engagement draft and a fixed quote — usually within one business day.</p>
   <div class="flex flex-wrap items-center justify-center gap-3 pt-3">
    <a href="mailto:info@vunvault.com?subject=Assessment%20Request%20%E2%80%94%20VUNVAULT" class="btn-get-started">Email info@vunvault.com</a>
    <a href="https://wa.me/254705998032" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-6 py-4 text-sm font-bold text-neutral-900 bg-white border border-neutral-200 rounded-full hover:border-neutral-400 transition-colors">WhatsApp +254 705 998 032</a>
   </div>
   <p class="pt-2 text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">NDA on request · Scope before invoice · No data retained</p>
  </div>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
.btn-get-started { display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 16px 42px; font-size: 0.95rem; font-weight: 700; letter-spacing: 0.02em; color: #ffffff; background: linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%); border-radius: var(--r-full); border: 1px solid rgba(59, 153, 252, 0.5); box-shadow: 0 14px 34px -14px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.25); transition: transform 0.25s var(--ease), box-shadow 0.25s var(--ease), filter 0.25s var(--ease); }
.btn-get-started::after { content: "→"; font-size: 1rem; transition: transform 0.25s var(--ease); }
.btn-get-started:hover { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 20px 44px -16px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.3); }
.btn-get-started:hover::after { transform: translateX(4px); }
.btn-get-started:active { transform: translateY(0) scale(0.98); }
@media (max-width: 768px) {
.btn-get-started { padding: 15px 34px; font-size: 0.9rem; }
}
```

**Behaviour:** prices come from the shared constants of Task 51 (`pricing-data.ts`, `formatUsdWhole`); every `Request Assessment` / `Start with Starter` link → `/contact?category=penetration_testing_request#contact-form`; the `Starter Audit` link → `#pricing`; the section keeps `id="pricing"` (the home page links to `/services#pricing`).

**Tests:** three plans show `$299`, `$899`, `$2,499`; links carry the category query; the band's heading renders verbatim.

---

**Data shape (TypeScript):**
N/A — static content.

**API contract (as comments only — do NOT implement the backend):**
N/A — static content.

---

**Out of scope:**
- Do not add checkout.
- Do not edit Task 54 components other than overwriting the three stubs and appending CSS.

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm --filter web dev` renders the route(s) in this task with no console errors, and `pnpm --filter web test` passes (a smoke test per new component renders it and asserts the key verbatim strings).
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 54b complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 55 — Products page A: hero and API-driven premium catalogue with USD purchase

**Layer:** L6

**Prerequisites:** Task 40c, Task 33, Task 42, Task 44

**Estimated files touched:** 10

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Products page A: hero and API-driven premium catalogue with USD purchase**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the Products route hero and the premium catalogue fed by the API, with Buy Now creating an invoice (USD) and handing off to billing.

**Deliverables:**
- `apps/web/src/app/(marketing)/products/page.tsx` — route; renders hero, catalogue, then `<FreeResources/>`, `<ToolboxShell/>`, `<CustomBand/>` (null stubs created here; Task 55b overwrites).
- `apps/web/src/app/(marketing)/products/_components/products-hero.tsx`, `premium-products.tsx`, `product-card.tsx`
- `apps/web/src/app/(marketing)/products/_components/free-resources.tsx`, `toolbox-shell.tsx`, `custom-band.tsx` — null stubs.
- `apps/web/src/app/(marketing)/products/_hooks/use-products.ts` — `useProducts`, `usePurchaseProduct`.
- `apps/web/src/app/(marketing)/products/_styles/products.css`
- `apps/web/src/mocks/handlers/store.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- `apps/web/src/app/(marketing)/products/products-a.test.tsx`

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
- **Feature stylesheet exception:** the reference CSS blocks below come from the prototype. Reproduce them in the task's own `.css` file (listed in Deliverables), replacing every value that has a token with `var(--token)`. A colour with NO token (for example a one-off dark gradient stop) may stay as a literal ONLY inside that `.css` file; never in TSX.
- Prefer the Tailwind classes shown in the reference markup. Where the markup uses a custom class (`vv-*`, `hero-*`, `adm-*` …) implement it from the CSS block that follows it.
- Replace every `<svg data-icon="REPLACE-WITH-LUCIDE"/>` with the closest `lucide-react` icon (keep size classes); replace every `<a href>` to an internal route with `next/link`.
- Convert the markup to TSX: `class` → `className`, `for` → `htmlFor`, self-close void tags. Do NOT copy `href` values such as `*.html`; the routes shown (e.g. `/about`) are final.
- Text content is verbatim. Do not rewrite, shorten or "improve" any string.

---

**Visual specification (embedded copy + layout):**

**Reference markup (footer variant `products`):**

##### Products hero + stats
```html
<section class="relative pt-12 pb-14 md:pt-20 md:pb-20 overflow-hidden">
 <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <div class="text-center max-w-4xl mx-auto space-y-6">
   <span class="hero-eyebrow">Tools · Automation · Documentation</span>
   <h1 class="text-4xl sm:text-6xl md:text-7xl font-extrabold text-neutral-900 tracking-tight leading-[1.1]">Security Tooling Built For Operators</h1>
   <p class="text-lg sm:text-xl text-neutral-500 font-normal max-w-2xl mx-auto leading-relaxed">Battle-tested penetration testing utilities, automation scripts and technical documentation — built by the team that maps Africa’s attack surfaces every day.</p>
   <div class="flex flex-wrap items-center justify-center gap-3 pt-4">
    <a href="#catalog" class="btn-get-started">Explore Catalog</a>
    <a href="#free-tools" class="btn-outline">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     <span>Free Tools</span>
    </a>
   </div>
  </div>
  <div class="vv-stat-strip">
   <div class="vv-stat">
    <span class="vv-stat-label">Tools Shipped</span>
    <span class="vv-stat-value">24</span>
   </div>
   <div class="vv-stat">
    <span class="vv-stat-label">Free Resources</span>
    <span class="vv-stat-value">12</span>
   </div>
   <div class="vv-stat">
    <span class="vv-stat-label">Active Operators</span>
    <span class="vv-stat-value">3,180</span>
   </div>
   <div class="vv-stat">
    <span class="vv-stat-label">Mean Patch Time</span>
    <span class="vv-stat-value">1.2s</span>
   </div>
  </div>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
.hero-eyebrow { display: inline-block; padding: 7px 16px; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); border-radius: var(--r-full); }
.btn-get-started { display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 16px 42px; font-size: 0.95rem; font-weight: 700; letter-spacing: 0.02em; color: #ffffff; background: linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%); border-radius: var(--r-full); border: 1px solid rgba(59, 153, 252, 0.5); box-shadow: 0 14px 34px -14px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.25); transition: transform 0.25s var(--ease), box-shadow 0.25s var(--ease), filter 0.25s var(--ease); }
.btn-get-started::after { content: "→"; font-size: 1rem; transition: transform 0.25s var(--ease); }
.btn-get-started:hover { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 20px 44px -16px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.3); }
.btn-get-started:hover::after { transform: translateX(4px); }
.btn-get-started:active { transform: translateY(0) scale(0.98); }
@media (max-width: 768px) {
.btn-get-started { padding: 15px 34px; font-size: 0.9rem; }
}
.btn-outline { display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 16px 36px; font-size: 0.95rem; font-weight: 700; letter-spacing: 0.02em; color: var(--ink); background: #ffffff; border: 1px solid var(--line); border-radius: var(--r-full); box-shadow: 0 10px 26px -22px rgba(10, 13, 18, 0.6); transition: transform 0.25s var(--ease), border-color 0.25s var(--ease), color 0.25s var(--ease), box-shadow 0.25s var(--ease); }
.btn-outline:hover { transform: translateY(-2px); border-color: var(--brand); color: var(--brand-strong); box-shadow: 0 18px 38px -22px var(--brand-glow); }
.btn-outline:active { transform: translateY(0) scale(0.98); }
.vv-stat-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; max-width: 56rem; margin: 3rem auto 0; padding: 22px 24px; border-radius: var(--r-xl); background: rgba(255, 255, 255, 0.76); backdrop-filter: blur(14px) saturate(1.4); -webkit-backdrop-filter: blur(14px) saturate(1.4); border: 1px solid rgba(59, 153, 252, 0.14); box-shadow: 0 8px 32px rgba(10, 13, 18, 0.06); }
.vv-stat { display: flex; flex-direction: column; gap: 5px; text-align: center; }
.vv-stat-label { font-size: 10px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-faint); }
.vv-stat-value { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 1.35rem; font-weight: 800; letter-spacing: -0.02em; color: var(--brand-strong); }
@media (max-width: 640px) {
.vv-stat-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 420px) {
.vv-stat-strip { grid-template-columns: 1fr; }
}
```

##### Premium products (cards compressed — data in the table below)
```html
<section id="paid-products" class="py-14 md:py-20 bg-paper border-t border-neutral-200/80">
 <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <div class="vv-sec-head">
   <div class="space-y-3">
    <div class="flex items-center gap-2">
     <span class="h-[2px] w-6 bg-cyan-600 rounded-full"></span>
     <span class="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Premium Products</span>
    </div>
    <h2 class="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight">Licensed tooling for professional engagements</h2>
    <p class="text-neutral-500 text-sm md:text-base max-w-2xl leading-relaxed">Commercial licences include encrypted delivery, twelve months of updates and a named support contact. Purchase routes directly to our secure checkout.</p>
   </div>
   <span class="vv-prod-badge">6 Products</span>
  </div>
  <div class="vv-prod-grid">
   <article class="vv-prod-card">
    <div class="vv-prod-head">
     <div class="vv-prod-icon">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
     </div>
     <span class="vv-prod-badge">Recon</span>
    </div>
    <div class="vv-prod-body">
     <h3 class="vv-prod-title">ReconVault Pro</h3>
     <p class="vv-prod-desc">Continuous attack-surface enumeration engine with subdomain discovery, port fingerprinting and CVE correlation in a single CLI.</p>
     <ul class="vv-prod-features">
      <li>
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       <span>CT-log & DNS brute subdomain enumeration</span>
      </li>
      <li>
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       <span>Live CVE cross-reference & risk scoring</span>
      </li>
      <li>
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       <span>JSON / SARIF export for CI pipelines</span>
      </li>
     </ul>
     <div class="vv-prod-foot">
      <div class="vv-prod-price">
       $49
       <span>/ license</span>
      </div>
      <a class="vv-prod-buy" href="payment.html?product=ReconVault%20Pro&price=49">
       <span>Buy Now</span>
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
      </a>
     </div>
    </div>
   </article>
   [+5 more sibling <article> elements with the SAME structure as the one above; their text content in order: Scanning ¦ VulnScope API ¦ Headless vulnerability scanner exposed as a REST API — drop authenticated scans straight into your CI/CD or SOC automation. ¦ OWASP Top 10 + API abuse detection ¦ Authenticated & unauthenticated scan modes ¦ Webhook alerts & scheduled runs ¦ $129 ¦ / year ¦ Buy Now || Human Risk ¦ PhishGuard Kit ¦ Authorised phishing-simulation framework with landing-page templates, campaign tracking and staff-awareness scoring. ¦ 40+ compliance-safe email templates ¦ Per-department risk scoring dashboard ¦ Automated awareness training follow-up ¦ $79 ¦ / license ¦ Buy Now || Detection ¦ LogHound SIEM Pack ¦ 412 production-tested detection rules mapped to MITRE ATT&CK, packaged for Splunk, Elastic and Wazuh. ¦ 412 rules across 14 ATT&CK tactics ¦ False-positive tuning notes per rule ¦ Purple-team validation playbooks ¦ $199 ¦ / pack ¦ Buy Now || Exploit Dev ¦ PayloadForge ¦ Encoder, obfuscator and payload staging console for authorised red-team engagements and detection-engineering validation. ¦ Multi-stage encoding chains ¦ AV / EDR evasion scoring ¦ Signed engagement audit log ¦ $99 ¦ / license ¦ Buy Now || GRC ¦ ComplianceMapper ¦ Map scan findings to Central Bank, ISO 27001 and Data Protection requirements, then export a board-ready evidence pack. ¦ CBK / ISO 27001 / GDPR control mapping ¦ Evidence pack & audit trail export ¦ Gap analysis with remediation owners ¦ $149 ¦ / year ¦ Buy Now]
  </div>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
.vv-prod-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px; align-items: stretch; }
@media (max-width: 1024px) {
.vv-prod-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 680px) {
.vv-prod-grid { grid-template-columns: 1fr; gap: 16px; }
}
.vv-prod-card { position: relative; display: flex; flex-direction: column; overflow: hidden; border-radius: 20px; background: #ffffff; border: 1px solid var(--line); transition: transform 0.28s var(--ease), border-color 0.28s var(--ease), box-shadow 0.28s var(--ease); }
.vv-prod-card::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, var(--brand), transparent); opacity: 0; transition: opacity 0.28s var(--ease); }
.vv-prod-card:hover { transform: translateY(-5px); border-color: var(--brand-line); box-shadow: 0 28px 56px -36px rgba(10, 13, 18, 0.5); }
.vv-prod-card:hover::before { opacity: 1; }
.vv-prod-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 22px 22px 0; }
.vv-prod-icon { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 48px; height: 48px; border-radius: 14px; color: var(--brand-strong); background: linear-gradient(150deg, rgba(59, 153, 252, 0.14), rgba(59, 153, 252, 0.05)); border: 1px solid var(--brand-line); transition: color 0.28s var(--ease), background 0.28s var(--ease), transform 0.28s var(--ease); }
.vv-prod-card:hover .vv-prod-icon { color: #ffffff; background: linear-gradient(135deg, var(--brand), var(--brand-strong)); transform: scale(1.05); }
.vv-prod-badge { flex: 0 0 auto; padding: 5px 11px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); border-radius: var(--r-full); white-space: nowrap; }
.vv-prod-body { display: flex; flex-direction: column; flex: 1 1 auto; padding: 16px 22px 22px; }
.vv-prod-title { font-size: 1.05rem; font-weight: 800; letter-spacing: -0.01em; line-height: 1.35; color: var(--ink); transition: color 0.25s var(--ease); }
.vv-prod-card:hover .vv-prod-title { color: var(--brand-strong); }
.vv-prod-desc { margin-top: 9px; font-size: 0.78rem; line-height: 1.7; color: var(--ink-muted); }
.vv-prod-features { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
.vv-prod-features li { display: flex; align-items: flex-start; gap: 8px; font-size: 0.75rem; line-height: 1.55; color: var(--ink-soft); }
.vv-prod-features svg { flex: 0 0 auto; margin-top: 3px; color: var(--brand); }
.vv-prod-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: auto; padding-top: 18px; border-top: 1px solid var(--line-soft); }
.vv-prod-price { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 1.5rem; font-weight: 800; letter-spacing: -0.03em; line-height: 1; color: var(--ink); }
.vv-prod-price span { font-family: inherit; font-size: 0.7rem; font-weight: 600; letter-spacing: 0; color: var(--ink-muted); margin-left: 4px; }
.vv-prod-buy,
      .vv-prod-dl { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 11px 20px; font-size: 0.76rem; font-weight: 800; letter-spacing: 0.01em; border-radius: var(--r-full); white-space: nowrap; text-decoration: none; transition: transform 0.22s var(--ease), filter 0.22s var(--ease), background-color 0.22s var(--ease), color 0.22s var(--ease), border-color 0.22s var(--ease); }
.vv-prod-buy { color: #ffffff; background: linear-gradient(135deg, var(--brand), var(--brand-strong)); border: 1px solid rgba(59, 153, 252, 0.5); }
.vv-prod-buy:hover { transform: translateY(-1px); filter: brightness(1.07); }
.vv-prod-buy:active { transform: translateY(0) scale(0.98); }
.vv-sec-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 30px; }
```

**Catalogue data** comes from `GET /api/v1/products` (`ProductView`; fixtures in `@vunvault/contracts/fixtures`). Card fields: category chip, name, description, three features, `$<price>` with `/ <unit>`, button `Buy Now`. The header chip `6 Products` = `total`. The six products:

| slug | name | category | $ (USD) | unit | features (3 each, verbatim) |
|---|---|---|---|---|---|
| reconvault-pro | ReconVault Pro | Recon | 49 | license | CT-log & DNS brute subdomain enumeration · Live CVE cross-reference & risk scoring · JSON / SARIF export for CI pipelines |
| vulnscope-api | VulnScope API | Scanning | 129 | year | OWASP Top 10 + API abuse detection · Authenticated & unauthenticated scan modes · Webhook alerts & scheduled runs |
| phishguard-kit | PhishGuard Kit | Human Risk | 79 | license | 40+ compliance-safe email templates · Per-department risk scoring dashboard · Automated awareness training follow-up |
| loghound-siem-pack | LogHound SIEM Pack | Detection | 199 | pack | 412 rules across 14 ATT&CK tactics · False-positive tuning notes per rule · Purple-team validation playbooks |
| payloadforge | PayloadForge | Exploit Dev | 99 | license | Multi-stage encoding chains · AV / EDR evasion scoring · Signed engagement audit log |
| compliancemapper | ComplianceMapper | GRC | 149 | year | CBK / ISO 27001 / GDPR control mapping · Evidence pack & audit trail export · Gap analysis with remediation owners |

**Buy Now (replaces the prototype's `payment.html?product=…`):** unauthenticated → `/login?next=/products`; authenticated client → `POST /api/v1/products/:id/purchase`, then navigate to `/portal/billing?invoice=<invoiceId>` (Task 66 pays it through the FX quote + USD checkout); a staff user sees the toast `{ kind: "warn", title: "Client accounts only", message: "Sign in with a client account to purchase licences." }`. Prices are USD; never show a local currency here.

**Tests:** six cards from MSW; Buy Now unauthenticated links to login; authenticated calls the purchase mutation then navigates; stubs don't crash the page.

---

**Data shape (TypeScript):**
```ts
interface ProductView { id: string; slug: string; name: string; category: string; description: string; features: string[]; priceUsdCents: number; unitLabel: "license" | "year" | "pack"; settlementCurrency: "USD" }
interface PurchaseResponse { data: { invoiceId: string; invoiceNumber: string; totalUsdCents: number; settlementCurrency: "USD" } }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET  /api/v1/products → 200 { data: ProductView[]; total }   (public)
// POST /api/v1/products/:id/purchase → 201 PurchaseResponse | 401 | 403 { error: "no_org" }
```

---

**Out of scope:**
- Do not build the checkout page (Task 66).
- Do not link to any `.html` file.
- Do not add a non-USD price.
- Do not build free resources, shell or band (Task 55b).

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm --filter web dev` renders the route(s) in this task with no console errors, and `pnpm --filter web test` passes (a smoke test per new component renders it and asserts the key verbatim strings).
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 55 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 55b — Products page B: free resources, simulated Toolbox Shell, custom-tooling band

**Layer:** L6

**Prerequisites:** Task 48, Task 55

**Estimated files touched:** 7

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Products page B: free resources, simulated Toolbox Shell, custom-tooling band**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the lower Products sections, replacing the three stubs from Task 55.

**Deliverables:**
- `apps/web/src/app/(marketing)/products/_components/free-resources.tsx`, `toolbox-shell.tsx`, `custom-band.tsx` — overwrite the stubs.
- `apps/web/src/app/(marketing)/products/_data/free-resources.ts`
- MODIFY `apps/web/src/app/(marketing)/products/_styles/products.css` — append.
- `apps/web/src/app/(marketing)/products/products-b.test.tsx`

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
- **Feature stylesheet exception:** the reference CSS blocks below come from the prototype. Reproduce them in the task's own `.css` file (listed in Deliverables), replacing every value that has a token with `var(--token)`. A colour with NO token (for example a one-off dark gradient stop) may stay as a literal ONLY inside that `.css` file; never in TSX.
- Prefer the Tailwind classes shown in the reference markup. Where the markup uses a custom class (`vv-*`, `hero-*`, `adm-*` …) implement it from the CSS block that follows it.
- Replace every `<svg data-icon="REPLACE-WITH-LUCIDE"/>` with the closest `lucide-react` icon (keep size classes); replace every `<a href>` to an internal route with `next/link`.
- Convert the markup to TSX: `class` → `className`, `for` → `htmlFor`, self-close void tags. Do NOT copy `href` values such as `*.html`; the routes shown (e.g. `/about`) are final.
- Text content is verbatim. Do not rewrite, shorten or "improve" any string.
- **Illustration exception:** SVG illustrations (hero network map, article thumbnails) are artwork, not UI chrome; their literal fill/stroke colours may be kept exactly as in the reference, inside the named illustration component file only.

---

**Visual specification (embedded copy + layout):**

**Reference markup:**

##### Free resources (cards compressed — data in the bracketed note and the table below)
```html
<section id="free-resources" class="py-14 md:py-20 bg-paper border-t border-neutral-200/80">
 <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <div class="vv-sec-head">
   <div class="space-y-3">
    <div class="flex items-center gap-2">
     <span class="h-[2px] w-6 bg-emerald-500 rounded-full"></span>
     <span class="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Free Resources</span>
    </div>
    <h2 class="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight">Open tooling, no licence required</h2>
    <p class="text-neutral-500 text-sm md:text-base max-w-2xl leading-relaxed">Community resources published under permissive licences. Click download and the file is fetched straight from the source — no checkout, no account, no telemetry.</p>
   </div>
   <span class="vv-prod-badge vv-prod-badge--free">6 Resources</span>
  </div>
  <div class="vv-prod-grid">
   <article class="vv-prod-card vv-prod-card--free">
    <div class="vv-prod-head">
     <div class="vv-prod-icon">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
     </div>
     <span class="vv-prod-badge vv-prod-badge--free">Free</span>
    </div>
    <div class="vv-prod-body">
     <h3 class="vv-prod-title">CVE Tracker CLI</h3>
     <p class="vv-prod-desc">Terminal utility that pulls the NVD feed, filters by vendor and ecosystem, and prints a prioritised patch queue for your estate.</p>
     <div class="vv-prod-tags">
      <span class="vv-skill">CLI</span>
      <span class="vv-skill">Python</span>
      <span class="vv-skill">NVD</span>
     </div>
     <div class="vv-prod-foot">
      <span class="vv-prod-size">2.4 MB · .zip</span>
      <button type="button" class="vv-prod-dl">
       <span>Download</span>
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
      </button>
     </div>
    </div>
   </article>
   [+5 more sibling <article> elements with the SAME structure as the one above; their text content in order: Free ¦ Nmap Operator Cheatsheet ¦ A twelve-page PDF of the scan flags, timing templates and evasion switches our assessors actually reach for during engagements. ¦ PDF ¦ Recon ¦ Reference ¦ 1.1 MB · .pdf ¦ Download || Free ¦ Linux Hardening Baselines ¦ Idempotent shell scripts that apply CIS-aligned baselines to Ubuntu, Debian and RHEL hosts, with a dry-run mode and rollback manifest. ¦ Bash ¦ CIS ¦ Linux ¦ 380 KB · .tar.gz ¦ Download || Free ¦ Threat Intel Feed ¦ Machine-readable JSON feed of weaponised CVEs, active exploitation status and vendor advisory links — refreshed every fifteen minutes. ¦ JSON ¦ API ¦ Live ¦ External host · .json ¦ Download || Free ¦ SACCO Compliance Checklist ¦ A printable readiness checklist mapping Central Bank of Kenya and Data Protection Act obligations to concrete technical controls. ¦ PDF ¦ CBK ¦ Fintech ¦ 860 KB · .pdf ¦ Download || Free ¦ Zero-Day Watch (RSS) ¦ Subscribe in any feed reader to receive VUNVAULT’s zero-day bulletin the moment a critical vulnerability becomes weaponised in the wild. ¦ RSS ¦ XML ¦ Alerts ¦ External host · .xml ¦ Download]
  </div>
  <p class="text-center text-xs text-neutral-500 mt-8">Free resources are provided as-is for authorised testing only. Never scan systems you do not own or have written permission to assess.</p>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
.vv-skill { padding: 5px 10px; font-size: 9.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-soft); background: #f5f7fa; border: 1px solid var(--line); border-radius: var(--r-full); }
.vv-prod-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px; align-items: stretch; }
@media (max-width: 1024px) {
.vv-prod-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 680px) {
.vv-prod-grid { grid-template-columns: 1fr; gap: 16px; }
}
.vv-prod-card { position: relative; display: flex; flex-direction: column; overflow: hidden; border-radius: 20px; background: #ffffff; border: 1px solid var(--line); transition: transform 0.28s var(--ease), border-color 0.28s var(--ease), box-shadow 0.28s var(--ease); }
.vv-prod-card::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, var(--brand), transparent); opacity: 0; transition: opacity 0.28s var(--ease); }
.vv-prod-card:hover { transform: translateY(-5px); border-color: var(--brand-line); box-shadow: 0 28px 56px -36px rgba(10, 13, 18, 0.5); }
.vv-prod-card:hover::before { opacity: 1; }
.vv-prod-card--free { background: rgba(255, 255, 255, 0.9); }
.vv-prod-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 22px 22px 0; }
.vv-prod-icon { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 48px; height: 48px; border-radius: 14px; color: var(--brand-strong); background: linear-gradient(150deg, rgba(59, 153, 252, 0.14), rgba(59, 153, 252, 0.05)); border: 1px solid var(--brand-line); transition: color 0.28s var(--ease), background 0.28s var(--ease), transform 0.28s var(--ease); }
.vv-prod-card:hover .vv-prod-icon { color: #ffffff; background: linear-gradient(135deg, var(--brand), var(--brand-strong)); transform: scale(1.05); }
.vv-prod-badge { flex: 0 0 auto; padding: 5px 11px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); border-radius: var(--r-full); white-space: nowrap; }
.vv-prod-badge--free { color: #047857; background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.35); }
.vv-prod-body { display: flex; flex-direction: column; flex: 1 1 auto; padding: 16px 22px 22px; }
.vv-prod-title { font-size: 1.05rem; font-weight: 800; letter-spacing: -0.01em; line-height: 1.35; color: var(--ink); transition: color 0.25s var(--ease); }
.vv-prod-card:hover .vv-prod-title { color: var(--brand-strong); }
.vv-prod-desc { margin-top: 9px; font-size: 0.78rem; line-height: 1.7; color: var(--ink-muted); }
.vv-prod-tags { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 16px; }
.vv-prod-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: auto; padding-top: 18px; border-top: 1px solid var(--line-soft); }
.vv-prod-size { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; font-weight: 600; letter-spacing: 0.04em; color: var(--ink-faint); }
.vv-prod-buy,
      .vv-prod-dl { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 11px 20px; font-size: 0.76rem; font-weight: 800; letter-spacing: 0.01em; border-radius: var(--r-full); white-space: nowrap; text-decoration: none; transition: transform 0.22s var(--ease), filter 0.22s var(--ease), background-color 0.22s var(--ease), color 0.22s var(--ease), border-color 0.22s var(--ease); }
.vv-prod-dl { color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); }
.vv-prod-dl:hover { color: #ffffff; background: linear-gradient(135deg, var(--brand), var(--brand-strong)); border-color: transparent; transform: translateY(-1px); }
.vv-prod-dl:active { transform: translateY(0) scale(0.98); }
.vv-sec-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 30px; }
```

##### Live console (toolbox shell)
```html
<section id="terminal" class="py-14 md:py-20 bg-paper border-t border-neutral-200/80">
 <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
  <div class="space-y-3 max-w-3xl">
   <div class="flex items-center gap-2">
    <span class="h-[2px] w-6 bg-cyan-600 rounded-full"></span>
    <span class="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Live Console</span>
   </div>
   <h2 class="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight">Try the toolbox before you download it</h2>
   <p class="text-neutral-500 text-sm md:text-base leading-relaxed">This is the same shell our operators use. Browse the catalogue, preview a scan or pull a free resource — right here in the browser.</p>
  </div>
  <div class="rounded-2xl bg-neutral-900/95 text-neutral-100 p-4 sm:p-5 border border-neutral-800 shadow-2xl overflow-hidden font-sans">
   <div class="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-neutral-800 text-xs">
    <div class="flex items-center gap-3">
     <span class="flex items-center gap-1.5" aria-hidden="true">
      <span class="w-2.5 h-2.5 rounded-full"></span>
      <span class="w-2.5 h-2.5 rounded-full"></span>
      <span class="w-2.5 h-2.5 rounded-full"></span>
     </span>
     <span class="font-extrabold tracking-wider text-white">VUNVAULT</span>
     <span class="text-neutral-600 hidden sm:inline">|</span>
     <span class="text-neutral-300 font-semibold uppercase tracking-wider hidden sm:inline">Toolbox Shell</span>
    </div>
    <div class="flex items-center gap-2.5">
     <span class="vv-scan-status" id="vv-term-status">
      <span class="vv-scan-status-dot" aria-hidden="true"></span>
      <span id="vv-term-status-text">READY</span>
     </span>
    </div>
   </div>
   <div class="vv-scan-screen vv-term-screen mt-4" id="vv-term-screen" role="log" aria-live="polite" aria-label="Interactive toolbox console output"></div>
   <form class="vv-term-form" id="vv-term-form">
    <label class="sr-only" for="vv-term-input">Enter a command</label>
    <div class="vv-scan-input-wrap">
     <span class="vv-scan-prompt" aria-hidden="true">$</span>
     <input id="vv-term-input" class="vv-scan-input" type="text" name="command" placeholder="help" autocomplete="off"/>
    </div>
    <button type="submit" class="vv-scan-execute">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     <span>Run</span>
    </button>
    <button type="button" class="vv-scan-reset" id="vv-term-clear">Clear</button>
   </form>
   <div class="vv-scan-chips mt-3.5">
    <span class="vv-scan-chips-label">Try:</span>
    <button type="button" class="vv-chip">help</button>
    <button type="button" class="vv-chip">products</button>
    <button type="button" class="vv-chip">free</button>
    <button type="button" class="vv-chip">scan example.com</button>
    <button type="button" class="vv-chip">download cve-tracker</button>
   </div>
   <p class="pt-4 mt-4 border-t border-neutral-800 text-[10px] text-neutral-500 leading-relaxed">
    Simulated environment for demonstration. Purchases route to
    <code class="text-cyan-400 font-mono">payment.html</code>
    ; free downloads are fetched directly from source.
   </p>
  </div>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
.vv-scan-status { display: inline-flex; align-items: center; gap: 7px; padding: 5px 12px; border-radius: var(--r-full); font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10px; font-weight: 800; letter-spacing: 0.14em; border: 1px solid transparent; white-space: nowrap; }
.vv-scan-status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.vv-scan-status[data-state="idle"] { color: #94a3b8; background: rgba(148, 163, 184, 0.1); border-color: rgba(148, 163, 184, 0.3); }
.vv-scan-status[data-state="scanning"] { color: #7dd3fc; background: rgba(59, 153, 252, 0.12); border-color: rgba(59, 153, 252, 0.42); }
.vv-scan-status[data-state="scanning"] .vv-scan-status-dot { animation: pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
.vv-scan-status[data-state="done"] { color: #34d399; background: rgba(16, 185, 129, 0.12); border-color: rgba(16, 185, 129, 0.42); }
.vv-scan-input-wrap { position: relative; display: flex; align-items: center; flex: 1 1 260px; min-width: 0; }
.vv-scan-prompt { position: absolute; left: 14px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; font-weight: 700; color: var(--brand); pointer-events: none; }
.vv-scan-input { width: 100%; padding: 13px 14px 13px 34px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; color: #e2e8f0; background: #070b11; border: 1px solid rgba(59, 153, 252, 0.24); border-radius: 10px; outline: none; transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease); }
.vv-scan-input::placeholder { color: #55637a; }
.vv-scan-input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(59, 153, 252, 0.16); }
.vv-scan-input.is-invalid { border-color: var(--critical); box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.16); }
.vv-scan-execute { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 9px; padding: 13px 22px; font-size: 12.5px; font-weight: 800; color: #04121f; background: linear-gradient(135deg, var(--brand-soft), var(--brand)); border-radius: 10px; transition: transform 0.2s var(--ease), filter 0.2s var(--ease), opacity 0.2s var(--ease); }
.vv-scan-execute:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.06); }
.vv-scan-execute:disabled { opacity: 0.55; cursor: not-allowed; }
.vv-scan-reset { flex: 0 0 auto; padding: 13px 18px; font-size: 12.5px; font-weight: 700; color: #93a2b5; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; transition: color 0.2s var(--ease), border-color 0.2s var(--ease), background-color 0.2s var(--ease); }
.vv-scan-reset:hover { color: #e2e8f0; border-color: rgba(59, 153, 252, 0.4); background: rgba(59, 153, 252, 0.1); }
.vv-scan-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.vv-scan-chips-label { font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #55637a; }
.vv-chip { padding: 6px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; color: #8d9aab; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.09); border-radius: var(--r-full); transition: color 0.2s var(--ease), border-color 0.2s var(--ease), background-color 0.2s var(--ease); }
.vv-chip:hover { color: var(--brand-soft); border-color: rgba(59, 153, 252, 0.45); background: rgba(59, 153, 252, 0.1); }
.vv-scan-screen { height: 340px; overflow-y: auto; padding: 16px 18px; border-radius: 12px; background: radial-gradient(120% 100% at 0% 0%, rgba(59, 153, 252, 0.07), transparent 60%), #05080d; border: 1px solid rgba(59, 153, 252, 0.16); font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; line-height: 1.85; scroll-behavior: smooth; }
@media (max-width: 768px) {
.vv-scan-screen { height: 260px; font-size: 11px; }
.vv-scan-status { justify-self: end; }
.vv-scan-execute,
  .vv-scan-reset { flex: 1 1 auto; justify-content: center; }
}
.vv-scan-screen::-webkit-scrollbar,
.vv-scan-body::-webkit-scrollbar { width: 8px; height: 8px; }
.vv-scan-screen::-webkit-scrollbar-track,
.vv-scan-body::-webkit-scrollbar-track { background: transparent; }
.vv-scan-screen::-webkit-scrollbar-thumb,
.vv-scan-body::-webkit-scrollbar-thumb { background: rgba(59, 153, 252, 0.28); border-radius: 9999px; border: 2px solid transparent; background-clip: padding-box; }
.vv-scan-screen::-webkit-scrollbar-thumb:hover,
.vv-scan-body::-webkit-scrollbar-thumb:hover { background: rgba(59, 153, 252, 0.6); background-clip: padding-box; }
.vv-scan-screen,
.vv-scan-body { scrollbar-width: thin; scrollbar-color: rgba(59, 153, 252, 0.35) transparent; }
.vv-scan-input:focus-visible { outline: none; border-color: var(--brand); box-shadow: 0 0 0 3px rgba(59, 153, 252, 0.22); }
.vv-scan-input.is-invalid { border-color: var(--critical); box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.18); animation: vvShake 0.32s var(--ease); }
@media (max-width: 480px) {
.vv-scan-screen { height: 220px; }
}
@media (prefers-reduced-motion: reduce) {
.vv-scan-modal,
  .vv-scan-window,
  .vv-line,
  .vv-scan-input.is-invalid { transition-duration: 0.001ms !important; animation-duration: 0.001ms !important; transform: none !important; }
}
@keyframes pulse { 50% { opacity: 0.5; } }
@keyframes vvShake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
.vv-term-screen { height: 320px; }
.vv-term-form { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
@media (max-width: 640px) {
.vv-term-screen { height: 240px; font-size: 11px; }
}
```

##### Custom tooling band
```html
<section class="py-14 md:py-20 bg-paper border-t border-neutral-200/80">
 <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <div class="vv-scan-cta">
   <div class="vv-scan-cta-glow" aria-hidden="true"></div>
   <div class="vv-scan-cta-body">
    <span class="vv-scan-cta-eyebrow">Need something bespoke?</span>
    <h2 class="vv-scan-cta-title">
     We build custom tooling —
     <span>Talk to an engineer</span>
    </h2>
    <p class="vv-scan-cta-text">Internal scanners, CI security gates, SIEM content or a private red-team arsenal. Tell us the workflow and we will scope the build.</p>
    <div class="vv-scan-cta-actions">
     <a href="/contact" class="vv-scan-cta-btn">
      <span>Start a Conversation</span>
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
     </a>
     <span class="vv-scan-cta-note">Nairobi-based · Serving clients worldwide</span>
    </div>
   </div>
  </div>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
.vv-scan-cta { position: relative; overflow: hidden; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 26px; padding: 40px 44px; border-radius: var(--r-2xl); color: #ffffff; background: radial-gradient(90% 130% at 100% 0%, rgba(59, 153, 252, 0.30), transparent 60%), linear-gradient(135deg, var(--dark) 0%, #060a10 100%); border: 1px solid rgba(59, 153, 252, 0.32); box-shadow: 0 30px 60px -34px rgba(0, 0, 0, 0.6); }
.vv-scan-cta-glow { position: absolute; top: -40%; right: -10%; width: 46%; height: 180%; background: radial-gradient(closest-side, var(--brand-glow), transparent 72%); filter: blur(70px); opacity: 0.55; pointer-events: none; }
.vv-scan-cta-body { position: relative; z-index: 1; flex: 1 1 420px; min-width: 0; }
.vv-scan-cta-eyebrow { display: inline-block; font-size: 10px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase; color: var(--brand); }
.vv-scan-cta-title { margin-top: 10px; font-size: clamp(1.4rem, 3vw, 2.05rem); font-weight: 800; letter-spacing: -0.02em; line-height: 1.2; color: #ffffff; }
.vv-scan-cta-title span { color: var(--brand-soft); }
.vv-scan-cta-text { margin-top: 12px; max-width: 62ch; font-size: 0.84rem; line-height: 1.75; color: #9aa8ba; }
.vv-scan-cta-actions { position: relative; z-index: 1; display: flex; flex-wrap: wrap; align-items: center; gap: 16px; }
.vv-scan-cta-btn { display: inline-flex; align-items: center; gap: 10px; padding: 16px 30px; font-size: 0.84rem; font-weight: 800; letter-spacing: 0.01em; color: #04121f; background: linear-gradient(135deg, var(--brand-soft), var(--brand)); border-radius: var(--r-full); border: 1px solid rgba(255, 255, 255, 0.18); box-shadow: 0 16px 34px -16px var(--brand-glow); transition: transform 0.25s var(--ease), filter 0.25s var(--ease), box-shadow 0.25s var(--ease); }
.vv-scan-cta-btn:hover { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 22px 46px -18px var(--brand-glow); }
.vv-scan-cta-btn:active { transform: translateY(0) scale(0.98); }
.vv-scan-cta-btn svg { transition: transform 0.25s var(--ease); }
.vv-scan-cta-btn:hover svg { transform: translateX(4px); }
.vv-scan-cta-note { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.04em; color: #6b7a8d; }
@media (max-width: 768px) {
.vv-scan-cta { padding: 28px 22px; }
.vv-scan-cta-btn { width: 100%; justify-content: center; }
}
```

**Free resources (constants; six entries, verbatim from the markup):** CVE Tracker CLI (CLI · Python · NVD · `2.4 MB · .zip`), Nmap Operator Cheatsheet (PDF · Recon · Reference · `1.1 MB · .pdf`), Linux Hardening Baselines (Bash · CIS · Linux · `380 KB · .tar.gz`), Threat Intel Feed (JSON · API · Live · `External host · .json`), SACCO Compliance Checklist (PDF · CBK · Fintech · `860 KB · .pdf`), Zero-Day Watch (RSS) (RSS · XML · Alerts · `External host · .xml`). The prototype's `Download` buttons have no file URLs: render `<button type="button" disabled aria-disabled="true" title="Download links are published when the file is released">` with `// TODO(content): file URLs`. Footnote verbatim: `Free resources are provided as-is for authorised testing only. Never scan systems you do not own or have written permission to assess.`

**Toolbox Shell — port the command interpreter (reference JS; replace DOM writes with React state; keep every output string verbatim, EXCEPT that `purchase` output points to `/products` and checkout to `/portal/billing` instead of `payment.html`):**
```js
(function () {
 "use strict";
 var PAID = {
 reconvault: { name: "ReconVault Pro", price: 49 },
 vulnscope: { name: "VulnScope API", price: 129 },
 phishguard: { name: "PhishGuard Kit", price: 79 },
 loghound: { name: "LogHound SIEM Pack", price: 199 },
 payloadforge: { name: "PayloadForge", price: 99 },
 compliancemapper: { name: "ComplianceMapper", price: 149 }
 };
 var FREE = {
 "cve-tracker": { name: "CVE Tracker CLI", file: "downloads/vv-cve-tracker-cli-v1.4.0.zip" },
 "nmap-cheatsheet": { name: "Nmap Operator Cheatsheet", file: "downloads/vunvault-nmap-cheatsheet.pdf" },
 "hardening-baselines": { name: "Linux Hardening Baselines", file: "downloads/vv-hardening-baselines.tar.gz" },
 "threat-feed": { name: "Threat Intel Feed (JSON)", file: "https://feeds.vunvault.com/threat-intel.json" },
 "sacco-checklist": { name: "SACCO Compliance Checklist", file: "downloads/vv-sacco-compliance-checklist.pdf" },
 "zero-day-watch": { name: "Zero-Day Watch (RSS)", file: "https://feeds.vunvault.com/zero-day-watch.xml" }
 };
 var toastEl = document.getElementById("vv-toast");
 var toastText = document.getElementById("vv-toast-text");
 var toastTimer = null;
 function toast(message) {
 if (!toastEl || !toastText) return;
 toastText.textContent = message;
 toastEl.classList.add("is-on");
 if (toastTimer) window.clearTimeout(toastTimer);
 toastTimer = window.setTimeout(function () {
 toastEl.classList.remove("is-on");
 }, 2600);
 }
 function triggerDownload(key) {
 var item = FREE[key];
 if (!item) return false;
 var isExternal = /^https?:\/\//i.test(item.file);
 var a = document.createElement("a");
 a.href = item.file;
 a.rel = "noopener";
 if (isExternal) {
 a.target = "_blank";
 } else {
 a.setAttribute("download", item.file.split("/").pop());
 }
 a.style.display = "none";
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 return true;
 }
 function triggerPurchase(key) {
 var item = PAID[key];
 if (!item) return false;
 var url = "payment.html?product=" +
 encodeURIComponent(item.name) +
 "&price=" + encodeURIComponent(item.price);
 window.location.href = url;
 return true;
 }
 document.querySelectorAll("[data-download]").forEach(function (btn) {
 btn.addEventListener("click", function () {
 var key = btn.getAttribute("data-download");
 var item = FREE[key];
 if (!item || !triggerDownload(key)) {
 toast("Resource unavailable — please retry.");
 return;
 }
 toast("Downloading " + item.name + " …");
 if (window.VVTerminal && window.VVTerminal.print) {
 window.VVTerminal.print("ok", "[+] download started → " + item.file);
 }
 });
 });
 (function terminal() {
 var screenEl = document.getElementById("vv-term-screen");
 var formEl = document.getElementById("vv-term-form");
 var inputEl = document.getElementById("vv-term-input");
 var clearBtn = document.getElementById("vv-term-clear");
 var statusEl = document.getElementById("vv-term-status");
 var statusTx = document.getElementById("vv-term-status-text");
 if (!screenEl || !formEl || !inputEl) return;
 var busy = false;
 function pad(n) { return String(n).padStart(2, "0"); }
 function stamp() {
 var d = new Date();
 return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
 }
 function print(kind, msg) {
 var line = document.createElement("div");
 line.className = "vv-line vv-line--" + kind;
 var ts = document.createElement("span");
 ts.className = "vv-line-ts";
 ts.textContent = "[" + stamp() + "]";
 var m = document.createElement("span");
 m.className = "vv-line-msg";
 m.textContent = msg;
 line.appendChild(ts);
 line.appendChild(m);
 screenEl.appendChild(line);
 screenEl.scrollTop = screenEl.scrollHeight;
 }
 function setStatus(state, text) {
 if (statusEl) statusEl.setAttribute("data-state", state);
 if (statusTx) statusTx.textContent = text;
 }
 var COMMANDS = {
 help: function () {
 print("sys", "VUNVAULT toolbox shell — available commands");
 print("muted", " help show this message");
 print("muted", " products list premium products");
 print("muted", " free list free resources");
 print("muted", " buy <id> open payment.html for a product");
 print("muted", " download <id> fetch a free resource");
 print("muted", " scan <target> run a simulated reconnaissance pass");
 print("muted", " about about this toolbox");
 print("muted", " clear clear the screen");
 },
 products: function () {
 print("info", "[*] Premium catalog — " + Object.keys(PAID).length + " products");
 Object.keys(PAID).forEach(function (id) {
 var p = PAID[id];
 print("muted", " " + id.padEnd(18, " ") + p.name.padEnd(24, " ") + "$" + p.price);
 });
 print("ok", "[+] run `buy <id>` to open secure checkout");
 },
 free: function () {
 print("info", "[*] Free resources — " + Object.keys(FREE).length + " downloads");
 Object.keys(FREE).forEach(function (id) {
 print("muted", " " + id.padEnd(22, " ") + FREE[id].name);
 });
 print("ok", "[+] run `download <id>` to fetch a file");
 },
 buy: function (arg) {
 if (!arg) { print("warn", "[!] usage: buy <product-id> (try `products`)"); return; }
 var id = arg.toLowerCase();
 if (!PAID[id]) { print("crit", "[!] unknown product id: " + arg); return; }
 print("info", "[*] redirecting to payment.html for " + PAID[id].name + " …");
 window.setTimeout(function () { triggerPurchase(id); }, 420);
 },
 download: function (arg) {
 if (!arg) { print("warn", "[!] usage: download <resource-id> (try `free`)"); return; }
 var id = arg.toLowerCase();
 if (!FREE[id]) { print("crit", "[!] unknown resource id: " + arg); return; }
 print("ok", "[+] fetching " + FREE[id].name);
 print("muted", " source → " + FREE[id].file);
 triggerDownload(id);
 },
 scan: function (arg) {
 if (!arg) { print("warn", "[!] usage: scan <domain|ip>"); return; }
 if (busy) { print("warn", "[!] a scan is already running"); return; }
 busy = true;
 setStatus("scanning", "SCANNING");
 var steps = [
 ["sys", "vunvault-recon v2.4.0 — target " + arg],
 ["info", "[*] resolving DNS records …"],
 ["ok", "[+] A record → 203.0.113.42"],
 ["info", "[*] enumerating subdomains via CT logs …"],
 ["ok", "[+] 14 subdomains discovered"],
 ["info", "[*] probing TCP ports 1-1024 …"],
 ["warn", "[!] 22/tcp open — SSH (OpenSSH 8.2p1)"],
 ["ok", "[+] 443/tcp open — TLS 1.3, HSTS enabled"],
 ["info", "[*] cross-referencing CVEs …"],
 ["crit", "[CRITICAL] CVE-2026-9122 — RCE in API ingress (CVSS 9.8)"],
 ["warn", "[HIGH] CVE-2026-4401 — directory traversal (CVSS 7.5)"],
 ["ok", "[+] reconnaissance complete — 2 findings"]
 ];
 var i = 0;
 var timer = window.setInterval(function () {
 if (i >= steps.length) {
 window.clearInterval(timer);
 busy = false;
 setStatus("done", "COMPLETE");
 window.setTimeout(function () { setStatus("idle", "READY"); }, 2600);
 return;
 }
 print(steps[i][0], steps[i][1]);
 i++;
 }, 320);
 },
 about: function () {
 print("sys", "VUNVAULT Toolbox — build 2.4.0 (Nairobi, Kenya)");
 print("muted", "Penetration testing tooling, automation scripts and");
 print("muted", "technical documentation for defenders and offensive engineers.");
 },
 clear: function () {
 screenEl.innerHTML = "";
 }
 };
 function run(raw) {
 var text = (raw || "").trim();
 if (!text) return;
 print("muted", "$ " + text);
 var parts = text.split(/\s+/);
 var cmd = parts.shift().toLowerCase();
 var arg = parts.join(" ");
 if (Object.prototype.hasOwnProperty.call(COMMANDS, cmd)) {
 COMMANDS[cmd](arg);
 } else {
 print("crit", "[!] command not found: " + cmd);
 print("muted", " type `help` for the command list");
 }
 }
 formEl.addEventListener("submit", function (e) {
 e.preventDefault();
 var value = inputEl.value;
 inputEl.value = "";
 run(value);
 inputEl.focus();
 });
 if (clearBtn) {
 clearBtn.addEventListener("click", function () {
 screenEl.innerHTML = "";
 inputEl.focus();
 });
 }
 document.querySelectorAll("[data-vv-term-cmd]").forEach(function (chip) {
 chip.addEventListener("click", function () {
 var cmd = chip.getAttribute("data-vv-term-cmd");
 run(cmd);
 inputEl.focus();
 });
 });
 screenEl.addEventListener("click", function () { inputEl.focus(); });
 print("sys", "vunvault-toolbox v2.4.0 — interactive shell");
 print("muted", "type \"help\" to list available commands");
 window.VVTerminal = { print: print, run: run };
 })();
 })();
```
Header chip `READY`; input placeholder `help`; buttons `Run`, `Clear`; suggestion chips `help`, `products`, `free`, `scan example.com`, `download cve-tracker`; footnote: `Simulated environment for demonstration. Purchases route to checkout; free downloads are fetched directly from source.` (planner edit of the prototype's `payment.html` wording). `scan <target>` uses `useScanSimulation` (Task 48).

**Tests:** six disabled downloads; shell: `help`, `products`, `free`, `scan example.com`, unknown command; `Clear` empties the log; band link → `/contact`.

---

**Data shape (TypeScript):**
N/A — static content.

**API contract (as comments only — do NOT implement the backend):**
N/A — static content.

---

**Out of scope:**
- Do not wire real downloads.
- Do not link to `.html` files.

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm --filter web dev` renders the route(s) in this task with no console errors, and `pnpm --filter web test` passes (a smoke test per new component renders it and asserts the key verbatim strings).
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 55b complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 56 — Blog: news list with search/filters/featured report, article detail route, newsletter

**Layer:** L6

**Prerequisites:** Task 40c, Task 42, Task 44, Task 47, Task 48, Task 49

**Estimated files touched:** 14

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Blog: news list with search/filters/featured report, article detail route, newsletter**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build `/blog` (hero search, category filter pills, featured highest-priority report, article grid, empty state, newsletter signup) and `/blog/[slug]` (article reader) on the public content API.

**Deliverables:**
- `apps/web/src/app/(marketing)/blog/page.tsx`, `apps/web/src/app/(marketing)/blog/[slug]/page.tsx`
- `apps/web/src/app/(marketing)/blog/_components/blog-hero.tsx`, `featured-report.tsx`, `news-list.tsx`, `category-pills.tsx`, `article-reader.tsx`, `newsletter-form.tsx`, `safe-markdown.tsx`
- `apps/web/src/app/(marketing)/blog/_hooks/use-blog.ts` — list/detail/newsletter hooks.
- `apps/web/src/app/(marketing)/blog/_styles/blog.css`
- `apps/web/src/mocks/handlers/newsletter.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- `apps/web/src/app/(marketing)/blog/blog.test.tsx`
- `apps/web/src/app/(marketing)/blog/[slug]/article.test.tsx`

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
- **Feature stylesheet exception:** the reference CSS blocks below come from the prototype. Reproduce them in the task's own `.css` file (listed in Deliverables), replacing every value that has a token with `var(--token)`. A colour with NO token (for example a one-off dark gradient stop) may stay as a literal ONLY inside that `.css` file; never in TSX.
- Prefer the Tailwind classes shown in the reference markup. Where the markup uses a custom class (`vv-*`, `hero-*`, `adm-*` …) implement it from the CSS block that follows it.
- Replace every `<svg data-icon="REPLACE-WITH-LUCIDE"/>` with the closest `lucide-react` icon (keep size classes); replace every `<a href>` to an internal route with `next/link`.
- Convert the markup to TSX: `class` → `className`, `for` → `htmlFor`, self-close void tags. Do NOT copy `href` values such as `*.html`; the routes shown (e.g. `/about`) are final.
- Text content is verbatim. Do not rewrite, shorten or "improve" any string.
- **Illustration exception:** SVG illustrations (hero network map, article thumbnails) are artwork, not UI chrome; their literal fill/stroke colours may be kept exactly as in the reference, inside the named illustration component file only.

---

**Visual specification (embedded copy + layout):**

**Reference markup (the blog page also shows the CVE ticker from Task 47 above the hero and the Free Scanner CTA from Task 48 at the bottom; footer variant `company`):**

##### Blog hero + search
```html
<section class="vv-blog-hero">
 <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <div class="vv-blog-hero-inner">
   <span class="hero-eyebrow">Threat Intelligence · Field Reports</span>
   <h1 class="vv-blog-title">News & Threat Reports</h1>
   <p class="vv-blog-sub">CVE analysis, incident-response field notes and defensive engineering from the VUNVAULT sensor network — written for the people who have to act on it.</p>
   <div class="vv-blog-controls">
    <label class="vv-blog-search" aria-label="Search reports">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     <input id="vv-blog-search" type="search" placeholder="Search reports, CVEs, vendors, categories…" autocomplete="off"/>
    </label>
    <div class="vv-blog-counter" id="vv-blog-counter" aria-live="polite">Showing 0 reports</div>
   </div>
   <div class="vv-blog-filters" id="vv-blog-filters" role="tablist" aria-label="Filter reports by category"></div>
  </div>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
.hero-eyebrow { display: inline-block; padding: 7px 16px; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); border-radius: var(--r-full); }
.vv-blog-hero { padding: 3.5rem 0 2.25rem; background: radial-gradient(90% 60% at 50% 0%, rgba(59, 153, 252, 0.08), transparent 60%), var(--paper); border-bottom: 1px solid var(--line-soft); }
.vv-blog-hero-inner { display: flex; flex-direction: column; align-items: center; gap: 16px; max-width: 56rem; margin: 0 auto; text-align: center; }
.vv-blog-title { font-size: clamp(2rem, 5vw, 3.25rem); font-weight: 800; letter-spacing: -0.03em; line-height: 1.1; color: var(--ink); }
.vv-blog-sub { font-size: 1rem; line-height: 1.7; color: var(--ink-muted); max-width: 42rem; }
.vv-blog-controls { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; width: 100%; max-width: 46rem; margin-top: 14px; }
.vv-blog-search { position: relative; flex: 1 1 260px; min-width: 0; display: flex; align-items: center; }
.vv-blog-search svg { position: absolute; left: 16px; width: 18px; height: 18px; color: var(--ink-muted); pointer-events: none; }
.vv-blog-search input { width: 100%; padding: 14px 16px 14px 46px; font-size: 0.9rem; color: var(--ink); background: #ffffff; border: 1px solid var(--line); border-radius: var(--r-full); outline: none; transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
.vv-blog-search input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-tint); }
.vv-blog-counter { flex: 0 0 auto; padding: 12px 18px; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); border-radius: var(--r-full); white-space: nowrap; }
.vv-blog-filters { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 6px; }
body.vv-reader-open .vv-blog-hero,
body.vv-reader-open .vv-featured-wrap,
body.vv-reader-open .vv-news-section,
body.vv-reader-open .vv-newsletter-section,
body.vv-reader-open .vv-scan-cta-section { display: none !important; }
@media (max-width: 640px) {
.vv-blog-hero { padding: 2.5rem 0 1.75rem; }
.vv-blog-counter { width: 100%; text-align: center; }
}
```

##### Featured report
```html
<section class="vv-featured-wrap" id="vv-featured-wrap" hidden>
 <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <a href="#" class="vv-featured" id="vv-featured">
   <div class="vv-featured-thumb" id="vv-featured-thumb">
    <span class="vv-featured-badge">Featured Report</span>
   </div>
   <div class="vv-featured-body">
    <span class="vv-featured-eyebrow">Editor's Pick · Highest Priority</span>
    <h2 class="vv-featured-title" id="vv-featured-title">—</h2>
    <p class="vv-featured-excerpt" id="vv-featured-excerpt">—</p>
    <div class="vv-featured-meta" id="vv-featured-meta"></div>
    <span class="vv-featured-cta">
     Read Full Report
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
    </span>
   </div>
  </a>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
.vv-featured-wrap { padding: 3rem 0 0; }
.vv-featured { display: grid; grid-template-columns: 1fr 1.15fr; overflow: hidden; border-radius: var(--r-2xl); text-decoration: none; background: radial-gradient(90% 130% at 100% 0%, rgba(59, 153, 252, 0.22), transparent 60%), linear-gradient(135deg, var(--dark) 0%, #060a10 100%); border: 1px solid rgba(59, 153, 252, 0.28); box-shadow: 0 32px 70px -40px rgba(0, 0, 0, 0.7); transition: transform 0.3s var(--ease), box-shadow 0.3s var(--ease), border-color 0.3s var(--ease); }
.vv-featured:hover { transform: translateY(-3px); border-color: rgba(59, 153, 252, 0.55); box-shadow: 0 42px 84px -42px rgba(0, 0, 0, 0.85); }
.vv-featured-thumb { position: relative; aspect-ratio: 4 / 3; overflow: hidden; background: linear-gradient(150deg, var(--dark), #060a10); }
.vv-featured-thumb svg { position: absolute; inset: 0; width: 100%; height: 100%; transition: transform 0.7s var(--ease); }
.vv-featured:hover .vv-featured-thumb svg { transform: scale(1.05); }
.vv-featured-badge { position: absolute; top: 16px; left: 16px; padding: 6px 12px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: #04121f; background: linear-gradient(135deg, var(--brand-soft), var(--brand)); border-radius: var(--r-full); box-shadow: 0 12px 26px -14px var(--brand-glow); }
.vv-featured-body { display: flex; flex-direction: column; gap: 14px; padding: 34px 38px; }
.vv-featured-eyebrow { font-size: 10px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase; color: var(--brand); }
.vv-featured-title { font-size: clamp(1.3rem, 2.4vw, 1.9rem); font-weight: 800; letter-spacing: -0.02em; line-height: 1.25; color: #ffffff; }
.vv-featured-excerpt { font-size: 0.88rem; line-height: 1.72; color: #9aa8ba; }
.vv-featured-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; font-size: 11px; font-weight: 600; color: #7d8b9e; }
.vv-featured-cta { display: inline-flex; align-items: center; gap: 8px; margin-top: auto; padding-top: 6px; font-size: 0.8rem; font-weight: 800; color: var(--brand-soft); }
.vv-featured-cta svg { transition: transform 0.25s var(--ease); }
.vv-featured:hover .vv-featured-cta svg { transform: translateX(4px); }
.vv-featured .vv-chip--cat { color: var(--brand-soft); background: rgba(59, 153, 252, 0.14); border-color: rgba(59, 153, 252, 0.36); }
@media (max-width: 900px) {
.vv-featured { grid-template-columns: 1fr; }
.vv-featured-body { padding: 26px 22px; }
}
@media (prefers-reduced-motion: reduce) {
.vv-featured,
  .vv-featured-thumb svg,
  .vv-blog-pill,
  .vv-reader-back,
  .vv-empty-reset,
  .vv-newsletter-btn { transition: none !important; }
}
```

##### News list + filters + empty state
```html
<section class="vv-news-section" id="vv-news-section">
 <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <div class="vv-news-header">
   <div class="vv-news-header-title">
    <div class="flex items-center gap-2">
     <span class="h-[2px] w-6 bg-cyan-600 rounded-full"></span>
     <span class="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700" id="vv-news-eyebrow">ALL REPORTS</span>
    </div>
    <h2 id="vv-news-heading">From the VUNVAULT Newsroom</h2>
    <p id="vv-news-subheading">Browse every approved advisory, field report and analysis.</p>
   </div>
  </div>
  <div class="vv-news-grid" id="vv-news-grid"></div>
  <div class="vv-empty" id="vv-empty" hidden>
   <div class="vv-empty-icon" aria-hidden="true">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </div>
   <h3 class="vv-empty-title">No matching threat reports found</h3>
   <p class="vv-empty-text">Nothing in our current advisory set matches that query. Try a broader search term, switch categories, or clear the filters to see the full feed.</p>
   <button type="button" class="vv-empty-reset" id="vv-empty-reset">Clear Filters</button>
  </div>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
.vv-news-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px; align-items: stretch; }
@media (min-width: 1024px) {
.vv-news-grid { max-width: 76rem; margin-inline: auto; }
}
@media (max-width: 980px) {
.vv-news-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 680px) {
.vv-news-grid { grid-template-columns: 1fr; gap: 16px; }
}
.vv-news-section { padding: 3rem 0 3.5rem; background: var(--paper); }
.vv-news-header { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 22px; }
.vv-news-header-title { display: flex; flex-direction: column; gap: 6px; }
.vv-news-header-title h2 { font-size: 1.4rem; font-weight: 800; letter-spacing: -0.02em; color: var(--ink); }
.vv-news-header-title p { font-size: 0.8rem; color: var(--ink-muted); }
.vv-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 4rem 1.5rem; margin-top: 1.5rem; border-radius: var(--r-2xl); background: #ffffff; border: 1px dashed var(--line); text-align: center; }
.vv-empty-icon { display: flex; align-items: center; justify-content: center; width: 62px; height: 62px; border-radius: 50%; color: var(--brand); background: var(--brand-tint); border: 1px solid var(--brand-line); margin-bottom: 4px; }
.vv-empty-title { font-size: 1.15rem; font-weight: 800; letter-spacing: -0.02em; color: var(--ink); }
.vv-empty-text { font-size: 0.85rem; line-height: 1.65; color: var(--ink-muted); max-width: 34rem; }
.vv-empty-reset { margin-top: 8px; padding: 11px 22px; font-size: 0.75rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #ffffff; background: linear-gradient(135deg, var(--brand), var(--brand-strong)); border: 1px solid rgba(59, 153, 252, 0.45); border-radius: var(--r-full); cursor: pointer; transition: transform 0.22s var(--ease), filter 0.22s var(--ease); }
.vv-empty-reset:hover { transform: translateY(-1px); filter: brightness(1.07); }
@media (prefers-reduced-motion: reduce) {
}
```

##### Article reader (detail view)
```html
<section class="vv-reader" id="vv-article-reader" hidden>
 <div class="vv-reader-inner">
  <button type="button" class="vv-reader-back">
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
   <span>Back to News / All Reports</span>
  </button>
  <header class="vv-reader-header">
   <div class="vv-reader-cat-row" id="vv-reader-cat-row"></div>
   <h1 class="vv-reader-title" id="vv-reader-title">—</h1>
   <div class="vv-reader-meta" id="vv-reader-meta"></div>
  </header>
  <div class="vv-reader-hero" id="vv-reader-hero"></div>
  <div class="vv-reader-body" id="vv-reader-body"></div>
  <footer class="vv-reader-foot">
   <div class="vv-reader-tags" id="vv-reader-tags"></div>
   <button type="button" class="vv-reader-back">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Back to News / All Reports</span>
   </button>
  </footer>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
.vv-reader { padding: 3rem 0 5rem; }
.vv-reader-inner { max-width: 46rem; margin: 0 auto; padding: 0 1.5rem; }
.vv-reader-back { display: inline-flex; align-items: center; gap: 8px; padding: 9px 16px; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-soft); background: #ffffff; border: 1px solid var(--line); border-radius: var(--r-full); cursor: pointer; transition: color var(--dur) var(--ease), border-color var(--dur) var(--ease), background-color var(--dur) var(--ease), transform var(--dur) var(--ease); }
.vv-reader-back:hover,
.vv-reader-back:focus-visible { color: var(--brand-strong); border-color: var(--brand-line); background: var(--brand-tint); transform: translateX(-2px); outline: none; }
.vv-reader-back svg { transition: transform 0.22s var(--ease); }
.vv-reader-back:hover svg { transform: translateX(-3px); }
.vv-reader-header { margin-top: 28px; }
.vv-reader-cat-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.vv-reader-title { margin-top: 14px; font-size: clamp(1.75rem, 4vw, 2.75rem); font-weight: 800; letter-spacing: -0.03em; line-height: 1.15; color: var(--ink); }
.vv-reader-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 18px; padding-bottom: 22px; border-bottom: 1px solid var(--line-soft); font-size: 0.78rem; color: var(--ink-muted); }
.vv-reader-meta strong { font-weight: 700; color: var(--ink); }
.vv-reader-hero { position: relative; margin-top: 26px; aspect-ratio: 16 / 9; overflow: hidden; border-radius: var(--r-xl); background: linear-gradient(150deg, var(--dark), #060a10); border: 1px solid var(--line-soft); box-shadow: 0 24px 50px -34px rgba(10, 13, 18, 0.55); }
.vv-reader-hero svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.vv-reader-body { margin-top: 34px; font-size: 1rem; line-height: 1.85; color: #2d3748; }
.vv-reader-body > *:first-child { margin-top: 0; }
.vv-reader-body p { margin: 0 0 1.25em; }
.vv-reader-body h2 { margin: 2em 0 0.6em; font-size: 1.4rem; font-weight: 800; letter-spacing: -0.02em; color: var(--ink); }
.vv-reader-body h3 { margin: 1.6em 0 0.5em; font-size: 1.12rem; font-weight: 800; color: var(--ink); }
.vv-reader-body ul,
.vv-reader-body ol { margin: 0 0 1.25em; padding-left: 1.5em; list-style: disc; }
.vv-reader-body li { margin-bottom: 0.45em; }
.vv-reader-body code { padding: 2px 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.85em; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); border-radius: 5px; }
.vv-reader-body pre { padding: 16px 18px; margin: 0 0 1.25em; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.85rem; line-height: 1.6; color: #e2e8f0; background: #070b11; border: 1px solid rgba(59, 153, 252, 0.24); border-radius: var(--r-md); overflow-x: auto; }
.vv-reader-body blockquote { margin: 1.5em 0; padding: 4px 0 4px 18px; font-style: italic; color: var(--ink-soft); border-left: 3px solid var(--brand); }
.vv-reader-body a { color: var(--brand-strong); text-decoration: underline; text-underline-offset: 3px; }
.vv-reader-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; margin-top: 44px; padding-top: 26px; border-top: 1px solid var(--line-soft); }
.vv-reader-tags { display: flex; flex-wrap: wrap; gap: 6px; }
@media (max-width: 640px) {
.vv-reader-inner { padding: 0 1.1rem; }
.vv-reader-body { font-size: 0.95rem; }
}
@media (prefers-reduced-motion: reduce) {
}
```

##### Newsletter
```html
<section class="vv-newsletter-section">
 <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <div class="vv-newsletter">
   <div class="vv-newsletter-glow" aria-hidden="true"></div>
   <div class="vv-newsletter-body">
    <span class="vv-newsletter-eyebrow">Threat Advisory Newsletter</span>
    <h2 class="vv-newsletter-title">Get zero-day briefings before the exploit drops.</h2>
    <p class="vv-newsletter-text">Weekly context on weaponised CVEs, patch windows and adversary tradecraft — plus the sensor data behind each call. Written by the analysts who publish our advisories.</p>
   </div>
   <form class="vv-newsletter-form" id="vv-newsletter-form">
    <label class="sr-only" for="vv-newsletter-email">Email address</label>
    <input id="vv-newsletter-email" class="vv-newsletter-input" type="email" name="email" placeholder="you@company.com" autocomplete="email" required/>
    <button type="submit" class="vv-newsletter-btn">Subscribe</button>
   </form>
   <p class="vv-newsletter-note" id="vv-newsletter-note">No spam. Unsubscribe anytime. We only send threat intelligence.</p>
  </div>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
.vv-newsletter-section { padding: 3.5rem 0; }
.vv-newsletter { position: relative; overflow: hidden; display: grid; grid-template-columns: 1.35fr 1fr; gap: 30px; align-items: center; padding: 38px 40px; border-radius: var(--r-2xl); color: #ffffff; background: radial-gradient(80% 130% at 0% 100%, rgba(59, 153, 252, 0.28), transparent 60%), linear-gradient(135deg, var(--dark) 0%, #060a10 100%); border: 1px solid rgba(59, 153, 252, 0.28); box-shadow: 0 30px 60px -34px rgba(0, 0, 0, 0.6); }
.vv-newsletter-glow { position: absolute; top: -50%; left: -12%; width: 46%; height: 200%; background: radial-gradient(closest-side, var(--brand-glow), transparent 72%); filter: blur(70px); opacity: 0.5; pointer-events: none; }
.vv-newsletter-body { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 10px; }
.vv-newsletter-eyebrow { font-size: 10px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase; color: var(--brand); }
.vv-newsletter-title { font-size: clamp(1.3rem, 2.6vw, 1.85rem); font-weight: 800; letter-spacing: -0.02em; line-height: 1.2; color: #ffffff; }
.vv-newsletter-text { max-width: 46ch; font-size: 0.85rem; line-height: 1.7; color: #9aa8ba; }
.vv-newsletter-form { position: relative; z-index: 1; display: flex; flex-wrap: wrap; gap: 10px; }
.vv-newsletter-input { flex: 1 1 220px; min-width: 0; padding: 14px 18px; font-size: 0.88rem; color: #e2e8f0; background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(59, 153, 252, 0.28); border-radius: var(--r-full); outline: none; transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
.vv-newsletter-input::placeholder { color: #55637a; }
.vv-newsletter-input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(59, 153, 252, 0.18); }
.vv-newsletter-btn { flex: 0 0 auto; padding: 14px 26px; font-size: 0.78rem; font-weight: 800; letter-spacing: 0.04em; color: #04121f; background: linear-gradient(135deg, var(--brand-soft), var(--brand)); border: 1px solid rgba(255, 255, 255, 0.18); border-radius: var(--r-full); cursor: pointer; transition: transform 0.22s var(--ease), filter 0.22s var(--ease), box-shadow 0.22s var(--ease); box-shadow: 0 16px 34px -16px var(--brand-glow); }
.vv-newsletter-btn:hover { transform: translateY(-2px); filter: brightness(1.06); }
.vv-newsletter-btn:disabled { opacity: 0.65; cursor: default; transform: none; filter: none; }
.vv-newsletter-note { grid-column: 1 / -1; position: relative; z-index: 1; font-size: 0.7rem; color: #6b7a8d; letter-spacing: 0.02em; }
.vv-newsletter-note.is-ok { color: #34d399; }
.vv-newsletter-note.is-err { color: #fb7185; }
@media (max-width: 900px) {
.vv-newsletter { grid-template-columns: 1fr; padding: 28px 22px; }
}
@media (prefers-reduced-motion: reduce) {
}
```

**Data model change from the prototype (which read posts from `localStorage`):** all posts come from `GET /api/v1/content` and `GET /api/v1/content/:slug` (public).
- List: `usePublicContent({ q, category, sort, page, pageSize: 12 })`. Search input placeholder verbatim `Search reports, CVEs, vendors, categories…`; debounce 250 ms; the `Showing N reports` counter shows `total`. Category pills: `All` + one pill per `BLOG_CATEGORY_LABELS` value present in the loaded data (`role="tablist"`/`role="tab"`, `aria-selected`). Featured report = `sort=priority` first item (severity then newest), labelled `Featured Report` / `Editor's Pick · Highest Priority`, button `Read Full Report`. Section heading `ALL REPORTS` / `From the VUNVAULT Newsroom` / `Browse every approved advisory, field report and analysis.` Empty state (verbatim): title `No matching threat reports found`, body `Nothing in our current advisory set matches that query. Try a broader search term, switch categories, or clear the filters to see the full feed.`, button `Clear Filters`. Cards reuse `ArticleCard` from Task 49 plus a severity chip (`vv-chip--critical|high|medium|low`, text `CRITICAL|HIGH|MEDIUM|LOW`).
- Detail `/blog/[slug]` (`export const runtime = "edge"`): fetch on the server with `fetch(env.NEXT_PUBLIC_API_URL + "/api/v1/content/" + slug, { next: { revalidate: 60 } })`; 404 → `notFound()`; `generateMetadata` from the item (title, excerpt, OpenGraph image = `featuredImageUrl`). The reader shows the back link `Back to News / All Reports`, category, date, read time, author, tags, title, featured image and the body. **`bodyMd` is rendered with `SafeMarkdown`** — a tiny renderer supporting only: `##`/`###` headings, paragraphs, `-` lists, `>` quotes, `**bold**`, `*italic*`, `` `code` ``, `[text](https://…)` (links get `rel="noopener noreferrer nofollow"`), NO raw HTML, NO images; React elements only (never `dangerouslySetInnerHTML`). Unit-test it with an XSS string.
- Newsletter: RHF + Zod (`NewsletterSubscribeBody`); heading/body from `NEWSLETTER_COPY`; label `Email address`, placeholder `you@company.com`, button `Subscribe`, fine print `No spam. Unsubscribe anytime. We only send threat intelligence.`; on `202` toast `{ kind: "ok", title: "Check your inbox", message: "We sent a confirmation link to your email address." }` (planner-authored copy) — never reveal whether the address existed.
- `/newsletter/confirm?token=` page (in `(auth)` group, Task 63) completes the double opt-in.

**Tests:** search debounces and requests `q`; pills filter; empty state shows verbatim copy and `Clear Filters` resets; featured item is the CRITICAL one; reader renders markdown safely (a `<script>` and a `javascript:` link are inert); unknown slug → not-found; newsletter submit shows the toast and clears the field.

---

**Data shape (TypeScript):**
```ts
// PublicContentItem / PublicContentDetail: see contracts (Task 40b).
interface BlogFilters { q: string; category: BlogCategory | "all"; sort: "newest" | "priority" }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET  /api/v1/content?q=&category=&sort=newest|priority&page=&pageSize=12 → 200 { data: PublicContentItem[]; total }
// GET  /api/v1/content/:slug → 200 { data: PublicContentDetail } | 404 { error: "not_found" }
// POST /api/v1/newsletter body { email: string; source?: "blog" } → 202 {} | 400 | 429
```

---

**Out of scope:**
- Do not render raw HTML from the API.
- Do not use `localStorage`.
- Do not implement the confirm page (Task 63).
- Do not build the Studio (Task 72).

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm --filter web dev` renders the route(s) in this task with no console errors, and `pnpm --filter web test` passes (a smoke test per new component renders it and asserts the key verbatim strings).
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 56 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 57 — Contact page with secure request form

**Layer:** L6

**Prerequisites:** Task 40, Task 42, Task 44

**Estimated files touched:** 8

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Contact page with secure request form**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the Contact route: hero, category-aware secure request form posting to the public contact API, side information cards, and status banners.

**Deliverables:**
- `apps/web/src/app/(marketing)/contact/page.tsx`
- `apps/web/src/app/(marketing)/contact/_components/contact-hero.tsx`, `contact-form.tsx`, `contact-cards.tsx`
- `apps/web/src/app/(marketing)/contact/_hooks/use-contact.ts`
- `apps/web/src/app/(marketing)/contact/_styles/contact.css`
- `apps/web/src/mocks/handlers/contact.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- `apps/web/src/app/(marketing)/contact/contact.test.tsx`

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
- **Feature stylesheet exception:** the reference CSS blocks below come from the prototype. Reproduce them in the task's own `.css` file (listed in Deliverables), replacing every value that has a token with `var(--token)`. A colour with NO token (for example a one-off dark gradient stop) may stay as a literal ONLY inside that `.css` file; never in TSX.
- Prefer the Tailwind classes shown in the reference markup. Where the markup uses a custom class (`vv-*`, `hero-*`, `adm-*` …) implement it from the CSS block that follows it.
- Replace every `<svg data-icon="REPLACE-WITH-LUCIDE"/>` with the closest `lucide-react` icon (keep size classes); replace every `<a href>` to an internal route with `next/link`.
- Convert the markup to TSX: `class` → `className`, `for` → `htmlFor`, self-close void tags. Do NOT copy `href` values such as `*.html`; the routes shown (e.g. `/about`) are final.
- Text content is verbatim. Do not rewrite, shorten or "improve" any string.

---

**Visual specification (embedded copy + layout):**

**Reference markup (footer variant `contact`, dark):**

##### Contact hero
```html
<section class="relative pt-12 pb-10 md:pt-20 md:pb-14 overflow-hidden">
 <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <div class="text-center max-w-3xl mx-auto space-y-6">
   <span class="hero-eyebrow">Contact · Press · Disclosure</span>
   <h1 class="text-4xl sm:text-5xl md:text-6xl font-extrabold text-neutral-900 tracking-tight leading-[1.1]">Let’s secure your perimeter</h1>
   <p class="text-lg sm:text-xl text-neutral-500 font-normal max-w-2xl mx-auto leading-relaxed">Request a penetration test, report a vulnerability, apply for a Journalist / Blogger profile, or submit a confidential whistleblower tip — all from one place.</p>
   <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
    <a href="#contact-form" class="btn-get-started">Start a Request</a>
    <a href="#direct-channels" class="inline-flex items-center gap-2 px-6 py-4 rounded-full text-sm font-bold text-neutral-900 bg-white border border-neutral-200 hover:border-neutral-900 transition-colors">
     <span>Direct channels</span>
    </a>
   </div>
  </div>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
.hero-eyebrow { display: inline-block; padding: 7px 16px; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); border-radius: var(--r-full); }
.btn-get-started { display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 16px 42px; font-size: 0.95rem; font-weight: 700; letter-spacing: 0.02em; color: #ffffff; background: linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%); border-radius: var(--r-full); border: 1px solid rgba(59, 153, 252, 0.5); box-shadow: 0 14px 34px -14px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.25); transition: transform 0.25s var(--ease), box-shadow 0.25s var(--ease), filter 0.25s var(--ease); }
.btn-get-started::after { content: "→"; font-size: 1rem; transition: transform 0.25s var(--ease); }
.btn-get-started:hover { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 20px 44px -16px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.3); }
.btn-get-started:hover::after { transform: translateX(4px); }
.btn-get-started:active { transform: translateY(0) scale(0.98); }
@media (max-width: 768px) {
.btn-get-started { padding: 15px 34px; font-size: 0.9rem; }
}
.btn-get-started.vv-submit { padding: 14px 34px; font-size: 0.86rem; border: 0; }
.btn-get-started.vv-submit[disabled] { opacity: 0.6; cursor: not-allowed; transform: none; filter: none; }
```

##### Contact form + side cards
```html
<section id="contact" class="py-10 md:py-14 bg-paper border-t border-neutral-200/80">
 <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <div class="vv-contact-grid">
   <div class="glass-card rounded-3xl p-6 sm:p-8 border border-neutral-200/90 shadow-sm">
    <div class="flex items-center gap-2 mb-2">
     <span class="h-[2px] w-6 bg-cyan-600 rounded-full"></span>
     <span class="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">Secure Request Form</span>
    </div>
    <h2 class="text-2xl sm:text-3xl font-extrabold text-neutral-900 tracking-tight">Tell us what you need</h2>
    <p class="mt-3 text-sm text-neutral-500 leading-relaxed max-w-xl">Every submission is encrypted in transit and routed to the correct team. Journalist and blogger requests go through manual verification before any publishing rights are granted.</p>
    <form id="contact-form" class="mt-7 space-y-5">
     <div class="vv-form-row">
      <div class="vv-field">
       <label class="zero-day-label" for="cf-name">
        Full Name
        <span aria-hidden="true">*</span>
       </label>
       <input class="zero-day-input" id="cf-name" name="name" type="text" autocomplete="name" placeholder="Jane Wanjiru" required/>
      </div>
      [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Business Email ¦ * || Organization || Inquiry Category ¦ * ¦ Select a category… ¦ Penetration Testing Request ¦ Vulnerability / Bug Report ¦ Journalist / Blogger Profile Request ¦ Whistleblower Tip ¦ General Support]
      <div class="vv-field vv-field--full">
       <label class="zero-day-label" for="cf-subject">Subject</label>
       <input class="zero-day-input" id="cf-subject" name="subject" type="text" placeholder="Short summary of your request"/>
      </div>
      <div class="vv-field vv-field--full">
       <label class="zero-day-label" for="cf-message">
        Message Details
        <span aria-hidden="true">*</span>
       </label>
       <textarea class="zero-day-input" id="cf-message" name="message" placeholder="Scope, target environments, deadlines, or the details of your disclosure…" required></textarea>
      </div>
     </div>
     <label class="vv-check" for="cf-consent">
      <input type="checkbox" id="cf-consent" name="consent" required/>
      <span>I confirm I am authorised to submit this request and I accept the VUNVAULT privacy policy and responsible disclosure terms.</span>
     </label>
     <div class="vv-form-note" role="note">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      <span>
       <strong>Every submission is queued locally and reviewed in User & Access Management.</strong>
       Journalist / Blogger profile requests go through manual verification before any publishing rights are granted.
      </span>
     </div>
     <div class="vv-form-actions">
      <button type="submit" class="btn-get-started vv-submit" id="cf-submit">Send Secure Request</button>
      <span class="text-[11px] text-neutral-500 font-mono">TLS 1.3 · Nothing is stored on this device</span>
     </div>
     <div class="vv-status" id="cf-status" role="status" aria-live="polite"></div>
    </form>
   </div>
   <div id="direct-channels" class="space-y-5">
    <a href="mailto:support@vunvault.com" class="vv-channel glass-card border border-neutral-200/90">
     <span class="vv-channel-icon" aria-hidden="true">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
     </span>
     <span class="min-w-0">
      <span class="vv-channel-label">Email Support</span>
      <span class="vv-channel-value">support@vunvault.com</span>
      <span class="vv-channel-text">General enquiries, scoping calls and assessment scheduling. Typical first response within one business day.</span>
     </span>
    </a>
    <a href="https://wa.me/254705998032" target="_blank" rel="noopener noreferrer" class="vv-channel glass-card border border-neutral-200/90">
     <span class="vv-channel-icon" aria-hidden="true">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
     </span>
     <span class="min-w-0">
      <span class="vv-channel-label">WhatsApp</span>
      <span class="vv-channel-value">+254 705 998 032</span>
      <span class="vv-channel-text">Urgent incident response and active-breach escalation, monitored during Nairobi business hours.</span>
     </span>
    </a>
    <div class="glass-card rounded-3xl p-6 sm:p-7 border border-neutral-200/90">
     <div class="flex items-start gap-4">
      <span class="vv-channel-icon vv-channel-icon--dark" aria-hidden="true">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
      </span>
      <div class="min-w-0">
       <span class="vv-channel-label">Whistleblower & Security</span>
       <h3 class="mt-1 text-lg font-extrabold text-neutral-900 tracking-tight">Confidential tip submission</h3>
      </div>
     </div>
     <p class="vv-channel-text">
      Report a data breach, insider threat or systemic control failure. Encrypt your message with our public PGP key before sending, and we will never disclose your identity without explicit consent or a lawful order.
     </p>
     <div class="vv-pgp">
      <div>
       <div class="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Public PGP Key</div>
       <code>0x3B99FC12</code>
      </div>
      <a class="vv-pgp-dl" href="vunvault-pgp.asc">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       <span>Download key</span>
      </a>
     </div>
     <p class="mt-3 text-[11px] leading-relaxed text-neutral-500">
      Fingerprint:
      <code class="font-mono text-neutral-700">3B99 FC12 8A4D 55E0 91C7</code>
     </p>
    </div>
    [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Follow & Engage ¦ Threat briefings, zero-day commentary and open-source tooling. || Press & Publishing Workflow ¦ 01 ¦ Submit a ¦ Journalist / Blogger Profile Request ¦ using the form. ¦ 02 ¦ The request is routed to ¦ user-management.html ¦ for manual identity verification. ¦ 03 ¦ On approval, your account is upgraded to an authorised Journalist / Blogger profile. ¦ 04 ¦ Draft posts with embedded images or video and click ¦ Publish ¦ . ¦ 05 ¦ Posts enter the moderation queue in ¦ admin.html ¦ — nothing goes live immediately. ¦ 06 ¦ Once an admin approves, the article publishes to the blog and dynamic feeds. || Operational Info ¦ Based in ¦ Nairobi, Kenya ¦ Coverage ¦ Africa & worldwide ¦ Support hours ¦ Mon–Fri · 08:00–18:00 EAT ¦ Incident response ¦ 24 / 7 escalation line]
   </div>
  </div>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
@media (max-width: 768px) {
}
.vv-contact-grid { display: grid; grid-template-columns: minmax(0, 1.12fr) minmax(0, 0.88fr); gap: 26px; align-items: start; }
@media (max-width: 980px) {
.vv-contact-grid { grid-template-columns: 1fr; gap: 20px; }
}
.vv-form-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
@media (max-width: 640px) {
.vv-form-row { grid-template-columns: 1fr; }
}
.vv-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.vv-field--full { grid-column: 1 / -1; }
.vv-form-note { display: flex; align-items: flex-start; gap: 10px; margin-top: 4px; padding: 12px 14px; border-radius: var(--r-md); background: var(--brand-tint); border: 1px solid var(--brand-line); font-size: 0.72rem; line-height: 1.65; color: var(--ink-soft); }
.vv-form-note svg { flex: 0 0 auto; margin-top: 2px; color: var(--brand-strong); }
.vv-check { display: flex; align-items: flex-start; gap: 10px; font-size: 0.72rem; line-height: 1.6; color: var(--ink-muted); cursor: pointer; }
.vv-check input { flex: 0 0 auto; width: 16px; height: 16px; margin-top: 2px; accent-color: var(--brand); cursor: pointer; }
.vv-form-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; margin-top: 4px; }
.vv-status { display: none; align-items: flex-start; gap: 10px; padding: 14px 16px; border-radius: var(--r-md); font-size: 0.76rem; line-height: 1.65; border: 1px solid transparent; }
.vv-status.is-visible { display: flex; }
.vv-status svg { flex: 0 0 auto; margin-top: 2px; }
.vv-channel { display: flex; align-items: flex-start; gap: 18px; padding: 22px 22px; border-radius: var(--r-xl); transition: transform 0.25s var(--ease), border-color 0.25s var(--ease), box-shadow 0.25s var(--ease); }
a.vv-channel:hover,
      a.vv-channel:focus-visible { transform: translateY(-3px); border-color: var(--brand-line); box-shadow: 0 22px 46px -34px rgba(10, 13, 18, 0.45); outline: none; }
.vv-channel-icon { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 46px; height: 46px; border-radius: 14px; color: #ffffff; background: linear-gradient(135deg, var(--brand), var(--brand-strong)); box-shadow: 0 12px 26px -16px var(--brand-glow); }
.vv-channel-icon--dark { background: linear-gradient(135deg, var(--dark), #05070a); border: 1px solid rgba(59, 153, 252, 0.35); color: var(--brand-soft); }
.vv-channel-label { font-size: 10px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-faint); }
.vv-channel-value { margin-top: 5px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 1rem; font-weight: 800; color: var(--ink); word-break: break-word; transition: color 0.25s var(--ease); }
a.vv-channel:hover .vv-channel-value { color: var(--brand-strong); }
.vv-channel-text { margin-top: 8px; font-size: 0.76rem; line-height: 1.7; color: var(--ink-muted); }
.vv-pgp { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-top: 14px; padding: 12px 14px; border-radius: var(--r-md); background: var(--dark); border: 1px solid rgba(59, 153, 252, 0.28); }
.vv-pgp code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; color: var(--brand-soft); word-break: break-all; }
.vv-pgp-dl { display: inline-flex; align-items: center; gap: 7px; padding: 8px 14px; font-size: 0.68rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #04121f; background: linear-gradient(135deg, var(--brand-soft), var(--brand)); border-radius: var(--r-full); white-space: nowrap; transition: filter 0.22s var(--ease), transform 0.22s var(--ease); }
.vv-pgp-dl:hover { filter: brightness(1.07); transform: translateY(-1px); }
```

**Form (RHF + Zod `ContactBody`; field ids in the markup are `cf-*`):** fields `name` (placeholder `Jane Wanjiru`), `email` (`jane@company.co.ke`), `organization` (`Company, SACCO or newsroom`), `category` (select; options and order verbatim: `Penetration Testing Request`, `Vulnerability / Bug Report`, `Journalist / Blogger Profile Request`, `Whistleblower Tip`, `General Support` — map to the contract enum values `penetration_testing_request`, `vulnerability_report`, `journalist_blogger_profile_request`, `whistleblower_tip`, `general_support`), `subject` (`Short summary of your request`), `message` (placeholder from the markup), `consent` checkbox (text from the markup; required — message `"Consent is required"`), and a hidden honeypot field named `website` (visually hidden, `tabIndex={-1}`, `autoComplete="off"`; if filled, the API silently drops it). Pre-select the category from `?category=<enum value>` in the URL. Submit button label `Send Secure Request` (disabled + spinner while pending).

**Status banner (replaces the prototype's `localStorage` queue):** on `201` show an `ok` banner `Request received — reference <strong>REQ-XXXXXX</strong>.` followed by the category-specific sentence taken from the reference JS below, where `REQ-XXXXXX` = `REQ-` + the first 6 characters of the returned `id` uppercased; reset the form. On `400 validation_failed` show the error banner `Please complete every required field with a valid business email address before sending.`; on `429` show `Too many requests. Please wait a few minutes and try again.` (planner-authored); on network failure show `We could not send your request. Please email support@vunvault.com instead.` Banner uses `role="status"` (ok) / `role="alert"` (error).
Category success sentences (reference; replace the localStorage/queue wording with API wording — the sentences about being "queued in User & Access Management" become `An administrator will review it shortly.`):
```js
function setStatus(kind, html) {
 if (!statusEl) return;
 statusEl.className = "vv-status is-visible vv-status--" + kind;
 var icon = kind === "ok"
 ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>'
 : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>';
 statusEl.innerHTML = icon + "<span>" + html + "</span>";
 }
 function clearStatus() {
 if (!statusEl) return;
 statusEl.className = "vv-status";
 statusEl.innerHTML = "";
 }
 function markInvalid(el, invalid) {
 if (!el) return;
 el.classList.toggle("is-invalid", !!invalid);
 }
 form.addEventListener("submit", function (event) {
 event.preventDefault(); 
 clearStatus();
 var name = document.getElementById("cf-name");
 var email = document.getElementById("cf-email");
 var org = document.getElementById("cf-org");
 var subject = document.getElementById("cf-subject");
 var message = document.getElementById("cf-message");
 var consent = document.getElementById("cf-consent");
 var firstInvalid = null;
 var nameBad = !name.value.trim();
 var emailBad = !EMAIL_RE.test(email.value.trim());
 var catBad = !category.value;
 var messageBad = message.value.trim().length < 12;
 var consentBad = !consent.checked;
 markInvalid(name, nameBad); if (nameBad && !firstInvalid) firstInvalid = name;
 markInvalid(email, emailBad); if (emailBad && !firstInvalid) firstInvalid = email;
 markInvalid(category, catBad); if (catBad && !firstInvalid) firstInvalid = category;
 markInvalid(message, messageBad); if (messageBad && !firstInvalid) firstInvalid = message;
 if (nameBad || emailBad || catBad || messageBad || consentBad) {
 setStatus("err", "Please complete every required field with a valid business email address before sending.");
 if (firstInvalid && typeof firstInvalid.focus === "function") firstInvalid.focus();
 return;
 }
 var meta = CATEGORY_META[category.value] || { role: "Unspecified", roleSlug: "", label: category.value };
 var now = new Date();
var record = {
 id: makeRequestId(),
 name: name.value.trim(),
 email: email.value.trim(),
 organization: org ? org.value.trim() : "",
 role: meta.role,
 roleSlug: meta.roleSlug, // ← NEW: drives RBAC grant downstream
 category: category.value,
 categoryLabel: meta.label,
 subject: subject ? subject.value.trim() : "",
 message: message.value.trim(),
 submittedAt: utcStamp(now),
 submittedTs: now.getTime(),
 status: "Pending",
 decidedAt: ""
};
 var queue = readRequests();
 queue.unshift(record);
 if (queue.length > MAX_RECORDS) queue = queue.slice(0, MAX_RECORDS);
 if (!writeRequests(queue)) {
 setStatus("err",
 "Your browser blocked local storage, so the request could not be queued. " +
 "Please email <strong>support@vunvault.com</strong> instead.");
 return;
 }
 try {
 document.dispatchEvent(new CustomEvent("vunvault:access-request-created", { detail: record }));
 } catch (err) { }
 var routing = category.value === "journalist"
 ? "Your Journalist&nbsp;/&nbsp;Blogger profile request is now queued in " +
 "<strong>User &amp; Access Management</strong> for manual verification."
 : category.value === "whistleblower"
 ? "Your tip is queued for the confidential disclosure team. Encrypt follow-up " +
 "correspondence wi
/* …truncated by planner… */
```
The side cards (`Download key` PGP link, `Request a Report`, contact details) are in the markup; the PGP file link `vunvault-pgp.asc` → `/vunvault-pgp.asc` (static file the operator adds under `public/`; do not create it).

**Tests:** category preselect from the URL; required-field messages; honeypot included in the payload; success banner shows `REQ-` + 6 chars; 429 and network error banners; consent unchecked blocks submit with `Consent is required`.

---

**Data shape (TypeScript):**
```ts
// ContactBody: see contracts (Task 20). Honeypot `website` is client-only and sent as an extra field.
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/contact body { name; email; organization?; category; subject; message(10..5000); consent: true; website?: "" } → 201 { data: { id: string } } | 400 validation_failed | 429 rate_limited
```

---

**Out of scope:**
- Do not use `localStorage`.
- Do not implement the admin queue.
- Do not add CAPTCHA UI (the API supports Turnstile; enable it in a later hardening task).

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm --filter web dev` renders the route(s) in this task with no console errors, and `pnpm --filter web test` passes (a smoke test per new component renders it and asserts the key verbatim strings).
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 57 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 58 — Cookie consent banner (server-recorded)

**Layer:** L6

**Prerequisites:** Task 40, Task 42, Task 44

**Estimated files touched:** 8

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Cookie consent banner (server-recorded)**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the cookie consent banner with Accept All, Essential Only and a Customize panel, recorded through the consent API and mounted after the preloader.

**Deliverables:**
- `apps/web/src/app/(marketing)/_components/consent/consent-banner.tsx` — client.
- `apps/web/src/app/(marketing)/_components/consent/consent-store.ts` — Zustand store (in-memory) `{ decided, prefs }` + `ConsentProvider` reading `GET`-less state from a cookie flag.
- `apps/web/src/app/(marketing)/_hooks/use-record-consent.ts`
- `apps/web/src/app/(marketing)/_styles/consent.css`
- `apps/web/src/mocks/handlers/consent.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- MODIFY `apps/web/src/app/(marketing)/layout.tsx` — mount `<ConsentBanner />`.
- `apps/web/src/app/(marketing)/_components/consent/consent.test.tsx`

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
- **Feature stylesheet exception:** the reference CSS blocks below come from the prototype. Reproduce them in the task's own `.css` file (listed in Deliverables), replacing every value that has a token with `var(--token)`. A colour with NO token (for example a one-off dark gradient stop) may stay as a literal ONLY inside that `.css` file; never in TSX.
- Prefer the Tailwind classes shown in the reference markup. Where the markup uses a custom class (`vv-*`, `hero-*`, `adm-*` …) implement it from the CSS block that follows it.
- Replace every `<svg data-icon="REPLACE-WITH-LUCIDE"/>` with the closest `lucide-react` icon (keep size classes); replace every `<a href>` to an internal route with `next/link`.
- Convert the markup to TSX: `class` → `className`, `for` → `htmlFor`, self-close void tags. Do NOT copy `href` values such as `*.html`; the routes shown (e.g. `/about`) are final.
- Text content is verbatim. Do not rewrite, shorten or "improve" any string.

---

**Visual specification (embedded copy + layout):**

**Reference markup:**

##### Cookie consent banner
```html
<div class="vv-consent" id="vv-consent" role="dialog" aria-modal="true" aria-labelledby="vv-consent-title" aria-describedby="vv-consent-desc">
 <div class="vv-consent-backdrop" aria-hidden="true"></div>
 <div class="vv-consent-card" role="document">
  <span class="vv-consent-rule" aria-hidden="true"></span>
  <header class="vv-consent-head">
   <span class="vv-consent-eyebrow">
    <span class="vv-consent-eyebrow-dot" aria-hidden="true"></span>
    Privacy & Consent
   </span>
   <h2 class="vv-consent-title" id="vv-consent-title">We value your privacy</h2>
   <p class="vv-consent-desc" id="vv-consent-desc">
    VUNVAULT uses a small set of cookies to keep this site secure, remember your preferences and understand how our threat intelligence is used. Strictly necessary cookies are always active — everything else is your call.
   </p>
  </header>
  <ul class="vv-consent-chips" aria-label="Cookie categories at a glance">
   <li class="vv-consent-chip is-locked">
    Strictly Necessary
    <b>Always on</b>
   </li>
   <li class="vv-consent-chip">
    Analytics
    <b>Off</b>
   </li>
   <li class="vv-consent-chip">
    Marketing
    <b>Off</b>
   </li>
   <li class="vv-consent-chip">
    Functional
    <b>Off</b>
   </li>
  </ul>
  <section class="vv-consent-prefs" hidden aria-label="Cookie preferences">
   <div class="vv-pref">
    <div class="vv-pref-text">
     <h3 class="vv-pref-name">Strictly Necessary</h3>
     <p class="vv-pref-desc">Authentication, session integrity, CSRF protection and load balancing. Required for the site to function and cannot be disabled.</p>
    </div>
    <label class="vv-pref-switch vv-pref-switch--locked">
     <input type="checkbox" disabled aria-label="Strictly necessary cookies — always active"/>
     <span class="vv-pref-track" aria-hidden="true">
      <span class="vv-pref-knob"></span>
     </span>
     <span class="vv-pref-state">Always on</span>
    </label>
   </div>
   [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Analytics ¦ Aggregated, anonymised measurement of which advisories, courses and service pages are actually being used. ¦ Off || Marketing ¦ Used to measure campaign reach and avoid showing you the same security briefing twice. ¦ Off || Functional ¦ Remembers interface choices such as theme, dashboard layout and collapsed panels between visits. ¦ Off]
   <div class="vv-consent-prefs-actions">
    <button type="button" class="vv-consent-btn vv-consent-btn--ghost">Back</button>
    <button type="button" class="vv-consent-btn vv-consent-btn--primary">Save Preferences</button>
   </div>
  </section>
  <div class="vv-consent-actions">
   <button type="button" class="vv-consent-btn vv-consent-btn--primary">Accept All</button>
   <button type="button" class="vv-consent-btn vv-consent-btn--ghost">Essential Only</button>
   <button type="button" class="vv-consent-btn vv-consent-btn--link">Customize Preferences</button>
  </div>
  <footer class="vv-consent-foot">
   <span>
    Read our
    <a href="/privacy">Privacy Policy</a>
    &
    <a href="/cookie-policy">Cookie Policy</a>
    .
   </span>
   <span class="vv-consent-live" role="status" aria-live="polite"></span>
  </footer>
 </div>
</div>
```
Custom CSS for this markup (reference):
```css
.vv-consent { --vv-in: calc(var(--dur, 200ms) * 1.6); --vv-out: calc(var(--dur, 200ms) * 1.4); --vv-line: rgba(59, 153, 252, 0.28); --vv-ink: #e8eef6; --vv-muted: #9aa8ba; --vv-faint: #6b7a8d; position: fixed; inset: 0; z-index: 9990; display: flex; align-items: center; justify-content: center; padding: 24px; opacity: 0; visibility: hidden; transition: opacity var(--vv-in) var(--ease, cubic-bezier(0.4, 0, 0.2, 1)), visibility var(--vv-in) var(--ease, cubic-bezier(0.4, 0, 0.2, 1)); }
.vv-consent.is-visible { opacity: 1; visibility: visible; }
.vv-consent.is-leaving { opacity: 0; visibility: hidden; transition-duration: var(--vv-out); }
.vv-consent [hidden] { display: none !important; }
.vv-consent-backdrop { position: absolute; inset: 0; background: rgba(5, 7, 10, 0.72); backdrop-filter: blur(7px) saturate(1.2); -webkit-backdrop-filter: blur(7px) saturate(1.2); opacity: 0; transition: opacity var(--vv-in) var(--ease, cubic-bezier(0.4, 0, 0.2, 1)); }
.vv-consent.is-visible .vv-consent-backdrop { opacity: 1; }
.vv-consent-card { position: relative; width: min(660px, 100%); max-height: min(88vh, 760px); overflow-y: auto; padding: 30px 30px 26px; border-radius: var(--r-2xl, 28px); background: radial-gradient(110% 90% at 100% 0%, rgba(59, 153, 252, 0.16), transparent 58%), linear-gradient(160deg, #0d131c 0%, #05080d 100%); border: 1px solid var(--vv-line); box-shadow: 0 40px 90px -40px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.03) inset; opacity: 0; transform: translateY(18px) scale(0.985); transition: opacity var(--vv-in) var(--ease, cubic-bezier(0.4, 0, 0.2, 1)), transform var(--vv-in) var(--ease, cubic-bezier(0.4, 0, 0.2, 1)); }
.vv-consent.is-visible .vv-consent-card { opacity: 1; transform: translateY(0) scale(1); }
.vv-consent-card::-webkit-scrollbar { width: 8px; }
.vv-consent-card::-webkit-scrollbar-track { background: transparent; }
.vv-consent-card::-webkit-scrollbar-thumb { background: rgba(59, 153, 252, 0.28); border-radius: 9999px; border: 2px solid transparent; background-clip: padding-box; }
.vv-consent-card { scrollbar-width: thin; scrollbar-color: rgba(59, 153, 252, 0.35) transparent; }
.vv-consent-rule { position: absolute; top: 0; left: 12%; right: 12%; height: 2px; background: linear-gradient(90deg, transparent, var(--brand, var(--brand)), transparent); opacity: 0.9; pointer-events: none; }
.vv-consent-eyebrow { display: inline-flex; align-items: center; gap: 9px; font-size: 10px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase; color: var(--brand, var(--brand)); }
.vv-consent-eyebrow-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--brand, var(--brand)); box-shadow: 0 0 0 4px rgba(59, 153, 252, 0.16); animation: vvConsentPulse 2.2s var(--ease, cubic-bezier(0.4, 0, 0.2, 1)) infinite; }
.vv-consent-title { margin-top: 12px; font-size: clamp(1.3rem, 3.2vw, 1.65rem); font-weight: 800; letter-spacing: -0.02em; line-height: 1.25; color: #ffffff; }
.vv-consent-desc { margin-top: 10px; font-size: 0.85rem; line-height: 1.75; color: var(--vv-muted); max-width: 62ch; }
.vv-consent-chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 20px 0 0; padding: 0; list-style: none; }
.vv-consent-chip { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; font-size: 10.5px; font-weight: 600; color: #8d9aab; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.09); border-radius: var(--r-full, 9999px); transition: color var(--dur, 200ms) var(--ease, cubic-bezier(0.4, 0, 0.2, 1)), background-color var(--dur, 200ms) var(--ease, cubic-bezier(0.4, 0, 0.2, 1)), border-color var(--dur, 200ms) var(--ease, cubic-bezier(0.4, 0, 0.2, 1)); }
.vv-consent-chip b { font-size: 9px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--vv-faint); }
.vv-consent-chip.is-on { color: #cfe3ff; background: rgba(59, 153, 252, 0.1); border-color: rgba(59, 153, 252, 0.4); }
.vv-consent-chip.is-on b { color: var(--brand-soft, var(--brand-soft)); }
.vv-consent-chip.is-locked b { color: #34d399; }
.vv-consent-prefs { display: flex; flex-direction: column; gap: 12px; margin-top: 20px; animation: vvConsentPanel var(--dur, 200ms) var(--ease, cubic-bezier(0.4, 0, 0.2, 1)) both; }
.vv-pref { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; padding: 14px 16px; border-radius: var(--r-md, 14px); background: rgba(255, 255, 255, 0.035); border: 1px solid rgba(255, 255, 255, 0.07); transition: background-color var(--dur, 200ms) var(--ease, cubic-bezier(0.4, 0, 0.2, 1)), border-color var(--dur, 200ms) var(--ease, cubic-bezier(0.4, 0, 0.2, 1)); }
.vv-pref:hover { background: rgba(59, 153, 252, 0.05); border-color: rgba(59, 153, 252, 0.28); }
.vv-pref-text { min-width: 0; }
.vv-pref-name { font-size: 0.84rem; font-weight: 800; letter-spacing: -0.005em; color: var(--vv-ink); }
.vv-pref-desc { margin-top: 5px; font-size: 0.74rem; line-height: 1.65; color: #7d8b9e; max-width: 46ch; }
.vv-pref-switch { position: relative; flex: 0 0 auto; display: inline-flex; align-items: center; gap: 10px; cursor: pointer; user-select: none; -webkit-user-select: none; }
.vv-pref-switch--locked { cursor: default; }
.vv-pref-switch input { position: absolute; width: 1px; height: 1px; opacity: 0; margin: 0; pointer-events: none; }
.vv-pref-track { position: relative; display: block; width: 44px; height: 24px; border-radius: var(--r-full, 9999px); background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.14); transition: background-color var(--dur, 200ms) var(--ease, cubic-bezier(0.4, 0, 0.2, 1)), border-color var(--dur, 200ms) var(--ease, cubic-bezier(0.4, 0, 0.2, 1)), box-shadow var(--dur, 200ms) var(--ease, cubic-bezier(0.4, 0, 0.2, 1)); }
.vv-pref-knob { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #8d9aab; transition: transform var(--dur, 200ms) var(--ease, cubic-bezier(0.4, 0, 0.2, 1)), background-color var(--dur, 200ms) var(--ease, cubic-bezier(0.4, 0, 0.2, 1)); }
.vv-pref-switch input:checked + .vv-pref-track { background: linear-gradient(135deg, var(--brand, var(--brand)), var(--brand-strong, var(--brand-strong))); border-color: rgba(59, 153, 252, 0.6); }
.vv-pref-switch input:checked + .vv-pref-track .vv-pref-knob { transform: translateX(20px); background: #ffffff; }
.vv-pref-switch input:focus-visible + .vv-pref-track { box-shadow: 0 0 0 3px rgba(59, 153, 252, 0.3); }
.vv-pref-switch input:disabled + .vv-pref-track { opacity: 0.85; }
.vv-pref-state { min-width: 64px; text-align: right; font-size: 9.5px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--vv-faint); }
.vv-consent-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px; }
.vv-consent-prefs-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10px; margin-top: 4px; }
.vv-consent-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 13px 22px; font-size: 0.8rem; font-weight: 800; letter-spacing: 0.01em; line-height: 1; border-radius: var(--r-full, 9999px); border: 1px solid transparent; cursor: pointer; transition: transform var(--dur, 200ms) var(--ease, cubic-bezier(0.4, 0, 0.2, 1)), filter var(--dur, 200ms) var(--ease, cubic-bezier(0.4, 0, 0.2, 1)), color var(--dur, 200ms) var(--ease, cubic-bezier(0.4, 0, 0.2, 1)), background-color var(--dur, 200ms) var(--ease, cubic-bezier(0.4, 0, 0.2, 1)), border-color var(--dur, 200ms) var(--ease, cubic-bezier(0.4, 0, 0.2, 1)), box-shadow var(--dur, 200ms) var(--ease, cubic-bezier(0.4, 0, 0.2, 1)); }
.vv-consent-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(59, 153, 252, 0.45); }
.vv-consent-btn--primary { flex: 1 1 170px; color: #04121f; background: linear-gradient(135deg, var(--brand-soft, var(--brand-soft)), var(--brand, var(--brand))); box-shadow: 0 16px 34px -18px rgba(59, 153, 252, 0.75); }
.vv-consent-btn--primary:hover { transform: translateY(-2px); filter: brightness(1.06); }
.vv-consent-btn--primary:active { transform: translateY(0) scale(0.985); }
.vv-consent-btn--ghost { flex: 1 1 170px; color: #c3ccd8; background: rgba(255, 255, 255, 0.04); border-color: rgba(255, 255, 255, 0.14); }
.vv-consent-btn--ghost:hover { color: #ffffff; background: rgba(59, 153, 252, 0.1); border-color: rgba(59, 153, 252, 0.5); transform: translateY(-2px); }
.vv-consent-btn--link { flex: 1 1 100%; padding: 10px 8px; color: var(--brand-soft, var(--brand-soft)); background: transparent; text-decoration: underline; text-underline-offset: 4px; text-decoration-color: rgba(59, 153, 252, 0.35); }
.vv-consent-btn--link:hover { color: #ffffff; text-decoration-color: #ffffff; }
.vv-consent-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; margin-top: 20px; padding-top: 14px; border-top: 1px solid rgba(255, 255, 255, 0.08); font-size: 10.5px; line-height: 1.6; color: var(--vv-faint); }
.vv-consent-foot a { color: var(--vv-muted); text-decoration: underline; text-underline-offset: 3px; transition: color var(--dur, 200ms) var(--ease, cubic-bezier(0.4, 0, 0.2, 1)); }
.vv-consent-foot a:hover { color: var(--brand-soft, var(--brand-soft)); }
.vv-consent-live { font-weight: 700; color: var(--brand-soft, var(--brand-soft)); }
@media (max-width: 768px) {
.vv-consent { padding: 16px; }
.vv-consent-card { padding: 24px 20px 20px; border-radius: var(--r-xl, 24px); max-height: 92vh; }
.vv-pref { flex-direction: column; gap: 12px; }
.vv-pref-switch { align-self: flex-start; }
.vv-pref-desc { max-width: none; }
.vv-consent-btn--primary, .vv-consent-btn--ghost { flex: 1 1 100%; }
.vv-consent-foot { font-size: 10px; }
}
@media (max-width: 520px) {
.vv-consent { align-items: flex-end; padding: 0; }
.vv-consent-card { width: 100%; max-height: 88vh; border-radius: var(--r-xl, 24px) var(--r-xl, 24px) 0 0; border-bottom: 0; }
}
@media (prefers-reduced-motion: reduce) {
.vv-consent, .vv-consent-backdrop, .vv-consent-card, .vv-consent-prefs { transition-duration: 0.001ms !important; animation-duration: 0.001ms !important; }
.vv-consent-eyebrow-dot { animation: none !important; }
.vv-consent-card { transform: none !important; }
.vv-consent.is-visible .vv-consent-card { transform: none !important; }
}
@keyframes vvConsentPulse { 0%, 100% { box-shadow: 0 0 0 4px rgba(59, 153, 252, 0.16); } 50% { box-shadow: 0 0 0 8px rgba(59, 153, 252, 0.04); } }
@keyframes vvConsentPanel { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
```

**Behaviour (replaces the prototype's `sessionStorage` + `fetch(consent-banner.html)`):**
- Mount rules: show the banner after the `vunvault:preloader-done` event (Task 44) or after a 6 s fallback, unless the decision is already known. The decision is known when the API-set cookie `vv_consent` exists (HttpOnly is NOT used for this one: the API sets a readable cookie `vv_consent=1; Max-Age=31536000; SameSite=Lax; Secure` on `POST /api/v1/consent` — add this cookie to the Task 40 consent route as a one-line follow-up in your completion notes if it is missing; until then, read the 204 response as success and keep the decision in memory).
- Buttons (selectors as in the markup): `data-vv-consent='accept-all'` → record `{ strictlyNecessary: true, analytics: true, marketing: true, functional: true }`; the essential-only button → `{ strictlyNecessary: true, analytics: false, marketing: false, functional: false }`; `Customize` opens the preferences panel (hides the quick-actions row; first switch gets focus; `aria-live` region announces `Preference panel opened`), `Back` returns (`Returned to quick choices`); the Save button records the toggles. The `strictlyNecessary` switch is checked and disabled. Switch state text `On`/`Off` and the summary chips update live; announcements: `<Name> cookies enabled|disabled`.
- Recording: `POST /api/v1/consent` with `{ categories, policyVersion: "1" }` (constants `CONSENT_ACCEPT_ALL`, `CONSENT_ESSENTIAL_ONLY` from contracts); on success add class `is-leaving`, after 400 ms unmount and remove `vv-consent-open` from `body`; on error keep the banner open and show a toast `{ kind: "warn", title: "Could not save your choice", message: "Please try again." }`. Optimistically treat a network failure as undecided.
- Analytics/marketing scripts: none exist in v1 — expose `useConsent()` returning the in-memory prefs for future gating.
- A11y: the banner is `role="dialog"` non-modal with `aria-labelledby`; the first button is focused with `preventScroll`; Escape does NOT dismiss it (a choice is required).

**Tests:** appears after the preloader event; Accept All posts all-true; Essential Only posts only strictlyNecessary; Customize shows the panel and toggling `analytics` flips the chip text; Save posts the toggled values; the banner unmounts after success; the necessary switch is disabled.

---

**Data shape (TypeScript):**
```ts
interface ConsentBody { categories: { strictlyNecessary: true; analytics: boolean; marketing: boolean; functional: boolean }; policyVersion: string }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/consent body ConsentBody → 204 | 400 validation_failed | 429 rate_limited
```

---

**Out of scope:**
- Do not use `sessionStorage`/`localStorage`.
- Do not load any analytics scripts.
- Do not fetch the banner as an HTML file.

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm --filter web dev` renders the route(s) in this task with no console errors, and `pnpm --filter web test` passes (a smoke test per new component renders it and asserts the key verbatim strings).
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 58 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 59 — Login page

**Layer:** L7

**Prerequisites:** Task 8, Task 10, Task 11, Task 26, Task 40e, Task 42, Task 43

**Estimated files touched:** 9

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Login page**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the `/login` route: animated auth background, glass login card with OAuth buttons, validated email/password form, remember-me and the hand-off to the MFA challenge dialog.

**Deliverables:**
- `apps/web/src/app/(auth)/layout.tsx` — MODIFY: full-screen auth shell (renders `{children}` only; no marketing chrome).
- `apps/web/src/app/(auth)/login/page.tsx` — route (reads `?next=`, `?error=`, `?mfa=1`).
- `apps/web/src/app/(auth)/_components/auth-background.tsx`
- `apps/web/src/app/(auth)/_components/oauth-buttons.tsx` — shared with signup.
- `apps/web/src/app/(auth)/login/_components/login-card.tsx` (client)
- `apps/web/src/app/(auth)/login/_hooks/use-login.ts`
- `apps/web/src/app/(auth)/_styles/auth.css`
- `apps/web/src/mocks/handlers/auth.ts` — MODIFY only if a handler is missing.
- `apps/web/src/app/(auth)/login/login.test.tsx`

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
- **Feature stylesheet exception:** the reference CSS blocks below come from the prototype. Reproduce them in the task's own `.css` file (listed in Deliverables), replacing every value that has a token with `var(--token)`. A colour with NO token (for example a one-off dark gradient stop) may stay as a literal ONLY inside that `.css` file; never in TSX.
- Prefer the Tailwind classes shown in the reference markup. Where the markup uses a custom class (`vv-*`, `hero-*`, `adm-*` …) implement it from the CSS block that follows it.
- Replace every `<svg data-icon="REPLACE-WITH-LUCIDE"/>` with the closest `lucide-react` icon (keep size classes); replace every `<a href>` to an internal route with `next/link`.
- Convert the markup to TSX: `class` → `className`, `for` → `htmlFor`, self-close void tags. Do NOT copy `href` values such as `*.html`; the routes shown (e.g. `/about`) are final.
- Text content is verbatim. Do not rewrite, shorten or "improve" any string.

---

**Visual specification (embedded copy + layout):**

**Reference markup (the prototype page is a full-screen overlay; implement it as a normal route — the card is centred in `.vv-auth-overlay`). The OTP overlay inside this file is Task 60, not this task.**

##### Animated background
```html
<div class="vv-auth-bg" aria-hidden="true">
 <span class="vv-orb vv-orb--1"></span>
 <span class="vv-orb vv-orb--2"></span>
 <span class="vv-orb vv-orb--3"></span>
 <span class="vv-auth-grid"></span>
 <span class="vv-auth-scanline"></span>
</div>
```
Custom CSS for this markup (reference):
```css
.vv-auth-bg { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; background: radial-gradient(120% 90% at 15% 5%, rgba(59, 153, 252, 0.18), transparent 55%), radial-gradient(100% 80% at 85% 100%, rgba(111, 182, 255, 0.14), transparent 58%), linear-gradient(165deg, var(--dark) 0%, #05070a 55%, #000000 100%); }
.vv-orb { position: absolute; display: block; border-radius: 50%; filter: blur(90px); opacity: 0.55; will-change: transform; }
.vv-orb--1 { top: -18%; left: -10%; width: 46vw; height: 46vw; max-width: 620px; max-height: 620px; background: radial-gradient(closest-side, rgba(59, 153, 252, 0.75), transparent 72%); animation: vvOrbFloat 22s var(--ease) infinite; }
.vv-orb--2 { bottom: -22%; right: -12%; width: 52vw; height: 52vw; max-width: 680px; max-height: 680px; background: radial-gradient(closest-side, rgba(30, 123, 224, 0.7), transparent 72%); animation: vvOrbFloat 26s var(--ease) infinite reverse; }
.vv-orb--3 { top: 38%; right: 22%; width: 26vw; height: 26vw; max-width: 340px; max-height: 340px; background: radial-gradient(closest-side, rgba(111, 182, 255, 0.55), transparent 74%); animation: vvOrbFloat 18s var(--ease) infinite; animation-delay: -6s; }
.vv-auth-grid { position: absolute; inset: -20%; background-image: linear-gradient(to right, rgba(59, 153, 252, 0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(59, 153, 252, 0.10) 1px, transparent 1px); background-size: 64px 64px; transform: rotateX(62deg) translateZ(-120px) scale(1.6); transform-origin: 50% 60%; -webkit-mask-image: radial-gradient(60% 55% at 50% 50%, #000 0%, transparent 78%); mask-image: radial-gradient(60% 55% at 50% 50%, #000 0%, transparent 78%); opacity: 0.45; animation: vvGridDrift 6s linear infinite; }
.vv-auth-scanline { position: absolute; left: -20%; right: -20%; height: 40vh; top: -40vh; background: linear-gradient( to bottom, transparent, rgba(59, 153, 252, 0.07), transparent ); animation: vvAuthScan 9s linear infinite; }
@media (prefers-reduced-motion: reduce) {
.vv-orb,
  .vv-auth-grid,
  .vv-auth-scanline,
  .vv-spinner,
  .vv-success-ring,
  .vv-success-bar span { animation: none !important; }
}
@media print {
.vv-auth-bg,
  .vv-toast-stack { display: none !important; }
}
@keyframes vvOrbFloat { 0%, 100% { transform: translate3d(0, 0, 0) scale(1); } 33% { transform: translate3d(4%, -6%, 0) scale(1.08); } 66% { transform: translate3d(-5%, 4%, 0) scale(0.95); } }
@keyframes vvGridDrift { from { background-position: 0 0, 0 0; } to { background-position: 0 64px, 64px 0; } }
@keyframes vvAuthScan { 0% { transform: translateY(0); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateY(180vh); opacity: 0; } }
```

##### Login card
```html
<div class="vv-auth-card" id="vvLoginCard" role="dialog" aria-modal="true" aria-labelledby="vvLoginTitle">
 <header class="vv-auth-head">
  <span class="vv-brand">
   <span class="vv-brand-mark" aria-hidden="true">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </span>
   <span class="vv-brand-name">VUNVAULT</span>
  </span>
  <h1 class="vv-auth-title" id="vvLoginTitle">Welcome back</h1>
  <p class="vv-auth-sub">Sign in to access your security console.</p>
 </header>
 <div class="vv-social-grid" role="group" aria-label="Social sign in">
  <button type="button" class="vv-social-btn">
   <span class="vv-social-icon" aria-hidden="true">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </span>
   <span class="vv-social-label">Google</span>
  </button>
  [+2 more sibling <button> elements with the SAME structure as the one above; their text content in order: GitHub || Microsoft]
 </div>
 <div class="vv-divider" role="separator" aria-label="or">
  <span>OR</span>
 </div>
 <form class="vv-form" id="vvLoginForm" autocomplete="on">
  <div class="vv-field">
   <label class="vv-label" for="vvEmail">Email address</label>
   <div class="vv-input-wrap">
    <span class="vv-input-icon" aria-hidden="true">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
    </span>
    <input class="vv-input" id="vvEmail" name="email" type="email" inputmode="email" autocomplete="username" placeholder="you@company.com" aria-describedby="vvEmailError"/>
   </div>
   <p class="vv-error" id="vvEmailError" role="alert" aria-live="polite"></p>
  </div>
  <div class="vv-field">
   <div class="vv-field-row">
    <label class="vv-label" for="vvPassword">Password</label>
    <a class="vv-link" href="/forgot-password">Forgot Password?</a>
   </div>
   <div class="vv-input-wrap">
    <span class="vv-input-icon" aria-hidden="true">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
    </span>
    <input class="vv-input vv-input--pw" id="vvPassword" name="password" type="password" autocomplete="current-password" placeholder="Enter your password" aria-describedby="vvPasswordError"/>
    <button type="button" class="vv-eye" id="vvTogglePw" aria-label="Show password" aria-pressed="false" aria-controls="vvPassword">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
    </button>
   </div>
   <p class="vv-error" id="vvPasswordError" role="alert" aria-live="polite"></p>
  </div>
  <label class="vv-checkbox">
   <input type="checkbox" id="vvRemember" name="remember"/>
   <span class="vv-checkmark" aria-hidden="true">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </span>
   <span class="vv-checkbox-text">Keep me signed in on this device</span>
  </label>
  <button type="submit" class="vv-submit" id="vvSubmitBtn">
   <span class="vv-submit-label">Sign In</span>
   <span class="vv-spinner" aria-hidden="true"></span>
  </button>
 </form>
 <p class="vv-signup">
  Don’t have an account?
  <a href="/signup" class="vv-signup-link">Sign Up</a>
 </p>
 <p class="vv-legal">
  <svg data-icon="REPLACE-WITH-LUCIDE"/>
  Secured with 256-bit TLS · Zero-knowledge credential handling
 </p>
</div>
```
Custom CSS for this markup (reference):
```css
.vv-auth-card { position: relative; z-index: 1; width: 100%; max-width: var(--auth-card-w); padding: 38px 36px 30px; margin: auto; border-radius: var(--r-2xl); background: radial-gradient(120% 80% at 50% -10%, rgba(59, 153, 252, 0.14), transparent 60%), linear-gradient(165deg, rgba(16, 21, 29, 0.92), rgba(8, 11, 16, 0.96)); border: 1px solid var(--brand-line); box-shadow: 0 50px 100px -40px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.03) inset, 0 0 60px -30px var(--brand-glow); backdrop-filter: blur(20px) saturate(1.4); -webkit-backdrop-filter: blur(20px) saturate(1.4); animation: vvCardIn 0.55s var(--ease-out) both; transition: opacity 0.3s var(--ease), filter 0.3s var(--ease), transform 0.3s var(--ease); }
.vv-auth-card.is-dimmed { opacity: 0.35; filter: blur(3px); transform: scale(0.985); pointer-events: none; }
.vv-auth-card::before { content: ""; position: absolute; top: 0; left: 12%; right: 12%; height: 1px; background: linear-gradient(90deg, transparent, var(--brand), transparent); opacity: 0.75; border-radius: var(--r-full); pointer-events: none; }
.vv-auth-head { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; margin-bottom: 26px; }
.vv-brand { display: inline-flex; align-items: center; gap: 11px; margin-bottom: 14px; }
.vv-brand-mark { display: inline-flex; align-items: center; justify-content: center; width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(145deg, var(--dark), #000000); border: 1px solid rgba(59, 153, 252, 0.38); box-shadow: 0 0 0 1px rgba(59, 153, 252, 0.08), 0 8px 22px -12px var(--brand-glow); transition: transform var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
.vv-brand-mark svg { width: 22px; height: 22px; }
.vv-brand:hover .vv-brand-mark { transform: translateY(-2px); box-shadow: 0 0 0 1px rgba(59, 153, 252, 0.25), 0 12px 28px -14px var(--brand-glow); }
.vv-brand-name { font-size: 1.05rem; font-weight: 800; letter-spacing: 0.18em; color: #ffffff; text-shadow: 0 0 24px rgba(59, 153, 252, 0.35); }
.vv-auth-title { font-size: 1.6rem; font-weight: 800; letter-spacing: -0.02em; line-height: 1.2; color: var(--txt-1); }
.vv-auth-sub { font-size: 0.82rem; line-height: 1.6; color: var(--txt-3); }
.vv-social-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.vv-social-btn { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 10px; font-size: 0.78rem; font-weight: 600; letter-spacing: 0.01em; color: var(--txt-2); background: rgba(255, 255, 255, 0.04); border: 1px solid var(--line-glass); border-radius: var(--r-md); transition: background-color 0.22s var(--ease), border-color 0.22s var(--ease), color 0.22s var(--ease), transform 0.22s var(--ease), box-shadow 0.22s var(--ease); }
.vv-social-btn:hover { color: #ffffff; background: rgba(59, 153, 252, 0.10); border-color: var(--brand-line); transform: translateY(-2px); box-shadow: 0 14px 28px -18px var(--brand-glow); }
.vv-social-btn:active { transform: translateY(0) scale(0.98); }
.vv-social-btn:focus-visible { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(59, 153, 252, 0.22); }
.vv-social-icon { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 18px; height: 18px; }
.vv-social-icon svg { width: 18px; height: 18px; }
.vv-social-btn[data-vv-provider="GitHub"] .vv-social-icon { color: #e6edf3; }
.vv-social-label { white-space: nowrap; }
.vv-divider { display: flex; align-items: center; gap: 14px; margin: 22px 0; font-size: 10px; font-weight: 800; letter-spacing: 0.24em; text-transform: uppercase; color: var(--txt-4); }
.vv-divider::before,
.vv-divider::after { content: ""; flex: 1 1 auto; height: 1px; background: linear-gradient( 90deg, transparent, rgba(59, 153, 252, 0.30), transparent ); }
.vv-form { display: flex; flex-direction: column; gap: 16px; }
.vv-field { display: flex; flex-direction: column; gap: 7px; }
.vv-field-row { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.vv-label { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--txt-3); }
.vv-input-wrap { position: relative; display: flex; align-items: center; }
.vv-input-icon { position: absolute; left: 14px; display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; color: var(--txt-4); pointer-events: none; transition: color 0.22s var(--ease); }
.vv-input-wrap:focus-within .vv-input-icon { color: var(--brand); }
.vv-input { width: 100%; padding: 13px 14px 13px 42px; font-size: 0.86rem; font-weight: 500; color: var(--txt-1); background: rgba(5, 8, 13, 0.72); border: 1px solid var(--line-glass); border-radius: var(--r-md); outline: none; transition: border-color 0.22s var(--ease), box-shadow 0.22s var(--ease), background-color 0.22s var(--ease); }
.vv-input--pw { padding-right: 48px; letter-spacing: 0.02em; }
.vv-input::placeholder { color: var(--txt-4); font-weight: 400; }
.vv-input:hover { border-color: rgba(255, 255, 255, 0.16); }
.vv-input:focus { background: rgba(5, 8, 13, 0.95); border-color: var(--brand); box-shadow: 0 0 0 3px rgba(59, 153, 252, 0.18), 0 0 24px -12px var(--brand-glow); }
.vv-input:-webkit-autofill,
.vv-input:-webkit-autofill:hover,
.vv-input:-webkit-autofill:focus { -webkit-text-fill-color: var(--txt-1); -webkit-box-shadow: 0 0 0 1000px rgba(5, 8, 13, 0.98) inset; caret-color: var(--txt-1); border-color: var(--brand-line); transition: background-color 9999s ease-in-out 0s; }
.vv-input.is-invalid { border-color: var(--critical); box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.16); animation: vvShake 0.32s var(--ease); }
.vv-input.is-invalid + .vv-eye,
.vv-input-wrap:has(.vv-input.is-invalid) .vv-input-icon { color: var(--critical); }
.vv-eye { position: absolute; right: 8px; display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 9px; color: var(--txt-4); background: transparent; border: 1px solid transparent; transition: color 0.22s var(--ease), background-color 0.22s var(--ease), border-color 0.22s var(--ease); }
.vv-eye:hover { color: var(--brand-soft); background: rgba(59, 153, 252, 0.10); border-color: var(--brand-line); }
.vv-eye:focus-visible { color: var(--brand); border-color: var(--brand); box-shadow: 0 0 0 3px rgba(59, 153, 252, 0.20); }
.vv-eye svg { width: 17px; height: 17px; pointer-events: none; }
.vv-eye .vv-eye-off { display: none; }
.vv-eye.is-visible .vv-eye-on { display: none; }
.vv-eye.is-visible .vv-eye-off { display: block; }
.vv-error { font-size: 0.72rem; font-weight: 600; line-height: 1.5; color: #fb7185; padding-left: 2px; }
.vv-error:empty { display: none; }
.vv-link { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.02em; color: var(--brand-soft); border-radius: 4px; transition: color 0.2s var(--ease); }
.vv-link:hover { color: #ffffff; text-decoration: underline; text-underline-offset: 3px; }
.vv-link:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(59, 153, 252, 0.22); }
.vv-checkbox { display: flex; align-items: center; gap: 10px; margin-top: 2px; cursor: pointer; user-select: none; -webkit-user-select: none; }
.vv-checkbox input { position: absolute; opacity: 0; width: 0; height: 0; pointer-events: none; }
.vv-checkmark { position: relative; flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; color: transparent; background: rgba(5, 8, 13, 0.72); border: 1px solid var(--line-glass-strong); border-radius: 6px; transition: background-color 0.2s var(--ease), border-color 0.2s var(--ease), color 0.2s var(--ease), box-shadow 0.2s var(--ease); }
.vv-checkmark svg { width: 11px; height: 11px; opacity: 0; transform: scale(0.6); transition: opacity 0.18s var(--ease), transform 0.18s var(--ease); }
.vv-checkbox:hover .vv-checkmark { border-color: var(--brand-line); }
.vv-checkbox input:focus-visible + .vv-checkmark { border-color: var(--brand); box-shadow: 0 0 0 3px rgba(59, 153, 252, 0.20); }
.vv-checkbox input:checked + .vv-checkmark { color: #ffffff; background: linear-gradient(135deg, var(--brand), var(--brand-strong)); border-color: transparent; box-shadow: 0 6px 16px -10px var(--brand-glow); }
.vv-checkbox input:checked + .vv-checkmark svg { opacity: 1; transform: scale(1); }
.vv-checkbox-text { font-size: 0.76rem; line-height: 1.5; color: var(--txt-3); }
.vv-submit { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 10px; width: 100%; margin-top: 6px; padding: 14px 24px; font-size: 0.88rem; font-weight: 800; letter-spacing: 0.02em; color: #ffffff; background: linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%); border: 1px solid rgba(59, 153, 252, 0.5); border-radius: var(--r-md); box-shadow: 0 16px 36px -18px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.22); transition: transform 0.22s var(--ease), filter 0.22s var(--ease), box-shadow 0.22s var(--ease), opacity 0.22s var(--ease); }
.vv-submit:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.06); box-shadow: 0 22px 46px -20px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.28); }
.vv-submit:active:not(:disabled) { transform: translateY(0) scale(0.99); }
.vv-submit:focus-visible { box-shadow: 0 0 0 3px rgba(59, 153, 252, 0.35), 0 16px 36px -18px var(--brand-glow); }
.vv-submit:disabled { cursor: not-allowed; opacity: 0.65; }
.vv-submit-label { transition: opacity 0.2s var(--ease); }
.vv-spinner { position: absolute; right: 18px; width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.32); border-top-color: #ffffff; opacity: 0; animation: spin 0.7s linear infinite; transition: opacity 0.2s var(--ease); }
.vv-submit.is-loading { pointer-events: none; }
.vv-submit.is-loading .vv-submit-label { opacity: 0.72; }
.vv-submit.is-loading .vv-spinner { opacity: 1; }
.vv-signup { margin-top: 22px; text-align: center; font-size: 0.8rem; color: var(--txt-3); }
.vv-signup-link { margin-left: 5px; font-weight: 800; color: var(--brand-soft); border-radius: 4px; transition: color 0.2s var(--ease), text-shadow 0.2s var(--ease); }
.vv-signup-link:hover { color: #ffffff; text-shadow: 0 0 18px var(--brand-glow); text-decoration: underline; text-underline-offset: 3px; }
.vv-signup-link:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(59, 153, 252, 0.22); }
.vv-legal { display: flex; align-items: center; justify-content: center; gap: 7px; margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--line-glass); font-size: 0.68rem; font-weight: 600; letter-spacing: 0.03em; color: var(--txt-4); text-align: center; }
.vv-legal svg { flex: 0 0 auto; width: 12px; height: 12px; color: var(--ok); }
.vv-otp-view .vv-submit { margin-top: 20px; }
@media (max-width: 640px) {
.vv-auth-card { margin-top: 6vh; padding: 30px 24px 24px; border-radius: var(--r-xl); }
.vv-auth-title { font-size: 1.4rem; }
.vv-social-label { display: none; }
.vv-social-btn { padding: 13px 10px; }
.vv-social-icon,
  .vv-social-icon svg { width: 20px; height: 20px; }
}
@media (max-width: 420px) {
.vv-auth-card { margin-top: 3vh; padding: 26px 18px 22px; border-radius: var(--r-lg); }
.vv-auth-title { font-size: 1.25rem; }
.vv-auth-sub { font-size: 0.76rem; }
.vv-divider { margin: 18px 0; }
}
@media (max-height: 560px) and (orientation: landscape) {
.vv-auth-card { margin-top: 0; padding: 24px 26px 22px; }
.vv-brand { margin-bottom: 8px; }
.vv-auth-head { margin-bottom: 18px; }
}
@media (prefers-reduced-motion: reduce) {
.vv-auth-card,
  .vv-otp-card,
  .vv-toast { opacity: 1 !important; transform: none !important; }
}
@media print {
.vv-auth-card { box-shadow: none; border: 1px solid #ddd; background: #ffffff; color: #000; }
}
@keyframes spin { to { transform: rot
/* …truncated by planner; remaining rules follow the same patterns… */
```

**Form (RHF + Zod; NOT `useState` for values):** schema = `LoginBody` from `@vunvault/contracts` (`email`, `password`, `remember`). Validation messages (verbatim from the prototype where present; the password minimum follows the API contract, which is 8, not the prototype's 6): email empty → `Email address is required.`; malformed → `Enter a valid email address.`; password empty → `Password is required.`; shorter than 8 → `Password must be at least 8 characters.` (planner edit — the prototype said 6). Errors render in the `.vv-error` `<p role="alert" aria-live="polite">` under each field; invalid inputs get `aria-invalid="true"` and the `is-invalid` class. The eye button toggles `type="password"|"text"`, flips `aria-pressed` and `aria-label` between `Show password` / `Hide password`. `Forgot Password?` → `/forgot-password`; `Sign Up` → `/signup`.

**Submit flow:** button label `Sign In`, shows the spinner and `aria-busy` while pending. `POST /api/v1/auth/login`: (a) `mfaRequired: false` → `queryClient.setQueryData(queryKeys.session(), user)` then `router.replace(next ?? homeFor(role))` (open-redirect safe: `next` must start with a single `/`); (b) `mfaRequired: true` → open the MFA dialog (Task 60) via a small store `useMfaDialog().open({ email, methods, next })`; (c) `401 invalid_credentials` → toast `{ kind: "crit", title: "Sign-in failed", message: "Incorrect email or password." }` (planner copy; never say which one is wrong); (d) `429 rate_limited` → toast `{ kind: "warn", title: "Too many attempts", message: "Please wait a few minutes before trying again." }`. Query `?mfa=1` (returning from OAuth) opens the MFA dialog immediately with the methods `["totp", "webauthn"]` (the API exposes no method-list endpoint; an unavailable method simply fails with `mfa_failed`); `?error=` codes map to toasts: `oauth_state`/`oauth_denied` → `OAuth sign-in was cancelled or expired. Please try again.`; `oauth_email_unverified` → `Your provider account has no verified email address.`; `oauth_not_allowed` → `Staff accounts must sign in with email and password.`; `oauth_email_in_use` → `An account with this email already exists. Sign in with your password.`; `mfa_required` → `Multi-factor authentication is required for this account.`
**OAuth buttons (`Google`, `GitHub`, `Microsoft`):** `window.location.assign(env.NEXT_PUBLIC_API_URL + "/api/v1/auth/oauth/<provider>/start?next=" + encodeURIComponent(next))` (providers `google`, `github`, `microsoft`). Replace the prototype's `OAuth handshake would start here in production.` toast.
Footer lines verbatim: `Don’t have an account?` + `Sign Up`; `Secured with 256-bit TLS · Zero-knowledge credential handling` — NOTE (planner): the second line is marketing copy kept verbatim from the prototype; flag it to the product owner because the platform is not zero-knowledge.
Page: `metadata.title = "Sign in"`, `robots: { index: false }`. The card is `role="dialog" aria-modal="true" aria-labelledby="vvLoginTitle"` in the prototype — as a full page this is wrong; render it as `<main>` with `aria-labelledby` and NO dialog role.

**Tests:** empty submit shows both required messages; invalid email message; successful client login navigates to `/portal`; `next=/portal/billing` honoured, `next=//evil.com` ignored; MFA response opens the dialog store; OAuth button builds the exact start URL; eye toggle updates aria; `?error=oauth_not_allowed` shows the toast text.

---

**Data shape (TypeScript):**
```ts
interface LoginBody { email: string; password: string; remember?: boolean }
type LoginResponse = { data: { user: SessionUser | null; mfaRequired: boolean; mfaMethods: ("totp" | "webauthn" | "email_otp")[] } };
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/auth/login body { email; password: string(min8); remember?: boolean } → 200 LoginResponse | 401 { error: "invalid_credentials" } | 429 { error: "rate_limited" }
// GET  /api/v1/auth/oauth/:provider/start?next=<path> → 302 (browser navigation, not fetch)
```

---

**Out of scope:**
- Do not build the MFA dialog (Task 60).
- Do not store anything in browser storage — `remember` is sent to the API, which sets a 30-day cookie.
- Do not add a forgot-password page here (Task 63).

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm --filter web dev` renders the route(s) in this task with no console errors, and `pnpm --filter web test` passes (a smoke test per new component renders it and asserts the key verbatim strings).
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 59 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 60 — MFA challenge dialog: authenticator code, security key, email code, recovery code

**Layer:** L7

**Prerequisites:** Task 11, Task 26, Task 27, Task 59

**Estimated files touched:** 10

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **MFA challenge dialog: authenticator code, security key, email code, recovery code**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the verification dialog shown after a password login (or OAuth return) that completes MFA with TOTP, WebAuthn, email OTP or a recovery code.

**Deliverables:**
- `apps/web/src/app/(auth)/login/_components/mfa-dialog.tsx` (client)
- `apps/web/src/app/(auth)/login/_components/otp-input.tsx` — six-box input (reused by Task 62).
- `apps/web/src/app/(auth)/login/_hooks/use-mfa.ts` — verify / email-otp / recovery / webauthn hooks.
- `apps/web/src/app/(auth)/login/_lib/webauthn-client.ts` — browser WebAuthn helpers.
- `apps/web/src/app/(auth)/login/_store/mfa-dialog-store.ts` — Zustand store used by Task 59.
- MODIFY `apps/web/src/app/(auth)/_styles/auth.css` — append OTP rules.
- MODIFY `apps/web/src/app/(auth)/login/page.tsx` — mount `<MfaDialog/>` (do NOT edit `login-card.tsx`; Task 59 already calls the store).
- `apps/web/src/app/(auth)/login/mfa.test.tsx`

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
- **Feature stylesheet exception:** the reference CSS blocks below come from the prototype. Reproduce them in the task's own `.css` file (listed in Deliverables), replacing every value that has a token with `var(--token)`. A colour with NO token (for example a one-off dark gradient stop) may stay as a literal ONLY inside that `.css` file; never in TSX.
- Prefer the Tailwind classes shown in the reference markup. Where the markup uses a custom class (`vv-*`, `hero-*`, `adm-*` …) implement it from the CSS block that follows it.
- Replace every `<svg data-icon="REPLACE-WITH-LUCIDE"/>` with the closest `lucide-react` icon (keep size classes); replace every `<a href>` to an internal route with `next/link`.
- Convert the markup to TSX: `class` → `className`, `for` → `htmlFor`, self-close void tags. Do NOT copy `href` values such as `*.html`; the routes shown (e.g. `/about`) are final.
- Text content is verbatim. Do not rewrite, shorten or "improve" any string.

---

**Visual specification (embedded copy + layout):**

**Reference markup (OTP overlay from the prototype):**

##### OTP overlay (verification dialog, error + success views)
```html
<div class="vv-otp-overlay" id="vvOtpOverlay" hidden>
 <div class="vv-otp-card" id="vvOtpCard" role="dialog" aria-modal="true" aria-labelledby="vvOtpTitle">
  <button type="button" class="vv-otp-close" id="vvOtpClose" aria-label="Close verification">
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
  </button>
  <div class="vv-otp-view" id="vvOtpView">
   <span class="vv-otp-icon" aria-hidden="true">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </span>
   <h2 class="vv-otp-title" id="vvOtpTitle">Verify it’s you</h2>
   <p class="vv-otp-sub">
    Enter the 6-digit code we sent to
    <strong id="vvOtpTarget">your email</strong>
   </p>
   <form id="vvOtpForm" autocomplete="off">
    <div class="vv-otp-inputs" id="vvOtpInputs" role="group" aria-label="6 digit verification code">
     <input class="vv-otp-digit" type="text" inputmode="numeric" maxlength="1" autocomplete="one-time-code" aria-label="Digit 1"/>
     [+5 more sibling <input> elements with the SAME structure as the one above; their text content in order: || || || || ]
    </div>
    <p class="vv-error vv-error--center" id="vvOtpError" role="alert" aria-live="polite"></p>
    <button type="submit" class="vv-submit" id="vvOtpSubmit">
     <span class="vv-submit-label">Verify OTP</span>
     <span class="vv-spinner" aria-hidden="true"></span>
    </button>
   </form>
   <div class="vv-otp-foot">
    <span class="vv-otp-foot-text">Didn’t get the code?</span>
    <button type="button" class="vv-link-btn" id="vvResend">Resend code</button>
    <span class="vv-otp-timer" id="vvTimer" aria-live="polite"></span>
   </div>
   <button type="button" class="vv-back" id="vvBackToLogin">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    Back to sign in
   </button>
  </div>
  <div class="vv-otp-view vv-otp-success" id="vvOtpSuccess" hidden>
   <span class="vv-success-ring" aria-hidden="true">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </span>
   <h2 class="vv-otp-title">Identity verified</h2>
   <p class="vv-otp-sub">Redirecting you to your dashboard…</p>
   <div class="vv-success-bar">
    <span></span>
   </div>
  </div>
 </div>
</div>
```
Custom CSS for this markup (reference):
```css
.vv-error { font-size: 0.72rem; font-weight: 600; line-height: 1.5; color: #fb7185; padding-left: 2px; }
.vv-error:empty { display: none; }
.vv-error--center { text-align: center; padding-left: 0; margin-top: 12px; }
.vv-submit { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 10px; width: 100%; margin-top: 6px; padding: 14px 24px; font-size: 0.88rem; font-weight: 800; letter-spacing: 0.02em; color: #ffffff; background: linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%); border: 1px solid rgba(59, 153, 252, 0.5); border-radius: var(--r-md); box-shadow: 0 16px 36px -18px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.22); transition: transform 0.22s var(--ease), filter 0.22s var(--ease), box-shadow 0.22s var(--ease), opacity 0.22s var(--ease); }
.vv-submit:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.06); box-shadow: 0 22px 46px -20px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.28); }
.vv-submit:active:not(:disabled) { transform: translateY(0) scale(0.99); }
.vv-submit:focus-visible { box-shadow: 0 0 0 3px rgba(59, 153, 252, 0.35), 0 16px 36px -18px var(--brand-glow); }
.vv-submit:disabled { cursor: not-allowed; opacity: 0.65; }
.vv-submit-label { transition: opacity 0.2s var(--ease); }
.vv-spinner { position: absolute; right: 18px; width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.32); border-top-color: #ffffff; opacity: 0; animation: spin 0.7s linear infinite; transition: opacity 0.2s var(--ease); }
.vv-submit.is-loading { pointer-events: none; }
.vv-submit.is-loading .vv-submit-label { opacity: 0.72; }
.vv-submit.is-loading .vv-spinner { opacity: 1; }
.vv-otp-overlay { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 24px 20px; background: rgba(3, 5, 8, 0.78); backdrop-filter: blur(22px) saturate(1.3); -webkit-backdrop-filter: blur(22px) saturate(1.3); opacity: 0; visibility: hidden; transition: opacity 0.28s var(--ease), visibility 0.28s var(--ease); overflow-y: auto; overscroll-behavior: contain; }
.vv-otp-overlay.is-open { opacity: 1; visibility: visible; }
.vv-otp-card { position: relative; width: 100%; max-width: 420px; margin: auto; padding: 34px 32px 28px; border-radius: var(--r-2xl); background: radial-gradient(120% 80% at 50% -10%, rgba(59, 153, 252, 0.16), transparent 60%), linear-gradient(165deg, rgba(16, 21, 29, 0.96), rgba(8, 11, 16, 0.98)); border: 1px solid var(--brand-line); box-shadow: 0 50px 100px -40px rgba(0, 0, 0, 0.95), 0 0 0 1px rgba(255, 255, 255, 0.03) inset, 0 0 60px -30px var(--brand-glow); backdrop-filter: blur(20px) saturate(1.4); -webkit-backdrop-filter: blur(20px) saturate(1.4); transform: translateY(14px) scale(0.98); transition: transform 0.32s var(--ease-out); }
.vv-otp-overlay.is-open .vv-otp-card { transform: translateY(0) scale(1); }
.vv-otp-card::before { content: ""; position: absolute; top: 0; left: 12%; right: 12%; height: 1px; background: linear-gradient(90deg, transparent, var(--brand), transparent); opacity: 0.75; border-radius: var(--r-full); pointer-events: none; }
.vv-otp-card.vv-shake { animation: vvShakeStrong 0.42s var(--ease); }
.vv-otp-close { position: absolute; top: 14px; right: 14px; display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 9px; color: var(--txt-4); background: transparent; border: 1px solid transparent; transition: color 0.2s var(--ease), background-color 0.2s var(--ease), border-color 0.2s var(--ease); }
.vv-otp-close:hover { color: #ffffff; background: rgba(244, 63, 94, 0.12); border-color: rgba(244, 63, 94, 0.35); }
.vv-otp-close:focus-visible { color: var(--brand); border-color: var(--brand); box-shadow: 0 0 0 3px rgba(59, 153, 252, 0.22); }
.vv-otp-view { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 4px; animation: vvFadeUp 0.35s var(--ease-out) both; }
.vv-otp-icon { display: inline-flex; align-items: center; justify-content: center; width: 60px; height: 60px; margin-bottom: 16px; border-radius: 50%; color: var(--brand); background: radial-gradient(closest-side, rgba(59, 153, 252, 0.22), transparent 72%), rgba(59, 153, 252, 0.08); border: 1px solid var(--brand-line); box-shadow: 0 0 34px -12px var(--brand-glow); }
.vv-otp-icon svg { width: 26px; height: 26px; }
.vv-otp-title { font-size: 1.35rem; font-weight: 800; letter-spacing: -0.02em; color: var(--txt-1); }
.vv-otp-sub { margin-top: 8px; font-size: 0.82rem; line-height: 1.65; color: var(--txt-3); max-width: 34ch; }
.vv-otp-sub strong { color: var(--brand-soft); font-weight: 700; }
.vv-otp-inputs { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 9px; width: 100%; margin-top: 24px; }
.vv-otp-digit { width: 100%; aspect-ratio: 1 / 1.15; min-width: 0; padding: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 1.4rem; font-weight: 800; text-align: center; color: var(--txt-1); background: rgba(5, 8, 13, 0.75); border: 1px solid var(--line-glass-strong); border-radius: var(--r-md); outline: none; caret-color: var(--brand); transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease), background-color 0.2s var(--ease), transform 0.2s var(--ease), color 0.2s var(--ease); }
.vv-otp-digit:hover:not(:disabled) { border-color: rgba(255, 255, 255, 0.20); }
.vv-otp-digit:focus { background: rgba(5, 8, 13, 0.98); border-color: var(--brand); box-shadow: 0 0 0 3px rgba(59, 153, 252, 0.20), 0 0 28px -12px var(--brand-glow); transform: translateY(-2px); }
.vv-otp-digit.is-filled { color: #ffffff; border-color: var(--brand-line); background: rgba(59, 153, 252, 0.10); }
.vv-otp-digit.is-error { color: #fb7185; border-color: var(--critical); background: rgba(244, 63, 94, 0.10); box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.16); animation: vvShake 0.32s var(--ease); }
.vv-otp-digit.is-ok { color: #34d399; border-color: rgba(16, 185, 129, 0.5); background: rgba(16, 185, 129, 0.10); box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.14); }
.vv-otp-digit:disabled { cursor: default; opacity: 0.85; }
.vv-otp-view form { width: 100%; }
.vv-otp-view .vv-submit { margin-top: 20px; }
.vv-otp-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 6px 10px; margin-top: 20px; font-size: 0.76rem; color: var(--txt-3); }
.vv-otp-foot-text { white-space: nowrap; }
.vv-link-btn { padding: 4px 2px; font-size: 0.76rem; font-weight: 800; color: var(--brand-soft); background: transparent; border: 0; border-radius: 6px; transition: color 0.2s var(--ease), text-shadow 0.2s var(--ease); }
.vv-link-btn:hover:not(:disabled) { color: #ffffff; text-shadow: 0 0 16px var(--brand-glow); text-decoration: underline; text-underline-offset: 3px; }
.vv-link-btn:disabled { color: var(--txt-4); cursor: not-allowed; text-decoration: none; text-shadow: none; }
.vv-link-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(59, 153, 252, 0.22); }
.vv-otp-timer { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.72rem; font-weight: 700; color: var(--txt-4); white-space: nowrap; }
.vv-otp-timer:empty { display: none; }
.vv-back { display: inline-flex; align-items: center; gap: 7px; margin-top: 20px; padding: 8px 12px; font-size: 0.74rem; font-weight: 700; color: var(--txt-3); background: transparent; border: 1px solid transparent; border-radius: var(--r-full); transition: color 0.2s var(--ease), background-color 0.2s var(--ease), border-color 0.2s var(--ease); }
.vv-back svg { transition: transform 0.2s var(--ease); }
.vv-back:hover { color: #ffffff; background: rgba(59, 153, 252, 0.10); border-color: var(--brand-line); }
.vv-back:hover svg { transform: translateX(-3px); }
.vv-back:focus-visible { color: var(--brand); border-color: var(--brand); box-shadow: 0 0 0 3px rgba(59, 153, 252, 0.22); }
.vv-otp-success { animation: vvFadeUp 0.4s var(--ease-out) both; }
.vv-success-ring { display: inline-flex; align-items: center; justify-content: center; width: 72px; height: 72px; margin-bottom: 18px; border-radius: 50%; color: #ffffff; background: linear-gradient(135deg, var(--ok), #059669); box-shadow: 0 0 0 8px rgba(16, 185, 129, 0.12), 0 20px 44px -18px rgba(16, 185, 129, 0.75); animation: vvSuccessPop 0.5s var(--ease-out) both; }
.vv-success-ring svg { width: 30px; height: 30px; }
.vv-otp-success .vv-otp-title { color: #ffffff; }
.vv-success-bar { position: relative; width: 100%; height: 3px; margin-top: 24px; border-radius: var(--r-full); background: rgba(255, 255, 255, 0.08); overflow: hidden; }
.vv-success-bar span { position: absolute; inset: 0 auto 0 0; display: block; width: 0; border-radius: var(--r-full); background: linear-gradient(90deg, var(--brand-strong), var(--brand-soft)); box-shadow: 0 0 14px var(--brand-glow); animation: vvSuccessBar 1.4s var(--ease) forwards; }
@media (max-widt
/* …truncated by planner; remaining rules follow the same patterns… */
```

**Prototype behaviour to port (reference JS; keep the six-box UX: auto-advance, backspace goes back, paste of 6 digits fills all boxes, arrow keys move focus, only digits accepted; drop the "test OTP" toasts and console logging — those were dev scaffolding and must NOT exist):**
```js
otpOverlay = document.getElementById("vvOtpOverlay");
 var otpCard = document.getElementById("vvOtpCard");
 var otpForm = document.getElementById("vvOtpForm");
 var otpView = document.getElementById("vvOtpView");
 var otpSuccess = document.getElementById("vvOtpSuccess");
 var otpInputs = Array.prototype.slice.call(document.querySelectorAll("[data-vv-otp-digit]"));
 var otpError = document.getElementById("vvOtpError");
 var otpTarget = document.getElementById("vvOtpTarget");
 var otpSubmit = document.getElementById("vvOtpSubmit");
 var otpClose = document.getElementById("vvOtpClose");
 var backToLogin = document.getElementById("vvBackToLogin");
 var resendBtn = document.getElementById("vvResend");
 var timerEl = document.getElementById("vvTimer");
 var toastStack = document.getElementById("vvToastStack");
 var generatedOtp = null;
 var resendCooldown = null;
 var lastFocused = null;
 var RESEND_SECONDS = 30;
 function generateOtp() {
 if (window.crypto && window.crypto.getRandomValues) {
 var buf = new Uint32Array(1);
 window.crypto.getRandomValues(buf);
 return String(100000 + (buf[0] % 900000));
 }
 return String(Math.floor(100000 + Math.random() * 900000));
 }
 function maskEmail(value) {
 var at = value.indexOf("@");
 if (at < 1) return value;
 var name = value.slice(0, at);
 var domain = value.slice(at);
 var head = name.slice(0, Math.min(2, name.length));
 return head + "•".repeat(Math.max(1, name.length - 2)) + domain;
 }
 function setLoading(button, isLoading) {
 if (!button) return;
 button.classList.toggle("is-loading", isLoading);
 button.disabled = isLoading;
 }
 function clearErrors() {
 emailErr.textContent = "";
 pwErr.textContent = "";
 emailInput.classList.remove("is-invalid");
 pwInput.classList.remove("is-invalid");
 }
 pwToggle.addEventListener("click", function () {
 var showing = pwInput.type === "text";
 pwInput.type = showing ? "password" : "text";
 pwToggle.classList.toggle("is-visible", !showing);
 pwToggle.setAttribute("aria-pressed", String(!showing));
 pwToggle.setAttribute("aria-label", showing ? "Show password" : "Hide password");
 pwInput.focus({ preventScroll: true });
 });
 function showToast(options) {
 var opts = options || {};
 var toast = document.createElement("div");
 toast.className = "vv-toast" + (opts.variant ? " vv-toast--" + opts.variant : "");
 var iconSvg = opts.variant === "success"
 ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
 : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
 var html = ''
 + '<span class="vv-toast-icon" aria-hidden="true">' + iconSvg + '</span>'
 + '<div class="vv-toast-body">'
 + '<div class="vv-toast-title">' + (opts.title || "Notice") + '</div>'
 + (opts.message ? '<div class="vv-toast-msg">' + opts.message + '</div>' : '')
 + (opts.code
 ? '<div class="vv-toast-code-row">'
 + '<code class="vv-toast-code">' + opts.code + '</code>'
 + '<button type="button" class="vv-toast-copy" data-vv-copy="' + opts.code + '">Copy</button>'
 + '</div>'
 : '')
 + '</div>'
 + '<button type="button" class="vv-toast-close" aria-label="Dismiss notification">'
 + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
 + '</button>';
 toast.innerHTML = html;
 toastStack.appendChild(toast);
 requestAnimationFrame(function () {
 requestAnimationFrame(function () { toast.classList.add("is-in"); });
 });
 var lifetime = opts.duration || 16000;
 var killTimer = window.setTimeout(dismiss, lifetime);
 function dismiss() {
 window.clearTimeout(killTimer);
 toast.classList.remove("is-in");
 toast.classList.add("is-out");
 window.setTimeout(function () {
 if (toast.parentNode) toast.parentNode.removeChild(toast);
 }, 380);
 }
 toast.querySelector(".vv-toast-close").addEventListener("click", dismiss);
 var copyBtn = toast.querySelector("[data-vv-copy]");
 if (copyBtn) {
 copyBtn.addEventListener("click", function () {
 var value = copyBtn.getAttribute("data-vv-copy");
 var done = function () {
 copyBtn.textContent = "Copied";
 copyBtn.classList.add("is-copied");
 window.setTimeout(function () {
 copyBtn.textContent = "Copy";
 copyBtn.classList.remove("is-copied");
 }, 1800);
 };
 if (navigator.clipboard && navigator.clipboard.writeText) {
 navigator.clipboard.writeText(value).then(done).catch(done);
 } else {
 done();
 }
 });
 }
 return dismiss;
 }
 function openOtpModal() {
 lastFocused = document.activeElement;
 otpView.hidden = false;
 otpSuccess.hidden = true;
 otpError.textContent = "";
 resetOtpInputs();
 otpOverlay.hidden = false;
 loginCard.classList.add("is-dimmed");
 document.body.classList.add("vv-modal-open");
 void otpOverlay.offsetWidth;
 otpOverlay.classList.add("is-open");
 window.setTimeout(function () {
 if (otpInputs[0]) otpInputs[0].focus();
 }, 180);
 }
 function closeOtpModal() {
 otpOverlay.classList.remov
/* …truncated by planner… */
```
**Real behaviour:** the dialog uses the `Dialog` primitive semantics of the markup (`role="dialog"`, `aria-modal`, `aria-labelledby="vvOtpTitle"`, focus trap, Escape closes and clears the store; closing calls nothing on the API — the challenge cookie simply expires). Title `Verify it’s you`; the subtitle names the method: email → `Enter the 6-digit code we sent to <strong>{masked email}</strong>`; TOTP → `Enter the 6-digit code from your authenticator app.`; recovery → `Enter one of your 12-character recovery codes (XXXX-XXXX-XXXX).`; security key → `Insert or tap your security key when prompted.` (the last three are planner-authored). A method switcher (links under the form: `Use authenticator app`, `Use security key`, `Email me a code` (staff only), `Use a recovery code`) shows only the methods the login response offered. Default method order: `webauthn` (auto-prompts once), else `totp`, else `email_otp`.
- **TOTP / email OTP:** `POST /api/v1/auth/mfa/verify` body `{ method, code }`; incorrect → show the verbatim error `Incorrect code. Please check the digits and try again.` and shake the boxes (`prefers-reduced-motion`: no shake); `Please enter all 6 digits.` when incomplete; `410 challenge_expired` → close and toast `{ kind: "warn", title: "Session expired", message: "Please sign in again." }`; five failures → the API deletes the challenge: same toast. Email method: on open call `POST /api/v1/auth/mfa/email-otp` (202), `Resend` link calls it again with a 60 s cooldown showing `Resend in {n}s`. 
- **Security key:** `POST /api/v1/auth/mfa/webauthn/options` → `navigator.credentials.get({ publicKey })` (decode base64url fields; encode the assertion back) → `POST /api/v1/auth/mfa/verify` `{ method: "webauthn", assertion }`; user cancel → stay on the dialog with `Security key request was cancelled.`
- **Recovery code:** `POST /api/v1/auth/mfa/recovery` `{ code }`; format-validate `^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$` after uppercasing/stripping spaces.
- **Success view (verbatim):** title `Verification successful`, text `Redirecting to VUNVAULT…`; then `queryClient.setQueryData(session)` and `router.replace(next ?? homeFor(role))`. Staff whose session is still `aal1` (recovery login) are sent to `/login?error=mfa_required`.

**Tests:** digits-only input, paste of `123456` fills six boxes and submits once; backspace navigation; wrong code shows the verbatim error; success shows the success view then navigates; method switch hides unavailable methods; Escape closes; resend cooldown with fake timers; WebAuthn path calls the options endpoint (mock `navigator.credentials`).

---

**Data shape (TypeScript):**
```ts
type MfaMethod = "totp" | "webauthn" | "email_otp" | "recovery";
interface MfaDialogState { open: boolean; email: string; methods: MfaMethod[]; next?: string; show(i: { email: string; methods: MfaMethod[]; next?: string }): void; close(): void }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/auth/mfa/verify body { method: "totp"|"email_otp"; code: string(6) } | { method: "webauthn"; assertion: unknown } → 200 { data: SessionUser } | 401 { error: "mfa_failed" } | 410 { error: "challenge_expired" }
// POST /api/v1/auth/mfa/email-otp → 202 {} | 429
// POST /api/v1/auth/mfa/webauthn/options → 200 { data: PublicKeyCredentialRequestOptionsJSON }
// POST /api/v1/auth/mfa/recovery body { code: string(XXXX-XXXX-XXXX) } → 200 { data: SessionUser } | 401 mfa_failed
```

---

**Out of scope:**
- Do not log or display test OTPs anywhere.
- Do not edit the login card (Task 59).
- Do not store codes in browser storage.

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm --filter web dev` renders the route(s) in this task with no console errors, and `pnpm --filter web test` passes (a smoke test per new component renders it and asserts the key verbatim strings).
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 60 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 61 — Signup page A: details form, validation, strength meter

**Layer:** L7

**Prerequisites:** Task 10, Task 40d, Task 42, Task 59

**Estimated files touched:** 9

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Signup page A: details form, validation, strength meter**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the `/signup` route and its details form; submitting starts the verified signup (verification dialog is Task 62).

**Deliverables:**
- `apps/web/src/app/(auth)/signup/page.tsx`
- `apps/web/src/app/(auth)/signup/_components/signup-card.tsx` (client)
- `apps/web/src/app/(auth)/signup/_components/password-strength.tsx`
- `apps/web/src/app/(auth)/signup/_hooks/use-signup.ts`
- `apps/web/src/app/(auth)/signup/_store/signup-store.ts` — in-memory `{ email, fullName }` shared with Task 62.
- `apps/web/src/app/(auth)/_styles/signup.css`
- `apps/web/src/app/(auth)/signup/signup-a.test.tsx`
- MODIFY `apps/web/src/app/(auth)/signup/page.tsx` — also mount `<SignupVerifyDialog/>` imported from `./_components/signup-verify-dialog` (create a null stub here; Task 62 overwrites it).

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
- **Feature stylesheet exception:** the reference CSS blocks below come from the prototype. Reproduce them in the task's own `.css` file (listed in Deliverables), replacing every value that has a token with `var(--token)`. A colour with NO token (for example a one-off dark gradient stop) may stay as a literal ONLY inside that `.css` file; never in TSX.
- Prefer the Tailwind classes shown in the reference markup. Where the markup uses a custom class (`vv-*`, `hero-*`, `adm-*` …) implement it from the CSS block that follows it.
- Replace every `<svg data-icon="REPLACE-WITH-LUCIDE"/>` with the closest `lucide-react` icon (keep size classes); replace every `<a href>` to an internal route with `next/link`.
- Convert the markup to TSX: `class` → `className`, `for` → `htmlFor`, self-close void tags. Do NOT copy `href` values such as `*.html`; the routes shown (e.g. `/about`) are final.
- Text content is verbatim. Do not rewrite, shorten or "improve" any string.

---

**Visual specification (embedded copy + layout):**

**Reference markup:**

##### Background layer
```html
<div class="bg-layer" aria-hidden="true">
 <div class="bg-grid"></div>
 <div class="bg-orb bg-orb--1"></div>
 <div class="bg-orb bg-orb--2"></div>
 <div class="bg-orb bg-orb--3"></div>
 <div class="bg-wire">
  <span class="wire wire--nav"></span>
  <span class="wire wire--hero"></span>
  <span class="wire wire--a"></span>
  <span class="wire wire--b"></span>
  <span class="wire wire--c"></span>
  <span class="wire wire--d"></span>
 </div>
</div>
```
Custom CSS for this markup (reference):
```css
.bg-layer { position: fixed; inset: 0; z-index: 0; overflow: hidden; background: radial-gradient(120% 90% at 12% 0%, rgba(59, 153, 252, 0.18), transparent 55%), radial-gradient(110% 85% at 100% 100%, rgba(59, 153, 252, 0.14), transparent 62%), linear-gradient(160deg, var(--dark) 0%, #070a0f 52%, #04060a 100%); }
.bg-grid { position: absolute; inset: -12%; background-image: linear-gradient(to right, rgba(59, 153, 252, 0.11) 1px, transparent 1px), linear-gradient(to bottom, rgba(59, 153, 252, 0.11) 1px, transparent 1px); background-size: 58px 58px; -webkit-mask-image: radial-gradient(66% 62% at 50% 45%, #000 10%, transparent 80%); mask-image: radial-gradient(66% 62% at 50% 45%, #000 10%, transparent 80%); animation: gridDrift 22s linear infinite; }
.bg-orb { position: absolute; border-radius: 50%; filter: blur(90px); opacity: 0.5; pointer-events: none; }
.bg-orb--1 { top: -12%; left: -8%; width: 520px; height: 520px; background: radial-gradient(closest-side, rgba(59, 153, 252, 0.55), transparent 72%); animation: orbFloat 16s ease-in-out infinite; }
.bg-orb--2 { bottom: -18%; right: -10%; width: 620px; height: 620px; background: radial-gradient(closest-side, rgba(30, 123, 224, 0.45), transparent 72%); animation: orbFloat 20s ease-in-out infinite reverse; }
.bg-orb--3 { top: 38%; left: 58%; width: 380px; height: 380px; background: radial-gradient(closest-side, rgba(111, 182, 255, 0.28), transparent 72%); animation: orbFloat 24s ease-in-out infinite; }
.bg-wire { position: absolute; inset: 0; pointer-events: none; opacity: 0.55; }
.wire { position: absolute; border: 1px solid rgba(59, 153, 252, 0.22); border-radius: 16px; background: rgba(255, 255, 255, 0.02); }
.wire--nav { top: 4%; left: 6%; width: 88%; height: 56px; }
.wire--hero { top: 16%; left: 6%; width: 52%; height: 210px; }
.wire--a { top: 16%; left: 62%; width: 32%; height: 96px; }
.wire--b { top: 34%; left: 62%; width: 32%; height: 96px; }
.wire--c { top: 58%; left: 6%; width: 40%; height: 150px; }
.wire--d { top: 58%; left: 50%; width: 44%; height: 150px; }
@media (prefers-reduced-motion: reduce) {
.bg-orb, .bg-grid { animation: none !important; }
}
@keyframes gridDrift { from { background-position: 0 0, 0 0; } to { background-position: 0 58px, 58px 0; } }
@keyframes orbFloat { 0%, 100% { transform: translate3d(0, 0, 0) scale(1); } 50% { transform: translate3d(24px, -34px, 0) scale(1.08); } }
```

##### Signup card
```html
<main class="card" role="dialog" aria-modal="true" aria-labelledby="signupTitle">
 <div class="card-head">
  <div class="brand-mark">
   <span class="brand-tile">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </span>
   <span class="brand-name">VUNVAULT</span>
  </div>
  <h1 class="card-title" id="signupTitle">Create your account</h1>
  <p class="card-sub">Join the platform that finds the cracks before they do.</p>
 </div>
 <div class="social-grid">
  <button type="button" class="social-btn">
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
   <span>Google</span>
  </button>
  [+2 more sibling <button> elements with the SAME structure as the one above; their text content in order: GitHub || Microsoft]
 </div>
 <div class="divider">or</div>
 <form class="form" id="signupForm" autocomplete="on">
  <div class="field">
   <label for="fullName">Full name</label>
   <input class="input" type="text" id="fullName" name="fullName" placeholder="Jane Wanjiru" autocomplete="name"/>
   <span class="err"></span>
  </div>
  <div class="field-row">
   <div class="field">
    <label for="phone">Phone number</label>
    <input class="input" type="tel" id="phone" name="phone" placeholder="+254 705 998 032" autocomplete="tel"/>
    <span class="err"></span>
   </div>
   <div class="field">
    <label for="country">Country</label>
    <select class="input" id="country" name="country" required>
     <option value disabled>Select country…</option>
     <option value="KE">Kenya</option>
     <option value="UG">Uganda</option>
     <option value="TZ">Tanzania</option>
     <option value="RW">Rwanda</option>
     <option value="NG">Nigeria</option>
     <option value="GH">Ghana</option>
     <option value="ZA">South Africa</option>
     <option value="EG">Egypt</option>
     <option value="ET">Ethiopia</option>
     <option value="US">United States</option>
     <option value="GB">United Kingdom</option>
     <option value="CA">Canada</option>
     <option value="DE">Germany</option>
     <option value="FR">France</option>
     <option value="IN">India</option>
     <option value="AE">United Arab Emirates</option>
     <option value="AU">Australia</option>
     <option value="OTHER">Other</option>
    </select>
    <span class="err"></span>
   </div>
  </div>
  <div class="field">
   <span class="field-label">Account type</span>
   <div class="radio-row">
    <label class="radio-card">
     <input type="radio" name="accountType" value="Individual"/>
     <span class="radio-body">
      <span class="radio-dot" aria-hidden="true"></span>
      <span class="radio-text">
       <span class="radio-title">Individual</span>
       <span class="radio-sub">Personal account</span>
      </span>
     </span>
    </label>
    <label class="radio-card">
     <input type="radio" name="accountType" value="Company"/>
     <span class="radio-body">
      <span class="radio-dot" aria-hidden="true"></span>
      <span class="radio-text">
       <span class="radio-title">Company</span>
       <span class="radio-sub">Team / organisation</span>
      </span>
     </span>
    </label>
   </div>
  </div>
  [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Email address || Password ¦ — || Confirm password]
  <button type="submit" class="btn-primary" id="signupBtn">
   <span>Sign Up</span>
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
  </button>
  <p class="legal">
   By creating an account you agree to our
   <a href="#">Terms of Service</a>
   and
   <a href="#">Privacy Policy</a>
   .
  </p>
 </form>
 <div class="card-foot">
  Already have an account?
  <a href="/login">Log in</a>
 </div>
 <div class="secure-note">
  <svg data-icon="REPLACE-WITH-LUCIDE"/>
  256-bit encrypted · 2FA protected
 </div>
</main>
```
Custom CSS for this markup (reference):
```css
.card { position: relative; width: min(500px, 100%); padding: 32px 32px 26px; border-radius: var(--r-2xl); background: linear-gradient(180deg, #ffffff 0%, #fdfefe 100%); border: 1px solid rgba(59, 153, 252, 0.18); box-shadow: 0 50px 100px -45px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.05) inset, 0 0 70px -40px var(--brand-glow); animation: cardIn 0.5s var(--ease) both; }
.card::before { content: ""; position: absolute; top: 0; left: 12%; right: 12%; height: 1px; background: linear-gradient(90deg, transparent, var(--brand), transparent); opacity: 0.7; border-radius: var(--r-full); }
.card-head { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; margin-bottom: 24px; }
.brand-mark { display: inline-flex; align-items: center; gap: 10px; }
.brand-tile { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; background: linear-gradient(145deg, var(--dark), #000); border: 1px solid rgba(59, 153, 252, 0.35); box-shadow: 0 8px 22px -12px var(--brand-glow); }
.brand-tile svg { width: 20px; height: 20px; }
.brand-name { font-size: 1.05rem; font-weight: 800; letter-spacing: 0.16em; color: var(--ink); }
.card-title { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em; color: var(--ink); }
.card-sub { font-size: 0.84rem; line-height: 1.6; color: var(--ink-muted); max-width: 34ch; }
.social-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.social-btn { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 11px 8px; font-size: 0.78rem; font-weight: 700; color: var(--ink); background: #ffffff; border: 1px solid var(--line); border-radius: var(--r-md); transition: transform 0.2s var(--ease), border-color 0.2s var(--ease), box-shadow 0.2s var(--ease), background-color 0.2s var(--ease); }
.social-btn:hover { transform: translateY(-2px); border-color: var(--brand-line); background: #fbfdff; box-shadow: 0 14px 28px -20px rgba(10, 13, 18, 0.6); }
.social-btn:active { transform: translateY(0) scale(0.985); }
.social-btn svg { width: 17px; height: 17px; flex: 0 0 auto; }
.social-btn span { white-space: nowrap; }
.divider { display: flex; align-items: center; gap: 14px; margin: 22px 0; font-size: 10.5px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-faint); }
.divider::before,
.divider::after { content: ""; flex: 1 1 auto; height: 1px; background: linear-gradient(90deg, transparent, var(--line), transparent); }
.form { display: flex; flex-direction: column; gap: 15px; }
.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.field label,
.field-label { font-size: 10.5px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-muted); }
.input,
select.input { width: 100%; padding: 12px 14px; font-family: inherit; font-size: 0.88rem; color: var(--ink); background: #ffffff; border: 1px solid var(--line); border-radius: var(--r-md); outline: none; transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease), background-color 0.2s var(--ease); }
.input::placeholder { color: var(--ink-faint); }
.input:hover { border-color: #d4d4d4; }
.input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-tint); background: #ffffff; }
.input.is-invalid { border-color: var(--critical); box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.14); animation: shake 0.32s var(--ease); }
select.input { appearance: none; -webkit-appearance: none; padding-right: 38px; background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%233B99FC' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 13px center; cursor: pointer; }
select.input:invalid { color: var(--ink-faint); }
.pw-wrap .input { padding-right: 48px; }
.err { font-size: 0.72rem; font-weight: 600; color: var(--critical); min-height: 0; opacity: 0; transform: translateY(-3px); transition: opacity 0.2s var(--ease), transform 0.2s var(--ease); }
.err.is-visible { opacity: 1; transform: translateY(0); }
.radio-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.radio-card { position: relative; display: block; cursor: pointer; }
.radio-card input { position: absolute; opacity: 0; width: 0; height: 0; pointer-events: none; }
.radio-body { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: 1px solid var(--line); border-radius: var(--r-md); background: #ffffff; transition: border-color 0.2s var(--ease), background-color 0.2s var(--ease), box-shadow 0.2s var(--ease); }
.radio-card:hover .radio-body { border-color: #d4d4d4; }
.radio-dot { flex: 0 0 auto; width: 16px; height: 16px; border-radius: 50%; border: 1.5px solid #cfcfcf; background: #ffffff; position: relative; transition: border-color 0.2s var(--ease); }
.radio-dot::after { content: ""; position: absolute; inset: 3px; border-radius: 50%; background: var(--brand); transform: scale(0); transition: transform 0.2s var(--ease); }
.radio-text { display: flex; flex-direction: column; min-width: 0; }
.radio-title { font-size: 0.82rem; font-weight: 700; color: var(--ink); line-height: 1.3; }
.radio-sub { font-size: 0.68rem; color: var(--ink-faint); line-height: 1.4; }
.radio-card input:checked + .radio-body { border-color: var(--brand); background: var(--brand-tint); box-shadow: 0 0 0 3px rgba(59, 153, 252, 0.1); }
.radio-card input:checked + .radio-body .radio-dot { border-color: var(--brand); }
.radio-card input:checked + .radio-body .radio-dot::after { transform: scale(1); }
.radio-card input:focus-visible + .radio-body { box-shadow: 0 0 0 3px var(--brand-tint); }
.btn-primary { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 10px; width: 100%; margin-top: 6px; padding: 15px 24px; font-size: 0.88rem; font-weight: 800; letter-spacing: 0.01em; color: #ffffff; background: linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%); border: 1px solid rgba(59, 153, 252, 0.5); border-radius: var(--r-full); box-shadow: 0 16px 34px -16px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.25); transition: transform 0.22s var(--ease), filter 0.22s var(--ease), box-shadow 0.22s var(--ease), opacity 0.2s var(--ease); }
.btn-primary:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 22px 46px -18px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.3); }
.btn-primary:active:not(:disabled) { transform: translateY(0) scale(0.99); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-primary svg { width: 16px; height: 16px; }
.legal { margin-top: 14px; font-size: 0.7rem; line-height: 1.65; text-align: center; color: var(--ink-faint); }
.legal a { color: var(--brand-strong); font-weight: 600; }
.legal a:hover { text-decoration: underline; }
.card-foot { margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--line-soft); text-align: center; font-size: 0.82rem; color: var(--ink-muted); }
.card-foot a { font-weight: 800; color: var(--brand-strong); transition: color 0.2s var(--ease); }
.card-foot a:hover { color: var(--brand); text-decoration: underline; }
.secure-note { display: flex; align-items: center; justify-content: center; gap: 7px; margin-top: 14px; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-faint); }
.secure-note svg { width: 12px; height: 12px; color: var(--ok); }
.step-actions .btn-primary { margin-top: 0; flex: 1 1 auto; }
@media (max-width: 520px) {
.card { padding: 26px 20px 22px; border-radius: var(--r-xl); }
.card-title { font-size: 1.3rem; }
.social-btn span { display: none; }
.social-btn { padding: 12px 8px; }
.social-btn svg { width: 19px; height: 19px; }
.field-row { grid-template-columns: 1fr; }
.radio-row { grid-template-columns: 1fr; }
}
@keyframes cardIn { from { opacity: 0; transform: translateY(22px) scale(0.975); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
```

**Form (RHF + Zod `SignupBody` from `@vunvault/contracts`):** fields `fullName` (placeholder `Jane Wanjiru`), `phone` (`+254 705 998 032`), `country` (select, first option `Select country…`; options verbatim and in order: Kenya, Uganda, Tanzania, Rwanda, Nigeria, Ghana, South Africa, Egypt, Ethiopia, United States, United Kingdom, Canada, Germany, France, India, United Arab Emirates, Australia, Other — map to ISO codes KE UG TZ RW NG GH ZA EG ET US GB CA DE FR IN AE AU and `Other` → `XX`; NOTE the contract requires a 2-letter code and the API accepts `XX`), `accountType` (radio cards `Individual` / `Personal account` and `Company` / `Team / organisation`), `email` (`you@company.com`), `password` (placeholder `At least 12 characters` — planner edit of `At least 8 characters`, following the API policy), `confirmPassword` (`Re-enter your password`). Validation messages verbatim from the prototype: `Please enter your full name.`, `Enter a valid phone number.`, `Please select your country.`, `Enter a valid email address.`, `Please confirm your password.`, `Passwords do not match.`; password rule message: `Password must be at least 12 characters and include upper and lower case letters, a number and a symbol.` (planner edit of `Password must be at least 8 characters.`). Show/hide toggle on both password fields (`aria-label`s `Show password`/`Hide password`).
**Strength meter (`PasswordStrength`):** four bars + label using `scorePassword()` from `@vunvault/contracts`; labels `Awaiting input`, `Weak`, `Fair`, `Good`, `Strong`; the markup shows the placeholder `—`.
**Submit (`Sign Up`):** `POST /api/v1/auth/signup` → `202 { data: { email, verificationRequired: true, resendAfterSeconds: 30 } }` → store `{ email, fullName }` and open the verification dialog (Task 62). `409 email_taken` → field error on `email`: `An account with this email already exists.`; `422 breached_password` → field error on `password`: `This password has appeared in a data breach. Choose a different one.`; `429` → toast `{ kind: "warn", title: "Too many attempts", message: "Please wait a few minutes before trying again." }`. Failed validation focuses the first invalid field and shows the toast `{ kind: "warn", title: "Check your details", message: "Some fields need your attention before we can continue." }` (verbatim from the prototype). Social buttons: reuse `OAuthButtons` (Task 59) with the start URL and `next=/onboarding`. Footer: `By creating an account you agree to our` `Terms of Service` `and` `Privacy Policy` (links `/terms`, `/privacy` — pages do not exist yet; render as `<a href>` anyway), `Already have an account?` `Log in` → `/login`; secure note `256-bit encrypted · 2FA protected`.
`metadata.title = "Create your account"`.

**Tests:** each validation message; country list order and count; account-type radios; strength label transitions; 202 opens the dialog store with the email; 409 and 422 map to field errors.

---

**Data shape (TypeScript):**
```ts
interface SignupStartResponse { data: { email: string; verificationRequired: true; resendAfterSeconds: 30; expiresInSeconds: 600 } }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/auth/signup body { fullName; email; phone?; country: string(2); accountType: "individual"|"company"; password: string(min12); confirmPassword; description?: string } → 202 SignupStartResponse | 400 | 409 { error: "email_taken" } | 422 { error: "breached_password" } | 429
```

---

**Out of scope:**
- Do not build the verification / 2FA dialog (Task 62).
- Do not send the user to any dashboard here.
- Do not use browser storage.

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm --filter web dev` renders the route(s) in this task with no console errors, and `pnpm --filter web test` passes (a smoke test per new component renders it and asserts the key verbatim strings).
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 61 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 62 — Signup page B: email verification, authenticator enrolment, success

**Layer:** L7

**Prerequisites:** Task 27, Task 40d, Task 60, Task 61

**Estimated files touched:** 8

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Signup page B: email verification, authenticator enrolment, success**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the verification dialog: step 1 email OTP, step 2 TOTP enrolment (QR + secret + code), step 3 success with redirect to onboarding.

**Deliverables:**
- `apps/web/src/app/(auth)/signup/_components/signup-verify-dialog.tsx` — overwrites the Task 61 stub.
- `apps/web/src/app/(auth)/signup/_components/step-tracker.tsx`
- `apps/web/src/app/(auth)/signup/_hooks/use-verify-signup.ts`
- MODIFY `apps/web/src/app/(auth)/_styles/signup.css` — append.
- `apps/web/src/app/(auth)/signup/signup-b.test.tsx`

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
- **Feature stylesheet exception:** the reference CSS blocks below come from the prototype. Reproduce them in the task's own `.css` file (listed in Deliverables), replacing every value that has a token with `var(--token)`. A colour with NO token (for example a one-off dark gradient stop) may stay as a literal ONLY inside that `.css` file; never in TSX.
- Prefer the Tailwind classes shown in the reference markup. Where the markup uses a custom class (`vv-*`, `hero-*`, `adm-*` …) implement it from the CSS block that follows it.
- Replace every `<svg data-icon="REPLACE-WITH-LUCIDE"/>` with the closest `lucide-react` icon (keep size classes); replace every `<a href>` to an internal route with `next/link`.
- Convert the markup to TSX: `class` → `className`, `for` → `htmlFor`, self-close void tags. Do NOT copy `href` values such as `*.html`; the routes shown (e.g. `/about`) are final.
- Text content is verbatim. Do not rewrite, shorten or "improve" any string.

---

**Visual specification (embedded copy + layout):**

**Reference markup:**

##### Verification modal (3 steps: Email, 2FA, Done)
```html
<div class="verify" id="verifyModal" hidden aria-hidden="true">
 <div class="verify-backdrop"></div>
 <div class="verify-card" role="dialog" aria-modal="true" aria-labelledby="verifyTitle">
  <button type="button" class="verify-close" aria-label="Close verification">
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
  </button>
  <div class="steps" id="stepTracker">
   <div class="step-node">
    <b>1</b>
    <span>Email</span>
   </div>
   <span class="step-line"></span>
   <div class="step-node">
    <b>2</b>
    <span>2FA</span>
   </div>
   <span class="step-line"></span>
   <div class="step-node">
    <b>3</b>
    <span>Done</span>
   </div>
  </div>
  <section class="step" data-step="otp">
   <div class="step-icon">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </div>
   <h2 class="step-title" id="verifyTitle">Verify your email</h2>
   <p class="step-text">
    We sent a 6-digit verification code to
    <br/>
    <strong id="otpTargetEmail">your email</strong>
   </p>
   <div class="otp-row" id="otpRow">
    <input class="otp-input" type="text" inputmode="numeric" maxlength="1" autocomplete="one-time-code" aria-label="Digit 1"/>
    [+5 more sibling <input> elements with the SAME structure as the one above; their text content in order: || || || || ]
   </div>
   <span class="err" id="otpError"></span>
   <div class="test-hint">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <div class="test-hint-body">
     <div class="test-hint-title">Test mode</div>
     <div class="test-hint-text">
      Your email OTP is
      <code id="otpTestCode">------</code>
      — enter it above.
     </div>
    </div>
   </div>
   <div class="step-actions">
    <button type="button" class="btn-ghost">Back</button>
    <button type="button" class="btn-primary" id="verifyOtpBtn" disabled>
     <span>Verify OTP</span>
    </button>
   </div>
   <div class="resend-row">
    Didn't get the code?
    <button type="button" class="resend-btn" id="resendBtn" disabled>Resend in 30s</button>
   </div>
  </section>
  [+2 more sibling <section> elements with the SAME structure as the one above; their text content in order: Two-factor authentication ¦ Scan the secret key in your authenticator app, then enter the 6-digit code it generates. ¦ Your 2FA secret key ¦ ---------------- ¦ Authenticator code ¦ Test mode ¦ Your authenticator code is ¦ ------ ¦ Back ¦ Verify & Create Account || Account Created & Verified! ¦ Welcome to VUNVAULT, ¦ friend ¦ . Your email and two-factor authentication are now active. ¦ Redirecting to your dashboard… ¦ Go now]
 </div>
</div>
```
Custom CSS for this markup (reference):
```css
.err { font-size: 0.72rem; font-weight: 600; color: var(--critical); min-height: 0; opacity: 0; transform: translateY(-3px); transition: opacity 0.2s var(--ease), transform 0.2s var(--ease); }
.err.is-visible { opacity: 1; transform: translateY(0); }
.btn-primary { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 10px; width: 100%; margin-top: 6px; padding: 15px 24px; font-size: 0.88rem; font-weight: 800; letter-spacing: 0.01em; color: #ffffff; background: linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%); border: 1px solid rgba(59, 153, 252, 0.5); border-radius: var(--r-full); box-shadow: 0 16px 34px -16px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.25); transition: transform 0.22s var(--ease), filter 0.22s var(--ease), box-shadow 0.22s var(--ease), opacity 0.2s var(--ease); }
.btn-primary:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 22px 46px -18px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.3); }
.btn-primary:active:not(:disabled) { transform: translateY(0) scale(0.99); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-primary svg { width: 16px; height: 16px; }
.verify { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 24px 16px; opacity: 0; transition: opacity 0.25s var(--ease); }
.verify[hidden] { display: none; }
.verify.is-open { opacity: 1; }
.verify-backdrop { position: absolute; inset: 0; background: rgba(4, 6, 10, 0.72); backdrop-filter: blur(14px) saturate(130%); -webkit-backdrop-filter: blur(14px) saturate(130%); }
.verify-card { position: relative; z-index: 1; width: min(440px, 100%); max-height: 92vh; overflow-y: auto; padding: 30px 28px 26px; border-radius: var(--r-2xl); background: #ffffff; border: 1px solid rgba(59, 153, 252, 0.22); box-shadow: 0 46px 96px -42px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.05) inset; transform: translateY(16px) scale(0.98); transition: transform 0.3s var(--ease); scrollbar-width: thin; scrollbar-color: rgba(59, 153, 252, 0.4) transparent; }
.verify.is-open .verify-card { transform: translateY(0) scale(1); }
.verify-card::-webkit-scrollbar { width: 8px; }
.verify-card::-webkit-scrollbar-track { background: transparent; }
.verify-card::-webkit-scrollbar-thumb { background: rgba(59, 153, 252, 0.3); border-radius: 9999px; border: 2px solid transparent; background-clip: padding-box; }
.verify-close { position: absolute; top: 14px; right: 14px; display: grid; place-items: center; width: 34px; height: 34px; border: 0; border-radius: 10px; color: var(--ink-faint); background: transparent; transition: color 0.2s var(--ease), background-color 0.2s var(--ease); }
.verify-close:hover { color: var(--ink); background: #f4f4f4; }
.verify-close svg { width: 17px; height: 17px; }
.steps { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 22px; }
.step-node { display: flex; align-items: center; gap: 8px; font-size: 10px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-faint); transition: color 0.25s var(--ease); }
.step-node b { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid var(--line); font-size: 10px; font-weight: 800; background: #fff; transition: all 0.25s var(--ease); }
.step-node.is-active { color: var(--brand-strong); }
.step-node.is-active b { border-color: var(--brand); background: var(--brand); color: #ffffff; box-shadow: 0 0 0 4px var(--brand-tint); }
.step-node.is-done { color: var(--ok); }
.step-node.is-done b { border-color: var(--ok); background: var(--ok); color: #ffffff; }
.step-line { width: 26px; height: 2px; border-radius: var(--r-full); background: var(--line); transition: background-color 0.25s var(--ease); }
.step-line.is-done { background: var(--ok); }
.step { animation: stepIn 0.32s var(--ease) both; }
.step[hidden] { display: none; }
.step-icon { display: grid; place-items: center; width: 54px; height: 54px; margin: 0 auto 16px; border-radius: 16px; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); }
.step-icon svg { width: 24px; height: 24px; }
.step-title { font-size: 1.2rem; font-weight: 800; letter-spacing: -0.015em; text-align: center; color: var(--ink); }
.step-text { margin-top: 8px; font-size: 0.82rem; line-height: 1.65; text-align: center; color: var(--ink-muted); }
.step-text strong { color: var(--ink); font-weight: 700; }
.otp-row { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 9px; margin: 22px 0 6px; }
.otp-input { width: 100%; height: 56px; text-align: center; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 1.3rem; font-weight: 800; color: var(--ink); background: #ffffff; border: 1.5px solid var(--line); border-radius: var(--r-md); outline: none; transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease), background-color 0.2s var(--ease), transform 0.15s var(--ease); caret-color: var(--brand); }
.otp-input:hover { border-color: #d4d4d4; }
.otp-input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-tint); transform: translateY(-2px); }
.otp-input.is-filled { border-color: var(--brand-line); background: var(--brand-tint); }
.otp-row.is-invalid .otp-input { border-color: var(--critical); animation: shake 0.34s var(--ease); }
.test-hint { display: flex; align-items: flex-start; gap: 10px; margin-top: 16px; padding: 12px 14px; border-radius: var(--r-md); background: rgba(245, 158, 11, 0.08); border: 1px dashed rgba(245, 158, 11, 0.5); }
.test-hint svg { flex: 0 0 auto; width: 15px; height: 15px; margin-top: 1px; color: var(--warn); }
.test-hint-body { min-width: 0; }
.test-hint-title { font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #b45309; }
.test-hint-text { margin-top: 4px; font-size: 0.74rem; line-height: 1.55; color: #92400e; }
.test-hint code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.88rem; font-weight: 800; letter-spacing: 0.14em; color: #7c2d12; background: rgba(255, 255, 255, 0.75); border: 1px solid rgba(245, 158, 11, 0.45); border-radius: 6px; padding: 1px 7px; }
.step-actions { display: flex; align-items: center; gap: 10px; margin-top: 18px; }
.btn-ghost { flex: 0 0 auto; padding: 14px 18px; font-size: 0.8rem; font-weight: 700; color: var(--ink-soft); background: #f5f5f5; border: 1px solid var(--line); border-radius: var(--r-full); transition: color 0.2s var(--ease), background-color 0.2s var(--ease), border-color 0.2s var(--ease); }
.btn-ghost:hover:not(:disabled) { color: var(--ink); background: #ededed; border-color: #d4d4d4; }
.btn-ghost:disabled { opacity: 0.55; cursor: not-allowed; }
.step-actions .btn-primary { margin-top: 0; flex: 1 1 auto; }
.resend-row { margin-top: 14px; text-align: center; font-size: 0.76rem; color: var(--ink-muted); }
.resend-btn { border: 0; background: none; padding: 0; font-size: 0.76rem; font-weight: 800; color: var(--brand-strong); transition: color 0.2s var(--ease); }
.resend-btn:disabled { color: var(--ink-faint); cursor: not-allowed; }
.resend-btn:hover:not(:disabled) { color: var(--brand); text-decoration: underline; }
@media (max-width: 520px) {
.otp-row { gap: 6px; }
.otp-input { height: 48px; font-size: 1.1rem; }
.verify-card { padding: 24px 18px 22px; }
.step-actions { flex-direction: column-reverse; }
.step-actions .btn-ghost { width: 100%; }
}
@media (max-width: 380px) {
.otp-input { height: 44px; font-size: 1rem; border-radius: 9px; }
.step-node span { display: none; }
}
@keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
@keyframes stepIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
```

**Prototype behaviour to port (reference JS for step handling; REMOVE every "Test mode" hint panel and the fake in-page OTP/authenticator generation — the `test-hint` blocks must not exist; REMOVE the fake secret generator):**
```js
(function () {
 "use strict";
 var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
 var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
 var toastStack = $("#toastStack");
 var ICONS = {
 info: '<path d="M12 16v-4"/><path d="M12 8h.01"/><circle cx="12" cy="12" r="10"/>',
 ok: '<path d="M20 6 9 17l-5-5"/>',
 warn: '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>',
 error: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>'
 };
 function toast(options) {
 var opts = options || {};
 var type = opts.type || "info";
 var duration = typeof opts.duration === "number" ? opts.duration : 8000;
 var el = document.createElement("div");
 el.className = "toast toast--" + type;
 var iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
 'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
 (ICONS[type] || ICONS.info) + "</svg>";
 var html = "";
 html += '<div class="toast-icon">' + iconSvg + "</div>";
 html += '<div class="toast-body">';
 if (opts.title) html += '<div class="toast-title">' + escapeHtml(opts.title) + "</div>";
 if (opts.message) html += '<div class="toast-msg">' + escapeHtml(opts.message) + "</div>";
 if (opts.code) html += '<div class="toast-code">' + escapeHtml(opts.code) + "</div>";
 html += "</div>";
 html += '<button type="button" class="toast-close" aria-label="Dismiss notification">' +
 '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" ' +
 'stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>' +
 "</button>";
 el.innerHTML = html;
 toastStack.appendChild(el);
 var remove = function () {
 if (!el.parentNode) return;
 el.classList.add("is-leaving");
 window.setTimeout(function () {
 if (el.parentNode) el.parentNode.removeChild(el);
 }, 300);
 };
 $(".toast-close", el).addEventListener("click", remove);
 requestAnimationFrame(function () {
 requestAnimationFrame(function () { el.classList.add("is-visible"); });
 });
 if (duration > 0) window.setTimeout(remove, duration);
 return el;
 }
 function escapeHtml(str) {
 return String(str)
 .replace(/&/g, "&amp;")
 .replace(/</g, "&lt;")
 .replace(/>/g, "&gt;")
 .replace(/"/g, "&quot;")
 .replace(/'/g, "&#39;");
 }
 var state = {
 otp: null,
 totp: null,
 secret: null,
 email: "",
 name: ""
 };
 var resendTimer = null;
 var redirectTimer = null;
 function randomDigits(len) {
 var out = "";
 for (var i = 0; i < len; i++) out += Math.floor(Math.random() * 10);
 return out;
 }
 function generateOtp() { return randomDigits(6); }
 function generateTotp() { return randomDigits(6); }
 function generateBase32Secret(len) {
 var alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
 var out = "";
 for (var i = 0; i < (len || 16); i++) {
 out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
 }
 return out;
 }
 $$("[data-toggle-pw]").forEach(function (btn) {
 btn.addEventListener("click", function () {
 var input = document.getElementById(btn.getAttribute("data-toggle-pw"));
 if (!input) return;
 var show = input.type === "password";
 input.type = show ? "text" : "password";
 btn.classList.toggle("is-visible", show);
 btn.setAttribute("aria-pressed", show ? "true" : "false");
 btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
 input.focus({ preventScroll: true });
 });
 });
 var pwInput = $("#password");
 var strengthEl = $("#strength");
 var strengthLabel = $("#strengthLabel");
 var LABELS = ["—", "Weak", "Fair", "Good", "Strong"];
 function scorePassword(value) {
 if (!value) return 0;
 var score = 0;
 if (value.length >= 8) score++;
 if (value.length >= 12) score++;
 if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
 if (/\d/.test(value)) score++;
 if (/[^A-Za-z0-9]/.test(value)) score++;
 return Math.min(4, score);
 }
 pwInput.addEventListener("input", function () {
 var level = scorePassword(pwInput.value);
 strengthEl.setAttribute("data-level", String(level));
 strengthLabel.textContent = LABELS[level];
 });
 func
/* …truncated by planner… */
```
**Real flow:**
1. **Step 1 — Verify your email:** title `Verify your email`, text `We sent a 6-digit verification code to` + the address. Reuse `OtpInput` (Task 60). Submit → `POST /api/v1/auth/signup/verify-email { email, code }`: `200` → session cookies are set by the API (aal1) → step 2; `otp_invalid` → verbatim `That code is incorrect. Please try again.`; `otp_exhausted` → `Too many incorrect attempts. Request a new code.` (planner copy) and the boxes disable until `Resend`; `410 otp_expired` → `That code has expired. Request a new one.`; incomplete → `Please enter all 6 digits.`. `Back` closes the dialog (the pending account is cleaned up by the API after 24 h). `Resend in 30s` countdown, then a link that calls `POST /api/v1/auth/signup/resend` and toasts `{ kind: "ok", title: "Verification code sent", message: "A fresh verification code was sent to <email>" }`; toast on step 1 success: `{ kind: "ok", title: "Email verified", message: "Now let's set up two-factor authentication." }`.
2. **Step 2 — Two-factor authentication:** text `Scan the secret key in your authenticator app, then enter the 6-digit code it generates.` On entering the step call `POST /api/v1/account/mfa/totp/enroll` → show the QR (`qrCodeSvg` rendered as `<img alt="Authenticator QR code" src="data:image/svg+xml;utf8,<encoded>">` — NEVER inject the SVG with `dangerouslySetInnerHTML`) above the secret panel (`Your 2FA secret key` + the base32 secret grouped in 4s, with a `Copy` button that toasts `Secret copied`), and a code input (`Authenticator code`, placeholder `000000`, `inputmode="numeric"`). Submit button `Verify & Create Account` → `POST /api/v1/account/mfa/totp/verify { factorId, code }`; wrong code → `That authenticator code is incorrect.` / `Please enter the full 6-digit code.`; success → step 3. (Planner decision: authenticator enrolment is mandatory at signup, as in the prototype.)
3. **Step 3 — Done:** title `Account Created & Verified!`, text `Welcome to VUNVAULT, <first name>.` `Your email and two-factor authentication are now active.` `Redirecting to your dashboard…` with the progress bar (`redirect-bar`, 2.5 s; instant under reduced motion) and the `Go now` button; then `router.replace("/onboarding")` (the onboarding wizard completes the profile). Toast: `{ kind: "ok", title: "Account Created & Verified!", message: "Two-factor authentication is now active on your account." }`.
The step tracker labels are `Email`, `2FA`, `Done` with numbers 1–3 (`aria-current="step"` on the active one). Dialog semantics: `role="dialog"`, `aria-modal`, `aria-labelledby="verifyTitle"`, focus trap, Escape closes ONLY on step 1.

**Tests:** step 1 wrong/incomplete/expired messages; correct code advances and shows the toast; QR rendered through `<img>` (no `innerHTML`); TOTP verify error and success; step 3 redirects to `/onboarding` after the timer (fake timers); no element with text `Test mode` exists.

---

**Data shape (TypeScript):**
```ts
interface TotpEnrollStart { data: { factorId: string; qrCodeSvg: string; secret: string; uri: string } }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/auth/signup/verify-email body { email; code: string(6) } → 200 { data: SessionUser } | 401 { error: "otp_invalid" | "otp_exhausted" } | 410 otp_expired | 429
// POST /api/v1/auth/signup/resend body { email } → 202 {}
// POST /api/v1/account/mfa/totp/enroll → 201 TotpEnrollStart
// POST /api/v1/account/mfa/totp/verify body { factorId; code: string(6) } → 204 | 401 { error: "mfa_failed" }
```

---

**Out of scope:**
- Do not render any 'test mode' OTP or secret.
- Do not use `innerHTML`/`dangerouslySetInnerHTML`.
- Do not build onboarding (Tasks 64–65).

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm --filter web dev` renders the route(s) in this task with no console errors, and `pnpm --filter web test` passes (a smoke test per new component renders it and asserts the key verbatim strings).
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 62 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 63 — Accept-invite, forgot-password, reset-password and newsletter-confirm pages

**Layer:** L7

**Prerequisites:** Task 10, Task 31, Task 40c, Task 40d, Task 59, Task 60

**Estimated files touched:** 12

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Accept-invite, forgot-password, reset-password and newsletter-confirm pages**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the four small auth-adjacent routes that have no prototype page, reusing the login card styling: staff invitation acceptance, password reset request and completion, and newsletter confirmation.

**Deliverables:**
- `apps/web/src/app/(auth)/accept-invite/page.tsx`
- `apps/web/src/app/(auth)/forgot-password/page.tsx`
- `apps/web/src/app/(auth)/reset-password/page.tsx`
- `apps/web/src/app/(auth)/newsletter/confirm/page.tsx`
- `apps/web/src/app/(auth)/_components/auth-card.tsx` — generic card shell reproducing the login card classes (`vv-auth-card`, head/brand/title/sub).
- `apps/web/src/app/(auth)/accept-invite/_components/accept-invite-form.tsx`
- `apps/web/src/app/(auth)/forgot-password/_components/forgot-form.tsx`
- `apps/web/src/app/(auth)/reset-password/_components/reset-form.tsx`
- `apps/web/src/app/(auth)/_hooks/use-auth-misc.ts`
- `apps/web/src/mocks/handlers/auth-misc.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- `apps/web/src/app/(auth)/_components/auth-misc.test.tsx`

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
- **Feature stylesheet exception:** the reference CSS blocks below come from the prototype. Reproduce them in the task's own `.css` file (listed in Deliverables), replacing every value that has a token with `var(--token)`. A colour with NO token (for example a one-off dark gradient stop) may stay as a literal ONLY inside that `.css` file; never in TSX.
- Prefer the Tailwind classes shown in the reference markup. Where the markup uses a custom class (`vv-*`, `hero-*`, `adm-*` …) implement it from the CSS block that follows it.
- Replace every `<svg data-icon="REPLACE-WITH-LUCIDE"/>` with the closest `lucide-react` icon (keep size classes); replace every `<a href>` to an internal route with `next/link`.
- Convert the markup to TSX: `class` → `className`, `for` → `htmlFor`, self-close void tags. Do NOT copy `href` values such as `*.html`; the routes shown (e.g. `/about`) are final.
- Text content is verbatim. Do not rewrite, shorten or "improve" any string.

---

**Visual specification (embedded copy + layout):**

**Reuse the login card look:** import `auth.css` (Task 59) and reuse these classes exactly (their CSS is defined there): `vv-auth-card`, `vv-auth-head`, `vv-brand`, `vv-brand-mark`, `vv-brand-name`, `vv-auth-title`, `vv-auth-sub`, `vv-form`, `vv-field`, `vv-label`, `vv-input-wrap`, `vv-input`, `vv-input-icon`, `vv-error`, `vv-submit`, `vv-submit-label`, `vv-spinner`, `vv-link`, `vv-legal`. Page background: the same `AuthBackground` component (Task 59).

**All copy on these four pages is planner-authored (no prototype exists); keep it exactly as given:**
- **Forgot password** (`/forgot-password`): title `Reset your password`; sub `Enter your account email and we will send you a reset link.`; field `Email address` (placeholder `you@company.com`; same email validation messages as login); button `Send reset link`; after submit (ALWAYS, regardless of the API result except network failure) replace the form with: title `Check your inbox`, text `If an account exists for that address, a reset link is on its way. It expires in 30 minutes.`; link `Back to sign in` → `/login`.
- **Reset password** (`/reset-password?token=`): title `Choose a new password`; sub `Use at least 12 characters (14 for staff accounts) with upper and lower case letters, a number and a symbol.`; fields `New password`, `Confirm new password` (RHF + Zod `ResetPasswordBody`; confirm message `Both entries must match exactly.`); show `PasswordStrength` (Task 61); button `Update password`; success → title `Password updated`, text `All other sessions were signed out. Sign in with your new password.`, button `Go to sign in`; `410 token_invalid` → inline alert `This reset link is invalid or has already been used.` with a link `Request a new link` → `/forgot-password`; `422 breached_password` → field error `This password has appeared in a data breach. Choose a different one.`. Missing `token` query → the invalid-link state.
- **Accept invite** (`/accept-invite?token=`): on load `GET /api/v1/invitations/:token`; loading → `Skeleton`; `404` → title `Invitation not valid`, text `This invitation link is invalid or has expired. Ask an administrator to send a new one.`; found → title `Join VUNVAULT`, sub `You've been invited as <strong>{roleLabel}</strong> · {teamLabel}.`, read-only `Work email` showing the address, fields `Password` / `Confirm password` (min 14, same rules, `PasswordStrength`), button `Activate account`; success → title `Account activated`, text `Multi-factor authentication is mandatory for staff accounts. Set it up now to continue.`, button `Set up MFA` → `/admin/profile#security`.
- **Newsletter confirm** (`/newsletter/confirm?token=`): on load `POST /api/v1/newsletter/confirm`; pending → `Confirming your subscription…`; success → title `Subscription confirmed`, text `You will now receive VUNVAULT threat advisories.`, link `Back to the blog` → `/blog`; `404` → title `Link not valid`, text `This confirmation link is invalid or has already been used.`. (Unsubscribe link handling is out of scope.)
All four pages: `metadata.robots = { index: false }`, no marketing chrome, each card `<main>` with an `h1`.

**Tests:** forgot form always ends on the `Check your inbox` state; reset: invalid token state, mismatch message, success state; accept-invite: 404 state, success state, role/team shown; newsletter confirm: pending→success and 404.

---

**Data shape (TypeScript):**
```ts
interface InvitationPreview { email: string; fullName: string; role: UserRole; roleLabel: string; team: Team; teamLabel: string; expiresAt: string }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/auth/forgot-password body { email } → 202 {}
// POST /api/v1/auth/reset-password body { token; newPassword; confirmPassword } → 204 | 400 | 410 { error: "token_invalid" } | 422 breached_password
// GET  /api/v1/invitations/:token → 200 { data: InvitationPreview } | 404 not_found
// POST /api/v1/invitations/:token/accept body { password; confirmPassword } → 201 { data: SessionUser; mfaEnrolmentRequired: true } | 400 | 404 | 422 breached_password
// POST /api/v1/newsletter/confirm body { token } → 204 | 404 not_found
```

---

**Out of scope:**
- Do not change the login or signup pages.
- Do not add an unsubscribe page.
- Do not store tokens anywhere (read from the URL once, keep in component state only).

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm --filter web dev` renders the route(s) in this task with no console errors, and `pnpm --filter web test` passes (a smoke test per new component renders it and asserts the key verbatim strings).
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 63 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 64 — Client onboarding wizard A: hero, stepper, step 1 (personal) and step 2 (career & entity)

**Layer:** L7

**Prerequisites:** Task 10, Task 30, Task 42, Task 44, Task 62

**Estimated files touched:** 10

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Client onboarding wizard A: hero, stepper, step 1 (personal) and step 2 (career & entity)**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the `/onboarding` route shell with the hero, the three-step stepper, and the first two steps with per-step validation.

**Deliverables:**
- `apps/web/src/app/(authed)/onboarding/layout.tsx` — `requireSession()` then the MARKETING header/footer (import `SiteHeader`/`SiteFooter` from `(marketing)/_components`, variant `home`); no portal chrome.
- `apps/web/src/app/(authed)/onboarding/page.tsx`
- `apps/web/src/app/(authed)/onboarding/_components/onboarding-wizard.tsx` (client)
- `apps/web/src/app/(authed)/onboarding/_components/step-personal.tsx`, `step-profile.tsx`, `stepper.tsx`, `onboarding-hero.tsx`
- `apps/web/src/app/(authed)/onboarding/_store/onboarding-store.ts` — in-memory wizard state (RHF holds the values; the store holds `step`).
- `apps/web/src/app/(authed)/onboarding/_styles/onboarding.css`
- `apps/web/src/app/(authed)/onboarding/_components/step-final.tsx` — null stub (Task 65 overwrites).
- `apps/web/src/mocks/handlers/onboarding.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- `apps/web/src/app/(authed)/onboarding/onboarding-a.test.tsx`

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
- **Feature stylesheet exception:** the reference CSS blocks below come from the prototype. Reproduce them in the task's own `.css` file (listed in Deliverables), replacing every value that has a token with `var(--token)`. A colour with NO token (for example a one-off dark gradient stop) may stay as a literal ONLY inside that `.css` file; never in TSX.
- Prefer the Tailwind classes shown in the reference markup. Where the markup uses a custom class (`vv-*`, `hero-*`, `adm-*` …) implement it from the CSS block that follows it.
- Replace every `<svg data-icon="REPLACE-WITH-LUCIDE"/>` with the closest `lucide-react` icon (keep size classes); replace every `<a href>` to an internal route with `next/link`.
- Convert the markup to TSX: `class` → `className`, `for` → `htmlFor`, self-close void tags. Do NOT copy `href` values such as `*.html`; the routes shown (e.g. `/about`) are final.
- Text content is verbatim. Do not rewrite, shorten or "improve" any string.

---

**Visual specification (embedded copy + layout):**

**Reference markup:**

##### Onboarding hero
```html
<section class="ob-hero">
 <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <div class="max-w-4xl">
   <span class="ob-eyebrow">
    <span class="ob-eyebrow-dot" aria-hidden="true"></span>
    Account setup · 3 steps
   </span>
   <h1 class="ob-title">
    Let's finish setting up
    <br/>
    <span>your VUNVAULT workspace.</span>
   </h1>
   <p class="ob-sub">
    Tell us who you are and how you work. This information shapes your scan scope, your compliance mapping and the reporting format you receive. It takes about two minutes — and nothing is shared outside VUNVAULT.
   </p>
   <div class="ob-meta-row">
    <span class="ob-meta-chip">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     256-bit encrypted submission
    </span>
    [+2 more sibling <span> elements with the SAME structure as the one above; their text content in order: ~2 minutes to complete || GDPR & DPA 2019 aligned]
   </div>
  </div>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
.ob-hero { padding: 2.75rem 0 1.25rem; }
.ob-eyebrow { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 9999px; background: var(--brand-tint); border: 1px solid var(--brand-line); color: var(--brand-strong); font-size: 10.5px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; }
.ob-eyebrow-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--brand); box-shadow: 0 0 0 4px rgba(59, 153, 252, 0.16); }
.ob-title { margin-top: 18px; font-size: clamp(1.9rem, 4.2vw, 2.95rem); font-weight: 800; letter-spacing: -0.03em; line-height: 1.1; color: var(--ink); }
.ob-title span { background: linear-gradient(120deg, var(--brand), var(--brand-strong)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.ob-sub { margin-top: 14px; max-width: 62ch; font-size: 0.95rem; line-height: 1.75; color: var(--ink-muted); }
.ob-meta-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 20px; }
.ob-meta-chip { display: inline-flex; align-items: center; gap: 7px; padding: 7px 13px; border-radius: 9999px; background: #ffffff; border: 1px solid var(--line); font-size: 11px; font-weight: 700; color: var(--ink-soft); box-shadow: 0 6px 16px -14px rgba(10, 13, 18, 0.6); }
.ob-meta-chip svg { width: 13px; height: 13px; color: var(--brand); }
@media (max-width: 768px) {
.ob-hero { padding: 2rem 0 1rem; }
}
```

##### Wizard shell: stepper + steps 1 and 2 (the form is split — step 3 is in the next task)
```html
<form id="onboardingForm" autocomplete="on">
 <section class="ob-panel" data-step="1" aria-labelledby="obStep1Title">
  <div class="ob-panel-head">
   <div class="ob-panel-index">Step 01 — Personal & contact</div>
   <h2 class="ob-panel-title" id="obStep1Title">Who are we protecting?</h2>
   <p class="ob-panel-text">Use the name and contact details you want attached to your security reports. We use your email for scan notifications and your phone for critical alerts only.</p>
  </div>
  <div class="ob-grid">
   <div class="ob-field ob-span-2">
    <label class="ob-label" for="obFullName">
     Full name
     <span aria-hidden="true">*</span>
    </label>
    <input class="ob-input" type="text" id="obFullName" name="fullName" placeholder="Jane Wanjiru Kamau" autocomplete="name"/>
    <span class="ob-err"></span>
   </div>
   <div class="ob-field">
    <label class="ob-label" for="obDob">
     Date of birth
     <span aria-hidden="true">*</span>
    </label>
    <input class="ob-input" type="date" id="obDob" name="dob"/>
    <span class="ob-hint">You must be at least 16 years old.</span>
    <span class="ob-err"></span>
   </div>
   [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Phone number ¦ * ¦ Include your country code for SMS alerts. || Email address ¦ * || Confirm email address ¦ *]
  </div>
 </section>
 [+2 more sibling <section> elements with the SAME structure as the one above; their text content in order: Step 02 — Career & account type ¦ How do you use VUNVAULT? ¦ Your role determines the assessment templates, compliance mappings and reporting depth we prepare for you. Your entity type determines the contracting and invoicing path. ¦ Career / role ¦ * ¦ Student ¦ Learning tracks, labs and free certificates. ¦ [+3 more sibling <label> elements with the SAME structure as the one above; their text content in order: Business Owner ¦ Starter scans and plain-language reporting. || Cybersecurity Professional ¦ Full-scope pentesting and purple-team work. || Independent Specialist ¦ Consulting, audits and client engagements.] ¦ Entity type ¦ * ¦ Individual ¦ Personal account, personal scope. ¦ [+2 more sibling <label> elements with the SAME structure as the one above; their text content in order: Company ¦ Registered business or startup. || Corporation ¦ Enterprise, group or public entity.] || Step 03 — Verification & finalisation ¦ Confirm and secure your account ¦ Review what we captured, answer one account-recovery question, and confirm the declarations below. Your recovery answer is hashed locally — we never store it in plain text. ¦ Captured details ¦ Ready to submit ¦ Account recovery question ¦ * ¦ Choose a recovery question… ¦ What was the name of your first pet? ¦ In what city were you born? ¦ What is your mother's maiden name? ¦ What was your first car? ¦ What was the name of your first school? ¦ Recovery answer ¦ * ¦ Case-insensitive. Keep it something only you would know. ¦ I confirm that the personal, contact and entity information I provided is accurate, current and belongs to me or to an organisation I am authorised to represent. ¦ [+2 more sibling <label> elements with the SAME structure as the one above; their text content in order: I confirm I will only request assessments against systems I own or have ¦ written authorisation ¦ to test, and I accept the ¦ Acceptable Use Policy ¦ . || I agree to the ¦ Terms of Service ¦ and ¦ Privacy Policy ¦ , including the processing of my data for account verification and security notifications.]]
 <section class="ob-success" id="obSuccess" hidden>
  <div class="ob-success-mark">
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
  </div>
  <h2 class="ob-success-title">Onboarding complete</h2>
  <p class="ob-success-text">
   Welcome aboard,
   <strong id="obSuccessName">friend</strong>
   . Your VUNVAULT profile has been created and verified. Taking you back to the main platform…
  </p>
  <div class="ob-redirect-bar">
   <span></span>
  </div>
  <p class="ob-redirect-note">Redirecting to vun1.html</p>
 </section>
 <div class="ob-actions" id="obActions">
  <button type="button" class="ob-btn ob-btn--ghost" id="obPrevBtn" hidden>
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
   <span>Back</span>
  </button>
  <span class="ob-progress-text" id="obProgressText">Step 1 of 3</span>
  <button type="button" class="ob-btn ob-btn--primary" id="obNextBtn">
   <span>Next</span>
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
  </button>
  <button type="submit" class="ob-btn ob-btn--primary" id="obSubmitBtn" hidden>
   <span>Complete Setup</span>
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
  </button>
 </div>
</form>
```
Custom CSS for this markup (reference):
```css
.ob-panel { padding: 34px 32px 8px; animation: obPanelIn 0.36s var(--ease) both; }
.ob-panel-head { margin-bottom: 26px; }
.ob-panel-index { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: var(--brand-strong); }
.ob-panel-title { margin-top: 8px; font-size: 1.35rem; font-weight: 800; letter-spacing: -0.02em; color: var(--ink); }
.ob-panel-text { margin-top: 8px; font-size: 0.84rem; line-height: 1.7; color: var(--ink-muted); max-width: 66ch; }
.ob-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.ob-span-2 { grid-column: 1 / -1; }
@media (max-width: 720px) {
.ob-grid { grid-template-columns: 1fr; }
.ob-span-2 { grid-column: auto; }
}
.ob-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.ob-label { font-size: 10.5px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-muted); }
.ob-label span { color: var(--critical); }
.ob-input { width: 100%; padding: 13px 14px; font-family: inherit; font-size: 0.88rem; color: var(--ink); background: #ffffff; border: 1px solid var(--line); border-radius: 12px; outline: none; transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease), background-color 0.2s var(--ease); }
.ob-input::placeholder { color: var(--ink-faint); }
.ob-input:hover { border-color: #d4d4d4; }
.ob-input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-tint); background: #ffffff; }
.ob-input.is-invalid { border-color: var(--critical); box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.14); animation: obShake 0.32s var(--ease); }
select.ob-input { appearance: none; -webkit-appearance: none; padding-right: 40px; background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%233B99FC' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; cursor: pointer; }
.ob-hint { font-size: 11px; line-height: 1.55; color: var(--ink-faint); }
.ob-err { font-size: 0.72rem; font-weight: 600; color: var(--critical); opacity: 0; transform: translateY(-3px); transition: opacity 0.2s var(--ease), transform 0.2s var(--ease); }
.ob-err.is-visible { opacity: 1; transform: translateY(0); }
.ob-actions { display: flex; align-items: center; gap: 12px; padding: 22px 32px 28px; margin-top: 12px; border-top: 1px solid var(--line-soft); background: linear-gradient(180deg, rgba(252, 251, 249, 0), rgba(252, 251, 249, 0.8)); }
.ob-progress-text { margin-inline: auto; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); white-space: nowrap; }
.ob-btn { display: inline-flex; align-items: center; justify-content: center; gap: 9px; padding: 14px 30px; font-family: inherit; font-size: 0.82rem; font-weight: 800; letter-spacing: 0.01em; border-radius: 9999px; border: 1px solid transparent; cursor: pointer; transition: transform 0.22s var(--ease), filter 0.22s var(--ease), box-shadow 0.22s var(--ease), background-color 0.22s var(--ease), border-color 0.22s var(--ease), color 0.22s var(--ease), opacity 0.2s var(--ease); }
.ob-btn svg { width: 15px; height: 15px; transition: transform 0.22s var(--ease); }
.ob-btn--primary { color: #ffffff; background: linear-gradient(135deg, var(--brand), var(--brand-strong)); border-color: rgba(59, 153, 252, 0.5); box-shadow: 0 16px 34px -16px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.25); }
.ob-btn--primary:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 22px 46px -18px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.3); }
.ob-btn--primary:hover:not(:disabled) svg { transform: translateX(3px); }
.ob-btn--primary:active:not(:disabled) { transform: translateY(0) scale(0.985); }
.ob-btn--ghost { color: var(--ink-soft); background: #ffffff; border-color: var(--line); }
.ob-btn--ghost:hover:not(:disabled) { color: var(--brand-strong); border-color: var(--brand-line); background: var(--brand-tint); transform: translateY(-1px); }
.ob-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.ob-btn.is-busy { pointer-events: none; }
.ob-success { padding: 56px 32px 62px; text-align: center; animation: obPanelIn 0.4s var(--ease) both; }
.ob-success-mark { position: relative; display: grid; place-items: center; width: 88px; height: 88px; margin: 0 auto 22px; border-radius: 50%; background: rgba(16, 185, 129, 0.1); border: 1.5px solid rgba(16, 185, 129, 0.4); animation: obPop 0.45s var(--ease) both; }
.ob-success-mark::after { content: ""; position: absolute; inset: -9px; border-radius: 50%; border: 1.5px solid rgba(16, 185, 129, 0.25); animation: obRing 1.9s var(--ease) infinite; }
.ob-success-mark svg { width: 38px; height: 38px; color: var(--ok); }
.ob-success-title { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em; color: var(--ink); }
.ob-success-text { margin-top: 10px; font-size: 0.86rem; line-height: 1.7; color: var(--ink-muted); max-width: 46ch; margin-inline: auto; }
.ob-success-text strong { color: var(--ink); }
.ob-redirect-bar { height: 3px; width: min(320px, 100%); margin: 26px auto 0; border-radius: 9999px; background: #ececec; overflow: hidden; }
.ob-redirect-bar span { display: block; height: 100%; width: 0; border-radius: 9999px; background: linear-gradient(90deg, var(--brand-strong), var(--brand-soft)); animation: obFill 2.2s var(--ease) forwards; }
.ob-redirect-note { margin-top: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-faint); }
@media (max-width: 768px) {
.ob-panel { padding: 26px 20px 6px; }
.ob-actions { padding: 18px 20px 24px; flex-wrap: wrap; }
.ob-btn { flex: 1 1 auto; padding: 14px 20px; }
.ob-progress-text { order: -1; width: 100%; text-align: center; margin: 0 0 4px; }
}
@media (prefers-reduced-motion: reduce) {
.ob-panel,
    .ob-success,
    .ob-success-mark,
    .ob-shell,
    .ob-input.is-invalid { animation: none !important; }
.ob-redirect-bar span { width: 100%; animation: none !important; }
.ob-success-mark::after { animation: none !important; }
}
@keyframes obPanelIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes obShake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
@keyframes obRing { 0% { transform: scale(0.92); opacity: 0.9; } 100% { transform: scale(1.28); opacity: 0; } }
@keyframes obPop { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: scale(1); } }
@keyframes obFill { from { width: 0%; } to { width: 100%; } }
```

**ONE `useForm` for the whole wizard** (RHF + Zod `OnboardingSubmitBody` from `@vunvault/contracts`, `mode: "onTouched"`); each step validates only its own fields with `trigger([...])` before `Next`. Step 1 fields (`OnboardingStep1`): `fullName`, `dateOfBirth`, `phone` (optional, E.164 — placeholder and helper text verbatim from the markup), `email`, `emailConfirm`; prefill `fullName` and `email` (and `emailConfirm`) from `useSession()`; error messages: `You must be at least 16 years old.` (DOB), `Email addresses must match.`, plus the field messages in the markup. Step 2 fields (`OnboardingStep2`): `career` (four radio cards from `CAREER_LABELS`/`CAREER_DESCRIPTIONS`: `Student` / `Learning tracks, labs and free certificates.`, `Business Owner` / `Starter scans and plain-language reporting.`, `Cybersecurity Professional` / `Full-scope pentesting and purple-team work.`, `Independent Specialist` / `Consulting, audits and client engagements.`) and `entity` (three radio cards `Individual` / `Personal account, personal scope.`, `Company` / `Registered business or startup.`, `Corporation` / `Enterprise, group or public entity.`). Radio groups are real `<input type="radio">` inside `<fieldset><legend>`; the card is the label. Required messages: `Select what best describes you.`, `Select an account entity.` (planner copy).
**Stepper:** `<ol aria-label="Onboarding progress">`, items marked `is-active` / `is-done`; the active item `aria-current="step"`; step labels from the markup; clicking a previous step goes back, future steps are not clickable. `Back` / `Continue` buttons as in the markup; focus moves to the step heading on change; scroll to the wizard top (`scrollIntoView({ block: "start" })`, instant under reduced motion).
**Guard:** `GET /api/v1/onboarding` — if `completed` → `router.replace(homeFor(role))`; staff never see this page (redirect to `/admin`).
Hero copy verbatim from the markup (eyebrow, title, sub, meta chips).

**Tests:** under-16 DOB blocked with the verbatim message; email mismatch message; Continue blocked until a career and entity are chosen; stepper state after Back/Next; completed users are redirected.

---

**Data shape (TypeScript):**
```ts
type OnboardingStep1 = { fullName: string; dateOfBirth: string; phone?: string; email: string; emailConfirm: string };
type OnboardingStep2 = { career: CareerRole; entity: EntityType };
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/onboarding → 200 { data: { completed: boolean; completedAt: string | null } }
```

---

**Out of scope:**
- Do not build step 3 or submission (Task 65).
- Do not persist partial answers to the server or browser storage.
- Do not show this page to staff.

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm --filter web dev` renders the route(s) in this task with no console errors, and `pnpm --filter web test` passes (a smoke test per new component renders it and asserts the key verbatim strings).
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 64 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---

### TASK 65 — Client onboarding wizard B: step 3 (recovery question, declarations) and submission

**Layer:** L7

**Prerequisites:** Task 30, Task 64

**Estimated files touched:** 7

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Client onboarding wizard B: step 3 (recovery question, declarations) and submission**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the final onboarding step and the submit flow that posts the whole wizard to the API and lands the client in the portal.

**Deliverables:**
- `apps/web/src/app/(authed)/onboarding/_components/step-final.tsx` — overwrites the Task 64 stub.
- `apps/web/src/app/(authed)/onboarding/_hooks/use-submit-onboarding.ts`
- MODIFY `apps/web/src/app/(authed)/onboarding/_components/onboarding-wizard.tsx` — wire the final step and submit.
- MODIFY `apps/web/src/app/(authed)/onboarding/_styles/onboarding.css` — append if needed.
- `apps/web/src/app/(authed)/onboarding/onboarding-b.test.tsx`

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
- **Feature stylesheet exception:** the reference CSS blocks below come from the prototype. Reproduce them in the task's own `.css` file (listed in Deliverables), replacing every value that has a token with `var(--token)`. A colour with NO token (for example a one-off dark gradient stop) may stay as a literal ONLY inside that `.css` file; never in TSX.
- Prefer the Tailwind classes shown in the reference markup. Where the markup uses a custom class (`vv-*`, `hero-*`, `adm-*` …) implement it from the CSS block that follows it.
- Replace every `<svg data-icon="REPLACE-WITH-LUCIDE"/>` with the closest `lucide-react` icon (keep size classes); replace every `<a href>` to an internal route with `next/link`.
- Convert the markup to TSX: `class` → `className`, `for` → `htmlFor`, self-close void tags. Do NOT copy `href` values such as `*.html`; the routes shown (e.g. `/about`) are final.
- Text content is verbatim. Do not rewrite, shorten or "improve" any string.

---

**Visual specification (embedded copy + layout):**

**Reference markup (the same form; look for step 3 — recovery question select, answer input, three declaration checkboxes, the submit button and the final consent note):**

##### Step 3 (security & declarations) and submit area — extracted from the same form
```html
<form id="onboardingForm" autocomplete="on">
 <section class="ob-panel" data-step="1" aria-labelledby="obStep1Title">
  <div class="ob-panel-head">
   <div class="ob-panel-index">Step 01 — Personal & contact</div>
   <h2 class="ob-panel-title" id="obStep1Title">Who are we protecting?</h2>
   <p class="ob-panel-text">Use the name and contact details you want attached to your security reports. We use your email for scan notifications and your phone for critical alerts only.</p>
  </div>
  <div class="ob-grid">
   <div class="ob-field ob-span-2">
    <label class="ob-label" for="obFullName">
     Full name
     <span aria-hidden="true">*</span>
    </label>
    <input class="ob-input" type="text" id="obFullName" name="fullName" placeholder="Jane Wanjiru Kamau" autocomplete="name"/>
    <span class="ob-err"></span>
   </div>
   <div class="ob-field">
    <label class="ob-label" for="obDob">
     Date of birth
     <span aria-hidden="true">*</span>
    </label>
    <input class="ob-input" type="date" id="obDob" name="dob"/>
    <span class="ob-hint">You must be at least 16 years old.</span>
    <span class="ob-err"></span>
   </div>
   [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Phone number ¦ * ¦ Include your country code for SMS alerts. || Email address ¦ * || Confirm email address ¦ *]
  </div>
 </section>
 [+2 more sibling <section> elements with the SAME structure as the one above; their text content in order: Step 02 — Career & account type ¦ How do you use VUNVAULT? ¦ Your role determines the assessment templates, compliance mappings and reporting depth we prepare for you. Your entity type determines the contracting and invoicing path. ¦ Career / role ¦ * ¦ Student ¦ Learning tracks, labs and free certificates. ¦ [+3 more sibling <label> elements with the SAME structure as the one above; their text content in order: Business Owner ¦ Starter scans and plain-language reporting. || Cybersecurity Professional ¦ Full-scope pentesting and purple-team work. || Independent Specialist ¦ Consulting, audits and client engagements.] ¦ Entity type ¦ * ¦ Individual ¦ Personal account, personal scope. ¦ [+2 more sibling <label> elements with the SAME structure as the one above; their text content in order: Company ¦ Registered business or startup. || Corporation ¦ Enterprise, group or public entity.] || Step 03 — Verification & finalisation ¦ Confirm and secure your account ¦ Review what we captured, answer one account-recovery question, and confirm the declarations below. Your recovery answer is hashed locally — we never store it in plain text. ¦ Captured details ¦ Ready to submit ¦ Account recovery question ¦ * ¦ Choose a recovery question… ¦ What was the name of your first pet? ¦ In what city were you born? ¦ What is your mother's maiden name? ¦ What was your first car? ¦ What was the name of your first school? ¦ Recovery answer ¦ * ¦ Case-insensitive. Keep it something only you would know. ¦ I confirm that the personal, contact and entity information I provided is accurate, current and belongs to me or to an organisation I am authorised to represent. ¦ [+2 more sibling <label> elements with the SAME structure as the one above; their text content in order: I confirm I will only request assessments against systems I own or have ¦ written authorisation ¦ to test, and I accept the ¦ Acceptable Use Policy ¦ . || I agree to the ¦ Terms of Service ¦ and ¦ Privacy Policy ¦ , including the processing of my data for account verification and security notifications.]]
 <section class="ob-success" id="obSuccess" hidden>
  <div class="ob-success-mark">
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
  </div>
  <h2 class="ob-success-title">Onboarding complete</h2>
  <p class="ob-success-text">
   Welcome aboard,
   <strong id="obSuccessName">friend</strong>
   . Your VUNVAULT profile has been created and verified. Taking you back to the main platform…
  </p>
  <div class="ob-redirect-bar">
   <span></span>
  </div>
  <p class="ob-redirect-note">Redirecting to vun1.html</p>
 </section>
 <div class="ob-actions" id="obActions">
  <button type="button" class="ob-btn ob-btn--ghost" id="obPrevBtn" hidden>
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
   <span>Back</span>
  </button>
  <span class="ob-progress-text" id="obProgressText">Step 1 of 3</span>
  <button type="button" class="ob-btn ob-btn--primary" id="obNextBtn">
   <span>Next</span>
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
  </button>
  <button type="submit" class="ob-btn ob-btn--primary" id="obSubmitBtn" hidden>
   <span>Complete Setup</span>
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
  </button>
 </div>
</form>
```
Custom CSS for this markup (reference):
```css
.ob-panel { padding: 34px 32px 8px; animation: obPanelIn 0.36s var(--ease) both; }
.ob-panel-head { margin-bottom: 26px; }
.ob-panel-index { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: var(--brand-strong); }
.ob-panel-title { margin-top: 8px; font-size: 1.35rem; font-weight: 800; letter-spacing: -0.02em; color: var(--ink); }
.ob-panel-text { margin-top: 8px; font-size: 0.84rem; line-height: 1.7; color: var(--ink-muted); max-width: 66ch; }
.ob-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.ob-span-2 { grid-column: 1 / -1; }
@media (max-width: 720px) {
.ob-grid { grid-template-columns: 1fr; }
.ob-span-2 { grid-column: auto; }
}
.ob-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.ob-label { font-size: 10.5px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-muted); }
.ob-label span { color: var(--critical); }
.ob-input { width: 100%; padding: 13px 14px; font-family: inherit; font-size: 0.88rem; color: var(--ink); background: #ffffff; border: 1px solid var(--line); border-radius: 12px; outline: none; transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease), background-color 0.2s var(--ease); }
.ob-input::placeholder { color: var(--ink-faint); }
.ob-input:hover { border-color: #d4d4d4; }
.ob-input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-tint); background: #ffffff; }
.ob-input.is-invalid { border-color: var(--critical); box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.14); animation: obShake 0.32s var(--ease); }
select.ob-input { appearance: none; -webkit-appearance: none; padding-right: 40px; background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%233B99FC' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; cursor: pointer; }
.ob-hint { font-size: 11px; line-height: 1.55; color: var(--ink-faint); }
.ob-err { font-size: 0.72rem; font-weight: 600; color: var(--critical); opacity: 0; transform: translateY(-3px); transition: opacity 0.2s var(--ease), transform 0.2s var(--ease); }
.ob-err.is-visible { opacity: 1; transform: translateY(0); }
.ob-actions { display: flex; align-items: center; gap: 12px; padding: 22px 32px 28px; margin-top: 12px; border-top: 1px solid var(--line-soft); background: linear-gradient(180deg, rgba(252, 251, 249, 0), rgba(252, 251, 249, 0.8)); }
.ob-progress-text { margin-inline: auto; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); white-space: nowrap; }
.ob-btn { display: inline-flex; align-items: center; justify-content: center; gap: 9px; padding: 14px 30px; font-family: inherit; font-size: 0.82rem; font-weight: 800; letter-spacing: 0.01em; border-radius: 9999px; border: 1px solid transparent; cursor: pointer; transition: transform 0.22s var(--ease), filter 0.22s var(--ease), box-shadow 0.22s var(--ease), background-color 0.22s var(--ease), border-color 0.22s var(--ease), color 0.22s var(--ease), opacity 0.2s var(--ease); }
.ob-btn svg { width: 15px; height: 15px; transition: transform 0.22s var(--ease); }
.ob-btn--primary { color: #ffffff; background: linear-gradient(135deg, var(--brand), var(--brand-strong)); border-color: rgba(59, 153, 252, 0.5); box-shadow: 0 16px 34px -16px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.25); }
.ob-btn--primary:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 22px 46px -18px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.3); }
.ob-btn--primary:hover:not(:disabled) svg { transform: translateX(3px); }
.ob-btn--primary:active:not(:disabled) { transform: translateY(0) scale(0.985); }
.ob-btn--ghost { color: var(--ink-soft); background: #ffffff; border-color: var(--line); }
.ob-btn--ghost:hover:not(:disabled) { color: var(--brand-strong); border-color: var(--brand-line); background: var(--brand-tint); transform: translateY(-1px); }
.ob-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.ob-btn.is-busy { pointer-events: none; }
.ob-success { padding: 56px 32px 62px; text-align: center; animation: obPanelIn 0.4s var(--ease) both; }
.ob-success-mark { position: relative; display: grid; place-items: center; width: 88px; height: 88px; margin: 0 auto 22px; border-radius: 50%; background: rgba(16, 185, 129, 0.1); border: 1.5px solid rgba(16, 185, 129, 0.4); animation: obPop 0.45s var(--ease) both; }
.ob-success-mark::after { content: ""; position: absolute; inset: -9px; border-radius: 50%; border: 1.5px solid rgba(16, 185, 129, 0.25); animation: obRing 1.9s var(--ease) infinite; }
.ob-success-mark svg { width: 38px; height: 38px; color: var(--ok); }
.ob-success-title { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em; color: var(--ink); }
.ob-success-text { margin-top: 10px; font-size: 0.86rem; line-height: 1.7; color: var(--ink-muted); max-width: 46ch; margin-inline: auto; }
.ob-success-text strong { color: var(--ink); }
.ob-redirect-bar { height: 3px; width: min(320px, 100%); margin: 26px auto 0; border-radius: 9999px; background: #ececec; overflow: hidden; }
.ob-redirect-bar span { display: block; height: 100%; width: 0; border-radius: 9999px; background: linear-gradient(90deg, var(--brand-strong), var(--brand-soft)); animation: obFill 2.2s var(--ease) forwards; }
.ob-redirect-note { margin-top: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-faint); }
@media (max-width: 768px) {
.ob-panel { padding: 26px 20px 6px;
/* …truncated by planner; remaining rules follow the same patterns… */
```

**Fields (`OnboardingStep3`):** `recoveryQuestion` (select with the five `RECOVERY_QUESTION_LABELS`: `What was the name of your first pet?`, `In what city were you born?`, `What is your mother's maiden name?`, `What was your first car?`, `What was the name of your first school?`), `recoveryAnswer` (min 3 chars; `type="password"`-like masked? NO — keep `type="text"` with `autocomplete="off"`, as in the prototype), and three REQUIRED checkboxes `declarations.infoAccurate`, `declarations.authorisedTesting`, `declarations.termsAccepted` with the label text verbatim from the markup; each unchecked shows the required message `You must accept this declaration to continue.` (planner copy).
**Submit:** `POST /api/v1/onboarding` with the full body (`step1`, `step2`, `step3`); pending state on the button (label from the markup + spinner); `201` → toast `{ kind: "ok", title: "Profile complete", message: "Welcome to your VUNVAULT workspace." }` and `router.replace("/portal")`; `409 already_completed` → redirect to `/portal`; `422 email_mismatch` → jump to step 1 with the field error `Email must match the address you signed up with.`; `400 validation_failed` → map `details` paths to fields and jump to the first step containing an error; network failure → toast `{ kind: "crit", title: "Could not save your profile", message: "Please try again." }`. After success invalidate `queryKeys.profile()` and `queryKeys.session()`.
**Privacy:** the recovery answer is sent once and never echoed, logged, or kept after submit (clear the RHF field).

**Tests:** submit blocked until all three declarations are checked; the body shape matches `OnboardingSubmitBody`; success navigates to `/portal`; 409 navigates; 422 jumps to step 1 with the message; the answer field is reset after success.

---

**Data shape (TypeScript):**
```ts
type OnboardingStep3 = { recoveryQuestion: RecoveryQuestion; recoveryAnswer: string; declarations: { infoAccurate: true; authorisedTesting: true; termsAccepted: true } };
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/onboarding body { step1; step2; step3 } → 201 { data: { completed: true; completedAt: string } } | 400 validation_failed | 409 { error: "already_completed" } | 422 { error: "email_mismatch" }
```

---

**Out of scope:**
- Do not add steps.
- Do not implement a recovery flow that uses the answer.
- Do not log the answer.

---

**Definition of done:**
☐ `pnpm --filter web typecheck` passes with zero errors.
☐ `pnpm --filter web lint` passes with zero errors.
☐ `pnpm --filter web dev` renders the route(s) in this task with no console errors, and `pnpm --filter web test` passes (a smoke test per new component renders it and asserts the key verbatim strings).
☐ Every visible string matches the copy specified above, verbatim.
☐ No hard-coded hex, radius, or easing values outside the token files named in Deliverables.
☐ Every animation has a `prefers-reduced-motion` fallback.
☐ Every interactive element is keyboard-reachable and has a visible focus state.
☐ Every dialog has `role="dialog"`, `aria-modal`, focus trap, Escape-to-close.
☐ Every icon-only button has an `aria-label`.
☐ No file was created or modified outside the Deliverables list.
☐ Report at the end: `Task 65 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---


This is Part 3 of 5. Say "continue" to receive Part 4 (L8 client portal, L9 admin surface, L10 scan worker).

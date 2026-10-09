### TASK 40f — Backend addendum C: admin contact inbox and client directory

**Layer:** L4

**Prerequisites:** Task 18, Task 20, Task 24, Task 25, Task 31, Task 40

**Estimated files touched:** 9

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Backend addendum C: admin contact inbox and client directory**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Give administrators a way to read and triage public contact messages (including Verified-Blogger requests) and to search client accounts for the badge grant.

**Deliverables:**
- MODIFY `packages/contracts/src/contact.ts` — add `ContactMessageView`, `ContactListQuery`, `ContactTriageBody`, `ClientDirectoryItem`, `ClientDirectoryQuery`.
- MODIFY `packages/contracts/src/routes-b.ts` — document the four routes.
- `apps/api/src/routes/v1/contact-admin/index.ts`, `service.ts`, `repo.ts`.
- MODIFY `apps/api/src/routes/v1/index.ts` — one `register` line.
- MODIFY `apps/api/src/audit/events.ts` — add `CONTACT_TRIAGED` (info, administrative).
- MODIFY `apps/api/src/conformance/route-manifest.ts` — nothing to exempt; extend the contract-drift expectations.
- `apps/api/src/routes/v1/contact-admin/contact-admin.test.ts`.
- MODIFY `apps/api/src/audit/events.test.ts`.
- MODIFY `packages/contracts/fixtures/index.ts` and add `packages/contracts/fixtures/contact.ts` — six fixture messages and four client directory rows.

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

**Permissions:** reads and triage need `support:handle` (held by `support_engineer`, `admin`, `super_admin`). Client directory needs `users:read`. All routes use `[authenticate, requireStaff, requirePermission(...)]`.

**Contracts:**
- `ContactMessageView = { id, name, email, organization: string | null, category: ContactCategory, categoryLabel: string, subject, message, status: "new"|"triaged"|"closed", assignedTo: { id: string; label: string } | null, createdAt: IsoDateTime }`.
- `ContactListQuery = PageQuery & { status?: ContactStatus, category?: ContactCategory }` (`q` searches name, email, organization, subject).
- `ContactTriageBody = { status?: ContactStatus, assignedTo?: Uuid | null }` with a refine that at least one is present.
- `ClientDirectoryItem = { id, fullName, email, company: string | null, clientCode: string | null, verifiedBlogger: boolean }`; `ClientDirectoryQuery = PageQuery & { verifiedBlogger?: boolean }`.

**Routes:**
- `GET /api/v1/admin/contact` (query `ContactListQuery`) → `{ data: ContactMessageView[]; total }` newest first. `message` is returned in full only to users with `support:handle`.
- `PATCH /api/v1/admin/contact/:id` body `ContactTriageBody` → `200 { data: ContactMessageView }`; `assignedTo` must be an active staff user; audited `CONTACT_TRIAGED` (details `{ status, assignedTo }`).
- `GET /api/v1/admin/clients` (query `ClientDirectoryQuery`, `users:read`) → `{ data: ClientDirectoryItem[]; total }`: profiles with `role = 'client'`, not deleted; `q` ILIKE on name, email, organization name, client code.
- The existing `POST/DELETE /admin/users/:id/blogger-badge` (Task 40) is used from the UI; no change.

**Tests (assert):** support engineer can list and triage but gets 403 on `/admin/clients`; assigning a client account as handler → `422 { error: "invalid_assignee" }`; list `q` filter; audit entry written on triage; the conformance suite passes.

---

**Data shape (TypeScript):**
```ts
interface ContactMessageView { id: string; name: string; email: string; organization: string | null; category: ContactCategory; categoryLabel: string; subject: string; message: string; status: "new" | "triaged" | "closed"; assignedTo: { id: string; label: string } | null; createdAt: string }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET   /api/v1/admin/contact query { page; pageSize; q?; status?; category? } → 200 { data: ContactMessageView[]; total }
// PATCH /api/v1/admin/contact/:id body { status?; assignedTo?: string | null } → 200 { data: ContactMessageView } | 404 | 422 invalid_assignee
// GET   /api/v1/admin/clients query { page; pageSize; q?; verifiedBlogger? } → 200 { data: ClientDirectoryItem[]; total }
```

---

**Out of scope:**
- Do not add reply/email-sending from the inbox.
- Do not expose raw IP hashes.
- Do not write UI.

---

**Definition of done:**
☐ `pnpm --filter api typecheck` passes with zero errors.
☐ `pnpm --filter api lint` passes with zero errors.
☐ `pnpm --filter api test` passes and `pnpm --filter api typecheck` passes with zero errors.
☐ No file was created or modified outside the Deliverables list.
☐ No dependency outside "Dependencies allowed" was added.
☐ No Express, Prisma, Joi, `localStorage`, or `sessionStorage` anywhere in the diff.
☐ Report at the end: `Task 40f complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---


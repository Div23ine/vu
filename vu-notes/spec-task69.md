### TASK 69 — Portal home: released scans list and report detail (planner-authored — no prototype)

**Layer:** L8

**Prerequisites:** Task 35, Task 12, Task 9, Task 45

**Estimated files touched:** 11

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Portal home: released scans list and report detail (planner-authored — no prototype)**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build `/portal` (the client's scans) and `/portal/scans/[id]` (released report detail with redacted findings) on the release-locked scans API.

**Deliverables:**
- `apps/web/src/app/(authed)/portal/page.tsx`
- `apps/web/src/app/(authed)/portal/scans/[id]/page.tsx`
- `apps/web/src/app/(authed)/portal/_components/scans-table.tsx`, `scan-summary-cards.tsx`, `new-scan-dialog.tsx`, `findings-list.tsx`, `severity-bar.tsx`
- `apps/web/src/app/(authed)/portal/_hooks/use-scans.ts`
- `apps/web/src/app/(authed)/portal/_styles/scans.css`
- `apps/web/src/mocks/handlers/scans.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- `apps/web/src/app/(authed)/portal/scans.test.tsx`

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

**No prototype exists for this page; build it from the shared primitives and the billing page's visual language (`vbb-*` card/table/chip styles live in `billing.css` — copy the needed rules into `scans.css`; do not import across features). All copy below is planner-authored.**

**`/portal` layout:** hero (eyebrow `Client Portal`, h1 `Your Security Reports`, p `Released penetration test and vulnerability assessment reports for your organisation.`) → three summary cards (`Reports released` count, `Open findings` count (critical+high highlighted), `Next assessment` days from profile stats) → `Request PenTest` hint card linking to the header dialog → the scans table (`DataTable`): columns `Job` (`JOB-4466`), `Target`, `Type` (`SCAN_TYPE_LABELS`), `Released` (date), `Findings` (compact severity bar with counts), `Action` (`View report`). Empty state: `No released reports yet` / `Reports appear here after the VUNVAULT team completes the mandatory review.` A secondary button `New scan request` opens `NewScanDialog`.
**Release lock (critical):** the list shows ONLY what `GET /api/v1/scans` returns (the API already excludes unreleased jobs). The UI must not infer or display unreleased jobs, review state, or gate state anywhere. A `404` on the detail page → the standard not-found page.
**NewScanDialog:** fields (RHF + Zod `CreateScanBody` minus `orgId`): `Target` (hostname, URL, IPv4 or CIDR; placeholder `app.example.co.ke`), `Scan type` (`SCAN_TYPE_LABELS`), `Priority` (`Low`…`Critical`, default `Medium`), `Environment` (`Production`/`Staging`), `Scope notes`, and `Signed authorisation (PDF, max 10 MB)` file input (required). Flow: `POST /scans/authorisation-url` → `PUT` the file to the presigned URL (`fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: file })`) → `POST /scans { …, authorisationDocKey }`. Messages: `422 authorisation_missing` → `The signed authorisation could not be verified. Upload it again.`; `422 target_not_allowed` → `That target cannot be scanned. Internal and private addresses require an engagement lead.`; success toast `{ kind: "ok", title: "Scan requested", message: "Job <JOB-code> is queued. You will be notified when the report is released." }`. Dialog note: `Only scan systems you own or are authorised in writing to test.` The new job does NOT appear in the table until released (explain in the toast text above).
**Detail page:** header (job code, target, type, released date), severity summary (`Critical`/`High`/`Medium`/`Low` counts as `Badge`s), the findings list from `GET /scans/:id/findings` — each finding a collapsible `<details>` with title, severity badge, CVSS and CWE when present, description, `Remediation` text (`remediationGuidance`) and `Evidence (redacted)` in a monospace block (React text node only). No export in v1 (`// TODO(backend-contract): report PDF`).

**Tests:** table renders MSW rows and links to detail; empty state; New scan dialog requires the PDF and runs the three requests in order (assert order); 422 mappings; detail renders findings sorted critical→low; evidence is rendered as text (an `<img onerror>` string stays inert).

---

**Data shape (TypeScript):**
```ts
// ScanJob, ScanFinding, CreateScanBody: see contracts (Task 19).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET  /api/v1/scans?page=&pageSize= → 200 { data: ScanJob[]; total }   (released jobs of own org only)
// GET  /api/v1/scans/:id → 200 { data: ScanJob } | 404 · GET /api/v1/scans/:id/findings → 200 { data: ScanFinding[] }
// POST /api/v1/scans/authorisation-url body { contentType: "application/pdf"; sizeBytes } → 200 { data: { uploadUrl; objectKey; expiresAt } }
// POST /api/v1/scans body { targetHost; scanType; priority?; environment?; scopeNotes?; authorisationDocKey } → 201 { data: ScanJob } | 422 authorisation_missing | 422 target_not_allowed
```

---

**Out of scope:**
- Do not show unreleased jobs or any review/gate/payment state.
- Do not connect to scan infrastructure.
- Do not implement report PDF export.

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
☐ Report at the end: `Task 69 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---


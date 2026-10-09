### TASK 83e — Admin Contact inbox and Verified-Blogger badge management (planner-authored — no prototype)

**Layer:** L9

**Prerequisites:** Task 40f, Task 46, Task 75, Task 12

**Estimated files touched:** 10

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Admin Contact inbox and Verified-Blogger badge management (planner-authored — no prototype)**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build `/admin/contact`: the triage inbox for public contact messages (including verification requests) and the client directory with the badge grant/revoke control.

**Deliverables:**
- `apps/web/src/app/(authed)/admin/contact/page.tsx`
- `apps/web/src/app/(authed)/admin/contact/_components/inbox-table.tsx`, `message-dialog.tsx`, `client-directory.tsx`, `badge-toggle.tsx`
- `apps/web/src/app/(authed)/admin/contact/_hooks/use-contact-admin.ts`
- `apps/web/src/app/(authed)/admin/contact/_styles/contact.css`
- MODIFY `apps/web/src/app/(authed)/admin/_components/admin-nav.ts` — add `Contact Inbox` · `/admin/contact` · `support:handle` (drawer label `Contact Inbox`).
- `apps/web/src/mocks/handlers/admin-contact.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- `apps/web/src/app/(authed)/admin/contact/contact-admin.test.tsx`

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

**Shared admin classes (`adm-card`, `adm-kpi*`, `adm-table*`, `adm-badge*`, `adm-btn*`, `adm-tag*`, `adm-page-head`, `adm-field`, `adm-select` …) already exist in `admin-shared.css` (Task 75) — import it; the CSS below is ONLY the rules specific to this page.**

**Planner-authored page; use the shared admin classes. Copy:** eyebrow `Support & Verification`, h1 `Contact Inbox`, description `Public contact requests, vulnerability reports and Verified Blogger verification requests.` Tabs: `Messages`, `Clients & Badges`.
**Messages tab:** summary chips (`New`, `Triaged`, `Closed` counts from the list totals), filters (status, category via `CONTACT_CATEGORY_LABELS`, search), `DataTable` columns `Received`, `From` (name + email + organisation), `Category`, `Subject`, `Status`, `Assigned to`, `Actions` (`Open`). `Open` shows a dialog with the full message (text node only), a status select (`new|triaged|closed`), an assignee select (active staff), `Save` → `PATCH /admin/contact/:id`; toast `Message updated` / `The request was saved.`. A message whose category is `journalist_blogger_profile_request` shows the banner `Verification request — grant the Verified Blogger badge from the Clients & Badges tab after you have verified the applicant.` with a `Find client` button that switches tabs and pre-fills the search with the sender's email.
**Clients & Badges tab:** requires `users:read` (otherwise hidden). `GET /admin/clients` table: `Client`, `Email`, `Company`, `Client ID`, `Verified Blogger` (chip), `Action` (`Grant badge` / `Revoke badge` — only with `users:manage`; confirm dialog; `POST/DELETE /admin/users/:id/blogger-badge`; toasts `Badge granted` / `<email> can now use the Content Studio.` and `Badge revoked` / `<email> can no longer submit articles.`).

**Tests:** inbox rows and filters; message dialog saves status/assignee; verification banner and the tab hand-off; badge grant/revoke permission gating and toasts.

---

**Data shape (TypeScript):**
```ts
// ContactMessageView, ClientDirectoryItem: see contracts (Task 40f).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/admin/contact · PATCH /api/v1/admin/contact/:id · GET /api/v1/admin/clients · POST|DELETE /api/v1/admin/users/:id/blogger-badge
```

---

**Out of scope:**
- Do not send replies from the inbox.
- Do not expose the message body to roles without `support:handle`.
- Do not edit other admin pages.

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
☐ Report at the end: `Task 83e complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---


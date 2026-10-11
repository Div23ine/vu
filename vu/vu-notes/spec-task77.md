### TASK 77 — Admin Scan Queue: summary, filters, table, bulk actions

**Layer:** L9

**Prerequisites:** Task 35, Task 46, Task 75, Task 12

**Estimated files touched:** 14

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Admin Scan Queue: summary, filters, table, bulk actions**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build `/admin/scan-queue` on the admin scans API: summary tiles, search/filter toolbar, sortable selectable table with ETA/progress/gate/payment state, bulk action bar and the row action menu.

**Deliverables:**
- `apps/web/src/app/(authed)/admin/scan-queue/page.tsx`
- `apps/web/src/app/(authed)/admin/scan-queue/_components/queue-summary.tsx`, `queue-toolbar.tsx`, `queue-table.tsx`, `bulk-bar.tsx`, `row-actions.tsx`, `gate-badge.tsx`, `payment-chip.tsx`, `queue-footer-card.tsx`
- `apps/web/src/app/(authed)/admin/scan-queue/_hooks/use-scan-queue.ts`
- `apps/web/src/app/(authed)/admin/scan-queue/_styles/scan-queue.css`
- `apps/web/src/mocks/handlers/admin-scans.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- `apps/web/src/app/(authed)/admin/scan-queue/scan-queue.test.tsx`

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

**Reference markup (the review-gate dialog inside this file is Task 78):**

##### Scan Queue page body
```html
<div class="adm-shell">
 <div class="adm-page-head">
  <div>
   <span class="adm-eyebrow">Vulnerability Assessment & Job Queue</span>
   <h1 class="adm-page-title">Scan Queue & Job Assessment</h1>
   <p class="adm-page-sub">Every penetration test, external scan and internal assessment in one queue. Client release is blocked until an administrator clears the Mandatory Admin Review Gate.</p>
  </div>
  <div class="adm-head-actions">
   <button type="button" class="adm-btn adm-btn-primary" id="sq-new-job">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>New Scan Request</span>
   </button>
   <button type="button" class="adm-btn adm-btn-dark" id="sq-export-queue">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Export Queue</span>
   </button>
   <button type="button" class="adm-btn adm-btn-ghost" id="sq-refresh">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Refresh</span>
   </button>
  </div>
 </div>
 <section aria-labelledby="sq-kpi-heading">
  <h2 id="sq-kpi-heading" class="sr-only">Queue summary indicators</h2>
  <div class="adm-kpi-grid">
   <article class="adm-kpi">
    <span class="adm-kpi-label">Jobs In Queue</span>
    <span class="adm-kpi-value">96</span>
    <span class="adm-kpi-delta adm-kpi-delta--up">▲ 14 added today</span>
   </article>
   [+5 more sibling <article> elements with the SAME structure as the one above; their text content in order: Running Scans ¦ 12 ¦ ● 12 of 24 worker slots || Awaiting Admin Review ¦ 37 ¦ ● Client release blocked || Approved & Released ¦ 1,842 ¦ ▲ 96 released this week || Payment Outstanding ¦ 9 ¦ ▲ 3 overdue > 14 days || Held / Rejected ¦ 5 ¦ ● Pending remediation]
  </div>
 </section>
 <section class="sq-toolbar" aria-labelledby="sq-filter-heading">
  <div class="sq-toolbar-head">
   <h2 class="sq-toolbar-title" id="sq-filter-heading">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    Filter & Search Queue
   </h2>
   <span class="sq-results" role="status" aria-live="polite">
    Showing
    <strong id="sq-visible-count">10</strong>
    of
    <strong id="sq-total-count">10</strong>
    jobs
   </span>
  </div>
  <div class="sq-toolbar-grid">
   <div class="sq-field">
    <label class="sq-field-label" for="sq-search">Search</label>
    <div class="sq-input-wrap">
     <span class="sq-input-icon" aria-hidden="true">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
     </span>
     <input id="sq-search" class="sq-input" type="search" placeholder="Job ID, target host, client or requester…" autocomplete="off"/>
    </div>
   </div>
   [+4 more sibling <div> elements with the SAME structure as the one above; their text content in order: Job Status ¦ All statuses ¦ Running ¦ Awaiting Review ¦ Completed ¦ Queued ¦ Held || Review Gate ¦ All gate states ¦ Awaiting Review ¦ In Review ¦ Approved — Released ¦ Held — Blocked ¦ Blocked — Payment || Payment ¦ All payments ¦ Paid ¦ Pending ¦ Overdue || Scan Type ¦ All types ¦ External ¦ API ¦ Internal ¦ Network ¦ Mobile]
   <div class="sq-toolbar-actions">
    <button type="button" class="sq-clear-btn" id="sq-clear-filters">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     <span>Reset</span>
    </button>
   </div>
  </div>
 </section>
 <div class="sq-bulkbar" id="sq-bulkbar" role="region" aria-label="Bulk job actions">
  <span class="sq-bulk-count">
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
   <strong id="sq-selected-count">0</strong>
   job(s) selected
  </span>
  <div class="sq-bulk-actions">
   <button type="button" class="sq-bulk-btn sq-bulk-btn--primary">Open Review Gate</button>
   <button type="button" class="sq-bulk-btn">Assign Reviewer</button>
   <button type="button" class="sq-bulk-btn">Place On Hold</button>
   <button type="button" class="sq-bulk-btn sq-bulk-btn--danger">Reject Batch</button>
   <button type="button" class="sq-bulk-btn">Clear Selection</button>
  </div>
 </div>
 <section class="adm-card sq-table-card" aria-labelledby="sq-table-heading">
  <div class="adm-card-head">
   <div>
    <h2 class="adm-card-title" id="sq-table-heading">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Vulnerability Assessment & Job Queue
    </h2>
    <p class="adm-card-note">Target host details, client request information, payment status and per-job review-gate state. Results remain locked until an administrator approves release.</p>
   </div>
   <span class="adm-tag adm-tag--warn">37 Awaiting Review</span>
  </div>
  <div class="adm-table-wrap">
   <table class="adm-table sq-table">
    <caption class="sr-only">Vulnerability assessment job queue with target host, client request, payment status and mandatory admin review gate</caption>
    <thead>
     <tr>
      <th>
       <input type="checkbox" class="sq-check" id="sq-select-all" aria-label="Select all visible jobs"/>
      </th>
      <th>Job / Requested</th>
      <th>Target Host</th>
      <th>Client Request Info</th>
      <th>Type</th>
      <th>Payment</th>
      <th>Priority</th>
      <th>Status / Progress</th>
      <th>Review Gate</th>
      <th>Actions</th>
     </tr>
    </thead>
    <tbody id="sq-tbody">
     <tr class="sq-row">
      <td>
       <input type="checkbox" class="sq-check sq-row-check" aria-label="Select JOB-4471"/>
      </td>
      <td>
       <span class="sq-job">JOB-4471</span>
       <span class="sq-sub sq-sub--mono">24 Sep · 06:12 UTC</span>
      </td>
      <td>
       <span class="sq-host">api.horizonsacco.co.ke</span>
       <span class="sq-sub sq-sub--mono">41.90.64.12</span>
       <span class="sq-env sq-env--prod">Production</span>
      </td>
      <td>
       <span class="sq-client">Horizon SACCO</span>
       <span class="sq-sub">grace@horizonsacco.co.ke</span>
       <span class="sq-sub">Scope: external API + auth flow</span>
      </td>
      <td>
       <span class="adm-badge adm-badge--info">External</span>
      </td>
      <td>
       <span class="adm-badge adm-badge--settled">Paid</span>
      </td>
      <td>
       <span class="sq-prio sq-prio--critical">Critical</span>
      </td>
      <td>
       <div class="sq-progress">
        <progress class="adm-progress" value="78" aria-label="JOB-4471 progress">78%</progress>
        <span class="sq-progress-val">78%</span>
       </div>
       <span class="sq-sub">Running · ETA 4m 12s</span>
      </td>
      <td>
       <div class="sq-gate">
        <span class="sq-gate-badge sq-gate-badge--awaiting">Awaiting Review</span>
        <span class="sq-gate-lock sq-gate-lock--locked">
         <svg data-icon="REPLACE-WITH-LUCIDE"/>
         Client release blocked
        </span>
       </div>
      </td>
      <td>
       <div class="sq-actions">
        <button type="button" class="sq-act sq-act--primary">Review Findings</button>
        <button type="button" class="sq-act">Hold</button>
        <button type="button" class="sq-icon-btn" aria-label="View report preview for JOB-4471">
         <svg data-icon="REPLACE-WITH-LUCIDE"/>
        </button>
       </div>
      </td>
     </tr>
     [+9 more sibling <tr> elements with the SAME structure as the one above; their text content in order: JOB-4470 ¦ 24 Sep · 05:48 UTC ¦ pay.nairobifintech.com ¦ 102.68.77.14 ¦ Production ¦ Nairobi Fintech Group ¦ devops@nairobifintech.com ¦ Scope: payment gateway API ¦ API ¦ Paid ¦ High ¦ 64% ¦ 64% ¦ Running · ETA 7m 38s ¦ Awaiting Review ¦ Client release blocked ¦ Review Findings ¦ Hold || JOB-4469 ¦ 23 Sep · 21:30 UTC ¦ vault.lakeviewlogistics.com ¦ 10.24.8.11 ¦ Internal ¦ Lakeview Logistics ¦ security@lakeviewlogistics.com ¦ Scope: internal credential vault ¦ Internal ¦ Paid ¦ High ¦ 41% ¦ 41% ¦ Running · ETA 13m 05s ¦ In Review ¦ Client release blocked ¦ Continue Review ¦ Reassign || JOB-4468 ¦ 23 Sep · 18:05 UTC ¦ 10.24.8.0/24 ¦ Internal subnet · 254 hosts ¦ Internal ¦ Lakeview Logistics ¦ security@lakeviewlogistics.com ¦ Scope: internal network sweep ¦ Network ¦ Paid ¦ Medium ¦ 89% ¦ 89% ¦ Running · ETA 1m 47s ¦ Awaiting Review ¦ Client release blocked ¦ Review Findings ¦ Hold || JOB-4467 ¦ 23 Sep · 15:22 UTC ¦ mobile.mwananchi.co.ke ¦ 41.90.12.88 ¦ Production ¦ Mwananchi Microfinance ¦ mobile@mwananchi.co.ke ¦ Scope: Android + iOS API surface ¦ Mobile ¦ Pending ¦ Critical ¦ 0% ¦ 0% ¦ Queued · not yet assigned ¦ Blocked — Payment ¦ Not eligible for review ¦ Request Payment ¦ Cancel Job || JOB-4466 ¦ 22 Sep · 11:14 UTC ¦ core.kijaniagri.co.ke ¦ 41.90.55.21 ¦ Production ¦ Kijani Agri Co-op ¦ it@kijaniagri.co.ke ¦ Scope: public web perimeter ¦ External ¦ Paid ¦ Medium ¦ 100% ¦ 100% ¦ Completed · 22 Sep 14:02 UTC ¦ Approved — Released ¦ Client access granted ¦ Download Report ¦ Revoke Release || JOB-4465 ¦ 21 Sep · 09:47 UTC ¦ portal.techbridge.co.ke ¦ 197.248.10.4 ¦ Staging ¦ TechBridge Solutions ¦ admin@techbridge.co.ke ¦ Scope: customer portal + SSO ¦ External ¦ Overdue ¦ High ¦ 100% ¦ 100% ¦ Completed · held for remediation ¦ Held — Blocked ¦ Client release blocked ¦ Reopen Review ¦ Reassign || JOB-4464 ¦ 21 Sep · 07:03 UTC ¦ auth.mwananchi.co.ke ¦ 41.90.12.90 ¦ Production ¦ Mwananchi Microfinance ¦ security@mwananchi.co.ke ¦ Scope: authentication & token service ¦ API ¦ Paid ¦ Critical ¦ 100% ¦ 100% ¦ Completed · 21 Sep 09:41 UTC ¦ Awaiting Review ¦ Client release blocked ¦ Review Findings ¦ Hold || JOB-4463 ¦ 20 Sep · 13:26 UTC ¦ vpn.nairobifintech.com ¦ 102.68.77.20 ¦ Production ¦ Nairobi Fintech Group ¦ devops@nairobifintech.com ¦ Scope: VPN concentrator & MFA ¦ Internal ¦ Paid ¦ High ¦ 100% ¦ 100% ¦ Completed · 20 Sep 16:12 UTC ¦ Approved — Released ¦ Client access granted ¦ Download Report ¦ Revoke Release || JOB-4462 ¦ 19 Sep · 10:58 UTC ¦ shop.kijaniagri.co.ke ¦ 41.90.55.30 ¦ Production ¦ Kijani Agri Co-op ¦ it@kijaniagri.co.ke ¦ Scope: e-commerce storefront ¦ External ¦ Paid ¦ Low ¦ 100% ¦ 100% ¦ Completed · 19 Sep 12:44 UTC ¦ Approved — Released ¦ Client access granted ¦ Download Report ¦ Revoke Release]
    </tbody>
    <tfoot>
     <tr>
      <td>Client release is locked until the Mandatory Admin Review Gate is cleared by an administrator.</td>
     </tr>
    </tfoot>
   </table>
  </div>
  <div class="sq-empty" id="sq-empty">
   <span class="sq-empty-icon" aria-hidden="true">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </span>
   <span class="sq-empty-title">No jobs match the current filters</span>
   <span class="sq-empty-text">Adjust your search terms or reset the filters to see the full vulnerability assessment queue.</span>
   <button type="button" class="adm-btn adm-btn-ghost" id="sq-empty-reset">Reset Filters</button>
  </div>
 </section>
 <section class="adm-card adm-card--dark sq-gate-card" aria-labelledby="sq-gate-heading">
  <div class="adm-card-head">
   <div>
    <h2 class="adm-card-title" id="sq-gate-heading">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Mandatory Admin Review Gate
    </h2>
    <p class="adm-card-note">No penetration test result leaves the platform without a human administrator clearing four mandatory verification steps. This gate cannot be bypassed, delegated or automated.</p>
   </div>
   <span class="adm-tag adm-tag--crit">Enforced</span>
  </div>
  <div class="adm-card-body">
   <ol class="sq-gate-steps">
    <li class="sq-gate-step">
     <span class="sq-gate-step-num">01</span>
     <span class="sq-gate-step-title">Scope Authorisation Verified</span>
     <span class="sq-gate-step-text">Confirm the signed authorisation document covers every host in the target list and that the testing window has not expired.</span>
    </li>
    [+3 more sibling <li> elements with the SAME structure as the one above; their text content in order: 02 ¦ Evidence Sanitised ¦ Ensure no live client production data, credentials or personal information is embedded in screenshots, payloads or proof-of-concept output. || 03 ¦ Findings Manually Validated ¦ Every critical and high severity finding must be independently reproduced and confirmed by the reviewing administrator before it reaches the client. || 04 ¦ Remediation Guidance Attached ¦ The report must ship with prioritised, actionable remediation steps and a re-test window before the release flag can be flipped.]
   </ol>
   <div class="sq-gate-alert">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span class="sq-gate-alert-text">
     <strong>Release lock:</strong>
     Jobs sitting in
     <em>Awaiting Review</em>
     ,
     <em>In Review</em>
     ,
     <em>Held</em>
     or
     <em>Blocked — Payment</em>
     are invisible to the client portal. Attempting to release a locked job raises a
     <strong>SEV-2 audit event</strong>
     and notifies the incident commander on duty.
    </span>
   </div>
  </div>
 </section>
</div>
```
Custom CSS for this markup (reference):
```css
.adm-page-sub { margin-top: 8px; max-width: 74ch; font-size: 0.85rem; line-height: 1.7; color: var(--ink-muted); }
.adm-kpi-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px; margin-bottom: 26px; }
.adm-card { display: flex; flex-direction: column; border-radius: 18px; background: #ffffff; border: 1px solid var(--line); box-shadow: 0 18px 44px -38px rgba(10, 13, 18, 0.55); overflow: hidden; }
.adm-card-note { margin-top: 5px; font-size: 0.74rem; line-height: 1.6; color: var(--ink-muted); max-width: 66ch; }
.adm-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
.adm-table tbody td { padding: 14px 16px; vertical-align: top; color: var(--ink); border-bottom: 1px solid var(--line-soft); }
.sq-toolbar { margin-bottom: 18px; padding: 20px 22px; border-radius: 18px; background: #ffffff; border: 1px solid var(--line); box-shadow: 0 16px 40px -36px rgba(10, 13, 18, 0.6); }
.sq-toolbar-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.sq-toolbar-title { display: flex; align-items: center; gap: 9px; font-size: 0.86rem; font-weight: 800; color: var(--ink); }
.sq-toolbar-title svg { color: var(--brand); }
.sq-results { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; font-weight: 700; color: var(--ink-muted); }
.sq-results strong { color: var(--brand-strong); }
.sq-toolbar-grid { display: grid; grid-template-columns: minmax(220px, 2.2fr) repeat(4, minmax(140px, 1fr)) auto; gap: 12px; align-items: end; }
@media (max-width: 1280px) {
.sq-toolbar-grid { grid-template-columns: minmax(220px, 2fr) repeat(2, minmax(140px, 1fr)); }
}
@media (max-width: 720px) {
.sq-toolbar-grid { grid-template-columns: 1fr; }
}
.sq-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.sq-field-label { font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); }
.sq-input-wrap { position: relative; display: flex; align-items: center; }
.sq-input-icon { position: absolute; left: 13px; color: var(--ink-faint); pointer-events: none; display: inline-flex; }
.sq-input,
      .sq-select { width: 100%; padding: 11px 14px; font-size: 0.8rem; color: var(--ink); background: #ffffff; border: 1px solid var(--line); border-radius: 12px; outline: none; transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
.sq-input { padding-left: 38px; }
.sq-input::placeholder { color: var(--ink-faint); }
.sq-input:focus,
      .sq-select:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-tint); }
.sq-toolbar-actions { display: flex; gap: 8px; }
.sq-clear-btn { display: inline-flex; align-items: center; gap: 7px; padding: 11px 18px; font-size: 0.76rem; font-weight: 800; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); border-radius: 12px; cursor: pointer; white-space: nowrap; transition: all var(--dur) var(--ease); }
.sq-clear-btn:hover { background: var(--brand); border-color: var(--brand); color: #ffffff; }
.sq-bulkbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 16px; padding: 12px 18px; border-radius: 14px; background: linear-gradient(135deg, var(--dark), #070b11); border: 1px solid rgba(59, 153, 252, 0.3); box-shadow: 0 18px 40px -30px rgba(0, 0, 0, 0.8); color: #ffffff; opacity: 0; max-height: 0; padding-block: 0; overflow: hidden; transform: translateY(-6px); transition: opacity 0.25s var(--ease), max-height 0.3s var(--ease), padding 0.3s var(--ease), transform 0.25s var(--ease); }
.sq-bulkbar.is-active { opacity: 1; max-height: 160px; padding-block: 12px; transform: translateY(0); }
.sq-bulk-count { display: inline-flex; align-items: center; gap: 9px; font-size: 0.78rem; font-weight: 700; color: #cbd5e1; }
.sq-bulk-count strong { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 1rem; font-weight: 800; color: var(--brand-soft); }
.sq-bulk-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.sq-bulk-btn { display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; font-size: 0.72rem; font-weight: 800; border-radius: var(--r-full); cursor: pointer; color: #cbd5e1; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.14); transition: all 0.2s var(--ease); }
.sq-bulk-btn:hover { color: #ffffff; border-color: rgba(59, 153, 252, 0.5); background: rgba(59, 153, 252, 0.16); transform: translateY(-1px); }
.sq-bulk-btn--primary { color: #04121f; background: linear-gradient(135deg, var(--brand-soft), var(--brand)); border-color: transparent; }
.sq-bulk-btn--primary:hover { filter: brightness(1.06); color: #04121f; }
.sq-bulk-btn--danger { color: #fda4af; border-color: rgba(244, 63, 94, 0.35); }
.sq-bulk-btn--danger:hover { color: #ffffff; background: rgba(244, 63, 94, 0.25); border-color: rgba(244, 63, 94, 0.6); }
.sq-table-card { overflow: hidden; }
.sq-table { min-width: 1240px; }
.sq-table tbody td { vertical-align: middle; }
.sq-table thead th:first-child,
      .sq-table tbody td:first-child { width: 42px; padding-right: 4px; }
.sq-check { appearance: none; -webkit-appearance: none; width: 17px; height: 17px; border-radius: 5px; border: 1.5px solid var(--line); background: #ffffff; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 0.18s var(--ease); flex: 0 0 auto; }
.sq-check:hover { border-color: var(--brand-line); }
.sq-check:checked { background: linear-gradient(135deg, var(--brand), var(--brand-strong)); border-color: transparent; }
.sq-check:checked::after { content: ""; width: 5px; height: 9px; border: solid #ffffff; border-width: 0 2px 2px 0; transform: rotate(45deg) translate(-1px, -1px); }
.sq-check:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--brand-tint); }
.sq-job { display: block; font-size: 0.76rem; font-weight: 800; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); border-radius: 7px; padding: 4px 9px; white-space: nowrap; width: max-content; }
.sq-sub { display: block; margin-top: 5px; font-size: 10.5px; line-height: 1.5; color: var(--ink-muted); }
.sq-sub--mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10px; letter-spacing: 0.01em; }
.sq-host { display: block; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.76rem; font-weight: 800; color: var(--ink); word-break: break-all; max-width: 22ch; }
.sq-client { display: block; font-size: 0.78rem; font-weight: 800; color: var(--ink); }
.sq-env { display: inline-block; margin-top: 6px; padding: 3px 9px; font-size: 9px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; border-radius: var(--r-full); border: 1px solid transparent; }
.sq-env--prod { color: #9f1239; background: #fff1f2; border-color: #fecdd3; }
.sq-prio { display: inline-flex; align-items: center; gap: 6px; padding: 4px 11px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; border-radius: var(--r-full); white-space: nowrap; border: 1px solid transparent; }
.sq-prio::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.sq-prio--critical { color: #9f1239; background: #fff1f2; border-color: #fecdd3; }
.sq-progress { display: flex; align-items: center; gap: 10px; min-width: 150px; }
.sq-progress .adm-progress { flex: 1 1 auto; }
.sq-progress-val { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; font-weight: 800; color: var(--brand-strong); min-width: 36px; text-align: right; }
.sq-gate { display: flex; flex-direction: column; gap: 6px; min-width: 165px; }
.sq-gate-badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; font-size: 9.5px; fo
/* …truncated by planner; remaining rules follow the same patterns… */
```

Verbatim strings found in the prototype's script (toast titles/messages, status and validation text — use exactly these where the matching event occurs; the surrounding logic is replaced by API calls):
- `use strict`
- `><circle cx=`
- `Filters cleared`
- `Showing the full vulnerability assessment queue.`
- `Selection cleared`
- `No jobs are selected.`
- `No jobs selected`
- `Select at least one job from the queue first.`
- `Nothing to review`
- `None of the selected jobs are eligible for the review gate.`
- `Review gate opened`
- `eligible job(s) in the current selection.`
- `Reviewer assigned`
- `job(s) reassigned to a.njoroge.`
- `Jobs placed on hold`
- `job(s) locked pending remediation.`
- `Batch rejected`
- `job(s) returned to the analyst for rework.`
- `Awaiting Review`
- `Complete all five verification steps and select a decision to enable the gate action.`
- `Pending — awaiting settlement`
- `Overdue — collection required`
- `verification step(s) still outstanding before the gate can be cleared.`
- `All verification steps complete — select a gate decision to continue.`
- `All checks complete. Confirming will write this decision to the immutable audit log.`
- `Client portal access granted. Decision written to the audit log`
- `with reviewer note.`
- `held for remediation`
- `Report remains locked. The client has been notified of outstanding findings.`
- `Job returned to the assigned analyst for rework and re-submission.`
**Data:** `GET /admin/scans/summary` → tiles (`Jobs in Queue`, `Added today`, `Running Scans` + worker slots, `Awaiting Admin Review`, `Approved & Released` + `Released this week`, `Payment Outstanding` + `Overdue > 14 days`, `Held / Rejected`) — copy for labels from the markup. `GET /admin/scans` with `q`, `status`, `gate`, `payment`, `type`, `page`, `pageSize`, sort; filters live in the URL query (`useSearchParams`) so views are linkable; `Clear filters` resets and toasts `Filters cleared` / `Showing the full vulnerability assessment queue.`. Table via `DataTable` (Task 12) with `enableRowSelection`; columns exactly as the markup (select, `Job ID`/`Requested`, `Target`/`Client`, `Type`, `Priority`, `Status` with progress bar and ETA (`formatEta`, completed shows the completed timestamp), `Review Gate`, `Payment`, `Actions`). Timestamps `DD Mon · HH:MM UTC` (`formatQueueStamp`). Gate and payment chip text from `REVIEW_GATE_LABELS` / `PAYMENT_STATUS_LABELS`.
**Bulk bar (appears when ≥ 1 row selected; `aria-live="polite"` count `<n> selected`):** `Open Review Gate`, `Assign Reviewer` (reviewer select listing active staff with `scans:review`; default = current user), `Place on Hold`, `Reject Batch`, `Clear` → `POST /admin/scans/bulk`; response `{ updated, skippedIds }` → toast with the matching prototype titles (`Review gate opened` / `Reviewer assigned` / `Jobs placed on hold` / `Batch rejected`) and message `<updated> job(s) …` using the verbatim tails from the strings list; when nothing is selected the toast is `No jobs selected` / `Select at least one job from the queue first.`; when all skipped → `Nothing to review` / `None of the selected jobs are eligible for the review gate.`. Bulk can never release.
**Row actions menu (per row; items depend on state):** `Review gate` (opens the Task 78 dialog for jobs with gate `in_review`), `Preview report` (read-only toast `Opening report preview` / `<JOB> — client-facing copy (redacted).`; no endpoint — `// TODO(backend-contract)`), `Request payment` (`POST …/request-payment`; toast `Payment reminder sent` / `<JOB> — invoice re-issued to the client billing contact.`), `Cancel job` (`POST …/cancel`, confirm dialog; toast `Job removed from the queue and archived to the audit trail.`), `Assign analyst` is out of scope (no endpoint) — omit it. Items the user lacks permission for are hidden (`scans:review`, `scans:release`).
Poll the list every 15 s while visible; the real-time push comes in Layer L12.

**Tests:** summary tiles from MSW; URL-driven filters; selection shows the bulk bar and count; bulk call body shape; skipped-all toast; row menu items by state; permission-hidden actions; timestamps formatted in UTC.

---

**Data shape (TypeScript):**
```ts
// ScanJob, ScanQueueSummary, BulkScanActionBody: see contracts (Task 19).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/admin/scans?… → 200 { data: ScanJob[]; total } · GET …/summary → { data: ScanQueueSummary }
// POST /api/v1/admin/scans/bulk body { action; ids; reviewerId? } → 200 { data: { updated; skippedIds } }
// POST /api/v1/admin/scans/:id/request-payment | /cancel → 200 { data: ScanJob }
```

---

**Out of scope:**
- Do not build the review-gate dialog (Task 78).
- Do not release anything from the bulk bar.
- Do not show scan output (Layer L12).

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
☐ Report at the end: `Task 77 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---


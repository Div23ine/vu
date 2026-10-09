### TASK 81 — Admin Zero-Day Intel A: summary, advisory editor, NVD import, drafts, recent advisories

**Layer:** L9

**Prerequisites:** Task 38, Task 46, Task 75

**Estimated files touched:** 15

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Admin Zero-Day Intel A: summary, advisory editor, NVD import, drafts, recent advisories**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build `/admin/zero-day`: summary tiles, the advisory editor (CVE, vendor, CVSS, severity, flags, scope entries, summary, remediation, references), NVD import, the live client-view preview, drafts and the published-advisories table.

**Deliverables:**
- `apps/web/src/app/(authed)/admin/zero-day/page.tsx`
- `apps/web/src/app/(authed)/admin/zero-day/_components/zd-summary.tsx`, `advisory-editor.tsx`, `scope-entries.tsx`, `severity-picker.tsx`, `client-preview.tsx`, `drafts-panel.tsx`, `recent-advisories.tsx`, `patch-status-menu.tsx`
- `apps/web/src/app/(authed)/admin/zero-day/_hooks/use-advisories-admin.ts`
- `apps/web/src/app/(authed)/admin/zero-day/_lib/cvss.ts` — `severityFromCvss`, band hints.
- `apps/web/src/app/(authed)/admin/zero-day/_styles/zero-day.css`
- `apps/web/src/mocks/handlers/admin-advisories.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- `apps/web/src/app/(authed)/admin/zero-day/zero-day-a.test.tsx`

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

**Reference markup (the Emergency Broadcast dialog is Task 82):**

##### Zero-Day Intel page body (editor, side panels, recent advisories)
```html
<div class="adm-shell">
 <div class="adm-page-head">
  <div>
   <span class="adm-eyebrow">Zero-Day Intelligence & Advisory Desk</span>
   <h1 class="adm-page-title">Zero-Day Advisory Editor</h1>
   <p class="adm-page-sub">
    Draft, review and broadcast zero-day advisories. Save work in progress as a draft, or raise an emergency broadcast that pushes the advisory to every affected client dashboard within seconds.
   </p>
  </div>
  <div class="adm-head-actions">
   <button type="button" class="adm-btn adm-btn-ghost" id="zd-new-advisory">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>New Advisory</span>
   </button>
   <button type="button" class="adm-btn adm-btn-dark" id="zd-import-cve">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Import From NVD</span>
   </button>
   <button type="button" class="adm-btn adm-btn-ghost" id="zd-view-history">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Broadcast History</span>
   </button>
  </div>
 </div>
 <section aria-labelledby="zd-kpi-heading">
  <h2 id="zd-kpi-heading" class="sr-only">Zero-day intelligence indicators</h2>
  <div class="adm-kpi-grid">
   <article class="adm-kpi">
    <span class="adm-kpi-label">Active Zero-Days</span>
    <span class="adm-kpi-value">1,284</span>
    <span class="adm-kpi-delta adm-kpi-delta--down">▲ 62 this week</span>
   </article>
   [+5 more sibling <article> elements with the SAME structure as the one above; their text content in order: Critical Severity ¦ 46 ¦ 9 currently unpatched || Weaponized In Wild ¦ 37 ¦ ● Active exploitation confirmed || Advisories Published ¦ 418 ¦ ▲ 12 broadcast this month || Open Drafts ¦ 7 ¦ ● 3 escalated for review || Dashboards Reached ¦ 312 ¦ ▲ 18 new clients this month]
  </div>
 </section>
 <div class="zd-layout">
  <div class="zd-col">
   <section class="adm-card" aria-labelledby="zd-editor-heading">
    <div class="adm-card-head">
     <div>
      <h2 class="adm-card-title" id="zd-editor-heading">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Advisory Editor
      </h2>
      <p class="adm-card-note">Complete the CVE details, set the severity level and define the affected scope. Drafts are private to the intelligence team until explicitly broadcast.</p>
     </div>
     <span class="adm-tag" id="zd-draft-tag">Draft — Not Published</span>
    </div>
    <div class="adm-card-body">
     <form class="zd-form" id="zd-form">
      <fieldset class="zd-fieldset">
       <legend class="zd-legend">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
        Identifiers
       </legend>
       <div class="zd-row">
        <div class="zd-field">
         <label class="zd-label" for="zd-cve">
          <span>
           CVE ID
           <span class="zd-label-req" aria-hidden="true">*</span>
          </span>
          <span class="zd-hint">Format: CVE-YYYY-NNNNN</span>
         </label>
         <input id="zd-cve" class="zd-input zd-mono" type="text" name="cve" placeholder="CVE-2026-21447" autocomplete="off" required aria-describedby="zd-cve-error"/>
         <span class="zd-hint" id="zd-cve-error" hidden>Enter a valid CVE identifier in the format CVE-YYYY-NNNNN.</span>
        </div>
        <div class="zd-field">
         <label class="zd-label" for="zd-vendor">
          <span>Vendor / Project</span>
         </label>
         <input id="zd-vendor" class="zd-input" type="text" name="vendor" placeholder="Apache Software Foundation" autocomplete="off"/>
        </div>
       </div>
       <div class="zd-row">
        <div class="zd-field">
         <label class="zd-label" for="zd-cvss">
          <span>CVSS v3.1 Base Score</span>
          <span class="zd-hint">0.0 – 10.0</span>
         </label>
         <input id="zd-cvss" class="zd-input zd-mono" type="text" name="cvss" placeholder="9.8" inputmode="decimal" autocomplete="off" maxlength="4"/>
        </div>
        <div class="zd-field">
         <label class="zd-label" for="zd-published">
          <span>Disclosure Date (UTC)</span>
         </label>
         <input id="zd-published" class="zd-input zd-mono" type="date" name="published"/>
        </div>
       </div>
      </fieldset>
      [+4 more sibling <fieldset> elements with the SAME structure as the one above; their text content in order: Severity Level ¦ Critical ¦ CVSS 9.0 – 10.0 ¦ High ¦ CVSS 7.0 – 8.9 ¦ Medium ¦ CVSS 4.0 – 6.9 ¦ Low ¦ CVSS 0.1 – 3.9 ¦ Weaponized in the wild ¦ Public PoC available ¦ Pre-auth exploitable ¦ Vendor patch available || Advisory Title ¦ Headline ¦ * ¦ 0 / 140 ¦ An advisory title is required before saving or broadcasting. ¦ Use the pattern: ¦ Product — impact in plain language ¦ . Avoid exploit detail in the headline. || Affected Scope ¦ Affected Products, Versions, Platforms or Hosts ¦ Press Enter to add ¦ Add ¦ Quick add: ¦ Web & API ¦ Network & Edge ¦ Endpoint / Desktop ¦ Cloud & Containers ¦ Mobile ¦ OT / ICS ¦ Identity & SSO ¦ Add every product, version range, platform or client host class the advisory applies to. The broadcast engine matches these against client asset inventories. || Technical Summary & Guidance ¦ Technical Summary ¦ 0 / 1200 ¦ Remediation Guidance ¦ 0 / 900 ¦ References ¦ One URL per line]
     </form>
    </div>
   </section>
   <section class="adm-card" aria-labelledby="zd-published-heading">
    <div class="adm-card-head">
     <div>
      <h2 class="adm-card-title" id="zd-published-heading">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Recently Published Advisories
      </h2>
      <p class="adm-card-note">Last six advisories pushed to client dashboards, with broadcast reach and remediation state.</p>
     </div>
     <span class="adm-tag adm-tag--ok">418 Published</span>
    </div>
    <div class="adm-table-wrap">
     <table class="adm-table zd-table">
      <caption class="sr-only">Recently published zero-day advisories</caption>
      <thead>
       <tr>
        <th>CVE ID</th>
        <th>Advisory Title</th>
        <th>Severity</th>
        <th>Broadcast</th>
        <th class="adm-num">Reach</th>
        <th>Status</th>
        <th>Actions</th>
       </tr>
      </thead>
      <tbody>
       <tr>
        <td class="adm-mono">CVE-2026-21447</td>
        <td>
         <span class="zd-advisory-title">Apache Struts 2 — OGNL injection RCE</span>
         <span class="zd-advisory-scope">Web & API · Struts 2.0.0 – 2.5.32</span>
        </td>
        <td>
         <span class="zd-sev-pill zd-sev-pill--critical">Critical</span>
        </td>
        <td class="adm-mono">24 Sep · 14:36</td>
        <td class="adm-num adm-strong">312</td>
        <td>
         <span class="adm-badge adm-badge--crit">Unpatched</span>
        </td>
        <td>
         <div class="zd-row-actions">
          <button type="button" class="zd-act">Edit</button>
          <button type="button" class="zd-act">Re-broadcast</button>
          <button type="button" class="zd-act zd-act--danger">Retract</button>
         </div>
        </td>
       </tr>
       [+5 more sibling <tr> elements with the SAME structure as the one above; their text content in order: CVE-2026-0091 ¦ Cisco IOS XE — Web UI authentication bypass ¦ Network & Edge · IOS XE 17.x ¦ Critical ¦ 24 Sep · 14:35 ¦ 284 ¦ Patch in progress ¦ Edit ¦ Re-broadcast ¦ Retract || CVE-2026-3327 ¦ Oracle WebLogic — deserialization RCE ¦ Web & API · WebLogic 12.2.1.x ¦ High ¦ 24 Sep · 14:32 ¦ 196 ¦ Unpatched ¦ Edit ¦ Re-broadcast ¦ Retract || CVE-2026-18820 ¦ Windows Print Spooler — privilege escalation ¦ Endpoint / Desktop · Windows 10 / 11 ¦ High ¦ 24 Sep · 14:28 ¦ 298 ¦ Patched ¦ Edit ¦ Re-broadcast ¦ Retract || CVE-2025-53112 ¦ Google Chrome V8 — type confusion in JIT ¦ Endpoint / Desktop · Chrome < 128.0.6 ¦ Critical ¦ 24 Sep · 14:25 ¦ 305 ¦ Patched ¦ Edit ¦ Re-broadcast ¦ Retract || CVE-2026-1104 ¦ Linux Kernel io_uring — use-after-free ¦ OT / ICS · Kernel 6.4 – 6.9 ¦ High ¦ 24 Sep · 14:21 ¦ 152 ¦ Patched ¦ Edit ¦ Re-broadcast ¦ Retract]
      </tbody>
      <tfoot>
       <tr>
        <td>Broadcast reach counts unique client dashboards that acknowledged the advisory within 24 hours.</td>
       </tr>
      </tfoot>
     </table>
    </div>
   </section>
  </div>
  <aside class="zd-col" aria-label="Advisory publishing controls">
   <section class="adm-card adm-card--dark">
    <div class="adm-card-head">
     <div>
      <h2 class="adm-card-title">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Publish Controls
      </h2>
      <p class="adm-card-note">Save the advisory as a private draft, or raise an emergency broadcast to every affected client dashboard.</p>
     </div>
    </div>
    <div class="adm-card-body zd-panel">
     <div class="zd-panel-section">
      <span class="zd-panel-title">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Editorial State
      </span>
      <div class="zd-status-row">
       <span>Current status</span>
       <strong id="zd-status-value">Draft</strong>
      </div>
      <div class="zd-status-row">
       <span>Last saved</span>
       <strong id="zd-last-saved">Never</strong>
      </div>
      <div class="zd-status-row">
       <span>Severity set</span>
       <strong id="zd-severity-value">Not set</strong>
      </div>
      <div class="zd-status-row">
       <span>Scope entries</span>
       <strong id="zd-scope-count">0</strong>
      </div>
      <div class="zd-status-row">
       <span>Author</span>
       <strong>e.reed</strong>
      </div>
     </div>
     [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Actions ¦ Save Draft ¦ Preview Client View ¦ Emergency Broadcast ¦ Broadcasts are irreversible once dispatched. Verify the severity and scope before confirming. || Emergency broadcast ¦ pushes the advisory to every matching client dashboard, issues email and SMS alerts to registered contacts, and opens a SEV-1 audit event. || Estimated Broadcast Reach ¦ Client dashboards ¦ 312 ¦ Email contacts ¦ 486 ¦ SMS / on-call ¦ 74 ¦ Incident commander ¦ 1]
    </div>
   </section>
   <section class="adm-card" aria-labelledby="zd-drafts-heading">
    <div class="adm-card-head">
     <div>
      <h2 class="adm-card-title" id="zd-drafts-heading">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Open Drafts
      </h2>
      <p class="adm-card-note">Work in progress, private to the intelligence team.</p>
     </div>
     <span class="adm-tag adm-tag--warn">7</span>
    </div>
    <div class="adm-card-body">
     <div class="zd-drafts">
      <article class="zd-draft" tabindex="0">
       <div class="zd-draft-top">
        <span class="zd-draft-cve">CVE-2026-40118</span>
        <span class="zd-sev-pill zd-sev-pill--critical">Critical</span>
       </div>
       <span class="zd-draft-title">Kubernetes ingress-nginx — admission webhook bypass</span>
       <div class="zd-draft-meta">
        <span>e.reed · 12 min ago</span>
        <span>Unsaved changes</span>
       </div>
      </article>
      [+2 more sibling <article> elements with the SAME structure as the one above; their text content in order: CVE-2026-39980 ¦ High ¦ PostgreSQL — privilege escalation via extension loading ¦ f.hassan · 2 hours ago ¦ Awaiting reviewer || CVE-2026-38771 ¦ Medium ¦ Redis — ACL bypass in sentinel failover path ¦ d.mwangi · Yesterday ¦ Needs scope entries]
     </div>
     <div>
      <button type="button" class="adm-mini-btn" id="zd-view-all-drafts">View all 7 drafts</button>
     </div>
    </div>
   </section>
   <section class="adm-card" aria-labelledby="zd-preview-heading">
    <div class="adm-card-head">
     <div>
      <h2 class="adm-card-title" id="zd-preview-heading">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Client Dashboard Preview
      </h2>
      <p class="adm-card-note">Live rendering of how this advisory appears to clients.</p>
     </div>
    </div>
    <div class="adm-card-body">
     <div class="zd-preview">
      <div class="zd-preview-top">
       <span class="zd-preview-cve" id="zd-prev-cve">CVE-XXXX-XXXXX</span>
       <span class="zd-preview-sev zd-preview-sev--none" id="zd-prev-sev">No severity</span>
      </div>
      <span class="zd-preview-title is-placeholder" id="zd-prev-title">Advisory title will appear here</span>
      <div class="zd-preview-scope" id="zd-prev-scope">
       <span class="zd-preview-chip">No scope entries</span>
      </div>
      <div class="zd-preview-foot">
       <span>Source: VUNVAULT Intelligence</span>
       <span id="zd-prev-date">Not dated</span>
      </div>
     </div>
    </div>
   </section>
  </aside>
 </div>
</div>
```
Custom CSS for this markup (reference):
```css
.adm-page-sub { margin-top: 8px; max-width: 76ch; font-size: 0.85rem; line-height: 1.7; color: var(--ink-muted); }
.adm-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; filter: none !important; box-shadow: none !important; }
.adm-kpi-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px; margin-bottom: 26px; }
.adm-card { display: flex; flex-direction: column; border-radius: 18px; background: #ffffff; border: 1px solid var(--line); box-shadow: 0 18px 44px -38px rgba(10, 13, 18, 0.55); overflow: hidden; }
.adm-card-note { margin-top: 5px; font-size: 0.74rem; line-height: 1.6; color: var(--ink-muted); max-width: 68ch; }
.adm-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
.adm-table tbody td { padding: 14px 16px; vertical-align: top; color: var(--ink); border-bottom: 1px solid var(--line-soft); }
.zd-layout { display: grid; grid-template-columns: minmax(0, 2.15fr) minmax(0, 1fr); gap: 20px; align-items: start; margin-bottom: 20px; }
@media (max-width: 1180px) {
.zd-layout { grid-template-columns: 1fr; }
}
.zd-col { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.zd-form { display: flex; flex-direction: column; gap: 22px; }
.zd-fieldset { display: flex; flex-direction: column; gap: 16px; border: 0; padding: 0; margin: 0; min-width: 0; }
.zd-legend { display: flex; align-items: center; gap: 9px; padding: 0; margin-bottom: 4px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-faint); }
.zd-legend::after { content: ""; flex: 1 1 auto; height: 1px; background: var(--line-soft); }
.zd-legend svg { color: var(--brand); flex: 0 0 auto; }
.zd-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
@media (max-width: 760px) {
.zd-row, .zd-row--3 { grid-template-columns: 1fr; }
}
.zd-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.zd-label { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 10px; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; color: var(--ink-muted); }
.zd-label-req { color: #be123c; font-size: 11px; line-height: 1; }
.zd-hint { font-size: 10px; font-weight: 600; letter-spacing: 0; text-transform: none; color: var(--ink-faint); }
.zd-input,
      .zd-select,
      .zd-textarea { width: 100%; padding: 12px 14px; font-size: 0.82rem; font-family: inherit; color: var(--ink); background: #ffffff; border: 1px solid var(--line); border-radius: 12px; outline: none; transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease), background-color var(--dur) var(--ease); }
.zd-input::placeholder,
      .zd-textarea::placeholder { color: var(--ink-faint); }
.zd-input:focus,
      .zd-select:focus,
      .zd-textarea:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-tint); }
.zd-input.is-invalid,
      .zd-select.is-invalid,
      .zd-textarea.is-invalid { border-color: var(--critical); box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.16); animation: zdShake 0.32s var(--ease); }
.zd-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; letter-spacing: 0.01em; }
.zd-scope-input-row .zd-input { flex: 1 1 auto; }
.zd-panel { display: flex; flex-direction: column; gap: 16px; }
.zd-panel-section { display: flex; flex-direction: column; gap: 12px; }
.zd-panel-section + .zd-panel-section { padding-top: 16px; border-top: 1px solid var(--line-soft); }
.adm-card--dark .zd-panel-section + .zd-panel-section { border-top-color: rgba(255, 255, 255, 0.08); }
.zd-panel-title { display: flex; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-faint); }
.adm-card--dark .zd-panel-title { color: #7d8b9e; }
.zd-panel-title svg { color: var(--brand); flex: 0 0 auto; }
.zd-status-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 0.74rem; font-weight: 600; color: var(--ink-soft); }
.adm-card--dark .zd-status-row { color: #93a2b5; }
.zd-status-row strong { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.74rem; font-weight: 800; color: var(--ink); }
.adm-card--dark .zd-status-row strong { color: #ffffff; }
.zd-actions-stack .adm-btn { width: 100%; }
.adm-card--dark .zd-action-note { color: #64748b; }
.zd-drafts { display: flex; flex-direction: column; gap: 10px; }
.zd-draft { display: flex; flex-direction: column; gap: 5px; padding: 13px 14px; border-radius: 12px; background: #f8fafc; border: 1px solid var(--line-soft); cursor: pointer; transition: all 0.2s var(--ease); }
.zd-draft:hover { transform: translateY(-2px); border-color: var(--brand-line); box-shadow: 0 14px 30px -22px var(--brand-glow); }
.zd-draft-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.zd-draft-cve { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.72rem; font-weight: 800; color: var(--ink); }
.zd-draft-title { font-size: 0.72rem; line-height: 1.5; color: var(--ink-muted); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.zd-draft-meta { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 9.5px; font-weight: 700; color: var(--ink-faint); }
.zd-preview { display: flex; flex-direction: column; gap: 12px; padding: 18px; border-radius: 14px; background: linear-gradient(160deg, rgba(59, 153, 252, 0.06), rgba(10, 13, 18, 0.02)); border: 1px solid var(--brand-line); }
.zd-preview-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.zd-preview-cve { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.78rem; font-weight: 800; color: var(--brand-strong); letter-spacing: 0.02em; }
.zd-preview-sev { display: inline-flex; align-items: center; gap: 6px; padding: 4px 11px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; border-radius: var(--r-full); border: 1px solid transparent; }
.zd-preview-sev--none { color: var(--ink-muted); background: #f4f4f5; border-color: var(--line); }
.zd-preview-title { font-size: 0.92rem; font-weight: 800; line-height: 1.4; color: var(--ink); }
.zd-preview-title.is-placeholder { color: var(--ink-faint); font-style: italic; font-weight: 600; }
.zd-preview-scope { display: flex; flex-wrap: wrap; gap: 6px; }
.zd-preview-chip { padding: 4px 10px; font-size: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 700; color: var(--ink-soft); background: #ffffff; border: 1px solid var(--line); border-radius: var(--r-full); }
.zd-preview-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding-top: 12px; border-top: 1px dashed var(--line); font-size: 9.5px; font-weight: 700; color: var(--ink-faint); }
.zd-table { min-width: 960px; }
.zd-sev-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 11px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; border-radius: var(--r-full); white-space: nowrap; border: 1px solid transparent; }
.zd-sev-pill::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.zd-sev-pill--critical { color: #9f1239; background: #fff1f2; border-color: #fecdd3; }
.zd-advisory-title { display: block; font-size: 0.78rem; font-weight: 700; color: var(--ink); line-height: 1.45; }
.zd-advisory-scope { display: block; margin-top: 5px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10px; color: var(--ink-muted); }
.zd-row-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.zd-act { display: inline-flex; align-items: center; gap: 6px; padding: 7p
/* …truncated by planner; remaining rules follow the same patterns… */
```

Verbatim strings found in the prototype's script (toast titles/messages, status and validation text — use exactly these where the matching event occurs; the surrounding logic is replaced by API calls):
- `use strict`
- `><circle cx=`
- `Remove scope entry:`
- `Already in scope`
- `Scope updated`
- `No scope entries`
- `Advisory title will appear here`
- `Complete all five acknowledgements and type the confirmation phrase to unlock the broadcast button.`
- `acknowledgement(s) still outstanding before broadcast can proceed.`
- `All acknowledgements complete — type "`
- `" to unlock the broadcast button.`
- `All checks complete. Broadcasting will dispatch the advisory immediately and cannot be undone.`
- `a valid CVE identifier`
- `an advisory title`
- `a severity level`
- `at least one scope entry`
- `Advisory incomplete`
- `before raising an emergency broadcast.`
- `Emergency broadcast dispatched`
- `pushed to 312 client dashboards, 486 email contacts and 74 on-call SMS numbers.`
- `Audit event recorded`
- `SEV-1 broadcast event written with session reference ADM-2026-0924-7F3A.`
- `Nothing to save`
- `Add at least a CVE identifier before saving this advisory as a draft.`
- `Draft saved`
- `stored privately. Only the intelligence team can see it until broadcast.`
- `Client view preview`
- `Opening a read-only rendering of the advisory as clients would see it.`
**Editor (RHF + Zod `AdvisoryDraftBody`/`AdvisoryPublishable`):** fields and labels verbatim from the markup. CVE field validates `^CVE-\d{4}-\d{4,}$` with the verbatim message `Enter a valid CVE identifier in the format CVE-YYYY-NNNNN.`; `Import from NVD` button → `GET /admin/advisories/nvd?cveId=` pre-fills vendor, CVSS, severity, disclosure date, title, summary, references (never auto-saves; toast `NVD data imported` / `Review the imported fields before saving.` (planner); `404` → `CVE not found in NVD.`; `502` → `NVD is unavailable. Enter the details manually.`). Severity picker (`Critical`/`High`/`Medium`/`Low` with the `SEVERITY_CVSS_HINTS`) auto-selects from CVSS but can be set manually; a mismatch shows the warning `Severity does not match the CVSS score.`. Four flag toggles (`Weaponized`, `Public PoC`, `Pre-auth`, `Patch available` — labels from the markup). **Scope entries:** type + Enter adds a chip (max 50; duplicate → toast `Already in scope` / `"<entry>" is already listed.`), optional category select from `SCOPE_CATEGORY_LABELS`, remove buttons have `aria-label="Remove scope entry: <entry>"`. Counters: summary ≤ 1200, remediation ≤ 900, title ≤ 140. **Live client preview** (right column) renders the advisory exactly as `ClientAdvisory` cards do (Task 70) with placeholders `Advisory title will appear here`, `No scope entries`, severity chip `none` state; the `Preview as client` button toasts `Client view preview` / `Opening a read-only rendering of the advisory as clients would see it.`.
**Save Draft:** disabled/toast when only empty: `Nothing to save` / `Add at least a CVE identifier before saving this advisory as a draft.`; otherwise `POST /admin/advisories` (create) or `PUT …/:id` and toast `Draft saved` / `<CVE> stored privately. Only the intelligence team can see it until broadcast.`; `409 cve_exists` → field error `An advisory for this CVE already exists.`. `Clear editor` → toast `Editor cleared` / `Ready for a new zero-day advisory.`. Autosave is NOT used.
**Drafts panel:** `GET /admin/advisories/drafts` rows (CVE, title, author, `note` chip when present) — clicking loads the draft into the editor (`PUT` afterwards). **Recent published advisories:** `GET /admin/advisories?status=published` table (CVE, title/scope, severity chip, broadcast time, `reach` as `<n> dashboards`, patch status with an inline menu → `PATCH …/patch-status` for users with `intel:write`; `Retract` for `intel:broadcast` users opens a confirm dialog with a required note ≥ 10 → `POST …/retract`). Summary tiles from `GET /admin/advisories/summary`.
**Permissions:** the `Emergency Broadcast` area is visible only with `intel:broadcast`; analysts (`intel:write`) can draft and save.

**Tests:** CVE message; NVD import fills fields without saving; severity/CVSS mismatch warning; scope add/duplicate/remove with the verbatim toast; draft create vs update; drafts panel load; patch-status change; permission gating.

---

**Data shape (TypeScript):**
```ts
// AdvisoryDraftBody, Advisory, AdvisorySummary, DraftListItem, NvdImportResult: see contracts (Task 20d).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/admin/advisories/summary · /drafts · /nvd?cveId= · ?status= … (see contracts)
// POST /api/v1/admin/advisories → 201 | 409 cve_exists · PUT /api/v1/admin/advisories/:id → 200 | 409 not_editable
// PATCH /api/v1/admin/advisories/:id/patch-status { patchStatus } → 200 · POST …/retract { note } → 200
```

---

**Out of scope:**
- Do not broadcast from this task (Task 82).
- Do not auto-publish NVD data.
- Do not use browser storage for drafts.

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
☐ Report at the end: `Task 81 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---


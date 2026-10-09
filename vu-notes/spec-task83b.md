### TASK 83b — Admin Audit Logs: summary, filters, chain status, verification, export, event detail

**Layer:** L9

**Prerequisites:** Task 39, Task 46, Task 75, Task 12

**Estimated files touched:** 14

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Admin Audit Logs: summary, filters, chain status, verification, export, event detail**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build `/admin/audit` on the read-only audit API: summary tiles, filter bar, live-style table, hash-chain status panel, verify/export/snapshot actions and the event detail dialog.

**Deliverables:**
- `apps/web/src/app/(authed)/admin/audit/page.tsx`
- `apps/web/src/app/(authed)/admin/audit/_components/audit-summary.tsx`, `audit-toolbar.tsx`, `audit-table.tsx`, `chain-panel.tsx`, `event-dialog.tsx`, `severity-chip.tsx`
- `apps/web/src/app/(authed)/admin/audit/_hooks/use-audit.ts`
- `apps/web/src/app/(authed)/admin/audit/_styles/audit.css`
- `apps/web/src/mocks/handlers/admin-audit.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- `apps/web/src/app/(authed)/admin/audit/audit.test.tsx`

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

**Reference markup:**

##### Audit Logs page body
```html
<div class="adm-shell">
 <div class="adm-page-head">
  <div>
   <span class="adm-eyebrow">Cryptographic System Audit Trail</span>
   <h1 class="adm-page-title">System Audit Logs</h1>
   <p class="adm-page-sub">
    Immutable, hash-chained record of every security event, authentication attempt, scan completion and administrative report release across the VUNVAULT platform. Writes are append-only and every entry is signed with AES-256-GCM.
   </p>
  </div>
  <div class="adm-head-actions">
   <button type="button" class="adm-btn adm-btn-primary" id="al-verify-chain">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Verify Hash Chain</span>
   </button>
   <button type="button" class="adm-btn adm-btn-dark" id="al-export-logs">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Export Compliance Data</span>
   </button>
   <button type="button" class="adm-btn adm-btn-ghost" id="al-refresh-stream">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Refresh Stream</span>
   </button>
  </div>
 </div>
 <section aria-labelledby="al-kpi-heading">
  <h2 id="al-kpi-heading" class="sr-only">Audit trail indicators</h2>
  <div class="adm-kpi-grid">
   <article class="adm-kpi">
    <span class="adm-kpi-label">Events (24h)</span>
    <span class="adm-kpi-value">1,482</span>
    <span class="adm-kpi-delta adm-kpi-delta--up">▲ 6.4% vs. yesterday</span>
   </article>
   [+5 more sibling <article> elements with the SAME structure as the one above; their text content in order: Auth Attempts ¦ 316 ¦ 9 failed · 2 locked out || Scan Completions ¦ 96 ¦ ▲ 12 in the last hour || Report Releases ¦ 23 ¦ All approved by review gate || Chain Integrity ¦ 100 ¦ % ¦ 0 hash mismatches || Retention (WORM) ¦ 7 ¦ yr ¦ Immutable · AES-256-GCM]
  </div>
 </section>
 <div class="al-layout">
  <div class="al-col">
   <section class="al-toolbar" aria-labelledby="al-filter-heading">
    <div class="al-toolbar-head">
     <h2 class="al-toolbar-title" id="al-filter-heading">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      Filter & Search Audit Trail
     </h2>
     <span class="al-results" role="status" aria-live="polite">
      Showing
      <strong id="al-visible-count">18</strong>
      of
      <strong id="al-total-count">18</strong>
      events
     </span>
    </div>
    <div class="al-toolbar-grid">
     <div class="al-field">
      <label class="al-field-label" for="al-search">Search</label>
      <div class="al-input-wrap">
       <span class="al-input-icon" aria-hidden="true">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
       </span>
       <input id="al-search" class="al-input" type="search" placeholder="Actor, IP, CVE, job ID or message…" autocomplete="off"/>
      </div>
     </div>
     [+4 more sibling <div> elements with the SAME structure as the one above; their text content in order: Event Type ¦ All events ¦ Authentication ¦ Scan Completion ¦ Report Release ¦ Administrative ¦ Security Event ¦ System || Severity ¦ Any severity ¦ Success / OK ¦ Informational ¦ Warning ¦ Critical || Actor ¦ Any actor ¦ e.reed (Super Admin) ¦ a.njoroge (Admin) ¦ d.mwangi (Analyst) ¦ f.hassan (Analyst) ¦ b.otieno (Operator) ¦ g.wanjiru (Auditor) ¦ System / automation || Time Range ¦ Last 24 hours ¦ Last hour ¦ Last 6 hours ¦ Last 7 days ¦ Last 30 days]
     <div class="al-toolbar-actions">
      <button type="button" class="al-clear-btn" id="al-clear-filters">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       <span>Reset</span>
      </button>
     </div>
    </div>
   </section>
   <section class="al-console" aria-labelledby="al-console-heading">
    <div class="al-console-chrome">
     <div class="al-chrome-left">
      <span class="al-dots" aria-hidden="true">
       <span class="al-dot al-dot--close"></span>
       <span class="al-dot al-dot--min"></span>
       <span class="al-dot al-dot--max"></span>
      </span>
      <span class="al-chrome-title" id="al-console-heading">vunvault-audit-trail@node-nbo-01:/var/log/vunvault/audit.log — tail -f</span>
     </div>
     <div class="al-chrome-right">
      <span class="al-chrome-pill al-chrome-pill--live">
       <span class="al-live-dot" aria-hidden="true"></span>
       <span>Live</span>
      </span>
      <span class="al-chrome-pill al-chrome-pill--chain" id="al-chain-pill">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       <span>Chain Intact</span>
      </span>
     </div>
    </div>
    <div class="al-console-meta">
     <div class="al-meta-cell">
      <span class="al-meta-label">Node</span>
      <span class="al-meta-value">node-nbo-01 · NBO-CORE</span>
     </div>
     [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Encryption ¦ AES-256-GCM || Head Hash ¦ 0x7f3a9c21d48b05e6 || Last Sync ¦ --:--:-- UTC]
    </div>
    <div class="al-console-body" id="al-console-body" role="log" aria-live="polite" aria-label="Audit trail stream">
     <article class="al-row al-row--ok">
      <span class="al-cell al-ts">
       <strong>09:41:12</strong>
       UTC
      </span>
      <span class="al-cell">
       <span class="al-type al-type--auth">Auth</span>
      </span>
      <span class="al-cell al-msg">
       <strong>AUTH_SUCCESS</strong>
       · e.reed@vunvault.com signed in from
       <span class="al-ip">196.201.214.77</span>
       (Nairobi, KE) · MFA
       <span class="al-ok">hardware-key verified</span>
      </span>
      <span class="al-cell">
       <span class="al-actor">
        <span class="al-actor-dot al-actor-dot--admin"></span>
        e.reed
       </span>
      </span>
      <span class="al-cell">
       <span class="al-2fa al-2fa--ok">2FA OK</span>
      </span>
     </article>
     [+17 more sibling <article> elements with the SAME structure as the one above; their text content in order: 09:38:04 ¦ UTC ¦ Security ¦ AUTH_RATE_LIMIT ¦ · 5 failed attempts in 90 s from ¦ 41.90.64.199 ¦ targeting ¦ admin@vunvault.com ¦ · source IP ¦ temporarily blocked for 15 min ¦ system ¦ 2FA FAIL || 09:36:48 ¦ UTC ¦ Scan ¦ SCAN_COMPLETE ¦ · ¦ JOB-4471 ¦ against ¦ api.horizonsacco.co.ke ¦ finished in 4 m 12 s · ¦ 3 findings (1 critical, 1 high, 1 medium) ¦ e.reed ¦ — || 09:34:21 ¦ UTC ¦ Release ¦ REPORT_RELEASED ¦ · ¦ JOB-4471 ¦ approved at the Mandatory Admin Review Gate and released to ¦ Horizon SACCO ¦ client portal · reviewer note attached ¦ e.reed ¦ 2FA OK || 09:32:09 ¦ UTC ¦ Auth ¦ AUTH_FAILURE ¦ · login attempt from ¦ 185.220.101.42 ¦ (TOR exit node) against ¦ admin@vunvault.com ¦ · source ¦ denied by geo-block policy ¦ external ¦ 2FA FAIL || 09:28:55 ¦ UTC ¦ Admin ¦ USER_PROVISIONED ¦ · invitation issued to ¦ a.mohamed@vunvault.com ¦ as Security Analyst — Offensive Security · MFA enrolment required within 72 h ¦ e.reed ¦ 2FA OK || 09:24:11 ¦ UTC ¦ Auth ¦ AUTH_SUCCESS ¦ · a.njoroge@vunvault.com signed in from ¦ 41.90.32.10 ¦ (Nairobi, KE) · MFA ¦ TOTP verified ¦ a.njoroge ¦ 2FA OK || 09:18:33 ¦ UTC ¦ Scan ¦ SCAN_COMPLETE ¦ · ¦ JOB-4470 ¦ against ¦ pay.nairobifintech.com ¦ finished · ¦ 2 findings (1 high, 1 medium) ¦ a.njoroge ¦ — || 09:12:04 ¦ UTC ¦ Admin ¦ PERMISSION_CHANGED ¦ · role elevated for ¦ d.mwangi@vunvault.com ¦ — granted ¦ Security Automation scope ¦ · SEV-2 audit event ¦ e.reed ¦ 2FA OK || 09:06:47 ¦ UTC ¦ Admin ¦ ADVISORY_BROADCAST ¦ · ¦ CVE-2026-21447 ¦ emergency advisory pushed to ¦ 312 client dashboards ¦ · SEV-1 audit event ¦ f.hassan ¦ 2FA OK || 08:54:12 ¦ UTC ¦ Release ¦ REPORT_RELEASED ¦ · ¦ JOB-4460 ¦ approved and released to ¦ Nairobi Fintech Group ¦ client portal ¦ e.reed ¦ 2FA OK || 08:00:00 ¦ UTC ¦ System ¦ KEY_ROTATION ¦ · audit log encryption key rotated by KMS · ¦ previous key archived to cold storage ¦ system ¦ — || 07:44:19 ¦ UTC ¦ Auth ¦ AUTH_MFA_FAILURE ¦ · invalid TOTP code for ¦ k.kimani@vunvault.com ¦ from ¦ 41.90.88.42 ¦ · ¦ attempt 3 of 5 before lockout ¦ system ¦ 2FA FAIL || 07:12:08 ¦ UTC ¦ Scan ¦ SCAN_COMPLETE ¦ · ¦ JOB-4469 ¦ against ¦ vault.lakeviewlogistics.com ¦ finished · ¦ 0 critical · 2 high · 6 medium ¦ d.mwangi ¦ — || 06:58:33 ¦ UTC ¦ Admin ¦ ACCOUNT_SUSPENDED ¦ · ¦ l.achieng@vunvault.com ¦ suspended after 68 days of inactivity · ¦ all session tokens revoked ¦ e.reed ¦ 2FA OK || 06:00:00 ¦ UTC ¦ Security ¦ CHAIN_VERIFIED ¦ · hourly hash chain integrity check completed · ¦ 1,482 entries · 0 mismatches ¦ system ¦ — || 17:22:14 ¦ UTC ¦ Auth ¦ AUTH_SUCCESS ¦ · g.wanjiru@vunvault.com signed in from ¦ 41.90.10.44 ¦ (Nairobi, KE) · MFA ¦ TOTP verified ¦ g.wanjiru ¦ 2FA OK || 23:00:00 ¦ UTC ¦ System ¦ LOG_BACKUP ¦ · daily audit log snapshot written to immutable WORM cold storage · ¦ retention 7 years ¦ system ¦ —]
    </div>
    <div class="al-empty" id="al-empty">
     <span class="al-empty-icon" aria-hidden="true">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
     </span>
     <span class="al-empty-title">No audit events match the current filters</span>
     <span class="al-empty-text">Adjust your search terms or reset the filters to see the full cryptographic audit trail.</span>
     <button type="button" class="adm-btn adm-btn-ghost" id="al-empty-reset">Reset Filters</button>
    </div>
   </section>
  </div>
  <aside class="al-col" aria-label="Audit integrity controls">
   <section class="adm-card adm-card--dark">
    <div class="adm-card-head">
     <div>
      <h2 class="adm-card-title">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Cryptographic Chain
      </h2>
      <p class="adm-card-note">Append-only Merkle-linked log. Each entry commits to the hash of the previous.</p>
     </div>
     <span class="adm-tag adm-tag--ok">Intact</span>
    </div>
    <div class="adm-card-body al-panel">
     <div class="al-panel-section">
      <span class="al-panel-title">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Chain State
      </span>
      <div class="al-status-row">
       <span>Total entries</span>
       <strong>1,482,904</strong>
      </div>
      <div class="al-status-row">
       <span>Chain height</span>
       <strong>1,482,904</strong>
      </div>
      <div class="al-status-row">
       <span>Genesis block</span>
       <strong>2024-03-01</strong>
      </div>
      <div class="al-status-row">
       <span>Last verified</span>
       <strong id="al-last-verified">06:00:00 UTC</strong>
      </div>
      <div class="al-status-row">
       <span>Hash mismatches</span>
       <strong>0</strong>
      </div>
     </div>
     [+2 more sibling <div> elements with the SAME structure as the one above; their text content in order: Latest Blocks ¦ #1,482,904 ¦ 09:41:12 UTC ¦ 0x7f3a9c21d48b05e6…c9a1f0e2 ¦ #1,482,903 ¦ 09:38:04 UTC ¦ 0x4b8e12a7c3f96d0b…28e7f4c1 ¦ #1,482,902 ¦ 09:36:48 UTC ¦ 0x92d5c4f18ea63b70…d81e5a03 ¦ #1,482,901 ¦ 09:34:21 UTC ¦ 0xc1f0a84e796d230b…4a8f9b17 ¦ #1,482,900 ¦ 09:32:09 UTC ¦ 0x5e2b7d91af36c804…7f1e2d9a || Run Integrity Check ¦ Export WORM Snapshot ¦ Snapshot exports are signed and timestamped for regulatory submission.]
    </div>
   </section>
   [+2 more sibling <section> elements with the SAME structure as the one above; their text content in order: Event Distribution (24h) ¦ 1,482 total events recorded across the platform. ¦ 24h ¦ Authentication ¦ 316 ¦ 316 ¦ Scan Events ¦ 642 ¦ 642 ¦ Report Releases ¦ 23 ¦ 23 ¦ Administrative ¦ 87 ¦ 87 ¦ Security Events ¦ 14 ¦ 14 ¦ System ¦ 400 ¦ 400 || Active Alerts ¦ Anomalies flagged by the audit stream monitor. ¦ 2 Open ¦ TOR exit node blocked ¦ — 185.220.101.42 attempted admin login. Geo-block policy enforced. No session created. ¦ Repeated MFA failures ¦ — k.kimani@vunvault.com has 3 invalid TOTP attempts in the last 2 hours. Account lockout imminent.]
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
.al-layout { display: grid; grid-template-columns: minmax(0, 2.3fr) minmax(0, 1fr); gap: 20px; align-items: start; margin-bottom: 20px; }
@media (max-width: 1180px) {
.al-layout { grid-template-columns: 1fr; }
}
.al-col { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.al-toolbar { margin-bottom: 18px; padding: 20px 22px; border-radius: 18px; background: #ffffff; border: 1px solid var(--line); box-shadow: 0 16px 40px -36px rgba(10, 13, 18, 0.6); }
.al-toolbar-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.al-toolbar-title { display: flex; align-items: center; gap: 9px; font-size: 0.86rem; font-weight: 800; color: var(--ink); }
.al-toolbar-title svg { color: var(--brand); }
.al-results { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; font-weight: 700; color: var(--ink-muted); }
.al-results strong { color: var(--brand-strong); }
.al-toolbar-grid { display: grid; grid-template-columns: minmax(220px, 2.2fr) repeat(4, minmax(130px, 1fr)) auto; gap: 12px; align-items: end; }
@media (max-width: 1320px) {
.al-toolbar-grid { grid-template-columns: minmax(220px, 2fr) repeat(2, minmax(130px, 1fr)); }
}
@media (max-width: 720px) {
.al-toolbar-grid { grid-template-columns: 1fr; }
}
.al-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.al-field-label { font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); }
.al-input-wrap { position: relative; display: flex; align-items: center; }
.al-input-icon { position: absolute; left: 13px; color: var(--ink-faint); pointer-events: none; display: inline-flex; }
.al-input,
      .al-select { width: 100%; padding: 11px 14px; font-size: 0.8rem; color: var(--ink); background: #ffffff; border: 1px solid var(--line); border-radius: 12px; outline: none; transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
.al-input { padding-left: 38px; }
.al-input::placeholder { color: var(--ink-faint); }
.al-input:focus,
      .al-select:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-tint); }
.al-toolbar-actions { display: flex; gap: 8px; }
.al-clear-btn { display: inline-flex; align-items: center; gap: 7px; padding: 11px 18px; font-size: 0.76rem; font-weight: 800; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); border-radius: 12px; cursor: pointer; white-space: nowrap; transition: all var(--dur) var(--ease); }
.al-clear-btn:hover { background: var(--brand); border-color: var(--brand); color: #ffffff; }
.al-console { position: relative; border-radius: 18px; overflow: hidden; background: radial-gradient(120% 100% at 0% 0%, rgba(59, 153, 252, 0.10), transparent 60%), linear-gradient(165deg, #05080d 0%, #070b11 55%, #04070b 100%); border: 1px solid rgba(59, 153, 252, 0.28); box-shadow: 0 34px 80px -40px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.03) inset; }
.al-console-chrome { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 16px; background: linear-gradient(180deg, #151b25, #10151d); border-bottom: 1px solid rgba(59, 153, 252, 0.18); }
.al-chrome-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.al-dots { display: flex; align-items: center; gap: 7px; flex: 0 0 auto; }
.al-dot { width: 11px; height: 11px; border-radius: 50%; border: 1px solid rgba(0, 0, 0, 0.3); }
.al-dot--close { background: #ff5f57; }
.al-dot--min { background: #febc2e; }
.al-dot--max { background: #28c840; }
.al-chrome-title { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; color: #8d9aab; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.al-chrome-right { display: flex; align-items: center; gap: 10px; flex: 0 0 auto; }
.al-chrome-pill { display: inline-flex; align-items: center; gap: 7px; padding: 5px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; border-radius: var(--r-full); white-space: nowrap; border: 1px solid transparent; }
.al-chrome-pill--live { color: #7dd3fc; background: rgba(59, 153, 252, 0.12); border-color: rgba(59, 153, 252, 0.42); }
.al-chrome-pill--live .al-live-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; animation: pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
.al-chrome-pill--chain { color: #34d399; background: rgba(16, 185, 129, 0.12); border-color: rgba(16, 185, 129, 0.42); }
.al-chrome-pill--chain.is-warn { color: #fbbf24; background: rgba(245, 158, 11, 0.12); border-color: rgba(245, 158, 11, 0.42); }
.al-console-meta { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; background: rgba(255, 255, 255, 0.05); border-bottom: 1px solid rgba(59, 153, 252, 0.14); }
@media (max-width: 860px) {
.al-console-meta { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 480px) {
.al-console-meta { grid-template-columns: 1fr; }
}
.al-meta-cell { display: flex; flex-direction: column; gap: 5px; padding: 12px 16px; background: rgba(5, 8, 13, 0.6); }
.al-meta-label { font-size: 9px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #55637a; }
.al-meta-value { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.72rem; font-weight: 700; color: #cbd5e1; word-break: break-all; }
.al-console-body { max-height: 680px; overflow-y: auto; padding: 14px 0 8px; scrollbar-width: thin; scrollbar-color: rgba(59, 153, 252, 0.35) transparent; scroll-behavior: smooth; }
.al-console-body::-webkit-scrollbar { width: 9px; height: 9px; }
.al-console-body::-webkit-scrollbar-track { background: transparent; }
.al-console-body::-webkit-scrollbar-thumb { background: rgba(59, 153, 252, 0.28); border-radius: 9999px; border: 2px solid transparent; background-clip: padding-box; }
.al-console-body::-webkit-scrollbar-thumb:hover { background: rgba(59, 153, 252, 0.6); background-clip: padding-box; }
.al-row { display: grid; grid-template-columns: 172px 92px 1fr 128px 90px; align-items: start; gap: 12px; padding: 11px 18px
/* …truncated by planner; remaining rules follow the same patterns… */
```

##### Event detail dialog
```html
<div id="al-event-modal" class="al-modal" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="al-event-title">
 <div class="al-modal-backdrop"></div>
 <div class="al-modal-window" role="document">
  <div class="al-modal-head">
   <div>
    <span class="al-modal-eyebrow">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Audit Event Detail
    </span>
    <h2 class="al-modal-title" id="al-event-title">—</h2>
    <p class="al-modal-sub">
     Event ID:
     <span id="al-modal-event-id">—</span>
    </p>
   </div>
   <button type="button" class="al-modal-close" aria-label="Close event detail">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </button>
  </div>
  <div class="al-modal-body">
   <div>
    <div class="al-modal-section-title">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Event Summary
    </div>
    <div class="al-modal-summary">
     <div class="al-modal-summary-item">
      <span class="al-modal-summary-label">Timestamp (UTC)</span>
      <span class="al-modal-summary-value" id="al-modal-ts">—</span>
     </div>
     [+4 more sibling <div> elements with the SAME structure as the one above; their text content in order: Event Type ¦ — || Actor ¦ — || Severity ¦ — || Event Code ¦ —]
    </div>
   </div>
   [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Full Message ¦ — || Raw Encrypted Payload || Hash Chain Verification ¦ Chain verified — entry is authentic and unmodified ¦ Entry hash: ¦ — ¦ Previous hash: ¦ — ¦ Signature: ¦ AES-256-GCM · HMAC-SHA256]
  </div>
  <div class="al-modal-foot">
   <span class="al-modal-foot-note">Audit entries are append-only. This record cannot be edited or deleted within the 7-year retention window.</span>
   <div class="al-modal-foot-actions">
    <button type="button" class="adm-btn adm-btn-ghost" id="al-modal-copy">Copy Payload</button>
    <button type="button" class="adm-btn adm-btn-primary">Close</button>
   </div>
  </div>
 </div>
</div>
```
Custom CSS for this markup (reference):
```css
.al-actions-stack .adm-btn { width: 100%; }
.al-modal { position: fixed; inset: 0; z-index: 300; display: flex; align-items: center; justify-content: center; padding: 24px; opacity: 0; transition: opacity 0.22s var(--ease); }
.al-modal[hidden] { display: none !important; }
.al-modal.is-open { opacity: 1; }
.al-modal-backdrop { position: absolute; inset: 0; background: rgba(5, 7, 10, 0.78); backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px); }
.al-modal-window { position: relative; z-index: 1; display: flex; flex-direction: column; width: min(760px, 100%); max-height: 90vh; border-radius: 18px; overflow: hidden; background: #ffffff; border: 1px solid var(--line); box-shadow: 0 40px 90px -40px rgba(0, 0, 0, 0.9); transform: translateY(18px) scale(0.985); transition: transform 0.28s var(--ease); }
.al-modal.is-open .al-modal-window { transform: translateY(0) scale(1); }
.al-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 20px 22px 16px; background: radial-gradient(90% 140% at 100% 0%, rgba(59, 153, 252, 0.22), transparent 62%), linear-gradient(160deg, var(--dark), #070b11); color: #ffffff; }
.al-modal-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: var(--brand); }
.al-modal-title { margin-top: 8px; font-size: 1.1rem; font-weight: 800; letter-spacing: -0.02em; color: #ffffff; line-height: 1.4; }
.al-modal-sub { margin-top: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; color: #93a2b5; word-break: break-all; }
.al-modal-close { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; color: #93a2b5; background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.14); transition: all 0.2s var(--ease); flex: 0 0 auto; }
.al-modal-close:hover { color: #ffffff; background: rgba(244, 63, 94, 0.3); border-color: rgba(244, 63, 94, 0.5); }
.al-modal-body { flex: 1 1 auto; overflow-y: auto; padding: 22px; display: flex; flex-direction: column; gap: 20px; scrollbar-width: thin; scrollbar-color: rgba(59, 153, 252, 0.35) transparent; }
.al-modal-body::-webkit-scrollbar { width: 8px; }
.al-modal-body::-webkit-scrollbar-thumb { background: rgba(59, 153, 252, 0.3); border-radius: 9999px; border: 2px solid transparent; background-clip: padding-box; }
.al-modal-section-title { display: flex; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 12px; }
.al-modal-summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
@media (max-width: 560px) {
.al-modal-summary { grid-template-col
```

Verbatim strings found in the prototype's script (toast titles/messages, status and validation text — use exactly these where the matching event occurs; the surrounding logic is replaced by API calls):
- `use strict`
- `><circle cx=`
- `Filters cleared`
- `Showing the full cryptographic audit trail.`
- `Scan Completion`
- `Report Release`
- `Security Event`
- `Payload copied`
- `Raw encrypted payload copied to clipboard.`
- `Clipboard blocked`
- `Copy the payload manually from the panel.`
- `Payload ready`
- `Select and copy the payload text manually.`
- `Open detail for audit event`
- `Hash chain verified`
- `1,482,904 entries checked · 0 mismatches · chain integrity 100%.`
- `Compliance export ready`
- `Signed CSV + JSON bundle generated for the last 24 hours at`
- `Stream refreshed`
- `Audit tail resynced at`
- `Integrity check complete`
- `Chain state: intact · last verified at`
- `WORM snapshot signed`
- `Immutable snapshot written to cold storage at`
- `Profile picture`
**Data:** `GET /admin/audit/summary` tiles (`Events (24 h)`, `Auth Attempts`, `Failed Auth`, `Locked Out`, `Scan Completions`, `Report Releases`, `Chain Integrity` %, `Hash Mismatches`, `Retention` `7 years`); `GET /admin/audit/chain` for the chain panel (`state`, `totalEntries`, `genesisDate`, `lastVerifiedAt`, `headHash`, `node`, `encryption`); `GET /admin/audit` (`q`, `category`, `severity`, `actor`, `range`, `page`, `pageSize`) → table: `Timestamp (UTC)` (`YYYY-MM-DD HH:MM:SS`), `Category` (`AUDIT_CATEGORY_LABELS`), `Event`, `Severity` (chip colours ok=green, info=blue, warning=amber, critical=red; `SEV-n` suffix when `sevLevel`), `Actor`, `Details` (message), `Hash` (first 8 chars) and a row button `Open detail for audit event <seq>` (accessible name verbatim). Range select labels from `AUDIT_RANGE_LABELS`; `Clear filters` toasts `Filters cleared` / `Showing the full cryptographic audit trail.`. **Rows are read-only; there is no edit or delete control anywhere on this page.**
**Actions:** `Verify chain` → `POST /admin/audit/verify` (button shows a spinner; `409 verify_in_progress` → toast `Verification already running`); success toasts: `Hash chain verified` / `<entries> entries checked · <mismatches> mismatches · chain integrity <n>%.`, and when `mismatches > 0` a persistent critical banner above the table `Hash chain mismatch detected at entry #<firstMismatchSeq>. Escalate to the incident commander.`; `Integrity check` re-reads `GET …/chain` and toasts `Integrity check complete` / `Chain state: <intact|broken> · last verified at <HH:MM:SS UTC>.`; `Export` (`Compliance export`) → `GET /admin/audit/export` with the current filters, saved as `vunvault-audit-<UTC date>.csv`, toast `Compliance export ready` / `Signed CSV bundle generated for <range label> at <HH:MM:SS UTC>.` (JSON bundle and signing are not provided by the API — wording adjusted from the prototype); `WORM snapshot` is not an API action — render it disabled with tooltip `Snapshots are written automatically by the platform.` (`// TODO(backend-contract)`). `Refresh stream` refetches (toast `Stream refreshed` / `Audit tail resynced at <HH:MM:SS UTC>.`).
**Event dialog:** `Dialog`; header with category/severity chips, `seq`, event type; body: timestamp, actor, subject, ip, full message, `Hash` and `Previous hash` (monospace, each with a `Copy` button → toast `Payload copied` / `Hash copied to clipboard.`; on clipboard failure toast `Clipboard blocked` / `Select and copy the value manually.`), and the chain-link line `Linked to entry #<seq-1>`. Do NOT show or request encrypted payloads, signatures or key ids (the API never returns them).
Live row insertion over SSE and the `LIVE` indicator come in Layer L12; this task polls the first page every 10 s while visible and highlights newly seen rows for 2 s (no highlight under reduced motion).

**Tests:** summary tiles; filters in the URL; row detail dialog opens from the labelled button; verify success and mismatch banner; export triggers a download with the filter query; no element offers edit/delete; clipboard fallback toast.

---

**Data shape (TypeScript):**
```ts
// AuditEntryView, AuditSummary, ChainStatus, VerifyChainResult: see contracts (Task 20).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/admin/audit?… → 200 { data: AuditEntryView[]; total } · GET …/summary · GET …/chain
// POST /api/v1/admin/audit/verify body { incremental?: boolean } → 200 { data: VerifyChainResult } | 409 verify_in_progress
// GET /api/v1/admin/audit/export?… → 200 text/csv | 422 range_too_large
```

---

**Out of scope:**
- Do not add any edit/delete/redact control.
- Do not implement SSE (Layer L12).
- Do not request or show sealed payloads.

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
☐ Report at the end: `Task 83b complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---


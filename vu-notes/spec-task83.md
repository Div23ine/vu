### TASK 83 — Admin Content Moderation: queue, filters and editorial review dialog

**Layer:** L9

**Prerequisites:** Task 36, Task 46, Task 75, Task 12, Task 11

**Estimated files touched:** 14

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Admin Content Moderation: queue, filters and editorial review dialog**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build `/admin/content`: summary tiles, filterable review queue with risk flags and the editorial review dialog with five checks and decisions (approve, request changes, reject, publish, schedule, remind author).

**Deliverables:**
- `apps/web/src/app/(authed)/admin/content/page.tsx`
- `apps/web/src/app/(authed)/admin/content/_components/content-summary.tsx`, `content-toolbar.tsx`, `content-table.tsx`, `review-dialog.tsx`, `editorial-checks.tsx`, `risk-flags.tsx`, `row-actions.tsx`
- `apps/web/src/app/(authed)/admin/content/_hooks/use-moderation.ts`
- `apps/web/src/app/(authed)/admin/content/_styles/content.css`
- `apps/web/src/mocks/handlers/admin-content.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- `apps/web/src/app/(authed)/admin/content/content.test.tsx`

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

##### Content Moderation page body
```html
<div class="adm-shell">
 <div class="adm-page-head">
  <div>
   <span class="adm-eyebrow">Pre-Publication Review Queue</span>
   <h1 class="adm-page-title">Content Moderation</h1>
   <p class="adm-page-sub">Every blog post, news announcement, threat advisory and product listing authored by staff must clear editorial review before it renders live on the public website.</p>
  </div>
  <div class="adm-head-actions">
   <button type="button" class="adm-btn adm-btn-primary" id="cm-review-next">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Review Next Item</span>
   </button>
   <button type="button" class="adm-btn adm-btn-dark" id="cm-export-queue">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Export Review Log</span>
   </button>
   <button type="button" class="adm-btn adm-btn-ghost" id="cm-refresh-queue">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Refresh Queue</span>
   </button>
  </div>
 </div>
 <section aria-labelledby="cm-kpi-heading">
  <h2 id="cm-kpi-heading" class="sr-only">Content moderation indicators</h2>
  <div class="adm-kpi-grid">
   <article class="adm-kpi">
    <span class="adm-kpi-label">Awaiting Review</span>
    <span class="adm-kpi-value">14</span>
    <span class="adm-kpi-delta adm-kpi-delta--warn">● Blocking publication</span>
   </article>
   [+5 more sibling <article> elements with the SAME structure as the one above; their text content in order: Changes Requested ¦ 5 ¦ ● Returned to authors || Approved Today ¦ 9 ¦ ▲ Queued for publication || Rejected (7 days) ¦ 3 ¦ 2 legal · 1 unsupported claim || Avg. Review Time ¦ 2.4 ¦ h ¦ ▼ 18% faster this week || Published (30 days) ¦ 62 ¦ ▲ 12% vs. previous period]
  </div>
 </section>
 <div class="cm-layout">
  <div class="cm-col">
   <section class="cm-toolbar" aria-labelledby="cm-filter-heading">
    <div class="cm-toolbar-head">
     <h2 class="cm-toolbar-title" id="cm-filter-heading">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      Filter & Search Queue
     </h2>
     <span class="cm-results" role="status" aria-live="polite">
      Showing
      <strong id="cm-visible-count">10</strong>
      of
      <strong id="cm-total-count">10</strong>
      items
     </span>
    </div>
    <div class="cm-toolbar-grid">
     <div class="cm-field">
      <label class="cm-field-label" for="cm-search">Search</label>
      <div class="cm-input-wrap">
       <span class="cm-input-icon" aria-hidden="true">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
       </span>
       <input id="cm-search" class="cm-input" type="search" placeholder="Title, slug, author or tag…" autocomplete="off"/>
      </div>
     </div>
     [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Content Type ¦ All types ¦ Blog Post ¦ News Announcement ¦ Threat Advisory ¦ Product Listing || Review Status ¦ All statuses ¦ Pending Review ¦ In Review ¦ Changes Requested ¦ Approved ¦ Rejected || Risk Flag ¦ Any flag ¦ Legal review required ¦ Contains PII ¦ Unverified claim ¦ Brand-sensitive ¦ No flags]
     <div class="cm-toolbar-actions">
      <button type="button" class="cm-clear-btn" id="cm-clear-filters">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       <span>Reset</span>
      </button>
     </div>
    </div>
   </section>
   <section class="adm-card" aria-labelledby="cm-queue-heading">
    <div class="adm-card-head">
     <div>
      <h2 class="adm-card-title" id="cm-queue-heading">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Pending Publication Queue
      </h2>
      <p class="adm-card-note">Content authored by staff members awaiting editorial sign-off before it renders on the public website. Nothing here is visible to clients or the public yet.</p>
     </div>
     <span class="adm-tag adm-tag--warn">14 Awaiting Review</span>
    </div>
    <div class="adm-table-wrap">
     <table class="adm-table cm-table">
      <caption class="sr-only">Content awaiting pre-publication review with type, author, risk flags and moderation actions</caption>
      <thead>
       <tr>
        <th>Content</th>
        <th>Type</th>
        <th>Author</th>
        <th>Submitted</th>
        <th>Risk Flags</th>
        <th>Status</th>
        <th>Actions</th>
       </tr>
      </thead>
      <tbody id="cm-tbody">
       <tr class="cm-row">
        <td>
         <div class="cm-content-cell">
          <span class="cm-thumb cm-thumb--blog" aria-hidden="true">
           <svg data-icon="REPLACE-WITH-LUCIDE"/>
          </span>
          <span class="cm-content-body">
           <span class="cm-title">Kenya State House Cyber Security Audit & Risk Analysis</span>
           <span class="cm-excerpt">An investigative analysis of government digital perimeter vulnerabilities and defence protocols, based on open-source intelligence.</span>
           <span class="cm-slug">/blog/kenya-state-house-cyber-audit</span>
          </span>
         </div>
        </td>
        [+2 more sibling <td> elements with the SAME structure as the one above; their text content in order: Blog Post || AN ¦ Amara Njoroge ¦ Offensive Security]
        <td class="adm-mono">24 Sep · 08:12</td>
        <td>
         <div class="cm-risk-stack">
          <span class="cm-risk cm-risk--legal">Legal review</span>
          <span class="cm-risk cm-risk--pii">Sensitive naming</span>
         </div>
        </td>
        [+2 more sibling <td> elements with the SAME structure as the one above; their text content in order: Pending Review || Review ¦ Approve]
       </tr>
       [+9 more sibling <tr> elements with the SAME structure as the one above; their text content in order: Apache Struts 2 OGNL Injection — Emergency Client Advisory ¦ Urgent remediation guidance for CVE-2026-21447. Requires immediate publication across all affected client dashboards. ¦ /advisories/cve-2026-21447 ¦ Threat Advisory ¦ FH ¦ Fatima Hassan ¦ Threat Intelligence ¦ 24 Sep · 09:02 ¦ No flags ¦ Pending Review ¦ Review ¦ Approve || VUNVAULT Sentinel — Continuous Attack Surface Monitoring ¦ Product listing describing continuous perimeter monitoring with automated alerting and quarterly re-assessment. ¦ /products/sentinel ¦ Product Listing ¦ BO ¦ Brian Otieno ¦ Curriculum & Product ¦ 23 Sep · 16:48 ¦ Unverified claim ¦ Pending Review ¦ Review ¦ Request Changes || VUNVAULT Partners With East African Fintech Alliance ¦ Joint press announcement covering a new regional security partnership and shared threat intelligence programme. ¦ /news/east-african-fintech-alliance ¦ News Announcement ¦ GW ¦ Grace Wanjiru ¦ Compliance & Comms ¦ 23 Sep · 11:30 ¦ Brand-sensitive ¦ In Review ¦ Continue Review ¦ Approve || Africa's Cyber Awakening: How the Continent Is Fighting Back ¦ An in-depth analysis of evolving threat landscapes across Kenya, Ghana and Nigeria, citing recent incident case studies. ¦ /blog/africa-cyber-awakening ¦ Blog Post ¦ AN ¦ Amara Njoroge ¦ Offensive Security ¦ 22 Sep · 14:20 ¦ Contains PII ¦ Changes Requested ¦ Re-review ¦ Remind Author || VUNVAULT Opens Regional Security Operations Hub in Accra ¦ Announcement of the new Ghana-based SOC facility supporting West African clients with 24/7 monitoring. ¦ /news/accra-soc-hub ¦ News Announcement ¦ GW ¦ Grace Wanjiru ¦ Compliance & Comms ¦ 21 Sep · 10:15 ¦ No flags ¦ Approved ¦ Publish Now ¦ Schedule || VUNVAULT Academy — Security Foundations Certification ¦ Product page for the free cybersecurity foundations track with certificate of completion. ¦ /products/academy-foundations ¦ Product Listing ¦ BO ¦ Brian Otieno ¦ Curriculum & Product ¦ 23 Sep · 09:41 ¦ No flags ¦ Pending Review ¦ Review ¦ Approve || Unverified Ransomware Attribution — Vendor X Campaign ¦ Advisory attributing an active campaign to a named threat actor based on unattributed telemetry. ¦ /advisories/vendor-x-ransomware ¦ Threat Advisory ¦ DM ¦ Daniel Mwangi ¦ Security Automation ¦ 22 Sep · 08:55 ¦ Unverified claim ¦ Attribution risk ¦ Rejected ¦ Reopen ¦ Archive || Why Most SACCOs Fail Their Central Bank Security Audit ¦ Practical breakdown of the six most common regulatory findings and how to close them before examination. ¦ /blog/sacco-central-bank-audit ¦ Blog Post ¦ GW ¦ Grace Wanjiru ¦ Compliance & Comms ¦ 24 Sep · 07:28 ¦ Brand-sensitive ¦ Pending Review ¦ Review ¦ Approve || Cisco IOS XE Authentication Bypass — Client Mitigation Brief ¦ Compensating controls and patching guidance for CVE-2026-0091 affecting IOS XE Web UI deployments. ¦ /advisories/cve-2026-0091 ¦ Threat Advisory ¦ FH ¦ Fatima Hassan ¦ Threat Intelligence ¦ 24 Sep · 06:48 ¦ No flags ¦ Pending Review ¦ Review ¦ Approve]
      </tbody>
      <tfoot>
       <tr>
        <td>Content approved here is queued for publication, not immediately visible. Use the content editor to schedule a live time.</td>
       </tr>
      </tfoot>
     </table>
    </div>
    <div class="cm-empty" id="cm-empty">
     <span class="cm-empty-icon" aria-hidden="true">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
     </span>
     <span class="cm-empty-title">No content matches the current filters</span>
     <span class="cm-empty-text">Adjust your search terms or reset the filters to see the full pre-publication review queue.</span>
     <button type="button" class="adm-btn adm-btn-ghost" id="cm-empty-reset">Reset Filters</button>
    </div>
   </section>
  </div>
  <aside class="cm-col" aria-label="Moderation controls">
   <section class="adm-card adm-card--dark">
    <div class="adm-card-head">
     <div>
      <h2 class="adm-card-title">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Review Workflow
      </h2>
      <p class="adm-card-note">Every item must clear editorial review before it can be published to the public website.</p>
     </div>
    </div>
    <div class="adm-card-body cm-panel">
     <div class="cm-panel-section">
      <span class="cm-panel-title">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Queue Snapshot
      </span>
      <div class="cm-status-row">
       <span>Pending review</span>
       <strong>14</strong>
      </div>
      <div class="cm-status-row">
       <span>In review</span>
       <strong>3</strong>
      </div>
      <div class="cm-status-row">
       <span>Changes requested</span>
       <strong>5</strong>
      </div>
      <div class="cm-status-row">
       <span>Approved (not yet live)</span>
       <strong>9</strong>
      </div>
      <div class="cm-status-row">
       <span>Oldest waiting item</span>
       <strong>36 h</strong>
      </div>
     </div>
     <div class="cm-panel-section">
      <span class="cm-panel-title">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Bulk Actions
      </span>
      <div class="cm-actions-stack">
       <button type="button" class="adm-btn adm-btn-ghost" id="cm-bulk-approve">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
        <span>Approve All Flag-Free</span>
       </button>
       <button type="button" class="adm-btn adm-btn-dark" id="cm-bulk-escalate">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
        <span>Escalate Flagged Items</span>
       </button>
       <button type="button" class="adm-btn adm-btn-ghost" id="cm-bulk-remind">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
        <span>Remind All Authors</span>
       </button>
      </div>
      <p class="cm-action-note">Bulk approvals still require individual confirmation per item.</p>
     </div>
    </div>
   </section>
   <section class="adm-card adm-card--dark" aria-labelledby="cm-dist-heading">
    <div class="adm-card-head">
     <div>
      <h2 class="adm-card-title" id="cm-dist-heading">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Queue by Content Type
      </h2>
      <p class="adm-card-note">Breakdown of the 14 items currently awaiting review.</p>
     </div>
     <span class="adm-tag">14 Items</span>
    </div>
    <div class="adm-card-body">
     <div class="cm-dist">
      <div class="cm-dist-row">
       <span class="cm-dist-name">Blog Post</span>
       <progress class="cm-progress" value="6">6</progress>
       <span class="cm-dist-count">6</span>
      </div>
      [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Threat Advisory ¦ 4 ¦ 4 || News Announcement ¦ 2 ¦ 2 || Product Listing ¦ 2 ¦ 2]
     </div>
    </div>
   </section>
   <section class="adm-card" aria-labelledby="cm-guidelines-heading">
    <div class="adm-card-head">
     <div>
      <h2 class="adm-card-title" id="cm-guidelines-heading">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Pre-Publication Guidelines
      </h2>
      <p class="adm-card-note">The five checks every reviewer must complete before approving content.</p>
     </div>
    </div>
    <div class="adm-card-body">
     <div class="cm-guidelines">
      <div class="cm-guideline">
       <span class="cm-guideline-num">01</span>
       <span class="cm-guideline-body">
        <span class="cm-guideline-title">No unverified claims</span>
        <span class="cm-guideline-text">Every technical assertion must trace to a cited source or internal test evidence.</span>
       </span>
      </div>
      [+4 more sibling <div> elements with the SAME structure as the one above; their text content in order: 02 ¦ No client or personal data ¦ Screenshots, logs and case studies must be fully anonymised before publication. || 03 ¦ Legal review completed where flagged ¦ Named entities, government bodies and vendor attribution require legal sign-off. || 04 ¦ Brand voice consistent ¦ Tone, terminology and product naming must match the VUNVAULT editorial standard. || 05 ¦ Publication path selected ¦ Decide whether the item publishes immediately, on schedule, or requires a client-only release.]
     </div>
    </div>
   </section>
   <section class="adm-card adm-card--dark" aria-labelledby="cm-activity-heading">
    <div class="adm-card-head">
     <div>
      <h2 class="adm-card-title" id="cm-activity-heading">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Recent Moderation Activity
      </h2>
      <p class="adm-card-note">Last six editorial decisions across the queue.</p>
     </div>
     <span class="adm-tag">Live</span>
    </div>
    <div class="adm-card-body">
     <div class="cm-activity">
      <div class="cm-activity-item">
       <span class="cm-activity-dot cm-activity-dot--ok"></span>
       <span class="cm-activity-body">
        <span class="cm-activity-text">
         <strong>e.reed</strong>
         approved
         <em>VUNVAULT Opens Regional SOC Hub in Accra</em>
         .
        </span>
        <span class="cm-activity-time">Today · 09:41 UTC</span>
       </span>
      </div>
      [+5 more sibling <div> elements with the SAME structure as the one above; their text content in order: e.reed ¦ requested changes on ¦ Africa's Cyber Awakening ¦ — PII in case study. ¦ Today · 09:22 UTC || e.reed ¦ rejected ¦ Unverified Ransomware Attribution ¦ — attribution risk. ¦ Yesterday · 17:04 UTC || a.njoroge ¦ submitted ¦ Kenya State House Cyber Security Audit ¦ for review. ¦ Today · 08:12 UTC || f.hassan ¦ published advisory ¦ CVE-2026-3327 ¦ to client dashboards. ¦ Yesterday · 14:32 UTC || g.wanjiru ¦ submitted ¦ East African Fintech Alliance ¦ — legal flag raised. ¦ Yesterday · 11:30 UTC]
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
.cm-layout { display: grid; grid-template-columns: minmax(0, 2.2fr) minmax(0, 1fr); gap: 20px; align-items: start; margin-bottom: 20px; }
@media (max-width: 1180px) {
.cm-layout { grid-template-columns: 1fr; }
}
.cm-col { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.cm-toolbar { margin-bottom: 18px; padding: 20px 22px; border-radius: 18px; background: #ffffff; border: 1px solid var(--line); box-shadow: 0 16px 40px -36px rgba(10, 13, 18, 0.6); }
.cm-toolbar-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.cm-toolbar-title { display: flex; align-items: center; gap: 9px; font-size: 0.86rem; font-weight: 800; color: var(--ink); }
.cm-toolbar-title svg { color: var(--brand); }
.cm-results { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; font-weight: 700; color: var(--ink-muted); }
.cm-results strong { color: var(--brand-strong); }
.cm-toolbar-grid { display: grid; grid-template-columns: minmax(220px, 2.2fr) repeat(3, minmax(140px, 1fr)) auto; gap: 12px; align-items: end; }
@media (max-width: 1180px) {
.cm-toolbar-grid { grid-template-columns: minmax(220px, 2fr) repeat(2, minmax(140px, 1fr)); }
}
@media (max-width: 720px) {
.cm-toolbar-grid { grid-template-columns: 1fr; }
}
.cm-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.cm-field-label { font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); }
.cm-input-wrap { position: relative; display: flex; align-items: center; }
.cm-input-icon { position: absolute; left: 13px; color: var(--ink-faint); pointer-events: none; display: inline-flex; }
.cm-input,
      .cm-select { width: 100%; padding: 11px 14px; font-size: 0.8rem; color: var(--ink); background: #ffffff; border: 1px solid var(--line); border-radius: 12px; outline: none; transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
.cm-input { padding-left: 38px; }
.cm-input::placeholder { color: var(--ink-faint); }
.cm-input:focus,
      .cm-select:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-tint); }
.cm-toolbar-actions { display: flex; gap: 8px; }
.cm-clear-btn { display: inline-flex; align-items: center; gap: 7px; padding: 11px 18px; font-size: 0.76rem; font-weight: 800; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); border-radius: 12px; cursor: pointer; white-space: nowrap; transition: all var(--dur) var(--ease); }
.cm-clear-btn:hover { background: var(--brand); border-color: var(--brand); color: #ffffff; }
.cm-table { min-width: 1180px; }
.cm-content-cell { display: flex; align-items: flex-start; gap: 12px; min-width: 0; max-width: 34ch; }
.cm-thumb { width: 48px; height: 48px; border-radius: 10px; flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; color: #ffffff; background: linear-gradient(145deg, var(--dark), #060a10); border: 1px solid rgba(59, 153, 252, 0.3); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04); overflow: hidden; }
.cm-thumb svg { width: 22px; height: 22px; }
.cm-thumb--blog { color: var(--brand-soft); }
.cm-content-body { min-width: 0; }
.cm-title { display: block; font-size: 0.82rem; font-weight: 800; color: var(--ink); line-height: 1.4; }
.cm-excerpt { display: block; margin-top: 4px; font-size: 10.5px; line-height: 1.6; color: var(--ink-muted); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.cm-slug { display: block; margin-top: 5px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 9.5px; color: var(--ink-faint); }
.cm-risk-stack { display: flex; flex-direction: column; gap: 5px; align-items: flex-start; }
.cm-risk { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; font-size: 9px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; border-radius: var(--r-full); white-space: nowrap; border: 1px solid transparent; }
.cm-risk--legal { color: #9f1239; background: #fff1f2; border-color: #fecdd3; }
.cm-risk--pii { color: #92400e; background: #fffbeb; border-color: #fde68a; }
.cm-empty { display: none; flex-direction: column; align-items: center; gap: 10px; padding: 54px 22px; text-align: center; }
.cm-empty.is-visible { display: flex; }
.cm-empty-icon { width: 54px; height: 54px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: var(--brand); background: var(--brand-tint); border: 1px solid var(--brand-line); }
.cm-empty-title { font-size: 1rem; font-weight: 800; color: var(--ink); }
.cm-empty-text { font-size: 0.8rem; color: var(--ink-muted); max-width: 44ch; line-height: 1.65; }
.cm-panel { display: flex; flex-direction: column; gap: 16px; }
.cm-panel-section { display: flex; flex-direction: column; gap: 12px; }
.cm-panel-section + .cm-panel-section { padding-top: 16px; border-top: 1px solid var(--line-soft); }
.adm-card--dark .cm-panel-section + .cm-panel-section { border-top-color: rgba(255, 255, 255, 0.08); }
.cm-panel-title { display: flex; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-faint); }
.adm-card--dark .cm-panel-title { color: #7d8b9e; }
.cm-panel-title svg { color: var(--brand); flex: 0 0 auto; }
.cm-status-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 0.74rem; font-weight: 600; color: var(--ink-soft); }
.adm-card--dark .cm-status-row { color: #93a2b5; }
.cm-status-row strong { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.74rem; font-weight: 800; color: var(--ink); }
.adm-card--dark .cm-status-row strong { color: #ffffff; }
.cm-actions-stack { display: flex; flex-direction: column; gap: 10px; }
.cm-actions-stack .adm-btn { width: 100%; }
.cm-action-note { font-size: 10px; line-height: 1.6; color: var(--ink-faint); text-align: center; }
.adm-card--dark
/* …truncated by planner; remaining rules follow the same patterns… */
```

##### Editorial review dialog
```html
<div id="cm-review-modal" class="cm-modal" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="cm-review-title">
 <div class="cm-modal-backdrop"></div>
 <div class="cm-modal-window" role="document">
  <div class="cm-modal-head">
   <div>
    <span class="cm-modal-eyebrow">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Pre-Publication Review
    </span>
    <h2 class="cm-modal-title" id="cm-review-title">Editorial sign-off</h2>
    <p class="cm-modal-sub">
     <span id="cm-modal-slug">/</span>
    </p>
   </div>
   <button type="button" class="cm-modal-close" aria-label="Close review">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </button>
  </div>
  <div class="cm-modal-body">
   <div>
    <div class="cm-modal-section-title">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Content Preview
    </div>
    <div class="cm-preview-body">
     <h3 class="cm-preview-title" id="cm-modal-preview-title">—</h3>
     <div class="cm-preview-meta">
      <span id="cm-modal-preview-type">—</span>
      <span>·</span>
      <span id="cm-modal-preview-author">—</span>
      <span>·</span>
      <span id="cm-modal-preview-date">—</span>
     </div>
     <p class="cm-preview-excerpt" id="cm-modal-preview-excerpt">Full content preview is rendered here for the reviewer.</p>
     <div class="cm-preview-tags" id="cm-modal-preview-tags">
      <span class="cm-preview-tag">no tags</span>
     </div>
    </div>
   </div>
   [+2 more sibling <div> elements with the SAME structure as the one above; their text content in order: Mandatory Editorial Checklist ¦ Technical accuracy verified ¦ Every technical claim traces to a citation, internal test result or public advisory. ¦ No client or personal data present ¦ Screenshots, logs and case studies are fully anonymised. ¦ Legal review cleared (where flagged) ¦ Named entities, government references and vendor attribution are signed off. ¦ Brand voice and terminology consistent ¦ Tone, product naming and formatting match the VUNVAULT editorial standard. ¦ Publication path decided ¦ Immediate, scheduled or client-only release has been agreed with the author. || Editorial Decision ¦ Approve for Publication ¦ Clears the item for the public website and any scheduled client release. ¦ Request Changes ¦ Returns the item to the author with reviewer notes attached. ¦ Reject ¦ Marks the item invalid with feedback. It will not be published.]
   <div class="cm-note-field">
    <label class="cm-field-label" for="cm-review-note">
     <span>Reviewer Notes</span>
     <span class="cm-hint">Recorded in the audit log and sent to the author if changes are requested.</span>
    </label>
    <textarea id="cm-review-note" class="cm-textarea" placeholder="Summarise what was checked, any residual concerns and the rationale for this decision…"></textarea>
   </div>
   <div class="cm-reviewer">
    <span>
     <span class="cm-reviewer-label">Reviewer</span>
     <span class="cm-reviewer-value">e.reed@vunvault.com</span>
    </span>
    [+2 more sibling <span> elements with the SAME structure as the one above; their text content in order: Role ¦ Super Administrator || Decision Timestamp ¦ —]
   </div>
  </div>
  <div class="cm-modal-foot">
   <span class="cm-modal-foot-note" id="cm-modal-hint">Complete all five editorial checks and select a decision to enable the action.</span>
   <div class="cm-modal-foot-actions">
    <button type="button" class="adm-btn adm-btn-ghost">Cancel</button>
    <button type="button" class="adm-btn adm-btn-primary" id="cm-confirm-decision" disabled>
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     <span>Confirm Decision</span>
    </button>
   </div>
  </div>
 </div>
</div>
```
Custom CSS for this markup (reference):
```css
.cm-modal { position: fixed; inset: 0; z-index: 300; display: flex; align-items: center; justify-content: center; padding: 24px; opacity: 0; transition: opacity 0.22s var(--ease); }
.cm-modal[hidden] { display: none !important; }
.cm-modal.is-open { opacity: 1; }
.cm-modal-backdrop { position: absolute; inset: 0; background: rgba(5, 7, 10, 0.78); backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px); }
.cm-modal-window { position: relative; z-index: 1; display: flex; flex-direction: column; width: min(900px, 100%); max-height: 92vh; border-radius: 18px; overflow: hidden; background: #ffffff; border: 1px solid var(--line); box-shadow: 0 40px 90px -40px rgba(0, 0, 0, 0.9); transform: translateY(18px) scale(0.985); transition: transform 0.28s var(--ease); }
.cm-modal.is-open .cm-modal-window { transform: translateY(0) scale(1); }
.cm-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 20px 22px 16px; background: radial-gradient(90% 140% at 100% 0%, rgba(59, 153, 252, 0.22), transparent 62%), linear-gradient(160deg, var(--dark), #070b11); color: #ffffff; }
.cm-modal-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: var(--brand); }
.cm-modal-title { margin-top: 8px; font-size: 1.14rem; font-weight: 800; letter-spacing: -0.02em; color: #ffffff; line-height: 1.35; }
.cm-modal-sub { margin-top: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; color: #93a2b5; word-break: break-word; }
.cm-modal-close { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; color: #93a2b5; background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.14); transition: all 0.2s var(--ease); flex: 0 0 auto; }
.cm-modal-close:hover { color: #ffffff; background: rgba(244, 63, 94, 0.3); border-color: rgba(244, 63, 94, 0.5); }
.cm-modal-body { flex: 1 1 auto; overflow-y: auto; padding: 22px; display: flex; flex-direction: column; gap: 20px; scrollbar-width: thin; scrollbar-color: rgba(59, 153, 252, 0.35) transparent; }
.cm-modal-body::-webkit-scrollbar { width: 8px; }
.cm-modal-body::-webkit-scrollbar-thumb { background: rgba(59, 153, 252, 0.3); border-radius: 9999px; border: 2px solid transparent; background-clip: padding-box; }
.cm-modal-section-title { display: flex; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 12px; }
.cm-preview-body { padding: 18px 20px; border-radius: 14px; background: #f8fafc; border: 1px solid var(--line-soft); }
.cm-preview-title { font-size: 1.05rem; font-weight: 800; letter-spacing: -0.015em; line-height: 1.4; color: var(--ink); margin: 0 0 8px; }
.cm-preview-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 14px; font-size: 10.5px; font-weight: 600; color: var(--ink-muted); }
.cm-preview-meta span { display: inline-flex; align-items: center; gap: 5px; }
.cm-preview-excerpt { font-size: 0.82rem; line-height: 1.75; color: var(--ink-soft); margin: 0; }
.cm-preview-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
.cm-preview-tag { padding: 4px 10px; font-size: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 700; color: var(--ink-soft); background: #ffffff; border: 1px solid var(--line); border-radius: var(--r-full); }
.cm-note-field { display: flex; flex-direction: column; gap: 8px; }
.cm-textarea { w
```

Verbatim strings found in the prototype's script (toast titles/messages, status and validation text — use exactly these where the matching event occurs; the surrounding logic is replaced by API calls):
- `use strict`
- `><circle cx=`
- `Filters cleared`
- `Showing the full pre-publication review queue.`
- `Pending Review`
- `Changes Requested`
- `News Announcement`
- `Threat Advisory`
- `Product Listing`
- `Legal review`
- `Contains PII`
- `Unverified claim`
- `Complete all five editorial checks and select a decision to enable the action.`
- `editorial check(s) still outstanding before a decision can be confirmed.`
- `All editorial checks complete — select a decision to continue.`
- `All checks complete. Confirming will write this editorial decision to the audit log.`
- `Content approved`
- `with reviewer notes.`
- `Changes requested`
- `Content rejected`
- `Content published`
- `Publication scheduled`
- `Author reminded`
- `Item reopened`
- `Content archived`
- `Reader preview`
- `Action recorded`
- `Queue clear`
- `No items are currently pending review.`
- `Review log exported`
- `CSV generated with editorial decisions, reviewers and timestamps.`
- `Queue refreshed`
- `Synced at`
- `Nothing to approve`
- `No flag-free pending items are currently in the queue.`
- `Bulk approval complete`
**Data:** `GET /admin/content/summary` → tiles (`Awaiting Review`, `Changes Requested`, `Approved Today`, `Rejected (7 days)`, `Avg. Review Time` `<n> h`, `Published (30 days)`). `GET /admin/content` (`type`, `status`, `flag`, `q`, `page`) → table: `Content` (title + summary + type chip `CONTENT_TYPE_LABELS` + slug path), `Author` (initials + name + team), `Submitted` (`DD Mon · HH:MM UTC`), `Risk flags` (`RISK_FLAG_LABELS` chips, none = `—`), `Status` (`CONTENT_STATUS_LABELS`), `Actions`. Filter selects and `Clear filters` (toast `Filters cleared` / `Showing the full pre-publication review queue.`). `Refresh queue` toasts `Queue refreshed`; `Export review log` calls `// TODO(backend-contract): no export endpoint` and toasts `Review log exported` only if a CSV was produced — until the endpoint exists render the button disabled with the tooltip `Export is not available yet.`. `Approve all clean` (bulk over flag-free pending items): iterate `POST …/actions { action: "approve" }` for each flag-free pending item the caller did not author; none → toast `Nothing to approve` / `No flag-free pending items are currently in the queue.`; each result handled individually.
**Review dialog (`Dialog`):** shows the item (title, author, slug, flags, summary), five editorial checks (labels from the markup), decision radios (`Approve`, `Request changes`, `Reject`), reviewer note (required for request-changes/reject, min 10 — error `Add a note of at least 10 characters.` planner), and the status lines verbatim: `Complete all five editorial checks and select a decision to enable the action.` → `<n> editorial check(s) still outstanding before a decision can be confirmed.` → `All editorial checks complete — select a decision to continue.` → `All checks complete. Confirming will write this editorial decision to the audit log.` Approve requires all five checks (UI rule; the API enforces separation of duties). Row actions by status: `publish` (approved → toast `Content published` / `"<title>" is now live on the public website.`), `schedule` (date-time picker, future only → `Publication scheduled` / `"<title>" will go live at the next scheduled slot.`), `remind_author` (`Author reminded` / `"<title>" — notification sent to the author.`), `Preview` (toast `Reader preview` / `"<title>" — rendering as it would appear to the public.`; no endpoint). Decision toasts verbatim: `Content approved` / `"<title>" cleared for publication with reviewer notes.`; `Changes requested` / `"<title>" returned to the author for revision.`; `Content rejected` / `"<title>" archived. No further review unless reopened.`.
**Error mapping:** `409 own_submission` → `You cannot review your own submission.`; `403 legal_review_required` → `This item needs administrator sign-off before it can be published.`; `409 invalid_transition` → refresh the queue.

**Tests:** summary tiles; filters; dialog gating; each decision payload; legal-review 403 message; own-submission 409 message; bulk approve skips authored/flagged items.

---

**Data shape (TypeScript):**
```ts
// ModerationItem, ModerationSummary, ModerationActionBody: see contracts (Task 20).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/admin/content?… → 200 { data: ModerationItem[]; total } · GET …/summary → { data: ModerationSummary }
// POST /api/v1/admin/content/:id/actions body { action; note?; scheduledFor? } → 200 { data: ModerationItem } | 403 legal_review_required | 409 { error: "own_submission" | "invalid_transition" }
```

---

**Out of scope:**
- Do not render submitted body content unsanitised.
- Do not add an export endpoint call.
- Do not publish without the API's checks.

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
☐ Report at the end: `Task 83 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---


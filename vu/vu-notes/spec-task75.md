### TASK 75 — Admin shared stylesheet and PageHead component

**Layer:** L9

**Prerequisites:** Task 5, Task 8, Task 9, Task 46

**Estimated files touched:** 5

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Admin shared stylesheet and PageHead component**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Create the admin surface's shared stylesheet (cards, KPI tiles, tables, badges, buttons, tags, form fields, toasts, modals) and the `AdminPageHead` component every admin page opens with.

**Deliverables:**
- `apps/web/src/app/(authed)/admin/_styles/admin-shared.css` — the reference CSS below, converted to token `var()`s.
- `apps/web/src/app/(authed)/admin/_components/admin-page-head.tsx` — `AdminPageHead`.
- `apps/web/src/app/(authed)/admin/_components/admin-page-head.test.tsx`
- `apps/web/src/app/(authed)/admin/_components/kpi-strip.tsx` — thin wrappers `AdmKpiStrip` / `AdmKpi` that render the reference `adm-kpi*` markup.
- MODIFY `apps/web/src/app/(authed)/admin/layout.tsx` — add `import "./_styles/admin-shared.css";`.

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

**Reference markup (page head + KPI strip as they open every admin page — taken from the Command Center page):**

##### Page head and KPI strip
```html
<div class="adm-shell">
 <div class="adm-page-head">
  <div>
   <span class="adm-eyebrow">Data Analytics Dashboard Overview</span>
   <h1 class="adm-page-title">Administrative Command Center</h1>
   <p class="adm-page-sub">Consolidated operational intelligence across revenue, network load, job throughput and threat posture. All figures refresh from the VUNVAULT sensor mesh and billing ledger.</p>
  </div>
  <div class="adm-head-actions">
   <button type="button" class="adm-btn adm-btn-primary" id="adm-initiate-scan">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Initiate System Scan</span>
   </button>
   <button type="button" class="adm-btn adm-btn-dark" id="adm-export-audit">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Export Audit Logs</span>
   </button>
   <button type="button" class="adm-btn adm-btn-ghost" id="adm-refresh-dashboard">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Refresh Metrics</span>
   </button>
  </div>
 </div>
 <section aria-labelledby="adm-kpi-heading">
  <h2 id="adm-kpi-heading" class="sr-only">Key performance indicators</h2>
  <div class="adm-kpi-grid">
   <article class="adm-kpi">
    <span class="adm-kpi-label">Total Paid Clients</span>
    <span class="adm-kpi-value">312</span>
    <span class="adm-kpi-delta adm-kpi-delta--up">▲ 18 new this month</span>
   </article>
   [+5 more sibling <article> elements with the SAME structure as the one above; their text content in order: Total Revenue ¦ $184,720 ¦ ▲ 12.4% vs. last quarter || Completed Jobs ¦ 1,842 ¦ ▲ 96 closed this week || Pending Review ¦ 37 ¦ ● Awaiting mandatory admin review || Active Running Scans ¦ 12 ¦ ● 12 of 24 worker slots in use || Critical CVEs Tracked ¦ 46 ¦ ▲ 9 unpatched · escalation advised]
  </div>
 </section>
 <section aria-labelledby="adm-revenue-heading" class="adm-grid">
  <div class="adm-card adm-span-4">
   <div class="adm-card-head">
    <div>
     <h2 class="adm-card-title" id="adm-revenue-heading">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      Revenue & Paid Scans
     </h2>
     <p class="adm-card-note">Billing ledger rollup for penetration testing packages, retainers and compliance assessments.</p>
    </div>
    <span class="adm-tag adm-tag--ok">Ledger Synced</span>
   </div>
   <div class="adm-card-body">
    <dl class="adm-dl">
     <div class="adm-dl-item">
      <dt>Gross Revenue (YTD)</dt>
      <dd>
       $184,720
       <small>All packages, net of refunds</small>
      </dd>
     </div>
     [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Revenue This Month ¦ $22,450 ¦ 01 – 24 Sep 2026 || Paid Clients ¦ 312 ¦ 284 SME · 22 SACCO · 6 Enterprise || Average Order Value ¦ $592 ¦ Across all plan tiers]
    </dl>
    <hr class="adm-divider"/>
    <h3 class="adm-kpi-label">Revenue by Package Tier</h3>
    <div class="adm-progress-row">
     <span class="adm-progress-name">
      Starter Scan
      <small>$299 / scan</small>
     </span>
     <progress class="adm-progress" value="41">41%</progress>
     <span class="adm-progress-value">41%</span>
    </div>
    [+2 more sibling <div> elements with the SAME structure as the one above; their text content in order: SACCO & Fintech ¦ $899 / assessment ¦ 34% ¦ 34% || Enterprise Retainer ¦ $2,499 / month ¦ 25% ¦ 25%]
    <p class="adm-note">Tier shares are computed on gross revenue for the trailing 90 days.</p>
   </div>
  </div>
  <div class="adm-card adm-span-8">
   <div class="adm-card-head">
    <div>
     <h2 class="adm-card-title">Recent Payment Transactions</h2>
     <p class="adm-card-note">Latest six settled, pending and refunded transactions across M-Pesa, card and bank transfer.</p>
    </div>
    <span class="adm-tag">Last 48 hours</span>
   </div>
   <div class="adm-card-body">
    <div class="adm-table-wrap">
     <table class="adm-table">
      <caption class="sr-only">Recent payment transactions for penetration testing packages</caption>
      <thead>
       <tr>
        <th>Txn ID</th>
        <th>Date (UTC)</th>
        <th>Client</th>
        <th>Package</th>
        <th>Method</th>
        <th class="adm-num">Amount</th>
        <th>Status</th>
       </tr>
      </thead>
      <tbody>
       <tr>
        <td class="adm-mono">VX-90241</td>
        <td class="adm-mono">24 Sep · 09:14</td>
        <td class="adm-strong">Horizon SACCO</td>
        <td>Enterprise Retainer</td>
        <td>M-Pesa</td>
        <td class="adm-num adm-strong">$2,499</td>
        <td>
         <span class="adm-badge adm-badge--settled">Settled</span>
        </td>
       </tr>
       [+5 more sibling <tr> elements with the SAME structure as the one above; their text content in order: VX-90240 ¦ 24 Sep · 08:02 ¦ Nairobi Fintech Group ¦ SACCO & Fintech Compliance ¦ Card ¦ $899 ¦ Settled || VX-90239 ¦ 23 Sep · 17:41 ¦ Kijani Agri Co-op ¦ Starter Scan ¦ M-Pesa ¦ $299 ¦ Settled || VX-90238 ¦ 23 Sep · 14:20 ¦ Lakeview Logistics ¦ Enterprise Retainer ¦ Bank Transfer ¦ $2,499 ¦ Pending || VX-90237 ¦ 23 Sep · 11:05 ¦ Mwananchi Microfinance ¦ SACCO & Fintech Compliance ¦ M-Pesa ¦ $899 ¦ Settled || VX-90236 ¦ 22 Sep · 19:33 ¦ TechBridge Solutions ¦ Starter Scan ¦ Card ¦ $299 ¦ Refunded]
      </tbody>
      <tfoot>
       <tr>
        <td>Total across displayed transactions</td>
        <td class="adm-num">$7,394</td>
        <td>5 settled · 1 pending · 1 refunded</td>
       </tr>
      </tfoot>
     </table>
    </div>
    <div class="adm-card-body">
     <div class="adm-inline-actions">
      <button type="button" class="adm-mini-btn">Reconcile Ledger</button>
      <button type="button" class="adm-mini-btn">Download CSV</button>
      <button type="button" class="adm-mini-btn">Issue Refund</button>
     </div>
    </div>
   </div>
  </div>
 </section>
 [+3 more sibling <section> elements with the SAME structure as the one above; their text content in order: Traffic & Network Load ¦ Incoming site sessions, API request volume and per-endpoint latency across the edge tier. ¦ Rolling 24h ¦ Site Sessions ¦ 48,392 ¦ ▲ 6.2% day over day ¦ API Requests ¦ 2.14M ¦ Across 41 endpoints ¦ Avg. Response ¦ 142 ¦ ms · p95 384 ms ¦ Hourly API Request Volume (millions) ¦ Peak 00:00 UTC · 0.31M ¦ 0.31 ¦ 00h ¦ [+6 more sibling <div> elements with the SAME structure as the one above; their text content in order: 0.22 ¦ 04h || 0.29 ¦ 08h || 0.27 ¦ 12h || 0.24 ¦ 16h || 0.21 ¦ 20h || 0.30 ¦ 24h] ¦ Top Endpoints by Load ¦ Request distribution, mean latency and error ratio. ¦ Top API endpoints by request volume ¦ Endpoint ¦ Requests ¦ Latency ¦ Errors ¦ /api/v1/scan/submit ¦ 412,880 ¦ 168 ms ¦ 0.21% ¦ [+5 more sibling <tr> elements with the SAME structure as the one above; their text content in order: /api/v1/auth/token ¦ 388,214 ¦ 92 ms ¦ 0.08% || /api/v1/report/export ¦ 121,540 ¦ 431 ms ¦ 0.64% || /api/v1/cve/feed ¦ 96,772 ¦ 74 ms ¦ 0.02% || /api/v1/nodes/heartbeat ¦ 84,318 ¦ 41 ms ¦ 0.01% || /admin (dashboard) ¦ 51,204 ¦ 210 ms ¦ 0.33%] ¦ Aggregate ¦ 1,154,928 ¦ 169 ms ¦ 0.22% ¦ Sensor Node Load Distribution ¦ Real-time worker saturation per regional reconnaissance node. Values above 85% trigger autoscaling. ¦ 412 / 412 online ¦ node-nbo-01 ¦ Nairobi Core · 41,200 req/min ¦ 62% ¦ 62% ¦ [+5 more sibling <div> elements with the SAME structure as the one above; their text content in order: node-nbo-02 ¦ Nairobi Edge · 28,940 req/min ¦ 48% ¦ 48% || node-acc-01 ¦ Accra Relay · 36,410 req/min ¦ 88% ¦ 88% || node-lag-01 ¦ Lagos Relay · 31,880 req/min ¦ 55% ¦ 55% || node-jnb-01 ¦ Johannesburg Vault · 19,220 req/min ¦ 33% ¦ 33% || node-fra-01 ¦ Frankfurt Mirror · 44,600 req/min ¦ 79% ¦ 79%] ¦ Node load is sampled every 15 seconds from the heartbeat mesh and averaged over a 5-minute window. || Job Progress & Status ¦ Throughput barometer across the scan pipeline, including jobs blocked on mandatory admin review. ¦ 37 Awaiting Review ¦ Completed Jobs ¦ 1,842 ¦ 96 closed in the last 7 days ¦ Pending Jobs ¦ 96 ¦ Queued, not yet assigned ¦ Unreviewed Jobs ¦ 37 ¦ Admin review required before release ¦ Active Running Scans ¦ 12 ¦ 12 of 24 worker slots occupied ¦ Pipeline Distribution ¦ Completed ¦ 1,842 jobs ¦ 93% ¦ 93% ¦ [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Pending ¦ 96 jobs ¦ 5% ¦ 5% || Unreviewed ¦ 37 jobs ¦ 2% ¦ 2% || Running ¦ 12 jobs ¦ 1% ¦ 1%] ¦ Unreviewed jobs are held for a maximum of 72 hours before automatic escalation to the on-call lead. ¦ Active Running Scans Monitor ¦ Live worker telemetry for every scan currently executing on the VUNVAULT engine. ¦ 12 Active ¦ Currently running penetration test scans ¦ Job ID ¦ Target ¦ Type ¦ Analyst ¦ Progress ¦ ETA ¦ JOB-4471 ¦ api.horizonsacco.co.ke ¦ External ¦ e.reed ¦ 78% ¦ 4m 12s ¦ [+4 more sibling <tr> elements with the SAME structure as the one above; their text content in order: JOB-4470 ¦ pay.nairobifintech.com ¦ API ¦ a.njoroge ¦ 64% ¦ 7m 38s || JOB-4469 ¦ vault.lakeviewlogistics.com ¦ Internal ¦ d.mwangi ¦ 41% ¦ 13m 05s || JOB-4468 ¦ 10.24.8.0/24 ¦ Network ¦ b.otieno ¦ 89% ¦ 1m 47s || JOB-4467 ¦ mobile.mwananchi.co.ke ¦ Mobile ¦ f.hassan ¦ 22% ¦ 18m 30s] ¦ Showing 5 of 12 active jobs · 7 more running on the secondary worker pool ¦ Open Scan Queue ¦ Pause All Workers ¦ Assign Reviewer || Zero-Day Threat Level ¦ Composite index derived from weaponisation status, exploit availability and patch coverage. ¦ Elevated ¦ Current Level ¦ LEVEL 4 / 5 ¦ Low ¦ Guarded ¦ Elevated ¦ High ¦ Severe ¦ Critical CVEs Tracked ¦ 46 ¦ 9 currently unpatched ¦ Total Active Zero-Days ¦ 1,284 ¦ ▲ 62 this week ¦ Weaponized in the Wild ¦ 37 ¦ Active exploitation confirmed ¦ Threats Blocked (YTD) ¦ 12,904 ¦ Perimeter + endpoint sensors ¦ Threat level is recalculated hourly. A level of 4 or above triggers automatic escalation to the incident commander on duty. ¦ Sensor Node Network Connectivity ¦ Connectivity, heartbeat latency and clock drift for each regional sensor node in the mesh. ¦ 412 / 412 Online ¦ node-nbo-01 ¦ Nairobi Core · Kenya ¦ Heartbeat ¦ 18 ms ¦ Clock Drift ¦ ±2 ms ¦ Operational ¦ [+5 more sibling <article> elements with the SAME structure as the one above; their text content in order: node-nbo-02 ¦ Nairobi Edge · Kenya ¦ Heartbeat ¦ 24 ms ¦ Clock Drift ¦ ±3 ms ¦ Operational || node-acc-01 ¦ Accra Relay · Ghana ¦ Heartbeat ¦ 142 ms ¦ Clock Drift ¦ ±11 ms ¦ High Load || node-lag-01 ¦ Lagos Relay · Nigeria ¦ Heartbeat ¦ 96 ms ¦ Clock Drift ¦ ±5 ms ¦ Operational || node-jnb-01 ¦ Johannesburg Vault · South Africa ¦ Heartbeat ¦ 112 ms ¦ Clock Drift ¦ ±4 ms ¦ Operational || node-fra-01 ¦ Frankfurt Mirror · Germany ¦ Heartbeat ¦ 38 ms ¦ Clock Drift ¦ ±19 ms ¦ Drift Warning] ¦ Threats Blocked — Last 7 Days ¦ Total 12,904 ¦ 1,640 ¦ Mon ¦ [+6 more sibling <div> elements with the SAME structure as the one above; their text content in order: 1,982 ¦ Tue || 1,410 ¦ Wed || 2,240 ¦ Thu || 1,880 ¦ Fri || 1,502 ¦ Sat || 2,250 ¦ Sun] ¦ Connectivity is confirmed by a signed heartbeat every 15 seconds. Two consecutive misses mark a node as degraded; three mark it offline.]
</div>
```

`AdminPageHead({ eyebrow, title, description, actions })` renders `.adm-page-head` with the eyebrow (`Eyebrow`), `h1.adm-h1`, description `p.adm-lede` and a right-aligned actions slot. `AdmKpi({ label, value, unit?, delta?: { tone: "up"|"dot"|"down"|"warn"; text } })` renders the `adm-kpi` tile (value in monospace; same visual as `KpiCard` of Task 9 — if the markup's classes differ, the CSS below wins).

**Shared CSS (complete; every class the admin pages use that is not part of the Task 46 chrome). Convert to `var(--token)` where a token exists; keep the rest:**
```css
body.adm-body { background: radial-gradient(90% 42% at 50% 0%, rgba(59, 153, 252, 0.07), transparent 62%), var(--paper); }
.adm-main { flex: 1 1 auto; padding: 28px 0 64px; }
.adm-page-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 20px; padding-bottom: 22px; margin-bottom: 26px; border-bottom: 1px solid var(--line-soft); }
.adm-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 10px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: var(--brand-strong); }
.adm-eyebrow::before { content: ""; width: 22px; height: 2px; border-radius: 2px; background: var(--brand); }
.adm-page-title { margin-top: 10px; font-size: clamp(1.6rem, 3.2vw, 2.3rem); font-weight: 800; letter-spacing: -0.025em; line-height: 1.15; color: var(--ink); }
.adm-page-sub { margin-top: 8px; max-width: 70ch; font-size: 0.85rem; line-height: 1.7; color: var(--ink-muted); }
.adm-head-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.adm-btn { display: inline-flex; align-items: center; justify-content: center; gap: 9px; padding: 12px 20px; font-size: 0.78rem; font-weight: 800; letter-spacing: 0.01em; border-radius: var(--r-full); border: 1px solid transparent; cursor: pointer; white-space: nowrap; transition: transform 0.2s var(--ease), filter 0.2s var(--ease), box-shadow 0.2s var(--ease), background-color 0.2s var(--ease), border-color 0.2s var(--ease), color 0.2s var(--ease); }
.adm-btn:active { transform: translateY(1px) scale(0.985); }
.adm-btn-primary { color: #ffffff; background: linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%); border-color: rgba(59, 153, 252, 0.5); box-shadow: 0 14px 30px -16px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.24); }
.adm-btn-primary:hover { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 20px 40px -18px var(--brand-glow); }
.adm-btn-ghost { color: var(--ink); background: #ffffff; border-color: var(--line); box-shadow: 0 6px 18px -16px rgba(10, 13, 18, 0.6); }
.adm-btn-ghost:hover { transform: translateY(-2px); border-color: var(--brand-line); color: var(--brand-strong); box-shadow: 0 14px 30px -20px var(--brand-glow); }
.adm-btn-dark { color: #ffffff; background: linear-gradient(135deg, var(--dark), #05070a); border-color: rgba(59, 153, 252, 0.32); }
.adm-btn-dark:hover { transform: translateY(-2px); border-color: var(--brand); box-shadow: 0 18px 34px -20px var(--brand-glow); }
.adm-btn svg { flex: 0 0 auto; }
.adm-kpi-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px; margin-bottom: 30px; }
@media (max-width: 1380px) {
.adm-kpi-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 760px) {
.adm-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 460px) {
.adm-kpi-grid { grid-template-columns: 1fr; }
}
.adm-kpi { position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 7px; padding: 18px 18px 16px; border-radius: 16px; background: #ffffff; border: 1px solid var(--line); box-shadow: 0 12px 30px -26px rgba(10, 13, 18, 0.5); transition: transform 0.25s var(--ease), border-color 0.25s var(--ease), box-shadow 0.25s var(--ease); }
.adm-kpi::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, var(--brand), transparent); opacity: 0.75; }
.adm-kpi:hover { transform: translateY(-3px); border-color: var(--brand-line); box-shadow: 0 22px 44px -30px var(--brand-glow); }
.adm-kpi-label { font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); }
.adm-kpi-value { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: clamp(1.5rem, 2.6vw, 1.95rem); font-weight: 800; letter-spacing: -0.035em; line-height: 1; color: var(--ink); }
.adm-kpi-value small { font-size: 0.62em; font-weight: 700; color: var(--ink-muted); margin-left: 2px; }
.adm-kpi-delta { font-size: 10.5px; font-weight: 700; color: var(--ink-muted); }
.adm-kpi-delta--up { color: #047857; }
.adm-kpi-delta--down { color: #be123c; }
.adm-kpi-delta--warn { color: #b45309; }
.adm-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 20px; margin-bottom: 20px; }
.adm-card { grid-column: span 12; display: flex; flex-direction: column; border-radius: 18px; background: #ffffff; border: 1px solid var(--line); box-shadow: 0 18px 44px -38px rgba(10, 13, 18, 0.55); overflow: hidden; }
.adm-card--dark { background: radial-gradient(80% 120% at 100% 0%, rgba(59, 153, 252, 0.16), transparent 62%), linear-gradient(160deg, var(--dark) 0%, #070b11 100%); border-color: rgba(59, 153, 252, 0.26); box-shadow: 0 26px 56px -34px rgba(0, 0, 0, 0.7); color: #ffffff; }
@media (min-width: 1080px) {
.adm-span-4 { grid-column: span 4; }
.adm-span-5 { grid-column: span 5; }
.adm-span-6 { grid-column: span 6; }
.adm-span-7 { grid-column: span 7; }
.adm-span-8 { grid-column: span 8; }
.adm-span-12 { grid-column: span 12; }
}
.adm-card-head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 14px; padding: 20px 22px 16px; border-bottom: 1px solid var(--line-soft); }
.adm-card--dark .adm-card-head { border-bottom-color: rgba(255, 255, 255, 0.08); }
.adm-card-title { display: flex; align-items: center; gap: 10px; font-size: 1rem; font-weight: 800; letter-spacing: -0.01em; color: var(--ink); }
.adm-card--dark .adm-card-title { color: #ffffff; }
.adm-card-title svg { color: var(--brand); flex: 0 0 auto; }
.adm-card-note { margin-top: 5px; font-size: 0.74rem; line-height: 1.6; color: var(--ink-muted); max-width: 62ch; }
.adm-card--dark .adm-card-note { color: #93a2b5; }
.adm-card-body { flex: 1 1 auto; padding: 20px 22px 24px; }
.adm-tag { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 9.5px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; border-radius: var(--r-full); white-space: nowrap; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); }
.adm-tag--ok { color: #047857; background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.35); }
.adm-tag--warn { color: #b45309; background: rgba(245, 158, 11, 0.12); border-color: rgba(245, 158, 11, 0.35); }
.adm-tag--crit { color: #be123c; background: rgba(244, 63, 94, 0.1); border-color: rgba(244, 63, 94, 0.35); }
.adm-card--dark .adm-tag { color: var(--brand-soft); background: rgba(59, 153, 252, 0.14); border-color: rgba(59, 153, 252, 0.35); }
.adm-dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 20px; margin: 0; }
.adm-dl--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
@media (max-width: 700px) {
.adm-dl, .adm-dl--3 { grid-template-columns: 1fr; }
}
.adm-dl-item { padding: 14px 16px; border-radius: 13px; background: #f8fafc; border: 1px solid var(--line-soft); }
.adm-card--dark .adm-dl-item { background: rgba(255, 255, 255, 0.04); border-color: rgba(255, 255, 255, 0.08); }
.adm-dl dt { font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); }
.adm-card--dark .adm-dl dt { color: #7d8b9e; }
.adm-dl dd { margin: 7px 0 0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 1.28rem; font-weight: 800; letter-spacing: -0.03em; color: var(--ink); }
.adm-card--dark .adm-dl dd { color: #ffffff; }
.adm-dl dd small { display: block; margin-top: 4px; font-family: "Inter", system-ui, sans-serif; font-size: 10.5px; font-weight: 600; letter-spacing: 0; color: var(--ink-muted); }
.adm-card--dark .adm-dl dd small { color: #8b98a9; }
.adm-table-wrap { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
.adm-table { width: 100%; min-width: 720px; border-collapse: collapse; font-size: 0.78rem; }
.adm-table thead th { position: sticky; top: 0; z-index: 2; padding: 12px 16px; text-align: left; font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-muted); background: #f6f8fb; border-bottom: 1px solid var(--line); white-space: nowrap; }
.adm-card--dark .adm-table thead th { color: #b7c4d4; background: rgba(255, 255, 255, 0.04); border-bottom-color: rgba(59, 153, 252, 0.22); }
.adm-table tbody td { padding: 13px 16px; vertical-align: middle; color: var(--ink); border-bottom: 1px solid var(--line-soft); }
.adm-card--dark .adm-table tbody td { color: #cbd5e1; border-bottom-color: rgba(255, 255, 255, 0.07); }
.adm-table tbody tr:nth-child(even) { background: #fbfcfd; }
.adm-card--dark .adm-table tbody tr:nth-child(even) { background: rgba(255, 255, 255, 0.02); }
.adm-table tbody tr { transition: background-color var(--dur) var(--ease); }
.adm-table tbody tr:hover { background: var(--brand-tint); }
.adm-card--dark .adm-table tbody tr:hover { background: rgba(59, 153, 252, 0.12); }
.adm-table tfoot td { padding: 13px 16px; font-size: 0.76rem; font-weight: 800; color: var(--ink); background: #f6f8fb; border-top: 1px solid var(--line); }
.adm-card--dark .adm-table tfoot td { color: #ffffff; background: rgba(255, 255, 255, 0.05); border-top-color: rgba(59, 153, 252, 0.22); }
.adm-num { text-align: right; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.adm-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.74rem; font-weight: 700; letter-spacing: -0.01em; }
.adm-strong { font-weight: 800; }
.adm-badge { display: inline-block; padding: 4px 11px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; border-radius: var(--r-full); white-space: nowrap; border: 1px solid transparent; }
.adm-badge--settled { color: #065f46; background: #ecfdf5; border-color: #a7f3d0; }
.adm-badge--pending { color: #92400e; background: #fffbeb; border-color: #fde68a; }
.adm-badge--refunded { color: #9f1239; background: #fff1f2; border-color: #fecdd3; }
.adm-badge--ok { color: #065f46; background: #ecfdf5; border-color: #a7f3d0; }
.adm-badge--warn { color: #92400e; background: #fffbeb; border-color: #fde68a; }
.adm-badge--crit { color: #9f1239; background: #fff1f2; border-color: #fecdd3; }
.adm-badge--info { color: var(--brand-strong); background: var(--brand-tint); border-color: var(--brand-line); }
.adm-card--dark .adm-badge--info { color: var(--brand-soft); background: rgba(59, 153, 252, 0.14); border-color: rgba(59, 153, 252, 0.35); }
.adm-figure { margin: 0; padding: 18px 18px 14px; border-radius: 14px; background: #f8fafc; border: 1px solid var(--line-soft); }
.adm-card--dark .adm-figure { background: rgba(255, 255, 255, 0.03); border-color: rgba(255, 255, 255, 0.08); }
.adm-figcaption { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-muted); }
.adm-card--dark .adm-figcaption { color: #93a2b5; }
.adm-figcaption span:last-child { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; letter-spacing: 0.04em; color: var(--brand-strong); }
.adm-card--dark .adm-figcaption span:last-child { color: var(--brand-soft); }
.adm-bars { display: flex; align-items: flex-end; gap: clamp(6px, 1.4vw, 14px); height: 190px; padding-top: 6px; }
.adm-bar-col { flex: 1 1 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 8px; height: 100%; min-width: 0; }
.adm-bar-track { position: relative; width: 100%; height: 100%; display: flex; align-items: flex-end; border-radius: 8px 8px 4px 4px; background: rgba(59, 153, 252, 0.06); overflow: hidden; }
.adm-card--dark .adm-bar-track { background: rgba(255, 255, 255, 0.05); }
.adm-bar-fill { display: block; width: 100%; border-radius: 8px 8px 4px 4px; background: linear-gradient(180deg, var(--brand-soft), var(--brand-strong)); box-shadow: 0 0 18px -6px var(--brand-glow); transition: height 0.6s var(--ease); }
.adm-bar-fill--alt { background: linear-gradient(180deg, #34d399, #059669); box-shadow: 0 0 18px -6px rgba(16, 185, 129, 0.5); }
.adm-bar-label { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 9.5px; font-weight: 700; color: var(--ink-muted); white-space: nowrap; }
.adm-card--dark .adm-bar-label { color: #7d8b9e; }
.adm-bar-value { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10px; font-weight: 800; color: var(--ink); }
.adm-card--dark .adm-bar-value { color: #ffffff; }
.adm-progress-row { display: grid; grid-template-columns: minmax(120px, 1.4fr) minmax(80px, 3fr) auto; align-items: center; gap: 14px; padding: 11px 0; border-bottom: 1px dashed var(--line-soft); }
.adm-progress-row:last-child { border-bottom: 0; }
.adm-card--dark .adm-progress-row { border-bottom-color: rgba(255, 255, 255, 0.08); }
.adm-progress-name { font-size: 0.76rem; font-weight: 700; color: var(--ink); }
.adm-card--dark .adm-progress-name { color: #e2e8f0; }
.adm-progress-name small { display: block; margin-top: 2px; font-size: 9.5px; font-weight: 600; color: var(--ink-faint); }
.adm-card--dark .adm-progress-name small { color: #7d8b9e; }
.adm-progress-value { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; font-weight: 800; color: var(--brand-strong); min-width: 44px; text-align: right; }
.adm-card--dark .adm-progress-value { color: var(--brand-soft); }
progress.adm-progress { appearance: none; -webkit-appearance: none; width: 100%; height: 8px; border: 0; border-radius: var(--r-full); overflow: hidden; background: rgba(59, 153, 252, 0.12); display: block; }
progress.adm-progress::-webkit-progress-bar { background: rgba(59, 153, 252, 0.12); border-radius: var(--r-full); }
progress.adm-progress::-webkit-progress-value { border-radius: var(--r-full); background: linear-gradient(90deg, var(--brand-strong), var(--brand-soft)); }
progress.adm-progress::-moz-progress-bar { border-radius: var(--r-full); background: linear-gradient(90deg, var(--brand-strong), var(--brand-soft)); }
progress.adm-progress--warn::-webkit-progress-value { background: linear-gradient(90deg, #d97706, #fbbf24); }
progress.adm-progress--warn::-moz-progress-bar { background: linear-gradient(90deg, #d97706, #fbbf24); }
progress.adm-progress--crit::-webkit-progress-value { background: linear-gradient(90deg, #be123c, #fb7185); }
progress.adm-progress--crit::-moz-progress-bar { background: linear-gradient(90deg, #be123c, #fb7185); }
progress.adm-progress--ok::-webkit-progress-value { background: linear-gradient(90deg, #047857, #34d399); }
progress.adm-progress--ok::-moz-progress-bar { background: linear-gradient(90deg, #047857, #34d399); }
.adm-card--dark progress.adm-progress,
      .adm-card--dark progress.adm-progress::-webkit-progress-bar { background: rgba(255, 255, 255, 0.09); }
.adm-threat { display: flex; flex-direction: column; gap: 12px; padding: 18px; border-radius: 14px; background: linear-gradient(160deg, rgba(244, 63, 94, 0.08), rgba(245, 158, 11, 0.05)); border: 1px solid rgba(244, 63, 94, 0.22); }
.adm-threat-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.adm-threat-level { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 1.25rem; font-weight: 800; letter-spacing: 0.06em; color: #be123c; }
.adm-threat-scale { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
.adm-threat-step { height: 10px; border-radius: var(--r-full); background: var(--line); transition: background-color var(--dur) var(--ease); }
.adm-threat-step.is-1 { background: #34d399; }
.adm-threat-step.is-2 { background: #a3e635; }
.adm-threat-step.is-3 { background: #fbbf24; }
.adm-threat-step.is-4 { background: #f97316; }
.adm-threat-step.is-5 { background: var(--critical); box-shadow: 0 0 14px -4px rgba(244, 63, 94, 0.8); }
.adm-threat-legend { display: flex; justify-content: space-between; font-size: 9px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-faint); }
.adm-node-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
@media (max-width: 900px) {
.adm-node-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 560px) {
.adm-node-grid { grid-template-columns: 1fr; }
}
.adm-node { display: flex; flex-direction: column; gap: 8px; padding: 14px 15px; border-radius: 13px; background: #f8fafc; border: 1px solid var(--line-soft); transition: border-color var(--dur) var(--ease), transform var(--dur) var(--ease); }
.adm-node:hover { transform: translateY(-2px); border-color: var(--brand-line); }
.adm-card--dark .adm-node { background: rgba(255, 255, 255, 0.04); border-color: rgba(255, 255, 255, 0.08); }
.adm-card--dark .adm-node:hover { border-color: rgba(59, 153, 252, 0.45); }
.adm-node-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.adm-node-id { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.72rem; font-weight: 800; color: var(--ink); }
.adm-card--dark .adm-node-id { color: #e2e8f0; }
.adm-node-region { font-size: 10px; font-weight: 600; color: var(--ink-muted); }
.adm-card--dark .adm-node-region { color: #8b98a9; }
.adm-node-metric { display: flex; align-items: center; justify-content: space-between; font-size: 10.5px; font-weight: 700; color: var(--ink-soft); }
.adm-card--dark .adm-node-metric { color: #93a2b5; }
.adm-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto; }
.adm-dot--ok { background: var(--ok); box-shadow: 0 0 10px -2px rgba(16, 185, 129, 0.9); }
.adm-dot--warn { background: var(--high); box-shadow: 0 0 10px -2px rgba(245, 158, 11, 0.9); }
.adm-dot--crit { background: var(--critical); box-shadow: 0 0 10px -2px rgba(244, 63, 94, 0.9); }
.adm-divider { height: 1px; margin: 18px 0; background: var(--line-soft); border: 0; }
.adm-card--dark .adm-divider { background: rgba(255, 255, 255, 0.08); }
.adm-note { margin-top: 16px; font-size: 10.5px; line-height: 1.7; color: var(--ink-faint); }
.adm-card--dark .adm-note { color: #64748b; }
.adm-inline-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.adm-mini-btn { display: inline-flex; align-items: center; gap: 7px; padding: 9px 15px; font-size: 0.72rem; font-weight: 800; border-radius: var(--r-full); cursor: pointer; color: var(--ink); background: #ffffff; border: 1px solid var(--line); transition: all 0.2s var(--ease); }
.adm-mini-btn:hover { transform: translateY(-1px); color: var(--brand-strong); border-color: var(--brand-line); box-shadow: 0 12px 24px -18px var(--brand-glow); }
.adm-card--dark .adm-mini-btn { color: #cbd5e1; background: rgba(255, 255, 255, 0.05); border-color: rgba(255, 255, 255, 0.12); }
.adm-card--dark .adm-mini-btn:hover { color: #ffffff; border-color: rgba(59, 153, 252, 0.5); background: rgba(59, 153, 252, 0.12); }
@media (prefers-reduced-motion: reduce) {
.adm-kpi, .adm-btn, .adm-node, .adm-mini-btn, .adm-bar-fill { transition-duration: 0.001ms !important; transform: none !important; }
}
@media print {
body.adm-body { background: #ffffff; }
.adm-card, .adm-kpi { box-shadow: none; border-color: #cccccc; }
}
```
**Tests:** page head renders eyebrow/title/description verbatim and an actions slot; KPI tile renders a value with a unit and delta tone classes.

---

**Data shape (TypeScript):**
N/A — presentational.

**API contract (as comments only — do NOT implement the backend):**
N/A — no API.

---

**Out of scope:**
- Do not build any page.
- Do not edit the Task 46 chrome stylesheet.

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
☐ Report at the end: `Task 75 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---


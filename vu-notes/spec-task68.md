### TASK 68 — Client profile page

**Layer:** L8

**Prerequisites:** Task 30, Task 45, Task 42, Task 10

**Estimated files touched:** 8

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Client profile page**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build `/portal/profile`: identity header with account stats and an editable personal/company details form saved through the profile API.

**Deliverables:**
- `apps/web/src/app/(authed)/portal/profile/page.tsx`
- `apps/web/src/app/(authed)/portal/profile/_components/profile-hero.tsx`, `profile-form.tsx`, `account-stats.tsx`
- `apps/web/src/app/(authed)/portal/profile/_hooks/use-client-profile.ts`
- `apps/web/src/app/(authed)/portal/profile/_styles/profile.css`
- `apps/web/src/mocks/handlers/profile.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- `apps/web/src/app/(authed)/portal/profile/profile.test.tsx`

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

##### Client profile page body
```html
<main class="flex-1">
 <section class="pt-10 pb-16 md:pt-14 md:pb-20">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
   <div class="vvp-identity">
    <div class="vvp-identity-glow" aria-hidden="true"></div>
    <div class="vvp-avatar" aria-hidden="true">JW</div>
    <div class="vvp-identity-body">
     <h1 class="vvp-identity-name">Jane Wanjiru</h1>
     <p class="vvp-identity-company">Acme Fintech Ltd · Head of Information Security</p>
     <div class="vvp-chip-row">
      <span class="vvp-chip vvp-chip--mono">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       CLIENT ID VV-CL-48210
      </span>
      [+2 more sibling <span> elements with the SAME structure as the one above; their text content in order: Enterprise Client || Subscription Active]
     </div>
    </div>
    <div class="vvp-identity-stats" aria-label="Account summary">
     <div>
      <div class="vvp-stat-label">Engagements</div>
      <div class="vvp-stat-value">07</div>
     </div>
     <div>
      <div class="vvp-stat-label">Open Findings</div>
      <div class="vvp-stat-value">12</div>
     </div>
     <div>
      <div class="vvp-stat-label">Next Assessment</div>
      <div class="vvp-stat-value">14d</div>
     </div>
    </div>
   </div>
   <div class="vvp-tiles">
    <a href="/portal/academy" class="vvp-tile">
     <span class="vvp-tile-icon">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
     </span>
     <span class="vvp-tile-title">Academy Progress</span>
     <span class="vvp-tile-text">Track your learning tracks and certificates.</span>
    </a>
    [+3 more sibling <a> elements with the SAME structure as the one above; their text content in order: Free Vulnerability Scanner ¦ Run a live reconnaissance sweep on your perimeter. || Billing & Invoices ¦ Review statements, plans and payment history. || Password Manager ¦ Audit credentials and vault hygiene.]
   </div>
   <form id="vvp-profile-form">
    <div class="vvp-card">
     <div class="vvp-card-head">
      <span class="vvp-card-icon" aria-hidden="true">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
      </span>
      <div>
       <h2 class="vvp-card-title">Personal Details</h2>
       <p class="vvp-card-sub">Used for engagement correspondence, report delivery and emergency contact.</p>
      </div>
     </div>
     <div class="vvp-grid">
      <div class="vvp-field">
       <label for="pf-fullname">Full Name</label>
       <input id="pf-fullname" name="fullName" class="vvp-input" type="text" value="Jane Wanjiru" autocomplete="name"/>
      </div>
      [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Role / Title || Work Email || Phone Number]
     </div>
     <div class="vvp-actions">
      <p class="vvp-actions-meta" id="vvp-personal-meta">Saves your name, role and contact details, then refreshes your profile header.</p>
      <div class="vvp-actions-buttons">
       <button type="button" class="vvp-btn vvp-btn--primary" id="vvp-save-personal-btn">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
        <span>Save Personal Details</span>
       </button>
      </div>
     </div>
    </div>
    !-- ---------------- company details ---------------- -->
    <div class="vvp-card">
     <div class="vvp-card-head">
      <span class="vvp-card-icon" aria-hidden="true">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
      </span>
      <div>
       <h2 class="vvp-card-title">Company Details</h2>
       <p class="vvp-card-sub">Defines the authorised scope boundary for all VUNVAULT testing activity.</p>
      </div>
     </div>
     <div class="vvp-grid">
      <div class="vvp-field">
       <label for="pf-company">Organization / Company Name</label>
       <input id="pf-company" name="company" class="vvp-input" type="text" value="Acme Fintech Ltd" autocomplete="organization"/>
      </div>
      <div class="vvp-field">
       <label for="pf-domain">Primary Target Domain / URL</label>
       <input id="pf-domain" name="domain" class="vvp-input" type="text" value="https://app.acmefintech.co.ke" autocomplete="off"/>
       <span class="vvp-hint">Only assets you own or are authorised to test.</span>
      </div>
      <div class="vvp-field vvp-col-span-2">
       <label for="pf-industry">Industry</label>
       <select id="pf-industry" name="industry" class="vvp-select">
        <option>Financial Services / Fintech</option>
        <option>SACCO / Microfinance</option>
        <option>Banking</option>
        <option>Insurance</option>
        <option>Healthcare</option>
        <option>Telecommunications</option>
        <option>Government / Public Sector</option>
        <option>Education</option>
        <option>Retail & E-Commerce</option>
        <option>Technology / SaaS</option>
        <option>Other</option>
       </select>
      </div>
     </div>
     <div class="vvp-actions">
      <p class="vvp-actions-meta">
       Last updated
       <span id="vvp-last-updated">18 Aug 2026, 09:14 UTC</span>
      </p>
      <div class="vvp-actions-buttons">
       <button type="reset" class="vvp-btn vvp-btn--ghost" id="vvp-reset-btn">Discard Changes</button>
       <button type="submit" class="vvp-btn vvp-btn--primary" id="vvp-save-btn">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
        <span>Save Profile Settings</span>
       </button>
      </div>
     </div>
    </div>
   </form>
  </div>
 </section>
</main>
```
Custom CSS for this markup (reference):
```css
.vvp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 9px; padding: 13px 24px; font-size: 0.8rem; font-weight: 800; letter-spacing: 0.01em; border-radius: var(--r-full); border: 1px solid transparent; cursor: pointer; white-space: nowrap; text-decoration: none; transition: transform 0.22s var(--ease), filter 0.22s var(--ease), box-shadow 0.22s var(--ease), background-color 0.22s var(--ease), border-color 0.22s var(--ease), color 0.22s var(--ease); }
.vvp-btn svg { transition: transform 0.22s var(--ease); }
.vvp-btn:hover svg { transform: translateX(3px); }
.vvp-btn:active { transform: translateY(0) scale(0.98); }
.vvp-btn--primary { color: #04121f; background: linear-gradient(135deg, var(--brand-soft), var(--brand)); border-color: rgba(59, 153, 252, 0.45); box-shadow: 0 16px 34px -16px var(--brand-glow); }
.vvp-btn--primary:hover { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 22px 46px -18px var(--brand-glow); }
.vvp-btn--ghost { color: var(--ink-soft); background: #ffffff; border-color: var(--line); }
.vvp-btn--ghost:hover { color: var(--ink); border-color: var(--brand-line); background: var(--brand-tint); transform: translateY(-1px); }
.vvp-btn[disabled] { opacity: 0.55; cursor: not-allowed; transform: none; filter: none; }
.vvp-card { position: relative; padding: 28px 30px; border-radius: var(--r-2xl); background: rgba(255, 255, 255, 0.78); backdrop-filter: blur(14px) saturate(1.4); -webkit-backdrop-filter: blur(14px) saturate(1.4); border: 1px solid rgba(59, 153, 252, 0.14); box-shadow: 0 8px 32px rgba(10, 13, 18, 0.06); transition: border-color 0.28s var(--ease), box-shadow 0.28s var(--ease); }
.vvp-card:hover { border-color: var(--brand-line); box-shadow: 0 22px 50px -36px rgba(10, 13, 18, 0.45); }
.vvp-card-head { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid var(--line-soft); }
.vvp-card-icon { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 14px; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); }
.vvp-card-title { font-size: 1.05rem; font-weight: 800; letter-spacing: -0.01em; color: var(--ink); line-height: 1.35; }
.vvp-card-sub { margin-top: 4px; font-size: 0.78rem; line-height: 1.6; color: var(--ink-muted); }
.vvp-identity { position: relative; overflow: hidden; display: flex; flex-wrap: wrap; align-items: center; gap: 26px; padding: 30px 32px; border-radius: var(--r-2xl); color: #ffffff; background: radial-gradient(90% 130% at 100% 0%, rgba(59, 153, 252, 0.30), transparent 60%), linear-gradient(135deg, var(--dark) 0%, #060a10 100%); border: 1px solid rgba(59, 153, 252, 0.32); box-shadow: 0 30px 60px -34px rgba(0, 0, 0, 0.6); }
.vvp-identity-glow { position: absolute; top: -45%; right: -8%; width: 46%; height: 190%; background: radial-gradient(closest-side, var(--brand-glow), transparent 72%); filter: blur(70px); opacity: 0.5; pointer-events: none; }
.vvp-avatar { position: relative; z-index: 1; flex: 0 0 auto; display: grid; place-items: center; width: 88px; height: 88px; border-radius: 50%; font-size: 1.85rem; font-weight: 800; letter-spacing: 0.02em; color: #ffffff; background: linear-gradient(135deg, var(--brand), var(--brand-strong)); border: 1px solid rgba(255, 255, 255, 0.2); box-shadow: 0 0 0 6px rgba(59, 153, 252, 0.12), 0 22px 44px -22px var(--brand-glow); }
.vvp-identity-body { position: relative; z-index: 1; flex: 1 1 320px; min-width: 0; }
.vvp-identity-name { font-size: clamp(1.35rem, 3vw, 1.85rem); font-weight: 800; letter-spacing: -0.02em; line-height: 1.2; color: #ffffff; }
.vvp-identity-company { margin-top: 6px; font-size: 0.86rem; font-weight: 600; color: #9aa8ba; }
.vvp-chip-row { display: flex; flex-wrap: wrap; align-items: center; gap: 9px; margin-top: 16px; }
.vvp-chip { display: inline-flex; align-items: center; gap: 7px; padding: 6px 13px; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.06em; border-radius: var(--r-full); white-space: nowrap; color: #8d9aab; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); }
.vvp-chip--mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; letter-spacing: 0.04em; color: var(--brand-soft); background: rgba(59, 153, 252, 0.12); border-color: rgba(59, 153, 252, 0.35); }
.vvp-identity-stats { position: relative; z-index: 1; flex: 0 0 auto; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; padding-left: 26px; border-left: 1px solid rgba(255, 255, 255, 0.1); }
.vvp-stat-label { font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #7d8b9e; white-space: nowrap; }
.vvp-stat-value { margin-top: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 1.3rem; font-weight: 800; letter-spacing: -0.02em; color: var(--brand); text-shadow: 0 0 22px var(--brand-glow); line-height: 1; }
.vvp-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.vvp-col-span-2 { grid-column: span 2; }
.vvp-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.vvp-field > label { font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-muted); }
.vvp-input,
    .vvp-select,
    .vvp-textarea { width: 100%; padding: 12px 14px; font-size: 0.84rem; font-family: inherit; color: var(--ink); background: #ffffff; border: 1px solid var(--line); border-radius: var(--r-md); outline: none; transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease), background-color var(--dur) var(--ease); }
.vvp-input::placeholder,
    .vvp-textarea::placeholder { color: var(--ink-faint); }
.vvp-input:hover,
    .vvp-select:hover,
    .vvp-textarea:hover { border-color: #d4d4d4; }
.vvp-input:focus,
    .vvp-select:focus,
    .vvp-textarea:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-tint); }
.vvp-input.is-invalid,
    .vvp-select.is-invalid,
    .vvp-textarea.is-invalid { border-color: var(--critical); box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.16); }
.vvp-select { appearance: none; -webkit-appearance: none; background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%233B99FC' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 38px; cursor: pointer; }
.vvp-hint { font-size: 0.7rem; line-height: 1.5; color: var(--ink-faint); }
.vvp-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; margin-top: 26px; padding-top: 22px; border-top: 1px solid var(--line-soft); }
.vvp-actions-meta { font-size: 0.72rem; color: var(--ink-faint); line-height: 1.5; }
.vvp-actions-buttons { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.vvp-tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.vvp-tile { display: flex; flex-direction: column; gap: 12px; padding: 20px 20px 22px; border-radius: var(--r-xl); background: #ffffff; border: 1px solid var(--line); text-decoration: none; transition: transform 0.25s var(--ease), border-color 0.25s var(--ease), box-shadow 0.25s var(--ease); }
.vvp-tile:hover,
    .vvp-tile:focus-visible { transform: translateY(-3px); border-color: var(--brand-line); box-shadow: 0 22px 46px -34px rgba(10, 13, 18, 0.45); outline: none; }
.vvp-tile-icon { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 12px; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); }
.vvp-tile-title { font-size: 0.86rem; font-weight: 800; letter-spacing: -0.005em; color: var(--ink); transition: color 0.25s var(--ease); }
.vvp-tile:hover .vvp-tile-title { color: var(--brand-strong); }
.vvp-tile-text { font-size: 0.74rem; line-height: 1.6; color: var(--ink-muted); }
@media (max-width: 1024px) {
.vvp-identity-stats { flex: 1 1 100%; padding-left: 0; padding-top: 22px; border-left: 0; border-top: 1px solid rgba(255, 255, 255, 0.1); }
.vvp-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 768px) {
.vvp-identity { padding: 24px 22px; gap: 20px; }
.vvp-avatar { width: 74px; height: 74px; font-size: 1.5rem; }
.vvp-card { padding: 22px 20px; }
.vvp-actions { flex-direction: column; align-items: stretch; }
.vvp-actions-buttons { width: 100%; }
.vvp-actions-buttons .vvp-btn { flex: 1 1 auto; }
.vvp-modal-actions .vvp-btn { width: 100%; }
}
@media (max-width: 640px) {
.vvp-grid { grid-template-columns: 1fr; }
.vvp-col-span-2 { grid-column: auto; }
.vvp-tiles { grid-template-columns: 1fr; }
.vvp-identity-stats { grid-t
/* …truncated by planner; remaining rules follow the same patterns… */
```

Verbatim strings found in the prototype's script (toast titles/messages, status and validation text — use exactly these where the matching event occurs; the surrounding logic is replaced by API calls):
- `use strict`
- `Last updated`
- `— VUNVAULT Client Profile`
- `Please complete name, role and email`
- `Personal details saved`
- `Could not save — storage unavailable`
**Behaviour (replaces the prototype's local storage persistence):** load `GET /api/v1/profile` (`ClientProfile`); the hero shows initials avatar, full name, `jobTitle`, company, `Client ID` = `clientCode` (`VV-CL-48210`), the plan chip (`plan.name` + status) and the three stats (`engagements`, `openFindings`, `nextAssessmentInDays` formatted `<n> days`, or `—` when null). Form fields (RHF + Zod `UpdateProfileBody`): `Full Name`, `Job Title`, `Email` (read-only, `aria-readonly`), `Phone`, `Company Name`, `Primary Domain` (accepts `https://example.co.ke` or `example.co.ke`; the API normalises), `Industry` (select with the 11 `INDUSTRY_LABELS`, first option `Select industry…`). Validation message verbatim: `Please complete name, role and email` is split into per-field messages: `Please enter your full name.`, `Please enter your job title.`. Save → `PATCH /api/v1/profile`; success toast title `Personal details saved` (message `Your profile has been updated.`) and the footer line `Last saved just now` (drop `· stored locally on this device` — it is no longer true); failure toast `{ kind: "crit", title: "Could not save", message: "Please try again." }`. Dirty-state guard: `Save` disabled until the form is dirty; `beforeunload` warning while dirty (`useEffect`, remove on save).

**Tests:** header shows `VV-CL-48210` and the stats from MSW; read-only email; PATCH body shape; success toast; the dirty guard disables Save; a 400 maps `details` to fields.

---

**Data shape (TypeScript):**
```ts
// ClientProfile, UpdateProfileBody: see contracts (Task 19).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/profile → 200 { data: ClientProfile } | 403 no_org
// PATCH /api/v1/profile body UpdateProfileBody → 200 { data: ClientProfile } | 400 validation_failed
```

---

**Out of scope:**
- Do not use browser storage.
- Do not add avatar upload for clients.
- Do not implement password or MFA controls here.

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
☐ Report at the end: `Task 68 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---


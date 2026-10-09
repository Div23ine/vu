### TASK 79b — Admin User & Access Management B: invitations panel and role/permission matrix

**Layer:** L9

**Prerequisites:** Task 31, Task 79

**Estimated files touched:** 6

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Admin User & Access Management B: invitations panel and role/permission matrix**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the invitations panel and the role/permission matrix, replacing the Task 79 stubs.

**Deliverables:**
- `apps/web/src/app/(authed)/admin/users/_components/invitations-panel.tsx`, `role-matrix.tsx` — overwrite the stubs.
- MODIFY `apps/web/src/app/(authed)/admin/users/_styles/users.css` — append.
- `apps/web/src/app/(authed)/admin/users/users-b.test.tsx`

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

##### Invitations column
```html
<aside class="um-col" aria-label="Team provisioning controls">
 <section class="adm-card adm-card--dark">
  <div class="adm-card-head">
   <div>
    <h2 class="adm-card-title">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Provisioning Controls
    </h2>
    <p class="adm-card-note">Review the invitation summary and issue scoped access. All provisioning events are audited.</p>
   </div>
  </div>
  <div class="adm-card-body um-panel">
   <div class="um-panel-section">
    <span class="um-panel-title">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Invitation Summary
    </span>
    <div class="um-status-row">
     <span>Invitee</span>
     <strong id="um-summary-name">Not set</strong>
    </div>
    <div class="um-status-row">
     <span>Email</span>
     <strong id="um-summary-email">Not set</strong>
    </div>
    <div class="um-status-row">
     <span>Role</span>
     <strong id="um-summary-role">Security Analyst</strong>
    </div>
    <div class="um-status-row">
     <span>Team</span>
     <strong id="um-summary-team">Offensive Security</strong>
    </div>
    <div class="um-status-row">
     <span>Access tier</span>
     <strong id="um-summary-tier">Standard</strong>
    </div>
    <div class="um-status-row">
     <span>Checklist</span>
     <strong id="um-summary-checks">1 / 4</strong>
    </div>
   </div>
   <div class="um-panel-section">
    <span class="um-panel-title">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Actions
    </span>
    <div class="um-actions-stack">
     <button type="button" class="adm-btn adm-btn-ghost" id="um-save-draft">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      <span>Save Draft</span>
     </button>
     <button type="button" class="adm-btn adm-btn-dark" id="um-open-matrix">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      <span>Preview Permission Matrix</span>
     </button>
     <button type="button" class="adm-btn adm-btn-primary" id="um-send-invite">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      <span>Send Secure Invitation</span>
     </button>
    </div>
    <p class="um-action-note">Invitations expire after 72 hours if MFA enrolment is not completed.</p>
   </div>
  </div>
 </section>
 <section class="adm-card adm-card--dark" aria-labelledby="um-dist-heading">
  <div class="adm-card-head">
   <div>
    <h2 class="adm-card-title" id="um-dist-heading">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Role Distribution
    </h2>
    <p class="adm-card-note">Active accounts per role across the platform.</p>
   </div>
   <span class="adm-tag">24 Active</span>
  </div>
  <div class="adm-card-body">
   <div class="um-dist">
    <div class="um-dist-row">
     <span class="um-dist-name">Security Analyst</span>
     <progress class="um-progress" value="11">11</progress>
     <span class="um-dist-count">11</span>
    </div>
    [+5 more sibling <div> elements with the SAME structure as the one above; their text content in order: SOC Operator ¦ 7 ¦ 7 || Administrator ¦ 3 ¦ 3 || Compliance Auditor ¦ 2 ¦ 2 || Support Engineer ¦ 1 ¦ 1 || Super Admin ¦ 1 ¦ 1]
   </div>
  </div>
 </section>
 <section class="adm-card" aria-labelledby="um-invites-heading">
  <div class="adm-card-head">
   <div>
    <h2 class="adm-card-title" id="um-invites-heading">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Pending Invitations
    </h2>
    <p class="adm-card-note">Awaiting acceptance and MFA enrolment.</p>
   </div>
   <span class="adm-tag adm-tag--warn">4</span>
  </div>
  <div class="adm-card-body">
   <div class="um-invites">
    <article class="um-invite">
     <div class="um-invite-top">
      <span class="um-invite-email">a.mohamed@vunvault.com</span>
      <span class="um-role um-role--analyst">Analyst</span>
     </div>
     <div class="um-invite-meta">
      <span>Invited 22 Sep 2026</span>
      <span>Expires in 18 h</span>
     </div>
     <div class="um-invite-actions">
      <button type="button" class="um-mini-act">Resend</button>
      <button type="button" class="um-mini-act um-mini-act--danger">Revoke</button>
     </div>
    </article>
    [+2 more sibling <article> elements with the SAME structure as the one above; their text content in order: j.kariuki@vunvault.com ¦ Operator ¦ Invited 23 Sep 2026 ¦ Expires in 41 h ¦ Resend ¦ Revoke || m.ochieng@vunvault.com ¦ Auditor ¦ Invited 23 Sep 2026 ¦ Expires in 55 h ¦ Resend ¦ Revoke]
   </div>
   <div>
    <button type="button" class="adm-mini-btn" id="um-view-all-invites">View all 4 invitations</button>
   </div>
  </div>
 </section>
 <section class="adm-card adm-card--dark" aria-labelledby="um-activity-heading">
  <div class="adm-card-head">
   <div>
    <h2 class="adm-card-title" id="um-activity-heading">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Recent Access Activity
    </h2>
    <p class="adm-card-note">Last six identity and permission events.</p>
   </div>
   <span class="adm-tag">Live</span>
  </div>
  <div class="adm-card-body">
   <div class="um-activity">
    <div class="um-activity-item">
     <span class="um-activity-dot um-activity-dot--ok"></span>
     <span class="um-activity-body">
      <span class="um-activity-text">
       <strong>a.njoroge</strong>
       signed in with hardware-key MFA.
      </span>
      <span class="um-activity-time">Today · 09:12 UTC</span>
     </span>
    </div>
    [+5 more sibling <div> elements with the SAME structure as the one above; their text content in order: k.kimani ¦ failed MFA enrolment challenge — third attempt. ¦ Today · 08:04 UTC || Role changed: ¦ d.mwangi ¦ elevated to Security Analyst — Automation. ¦ Today · 07:41 UTC || Account ¦ p.ndegwa ¦ suspended and all session tokens revoked. ¦ 12 Sep · 08:10 UTC || f.hassan ¦ completed quarterly access review attestation. ¦ 11 Sep · 15:26 UTC || Invitation issued to ¦ a.mohamed@vunvault.com ¦ — Security Analyst. ¦ 22 Sep · 11:02 UTC]
   </div>
  </div>
 </section>
</aside>
```
Custom CSS for this markup (reference):
```css
.adm-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; filter: none !important; box-shadow: none !important; }
.adm-card { display: flex; flex-direction: column; border-radius: 18px; background: #ffffff; border: 1px solid var(--line); box-shadow: 0 18px 44px -38px rgba(10, 13, 18, 0.55); overflow: hidden; }
.adm-card-note { margin-top: 5px; font-size: 0.74rem; line-height: 1.6; color: var(--ink-muted); max-width: 68ch; }
.um-col { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.um-role { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; border-radius: var(--r-full); white-space: nowrap; border: 1px solid transparent; }
.um-role::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.um-role--analyst { color: var(--brand-strong); background: var(--brand-tint); border-color: var(--brand-line); }
.um-panel { display: flex; flex-direction: column; gap: 16px; }
.um-panel-section { display: flex; flex-direction: column; gap: 12px; }
.um-panel-section + .um-panel-section { padding-top: 16px; border-top: 1px solid var(--line-soft); }
.adm-card--dark .um-panel-section + .um-panel-section { border-top-color: rgba(255, 255, 255, 0.08); }
.um-panel-title { display: flex; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-faint); }
.adm-card--dark .um-panel-title { color: #7d8b9e; }
.um-panel-title svg { color: var(--brand); flex: 0 0 auto; }
.um-status-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 0.74rem; font-weight: 600; color: var(--ink-soft); }
.adm-card--dark .um-status-row { color: #93a2b5; }
.um-status-row strong { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.74rem; font-weight: 800; color: var(--ink); }
.adm-card--dark .um-status-row strong { color: #ffffff; }
.um-actions-stack { display: flex; flex-direction: column; gap: 10px; }
.um-actions-stack .adm-btn { width: 100%; }
.um-action-note { font-size: 10px; line-height: 1.6; color: var(--ink-faint); text-align: center; }
.adm-card--dark .um-action-note { color: #64748b; }
.um-dist { display: flex; flex-direction: column; gap: 10px; }
.um-dist-row { display: grid; grid-template-columns: minmax(96px, 1.2fr) minmax(60px, 2.6fr) auto; align-items: center; gap: 10px; }
.um-dist-name { font-size: 0.72rem; font-weight: 700; color: var(--ink); }
.adm-card--dark .um-dist-name { color: #e2e8f0; }
.um-dist-count { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; font-weight: 800; color: var(--brand-soft); min-width: 28px; text-align: right; }
progress.um-progress { appearance: none; -webkit-appearance: none; width: 100%; height: 7px; border: 0; border-radius: var(--r-full); overflow: hidden; background: rgba(255, 255, 255, 0.09); display: block; }
progress.um-progress::-webkit-progress-bar { background: rgba(255, 255, 255, 0.09); border-radius: var(--r-full); }
progress.um-progress::-webkit-progress-value { border-radius: var(--r-full); background: linear-gradient(90deg, var(--brand-strong), var(--brand-soft)); }
progress.um-progress::-moz-progress-bar { border-radius: var(--r-full); background: linear-gradient(90deg, var(--brand-strong), var(--brand-soft)); }
.um-activity { display: flex; flex-direction: column; gap: 12px; }
.um-activity-item { display: flex; align-items: flex-start; gap: 11px; padding-bottom: 12px; border-bottom: 1px dashed rgba(255, 255, 255, 0.08); }
.um-activity-item:last-child { border-bottom: 0; padding-bottom: 0; }
.um-activity-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex: 0 0 auto; background: var(--brand); box-shadow: 0 0 10px -2px var(--brand-glow); }
.um-activity-dot--ok { background: var(--ok); box-shadow: 0 0 10px -2px rgba(16, 185, 129, 0.9); }
.um-activity-body { min-width: 0; }
.um-activity-text { display: block; font-size: 0.72rem; line-height: 1.6; color: #cbd5e1; }
.um-activity-text strong { color: #ffffff; }
.um-activity-time { display: block; margin-top: 3px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 9.5px; color: #64748b; }
.um-invites { display: flex; flex-direction: column; gap: 10px; }
.um-invite { display: flex; flex-direction: column; gap: 6px; padding: 13px 14px; border-radius: 12px; background: #f8fafc; border: 1px solid var(--line-soft); transition: all 0.2s var(--ease); }
.um-invite:hover { transform: translateY(-2px); border-color: var(--brand-line); box-shadow: 0 14px 30px -22px var(--brand-glow); }
.um-invite-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.um-invite-email { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.72rem; font-weight: 80
/* …truncated by planner; remaining rules follow the same patterns… */
```

##### Role & permission matrix (+ intro card)
```html
<section class="adm-card" aria-labelledby="um-matrix-heading" id="um-matrix-anchor">
 <div class="adm-card-head">
  <div>
   <h2 class="adm-card-title" id="um-matrix-heading">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    Role Permission Matrix
   </h2>
   <p class="adm-card-note">Toggle capability grants per role. Changes apply to every member holding that role after saving. Super Administrator permissions are immutable.</p>
  </div>
  <span class="adm-tag adm-tag--crit">Privileged Action</span>
 </div>
 <div class="adm-table-wrap">
  <table class="um-perm-matrix">
   <caption class="sr-only">Capability grants per role</caption>
   <thead>
    <tr>
     <th>Capability</th>
     <th>Super Admin</th>
     <th>Admin</th>
     <th>Analyst</th>
     <th>Operator</th>
     <th>Auditor</th>
     <th>Support</th>
    </tr>
   </thead>
   <tbody>
    <tr>
     <td class="um-perm-cat">Scan Operations</td>
    </tr>
    <tr>
     <td>Initiate system scan</td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Super Admin can initiate system scan"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Admin can initiate system scan"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Analyst can initiate system scan"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Operator can initiate system scan"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Auditor cannot initiate system scan"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Support cannot initiate system scan"/>
     </td>
    </tr>
    <tr>
     <td>Manage scan queue</td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Super Admin can manage scan queue"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Admin can manage scan queue"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Analyst can manage scan queue"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Operator can manage scan queue"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Auditor cannot manage scan queue"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Support cannot manage scan queue"/>
     </td>
    </tr>
    <tr>
     <td>Pause all workers</td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Super Admin can pause workers"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Admin can pause workers"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Analyst cannot pause workers"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Operator can pause workers"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Auditor cannot pause workers"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Support cannot pause workers"/>
     </td>
    </tr>
    <tr>
     <td class="um-perm-cat">Review & Release</td>
    </tr>
    <tr>
     <td>Clear review gate</td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Super Admin can clear review gate"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Admin can clear review gate"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Analyst cannot clear review gate"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Operator cannot clear review gate"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Auditor cannot clear review gate"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Support cannot clear review gate"/>
     </td>
    </tr>
    <tr>
     <td>Release report to client</td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Super Admin can release report"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Admin can release report"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Analyst cannot release report"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Operator cannot release report"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Auditor cannot release report"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Support cannot release report"/>
     </td>
    </tr>
    <tr>
     <td>Revoke released report</td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Super Admin can revoke report"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Admin can revoke report"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Analyst cannot revoke report"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Operator cannot revoke report"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Auditor cannot revoke report"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Support cannot revoke report"/>
     </td>
    </tr>
    <tr>
     <td class="um-perm-cat">Zero-Day Advisory</td>
    </tr>
    <tr>
     <td>Draft advisory</td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Super Admin can draft advisory"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Admin can draft advisory"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Analyst can draft advisory"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Operator cannot draft advisory"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Auditor cannot draft advisory"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Support cannot draft advisory"/>
     </td>
    </tr>
    <tr>
     <td>Emergency broadcast</td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Super Admin can broadcast"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Admin can broadcast"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Analyst cannot broadcast"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Operator cannot broadcast"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Auditor cannot broadcast"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Support cannot broadcast"/>
     </td>
    </tr>
    <tr>
     <td class="um-perm-cat">Identity & Administration</td>
    </tr>
    <tr>
     <td>Provision new members</td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Super Admin can provision"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Admin can provision"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Analyst cannot provision"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Operator cannot provision"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Auditor cannot provision"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Support cannot provision"/>
     </td>
    </tr>
    <tr>
     <td>Edit role permissions</td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Super Admin can edit permissions"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Admin can edit permissions"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Analyst cannot edit permissions"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Operator cannot edit permissions"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Auditor cannot edit permissions"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Support cannot edit permissions"/>
     </td>
    </tr>
    <tr>
     <td>Read audit logs</td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Super Admin can read audit logs"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Admin can read audit logs"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Analyst can read audit logs"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Operator can read audit logs"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Auditor can read audit logs"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Support cannot read audit logs"/>
     </td>
    </tr>
    <tr>
     <td class="um-perm-cat">Client Data</td>
    </tr>
    <tr>
     <td>View client assets</td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Super Admin can view client assets"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Admin can view client assets"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Analyst can view client assets"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Operator can view client assets"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Auditor can view client assets"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Support can view client assets"/>
     </td>
    </tr>
    <tr>
     <td>Export client evidence</td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Super Admin can export evidence"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Admin can export evidence"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Analyst can export evidence"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Operator cannot export evidence"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" aria-label="Auditor can export evidence"/>
     </td>
     <td>
      <input type="checkbox" class="um-check" disabled aria-label="Support cannot export evidence"/>
     </td>
    </tr>
   </tbody>
   <tfoot>
    <tr>
     <td>Super Administrator capabilities are locked and cannot be modified. All other changes are audited.</td>
    </tr>
   </tfoot>
  </table>
 </div>
 <div class="adm-card-body">
  <span class="um-hint">Changes to the permission matrix apply globally to every member holding the affected role.</span>
  <div>
   <button type="button" class="adm-mini-btn" id="um-matrix-reset">Discard Changes</button>
   <button type="button" class="adm-btn adm-btn-primary" id="um-matrix-save">Save Permission Matrix</button>
  </div>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
.um-hint { font-size: 10px; font-weight: 600; letter-spacing: 0; text-transform: none; color: var(--ink-faint); }
.um-perm-matrix { width: 100%; border-collapse: collapse; font-size: 0.74rem; }
.um-perm-matrix thead th { padding: 10px 12px; text-align: center; font-size: 9px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-muted); background: #f6f8fb; border-bottom: 1px solid var(--line); white-space: nowrap; }
.um-perm-matrix thead th:first-child { text-align: left; min-width: 190px; }
.um-perm-matrix tbody td { padding: 10px 12px; text-align: center; border-bottom: 1px solid var(--line-soft); }
.um-perm-matrix tbody td:first-child { text-align: left; font-weight: 700; color: var(--ink); }
.um-perm-matrix tbody tr:hover { background: var(--brand-tint); }
.um-perm-cat { background: #fbfcfd !important; font-size: 9px !important; font-weight: 800 !important; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint) !important; }
.um-perm-matrix .sq-check,
      .um-perm-matrix .um-check { appearance: none; -webkit-appearance: none; width: 17px; height: 17px; border-radius: 5px; border: 1.5px solid var(--line); background: #ffffff; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: all 0.18s var(--ease); vertical-align: middle; }
.um-perm-matrix .um-check:hover { border-color: var(--brand-line); }
.um-perm-matrix .um-check:checked { background: linear-gradient(135deg, var(--brand), var(--brand-strong)); border-color: transparent; }
.um-perm-matrix .um-check:checked::after { content: ""; width: 5px; height: 9px; border: solid #ffffff; border-width: 0 2px 2px 0; transform: rotate(45deg) translate(-1px, -1px); }
.um-perm-matrix .um-check:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--brand-tint); }
.um-perm-matrix .um-check:disabled { opacity: 0.4; cursor: not-allowed; background: #f4f4f5; }
@media (prefers-reduced-motion: reduce) {
.adm-kpi, .adm-btn, .um-act, .um-icon-btn, .um-invite, .um-toast,
        .um-modal, .um-modal-window, .adm-hamburger-bar,
        .um-input, .um-select, .um-textarea { transition-duration: 0.001ms !important; animation-duration: 0.001ms !important; transform: none !important; }
}
```

**Invitations panel:** pending invitations come from `GET /admin/users?status=pending_invite` (name, email, role label, `expires <relative>`); buttons `Resend` (`POST …/invitations/:id/resend`; toast `Invitation resent` / `<email> — secure invitation email re-dispatched.`), `Revoke` (`DELETE …/invitations/:id`; toast `Invitation revoked` / `<email> — pending invitation invalidated.`), link `All invitations` (informational toast `Opening the full invitation workspace — <n> pending.`). Both actions need `users:manage`; `409 resend_limit` → toast `Resend limit reached. Revoke and invite again.` (planner).
**Role matrix:** a table generated from `ROLE_PERMISSIONS` / `ROLE_LABELS` / `ROLE_DESCRIPTIONS` / `PERMISSIONS` (rows = capabilities, columns = roles, ✓ cells) — NOT hard-coded; keep the markup's column order and headings; the intro copy is verbatim.

**Tests:** panel lists pending invitations and calls the right endpoints; matrix derives from contracts (change a permission in a test double and see the cell change).

---

**Data shape (TypeScript):**
```ts
// Invitation: see contracts (Task 19).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/admin/users/invitations/:id/resend → 200 { data: Invitation } | 409 resend_limit · DELETE …/invitations/:id → 204
```

---

**Out of scope:**
- Do not hard-code permission cells.
- Do not edit roster components.

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
☐ Report at the end: `Task 79b complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---


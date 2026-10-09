### TASK 79 — Admin User & Access Management A: summary, filters, roster, row actions

**Layer:** L9

**Prerequisites:** Task 31, Task 46, Task 75, Task 12

**Estimated files touched:** 12

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Admin User & Access Management A: summary, filters, roster, row actions**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build `/admin/users`: staff summary tiles, the searchable/filterable roster with MFA and status chips, and per-row suspend/reactivate/enforce-MFA/role/delete actions.

**Deliverables:**
- `apps/web/src/app/(authed)/admin/users/page.tsx` — route; also renders `<InvitationsPanel/>` and `<RoleMatrix/>` (null stubs created here; Task 79b overwrites).
- `apps/web/src/app/(authed)/admin/users/_components/users-summary.tsx`, `users-toolbar.tsx`, `roster-table.tsx`, `row-actions.tsx`, `confirm-action-dialog.tsx`
- `apps/web/src/app/(authed)/admin/users/_components/invitations-panel.tsx`, `role-matrix.tsx` — null stubs.
- `apps/web/src/app/(authed)/admin/users/_hooks/use-users.ts`
- `apps/web/src/app/(authed)/admin/users/_styles/users.css`
- `apps/web/src/mocks/handlers/admin-users.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- `apps/web/src/app/(authed)/admin/users/users-a.test.tsx`

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

**Reference markup (the `Provision New Member` button/dialog is Task 80; the invitations aside and the role matrix are Task 79b):**

##### Page head and summary tiles
```html
<div class="adm-page-head">
 <div>
  <span class="adm-eyebrow">Identity, Access & Provisioning</span>
  <h1 class="adm-page-title">User & Access Management</h1>
  <p class="adm-page-sub">Maintain the active staff roster of security analysts and operators, review role assignments and provision new team members with least-privilege access.</p>
 </div>
 <div class="adm-head-actions">
  <button type="button" class="adm-btn adm-btn-primary" id="um-invite-btn">
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
   <span>Provision New Member</span>
  </button>
  <button type="button" class="adm-btn adm-btn-dark" id="um-export-roster">
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
   <span>Export Roster</span>
  </button>
  <button type="button" class="adm-btn adm-btn-ghost" id="um-review-access">
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
   <span>Quarterly Access Review</span>
  </button>
 </div>
</div>
```
Custom CSS for this markup (reference):
```css
.adm-page-sub { margin-top: 8px; max-width: 76ch; font-size: 0.85rem; line-height: 1.7; color: var(--ink-muted); }
.adm-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; filter: none !important; box-shadow: none !important; }
.um-actions-stack .adm-btn { width: 100%; }
@media (prefers-reduced-motion: reduce) {
.adm-kpi, .adm-btn, .um-act, .um-icon-btn, .um-invite, .um-toast,
        .um-modal, .um-modal-window, .adm-hamburger-bar,
        .um-input, .um-select, .um-textarea { transition-duration: 0.001ms !important; animation-duration: 0.001ms !important; transform: none !important; }
}
@media print {
.adm-hamburger, .adm-head-actions, .adm-nav, .um-toolbar,
        .um-actions, .um-modal, .um-toast-stack, .um-actions-stack { display: none !important; }
}
```

##### Summary tiles
```html
<section aria-labelledby="um-kpi-heading">
 <h2 id="um-kpi-heading" class="sr-only">Team and access indicators</h2>
 <div class="adm-kpi-grid">
  <article class="adm-kpi">
   <span class="adm-kpi-label">Active Team Members</span>
   <span class="adm-kpi-value">24</span>
   <span class="adm-kpi-delta adm-kpi-delta--up">▲ 3 onboarded this month</span>
  </article>
  [+5 more sibling <article> elements with the SAME structure as the one above; their text content in order: Security Analysts ¦ 11 ¦ ● Pentest & red team || Operators ¦ 7 ¦ ● SOC & scan operations || Pending Invitations ¦ 4 ¦ ● Awaiting acceptance || MFA Enrolment ¦ 92 ¦ % ¦ 2 accounts without MFA || Dormant Accounts ¦ 2 ¦ ▲ 60+ days inactive · review]
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
.adm-kpi-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 14px; margin-bottom: 26px; }
@media (prefers-reduced-motion: reduce) {
}
```

##### Roster column (toolbar + table)
```html
<div class="um-col">
 <section class="um-toolbar" aria-labelledby="um-filter-heading">
  <div class="um-toolbar-head">
   <h2 class="um-toolbar-title" id="um-filter-heading">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    Search & Filter Roster
   </h2>
   <span class="um-results" role="status" aria-live="polite">
    Showing
    <strong id="um-visible-count">10</strong>
    of
    <strong id="um-total-count">10</strong>
    members
   </span>
  </div>
  <div class="um-toolbar-grid">
   <div class="um-field">
    <label class="um-field-label" for="um-search">Search</label>
    <div class="um-input-wrap">
     <span class="um-input-icon" aria-hidden="true">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
     </span>
     <input id="um-search" class="um-input" type="search" placeholder="Name, email, team or scope…" autocomplete="off"/>
    </div>
   </div>
   [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Role ¦ All roles ¦ Super Administrator ¦ Administrator ¦ Security Analyst ¦ SOC Operator ¦ Compliance Auditor ¦ Support Engineer || Account Status ¦ All statuses ¦ Active ¦ Pending Invite ¦ Suspended ¦ Dormant || MFA ¦ MFA — any ¦ Enrolled ¦ Not enrolled]
   <div class="um-toolbar-actions">
    <button type="button" class="um-clear-btn" id="um-clear-filters">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     <span>Reset</span>
    </button>
   </div>
  </div>
 </section>
 <section class="adm-card" aria-labelledby="um-roster-heading">
  <div class="adm-card-head">
   <div>
    <h2 class="adm-card-title" id="um-roster-heading">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Active Staff Roster — Security Analysts & Operators
    </h2>
    <p class="adm-card-note">Every account with platform access, its assigned role, permitted scope and authentication posture.</p>
   </div>
   <span class="adm-tag adm-tag--ok">24 Active</span>
  </div>
  <div class="adm-table-wrap">
   <table class="adm-table um-table">
    <caption class="sr-only">Active staff roster of security analysts and operators with role, scope, MFA status and account state</caption>
    <thead>
     <tr>
      <th>Member</th>
      <th>Role</th>
      <th>Scope & Team</th>
      <th>MFA / Access</th>
      <th>Last Active</th>
      <th>Status</th>
      <th>Actions</th>
     </tr>
    </thead>
    <tbody id="um-tbody">
     <tr class="um-row">
      <td>
       <div class="um-identity">
        <span class="um-avatar" aria-hidden="true">ER</span>
        <span class="um-identity-body">
         <span class="um-name">Dr. Evelyn Reed</span>
         <span class="um-email">e.reed@vunvault.com</span>
         <span class="um-meta-line">Joined Mar 2024 · Nairobi HQ</span>
        </span>
       </div>
      </td>
      [+3 more sibling <td> elements with the SAME structure as the one above; their text content in order: Super Administrator || Full platform · All modules ¦ Incident commander · Final approval || MFA enrolled ¦ Hardware key]
      <td class="adm-mono">Now · 09:41</td>
      <td>
       <span class="adm-badge adm-badge--ok">Active</span>
      </td>
      <td>
       <div class="um-actions">
        <button type="button" class="um-act um-act--primary">Permissions</button>
        <button type="button" class="um-icon-btn" aria-label="Edit profile for Dr. Evelyn Reed">
         <svg data-icon="REPLACE-WITH-LUCIDE"/>
        </button>
        <button type="button" class="um-icon-btn" aria-label="Suspend account for Dr. Evelyn Reed">
         <svg data-icon="REPLACE-WITH-LUCIDE"/>
        </button>
       </div>
      </td>
     </tr>
     [+9 more sibling <tr> elements with the SAME structure as the one above; their text content in order: AN ¦ Amara Njoroge ¦ a.njoroge@vunvault.com ¦ Joined Jun 2024 · Nairobi HQ ¦ Administrator ¦ Offensive Security · Pentest queue ¦ Red team lead · Review authority ¦ MFA enrolled ¦ TOTP ¦ 12 min ago ¦ Active ¦ Permissions || DM ¦ Daniel Mwangi ¦ d.mwangi@vunvault.com ¦ Joined Aug 2024 · Nairobi HQ ¦ Security Analyst ¦ Security Automation · Scan queue ¦ Enumeration agents · Patch validation ¦ MFA enrolled ¦ TOTP ¦ 38 min ago ¦ Active ¦ Permissions || FH ¦ Fatima Hassan ¦ f.hassan@vunvault.com ¦ Joined Jan 2025 · Remote — Mombasa ¦ Security Analyst ¦ Threat Intelligence · Zero-Day desk ¦ CVE curation · Advisory drafting ¦ MFA enrolled ¦ TOTP ¦ 1 h ago ¦ Active ¦ Permissions || BO ¦ Brian Otieno ¦ b.otieno@vunvault.com ¦ Joined Feb 2025 · Nairobi HQ ¦ SOC Operator ¦ SOC · Detection & triage ¦ Shift lead · Alert queue ¦ MFA enrolled ¦ TOTP ¦ 5 min ago ¦ Active ¦ Permissions || GW ¦ Grace Wanjiru ¦ g.wanjiru@vunvault.com ¦ Joined Apr 2025 · Nairobi HQ ¦ Compliance Auditor ¦ Audit Logs · Compliance reporting ¦ Read-only · No scan execution ¦ MFA enrolled ¦ TOTP ¦ Yesterday · 17:22 ¦ Active ¦ Permissions || KK ¦ Kevin Kimani ¦ k.kimani@vunvault.com ¦ Joined Jul 2025 · Remote — Kisumu ¦ SOC Operator ¦ SOC · Night shift monitoring ¦ Alert triage · Escalation ¦ MFA not enrolled ¦ Enrolment required ¦ 2 h ago ¦ Active ¦ Permissions ¦ Enforce MFA || AM ¦ Aisha Mohamed ¦ a.mohamed@vunvault.com ¦ Invited 22 Sep 2026 · Not yet accepted ¦ Security Analyst ¦ Offensive Security · Pentest queue ¦ Onboarding in progress ¦ Awaiting enrolment ¦ — ¦ Pending Invite ¦ Resend Invite ¦ Revoke || PN ¦ Peter Ndegwa ¦ p.ndegwa@vunvault.com ¦ Suspended 12 Sep 2026 · Offboarding ¦ Support Engineer ¦ Client Support · Ticketing only ¦ No scan or dashboard access ¦ MFA enrolled ¦ Tokens revoked ¦ 12 Sep · 08:10 ¦ Suspended ¦ Reactivate ¦ Delete || LA ¦ Lucy Achieng ¦ l.achieng@vunvault.com ¦ Last login 68 days ago ¦ SOC Operator ¦ SOC · Detection & triage ¦ Dormant · Access review due ¦ MFA enrolled ¦ Review required ¦ 68 days ago ¦ Dormant ¦ Permissions ¦ Suspend]
    </tbody>
    <tfoot>
     <tr>
      <td>Role changes, suspensions and permission edits are written to the immutable audit log with your administrator identity.</td>
     </tr>
    </tfoot>
   </table>
  </div>
  <div class="um-empty" id="um-empty">
   <span class="um-empty-icon" aria-hidden="true">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </span>
   <span class="um-empty-title">No team members match the current filters</span>
   <span class="um-empty-text">Adjust your search terms or reset the filters to see the full staff roster.</span>
   <button type="button" class="adm-btn adm-btn-ghost" id="um-empty-reset">Reset Filters</button>
  </div>
 </section>
 <section class="adm-card" aria-labelledby="um-provision-heading" id="um-provision-anchor">
  <div class="adm-card-head">
   <div>
    <h2 class="adm-card-title" id="um-provision-heading">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Provision New Team Member
    </h2>
    <p class="adm-card-note">Issue a scoped invitation to a security analyst, operator or auditor. Permissions are applied only after the invitee completes MFA enrolment and accepts the invitation.</p>
   </div>
   <span class="adm-tag adm-tag--warn">Least Privilege Enforced</span>
  </div>
  <div class="adm-card-body">
   <form class="um-form" id="um-form">
    <fieldset class="um-fieldset">
     <legend class="um-legend">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      Identity
     </legend>
     <div class="um-row">
      <div class="um-field">
       <label class="um-label" for="um-fullname">
        <span>
         Full Name
         <span class="um-label-req" aria-hidden="true">*</span>
        </span>
       </label>
       <input id="um-fullname" class="um-input" type="text" name="fullname" placeholder="Aisha Mohamed" autocomplete="off" required/>
      </div>
      <div class="um-field">
       <label class="um-label" for="um-email">
        <span>
         Work Email
         <span class="um-label-req" aria-hidden="true">*</span>
        </span>
        <span class="um-hint">@vunvault.com domain</span>
       </label>
       <input id="um-email" class="um-input um-mono" type="email" name="email" placeholder="a.mohamed@vunvault.com" autocomplete="off" required/>
      </div>
     </div>
     <div class="um-row">
      <div class="um-field">
       <label class="um-label" for="um-title">
        <span>Job Title</span>
       </label>
       <input id="um-title" class="um-input" type="text" name="title" placeholder="Security Analyst — Offensive Security" autocomplete="off"/>
      </div>
      <div class="um-field">
       <label class="um-label" for="um-location">
        <span>Base / Location</span>
       </label>
       <input id="um-location" class="um-input" type="text" name="location" placeholder="Nairobi HQ / Remote — Kenya" autocomplete="off"/>
      </div>
     </div>
    </fieldset>
    [+3 more sibling <fieldset> elements with the SAME structure as the one above; their text content in order: Role Assignment ¦ Security Analyst ¦ Run scans, review findings and author advisories within an assigned scope. ¦ SOC Operator ¦ Monitor live feeds, triage alerts and escalate incidents. No client release authority. ¦ Compliance Auditor ¦ Read-only access to audit logs, reports and regulatory evidence. No execution rights. ¦ Administrator ¦ Full operational control including review-gate approval and client release. ¦ Support Engineer ¦ Client ticketing and triage only. No access to scan data or dashboards. ¦ Super Administrator ¦ Unrestricted platform control. Reserved for the security leadership team only. ¦ Roles are additive. Grant the minimum role required for the member's responsibilities. || Scope & Team ¦ Team / Unit ¦ Offensive Security ¦ SOC — Detection & Response ¦ Threat Intelligence ¦ Security Automation ¦ Compliance & Audit ¦ Client Support ¦ Access Tier ¦ Standard — assigned scope only ¦ Elevated — cross-client read ¦ Restricted — single client ¦ Access Review Due ¦ Scope Notes ¦ Visible to reviewers only || Security Requirements ¦ MFA enrolment mandatory ¦ Enforced for all roles. Invitation expires if not enrolled within 72 hours. ¦ Signed NDA and confidentiality agreement on file ¦ Required before any client scope is granted. ¦ Background verification completed ¦ Mandatory for roles with client data access. ¦ Security awareness training acknowledged ¦ VUNVAULT internal policy and incident reporting procedure.]
   </form>
  </div>
 </section>
</div>
```
Custom CSS for this markup (reference):
```css
.adm-card { display: flex; flex-direction: column; border-radius: 18px; background: #ffffff; border: 1px solid var(--line); box-shadow: 0 18px 44px -38px rgba(10, 13, 18, 0.55); overflow: hidden; }
.adm-card-note { margin-top: 5px; font-size: 0.74rem; line-height: 1.6; color: var(--ink-muted); max-width: 68ch; }
.adm-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
.adm-table tbody td { padding: 14px 16px; vertical-align: middle; color: var(--ink); border-bottom: 1px solid var(--line-soft); }
.um-col { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.um-toolbar { margin-bottom: 18px; padding: 20px 22px; border-radius: 18px; background: #ffffff; border: 1px solid var(--line); box-shadow: 0 16px 40px -36px rgba(10, 13, 18, 0.6); }
.um-toolbar-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.um-toolbar-title { display: flex; align-items: center; gap: 9px; font-size: 0.86rem; font-weight: 800; color: var(--ink); }
.um-toolbar-title svg { color: var(--brand); }
.um-results { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; font-weight: 700; color: var(--ink-muted); }
.um-results strong { color: var(--brand-strong); }
.um-toolbar-grid { display: grid; grid-template-columns: minmax(220px, 2.2fr) repeat(3, minmax(140px, 1fr)) auto; gap: 12px; align-items: end; }
@media (max-width: 1180px) {
.um-toolbar-grid { grid-template-columns: minmax(220px, 2fr) repeat(2, minmax(140px, 1fr)); }
}
@media (max-width: 720px) {
.um-toolbar-grid { grid-template-columns: 1fr; }
}
.um-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.um-field-label { font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); }
.um-input-wrap { position: relative; display: flex; align-items: center; }
.um-input-icon { position: absolute; left: 13px; color: var(--ink-faint); pointer-events: none; display: inline-flex; }
.um-input,
      .um-select { width: 100%; padding: 11px 14px; font-size: 0.8rem; color: var(--ink); background: #ffffff; border: 1px solid var(--line); border-radius: 12px; outline: none; transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
.um-input { padding-left: 38px; }
.um-input::placeholder { color: var(--ink-faint); }
.um-input:focus,
      .um-select:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-tint); }
.um-toolbar-actions { display: flex; gap: 8px; }
.um-clear-btn { display: inline-flex; align-items: center; gap: 7px; padding: 11px 18px; font-size: 0.76rem; font-weight: 800; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); border-radius: 12px; cursor: pointer; white-space: nowrap; transition: all var(--dur) var(--ease); }
.um-clear-btn:hover { background: var(--brand); border-color: var(--brand); color: #ffffff; }
.um-table { min-width: 1100px; }
.um-identity { display: flex; align-items: center; gap: 12px; min-width: 0; }
.um-avatar { width: 40px; height: 40px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; letter-spacing: 0.04em; color: #ffffff; background: linear-gradient(135deg, var(--brand), var(--brand-strong)); border: 2px solid #ffffff; box-shadow: 0 6px 16px -10px var(--brand-glow); flex: 0 0 auto; }
.um-identity-body { min-width: 0; }
.um-name { display: block; font-size: 0.82rem; font-weight: 800; color: var(--ink); line-height: 1.3; }
.um-email { display: block; margin-top: 2px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; color: var(--ink-muted); word-break: break-all; }
.um-meta-line { display: block; margin-top: 4px; font-size: 10px; color: var(--ink-faint); }
.um-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 190px; }
.um-act { display: inline-flex; align-items: center; gap: 6px; padding: 8px 13px; font-size: 0.7rem; font-weight: 800; border-radius: var(--r-full); cursor: pointer; white-space: nowrap; color: var(--ink); background: #ffffff; border: 1px solid var(--line); transition: all 0.2s var(--ease); }
.um-act:hover { transform: translateY(-1px); color: var(--brand-strong); border-color: var(--brand-line); box-shadow: 0 12px 24px -18px var(--brand-glow); }
.um-act--primary { color: #ffffff; background: linear-gradient(135deg, var(--brand), var(--brand-strong)); border-color: rgba(59, 153, 252, 0.5); box-shadow: 0 12px 26px -16px var(--brand-glow); }
.um-act--primary:hover { color: #ffffff; filter: brightness(1.06); }
.um-act:disabled { opacity: 0.45; cursor: not-allowed; transform: none; box-shadow: none; }
.um-icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; color: var(--ink-soft); background: #f4f6f9; border: 1px solid var(--line); transition: all 0.2s var(--ease); }
.um-icon-btn:hover { color: #ffffff; background: linear-gradient(135deg, var(--brand), var(--brand-strong)); border-color: transparent; transform: translateY(-1px); }
.um-empty { display: none; flex-direction: column; align-items: center; gap: 10px; padding: 54px 22px; text-align: center; }
.um-empty.is-visible { display: flex; }
.um-empty-icon { width: 54px; height: 54px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: var(--brand); background: var(--brand-tint); border: 1px solid var(--brand-line); }
.um-empty-title { font-size: 1rem; font-weight: 800; color: var(--ink); }
.um-empty-text { font-size: 0.8rem; color: var(--ink-muted); max-width: 44ch; line-height: 1.65; }
.um-form { display: flex; flex-direction: column; gap: 22px; }
.um-fieldset { display: flex; flex-direction: column; gap: 16px; border: 0; padding: 0; margin: 0; min-width: 0; }
.um-legend { display: flex; align-items: center; gap: 9px; padding: 0; margin-bottom: 4px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-faint); }
.um-legend::after { content: ""; flex: 1 1 auto; height: 1px; background: var(--line-soft); }
.um-legend svg { color: var(--brand); flex: 0 0 auto; }
.um-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
@media (max-width: 760px) {
.um-row, .um-row--3 { grid-template-columns: 1fr; }
}
.um-label { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 10px; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; color: var(--ink-muted); }
.um-label-req { color: #be123c; font-size: 11px; line-height: 1; }
.um-hint { font-size: 10px; font-weight: 600; letter-spacing: 0; text-transform: none; color: var(--ink-faint); }
      .um-select,
      .um-textarea { width: 100%; padding: 12px 14px; font-size: 0.82rem; font-family: inherit; color: var(--ink); background: #ffffff; border: 1px solid var(--line); border-radius: 12px; outline: none; transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
.um-input::placeholder,
      .um-textarea::placeholder { color: var(--ink-faint); }
      .um-select:focus,
      .um-textarea:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-tint); }
.um-input.is-invalid,
      .um-select.is-invalid,
      .um-textarea.is-invalid { border-color: var(--critical); box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.16); animation: umShake 0.32s var(--ease); }
@media (prefers-reduced-motion: reduce) {
        .um-input, .um-select, .u
/* …truncated by planner; remaining rules follow the same patterns… */
```

Verbatim strings found in the prototype's script (toast titles/messages, status and validation text — use exactly these where the matching event occurs; the surrounding logic is replaced by API calls):
- `use strict`
- `><circle cx=`
- `Filters cleared`
- `Showing the full staff roster.`
- `Super Administrator`
- `Security Analyst`
- `SOC Operator`
- `Compliance Auditor`
- `Support Engineer`
- `Tick at least one capability override and confirm authorisation to save.`
- `Select at least one capability override to apply to this member.`
- `Confirm that this access change is authorised before saving.`
- `Ready to save. The change is written to the immutable audit log.`
- `Permissions updated`
- `Profile editor`
- `— editing name, title, team and scope assignment.`
- `Account suspended`
- `— all active session tokens revoked immediately.`
- `Account reactivated`
- `— new invitation issued for MFA re-enrolment.`
- `MFA enforcement`
- `— enrolment challenge re-issued with 24-hour deadline.`
- `Invitation resent`
- `— secure invitation email re-dispatched.`
- `Invitation revoked`
- `— pending invitation invalidated.`
- `Account deletion queued`
- `— permanent removal scheduled after 30-day retention window.`
- `Action recorded`
- `— expires in 72 hours.`
- `— access link invalidated.`
- `All invitations`
- `Opening the full invitation workspace — 4 pending.`
- `Offensive Security`
- `Threat Intelligence`
- `Security Automation`
**Data:** `GET /admin/users/summary` → tiles (`Active Team Members`, `Security Analysts`, `Operators`, `Pending Invitations`, `MFA Enrolment` %, `Dormant Accounts`; delta lines as in the markup, derived: `▲ <onboardedThisMonth> onboarded this month`, `<accountsWithoutMfa> accounts without MFA`). `GET /admin/users` (query `q`, `role`, `status`, `mfa`, `page`, `pageSize`) → roster via `DataTable`: `Member` (initials avatar + name + email), `Scope & Team`, `MFA / Access` (chip `Enrolled · TOTP` / `Enrolled · Hardware key` / `NOT enrolled` / `Tokens revoked` / `Review required` from `mfa`, `accountStatus`, `accessReviewDue`), `Last Active` (`formatRelativeActive`), `Status` (`ACCOUNT_STATUS_LABELS` badge), `Actions`. `Showing 10 of 24 members` via `ResultCount`; filters in the URL; `Reset Filters` empty state (verbatim).
**Row actions (menu; hidden unless the caller has `users:manage` — everyone else gets a read-only roster):** `Edit profile` (toast `Profile editor` / `<name> — editing name, title, team and scope assignment.` — no endpoint; `// TODO(backend-contract)`), `Adjust permissions` (opens Task 80's dialog), `Suspend` (confirm dialog with an optional reason → `POST …/suspend`; toast `Account suspended` / `<email> — all active session tokens revoked immediately.`), `Reactivate` (toast `Account reactivated` / `<email> — new invitation issued for MFA re-enrolment.`), `Enforce MFA` (toast `MFA enforcement` / `<email> — enrolment challenge re-issued with 24-hour deadline.`), `Change role` (select + confirm → `PATCH …/role`), `Delete` (destructive confirm; toast `Account deletion queued` / `<email> — permanent removal scheduled after 30-day retention window.`). Self-targeting and last-super-admin errors from the API (`self_action`, `last_super_admin`) → toast `{ kind: "crit", title: "Action not allowed", message: "You cannot do this to your own account or the last Super Administrator." }`. Every state-changing action refreshes the roster and summary.

**Tests:** summary tiles; roster columns and chips for the ten fixture members; filters/URL; action menu visibility by permission; suspend confirm → API call → toast; last-super-admin error mapping.

---

**Data shape (TypeScript):**
```ts
// StaffMember, StaffSummary: see contracts (Task 19).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/admin/users?… → 200 { data: StaffMember[]; total } · GET …/summary → 200 { data: StaffSummary }
// POST /api/v1/admin/users/:id/suspend | /reactivate | /enforce-mfa body { reason? } → 200 { data: StaffMember } | 409 { error: "self_action"|"last_super_admin"|"invalid_state" }
// PATCH /api/v1/admin/users/:id/role body { role } → 200 · DELETE /api/v1/admin/users/:id → 204
```

---

**Out of scope:**
- Do not build the provision/permission dialogs (Task 80) or the invitations/matrix (Task 79b).
- Do not build the profile editor.
- Do not show actions to users without `users:manage`.

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
☐ Report at the end: `Task 79 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---


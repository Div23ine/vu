### TASK 80 — Admin User & Access Management B: Provision New Team Member and permission override dialogs

**Layer:** L9

**Prerequisites:** Task 31, Task 79, Task 11, Task 10

**Estimated files touched:** 10

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Admin User & Access Management B: Provision New Team Member and permission override dialogs**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the two dialogs of the users page: the scoped invitation form with the onboarding checklist, and the capability-override dialog.

**Deliverables:**
- `apps/web/src/app/(authed)/admin/users/_components/provision-dialog.tsx`
- `apps/web/src/app/(authed)/admin/users/_components/permission-dialog.tsx`
- `apps/web/src/app/(authed)/admin/users/_hooks/use-provision.ts`
- MODIFY `apps/web/src/app/(authed)/admin/users/_styles/users.css` — append.
- MODIFY `apps/web/src/app/(authed)/admin/users/page.tsx` — mount the dialogs and the `Provision New Member` button.
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

**Reference markup (search the first block for the `Provision New Team Member` dialog — it is part of the page body; the second block is the permission dialog):**

##### Provision New Member dialog (inside the page markup) — extracted by id
```html
<main class="adm-main">
 <div class="adm-shell">
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
  <div class="um-layout">
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
       <p class="adm-card-note">Issue a scoped invitation to a se
##### Permission override dialog
```html
<div id="um-perm-modal" class="um-modal" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="um-perm-title">
 <div class="um-modal-backdrop"></div>
 <div class="um-modal-window" role="document">
  <div class="um-modal-head">
   <div>
    <span class="um-modal-eyebrow">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Access Control — Privileged Action
    </span>
    <h2 class="um-modal-title" id="um-perm-title">Update member permissions</h2>
    <p class="um-modal-sub">
     <span id="um-perm-member">—</span>
     ·
     <span id="um-perm-role">—</span>
    </p>
   </div>
   <button type="button" class="um-modal-close" aria-label="Close permission editor">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </button>
  </div>
  <div class="um-modal-body">
   <div>
    <div class="um-modal-section-title">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Member Summary
    </div>
    <div class="um-modal-summary">
     <div class="um-modal-summary-item">
      <span class="um-modal-summary-label">Member</span>
      <span class="um-modal-summary-value" id="um-modal-name">—</span>
     </div>
     [+2 more sibling <div> elements with the SAME structure as the one above; their text content in order: Current Role ¦ — || Assigned Scope ¦ —]
    </div>
   </div>
   <div>
    <div class="um-modal-section-title">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Capability Overrides
    </div>
    <div class="um-ack-list">
     <label class="um-ack-item">
      <input type="checkbox" class="um-ovr"/>
      <span class="um-ack-text">
       <span class="um-ack-title">Initiate scans</span>
       <span class="um-ack-hint">Allow this member to submit new targets to the scan queue.</span>
      </span>
     </label>
     [+4 more sibling <label> elements with the SAME structure as the one above; their text content in order: Clear review gate ¦ Permit approval of penetration test results for client release. || Emergency broadcast ¦ Allow zero-day advisories to be dispatched to client dashboards. || Export client evidence ¦ Permit downloading of raw scan output and evidence packages. || Read audit logs ¦ Grant read-only visibility into the immutable audit trail.]
    </div>
   </div>
   <div class="um-ack-list">
    <label class="um-ack-item">
     <input type="checkbox" id="um-perm-ack"/>
     <span class="um-ack-text">
      <span class="um-ack-title">I confirm this access change is authorised</span>
      <span class="um-ack-hint">The change is written to the immutable audit log against your administrator identity.</span>
     </span>
    </label>
   </div>
  </div>
  <div class="um-modal-foot">
   <span class="um-modal-foot-note" id="um-perm-hint">Tick at least one capability override and confirm authorisation to save.</span>
   <div class="um-modal-foot-actions">
    <button type="button" class="adm-btn adm-btn-ghost">Cancel</button>
    <button type="button" class="adm-btn adm-btn-primary" id="um-perm-save" disabled>
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     <span>Save Permission Change</span>
    </button>
   </div>
  </div>
 </div>
</div>
```
Custom CSS for this markup (reference):
```css
.um-actions-stack .adm-btn { width: 100%; }
.um-modal { position: fixed; inset: 0; z-index: 300; display: flex; align-items: center; justify-content: center; padding: 24px; opacity: 0; transition: opacity 0.22s var(--ease); }
.um-modal[hidden] { display: none !important; }
.um-modal.is-open { opacity: 1; }
.um-modal-backdrop { position: absolute; inset: 0; background: rgba(5, 7, 10, 0.76); backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px); }
.um-modal-window { position: relative; z-index: 1; display: flex; flex-direction: column; width: min(640px, 100%); max-height: 90vh; border-radius: 18px; overflow: hidden; background: #ffffff; border: 1px solid var(--line); box-shadow: 0 40px 90px -40px rgba(0, 0, 0, 0.9); transform: translateY(18px) scale(0.985); transition: transform 0.28s var(--ease); }
.um-modal.is-open .um-modal-window { transform: translateY(0) scale(1); }
.um-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 20px 22px 16px; background: radial-gradient(90% 140% at 100% 0%, rgba(59, 153, 252, 0.2), transparent 62%), linear-gradient(160deg, var(--dark), #070b11); color: #ffffff; }
.um-modal-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: var(--brand); }
.um-modal-title { margin-top: 8px; font-size: 1.14rem; font-weight: 800; letter-spacing: -0.02em; color: #ffffff; }
.um-modal-sub { margin-top: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; color: #93a2b5; word-break: break-word; }
.um-modal-close { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; color: #93a2b5; background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.14); transition: all 0.2s var(--ease); flex: 0 0 auto; }
.um-modal-close:hover { color: #ffffff; background: rgba(244, 63, 94, 0.3); border-color: rgba(244, 63, 94, 0.5); }
.um-modal-body { flex: 1 1 auto; overflow-y: auto; padding: 22px; display: flex; flex-direction: column; gap: 20px; scrollbar-width: thin; scrollbar-color: rgba(59, 153, 252, 0.35) transparent; }
.um-modal-body::-webkit-scrollbar { width: 8px; }
.um-modal-body::-webkit-scrollbar-thumb { background: rgba(59, 153, 252, 0.3); border-radius: 9999px; border: 2px solid transparent; background-clip: padding-box; }
.um-modal-section-title { display: flex; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 12px; }
.um-modal-summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
@media (max-width: 560px) {
.um-modal-summary { grid-template-columns: 1fr; }
}
.u
```

**Provision dialog (RHF + Zod `ProvisionInviteBody`; title `Provision New Team Member`, description and field labels verbatim as in the markup, i.e. `Full Name`, `Work Email` (helper `@vunvault.com domain`), `Job Title`, `Base / Location`, role select, team select (the six `TEAM_LABELS` of staff teams: `Offensive Security`, `SOC — Detection & Response`, `Threat Intelligence`, `Security Automation`, `Compliance & Audit`, `Client Support`), `Access tier`, `Access review due`, `Scope Notes` (helper `Visible to reviewers only`) and the onboarding checklist: `MFA enrolment mandatory` (checked, disabled), `NDA on file`, `Background verified`, `Training acknowledged`):** the role select lists ONLY staff roles; selecting `Super Administrator`/`Administrator` requires the caller to be a super admin (the API enforces; the UI disables those options for others). Live summary line (verbatim pattern): `<n> outstanding security requirement(s)` and the button states `Provisioning incomplete` (disabled) / `Send Secure Invitation`; secondary `Save Draft` (`draft: true`). Email must end `@vunvault.com` (message `Use a valid @vunvault.com work email.`). Success toast `Invitation sent` / `Secure invitation issued to <email>` and for drafts `Draft saved` / `<name> — stored privately.`; on `409 email_taken` field error `That email already has an account or invitation.`. The invite expiry hint `Expires in 72 hours` is displayed (verbatim `— expires in 72 hours.` tail from the strings).
**Permission override dialog:** shows the member, current role/permissions (from `ROLE_PERMISSIONS`), a list of capability override checkboxes (`PERMISSIONS` with human labels from the markup), an authorisation checkbox (`Confirm that this access change is authorised before saving.` as the error text when unchecked) and the status line copy from the strings (`Select at least one capability override to apply to this member.`, `Ready to save. The change is written to the immutable audit log.`). **There is NO per-user permission override endpoint in the API** — role is the only authority. Therefore this dialog is implemented as a *role change* UI: show a role select and the resulting permission diff (added/removed capabilities computed from `ROLE_PERMISSIONS`), and Save calls `PATCH …/role`; keep the verbatim authorisation requirement and toast `Permissions updated` / `<name> is now <Role label>.` Document the limitation in a comment: `// TODO(backend-contract): per-capability overrides are not supported; role changes only`.

**Tests:** disabled/enabled states and the outstanding-requirement counter; non-vunvault email rejected; draft vs send payloads; admin cannot pick `super_admin`; permission dialog shows the diff and calls the role endpoint with the authorisation checked.

---

**Data shape (TypeScript):**
```ts
// ProvisionInviteBody, ChangeRoleBody: see contracts (Task 19).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/admin/users/invitations body ProvisionInviteBody → 201 { data: Invitation } | 400 | 403 | 409 email_taken
// PATCH /api/v1/admin/users/:id/role body { role } → 200 { data: StaffMember } | 409
```

---

**Out of scope:**
- Do not invent a per-user override API.
- Do not allow inviting non-@vunvault.com emails.
- Do not edit the roster components other than mounting.

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
☐ Report at the end: `Task 80 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---


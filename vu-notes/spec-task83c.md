### TASK 83c — Admin Profile Settings A: identity, personal details, avatar

**Layer:** L9

**Prerequisites:** Task 28, Task 46, Task 75, Task 10

**Estimated files touched:** 11

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Admin Profile Settings A: identity, personal details, avatar**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build `/admin/profile`: identity header, tab bar, and the Personal Details panel (name, title, contact, timezone, language, bio) with avatar upload, saved through the account-settings API.

**Deliverables:**
- `apps/web/src/app/(authed)/admin/profile/page.tsx`
- `apps/web/src/app/(authed)/admin/profile/_components/identity-header.tsx`, `profile-tabs.tsx`, `personal-panel.tsx`, `avatar-uploader.tsx`, `security-panel.tsx` (null stub — Task 83d), `notifications-panel.tsx` (null stub — Task 83d)
- `apps/web/src/app/(authed)/admin/profile/_hooks/use-account-settings.ts`
- `apps/web/src/app/(authed)/admin/profile/_styles/profile.css`
- `apps/web/src/mocks/handlers/admin-profile.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- `apps/web/src/app/(authed)/admin/profile/profile-a.test.tsx`

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

**Reference markup (all three panels; only the Personal panel and the header are built here — the Security and Notifications panels are Task 83d, build them as stubs now):**

##### Profile Settings page body (identity header, tab bar, personal / security / notifications panels)
```html
<div class="adm-shell">
 <div class="adm-page-head">
  <div>
   <span class="adm-eyebrow">Account & Personal Configuration</span>
   <h1 class="adm-page-title">Profile Settings</h1>
   <p class="adm-page-sub">
    Manage your administrator identity, profile picture, password, two-factor authentication and personal notification preferences. Sensitive changes are written to the immutable audit log.
   </p>
  </div>
  <div class="adm-head-actions">
   <button type="button" class="adm-btn adm-btn-ghost" id="ps-discard-all">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Discard Changes</span>
   </button>
   <button type="button" class="adm-btn adm-btn-primary" id="ps-save-all">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Save All Changes</span>
   </button>
  </div>
 </div>
 <section class="ps-identity" aria-labelledby="ps-identity-heading">
  <div class="ps-identity-left">
   <div class="ps-avatar-wrap">
    <span class="ps-avatar" id="ps-identity-avatar" aria-hidden="true">ER</span>
    <span class="ps-avatar-badge" aria-hidden="true">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
    </span>
   </div>
   <div class="ps-identity-text">
    <span class="ps-identity-eyebrow">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Verified Administrator
    </span>
    <h2 class="ps-identity-name" id="ps-identity-heading">Dr. Evelyn Reed</h2>
    <div class="ps-identity-meta">
     <span>Super Administrator</span>
     <span aria-hidden="true">·</span>
     <span>Command Center — Nairobi HQ</span>
     <span aria-hidden="true">·</span>
     <code>e.reed@vunvault.com</code>
    </div>
   </div>
  </div>
  <div class="ps-identity-right">
   <span class="ps-identity-stat ps-identity-stat--ok">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    MFA:
    <strong>Hardware key</strong>
   </span>
   <span class="ps-identity-stat">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    Last sign-in:
    <strong id="ps-last-signin">Today · 09:41 UTC</strong>
   </span>
   <span class="ps-identity-stat">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    Sessions:
    <strong>3 active</strong>
   </span>
  </div>
 </section>
 <nav class="ps-tabs" role="tablist" aria-label="Profile settings sections">
  <button type="button" class="ps-tab" role="tab" id="ps-tab-personal" aria-controls="ps-panel-personal" aria-selected="true">
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
   Personal Details
  </button>
  [+3 more sibling <button> elements with the SAME structure as the one above; their text content in order: Profile Picture || Password & 2FA || Notifications]
 </nav>
 <div class="ps-layout">
  <div class="ps-col">
   <section class="adm-card ps-panel" id="ps-panel-personal" role="tabpanel" aria-labelledby="ps-tab-personal" tabindex="0">
    <div class="adm-card-head">
     <div>
      <h2 class="adm-card-title">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Personal Details
      </h2>
      <p class="adm-card-note">How your name and contact information appear across the VUNVAULT platform and in client-facing communication.</p>
     </div>
     <span class="adm-tag adm-tag--ok">Verified</span>
    </div>
    <div class="adm-card-body">
     <form class="ps-form" id="ps-personal-form">
      <fieldset class="ps-fieldset">
       <legend class="ps-legend">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
        Identity
       </legend>
       <div class="ps-row">
        <div class="ps-field">
         <label class="ps-label" for="ps-first">
          <span>
           First Name
           <span class="ps-label-req" aria-hidden="true">*</span>
          </span>
         </label>
         <input id="ps-first" class="ps-input" type="text" name="first" value="Evelyn" autocomplete="given-name" required/>
        </div>
        <div class="ps-field">
         <label class="ps-label" for="ps-last">
          <span>
           Last Name
           <span class="ps-label-req" aria-hidden="true">*</span>
          </span>
         </label>
         <input id="ps-last" class="ps-input" type="text" name="last" value="Reed" autocomplete="family-name" required/>
        </div>
       </div>
       <div class="ps-row">
        <div class="ps-field">
         <label class="ps-label" for="ps-display">
          <span>Display Name</span>
          <span class="ps-hint">Shown in the audit log</span>
         </label>
         <input id="ps-display" class="ps-input" type="text" name="display" value="Dr. Evelyn Reed" autocomplete="nickname"/>
        </div>
        <div class="ps-field">
         <label class="ps-label" for="ps-jobtitle">
          <span>Job Title</span>
         </label>
         <input id="ps-jobtitle" class="ps-input" type="text" name="jobtitle" value="Super Administrator · Incident Commander" autocomplete="organization-title"/>
        </div>
       </div>
      </fieldset>
      [+2 more sibling <fieldset> elements with the SAME structure as the one above; their text content in order: Contact ¦ Work Email ¦ * ¦ @vunvault.com domain ¦ Direct Phone ¦ Encrypted at rest ¦ Timezone ¦ Africa/Nairobi — EAT (UTC+3) ¦ Africa/Lagos — WAT (UTC+1) ¦ Africa/Accra — GMT (UTC+0) ¦ Africa/Johannesburg — SAST (UTC+2) ¦ Europe/London — GMT/BST ¦ Europe/Berlin — CET/CEST ¦ America/New_York — ET ¦ Asia/Dubai — GST (UTC+4) ¦ Interface Language ¦ English (United Kingdom) ¦ English (United States) ¦ Kiswahili ¦ Français || Biography ¦ Short Biography ¦ 0 / 400 ¦ Cybersecurity leader driving VUNVAULT's offensive and defensive programmes across Africa. Incident commander for SEV-1 events and final approver at the Mandatory Admin Review Gate.]
      <div>
       <button type="button" class="adm-btn adm-btn-ghost">Reset</button>
       <button type="button" class="adm-btn adm-btn-primary">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
        <span>Save Personal Details</span>
       </button>
      </div>
     </form>
    </div>
   </section>
   [+3 more sibling <section> elements with the SAME structure as the one above; their text content in order: Profile Picture ¦ Upload a square image at least 256×256 px. It appears in the header, audit log, contributor cards and client-facing dashboards where your name is shown. ¦ No upload ¦ ER ¦ Drag & drop your image here ¦ Or click to browse. Accepted: PNG, JPG, WEBP, SVG — up to 4 MB. Square crops preferred. ¦ Remove Current Picture ¦ Generate From Initials ¦ Files are scanned for embedded malware, stripped of all EXIF metadata and stored encrypted on the VUNVAULT CDN. Uploads are written to the audit log against your administrator identity. || Password & Two-Factor Authentication ¦ Update your password and manage the authentication factors protecting your administrator account. All credential changes immediately invalidate other active sessions. ¦ 2FA Active ¦ Change Password ¦ Current Password ¦ * ¦ New Password ¦ * ¦ Min. 14 characters ¦ — ¦ Confirm New Password ¦ * ¦ Passwords are hashed with Argon2id and compared in constant time. The platform rejects any password appearing in known breach corpora. ¦ Two-Factor Authentication ¦ Require 2FA at every sign-in ¦ Enforces a second factor for every new session. Disabling this significantly weakens your account and triggers an immediate SEV-2 audit event. ¦ Enforced by policy ¦ Last factor change: 12 Aug 2026 ¦ Authenticator app — primary factor ¦ Scan the QR code with your authenticator app. If you can't scan it, enter the manual secret below. Codes rotate every 30 seconds. ¦ JBSW Y3DP EHPK 3PXP ¦ Recovery Codes — 3 of 10 remaining ¦ 4F7A-9C2E-D018 ¦ B3E1-6D45-A902 ¦ C8K2-7W91-Z534 ¦ ••••-••••-•••• ¦ ••••-••••-•••• ¦ ••••-••••-•••• ¦ Download Codes ¦ Regenerate Codes ¦ Hardware security key — secondary factor ¦ YubiKey 5C NFC registered on 12 Aug 2026. Provides phishing-resistant authentication for all privileged operations. ¦ Registered ¦ Serial: ••••-8842 ¦ Reset ¦ Update Password & 2FA || Notification Preferences ¦ Choose how and where VUNVAULT reaches you. Critical security alerts are always delivered regardless of these preferences. ¦ Personal ¦ Notification channel preferences per event category ¦ Event Category ¦ In-App ¦ Email ¦ SMS ¦ Push ¦ Security & Access ¦ Sign-in from new device ¦ Alert when a new device or unrecognised IP authenticates to your account. ¦ Password or 2FA changed ¦ Immediate notification of any credential change on your account. ¦ Failed authentication attempts ¦ Burst of failed sign-ins against your account from any source. ¦ Scan Operations ¦ Scan completed ¦ A job assigned to you finishes execution and results are ready. ¦ Job awaiting review gate ¦ A job is blocked on the Mandatory Admin Review Gate and requires your attention. ¦ Critical finding detected ¦ A scan has produced a critical severity finding requiring escalation. ¦ Threat Intelligence ¦ Zero-day advisory broadcast ¦ A new emergency advisory has been dispatched to client dashboards. ¦ Threat level change ¦ Global zero-day threat level moves up or down a step. ¦ Administrative ¦ Content awaiting moderation ¦ A staff-authored blog post, advisory or product listing is queued for review. ¦ New team member provisioned ¦ An invitation is sent or a new account is created on the platform. ¦ Weekly digest ¦ A Monday morning summary of scans, releases, threats and audit events. ¦ Quiet hours — suppress non-critical notifications ¦ to ¦ Always delivered: ¦ credential changes, SEV-1 broadcasts, review-gate escalations and incident commander pages ignore quiet hours. ¦ Reset to Defaults ¦ Save Notification Preferences]
  </div>
  <aside class="ps-col" aria-label="Account security summary">
   <section class="adm-card adm-card--dark">
    <div class="adm-card-head">
     <div>
      <h2 class="adm-card-title">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Account Summary
      </h2>
      <p class="adm-card-note">Current identity and session state for this administrator account.</p>
     </div>
     <span class="adm-tag adm-tag--ok">Active</span>
    </div>
    <div class="adm-card-body ps-panel">
     <div class="ps-panel-section">
      <div class="ps-status-row">
       <span>Username</span>
       <strong>e.reed</strong>
      </div>
      <div class="ps-status-row">
       <span>Role</span>
       <strong>Super Administrator</strong>
      </div>
      <div class="ps-status-row">
       <span>Team</span>
       <strong>Command Center</strong>
      </div>
      <div class="ps-status-row">
       <span>Member since</span>
       <strong>Mar 2024</strong>
      </div>
      <div class="ps-status-row">
       <span>Session reference</span>
       <strong>ADM-…-7F3A</strong>
      </div>
     </div>
     [+2 more sibling <div> elements with the SAME structure as the one above; their text content in order: Security Posture ¦ 80 ¦ Score ¦ Strong posture ¦ 3 of 4 recommendations complete. Enrol a second hardware key to reach a perfect score. ¦ Hardware-key MFA registered ¦ Recovery codes generated ¦ Password updated within 90 days ¦ Register a backup hardware key || Open Security Settings ¦ Sign Out Other Sessions ¦ 2 other active sessions will be terminated immediately.]
    </div>
   </section>
   <section class="adm-card" aria-labelledby="ps-sessions-heading">
    <div class="adm-card-head">
     <div>
      <h2 class="adm-card-title" id="ps-sessions-heading">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Active Sessions
      </h2>
      <p class="adm-card-note">Devices currently authenticated to your account.</p>
     </div>
     <span class="adm-tag">3</span>
    </div>
    <div class="adm-card-body">
     <div>
      <table class="ps-sessions">
       <thead>
        <tr>
         <th>Device</th>
         <th>IP Address</th>
         <th>2FA</th>
         <th>Started</th>
         <th></th>
        </tr>
       </thead>
       <tbody>
        <tr>
         <td>
          <span class="adm-strong">MacBook Pro · Safari</span>
          <span>Nairobi, KE · This device</span>
         </td>
         <td class="adm-mono">196.201.214.77</td>
         <td>
          <span class="adm-badge adm-badge--ok">Hardware key</span>
         </td>
         <td class="adm-mono">09:41 UTC</td>
         <td>
          <span class="adm-badge adm-badge--info">Current</span>
         </td>
        </tr>
        [+2 more sibling <tr> elements with the SAME structure as the one above; their text content in order: iPhone 15 Pro · Safari ¦ Nairobi, KE ¦ 196.201.214.82 ¦ TOTP ¦ 07:12 UTC ¦ Revoke || ThinkPad X1 · Chrome ¦ Frankfurt, DE ¦ 185.220.101.9 ¦ Hardware key ¦ Yesterday · 21:04 ¦ Revoke]
       </tbody>
      </table>
     </div>
    </div>
   </section>
   <section class="adm-card adm-card--dark" aria-labelledby="ps-danger-heading">
    <div class="adm-card-head">
     <div>
      <h2 class="adm-card-title" id="ps-danger-heading">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
       Danger Zone
      </h2>
     </div>
    </div>
    <div class="adm-card-body">
     <div class="ps-danger">
      <svg data-icon="REPLACE-WITH-LUCIDE"/>
      <div class="ps-danger-body">
       <span class="ps-danger-title">Deactivate administrator account</span>
       <p class="ps-danger-text">
        This immediately revokes all sessions, removes your access to every module and transfers outstanding review-gate jobs to the on-call lead. Reversal requires an executive approval.
       </p>
       <div>
        <button type="button" class="adm-btn adm-btn-danger" id="ps-deactivate">
         <svg data-icon="REPLACE-WITH-LUCIDE"/>
         <span>Request Deactivation</span>
        </button>
       </div>
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
.adm-btn-danger { color: #be123c; background: #fff1f2; border-color: #fecdd3; }
.adm-btn-danger:hover { transform: translateY(-2px); color: #ffffff; background: linear-gradient(135deg, var(--critical), #be123c); border-color: transparent; }
.adm-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; filter: none !important; box-shadow: none !important; }
.adm-card { display: flex; flex-direction: column; border-radius: 18px; background: #ffffff; border: 1px solid var(--line); box-shadow: 0 18px 44px -38px rgba(10, 13, 18, 0.55); overflow: hidden; }
.adm-card-note { margin-top: 5px; font-size: 0.74rem; line-height: 1.6; color: var(--ink-muted); max-width: 68ch; }
.ps-layout { display: grid; grid-template-columns: minmax(0, 2.15fr) minmax(0, 1fr); gap: 20px; align-items: start; margin-bottom: 20px; }
@media (max-width: 1180px) {
.ps-layout { grid-template-columns: 1fr; }
}
.ps-col { display: flex; flex-direction: column; gap: 20px; min-width: 0; }
.ps-identity { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 20px; padding: 24px 26px; border-radius: 18px; background: radial-gradient(90% 160% at 100% 0%, rgba(59, 153, 252, 0.2), transparent 62%), linear-gradient(135deg, var(--dark) 0%, #060a10 100%); border: 1px solid rgba(59, 153, 252, 0.32); box-shadow: 0 26px 56px -34px rgba(0, 0, 0, 0.7); color: #ffffff; overflow: hidden; position: relative; }
.ps-identity::before { content: ""; position: absolute; inset: 0; background-image: linear-gradient(to right, rgba(59, 153, 252, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(59, 153, 252, 0.08) 1px, transparent 1px); background-size: 44px 44px; -webkit-mask-image: radial-gradient(90% 90% at 0% 0%, #000 0%, transparent 76%); mask-image: radial-gradient(90% 90% at 0% 0%, #000 0%, transparent 76%); pointer-events: none; }
.ps-identity-left { position: relative; z-index: 1; display: flex; align-items: center; gap: 22px; flex-wrap: wrap; min-width: 0; }
.ps-avatar-wrap { position: relative; flex: 0 0 auto; }
.ps-avatar { width: 96px; height: 96px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 30px; font-weight: 800; letter-spacing: 0.04em; color: #ffffff; background: linear-gradient(135deg, var(--brand), var(--brand-strong)); border: 3px solid rgba(255, 255, 255, 0.15); box-shadow: 0 0 0 6px rgba(59, 153, 252, 0.12), 0 24px 48px -26px rgba(0, 0, 0, 0.75); overflow: hidden; }
.ps-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ps-avatar-badge { position: absolute; bottom: 2px; right: 2px; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #04121f; background: linear-gradient(135deg, var(--brand-soft), var(--brand)); border: 2px solid #060a10; box-shadow: 0 8px 18px -8px var(--brand-glow); }
.ps-identity-text { min-width: 0; }
.ps-identity-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: var(--brand); }
.ps-identity-name { margin-top: 8px; font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em; line-height: 1.15; color: #ffffff; }
.ps-identity-meta { margin-top: 6px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px; font-size: 0.76rem; font-weight: 600; color: #93a2b5; }
.ps-identity-meta code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; color: var(--brand-soft); background: rgba(59, 153, 252, 0.12); padding: 2px 8px; border-radius: 6px; border: 1px solid rgba(59, 153, 252, 0.28); }
.ps-identity-right { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
.ps-identity-stat { display: flex; align-items: center; gap: 10px; padding: 8px 14px; border-radius: var(--r-full); background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); font-size: 10.5px; font-weight: 700; color: #cbd5e1; white-space: nowrap; }
.ps-identity-stat strong { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #ffffff; font-weight: 800; }
.ps-identity-stat--ok strong { color: #34d399; }
@media (max-width: 720px) {
.ps-identity-right { align-items: flex-start; width: 100%; }
.ps-identity-left { gap: 18px; }
.ps-avatar { width: 82px; height: 82px; font-size: 26px; }
.ps-identity-name { font-size: 1.25rem; }
}
.ps-tabs { display: flex; flex-wrap: wrap; gap: 4px; padding: 6px; border-radius: var(--r-full); background: #ffffff; border: 1px solid var(--line); box-shadow: 0 12px 30px -26px rgba(10, 13, 18, 0.5); margin-bottom: 20px; overflow-x: auto; scrollbar-width: none; }
.ps-tabs::-webkit-scrollbar { display: none; }
.ps-tab { display: inline-flex; align-items: center; gap: 8px; padding: 9px 16px; font-size: 0.74rem; font-weight: 700; letter-spacing: 0.01em; white-space: nowrap; border-radius: var(--r-full); border: 0; cursor: pointer; color: var(--ink-soft); background: transparent; transition: color var(--dur) var(--ease), background-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
.ps-tab svg { flex: 0 0 auto; opacity: 0.85; }
.ps-tab:hover { color: var(--brand-strong); background: var(--brand-tint); }
.ps-tab[aria-selected="true"] { color: var(--brand-strong); background: var(--brand-tint); box-shadow: inset 0 0 0 1px var(--brand-line); font-weight: 800; }
.ps-panel[hidden] { display: none; }
.ps-form { display: flex; flex-direction: column; gap: 22px; }
.ps-fieldset { display: flex; flex-direction: column; gap: 16px; border: 0; padding: 0; margin: 0; min-width: 0; }
.ps-legend { display: flex; align-items: center; gap: 9px; padding: 0; margin-bottom: 4px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-faint); }
.ps-legend::after { content: ""; flex: 1 1 auto; height: 1px; background: var(--line-soft); }
.ps-legend svg { color: var(--brand); flex: 0 0 auto; }
.ps-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
@media (max-width: 820px) {
.ps-row, .ps-row--3 { grid-template-columns: 1fr; }
}
.ps-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.ps-label { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 10px; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; color: var(--ink-muted); }
.ps-label-req { color: #be123c; font-size: 11px; line-height: 1; }
.ps-hint { font-size: 10px; font-weight: 600; letter-spacing: 0; text-transform: none; color: var(--ink-faint); }
.ps-input,
      .ps-select,
      .ps-textarea { width: 100%; padding: 12px 14px; font-size: 0.82rem; font-family: inherit; color: var(--ink); background: #ffffff; border: 1px solid va
/* …truncated by planner; remaining rules follow the same patterns… */
```

Verbatim strings found in the prototype's script (toast titles/messages, status and validation text — use exactly these where the matching event occurs; the surrounding logic is replaced by API calls):
- `use strict`
- `[VUNVAULT] Unable to persist profile:`
- `><circle cx=`
- `Profile picture`
- `Custom image`
- `File too large`
- `Avatar uploads are limited to 4 MB.`
- `Unsupported file type`
- `Please upload a PNG, JPG, WEBP or SVG image.`
- `Avatar updated`
- `Image accepted and queued for security scanning at`
- `Upload failed`
- `The file could not be read. Please try again.`
- `Avatar removed`
- `Falling back to initials across the platform.`
- `Avatar generated`
- `Initials image created for your account.`
- `Toggle password visibility`
- `Personal details saved`
- `Profile updated at`
- `and written to the audit log.`
- `Security settings updated`
- `Password change enforced across all sessions at`
- `Notification preferences saved`
- `Channel matrix updated at`
- `Changes saved`
- `Settings updated successfully.`
- `Dr. Evelyn Reed`
- `Super Administrator · Incident Commander`
- `Cybersecurity leader driving VUNVAULT's offensive and defensive programmes across Africa. Incident commander for SEV-1 events and final approver at the Mandatory Admin Review Gate.`
- `Personal details reset`
- `Restored to the last saved values.`
- `Security form reset`
- `Password fields cleared.`
- `Notifications reset`
- `Restored to VUNVAULT defaults.`
- `Saving all…`
- `All changes saved`
- `Profile, avatar, credentials and preferences synced at`
- `Changes discarded`
**Tabs:** `Personal Details`, `Security & Credentials`, `Notifications` as `role="tablist"` with the active tab in the URL hash (`#personal`, `#security`, `#notifications`) so the invite flow (`/admin/profile#security`) works; arrow-key navigation between tabs.
**Identity header:** avatar (image or initials), name, `ROLE_LABELS[role]` (plus `· Incident Commander` ONLY when the API ever supplies that flag — not available now: render just the role), member-since (`Mar 2024`), username, `MFA` summary (`mfaSummary`), last sign-in (`formatRelativeActive`), active sessions count; the bio text from `bio`.
**Personal panel (RHF + Zod `UpdateProfileSettingsBody`):** fields `First Name`, `Last Name`, `Display Name`, `Job Title`, `Email` (read-only), `Phone`, `Time Zone` (`TIMEZONES` options), `Language` (`LANGUAGES`), `Bio` (counter `n / 400`). Save → `PATCH /account/settings`; toast `Personal details saved` / `Profile updated at <HH:MM:SS UTC> and written to the audit log.`; `Reset` → toast `Personal details reset` / `Restored to the last saved values.`; unsaved-changes guard (Save disabled when pristine).
**Avatar:** file input + drop target; client checks first (toasts `File too large` / `Avatar uploads are limited to 4 MB.`, `Unsupported file type` / `Please upload a PNG, JPG, WEBP or SVG image.`), then `POST /account/avatar/upload-url` → `PUT` to the presigned URL → `POST /account/avatar/confirm { objectKey }`; success toast `Avatar updated` / `Image accepted and queued for security scanning at <HH:MM:SS UTC>.`; `Remove` → `DELETE /account/avatar` → toast `Avatar removed` / `Falling back to initials across the platform.`; the prototype's `Generate initials avatar` is just the fallback (toast `Avatar generated` / `Initials image created for your account.` — no API call). SVG avatars must be rendered through `<img>` only.
**Footer actions:** `Discard changes` (toast `Changes discarded` / `All unsaved edits have been reverted to the last saved state.`) and `Save all changes` (saves the personal panel; toast `All changes saved` / `Profile, avatar, credentials and preferences synced at <HH:MM:SS UTC>.` only when every panel was saved).

**Tests:** header values from MSW; hash-driven tabs; Save payload; avatar type/size rejections and the three-request order; remove avatar; read-only email.

---

**Data shape (TypeScript):**
```ts
// ProfileSettings, UpdateProfileSettingsBody: see contracts (Task 20d).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/account/settings → 200 { data: ProfileSettings } · PATCH /api/v1/account/settings body UpdateProfileSettingsBody → 200
// POST /api/v1/account/avatar/upload-url · POST …/avatar/confirm · DELETE …/avatar
```

---

**Out of scope:**
- Do not build the Security and Notifications panels (Task 83d).
- Do not render SVG avatars inline.
- Do not fake an `Incident Commander` label.

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
☐ Report at the end: `Task 83c complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---


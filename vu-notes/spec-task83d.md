### TASK 83d — Admin Profile Settings B: security & credentials, active sessions, notification preferences

**Layer:** L9

**Prerequisites:** Task 27, Task 29, Task 67, Task 83c

**Estimated files touched:** 13

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Admin Profile Settings B: security & credentials, active sessions, notification preferences**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the Security & Credentials and Notifications panels of `/admin/profile`, reusing the password/MFA/recovery components from the client Password Manager where possible.

**Deliverables:**
- `apps/web/src/app/(authed)/admin/profile/_components/security-panel.tsx` — overwrites the stub.
- `apps/web/src/app/(authed)/admin/profile/_components/sessions-list.tsx`, `posture-card.tsx`, `notifications-panel.tsx` — overwrites the stub, `notification-matrix.tsx`, `quiet-hours.tsx`
- `apps/web/src/app/(authed)/admin/profile/_hooks/use-admin-security.ts`
- MODIFY `apps/web/src/app/(authed)/admin/profile/_styles/profile.css` — append.
- MODIFY `apps/web/src/mocks/handlers/admin-profile.ts`.
- `apps/web/src/app/(authed)/admin/profile/profile-b.test.tsx`

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

**Reference markup:** the Security and Notifications panels are inside the page body block shown in Task 83c (search it for the `Change Password`, `Active Sessions` and `Notification Preferences` groups). Build them with exactly that structure and copy; the strings list below applies:

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
**Security & Credentials panel:** (1) **Posture card:** `GET /account/security` → `SecurityPosture` (score meter, label `Strong posture`/`Fair posture`/`Weak posture`, items with ✓/○). (2) **Change password:** reuse the `ChangePasswordCard` from `apps/web/src/app/(authed)/portal/security/_components` by importing it (do not copy); staff minimum is 14 characters (the component already switches by role); on success toast `Security settings updated` / `Password change enforced across all sessions at <HH:MM:SS UTC>.`. (3) **Authenticator app, hardware keys, recovery codes:** import the same `TotpPanel`, `SecurityKeyPanel`, `RecoveryKeysCard` from the portal security feature; the manual-secret copy button toasts `Manual secret copied to clipboard.` and on failure `Clipboard blocked` / `Copy the secret manually: <secret>`. (4) **Require 2FA** switch (read-only for staff: always on; render as a disabled checked switch with helper `Required for all staff accounts.`). (5) **Active sessions:** `GET /account/sessions` list (device label, ip, `location`, MFA method, started, `This device` chip for `current`), per-row `Revoke` (`DELETE …/sessions/:id`), `Sign out all other sessions` (`POST …/revoke-others`; toast `Sessions revoked` / `<n> other session(s) were signed out.` planner). (6) **Request deactivation** (danger zone): button → dialog with a required reason ≥ 10 characters → `POST /account/deactivation-request`; toast `Request sent` / `A super administrator will review your deactivation request.` (planner); `409 already_requested` → `You already have a pending request.`.
**Notifications panel:** `GET /account/notifications`; a matrix (rows = the 11 `NOTIFICATION_EVENT_META` events grouped as `Security & Access`, `Scan Operations`, `Threat Intelligence`, `Administrative` with titles/descriptions verbatim; columns `In-App`, `Email`, `SMS`, `Push` as real checkboxes, `aria-label` = `<event title> — <channel>`); a note that credential changes and SEV-1 alerts ignore opt-outs and quiet hours (`Critical security alerts are always delivered.` planner); `Quiet hours` switch + two `time` inputs (`From`, `To`; validation per contract). `Save` → `PUT /account/notifications` (toast `Notification preferences saved` / `Channel matrix updated at <HH:MM:SS UTC>.`); `Reset to Defaults` (in-app + email on, sms + push off for every event; toast `Notifications reset` / `Restored to VUNVAULT defaults.`) only changes the form until saved.

**Tests:** posture card renders the API values; the password card is the imported component (assert by test id); sessions list/revoke/revoke-others; deactivation dialog validation and 409; notification matrix state and the `PUT` payload shape; quiet-hours validation; defaults reset.

---

**Data shape (TypeScript):**
```ts
// MfaStatus, SecurityPosture, SessionView, NotificationPrefs: see contracts (Task 20d).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/account/security · GET/DELETE /account/sessions[/:id] · POST /account/sessions/revoke-others · GET/PUT /account/notifications · POST /account/deactivation-request body { reason }
```

---

**Out of scope:**
- Do not copy the portal security components (import them).
- Do not allow staff to disable 2FA.
- Do not store anything in browser storage.

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
☐ Report at the end: `Task 83d complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---


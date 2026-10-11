### TASK 82 — Admin Zero-Day Intel B: irreversible Emergency Broadcast dialog

**Layer:** L9

**Prerequisites:** Task 38, Task 81, Task 11

**Estimated files touched:** 8

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Admin Zero-Day Intel B: irreversible Emergency Broadcast dialog**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the Emergency Broadcast confirmation dialog with audience estimate, five acknowledgements, typed confirmation and SEV-1 result.

**Deliverables:**
- `apps/web/src/app/(authed)/admin/zero-day/_components/broadcast-dialog.tsx`
- `apps/web/src/app/(authed)/admin/zero-day/_components/ack-checklist.tsx`
- `apps/web/src/app/(authed)/admin/zero-day/_hooks/use-broadcast.ts`
- MODIFY `apps/web/src/app/(authed)/admin/zero-day/_styles/zero-day.css` — append.
- MODIFY `apps/web/src/app/(authed)/admin/zero-day/_components/advisory-editor.tsx` — wire the `Emergency Broadcast` button.
- `apps/web/src/app/(authed)/admin/zero-day/broadcast.test.tsx`

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

##### Emergency broadcast dialog
```html
<div id="zd-broadcast-modal" class="zd-modal" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="zd-broadcast-title">
 <div class="zd-modal-backdrop"></div>
 <div class="zd-modal-window" role="document">
  <div class="zd-modal-head">
   <div>
    <span class="zd-modal-eyebrow">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Emergency Broadcast — Irreversible
    </span>
    <h2 class="zd-modal-title" id="zd-broadcast-title">Confirm advisory broadcast</h2>
    <p class="zd-modal-sub">
     This pushes the advisory to every matching client dashboard, dispatches email and SMS alerts, and opens a SEV-1 audit event. It cannot be undone — only retracted with a follow-up notice.
    </p>
   </div>
   <button type="button" class="zd-modal-close" aria-label="Close broadcast confirmation">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </button>
  </div>
  <div class="zd-modal-body">
   <div>
    <div class="zd-modal-section-title">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Advisory Being Broadcast
    </div>
    <div class="zd-modal-summary">
     <div class="zd-modal-summary-item">
      <span class="zd-modal-summary-label">CVE ID</span>
      <span class="zd-modal-summary-value" id="zd-modal-cve">—</span>
     </div>
     [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Severity ¦ — || Advisory Title ¦ — || Affected Scope ¦ —]
    </div>
   </div>
   [+2 more sibling <div> elements with the SAME structure as the one above; their text content in order: Immediate Reach ¦ 312 ¦ Client Dashboards ¦ 486 ¦ Email Contacts ¦ 74 ¦ SMS / On-call || Pre-Broadcast Acknowledgement ¦ Severity level is correct ¦ The assigned severity matches the CVSS base score and observed exploitation status. ¦ Affected scope is complete ¦ Every affected product, version range and platform is listed — no over- or under-matching. ¦ Content is safe for client distribution ¦ No unredacted exploit code, internal credentials or third-party confidential data is included. ¦ Remediation guidance is actionable ¦ Immediate mitigations and the permanent fix are both documented for clients. ¦ I am authorised to issue emergency broadcasts ¦ This action is recorded against your administrator identity and cannot be revoked.]
   <div class="zd-confirm-word-field">
    <label class="zd-label" for="zd-confirm-word">
     <span>
      Type
      <strong>BROADCAST</strong>
      to confirm
     </span>
    </label>
    <input id="zd-confirm-word" class="zd-confirm-word" type="text" placeholder="BROADCAST" autocomplete="off" aria-describedby="zd-confirm-hint"/>
    <span class="zd-hint" id="zd-confirm-hint">The confirmation phrase is case-insensitive and required before the broadcast button unlocks.</span>
   </div>
  </div>
  <div class="zd-modal-foot">
   <span class="zd-modal-foot-note" id="zd-modal-hint">Complete all five acknowledgements and type the confirmation phrase to unlock the broadcast button.</span>
   <div class="zd-modal-foot-actions">
    <button type="button" class="adm-btn adm-btn-ghost">Cancel</button>
    <button type="button" class="adm-btn adm-btn-danger" id="zd-confirm-broadcast" disabled>
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     <span>Broadcast Now</span>
    </button>
   </div>
  </div>
 </div>
</div>
```
Custom CSS for this markup (reference):
```css
.adm-btn-danger { color: #ffffff; background: linear-gradient(135deg, var(--critical), #be123c); border-color: rgba(244, 63, 94, 0.55); box-shadow: 0 14px 30px -16px rgba(244, 63, 94, 0.7); }
.adm-btn-danger:hover { transform: translateY(-2px); filter: brightness(1.07); box-shadow: 0 20px 40px -18px rgba(244, 63, 94, 0.85); }
.adm-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; filter: none !important; box-shadow: none !important; }
.zd-label { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 10px; font-weight: 800; letter-spacing: 0.13em; text-transform: uppercase; color: var(--ink-muted); }
.zd-hint { font-size: 10px; font-weight: 600; letter-spacing: 0; text-transform: none; color: var(--ink-faint); }
.zd-actions-stack .adm-btn { width: 100%; }
.zd-modal { position: fixed; inset: 0; z-index: 300; display: flex; align-items: center; justify-content: center; padding: 24px; opacity: 0; transition: opacity 0.22s var(--ease); }
.zd-modal[hidden] { display: none !important; }
.zd-modal.is-open { opacity: 1; }
.zd-modal-backdrop { position: absolute; inset: 0; background: rgba(5, 7, 10, 0.78); backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px); }
.zd-modal-window { position: relative; z-index: 1; display: flex; flex-direction: column; width: min(700px, 100%); max-height: 90vh; border-radius: 18px; overflow: hidden; background: #ffffff; border: 1px solid rgba(244, 63, 94, 0.3); box-shadow: 0 40px 90px -40px rgba(0, 0, 0, 0.9); transform: translateY(18px) scale(0.985); transition: transform 0.28s var(--ease); }
.zd-modal.is-open .zd-modal-window { transform: translateY(0) scale(1); }
.zd-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 22px 22px 18px; background: radial-gradient(90% 140% at 100% 0%, rgba(244, 63, 94, 0.28), transparent 62%), linear-gradient(160deg, var(--dark), #070b11); color: #ffffff; }
.zd-modal-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: #fb7185; }
.zd-modal-title { margin-top: 8px; font-size: 1.14rem; font-weight: 800; letter-spacing: -0.02em; color: #ffffff; }
.zd-modal-sub { margin-top: 6px; font-size: 11px; line-height: 1.6; color: #93a2b5; max-width: 54ch; }
.zd-modal-close { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; color: #93a2b5; background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.14); transition: all 0.2s var(--ease); flex: 0 0 auto; }
.zd-modal-close:hover { color: #ffffff; background: rgba(244, 63, 94, 0.3); border-color: rgba(244, 63, 94, 0.5); }
.zd-modal-body { flex: 1 1 auto; overflow-y: auto; padding: 22px; display: flex; flex-direction: column; gap: 20px; scrollbar-width: thin; scrollbar-color: rgba(244, 63, 94, 0.35) transparent; }
.zd-modal-body::-webkit-scrollbar { width: 8px; }
.zd-modal-body::-webkit-scrollbar-thumb { background: rgba(244, 63, 94, 0.3); border-radius: 9999px; border: 2px solid transparent; background-clip: padding-box; }
.zd-modal-section-title { display: flex; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 12px; }
.zd-modal-summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
@media (max-width: 560px) {
.zd-modal-summary { grid-template-columns: 1fr; }
}
.zd-modal-summary-item { padding: 13px 15px; border-radius: 12px; background: #f8fafc; border: 1px solid var(--line-soft); }
.zd-modal-summary-label { display: block; font-size: 9px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); }
.zd-modal-summary-value { display: block; margin-top: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.8rem; font-weight: 800; color: var(--ink); word-break: break-word; }
.zd-confirm-word-field { display: flex; flex-direction: column; gap: 8px; }
.zd-confirm-word { width: 100%; padding: 13px 15px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.88rem; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; text-align: center; color: var(--ink); background: #fff1f2; border: 1.5px solid #fecdd3; border-radius: 12px; outline: none; transition: all 0.2s var(--ease); }
.zd-confirm-word::placeholder { color: rgba(159, 18, 57, 0.35); letter-spacing: 0.16em; }
.zd-confirm-word:focus { border-color: var(--critical); box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.16); }
.zd-confirm-word.is-valid { background: #ecfdf5; border-color: var(--ok); }
.zd-modal-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; padding: 16px 22px; background: #f8fafc; border-top: 1px solid var(--line-soft); }
.zd-modal-foot-note { font-size: 10.5px; color: var(--ink-muted); max-width: 46ch; line-height: 1.6; }
.zd-modal-foot-actions { display: flex; flex-wrap: wrap; gap: 10px; }
@media (prefers-reduced-motion: reduce) {
.adm-kpi, .adm-btn, .zd-act, .zd-tag, .zd-draft, .zd-toast,
        .zd-modal, .zd-modal-window, .adm-hamburger-bar,
        .zd-input, .zd-select, .zd-textarea { transition-duration: 0.001ms !important; animation-duration: 0.001ms !important; transform: none !important; }
}
@media print {
.adm-hamburger, .adm-head-actions, .adm-nav, .zd-actions-stack,
        .zd-modal, .zd-toast-stack, .zd-row-actions { display: none !important; }
}
```

**Pre-checks (before the dialog opens):** the advisory must be saved (a draft id exists — otherwise save first) and complete: missing items produce the verbatim toast `Advisory incomplete` / `Complete <list from: a valid CVE identifier, an advisory title, a severity level, at least one scope entry> before raising an emergency broadcast.` — build the list from those four phrases.
**Dialog:** `Dialog` primitive; the audience estimate from `POST /admin/advisories/:id/estimate` (`dashboards`, `emailContacts`, `smsContacts`, `incidentCommanders`) shown in the summary strip; five acknowledgement checkboxes with the verbatim titles and descriptions from `BROADCAST_ACK_LABELS`; a text input `Type BROADCAST to confirm` (case-insensitive match against `BROADCAST_CONFIRM_PHRASE`); status line (verbatim): `Complete all five acknowledgements and type the confirmation phrase to unlock the broadcast button.` → `<n> acknowledgement(s) still outstanding before broadcast can proceed.` → `All acknowledgements complete — type "BROADCAST" to unlock the broadcast button.` → `All checks complete. Broadcasting will dispatch the advisory immediately and cannot be undone.`; the confirm button is the danger variant `Broadcast Now` and stays disabled until the contract rule (`EmergencyBroadcastBody`) holds. `Cancel` closes.
**Submit:** `POST /admin/advisories/:id/broadcast { ack, confirmPhrase }` → `202 BroadcastRecord`; success toasts (verbatim): `Emergency broadcast dispatched` / `<CVE> pushed to <dashboards> client dashboards, <emailContacts> email contacts and <smsContacts> on-call SMS numbers.` and `Audit event recorded` / `SEV-1 broadcast event written with session reference <ADM-YYYY-MMDD-XXXX>.` (reference computed as in Task 46); then close, refresh the advisory lists, and show a delivery progress strip polling `GET /admin/advisories/:id/broadcasts` every 3 s until `status` is `sent`/`failed` (`Delivering… <sent>/<audience>`); the push version comes in Layer L12. Errors: `400 validation_failed` (never expected) → stay open; `403` → `Only administrators can issue emergency broadcasts.`; `409 broadcast_in_progress` → `A broadcast for this advisory was just sent. Wait a minute before sending another.`; `422 advisory_incomplete` → the same incomplete toast with the API's `details`. The dialog cannot be dismissed by clicking the backdrop once the request is in flight. **Re-broadcast** for published advisories uses the same dialog with title `Re-broadcast advisory` and `POST …/rebroadcast`.

**Tests:** confirm locked until five acks + phrase; wrong phrase locked; status line text transitions; success toasts with real counts; 409 and 422 mapping; the incomplete pre-check message lists exactly the missing items; backdrop click ignored while pending.

---

**Data shape (TypeScript):**
```ts
// EmergencyBroadcastBody, BroadcastEstimate, BroadcastRecord: see contracts (Task 20d).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/admin/advisories/:id/estimate → 200 { data: BroadcastEstimate }
// POST /api/v1/admin/advisories/:id/broadcast | /rebroadcast body { ack: {severityCorrect, scopeComplete, contentSafe, remediationActionable, authorised: true}; confirmPhrase: "BROADCAST" } → 202 { data: BroadcastRecord } | 403 | 409 broadcast_in_progress | 422 advisory_incomplete
// GET /api/v1/admin/advisories/:id/broadcasts → 200 { data: BroadcastRecord[] }
```

---

**Out of scope:**
- Do not add a way to cancel a broadcast.
- Do not enable the confirm button early.
- Do not implement SSE (Layer L12).

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
☐ Report at the end: `Task 82 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---


### TASK 78 — Admin Mandatory Review Gate dialog

**Layer:** L9

**Prerequisites:** Task 35, Task 77, Task 11

**Estimated files touched:** 8

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Admin Mandatory Review Gate dialog**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the review-gate dialog: five verification checks, the three decisions, the payment lock and the immutable-audit confirmation.

**Deliverables:**
- `apps/web/src/app/(authed)/admin/scan-queue/_components/review-gate-dialog.tsx`
- `apps/web/src/app/(authed)/admin/scan-queue/_components/gate-checklist.tsx`, `gate-decision-picker.tsx`
- `apps/web/src/app/(authed)/admin/scan-queue/_hooks/use-gate-decision.ts`
- MODIFY `apps/web/src/app/(authed)/admin/scan-queue/_styles/scan-queue.css` — append rules.
- MODIFY `apps/web/src/app/(authed)/admin/scan-queue/_components/row-actions.tsx` — open the dialog.
- `apps/web/src/app/(authed)/admin/scan-queue/review-gate.test.tsx`

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

##### Review gate dialog
```html
<div id="sq-review-modal" class="sq-modal" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="sq-review-title">
 <div class="sq-modal-backdrop"></div>
 <div class="sq-modal-window" role="document">
  <div class="sq-modal-head">
   <div>
    <span class="sq-modal-eyebrow">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Mandatory Admin Review Gate
    </span>
    <h2 class="sq-modal-title" id="sq-review-title">Review findings before client release</h2>
    <p class="sq-modal-sub">
     <span id="sq-modal-job">JOB-0000</span>
     ·
     <span id="sq-modal-target">target.example.com</span>
    </p>
   </div>
   <button type="button" class="sq-modal-close" aria-label="Close review gate">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </button>
  </div>
  <div class="sq-modal-body">
   <div>
    <div class="sq-modal-section-title">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     Findings Summary
    </div>
    <div class="sq-findings">
     <div class="sq-finding sq-finding--crit">
      <span class="sq-finding-count" id="sq-crit-count">0</span>
      <span class="sq-finding-label">Critical</span>
     </div>
     [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: 0 ¦ High || 0 ¦ Medium || 0 ¦ Low]
    </div>
   </div>
   [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Client Request Context ¦ Client ¦ — ¦ Target Host ¦ — ¦ Payment ¦ — || Mandatory Verification Checklist ¦ Scope authorisation verified ¦ Signed authorisation on file covers every host in the target list. ¦ Evidence sanitised ¦ No production data, credentials or personal information in the report. ¦ Critical & high findings manually validated ¦ Each severe finding independently reproduced by the reviewer. ¦ Remediation guidance attached ¦ Prioritised fixes and a re-test window are included in the report. ¦ Client-ready redaction approved ¦ Exploit payloads are safely truncated for the client-facing copy. || Gate Decision ¦ Approve & Release ¦ Clears the gate and grants the client portal access to the report. ¦ Hold for Remediation ¦ Keeps the report locked while the client remediates findings. ¦ Reject & Archive ¦ Marks the job invalid and returns it to the analyst for rework.]
   <div class="sq-note-field">
    <label class="sq-field-label" for="sq-review-note">Reviewer Note (recorded in the audit log)</label>
    <textarea id="sq-review-note" class="sq-textarea" placeholder="Summarise what was verified, any residual risk accepted, and the rationale for this decision…"></textarea>
   </div>
   <div class="sq-reviewer">
    <span>
     <span class="sq-reviewer-label">Reviewer</span>
     <br/>
     <span class="sq-reviewer-value">e.reed@vunvault.com</span>
    </span>
    [+2 more sibling <span> elements with the SAME structure as the one above; their text content in order: Role ¦ Super Administrator || Gate Timestamp ¦ —]
   </div>
  </div>
  <div class="sq-modal-foot">
   <span class="sq-modal-foot-note" id="sq-gate-hint">Complete all five verification steps and select a decision to enable the gate action.</span>
   <div class="sq-modal-foot-actions">
    <button type="button" class="adm-btn adm-btn-ghost">Cancel</button>
    <button type="button" class="adm-btn adm-btn-primary" id="sq-confirm-gate" disabled>
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     <span>Confirm Gate Decision</span>
    </button>
   </div>
  </div>
 </div>
</div>
```
Custom CSS for this markup (reference):
```css
.sq-field-label { font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); }
.sq-modal { position: fixed; inset: 0; z-index: 300; display: flex; align-items: center; justify-content: center; padding: 24px; opacity: 0; transition: opacity 0.22s var(--ease); }
.sq-modal[hidden] { display: none !important; }
.sq-modal.is-open { opacity: 1; }
.sq-modal-backdrop { position: absolute; inset: 0; background: rgba(5, 7, 10, 0.76); backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px); }
.sq-modal-window { position: relative; z-index: 1; display: flex; flex-direction: column; width: min(760px, 100%); max-height: 90vh; border-radius: 18px; overflow: hidden; background: #ffffff; border: 1px solid var(--line); box-shadow: 0 40px 90px -40px rgba(0, 0, 0, 0.85); transform: translateY(18px) scale(0.985); transition: transform 0.28s var(--ease); }
.sq-modal.is-open .sq-modal-window { transform: translateY(0) scale(1); }
.sq-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 20px 22px 16px; background: radial-gradient(90% 140% at 100% 0%, rgba(59, 153, 252, 0.18), transparent 62%), linear-gradient(160deg, var(--dark), #070b11); color: #ffffff; }
.sq-modal-eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: var(--brand); }
.sq-modal-title { margin-top: 8px; font-size: 1.16rem; font-weight: 800; letter-spacing: -0.02em; color: #ffffff; }
.sq-modal-sub { margin-top: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; color: #93a2b5; word-break: break-word; }
.sq-modal-close { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; color: #93a2b5; background: rgba(255, 255, 255, 0.07); border: 1px solid rgba(255, 255, 255, 0.14); transition: all 0.2s var(--ease); flex: 0 0 auto; }
.sq-modal-close:hover { color: #ffffff; background: rgba(244, 63, 94, 0.3); border-color: rgba(244, 63, 94, 0.5); }
.sq-modal-body { flex: 1 1 auto; overflow-y: auto; padding: 22px; display: flex; flex-direction: column; gap: 20px; scrollbar-width: thin; scrollbar-color: rgba(59, 153, 252, 0.35) transparent; }
.sq-modal-body::-webkit-scrollbar { width: 8px; }
.sq-modal-body::-webkit-scrollbar-thumb { background: rgba(59, 153, 252, 0.3); border-radius: 9999px; border: 2px solid transparent; background-clip: padding-box; }
.sq-modal-section-title { display: flex; align-items: center; gap: 8px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 12px; }
.sq-findings { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
@media (max-width: 560px) {
.sq-findings { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
.sq-finding { padding: 14px 14px 12px; border-radius: 12px; border: 1px solid var(--line-soft); background: #f8fafc; text-align: center; }
.sq-finding-count { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 1.4rem; font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
.sq-finding-label { display: block; margin-top: 6px; font-size: 9px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-faint); }
.sq-finding--crit .sq-finding-count { color: #be123c; }
.sq-finding--high .sq-finding-count { color: #b45309; }
.sq-finding--med  .sq-finding-count { color: #1d4ed8; }
.sq-finding--low  .sq-finding-count { color: #047857; }
.sq-note-field { display: flex; flex-direction: column; gap: 8px; }
.sq-textarea { width: 100%; min-height: 96px; padding: 13px 15px; font-size: 0.8rem; line-height: 1.6; color: var(--ink); background: #ffffff; border: 1px solid var(--line); border-radius: 12px; resize: vertical; outline: none; transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
.sq-textarea:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-tint); }
.sq-reviewer { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 13px; background: #f8fafc; border: 1px solid var(--line-soft); }
.sq-reviewer-label { font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); }
.sq-reviewer-value { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.76rem; font-weight: 700; color: var(--ink); }
.sq-modal-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; padding: 16px 22px; background: #f8fafc; border-top: 1px solid var(--line-soft); }
.sq-modal-foot-note { font-size: 10.5px; color: var(--ink-muted); max-width: 44ch; line-height: 1.6; }
.sq-modal-foot-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.sq-modal-foot .adm-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; filter: none; box-shadow: none; }
@media (prefers-reduced-motion: reduce) {
.adm-kpi, .adm-btn, .sq-act, .sq-icon-btn, .sq-bulk-btn, .sq-clear-btn,
        .sq-modal, .sq-modal-window, .sq-toast, .sq-bulkbar, .adm-hamburger-bar { transition-duration: 0.001ms !important; animation-duration: 0.001ms !important; transform: none !important; }
}
@media print {
.adm-hamburger, .adm-head-actions, .adm-nav, .sq-toolbar, .sq-bulkbar,
        .sq-actions, .sq-modal, .sq-toast-stack { display: none !important; }
}
```

**Behaviour:** built on the `Dialog` primitive (focus trap, Escape, `aria-labelledby`). Header shows the job (`JOB-4471`), target, client, and a gate badge (`Awaiting Review`). Body: `REVIEW_CHECK_LABELS` five checkboxes (titles + descriptions verbatim from contracts), the three decision radio cards (`GATE_DECISION_LABELS` titles/descriptions), a required reviewer note (`Reviewer note` textarea, min 10 characters, error `Add a reviewer note of at least 10 characters.` (planner)), payment panel showing the job's payment state — `Pending — awaiting settlement` / `Overdue — collection required` (verbatim) in a warning panel when not paid, with the line `Release is blocked until payment is settled.` (planner) — and a status line that updates live: `Complete all five verification steps and select a decision to enable the gate action.` → `<n> verification step(s) still outstanding before the gate can be cleared.` → `All verification steps complete — select a decision to continue.` → `All checks complete. Confirming will write this decision to the immutable audit log.`. The confirm button label follows the decision (`Approve & Release` / `Hold for Remediation` / `Reject & Archive`) and is disabled until the contract rule holds (`approve_release` needs all five checks; others do not) and the note is valid.
**Submit:** `POST /admin/scans/:id/gate-decision { decision, checks, note }`. Success toasts (verbatim): approve → `Client portal access granted. Decision written to the audit log` + `<JOB> released with reviewer note.`; hold → `<JOB> held for remediation` + `Report remains locked. The client has been notified of outstanding findings.`; reject → `<JOB> rejected` + `Job returned to the assigned analyst for rework and re-submission.`. **`409 payment_outstanding`** (the API recorded the attempt and set `blocked_payment`): do NOT show success — show the inline critical panel `Release blocked — payment is outstanding. The decision was recorded and the job is locked until the invoice is paid.` and refresh the queue. `403 forbidden` → `Your role cannot release reports. Ask an administrator.`; `409 already_released` → close + refresh. Users without `scans:release` see the `Approve & Release` card disabled with the tooltip `Requires administrator authority.`.
**Tests:** confirm disabled until five checks + note for approve; hold allowed with unchecked checks; the three success toasts; 409 payment shows the blocked panel and no success toast; analyst sees approve disabled; keyboard: Escape closes, focus returns to the row action.

---

**Data shape (TypeScript):**
```ts
// GateDecisionBody: see contracts (Task 19).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/admin/scans/:id/gate-decision body { decision; checks: Record<ReviewCheckKey, boolean>; note: string(min10) } → 200 { data: ScanJob } | 403 forbidden | 409 { error: "payment_outstanding" | "not_reviewable" | "already_released" }
```

---

**Out of scope:**
- Do not add any way to undo a release.
- Do not skip the audit confirmation line.
- Do not bypass the payment lock.

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
☐ Report at the end: `Task 78 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---


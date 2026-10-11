### TASK 65 — Client onboarding wizard B: step 3 (recovery question, declarations) and submission

**Layer:** L7

**Prerequisites:** Task 30, Task 64

**Estimated files touched:** 7

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Client onboarding wizard B: step 3 (recovery question, declarations) and submission**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the final onboarding step and the submit flow that posts the whole wizard to the API and lands the client in the portal.

**Deliverables:**
- `apps/web/src/app/(authed)/onboarding/_components/step-final.tsx` — overwrites the Task 64 stub.
- `apps/web/src/app/(authed)/onboarding/_hooks/use-submit-onboarding.ts`
- MODIFY `apps/web/src/app/(authed)/onboarding/_components/onboarding-wizard.tsx` — wire the final step and submit.
- MODIFY `apps/web/src/app/(authed)/onboarding/_styles/onboarding.css` — append if needed.
- `apps/web/src/app/(authed)/onboarding/onboarding-b.test.tsx`

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

**Reference markup (the same form; look for step 3 — recovery question select, answer input, three declaration checkboxes, the submit button and the final consent note):**

##### Step 3 (security & declarations) and submit area — extracted from the same form
```html
<form id="onboardingForm" autocomplete="on">
 <section class="ob-panel" data-step="1" aria-labelledby="obStep1Title">
  <div class="ob-panel-head">
   <div class="ob-panel-index">Step 01 — Personal & contact</div>
   <h2 class="ob-panel-title" id="obStep1Title">Who are we protecting?</h2>
   <p class="ob-panel-text">Use the name and contact details you want attached to your security reports. We use your email for scan notifications and your phone for critical alerts only.</p>
  </div>
  <div class="ob-grid">
   <div class="ob-field ob-span-2">
    <label class="ob-label" for="obFullName">
     Full name
     <span aria-hidden="true">*</span>
    </label>
    <input class="ob-input" type="text" id="obFullName" name="fullName" placeholder="Jane Wanjiru Kamau" autocomplete="name"/>
    <span class="ob-err"></span>
   </div>
   <div class="ob-field">
    <label class="ob-label" for="obDob">
     Date of birth
     <span aria-hidden="true">*</span>
    </label>
    <input class="ob-input" type="date" id="obDob" name="dob"/>
    <span class="ob-hint">You must be at least 16 years old.</span>
    <span class="ob-err"></span>
   </div>
   [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Phone number ¦ * ¦ Include your country code for SMS alerts. || Email address ¦ * || Confirm email address ¦ *]
  </div>
 </section>
 [+2 more sibling <section> elements with the SAME structure as the one above; their text content in order: Step 02 — Career & account type ¦ How do you use VUNVAULT? ¦ Your role determines the assessment templates, compliance mappings and reporting depth we prepare for you. Your entity type determines the contracting and invoicing path. ¦ Career / role ¦ * ¦ Student ¦ Learning tracks, labs and free certificates. ¦ [+3 more sibling <label> elements with the SAME structure as the one above; their text content in order: Business Owner ¦ Starter scans and plain-language reporting. || Cybersecurity Professional ¦ Full-scope pentesting and purple-team work. || Independent Specialist ¦ Consulting, audits and client engagements.] ¦ Entity type ¦ * ¦ Individual ¦ Personal account, personal scope. ¦ [+2 more sibling <label> elements with the SAME structure as the one above; their text content in order: Company ¦ Registered business or startup. || Corporation ¦ Enterprise, group or public entity.] || Step 03 — Verification & finalisation ¦ Confirm and secure your account ¦ Review what we captured, answer one account-recovery question, and confirm the declarations below. Your recovery answer is hashed locally — we never store it in plain text. ¦ Captured details ¦ Ready to submit ¦ Account recovery question ¦ * ¦ Choose a recovery question… ¦ What was the name of your first pet? ¦ In what city were you born? ¦ What is your mother's maiden name? ¦ What was your first car? ¦ What was the name of your first school? ¦ Recovery answer ¦ * ¦ Case-insensitive. Keep it something only you would know. ¦ I confirm that the personal, contact and entity information I provided is accurate, current and belongs to me or to an organisation I am authorised to represent. ¦ [+2 more sibling <label> elements with the SAME structure as the one above; their text content in order: I confirm I will only request assessments against systems I own or have ¦ written authorisation ¦ to test, and I accept the ¦ Acceptable Use Policy ¦ . || I agree to the ¦ Terms of Service ¦ and ¦ Privacy Policy ¦ , including the processing of my data for account verification and security notifications.]]
 <section class="ob-success" id="obSuccess" hidden>
  <div class="ob-success-mark">
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
  </div>
  <h2 class="ob-success-title">Onboarding complete</h2>
  <p class="ob-success-text">
   Welcome aboard,
   <strong id="obSuccessName">friend</strong>
   . Your VUNVAULT profile has been created and verified. Taking you back to the main platform…
  </p>
  <div class="ob-redirect-bar">
   <span></span>
  </div>
  <p class="ob-redirect-note">Redirecting to vun1.html</p>
 </section>
 <div class="ob-actions" id="obActions">
  <button type="button" class="ob-btn ob-btn--ghost" id="obPrevBtn" hidden>
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
   <span>Back</span>
  </button>
  <span class="ob-progress-text" id="obProgressText">Step 1 of 3</span>
  <button type="button" class="ob-btn ob-btn--primary" id="obNextBtn">
   <span>Next</span>
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
  </button>
  <button type="submit" class="ob-btn ob-btn--primary" id="obSubmitBtn" hidden>
   <span>Complete Setup</span>
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
  </button>
 </div>
</form>
```
Custom CSS for this markup (reference):
```css
.ob-panel { padding: 34px 32px 8px; animation: obPanelIn 0.36s var(--ease) both; }
.ob-panel-head { margin-bottom: 26px; }
.ob-panel-index { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; color: var(--brand-strong); }
.ob-panel-title { margin-top: 8px; font-size: 1.35rem; font-weight: 800; letter-spacing: -0.02em; color: var(--ink); }
.ob-panel-text { margin-top: 8px; font-size: 0.84rem; line-height: 1.7; color: var(--ink-muted); max-width: 66ch; }
.ob-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.ob-span-2 { grid-column: 1 / -1; }
@media (max-width: 720px) {
.ob-grid { grid-template-columns: 1fr; }
.ob-span-2 { grid-column: auto; }
}
.ob-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.ob-label { font-size: 10.5px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-muted); }
.ob-label span { color: var(--critical); }
.ob-input { width: 100%; padding: 13px 14px; font-family: inherit; font-size: 0.88rem; color: var(--ink); background: #ffffff; border: 1px solid var(--line); border-radius: 12px; outline: none; transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease), background-color 0.2s var(--ease); }
.ob-input::placeholder { color: var(--ink-faint); }
.ob-input:hover { border-color: #d4d4d4; }
.ob-input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-tint); background: #ffffff; }
.ob-input.is-invalid { border-color: var(--critical); box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.14); animation: obShake 0.32s var(--ease); }
select.ob-input { appearance: none; -webkit-appearance: none; padding-right: 40px; background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%233B99FC' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; cursor: pointer; }
.ob-hint { font-size: 11px; line-height: 1.55; color: var(--ink-faint); }
.ob-err { font-size: 0.72rem; font-weight: 600; color: var(--critical); opacity: 0; transform: translateY(-3px); transition: opacity 0.2s var(--ease), transform 0.2s var(--ease); }
.ob-err.is-visible { opacity: 1; transform: translateY(0); }
.ob-actions { display: flex; align-items: center; gap: 12px; padding: 22px 32px 28px; margin-top: 12px; border-top: 1px solid var(--line-soft); background: linear-gradient(180deg, rgba(252, 251, 249, 0), rgba(252, 251, 249, 0.8)); }
.ob-progress-text { margin-inline: auto; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-faint); white-space: nowrap; }
.ob-btn { display: inline-flex; align-items: center; justify-content: center; gap: 9px; padding: 14px 30px; font-family: inherit; font-size: 0.82rem; font-weight: 800; letter-spacing: 0.01em; border-radius: 9999px; border: 1px solid transparent; cursor: pointer; transition: transform 0.22s var(--ease), filter 0.22s var(--ease), box-shadow 0.22s var(--ease), background-color 0.22s var(--ease), border-color 0.22s var(--ease), color 0.22s var(--ease), opacity 0.2s var(--ease); }
.ob-btn svg { width: 15px; height: 15px; transition: transform 0.22s var(--ease); }
.ob-btn--primary { color: #ffffff; background: linear-gradient(135deg, var(--brand), var(--brand-strong)); border-color: rgba(59, 153, 252, 0.5); box-shadow: 0 16px 34px -16px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.25); }
.ob-btn--primary:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 22px 46px -18px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.3); }
.ob-btn--primary:hover:not(:disabled) svg { transform: translateX(3px); }
.ob-btn--primary:active:not(:disabled) { transform: translateY(0) scale(0.985); }
.ob-btn--ghost { color: var(--ink-soft); background: #ffffff; border-color: var(--line); }
.ob-btn--ghost:hover:not(:disabled) { color: var(--brand-strong); border-color: var(--brand-line); background: var(--brand-tint); transform: translateY(-1px); }
.ob-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.ob-btn.is-busy { pointer-events: none; }
.ob-success { padding: 56px 32px 62px; text-align: center; animation: obPanelIn 0.4s var(--ease) both; }
.ob-success-mark { position: relative; display: grid; place-items: center; width: 88px; height: 88px; margin: 0 auto 22px; border-radius: 50%; background: rgba(16, 185, 129, 0.1); border: 1.5px solid rgba(16, 185, 129, 0.4); animation: obPop 0.45s var(--ease) both; }
.ob-success-mark::after { content: ""; position: absolute; inset: -9px; border-radius: 50%; border: 1.5px solid rgba(16, 185, 129, 0.25); animation: obRing 1.9s var(--ease) infinite; }
.ob-success-mark svg { width: 38px; height: 38px; color: var(--ok); }
.ob-success-title { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em; color: var(--ink); }
.ob-success-text { margin-top: 10px; font-size: 0.86rem; line-height: 1.7; color: var(--ink-muted); max-width: 46ch; margin-inline: auto; }
.ob-success-text strong { color: var(--ink); }
.ob-redirect-bar { height: 3px; width: min(320px, 100%); margin: 26px auto 0; border-radius: 9999px; background: #ececec; overflow: hidden; }
.ob-redirect-bar span { display: block; height: 100%; width: 0; border-radius: 9999px; background: linear-gradient(90deg, var(--brand-strong), var(--brand-soft)); animation: obFill 2.2s var(--ease) forwards; }
.ob-redirect-note { margin-top: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-faint); }
@media (max-width: 768px) {
.ob-panel { padding: 26px 20px 6px;
/* …truncated by planner; remaining rules follow the same patterns… */
```

**Fields (`OnboardingStep3`):** `recoveryQuestion` (select with the five `RECOVERY_QUESTION_LABELS`: `What was the name of your first pet?`, `In what city were you born?`, `What is your mother's maiden name?`, `What was your first car?`, `What was the name of your first school?`), `recoveryAnswer` (min 3 chars; `type="password"`-like masked? NO — keep `type="text"` with `autocomplete="off"`, as in the prototype), and three REQUIRED checkboxes `declarations.infoAccurate`, `declarations.authorisedTesting`, `declarations.termsAccepted` with the label text verbatim from the markup; each unchecked shows the required message `You must accept this declaration to continue.` (planner copy).
**Submit:** `POST /api/v1/onboarding` with the full body (`step1`, `step2`, `step3`); pending state on the button (label from the markup + spinner); `201` → toast `{ kind: "ok", title: "Profile complete", message: "Welcome to your VUNVAULT workspace." }` and `router.replace("/portal")`; `409 already_completed` → redirect to `/portal`; `422 email_mismatch` → jump to step 1 with the field error `Email must match the address you signed up with.`; `400 validation_failed` → map `details` paths to fields and jump to the first step containing an error; network failure → toast `{ kind: "crit", title: "Could not save your profile", message: "Please try again." }`. After success invalidate `queryKeys.profile()` and `queryKeys.session()`.
**Privacy:** the recovery answer is sent once and never echoed, logged, or kept after submit (clear the RHF field).

**Tests:** submit blocked until all three declarations are checked; the body shape matches `OnboardingSubmitBody`; success navigates to `/portal`; 409 navigates; 422 jumps to step 1 with the message; the answer field is reset after success.

---

**Data shape (TypeScript):**
```ts
type OnboardingStep3 = { recoveryQuestion: RecoveryQuestion; recoveryAnswer: string; declarations: { infoAccurate: true; authorisedTesting: true; termsAccepted: true } };
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/onboarding body { step1; step2; step3 } → 201 { data: { completed: true; completedAt: string } } | 400 validation_failed | 409 { error: "already_completed" } | 422 { error: "email_mismatch" }
```

---

**Out of scope:**
- Do not add steps.
- Do not implement a recovery flow that uses the answer.
- Do not log the answer.

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
☐ Report at the end: `Task 65 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---


This is Part 3 of 5. Say "continue" to receive Part 4 (L8 client portal, L9 admin surface, L10 scan worker).

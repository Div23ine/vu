### TASK 64 — Client onboarding wizard A: hero, stepper, step 1 (personal) and step 2 (career & entity)

**Layer:** L7

**Prerequisites:** Task 10, Task 30, Task 42, Task 44, Task 62

**Estimated files touched:** 10

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Client onboarding wizard A: hero, stepper, step 1 (personal) and step 2 (career & entity)**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the `/onboarding` route shell with the hero, the three-step stepper, and the first two steps with per-step validation.

**Deliverables:**
- `apps/web/src/app/(authed)/onboarding/layout.tsx` — `requireSession()` then the MARKETING header/footer (import `SiteHeader`/`SiteFooter` from `(marketing)/_components`, variant `home`); no portal chrome.
- `apps/web/src/app/(authed)/onboarding/page.tsx`
- `apps/web/src/app/(authed)/onboarding/_components/onboarding-wizard.tsx` (client)
- `apps/web/src/app/(authed)/onboarding/_components/step-personal.tsx`, `step-profile.tsx`, `stepper.tsx`, `onboarding-hero.tsx`
- `apps/web/src/app/(authed)/onboarding/_store/onboarding-store.ts` — in-memory wizard state (RHF holds the values; the store holds `step`).
- `apps/web/src/app/(authed)/onboarding/_styles/onboarding.css`
- `apps/web/src/app/(authed)/onboarding/_components/step-final.tsx` — null stub (Task 65 overwrites).
- `apps/web/src/mocks/handlers/onboarding.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- `apps/web/src/app/(authed)/onboarding/onboarding-a.test.tsx`

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

##### Onboarding hero
```html
<section class="ob-hero">
 <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <div class="max-w-4xl">
   <span class="ob-eyebrow">
    <span class="ob-eyebrow-dot" aria-hidden="true"></span>
    Account setup · 3 steps
   </span>
   <h1 class="ob-title">
    Let's finish setting up
    <br/>
    <span>your VUNVAULT workspace.</span>
   </h1>
   <p class="ob-sub">
    Tell us who you are and how you work. This information shapes your scan scope, your compliance mapping and the reporting format you receive. It takes about two minutes — and nothing is shared outside VUNVAULT.
   </p>
   <div class="ob-meta-row">
    <span class="ob-meta-chip">
     <svg data-icon="REPLACE-WITH-LUCIDE"/>
     256-bit encrypted submission
    </span>
    [+2 more sibling <span> elements with the SAME structure as the one above; their text content in order: ~2 minutes to complete || GDPR & DPA 2019 aligned]
   </div>
  </div>
 </div>
</section>
```
Custom CSS for this markup (reference):
```css
.ob-hero { padding: 2.75rem 0 1.25rem; }
.ob-eyebrow { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 9999px; background: var(--brand-tint); border: 1px solid var(--brand-line); color: var(--brand-strong); font-size: 10.5px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; }
.ob-eyebrow-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--brand); box-shadow: 0 0 0 4px rgba(59, 153, 252, 0.16); }
.ob-title { margin-top: 18px; font-size: clamp(1.9rem, 4.2vw, 2.95rem); font-weight: 800; letter-spacing: -0.03em; line-height: 1.1; color: var(--ink); }
.ob-title span { background: linear-gradient(120deg, var(--brand), var(--brand-strong)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.ob-sub { margin-top: 14px; max-width: 62ch; font-size: 0.95rem; line-height: 1.75; color: var(--ink-muted); }
.ob-meta-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 20px; }
.ob-meta-chip { display: inline-flex; align-items: center; gap: 7px; padding: 7px 13px; border-radius: 9999px; background: #ffffff; border: 1px solid var(--line); font-size: 11px; font-weight: 700; color: var(--ink-soft); box-shadow: 0 6px 16px -14px rgba(10, 13, 18, 0.6); }
.ob-meta-chip svg { width: 13px; height: 13px; color: var(--brand); }
@media (max-width: 768px) {
.ob-hero { padding: 2rem 0 1rem; }
}
```

##### Wizard shell: stepper + steps 1 and 2 (the form is split — step 3 is in the next task)
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
.ob-panel { padding: 26px 20px 6px; }
.ob-actions { padding: 18px 20px 24px; flex-wrap: wrap; }
.ob-btn { flex: 1 1 auto; padding: 14px 20px; }
.ob-progress-text { order: -1; width: 100%; text-align: center; margin: 0 0 4px; }
}
@media (prefers-reduced-motion: reduce) {
.ob-panel,
    .ob-success,
    .ob-success-mark,
    .ob-shell,
    .ob-input.is-invalid { animation: none !important; }
.ob-redirect-bar span { width: 100%; animation: none !important; }
.ob-success-mark::after { animation: none !important; }
}
@keyframes obPanelIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes obShake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
@keyframes obRing { 0% { transform: scale(0.92); opacity: 0.9; } 100% { transform: scale(1.28); opacity: 0; } }
@keyframes obPop { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: scale(1); } }
@keyframes obFill { from { width: 0%; } to { width: 100%; } }
```

**ONE `useForm` for the whole wizard** (RHF + Zod `OnboardingSubmitBody` from `@vunvault/contracts`, `mode: "onTouched"`); each step validates only its own fields with `trigger([...])` before `Next`. Step 1 fields (`OnboardingStep1`): `fullName`, `dateOfBirth`, `phone` (optional, E.164 — placeholder and helper text verbatim from the markup), `email`, `emailConfirm`; prefill `fullName` and `email` (and `emailConfirm`) from `useSession()`; error messages: `You must be at least 16 years old.` (DOB), `Email addresses must match.`, plus the field messages in the markup. Step 2 fields (`OnboardingStep2`): `career` (four radio cards from `CAREER_LABELS`/`CAREER_DESCRIPTIONS`: `Student` / `Learning tracks, labs and free certificates.`, `Business Owner` / `Starter scans and plain-language reporting.`, `Cybersecurity Professional` / `Full-scope pentesting and purple-team work.`, `Independent Specialist` / `Consulting, audits and client engagements.`) and `entity` (three radio cards `Individual` / `Personal account, personal scope.`, `Company` / `Registered business or startup.`, `Corporation` / `Enterprise, group or public entity.`). Radio groups are real `<input type="radio">` inside `<fieldset><legend>`; the card is the label. Required messages: `Select what best describes you.`, `Select an account entity.` (planner copy).
**Stepper:** `<ol aria-label="Onboarding progress">`, items marked `is-active` / `is-done`; the active item `aria-current="step"`; step labels from the markup; clicking a previous step goes back, future steps are not clickable. `Back` / `Continue` buttons as in the markup; focus moves to the step heading on change; scroll to the wizard top (`scrollIntoView({ block: "start" })`, instant under reduced motion).
**Guard:** `GET /api/v1/onboarding` — if `completed` → `router.replace(homeFor(role))`; staff never see this page (redirect to `/admin`).
Hero copy verbatim from the markup (eyebrow, title, sub, meta chips).

**Tests:** under-16 DOB blocked with the verbatim message; email mismatch message; Continue blocked until a career and entity are chosen; stepper state after Back/Next; completed users are redirected.

---

**Data shape (TypeScript):**
```ts
type OnboardingStep1 = { fullName: string; dateOfBirth: string; phone?: string; email: string; emailConfirm: string };
type OnboardingStep2 = { career: CareerRole; entity: EntityType };
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// GET /api/v1/onboarding → 200 { data: { completed: boolean; completedAt: string | null } }
```

---

**Out of scope:**
- Do not build step 3 or submission (Task 65).
- Do not persist partial answers to the server or browser storage.
- Do not show this page to staff.

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
☐ Report at the end: `Task 64 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---


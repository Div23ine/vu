### TASK 61 — Signup page A: details form, validation, strength meter

**Layer:** L7

**Prerequisites:** Task 10, Task 40d, Task 42, Task 59

**Estimated files touched:** 9

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Signup page A: details form, validation, strength meter**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the `/signup` route and its details form; submitting starts the verified signup (verification dialog is Task 62).

**Deliverables:**
- `apps/web/src/app/(auth)/signup/page.tsx`
- `apps/web/src/app/(auth)/signup/_components/signup-card.tsx` (client)
- `apps/web/src/app/(auth)/signup/_components/password-strength.tsx`
- `apps/web/src/app/(auth)/signup/_hooks/use-signup.ts`
- `apps/web/src/app/(auth)/signup/_store/signup-store.ts` — in-memory `{ email, fullName }` shared with Task 62.
- `apps/web/src/app/(auth)/_styles/signup.css`
- `apps/web/src/app/(auth)/signup/signup-a.test.tsx`
- MODIFY `apps/web/src/app/(auth)/signup/page.tsx` — also mount `<SignupVerifyDialog/>` imported from `./_components/signup-verify-dialog` (create a null stub here; Task 62 overwrites it).

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

##### Background layer
```html
<div class="bg-layer" aria-hidden="true">
 <div class="bg-grid"></div>
 <div class="bg-orb bg-orb--1"></div>
 <div class="bg-orb bg-orb--2"></div>
 <div class="bg-orb bg-orb--3"></div>
 <div class="bg-wire">
  <span class="wire wire--nav"></span>
  <span class="wire wire--hero"></span>
  <span class="wire wire--a"></span>
  <span class="wire wire--b"></span>
  <span class="wire wire--c"></span>
  <span class="wire wire--d"></span>
 </div>
</div>
```
Custom CSS for this markup (reference):
```css
.bg-layer { position: fixed; inset: 0; z-index: 0; overflow: hidden; background: radial-gradient(120% 90% at 12% 0%, rgba(59, 153, 252, 0.18), transparent 55%), radial-gradient(110% 85% at 100% 100%, rgba(59, 153, 252, 0.14), transparent 62%), linear-gradient(160deg, var(--dark) 0%, #070a0f 52%, #04060a 100%); }
.bg-grid { position: absolute; inset: -12%; background-image: linear-gradient(to right, rgba(59, 153, 252, 0.11) 1px, transparent 1px), linear-gradient(to bottom, rgba(59, 153, 252, 0.11) 1px, transparent 1px); background-size: 58px 58px; -webkit-mask-image: radial-gradient(66% 62% at 50% 45%, #000 10%, transparent 80%); mask-image: radial-gradient(66% 62% at 50% 45%, #000 10%, transparent 80%); animation: gridDrift 22s linear infinite; }
.bg-orb { position: absolute; border-radius: 50%; filter: blur(90px); opacity: 0.5; pointer-events: none; }
.bg-orb--1 { top: -12%; left: -8%; width: 520px; height: 520px; background: radial-gradient(closest-side, rgba(59, 153, 252, 0.55), transparent 72%); animation: orbFloat 16s ease-in-out infinite; }
.bg-orb--2 { bottom: -18%; right: -10%; width: 620px; height: 620px; background: radial-gradient(closest-side, rgba(30, 123, 224, 0.45), transparent 72%); animation: orbFloat 20s ease-in-out infinite reverse; }
.bg-orb--3 { top: 38%; left: 58%; width: 380px; height: 380px; background: radial-gradient(closest-side, rgba(111, 182, 255, 0.28), transparent 72%); animation: orbFloat 24s ease-in-out infinite; }
.bg-wire { position: absolute; inset: 0; pointer-events: none; opacity: 0.55; }
.wire { position: absolute; border: 1px solid rgba(59, 153, 252, 0.22); border-radius: 16px; background: rgba(255, 255, 255, 0.02); }
.wire--nav { top: 4%; left: 6%; width: 88%; height: 56px; }
.wire--hero { top: 16%; left: 6%; width: 52%; height: 210px; }
.wire--a { top: 16%; left: 62%; width: 32%; height: 96px; }
.wire--b { top: 34%; left: 62%; width: 32%; height: 96px; }
.wire--c { top: 58%; left: 6%; width: 40%; height: 150px; }
.wire--d { top: 58%; left: 50%; width: 44%; height: 150px; }
@media (prefers-reduced-motion: reduce) {
.bg-orb, .bg-grid { animation: none !important; }
}
@keyframes gridDrift { from { background-position: 0 0, 0 0; } to { background-position: 0 58px, 58px 0; } }
@keyframes orbFloat { 0%, 100% { transform: translate3d(0, 0, 0) scale(1); } 50% { transform: translate3d(24px, -34px, 0) scale(1.08); } }
```

##### Signup card
```html
<main class="card" role="dialog" aria-modal="true" aria-labelledby="signupTitle">
 <div class="card-head">
  <div class="brand-mark">
   <span class="brand-tile">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </span>
   <span class="brand-name">VUNVAULT</span>
  </div>
  <h1 class="card-title" id="signupTitle">Create your account</h1>
  <p class="card-sub">Join the platform that finds the cracks before they do.</p>
 </div>
 <div class="social-grid">
  <button type="button" class="social-btn">
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
   <span>Google</span>
  </button>
  [+2 more sibling <button> elements with the SAME structure as the one above; their text content in order: GitHub || Microsoft]
 </div>
 <div class="divider">or</div>
 <form class="form" id="signupForm" autocomplete="on">
  <div class="field">
   <label for="fullName">Full name</label>
   <input class="input" type="text" id="fullName" name="fullName" placeholder="Jane Wanjiru" autocomplete="name"/>
   <span class="err"></span>
  </div>
  <div class="field-row">
   <div class="field">
    <label for="phone">Phone number</label>
    <input class="input" type="tel" id="phone" name="phone" placeholder="+254 705 998 032" autocomplete="tel"/>
    <span class="err"></span>
   </div>
   <div class="field">
    <label for="country">Country</label>
    <select class="input" id="country" name="country" required>
     <option value disabled>Select country…</option>
     <option value="KE">Kenya</option>
     <option value="UG">Uganda</option>
     <option value="TZ">Tanzania</option>
     <option value="RW">Rwanda</option>
     <option value="NG">Nigeria</option>
     <option value="GH">Ghana</option>
     <option value="ZA">South Africa</option>
     <option value="EG">Egypt</option>
     <option value="ET">Ethiopia</option>
     <option value="US">United States</option>
     <option value="GB">United Kingdom</option>
     <option value="CA">Canada</option>
     <option value="DE">Germany</option>
     <option value="FR">France</option>
     <option value="IN">India</option>
     <option value="AE">United Arab Emirates</option>
     <option value="AU">Australia</option>
     <option value="OTHER">Other</option>
    </select>
    <span class="err"></span>
   </div>
  </div>
  <div class="field">
   <span class="field-label">Account type</span>
   <div class="radio-row">
    <label class="radio-card">
     <input type="radio" name="accountType" value="Individual"/>
     <span class="radio-body">
      <span class="radio-dot" aria-hidden="true"></span>
      <span class="radio-text">
       <span class="radio-title">Individual</span>
       <span class="radio-sub">Personal account</span>
      </span>
     </span>
    </label>
    <label class="radio-card">
     <input type="radio" name="accountType" value="Company"/>
     <span class="radio-body">
      <span class="radio-dot" aria-hidden="true"></span>
      <span class="radio-text">
       <span class="radio-title">Company</span>
       <span class="radio-sub">Team / organisation</span>
      </span>
     </span>
    </label>
   </div>
  </div>
  [+3 more sibling <div> elements with the SAME structure as the one above; their text content in order: Email address || Password ¦ — || Confirm password]
  <button type="submit" class="btn-primary" id="signupBtn">
   <span>Sign Up</span>
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
  </button>
  <p class="legal">
   By creating an account you agree to our
   <a href="#">Terms of Service</a>
   and
   <a href="#">Privacy Policy</a>
   .
  </p>
 </form>
 <div class="card-foot">
  Already have an account?
  <a href="/login">Log in</a>
 </div>
 <div class="secure-note">
  <svg data-icon="REPLACE-WITH-LUCIDE"/>
  256-bit encrypted · 2FA protected
 </div>
</main>
```
Custom CSS for this markup (reference):
```css
.card { position: relative; width: min(500px, 100%); padding: 32px 32px 26px; border-radius: var(--r-2xl); background: linear-gradient(180deg, #ffffff 0%, #fdfefe 100%); border: 1px solid rgba(59, 153, 252, 0.18); box-shadow: 0 50px 100px -45px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.05) inset, 0 0 70px -40px var(--brand-glow); animation: cardIn 0.5s var(--ease) both; }
.card::before { content: ""; position: absolute; top: 0; left: 12%; right: 12%; height: 1px; background: linear-gradient(90deg, transparent, var(--brand), transparent); opacity: 0.7; border-radius: var(--r-full); }
.card-head { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; margin-bottom: 24px; }
.brand-mark { display: inline-flex; align-items: center; gap: 10px; }
.brand-tile { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; background: linear-gradient(145deg, var(--dark), #000); border: 1px solid rgba(59, 153, 252, 0.35); box-shadow: 0 8px 22px -12px var(--brand-glow); }
.brand-tile svg { width: 20px; height: 20px; }
.brand-name { font-size: 1.05rem; font-weight: 800; letter-spacing: 0.16em; color: var(--ink); }
.card-title { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em; color: var(--ink); }
.card-sub { font-size: 0.84rem; line-height: 1.6; color: var(--ink-muted); max-width: 34ch; }
.social-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.social-btn { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 11px 8px; font-size: 0.78rem; font-weight: 700; color: var(--ink); background: #ffffff; border: 1px solid var(--line); border-radius: var(--r-md); transition: transform 0.2s var(--ease), border-color 0.2s var(--ease), box-shadow 0.2s var(--ease), background-color 0.2s var(--ease); }
.social-btn:hover { transform: translateY(-2px); border-color: var(--brand-line); background: #fbfdff; box-shadow: 0 14px 28px -20px rgba(10, 13, 18, 0.6); }
.social-btn:active { transform: translateY(0) scale(0.985); }
.social-btn svg { width: 17px; height: 17px; flex: 0 0 auto; }
.social-btn span { white-space: nowrap; }
.divider { display: flex; align-items: center; gap: 14px; margin: 22px 0; font-size: 10.5px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-faint); }
.divider::before,
.divider::after { content: ""; flex: 1 1 auto; height: 1px; background: linear-gradient(90deg, transparent, var(--line), transparent); }
.form { display: flex; flex-direction: column; gap: 15px; }
.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.field label,
.field-label { font-size: 10.5px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-muted); }
.input,
select.input { width: 100%; padding: 12px 14px; font-family: inherit; font-size: 0.88rem; color: var(--ink); background: #ffffff; border: 1px solid var(--line); border-radius: var(--r-md); outline: none; transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease), background-color 0.2s var(--ease); }
.input::placeholder { color: var(--ink-faint); }
.input:hover { border-color: #d4d4d4; }
.input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-tint); background: #ffffff; }
.input.is-invalid { border-color: var(--critical); box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.14); animation: shake 0.32s var(--ease); }
select.input { appearance: none; -webkit-appearance: none; padding-right: 38px; background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%233B99FC' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 13px center; cursor: pointer; }
select.input:invalid { color: var(--ink-faint); }
.pw-wrap .input { padding-right: 48px; }
.err { font-size: 0.72rem; font-weight: 600; color: var(--critical); min-height: 0; opacity: 0; transform: translateY(-3px); transition: opacity 0.2s var(--ease), transform 0.2s var(--ease); }
.err.is-visible { opacity: 1; transform: translateY(0); }
.radio-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.radio-card { position: relative; display: block; cursor: pointer; }
.radio-card input { position: absolute; opacity: 0; width: 0; height: 0; pointer-events: none; }
.radio-body { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: 1px solid var(--line); border-radius: var(--r-md); background: #ffffff; transition: border-color 0.2s var(--ease), background-color 0.2s var(--ease), box-shadow 0.2s var(--ease); }
.radio-card:hover .radio-body { border-color: #d4d4d4; }
.radio-dot { flex: 0 0 auto; width: 16px; height: 16px; border-radius: 50%; border: 1.5px solid #cfcfcf; background: #ffffff; position: relative; transition: border-color 0.2s var(--ease); }
.radio-dot::after { content: ""; position: absolute; inset: 3px; border-radius: 50%; background: var(--brand); transform: scale(0); transition: transform 0.2s var(--ease); }
.radio-text { display: flex; flex-direction: column; min-width: 0; }
.radio-title { font-size: 0.82rem; font-weight: 700; color: var(--ink); line-height: 1.3; }
.radio-sub { font-size: 0.68rem; color: var(--ink-faint); line-height: 1.4; }
.radio-card input:checked + .radio-body { border-color: var(--brand); background: var(--brand-tint); box-shadow: 0 0 0 3px rgba(59, 153, 252, 0.1); }
.radio-card input:checked + .radio-body .radio-dot { border-color: var(--brand); }
.radio-card input:checked + .radio-body .radio-dot::after { transform: scale(1); }
.radio-card input:focus-visible + .radio-body { box-shadow: 0 0 0 3px var(--brand-tint); }
.btn-primary { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 10px; width: 100%; margin-top: 6px; padding: 15px 24px; font-size: 0.88rem; font-weight: 800; letter-spacing: 0.01em; color: #ffffff; background: linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%); border: 1px solid rgba(59, 153, 252, 0.5); border-radius: var(--r-full); box-shadow: 0 16px 34px -16px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.25); transition: transform 0.22s var(--ease), filter 0.22s var(--ease), box-shadow 0.22s var(--ease), opacity 0.2s var(--ease); }
.btn-primary:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 22px 46px -18px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.3); }
.btn-primary:active:not(:disabled) { transform: translateY(0) scale(0.99); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-primary svg { width: 16px; height: 16px; }
.legal { margin-top: 14px; font-size: 0.7rem; line-height: 1.65; text-align: center; color: var(--ink-faint); }
.legal a { color: var(--brand-strong); font-weight: 600; }
.legal a:hover { text-decoration: underline; }
.card-foot { margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--line-soft); text-align: center; font-size: 0.82rem; color: var(--ink-muted); }
.card-foot a { font-weight: 800; color: var(--brand-strong); transition: color 0.2s var(--ease); }
.card-foot a:hover { color: var(--brand); text-decoration: underline; }
.secure-note { display: flex; align-items: center; justify-content: center; gap: 7px; margin-top: 14px; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-faint); }
.secure-note svg { width: 12px; height: 12px; color: var(--ok); }
.step-actions .btn-primary { margin-top: 0; flex: 1 1 auto; }
@media (max-width: 520px) {
.card { padding: 26px 20px 22px; border-radius: var(--r-xl); }
.card-title { font-size: 1.3rem; }
.social-btn span { display: none; }
.social-btn { padding: 12px 8px; }
.social-btn svg { width: 19px; height: 19px; }
.field-row { grid-template-columns: 1fr; }
.radio-row { grid-template-columns: 1fr; }
}
@keyframes cardIn { from { opacity: 0; transform: translateY(22px) scale(0.975); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
```

**Form (RHF + Zod `SignupBody` from `@vunvault/contracts`):** fields `fullName` (placeholder `Jane Wanjiru`), `phone` (`+254 705 998 032`), `country` (select, first option `Select country…`; options verbatim and in order: Kenya, Uganda, Tanzania, Rwanda, Nigeria, Ghana, South Africa, Egypt, Ethiopia, United States, United Kingdom, Canada, Germany, France, India, United Arab Emirates, Australia, Other — map to ISO codes KE UG TZ RW NG GH ZA EG ET US GB CA DE FR IN AE AU and `Other` → `XX`; NOTE the contract requires a 2-letter code and the API accepts `XX`), `accountType` (radio cards `Individual` / `Personal account` and `Company` / `Team / organisation`), `email` (`you@company.com`), `password` (placeholder `At least 12 characters` — planner edit of `At least 8 characters`, following the API policy), `confirmPassword` (`Re-enter your password`). Validation messages verbatim from the prototype: `Please enter your full name.`, `Enter a valid phone number.`, `Please select your country.`, `Enter a valid email address.`, `Please confirm your password.`, `Passwords do not match.`; password rule message: `Password must be at least 12 characters and include upper and lower case letters, a number and a symbol.` (planner edit of `Password must be at least 8 characters.`). Show/hide toggle on both password fields (`aria-label`s `Show password`/`Hide password`).
**Strength meter (`PasswordStrength`):** four bars + label using `scorePassword()` from `@vunvault/contracts`; labels `Awaiting input`, `Weak`, `Fair`, `Good`, `Strong`; the markup shows the placeholder `—`.
**Submit (`Sign Up`):** `POST /api/v1/auth/signup` → `202 { data: { email, verificationRequired: true, resendAfterSeconds: 30 } }` → store `{ email, fullName }` and open the verification dialog (Task 62). `409 email_taken` → field error on `email`: `An account with this email already exists.`; `422 breached_password` → field error on `password`: `This password has appeared in a data breach. Choose a different one.`; `429` → toast `{ kind: "warn", title: "Too many attempts", message: "Please wait a few minutes before trying again." }`. Failed validation focuses the first invalid field and shows the toast `{ kind: "warn", title: "Check your details", message: "Some fields need your attention before we can continue." }` (verbatim from the prototype). Social buttons: reuse `OAuthButtons` (Task 59) with the start URL and `next=/onboarding`. Footer: `By creating an account you agree to our` `Terms of Service` `and` `Privacy Policy` (links `/terms`, `/privacy` — pages do not exist yet; render as `<a href>` anyway), `Already have an account?` `Log in` → `/login`; secure note `256-bit encrypted · 2FA protected`.
`metadata.title = "Create your account"`.

**Tests:** each validation message; country list order and count; account-type radios; strength label transitions; 202 opens the dialog store with the email; 409 and 422 map to field errors.

---

**Data shape (TypeScript):**
```ts
interface SignupStartResponse { data: { email: string; verificationRequired: true; resendAfterSeconds: 30; expiresInSeconds: 600 } }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/auth/signup body { fullName; email; phone?; country: string(2); accountType: "individual"|"company"; password: string(min12); confirmPassword; description?: string } → 202 SignupStartResponse | 400 | 409 { error: "email_taken" } | 422 { error: "breached_password" } | 429
```

---

**Out of scope:**
- Do not build the verification / 2FA dialog (Task 62).
- Do not send the user to any dashboard here.
- Do not use browser storage.

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
☐ Report at the end: `Task 61 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---


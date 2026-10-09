### TASK 62 — Signup page B: email verification, authenticator enrolment, success

**Layer:** L7

**Prerequisites:** Task 27, Task 40d, Task 60, Task 61

**Estimated files touched:** 8

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Signup page B: email verification, authenticator enrolment, success**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the verification dialog: step 1 email OTP, step 2 TOTP enrolment (QR + secret + code), step 3 success with redirect to onboarding.

**Deliverables:**
- `apps/web/src/app/(auth)/signup/_components/signup-verify-dialog.tsx` — overwrites the Task 61 stub.
- `apps/web/src/app/(auth)/signup/_components/step-tracker.tsx`
- `apps/web/src/app/(auth)/signup/_hooks/use-verify-signup.ts`
- MODIFY `apps/web/src/app/(auth)/_styles/signup.css` — append.
- `apps/web/src/app/(auth)/signup/signup-b.test.tsx`

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

##### Verification modal (3 steps: Email, 2FA, Done)
```html
<div class="verify" id="verifyModal" hidden aria-hidden="true">
 <div class="verify-backdrop"></div>
 <div class="verify-card" role="dialog" aria-modal="true" aria-labelledby="verifyTitle">
  <button type="button" class="verify-close" aria-label="Close verification">
   <svg data-icon="REPLACE-WITH-LUCIDE"/>
  </button>
  <div class="steps" id="stepTracker">
   <div class="step-node">
    <b>1</b>
    <span>Email</span>
   </div>
   <span class="step-line"></span>
   <div class="step-node">
    <b>2</b>
    <span>2FA</span>
   </div>
   <span class="step-line"></span>
   <div class="step-node">
    <b>3</b>
    <span>Done</span>
   </div>
  </div>
  <section class="step" data-step="otp">
   <div class="step-icon">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </div>
   <h2 class="step-title" id="verifyTitle">Verify your email</h2>
   <p class="step-text">
    We sent a 6-digit verification code to
    <br/>
    <strong id="otpTargetEmail">your email</strong>
   </p>
   <div class="otp-row" id="otpRow">
    <input class="otp-input" type="text" inputmode="numeric" maxlength="1" autocomplete="one-time-code" aria-label="Digit 1"/>
    [+5 more sibling <input> elements with the SAME structure as the one above; their text content in order: || || || || ]
   </div>
   <span class="err" id="otpError"></span>
   <div class="test-hint">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <div class="test-hint-body">
     <div class="test-hint-title">Test mode</div>
     <div class="test-hint-text">
      Your email OTP is
      <code id="otpTestCode">------</code>
      — enter it above.
     </div>
    </div>
   </div>
   <div class="step-actions">
    <button type="button" class="btn-ghost">Back</button>
    <button type="button" class="btn-primary" id="verifyOtpBtn" disabled>
     <span>Verify OTP</span>
    </button>
   </div>
   <div class="resend-row">
    Didn't get the code?
    <button type="button" class="resend-btn" id="resendBtn" disabled>Resend in 30s</button>
   </div>
  </section>
  [+2 more sibling <section> elements with the SAME structure as the one above; their text content in order: Two-factor authentication ¦ Scan the secret key in your authenticator app, then enter the 6-digit code it generates. ¦ Your 2FA secret key ¦ ---------------- ¦ Authenticator code ¦ Test mode ¦ Your authenticator code is ¦ ------ ¦ Back ¦ Verify & Create Account || Account Created & Verified! ¦ Welcome to VUNVAULT, ¦ friend ¦ . Your email and two-factor authentication are now active. ¦ Redirecting to your dashboard… ¦ Go now]
 </div>
</div>
```
Custom CSS for this markup (reference):
```css
.err { font-size: 0.72rem; font-weight: 600; color: var(--critical); min-height: 0; opacity: 0; transform: translateY(-3px); transition: opacity 0.2s var(--ease), transform 0.2s var(--ease); }
.err.is-visible { opacity: 1; transform: translateY(0); }
.btn-primary { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 10px; width: 100%; margin-top: 6px; padding: 15px 24px; font-size: 0.88rem; font-weight: 800; letter-spacing: 0.01em; color: #ffffff; background: linear-gradient(135deg, var(--brand) 0%, var(--brand-strong) 100%); border: 1px solid rgba(59, 153, 252, 0.5); border-radius: var(--r-full); box-shadow: 0 16px 34px -16px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.25); transition: transform 0.22s var(--ease), filter 0.22s var(--ease), box-shadow 0.22s var(--ease), opacity 0.2s var(--ease); }
.btn-primary:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 22px 46px -18px var(--brand-glow), inset 0 1px 0 rgba(255, 255, 255, 0.3); }
.btn-primary:active:not(:disabled) { transform: translateY(0) scale(0.99); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-primary svg { width: 16px; height: 16px; }
.verify { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 24px 16px; opacity: 0; transition: opacity 0.25s var(--ease); }
.verify[hidden] { display: none; }
.verify.is-open { opacity: 1; }
.verify-backdrop { position: absolute; inset: 0; background: rgba(4, 6, 10, 0.72); backdrop-filter: blur(14px) saturate(130%); -webkit-backdrop-filter: blur(14px) saturate(130%); }
.verify-card { position: relative; z-index: 1; width: min(440px, 100%); max-height: 92vh; overflow-y: auto; padding: 30px 28px 26px; border-radius: var(--r-2xl); background: #ffffff; border: 1px solid rgba(59, 153, 252, 0.22); box-shadow: 0 46px 96px -42px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.05) inset; transform: translateY(16px) scale(0.98); transition: transform 0.3s var(--ease); scrollbar-width: thin; scrollbar-color: rgba(59, 153, 252, 0.4) transparent; }
.verify.is-open .verify-card { transform: translateY(0) scale(1); }
.verify-card::-webkit-scrollbar { width: 8px; }
.verify-card::-webkit-scrollbar-track { background: transparent; }
.verify-card::-webkit-scrollbar-thumb { background: rgba(59, 153, 252, 0.3); border-radius: 9999px; border: 2px solid transparent; background-clip: padding-box; }
.verify-close { position: absolute; top: 14px; right: 14px; display: grid; place-items: center; width: 34px; height: 34px; border: 0; border-radius: 10px; color: var(--ink-faint); background: transparent; transition: color 0.2s var(--ease), background-color 0.2s var(--ease); }
.verify-close:hover { color: var(--ink); background: #f4f4f4; }
.verify-close svg { width: 17px; height: 17px; }
.steps { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 22px; }
.step-node { display: flex; align-items: center; gap: 8px; font-size: 10px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-faint); transition: color 0.25s var(--ease); }
.step-node b { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid var(--line); font-size: 10px; font-weight: 800; background: #fff; transition: all 0.25s var(--ease); }
.step-node.is-active { color: var(--brand-strong); }
.step-node.is-active b { border-color: var(--brand); background: var(--brand); color: #ffffff; box-shadow: 0 0 0 4px var(--brand-tint); }
.step-node.is-done { color: var(--ok); }
.step-node.is-done b { border-color: var(--ok); background: var(--ok); color: #ffffff; }
.step-line { width: 26px; height: 2px; border-radius: var(--r-full); background: var(--line); transition: background-color 0.25s var(--ease); }
.step-line.is-done { background: var(--ok); }
.step { animation: stepIn 0.32s var(--ease) both; }
.step[hidden] { display: none; }
.step-icon { display: grid; place-items: center; width: 54px; height: 54px; margin: 0 auto 16px; border-radius: 16px; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); }
.step-icon svg { width: 24px; height: 24px; }
.step-title { font-size: 1.2rem; font-weight: 800; letter-spacing: -0.015em; text-align: center; color: var(--ink); }
.step-text { margin-top: 8px; font-size: 0.82rem; line-height: 1.65; text-align: center; color: var(--ink-muted); }
.step-text strong { color: var(--ink); font-weight: 700; }
.otp-row { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 9px; margin: 22px 0 6px; }
.otp-input { width: 100%; height: 56px; text-align: center; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 1.3rem; font-weight: 800; color: var(--ink); background: #ffffff; border: 1.5px solid var(--line); border-radius: var(--r-md); outline: none; transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease), background-color 0.2s var(--ease), transform 0.15s var(--ease); caret-color: var(--brand); }
.otp-input:hover { border-color: #d4d4d4; }
.otp-input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-tint); transform: translateY(-2px); }
.otp-input.is-filled { border-color: var(--brand-line); background: var(--brand-tint); }
.otp-row.is-invalid .otp-input { border-color: var(--critical); animation: shake 0.34s var(--ease); }
.test-hint { display: flex; align-items: flex-start; gap: 10px; margin-top: 16px; padding: 12px 14px; border-radius: var(--r-md); background: rgba(245, 158, 11, 0.08); border: 1px dashed rgba(245, 158, 11, 0.5); }
.test-hint svg { flex: 0 0 auto; width: 15px; height: 15px; margin-top: 1px; color: var(--warn); }
.test-hint-body { min-width: 0; }
.test-hint-title { font-size: 9.5px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #b45309; }
.test-hint-text { margin-top: 4px; font-size: 0.74rem; line-height: 1.55; color: #92400e; }
.test-hint code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.88rem; font-weight: 800; letter-spacing: 0.14em; color: #7c2d12; background: rgba(255, 255, 255, 0.75); border: 1px solid rgba(245, 158, 11, 0.45); border-radius: 6px; padding: 1px 7px; }
.step-actions { display: flex; align-items: center; gap: 10px; margin-top: 18px; }
.btn-ghost { flex: 0 0 auto; padding: 14px 18px; font-size: 0.8rem; font-weight: 700; color: var(--ink-soft); background: #f5f5f5; border: 1px solid var(--line); border-radius: var(--r-full); transition: color 0.2s var(--ease), background-color 0.2s var(--ease), border-color 0.2s var(--ease); }
.btn-ghost:hover:not(:disabled) { color: var(--ink); background: #ededed; border-color: #d4d4d4; }
.btn-ghost:disabled { opacity: 0.55; cursor: not-allowed; }
.step-actions .btn-primary { margin-top: 0; flex: 1 1 auto; }
.resend-row { margin-top: 14px; text-align: center; font-size: 0.76rem; color: var(--ink-muted); }
.resend-btn { border: 0; background: none; padding: 0; font-size: 0.76rem; font-weight: 800; color: var(--brand-strong); transition: color 0.2s var(--ease); }
.resend-btn:disabled { color: var(--ink-faint); cursor: not-allowed; }
.resend-btn:hover:not(:disabled) { color: var(--brand); text-decoration: underline; }
@media (max-width: 520px) {
.otp-row { gap: 6px; }
.otp-input { height: 48px; font-size: 1.1rem; }
.verify-card { padding: 24px 18px 22px; }
.step-actions { flex-direction: column-reverse; }
.step-actions .btn-ghost { width: 100%; }
}
@media (max-width: 380px) {
.otp-input { height: 44px; font-size: 1rem; border-radius: 9px; }
.step-node span { display: none; }
}
@keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
@keyframes stepIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
```

**Prototype behaviour to port (reference JS for step handling; REMOVE every "Test mode" hint panel and the fake in-page OTP/authenticator generation — the `test-hint` blocks must not exist; REMOVE the fake secret generator):**
```js
(function () {
 "use strict";
 var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
 var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
 var toastStack = $("#toastStack");
 var ICONS = {
 info: '<path d="M12 16v-4"/><path d="M12 8h.01"/><circle cx="12" cy="12" r="10"/>',
 ok: '<path d="M20 6 9 17l-5-5"/>',
 warn: '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>',
 error: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>'
 };
 function toast(options) {
 var opts = options || {};
 var type = opts.type || "info";
 var duration = typeof opts.duration === "number" ? opts.duration : 8000;
 var el = document.createElement("div");
 el.className = "toast toast--" + type;
 var iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
 'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
 (ICONS[type] || ICONS.info) + "</svg>";
 var html = "";
 html += '<div class="toast-icon">' + iconSvg + "</div>";
 html += '<div class="toast-body">';
 if (opts.title) html += '<div class="toast-title">' + escapeHtml(opts.title) + "</div>";
 if (opts.message) html += '<div class="toast-msg">' + escapeHtml(opts.message) + "</div>";
 if (opts.code) html += '<div class="toast-code">' + escapeHtml(opts.code) + "</div>";
 html += "</div>";
 html += '<button type="button" class="toast-close" aria-label="Dismiss notification">' +
 '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" ' +
 'stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>' +
 "</button>";
 el.innerHTML = html;
 toastStack.appendChild(el);
 var remove = function () {
 if (!el.parentNode) return;
 el.classList.add("is-leaving");
 window.setTimeout(function () {
 if (el.parentNode) el.parentNode.removeChild(el);
 }, 300);
 };
 $(".toast-close", el).addEventListener("click", remove);
 requestAnimationFrame(function () {
 requestAnimationFrame(function () { el.classList.add("is-visible"); });
 });
 if (duration > 0) window.setTimeout(remove, duration);
 return el;
 }
 function escapeHtml(str) {
 return String(str)
 .replace(/&/g, "&amp;")
 .replace(/</g, "&lt;")
 .replace(/>/g, "&gt;")
 .replace(/"/g, "&quot;")
 .replace(/'/g, "&#39;");
 }
 var state = {
 otp: null,
 totp: null,
 secret: null,
 email: "",
 name: ""
 };
 var resendTimer = null;
 var redirectTimer = null;
 function randomDigits(len) {
 var out = "";
 for (var i = 0; i < len; i++) out += Math.floor(Math.random() * 10);
 return out;
 }
 function generateOtp() { return randomDigits(6); }
 function generateTotp() { return randomDigits(6); }
 function generateBase32Secret(len) {
 var alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
 var out = "";
 for (var i = 0; i < (len || 16); i++) {
 out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
 }
 return out;
 }
 $$("[data-toggle-pw]").forEach(function (btn) {
 btn.addEventListener("click", function () {
 var input = document.getElementById(btn.getAttribute("data-toggle-pw"));
 if (!input) return;
 var show = input.type === "password";
 input.type = show ? "text" : "password";
 btn.classList.toggle("is-visible", show);
 btn.setAttribute("aria-pressed", show ? "true" : "false");
 btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
 input.focus({ preventScroll: true });
 });
 });
 var pwInput = $("#password");
 var strengthEl = $("#strength");
 var strengthLabel = $("#strengthLabel");
 var LABELS = ["—", "Weak", "Fair", "Good", "Strong"];
 function scorePassword(value) {
 if (!value) return 0;
 var score = 0;
 if (value.length >= 8) score++;
 if (value.length >= 12) score++;
 if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
 if (/\d/.test(value)) score++;
 if (/[^A-Za-z0-9]/.test(value)) score++;
 return Math.min(4, score);
 }
 pwInput.addEventListener("input", function () {
 var level = scorePassword(pwInput.value);
 strengthEl.setAttribute("data-level", String(level));
 strengthLabel.textContent = LABELS[level];
 });
 func
/* …truncated by planner… */
```
**Real flow:**
1. **Step 1 — Verify your email:** title `Verify your email`, text `We sent a 6-digit verification code to` + the address. Reuse `OtpInput` (Task 60). Submit → `POST /api/v1/auth/signup/verify-email { email, code }`: `200` → session cookies are set by the API (aal1) → step 2; `otp_invalid` → verbatim `That code is incorrect. Please try again.`; `otp_exhausted` → `Too many incorrect attempts. Request a new code.` (planner copy) and the boxes disable until `Resend`; `410 otp_expired` → `That code has expired. Request a new one.`; incomplete → `Please enter all 6 digits.`. `Back` closes the dialog (the pending account is cleaned up by the API after 24 h). `Resend in 30s` countdown, then a link that calls `POST /api/v1/auth/signup/resend` and toasts `{ kind: "ok", title: "Verification code sent", message: "A fresh verification code was sent to <email>" }`; toast on step 1 success: `{ kind: "ok", title: "Email verified", message: "Now let's set up two-factor authentication." }`.
2. **Step 2 — Two-factor authentication:** text `Scan the secret key in your authenticator app, then enter the 6-digit code it generates.` On entering the step call `POST /api/v1/account/mfa/totp/enroll` → show the QR (`qrCodeSvg` rendered as `<img alt="Authenticator QR code" src="data:image/svg+xml;utf8,<encoded>">` — NEVER inject the SVG with `dangerouslySetInnerHTML`) above the secret panel (`Your 2FA secret key` + the base32 secret grouped in 4s, with a `Copy` button that toasts `Secret copied`), and a code input (`Authenticator code`, placeholder `000000`, `inputmode="numeric"`). Submit button `Verify & Create Account` → `POST /api/v1/account/mfa/totp/verify { factorId, code }`; wrong code → `That authenticator code is incorrect.` / `Please enter the full 6-digit code.`; success → step 3. (Planner decision: authenticator enrolment is mandatory at signup, as in the prototype.)
3. **Step 3 — Done:** title `Account Created & Verified!`, text `Welcome to VUNVAULT, <first name>.` `Your email and two-factor authentication are now active.` `Redirecting to your dashboard…` with the progress bar (`redirect-bar`, 2.5 s; instant under reduced motion) and the `Go now` button; then `router.replace("/onboarding")` (the onboarding wizard completes the profile). Toast: `{ kind: "ok", title: "Account Created & Verified!", message: "Two-factor authentication is now active on your account." }`.
The step tracker labels are `Email`, `2FA`, `Done` with numbers 1–3 (`aria-current="step"` on the active one). Dialog semantics: `role="dialog"`, `aria-modal`, `aria-labelledby="verifyTitle"`, focus trap, Escape closes ONLY on step 1.

**Tests:** step 1 wrong/incomplete/expired messages; correct code advances and shows the toast; QR rendered through `<img>` (no `innerHTML`); TOTP verify error and success; step 3 redirects to `/onboarding` after the timer (fake timers); no element with text `Test mode` exists.

---

**Data shape (TypeScript):**
```ts
interface TotpEnrollStart { data: { factorId: string; qrCodeSvg: string; secret: string; uri: string } }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/auth/signup/verify-email body { email; code: string(6) } → 200 { data: SessionUser } | 401 { error: "otp_invalid" | "otp_exhausted" } | 410 otp_expired | 429
// POST /api/v1/auth/signup/resend body { email } → 202 {}
// POST /api/v1/account/mfa/totp/enroll → 201 TotpEnrollStart
// POST /api/v1/account/mfa/totp/verify body { factorId; code: string(6) } → 204 | 401 { error: "mfa_failed" }
```

---

**Out of scope:**
- Do not render any 'test mode' OTP or secret.
- Do not use `innerHTML`/`dangerouslySetInnerHTML`.
- Do not build onboarding (Tasks 64–65).

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
☐ Report at the end: `Task 62 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---


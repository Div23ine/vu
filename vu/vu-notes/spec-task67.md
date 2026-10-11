### TASK 67 — Password Manager & Security page: password change, TOTP, security key, recovery codes

**Layer:** L8

**Prerequisites:** Task 27, Task 45, Task 42, Task 10

**Estimated files touched:** 14

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Password Manager & Security page: password change, TOTP, security key, recovery codes**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build `/portal/security` on the real credentials API: change password with live rules and strength, authenticator-app enrolment with QR, WebAuthn key registration, and one-time recovery codes.

**Deliverables:**
- `apps/web/src/app/(authed)/portal/security/page.tsx`
- `apps/web/src/app/(authed)/portal/security/_components/security-hero.tsx`, `change-password-card.tsx`, `two-factor-card.tsx`, `totp-panel.tsx`, `security-key-panel.tsx`, `recovery-keys-card.tsx`, `regenerate-dialog.tsx`
- `apps/web/src/app/(authed)/portal/security/_hooks/use-security.ts`
- `apps/web/src/app/(authed)/portal/security/_lib/webauthn-register.ts`
- `apps/web/src/app/(authed)/portal/security/_styles/security.css`
- `apps/web/src/components/password-strength.tsx` — MOVE target: create the shared component here only if Task 61 placed it elsewhere; otherwise import it.
- `apps/web/src/mocks/handlers/security.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- `apps/web/src/app/(authed)/portal/security/security.test.tsx`

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

##### Password Manager page body (security cards are compressed; the bracketed notes list every string)
```html
<main class="flex-1">
 <section class="pt-10 md:pt-14">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
   <div class="max-w-3xl space-y-4">
    <span class="vpm-eyebrow">Security & Account Protection</span>
    <h1 class="text-3xl sm:text-4xl md:text-5xl font-extrabold text-neutral-900 tracking-tight leading-[1.15]">Password Manager & Security</h1>
    <p class="text-neutral-500 text-base sm:text-lg leading-relaxed">Rotate your credentials, harden your account with two-factor authentication and generate offline recovery keys you can trust when everything else fails.</p>
   </div>
  </div>
 </section>
 <section class="pt-10 md:pt-12 pb-16 md:pb-20">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
   <div class="vpm-stack">
    <div class="vpm-card">
     <div class="vpm-card-head">
      <span class="vpm-card-icon" aria-hidden="true">
       <svg data-icon="REPLACE-WITH-LUCIDE"/>
      </span>
      <div>
       <h2 class="vpm-card-title">Change Password</h2>
       <p class="vpm-card-sub">Choose a strong, unique passphrase. VUNVAULT stores only a salted hash — we can never read your password.</p>
      </div>
     </div>
     <form id="vpm-password-form">
      <div class="vpm-field">
       <label for="pw-current">Current Password</label>
       <div class="vpm-pw-wrap">
        <input id="pw-current" name="currentPassword" class="vpm-input" type="password" placeholder="Enter your current password" autocomplete="current-password" required/>
        <button type="button" class="vpm-pw-toggle" aria-label="Show current password">
         <svg data-icon="REPLACE-WITH-LUCIDE"/>
        </button>
       </div>
      </div>
      [+2 more sibling <div> elements with the SAME structure as the one above; their text content in order: New Password ¦ Awaiting input ¦ Use 12+ characters with mixed cases, numbers and symbols. ¦ At least 12 characters ¦ One uppercase letter ¦ One lowercase letter ¦ One number ¦ One symbol (!@#$…) || Confirm New Password ¦ Both entries must match exactly.]
      <div class="vpm-modal-actions">
       <button type="button" class="vpm-btn vpm-btn--ghost" id="vpm-pw-reset">Clear Fields</button>
       <button type="submit" class="vpm-btn vpm-btn--primary" id="vpm-pw-submit">
        <svg data-icon="REPLACE-WITH-LUCIDE"/>
        <span>Update Password</span>
       </button>
      </div>
     </form>
    </div>
    [+2 more sibling <div> elements with the SAME structure as the one above; their text content in order: Two-Factor Authentication ¦ Add a second proof of identity. We recommend enabling at least one method — an authenticator app or a hardware token. ¦ Authenticator App (TOTP) ¦ Not enabled ¦ Use Google Authenticator, Authy, 1Password or any TOTP-compatible app. Generates a fresh 6-digit code every 30 seconds. ¦ Off ¦ 1 ¦ Open your authenticator app and choose ¦ “Add account” ¦ → ¦ “Scan QR code” ¦ . ¦ 2 ¦ Point your camera at the QR code on the left. Can’t scan? Enter the setup key manually below. ¦ 3 ¦ Enter the ¦ 6-digit code ¦ your app generates to confirm setup. ¦ JBSWY3DPEHPK3PXP ¦ Copy ¦ Verification Code ¦ Verify & Enable ¦ Cancel ¦ Hardware Security Key (FIDO2 / WebAuthn) ¦ No keys registered ¦ YubiKey, Google Titan, Feitian and any FIDO2-certified key. Phishing-resistant — the strongest factor available today. ¦ Register Key || Recovery Keys ¦ Single-use backup codes for when you lose your phone, token or network access. Print them and store them offline. ¦ No recovery keys generated yet ¦ Generate a set of 10 single-use emergency codes. Each code can be used exactly once to regain access to your account. ¦ Generate Recovery Keys ¦ Emergency Backup Codes ¦ Generated just now · 10 of 10 unused ¦ These codes are shown once. Print them, store them in a safe, and never share them — anyone with a code can bypass your two-factor authentication. ¦ Hide Codes ¦ Print Codes ¦ Regenerate]
   </div>
  </div>
 </section>
</main>
```
Custom CSS for this markup (reference):
```css
.vpm-btn { display: inline-flex; align-items: center; justify-content: center; gap: 9px; padding: 13px 24px; font-size: 0.8rem; font-weight: 800; letter-spacing: 0.01em; border-radius: var(--r-full); border: 1px solid transparent; cursor: pointer; white-space: nowrap; text-decoration: none; transition: transform 0.22s var(--ease), filter 0.22s var(--ease), box-shadow 0.22s var(--ease), background-color 0.22s var(--ease), border-color 0.22s var(--ease), color 0.22s var(--ease); }
.vpm-btn svg { transition: transform 0.22s var(--ease); }
.vpm-btn:active { transform: translateY(0) scale(0.98); }
.vpm-btn--primary { color: #04121f; background: linear-gradient(135deg, var(--brand-soft), var(--brand)); border-color: rgba(59, 153, 252, 0.45); box-shadow: 0 16px 34px -16px var(--brand-glow); }
.vpm-btn--primary:hover { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 22px 46px -18px var(--brand-glow); }
.vpm-btn--ghost { color: var(--ink-soft); background: #ffffff; border-color: var(--line); }
.vpm-btn--ghost:hover { color: var(--ink); border-color: var(--brand-line); background: var(--brand-tint); transform: translateY(-1px); }
.vpm-btn[disabled] { opacity: 0.55; cursor: not-allowed; transform: none; filter: none; }
.vpm-eyebrow { display: inline-block; padding: 6px 14px; font-size: 0.66rem; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); border-radius: var(--r-full); }
.vpm-card { position: relative; padding: 28px 30px; border-radius: var(--r-2xl); background: rgba(255, 255, 255, 0.78); backdrop-filter: blur(14px) saturate(1.4); -webkit-backdrop-filter: blur(14px) saturate(1.4); border: 1px solid rgba(59, 153, 252, 0.14); box-shadow: 0 8px 32px rgba(10, 13, 18, 0.06); transition: border-color 0.28s var(--ease), box-shadow 0.28s var(--ease); }
.vpm-card:hover { border-color: var(--brand-line); box-shadow: 0 22px 50px -36px rgba(10, 13, 18, 0.45); }
.vpm-card-head { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 22px; padding-bottom: 20px; border-bottom: 1px solid var(--line-soft); }
.vpm-card-icon { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 14px; color: var(--brand-strong); background: var(--brand-tint); border: 1px solid var(--brand-line); }
.vpm-card-title { font-size: 1.05rem; font-weight: 800; letter-spacing: -0.01em; color: var(--ink); line-height: 1.35; }
.vpm-card-sub { margin-top: 4px; font-size: 0.78rem; line-height: 1.6; color: var(--ink-muted); }
.vpm-stack { display: flex; flex-direction: column; gap: 22px; max-width: 900px; margin-inline: auto; }
.vpm-field { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.vpm-field > label { font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-muted); }
.vpm-input { width: 100%; padding: 12px 14px; font-size: 0.84rem; font-family: inherit; color: var(--ink); background: #ffffff; border: 1px solid var(--line); border-radius: var(--r-md); outline: none; transition: border-color var(--dur) var(--ease), box-shadow var(--dur) var(--ease); }
.vpm-input::placeholder { color: var(--ink-faint); }
.vpm-input:focus { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-tint); }
.vpm-input.is-invalid { border-color: var(--critical); box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.16); }
.vpm-pw-wrap { position: relative; display: flex; align-items: center; }
.vpm-pw-wrap .vpm-input { padding-right: 46px; }
.vpm-pw-toggle { position: absolute; right: 6px; display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; color: var(--ink-faint); background: transparent; border: 0; cursor: pointer; transition: color 0.2s var(--ease), background-color 0.2s var(--ease); }
.vpm-pw-toggle:hover { color: var(--brand-strong); background: var(--brand-tint); }
.vpm-pw-toggle:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--brand-tint); }
.vpm-verify .vpm-field { flex: 1 1 200px; }
.vpm-verify .vpm-input { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 1rem; font-weight: 700; letter-spacing: 0.32em; text-align: center; text-indent: 0.32em; }
.vpm-modal-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 26px; padding-top: 22px; border-top: 1px solid var(--line-soft); }
@media (max-width: 768px) {
.vpm-card { padding: 22px 20px; }
.vpm-card-head { gap: 12px; }
.vpm-modal-actions { flex-direction: column-reverse; align-items: stretch; }
.vpm-modal-actions .vpm-btn { width: 100%; }
.vpm-verify .vpm-btn { width: 100%; }
}
@media (max-width: 640px) {
.vpm-keys-actions .vpm-btn { flex: 1 1 auto; }
}
@media (prefers-reduced-motion: reduce) {
.vpm-modal,
      .vpm-modal-card,
      .vpm-toast,
      .vpm-btn,
      .vpm-switch-track,
      .vpm-switch-track::after,
      .vpm-strength-bar { transition-duration: 0.001ms !important; }
}
```

##### Regenerate recovery keys confirmation dialog
```html
<div id="regenerateKeysModal" class="vpm-modal" hidden aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="vpm-regen-title">
 <div class="vpm-modal-backdrop"></div>
 <div class="vpm-modal-card" role="document">
  <div class="vpm-modal-head">
   <div>
    <span class="vpm-eyebrow">Irreversible action</span>
    <h2 id="vpm-regen-title" class="vpm-modal-title">Regenerate Recovery Keys?</h2>
    <p class="vpm-modal-text">Your existing 10 recovery codes will be permanently invalidated the moment new ones are created. Any printed copies you hold will stop working.</p>
   </div>
   <button type="button" class="vpm-modal-close" aria-label="Close dialog">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
   </button>
  </div>
  <div class="vpm-modal-actions">
   <p class="vpm-modal-note">Confirm only if you have lost your codes or suspect they may have leaked.</p>
   <button type="button" class="vpm-btn vpm-btn--ghost">Keep Existing Codes</button>
   <button type="button" class="vpm-btn vpm-btn--danger" id="vpm-regen-confirm">
    <svg data-icon="REPLACE-WITH-LUCIDE"/>
    <span>Yes, Regenerate</span>
   </button>
  </div>
 </div>
</div>
```
Custom CSS for this markup (reference):
```css
.vpm-btn--danger { color: #9f1239; background: #fff1f2; border-color: #fecdd3; }
.vpm-btn--danger:hover { color: #ffffff; background: linear-gradient(135deg, var(--critical), #be123c); border-color: transparent; transform: translateY(-1px); box-shadow: 0 14px 30px -16px rgba(244, 63, 94, 0.7); }
.vpm-modal { position: fixed; inset: 0; z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; opacity: 0; transition: opacity 0.22s var(--ease); }
.vpm-modal[hidden] { display: none !important; }
.vpm-modal.is-open { opacity: 1; }
.vpm-modal-backdrop { position: absolute; inset: 0; background: rgba(5, 7, 10, 0.74); backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px); }
.vpm-modal-card { position: relative; z-index: 1; display: flex; flex-direction: column; width: min(620px, 100%); max-height: 90vh; overflow-y: auto; padding: 30px 32px 32px; border-radius: var(--r-2xl); background: radial-gradient(120% 90% at 100% 0%, rgba(59, 153, 252, 0.08), transparent 55%), #ffffff; border: 1px solid rgba(59, 153, 252, 0.22); box-shadow: 0 40px 90px -40px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.03) inset; transform: translateY(18px) scale(0.985); transition: transform 0.28s var(--ease); scrollbar-width: thin; scrollbar-color: rgba(59, 153, 252, 0.35) transparent; }
.vpm-modal.is-open .vpm-modal-card { transform: translateY(0) scale(1); }
.vpm-modal-card::-webkit-scrollbar { width: 8px; }
.vpm-modal-card::-webkit-scrollbar-track { background: transparent; }
.vpm-modal-card::-webkit-scrollbar-thumb { background: rgba(59, 153, 252, 0.28); border-radius: 9999px; border: 2px solid transparent; background-clip: padding-box; }
.vpm-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 22px;
/* …truncated by planner; remaining rules follow the same patterns… */
```

Verbatim strings found in the prototype's script (toast titles/messages, status and validation text — use exactly these where the matching event occurs; the surrounding logic is replaced by API calls):
- `Awaiting input`
- `Use 12+ characters with mixed cases, numbers and symbols.`
- `Too easy to guess — add length and variety.`
- `Add uppercase letters, numbers and symbols.`
- `Almost there — a few more characters would help.`
- `Excellent. This password resists brute-force well.`
- `Both entries must match exactly.`
- `✓ Passwords match.`
- `Passwords do not match yet.`
- `Enter your current password`
- `New password does not meet the requirements`
- `Choose a stronger password`
- `Passwords do not match`
- `New password must differ from current`
- `Password updated successfully`
- `Authenticator app disabled`
- `Enter the 6-digit code`
- `Authenticator app enabled`
- `Hardware key removed`
- `Hardware security key registered`
- `Copy recovery code`
- `Recovery code copied`
- `Generated just now · 10 of 10 unused`
- `10 recovery keys generated`
- `Preparing printable sheet…`
- `Regenerated just now · 10 of 10 unused`
- `New recovery keys generated`
- `Copied to clipboard`
**Change password (RHF + Zod `ChangePasswordBody`):** live rule checklist (`PASSWORD_RULES` from contracts: `At least 12 characters`, `One uppercase letter`, `One lowercase letter`, `One number`, `One symbol (!@#$…)` — each row gets `is-met` when satisfied, with a visually hidden `met`/`not met` text), strength meter + label from `scorePassword` (`Awaiting input`, `Weak`, `Fair`, `Good`, `Strong`) with the hint strings from the script list above mapped by score (0 `Use 12+ characters with mixed cases, numbers and symbols.`, 1 `Too easy to guess — add length and variety.`, 2 `Add uppercase letters, numbers and symbols.`, 3 `Almost there — a few more characters would help.`, 4 `Excellent. This password resists brute-force well.`), match text `✓ Passwords match.` / `Passwords do not match yet.`; field errors `Enter your current password`, `New password does not meet the requirements`, `Passwords do not match`, `New password must differ from current`. Show/hide buttons on all three fields. Submit → `POST /account/password`; `401 invalid_credentials` → field error on current password `Current password is incorrect.`; `422 breached_password` → `This password has appeared in a data breach. Choose a different one.`; success → toast `Password updated successfully` + `All other sessions were signed out.` and reset the form. Staff roles show the helper `Staff accounts require at least 14 characters.` and enforce 14 client-side. `Clear Fields` resets the form. Keep the card subtitle exactly as in the markup (it says VUNVAULT stores only a salted hash; Supabase Auth stores a salted one-way hash).
**Two-factor card:** `GET /account/security` supplies `MfaStatus` + posture. **Authenticator app:** status chip `Not enabled`/`Enabled` (+ `Off`/`On` toggle); enabling calls `POST /account/mfa/totp/enroll`, shows the numbered steps from the markup with the QR rendered as an `<img src="data:image/svg+xml;utf8,…">` (never `innerHTML`) and the setup key (`secret`, grouped by 4, `Copy` → toast `Copied to clipboard`), a `Verification Code` input and `Verify & Enable` → `POST /account/mfa/totp/verify` (errors: `Enter the 6-digit code`, `Incorrect code.`); success toast `Authenticator app enabled`; disabling → `DELETE /account/mfa/totp` with a confirm dialog (`Disable authenticator app?` / `You will rely on your other methods to sign in.`), toast `Authenticator app disabled`; `422 last_factor` → `You cannot remove your only second factor.`. **Hardware key:** `Register Key` → `POST …/webauthn/register/options` → `navigator.credentials.create` → `POST …/register/verify { deviceName, credential }`; list registered keys (device name, added date) each with `Remove` (`DELETE …/webauthn/:id`); toasts `Hardware security key registered` / `Hardware key removed`; user cancel → `Security key registration was cancelled.`.
**Recovery keys:** state `No recovery keys generated yet`; `Generate Recovery Keys` → `POST /account/recovery-codes` shows the ten codes ONCE in the panel (`XXXX-XXXX-XXXX`, per-code `Copy recovery code <n>` buttons with toast `Recovery code copied`, `Hide Codes`, `Print Codes` (opens `window.print()` on a print-only stylesheet listing the codes; toast `Preparing printable sheet…`), `Regenerate` opens the confirm dialog from the markup then `POST /account/recovery-codes/regenerate`, toast `New recovery keys generated`); once hidden/reloaded the codes are NOT retrievable — show `Generated <relative time> · <remaining> of 10 unused` from `RecoveryCodesStatus`. Codes live only in component state while visible; clear on unmount/Hide.

**Tests:** rule checklist and strength transitions; mismatch and same-as-current errors; 401 and 422 mapping; TOTP enrol shows an `<img>` QR and verifies; disabling last factor error; WebAuthn register calls both endpoints (mock `navigator.credentials`); recovery codes: ten codes displayed once, `Print Codes` calls `window.print`, remaining count text after reload comes from the API.

---

**Data shape (TypeScript):**
```ts
// MfaStatus, SecurityPosture, ChangePasswordBody, RecoveryCodesResponse: see contracts (Tasks 20d, 27).
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/account/password body { currentPassword; newPassword; confirmPassword } → 204 | 401 | 422 breached_password
// GET  /api/v1/account/security → 200 { data: MfaStatus & { posture: SecurityPosture } }
// POST /api/v1/account/mfa/totp/enroll → 201 { data: { factorId; qrCodeSvg; secret; uri } } · POST …/totp/verify { factorId; code } → 204 | 401 mfa_failed · DELETE …/totp → 204 | 422 last_factor
// POST /api/v1/account/mfa/webauthn/register/options → 200 · POST …/register/verify { deviceName?; credential } → 201 { data: WebauthnKey } · DELETE …/webauthn/:id → 204
// POST /api/v1/account/recovery-codes → 201 { data: { codes: string[10]; batchId; generatedAt } } | 409 already_generated · POST …/regenerate → 201
```

---

**Out of scope:**
- Do not store or log recovery codes or the TOTP secret outside component state.
- Do not use `innerHTML`.
- Do not build the admin security tab (Task 83).

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
☐ Report at the end: `Task 67 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---


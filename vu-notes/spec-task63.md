### TASK 63 — Accept-invite, forgot-password, reset-password and newsletter-confirm pages

**Layer:** L7

**Prerequisites:** Task 10, Task 31, Task 40c, Task 40d, Task 59, Task 60

**Estimated files touched:** 12

---

**You are working in the VUNVAULT monorepo.**

You have no access to reference files. Everything you need is embedded below.
Do not invent design values. Do not invent copy. Use exactly what is given.

Complete exactly one task: **Accept-invite, forgot-password, reset-password and newsletter-confirm pages**.

Do not touch files outside the "Deliverables" list.
Do not install new dependencies unless listed under "Dependencies allowed".
When done, output the summary specified under "Definition of done".

---

**Goal:**
Build the four small auth-adjacent routes that have no prototype page, reusing the login card styling: staff invitation acceptance, password reset request and completion, and newsletter confirmation.

**Deliverables:**
- `apps/web/src/app/(auth)/accept-invite/page.tsx`
- `apps/web/src/app/(auth)/forgot-password/page.tsx`
- `apps/web/src/app/(auth)/reset-password/page.tsx`
- `apps/web/src/app/(auth)/newsletter/confirm/page.tsx`
- `apps/web/src/app/(auth)/_components/auth-card.tsx` — generic card shell reproducing the login card classes (`vv-auth-card`, head/brand/title/sub).
- `apps/web/src/app/(auth)/accept-invite/_components/accept-invite-form.tsx`
- `apps/web/src/app/(auth)/forgot-password/_components/forgot-form.tsx`
- `apps/web/src/app/(auth)/reset-password/_components/reset-form.tsx`
- `apps/web/src/app/(auth)/_hooks/use-auth-misc.ts`
- `apps/web/src/mocks/handlers/auth-misc.ts` and MODIFY `apps/web/src/mocks/handlers/index.ts`.
- `apps/web/src/app/(auth)/_components/auth-misc.test.tsx`

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

**Reuse the login card look:** import `auth.css` (Task 59) and reuse these classes exactly (their CSS is defined there): `vv-auth-card`, `vv-auth-head`, `vv-brand`, `vv-brand-mark`, `vv-brand-name`, `vv-auth-title`, `vv-auth-sub`, `vv-form`, `vv-field`, `vv-label`, `vv-input-wrap`, `vv-input`, `vv-input-icon`, `vv-error`, `vv-submit`, `vv-submit-label`, `vv-spinner`, `vv-link`, `vv-legal`. Page background: the same `AuthBackground` component (Task 59).

**All copy on these four pages is planner-authored (no prototype exists); keep it exactly as given:**
- **Forgot password** (`/forgot-password`): title `Reset your password`; sub `Enter your account email and we will send you a reset link.`; field `Email address` (placeholder `you@company.com`; same email validation messages as login); button `Send reset link`; after submit (ALWAYS, regardless of the API result except network failure) replace the form with: title `Check your inbox`, text `If an account exists for that address, a reset link is on its way. It expires in 30 minutes.`; link `Back to sign in` → `/login`.
- **Reset password** (`/reset-password?token=`): title `Choose a new password`; sub `Use at least 12 characters (14 for staff accounts) with upper and lower case letters, a number and a symbol.`; fields `New password`, `Confirm new password` (RHF + Zod `ResetPasswordBody`; confirm message `Both entries must match exactly.`); show `PasswordStrength` (Task 61); button `Update password`; success → title `Password updated`, text `All other sessions were signed out. Sign in with your new password.`, button `Go to sign in`; `410 token_invalid` → inline alert `This reset link is invalid or has already been used.` with a link `Request a new link` → `/forgot-password`; `422 breached_password` → field error `This password has appeared in a data breach. Choose a different one.`. Missing `token` query → the invalid-link state.
- **Accept invite** (`/accept-invite?token=`): on load `GET /api/v1/invitations/:token`; loading → `Skeleton`; `404` → title `Invitation not valid`, text `This invitation link is invalid or has expired. Ask an administrator to send a new one.`; found → title `Join VUNVAULT`, sub `You've been invited as <strong>{roleLabel}</strong> · {teamLabel}.`, read-only `Work email` showing the address, fields `Password` / `Confirm password` (min 14, same rules, `PasswordStrength`), button `Activate account`; success → title `Account activated`, text `Multi-factor authentication is mandatory for staff accounts. Set it up now to continue.`, button `Set up MFA` → `/admin/profile#security`.
- **Newsletter confirm** (`/newsletter/confirm?token=`): on load `POST /api/v1/newsletter/confirm`; pending → `Confirming your subscription…`; success → title `Subscription confirmed`, text `You will now receive VUNVAULT threat advisories.`, link `Back to the blog` → `/blog`; `404` → title `Link not valid`, text `This confirmation link is invalid or has already been used.`. (Unsubscribe link handling is out of scope.)
All four pages: `metadata.robots = { index: false }`, no marketing chrome, each card `<main>` with an `h1`.

**Tests:** forgot form always ends on the `Check your inbox` state; reset: invalid token state, mismatch message, success state; accept-invite: 404 state, success state, role/team shown; newsletter confirm: pending→success and 404.

---

**Data shape (TypeScript):**
```ts
interface InvitationPreview { email: string; fullName: string; role: UserRole; roleLabel: string; team: Team; teamLabel: string; expiresAt: string }
```

**API contract (as comments only — do NOT implement the backend):**
```ts
// POST /api/v1/auth/forgot-password body { email } → 202 {}
// POST /api/v1/auth/reset-password body { token; newPassword; confirmPassword } → 204 | 400 | 410 { error: "token_invalid" } | 422 breached_password
// GET  /api/v1/invitations/:token → 200 { data: InvitationPreview } | 404 not_found
// POST /api/v1/invitations/:token/accept body { password; confirmPassword } → 201 { data: SessionUser; mfaEnrolmentRequired: true } | 400 | 404 | 422 breached_password
// POST /api/v1/newsletter/confirm body { token } → 204 | 404 not_found
```

---

**Out of scope:**
- Do not change the login or signup pages.
- Do not add an unsubscribe page.
- Do not store tokens anywhere (read from the URL once, keep in component state only).

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
☐ Report at the end: `Task 63 complete. Files created: <list>. Files modified: <list>. Dependencies added: <list or "none">.`


---


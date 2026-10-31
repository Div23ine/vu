# Playbook

## Purpose

Running record of all changes to authentication, admin provisioning, and security policy.
Append-only: every phase of the magic-link work order adds a Change Log entry; nothing here is
rewritten, only appended to and corrected forward.

## Admin Roster

Provisioning source of truth (work order §3). Names for `tshepiso@` and `bukenya@` were resolved
per Q1 by matching the email local-part against the **contributors** records — the canonical
`CONTRIBUTORS` array in `apps/web/src/app/(marketing)/_components/home/contributors.tsx` (the
`/about` page's `about-data.ts` mirrors it). No name was invented.

| Email                 | Name              | Role        | Notes                                                                                                                                                                                                                    |
| --------------------- | ----------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| daniel@vunvault.com   | Daniel Okafor     | Admin       | 5-min MFA setup window. Contributor record matches the roster name.                                                                                                                                                      |
| divine@vunvault.com   | Divine Gospel     | SUPER ADMIN | MFA timer exempt. **NOT Thugu Maina** (hard constraint, work order §2). No contributor record exists for this address; the display name comes from the work order itself.                                                |
| tshepiso@vunvault.com | Raphunga Tshepiso | Admin       | 5-min window. From contributors (Research Analyst, contributor-04).                                                                                                                                                      |
| bukenya@vunvault.com  | Bukenoya Natasha  | Admin       | 5-min window. From contributors (Cybersecurity Analyst, contributor-02). Spelling discrepancy flagged: `about-data.ts` spells the same person "Bukeonya Natasha"; the canonical CONTRIBUTORS array ("Bukenoya") is used. |
| ⟨placeholder 5⟩       | —                 | Admin       | Slot reserved (Q2: `null` until supplied).                                                                                                                                                                               |
| ⟨placeholder 6⟩       | —                 | Admin       | Slot reserved (Q2: `null` until supplied).                                                                                                                                                                               |
| ⟨placeholder 7⟩       | —                 | Admin       | Slot reserved (Q2: `null` until supplied).                                                                                                                                                                               |
| ⟨placeholder 8⟩       | —                 | Admin       | Slot reserved (Q2: `null` until supplied).                                                                                                                                                                               |
| ⟨placeholder 9⟩       | —                 | Admin       | Slot reserved (Q2: `null` until supplied).                                                                                                                                                                               |

The machine-readable copy of this roster is `apps/api/src/lib/admin-roster.ts` (Phase 2). Fill a
placeholder there; provisioning, the signup guard and the MFA rules all read that one list.

## Change Log

### 2026-10-29 — Phase 1: Magic-link authentication (backend)

- **Changed:**
  - `POST /api/v1/auth/login` (password login) **deleted** — route, handler, `AuthService.login()`,
    the `LoginInput`/`LoginBody`/`LoginResponse` contracts and the password timing-equaliser.
  - `POST /api/v1/auth/magic-link` added: body is `{ email; next? }` on a **strict** schema — a
    `password` field is a hard 400. The response is ONE literal
    (`MagicLinkRequestResponse` / `MAGIC_LINK_ACK_MESSAGE`) byte-identical for registered and
    unregistered addresses, so the endpoint cannot enumerate accounts. Registered → single-use
    HMAC link (15 min TTL, email+purpose-bound, a newer link kills the older one) pointing at the
    API verify leg. Unregistered → signup-invitation email (Phase 3 leg, already wired).
  - `GET /api/v1/auth/magic-link/verify` added: consumes the token atomically (signature checked
    before any storage read; read-and-delete defeats replay), mints the aal1 Supabase session
    **server-side** (`issueSession`), stores it AES-256-GCM-encrypted inside the pre-MFA challenge
    and answers a bare **302** to `${WEB_ORIGIN}/login/mfa` setting ONLY the HttpOnly `vv_mfa`
    cookie — never `vv_at`/`vv_rt`. Every failure (invalid / expired / used / blocked / inactive /
    unavailable) redirects to `${WEB_ORIGIN}/login?error=<code>`; malformed tokens get the same
    redirect treatment, never a raw JSON error in a browser.
  - `POST /api/v1/auth/mfa/verify` (existing) is now the ONLY door to a full session: the 6-digit
    code (or WebAuthn assertion) against the challenge rotates the cookies. `availableMethods()`
    now always includes `email_otp`, guaranteeing every user a six-digit path.
  - `next` is sanitised on both legs (`sanitizeNextPath`: single `/`, never protocol-relative,
    never absolute) — open redirects are dropped.
  - Audit: `MAGIC_LINK_ISSUED`, `MAGIC_LINK_VERIFIED`, `SIGNUP_INVITE_SENT` (+ Phase 2's
    `MFA_SETUP_BLOCKED` / `MFA_SETUP_UNBLOCKED` / `ADMIN_PROVISIONED` catalogued). Tokens are
    never logged or audited at any level (work order §7).
  - Deny-by-default manifest updated: `PUBLIC_ROUTES` / `RATE_LIMITED_ROUTES` swapped login →
    the magic-link pair (request: `public_form` 5/10 min/IP; verify: `sensitive` 10/min/IP);
    verify listed under `NO_JSON_RESPONSE` (bare 302).
  - Contract drift repaired (pre-existing breakage at HEAD, unrelated to but blocking this work):
    `SignupBody` (country/accountType required, `NewPassword` rules, `confirmPassword` refine),
    `SignupVerifyBody` (`{ email, code }`), `SignupStartResponse` (full literal shape) restored to
    match the working API + web form; dead `AuthFlowHandle` / `SignupConfirmBody` /
    `MagicLinkVerifyResponse` schemas removed; `routes-a.ts` rewritten to document the real
    surface; `orders.test.ts` fake aligned with `FxRateSource`.
  - `account_status` enum + migration `0094_blocked_mfa_setup.sql` added early (additive;
    Phase 2 enforcement lands on top of it).
  - Deleted `apps/api/fix-all-imports.cjs` — a one-off ESM codemod committed by accident in
    79acb8a; zero references; it was the only thing failing `pnpm lint` at HEAD (§8: dead
    import helpers).
- **Files:** `packages/contracts/src/{auth,routes-a,permissions}.ts`,
  `packages/contracts/src/contracts-a.test.ts`, `packages/db/src/enum-values{,.test}.ts`,
  `packages/db/sql/0094_blocked_mfa_setup.sql`,
  `apps/api/src/routes/v1/auth/{index,service,magic-link,challenge,auth.test}.ts`,
  `apps/api/src/audit/events{,.test}.ts`, `apps/api/src/conformance/route-manifest.ts`,
  `apps/api/src/routes/v1/orders/orders.test.ts`, deleted `apps/api/fix-all-imports.cjs`.
- **Reason:** Work order §4 (Phase 1) — replace all password login with magic-link login;
  §1 items 1 and 5.
- **Verification:** `packages/contracts`: typecheck ✅ lint ✅ 174 tests ✅. `packages/db`:
  typecheck ✅ 143 tests ✅. `apps/api`: typecheck ✅ lint ✅ (after codemod deletion) 978 tests ✅
  including 16 new magic-link tests: byte-identical responses, single-use/replay/expired/forged
  tokens, superseded links, invite cooldown (exactly one email), `vv_mfa`-only cookie, encrypted
  challenge storage, six-digit guarantee, `next` sanitisation, blocked/inactive refusals, audit
  entries without tokens. Conformance route-table suite ✅ (guards, audit, CSRF, rate limits,
  contract drift). NOTE: in this sandbox (Node 20; repo requires 22) `src/plugins/infra.test.ts`
  needs `NODE_OPTIONS=--experimental-websocket` (Node 22 provides the global WebSocket natively);
  with it, all 978 pass. Frontend screens land in the Phase 1 (web) entry below.

### 2026-10-29 — Phase 1: Magic-link authentication (frontend + redirect enrichment)

**Changed**

- **API — MFA redirect enrichment:** both second-factor redirects (the magic-link verify leg and
  the OAuth staff leg) now land the browser on
  `${origin}/login/mfa?methods=<csv>&to=<masked>&next=<sanitised>`. `to` comes from the new
  `maskEmailForRedirect()` (first 2 chars of the local part + one bullet per remaining char + full
  domain) — the full email never appears in a URL or a log. The OAuth leg sends `methods=totp`
  only; the magic-link leg sends the account's enrolled methods. `next` is re-sanitised
  (single-`/`, never protocol-relative) before it is echoed.
- **Web `/login` — password card deleted.** `MagicLinkCard` collects ONLY an email →
  `POST /auth/magic-link` (strict body: a stale client sending `password` gets a 400) → the
  generic **"Check your email"** state (Resend link / Use a different email). No password input,
  no remember-me, no forgot-password link anywhere on the login surface. Registered and
  unregistered addresses render the IDENTICAL view (the API's generic 200 ack is the only
  input). `?next=` is captured at request time and rides inside the emailed verify URL.
  The `?error=` toast map gains the six verify-refusal codes (`magic_link_invalid`,
  `magic_link_expired`, `magic_link_used`, `account_blocked`, `account_inactive`,
  `sign_in_unavailable`) and the OAuth strings are reworded for the passwordless surface.
- **Web `/login/mfa` — new server route + `MfaPanel`.** The server component gates on the
  HttpOnly `vv_mfa` cookie: absent → "No active sign-in" card with a link back to `/login` (a
  dead OTP form is never rendered). Present → it filters the `methods` CSV to known challenge
  types (unknown tokens dropped; empty → the full list), accepts `to` only up to 254 chars and
  runs `next` through `safeNextPath`. The panel is page-mode (`<main>` inside `.vv-otp-page`; no
  overlay, no zustand store, no focus trap): default-method priority **totp > email_otp >
  webauthn**; email OTP auto-sends when it is the default or when switched to (60 s resend
  cooldown); **WebAuthn never auto-prompts on page load** — its button drives
  options → `credentials.get` → verify; success copy verbatim ("Verification successful" /
  "Redirecting to VUNVAULT…") then `next ?? homeFor(role)`; a staff session verified with a
  RECOVERY code stays aal1 → `/login?error=mfa_required`; a 410 toasts "Session expired" and
  returns to `/login`.
- `safeNextPath` moved to its own directive-free module `login/_lib/next-path.ts` (shared by the
  server routes and the client hook; the old `use-login.ts` dual-purpose file is gone).
- **Deleted** (work order §5/§8): `login-card.tsx`, `mfa-dialog.tsx`, `mfa-dialog-store.ts`,
  `use-login.ts`, dead `login/confirm/page.tsx`, dead `signup/confirm/page.tsx` (both
  `AuthFlowHandle` relics), abandoned `auth-passwordless.test.tsx`; comment-only references to
  the deleted modules reworded (no dangling symbols remain).
- **Mocks/tests:** the `POST /auth/login` mock handler became `POST /auth/magic-link` (strict
  contract parse, always the generic ack); `session.test.tsx`'s login block became a
  no-enumeration ack test (identical body for fixture and stranger emails; `password` field
  rejected 400). New suites: `login.test.tsx`, `login-page.test.tsx`, `mfa.test.tsx`,
  `mfa/mfa-page.test.tsx`.
- **Pre-existing upstream type breaks fixed minimally** (they blocked the green-build DoD and
  predate this work order): `signup-verify-dialog.tsx` posted `{ handle, code }` where the
  contract (unchanged since `1f65952`) demands `{ email, code }` — functionally broken
  upstream; `signup-card.tsx` omitted the contract-required `confirmPassword` (the form already
  collected and matched it); `roster-table.tsx` lacked the `blocked_mfa_setup` badge added by
  the Phase 1 enum widening. No signup LOGIC touched (Q3 respected).

**Files**

- `apps/api/src/routes/v1/auth/service.ts` (`maskEmailForRedirect` + verify-leg redirect),
  `oauth-service.ts` (staff MFA-leg redirect), `auth.test.ts` / `oauth.test.ts` (URL-parse
  assertions: pathname `/login/mfa` + `methods`/`to`/`next` params, evil-origin drops).
- `apps/web/src/app/(auth)/login/`: `_lib/next-path.ts`, `_hooks/use-magic-link.ts`,
  `_components/magic-link-card.tsx`, `_components/mfa-panel.tsx`, `mfa/page.tsx`,
  `mfa/mfa-page.test.tsx`, `page.tsx`, `login.test.tsx`, `login-page.test.tsx`, `mfa.test.tsx`;
  `_styles/auth.css` (`.vv-otp-page`, `.vv-sent`).
- Deleted: `_components/login-card.tsx`, `_components/mfa-dialog.tsx`, `_hooks/use-login.ts`,
  `_store/mfa-dialog-store.ts`, `confirm/page.tsx`, `../signup/confirm/page.tsx`,
  `../auth-passwordless.test.tsx`.
- `apps/web/src/mocks/handlers/auth.ts`, `src/lib/session.test.tsx`,
  `signup/_components/signup-card.tsx`, `signup/_components/signup-verify-dialog.tsx`,
  `admin/users/_components/roster-table.tsx` + comment rewording in 5 files.

**Reason** — Definition of Done: zero password-login paths; the second factor lives on its own
route fed by SERVER-masked redirect params (no PII in URLs, no client-side masking trust);
unregistered emails are indistinguishable in the UI; deleted surfaces cannot rot.

**Verification**

- api: `vitest run src/routes/v1/auth` → **75/75** (5 files); `tsc --noEmit` clean; eslint clean.
- web: `tsc --noEmit` clean (first green web typecheck of the work order); eslint clean on all
  touched files; login surface + session suites → **55/55** (login.test 12, login-page.test 6,
  mfa.test 20, mfa-page.test 7, session.test 10).
- Full web suite: **724 passed**; the remaining **15 failures in 6 files** (`env.test.ts` ×6,
  marketing contributors ×3, abandoned `signup-page.test.tsx` ×5, `signup-enroll.test.tsx` ×1)
  were proven IDENTICAL on the stashed pre-change tree (stash → re-run → pop) — pre-existing
  upstream red, untouched by Phase 1 (see Decisions & Known Gaps).

### 2026-10-29 — Phase 2: MFA enforcement + admin roster (backend)

- **Changed:**
  - `GET /auth/magic-link/verify` now gates on enrolment: enrolled → `/login/mfa` (Phase 1
    behaviour); unenrolled account that **needs forced setup** (any ADMINISTRATOR_ROLES member or
    a `client`) → the first-sign-in setup flow; unenrolled and setup-exempt → straight to a full
    session (302 `homeForRole`). A missed/expired admin window is detected here too and bounces
    to `/login?error=account_blocked`.
  - **Forced first-sign-in MFA setup** — three new routes under `POST /auth/mfa/setup/`:
    `options` (starts a TOTP enrolment bound to the sealed pre-MFA session; answers
    `{ factorId, qrCodeSvg, secret, uri, deadlineEpochMs }`), `verify` (first correct 6-digit
    code → `setMfaEnrolled(true)`, challenge + ledger cleared, full aal2 session issued, cookies
    rotate to `vv_at`/`vv_rt`), `abandon` (admin inside a timed window → `blocked: true` +
    `account_status = blocked_mfa_setup`; untimed user → `blocked: false`, start over). All
    three: `vv_mfa`-cookie guarded, require a setup-marked challenge (else 403), audited,
    `withTx`, `sensitive` rate limit, listed in the conformance manifest (`PUBLIC_ROUTES` —
    cookie-gated like the other challenge legs — `NO_BODY_MUTATIONS` for options/abandon,
    `RATE_LIMITED_ROUTES`).
  - **The 5-minute admin window:** `ADMIN_MFA_SETUP_WINDOW_SECONDS = 300`; the challenge TTL and
    a KV ledger (`mfasetup:u:<userId>` + `mfasetup:h:<handle>`, 24 h TTL) carry the deadline.
    Only TIMED (admin) windows are ledgered — normal-user enrolment is untimed, never blocked,
    never bypassed. Expiry is enforced **lazily**: a setup leg touched after the deadline (or a
    fresh magic-link verify) flips the account to `blocked_mfa_setup` and answers 410
    `setup_expired` / 302 `account_blocked`. Brute-force on setup verify: the 5th failure kills
    the challenge (restart via a new magic link) but does NOT immediately block — see Decisions.
  - **Exemption:** `divine@vunvault.com` (Divine Gospel, SUPER ADMIN) never receives a setup
    challenge, no timer, no block, MFA optional (`isMfaSetupExempt`); `requireStaff` was
    hard-blocking `aal !== 'aal2'`, which would have locked the exempt super admin out of the
    admin panel — it now waives the aal2 requirement for exempt emails only.
  - **Admin roster provisioning:** `apps/api/src/lib/admin-roster.ts` (the 9-slot data-driven
    config: 4 populated, 5 null placeholders) + `users` service `provisionAdminRoster()` +
    entry script `apps/api/scripts/provision-admins.ts` (single transaction; audits
    `ADMIN_PROVISIONED` and role corrections). Idempotent: existing users are role-corrected,
    never duplicated; each created admin gets a distinct random ≥32-byte password (vestigial —
    no password login exists) and `emailConfirm: true`.
  - **Unblock path (new):** `POST /admin/users/:id/unblock-mfa` (`users:manage`): 409
    `invalid_state` unless the account is `blocked_mfa_setup`, restores `active` +
    `updateMember`, audit `MFA_SETUP_UNBLOCKED`. MFA stays **unenrolled** — the next magic-link
    sign-in re-arms a fresh 5:00 window; the gate is re-armed, never waived.
  - Contracts: `MfaSetupOptionsResponse` / `MfaSetupVerifyBody` / `MfaSetupAbandonResponse`
    added to `packages/contracts/src/auth.ts`.
- **Files:** `apps/api/src/lib/admin-roster{,.test}.ts` (new), `apps/api/scripts/provision-admins.ts`
  (new), `apps/api/src/routes/v1/auth/{service,index,challenge,repo,auth.test}.ts`,
  `apps/api/src/routes/v1/users/{index,service,repo,users.test}.ts`, `apps/api/src/plugins/auth.ts`,
  `apps/api/src/conformance/route-manifest.ts`, `apps/api/{package.json,tsconfig.json}`,
  `packages/contracts/src/auth.ts`; test-only realignments in `oauth.test.ts`,
  `password-reset.test.ts`, `signup-verify.test.ts` (unenrolled seeds now pin `mfaEnrolled`
  explicitly — Phase 2 changed what an unenrolled verify means).
- **Reason:** Work order §4 (Phase 2) — MFA enforcement for all users, the admin 5:00 setup
  window with `BLOCKED_MFA_SETUP`, the Divine Gospel exemption, roster provisioning, and the
  documented unblock path (§1 item 2).
- **Verification:** `apps/api`: typecheck ✅ (tsc exit 0), eslint `src/ scripts/` ✅, full suite
  **1008/1008 (55 files)** ✅ with `NODE_OPTIONS=--experimental-websocket` (Node-20 sandbox
  workaround, pre-existing); targeted auth+users+lib+conformance rerun **172/172** ✅.
  `packages/contracts`: 174 tests + typecheck ✅. New tests: setup gate routing (admin/client/
  exempt), window expiry + lazy block, abandon semantics, brute-force challenge kill, verify
  success → aal2 session + cookie rotation, roster shape/lookup/exemption pins, provisioning
  idempotence (2nd pass: created [], skipped 4), unblock guards + 409 states.

### 2026-10-29 — Phase 2: MFA enforcement (web — /login/mfa/setup)

- **Changed:**
  - New route `apps/web/src/app/(auth)/login/mfa/setup/page.tsx`: same server gate as
    `/login/mfa` — no HttpOnly `vv_mfa` cookie → "No active sign-in" (a dead enrolment form is
    never rendered). `?deadline=` survives only as strict digits (epoch ms; anything else →
    untimed variant), `?to=` echoed only ≤254 chars (arrives SERVER-masked), `?next=` through
    `safeNextPath`.
  - New `MfaSetupPanel` (+ `use-mfa-setup.ts` hooks): POSTs `setup/options` on mount, renders
    the QR as a data-URI `<img>` (SVG never injected as markup — `qrCodeSrc`/`groupSecret`
    reused from the signup verify flow) with the grouped base32 secret + copy control, the
    six-box `OtpInput`, and — **only when a deadline exists** — the visible mm:ss countdown
    (`role="timer"`, low-time styling under 60 s) plus the Abandon control with its blocking
    warning. Countdown hits 0, Abandon is pressed, or any leg answers 410 `setup_expired` → the
    blocked notice ("Setup window expired" + super-admin unblock copy). 410 `challenge_expired`
    → toast + `/login`. Success → the spec's verbatim pair ("Verification successful" /
    "Redirecting to VUNVAULT…"), session cache seeded, then `next` ?? `homeFor(role)`.
  - MSW handlers for the three setup legs (untimed defaults; tests override for deadline /
    blocked / 410 paths); `.vv-setup-*` styles appended to `auth.css` (tokens only, signup
    QR-block parity).
- **Files:** `apps/web/src/app/(auth)/login/mfa/setup/{page,setup-page.test}.tsx` (new),
  `apps/web/src/app/(auth)/login/_components/mfa-setup-panel.tsx` (new),
  `apps/web/src/app/(auth)/login/_hooks/use-mfa-setup.ts` (new),
  `apps/web/src/app/(auth)/login/mfa-setup.test.tsx` (new),
  `apps/web/src/app/(auth)/_styles/auth.css`, `apps/web/src/mocks/handlers/auth.ts`.
- **Reason:** Work order §4 (Phase 2) frontend — the forced setup screen with the visible 5:00
  countdown for admins; normal users enrol without a timer.
- **Verification:** web typecheck ✅ (tsc exit 0), eslint on all touched files ✅, new tests
  **18/18** ✅ (12 panel + 6 page: QR/secret render, countdown tick + `is-low`, expiry block,
  abandon block + once-only close, `blocked:false` → `/login`, verify success → seed + navigate,
  incorrect-code copy + box reset, 410 legs, cookie gate, hostile `deadline`/`to`/`next`
  dropped). Full web suite: **742 passed** (724 prior + 18 new); the 15 failures are the
  documented pre-existing upstream red (unchanged, reproduced on the unmodified tree).

### 2026-10-29 — Phase 3: Unregistered-email handling (acceptance)

- **Changed:** no new code — the Phase 3 surface landed inside the Phase 1 `requestMagicLink`
  implementation; this phase is the work order's acceptance pass (§4 Phase 3), re-verified
  end-to-end after the workspace reconstruction (the sandbox reset destroyed `.git` and
  `node_modules`; the working tree survived and was re-committed as `9f79cd8`, superseding the
  partial magic-link stub merged upstream in PR #42).
- **Acceptance criteria, item by item:**
  - _Exactly one signup-invitation email:_ unregistered addresses hit the `invites.claim(email)`
    cooldown gate (KV, `ml:invite:<hash>`); a repeat request inside the window returns
    `{ sent: 'suppressed' }` and sends nothing. Test: "sends exactly one signup invitation per
    cooldown window to an unregistered address".
  - _Byte-identical HTTP response:_ registered and unregistered paths both answer the single
    `MagicLinkRequestResponse` literal (`MAGIC_LINK_ACK_MESSAGE`) — no status, header or body
    divergence, so the endpoint cannot enumerate accounts. Test: "answers registered and
    unregistered addresses with byte-identical bodies".
  - _Invitation content:_ subject "No VUNVAULT account found for this email", body carries the
    `${WEB_ORIGIN}/signup` link and an ignore-if-not-you line; the registration status signal
    travels ONLY in the email, never in the HTTP response.
  - _Soft-deleted accounts_ are treated as unregistered (invite, never a magic link). Test:
    "treats a soft-deleted account as unregistered — an invite, never a link".
  - _Rate limits:_ `POST /auth/magic-link` runs the `public_form` policy (per-IP) and is pinned
    in the conformance `RATE_LIMITED_ROUTES`; the per-email cooldown above is the second axis.
    Per-email request windows beyond the invite cooldown land in Phase 4.
  - _Audit:_ every unregistered attempt that passes the cooldown records `SIGNUP_INVITE_SENT`
    (auth index route wiring; asserted in the suite). No token or full email ever appears in
    audit details or logs.
- **Files:** none (verification only) — surface lives in `apps/api/src/routes/v1/auth/{service,
index,magic-link}.ts` from the Phase 1 entry above.
- **Reason:** Work order §4 (Phase 3) — one invitation email, byte-identical response, no
  enumeration.
- **Verification:** `packages/contracts` 174/174 ✅; `apps/api` targeted auth+users+lib+
  conformance **152/152** ✅ (`--experimental-websocket`, Node-20 sandbox); `apps/web` setup
  suites 18/18 ✅ — all re-run this session after dependency reinstall.

### 2026-10-29 — Phase 4: Signup guard + IAM hardening

- **Changed:**
  - **Signup guard (work order §1.4):** `AuthService.signup()` now refuses any email in the
    admin roster — all populated slots, case-insensitively (`isAdminEmail`, whitespace-tolerant)
    — with **422 `signup_not_allowed`** and the spec's exact copy: "This email is not eligible
    for signup." The guard fires BEFORE any other signup work (no breach check, no repo read, no
    Supabase call), so it cannot be probed as an oracle for the other validation rules. The five
    placeholder slots carry no email and can never match; filling a slot in `admin-roster.ts`
    extends the guard with zero code changes. NOTHING else in signup changed.
  - **Per-email rate limiting:** `LoginAbuseGuard` (`routes/v1/auth/login-abuse.ts`) adds a
    per-address issuance window — max 3 magic links per address per 15 minutes (`ml:win:<sha256>`,
    digest-only keys). Beyond it the request is suppressed with the IDENTICAL generic 200 (no
    link, no invite) and audited `AUTH_RATE_LIMIT`. Sits under the existing per-IP plugin limit
    (`public_form` 5/10min → 429).
  - **Exponential backoff / lockout on MFA failures:** from the 2nd wrong code a challenge locks
    for 2^(attempts-1) seconds (2s → 4s → 8s; the 5th failure still destroys the challenge —
    Phase 1 semantics unchanged). A verify while locked answers **429 `rate_limited` + a real
    `Retry-After` header** (HttpError grew an optional `headers` bag; the error handler copies it)
    and — importantly — consumes NO attempt. Both legs honour the lock: `/auth/mfa/verify` and
    `/auth/mfa/setup/verify`.
  - **Bot defence:** the magic-link form now carries a honeypot (`website`, off-screen +
    aria-hidden + tab-skipped) and a timing signal (`formTs` = form-render epoch ms). A filled
    honeypot or a sub-1.5s fill is dropped SILENTLY: identical generic 200, no email, no repo
    read, audited `AUTH_BOT_REJECTED` (new security_event) with the reason. A `formTs` more than
    5 minutes in the FUTURE is treated as clock skew and ignored — the signal can never lock a
    human out.
  - **CAPTCHA (Turnstile):** a per-IP soft limit (`ml:soft:<sha256>`, 3 requests / 15 min). Past
    it — and only while `TURNSTILE_ENFORCE=true` — the 200 gains `captchaRequired: true`; the
    web card flips to a Turnstile view and re-submits with `captchaToken`, which the API verifies
    through the SAME `HttpTurnstileVerifier` the public contact form uses (fail-closed, one
    generic 400 `captcha_failed`, audited). The flag depends ONLY on the IP, never on
    registration status, so registered/unregistered bodies stay byte-identical and enumeration
    stays impossible.
  - **Token hygiene (verified, already true from Phase 1/2):** magic-link tokens are single-use,
    15-min TTL, email+purpose-bound, compared via HMAC (constant-time by construction), and never
    appear in logs, audit messages or audit details (pinned by the existing "no `token=` in any
    audit entry" assertions; re-verified by grep across the auth surface).
  - **Deny-by-default:** unchanged from Phase 1/2 and enforced by the conformance route-table
    suite — every non-public route carries `authenticate`; the public list is exactly the
    magic-link pair, `mfa/verify` (+ its `vv_mfa`-cookie-gated helpers), the three
    `mfa/setup/*` legs (cookie-gated), the signup trio, `/auth/refresh`, `/auth/csrf`, the OAuth
    legs, invitations and public content/health. Interpretation documented under Decisions.
  - **Web:** `useMagicLink` sends `website` + `formTs` on every request and gained a `captcha`
    phase; `MagicLinkCard` renders the honeypot, the "One more step" captcha view (lazy Cloudflare
    script, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`) with its unavailable-widget fallback; `signup-card`
    maps `signup_not_allowed` to the email field with the spec copy (the 422 breach branch now
    discriminates by CODE, not status).
- **Files:** `packages/contracts/src/auth.ts` (request/response fields), `apps/api/src/lib/http-error.ts`,
  `apps/api/src/plugins/error-handler.ts`, `apps/api/src/routes/v1/auth/{login-abuse.ts (new),
challenge.ts, service.ts, index.ts, auth.test.ts}`, `apps/api/src/audit/events{,.test}.ts`,
  `apps/web/src/app/(auth)/login/_hooks/use-magic-link.ts`, `apps/web/src/app/(auth)/login/_components/
{magic-link-card,turnstile-widget (new)}.tsx`, `apps/web/src/app/(auth)/login/login.test.tsx`,
  `apps/web/src/app/(auth)/signup/_components/signup-card.tsx`, `apps/web/src/app/(auth)/signup/
_hooks/use-signup.ts`, `apps/web/src/app/(auth)/signup/signup-a.test.tsx`,
  `apps/web/src/app/(auth)/_styles/auth.css`.
- **Reason:** Work order §4 (Phase 4) — signup guard + per-IP/per-email rate limits, MFA backoff,
  honeypot/timing/CAPTCHA bot defence, token hygiene, generic errors, audit, deny-by-default.
- **Verification:** `apps/api`: tsc ✅, eslint ✅, full suite **1020/1020 (55 files)** ✅ (12 net
  new/updated tests: signup guard ×3, honeypot/timing/skew ×3, per-address window ×1, backoff
  lock ×2 (verify + setup legs), captcha soft limit ×3; the two rapid-fire brute-force tests now
  simulate lock expiry between attempts). `packages/contracts`: tsc ✅ 174/174 ✅. `apps/web`:
  tsc ✅, eslint ✅, full suite **747 passed** (742 + 5 new: honeypot carriage, captcha
  solve/refuse/unavailable, signup-guard copy) with the 15 documented pre-existing failures
  unchanged.

### 2026-10-29 — Phase 5: Cleanup (dead login surfaces, Zone.Identifier purge, env sync)

- **Changed:**
  - **Zone.Identifier purge:** ALL 1154 Windows download-marker files (`*:Zone.Identifier`,
    repo-wide, tracked + untracked) deleted; both spellings verified at zero afterwards.
  - **Forgot/reset password deleted end-to-end** — dead surfaces once password login was gone
    (Phase 1). Nothing else used `PasswordResetStore` (the authenticated account-security
    password change has its own path and is untouched):
    - API: `POST /auth/forgot-password` + `POST /auth/reset-password` routes, `forgotPassword()`
      / `resetPassword()` service methods, `password-reset.ts` + `password-reset.test.ts`, the
      dead `notifyCredentialsChanged` helper, the now-unused `notify` dep wiring and
      `validatePassword` import, and the three route-manifest entries (public / unaudited /
      rate-limited). `PASSWORD_CHANGED` stays in the audit catalog (account-security still uses it).
    - Contracts: `ForgotPasswordBody` + `ResetPasswordBody` schemas, their `routes-a.ts`
      documentation entries and the pair-validation test — replaced by a test pinning that the
      removed routes (and `POST /auth/login`) NEVER reappear in the route docs.
    - Web: `(auth)/forgot-password/` and `(auth)/reset-password/` route trees, `useForgotPassword`
      / `useResetPassword` hooks (the invitation/newsletter hooks in `use-auth-misc.ts` stay),
      their mock handlers and their `auth-misc.test.tsx` describes; the `(auth)` layout doc
      comment updated.
  - **Orphaned test suite deleted:** `signup-page.test.tsx` — the abandoned "passwordless signup"
    design's suite (mocked a non-existent endpoint; 5 of the 15 pre-existing web reds). The
    remaining 10 pre-existing reds (env ×6, marketing ×3, signup-enroll ×1) are untouched and
    still documented as out-of-scope.
  - **Dead env/config keys:** `RECON_URL` removed from `.env.example` and both
    `docs/env-reference.md` tables (no schema or code ever declared/read it — it was the exact
    failure `verify-env-docs` reported at HEAD); the stale `docker-compose.yml` comment naming it
    was reworded (the recon service itself is topology, out of scope). The dead Windows-download
    duplicate `" (2).gitignore"` (a stale copy of `.gitignore`, one line behind) was removed.
  - **Env schema + docs synced for Phase 4:** `TURNSTILE_ENFORCE` declared in the API env schema
    (it was already read from `process.env` by the Turnstile verifier) and `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
    declared in the web public env schema + `readPublicEnv`; both documented in
    `docs/env-reference.md` and `.env.example`. **`verify-env-docs` now passes** (it failed at HEAD).
  - **Dangling-reference sweep:** 23 admin-hook comments referencing the deleted `use-login.ts`
    reworded to "the directive-free hook-module pattern"; repo-wide greps for `login-card`,
    `mfa-dialog`, `LoginBody`, `/auth/login`, `use-login`, `passwordless`, `forgot-password`,
    `reset-password` all return zero live references (only intentional historical notes in
    comments and the immutable ADR-0002 remain).
- **Files (deleted):** 1154 × `*:Zone.Identifier`, `apps/api/src/routes/v1/auth/password-reset{,.test}.ts`,
  `apps/web/src/app/(auth)/forgot-password/**`, `apps/web/src/app/(auth)/reset-password/**`,
  `apps/web/src/app/(auth)/signup/signup-page.test.tsx`, `" (2).gitignore"`.
  **Files (edited):** `apps/api/src/routes/v1/auth/{index,service}.ts`,
  `apps/api/src/conformance/route-manifest.ts`, `apps/api/src/config/env.ts`,
  `packages/contracts/src/{auth,routes-a,contracts-a.test}.ts`, `apps/web/src/env.ts`,
  `apps/web/src/app/(auth)/{_hooks/use-auth-misc.ts,_components/auth-misc.test.tsx,layout.tsx}`,
  `apps/web/src/mocks/handlers/auth-misc.ts`, 23 admin hook/component comments, `.env.example`,
  `docs/env-reference.md`, `docker-compose.yml`.
- **Reason:** Work order §4 (Phase 5) / §8 deletion list — old login pages, components, routes,
  endpoints, handlers, helpers, orphaned tests, every Zone.Identifier file, dead env/config keys;
  grep for dangling refs; build + lint clean.
- **Verification:** `apps/api`: tsc ✅ eslint ✅ full suite **1008/1008 (54 files)** ✅ (12 tests
  left with the deleted password-reset suite). `packages/contracts`: tsc ✅ lint ✅ **173/173** ✅.
  `apps/web`: tsc ✅ eslint ✅ full suite **738 passed, 10 failed** — the 10 are exactly the
  documented pre-existing reds minus the deleted orphan suite's 5 ✅. `packages/db` 143 ✅,
  `packages/lib` 77 ✅, `packages/ui` 96 ✅; tsc clean in broadcast/notify/maintenance/scan
  workers, edge and recon ✅. `verify-env-docs` ✅. Zone.Identifier count: **0** ✅.

### 2026-10-29 — Phase 6: playbook audit (accuracy pass + Definition-of-Done tracking)

- **Changed:** Full audit of this document against work order §6 and the seven-phase plan.
  Verified in place and accurate: **Purpose** (append-only running record); **Admin Roster**
  (all 9 slots — 4 named from contributors records + work order, 5 `⟨placeholder⟩` rows pending
  email; `divine@vunvault.com` = Divine Gospel, SUPER ADMIN, timer-exempt, NOT Thugu Maina;
  machine-readable twin `apps/api/src/lib/admin-roster.ts`); **Change Log** (one entry per
  phase/sub-phase: P1 backend, P1 web, P2 backend, P2 web, P3, P4, P5 — each with
  Changed/Files/Reason/Verification); **Decisions & Assumptions** (per-phase decision blocks,
  Q1–Q3 defaults recorded); **Known Gaps** (the 5 pending admin emails; the signup password
  field retained-but-unused per Q3; the 10 pre-existing web-suite reds; plus this phase's
  annotations closing out the two stale "scheduled/when they land" bullets). The **admin MFA
  unblock path** (work order §2: super admin resets an admin's blocked MFA-setup state via
  `POST /admin/users/:id/unblock-mfa`, `users:manage`, 409 unless `blocked_mfa_setup`, restores
  `active` and clears the setup challenge) is documented in the Phase 2 backend entry. Added the
  missing **Definition of Done — status** section (below) so DoD tracking lives in the playbook
  as the plan requires. No history was rewritten; corrections are annotations only.
- **Files:** `playbook.md`.
- **Reason:** Work order §6 — playbook must be the accurate, append-only record; the plan tracks
  the global DoD checklist here.
- **Verification:** Manual read-through against work order §§1–8 acceptance criteria and the
  Phase 1–5 entries' own verification numbers (api 1008/1008, contracts 173/173, web
  738 + 10 documented pre-existing reds, db 143, lib 77, ui 96, all tsc/eslint clean,
  `verify-env-docs` OK, Zone.Identifier 0). Structure check: every required section present,
  roster table has exactly 9 rows, no entry rewrites prior text.

### 2026-10-29 — Phase 7: boot & verify (real infrastructure + ordered smoke run)

- **Changed:** First end-to-end boot of the API against real infrastructure (PostgreSQL 15 +
  Redis in the sandbox) and the work order's ordered smoke run.
  - **Migrations 0000–0094 applied** to a fresh cluster (`citext`/`pgcrypto` extensions and the
    `auth.users` compatibility shim pre-created), then **new migration
    `packages/db/sql/0095_account_type_staff.sql`** — additive
    `ALTER TYPE public.account_type ADD VALUE IF NOT EXISTS 'staff'`. Schema drift: the staff
    provisioning path (admin roster + `SqlUsersRepo.createProfile` for staff invitations) writes
    `'staff'`, but the drizzle baseline enum only carried the two public signup values
    (`individual`/`company`), so provisioning failed against a freshly migrated database. No repo
    code or pinned TS enum was changed; the public signup surface still accepts only
    individual/company.
  - **Admin roster provisioned for real:** `pnpm --filter @vunvault/api provision:admins` →
    daniel@ = Daniel Okafor (admin), tshepiso@ = Raphunga Tshepiso (admin), bukenya@ =
    Bukenoya Natasha (admin), divine@ = Divine Gospel (**super_admin**, exempt); all `active`,
    `mfa_enrolled=false`; audit chain seeded (CHAIN_GENESIS + 4 × USER_PROVISIONED).
  - **Three boot fixes found by actually booting:**
    1. `apps/api/src/lib/supabase-admin.ts` — new exported `sessionIdFromAccessToken()`;
       `toSession()` and the MFA-verify session path hardcoded `sessionId: ''`. GoTrue exposes
       the session id ONLY as a JWT claim (REST responses carry no session-id field), and the
       fail-closed `user_sessions` registry 401s every authenticated request when the row's id ≠
       the access token's `session_id` claim. The helper decodes (not verifies — the signature is
       already verified by the auth plugin's `resolveUser`) to restore that correspondence. This
       was the difference between "session issued" and "session usable".
    2. `apps/api/src/plugins/redis.ts` — `redisOptionsFromUrl` set `tls: {}` unconditionally, so
       plain `redis://` URLs (local dev / this sandbox) attempted a TLS handshake and hung at
       boot with ETIMEDOUT. TLS is now scheme-based: `rediss:` → `{}` (Upstash production,
       unchanged), anything else → `undefined`.
    3. `apps/api/src/plugins/db.ts` — removed a leftover `console.warn('[db] client has
types?', …)` debug line (work order §7: fix all boot errors _and warnings_).
  - **Ordered smoke run: 35/35 PASS, 0 FAIL** (harness `scratch/smoke.mjs`, raw output
    `scratch/smoke-result.txt` — sandbox workspace, not committed):

    | #   | Scenario (work-order order)                                                                                                                                                                                                                                                    | Checks | Result |
    | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ------ |
    | S0  | signup → OTP email → verify-email → unenrolled user routed to enrolment (`/login/mfa/setup`, no deadline) → TOTP enrol → full session → protected resource 200                                                                                                                 | 7      | ✅     |
    | S1  | magic link, registered user: generic 200 ack → verify 302 `/login/mfa?methods=totp%2Cemail_otp&to=<masked>` → only the `vv_mfa` challenge cookie → pre-MFA `/auth/session` 401 → replay = `magic_link_used` → TOTP verify 200 → `vv_at` set / `vv_mfa` cleared → protected 200 | 8      | ✅     |
    | S2  | unregistered email: byte-identical ack (82 b == 82 b) → exactly ONE invitation email containing the signup link → cooldown re-issue sends nothing → `SIGNUP_INVITE_SENT` audited                                                                                               | 6      | ✅     |
    | S3  | signup with `daniel@vunvault.com` / `divine@vunvault.com` → 422 `signup_not_allowed`, exact message "This email is not eligible for signup.", profiles untouched                                                                                                               | 4      | ✅     |
    | S4  | admin first login (daniel@): verify → 302 `/login/mfa/setup?to=da••••@vunvault.com&deadline=<epochMs>`, visible window **300.3 s = 5:00**, setup options echo deadline + QR + secret, `MAGIC_LINK_VERIFIED` audited                                                            | 4      | ✅     |
    | S5  | super admin (divine@): verify → 302 straight to `/admin`, no challenge cookie (full session set directly), session = `super_admin` "Divine Gospel" with `mfaEnrolled=false` (optional), never `blocked_mfa_setup`                                                              | 4      | ✅     |
    | S6  | expired token (valid signature, past `exp`) → `/login?error=magic_link_expired`; forged signature → `/login?error=magic_link_invalid`                                                                                                                                          | 2      | ✅     |

- **Files:** `apps/api/src/lib/supabase-admin.ts` (+ new `supabase-admin.test.ts`, 3 tests),
  `apps/api/src/plugins/redis.ts`, `apps/api/src/plugins/db.ts`,
  `apps/api/src/plugins/infra.test.ts` (+2 scheme-based-TLS assertions),
  `packages/db/sql/0095_account_type_staff.sql`, `playbook.md`.
- **Reason:** Work order §7 — boot the API, fix every error/warning, run the smoke scenarios in
  the prescribed order, record the results here.
- **Verification:** `/healthz` 200; `/readyz` 200 `{db:ok,redis:ok}`. Boot log and the entire
  final smoke run contain **zero level-40/50 (warn/error) entries** — only pino level-30 request
  logs and the two documented Node-20 deprecation notices (below). `tsc --noEmit` ✅; eslint on
  every changed file ✅; full API suite **1011/1011 (55 files)** ✅ including the new
  `sessionIdFromAccessToken` tests; smoke **35/35** as tabled above.
- **Sandbox caveats (reproducibility notes — these are environment limits, not product gaps):**
  - Real GoTrue and Resend cannot run/be reached from the sandbox, so a local capture stub
    (`scratch/stub-server.mjs`, workspace root, uncommitted) implements the GoTrue REST surface
    the API consumes — admin `generate_link` (**flat** response shape: supabase-js merges
    `action_link`/`email_otp`/`hashed_token` into the user object; a nested `properties` object
    silently yields an undefined token), `verify`, token refresh, admin users CRUD, factor
    enroll/challenge/verify (TOTP ±1 step, HMAC-SHA1) — signing HS256 JWTs with the dev
    `SUPABASE_JWT_SECRET` and building claims through `vv_custom_access_token_hook`, and captures
    outbound Resend mail **one file per email** into `scratch/emails/*.json`. The hardcoded
    `RESEND_URL` forced an `/etc/hosts` redirect + `NODE_TLS_REJECT_UNAUTHORIZED=0`; that
    insecure-TLS setting is sandbox-only and must never appear in production.
  - Sandbox Node is v20.20.2 (nodejs.org unreachable, cannot move to 22): supabase-js requires
    Node ≥ 22, so boot and tests need `NODE_OPTIONS=--experimental-websocket` (native WebSocket
    for realtime). The supabase-js and AWS-SDK Node-version notices are the ONLY non-request
    output at boot.
  - Redis-backed rate-limit windows persist across harness runs (`public_form` 5/600 s per IP
    produced spurious 429s) → the harness `FLUSHDB`s before each scenario.
  - Overlay-mount file quirk: byte-offset tailing of a shared JSONL email-capture file returned
    reads starting mid-record, which masqueraded as "signup OTP email never sent". Signup email
    dispatch is inline (`await` in `sendSignupCode`) and always succeeded; only the reader was
    wrong. Fixed by the one-file-per-email capture above — do not reintroduce offset-based JSONL
    tailing in this sandbox.
  - The stub inserts `auth.users` rows outside the API's provisioning transaction, so rolled-back
    provisions can leave orphan `auth.users` rows; stub user lookup prefers `profiles`. One
    orphan (`daniel@`) was cleaned during verification.

### 2026-10-29 — Signup workflow integrity: no Supabase account unless the workflow completes

- **Changed:** Hardened the signup authentication/authorization workflow so a Supabase (GoTrue)
  auth user exists **if and only if** the workflow is being followed — a failed step never leaves
  an account behind, and leftover debris never wedges the address for the next honest attempt.
  The defect: `signup()` calls `supabase.createUser` FIRST (unconfirmed), then does the org /
  profile / OTP / email-send work inside the route's PG transaction. GoTrue cannot join that
  transaction, so if ANY later step threw — most realistically the email provider being down at
  `sendSignupCode` — the PG work rolled back but the unconfirmed auth user **survived**, both
  violating the workflow (an account with no completed signup) and poisoning the address (every
  retry hit GoTrue `email_taken` → 409 forever). The staff paths (`accept` invitation,
  `provisionAdminRoster`) had the same rollback gap.
  - **`apps/api/src/lib/supabase-admin.ts`** — new `findAuthUserByEmail(email)` on the
    `SupabaseAdmin` interface + implementation: a paginated `listUsers` scan (loops to the first
    EMPTY page so a server that clamps `per_page` cannot truncate the search) returning
    `{ id, emailConfirmedAt }` or `null`. `plugins/auth.ts`'s unconfigured-admin literal gets the
    matching `fail` stub.
  - **`apps/api/src/routes/v1/auth/service.ts` (`signup`)** — (1) **Compensation:** everything
    after `createUser` is wrapped so any failure best-effort `deleteUser`s the unconfirmed auth
    user before rethrowing — the rolled-back transaction leaves no Supabase account. (2)
    **Self-heal:** if `createUser` fails `email_taken` while no profile row exists, the address is
    probed with `findAuthUserByEmail`; an **unconfirmed** orphan (debris of a prior rolled-back
    signup) is deleted and the create retried ONCE, so an honest signup is never wedged. A
    **confirmed** auth user with no profile is genuine drift → fail closed with the original
    `email_taken` (the route maps it to 409); a confirmed identity is NEVER deleted by signup.
  - **`apps/api/src/routes/v1/users/service.ts`** — the same compensation guard around
    `accept` (a confirmed user created for an invitation is deleted if the profile write, the
    invitation update, or the immediate sign-in fails — e.g. the provider withholds the session → 502) and around `provisionAdminRoster` (a slot's user is deleted if its profile write fails).
    No self-heal here: roster provisioning is already idempotent via its `findByEmail` profile
    check, and these are operator-driven paths, not the public workflow.
  - **Sandbox stub (`scratch/stub-server.mjs`, uncommitted)** — made the GoTrue stub faithful so
    the guarantee is testable live: `POST /admin/users` now REJECTS a duplicate email with 422
    `user_already_exists` (it previously inserted blindly), tracks a real `email_confirmed_at`
    (added the column to the `auth.users` shim and backfilled active profiles), `PUT` persists
    confirmation, `DELETE` removes the PG row, and a new paginated `GET /admin/users` backs
    `listUsers`. `userJson` now reports `email_confirmed_at` truthfully (was always "now").
- **Files:** `apps/api/src/lib/supabase-admin.ts`, `apps/api/src/plugins/auth.ts`,
  `apps/api/src/routes/v1/auth/service.ts`, `apps/api/src/routes/v1/users/service.ts`, and the
  test fakes/cases in `signup-verify.test.ts`, `users.test.ts`, `auth.test.ts`, `oauth.test.ts`.
- **Reason:** Stakeholder directive — "make sure the signup authentication doesn't fail and it
  should follow the workflow; if not, don't create an account in Supabase." The authorization
  gates were already correct (a `pending_verification` profile can neither complete signup nor
  borrow a magic link — `verifyMagicLink` requires `accountStatus === 'active'`); this closes the
  account-lifecycle gap so an incomplete/failed workflow cannot leave a Supabase account behind.
- **Verification:** `tsc -p tsconfig.build.json --noEmit` ✅ (source); eslint on all eight files
  ✅; full API suite **1017/1017 (55 files)** ✅ — up from 1011 with **6 new tests**: signup
  deletes the auth user when the OTP email send fails; signup self-heals an unconfirmed orphan
  (`email_taken` → delete → retry → 202); signup NEVER deletes a confirmed orphan (stays 409);
  `email_taken` with no orphan found still 409s (no delete); invitation `accept` deletes the
  confirmed user when sign-in withholds the session (502); `provisionAdminRoster` deletes the
  slot's user when the profile write fails. **Live** against the booted API + stub
  (`scratch/signup-verify.mjs`, output `scratch/signup-verify-result.txt`): **27/27** — happy path
  (unconfirmed on signup → confirmed + active + `vv_at` only after the OTP), wrong-code failure
  (401, auth user stays unconfirmed, profile stays pending, no session, correct code recovers),
  unconfirmed-orphan self-heal (202, orphan id reclaimed, fresh user + profile), confirmed-orphan
  fail-closed (409, orphan untouched, no profile). Main Phase-7 smoke re-run still **35/35**.

### 2026-10-31 — Revision 2 addendum, Phase 0: catalog extraction (A1)

- **Trigger:** Addendum to Implementation Spec — Revision 2 (A0 communication protocol, A1 mandatory
  pre-work, A2 Resend delivery bug, A3 Redis offline mode, A4 Definition-of-Done delta, A5 playbook
  template). The addendum says "apply before Phase 1 begins"; Phases 1–7 have already landed, so it
  is applied as a **retrofit to shipped code** (see Decisions & Assumptions → Revision 2 addendum).
- **What was done:** located and read the five catalogs at the repo root
  (`vunvault-task-catalogue-part-1..5.md`, 29,512 lines / ~2 MB in total) and extracted the canonical
  signup-verification and authentication workflows, the naming/error-code/data-model conventions, and
  every conflict between the catalogs and the addendum. Recorded below under **Catalog Extraction**.
- **Reading method (declared, not silent):** an exhaustive line-by-line read of 29,512 lines does not
  fit a single working context. The catalogs were indexed in full (`grep` over every part for signup,
  verification, auth, session, MFA, magic-link, health, Redis, guard, permission, error) and then the
  identified canonical sections were read **in full**: Tasks 15, 19, 20c, 21, 22, 24, 26, 27, 40,
  40d, 40e, 43, 59–63, 92, 102, 105, 110. Coverage limits are recorded in Known Gaps per A0.4 —
  nothing here is claimed as read that was not.
- **Files:** `playbook.md` only (this entry, Catalog Extraction, Email Delivery, Redis Mode,
  Decisions & Assumptions, Known Gaps, Definition of Done).
- **Headline finding:** the string `magic-link` appears **zero times in all five catalogs**. The
  magic-link login surface is entirely a work-order/spec construct; the catalogs' canonical login is
  `POST /auth/login` with email + password (Task 26) and their canonical mailbox proof is a 6-digit
  **email OTP** (Task 40d), not a link. This governs how A1.3 is applied.

## Catalog Extraction

Per addendum A1.2/A5. Each entry names the catalog part, the sections that carry the canonical
workflow, and what that part contributes. Phases 1–4 traceability is in the last column of each row.

### Catalog 1 — `vunvault-task-catalogue-part-1.md` (Part 1 of 5 — Layers L0, L1, L2, Tasks 1–20)

- **Signup verification workflow:** *not defined here.* Part 1 lays the data + contract foundations
  only; there is no signup route yet.
- **Authentication workflow:** *not defined here* (no routes). Task 19 fixes the vocabulary every
  later auth task must use.
- **Canonical sections:** Task 15 (line 2284) *Schema: identity, organisations, invitations, WebAuthn,
  consent* — `profiles`, `organizations`, `invitations`, `webauthn_credentials`, consent records,
  `ACCOUNT_STATUSES`. Task 19 (line 2760) *Contracts A: common envelopes, auth, roles & permissions*
  — `ErrorEnvelope = { error, message?, details? }`; `PERMISSIONS` (19 exact strings:
  `dashboard:read … profile:write`); `ROLE_PERMISSIONS` (`super_admin` = ALL); `ROLE_LABELS`;
  `JwtClaims = { sub, role, org_id, permissions }`;
  `SessionUser = { id, email, fullName, role, orgId, permissions, mfaEnrolled }`;
  `ProvisionInviteBody` — **admin provisioning** gates: email must end `@vunvault.com`, staff roles
  only, and `checklist: { mfaEnrolmentMandatory: true, ndaOnFile, backgroundVerified,
  trainingAcknowledged }`.
- **Conflicts with spec:** none direct. Note that `PERMISSIONS` is declared *exact* — there is no
  `diagnostics:*` permission, which constrains A2.4 (see conflict 6 below).
- **Phases 1–4 traceability:** Phase 2 admin roster + MFA enforcement ← Task 19
  `ProvisionInviteBody.checklist.mfaEnrolmentMandatory` and `ROLE_PERMISSIONS`; Phase 4 signup guard
  (admin emails rejected at signup) ← Task 19's `@vunvault.com` staff-address rule.

### Catalog 2 — `vunvault-task-catalogue-part-2.md` (Part 2 of 5 — addenda 20b–20d, L3, L4, Tasks 20b–40)

- **Signup verification workflow:** Task 26 (line 1208) defines the *original* signup — validate →
  HIBP `BreachCheck` (fail-open on timeout/5xx, `warn`) → `409 email_taken` → `createUser(emailConfirm:
  true)` → one transaction inserting `organizations` + `profiles` → `signInWithPassword` →
  `setSessionCookies` → `user_sessions` → audit `ACCOUNT_REGISTERED` → `201 { data: SessionUser }`.
  Task 26 explicitly carries a `// DECISION(v1)` note that **mailbox-ownership verification is NOT
  part of signup** — this is the decision Task 40d later reverses.
- **Authentication workflow (canonical session model):** Task 24 (line 944) + Task 26 (line 1208).
  - *Token source:* access token is read **only** from cookie `vv_at` — never an `Authorization`
    header, never a query string (a valid Bearer header alone must 401).
  - *Verification:* `jose.jwtVerify`, HS256 with `SUPABASE_JWT_SECRET`, `issuer = <SUPABASE_URL>/auth/v1`,
    `audience = "authenticated"`, `clockTolerance: 5`. Required claims `sub, exp, session_id, aal`
    (`aal1`|`aal2`) plus custom `role, org_id, permissions`, Zod-validated. Missing/invalid → `401
    { error: "unauthorized" }`.
  - *Token lifecycle:* `vv_at` (access) + `vv_rt` (refresh; 30 days when `remember`) + `vv_csrf`
    (re-issued on every set); `vv_mfa` (300 s) carries the pre-second-factor state. `POST /auth/refresh`
    rotates both cookies and updates `user_sessions.last_seen_at` → `204`; invalid → clear cookies,
    `401 unauthorized`. `POST /auth/logout` → `signOut(at, "local")`, `user_sessions.revoked_at`,
    clear all cookies, audit `AUTH_LOGOUT`, `204`. **No route ever returns a token in its body.**
  - *Revocation path:* `authenticate` consults the Redis **session-registry** (`sess:<sessionId>`,
    TTL 30 s); on a miss it reads `user_sessions.revoked_at` + `profiles.account_status, deleted_at`.
    Revoked, non-`active`, or soft-deleted → `401 unauthorized`. `last_seen_at` is updated
    fire-and-forget at most once per minute per session.
  - *AAL rule:* `AuthUser.aal` is `aal2` when the JWT says `aal2` **or** `user_sessions.mfa_method IS
    NOT NULL` (in-house WebAuthn / email-OTP cannot raise Supabase's own AAL, so they record
    `mfa_method` on the session row).
  - *MFA step:* challenge = random 32-byte base64url handle → Redis `mfa:<handle>` TTL 300 s holding
    `{ userId, email, remember, attempts: 0, methods, sessionEnc }`, where `sessionEnc` is the aal1
    session sealed with AES-256-GCM under a key derived by HKDF-SHA256 from
    `SUPABASE_SERVICE_ROLE_KEY` with info `"vv-mfa-challenge"`. `POST /auth/mfa/verify`: missing
    challenge → `410 challenge_expired`; 5 failures → delete challenge, audit `AUTH_MFA_FAILURE`,
    `401 mfa_failed`. Methods `totp` (→ aal2), `email_otp` (Redis `emailotp:<userId>` TTL 600 s, max
    1 send / 60 s, staff roles only), `webauthn`, `recovery`.
  - *Lockout:* failed `login_attempts` ≥ 5 per `sha256(lower(email))` in 15 min, or ≥ 20 per IP →
    `429 { error: "rate_limited" }` + `Retry-After: 900` + audit `AUTH_RATE_LIMIT`. Wrong password,
    unknown email, suspended, dormant and soft-deleted all collapse to one byte-identical
    `401 { error: "invalid_credentials" }` with a dummy hash comparison to equalise timing.
  - *Protected-route rules:* guards compose as
    `preHandler: [app.authenticate, app.requireStaff, app.requirePermission("x:y")]` on every
    `/admin/*` route. `requireStaff` = role ∈ `STAFF_ROLES` (`super_admin, admin, security_analyst,
    soc_operator, compliance_auditor, support_engineer`) **and** `aal === "aal2"`; staff on `aal1` →
    `403 { error: "mfa_required" }`. Also `requirePermission`, `requireAnyPermission`, `requireRole`,
    `optionalAuth` (never rejects). Task 40 (line 2927) enforces all of this with a conformance suite
    that walks the live route table against the `PUBLIC_ROUTES` allow-list.
  - *Claims hook:* `0024_auth_hook.sql` — `vv_custom_access_token_hook` injects `role`, `org_id`,
    `permissions` from `profiles`; no profile or `account_status <> 'active'` → `role = 'client'`,
    `permissions = []`. A test compares the SQL `CASE` against `ROLE_PERMISSIONS` to prevent drift.
- **Infrastructure conventions that bind A2/A3:** Task 21 (line 567) — health is **exactly**
  `GET /healthz → 200 { status: "ok" }` (no dependency checks) and `GET /readyz →` registered checks
  with a 2 s timeout each → `200 { status:"ready", checks }` / `503 { status:"not_ready", checks }`;
  error codes `validation_failed`(400) `unauthorized`(401) `forbidden`(403) `not_found`(404)
  `rate_limited`(429) `internal_error`(500). Task 22 (line 692) — `SecretProvider.get(name)` **throws
  `Error("secret <name> missing")`** when absent; `SECRET_NAMES` is an exact list containing
  `RESEND_API_KEY` and `UPSTASH_REDIS_URL`; the Redis plugin is
  `new Redis(await app.secrets.get("UPSTASH_REDIS_URL"), { maxRetriesPerRequest: null,
  enableReadyCheck: false, tls: {} })` with readiness checks `db` (`select 1`) and `redis` (`PING`);
  email is `ResendEmailProvider` over **global `fetch`, no vendor SDK**.
- **Conflicts with spec:** Redis mandatory (Task 22) vs A3 Redis-optional; no `/health` route
  (Task 21) vs A3.4; password login canonical (Task 26) vs the work order's zero-password rule.
- **Phases 1–4 traceability:** Phase 1 magic-link single-use tokens + `vv_mfa` hand-off ← Task 24's
  cookie/AAL model and Task 26's challenge store; Phase 2 MFA enforcement ← Task 26 step 4 + Task 24
  `requireStaff` aal2 rule; Phase 3 unregistered-email invitation ← Task 26's identical-body
  anti-enumeration posture; Phase 4 bot defense / rate limiting ← Task 26 lockout + `AUTH_RATE_LIMIT`.

### Catalog 3 — `vunvault-task-catalogue-part-3.md` (Part 3 of 5 — addenda 40b–40e, L5, L6, L7 auth & onboarding)

- **Signup verification workflow — CANONICAL (Task 40d, line 332).** "Auth addendum A: signup with
  email-OTP verification". The prototype flow it encodes is **(1) details → (2) "Verify your email"
  with a 6-digit code → (3) "Two-factor authentication" with an authenticator code → (4) "Account
  Created & Verified!"**. Task 26 had skipped mailbox verification; 40d replaces that behaviour.
  Ordered gates, exactly as written:
  1. `POST /api/v1/auth/signup` (public, policy `public_form`): validate `SignupBody` (password min
     12 + upper/lower/digit/symbol); `BreachCheck` → `422 breached_password`; an existing **`active`**
     profile → `409 { error: "email_taken" }`; an existing **`pending_verification`** profile for the
     same email is **REPLACED** (delete the unverified Supabase user + rows, then continue).
  2. `supabase.createUser({ email, password, emailConfirm: false, userMetadata: { fullName } })`.
  3. In ONE transaction insert `organizations` + `profiles` with `account_status =
     'pending_verification'` and `require_2fa = true`.
  4. Issue the OTP: 6 random digits (`crypto.randomInt`), Redis
     `signup:otp:<sha256(lower(email))>` = `{ codeHash: sha256(code), attempts: 0 }` TTL **600 s**;
     email via `app.email` (subject `"Your VUNVAULT verification code"`, body shows the code and says
     it expires in 10 minutes). In `NODE_ENV=development` ONLY also log the code at `debug`.
  5. **NO cookies are set.** Respond `202 SignupStartResponse` =
     `{ data: { email, verificationRequired: true, resendAfterSeconds: 30, expiresInSeconds: 600 } }`.
     Audit `ACCOUNT_REGISTERED` with `details: { stage: "started" }`.
  6. `POST /api/v1/auth/signup/verify-email` (public, policy `login`): look up the OTP; compare
     `sha256(code)` **constant-time**; at **5** failed attempts delete the OTP → `401 { error:
     "otp_exhausted" }`; wrong code → `401 { error: "otp_invalid" }` and `attempts++`; expired/missing
     → `410 { error: "otp_expired" }`. On success: `supabase.confirmEmail(userId)` → profile
     `account_status = 'active'` → delete the OTP → `supabase.issueSession(email)` (implemented as
     `auth.admin.generateLink({ type: "magiclink", email })` then server-side `auth.verifyOtp({
     token_hash, type: "magiclink" })`) → **aal1** session → `setSessionCookies` (`remember = false`)
     + `user_sessions` row → audit `ACCOUNT_REGISTERED` `{ stage: "email_verified" }` → `200 { data:
     SessionUser }` with `mfaEnrolled: false`.
  7. The web app then calls the Task 27 TOTP routes (`/account/mfa/totp/enroll`, `/verify`) to
     complete step 3; **the verify route replaces the cookies with the aal2 session**.
  8. `POST /api/v1/auth/signup/resend` (public, `public_form`): **always `202 {}`**; only if a
     `pending_verification` profile exists and the last send was ≥ 30 s ago is a new OTP issued
     (invalidating the old one).
  9. Cleanup contract: `pending_verification` profiles older than **24 h** are deleted (profile,
     organization, Supabase user) by the maintenance worker — repo exposes
     `listStalePendingSignups(olderThan)`.
  - What gates what: **no session before the OTP verifies** (step 5 sets no cookies); **no aal2
    before TOTP enrolment** (step 7); **no account survives 24 h unverified** (step 9).
- **Authentication workflow:** Task 40e (line 466) adds OAuth sign-in (Google, GitHub, Microsoft) via
  Supabase PKCE. Task 43 (line 938) fixes the **client-side protected-route rules**: `/portal`,
  `/portal/*`, `/admin`, `/admin/*`, `/onboarding` require cookie `vv_at` or `vv_rt`, else
  `302 /login?next=<path+search>`; `/login` and `/signup` with a session cookie present →
  `302 homeFor(role)`; `/admin/*` with a peeked role of `client` → `302 /forbidden`; and the mandated
  comment that *peeking is a routing convenience, never a security decision* — the API remains the
  authority. `homeFor(role)`: staff → `/admin` (`support_engineer` → `/admin/profile`, no dashboard
  permission), `client` → `/portal`. `requireSession({ staff?, permission? })` redirects to `/login`
  or `/forbidden`; staff without MFA go to `/login?error=mfa_required`. Task 59 (line 8293) login
  page, Task 60 (8685) MFA challenge dialog (authenticator code, security key, email code, recovery
  code), Task 61 (9100) signup page A (details, validation, strength meter), Task 62 (9488) signup
  page B (email verification, authenticator enrolment, success), Task 63 (9906) accept-invite,
  forgot-password, reset-password, newsletter-confirm.
- **Also in 40d — forgot / reset password:** `POST /auth/forgot-password` (public, `public_form`)
  **always `202 {}`**, identical body and similar timing; token = 32 random bytes base64url, Redis
  `pwreset:<sha256(token)>` = `{ userId }` TTL 1800 s single-use, at most 3 live tokens per user,
  link `${WEB_ORIGIN}/reset-password?token=<token>`; nothing audited at request time (a `debug` log
  only) — the audit entry is written on successful reset. `POST /auth/reset-password`: look up and
  DELETE atomically (`GETDEL`); invalid/used/expired → `410 { error: "token_invalid" }`; validate
  (staff 14, others 12), breach check, `updatePassword`, **revoke ALL sessions** (Supabase +
  `user_sessions` + registry), set `last_password_change_at`, email `credentials_changed`, audit
  `PASSWORD_CHANGED` `{ via: "reset" }`, `204`. **MFA is NOT bypassed.**
- **Conflicts with spec:** (a) 40d's forgot/reset-password routes were deleted in Phase 5 of the work
  order (no password login remains) — the catalog text is now dead contract; (b) 40d's mailbox proof
  is a **6-digit OTP**, whereas the work order's login surface is a **magic link** — note that 40d's
  own `issueSession` is implemented with `generateLink({type:"magiclink"})`, so the link mechanism is
  catalog-sanctioned *internally* even though the login surface is not; (c) Task 26's `201 +
  cookies` signup response is superseded by 40d's `202 + no cookies`.
- **Phases 1–4 traceability:** Phase 1 verify-leg aal1→aal2 hand-off and the "no token in a body"
  rule ← 40d step 6 + Task 24; Phase 2 forced first-sign-in MFA setup ← 40d step 7 (`require_2fa =
  true`, `mfaEnrolled: false`); Phase 3 unregistered-email handling ← 40d step 8's always-identical
  `202 {}` anti-enumeration posture applied to the magic-link leg; Phase 4 signup guard ←
  40d step 1's replace-if-`pending_verification` + Task 19's staff-address rule.

### Catalog 4 — `vunvault-task-catalogue-part-4.md` (Part 4 of 5 — addenda 40f–40g, L8 client portal, L9 admin surface, L10 scan worker)

- **Signup verification workflow:** none. Part 4 contains a single incidental `signup` mention
  (`stale signups` cross-reference); it does not alter Task 40d.
- **Authentication workflow:** no new auth mechanism. It *consumes* the Task 24 guard model — every
  admin surface here is built as `[authenticate, requireStaff, requirePermission(…)]`. Relevant
  sections: Task 83b (line 7788) Admin Audit Logs (summary, filters, chain status, verification,
  export, event detail), Task 83d (8828) Admin Profile Settings B — security & credentials, **active
  sessions**, notification preferences, Task 83e (9031) Admin Contact inbox + Verified-Blogger badge
  management. Task 69/70/73 are client-portal surfaces behind the Task 43 `/portal` guard.
- **Naming/conventions contributed:** the `verify` vocabulary in this part is overwhelmingly
  **audit-chain verification** (86 `verify` hits), not email verification — a grep-level trap worth
  recording so nobody conflates `audit:verify` with signup OTP verification.
- **Conflicts with spec:** none. A2.4's diagnostics endpoint would live in this admin surface, but
  no such route exists in Part 4 (see conflict 6).
- **Phases 1–4 traceability:** Phase 2's admin-session visibility ← Task 83d; the super-admin-only
  gating the addendum asks for in A2.4 ← Task 83b/83d's guard pattern.

### Catalog 5 — `vunvault-task-catalogue-part-5.md` (Part 5 of 5 — L11 workers, L12 real-time, L13 DevOps, L14 integration & hardening, Tasks 88b–110)

- **Signup verification workflow:** Task 92 (line 510) *Maintenance worker B* implements the other
  half of Task 40d's cleanup contract — retention purges, invitation expiry, dormant accounts,
  **stale signups** (the >24 h `pending_verification` sweep), upload processing, daily audit
  snapshot. So the signup workflow's final gate (unverified accounts do not survive) is owned here.
- **Authentication workflow:** no new mechanism. Task 105 (line 2194) *E2E platform: local stack,
  **fake providers**, seed users with MFA, Playwright fixtures, smoke specs* is the catalog's
  sanctioned home for test doubles — which matters for A2: a fake email provider belongs in the E2E
  harness, never bound in a production config. Task 102 (1880) edge Worker (API reverse proxy,
  origin verification), Task 103 (1986) CI, Task 110 (2690) closeout — runbooks, key rotation,
  audit-snapshot verification, go-live checklist.
- **Conflicts with spec:** Task 105's "fake providers" pattern is legitimate for E2E but is exactly
  the mechanism A2.1 warns about (`test-double bound in prod config`); the boundary is that the fake
  is wired by the *harness*, not by `NODE_ENV` inside the API.
- **Phases 1–4 traceability:** Phase 3's invite cooldown + Phase 1's TTL'd tokens both rely on expiry
  semantics that Task 92's sweeps backstop; Phase 4's audit expectations ← Task 110's runbook/verify
  tooling.

### Cross-catalog conventions (bind every phase)

- **Redis key namespace:** `signup:otp:<sha256(lower(email))>` (600 s) · `pwreset:<sha256(token)>`
  (1800 s) · `mfa:<handle>` (300 s) · `emailotp:<userId>` (600 s) · `sess:<sessionId>` (30 s).
  Phase 1 added `ml:pointer:<email>`, `ml:token:<jti>`, `ml:invite:<sha256(email)>` in the same
  shape — **all five are Redis-backed and therefore all five need an A3 in-memory fallback.**
- **Cookies:** `vv_at`, `vv_rt`, `vv_csrf`, `vv_mfa` — HttpOnly, never in a body, never in a URL.
- **Audit events:** `ACCOUNT_REGISTERED` (with `stage`), `AUTH_SUCCESS` (`details.mfa`),
  `AUTH_FAILURE`, `AUTH_RATE_LIMIT`, `AUTH_MFA_FAILURE`, `AUTH_LOGOUT`, `PASSWORD_CHANGED`,
  `PERMISSION_CHANGED`. Phase 1/3/4 added `MAGIC_LINK_ISSUED`, `SIGNUP_INVITE_SENT`,
  `AUTH_BOT_REJECTED`.
- **Error codes:** `validation_failed` `unauthorized` `forbidden` `not_found` `rate_limited`
  `internal_error` `email_taken` `breached_password` `invalid_credentials` `mfa_failed`
  `challenge_expired` `not_implemented` `otp_invalid` `otp_exhausted` `otp_expired` `token_invalid`
  `mfa_required` `signup_not_allowed` (work order).
- **Layering:** `routes → service → repo`; repos take `Db | Tx` and return plain objects; route files
  contain no Drizzle calls; state-changing routes are wrapped in `audited()` so domain writes and the
  audit append commit in ONE transaction. Forbidden anywhere: Express, Prisma, Joi, `localStorage`,
  `sessionStorage`, hard-coded secrets.
- **Data models:** `AuthUser { id, email, role, orgId, permissions, aal, sessionId }` ·
  `SessionUser { id, email, fullName, role, orgId, permissions, mfaEnrolled }` ·
  `MfaChallenge { userId, email, remember, attempts, methods, sessionEnc }` ·
  `account_status ∈ ACCOUNT_STATUSES` (incl. `pending_verification`) · `require_2fa` ·
  `client_code` `VV-CL-#####` from `next_client_code()` (sequence starts 48211).

### Conflicts between the catalogs and the Revision 2 addendum (A1.2)

1. **`magic-link` does not exist in the catalogs (0 hits in all 5 parts).** The canonical login is
   `POST /auth/login` with email + password (Task 26) and the canonical mailbox proof is a 6-digit
   email OTP (Task 40d). *Resolution per A1.3:* the catalogs keep authority over workflow **shape**
   (details → mailbox proof → TOTP → aal2; identical generic responses on the unauthenticated legs;
   cookies-only tokens), and the work order keeps authority over the **credential** (magic link
   instead of password). Already implemented this way in Phases 1–3; no change needed.
2. **Redis is mandatory in the catalogs, optional in the addendum.** Task 22 constructs
   `new Redis(await app.secrets.get("UPSTASH_REDIS_URL"))` and `SecretProvider.get` *throws* on a
   missing secret; `app.ts` registers a hard `redis` readiness probe. A3 requires the system to run
   correctly with Redis absent. *Resolution per A1.3:* A1.3 names "redis-optional" as one of the
   spec's own security requirements, so **the addendum wins** and the conflict is recorded here.
   Consequence that must be honoured: `/readyz` may **not** report `not_ready` merely because Redis
   is intentionally offline, or the orchestrator would pull traffic from a healthy pod (Task 21's own
   reasoning for why `/healthz` answers from the process alone).
3. **There is no `/health` route in the catalogs.** Task 21 defines exactly `/healthz` and `/readyz`;
   Task 40's conformance suite pins the route table and its schema check exempts only those two by
   name. A3.4 requires `/health → { redis, store }`. *Resolution:* add `/health` as a new public
   infra route with a real Zod response schema, listed in `PUBLIC_ROUTES`, leaving `/healthz` and
   `/readyz` byte-identical so catalog conformance is preserved.
4. **Task 40d's forgot/reset-password routes no longer exist.** Phase 5 deleted every password-login
   surface; the catalog still specifies them, and `SignupBody.password` is still collected, validated
   and breach-checked while authenticating nobody (already in Known Gaps as Q3).
5. **Signup response code:** Task 26 `201 + cookies` vs Task 40d `202 + no cookies`. Implemented per
   40d (the later addendum supersedes).
6. **A2.4's `POST /admin/diagnostics/email-test` is in no catalog, and no `diagnostics:*` permission
   exists** in Task 19's exact `PERMISSIONS` list — while Task 40's conformance suite demands
   `requirePermission`/`requireAnyPermission` on every `/api/v1/admin/*` route. *Resolution:* reuse an
   existing catalog permission rather than inventing one (precedent: `admin-badges` uses
   `users:manage`) and add `requireRole('super_admin')` to satisfy the addendum's "super-admin only".
7. **Test doubles:** Task 105 sanctions fake providers in the E2E harness; A2.1 forbids a test double
   bound in prod config. The line drawn here: a fake may be *injected by the harness* through the
   existing `ProvidersPluginOptions.email` seam, but nothing inside the API may select a fake based
   on `NODE_ENV`.

### 2026-10-31 — Revision 2 addendum, A2: Resend delivery contract + startup guard

- **Trigger:** reported symptom — the UI confirms "email sent", no email arrives, and the Resend
  dashboard shows no send event for the address.
- **Diagnosis (A2.1, call path traced end to end):** `use-magic-link.ts` → `POST /api/v1/auth/magic-link`
  → `magicLinkHandler` → `app.withTx` → `AuthService.requestMagicLink` → `app.email.send()` →
  `ResendEmailProvider.send()` → `POST https://api.resend.com/emails`. The provider itself was NOT
  the bug: it already awaited, threw on non-2xx, and refused a 2xx without an `id`. What the trace
  found instead is that **five distinct outcomes answer the byte-identical `200` "check your email"
  ack while sending nothing at all**, and only two of them left any trace:
  | Outcome | Sent? | Trace before this change |
  | --- | --- | --- |
  | `bot_dropped` (honeypot `website` filled — autofill/password managers do this) | no | audit only |
  | `bot_dropped` (timing — `formTs` too close to submit; **browser/server clock skew fails every request this way**) | no | audit only |
  | `window_suppressed` (per-address issuance window) | no | audit only |
  | `suppressed` (unregistered + invite cooldown) | no | **nothing at all** |
  | `link` with no email provider configured | no | a warn line |
  Nothing logged the Resend response, so even a *successful* send left no id to correlate with the
  dashboard. That combination — a generic 200 by design, plus zero observability — is what made this
  undiagnosable, and it is what this change fixes.
- **Changes (A2.2):** `packages/lib/src/providers/email.ts` now takes an optional logger and a send
  context, and logs the full response `{ id, status, error }` with the request id — at `info` on
  success, at `error` on every failure — while never logging the recipient address or the body. A 2xx
  carrying no `id` is now explicitly a FAILURE. `RequestMeta` gained an optional `requestId`, threaded
  from `request.id` into both magic-link sends as `purpose: 'magic_link' | 'signup_invite'`.
- **Changes (A2.1, observability of the silent paths):** every outcome that answers `200` without
  sending now emits a greppable warn line — `magic-link produced NO EMAIL · reason=<reason> ·
  requestId=<id>` — including the invite-cooldown path that previously left no trace anywhere. The
  HTTP response is **unchanged and still byte-identical** for registered and unregistered addresses:
  the fix adds server-side visibility, never a client-visible distinction (no enumeration, no
  email-status leak). `ProviderError` is not an `HttpError`, so a failed send still collapses to a
  generic `500 internal_error`.
- **Changes (A2.3, startup guard):** new `buildResendEmailProvider()` in `apps/api/src/plugins/providers.ts`.
  `RESEND_API_KEY` unset/empty → **FATAL + refuse to boot**. From-domain definitively not `verified`
  in Resend → **FATAL + refuse to boot** (Resend accepts the request and then refuses *delivery*,
  which is the reported symptom exactly). From-domain **uncheckable** (Resend's `/domains` API
  unreachable or non-2xx) → loud FATAL-level log, then boot: taking the platform down over a
  control-plane blip is the worse failure. `assertPlausibleFromAddress()` also rejects a placeholder
  or unqualified sender offline, before any network call.
- **Changes (A2.4, diagnostics):** new `POST /api/v1/admin/diagnostics/email-test`
  (`apps/api/src/routes/v1/diagnostics/index.ts`). Body `{ to, subject? }`; performs one real send and
  returns `{ data: { id, status, store } }` where `id` is the raw Resend id to search the dashboard
  for. Guarded `authenticate → requireStaff (aal2) → requirePermission('users:manage') →
  requireRole('super_admin')`, rate policy `sensitive`, and audited as the new `EMAIL_DELIVERY_TEST`
  system event with the destination and Resend id in the sealed chain. The addendum wrote the path as
  `/admin/diagnostics/email-test`; it lives under the `/api/v1` prefix like every other admin route.
- **Files:** `packages/lib/src/providers/email.ts`, `packages/lib/src/providers/index.ts`,
  `apps/api/src/plugins/providers.ts`, `apps/api/src/routes/v1/auth/service.ts`,
  `apps/api/src/routes/v1/auth/index.ts`, `apps/api/src/routes/v1/diagnostics/index.ts` (new),
  `apps/api/src/routes/v1/index.ts`, `apps/api/src/audit/events.ts`,
  `apps/api/src/audit/events.test.ts` (system-category count 5 → 6),
  `apps/api/src/plugins/email-guard.test.ts` (new, 13 tests),
  `apps/api/src/routes/v1/diagnostics/diagnostics.test.ts` (new, 2 tests), `playbook.md`.
- **Verification:** `tsc --noEmit` ✅ zero errors · eslint on every changed file ✅ · full API suite
  **1046/1046 (57 files)** ✅ against a pre-change baseline of **1017/1017 (55 files)** — 29 new
  tests, zero regressions.
- **NOT verified by the agent (A2.5 — recorded, not skipped):** no live send was performed. There is
  no `RESEND_API_KEY` in this environment and no access to the Resend dashboard or the user's inbox,
  so the checklist below is handed to the user rather than claimed as done. See Known Gaps.

**A2.5 verification checklist — status**

| # | Check | Result |
| --- | --- | --- |
| 1 | Request a magic link → a new entry appears in Resend → Emails within 30 s | ⏳ **user to run** (no API key / dashboard access here) |
| 2 | That entry shows status `delivered`/`sent` within 30 s | ⏳ **user to run** |
| 3 | The `info` log line for the request carries the same Resend `id` | ✅ implemented + unit-pinned (`email-guard.test.ts`) |
| 4 | `POST /api/v1/auth/magic-link` body is identical for registered and unregistered emails | ✅ unchanged by this work + already pinned by Phase 3 tests |
| 5 | Removing `RESEND_API_KEY` produces a loud startup failure, not silent success | ✅ implemented + unit-pinned (rejects with `FATAL: RESEND_API_KEY is not set`) |
| 6 | An unverified from-domain refuses to boot | ✅ implemented + unit-pinned |
| 7 | `POST /api/v1/admin/diagnostics/email-test` returns a raw Resend id | ✅ route live + guarded (401 unauthenticated); ⏳ live id **user to run** |

### 2026-10-31 — Revision 2 addendum, A3: Redis offline mode

- **Trigger:** the user has temporarily disabled local Redis and will switch it back. The catalogs
  make Redis mandatory (Task 22) and `SecretProvider.get` throws on a missing secret, so an absent
  `UPSTASH_REDIS_URL` was an unbootable API.
- **Changes (A3.1, one switch):** `REDIS_OPTIONAL` = `auto` (default) | `always` | `never`, defined
  once in `apps/api/src/config/env.ts` so the schema and the boot logic cannot drift. `auto` =
  optional outside production, **required in production**; `always` = optional everywhere; `never` =
  required everywhere. The connection string stays the vault secret `UPSTASH_REDIS_URL` — no second
  source of truth was introduced. Re-enabling Redis is `set the secret → restart`: **zero code
  changes**, and the boot path is the same one that runs today.
- **Changes (A3.1, unreachable-at-boot fallback):** `plugins/redis.ts` now proves the server answers
  before trusting it. It builds the command connection with the catalog's exact options
  (`maxRetriesPerRequest: null`, `enableReadyCheck: false`, TLS by URL scheme) and PINGs it inside a
  bounded budget (`REDIS_PROBE_TIMEOUT_MS` = 4 s). Probing the connection it intends to keep — rather
  than a throwaway — means an offline boot opens no socket to tear down and an online boot opens
  exactly the one connection it always did (this is why the existing `createRedis` instance-count test
  still passes untouched). Unreachable + optional → disconnect, fall back, warn. Unreachable +
  required → FATAL, refuse to boot.
- **Changes (A3.2, in-memory fallback):** new `apps/api/src/lib/memory-redis.ts`. `app.redis` is the
  shim rather than `undefined`, so **every existing consumer keeps one type and no call site needed a
  branch**. It implements exactly the commands the auth paths use — `get/set (EX·PX·NX·XX)/setex/del/
  exists/incr/incrby/decr/expire/pexpire/ttl/pttl/getdel/lpush/rpush/lrange/llen/publish/keys/flushdb/
  ping/quit/disconnect` — with real TTL semantics and `GETDEL` atomicity, which is what single-use
  tokens and the invite cooldown depend on. Anything else throws `TypeError` at the call site: loud
  and immediate, which is safer than a shim pretending to be a complete Redis. Covered: magic-link
  single-use (`ml:token:`, `ml:pointer:`), invite cooldown (`ml:invite:`), MFA challenge + replay cache
  (`mfa:`, `emailotp:`), signup OTP (`signup:otp:`), lockout/attempt counters (`rl:`), session registry
  (`sess:`), anti-bot counters.
- **Changes (A3.3, single-instance caveat):** `MEMORY_STORE_CAVEAT` is logged at `warn` on **every**
  offline boot, with the reason, and states that the fallback is correct only for one API instance and
  that a restart clears every token and counter. Also documented in the module header and in Redis Mode
  below.
- **Changes (A3.4, health):** new `GET /health` → `{ redis: "up" | "down", store: "redis" | "memory" }`,
  added to `PUBLIC_ROUTES`. `/healthz` and `/readyz` are **byte-identical** to their catalog shapes
  (Task 21) — this is a third route, not a reshaped one.
- **Changes (A3, readiness interaction):** the `redis` readiness probe is registered **only** while a
  real Redis backs the app. Offline, the shim always answers `PONG`, so leaving the probe registered
  would advertise a dependency that is deliberately absent; making it fail would be worse — the
  orchestrator would pull traffic from a pod that is serving correctly, which is precisely Task 21's
  stated reason for `/healthz` answering from the process alone. `/health` reports the degraded mode;
  `/readyz` remains the live probe.
- **Changes (A3, queues):** BullMQ *is* Redis, so `queues/index.ts` builds no producer offline. It
  decorates the disabled registry instead, whose `add()` logs `job NOT enqueued: Redis is offline…`,
  counts the refusal per queue (`dropCounts()`), and resolves to `undefined` — it never invents a job
  id or reports success. **Auth mail does not go through the queues**: magic-link and signup-OTP sends
  are inline `await app.email.send(…)`, so offline mode does not stop authentication email. What
  degrades is asynchronous fan-out (notify digests, PDF rendering, broadcasts, scans) — see Known Gaps.
- **Files:** `apps/api/src/config/env.ts`, `apps/api/src/lib/memory-redis.ts` (new),
  `apps/api/src/plugins/redis.ts`, `apps/api/src/app.ts`, `apps/api/src/queues/index.ts`,
  `apps/api/src/routes/health.ts`, `apps/api/src/types/fastify.d.ts`,
  `apps/api/src/conformance/route-manifest.ts`, `.env.example`, `apps/api/.env.example`,
  `apps/api/src/plugins/redis-offline.test.ts` (new, 16 tests), `playbook.md`.
- **Verification:** `tsc --noEmit` ✅ · eslint ✅ · full API suite **1046/1046 (57 files)** ✅.

**A3.5 verification checklist — status**

| # | Check | Result |
| --- | --- | --- |
| 1 | With Redis offline (`UPSTASH_REDIS_URL` unset, `REDIS_OPTIONAL=always`): API boots, `/health` → `{redis:"down",store:"memory"}`, magic-link issue + consume works on the shim | ✅ unit-pinned (`redis-offline.test.ts`) — no live Redis exists in this sandbox to switch off |
| 2 | With Redis unreachable but configured (host refuses): same fallback, reason recorded | ✅ unit-pinned |
| 3 | `REDIS_OPTIONAL=never` (or `auto` in production) + no Redis → loud FATAL boot refusal | ✅ unit-pinned |
| 4 | Re-enabling Redis: set `UPSTASH_REDIS_URL`, restart, `/health` → `{redis:"up",store:"redis"}`, **no code change** | ✅ unit-pinned (same binary, both modes) — ⏳ live re-enable against the user's Redis is **user to run** |
| 5 | `/readyz` does not report `not_ready` merely because Redis is intentionally offline | ✅ unit-pinned |
| 6 | Single-instance caveat logged on every offline boot and documented | ✅ |

### 2026-10-31 — Revision 3 addendum, A6: local Redis as the primary store (corrected root cause)

**Root-cause correction.** The Revision 2 reading — "Redis is offline" — was wrong. The deployment
moved from a **managed** Redis provider (which was rate-limiting the API) to a **local** instance that
is live. The defect that actually produced "magic link sent, no email" was an **uncaught store error
inside a request preHandler**:

- `plugins/rate-limit.ts` called `store.increment()` with no error handling. When the provider
  throttled or rejected a command the preHandler threw, so Fastify answered **500 on every
  rate-limited route before the handler ran** — the magic-link handler never reached
  `app.email.send(...)`. Nothing was queued at Resend, which is exactly the reported symptom.
- `LoginAbuseGuard` had the same uncaught pattern on its window counters.

**Fix — hybrid failure policy (user decision):**

- **Counters fail OPEN.** `rate-limit.ts` `increment` and `LoginAbuseGuard.claim` wrap their store
  calls; on a Redis fault they log `warn({ err, scope }, …)` and let the request through instead of
  500-ing. Losing a counter for the duration of an outage is preferable to locking every user out of
  login.
- **Single-use token stores fail CLOSED.** `MagicLinkTokenStore.issue`/`.consume` go through `guard()`:
  on a fault it logs `warn` with `scope: magic_link_issue` / `magic_link_consume` and **rethrows**. A
  token store that silently "succeeded" would either issue a link that can never be redeemed or accept
  a replayed one. `SignupInviteCooldown.claim` fails closed by returning `false`, which **suppresses**
  the send — during an outage we will not email-bomb an address we cannot remember we already emailed.
- **Logging seam:** `StoreLogger` (a `warn(fields, message)` shape) is defined in `challenge.ts` and
  re-exported by `login-abuse.ts`, so both stores accept a logger without an import cycle;
  `routes/v1/auth/index.ts` passes `app.log` into every Redis-backed auth store.
- **Observability:** every Redis fault carries a `scope` field, so one grep — `scope=magic_link_*` —
  finds all token-store faults, and `scope=<abuse scope>` finds counter faults.
- **No managed-provider limits were reintroduced into config.** `REDIS_OPTIONAL` remains the single
  switch; local Redis is the primary store; the in-memory shim is defence-in-depth only.

**Boot-probe defect found by live testing (fixed).** `probeRedis()` called `connection.connect()`
whenever that method existed. Real ioredis auto-connects in its constructor (`lazyConnect` defaults to
false) and rejects `connect()` unless status is `wait`, so the probe failed against a **healthy**
server with `Redis is already connecting/connected` → the API silently ran on the memory store, and in
production (where Redis is required) it would have **refused to boot at all**. `connect()` is now
called only from `wait`; otherwise `ping()` alone proves the server, since ioredis queues commands
issued while connecting. The unit-test fake implements `ping` only, so no Revision 2 test could have
caught this — it is visible only against a real server.

**Verification.** New gated integration test `src/plugins/redis-live.test.ts` — runs only when
`REDIS_LIVE_URL` is set, self-skips otherwise, so CI and ordinary runs are unaffected — executed
against real `redis-server` 7.0.15: PING; magic-link issue/consume **exactly once**; re-issue
invalidation of the previous token; invite cooldown `SET NX`; email-window counters; counters fail
open; token store fails closed; invite fails closed; and a **full `buildApp()` boot** that reports
`{redis:"up",store:"redis"}` on `/health` with the readiness probe registered. Results: **9/9 live**;
full suite **1048 passed / 9 skipped / 0 failed** with Redis stopped; `tsc --noEmit` clean; eslint
clean on every touched file.

**Files:** `src/plugins/redis.ts` (probe fix), `src/plugins/rate-limit.ts`, `src/routes/v1/auth/
login-abuse.ts`, `src/routes/v1/auth/challenge.ts` (`StoreLogger`), `src/routes/v1/auth/magic-link.ts`
(`guard()` + cooldown), `src/routes/v1/auth/index.ts` (logger wiring), `src/plugins/redis-live.test.ts`
(new).

### 2026-10-31 — Revision 3 addendum, SEO/AEO: discoverability baseline + answer-engine layer

**Goal (user request):** the site must be discoverable when people search "vunvault", and the user
chose the full scope — technical baseline, AEO content layer, and an off-page runbook.

**One source of truth.** `apps/web/src/lib/seo.ts` holds the brand constants, the organisation facts
and the indexable route table. `robots.ts`, `sitemap.ts`, `llms.txt` and the `Service` graph all read
`INDEXABLE_ROUTES`, so a page cannot appear in one crawler surface and not the others. Adding a public
page is a one-entry edit plus that page's canonical; the procedure is written into the runbook.

**Added:**

| Surface | File |
| --- | --- |
| Route table + JSON-LD builders | `apps/web/src/lib/seo.ts` (new) |
| JSON-LD renderer (escapes `<`, unnonced by design) | `apps/web/src/lib/json-ld.tsx` (new) |
| `/robots.txt` | `apps/web/src/app/robots.ts` (new) |
| `/sitemap.xml` | `apps/web/src/app/sitemap.ts` (new) |
| `/llms.txt` | `apps/web/src/app/llms.txt/route.ts` (new) |
| Tests (37) | `apps/web/src/lib/seo.test.ts`, `apps/web/src/app/seo-surfaces.test.ts` (new) |
| Off-page runbook | `docs/seo-runbook.md` (new) |

**Edited:** root `layout.tsx` (site-wide title template, description, keywords, robots default, full
Open Graph + Twitter defaults, `Organization` + `WebSite` JSON-LD); 14 marketing pages
(`alternates.canonical`, plus missing descriptions on `/about`, `/products`, `/services` and a new
metadata export for `/contact`); `blog/[slug]/page.tsx` (canonical override, `article` Open Graph,
`Article` + `BreadcrumbList`); `/services` and its three children (`Service`, breadcrumbs);
`(auth)`/`(authed)` layouts (group-level `noindex`); two new passthrough layouts —
`(marketing)/blog/layout.tsx` (because `blog/page.tsx` is a client component and cannot export
metadata) and `(marketing)/checkout/layout.tsx` (group `noindex` for four transactional routes, two of
which are client components).

**Index policy — the design point.** Crawlable-but-`noindex` and disallowed are different buckets, and
the difference is load-bearing: a disallowed page cannot be fetched, so Google never sees its
`noindex` and may still list the bare URL from inbound links. `/login`, `/signup`, `/checkout` and
`/academy` are therefore NOT disallowed — they carry `noindex` and stay crawlable. `/portal`, `/admin`
and `/onboarding` are both disallowed and `noindex` (belt and braces, nothing public links to them).
`robots.ts` also emits a blanket `Disallow: /` whenever `NEXT_PUBLIC_SITE_URL` is not a real public
https host, so a laptop or preview deployment cannot enter the index as duplicate content.

**AI crawlers.** An explicit group (`GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `ClaudeBot`,
`Claude-SearchBot`, `Claude-User`, `PerplexityBot`, `Perplexity-User`, `Applebot-Extended`,
`Amazonbot`, `cohere-ai`, `CCBot`) carries the **same** disallow list as the wildcard group. That
repetition is not redundant: robots.txt groups do not inherit, so a bot matching `GPTBot` ignores `*`
entirely and would otherwise have reached `/portal`. The runbook documents the two lines to add if
training use is ever declined, and that blocking `Google-Extended` does not affect Google Search.

**`/llms.txt`.** Follows the `llmstxt.org` shape (H1 → blockquote → prose → `##` sections of
`- [Title](absolute-url): summary`). Nothing is invented: the entity paragraph is the answer Zura
already gives to "What is VUNVAULT?", the company facts are what `/contact` and the footer publish, and
the page lines come from the route table. A `## Questions buyers ask` section re-publishes `HOME_QA`
verbatim — an explicit question→answer mapping is the most citable thing on the site for a retrieval
engine, and unlike `FAQPage` it carries no visible-content requirement.

**Structured data emitted:** `Organization` (every page, `#organization`) with alternate spellings,
slogan, real support/press contact points and hours, Nairobi/KE address and `knowsAbout`; `WebSite`
(`#website`) cross-referencing it through `publisher` so the graph is connected rather than two
islands; `Service` on the catalogue and its three children; `BreadcrumbList` on nested service pages
and articles; `Article` on `/blog/[slug]`.

**Deliberately omitted, each pinned by a test:** `logo` (schema.org needs raster ≥112×112; the repo
ships only `brand/logo.svg`), `sameAs` (no social profiles exist anywhere in the repository, and an
invented URL damages entity disambiguation), `potentialAction`/`SearchAction` (there is no site-wide
search endpoint and Google retired the sitelinks-searchbox result in 2024), and `FAQPage` — see Known
Gaps.

**Verification:** 37 new tests pass; eslint clean on every new and edited web file; `tsc --noEmit` for
the web workspace reports **zero** errors. The full web suite is 775 passed / 10 failed, and those 10
were **proven pre-existing** by running the same five files against a clean `HEAD` (`git stash -u` →
identical 10 failures → `git stash pop`): contributor-count drift in `home-end`/`about-b`/`page.test`,
six `env.test` expectations and one signup-enroll wizard assertion. None touch SEO code.

## Email Delivery (Resend)

Per addendum A5.

- **SDK/version:** none — `ResendEmailProvider` in `packages/lib/src/providers/email.ts` calls
  `POST https://api.resend.com/emails` over the **global `fetch`**, which is what catalog Task 22
  mandates ("Email/SMS providers use the global `fetch`, not vendor SDKs"). One POST, an 8-second
  `AbortSignal.timeout`, no retry inside the provider (retries belong to BullMQ's `notify` queue:
  3 attempts, exponential backoff). No `resend` npm package is installed, so there is no SDK version
  to pin or upgrade.
- **From-domain (verified?):** `VUNVAULT <no-reply@vunvault.com>` — the constant `DEFAULT_FROM`, so
  the domain is **`vunvault.com`**. Whether it is verified in the Resend dashboard **could not be
  confirmed from this environment** (no API key). It is now checked at boot: `GET
  https://api.resend.com/domains` must report `vunvault.com` as `verified`, otherwise the API refuses
  to start. **Action for the user:** confirm Resend → Domains shows `vunvault.com` verified — this is
  the single most likely cause of "accepted, never delivered".
- **Last verified send id:** ⚠️ **none — no live send has been performed by the agent.** There is no
  `RESEND_API_KEY` here and no dashboard/inbox access, so this field is deliberately left empty
  rather than filled with a fabricated id. To populate it: `POST
  /api/v1/admin/diagnostics/email-test` as a super admin and read `data.id`, or request a magic link
  and read the `resend accepted the message` info line.
- **Known failure mode fixed:** the send was **not** swallowed by the provider — it was invisible.
  Five outcomes answered the byte-identical `200` "check your email" ack while sending nothing
  (honeypot bot-drop, `formTs` timing bot-drop, per-address issuance window, invite cooldown, and no
  provider configured), one of them (invite cooldown) leaving no trace anywhere at all, and no path
  ever logged the Resend response. Fixed by: greppable `magic-link produced NO EMAIL · reason=…` warn
  lines on every silent path; `{ id, status, error }` + request id logged on every send; a 2xx with no
  `id` reclassified as failure; FATAL boot refusal on a missing key or an unverified from-domain; and
  the super-admin diagnostics endpoint. **Two environmental suspects this code change cannot rule
  out**, both to check on the user's machine: (a) `playbook.md`'s Phase 7 entry records that
  verification forced an **`/etc/hosts` redirect of `api.resend.com` to a local capture stub** — if
  that entry survived, every send goes to localhost and Resend never sees it; (b)
  `apps/api/.env.example` ships a **placeholder key** `re_dummy123456789`, which Resend rejects with
  401.

## Redis Mode

Per addendum A5.

- **Revision 3 status:** `mode: local`, `previous: managed (rate-limited)`, `fallback enabled`.
  The primary Redis is a **local instance**; the managed provider it replaced was rate-limiting the
  API and is no longer in the picture. **No managed-provider limits were reintroduced into config.**
  The in-memory store is still available but is **defence-in-depth only** — it is not the expected
  operating mode, and normal operation reports `{ "redis": "up", "store": "redis" }`.
- **Current mode:** **configurable at boot; resolved automatically.** The mode is decided once, at startup, by `REDIS_OPTIONAL`
  (`auto` default = optional outside production, required in production; `always` = optional
  everywhere; `never` = required everywhere) combined with whether `UPSTASH_REDIS_URL` is set and
  whether the server answers `PING` within 4 s. Read it back at any time from `GET /health`.
- **Fallback behaviours:** `app.redis` becomes an in-process shim implementing the exact command
  surface auth uses, so no consumer needed a branch. Preserved offline: magic-link single-use tokens
  and re-issue invalidation, signup-invite cooldown, MFA challenge + replay cache, signup email OTP,
  login lockout / attempt counters, session registry, anti-bot counters. Degraded offline: **BullMQ
  queues are disabled** — `add()` logs `job NOT enqueued: Redis is offline…`, is counted per queue, and
  resolves to `undefined` rather than faking a job; this affects notify digests, PDF rendering,
  broadcasts and scans, but **not** auth mail, which is sent inline. Also degraded: `publish()`
  reaches no subscriber, so SSE fan-out is limited to the instance's own clients. `/readyz` does not
  register a `redis` probe offline (a deliberately absent dependency must not mark a healthy pod
  unready); `/healthz` and `/readyz` keep their catalog shapes.
- **Failure policy while Redis is up but faulting (Rev 3, hybrid):** rate-limit and login-abuse
  **counters fail open** (log `warn` with a `scope`, allow the request) so a Redis blip cannot lock
  every user out of login; **single-use token stores fail closed** (`MagicLinkTokenStore` rethrows,
  `SignupInviteCooldown` suppresses the send) so an outage can never fake an issued or consumed token.
  All Redis faults are grep-able by `scope=magic_link_*`.
- **Re-enable procedure:** set `UPSTASH_REDIS_URL` (vault secret in production), restart, confirm
  `GET /health` reports `{ "redis": "up", "store": "redis" }` and that the boot log says
  `redis online`. **No code change, no flag flip, no redeploy of a different build** — and if
  `REDIS_OPTIONAL` was set to `always` to get through the outage, returning it to `auto` restores the
  production fail-fast behaviour.
- **Single-instance caveat documented:** **yes** — logged at `warn` on every offline boot
  (`MEMORY_STORE_CAVEAT`, with the reason), and stated in the `memory-redis.ts` module header, in the
  A3 change-log entry above, and in Known Gaps. In offline mode run **exactly one** API replica: two
  replicas would each hold their own tokens, counters and session cache, so a link issued by one could
  not be redeemed on another, a single-use token could be replayed once per replica, and rate-limit
  windows would be per-replica instead of global. Nothing is persisted — a restart clears every token,
  challenge and counter (fail-safe: outstanding links simply die).

## Definition of Done — status

| #   | Criterion (work order)                                                                      | Status | Where                                                                                                   |
| --- | ------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| 1   | Zero password-login paths                                                                   | ✅     | P1 entries; `contracts-a.test.ts` pins that `POST /auth/login`, forgot/reset never return to route docs |
| 2   | Replay-proof, TTL'd magic links (single-use, invalidated on re-issue)                       | ✅     | P1 backend entry; auth service tests                                                                    |
| 3   | Normal users always MFA-challenged (6-digit); unenrolled → enrolment route                  | ✅     | P2 entries; `verifyMagicLink` gating tests                                                              |
| 4   | Admin first sign-in: forced MFA setup, visible 5:00 countdown, expiry → `BLOCKED_MFA_SETUP` | ✅     | P2 backend/web entries; setup-window + lazy-block tests                                                 |
| 5   | `divine@vunvault.com` (Divine Gospel, SUPER ADMIN) exempt: no timer/block, optional MFA     | ✅     | P2 entries; `isMfaSetupExempt` tests                                                                    |
| 6   | Admin emails (all 9 slots) rejected at signup with the exact message                        | ✅     | P4 entry; `signup_not_allowed` 422 tests                                                                |
| 7   | Unregistered email → exactly one invitation email; byte-identical HTTP ack                  | ✅     | P3 entry; invite cooldown + response-equality tests                                                     |
| 8   | Rate limiting, bot defense (honeypot/timing/CAPTCHA), audit log live                        | ✅     | P4 entry; abuse-guard, backoff, bot-drop and audit tests                                                |
| 9   | Zone.Identifier files + old login surfaces deleted; grep clean; build/lint green            | ✅     | P5 entry                                                                                                |
| 10  | Playbook accurate (this document)                                                           | ✅     | P6 entry (this one)                                                                                     |
| 11  | API boots clean + ordered smoke tests recorded                                              | ✅     | P7 entry: boot clean (0 warn/err), smoke **35/35** (S0–S6), API suite 1011/1011                         |

### Revision 2 addendum — Definition of Done (delta, A4)

Additive to the work-order table above; the original 11 criteria are unchanged and still ✅.

| #   | Criterion (addendum A4)                                                              | Status | Where                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| A4.1 | vunvault catalogs 1–5 read; extraction recorded                                      | ✅     | Phase 0 entry + **Catalog Extraction** section (all five parts, with the reading method declared)                                                |
| A4.2 | Signup-verification + auth workflows match the catalogs                               | ✅     | Catalog Extraction: canonical flow is Task 40d (details → email OTP → TOTP → aal2) + Task 24/26 session model; conflicts 1–7 recorded and resolved |
| A4.3 | Magic-link email provably delivered via Resend (dashboard id logged)                  | ⚠️ **partial** | The `id` is now logged at `info` on every send and returned by the diagnostics endpoint (implemented + unit-pinned). **No live send was performed** — no API key, dashboard or inbox access here. Handed to the user; see Known Gaps |
| A4.4 | No swallowed Resend errors; startup fails loudly on missing key/domain                | ✅     | A2 entry; `buildResendEmailProvider` + `email-guard.test.ts` (13 tests)                                                                          |
| A4.5 | System boots and fully functions with Redis offline (in-memory fallback)              | ✅*    | A3 entry; `redis-offline.test.ts` (16 tests). \*Auth functions fully; **BullMQ queues cannot exist without Redis** and refuse jobs loudly — Known Gaps |
| A4.6 | `/health` reports Redis state                                                         | ✅     | `GET /health` → `{ redis, store }`; `PUBLIC_ROUTES`; `/healthz` + `/readyz` unchanged                                                            |
| A4.7 | Re-enabling Redis requires zero code changes                                          | ✅     | Same binary resolves both modes at boot; `redis-offline.test.ts` pins the online path; live re-enable is the user's to run                          |
| A4.8 | Agent communicated every out-of-scope change with the user before applying it          | ✅     | Four blocking questions asked and answered before any edit (delivery method, Resend verification, Redis switch shape, catalog depth); every deviation recorded in Decisions below |

## Decisions & Assumptions

- **Q1 (names):** resolved from the canonical `CONTRIBUTORS` array (home page), which
  `about-data.ts` mirrors. `tshepiso@` → Raphunga Tshepiso; `bukenya@` → Bukenoya Natasha
  (mirror-file spelling "Bukeonya" flagged, not used). No DB `contributors` table exists; the
  contributor records are the marketing data files.
- **Q2 (roster shape):** provisioning is data-driven from a 9-slot config
  (`apps/api/src/lib/admin-roster.ts`): 4 populated, 5 `null` placeholders. Filling a slot =
  editing that file only.
- **Q3 (signup password):** signup form left AS-IS; the password field is retained and validated
  (`NewPassword` rules, breach check) but **no password-login path exists** — the only login
  credential is the magic link. The stored password is therefore vestigial (see Known Gaps).
- **Hard constraint honoured:** `divine@vunvault.com` = **Divine Gospel**, SUPER ADMIN, exempt
  from the 5-minute MFA setup timeout and from `blocked_mfa_setup` entirely (Phase 2).
- **Verify leg answers 302, not JSON:** the link is clicked from an email client; a JSON body
  would be unreadable. The pre-MFA state rides in the HttpOnly `vv_mfa` cookie, so no token or
  handle ever appears in a URL beyond the single-use magic-link token itself (which the work
  order's own flow requires in the emailed link).
- **"Only these routes are public" (work order §7) interpreted against the login surface:**
  `/auth/magic-link`, `/auth/magic-link/verify`, `/auth/mfa/verify` (+ its `vv_mfa`-guarded
  helpers email-otp/webauthn-options/recovery), the signup trio and `/auth/refresh` remain public
  because signup is otherwise unchanged (work order §1.4) and cookie rotation needs refresh.
  Everything else stays deny-by-default, enforced by the conformance route-table suite.

- **`/login/mfa` gates on the `vv_mfa` cookie, not the query string:** query params alone would
  let anyone deep-link a dead OTP form; without the HttpOnly challenge cookie there is nothing
  to verify and the page says so. The masked `to` is produced SERVER-side
  (`maskEmailForRedirect`); the web displays it verbatim (≤254 chars) and never receives the
  full email on the MFA leg.
- **Pre-existing upstream web red is documented, not silently fixed:** the 15 failures above
  reproduce byte-identically on the unmodified tree (stash/re-run proof). `signup-page.test.tsx`
  (abandoned "passwordless signup" design, mocks a non-existent `/auth/signup/verify` handle
  endpoint) is scheduled for Phase 5 deletion as an orphaned suite; the env/marketing/
  signup-enroll failures are outside the auth work order and recorded in Known Gaps.

### Phase 2 decisions

- **Lazy blocking (deliberate):** an expired window flips the account to `blocked_mfa_setup` on
  the NEXT touch (a setup leg → 410 `setup_expired`; a magic-link verify → 302
  `/login?error=account_blocked`) instead of via a background sweeper — there is no cron
  infrastructure in this stack, and a sweep would block accounts nobody is watching with no
  audit trail. Every lazy block is audited (`MFA_SETUP_BLOCKED`). Same reasoning for
  brute-force: the 5th wrong setup code kills the CHALLENGE (a new magic link restarts the
  window) but does not instantly block the account — typos should not brick an admin; only a
  genuinely missed/expired window does.
- **`requireStaff` exemption:** the plugin previously refused any staff session below aal2. The
  exempt super admin signs in WITHOUT a forced second factor by design, so the check now waives
  aal2 for `isMfaSetupExempt(email)` only — every other staff account still needs aal2.
- **Provisioned admins get `team: null`:** `CreateProfileInput.team` was widened to
  `Team | null` because roster admins are not members of an operational team; inventing one
  would corrupt team filters. `accessTier`: `elevated` for the super admin slot, `standard` for
  the rest; `scopeNotes` carries the roster provenance.
- **Provisioning is idempotent and safe to re-run:** findByEmail → role-correct (audited) or
  create with a distinct random ≥32-byte password and `emailConfirm: true`. The password is
  vestigial (no password login exists) but keeps the auth-users row valid; second pass reports
  `created: []`.
- **Names are never invented:** the four populated slots resolve against the contributor
  records (Q1); `divine@vunvault.com` is deliberately NOT a contributor — Divine Gospel, SUPER
  ADMIN, `jobTitle` null. The 5 placeholder slots carry `email: null` and are skipped by
  provisioning until filled in the config file (Q2).
- **The web countdown is display-only:** `?deadline=` drives the visible mm:ss timer, but
  enforcement lives entirely server-side (challenge TTL + ledger). A tampered or dropped
  `deadline` param can only hide the timer — the API still closes the window, and the panel
  renders the blocked notice on the first 410.

### Phase 3 decisions

- **Phase 3 shipped inside Phase 1 on purpose:** splitting the unregistered branch out later
  would have meant touching the byte-identical response contract twice. The Phase 1 entry
  documents the mechanics; this entry is the acceptance record the work order asks for.
- **Missing email provider degrades to `suppressed`, not 500:** the response must stay identical
  for registered and unregistered addresses, so a provider outage can only warn server-side
  (same posture `forgotPassword` always had) — never change the HTTP surface.

### Phase 4 decisions

- **"Only these routes are public" (work order §7), final interpretation:** the PUBLIC list is
  the login/signup surface itself — `/auth/magic-link`, `/auth/magic-link/verify`,
  `/auth/mfa/verify`, `/signup` (work-order verbatim) — plus the routes those flows cannot work
  without: the `vv_mfa`-cookie-gated challenge helpers (email-otp, webauthn options, recovery,
  the three `mfa/setup/*` legs), `/auth/csrf` + `/auth/refresh` (cookie plumbing), the OAuth
  legs (they REDIRECT into the same MFA flow), invitations and public content/health. Everything
  else is deny-by-default behind `authenticate`, pinned by the conformance route-table suite: a
  new route without a guard fails the build.
- **Bot drops are silent by design:** a detected bot gets the identical 200 and NO email — it
  must not learn it was detected (a loud rejection teaches the next bot to empty the honeypot).
  The detection is recorded in the audit chain (`AUTH_BOT_REJECTED`), where it is loud.
- **Captcha gating order:** bot signals are evaluated FIRST (a bot never consumes soft-limit or
  per-address budget), then the IP soft limit, then the per-address window, then the
  registered/unregistered split. `captchaRequired` is keyed on the IP alone — the byte-identical
  guarantee for registration status is preserved (pinned by a test that compares the flagged
  bodies of a registered and an unregistered address).
- **The backoff lock does not consume attempts:** a 429 while locked is a wall, not a strike —
  otherwise a panicked retry-loop would burn the victim's 5-attempt budget and destroy the
  challenge, converting backoff into self-inflicted lockout. The 5th RECORDED failure still
  kills the challenge (Phase 1 semantics), and the setup leg's lazy-block posture is untouched.
- **Guard placement in signup:** the roster check precedes the breach check and every repo/
  Supabase call, so a refused address leaks nothing about password status, account existence or
  roster membership beyond the single spec'd sentence. `divine@vunvault.com` is refused like
  every other roster slot — the exemption is from the MFA setup TIMER, never from the guard.
- **`NEXT_PUBLIC_TURNSTILE_SITE_KEY` is read directly (not via the web env schema) for now:**
  Next inlines `NEXT_PUBLIC_*` references statically, and the env schema/docs sync
  (`verify-env-docs` currently fails at HEAD on a stale `RECON_URL`) is Phase 5's declared scope
  — the key will be added to the schema, `.env.example` and `docs/env-reference.md` there.

### Phase 5 decisions

- **`PasswordResetStore` went with the routes:** the work order's caution was "keep the store if
  account-security's change-password depends on it" — it does not (that flow has its own
  service/repo path), so the store, its token helpers and its test file were deleted outright.
- **ADR-0002 keeps its forgot-password example:** ADRs are immutable historical records; the
  envelope discipline it documents is still true, only the example route is gone. Rewriting an
  ADR to hide history would be the bigger inaccuracy.
- **The removed-route absence is TEST-PINNED:** `contracts-a.test.ts` now asserts that
  `POST /auth/login`, `/auth/forgot-password` and `/auth/reset-password` never reappear in the
  route documentation — cleanup that cannot silently regress.
- **Pre-existing web reds: 15 → 10.** The five deleted failures were the orphaned
  `signup-page.test.tsx` (declared for Phase 5 deletion in the Phase 1 entry). The remaining ten
  (env parsing ×6, marketing contributors ×3, signup-enroll wizard ×1) are upstream defects
  outside this work order, unchanged and still recorded in Known Gaps.

### Revision 2 addendum decisions (2026-10-31)

Recorded per A0.5 (every user↔agent decision) and A0.2 (nothing out-of-scope applied silently).

- **The addendum is a retrofit, not pre-Phase-1 work.** It says "apply before Phase 1 begins", but
  Phases 1–7 had already landed (see the entries above and the DoD table). Applied as an amendment to
  shipped code. **Confirmed with the user before any edit.**
- **Four blocking questions were asked and answered before the first change** (A0.1/A0.2): how to
  deliver the work (→ the user asked for `gh`), how to close Resend verification (→ *implement the
  fixes; the user verifies against their dashboard/inbox*), the Redis switch shape (→ *both: an
  explicit flag defaulting to auto-detect*), and catalog reading depth (→ *targeted extraction*).
- **`REDIS_OPTIONAL` semantics for `auto`.** The addendum named the flag but not what `auto` resolves
  to. Chosen: optional outside production, **required in production** — a laptop with Redis switched
  off boots, while a production deployment still fails loudly instead of silently degrading to
  single-instance state. `always` is the escape hatch for a deliberately Redis-less production run.
- **Redis URL stayed a vault secret.** The addendum suggested `REDIS_URL` as plain config; the repo
  reads `UPSTASH_REDIS_URL` through `SecretProvider` (catalog Task 22). Introducing a second source of
  truth for one connection string was judged worse than keeping the secret and adding only the
  optionality flag. **This is a deviation from the addendum's literal wording, resolved in favour of
  the catalogs per A1.3** (the flag itself is the spec's requirement and was implemented).
- **`app.redis` is the shim, not `undefined`.** The alternative — a possibly-undefined decorator —
  would have forced an `undefined` branch through 19 consumer files. The shim keeps one type, changes
  no call site, and fails loudly (`TypeError`) if a future feature reaches for a command it does not
  implement.
- **`/readyz` does not fail when Redis is intentionally offline**, and the `redis` probe is not
  registered at all in that mode. Reasoning is Task 21's own: an orchestrator must not pull traffic
  from a pod that is serving correctly. `/health` is where degraded mode is reported.
- **`/health` is a NEW route, not a reshaped one.** Task 21 defines exactly `/healthz` and `/readyz`
  and Task 40's conformance suite pins the table; both stay byte-identical. The new route carries a
  real Zod response schema (the conformance schema check exempts `/healthz` and `/readyz` *by name*),
  declared locally rather than in `@vunvault/contracts` because health is infrastructure, not a
  consumer contract — the same reason its two siblings have no contract schema.
- **Unverified from-domain: refuse to boot. Uncheckable from-domain: log FATAL and boot.** A2.3 allows
  either response. A definitive "not verified" is a misconfiguration that reproduces the reported bug
  exactly, so it blocks the boot; an unreachable Resend *management* API is not evidence of
  misconfiguration, and taking the whole platform down over a control-plane blip is the worse outcome.
- **No new `EMAIL_FROM` config flag was added.** A2.3 refers to "the configured from domain"; the
  sender is the existing `DEFAULT_FROM` constant. Making it env-configurable would have been a new
  config flag, which A0.2 requires asking about first — so it was not added. Flagged to the user
  instead.
- **`users:manage` + `requireRole('super_admin')` for the diagnostics route.** Task 19 declares
  `PERMISSIONS` as an exact list with no `diagnostics:*` entry, and Task 40's conformance suite
  requires a permission guard on every `/api/v1/admin/*` route. Reusing an existing permission
  (precedent: `admin-badges`) plus an explicit role check satisfies "super-admin only" without a
  contract change nobody asked for.
- **One new audit event type: `EMAIL_DELIVERY_TEST`** (category `system`). `audit_entries.event_type`
  is a **`text` column, not a DB enum**, so this is additive code with **no migration**. Justification:
  the endpoint can make the platform mail an arbitrary address, so its use belongs in the sealed
  chain. The existing category-count assertion in `events.test.ts` was updated 5 → 6 with a comment,
  following that file's own established convention.
- **Recipient addresses are kept out of application logs but recorded in the audit chain.** The
  provider logs `{ id, status, error, requestId, purpose }` only — stdout/log aggregation is
  high-volume and broadly readable. The diagnostics *audit* entry records the destination in full,
  because the chain is sealed, access-controlled (`audit:read`) and is the system of record for admin
  actions. The magic-link suppression warnings likewise omit the address (the audit entry already
  carries it as subject) and correlate by request id.
- **Disabled queues refuse loudly instead of faking success.** `add()` logs, counts and resolves to
  `undefined`. Inventing a job id would have recreated the exact silent-success failure A2 exists to
  eliminate.
- **Catalog reading was targeted, not exhaustive** (29,512 lines / ~2 MB). The user chose this
  explicitly. Method and coverage limits are declared in the Phase 0 entry and in Known Gaps, per A0.4
  — nothing is claimed as read that was not.

### Revision 3 addendum decisions (2026-10-31)

All four were obtained by asking the user **before** writing any Revision 3 code (A0.2), so nothing was
built speculatively.

- **A6 correction (user).** Redis is **not** offline. The deployment moved from a **managed** provider
  that was rate-limiting the API to a **local** instance which is live. Standing instruction: do not
  reintroduce managed-provider limits into config; treat the memory fallback as defence-in-depth only.
- **A6 failure policy → hybrid (user).** Rate-limit and login-abuse **counters fail OPEN** with loud
  `warn` logging; **single-use token stores fail CLOSED**. Rationale: an outage must not lock every
  user out of login, but it must never pretend a token was issued or consumed.
- **A7 MFA change / re-enrol → build NOTHING (user).** The three proposed options (self-service
  re-enrol, lost-authenticator recovery, super-admin reset) were all declined. Logged as a Known Gap
  with the agreed future shape, so the decision is reversible without re-litigating the design.
- **A8 AI chat box → build NOTHING, and leave Zura exactly as-is (user: "leave zura and don't build
  anything else").** No `POST /ai/chat` proxy, no SSE endpoint, no per-user LLM rate limit, no widget
  changes. `apps/web/src/app/(marketing)/_components/zura/` was not touched by Revision 3.
- **SEO/AEO → full scope (user: "all three").** (1) technical baseline — `robots.ts`, `sitemap.ts`,
  canonical URLs, JSON-LD Organization + WebSite, OG/Twitter pass; (2) AEO content layer —
  `llms.txt` and FAQPage structured data derived from the existing `qa-data.ts`; (3) an off-page
  runbook document. Goal: the site is discoverable when people search "vunvault".
- **Post-Revision-3 confirmation answers (2026-10-31).** Three questions were put to the user after
  the Revision 3 commit, and the answers are implemented in commit `56386f6`: **FAQ layer → mount the
  section and emit the markup** (home page renders `QaSection` + `faqJsonLd(HOME_QA)`); **brand assets
  → generate both** (done by rendering the repo's own `logo.svg` monogram with sharp — not AI-imagined
  — see *Brand rasters* in `docs/seo-runbook.md`); **delivery → reconnect GitHub in Arena, then push**.
- **Push remains blocked at the time of writing.** After the user chose reconnection, `gh auth status`
  still reports "not logged into any GitHub hosts" and `git push origin main` still fails with
  `could not read Username for 'https://github.com'` — the reconnection has not reached this sandbox.
  Revision 3 therefore ships as two commits on `main` plus regenerable artifacts:
  `../0001-feat-seo-auth-local-Redis-….patch`, `../0002-feat-seo-mount-the-buyer-Q-A-band-….patch`
  (apply on `b1a5c0b`) and `../vu-addendum-rev3.bundle` (full history).
- **Live-Redis verification method.** `redis-server` 7.0.15 was installed in the sandbox and started on
  demand; live checks run through the gated `redis-live.test.ts` (`REDIS_LIVE_URL=…`), and the server
  is **stopped before every full-suite run** (see the hermeticity gap below).
- **Email leg remains user-verified.** Per the standing Revision 2 decision ("implement the fixes; I'll
  verify against my dashboard/inbox") no live Resend send was performed by the agent. An HTTP-level
  magic-link live test was **not** added because its harness lives inside `auth.test.ts` and is not
  exported; extracting it would be an unlisted refactor of an existing test file (A0.2).

## Known Gaps / Future Work

- 5 admin emails still to be supplied (roster placeholders 5–9).
- Signup password field retained but unused for login (Q3). Consider dropping collection — or
  wiring it to nothing — once stakeholders confirm; until then it is validated and stored but
  never authenticates anyone.
- Phase 1 (web) screens, Phase 2 MFA enforcement/provisioning, Phase 4 signup guard + IAM
  hardening, Phase 5 cleanup (incl. the 1161 `*:Zone.Identifier` files), Phase 7 boot verification
  are recorded in the entries below as they land.
  **Phase 6 update:** all of those have landed except Phase 7 (boot + smoke verification), which
  gets its own entry when run.
  **Phase 7 update:** DONE — boot clean, smoke 35/35; see the Phase 7 entry. Every phase of the
  work order has now landed.
- `forgot-password` / `reset-password` are dead surfaces once password login is gone; their
  removal is scheduled in Phase 5 (work order §8: old login endpoints, dead password helpers). **Phase 6 update:** DONE — removed in Phase 5; see that entry.
- Pre-existing upstream web-suite failures unrelated to auth (reproduced on the unmodified
  tree): `env.test.ts` (6 — env parsing drift), marketing contributors tests (3 — page.test,
  about-b, home-end expect 6 contributors), `signup-enroll.test.tsx` (1 — wizard redirect
  assertion). Triage or fix outside this work order; `signup-page.test.tsx` (5) is abandoned-design
  orphan → Phase 5 deletion.
  **Phase 5 update:** the orphan suite is deleted — the standing pre-existing red count is now
  **10**, unchanged by any phase of this work order. The Zone.Identifier purge, the
  forgot/reset-password deletion and the dead-env-key removal listed above are DONE (see the
  Phase 5 entry).

### Revision 2 addendum — Known Gaps (A0.4: nothing silently skipped)

- **A2 live delivery verification was NOT performed by the agent.** This environment has no
  `RESEND_API_KEY` and no access to the Resend dashboard or to any inbox, so the two acceptance items
  that require them are handed to the user rather than claimed: (1) a magic-link request produces a
  visible Resend dashboard event within 30 s with status `delivered`/`sent`; (2) the diagnostics
  endpoint returns a real Resend id. Everything that *can* be proven without a live key is proven —
  the contract, the logging, the boot guard and the route guards are unit-pinned (29 new tests). The
  "Last verified send id" field in **Email Delivery (Resend)** is intentionally empty.
- **A3 live Redis re-enable was NOT performed** *(superseded by Revision 3 — see the A6 entry and the
  Revision 3 Known Gaps: a real `redis-server` 7.0.15 was installed in this sandbox and both the
  store-level flows and a full app boot were verified against it, which is what found the
  `probeRedis` `connect()` defect)*. No Redis server existed in this sandbox at Revision 2 time to
  switch off and back on, so both modes were pinned by unit tests against a fake connection rather
  than observed against a real one. The user's checklist: take Redis down → `/health` reports
  `{redis:"down",store:"memory"}` and login still works; bring it back → set `UPSTASH_REDIS_URL`,
  restart, `/health` reports `{redis:"up",store:"redis"}`.
- **BullMQ queues cannot run without Redis, and do not pretend to.** Offline, `add()` refuses, logs
  and counts. Consequence: notification fan-out, PDF generation, advisory broadcasts and scan
  enqueueing are unavailable until Redis returns. **Auth mail is unaffected** — magic-link and
  signup-OTP sends are inline `await app.email.send(…)`, never queued.
- **The in-memory store is single-instance only.** Two or more API replicas offline would each hold
  their own tokens, counters and session cache: a link issued by one could not be redeemed on another,
  a single-use token could be replayed once per replica, and rate-limit windows would be per-replica.
  Run exactly one replica in offline mode. State is not persisted — a restart clears every token and
  counter (fail-safe).
- **`/health` reports the mode resolved AT BOOT.** If Redis dies after a successful boot, `/health`
  keeps saying `up` while `/readyz` (which PINGs live) correctly reports `not_ready` and 503s. That
  division is deliberate — `/health` stays fast and has no failure mode of its own — but an operator
  reading only `/health` would miss a mid-life outage. A future improvement is a bounded live PING in
  `/health`, or a periodic re-probe that flips `redisMode`.
- **Catalog extraction was targeted, not exhaustive.** All five parts were indexed in full and the
  canonical sections were read completely (Tasks 15, 19, 20c, 21, 22, 24, 26, 27, 40, 40d, 40e, 43,
  59–63, 92, 102, 105, 110), but the remaining ~27,000 lines are predominantly frontend/design-token
  task specifications (Layers L5–L10: marketing pages, portal, admin UI) that do not define signup or
  authentication workflow. If a later phase touches those layers, the relevant task section should be
  read before implementation.
- **Two environmental suspects for the original Resend symptom remain unruled-out**, because both live
  outside this repository: (a) a surviving `/etc/hosts` entry redirecting `api.resend.com` to the
  Phase 7 capture stub (recorded in the Phase 7 entry above) — if present, every send goes to
  localhost and Resend never sees it; (b) a real `.env` still carrying the placeholder key
  `re_dummy123456789` from `apps/api/.env.example`, which Resend rejects with 401. Check
  `getent hosts api.resend.com` and the deployed `RESEND_API_KEY` prefix before chasing application
  code further.
- **No new `EMAIL_FROM` flag.** The sender remains the `DEFAULT_FROM` constant
  (`VUNVAULT <no-reply@vunvault.com>`). If a different verified domain is ever needed, that is a
  config-flag addition and per A0.2 must be agreed first.
- **Work was committed locally but NOT pushed.** This sandbox has no GitHub credentials: `gh` was
  installed (v2.103.3) but `gh auth status` reports "not logged into any GitHub hosts", there is no
  `GH_TOKEN`/`GITHUB_TOKEN`, and `git push --dry-run origin main` fails with
  `could not read Username for 'https://github.com'`. Interactive `gh auth login` is not possible
  here and no token was requested in chat. The commits are on `main` in the working checkout, ready
  for `git push origin main` once the GitHub connection is restored.

### Revision 3 addendum — Known Gaps (A0.4: nothing silently skipped)

- **A7 — MFA change / re-enrol: NOT BUILT (user decision).** There is still no supported path for an
  admin who loses or replaces their authenticator device, and the super admin (`divine@vunvault.com`)
  cannot reset another admin's MFA from the product. Today the only remedy is direct database
  intervention. If this is built later, the agreed shape is: **atomic** invalidation of the old secret
  when the new one is enrolled; an audit entry carrying actor, target, timestamp and reason;
  self-service re-enrol gated on a **fresh magic-link verification**; and a super-admin reset that
  returns **403 plus an audit entry** for anyone who is not the super admin (super admin exempt from
  MFA), with a 05:00 window.
- **A8 — AI chat box: NOT BUILT (user decision).** The existing Zura widget is left exactly as it is.
  Consequently there is no server-side `POST /ai/chat` proxy, no SSE streaming endpoint, no per-user
  LLM rate limit, no LLM audit events, and no key-isolation boundary beyond whatever Zura already
  provides. This is a deliberate "leave it alone", not an oversight — do not "helpfully" add one.
- **A6 email leg is unproven in-sandbox.** 9/9 live tests cover the token store, cooldown, counters,
  the fail-open/fail-closed policy and a full app boot against real Redis, but "a magic-link request
  produces a real email" needs a `RESEND_API_KEY` and an inbox, neither of which exists here. Handed to
  the user, consistent with Revision 2.
- **Test hermeticity against a live Redis.** `diagnostics.test.ts` and `internal-scans.test.ts` do not
  inject a Redis connection, so when a real server listens on 6379 they attach to it: **13 tests fail
  with 401s** and those files go from ~8 s to 100 s+. This is a test-isolation gap, **not** a product
  defect — the same 26 tests pass 26/26 with Redis stopped. Operating rule: never run the full API
  suite while a Redis is listening on 6379; use `REDIS_LIVE_URL` + `redis-live.test.ts` for live
  verification, then stop the server. The clean fix is to inject a fake connection in those two suites;
  not done here because it is an unlisted change to existing tests.
- **`/health` still reports the mode resolved AT BOOT** (unchanged from Revision 2): if Redis dies after
  a successful boot, `/health` keeps saying `up` while `/readyz` (live PING) correctly 503s.

### Revision 3 addendum — SEO/AEO Known Gaps

- **`FAQPage` was held back, then wired on the user's decision (Rev 3 SEO).** The Q&A copy in
  `qa-data.ts` (`HOME_QA`) was orphaned — `qa-section.tsx` implemented the section but no page
  imported it — so the markup would have described invisible content, a structured-data spam signal.
  The user chose **"mount the section and emit the markup"**: the home page now renders `<QaSection />`
  after `<PricingPlans />` and emits `faqJsonLd(HOME_QA)` for the same entries. The two are coupled on
  purpose; removing the component must remove the markup. Measured honestly: Google has shown FAQ rich
  results only for well-known government/health sites since August 2023, so the gain is answer-engine
  grounding and on-page clarity, not a SERP snippet.
- **Brand rasters shipped, rendered from the repo's own monogram (Rev 3 SEO).** `public/brand/
  logo-512.png` (square, transparent) satisfies schema.org's raster-≥112×112 rule and is now the
  `Organization.logo`; `public/brand/og-default.png` (1200×630) is wired into `openGraph.images` and
  `twitter.images`. Both are cropped renders of `brand/logo.svg` via sharp — not AI-generated — with
  the card's type set in Liberation Sans because no brand font was available to the offline renderer.
  Design may re-artwork them; the invariants live in `BRAND_ASSETS` (`lib/seo.ts`) and are asserted by
  `lib/seo.test.ts`.
- **`sameAs` omitted — no social/directory profiles exist in the repository.** Add the real URLs once
  the profiles do (runbook §Off-page, step 5).
- **Off-page work is a runbook, not code, and none of it is verified.** Search Console and Bing
  Webmaster verification, sitemap submission, Google Business Profile, the Wikidata item, profiles and
  link building all require accounts this sandbox has no access to. `docs/seo-runbook.md` sequences them
  by expected return; until step 1 is done there is no crawl or query data at all.
- **Canonical host consolidation unverified.** Canonicals are declared from `NEXT_PUBLIC_SITE_URL`. If
  `www` and apex are both live without a 301 to one origin, the declaration alone will not consolidate
  them — the redirect has to be fixed at the edge first.
- **No `hreflang`.** English only; add `alternates.languages` if a second locale ever ships (a wrong
  `hreflang` cluster is worse than none).
- **Ten pre-existing web test failures remain** (contributor-count drift ×3, `env.test` ×6,
  signup-enroll ×1). Proven present on clean `HEAD` before this revision; not fixed here because
  touching contributor data or env expectations is an unlisted change (A0.2).

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

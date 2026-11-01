VunVault — Frontend Chatbot + Auth Routing + Signup TOTP Fix — Executable Work Order

For: AI coding agent
Amends: Prior work order (Security & Admin Implementation)
Language: English only.

---

0. Guardrails (unchanged — read first)

# Rule
G1 🚫 NO DEPLOYMENT. Local run only. Last line of every report: "Awaiting explicit user confirmation before any deployment."
G2 pnpm dev only. Never next build, next start, pnpm build, turbo build. 1 GiB RAM ceiling — production builds kill the sandbox.
G3 Supabase is the system. May modify migrations / RLS / config / profiles. Do not stand up local Supabase. Log every change in playbook.md → Supabase changes.
G4 No destructive Supabase ops without approval (DROP/TRUNCATE/bulk DELETE/auth-user deletion).
G5 Resend is real. Verify magic-link / OTP emails on the Resend dashboard (Emails tab, status sent/delivered, provider id), not local logs. Use the rotated key (prior key compromised).
G6 Domain is vunnvault.com (double‑n). Not vunvault.com, not advobot.com.
G7 Talk to the user at every sub-task boundary. Pause 30–60 s to avoid rate limits.
G8 Never mark a sub-task complete with a silently skipped item. Log gaps in playbook.md → Known Gaps.

---

1. Pre-conditions (verify before Task 1)

P1 — Prior state confirmation

☐ git status clean or 3 previously-approved changes committed. Show any uncommitted diff to the user before starting.
☐ pnpm dev for API + UI runs (from prior run). Confirm both can start without next build.
☐ Resend key rotated by user (masked re_****…); confirm the new key is loaded.
☐ Confirm admin roster in DB: 4 active admins, divine@vunnvault.com = super_admin, 5 standby slots in config.

If any precondition fails, stop and report — do not improvise.

---

2. Discrepancy to resolve before Task 3

Prior run reported "Task 4 ✅ — MFA QR + TOTP" (QR decodes byte-identical to otpauth:// URI, secret ≥32 Base32 chars, accepted code). This new work order says "the MFA/TOTP step fails entirely to generate the QR code — blank space or error state."

Both cannot be true for the same code path. Before fixing, the agent must determine:

Possibility How to distinguish What to do
Regression — a commit since the prior run broke the QR render git log between the prior run's commit and HEAD; diff the QR component Fix the regression
API vs UI gap — the API returns a valid otpauth:// URI, but the frontend component fails to render it (e.g. qrcode.react missing, CSP blocks data: URIs, error boundary swallows it, wrong prop name) Call the API directly (curl) → confirm valid otpauth:// URI comes back. Then check browser console/network for render errors. Fix frontend rendering, not backend
Environment difference — QR renders in one browser/environment but not the target Test in the specific browser/environment the user is using Fix environment-specific issue (CSP, polyfill, etc.)
Prior verification was false — the "byte-identical" claim was based on a decode of the API response, not the rendered QR image Re-decode the rendered QR image in the browser, not the API payload Report honestly; fix accordingly

Log the root cause in playbook.md before fixing. Do not "fix" the QR code blind — if the API is fine and only the UI is broken, back-end changes will waste time and can break tests.

---

Task 1 — Frontend AI Chatbot Integration

Goal: Chatbot is a first-class element of the website UI, Gemini-free, cyber-security operator aesthetic.

1a — Locate

☐ Find every chat UI component, route, and mount point.
☐ Find every Gemini reference: strings, image/svg assets, gemini-* model names, SDK imports, alt text, aria-label, <title>, favicon, README user-visible mentions.
☐ Find where (if at all) the chat is currently mounted in the main layout — is it a hidden route, separate page, or absent from the main site?
☐ Record all paths in playbook.md → Chatbot map.
· Pause and report.

1b — Integrate into main website view

☐ Mount the chat widget in the main frontend layout so it's visible on the site (floating widget, docked panel, or dedicated nav entry — match the repo's existing UI pattern; if there is none, use a floating bottom-right widget, which is standard).
☐ Widget is only rendered for authenticated users with a completed MFA session — do not expose the chat to unauthenticated visitors.
☐ Confirm the widget does not block navigation, does not overflow on mobile viewport, and does not break other pages.
☐ The chat must still hit the existing POST /ai/chat (or repo's equivalent) proxy — do not duplicate API keys client-side.
· Pause and report.

1c — Remove Gemini branding and apply cyber-security operator aesthetic

☐ Remove every Gemini string, logo, and SDK import from user-visible code.
☐ Replace the avatar with a professional cybersecurity operator headset icon:
  · Use a neutral SVG (headset + shield motif).
  · Professional, not cartoonish; no third-party copyrighted assets.
  · Adapts to the site's color theme.
☐ Update alt / aria-label to "Security assistant" (or equivalent neutral text).
☐ Grep the runtime dev output for gemini (case-insensitive) → zero hits in user-visible code.
☐ Log any user-supplied avatar asset as a "pending replacement" in Known Gaps.
· Pause and report.

1d — Verify

☐ pnpm dev (UI only — no build).
☐ Open site → chat widget visible on the main layout.
☐ Send a message → request reaches the API proxy without error (response may stream if provider is configured locally; if not, confirm the request is formed correctly and the error is from the provider, not the UI).
☐ Confirm no Gemini text/logo visible anywhere in the rendered DOM.
☐ Confirm headset avatar renders correctly at desktop and mobile widths.
☐ Confirm unauthenticated visitor does not see the widget (or sees a "log in to chat" state per repo pattern).
· Pause and report.

Acceptance: Chatbot mounted in main site, Gemini-free, operator avatar present, API flow intact, no UI breakage.

---

Task 2 — Admin / Super-Admin / User Magic-Link Routing & MFA Rules

Goal: Correct redirects and timer behaviour per role. Three flows, exact destinations.

2a — Locate current behaviour

☐ Find the magic-link verify handler and where it redirects after session creation.
☐ Find the post-login redirect logic for: (a) plain admin, (b) super admin, (c) normal user.
☐ Find the current MFA-timeout enforcement (does it exist? where is BLOCKED_MFA_SETUP set?).
☐ Find how "first login" is tracked (DB flag, MFA enrolment state, or none).
☐ Record the current redirect matrix in playbook.md — what does each role see today?
· Pause and report.

2b — Implement admin flow (@vunnvault.com excluding super admin)

Per this work order, the admin flow is:

☐ After clicking magic link → never land on a generic login screen.
☐ On first login (no MFA enrolled yet):
  · Redirect to homepage with admin access.
  · Show a mandatory popup: "You have 5 minutes to set up your MFA. If not completed, your account will be suspended."
  · Start a 5:00 countdown tied to a server-side enforcement (not just client-side, so reloading the page does not reset the timer).
  · On completion: MFA enrolled, popup dismissed, timer cancelled.
  · On expiry: account status BLOCKED_MFA_SETUP; subsequent magic-link attempt rejected with a clear message.
☐ On subsequent logins (MFA already enrolled):
  · Magic link → MFA verify screen → 6-digit code → full admin dashboard.
  · No timer, no popup.
· Important change from prior run: earlier the first login went to a dedicated MFA setup screen. This new order says go to homepage + popup. Implement the homepage + popup flow. If a dedicated setup screen exists, keep it reachable from the popup (e.g. "Set up MFA" button) but the default destination is homepage.
· Pause and report.

2c — Implement super admin flow (divine@vunnvault.com)

☐ Magic link → full admin/super-admin access to the app.
☐ No 5-minute timer. No popup. No suspension risk.
☐ MFA setup remains available at any time (e.g. under account settings) but is not forced.
☐ If BLOCKED_MFA_SETUP is set on Divine by legacy logic, clear it and ensure the block branch is explicitly skipped for super_admin.
· Pause and report.

2d — Implement regular user flow

☐ Magic link → immediately route to MFA verification screen (6-digit code).
☐ Must not show "link expired" or "unauthenticated" states for a valid fresh link. If the current code shows these errors, find and fix the pre-session handoff (likely a cookie/session created on verify but dropped before the MFA prompt).
☐ On correct code → homepage with normal user profile.
☐ Wrong code → 401 with clear message; retry allowed within rate limits.
· Pause and report.

2e — Server-side enforcement (critical)

☐ The 5-minute timer for non-Divine admins must be enforced server-side, not only in the UI:
  · Record mfa_setup_deadline on the account at first-login session creation.
  · Middleware rejects protected requests past the deadline unless MFA is completed.
  · Setting the deadline is atomic; repeated magic-link clicks do not reset it.
☐ super_admin row is excluded from the enforcement branch.
☐ Every block / unblock event writes to the audit log.
· Pause and report.

2f — Verify all three flows end-to-end

Admin (daniel@vunnvault.com) — first login:

☐ Magic link delivered (Resend dashboard confirms).
☐ Click link → homepage loads with admin access (not login screen).
☐ Popup with exact 5:00 warning appears.
☐ Complete TOTP enrolment → QR decodes to valid otpauth://, code accepted, popup dismissed.
☐ Refresh the page → still on homepage, no new timer.

Admin — subsequent login:

☐ Magic link → MFA code screen → correct code → admin dashboard.

Admin — timeout test (use a temp test admin or tshepiso@):

☐ First login → homepage + popup → wait past 5:00 without enrolling.
☐ Account status becomes BLOCKED_MFA_SETUP.
☐ Next magic-link attempt is rejected with a clear message.
☐ Verify super-admin reset can unblock (documented in playbook).

Super admin (divine@vunnvault.com):

☐ Magic link → full access, no popup, no timer.
☐ Account never blocked by timer regardless of MFA state.
☐ MFA optional setup available in settings.

Regular user (someone@gmail.com):

☐ Sign up, enrol MFA, complete onboarding (per Task 3).
☐ Magic link → directly to MFA code screen (no "link expired" error).
☐ Correct code → homepage with normal user profile.
☐ Wrong code → 401, clear error.
· Pause and report after each role.

Acceptance: All three flows match the specified redirects and timer rules; timer enforced server-side; super admin never blocked.

---

Task 3 — Fix 3-Step Signup TOTP QR Bug + Onboarding → Login Routing

Blocked until §2 root-cause is logged (do not blind-fix).

3a — Diagnose the QR bug

☐ Call the TOTP enrolment endpoint directly (curl / fetch) from the signup flow.
☐ Capture the raw response: does it contain a valid otpauth:// URI and/or a QR image payload?
☐ In the browser (dev server), open DevTools → Network tab, reproduce signup Step 2.
  · Is the request sent? Is it 200?
  · What is the response body?
☐ Check the console: any JS error, CSP violation (Refused to load the image), QRCode library error?
☐ Check the component: does it receive the expected prop, and does the QR library get valid input?
☐ Record root cause in playbook.md. Examples:
  · Backend returns otpauth:// URI but frontend renders <img src="{undefined}"> → frontend prop mismatch.
  · Backend returns a data: URI but CSP blocks → add CSP allowance or render as SVG.
  · QR library not imported / wrong import path after a dep update.
  · Error boundary swallowing a render error.
  · API returns null secret.
· Pause and report root cause before fixing.

3b — Fix according to root cause

☐ Apply the minimal fix for the identified cause.
☐ Do not refactor unrelated signup logic.
☐ If the fix requires a dependency change (e.g. install qrcode.react), ask the user first (per G7 — dependency changes are out of scope unless approved).
· Pause and report.

3c — Verify QR renders correctly

☐ Reproduce signup Step 2 in the browser.
☐ QR image renders visibly (not blank, not error state).
☐ Decode the rendered image (not the API payload) → valid otpauth://totp/ URI.
☐ Secret is Base32, ≥32 chars.
☐ issuer= present (e.g. VunVault).
☐ Scan with Google Authenticator (or a TOTP generator using the secret) → 6-digit code shown.
☐ Submit that code to the confirmation endpoint → accepted.
· Pause and report.

3d — Verify the corrected signup sequence end-to-end

Per this work order:

Step 1 — Registration + OTP

☐ Sign up with a test email → OTP delivered via Resend (dashboard confirms).
☐ Enter OTP → accepted.

Step 2 — MFA/TOTP

☐ QR renders (per 3c).
☐ User scans, enters 6-digit code → accepted.
☐ Account creation finalised.

Step 3 — Onboarding

☐ After Step 2 completes, user is redirected to the Onboarding Wizard (not login, not homepage).

Final — Post-onboarding

☐ After Onboarding completes, user is redirected to Login page (not auto-logged-in, not homepage).
☐ User performs magic-link login + 6-digit MFA.
☐ Lands on homepage with normal user profile.
· Pause and report.

3e — Edge cases

☐ Refresh mid-signup (Step 2 after QR shown) → confirm state survives or logged as gap.
☐ Refresh mid-onboarding → confirm state survives or logged as gap.
☐ Invalid MFA code at signup Step 2 → rejected, user can retry.
☐ Attempt to reach onboarding without completing MFA → blocked.
☐ Attempt to reach homepage as normal user without MFA → blocked (redirect to MFA).
· Pause and report.

Acceptance: QR renders and decodes to a valid secret accepted by a TOTP generator; signup → onboarding → login → homepage sequence works end-to-end; edge cases behave.

---

Task 4 — Start API + UI, check errors

4a — Start both services

☐ Stop any orphaned process on :8080 (free RAM).
☐ pnpm dev for API — capture full log.
☐ pnpm dev for web — capture full log.
☐ No next build at any point.
· Pause and report.

4b — Smoke test

☐ GET /healthz, /health, /readyz → all 200; Redis up; Resend from-domain verified.
☐ Magic-link send to a provisioned admin → Resend dashboard shows the send.
☐ Signup with @vunnvault.com → blocked.
☐ Signup with @gmail.com → reaches Step 2, QR renders (proves the Task 3 fix works from the running app).
☐ Chatbot widget visible on the homepage (Task 1 fix).
· Pause and report.

4c — Error inventory

☐ List every error and warning from both startup logs.
☐ For each error introduced by Tasks 1–3, classify (local-fix-safe / needs-approval) per the existing §E protocol, fix if safe, re-verify.
· Pause and report.

4d — Clean stop

☐ SIGTERM both services; confirm graceful shutdown; no orphan processes.
· Report.

Acceptance: Both services boot on pnpm dev, zero errors, smoke tests pass.

---

Task 5 — playbook.md update

Append:

```markdown
## Chatbot (Task 1)
- Mount point: …
- Gemini references removed from: …
- Avatar asset: placeholder (headset + shield) — replacement pending
- Visibility: authenticated users only

## Auth redirect matrix (Task 2)
| Role | First login | Subsequent logins |
|---|---|---|
| admin (@vunnvault.com, non-super) | homepage + 5-min popup + server-side deadline | magic link → MFA code → dashboard |
| super_admin (divine@) | homepage, no popup, no timer | magic link → full access, MFA optional |
| normal user | (signup completes first) magic link → MFA code → homepage | magic link → MFA code → homepage |

- Timer enforcement: server-side (`mfa_setup_deadline` on account).
- Blocked state: BLOCKED_MFA_SETUP; unblock: super-admin reset.
- Divine exemption: super_admin skipped in enforcement branch.

## Signup TOTP QR bug (Task 3)
- Root cause: …
- Fix: … (file, line)
- Rendered QR decode verified: yes/no
- Google Authenticator sync: yes/no

## Signup → Onboarding → Login routing
- Post-onboarding destination: Login page (not auto-login)
- Verified end-to-end: yes/no

## Decisions & Assumptions
- …

## Known Gaps / Future Work
- 5 standby admin emails pending
- Avatar asset replacement pending user artwork
- UI page-level verification limited by 1 GiB sandbox — dev-server only
- …
```

---

Final report — exact structure

```
# VunVault — Chatbot / Auth Routing / Signup Fix — Report
Date: <UTC>  |  Commit: <sha>  |  No deployment performed.

## 1. Results
| Task | Sub-tasks | Status | Evidence |
|---|---|---|---|
| 1 Chatbot integration | 1a–1d | PASS/FAIL | … |
| 2 Auth routing + MFA rules | 2a–2f | PASS/FAIL | … |
| 3 Signup TOTP QR + onboarding routing | 3a–3e | PASS/FAIL | … |
| 4 API + UI start | 4a–4d | PASS/FAIL | … |
| 5 Playbook | — | PASS/FAIL | … |

## 2. Root cause log
- QR bug: <cause identified in 3a> — fixed at <file:line> — verified by <decode rendered image + Google Authenticator code accepted>
- Magic-link / MFA routing prior behaviour vs new: <summary>

## 3. Evidence per task
### 3.1 Chatbot
- Mount point: … | Gemini hits in dev bundle: 0 | Avatar: rendered | API flow: request reaches proxy
### 3.2 Auth redirects
- Admin first login: homepage + popup + timer at <server-side field>
- Admin timeout: blocked after 5:00 (evidence: status change + next login rejected)
- Divine: no timer (evidence: …)
- Normal user: direct to MFA screen (evidence: …), no "link expired" errors
### 3.3 Signup
- QR: rendered (screenshot/binary ref) | decoded URI: `otpauth://totp/…` | secret length: N | Google Auth code accepted
- Post-onboarding destination: `/login` (evidence: HTTP redirect 302 → /login)
- Full sequence: signup → OTP → QR → MFA → onboarding → login → MFA → homepage ✅

## 4. Dev-server runs (no builds)
| Service | Command | Errors | Warnings |
|---|---|---|---|
| API | pnpm dev | 0 | <list> |
| Web | pnpm dev | 0 | <list> |

## 5. Resend evidence
- Key masked: re_****…
- Magic-link email ids observed: …
- OTP email ids observed: …

## 6. Errors fixed / errors awaiting approval
- Fixed: …
- Awaiting approval: …

## 7. Supabase changes (if any)
| File / migration | Change | Applied | Reason |
|---|---|---|---|

## 8. Known gaps
- 5 standby admin emails pending
- Avatar asset pending
- …

## 9. Deployment
Nothing deployed. Awaiting explicit user confirmation before any deployment.
```

---

Definition of Done

☐ Chatbot visible on the main site layout, only for MFA-complete authenticated users; zero Gemini branding in rendered DOM; cybersecurity operator headset avatar renders on desktop and mobile.
☐ Admin (@vunnvault.com, non-super): first login → homepage + 5:00 popup + server-side deadline; subsequent → magic link + MFA → dashboard.
☐ Super admin (divine@vunnvault.com): magic link → full access, no timer, no popup, no block.
☐ Normal user: magic link → direct MFA screen (no "link expired"/unauthenticated); correct code → homepage; wrong code → clear rejection.
☐ Signup TOTP QR: renders visibly in browser; decoded URI valid; secret Base32 ≥32 chars; Google Authenticator code accepted.
☐ Post-onboarding: user is routed to Login page (not auto-login, not homepage); final login with MFA lands on homepage.
☐ API + UI run on pnpm dev only with 0 errors. No next build executed.
☐ All changes logged in playbook.md including the QR root cause and redirect matrix.
☐ Nothing deployed. Report ends with: "Awaiting explicit user confirmation before any deployment."

---

One-line instruction to the agent

Resolve the QR-bug root cause before fixing (Task 3a); implement the three redirect flows exactly as written with server-side timer enforcement (Task 2); run only pnpm dev; log everything in playbook.md; do not deploy. Start at P1.

VunVault — Human-in-the-Loop Verification Addendum

Amends: Frontend Chatbot + Auth Routing + Signup Fix work order (all previous tasks)
Overrides: every "agent self-verifies email" and "agent self-verifies QR" step in Tasks 1d, 2f, 3c, 3d, 4b
Rule: the user is the verifier for email delivery, magic links, MFA codes, and QR compatibility. The agent's job is to send real things to a real inbox and hand the user exactly what they need to confirm. The agent must not declare PASS on any of these items without the user's explicit confirmation.

---

H0 — One-time setup the agent must do before Task 1

H0.1 — Get the user's real email address

☐ Ask the user: "What real email address should I send the OTP, admin magic links, and test messages to? It must be an inbox you can open right now."
☐ Wait for the reply. Do not guess. Do not use delivered@resend.dev, @example.com, or any test address.
☐ Record the address in playbook.md → Human verification → Test inbox (masked if it is the user's personal address, e.g. j****@gmail.com).

H0.2 — Confirm real Resend is active

☐ Confirm the rotated Resend API key is loaded (re_****…, masked in logs).
☐ Confirm the from address is either onboarding@resend.dev (default) or a verified domain the user has set up. If the from is onboarding@resend.dev, the recipient must be the Resend-account email address (Resend rule); otherwise the user must verify their domain first. Confirm with the user which situation applies.
☐ No mocks. No MAIL_DEV_MODE. No console-log "success" pretending to be a send.

H0.3 — Declare the human-verification protocol

Post this to the user before starting Task 1:

"From now on, for every email and every MFA/QR check, I will:

1. Send the real email via Resend to <your address>.
2. Paste the Resend message id and dashboard status here.
3. Wait for you to confirm you received it and to paste back the OTP / magic-link code you saw.
4. For MFA, I will paste the QR image reference, the raw otpauth:// URI, and the Base32 secret here. You will add it to Google Authenticator and tell me whether the 6-digit code your app shows is accepted by my server.
5. I will not mark anything PASS until you confirm.
   If I cannot render the QR image, I will still give you the URI + secret so you can enter it manually in Google Authenticator. A manual-entry fallback is acceptable; a silent failure is not."

☐ Wait for the user to acknowledge before proceeding.

---

H1 — Email verification becomes user-verified (overrides 1d, 2f, 3c, 3d, 4b)

For every email the agent sends (OTP, magic link, admin magic link, super-admin magic link), the agent must:

Step Who does it
Trigger the send (API/UI) Agent
Capture Resend id + dashboard status Agent — paste into chat
Confirm the email arrives in the inbox User
Read the OTP / click the magic link / read the code User
Report back to the agent ("got it, code is XXXX" or "clicked link, was redirected to Y") User
Then and only then: agent validates the code server-side and marks PASS Agent

Items that are now user-verified, not agent-verified:

☐ OTP during signup (Task 3d Step 1)
☐ Admin first-login magic link (daniel@ or a provisioned admin)
☐ Admin subsequent-login magic link
☐ Super-admin magic link (divine@)
☐ Regular-user magic link
☐ The unregistered-address invite email (Task 2b from prior order) — user confirms receipt of the invitation email.

Agent must NOT:

· Paste the OTP into a local log as proof of delivery.
· Use Resend test recipients (delivered@resend.dev etc.) as the sole evidence.
· Claim "email body matches accepted code" without the user having opened the actual inbox.
· Declare a magic-link redirect working without the user describing where they landed.

---

H2 — MFA / TOTP verification becomes user-verified (overrides 3c, 3d, 2f-admin, 2b and any MFA step)

For every TOTP enrolment or login, the agent must deliver to the user:

1. The rendered QR image — attach or reference the image the browser rendered (screenshot path, or the PNG/SVG the component produced). If the QR does not render, say so explicitly.
2. The raw otpauth:// URI — verbatim, in a code block:
   ```
   otpauth://totp/VunVault:<email>?secret=<BASE32>&issuer=VunVault&algorithm=SHA1&digits=6&period=30
   ```
3. The Base32 secret on its own line (uppercase, no spaces), so the user can type it manually into Google Authenticator if the QR will not scan.

The user then:

· Scans the QR or enters the secret manually in Google Authenticator.
· Reads the 6-digit code the app displays.
· Pastes that code back to the agent.
· The agent submits the code to the server and reports the response.

If the agent cannot generate a QR image:

☐ Do not mark Task 3c/3d as FAIL yet.
☐ Deliver the URI + Base32 secret to the user.
☐ Ask the user to add it manually to Google Authenticator and paste the 6-digit code.
☐ Agent validates the code server-side.
☐ If the code is accepted → status is PASS (manual-entry fallback); the QR rendering bug is still logged as a Known Gap and must be fixed, but the TOTP secret itself is proven valid.
☐ If the code is rejected → status is FAIL; log the exact server response.

Agent must NOT:

· Feed the secret to an online TOTP generator and self-confirm.
· Claim "QR decodes byte-identical" as evidence that the user's Google Authenticator will accept it.
· Mark Task 3c PASS without the user's Google Authenticator actually producing an accepted code.

---

H3 — Reporting statuses for user-verified items

Use these statuses in the final report:

Status Meaning
PASS (user-confirmed) User confirmed receipt / scanned QR / code accepted by server
PASS (manual-entry fallback) QR failed to render, but the URI/secret the agent supplied produced an accepted code in the user's Google Authenticator
PENDING-USER Agent sent the real thing, is waiting for the user to confirm
FAIL Code rejected by server, or user confirmed the email never arrived, or user confirmed Google Authenticator rejected the secret
BLOCKED No real email address supplied, or no Resend key, or user unavailable

☐ Every user-verified item in the final report uses one of these statuses.
☐ The report has a dedicated section — see H4.

---

H4 — Required new section in the final report

Add this before the existing §9 Deployment line:

```
## Human-in-the-loop verification
| Item | Email/Secret delivered | Resend id / URI prefix | User confirmation | Server result | Status |
|---|---|---|---|---|---|
| Signup OTP | j****@… | re_… | "got it, code 332759" | 200 | PASS (user-confirmed) |
| Admin first login magic link | j****@… | re_… | "clicked, landed on /home with popup" | 200 | PASS (user-confirmed) |
| Admin subsequent magic link | j****@… | re_… | "clicked, landed on /mfa" | 200 | PASS (user-confirmed) |
| Super-admin magic link | j****@… | re_… | "clicked, landed on /home, no timer" | 200 | PASS (user-confirmed) |
| Regular-user magic link | j****@… | re_… | "clicked, went to MFA screen" | 200 | PASS (user-confirmed) |
| Signup TOTP — QR image | (rendered / not rendered) | otpauth://totp/… | "scanned, GA shows 482913" | 204 | PASS (user-confirmed) |
| Signup TOTP — manual secret | (n/a if QR worked) | otpauth://totp/… + secret | "typed secret, GA shows 731104" | 204 | PASS (manual-entry fallback) |
```

☐ Every row filled with the agent's evidence and the user's pasted-back confirmation.
☐ Any row with an empty "User confirmation" cell is downgraded to PENDING-USER — not PASS.

---

H5 — Overrides to existing work-order sections (quick reference)

Existing step Old behaviour New behaviour (this addendum wins)
1d chatbot email checks agent self-confirms not email-related; unchanged
2f admin/user magic-link tests agent self-confirms redirect user clicks link, user describes landing page, agent records
3d Step 1 signup OTP agent reads inbox user reads inbox, pastes OTP, agent validates
3c/3d Step 2 TOTP QR agent decodes + self-tests user scans or manually enters; user pastes 6-digit code; agent validates
4b smoke tests agent self-confirms any test that touches email or MFA is user-confirmed; other smoke tests unchanged
Final report "PASS" only "PASS (user-confirmed)" / "PASS (manual-entry fallback)" / "PENDING-USER" / "FAIL" / "BLOCKED"

---

H6 — Definition of Done additions

☐ User's real test email address obtained and recorded (masked).
☐ The human-verification protocol (§H0.3) posted to user and acknowledged.
☐ Every email in scope (OTP, admin first-login link, admin subsequent link, super-admin link, regular-user link) was actually received by the user, with the Resend id captured.
☐ Every TOTP enrolment in scope was scanned or manually entered by the user in Google Authenticator, and the resulting 6-digit code was accepted by the server.
☐ If any QR failed to render, the URI + Base32 secret were delivered to the user and the resulting code was still accepted (status = PASS manual-entry fallback), with QR rendering logged as a Known Gap.
☐ Final report includes the Human-in-the-loop verification table with no empty User-confirmation cells on any PASS row.
☐ Nothing is marked PASS on email or MFA unless the user confirmed it in chat.
☐ Last line of report unchanged: "Awaiting explicit user confirmation before any deployment."

---

H7 — One-line instruction to the agent

Ask the user for their real email first; send real Resend emails to that inbox and wait for the user to confirm receipt and paste the OTP / describe the magic-link landing; for every MFA step, hand the user the QR image + otpauth:// URI + Base32 secret, wait for the 6-digit code from their Google Authenticator, then validate server-side; if the QR cannot render, still deliver the URI + secret as manual-entry fallback; mark nothing PASS until the user confirms; nothing deployed. Start at H0.1.

# 0002 — API conventions every route follows

- **Status:** accepted
- **Date:** 2026-10-06
- **Deciders:** VUNVAULT platform
- **Supersedes:** nothing. Companion to [0001 — the audit chain](./0001-audit-chain.md).
- **Enforced by:** `apps/api/src/conformance/route-table.test.ts`

## Context

Layer L4 grew to forty-odd route groups across nine tasks, written against a
catalogue rather than against each other. Conventions that live only in prose
decay: one task forgets a guard, another audits outside the transaction, a third
returns a token in a body. The cost of any one of those is not a bug report — it is
an unauthorised read, an unaudited mutation, or a leaked credential.

So the conventions were written down here, and then made executable: a suite builds
the whole route table with inert infrastructure and asserts every rule against every
route. A new route that breaks one fails the build.

## Decision

Every HTTP route in `apps/api` follows all of the following.

1. **Fastify 5, Zod type provider.** Route plugins are `FastifyPluginAsync` exports,
   wrapped in `fastify-plugin` only when they decorate. Each declares
   `schema: { params, querystring, body, response }` with Zod schemas — from
   `@vunvault/contracts` wherever the shape crosses the wire, and locally only where
   the contracts package (owned by an earlier task) has no such schema.
2. **`routes → service → repo`.** Route files contain no Drizzle calls. Repos take a
   `Db | Tx` and return plain objects; services receive repos through their
   constructor; routes do orchestration and nothing else.
3. **One envelope.** Success is `{ data }` or `{ data, total }`; failure is
   `{ error, message?, details? }` thrown as `HttpError(status, code, message?,
details?)`. A 5xx never carries a message: stack traces, SQL and secrets do not
   reach a client. Every response carries `x-request-id`.
4. **Guards are explicit and ordered.** `[app.authenticate, app.requireStaff,
app.requirePermission("x:y")]`. Admin routes always carry all three — a staff
   session on one factor is refused with `403 mfa_required`, because the actions
   behind `/admin/` are the ones a stolen password should not unlock. Public routes
   are an explicit allow-list (`PUBLIC_ROUTES`), and each is protected by something
   else: a rate-limit policy, a signature, or a one-time token.
5. **Every mutation is audited, in the same transaction.** `audited(spec, handler)`
   runs the domain write and the chain append inside one `withTx`, so a write that
   cannot be accounted for does not happen. A route that must append more than one
   entry, or append conditionally, does it by hand and is tagged with
   `Symbol.for("vv.audited")` so the conformance suite still sees it.
6. **Tokens live in HttpOnly cookies.** No response body carries an access or
   refresh token; nothing is written to `localStorage` or `sessionStorage`; the
   double-submit CSRF check applies to every session-bound mutation except the two
   machine routes that sign their payloads instead (`CSRF_EXEMPT`).
7. **Rate limits are named.** A route that an attacker would automate first declares
   a `rateLimitPolicy` (`login`, `public_form`, `sensitive`); webhook and node-ingest
   routes are exempt from the shared limiter and enforce their own per-subject limit.
8. **The audit prefix is read-only.** Under `/api/v1/admin/audit` the only methods
   that exist are GET and one `POST /verify`. No route, repo or service anywhere
   updates or deletes an `audit_entries` row; the database refuses it too.
9. **Personal data is minimised at the write.** Contact and consent submissions store
   `sha256(ip + daily salt)`, never the address; a contact message's audit entry
   carries its category and nothing else; the dashboard's public content projection
   carries an author's name and no identifier.
10. **No forbidden stack.** Express, Prisma, Joi and web storage are refused by the
    ESLint config, by `scripts/verify-forbidden-stack.mjs`, and by a source scan in
    the conformance suite that ignores comments — documentation may name a thing the
    code must not use.
11. **Signup is a verified flow (Task 40d, superseding the Task 26 `DECISION(v1)`).**
    `POST /auth/signup` no longer opens a session: it creates the Supabase user
    unconfirmed, writes the profile as `account_status = 'pending_verification'` with
    `require_2fa = true`, emails a six-digit OTP and answers `202` with no cookies.
    Only `POST /auth/signup/verify-email` — the OTP checked constant-time against its
    SHA-256, five wrong codes destroying it, ten minutes to live — confirms the
    mailbox, activates the profile and mints the aal1 session, and the web app then
    requires authenticator enrolment (Task 27) before the account is usable. The v1
    decision to skip mailbox verification is withdrawn: the prototype's signup is a
    three-step flow (details → email code → authenticator), and an address nobody
    proved they own is an account nobody owns. A re-signup while `pending_verification`
    replaces the abandoned record; pending signups older than 24 h are garbage-collected
    by the maintenance worker (`listStalePendingSignups` is the contract). Forgot/reset
    password follow the same envelope discipline: `forgot-password` answers an
    identical `202 {}` for known and unknown addresses and audits nothing at request
    time — the single-use, 30-minute token's consumption is what writes
    `PASSWORD_CHANGED`, and a reset revokes every session without bypassing MFA.

## Consequences

- Adding a route means adding it to the manifest if it is an exception, and the
  manifest entry has to carry a reason. Exceptions are visible in one file instead of
  being buried in a route's options object.
- The conformance suite builds the app with inert decorations, so it runs in the unit
  test phase with no database, Redis or network. The cost is that a route whose
  guard _implementation_ is wrong is not caught here — only its presence is. The
  guards themselves are tested in `plugins/auth.test.ts` and `plugins/security.test.ts`.
- The suite reports contract drift against `ROUTES_A`/`ROUTES_B`/`ROUTES_C` but only
  fails on drift that touches the audit surface. A route added by a later task is that
  task's job to document; a route that quietly appears under `/admin/audit` is not.
- Two checks are deliberately structural rather than behavioural: `isAudited` proves a
  handler is wrapped, not that the wrapper wrote the right entry, and the response
  schema check proves a 2xx schema exists, not that it matches the contracts package.
  Each is backed by a per-task test that asserts the actual payload.

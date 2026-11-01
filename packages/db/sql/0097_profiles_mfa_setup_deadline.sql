-- Auth-routing work order, Task 2e: server-side enforcement of the
-- first-login MFA setup window.
--
-- Before this, the 5-minute admin window existed only in two places that a
-- browser controls or can outrun: the `?deadline=` query parameter the
-- magic-link redirect carries (rendered into a countdown) and a Redis/KV
-- ledger keyed on the pre-MFA challenge handle. Both are real, but neither is
-- a property OF THE ACCOUNT. The ledger dies with the challenge, so a member
-- who clicks a fresh magic link gets a fresh handle and a fresh 5:00 — the
-- timer restarts, which is exactly what the work order forbids ("repeated
-- magic-link clicks do not reset it").
--
-- This column is the authoritative deadline. It is written once, at
-- first-login session creation, and every later magic link leaves an unexpired
-- value alone (the UPDATE is a single statement with a COALESCE, so two
-- concurrent links cannot race it into a reset). Both the API auth middleware
-- and the magic-link leg read it, so reloading the page or requesting a new
-- link cannot extend the window.
--
-- NULL means "no window": either the account has never opened one, it has
-- completed enrolment (the writer clears it), or it is the exempt super admin,
-- who is excluded from the enforcement branch entirely and therefore never
-- receives one.
--
-- ADDITIVE: a nullable column plus a partial index. No row is rewritten, no
-- default is backfilled, nothing is dropped.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mfa_setup_deadline timestamptz;

COMMENT ON COLUMN public.profiles.mfa_setup_deadline IS
  'Server-side deadline for the forced first-login MFA enrolment window. Set once at first-login session creation and never extended by a later magic link; cleared when enrolment completes. NULL = no window (never opened, already enrolled, or the exempt super admin). Expiry flips account_status to blocked_mfa_setup.';

-- Only rows with an OPEN window are ever scanned (the enforcement lookup is
-- `where mfa_setup_deadline is not null and mfa_setup_deadline <= now()`), and
-- that set is tiny — one row per administrator mid-enrolment. A partial index
-- keeps it that way instead of indexing every profile in the table.
CREATE INDEX IF NOT EXISTS profiles_mfa_setup_deadline_idx
  ON public.profiles (mfa_setup_deadline)
  WHERE mfa_setup_deadline IS NOT NULL;

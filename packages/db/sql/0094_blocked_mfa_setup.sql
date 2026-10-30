-- Phase 2 (magic-link work order): first-login MFA enforcement for admins.
--
-- An admin whose 5:00 first-login MFA setup window expired — or who abandoned
-- the setup screen — is parked in `blocked_mfa_setup` until a super admin
-- resets the MFA state (see playbook.md, "Unblock path"). The super admin
-- account (divine@vunvault.com) is exempt from the timer and never lands here.
--
-- ADDITIVE: a new enum value only. `ALTER TYPE … ADD VALUE` cannot run inside
-- a transaction block on PG < 12 and the new value cannot be USED in the same
-- transaction on any version — this file only adds it, and the migrate runner
-- applies one file per transaction, so both rules hold.
--
-- Supabase/Postgres 15+: IF NOT EXISTS makes re-application a no-op.

ALTER TYPE public.account_status ADD VALUE IF NOT EXISTS 'blocked_mfa_setup';

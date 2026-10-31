-- LOCAL VERIFICATION FIX (2026-10-31, work-order rule R5): client onboarding
-- (SqlClientRepo.completeOnboarding) writes profiles.date_of_birth when the
-- three-step wizard completes, but neither the drizzle baseline nor any
-- hand-written file up to 0095 creates that column, so POST /api/v1/onboarding
-- failed with 'column "date_of_birth" of relation "profiles" does not exist'
-- (SQLSTATE 42703) against a freshly migrated database.
-- Additive: nullable date, no data rewritten; the authoritative copy with the
-- 16-years check remains onboarding_profiles.date_of_birth.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth date;

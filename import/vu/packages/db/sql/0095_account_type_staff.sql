-- Staff-provisioned profiles (SqlUsersRepo.createProfile — the admin-roster
-- provisioning path and staff invitations) write account_type 'staff'. The
-- drizzle baseline only carried the two PUBLIC signup values ('individual',
-- 'company'), so provisioning failed against a freshly migrated database.
-- Additive: no data is rewritten, and the public signup surface (SignupBody)
-- still only accepts individual/company.
ALTER TYPE public.account_type ADD VALUE IF NOT EXISTS 'staff';

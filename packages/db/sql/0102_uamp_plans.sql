-- UAMP subscription plans (product-specific codes under shared billing).
-- Amounts are USD cents. Entitlements live in application config keyed by plan code.

INSERT INTO plans (id, code, name, description, unit, monthly_usd_cents, active, created_at)
VALUES
  (gen_random_uuid(), 'uamp_free', 'UAMP Free', 'Free tier for individual developers', 'month', 0, true, now()),
  (gen_random_uuid(), 'uamp_starter', 'UAMP Starter', 'Starter monitoring for freelancers and small projects', 'month', 900, true, now()),
  (gen_random_uuid(), 'uamp_professional', 'UAMP Professional', 'Professional monitoring for startups and SaaS teams', 'month', 2900, true, now()),
  (gen_random_uuid(), 'uamp_business', 'UAMP Business', 'Business monitoring with higher limits and team seats', 'month', 7900, true, now()),
  (gen_random_uuid(), 'uamp_agency', 'UAMP Agency', 'Agency tier for multi-client monitoring', 'month', 14900, true, now())
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  monthly_usd_cents = EXCLUDED.monthly_usd_cents,
  active = EXCLUDED.active;

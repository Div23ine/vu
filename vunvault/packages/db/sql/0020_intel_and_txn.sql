-- Task 20b addendum: zero-day desk, sensor fleet, Command Center metrics and the
-- human payment transaction code.
--
-- The Drizzle migration creates all of this on a fresh database; the ALTER blocks
-- below are guarded so this file is also safe to apply to a database that predates
-- the schema change. migrate.ts runs Drizzle first, then this file.

-- 1) Defensive column additions ----------------------------------------------
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS paystack_customer_code text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_stripe_customer_id_key'
  ) THEN
    ALTER TABLE organizations ADD CONSTRAINT organizations_stripe_customer_id_key
      UNIQUE (stripe_customer_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_paystack_customer_code_key'
  ) THEN
    ALTER TABLE organizations ADD CONSTRAINT organizations_paystack_customer_code_key
      UNIQUE (paystack_customer_code);
  END IF;
END $$;

ALTER TABLE scan_jobs ADD COLUMN IF NOT EXISTS analyst_id uuid REFERENCES profiles (id);
CREATE INDEX IF NOT EXISTS scan_jobs_analyst_id_idx ON scan_jobs (analyst_id);

ALTER TABLE plans ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'month';

ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS plan_code text REFERENCES plans (code);

-- `payment_attempts.txn_number` / `txn_code`: a generated identity sequence and a
-- stored generated code (`VX-90241` …). Neither may be set by an INSERT.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'payment_attempts' AND column_name = 'txn_number'
  ) THEN
    ALTER TABLE payment_attempts
      ADD COLUMN txn_number bigint GENERATED ALWAYS AS IDENTITY (START WITH 90242);
    ALTER TABLE payment_attempts ALTER COLUMN txn_number SET NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'payment_attempts' AND column_name = 'txn_code'
  ) THEN
    ALTER TABLE payment_attempts
      ADD COLUMN txn_code text GENERATED ALWAYS AS ('VX-' || txn_number::text) STORED NOT NULL;
    ALTER TABLE payment_attempts ADD CONSTRAINT payment_attempts_txn_code_key UNIQUE (txn_code);
  END IF;
END $$;

-- 2) advisory_broadcasts: append-only except delivery progress ---------------
-- DELETE is refused outright. UPDATE is refused unless every column outside the
-- allow-list below is byte-identical, so the counters and terminal state of a
-- broadcast can advance but its content can never be rewritten.
CREATE OR REPLACE FUNCTION vv_reject_advisory_broadcast_delete() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION 'advisory broadcasts are append-only';
END;
$fn$;

CREATE OR REPLACE FUNCTION vv_guard_advisory_broadcast_update() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  v_mutable text[] := ARRAY[
    'status',
    'sent_dashboards',
    'sent_email',
    'sent_sms',
    'failed',
    'finished_at',
    'started_at',
    'queue_job_id',
    'audit_seq'
  ];
BEGIN
  IF (to_jsonb(OLD) - v_mutable) IS DISTINCT FROM (to_jsonb(NEW) - v_mutable) THEN
    RAISE EXCEPTION
      'advisory broadcasts are append-only: only status, delivery counters and timing may change';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS vv_advisory_broadcasts_no_delete ON advisory_broadcasts;
CREATE TRIGGER vv_advisory_broadcasts_no_delete
  BEFORE DELETE ON advisory_broadcasts
  FOR EACH ROW EXECUTE FUNCTION vv_reject_advisory_broadcast_delete();

DROP TRIGGER IF EXISTS vv_advisory_broadcasts_guard_update ON advisory_broadcasts;
CREATE TRIGGER vv_advisory_broadcasts_guard_update
  BEFORE UPDATE ON advisory_broadcasts
  FOR EACH ROW EXECUTE FUNCTION vv_guard_advisory_broadcast_update();

-- 3) Plan catalogue ----------------------------------------------------------
-- `monthly_usd_cents` is the price per `unit`, in USD cents.
INSERT INTO plans (code, name, unit, monthly_usd_cents) VALUES
  ('starter_scan',             'Starter Scan',               'scan',       29900),
  ('sacco_fintech_compliance', 'SACCO & Fintech Compliance', 'assessment', 89900),
  ('enterprise_retainer',      'Enterprise Client',          'month',     249900)
ON CONFLICT (code) DO NOTHING;

-- 4) Chart of accounts (Task 17) --------------------------------------------
INSERT INTO ledger_accounts (code, name, type) VALUES
  ('accounts_receivable',    'Accounts Receivable',    'asset'),
  ('cash_stripe_clearing',   'Stripe Clearing',        'asset'),
  ('cash_paystack_clearing', 'Paystack Clearing',      'asset'),
  ('revenue_services',       'Services Revenue',       'revenue'),
  ('revenue_subscription',   'Subscription Revenue',   'revenue'),
  ('revenue_academy',        'Academy Revenue',        'revenue'),
  ('refunds',                'Refunds',                'expense'),
  ('deferred_revenue',       'Deferred Revenue',       'liability')
ON CONFLICT (code) DO NOTHING;

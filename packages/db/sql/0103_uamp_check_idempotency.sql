-- UAMP check execution idempotency.
-- Existing rows receive stable legacy keys; new worker writes must supply a check_key.
ALTER TABLE uamp_check_results
  ADD COLUMN IF NOT EXISTS check_key text;

UPDATE uamp_check_results
SET check_key = 'legacy-' || id::text
WHERE check_key IS NULL;

ALTER TABLE uamp_check_results
  ALTER COLUMN check_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uamp_check_results_monitor_check_key_idx
  ON uamp_check_results (monitor_id, check_key);

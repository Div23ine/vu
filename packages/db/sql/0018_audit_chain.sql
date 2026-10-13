-- Retention: 7 years, WORM. Never UPDATE/DELETE. Corrections are new entries.
--
-- This migration makes the audit log append-only at the database level and links
-- every new entry to the current chain head, so a gap or a rewrite is impossible
-- without dropping the trigger (which itself is an auditable, privileged act).

-- 1) Append-only enforcement -------------------------------------------------
CREATE OR REPLACE FUNCTION vv_reject_audit_mutation() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION 'audit records are append-only';
END;
$fn$;

DROP TRIGGER IF EXISTS vv_audit_entries_append_only ON audit_entries;
CREATE TRIGGER vv_audit_entries_append_only
  BEFORE UPDATE OR DELETE ON audit_entries
  FOR EACH ROW EXECUTE FUNCTION vv_reject_audit_mutation();

DROP TRIGGER IF EXISTS vv_audit_entries_no_truncate ON audit_entries;
CREATE TRIGGER vv_audit_entries_no_truncate
  BEFORE TRUNCATE ON audit_entries
  FOR EACH STATEMENT EXECUTE FUNCTION vv_reject_audit_mutation();

DROP TRIGGER IF EXISTS vv_audit_checkpoints_append_only ON audit_checkpoints;
CREATE TRIGGER vv_audit_checkpoints_append_only
  BEFORE UPDATE OR DELETE ON audit_checkpoints
  FOR EACH ROW EXECUTE FUNCTION vv_reject_audit_mutation();

DROP TRIGGER IF EXISTS vv_audit_checkpoints_no_truncate ON audit_checkpoints;
CREATE TRIGGER vv_audit_checkpoints_no_truncate
  BEFORE TRUNCATE ON audit_checkpoints
  FOR EACH STATEMENT EXECUTE FUNCTION vv_reject_audit_mutation();

DROP TRIGGER IF EXISTS vv_content_reviews_append_only ON content_reviews;
CREATE TRIGGER vv_content_reviews_append_only
  BEFORE UPDATE OR DELETE ON content_reviews
  FOR EACH ROW EXECUTE FUNCTION vv_reject_audit_mutation();

-- 2) Chain linking -----------------------------------------------------------
-- Serialised with a transaction-level advisory lock so two concurrent inserts can
-- never both read the same head and fork the chain.
CREATE OR REPLACE FUNCTION vv_audit_chain_link() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  v_head_hash char(64);
  v_zero_hash char(64) := repeat('0', 64)::char(64);
BEGIN
  PERFORM pg_advisory_xact_lock(7340481);

  SELECT hash INTO v_head_hash
    FROM audit_entries
   ORDER BY seq DESC
   LIMIT 1;

  IF v_head_hash IS NULL THEN
    IF NEW.prev_hash <> v_zero_hash THEN
      RAISE EXCEPTION
        'audit chain: the first entry must reference the zero hash, got %', NEW.prev_hash;
    END IF;
  ELSIF NEW.prev_hash <> v_head_hash THEN
    RAISE EXCEPTION
      'audit chain: prev_hash % does not match the head hash %', NEW.prev_hash, v_head_hash;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS vv_audit_entries_chain_link ON audit_entries;
CREATE TRIGGER vv_audit_entries_chain_link
  BEFORE INSERT ON audit_entries
  FOR EACH ROW EXECUTE FUNCTION vv_audit_chain_link();

-- 3) Genesis -----------------------------------------------------------------
-- Written exactly once. Its hash is the digest of the fixed genesis string, and
-- its signature is zero because there is no key version before the first rotation.
INSERT INTO audit_entries (
  category,
  event_type,
  severity,
  actor_label,
  message,
  prev_hash,
  hash,
  signature,
  key_id,
  created_at
)
SELECT 'system',
       'CHAIN_GENESIS',
       'info',
       'system',
       'Genesis block',
       repeat('0', 64)::char(64),
       encode(digest('VUNVAULT-GENESIS-2024-03-01', 'sha256'), 'hex')::char(64),
       repeat('0', 64)::char(64),
       'genesis',
       '2024-03-01T00:00:00Z'::timestamptz
WHERE NOT EXISTS (SELECT 1 FROM audit_entries);

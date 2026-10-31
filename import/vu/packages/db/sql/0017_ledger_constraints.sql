-- Billing invariants that cannot be expressed as plain column constraints:
--   1. double-entry balance, checked at COMMIT (deferrable),
--   2. ledger immutability,
--   3. the derived `invoice_balances` view.
--
-- Money rules: USD is the only settlement currency, amounts are integer USD
-- cents, and the ledger — never the invoice row — is the source of truth.

-- 1) Double-entry balance ----------------------------------------------------
-- Deferred so an entry's debit and credit lines may be inserted in any order
-- within one transaction; the assertion runs at COMMIT.
CREATE OR REPLACE FUNCTION vv_assert_balanced_entry() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  v_entry_id uuid;
  v_debit    bigint;
  v_credit   bigint;
BEGIN
  v_entry_id := COALESCE(NEW.entry_id, OLD.entry_id);

  SELECT COALESCE(SUM(amount_usd_cents) FILTER (WHERE direction = 'debit'), 0),
         COALESCE(SUM(amount_usd_cents) FILTER (WHERE direction = 'credit'), 0)
    INTO v_debit, v_credit
    FROM ledger_lines
   WHERE entry_id = v_entry_id;

  IF v_debit <> v_credit THEN
    RAISE EXCEPTION 'journal entry % is not balanced: debit=% credit=%',
      v_entry_id, v_debit, v_credit;
  END IF;

  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS vv_ledger_lines_balanced ON ledger_lines;
CREATE CONSTRAINT TRIGGER vv_ledger_lines_balanced
  AFTER INSERT OR UPDATE OR DELETE ON ledger_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION vv_assert_balanced_entry();

-- 2) Ledger immutability -----------------------------------------------------
-- A posted entry is never edited or deleted. Corrections are a new `reversal`
-- entry that references the original through `reverses_entry_id`.
CREATE OR REPLACE FUNCTION vv_reject_ledger_mutation() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION 'ledger is immutable; post a reversal entry';
END;
$fn$;

DROP TRIGGER IF EXISTS vv_journal_entries_immutable ON journal_entries;
CREATE TRIGGER vv_journal_entries_immutable
  BEFORE UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION vv_reject_ledger_mutation();

DROP TRIGGER IF EXISTS vv_ledger_lines_immutable ON ledger_lines;
CREATE TRIGGER vv_ledger_lines_immutable
  BEFORE UPDATE OR DELETE ON ledger_lines
  FOR EACH ROW EXECUTE FUNCTION vv_reject_ledger_mutation();

-- 3) Derived invoice balances ------------------------------------------------
-- total       = sum(invoice_lines.quantity * unit_usd_cents)
-- paid        = sum(ledger_lines.amount_usd_cents) credited to accounts_receivable
--               by `payment_captured` entries that reference the invoice
-- outstanding = total - paid, never negative
CREATE OR REPLACE VIEW invoice_balances AS
WITH line_totals AS (
  SELECT il.invoice_id,
         SUM(il.quantity * il.unit_usd_cents)::bigint AS total_usd_cents
    FROM invoice_lines il
   GROUP BY il.invoice_id
),
paid_totals AS (
  SELECT je.reference_id AS invoice_id,
         SUM(ll.amount_usd_cents)::bigint AS paid_usd_cents
    FROM journal_entries je
    JOIN ledger_lines ll    ON ll.entry_id = je.id
    JOIN ledger_accounts la ON la.id = ll.account_id
   WHERE je.kind = 'payment_captured'
     AND je.reference_type = 'invoice'
     AND je.reference_id IS NOT NULL
     AND la.code = 'accounts_receivable'
     AND ll.direction = 'credit'
   GROUP BY je.reference_id
)
SELECT i.id AS invoice_id,
       COALESCE(lt.total_usd_cents, 0) AS total_usd_cents,
       COALESCE(pt.paid_usd_cents, 0)  AS paid_usd_cents,
       GREATEST(COALESCE(lt.total_usd_cents, 0) - COALESCE(pt.paid_usd_cents, 0), 0)
         AS outstanding_usd_cents
  FROM invoices i
  LEFT JOIN line_totals lt ON lt.invoice_id = i.id
  LEFT JOIN paid_totals pt ON pt.invoice_id = i.id;

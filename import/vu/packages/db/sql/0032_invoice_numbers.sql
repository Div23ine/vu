CREATE SCHEMA IF NOT EXISTS billing;
-- 0032: per-year invoice counters.
--
-- Invoice numbers are human-facing (`VV-INV-2026-0842`) and must never repeat or
-- be allocated out of order. A dedicated counter row per year, bumped inside the
-- issuing transaction, gives that without a sequence that cannot be reset per year
-- and without scanning `invoices` for MAX(number).
create table if not exists billing.invoice_counters (
  year integer primary key,
  last   integer not null check (last >= 0)
);

comment on table billing.invoice_counters is
  'Per-year invoice counters. Allocation is INSERT .. ON CONFLICT DO UPDATE SET last = last + 1 RETURNING last, inside the issuing transaction.';

-- Allocation helper, so the API never hand-writes the upsert.
create or replace function billing.next_invoice_counter(p_year integer)
returns integer
language sql
as $$
  insert into billing.invoice_counters (year, last)
  values (p_year, 1)
  on conflict (year) do update set last = billing.invoice_counters.last + 1
  returning last;
$$;

comment on function billing.next_invoice_counter(integer) is
  'Returns the next counter value for the given year, atomically.';

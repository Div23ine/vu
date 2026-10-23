-- 0092_guest_orders.sql
-- Guest (no-account) orders for the public /pricing checkout, plus the two
-- additional display currencies the pricing toggle offers. Additive only:
-- enum values are guarded, the table is new, nothing existing is touched.

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'public' and t.typname = 'display_currency'
       and exists (select 1 from pg_enum e where e.enumtypid = t.oid and e.enumlabel = 'GBP')
  ) then
    alter type public.display_currency add value 'GBP';
  end if;
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'public' and t.typname = 'display_currency'
       and exists (select 1 from pg_enum e where e.enumtypid = t.oid and e.enumlabel = 'EUR')
  ) then
    alter type public.display_currency add value 'EUR';
  end if;
end $$;

create table if not exists guest_orders (
  id                uuid primary key default gen_random_uuid(),
  -- The reference we hand Paystack at initialise; the single source of truth.
  reference         text not null unique,
  plan_code         text not null,
  email             citext not null,
  status            text not null default 'pending'
                    check (status in ('pending', 'paid', 'failed', 'expired')),
  usd_cents         integer not null check (usd_cents > 0),
  -- Display-only conversion snapshot locked at order creation (USD settles).
  display_currency  display_currency not null default 'USD',
  rate_local_per_usd text,
  display_minor     bigint,
  paid_at           timestamptz,
  failure_reason    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists guest_orders_email_idx on guest_orders (email);
create index if not exists guest_orders_status_idx on guest_orders (status);

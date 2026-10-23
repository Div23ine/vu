-- 0093_analytics_events.sql
-- First-party, consent-gated analytics: the browser only posts these events
-- when the visitor accepted the Analytics category, and the payload carries
-- no IP, no user agent join key and no cookies — an event name and the
-- minimal meta the product team asked for. Additive only.
create table if not exists analytics_events (
  id         uuid primary key default gen_random_uuid(),
  event      text not null,
  meta       jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists analytics_events_event_idx on analytics_events (event, created_at desc);

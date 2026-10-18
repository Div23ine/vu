-- 0091_open_tools_and_waitlist.sql
-- Open tooling catalogue + waitlist signups. Additive: two new tables and the
-- seed rows for the tools the Products page already announced. `file_url`
-- starts NULL everywhere: a tool is listed when announced, and its download
-- appears when the artifact is published; until then the UI offers a waitlist
-- signup for that tool.

create table if not exists open_tools (
  id         text primary key,
  name       text not null,
  summary    text not null,
  tags       text[] not null default '{}',
  size_label text,
  file_url   text,
  icon       text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists open_tools_sort_order_idx
  on open_tools (sort_order, id);

create table if not exists waitlist_entries (
  id         uuid primary key default gen_random_uuid(),
  email      citext not null,
  topic      text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists waitlist_entries_email_topic_idx
  on waitlist_entries (email, topic);

insert into open_tools (id, name, summary, tags, size_label, file_url, icon, sort_order)
values
  (
    'cve-tracker',
    'CVE Tracker CLI',
    'Terminal utility that pulls the NVD feed, filters by vendor and ecosystem, and prints a prioritised patch queue for your estate.',
    array['CLI', 'Python', 'NVD'],
    '2.4 MB · .zip',
    null,
    'terminal',
    1
  ),
  (
    'nmap-cheatsheet',
    'Nmap Operator Cheatsheet',
    'A twelve-page PDF of the scan flags, timing templates and evasion switches our assessors actually reach for during engagements.',
    array['PDF', 'Recon', 'Reference'],
    '1.1 MB · .pdf',
    null,
    'file-text',
    2
  ),
  (
    'hardening-baselines',
    'Linux Hardening Baselines',
    'Idempotent shell scripts that apply CIS-aligned baselines to Ubuntu, Debian and RHEL hosts, with a dry-run mode and rollback manifest.',
    array['Bash', 'CIS', 'Linux'],
    '380 KB · .tar.gz',
    null,
    'shield',
    3
  ),
  (
    'threat-feed',
    'Threat Intel Feed',
    'Machine-readable JSON feed of weaponised CVEs, active exploitation status and vendor advisory links — refreshed every fifteen minutes.',
    array['JSON', 'API', 'Live'],
    'External host · .json',
    null,
    'activity',
    4
  ),
  (
    'sacco-checklist',
    'SACCO Compliance Checklist',
    'A printable readiness checklist mapping Central Bank of Kenya and Data Protection Act obligations to concrete technical controls.',
    array['PDF', 'CBK', 'Fintech'],
    '860 KB · .pdf',
    null,
    'clipboard-check',
    5
  ),
  (
    'zero-day-watch',
    'Zero-Day Watch (RSS)',
    'Subscribe in any feed reader to receive VUNVAULT’s zero-day bulletin the moment a critical vulnerability becomes weaponised in the wild.',
    array['RSS', 'XML', 'Alerts'],
    'External host · .xml',
    null,
    'rss',
    6
  )
on conflict (id) do nothing;

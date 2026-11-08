-- UAMP product module: enums + core tables.
-- Generated to match packages/db/src/schema/uamp.ts and enum-values.ts.
-- Apply via the existing migration runner; do not run ad-hoc against production.

-- Enums
DO $$ BEGIN
  CREATE TYPE uamp_monitor_type AS ENUM ('http', 'https', 'api', 'ssl', 'domain', 'dns', 'keyword');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE uamp_monitor_status AS ENUM ('active', 'paused', 'disabled', 'pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE uamp_check_result_status AS ENUM ('up', 'down', 'degraded', 'error', 'timeout');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE uamp_incident_status AS ENUM ('open', 'acknowledged', 'investigating', 'resolved', 'false_positive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE uamp_incident_severity AS ENUM ('critical', 'major', 'minor', 'info');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE uamp_http_method AS ENUM ('GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE uamp_status_page_visibility AS ENUM ('public', 'private');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE uamp_alert_channel AS ENUM ('email', 'webhook', 'slack', 'in_app');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE uamp_ai_investigation_status AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Monitors
CREATE TABLE IF NOT EXISTS uamp_monitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  created_by uuid REFERENCES profiles(id),
  name text NOT NULL,
  type uamp_monitor_type NOT NULL,
  status uamp_monitor_status NOT NULL DEFAULT 'active',
  target text NOT NULL,
  method uamp_http_method DEFAULT 'GET',
  interval_seconds integer NOT NULL DEFAULT 300,
  timeout_ms integer NOT NULL DEFAULT 10000,
  locations text[] NOT NULL DEFAULT '{}',
  headers jsonb NOT NULL DEFAULT '[]',
  request_body text,
  assertions jsonb,
  keyword text,
  warn_days_before_expiry smallint,
  last_status uamp_check_result_status,
  last_checked_at timestamptz,
  last_latency_ms integer,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uamp_monitors_interval_positive CHECK (interval_seconds >= 30 AND interval_seconds <= 86400),
  CONSTRAINT uamp_monitors_timeout_positive CHECK (timeout_ms >= 1000 AND timeout_ms <= 60000),
  CONSTRAINT uamp_monitors_name_length CHECK (char_length(name) BETWEEN 1 AND 120),
  CONSTRAINT uamp_monitors_target_length CHECK (char_length(target) BETWEEN 1 AND 2048)
);

CREATE INDEX IF NOT EXISTS uamp_monitors_org_status_idx ON uamp_monitors (org_id, status);
CREATE INDEX IF NOT EXISTS uamp_monitors_org_type_idx ON uamp_monitors (org_id, type);
CREATE INDEX IF NOT EXISTS uamp_monitors_next_check_idx ON uamp_monitors (status, last_checked_at);

ALTER TABLE uamp_monitors ENABLE ROW LEVEL SECURITY;

-- Check results
CREATE TABLE IF NOT EXISTS uamp_check_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  monitor_id uuid NOT NULL REFERENCES uamp_monitors(id) ON DELETE CASCADE,
  status uamp_check_result_status NOT NULL,
  http_status integer,
  latency_ms integer,
  location text,
  error_message text,
  response_snippet text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uamp_check_results_snippet_length CHECK (response_snippet IS NULL OR char_length(response_snippet) <= 2048),
  CONSTRAINT uamp_check_results_error_length CHECK (error_message IS NULL OR char_length(error_message) <= 500)
);

CREATE INDEX IF NOT EXISTS uamp_check_results_monitor_checked_idx ON uamp_check_results (monitor_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS uamp_check_results_org_checked_idx ON uamp_check_results (org_id, checked_at DESC);

ALTER TABLE uamp_check_results ENABLE ROW LEVEL SECURITY;

-- Incidents
CREATE TABLE IF NOT EXISTS uamp_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  monitor_id uuid NOT NULL REFERENCES uamp_monitors(id) ON DELETE CASCADE,
  status uamp_incident_status NOT NULL DEFAULT 'open',
  severity uamp_incident_severity NOT NULL DEFAULT 'major',
  title text NOT NULL,
  summary text,
  started_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  acknowledged_by uuid REFERENCES profiles(id),
  resolved_by uuid REFERENCES profiles(id),
  failure_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uamp_incidents_title_length CHECK (char_length(title) BETWEEN 1 AND 200)
);

CREATE INDEX IF NOT EXISTS uamp_incidents_org_status_idx ON uamp_incidents (org_id, status);
CREATE INDEX IF NOT EXISTS uamp_incidents_monitor_started_idx ON uamp_incidents (monitor_id, started_at DESC);

ALTER TABLE uamp_incidents ENABLE ROW LEVEL SECURITY;

-- Status pages
CREATE TABLE IF NOT EXISTS uamp_status_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  name text NOT NULL,
  slug text NOT NULL,
  visibility uamp_status_page_visibility NOT NULL DEFAULT 'public',
  custom_domain text,
  monitor_ids uuid[] NOT NULL DEFAULT '{}',
  headline text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uamp_status_pages_name_length CHECK (char_length(name) BETWEEN 1 AND 120),
  CONSTRAINT uamp_status_pages_slug_format CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$')
);

CREATE UNIQUE INDEX IF NOT EXISTS uamp_status_pages_org_slug_idx ON uamp_status_pages (org_id, slug);
CREATE INDEX IF NOT EXISTS uamp_status_pages_org_idx ON uamp_status_pages (org_id);

ALTER TABLE uamp_status_pages ENABLE ROW LEVEL SECURITY;

-- Alert rules
CREATE TABLE IF NOT EXISTS uamp_alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  monitor_id uuid REFERENCES uamp_monitors(id) ON DELETE CASCADE,
  channel uamp_alert_channel NOT NULL,
  destination text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  failure_threshold smallint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uamp_alert_rules_threshold_positive CHECK (failure_threshold >= 1 AND failure_threshold <= 20),
  CONSTRAINT uamp_alert_rules_destination_length CHECK (char_length(destination) BETWEEN 1 AND 2048)
);

CREATE INDEX IF NOT EXISTS uamp_alert_rules_org_monitor_idx ON uamp_alert_rules (org_id, monitor_id);

ALTER TABLE uamp_alert_rules ENABLE ROW LEVEL SECURITY;

-- AI investigations
CREATE TABLE IF NOT EXISTS uamp_ai_investigations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  incident_id uuid NOT NULL REFERENCES uamp_incidents(id) ON DELETE CASCADE,
  status uamp_ai_investigation_status NOT NULL DEFAULT 'queued',
  model text,
  report text,
  findings jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS uamp_ai_investigations_incident_idx ON uamp_ai_investigations (incident_id);
CREATE INDEX IF NOT EXISTS uamp_ai_investigations_org_status_idx ON uamp_ai_investigations (org_id, status);

ALTER TABLE uamp_ai_investigations ENABLE ROW LEVEL SECURITY;

-- API keys
CREATE TABLE IF NOT EXISTS uamp_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id),
  created_by uuid REFERENCES profiles(id),
  name text NOT NULL,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  last_used_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uamp_api_keys_name_length CHECK (char_length(name) BETWEEN 1 AND 80)
);

CREATE UNIQUE INDEX IF NOT EXISTS uamp_api_keys_key_hash_idx ON uamp_api_keys (key_hash);
CREATE INDEX IF NOT EXISTS uamp_api_keys_org_idx ON uamp_api_keys (org_id);

ALTER TABLE uamp_api_keys ENABLE ROW LEVEL SECURITY;

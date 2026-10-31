-- Task 90: the in-app notification inbox, delivery receipts, and the released
-- report PDF key.
--
-- All three are additive: no existing column changes type and no existing row
-- is rewritten, so the migration is safe to run against a live database.

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  event notification_event NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_title_length CHECK (char_length(title) <= 140),
  CONSTRAINT notifications_body_length CHECK (char_length(body) <= 600)
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON notifications (user_id, created_at DESC);

-- The unread badge query; a partial index keeps it small.
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notifications (user_id)
  WHERE read_at IS NULL;

-- One row per delivery attempt per channel. Append-only by convention: the
-- notify worker only ever INSERTs here, and nothing UPDATEs or DELETEs it.
CREATE TABLE IF NOT EXISTS notification_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel notification_channel NOT NULL,
  destination text NOT NULL,
  template text,
  status text NOT NULL,
  provider_message_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_receipts_status_known CHECK (status IN ('sent', 'failed', 'skipped')),
  CONSTRAINT notification_receipts_error_length CHECK (char_length(error) <= 300)
);

CREATE INDEX IF NOT EXISTS notification_receipts_created_idx
  ON notification_receipts (created_at DESC);

CREATE INDEX IF NOT EXISTS notification_receipts_channel_status_idx
  ON notification_receipts (channel, status);

-- Released scan report PDF, rendered by the notify worker's `pdf` consumer.
ALTER TABLE scan_jobs ADD COLUMN IF NOT EXISTS report_object_key text;

-- RLS with no permissive policies: like every other table here, access is
-- exclusively through the API's server-side role.
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_receipts ENABLE ROW LEVEL SECURITY;

-- Admin approval attribution and stable editorial ordering for content.
-- Approval and publication are separate workflow events.

ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

CREATE INDEX IF NOT EXISTS content_items_approved_at_idx
  ON content_items (approved_at DESC NULLS LAST);

COMMENT ON COLUMN content_items.approved_by IS
  'Profile that approved this content item; null until an administrator approves it.';
COMMENT ON COLUMN content_items.approved_at IS
  'Timestamp of the approval decision; publication remains tracked separately by published_at.';

-- Hybrid content bodies: optional R2 object key for full markdown.
-- body_md stays as cache/fallback; writers dual-write until cutover.

ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS body_r2_key text;

COMMENT ON COLUMN content_items.body_r2_key IS
  'R2 object key for the full markdown body (e.g. content/bodies/{id}.md). Null = body only in body_md.';

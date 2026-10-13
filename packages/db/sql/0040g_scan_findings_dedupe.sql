-- Task 40g: the scan controller reports findings in batches and may retry a
-- batch after a network blip. The dedupe key is the job plus the hash of the
-- (title, cwe) pair, so a re-sent finding is a no-op instead of a duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS scan_findings_dedupe ON scan_findings (job_id, md5(title || coalesce(cwe,'')));

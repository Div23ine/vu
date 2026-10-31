import { getTableConfig } from 'drizzle-orm/pg-core';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { auditCheckpoints, auditEntries, AUDIT_EVENT_TYPES } from './audit.js';
import { broadcastJobs, contactMessages, contentItems, contentReviews } from './content.js';

const sqlDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'sql');
const chainSql = readFileSync(join(sqlDir, '0018_audit_chain.sql'), 'utf8');

function columnNames(table: Parameters<typeof getTableConfig>[0]): string[] {
  return getTableConfig(table).columns.map((column) => column.name);
}

const TABLES = [
  ['content_items', contentItems],
  ['content_reviews', contentReviews],
  ['contact_messages', contactMessages],
  ['broadcast_jobs', broadcastJobs],
  ['audit_entries', auditEntries],
  ['audit_checkpoints', auditCheckpoints],
] as const;

describe('content and audit tables', () => {
  it.each(TABLES)('%s exists with RLS enabled and no permissive policy', (_name, table) => {
    const config = getTableConfig(table);
    expect(config.name).toBe(_name);
    expect(config.enableRLS).toBe(true);
    expect(config.policies).toHaveLength(0);
  });
});

describe('content_items', () => {
  it('carries the moderation state machine and risk flags', () => {
    expect(columnNames(contentItems)).toEqual([
      'id',
      'type',
      'title',
      'summary',
      'body_md',
      'slug_path',
      'author_id',
      'author_team',
      'status',
      'category',
      'tags',
      'featured_image_key',
      'featured_image_url',
      'image_alt',
      'read_minutes',
      'excerpt',
      'risk_flags',
      'cve_id',
      // Task 40b: the blog's priority sort and severity chip.
      'severity',
      'submitted_at',
      'published_at',
      'scheduled_for',
      'created_at',
      'updated_at',
    ]);
    const config = getTableConfig(contentItems);
    expect(config.columns.find((column) => column.name === 'slug_path')?.isUnique).toBe(true);
    expect(config.indexes.map((idx) => idx.config.name)).toEqual([
      'content_items_status_idx',
      'content_items_type_idx',
      'content_items_submitted_at_idx',
      'content_items_category_idx',
      'content_items_type_severity_published_idx',
    ]);
  });

  it('keeps the review history append-only', () => {
    expect(columnNames(contentReviews)).toEqual([
      'id',
      'item_id',
      'reviewer_id',
      'action',
      'note',
      'created_at',
    ]);
    expect(columnNames(contentReviews)).not.toContain('updated_at');
    expect(chainSql).toContain('vv_content_reviews_append_only');
  });
});

describe('contact_messages', () => {
  it('requires consent and hashes the source address', () => {
    expect(columnNames(contactMessages)).toEqual([
      'id',
      'name',
      'email',
      'organization',
      'category',
      'subject',
      'message',
      'consent',
      'status',
      'assigned_to',
      'ip_hash',
      'created_at',
      'updated_at',
    ]);
    expect(columnNames(contactMessages)).not.toContain('ip');
    const checks = getTableConfig(contactMessages).checks.map((c) => c.name);
    expect(checks).toContain('contact_messages_consent_required');
  });
});

describe('broadcast_jobs', () => {
  it('bounds the advisory severity to 1..3', () => {
    expect(columnNames(broadcastJobs)).toEqual([
      'id',
      'content_item_id',
      'severity_level',
      'status',
      'audience_count',
      'sent_count',
      'failed_count',
      'started_at',
      'finished_at',
      'created_by',
      'created_at',
    ]);
    expect(getTableConfig(broadcastJobs).checks.map((c) => c.name)).toContain(
      'broadcast_jobs_severity_range',
    );
  });
});

describe('audit_entries', () => {
  it('has the hash-chain columns', () => {
    for (const required of ['seq', 'prev_hash', 'hash', 'signature', 'key_id']) {
      expect(columnNames(auditEntries), `missing ${required}`).toContain(required);
    }
    expect(columnNames(auditEntries)).toEqual([
      'seq',
      'id',
      'category',
      'event_type',
      'severity',
      'sev_level',
      'actor_id',
      'actor_label',
      'ip',
      'subject',
      'message',
      'details',
      'sealed_details',
      'nonce',
      'prev_hash',
      'hash',
      'signature',
      'key_id',
      'created_at',
    ]);
  });

  it('makes seq the primary key and hash unique', () => {
    const config = getTableConfig(auditEntries);
    // A single-column primary key lives on the column, not in `primaryKeys`.
    expect(config.columns.find((column) => column.name === 'seq')?.primary).toBe(true);
    expect(config.primaryKeys).toHaveLength(0);
    expect(config.columns.find((column) => column.name === 'hash')?.isUnique).toBe(true);
    expect(config.columns.find((column) => column.name === 'id')?.isUnique).toBe(true);
  });

  it('stores no updated_at and indexes the read paths', () => {
    expect(columnNames(auditEntries)).not.toContain('updated_at');
    expect(getTableConfig(auditEntries).indexes.map((idx) => idx.config.name)).toEqual([
      'audit_entries_created_at_idx',
      'audit_entries_category_created_idx',
      'audit_entries_severity_created_idx',
      'audit_entries_actor_created_idx',
      'audit_entries_event_type_idx',
    ]);
  });

  it('seals sensitive details instead of storing them in the clear', () => {
    const config = getTableConfig(auditEntries);
    const sealed = config.columns.find((column) => column.name === 'sealed_details');
    const nonce = config.columns.find((column) => column.name === 'nonce');
    expect(sealed?.getSQLType()).toBe('bytea');
    expect(nonce?.getSQLType()).toBe('bytea');
  });

  it('publishes the event-type vocabulary used by the API', () => {
    expect(AUDIT_EVENT_TYPES).toContain('AUTH_SUCCESS');
    expect(AUDIT_EVENT_TYPES).toContain('REPORT_RELEASED');
    expect(AUDIT_EVENT_TYPES).toContain('KEY_ROTATION');
    expect(AUDIT_EVENT_TYPES).toContain('CHAIN_VERIFIED');
  });
});

describe('audit_checkpoints', () => {
  it('records a verification window and the head hash', () => {
    expect(columnNames(auditCheckpoints)).toEqual([
      'id',
      'verified_at',
      'from_seq',
      'to_seq',
      'entries',
      'mismatches',
      'head_hash',
      'verified_by',
    ]);
    expect(columnNames(auditCheckpoints)).not.toContain('updated_at');
  });
});

describe('0018_audit_chain.sql', () => {
  it('refuses UPDATE, DELETE and TRUNCATE on both audit tables', () => {
    expect(chainSql).toContain('BEFORE UPDATE OR DELETE ON audit_entries');
    expect(chainSql).toContain('BEFORE TRUNCATE ON audit_entries');
    expect(chainSql).toContain('BEFORE UPDATE OR DELETE ON audit_checkpoints');
    expect(chainSql).toContain('BEFORE TRUNCATE ON audit_checkpoints');
    expect(chainSql).toContain("RAISE EXCEPTION 'audit records are append-only'");
  });

  it('links each insert to the head hash under an advisory lock', () => {
    expect(chainSql).toContain('pg_advisory_xact_lock(7340481)');
    expect(chainSql).toContain('BEFORE INSERT ON audit_entries');
    expect(chainSql).toContain('ORDER BY seq DESC');
    expect(chainSql).toContain('NEW.prev_hash <> v_head_hash');
    expect(chainSql).toContain("repeat('0', 64)");
  });

  it('seeds the genesis row once, from the fixed genesis string', () => {
    expect(chainSql).toContain('WHERE NOT EXISTS (SELECT 1 FROM audit_entries)');
    expect(chainSql).toContain("'CHAIN_GENESIS'");
    expect(chainSql).toContain("'Genesis block'");
    expect(chainSql).toContain("encode(digest('VUNVAULT-GENESIS-2024-03-01', 'sha256'), 'hex')");
    expect(chainSql).toContain("'genesis'");
    expect(chainSql).toContain("'2024-03-01T00:00:00Z'::timestamptz");
  });

  it('documents the retention rule', () => {
    expect(chainSql).toContain(
      '-- Retention: 7 years, WORM. Never UPDATE/DELETE. Corrections are new entries.',
    );
  });
});

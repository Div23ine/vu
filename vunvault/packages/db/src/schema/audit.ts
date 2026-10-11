import { sql } from 'drizzle-orm';
import {
  bigint,
  char,
  check,
  index,
  inet,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { bytea, createdAtCol, idCol, tz } from './_columns';
import { auditCategoryEnum, auditSeverityEnum } from './_enums';
import { profiles } from './identity';

/**
 * The append-only, hash-chained audit log.
 *
 * Chain shape: each row stores `prev_hash` (the previous row's `hash`) and its own
 * `hash`, plus an HMAC-SHA256 `signature` over that hash, keyed by `key_id`.
 * Tampering with any row breaks the chain from that point forward.
 *
 * Hashing is done by the API (Layer L3), never in the database:
 *   hash = sha256_hex(
 *     prev_hash || canonical_json({ category, event_type, severity, actor_label,
 *                                   subject, message, details, created_at })
 *   )
 *
 * The database enforces three things (see `sql/0018_audit_chain.sql`):
 *   1. no UPDATE, DELETE or TRUNCATE — audit records are append-only;
 *   2. an insert must reference the current head hash (or the zero hash when the
 *      table is empty), under an advisory transaction lock so the chain cannot fork;
 *   3. a genesis row exists exactly once.
 *
 * Retention: 7 years, WORM. Corrections are new entries.
 */

/** `event_type` values emitted by the platform. */
export const AUDIT_EVENT_TYPES = [
  'AUTH_SUCCESS',
  'AUTH_FAILURE',
  'AUTH_MFA_FAILURE',
  'AUTH_RATE_LIMIT',
  'SCAN_COMPLETE',
  'REPORT_RELEASED',
  'USER_PROVISIONED',
  'PERMISSION_CHANGED',
  'ACCOUNT_SUSPENDED',
  'ADVISORY_BROADCAST',
  'KEY_ROTATION',
  'CHAIN_VERIFIED',
  'CHAIN_GENESIS',
  'LOG_BACKUP',
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

/** 64 lowercase hex characters — the width of a SHA-256 digest. */
const HEX_64 = 64;

export const auditEntries = pgTable(
  'audit_entries',
  {
    /** Chain height. Genesis is `seq = 1`. */
    seq: bigint('seq', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    id: uuid('id').notNull().unique().defaultRandom(),
    category: auditCategoryEnum('category').notNull(),
    /** e.g. `AUTH_SUCCESS`, `SCAN_COMPLETE`, `REPORT_RELEASED`. */
    eventType: text('event_type').notNull(),
    severity: auditSeverityEnum('severity').notNull(),
    /** Renders as `SEV-1` … `SEV-3`. */
    sevLevel: smallint('sev_level'),
    actorId: uuid('actor_id').references(() => profiles.id),
    /** e.g. `e.reed`, `system`, `external`. */
    actorLabel: text('actor_label').notNull(),
    ip: inet('ip'),
    /** Target of the action, e.g. a user email or a job code. */
    subject: text('subject'),
    message: text('message').notNull(),
    /** Non-secret structured data. */
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
    /** AES-256-GCM ciphertext + tag for sensitive fields. */
    sealedDetails: bytea('sealed_details'),
    /** 12-byte AES-GCM nonce. */
    nonce: bytea('nonce'),
    prevHash: char('prev_hash', { length: HEX_64 }).notNull(),
    hash: char('hash', { length: HEX_64 }).notNull().unique(),
    /** Hex HMAC-SHA256 over `hash`. */
    signature: char('signature', { length: HEX_64 }).notNull(),
    /** Identifies the HMAC/AES key version; rotated by `KEY_ROTATION`. */
    keyId: text('key_id').notNull(),
    createdAt: createdAtCol(),
  },
  (table) => [
    index('audit_entries_created_at_idx').on(sql`${table.createdAt} DESC`),
    index('audit_entries_category_created_idx').on(table.category, sql`${table.createdAt} DESC`),
    index('audit_entries_severity_created_idx').on(table.severity, sql`${table.createdAt} DESC`),
    index('audit_entries_actor_created_idx').on(table.actorId, sql`${table.createdAt} DESC`),
    index('audit_entries_event_type_idx').on(table.eventType),
    check(
      'audit_entries_sev_level_range',
      sql`${table.sevLevel} IS NULL OR ${table.sevLevel} BETWEEN 1 AND 3`,
    ),
  ],
).enableRLS();

/** Verification runs recorded by the maintenance worker. Also append-only. */
export const auditCheckpoints = pgTable('audit_checkpoints', {
  id: idCol(),
  verifiedAt: tz('verified_at').notNull().defaultNow(),
  fromSeq: bigint('from_seq', { mode: 'number' }).notNull(),
  toSeq: bigint('to_seq', { mode: 'number' }).notNull(),
  entries: bigint('entries', { mode: 'number' }).notNull(),
  mismatches: integer('mismatches').notNull().default(0),
  headHash: char('head_hash', { length: HEX_64 }).notNull(),
  /** `system` or a user label. */
  verifiedBy: text('verified_by').notNull(),
}).enableRLS();

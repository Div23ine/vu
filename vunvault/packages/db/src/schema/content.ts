import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, pgTable, smallint, text, uuid } from 'drizzle-orm/pg-core';
import { citext, createdAtCol, idCol, timestamps, tz } from './_columns';
import {
  blogCategoryEnum,
  broadcastStatusEnum,
  findingSeverityEnum,
  contactCategoryEnum,
  contactStatusEnum,
  contentReviewActionEnum,
  contentStatusEnum,
  contentTypeEnum,
  riskFlagEnum,
  teamEnum,
} from './_enums';
import { profiles } from './identity';

/**
 * Editorial moderation, public contact messages and advisory broadcasts.
 *
 * `content_reviews` is append-only (enforced by `sql/0018_audit_chain.sql`): a
 * moderation decision is never edited, a new review row supersedes it.
 */

export const contentItems = pgTable(
  'content_items',
  {
    id: idCol(),
    type: contentTypeEnum('type').notNull(),
    title: text('title').notNull(),
    summary: text('summary'),
    bodyMd: text('body_md'),
    /**
     * e.g. `/blog/kenya-state-house-cyber-audit`, `/advisories/cve-2026-21447`,
     * `/products/sentinel`, `/news/accra-soc-hub`.
     */
    slugPath: text('slug_path').notNull().unique(),
    authorId: uuid('author_id')
      .notNull()
      .references(() => profiles.id),
    authorTeam: teamEnum('author_team'),
    status: contentStatusEnum('status').notNull().default('draft'),

    // --- Task 20c: Content Studio (blog posts) ------------------------------
    category: blogCategoryEnum('category'),
    /** Max eight, enforced here and by the API. */
    tags: text('tags')
      .array()
      .notNull()
      .default(sql`'{}'`),
    featuredImageKey: text('featured_image_key'),
    featuredImageUrl: text('featured_image_url'),
    imageAlt: text('image_alt'),
    readMinutes: smallint('read_minutes'),
    /** Blog posts use `excerpt`; `summary` stays for the other content types. */
    excerpt: text('excerpt'),
    riskFlags: riskFlagEnum('risk_flags')
      .array()
      .notNull()
      .default(sql`'{}'`),
    /** Advisories only, e.g. `CVE-2026-21447`. */
    cveId: text('cve_id'),
    /**
     * Task 40b: the blog's "Highest Priority" ordering and the CRITICAL/HIGH chip on
     * a post. Null for content that is not severity-bearing.
     */
    severity: findingSeverityEnum('severity'),
    submittedAt: tz('submitted_at'),
    publishedAt: tz('published_at'),
    scheduledFor: tz('scheduled_for'),
    ...timestamps,
  },
  (table) => [
    index('content_items_status_idx').on(table.status),
    index('content_items_type_idx').on(table.type),
    index('content_items_submitted_at_idx').on(sql`${table.submittedAt} DESC`),
    index('content_items_category_idx').on(table.category),
    // The public feed's `sort=priority`: type, then severity, then newest.
    index('content_items_type_severity_published_idx').on(
      table.type,
      table.severity,
      sql`${table.publishedAt} DESC`,
    ),
    check('content_items_tags_max', sql`cardinality(${table.tags}) <= 8`),
    check(
      'content_items_excerpt_length',
      sql`${table.excerpt} IS NULL OR char_length(${table.excerpt}) <= 240`,
    ),
  ],
).enableRLS();

/** Append-only moderation history. */
export const contentReviews = pgTable('content_reviews', {
  id: idCol(),
  itemId: uuid('item_id')
    .notNull()
    .references(() => contentItems.id, { onDelete: 'cascade' }),
  reviewerId: uuid('reviewer_id')
    .notNull()
    .references(() => profiles.id),
  action: contentReviewActionEnum('action').notNull(),
  note: text('note'),
  createdAt: createdAtCol(),
}).enableRLS();

export const contactMessages = pgTable(
  'contact_messages',
  {
    id: idCol(),
    name: text('name').notNull(),
    email: citext('email').notNull(),
    organization: text('organization'),
    category: contactCategoryEnum('category').notNull(),
    subject: text('subject').notNull(),
    message: text('message').notNull(),
    /** Consent is mandatory — the API rejects `false`, the database refuses it too. */
    consent: boolean('consent').notNull(),
    status: contactStatusEnum('status').notNull().default('new'),
    assignedTo: uuid('assigned_to').references(() => profiles.id),
    /** Hashed source address; the raw IP is never stored here. */
    ipHash: text('ip_hash'),
    ...timestamps,
  },
  (table) => [
    index('contact_messages_status_created_idx').on(table.status, sql`${table.createdAt} DESC`),
    check('contact_messages_consent_required', sql`${table.consent} = true`),
  ],
).enableRLS();

export const broadcastJobs = pgTable(
  'broadcast_jobs',
  {
    id: idCol(),
    contentItemId: uuid('content_item_id')
      .notNull()
      .references(() => contentItems.id),
    /** 1 = critical advisory, 3 = routine bulletin. */
    severityLevel: smallint('severity_level').notNull(),
    status: broadcastStatusEnum('status').notNull().default('queued'),
    audienceCount: integer('audience_count').notNull().default(0),
    sentCount: integer('sent_count').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),
    startedAt: tz('started_at'),
    finishedAt: tz('finished_at'),
    createdBy: uuid('created_by').references(() => profiles.id),
    createdAt: createdAtCol(),
  },
  (table) => [
    check('broadcast_jobs_severity_range', sql`${table.severityLevel} BETWEEN 1 AND 3`),
    index('broadcast_jobs_status_idx').on(table.status),
  ],
).enableRLS();

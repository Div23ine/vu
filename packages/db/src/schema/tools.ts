import { integer, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { citext, idCol, timestamps } from './_columns';

/**
 * Open tooling + waitlist.
 *
 * `open_tools` backs the Products page's open-tooling grid: the rows are the
 * source of truth (the page fetches them through the API), and `file_url` is
 * nullable on purpose — a tool is listed the moment it is announced, and the
 * download appears when the artifact is published. Tools without an artifact
 * offer a waitlist signup instead.
 *
 * `waitlist_entries` records those signups and the "this page is coming soon"
 * ones from the landing page banner. One row per address per topic; the empty
 * topic is the general site waitlist. No IP column: an email address is
 * already personal data, and the rate limit on the public endpoint is the
 * abuse control.
 */

export const openTools = pgTable(
  'open_tools',
  {
    /** Stable slug used in URLs and waitlist topics, e.g. `cve-tracker`. */
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    summary: text('summary').notNull(),
    tags: text('tags').array().notNull().default([]),
    /** Human label such as `2.4 MB · .zip`; null until the artifact exists. */
    sizeLabel: text('size_label'),
    /** Public download URL; null while the tool has no published artifact. */
    fileUrl: text('file_url'),
    /** Icon key resolved by the web UI (terminal, shield, …). */
    icon: text('icon').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (table) => [uniqueIndex('open_tools_sort_order_idx').on(table.sortOrder, table.id)],
).enableRLS();

export const waitlistEntries = pgTable(
  'waitlist_entries',
  {
    id: idCol(),
    email: citext('email').notNull(),
    /** Empty string = general site waitlist; otherwise an open-tool id. */
    topic: text('topic').notNull().default(''),
    ...timestamps,
  },
  (table) => [uniqueIndex('waitlist_entries_email_topic_idx').on(table.email, table.topic)],
).enableRLS();

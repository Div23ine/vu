import { sql } from 'drizzle-orm';
import {
  boolean,
  char,
  check,
  date,
  index,
  inet,
  jsonb,
  pgTable,
  primaryKey,
  text,
  time,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAtCol, idCol, timestamps, tz } from './_columns';
import {
  careerRoleEnum,
  entityTypeEnum,
  mfaMethodEnum,
  notificationChannelEnum,
  notificationEventEnum,
  recoveryQuestionEnum,
} from './_enums';
import { profiles } from './identity';

/**
 * Account security, device sessions, notification preferences and client
 * onboarding.
 *
 * Secret handling — nothing in this file stores a plaintext secret:
 *   - Passwords and TOTP secrets belong to Supabase Auth and never reach us.
 *   - Recovery codes are high-entropy random strings, stored as SHA-256 hex
 *     (`code_hash`); the `XXXX-XXXX-XXXX` form is shown to the user exactly once.
 *   - The onboarding recovery *answer* is low entropy, so it is stored as a
 *     memory-hard hash (`recovery_answer_hash`, scrypt) of the lower-cased,
 *     trimmed answer.
 *   - `login_attempts` stores a SHA-256 of the lower-cased email, never the
 *     address itself.
 */

/** The declarations a client must make to finish onboarding. */
export interface OnboardingDeclarations {
  infoAccurate: boolean;
  authorisedTesting: boolean;
  termsAccepted: boolean;
}

/** Languages the product ships in. */
export const SUPPORTED_LANGUAGES = ['en-GB', 'en-US', 'sw', 'fr'] as const;

/**
 * One row per recovery code. A batch is the 10 codes issued together, so a
 * re-issue can revoke a whole set by `batch_id`.
 */
export const userRecoveryCodes = pgTable(
  'user_recovery_codes',
  {
    id: idCol(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    batchId: uuid('batch_id').notNull(),
    /** SHA-256 hex of the normalised code. Never the plaintext. */
    codeHash: text('code_hash').notNull(),
    usedAt: tz('used_at'),
    createdAt: createdAtCol(),
  },
  (table) => [
    index('user_recovery_codes_user_batch_idx').on(table.userId, table.batchId),
    uniqueIndex('user_recovery_codes_user_code_idx').on(table.userId, table.codeHash),
  ],
).enableRLS();

/**
 * Device sessions. `id` is the Supabase Auth session id, so revoking a row here
 * and revoking the auth session are the same act.
 */
export const userSessions = pgTable(
  'user_sessions',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    /** e.g. `MacBook Pro · Safari`. */
    deviceLabel: text('device_label').notNull(),
    userAgent: text('user_agent'),
    ip: inet('ip'),
    geoCity: text('geo_city'),
    geoCountry: char('geo_country', { length: 2 }),
    mfaMethod: mfaMethodEnum('mfa_method'),
    startedAt: tz('started_at').notNull().defaultNow(),
    lastSeenAt: tz('last_seen_at').notNull().defaultNow(),
    revokedAt: tz('revoked_at'),
  },
  (table) => [index('user_sessions_user_revoked_idx').on(table.userId, table.revokedAt)],
).enableRLS();

/**
 * Per-event channel opt-ins. A missing row means the planner's defaults:
 * `in_app true, email true, sms false, push false` for every event — the API
 * applies them on read and "Reset to Defaults" writes them back.
 */
export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    event: notificationEventEnum('event').notNull(),
    inApp: boolean('in_app').notNull(),
    email: boolean('email').notNull(),
    sms: boolean('sms').notNull(),
    push: boolean('push').notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.event] })],
).enableRLS();

/**
 * Quiet hours.
 *
 * Rule: credential changes, SEV-1 broadcasts, review-gate escalations and
 * incident-commander pages IGNORE quiet hours and channel opt-outs. They are
 * delivered in-app and by email regardless of what is stored here.
 */
export const notificationSettings = pgTable('notification_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  quietHoursEnabled: boolean('quiet_hours_enabled').notNull().default(false),
  quietFrom: time('quiet_from'),
  quietTo: time('quiet_to'),
}).enableRLS();

/** Client onboarding (the 3-step wizard). One row per profile. */
export const onboardingProfiles = pgTable(
  'onboarding_profiles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    /** The API also refuses a date of birth under 16 at write time. */
    dateOfBirth: date('date_of_birth'),
    career: careerRoleEnum('career'),
    entity: entityTypeEnum('entity'),
    recoveryQuestion: recoveryQuestionEnum('recovery_question'),
    /** Memory-hard hash of the lower-cased, trimmed answer. Never plaintext. */
    recoveryAnswerHash: text('recovery_answer_hash'),
    declarations: jsonb('declarations')
      .$type<OnboardingDeclarations>()
      .notNull()
      .default({ infoAccurate: false, authorisedTesting: false, termsAccepted: false }),
    termsVersion: text('terms_version'),
    completedAt: tz('completed_at'),
    ...timestamps,
  },
  (table) => [
    check(
      'onboarding_profiles_min_age',
      sql`${table.dateOfBirth} IS NULL OR ${table.dateOfBirth} <= current_date - interval '16 years'`,
    ),
  ],
).enableRLS();

/**
 * Backs the 5-failure lockout. Stores a SHA-256 of the lower-cased email — never
 * the address. Rows older than 30 days are purged by the maintenance worker.
 */
export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: idCol(),
    emailHash: text('email_hash').notNull(),
    ip: inet('ip').notNull(),
    succeeded: boolean('succeeded').notNull(),
    /** e.g. `invalid_credentials`, `mfa_failed`, `rate_limited`. */
    reason: text('reason'),
    createdAt: createdAtCol(),
  },
  (table) => [
    index('login_attempts_email_created_idx').on(table.emailHash, sql`${table.createdAt} DESC`),
    index('login_attempts_ip_created_idx').on(table.ip, sql`${table.createdAt} DESC`),
  ],
).enableRLS();

/**
 * The in-app notification inbox (Task 90).
 *
 * One row per delivered `in_app` notification — written ONLY by the notify
 * worker, read by the portal/API. Append-mostly: the single permitted mutation
 * is `read_at` (marking read). There is no delete: an inbox that silently loses
 * security notifications is worse than one that grows.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: idCol(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    event: notificationEventEnum('event').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    readAt: tz('read_at'),
    createdAt: createdAtCol(),
  },
  (table) => [
    index('notifications_user_created_idx').on(table.userId, sql`${table.createdAt} DESC`),
    index('notifications_user_unread_idx')
      .on(table.userId)
      .where(sql`${table.readAt} IS NULL`),
    check('notifications_title_length', sql`char_length(${table.title}) <= 140`),
    check('notifications_body_length', sql`char_length(${table.body}) <= 600`),
  ],
).enableRLS();

/**
 * Delivery receipts (Task 90). One row per delivery ATTEMPT per channel —
 * a retried e-mail produces one receipt per attempt, which is exactly what an
 * operator debugging "the client says they never got it" needs.
 *
 * Append-only by convention: nothing in the codebase UPDATEs or DELETEs this
 * table. `destination` holds the e-mail address / E.164 number / user id the
 * attempt targeted; provider errors are truncated to 300 characters so a
 * provider stack trace can never bloat the row.
 */
export const notificationReceipts = pgTable(
  'notification_receipts',
  {
    id: idCol(),
    channel: notificationChannelEnum('channel').notNull(),
    destination: text('destination').notNull(),
    /** E-mail template name; null for `in_app`/`sms`, which carry no template. */
    template: text('template'),
    /** `sent` | `failed` | `skipped` (push, which has no provider yet). */
    status: text('status').notNull(),
    providerMessageId: text('provider_message_id'),
    error: text('error'),
    createdAt: createdAtCol(),
  },
  (table) => [
    index('notification_receipts_created_idx').on(sql`${table.createdAt} DESC`),
    index('notification_receipts_channel_status_idx').on(table.channel, table.status),
    check(
      'notification_receipts_status_known',
      sql`${table.status} IN ('sent', 'failed', 'skipped')`,
    ),
    check('notification_receipts_error_length', sql`char_length(${table.error}) <= 300`),
  ],
).enableRLS();

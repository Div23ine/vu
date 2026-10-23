import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { authUsers } from 'drizzle-orm/supabase';
import { bytea, citext, createdAtCol, idCol, timestamps, tz } from './_columns';
import {
  accessTierEnum,
  accountStatusEnum,
  accountTypeEnum,
  industryEnum,
  invitationStatusEnum,
  mfaMethodEnum,
  teamEnum,
  userRoleEnum,
} from './_enums';

/**
 * Identity, organisations, staff invitations, WebAuthn credentials and consent.
 *
 * Supabase Auth owns authentication: credentials, email verification and the
 * `auth.users` row all live there. `profiles` is a 1:1 mirror keyed on
 * `authUsers.id` and carries everything the product needs — role, org, team,
 * access tier, scope and MFA state. The Supabase Auth Hook reads `profiles.role`
 * and `profiles.org_id` to mint the JWT claims `role`, `org_id` and `permissions[]`.
 *
 * Every table here enables RLS and defines no permissive policy, so PostgREST
 * roles (`anon`, `authenticated`) see nothing; the API connects with a
 * server-side role.
 */

/** The onboarding checklist captured when an invitation is drafted. */
export interface InvitationChecklist {
  mfaEnrolmentMandatory: boolean;
  ndaOnFile: boolean;
  backgroundVerified: boolean;
  trainingAcknowledged: boolean;
}

/** Cookie-consent payload, stored verbatim as given by the visitor. */
export interface ConsentCategories {
  strictlyNecessary: boolean;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
}

export const organizations = pgTable(
  'organizations',
  {
    id: idCol(),
    name: text('name').notNull(),
    /** Human client code, e.g. `VV-CL-48210`. Shown on invoices and in the portal. */
    clientCode: text('client_code').notNull().unique(),
    primaryDomain: text('primary_domain'),
    industry: industryEnum('industry'),
    country: char('country', { length: 2 }),
    /** Provider customer handles, so an org keeps one card across invoices. */
    stripeCustomerId: text('stripe_customer_id').unique(),
    paystackCustomerCode: text('paystack_customer_code').unique(),
    ...timestamps,
  },
  (table) => [index('organizations_name_lower_idx').on(sql`lower(${table.name})`)],
).enableRLS();

export const profiles = pgTable(
  'profiles',
  {
    /** One row per Supabase auth user — identity itself lives in `auth.users`. */
    id: uuid('id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    /** Clients always have an org; staff may not. */
    orgId: uuid('org_id').references(() => organizations.id),
    /** Lower-cased by the API; `citext` makes the unique index case-proof too. */
    email: citext('email').notNull().unique(),
    fullName: text('full_name').notNull(),
    jobTitle: text('job_title'),
    phone: text('phone'),
    country: char('country', { length: 2 }),
    accountType: accountTypeEnum('account_type'),
    role: userRoleEnum('role').notNull().default('client'),
    accountStatus: accountStatusEnum('account_status').notNull().default('active'),
    team: teamEnum('team'),
    accessTier: accessTierEnum('access_tier').notNull().default('standard'),
    /** e.g. "Nairobi HQ", "Remote — Mombasa". */
    baseLocation: text('base_location'),
    /** e.g. "Full platform · All modules". */
    scopeSummary: text('scope_summary'),
    /** Reviewer-only free text. */
    scopeNotes: text('scope_notes'),
    mfaEnrolled: boolean('mfa_enrolled').notNull().default(false),
    mfaMethods: mfaMethodEnum('mfa_methods')
      .array()
      .notNull()
      .default(sql`'{}'`),
    joinedAt: tz('joined_at').notNull().defaultNow(),
    lastActiveAt: tz('last_active_at'),
    accessReviewDue: date('access_review_due'),
    suspendedAt: tz('suspended_at'),
    suspendedReason: text('suspended_reason'),
    /**
     * Soft delete. Audit entries must keep resolving their actor, so a profile
     * row is never removed — only marked.
     */
    deletedAt: tz('deleted_at'),

    // --- Task 20c: Profile Settings (staff) ---------------------------------
    firstName: text('first_name'),
    lastName: text('last_name'),
    displayName: text('display_name'),
    timezone: text('timezone').notNull().default('Africa/Nairobi'),
    /** One of `en-GB`, `en-US`, `sw`, `fr`. */
    language: text('language').notNull().default('en-GB'),
    bio: text('bio'),
    /** Object-storage key; the file itself lives in R2. */
    avatarKey: text('avatar_key'),
    /** Staff must keep a second factor; a client may be exempted by policy. */
    require2fa: boolean('require_2fa').notNull().default(true),
    lastPasswordChangeAt: tz('last_password_change_at'),
    lastFactorChangeAt: tz('last_factor_change_at'),
    deactivationRequestedAt: tz('deactivation_requested_at'),

    // --- Task 20c: Verified Journalist / Blogger badge ----------------------
    /**
     * Granted manually by an administrator after a Contact-page verification
     * request; never self-service.
     */
    verifiedBloggerAt: tz('verified_blogger_at'),
    verifiedBloggerBy: uuid('verified_blogger_by').references((): AnyPgColumn => profiles.id),
    ...timestamps,
  },
  (table) => [
    index('profiles_role_idx').on(table.role),
    check('profiles_language_supported', sql`${table.language} IN ('en-GB', 'en-US', 'sw', 'fr')`),
    check('profiles_bio_length', sql`${table.bio} IS NULL OR char_length(${table.bio}) <= 400`),
    index('profiles_account_status_idx').on(table.accountStatus),
    index('profiles_org_id_idx').on(table.orgId),
    index('profiles_last_active_at_idx').on(table.lastActiveAt),
  ],
).enableRLS();

export const staffInvitations = pgTable(
  'staff_invitations',
  {
    id: idCol(),
    email: citext('email').notNull(),
    fullName: text('full_name').notNull(),
    jobTitle: text('job_title'),
    baseLocation: text('base_location'),
    /** The API validates that this is a staff role, never `client`. */
    role: userRoleEnum('role').notNull(),
    team: teamEnum('team').notNull(),
    accessTier: accessTierEnum('access_tier').notNull().default('standard'),
    scopeNotes: text('scope_notes'),
    accessReviewDue: date('access_review_due'),
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => profiles.id),
    /** SHA-256 hex of the one-time token. The raw token is never stored. */
    tokenHash: text('token_hash').notNull().unique(),
    status: invitationStatusEnum('status').notNull().default('pending'),
    /** The API sets `now() + 72 hours`. */
    expiresAt: tz('expires_at').notNull(),
    acceptedAt: tz('accepted_at'),
    revokedAt: tz('revoked_at'),
    resendCount: integer('resend_count').notNull().default(0),
    checklist: jsonb('checklist').$type<InvitationChecklist>().notNull().default({
      mfaEnrolmentMandatory: true,
      ndaOnFile: false,
      backgroundVerified: false,
      trainingAcknowledged: false,
    }),
    ...timestamps,
  },
  (table) => [
    index('staff_invitations_status_expires_at_idx').on(table.status, table.expiresAt),
    index('staff_invitations_email_idx').on(table.email),
  ],
).enableRLS();

export const webauthnCredentials = pgTable('webauthn_credentials', {
  id: idCol(),
  userId: uuid('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  credentialId: text('credential_id').notNull().unique(),
  publicKey: bytea('public_key').notNull(),
  counter: bigint('counter', { mode: 'number' }).notNull().default(0),
  transports: text('transports')
    .array()
    .notNull()
    .default(sql`'{}'`),
  deviceName: text('device_name'),
  createdAt: createdAtCol(),
  lastUsedAt: tz('last_used_at'),
}).enableRLS();

export const consentRecords = pgTable(
  'consent_records',
  {
    id: idCol(),
    /** Append-only by convention: consent is never updated, only re-recorded. */
    userId: uuid('user_id').references(() => profiles.id, { onDelete: 'set null' }),
    /** Set for a visitor who has not signed in. */
    anonymousId: uuid('anonymous_id'),
    categories: jsonb('categories').$type<ConsentCategories>().notNull(),
    policyVersion: text('policy_version').notNull(),
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
    createdAt: createdAtCol(),
  },
  (table) => [
    check(
      'consent_records_actor_check',
      sql`(${table.userId} is not null or ${table.anonymousId} is not null)`,
    ),
  ],
).enableRLS();

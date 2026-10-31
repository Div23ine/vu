import { pgEnum } from 'drizzle-orm/pg-core';
import {
  ACCESS_TIERS,
  ACCOUNT_STATUSES,
  ACCOUNT_TYPES,
  ADVISORY_PATCH_STATUSES,
  ADVISORY_STATUSES,
  AUDIT_CATEGORIES,
  AUDIT_SEVERITIES,
  BILLING_CYCLES,
  BLOG_CATEGORIES,
  BROADCAST_KINDS,
  BROADCAST_STATUSES,
  CAREER_ROLES,
  CONTACT_CATEGORIES,
  CONTACT_STATUSES,
  CONTENT_REVIEW_ACTIONS,
  CONTENT_STATUSES,
  CONTENT_TYPES,
  DISPLAY_CURRENCIES,
  ENTITY_TYPES,
  FINDING_SEVERITIES,
  FINDING_STATUSES,
  INDUSTRIES,
  INVITATION_STATUSES,
  INVOICE_STATUSES,
  JOURNAL_KINDS,
  LEDGER_ACCOUNT_TYPES,
  LEDGER_DIRECTIONS,
  MFA_METHODS,
  NODE_STATUSES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENTS,
  PAYMENT_ATTEMPT_STATUSES,
  PAYMENT_CHANNELS,
  PAYMENT_PROVIDERS,
  PAYMENT_STATUSES,
  PENTEST_STATUSES,
  PENTEST_TARGET_TYPES,
  RECOVERY_QUESTIONS,
  REVIEW_CHECK_KEYS,
  REVIEW_DECISIONS,
  REVIEW_GATE_STATES,
  RISK_FLAGS,
  SCAN_ENVIRONMENTS,
  SCAN_PRIORITIES,
  SCAN_STATUSES,
  SCAN_TYPES,
  SCOPE_CATEGORIES,
  SUBSCRIPTION_STATUSES,
  TEAMS,
  USER_ROLES,
} from '../enum-values.js';

/**
 * Postgres enums, built from the single source of truth in `../enum-values`.
 * Never add a value here — add it to `enum-values.ts` and generate a migration.
 */

export const userRoleEnum = pgEnum('user_role', USER_ROLES);
export const accountStatusEnum = pgEnum('account_status', ACCOUNT_STATUSES);
export const accessTierEnum = pgEnum('access_tier', ACCESS_TIERS);
export const teamEnum = pgEnum('team', TEAMS);
export const mfaMethodEnum = pgEnum('mfa_method', MFA_METHODS);
export const accountTypeEnum = pgEnum('account_type', ACCOUNT_TYPES);
export const industryEnum = pgEnum('industry', INDUSTRIES);
export const invitationStatusEnum = pgEnum('invitation_status', INVITATION_STATUSES);
export const scanTypeEnum = pgEnum('scan_type', SCAN_TYPES);
export const scanPriorityEnum = pgEnum('scan_priority', SCAN_PRIORITIES);
export const scanEnvironmentEnum = pgEnum('scan_environment', SCAN_ENVIRONMENTS);
export const scanStatusEnum = pgEnum('scan_status', SCAN_STATUSES);
export const reviewGateStateEnum = pgEnum('review_gate_state', REVIEW_GATE_STATES);
export const reviewDecisionEnum = pgEnum('review_decision', REVIEW_DECISIONS);
export const reviewCheckKeyEnum = pgEnum('review_check_key', REVIEW_CHECK_KEYS);
export const findingSeverityEnum = pgEnum('finding_severity', FINDING_SEVERITIES);
export const findingStatusEnum = pgEnum('finding_status', FINDING_STATUSES);
export const pentestTargetTypeEnum = pgEnum('pentest_target_type', PENTEST_TARGET_TYPES);
export const pentestStatusEnum = pgEnum('pentest_status', PENTEST_STATUSES);
export const paymentStatusEnum = pgEnum('payment_status', PAYMENT_STATUSES);
export const invoiceStatusEnum = pgEnum('invoice_status', INVOICE_STATUSES);
export const subscriptionStatusEnum = pgEnum('subscription_status', SUBSCRIPTION_STATUSES);
export const billingCycleEnum = pgEnum('billing_cycle', BILLING_CYCLES);
export const paymentProviderEnum = pgEnum('payment_provider', PAYMENT_PROVIDERS);
export const paymentChannelEnum = pgEnum('payment_channel', PAYMENT_CHANNELS);
export const paymentAttemptStatusEnum = pgEnum('payment_attempt_status', PAYMENT_ATTEMPT_STATUSES);
export const displayCurrencyEnum = pgEnum('display_currency', DISPLAY_CURRENCIES);
export const ledgerDirectionEnum = pgEnum('ledger_direction', LEDGER_DIRECTIONS);
export const ledgerAccountTypeEnum = pgEnum('ledger_account_type', LEDGER_ACCOUNT_TYPES);
export const journalKindEnum = pgEnum('journal_kind', JOURNAL_KINDS);
export const contentTypeEnum = pgEnum('content_type', CONTENT_TYPES);
export const contentStatusEnum = pgEnum('content_status', CONTENT_STATUSES);
export const riskFlagEnum = pgEnum('risk_flag', RISK_FLAGS);
export const contentReviewActionEnum = pgEnum('content_review_action', CONTENT_REVIEW_ACTIONS);
export const contactCategoryEnum = pgEnum('contact_category', CONTACT_CATEGORIES);
export const contactStatusEnum = pgEnum('contact_status', CONTACT_STATUSES);
export const broadcastStatusEnum = pgEnum('broadcast_status', BROADCAST_STATUSES);
export const auditCategoryEnum = pgEnum('audit_category', AUDIT_CATEGORIES);
export const auditSeverityEnum = pgEnum('audit_severity', AUDIT_SEVERITIES);

// --- Task 20b addendum: zero-day desk, sensor fleet, Command Center ---
export const advisoryStatusEnum = pgEnum('advisory_status', ADVISORY_STATUSES);
export const advisoryPatchStatusEnum = pgEnum('advisory_patch_status', ADVISORY_PATCH_STATUSES);
export const scopeCategoryEnum = pgEnum('scope_category', SCOPE_CATEGORIES);
export const broadcastKindEnum = pgEnum('broadcast_kind', BROADCAST_KINDS);
export const nodeStatusEnum = pgEnum('node_status', NODE_STATUSES);

// --- Task 20c addendum: account security, notifications, onboarding ---
export const careerRoleEnum = pgEnum('career_role', CAREER_ROLES);
export const entityTypeEnum = pgEnum('entity_type', ENTITY_TYPES);
export const recoveryQuestionEnum = pgEnum('recovery_question', RECOVERY_QUESTIONS);
export const notificationEventEnum = pgEnum('notification_event', NOTIFICATION_EVENTS);
export const notificationChannelEnum = pgEnum('notification_channel', NOTIFICATION_CHANNELS);
export const blogCategoryEnum = pgEnum('blog_category', BLOG_CATEGORIES);

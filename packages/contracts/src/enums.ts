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
  INVOICE_STATUSES,
  INVITATION_STATUSES,
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
} from '@vunvault/db/enum-values';
import { z } from 'zod';

/**
 * Every wire enum, derived from the database tuples through the pure
 * `@vunvault/db/enum-values` subpath. This package never imports `drizzle-orm`,
 * so these schemas are safe to bundle into the browser.
 *
 * Adding a value means editing `enum-values.ts`, generating a migration, and —
 * only then — the wire schema picks it up automatically.
 */

export const UserRoleSchema = z.enum(USER_ROLES);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const AccountStatusSchema = z.enum(ACCOUNT_STATUSES);
export type AccountStatus = z.infer<typeof AccountStatusSchema>;

export const AccessTierSchema = z.enum(ACCESS_TIERS);
export type AccessTier = z.infer<typeof AccessTierSchema>;

export const TeamSchema = z.enum(TEAMS);
export type Team = z.infer<typeof TeamSchema>;

export const MfaMethodSchema = z.enum(MFA_METHODS);
export type MfaMethod = z.infer<typeof MfaMethodSchema>;

export const AccountTypeSchema = z.enum(ACCOUNT_TYPES);
export type AccountType = z.infer<typeof AccountTypeSchema>;

export const IndustrySchema = z.enum(INDUSTRIES);
export type Industry = z.infer<typeof IndustrySchema>;

export const InvitationStatusSchema = z.enum(INVITATION_STATUSES);
export type InvitationStatus = z.infer<typeof InvitationStatusSchema>;

export const ScanTypeSchema = z.enum(SCAN_TYPES);
export type ScanType = z.infer<typeof ScanTypeSchema>;

export const ScanPrioritySchema = z.enum(SCAN_PRIORITIES);
export type ScanPriority = z.infer<typeof ScanPrioritySchema>;

export const ScanEnvironmentSchema = z.enum(SCAN_ENVIRONMENTS);
export type ScanEnvironment = z.infer<typeof ScanEnvironmentSchema>;

export const ScanStatusSchema = z.enum(SCAN_STATUSES);
export type ScanStatus = z.infer<typeof ScanStatusSchema>;

export const ReviewGateStateSchema = z.enum(REVIEW_GATE_STATES);
export type ReviewGateState = z.infer<typeof ReviewGateStateSchema>;

export const ReviewDecisionSchema = z.enum(REVIEW_DECISIONS);
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;

export const ReviewCheckKeySchema = z.enum(REVIEW_CHECK_KEYS);
export type ReviewCheckKey = z.infer<typeof ReviewCheckKeySchema>;

export const FindingSeveritySchema = z.enum(FINDING_SEVERITIES);
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;

export const FindingStatusSchema = z.enum(FINDING_STATUSES);
export type FindingStatus = z.infer<typeof FindingStatusSchema>;

export const PentestTargetTypeSchema = z.enum(PENTEST_TARGET_TYPES);
export type PentestTargetType = z.infer<typeof PentestTargetTypeSchema>;

export const PentestStatusSchema = z.enum(PENTEST_STATUSES);
export type PentestStatus = z.infer<typeof PentestStatusSchema>;

export const PaymentStatusSchema = z.enum(PAYMENT_STATUSES);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const InvoiceStatusSchema = z.enum(INVOICE_STATUSES);
export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>;

export const SubscriptionStatusSchema = z.enum(SUBSCRIPTION_STATUSES);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

export const BillingCycleSchema = z.enum(BILLING_CYCLES);
export type BillingCycle = z.infer<typeof BillingCycleSchema>;

export const PaymentProviderSchema = z.enum(PAYMENT_PROVIDERS);
export type PaymentProvider = z.infer<typeof PaymentProviderSchema>;

export const PaymentChannelSchema = z.enum(PAYMENT_CHANNELS);
export type PaymentChannel = z.infer<typeof PaymentChannelSchema>;

export const PaymentAttemptStatusSchema = z.enum(PAYMENT_ATTEMPT_STATUSES);
export type PaymentAttemptStatus = z.infer<typeof PaymentAttemptStatusSchema>;

export const DisplayCurrencySchema = z.enum(DISPLAY_CURRENCIES);
export type DisplayCurrency = z.infer<typeof DisplayCurrencySchema>;

export const LedgerDirectionSchema = z.enum(LEDGER_DIRECTIONS);
export type LedgerDirection = z.infer<typeof LedgerDirectionSchema>;

export const LedgerAccountTypeSchema = z.enum(LEDGER_ACCOUNT_TYPES);
export type LedgerAccountType = z.infer<typeof LedgerAccountTypeSchema>;

export const JournalKindSchema = z.enum(JOURNAL_KINDS);
export type JournalKind = z.infer<typeof JournalKindSchema>;

export const ContentTypeSchema = z.enum(CONTENT_TYPES);
export type ContentType = z.infer<typeof ContentTypeSchema>;

export const ContentStatusSchema = z.enum(CONTENT_STATUSES);
export type ContentStatus = z.infer<typeof ContentStatusSchema>;

export const RiskFlagSchema = z.enum(RISK_FLAGS);
export type RiskFlag = z.infer<typeof RiskFlagSchema>;

export const ContentReviewActionSchema = z.enum(CONTENT_REVIEW_ACTIONS);
export type ContentReviewAction = z.infer<typeof ContentReviewActionSchema>;

export const ContactCategorySchema = z.enum(CONTACT_CATEGORIES);
export type ContactCategory = z.infer<typeof ContactCategorySchema>;

export const ContactStatusSchema = z.enum(CONTACT_STATUSES);
export type ContactStatus = z.infer<typeof ContactStatusSchema>;

export const BroadcastStatusSchema = z.enum(BROADCAST_STATUSES);
export type BroadcastStatus = z.infer<typeof BroadcastStatusSchema>;

export const AuditCategorySchema = z.enum(AUDIT_CATEGORIES);
export type AuditCategory = z.infer<typeof AuditCategorySchema>;

export const AuditSeveritySchema = z.enum(AUDIT_SEVERITIES);
export type AuditSeverity = z.infer<typeof AuditSeveritySchema>;

// --- Task 20b/20c addendum: zero-day desk, sensor fleet, account security ---

export const AdvisoryStatusSchema = z.enum(ADVISORY_STATUSES);
export type AdvisoryStatus = z.infer<typeof AdvisoryStatusSchema>;

export const AdvisoryPatchStatusSchema = z.enum(ADVISORY_PATCH_STATUSES);
export type AdvisoryPatchStatus = z.infer<typeof AdvisoryPatchStatusSchema>;

export const ScopeCategorySchema = z.enum(SCOPE_CATEGORIES);
export type ScopeCategory = z.infer<typeof ScopeCategorySchema>;

export const BroadcastKindSchema = z.enum(BROADCAST_KINDS);
export type BroadcastKind = z.infer<typeof BroadcastKindSchema>;

export const NodeStatusSchema = z.enum(NODE_STATUSES);
export type NodeStatus = z.infer<typeof NodeStatusSchema>;

export const CareerRoleSchema = z.enum(CAREER_ROLES);
export type CareerRole = z.infer<typeof CareerRoleSchema>;

export const EntityTypeSchema = z.enum(ENTITY_TYPES);
export type EntityType = z.infer<typeof EntityTypeSchema>;

export const RecoveryQuestionSchema = z.enum(RECOVERY_QUESTIONS);
export type RecoveryQuestion = z.infer<typeof RecoveryQuestionSchema>;

export const NotificationEventSchema = z.enum(NOTIFICATION_EVENTS);
export type NotificationEvent = z.infer<typeof NotificationEventSchema>;

export const NotificationChannelSchema = z.enum(NOTIFICATION_CHANNELS);
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;

export const BlogCategorySchema = z.enum(BLOG_CATEGORIES);
export type BlogCategory = z.infer<typeof BlogCategorySchema>;

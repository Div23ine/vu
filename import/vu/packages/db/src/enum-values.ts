/**
 * Every enum value used anywhere in VUNVAULT, as pure data.
 *
 * This module is deliberately dependency-free: `packages/contracts` imports it
 * through the `@vunvault/db/enum-values` subpath to build Zod enums, and it must
 * never pull `drizzle-orm` (or any runtime) into a browser bundle.
 *
 * `packages/db/src/schema/_enums.ts` builds the Postgres enums from these tuples,
 * so the wire format and the database can never drift apart.
 */

/** Postgres enum `user_role`. */
export const USER_ROLES = [
  'super_admin',
  'admin',
  'security_analyst',
  'soc_operator',
  'compliance_auditor',
  'support_engineer',
  'client',
] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Postgres enum `account_status`. */
export const ACCOUNT_STATUSES = [
  'active',
  'pending_invite',
  /** Task 40d: signup is a verified flow — the mailbox OTP activates the profile. */
  'pending_verification',
  'suspended',
  'dormant',
  /**
   * Phase 2 (magic-link work order): an ADMIN who let the 5:00 first-login MFA
   * setup window expire (or abandoned setup) is parked here until a super admin
   * resets the MFA state. The super admin account itself is exempt and can
   * never land in this status via the timer.
   */
  'blocked_mfa_setup',
] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/** Postgres enum `access_tier`. */
export const ACCESS_TIERS = ['standard', 'elevated', 'restricted'] as const;
export type AccessTier = (typeof ACCESS_TIERS)[number];

/** Postgres enum `team`. */
export const TEAMS = [
  'offensive_security',
  'soc_detection_response',
  'threat_intelligence',
  'security_automation',
  'compliance_audit',
  'client_support',
  'curriculum_product',
  'compliance_comms',
] as const;
export type Team = (typeof TEAMS)[number];

/** Postgres enum `mfa_method`. */
export const MFA_METHODS = ['totp', 'webauthn', 'email_otp'] as const;
export type MfaMethod = (typeof MFA_METHODS)[number];

/** Postgres enum `account_type`. */
export const ACCOUNT_TYPES = ['individual', 'company'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** Postgres enum `industry`. */
export const INDUSTRIES = [
  'financial_services_fintech',
  'sacco_microfinance',
  'banking',
  'insurance',
  'healthcare',
  'telecommunications',
  'government_public_sector',
  'education',
  'retail_ecommerce',
  'technology_saas',
  'other',
] as const;
export type Industry = (typeof INDUSTRIES)[number];

/** Postgres enum `invitation_status`. */
export const INVITATION_STATUSES = ['draft', 'pending', 'accepted', 'revoked', 'expired'] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

/** Postgres enum `scan_type`. */
export const SCAN_TYPES = ['external', 'api', 'internal', 'network', 'mobile'] as const;
export type ScanType = (typeof SCAN_TYPES)[number];

/** Postgres enum `scan_priority`. */
export const SCAN_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
export type ScanPriority = (typeof SCAN_PRIORITIES)[number];

/** Postgres enum `scan_environment`. */
export const SCAN_ENVIRONMENTS = ['production', 'staging'] as const;
export type ScanEnvironment = (typeof SCAN_ENVIRONMENTS)[number];

/** Postgres enum `scan_status`. */
export const SCAN_STATUSES = [
  'queued',
  'running',
  'awaiting_review',
  'completed',
  'held',
  'rejected',
  'cancelled',
] as const;
export type ScanStatus = (typeof SCAN_STATUSES)[number];

/** Postgres enum `review_gate_state`. */
export const REVIEW_GATE_STATES = [
  'not_eligible',
  'in_review',
  'approved_released',
  'held_blocked',
  'blocked_payment',
] as const;
export type ReviewGateState = (typeof REVIEW_GATE_STATES)[number];

/** Postgres enum `review_decision`. */
export const REVIEW_DECISIONS = ['approve_release', 'hold_remediation', 'reject_archive'] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

/** Postgres enum `review_check_key`. */
export const REVIEW_CHECK_KEYS = [
  'scope_authorisation_verified',
  'evidence_sanitised',
  'critical_high_validated',
  'remediation_guidance_attached',
  'client_redaction_approved',
] as const;
export type ReviewCheckKey = (typeof REVIEW_CHECK_KEYS)[number];

/** Postgres enum `finding_severity`. */
export const FINDING_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

/** Postgres enum `finding_status`. */
export const FINDING_STATUSES = ['open', 'validated', 'false_positive', 'remediated'] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

/** Postgres enum `pentest_target_type`. */
export const PENTEST_TARGET_TYPES = [
  'web_application',
  'network_infrastructure',
  'api',
  'mobile_app',
] as const;
export type PentestTargetType = (typeof PENTEST_TARGET_TYPES)[number];

/** Postgres enum `pentest_status`. */
export const PENTEST_STATUSES = [
  'received',
  'scoping',
  'scheduled',
  'converted',
  'declined',
] as const;
export type PentestStatus = (typeof PENTEST_STATUSES)[number];

/** Postgres enum `payment_status`. */
export const PAYMENT_STATUSES = ['paid', 'pending', 'overdue'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Postgres enum `invoice_status`. */
export const INVOICE_STATUSES = ['draft', 'pending', 'paid', 'overdue', 'void'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** Postgres enum `subscription_status`. */
export const SUBSCRIPTION_STATUSES = ['active', 'past_due', 'canceled', 'incomplete'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Postgres enum `billing_cycle`. */
export const BILLING_CYCLES = ['monthly', 'annual'] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

/** Postgres enum `payment_provider`. */
export const PAYMENT_PROVIDERS = ['stripe', 'paystack'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

/** Postgres enum `payment_channel`. */
export const PAYMENT_CHANNELS = ['card', 'mpesa', 'bank_transfer'] as const;
export type PaymentChannel = (typeof PAYMENT_CHANNELS)[number];

/** Postgres enum `payment_attempt_status`. */
export const PAYMENT_ATTEMPT_STATUSES = [
  'created',
  'requires_action',
  'succeeded',
  'failed',
  'canceled',
] as const;
export type PaymentAttemptStatus = (typeof PAYMENT_ATTEMPT_STATUSES)[number];

/** Postgres enum `display_currency`. */
export const DISPLAY_CURRENCIES = ['USD', 'KES', 'NGN', 'GHS', 'ZAR', 'GBP', 'EUR'] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

/** Postgres enum `ledger_direction`. */
export const LEDGER_DIRECTIONS = ['debit', 'credit'] as const;
export type LedgerDirection = (typeof LEDGER_DIRECTIONS)[number];

/** Postgres enum `ledger_account_type`. */
export const LEDGER_ACCOUNT_TYPES = ['asset', 'liability', 'revenue', 'expense', 'equity'] as const;
export type LedgerAccountType = (typeof LEDGER_ACCOUNT_TYPES)[number];

/** Postgres enum `journal_kind`. */
export const JOURNAL_KINDS = [
  'invoice_issued',
  'payment_captured',
  'refund',
  'adjustment',
  'reversal',
] as const;
export type JournalKind = (typeof JOURNAL_KINDS)[number];

/** Postgres enum `content_type`. */
export const CONTENT_TYPES = [
  'blog_post',
  'news_announcement',
  'threat_advisory',
  'product_listing',
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

/** Postgres enum `newsletter_status`. Double opt-in: pending until the link is followed. */
export const NEWSLETTER_STATUSES = ['pending', 'confirmed', 'unsubscribed'] as const;
export type NewsletterStatus = (typeof NEWSLETTER_STATUSES)[number];

/** Postgres enum `content_status`. */
export const CONTENT_STATUSES = [
  'draft',
  'pending_review',
  'in_review',
  'changes_requested',
  'approved',
  'rejected',
  'scheduled',
  'published',
] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/** Postgres enum `risk_flag`. */
export const RISK_FLAGS = [
  'legal_review_required',
  'contains_pii',
  'unverified_claim',
  'brand_sensitive',
] as const;
export type RiskFlag = (typeof RISK_FLAGS)[number];

/** Postgres enum `content_review_action`. */
export const CONTENT_REVIEW_ACTIONS = [
  'approve',
  'request_changes',
  'reject',
  'publish',
  'schedule',
  'remind_author',
] as const;
export type ContentReviewAction = (typeof CONTENT_REVIEW_ACTIONS)[number];

/** Postgres enum `contact_category`. */
export const CONTACT_CATEGORIES = [
  'penetration_testing_request',
  'vulnerability_report',
  'journalist_blogger_profile_request',
  'whistleblower_tip',
  'general_support',
] as const;
export type ContactCategory = (typeof CONTACT_CATEGORIES)[number];

/** Postgres enum `contact_status`. */
export const CONTACT_STATUSES = ['new', 'triaged', 'closed'] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

/** Postgres enum `broadcast_status`. */
export const BROADCAST_STATUSES = ['queued', 'sending', 'sent', 'failed'] as const;
export type BroadcastStatus = (typeof BROADCAST_STATUSES)[number];

/** Postgres enum `audit_category`. */
export const AUDIT_CATEGORIES = [
  'authentication',
  'scan_completion',
  'report_release',
  'administrative',
  'security_event',
  'system',
] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

/** Postgres enum `audit_severity`. */
export const AUDIT_SEVERITIES = ['ok', 'info', 'warning', 'critical'] as const;
export type AuditSeverity = (typeof AUDIT_SEVERITIES)[number];

/** Display labels for these live in `@vunvault/contracts` (Task 20d). */

/** Postgres enum `advisory_status`. */
export const ADVISORY_STATUSES = ['draft', 'published', 'retracted'] as const;
export type AdvisoryStatus = (typeof ADVISORY_STATUSES)[number];

/** Postgres enum `advisory_patch_status`. */
export const ADVISORY_PATCH_STATUSES = ['unpatched', 'patch_in_progress', 'patched'] as const;
export type AdvisoryPatchStatus = (typeof ADVISORY_PATCH_STATUSES)[number];

/** Postgres enum `scope_category`. */
export const SCOPE_CATEGORIES = [
  'web_api',
  'network_edge',
  'endpoint_desktop',
  'cloud_containers',
  'mobile',
  'ot_ics',
  'identity_sso',
] as const;
export type ScopeCategory = (typeof SCOPE_CATEGORIES)[number];

/** Postgres enum `broadcast_kind`. */
export const BROADCAST_KINDS = ['initial', 'rebroadcast', 'retraction'] as const;
export type BroadcastKind = (typeof BROADCAST_KINDS)[number];

/** Postgres enum `node_status`. */
export const NODE_STATUSES = [
  'operational',
  'high_load',
  'drift_warning',
  'degraded',
  'offline',
] as const;
export type NodeStatus = (typeof NODE_STATUSES)[number];
/** Postgres enum `career_role`. */
export const CAREER_ROLES = [
  'student',
  'business_owner',
  'cybersecurity_professional',
  'independent_specialist',
] as const;
export type CareerRole = (typeof CAREER_ROLES)[number];

/** Postgres enum `entity_type`. */
export const ENTITY_TYPES = ['individual', 'company', 'corporation'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/** Postgres enum `recovery_question`. */
export const RECOVERY_QUESTIONS = [
  'first_pet',
  'birth_city',
  'maiden_name',
  'first_car',
  'first_school',
] as const;
export type RecoveryQuestion = (typeof RECOVERY_QUESTIONS)[number];

/** Label maps for these live in `@vunvault/contracts` (Task 20d). */

/** Postgres enum `notification_event`. */
export const NOTIFICATION_EVENTS = [
  'signin_new_device',
  'credentials_changed',
  'failed_auth',
  'scan_completed',
  'job_awaiting_review',
  'critical_finding',
  'advisory_broadcast',
  'threat_level_change',
  'content_awaiting_moderation',
  'team_member_provisioned',
  'weekly_digest',
] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

/** Postgres enum `notification_channel`. */
export const NOTIFICATION_CHANNELS = ['in_app', 'email', 'sms', 'push'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/** Postgres enum `blog_category`. */
export const BLOG_CATEGORIES = [
  'news',
  'threat_intel',
  'blog',
  'industry_updates',
  'tutorials',
] as const;
export type BlogCategory = (typeof BLOG_CATEGORIES)[number];
/** Every enum name in the database, mapped to its values. */
export const ENUM_VALUES = {
  user_role: USER_ROLES,
  account_status: ACCOUNT_STATUSES,
  access_tier: ACCESS_TIERS,
  team: TEAMS,
  mfa_method: MFA_METHODS,
  account_type: ACCOUNT_TYPES,
  industry: INDUSTRIES,
  invitation_status: INVITATION_STATUSES,
  scan_type: SCAN_TYPES,
  scan_priority: SCAN_PRIORITIES,
  scan_environment: SCAN_ENVIRONMENTS,
  scan_status: SCAN_STATUSES,
  review_gate_state: REVIEW_GATE_STATES,
  review_decision: REVIEW_DECISIONS,
  review_check_key: REVIEW_CHECK_KEYS,
  finding_severity: FINDING_SEVERITIES,
  finding_status: FINDING_STATUSES,
  pentest_target_type: PENTEST_TARGET_TYPES,
  pentest_status: PENTEST_STATUSES,
  payment_status: PAYMENT_STATUSES,
  invoice_status: INVOICE_STATUSES,
  subscription_status: SUBSCRIPTION_STATUSES,
  billing_cycle: BILLING_CYCLES,
  payment_provider: PAYMENT_PROVIDERS,
  payment_channel: PAYMENT_CHANNELS,
  payment_attempt_status: PAYMENT_ATTEMPT_STATUSES,
  display_currency: DISPLAY_CURRENCIES,
  ledger_direction: LEDGER_DIRECTIONS,
  ledger_account_type: LEDGER_ACCOUNT_TYPES,
  journal_kind: JOURNAL_KINDS,
  content_type: CONTENT_TYPES,
  content_status: CONTENT_STATUSES,
  risk_flag: RISK_FLAGS,
  content_review_action: CONTENT_REVIEW_ACTIONS,
  contact_category: CONTACT_CATEGORIES,
  contact_status: CONTACT_STATUSES,
  broadcast_status: BROADCAST_STATUSES,
  audit_category: AUDIT_CATEGORIES,
  audit_severity: AUDIT_SEVERITIES,
  advisory_status: ADVISORY_STATUSES,
  advisory_patch_status: ADVISORY_PATCH_STATUSES,
  scope_category: SCOPE_CATEGORIES,
  broadcast_kind: BROADCAST_KINDS,
  node_status: NODE_STATUSES,
  career_role: CAREER_ROLES,
  entity_type: ENTITY_TYPES,
  recovery_question: RECOVERY_QUESTIONS,
  notification_event: NOTIFICATION_EVENTS,
  notification_channel: NOTIFICATION_CHANNELS,
  blog_category: BLOG_CATEGORIES,
  newsletter_status: NEWSLETTER_STATUSES,
} as const;

export type EnumName = keyof typeof ENUM_VALUES;

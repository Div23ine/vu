import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_STATUSES,
  ACCESS_TIERS,
  AUDIT_CATEGORIES,
  AUDIT_SEVERITIES,
  BILLING_CYCLES,
  BROADCAST_STATUSES,
  CONTACT_CATEGORIES,
  CONTACT_STATUSES,
  CONTENT_REVIEW_ACTIONS,
  CONTENT_STATUSES,
  CONTENT_TYPES,
  DISPLAY_CURRENCIES,
  ENUM_VALUES,
  FINDING_SEVERITIES,
  FINDING_STATUSES,
  INDUSTRIES,
  INVOICE_STATUSES,
  INVITATION_STATUSES,
  JOURNAL_KINDS,
  LEDGER_ACCOUNT_TYPES,
  LEDGER_DIRECTIONS,
  MFA_METHODS,
  PAYMENT_ATTEMPT_STATUSES,
  PAYMENT_CHANNELS,
  PAYMENT_PROVIDERS,
  PAYMENT_STATUSES,
  PENTEST_STATUSES,
  PENTEST_TARGET_TYPES,
  REVIEW_CHECK_KEYS,
  REVIEW_DECISIONS,
  REVIEW_GATE_STATES,
  RISK_FLAGS,
  SCAN_ENVIRONMENTS,
  SCAN_PRIORITIES,
  SCAN_STATUSES,
  SCAN_TYPES,
  SUBSCRIPTION_STATUSES,
  TEAMS,
  USER_ROLES,
  type AuditCategory,
  type ReviewGateState,
  type UserRole,
} from './enum-values';

/**
 * The tuples are the contract between the database and every wire schema, so the
 * counts and the security-critical members are pinned here: adding or removing a
 * value must be a deliberate change that also produces a migration.
 */

/** Every enum in `enum-values.ts`, with its expected length. */
const EXPECTED_COUNTS: Record<string, readonly [string[], number]> = {
  USER_ROLES: [
    [
      'super_admin',
      'admin',
      'security_analyst',
      'soc_operator',
      'compliance_auditor',
      'support_engineer',
      'client',
    ],
    7,
  ],
  ACCOUNT_STATUSES: [
    ['active', 'pending_invite', 'pending_verification', 'suspended', 'dormant'],
    5,
  ],
  ACCESS_TIERS: [['standard', 'elevated', 'restricted'], 3],
  TEAMS: [
    [
      'offensive_security',
      'soc_detection_response',
      'threat_intelligence',
      'security_automation',
      'compliance_audit',
      'client_support',
      'curriculum_product',
      'compliance_comms',
    ],
    8,
  ],
  MFA_METHODS: [['totp', 'webauthn', 'email_otp'], 3],
  ACCOUNT_TYPES: [['individual', 'company'], 2],
  INDUSTRIES: [
    [
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
    ],
    11,
  ],
  INVITATION_STATUSES: [['draft', 'pending', 'accepted', 'revoked', 'expired'], 5],
  SCAN_TYPES: [['external', 'api', 'internal', 'network', 'mobile'], 5],
  SCAN_PRIORITIES: [['critical', 'high', 'medium', 'low'], 4],
  SCAN_ENVIRONMENTS: [['production', 'staging'], 2],
  SCAN_STATUSES: [
    ['queued', 'running', 'awaiting_review', 'completed', 'held', 'rejected', 'cancelled'],
    7,
  ],
  REVIEW_GATE_STATES: [
    ['not_eligible', 'in_review', 'approved_released', 'held_blocked', 'blocked_payment'],
    5,
  ],
  REVIEW_DECISIONS: [['approve_release', 'hold_remediation', 'reject_archive'], 3],
  REVIEW_CHECK_KEYS: [
    [
      'scope_authorisation_verified',
      'evidence_sanitised',
      'critical_high_validated',
      'remediation_guidance_attached',
      'client_redaction_approved',
    ],
    5,
  ],
  FINDING_SEVERITIES: [['critical', 'high', 'medium', 'low'], 4],
  FINDING_STATUSES: [['open', 'validated', 'false_positive', 'remediated'], 4],
  PENTEST_TARGET_TYPES: [['web_application', 'network_infrastructure', 'api', 'mobile_app'], 4],
  PENTEST_STATUSES: [['received', 'scoping', 'scheduled', 'converted', 'declined'], 5],
  PAYMENT_STATUSES: [['paid', 'pending', 'overdue'], 3],
  INVOICE_STATUSES: [['draft', 'pending', 'paid', 'overdue', 'void'], 5],
  SUBSCRIPTION_STATUSES: [['active', 'past_due', 'canceled', 'incomplete'], 4],
  BILLING_CYCLES: [['monthly', 'annual'], 2],
  PAYMENT_PROVIDERS: [['stripe', 'paystack'], 2],
  PAYMENT_CHANNELS: [['card', 'mpesa', 'bank_transfer'], 3],
  PAYMENT_ATTEMPT_STATUSES: [['created', 'requires_action', 'succeeded', 'failed', 'canceled'], 5],
  DISPLAY_CURRENCIES: [['USD', 'KES', 'NGN', 'GHS', 'ZAR'], 5],
  LEDGER_DIRECTIONS: [['debit', 'credit'], 2],
  LEDGER_ACCOUNT_TYPES: [['asset', 'liability', 'revenue', 'expense', 'equity'], 5],
  JOURNAL_KINDS: [['invoice_issued', 'payment_captured', 'refund', 'adjustment', 'reversal'], 5],
  CONTENT_TYPES: [['blog_post', 'news_announcement', 'threat_advisory', 'product_listing'], 4],
  CONTENT_STATUSES: [
    [
      'draft',
      'pending_review',
      'in_review',
      'changes_requested',
      'approved',
      'rejected',
      'scheduled',
      'published',
    ],
    8,
  ],
  RISK_FLAGS: [['legal_review_required', 'contains_pii', 'unverified_claim', 'brand_sensitive'], 4],
  CONTENT_REVIEW_ACTIONS: [
    ['approve', 'request_changes', 'reject', 'publish', 'schedule', 'remind_author'],
    6,
  ],
  CONTACT_CATEGORIES: [
    [
      'penetration_testing_request',
      'vulnerability_report',
      'journalist_blogger_profile_request',
      'whistleblower_tip',
      'general_support',
    ],
    5,
  ],
  CONTACT_STATUSES: [['new', 'triaged', 'closed'], 3],
  BROADCAST_STATUSES: [['queued', 'sending', 'sent', 'failed'], 4],
  AUDIT_CATEGORIES: [
    [
      'authentication',
      'scan_completion',
      'report_release',
      'administrative',
      'security_event',
      'system',
    ],
    6,
  ],
  AUDIT_SEVERITIES: [['ok', 'info', 'warning', 'critical'], 4],
  ADVISORY_STATUSES: [['draft', 'published', 'retracted'], 3],
  ADVISORY_PATCH_STATUSES: [['unpatched', 'patch_in_progress', 'patched'], 3],
  SCOPE_CATEGORIES: [
    [
      'web_api',
      'network_edge',
      'endpoint_desktop',
      'cloud_containers',
      'mobile',
      'ot_ics',
      'identity_sso',
    ],
    7,
  ],
  BROADCAST_KINDS: [['initial', 'rebroadcast', 'retraction'], 3],
  NODE_STATUSES: [['operational', 'high_load', 'drift_warning', 'degraded', 'offline'], 5],
  CAREER_ROLES: [
    ['student', 'business_owner', 'cybersecurity_professional', 'independent_specialist'],
    4,
  ],
  ENTITY_TYPES: [['individual', 'company', 'corporation'], 3],
  RECOVERY_QUESTIONS: [['first_pet', 'birth_city', 'maiden_name', 'first_car', 'first_school'], 5],
  NOTIFICATION_EVENTS: [
    [
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
    ],
    11,
  ],
  NOTIFICATION_CHANNELS: [['in_app', 'email', 'sms', 'push'], 4],
  BLOG_CATEGORIES: [['news', 'threat_intel', 'blog', 'industry_updates', 'tutorials'], 5],
  // Task 40b: the marketing store addendum.
  NEWSLETTER_STATUSES: [['pending', 'confirmed', 'unsubscribed'], 3],
};

describe('enum tuples', () => {
  it('has the expected number of values for every enum', () => {
    for (const [name, [values, count]] of Object.entries(EXPECTED_COUNTS)) {
      expect(values, `${name} length`).toHaveLength(count);
    }
    expect(Object.keys(EXPECTED_COUNTS)).toHaveLength(51);
  });

  it('exposes every tuple through ENUM_VALUES under its Postgres enum name', () => {
    // 39 core + 5 (Task 20b) + 6 (Task 20c) + 1 (Task 40b).
    expect(Object.keys(ENUM_VALUES)).toHaveLength(51);
    expect(ENUM_VALUES.user_role).toBe(USER_ROLES);
    expect(ENUM_VALUES.review_gate_state).toBe(REVIEW_GATE_STATES);
    expect(ENUM_VALUES.display_currency).toBe(DISPLAY_CURRENCIES);
  });

  it('contains no duplicate values in any enum', () => {
    for (const [name, values] of Object.entries(ENUM_VALUES)) {
      expect(new Set(values).size, `${name} has duplicates`).toBe(values.length);
    }
  });

  it('pins the identity and authorisation enums', () => {
    expect(USER_ROLES).toEqual([
      'super_admin',
      'admin',
      'security_analyst',
      'soc_operator',
      'compliance_auditor',
      'support_engineer',
      'client',
    ]);
    expect(ACCOUNT_STATUSES).toEqual([
      'active',
      'pending_invite',
      'pending_verification',
      'suspended',
      'dormant',
    ]);
    expect(ACCESS_TIERS).toEqual(['standard', 'elevated', 'restricted']);
    expect(MFA_METHODS).toEqual(['totp', 'webauthn', 'email_otp']);
    expect(TEAMS).toContain('curriculum_product');
    expect(INDUSTRIES).toContain('sacco_microfinance');
    expect(INVITATION_STATUSES).toEqual(['draft', 'pending', 'accepted', 'revoked', 'expired']);
  });

  it('pins the scan and review-gate enums', () => {
    expect(SCAN_TYPES).toEqual(['external', 'api', 'internal', 'network', 'mobile']);
    expect(SCAN_PRIORITIES).toEqual(['critical', 'high', 'medium', 'low']);
    expect(SCAN_ENVIRONMENTS).toEqual(['production', 'staging']);
    expect(SCAN_STATUSES).toEqual([
      'queued',
      'running',
      'awaiting_review',
      'completed',
      'held',
      'rejected',
      'cancelled',
    ]);
    expect(REVIEW_GATE_STATES).toEqual([
      'not_eligible',
      'in_review',
      'approved_released',
      'held_blocked',
      'blocked_payment',
    ]);
    expect(REVIEW_DECISIONS).toEqual(['approve_release', 'hold_remediation', 'reject_archive']);
    // The five checks of the Mandatory Admin Review Gate.
    expect(REVIEW_CHECK_KEYS).toHaveLength(5);
    expect(REVIEW_CHECK_KEYS).toEqual([
      'scope_authorisation_verified',
      'evidence_sanitised',
      'critical_high_validated',
      'remediation_guidance_attached',
      'client_redaction_approved',
    ]);
    expect(FINDING_SEVERITIES).toEqual(['critical', 'high', 'medium', 'low']);
    expect(FINDING_STATUSES).toEqual(['open', 'validated', 'false_positive', 'remediated']);
    expect(PENTEST_TARGET_TYPES).toEqual([
      'web_application',
      'network_infrastructure',
      'api',
      'mobile_app',
    ]);
    expect(PENTEST_STATUSES).toEqual(['received', 'scoping', 'scheduled', 'converted', 'declined']);
  });

  it('pins the billing enums around USD-only settlement', () => {
    // Settlement stays USD-only; these are DISPLAY currencies (GBP/EUR added
    // for the public pricing toggle).
    expect(DISPLAY_CURRENCIES).toEqual(['USD', 'KES', 'NGN', 'GHS', 'ZAR', 'GBP', 'EUR']);
    expect(PAYMENT_STATUSES).toEqual(['paid', 'pending', 'overdue']);
    expect(INVOICE_STATUSES).toEqual(['draft', 'pending', 'paid', 'overdue', 'void']);
    expect(SUBSCRIPTION_STATUSES).toEqual(['active', 'past_due', 'canceled', 'incomplete']);
    expect(BILLING_CYCLES).toEqual(['monthly', 'annual']);
    expect(PAYMENT_PROVIDERS).toEqual(['stripe', 'paystack']);
    expect(PAYMENT_CHANNELS).toEqual(['card', 'mpesa', 'bank_transfer']);
    expect(PAYMENT_ATTEMPT_STATUSES).toEqual([
      'created',
      'requires_action',
      'succeeded',
      'failed',
      'canceled',
    ]);
    expect(LEDGER_DIRECTIONS).toEqual(['debit', 'credit']);
    expect(LEDGER_ACCOUNT_TYPES).toEqual(['asset', 'liability', 'revenue', 'expense', 'equity']);
    expect(JOURNAL_KINDS).toEqual([
      'invoice_issued',
      'payment_captured',
      'refund',
      'adjustment',
      'reversal',
    ]);
    // No cryptocurrency, ever.
    for (const value of [...DISPLAY_CURRENCIES, ...PAYMENT_PROVIDERS, ...PAYMENT_CHANNELS]) {
      expect(value.toLowerCase()).not.toContain('crypto');
    }
  });

  it('pins the content, contact, broadcast and audit enums', () => {
    expect(CONTENT_TYPES).toEqual([
      'blog_post',
      'news_announcement',
      'threat_advisory',
      'product_listing',
    ]);
    expect(CONTENT_STATUSES).toEqual([
      'draft',
      'pending_review',
      'in_review',
      'changes_requested',
      'approved',
      'rejected',
      'scheduled',
      'published',
    ]);
    expect(RISK_FLAGS).toEqual([
      'legal_review_required',
      'contains_pii',
      'unverified_claim',
      'brand_sensitive',
    ]);
    expect(CONTENT_REVIEW_ACTIONS).toEqual([
      'approve',
      'request_changes',
      'reject',
      'publish',
      'schedule',
      'remind_author',
    ]);
    expect(CONTACT_CATEGORIES).toEqual([
      'penetration_testing_request',
      'vulnerability_report',
      'journalist_blogger_profile_request',
      'whistleblower_tip',
      'general_support',
    ]);
    expect(CONTACT_STATUSES).toEqual(['new', 'triaged', 'closed']);
    expect(BROADCAST_STATUSES).toEqual(['queued', 'sending', 'sent', 'failed']);
    expect(AUDIT_CATEGORIES).toEqual([
      'authentication',
      'scan_completion',
      'report_release',
      'administrative',
      'security_event',
      'system',
    ]);
    expect(AUDIT_SEVERITIES).toEqual(['ok', 'info', 'warning', 'critical']);
  });

  it('derives the union types from the tuples', () => {
    const role: UserRole = 'security_analyst';
    const gate: ReviewGateState = 'approved_released';
    const category: AuditCategory = 'report_release';
    expect(USER_ROLES).toContain(role);
    expect(REVIEW_GATE_STATES).toContain(gate);
    expect(AUDIT_CATEGORIES).toContain(category);
  });
});

import type { AuditCategory, AuditSeverity } from '@vunvault/contracts';

/**
 * The audit event catalog.
 *
 * One entry per event type the platform can emit, with the category and severity
 * it belongs to. A route never picks a severity by hand: it names an event and the
 * catalog decides, so two teams cannot classify the same act differently.
 *
 * `sevLevel` marks the incidents a human must see: SEV-1 pages the incident
 * commander, SEV-2 is a same-day review, SEV-3 is informational.
 */

export interface AuditEventDefinition {
  category: AuditCategory;
  severity: AuditSeverity;
  sevLevel?: 1 | 2 | 3;
}

export const AUDIT_EVENTS = {
  // --- authentication ---
  AUTH_SUCCESS: { category: 'authentication', severity: 'ok' },
  AUTH_FAILURE: { category: 'authentication', severity: 'warning' },
  AUTH_MFA_FAILURE: { category: 'authentication', severity: 'warning' },
  AUTH_LOGOUT: { category: 'authentication', severity: 'info' },
  PASSWORD_CHANGED: { category: 'authentication', severity: 'info', sevLevel: 3 },
  MFA_ENABLED: { category: 'authentication', severity: 'info', sevLevel: 3 },
  MFA_DISABLED: { category: 'authentication', severity: 'warning', sevLevel: 2 },
  RECOVERY_CODES_GENERATED: { category: 'authentication', severity: 'info', sevLevel: 3 },
  SESSION_REVOKED: { category: 'authentication', severity: 'info' },
  ACCOUNT_REGISTERED: { category: 'authentication', severity: 'info' },
  // Phase 1/3 (magic-link work order): the login surface is the mailbox. An
  // issuance is a fact about an account; an invitation is a fact about an
  // address that has none. Neither records the token (work order §7).
  MAGIC_LINK_ISSUED: { category: 'authentication', severity: 'info' },
  MAGIC_LINK_VERIFIED: { category: 'authentication', severity: 'ok' },
  SIGNUP_INVITE_SENT: { category: 'authentication', severity: 'info' },
  // Phase 2: an admin parked in `blocked_mfa_setup`, and the super-admin reset.
  MFA_SETUP_BLOCKED: { category: 'authentication', severity: 'warning', sevLevel: 3 },
  MFA_SETUP_UNBLOCKED: { category: 'administrative', severity: 'info' },
  ADMIN_PROVISIONED: { category: 'administrative', severity: 'info' },

  // --- security events ---
  AUTH_RATE_LIMIT: { category: 'security_event', severity: 'warning' },
  // Phase 4: a magic-link request dropped by a bot signal (honeypot filled or
  // inhuman form timing). The subject is the probed address; no token exists.
  AUTH_BOT_REJECTED: { category: 'security_event', severity: 'warning' },
  RELEASE_LOCK_VIOLATION: { category: 'security_event', severity: 'critical', sevLevel: 2 },
  CSRF_REJECTED: { category: 'security_event', severity: 'warning' },
  WEBHOOK_SIGNATURE_INVALID: { category: 'security_event', severity: 'warning' },

  // --- scan lifecycle ---
  SCAN_REQUESTED: { category: 'scan_completion', severity: 'info' },
  SCAN_STARTED: { category: 'scan_completion', severity: 'info' },
  SCAN_COMPLETE: { category: 'scan_completion', severity: 'ok' },
  SCAN_CANCELLED: { category: 'scan_completion', severity: 'info' },
  SCAN_HELD: { category: 'scan_completion', severity: 'warning' },
  SCAN_FAILED: { category: 'scan_completion', severity: 'warning' },
  // Task 95: a whitelisted control signal (abort/pause/resume/kill) forwarded
  // from the scan terminal to the controller. Routine operation, but it is a
  // human reaching into a running job — the chain records who and which.
  SCAN_CONTROL_SENT: { category: 'scan_completion', severity: 'info' },

  // --- review gate and release ---
  GATE_DECISION: { category: 'report_release', severity: 'info' },
  REPORT_RELEASED: { category: 'report_release', severity: 'ok' },

  // --- administrative ---
  USER_PROVISIONED: { category: 'administrative', severity: 'info' },
  INVITATION_RESENT: { category: 'administrative', severity: 'info' },
  INVITATION_REVOKED: { category: 'administrative', severity: 'info' },
  INVITATION_ACCEPTED: { category: 'administrative', severity: 'info' },
  PERMISSION_CHANGED: { category: 'administrative', severity: 'warning', sevLevel: 2 },
  ACCOUNT_SUSPENDED: { category: 'administrative', severity: 'warning', sevLevel: 2 },
  ACCOUNT_REACTIVATED: { category: 'administrative', severity: 'info' },
  ACCOUNT_DELETED: { category: 'administrative', severity: 'warning', sevLevel: 2 },
  MFA_ENFORCED: { category: 'administrative', severity: 'info' },
  PROFILE_UPDATED: { category: 'administrative', severity: 'info' },
  DEACTIVATION_REQUESTED: { category: 'administrative', severity: 'warning', sevLevel: 2 },
  PAYMENT_METHOD_UPDATED: { category: 'administrative', severity: 'info' },
  PAYMENT_CAPTURED: { category: 'administrative', severity: 'ok' },
  PAYMENT_FAILED: { category: 'administrative', severity: 'warning' },
  REFUND_ISSUED: { category: 'administrative', severity: 'warning', sevLevel: 3 },
  ADVISORY_DRAFT_SAVED: { category: 'administrative', severity: 'info' },
  ADVISORY_BROADCAST: { category: 'administrative', severity: 'critical', sevLevel: 1 },
  ADVISORY_RETRACTED: { category: 'administrative', severity: 'warning', sevLevel: 2 },
  CONTENT_REVIEWED: { category: 'administrative', severity: 'info' },
  CONTENT_PUBLISHED: { category: 'administrative', severity: 'ok' },
  PENTEST_REQUESTED: { category: 'administrative', severity: 'info' },
  CONTACT_RECEIVED: { category: 'administrative', severity: 'info' },
  // Task 40f: an administrator changed a contact message's status or assignee.
  CONTACT_TRIAGED: { category: 'administrative', severity: 'info' },
  CONSENT_RECORDED: { category: 'administrative', severity: 'info' },
  PAYMENT_ATTEMPT_CREATED: { category: 'administrative', severity: 'info' },
  // Task 40c: the store and the newsletter.
  PRODUCT_PURCHASE_STARTED: { category: 'administrative', severity: 'info' },
  PRODUCT_DOWNLOADED: { category: 'administrative', severity: 'info' },
  NEWSLETTER_SUBSCRIBED: { category: 'administrative', severity: 'info' },
  NEWSLETTER_UNSUBSCRIBED: { category: 'administrative', severity: 'info' },
  ENTITLEMENT_GRANTED: { category: 'administrative', severity: 'ok' },
  FX_QUOTE_LOCKED: { category: 'administrative', severity: 'info' },
  ADVISORY_ACKNOWLEDGED: { category: 'administrative', severity: 'info' },
  ADVISORY_PATCH_STATUS_CHANGED: { category: 'administrative', severity: 'info' },
  CONTENT_DRAFT_SAVED: { category: 'administrative', severity: 'info' },
  CONTENT_SUBMITTED: { category: 'administrative', severity: 'info' },
  AVATAR_UPDATED: { category: 'administrative', severity: 'info' },
  ONBOARDING_COMPLETED: { category: 'administrative', severity: 'info' },
  SCAN_PAYMENT_REQUESTED: { category: 'administrative', severity: 'info' },
  BULK_SCAN_ACTION: { category: 'administrative', severity: 'info' },
  FINDING_REVIEWED: { category: 'administrative', severity: 'info' },
  INVOICE_ISSUED: { category: 'administrative', severity: 'info' },
  NOTIFICATION_PREFS_UPDATED: { category: 'administrative', severity: 'info' },

  // --- system ---
  KEY_ROTATION: { category: 'system', severity: 'info' },
  CHAIN_VERIFIED: { category: 'system', severity: 'ok' },
  LOG_BACKUP: { category: 'system', severity: 'ok' },
  CHAIN_GENESIS: { category: 'system', severity: 'info' },
  THREAT_LEVEL_CHANGED: { category: 'system', severity: 'warning' },
  // Revision 2 addendum A2.4: a super admin fired the email-delivery diagnostic.
  // This endpoint can make the platform send mail to an arbitrary address, so the
  // fact that it was used — by whom, to where, and which Resend id came back — is
  // recorded in the sealed audit chain, not just in the application log.
  EMAIL_DELIVERY_TEST: { category: 'system', severity: 'info' },
} as const satisfies Record<string, AuditEventDefinition>;

export type AuditEventType = keyof typeof AUDIT_EVENTS;

export const AUDIT_EVENT_TYPES = Object.keys(AUDIT_EVENTS) as AuditEventType[];

export function eventDefinition(eventType: AuditEventType): AuditEventDefinition {
  return AUDIT_EVENTS[eventType];
}

/** Severity ordering, used to allow an override only upward. */
const SEVERITY_ORDER: Record<AuditSeverity, number> = {
  ok: 0,
  info: 1,
  warning: 2,
  critical: 3,
};

export function isMoreSevere(candidate: AuditSeverity, current: AuditSeverity): boolean {
  return SEVERITY_ORDER[candidate] > SEVERITY_ORDER[current];
}

/** A `sevLevel` may only be raised (1 outranks 2 outranks 3). */
export function isHigherSevLevel(candidate: 1 | 2 | 3, current: 1 | 2 | 3): boolean {
  return candidate < current;
}

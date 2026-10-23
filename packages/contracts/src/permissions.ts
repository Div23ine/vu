import type {
  AccessTier,
  AccountStatus,
  Industry,
  PentestTargetType,
  PaymentStatus,
  ReviewCheckKey,
  ReviewDecision,
  ReviewGateState,
  ScanStatus,
  ScanType,
  Team,
  UserRole,
} from './enums';

/**
 * The permission catalogue and the role → permission map.
 *
 * These are the ONLY strings the API authorises against. The Supabase Auth Hook
 * mints `permissions[]` into the JWT from `ROLE_PERMISSIONS[role]`, so the token
 * and this file can never disagree.
 */

export const PERMISSIONS = [
  'dashboard:read',
  'scans:read',
  'scans:create',
  'scans:execute',
  'scans:review',
  'scans:release',
  'intel:read',
  'intel:write',
  'intel:broadcast',
  'users:read',
  'users:manage',
  'content:author',
  'content:moderate',
  'audit:read',
  'audit:verify',
  'billing:read',
  'billing:manage',
  'support:handle',
  'profile:read',
  'profile:write',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL_PERMISSIONS: readonly Permission[] = PERMISSIONS;

function allExcept(...excluded: Permission[]): readonly Permission[] {
  const blocked = new Set<Permission>(excluded);
  return PERMISSIONS.filter((permission) => !blocked.has(permission));
}

/**
 * `intel:broadcast` dispatches an emergency advisory to every client dashboard.
 * It is deliberately NOT implied by `intel:write`: an analyst may author and edit
 * advisories, but only an administrator may broadcast one.
 */
const BROADCAST_ROLES: readonly UserRole[] = ['super_admin', 'admin'];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  super_admin: ALL_PERMISSIONS,
  admin: allExcept('users:manage'),
  security_analyst: [
    'dashboard:read',
    'scans:read',
    'scans:create',
    'scans:execute',
    'intel:read',
    'intel:write',
    'content:author',
    'profile:read',
    'profile:write',
  ],
  soc_operator: [
    'dashboard:read',
    'scans:read',
    'scans:execute',
    'intel:read',
    'profile:read',
    'profile:write',
  ],
  compliance_auditor: [
    'dashboard:read',
    'scans:read',
    'audit:read',
    'profile:read',
    'profile:write',
  ],
  support_engineer: ['support:handle', 'profile:read', 'profile:write'],
  client: [
    'scans:read',
    'scans:create',
    'billing:read',
    'billing:manage',
    'profile:read',
    'profile:write',
  ],
};

/** True when a role may issue an emergency advisory broadcast. */
export function canBroadcast(role: UserRole): boolean {
  return BROADCAST_ROLES.includes(role);
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Administrator',
  admin: 'Administrator',
  security_analyst: 'Security Analyst',
  soc_operator: 'SOC Operator',
  compliance_auditor: 'Compliance Auditor',
  support_engineer: 'Support Engineer',
  client: 'Client',
};

export const ROLE_DESCRIPTIONS: Partial<Record<UserRole, string>> = {
  security_analyst: 'Run scans, review findings and author advisories within an assigned scope.',
  soc_operator:
    'Monitor live feeds, triage alerts and escalate incidents. No client release authority.',
  compliance_auditor:
    'Read-only access to audit logs, reports and regulatory evidence. No execution rights.',
  admin: 'Full operational control including review-gate approval and client release.',
  support_engineer: 'Client ticketing and triage only. No access to scan data or dashboards.',
  super_admin: 'Unrestricted platform control. Reserved for the security leadership team only.',
};

export const TEAM_LABELS: Record<Team, string> = {
  offensive_security: 'Offensive Security',
  soc_detection_response: 'SOC — Detection & Response',
  threat_intelligence: 'Threat Intelligence',
  security_automation: 'Security Automation',
  compliance_audit: 'Compliance & Audit',
  client_support: 'Client Support',
  curriculum_product: 'Curriculum & Product',
  compliance_comms: 'Compliance & Comms',
};

export const ACCESS_TIER_LABELS: Record<AccessTier, string> = {
  standard: 'Standard — assigned scope only',
  elevated: 'Elevated — cross-client read',
  restricted: 'Restricted — single client',
};

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  active: 'Active',
  pending_invite: 'Pending Invite',
  pending_verification: 'Pending Verification',
  suspended: 'Suspended',
  dormant: 'Dormant',
};

export const SCAN_TYPE_LABELS: Record<ScanType, string> = {
  external: 'External',
  api: 'API',
  internal: 'Internal',
  network: 'Network',
  mobile: 'Mobile',
};

export const SCAN_STATUS_LABELS: Record<ScanStatus, string> = {
  running: 'Running',
  awaiting_review: 'Awaiting Review',
  completed: 'Completed',
  queued: 'Queued',
  held: 'Held',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const REVIEW_GATE_LABELS: Record<ReviewGateState, string> = {
  in_review: 'In Review',
  approved_released: 'Approved — Released',
  held_blocked: 'Held — Blocked',
  blocked_payment: 'Blocked — Payment',
  not_eligible: 'Not eligible for review',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  paid: 'Paid',
  pending: 'Pending',
  overdue: 'Overdue',
};

export const REVIEW_CHECK_LABELS: Record<ReviewCheckKey, { title: string; description: string }> = {
  scope_authorisation_verified: {
    title: 'Scope authorisation verified',
    description: 'Signed authorisation on file covers every host in the target list.',
  },
  evidence_sanitised: {
    title: 'Evidence sanitised',
    description: 'No production data, credentials or personal information in the report.',
  },
  critical_high_validated: {
    title: 'Critical & high findings manually validated',
    description: 'Each severe finding independently reproduced by the reviewer.',
  },
  remediation_guidance_attached: {
    title: 'Remediation guidance attached',
    description: 'Prioritised fixes and a re-test window are included in the report.',
  },
  client_redaction_approved: {
    title: 'Client-ready redaction approved',
    description: 'Exploit payloads are safely truncated for the client-facing copy.',
  },
};

export const GATE_DECISION_LABELS: Record<ReviewDecision, { title: string; description: string }> =
  {
    approve_release: {
      title: 'Approve & Release',
      description: 'Clears the gate and grants the client portal access to the report.',
    },
    hold_remediation: {
      title: 'Hold for Remediation',
      description: 'Keeps the report locked while the client remediates findings.',
    },
    reject_archive: {
      title: 'Reject & Archive',
      description: 'Marks the job invalid and returns it to the analyst for rework.',
    },
  };

export const INDUSTRY_LABELS: Record<Industry, string> = {
  financial_services_fintech: 'Financial Services / Fintech',
  sacco_microfinance: 'SACCO / Microfinance',
  banking: 'Banking',
  insurance: 'Insurance',
  healthcare: 'Healthcare',
  telecommunications: 'Telecommunications',
  government_public_sector: 'Government / Public Sector',
  education: 'Education',
  retail_ecommerce: 'Retail & E-Commerce',
  technology_saas: 'Technology / SaaS',
  other: 'Other',
};

export const PENTEST_TARGET_LABELS: Record<PentestTargetType, string> = {
  web_application: 'Web Application',
  network_infrastructure: 'Network / Infrastructure',
  api: 'API',
  mobile_app: 'Mobile App',
};

/** Countries the platform sells into, in the order the picker shows them. */
export const COUNTRIES = {
  KE: 'Kenya',
  UG: 'Uganda',
  TZ: 'Tanzania',
  RW: 'Rwanda',
  NG: 'Nigeria',
  GH: 'Ghana',
  ZA: 'South Africa',
  EG: 'Egypt',
  ET: 'Ethiopia',
  US: 'United States',
  GB: 'United Kingdom',
  CA: 'Canada',
  DE: 'Germany',
} as const;

export type CountryCode = keyof typeof COUNTRIES;

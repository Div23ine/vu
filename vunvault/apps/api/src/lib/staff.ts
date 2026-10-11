import type { UserRole } from '@vunvault/contracts';

/**
 * Who counts as staff.
 *
 * `client` is the only non-staff role: it belongs to customer organisations and is
 * provisioned through signup, never through a staff invitation.
 */
export const STAFF_ROLES = [
  'super_admin',
  'admin',
  'security_analyst',
  'soc_operator',
  'compliance_auditor',
  'support_engineer',
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaff(role: UserRole | string): role is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

/** Roles that may hold `users:manage`-style authority over other staff. */
export const ADMINISTRATOR_ROLES = ['super_admin', 'admin'] as const;

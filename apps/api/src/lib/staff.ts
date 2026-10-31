import { domainToASCII } from 'node:url';
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

/**
 * The staff email domain — single-"n" spelling (`vunvault.com`), the corrected
 * hard fact from the security work order §2. `STAFF_EMAIL_DOMAIN` in
 * `routes/v1/users/service.ts` is the same constant in suffix form (staff
 * invitation gate); this one is the canonical domain for comparisons.
 */
export const STAFF_DOMAIN = 'vunvault.com';

/**
 * Normalise an email address's domain for an exact comparison: trim
 * surrounding whitespace, NFKC-fold (defeats fullwidth look-alikes),
 * lowercase, strip a trailing root dot, then IDN-encode to punycode.
 *
 * Returns `null` when the address has no parsable `local@domain` shape or the
 * domain fails the IDN conversion — callers MUST fail closed on `null`.
 *
 * Unicode confusables are deliberately NOT folded: a Cyrillic "а" punycodes to
 * a different ASCII domain (`xn--vunvult-5fg.com`), so a look-alike address is
 * treated as the ordinary external address it actually is — never as the staff
 * domain, and never as a bypass of it.
 */
export function normalizeEmailDomain(email: string): string | null {
  const folded = email.trim().normalize('NFKC').toLowerCase();
  const at = folded.lastIndexOf('@');
  if (at <= 0 || at === folded.length - 1) return null;
  const domain = folded.slice(at + 1).replace(/\.$/, '');
  if (domain === '') return null;
  const ascii = domainToASCII(domain);
  return ascii === '' ? null : ascii;
}

/** True when the address sits on the staff domain (case-, IDN- and dot-proof). */
export function isStaffDomainEmail(email: string): boolean {
  return normalizeEmailDomain(email) === STAFF_DOMAIN;
}

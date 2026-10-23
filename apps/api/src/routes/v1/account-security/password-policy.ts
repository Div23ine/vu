import { PASSWORD_RULE_TESTS } from '@vunvault/contracts';
import { isStaff } from '../../../lib/staff';

/** Client minimum. The shared contract owns the rule copy and the predicates. */
export const PASSWORD_MIN_LENGTH = 12;

/**
 * Staff minimum. Deliberately NOT in the shared contract: a browser must not be
 * the thing that decides how long a staff password has to be.
 */
export const STAFF_PASSWORD_MIN_LENGTH = 14;

/**
 * Password policy.
 *
 * Hashing is Supabase Auth's job — this module only decides whether a candidate
 * password may be handed to Supabase at all. Staff hold a longer minimum because
 * their accounts can reach client data.
 */

export interface PasswordPolicyIssue {
  rule: string;
  message: string;
}

export interface PasswordPolicyResult {
  valid: boolean;
  issues: PasswordPolicyIssue[];
}

/** 14 characters for staff, 12 for clients. */
export function requiredLength(role: string): number {
  return isStaff(role) ? STAFF_PASSWORD_MIN_LENGTH : PASSWORD_MIN_LENGTH;
}

export function validatePassword(
  password: string,
  role: string,
  currentPassword?: string,
): PasswordPolicyResult {
  const issues: PasswordPolicyIssue[] = [];
  const minimum = requiredLength(role);

  if (password.length < minimum) {
    issues.push({ rule: 'len', message: `At least ${minimum} characters` });
  }
  if (!PASSWORD_RULE_TESTS.upper(password)) {
    issues.push({ rule: 'upper', message: 'One uppercase letter' });
  }
  if (!PASSWORD_RULE_TESTS.lower(password)) {
    issues.push({ rule: 'lower', message: 'One lowercase letter' });
  }
  if (!PASSWORD_RULE_TESTS.digit(password)) {
    issues.push({ rule: 'digit', message: 'One number' });
  }
  if (!PASSWORD_RULE_TESTS.symbol(password)) {
    issues.push({ rule: 'symbol', message: 'One symbol (!@#$…)' });
  }
  if (currentPassword !== undefined && password === currentPassword) {
    issues.push({ rule: 'reuse', message: 'Choose a password you have not used before' });
  }

  return { valid: issues.length === 0, issues };
}

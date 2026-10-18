import type { Permission, SessionUser, UserRole } from '@vunvault/contracts';

/**
 * Permission helpers shared by the edge middleware, server guards and client
 * components .
 *
 * The permission catalog lives in `@vunvault/contracts` — the API mints the
 * same strings into the JWT — so nothing here can disagree with the backend.
 * Everything in this module is a *rendering/routing* decision; the API remains
 * the authority on every request.
 */

/** The six staff roles — everyone who is not a `client`. */
export const STAFF_ROLES = [
  'super_admin',
  'admin',
  'security_analyst',
  'soc_operator',
  'compliance_auditor',
  'support_engineer',
] as const satisfies readonly UserRole[];

const STAFF_ROLE_SET: ReadonlySet<UserRole> = new Set(STAFF_ROLES);

export function isStaffRole(role: UserRole): boolean {
  return STAFF_ROLE_SET.has(role);
}

/** Anything that carries a `permissions` array — in practice a `SessionUser`. */
export type PermissionHolder = Pick<SessionUser, 'permissions'>;

/** `can(user, p)` — membership test against the session's minted permissions. */
export function can(user: PermissionHolder | null | undefined, permission: Permission): boolean {
  return user?.permissions.includes(permission) ?? false;
}

/** True when the user holds at least one of `permissions`. */
export function canAny(
  user: PermissionHolder | null | undefined,
  permissions: readonly Permission[],
): boolean {
  return permissions.some((permission) => can(user, permission));
}

/**
 * Post-login landing route per role.
 *
 * `support_engineer` lands on `/admin/profile` because it is the only staff
 * role without `dashboard:read` — the Command Center would greet it with a
 * 403. Clients land in the portal; everyone else in the admin.
 */
export function homeFor(role: UserRole): '/admin' | '/admin/profile' | '/portal' {
  if (role === 'client') return '/portal';
  if (role === 'support_engineer') return '/admin/profile';
  return '/admin';
}

import type { Permission, SessionUser } from '@vunvault/contracts';
import { can } from '../../../../lib/permissions';

/**
 * Command Center navigation data .
 *
 * Label · route · required permission: an entry is HIDDEN when the session
 * lacks its permission (Profile Settings has none — every staff role holds
 * `profile:read`). Drawer labels differ from the desktop labels and are both
 * verbatim from the design. The active entry is matched by pathname
 * prefix, except `/admin`, which matches exactly.
 */

export interface AdminNavItem {
  label: string;
  drawerLabel: string;
  href: string;
  permission?: Permission;
}

export const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  {
    label: 'Dashboard Overview',
    drawerLabel: 'Dashboard Overview',
    href: '/admin',
    permission: 'dashboard:read',
  },
  {
    label: 'Scan Queue',
    drawerLabel: 'Scan Queue & Job Assessment',
    href: '/admin/scan-queue',
    permission: 'scans:read',
  },
  {
    label: 'Zero-Day Intel',
    drawerLabel: 'Zero-Day Intel',
    href: '/admin/zero-day',
    permission: 'intel:read',
  },
  {
    label: 'User Management',
    drawerLabel: 'User & Access Management',
    href: '/admin/users',
    permission: 'users:read',
  },
  {
    label: 'Content Moderation',
    drawerLabel: 'Content Moderation',
    href: '/admin/content',
    permission: 'content:moderate',
  },
  {
    label: 'Audit Logs',
    drawerLabel: 'System Audit Logs',
    href: '/admin/audit',
    permission: 'audit:read',
  },
  {
    // an earlier iteration: the public contact triage inbox. `support:handle` is the only
    // permission that may read a message body, so the entry hides without it.
    label: 'Contact Inbox',
    drawerLabel: 'Contact Inbox',
    href: '/admin/contact',
    permission: 'support:handle',
  },
  {
    // Always visible: every staff role holds profile:read/profile:write.
    label: 'Profile Settings',
    drawerLabel: 'Profile Settings',
    href: '/admin/profile',
  },
];

/** The entries this session may see, in design order. */
export function visibleAdminNavItems(user: SessionUser): AdminNavItem[] {
  return ADMIN_NAV_ITEMS.filter(
    (item) => item.permission === undefined || can(user, item.permission),
  );
}

/** Active-route match: `/admin` exactly, everything else by path prefix. */
export function isAdminRouteActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(`${href}/`);
}

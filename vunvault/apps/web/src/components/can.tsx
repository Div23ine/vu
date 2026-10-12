'use client';

import type { Permission } from '@vunvault/contracts';
import { useSession } from '../lib/session';

/**
 * Declarative permission gate for client components:
 *
 * ```tsx
 * <Can permission="scans:release" fallback={<p>Release authority required.</p>}>
 *   <ReleaseButton />
 * </Can>
 * ```
 *
 * Renders `children` only when the session holds the permission, otherwise
 * `fallback` (default `null`). This hides UI; it never secures anything — the
 * API re-checks the permission on the actual call.
 */
export interface CanProps {
  permission: Permission;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function Can({ permission, fallback = null, children }: CanProps) {
  const { can } = useSession();
  return <>{can(permission) ? children : fallback}</>;
}

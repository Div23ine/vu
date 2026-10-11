'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import type { Permission, SessionUser, UserRole } from '@vunvault/contracts';
import { queryKeys } from '@vunvault/lib';
import { apiGetQuiet } from './api';

/**
 * Session state.
 *
 * The source of truth is the HttpOnly session cookie; this module only holds
 * the *view* of it: a TanStack Query cache entry (React consumers) mirrored
 * into a Zustand store (non-React consumers, e.g. nav chips reading
 * `useSessionStore.getState()` outside a render). Nothing here persists —
 * reload the page and it is refetched, never restored from web storage.
 */

export interface SessionState {
  user: SessionUser | null;
  setUser(u: SessionUser | null): void;
  clear(): void;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clear: () => set({ user: null }),
}));

export interface UseSession {
  user: SessionUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isStaff: boolean;
  can(p: Permission): boolean;
  refetch(): void;
}

/**
 * Roles that reach the admin Command Center. Exactly the six staff roles —
 * everyone who is not a `client`. (Task 43 promotes this set into
 * `src/lib/permissions.ts` for the middleware; the session hook keeps its own
 * copy because Task 42 must not create Task 43's files.)
 */
const STAFF_ROLES: ReadonlySet<UserRole> = new Set<UserRole>([
  'super_admin',
  'admin',
  'security_analyst',
  'soc_operator',
  'compliance_auditor',
  'support_engineer',
]);

// TODO(backend-contract): GET /api/v1/auth/session → 200 { data: SessionUser } | 401 { error: "unauthorized" }.
export const sessionQueryOptions = {
  queryKey: queryKeys.session(),
  /**
   * A 401 is the *normal* state of an anonymous visitor, so the query resolves
   * to `null` instead of entering an error state — and `apiGetQuiet` suppresses
   * the global redirect for exactly this call.
   */
  queryFn: () =>
    apiGetQuiet<{ data: SessionUser }>('/api/v1/auth/session').then(
      (response) => response?.data ?? null,
    ),
  staleTime: 60_000,
  retry: false,
} satisfies UseQueryOptions<SessionUser | null>;

/** The session hook every client component reads. */
export function useSession(): UseSession {
  const query = useQuery(sessionQueryOptions);
  const user = query.data ?? null;
  const setUser = useSessionStore((state) => state.setUser);

  // Mirror the query result into the store so non-React code sees the same user.
  useEffect(() => {
    setUser(user);
  }, [setUser, user]);

  return {
    user,
    isLoading: query.isLoading,
    isAuthenticated: user !== null,
    isStaff: user !== null && STAFF_ROLES.has(user.role),
    can: (permission) => user?.permissions.includes(permission) ?? false,
    refetch: () => {
      void query.refetch();
    },
  };
}

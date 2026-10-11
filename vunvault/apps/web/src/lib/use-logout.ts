'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiPost } from './api';
import { useSessionStore } from './session';

/**
 * Logout mutation.
 *
 * The API clears the HttpOnly session cookie; this hook then wipes every
 * client-side trace of the session in the same tick — the whole query cache
 * (a logged-out viewer must never see stale privileged data flash past) and
 * the mirrored Zustand store — before replacing the route to `/login`.
 * `replace`, not `push`: the back button must not walk into a dead session.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    // TODO(backend-contract): POST /api/v1/auth/logout → 204 (session cookie cleared).
    mutationFn: () => apiPost<void>('/api/v1/auth/logout'),
    onSuccess: () => {
      queryClient.clear();
      useSessionStore.getState().clear();
      router.replace('/login');
    },
  });
}

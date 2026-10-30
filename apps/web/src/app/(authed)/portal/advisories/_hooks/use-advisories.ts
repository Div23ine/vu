import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClientAdvisory } from '@vunvault/contracts';
import { apiGet, apiPost } from '../../../../../lib/api';

/**
 * Portal advisories hooks — the client zero-day feed built in
 * an earlier iteration. The API serves only published advisories matched to the caller's
 * organisation (a retracted advisory is omitted — it never reaches the UI),
 * and acknowledge is idempotent per organisation.
 *
 * `queryKeys` (packages/lib) has no advisories entry yet and this task must
 * not touch packages/lib, so the key lives here — the an earlier iteration
 * `SECURITY_STATUS_KEY` precedent.
 *
 * No `'use client'` directive (the directive-free hook-module pattern): only client
 * components import this module.
 */

export const ADVISORIES_KEY = ['advisories'] as const;

/** Poll while the tab is visible; the real-time push arrives in Layer L12. */
const POLL_MS = 60_000;

export function useAdvisories() {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/advisories → 200 { data: ClientAdvisory[]; total }
    queryKey: ADVISORIES_KEY,
    queryFn: () =>
      apiGet<{ data: ClientAdvisory[]; total: number }>('/api/v1/advisories').then(
        (response) => response.data,
      ),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });
}

export function useAcknowledgeAdvisory() {
  const queryClient = useQueryClient();
  return useMutation({
    // TODO(backend-contract): POST /api/v1/advisories/:id/acknowledge → 204 (idempotent per org)
    mutationFn: (id: string) => apiPost<void>(`/api/v1/advisories/${id}/acknowledge`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ADVISORIES_KEY });
      const previous = queryClient.getQueryData<ClientAdvisory[]>(ADVISORIES_KEY);
      if (previous !== undefined) {
        queryClient.setQueryData<ClientAdvisory[]>(
          ADVISORIES_KEY,
          previous.map((item) => (item.id === id ? { ...item, acknowledged: true } : item)),
        );
      }
      return { previous };
    },
    onError: (_error, _id, context) => {
      // Roll the optimistic flip back; the card fires the `crit` toast.
      if (context?.previous !== undefined) {
        queryClient.setQueryData(ADVISORIES_KEY, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ADVISORIES_KEY });
    },
  });
}

/**
 * Display order: unacknowledged critical advisories pinned to the top,
 * everything else newest first.
 */
export function sortAdvisories(items: readonly ClientAdvisory[]): ClientAdvisory[] {
  return [...items].sort((a, b) => {
    const aPinned = a.severity === 'critical' && !a.acknowledged ? 1 : 0;
    const bPinned = b.severity === 'critical' && !b.acknowledged ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GateDecisionBody, ScanJob } from '@vunvault/contracts';
import { queryKeys } from '@vunvault/lib';
import { apiPost } from '../../../../../lib/api';

/**
 * Gate-decision hook — `POST /admin/scans/:id/gate-decision`.
 * EVERY outcome refreshes the queue: on success the row's gate/state
 * changed; on `409 payment_outstanding` the API RECORDED the attempt and
 * flipped the job to `blocked_payment`, so the list must show it; on
 * `409 already_released` somebody else got there first.
 *
 * No `'use client'` directive (the `use-login.ts` pattern).
 */

export function useGateDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    // TODO(backend-contract): POST /api/v1/admin/scans/:id/gate-decision
    //  body { decision; checks: Record<ReviewCheckKey, boolean>; note (min 10) }
    //  → 200 { data: ScanJob } | 403 forbidden
    //  | 409 { error: "payment_outstanding" | "not_reviewable" | "already_released" }
    mutationFn: ({ id, body }: { id: string; body: GateDecisionBody }) =>
      apiPost<{ data: ScanJob }>(`/api/v1/admin/scans/${id}/gate-decision`, body).then(
        (response) => response.data,
      ),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.scans.all() });
    },
  });
}

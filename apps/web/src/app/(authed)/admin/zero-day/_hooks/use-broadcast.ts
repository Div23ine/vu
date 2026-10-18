import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BroadcastRecord, EmergencyBroadcastBody } from '@vunvault/contracts';
import { apiGet, apiPost } from '../../../../../lib/api';
import { ADMIN_ADVISORIES_KEY } from './use-advisories-admin';

/**
 * Emergency broadcast hooks .
 *
 * Two writes share one mutation because they differ only in the URL segment and
 * the `kind` the API records: `POST …/:id/broadcast` for a first dispatch and
 * `POST …/:id/rebroadcast` for a published advisory. Both take the contract's
 * `EmergencyBroadcastBody` (five acknowledgements + the typed phrase) and both
 * answer `202 { data: BroadcastRecord }`.
 *
 * The delivery progress strip polls `GET …/:id/broadcasts` every 3 s and stops
 * on its own once the newest record settles (`sent` / `failed`) — the push
 * version arrives in Layer L12, so polling is the transport for now.
 *
 * The audience estimate lives in `use-advisories-admin.ts`: an earlier iteration's Publish
 * Controls panel renders the same numbers, and one query key must not be
 * fetched twice for one dialog.
 *
 * No `'use client'` directive (the `use-login.ts` pattern).
 */

export type BroadcastMode = 'initial' | 'rebroadcast';

export interface BroadcastInput {
  id: string;
  mode: BroadcastMode;
  body: EmergencyBroadcastBody;
}

/** Poll cadence for the delivery strip, per the spec. */
export const BROADCAST_POLL_MS = 3_000;

export function broadcastProgressKey(id: string | null) {
  return [...ADMIN_ADVISORIES_KEY, 'broadcasts', id] as const;
}

export function useBroadcastDispatch() {
  const queryClient = useQueryClient();
  return useMutation({
    // TODO(backend-contract): POST /api/v1/admin/advisories/:id/broadcast | /rebroadcast
    //  body { ack; confirmPhrase } → 202 { data: BroadcastRecord }
    //  | 400 validation_failed | 403 | 409 broadcast_in_progress | 422 advisory_incomplete
    mutationFn: ({ id, mode, body }: BroadcastInput) =>
      apiPost<{ data: BroadcastRecord }>(
        `/api/v1/admin/advisories/${id}/${mode === 'rebroadcast' ? 'rebroadcast' : 'broadcast'}`,
        body,
      ).then((response) => response.data),
    onSuccess: () => {
      // The advisory became published: refresh the desk's lists and tiles.
      void queryClient.invalidateQueries({ queryKey: ADMIN_ADVISORIES_KEY });
    },
  });
}

/**
 * The delivery records for one advisory, newest first.
 *
 * `enabled` keeps the poll off until a broadcast has actually been dispatched —
 * opening the desk must not start a 3 s timer for every advisory ever written.
 *
 * Since an earlier iteration the poll is the FALLBACK: while the SSE relay is up
 * (`isStreamLive`), progress frames patch this same cache key and a timer
 * would only race them. The settle-to-stop rule stays for the fallback path.
 */
export function useBroadcastProgress(
  advisoryId: string | null,
  enabled: boolean,
  isStreamLive: boolean = false,
) {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/admin/advisories/:id/broadcasts
    //  → 200 { data: BroadcastRecord[] }
    queryKey: broadcastProgressKey(advisoryId),
    enabled: enabled && advisoryId !== null,
    retry: false,
    refetchIntervalInBackground: false,
    queryFn: () =>
      apiGet<{ data: BroadcastRecord[] }>(`/api/v1/admin/advisories/${advisoryId}/broadcasts`).then(
        (response) => response.data,
      ),
    refetchInterval: (query) => {
      if (isStreamLive) return false;
      const latest = query.state.data?.[0];
      if (latest === undefined) return BROADCAST_POLL_MS;
      return latest.status === 'sent' || latest.status === 'failed' ? false : BROADCAST_POLL_MS;
    },
  });
}

/** The strip's `Delivering… <sent>/<audience>` figures, or null when settled. */
export interface BroadcastProgressView {
  sent: number;
  audience: number;
  settled: boolean;
  failed: boolean;
}

export function progressOf(
  records: readonly BroadcastRecord[] | undefined,
): BroadcastProgressView | null {
  const latest = records?.[0];
  if (latest === undefined) return null;
  return {
    sent: latest.sentDashboards,
    audience: latest.audienceDashboards,
    settled: latest.status === 'sent' || latest.status === 'failed',
    failed: latest.status === 'failed',
  };
}

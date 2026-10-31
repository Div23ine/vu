'use client';

import { useMutation } from '@tanstack/react-query';
import type { WaitlistBody } from '@vunvault/contracts';
import { apiPost } from '../../../lib/api';

/**
 * Waitlist signup hook.
 *
 * `POST /api/v1/waitlist` answers `202` for both new and duplicate
 * address+topic pairs, so the UI treats success as "you're on the list"
 * without leaking who already signed up.
 */
export function useJoinWaitlist() {
  return useMutation({
    mutationFn: (body: WaitlistBody) => apiPost<void>('/api/v1/waitlist', body),
  });
}

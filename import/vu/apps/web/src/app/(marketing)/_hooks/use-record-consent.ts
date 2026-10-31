'use client';

import { useMutation } from '@tanstack/react-query';
import type { ConsentBody } from '@vunvault/contracts';
import { apiPost } from '../../../lib/api';

/**
 * Consent recording hook .
 *
 * `POST /api/v1/consent` answers `204` — `apiPost<void>` resolves with
 * `undefined`, which the banner treats as success. A `400`/`429` or a network
 * failure rejects; the banner stays open and toasts (the choice is
 * optimistically treated as undecided).
 */
export function useRecordConsent() {
  return useMutation({
    // TODO(backend-contract): POST /api/v1/consent body ConsentBody → 204 | 400 validation_failed | 429 rate_limited
    mutationFn: (body: ConsentBody) => apiPost<void>('/api/v1/consent', body),
  });
}

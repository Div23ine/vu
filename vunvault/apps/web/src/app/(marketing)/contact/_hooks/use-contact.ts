'use client';

import { useMutation } from '@tanstack/react-query';
import type { ContactBody } from '@vunvault/contracts';
import { apiPost } from '../../../../lib/api';

/**
 * Contact submission hook (Task 57).
 *
 * The honeypot `website` field is client-only and travels as an extra key:
 * the API answers 201 and silently drops anything where it is filled — so a
 * bot gets the same success banner a human would, and never learns it lost.
 */

export type ContactPayload = ContactBody & { website?: string };

export function useSubmitContact() {
  return useMutation({
    // TODO(backend-contract): POST /api/v1/contact
    //   body { name; email; organization?; category; subject; message(10..5000); consent: true; website?: "" }
    //   → 201 { data: { id } } | 400 validation_failed | 429 rate_limited
    mutationFn: (payload: ContactPayload) =>
      apiPost<{ data: { id: string } }>('/api/v1/contact', payload).then(
        (response) => response.data.id,
      ),
  });
}

/** `REQ-` + the first 6 characters of the returned id, uppercased. */
export function contactReference(id: string): string {
  return `REQ-${id.slice(0, 6).toUpperCase()}`;
}

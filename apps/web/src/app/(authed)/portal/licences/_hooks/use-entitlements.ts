import { useMutation, useQuery } from '@tanstack/react-query';
import type { EntitlementView } from '@vunvault/contracts';
import { apiGet, apiPost } from '../../../../../lib/api';

/**
 * Entitlement hooks — the client's purchased product licences on
 * the an earlier iteration store API. The list is org-scoped server-side (keys of other
 * organisations never arrive); downloads are presigned URLs the browser
 * navigates to directly — the app never proxies file bytes.
 *
 * `queryKeys` (packages/lib) has no entitlements entry and this task must
 * not touch packages/lib, so the key lives here — the an earlier iteration
 * `SECURITY_STATUS_KEY` precedent.
 *
 * No `'use client'` directive (the directive-free hook-module pattern).
 */

export const ENTITLEMENTS_KEY = ['entitlements'] as const;

export function useEntitlements() {
  return useQuery({
    // TODO(backend-contract): GET /api/v1/entitlements → 200 { data: EntitlementView[] }
    queryKey: ENTITLEMENTS_KEY,
    queryFn: () =>
      apiGet<{ data: EntitlementView[] }>('/api/v1/entitlements').then((response) => response.data),
  });
}

export interface EntitlementDownloadUrl {
  url: string;
  expiresAt: string;
}

export function useDownloadUrl() {
  return useMutation({
    // TODO(backend-contract): POST /api/v1/entitlements/:id/download-url
    //  → 200 { data: { url; expiresAt } } | 404 | 409 { error: "not_available" }
    mutationFn: (id: string) =>
      apiPost<{ data: EntitlementDownloadUrl }>(`/api/v1/entitlements/${id}/download-url`).then(
        (response) => response.data,
      ),
  });
}

/**
 * The masked key display: `VV-XXXX-••••-••••-XXXX` — the first and last
 * groups stay readable, the middle two are hidden until `Reveal`.
 */
export function maskLicenseKey(key: string): string {
  const parts = key.split('-');
  const prefix = parts[0];
  const first = parts[1];
  const last = parts[4];
  if (parts.length !== 5 || prefix === undefined || first === undefined || last === undefined) {
    return '••••-••••-••••-••••';
  }
  return `${prefix}-${first}-••••-••••-${last}`;
}

'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import type { ProductView, PurchaseResponse } from '@vunvault/contracts';
import { apiGet, apiPost } from '../../../../lib/api';

/**
 * Products query hooks (Task 55).
 *
 * The canonical key factory (`@vunvault/lib`'s `queryKeys`) predates the
 * store endpoints (Task 40b), so the catalogue key lives here until the
 * factory grows a `store` branch. The list is public and cacheable for 300 s
 * (routes-d); a purchase issues an invoice and nothing more — payment follows
 * in the portal (Task 66).
 */

export const productsQueryKey = ['store', 'products'] as const;

export function useProducts() {
  return useQuery({
    queryKey: productsQueryKey,
    // TODO(backend-contract): GET /api/v1/products → 200 { data: ProductView[]; total } (public, cacheable 300s)
    queryFn: () => apiGet<{ data: ProductView[]; total: number }>('/api/v1/products'),
    staleTime: 300_000,
  });
}

export function usePurchaseProduct() {
  return useMutation({
    // TODO(backend-contract): POST /api/v1/products/:id/purchase body { productId }
    //   → 201 PurchaseResponse | 401 | 403 { error: "no_org" }
    mutationFn: (productId: string) =>
      apiPost<PurchaseResponse>(`/api/v1/products/${productId}/purchase`, {
        productId,
      }).then((response) => response.data),
  });
}

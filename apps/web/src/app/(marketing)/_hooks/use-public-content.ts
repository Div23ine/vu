'use client';

import { useQuery } from '@tanstack/react-query';
import type { PublicContentItem } from '@vunvault/contracts';
import { queryKeys } from '@vunvault/lib';
import { apiGet } from '../../../lib/api';

/**
 * Public content query hooks — the read side of the marketing
 * site's blog/news data (an earlier iteration on the API). Public and cacheable: the
 * endpoint needs no session, so the hook never uses the quiet 401 path.
 */

export interface PublicContentParams {
  pageSize: number;
  sort: 'newest' | 'priority';
}

export function usePublicContent(params: PublicContentParams) {
  return useQuery({
    queryKey: queryKeys.content.published({ page: 1, ...params }),
    // TODO(backend-contract): GET /api/v1/content?page=1&pageSize=6&sort=newest
    //  → 200 { data: PublicContentItem[]; total } (public, cacheable 60s)
    queryFn: () =>
      apiGet<{ data: PublicContentItem[]; total: number }>(
        `/api/v1/content?page=1&pageSize=${params.pageSize}&sort=${params.sort}`,
      ).then((response) => response.data),
    staleTime: 60_000,
  });
}

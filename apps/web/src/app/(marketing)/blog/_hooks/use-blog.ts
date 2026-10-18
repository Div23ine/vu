'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  BlogCategory,
  NewsletterSubscribeBody,
  PublicContentDetail,
  PublicContentItem,
} from '@vunvault/contracts';
import { queryKeys } from '@vunvault/lib';
import { apiGet, apiPost } from '../../../../lib/api';

/**
 * Blog data hooks — the public content API consumed
 * from the client.
 *
 * The an earlier iteration `usePublicContent` hook stays as the home grid's fixed
 * `{ pageSize, sort }` reader; this file carries the full filter surface
 * (`q`, `category`, `sort`, `page`) the blog needs, plus the detail and
 * newsletter calls.
 */

export interface BlogFilters {
  q: string;
  category: BlogCategory | 'all';
  sort: 'newest' | 'priority';
}

export const DEFAULT_BLOG_FILTERS: BlogFilters = { q: '', category: 'all', sort: 'newest' };

export interface BlogListParams {
  page?: number;
  pageSize?: number;
  filters?: BlogFilters;
}

function listQuery(params: Required<Pick<BlogListParams, 'page' | 'pageSize'>> & BlogFilters) {
  const search = new URLSearchParams();
  if (params.q !== '') search.set('q', params.q);
  if (params.category !== 'all') search.set('category', params.category);
  search.set('sort', params.sort);
  search.set('page', String(params.page));
  search.set('pageSize', String(params.pageSize));
  return search.toString();
}

// TODO(backend-contract): GET /api/v1/content?q=&category=&sort=newest|priority&page=&pageSize=12
//  → 200 { data: PublicContentItem[]; total } (public, cacheable 60s)
export function useBlogList({
  page = 1,
  pageSize = 12,
  filters,
}: BlogListParams & { filters: BlogFilters }) {
  const params = { page, pageSize, ...filters };
  return useQuery({
    queryKey: queryKeys.content.published(params),
    queryFn: () =>
      apiGet<{ data: PublicContentItem[]; total: number }>(
        `/api/v1/content?${listQuery(params)}`,
      ).then((response) => response),
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
}

/**
 * The unfiltered catalog snapshot the category pills are derived from — one
 * pill per category present in the loaded data, so the pill row must not
 * shrink when a filter is active.
 */
export function useBlogCategories() {
  return useQuery({
    queryKey: queryKeys.content.published({ scope: 'categories' }),
    queryFn: () =>
      apiGet<{ data: PublicContentItem[]; total: number }>(
        `/api/v1/content?sort=newest&page=1&pageSize=100`,
      ).then((response) => response.data),
    staleTime: 300_000,
  });
}

/** The featured card: `sort=priority` (severity critical→low, then newest). */
export function useFeaturedReport() {
  return useQuery({
    queryKey: queryKeys.content.published({ scope: 'featured' }),
    queryFn: () =>
      apiGet<{ data: PublicContentItem[]; total: number }>(
        `/api/v1/content?sort=priority&page=1&pageSize=1`,
      ).then((response) => response.data[0] ?? null),
    staleTime: 60_000,
  });
}

/** Detail key: the shared factory has no content-detail slot (an earlier iteration predates 40c). */
export const blogDetailQueryKey = (slug: string) => ['content', 'detail', slug] as const;

// TODO(backend-contract): GET /api/v1/content/:slug → 200 { data: PublicContentDetail } | 404
export function useBlogDetail(slug: string) {
  return useQuery({
    queryKey: blogDetailQueryKey(slug),
    queryFn: () =>
      apiGet<{ data: PublicContentDetail }>(`/api/v1/content/${slug}`).then(
        (response) => response.data,
      ),
    staleTime: 60_000,
  });
}

// TODO(backend-contract): POST /api/v1/newsletter body { email, source? } → 202 {} | 400 | 429
export function useNewsletterSubscribe() {
  return useMutation({
    mutationFn: (body: NewsletterSubscribeBody) =>
      apiPost<Record<string, never>>('/api/v1/newsletter', body),
  });
}

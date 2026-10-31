'use client';

import { useCallback, useState } from 'react';
import { CveTicker } from '../_components/cve-ticker';
import { BlogHero } from './_components/blog-hero';
import { FeaturedReport } from './_components/featured-report';
import { NewsList } from './_components/news-list';
import { NewsletterForm } from './_components/newsletter-form';
import { DEFAULT_BLOG_FILTERS, useBlogList, type BlogFilters } from './_hooks/use-blog';
import type { CategoryPillValue } from './_components/category-pills';

/**
 * `/blog` — the public news list.
 *
 * Client component: it owns the filter state (`q`, `category`, `sort`) the
 * hero, pills and list share. Section order per the spec: the an earlier iteration
 * CVE ticker above the hero, then featured report → grid → newsletter, with
 * The list query runs through the
 * same hook (and therefore the same cache key) in this page — for the
 * counter — and in `NewsList`; TanStack Query dedupes it into one request.
 *
 * The marketing layout supplies header/footer (the `company` footer variant
 * is pathname-derived for `/blog` — an earlier iteration).
 */

export default function BlogPage() {
  const [filters, setFilters] = useState<BlogFilters>(DEFAULT_BLOG_FILTERS);
  const [page, setPage] = useState(1);

  // The counter shows the list query's `total`.
  const { data } = useBlogList({ filters, page, pageSize: 12 });
  const total = data?.total ?? 0;

  const handleQueryChange = useCallback((q: string) => {
    setFilters((previous) => (previous.q === q ? previous : { ...previous, q }));
    setPage(1);
  }, []);

  const handleCategoryChange = useCallback((category: CategoryPillValue) => {
    setFilters((previous) =>
      previous.category === category ? previous : { ...previous, category },
    );
    setPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters(DEFAULT_BLOG_FILTERS);
    setPage(1);
  }, []);

  return (
    <>
      <CveTicker />
      <BlogHero
        total={total}
        query={filters.q}
        onQueryChange={handleQueryChange}
        category={filters.category}
        onCategoryChange={handleCategoryChange}
      />
      <FeaturedReport />
      <NewsList filters={filters} page={page} onClearFilters={handleClearFilters} />
      <NewsletterForm />
    </>
  );
}

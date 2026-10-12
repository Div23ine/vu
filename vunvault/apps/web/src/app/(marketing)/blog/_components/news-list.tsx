'use client';

import { SearchX } from 'lucide-react';
import { cn } from '@vunvault/lib';
import { SEVERITY_CHIP_LABELS } from '@vunvault/contracts';
import { Skeleton } from '@vunvault/ui';
import { ArticleCard } from '../../_components/article-card';
import { useBlogList, type BlogFilters } from '../_hooks/use-blog';
import '../_styles/blog.css';

/**
 * News list (Task 56) — the filterable article grid plus the verbatim empty
 * state. Cards reuse Task 49's `ArticleCard`, wrapped in a cell that pins the
 * severity chip (`vv-chip--critical|high|medium|low`, text from the
 * contract's `SEVERITY_CHIP_LABELS`) over the thumbnail — the card component
 * itself stays untouched.
 */

export interface NewsListProps {
  filters: BlogFilters;
  page: number;
  /** `Clear Filters` — resets search + category (and the page) upstream. */
  onClearFilters(): void;
}

export function NewsList({ filters, page, onClearFilters }: NewsListProps) {
  const { data, isLoading } = useBlogList({ filters, page, pageSize: 12 });
  const items = data?.data ?? [];

  return (
    <section className="vv-news-section" id="vv-news-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="vv-news-header">
          <div className="vv-news-header-title">
            <div className="flex items-center gap-2">
              <span className="h-[2px] w-6 bg-cyan-600 rounded-full" />
              <span
                className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700"
                id="vv-news-eyebrow"
              >
                ALL REPORTS
              </span>
            </div>
            <h2 id="vv-news-heading">From the VUNVAULT Newsroom</h2>
            <p id="vv-news-subheading">
              Browse every approved advisory, field report and analysis.
            </p>
          </div>
        </div>

        <div className="vv-news-grid" id="vv-news-grid" aria-busy={isLoading}>
          {isLoading
            ? [0, 1, 2].map((slot) => <Skeleton key={slot} className="h-[380px] rounded-lg" />)
            : items.map((item, index) => (
                <div key={item.id} className="vv-news-cell">
                  {item.severity !== null ? (
                    <span className={cn('vv-news-sev', `vv-chip--${item.severity}`)}>
                      {SEVERITY_CHIP_LABELS[item.severity]}
                    </span>
                  ) : null}
                  <ArticleCard item={item} index={index} />
                </div>
              ))}
        </div>

        {!isLoading && items.length === 0 ? (
          <div className="vv-empty" id="vv-empty">
            <div className="vv-empty-icon" aria-hidden="true">
              <SearchX size={26} />
            </div>
            <h3 className="vv-empty-title">No matching threat reports found</h3>
            <p className="vv-empty-text">
              Nothing in our current advisory set matches that query. Try a broader search term,
              switch categories, or clear the filters to see the full feed.
            </p>
            <button
              type="button"
              className="vv-empty-reset"
              id="vv-empty-reset"
              onClick={onClearFilters}
            >
              Clear Filters
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

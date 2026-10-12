'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { CategoryPills, type CategoryPillValue } from './category-pills';
import '../_styles/blog.css';

/**
 * Blog hero (Task 56) — eyebrow, title, the debounced search and the result
 * counter. The search input keeps a local value and propagates it 250 ms
 * after the last keystroke (the catalogue's debounce), so typing never
 * request-storms the API.
 */

export interface BlogHeroProps {
  /** `total` from the list query — rendered in the live counter. */
  total: number;
  query: string;
  onQueryChange(q: string): void;
  category: CategoryPillValue;
  onCategoryChange(category: CategoryPillValue): void;
}

export function BlogHero({
  total,
  query,
  onQueryChange,
  category,
  onCategoryChange,
}: BlogHeroProps) {
  const [value, setValue] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => onQueryChange(value), 250);
    return () => clearTimeout(timer);
  }, [value, onQueryChange]);

  return (
    <section className="vv-blog-hero">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="vv-blog-hero-inner">
          <span className="hero-eyebrow">Threat Intelligence · Field Reports</span>
          <h1 className="vv-blog-title">News &amp; Threat Reports</h1>
          <p className="vv-blog-sub">
            CVE analysis, incident-response field notes and defensive engineering from the VUNVAULT
            sensor network — written for the people who have to act on it.
          </p>

          <div className="vv-blog-controls">
            <label className="vv-blog-search" aria-label="Search reports">
              <Search size={18} aria-hidden="true" />
              <input
                id="vv-blog-search"
                type="search"
                placeholder="Search reports, CVEs, vendors, categories…"
                autoComplete="off"
                aria-label="Search reports"
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </label>
            <div className="vv-blog-counter" id="vv-blog-counter" aria-live="polite">
              Showing {total} reports
            </div>
          </div>

          <CategoryPills active={category} onSelect={onCategoryChange} />
        </div>
      </div>
    </section>
  );
}

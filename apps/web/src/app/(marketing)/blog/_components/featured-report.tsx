'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@vunvault/lib';
import { SEVERITY_CHIP_LABELS } from '@vunvault/contracts';
import { ArticleThumb } from '../../_components/article-thumb';
import { formatPublishedDate } from '../../_components/article-card';
import { useFeaturedReport } from '../_hooks/use-blog';
import '../_styles/blog.css';

/**
 * Featured report — the dark banner card above the grid.
 *
 * The item is the first row of `sort=priority` (severity critical→low, then
 * newest), exactly as the spec specifies. Hidden until the query
 * resolves (the design ships the section `hidden` and reveals it from JS).
 */
export function FeaturedReport() {
  const { data, isLoading } = useFeaturedReport();

  if (isLoading || data === null || data === undefined) return null;
  const item = data;

  return (
    <section className="vv-featured-wrap" id="vv-featured-wrap">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link href={`/blog/${item.slug}`} className="vv-featured" id="vv-featured">
          <div className="vv-featured-thumb" id="vv-featured-thumb">
            <ArticleThumb index={0} />
            <span className="vv-featured-badge">Featured Report</span>
          </div>
          <div className="vv-featured-body">
            <span className="vv-featured-eyebrow">Editor&apos;s Pick · Highest Priority</span>
            <h2 className="vv-featured-title" id="vv-featured-title">
              {item.title}
            </h2>
            <p className="vv-featured-excerpt" id="vv-featured-excerpt">
              {item.excerpt}
            </p>
            <div className="vv-featured-meta" id="vv-featured-meta">
              {item.categoryLabel !== null ? <span>{item.categoryLabel}</span> : null}
              <span>{formatPublishedDate(item.publishedAt)}</span>
              {item.readMinutes !== null ? <span>{item.readMinutes} min read</span> : null}
              {item.severity !== null ? (
                <span className={cn('vv-news-sev', 'vv-chip--static', `vv-chip--${item.severity}`)}>
                  {SEVERITY_CHIP_LABELS[item.severity]}
                </span>
              ) : null}
            </div>
            <span className="vv-featured-cta">
              Read Full Report
              <ArrowRight size={15} aria-hidden="true" />
            </span>
          </div>
        </Link>
      </div>
    </section>
  );
}

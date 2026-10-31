import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { PublicContentItem } from '@vunvault/contracts';
import { cn } from '@vunvault/lib';
import { ArticleThumb } from './article-thumb';
import '../_styles/home-mid.css';

/**
 * Article card (an earlier iteration, shared with the Blog list in an earlier iteration).
 *
 * The design rendered this markup from JS; here it is a component fed by
 * the public content API. The thumbnail is the item's `featuredImageUrl`
 * through `next/image` when present, otherwise the deterministic generated
 * illustration (`index % 6`). The whole card is one link to `slugPath`
 * (`/blog/<slug>`).
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `MMM D, YYYY` in UTC — e.g. `Aug 14, 2026`. */
export function formatPublishedDate(iso: string): string {
  const date = new Date(iso);
  const month = MONTHS[date.getUTCMonth()] ?? '';
  return `${month} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

export interface ArticleCardProps {
  item: PublicContentItem;
  /** Position used to pick the generated thumbnail variant. */
  index: number;
  /** Applies the `is-news-entering` animation (rotation re-entry). */
  entering?: boolean;
  /** Per-card animation stagger, in milliseconds. */
  enterDelayMs?: number;
}

export function ArticleCard({ item, index, entering = false, enterDelayMs = 0 }: ArticleCardProps) {
  return (
    <Link
      href={item.slugPath}
      className={cn('vv-article-card', entering && 'is-news-entering')}
      style={entering ? { animationDelay: `${enterDelayMs}ms` } : undefined}
    >
      <div className="vv-article-thumb">
        {item.featuredImageUrl !== null ? (
          <Image
            src={item.featuredImageUrl}
            alt={item.imageAlt ?? item.title}
            fill
            sizes="(max-width: 680px) 100vw, (max-width: 980px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <ArticleThumb index={index} />
        )}
        {item.categoryLabel !== null ? (
          <span className="vv-article-thumb-badge">{item.categoryLabel}</span>
        ) : null}
      </div>
      <div className="vv-article-body">
        <div className="vv-article-meta">
          <span>{formatPublishedDate(item.publishedAt)}</span>
          {item.readMinutes !== null ? (
            <>
              <span>·</span>
              <span>{item.readMinutes} min read</span>
            </>
          ) : null}
        </div>
        <h3 className="vv-article-title">{item.title}</h3>
        {item.excerpt !== null ? <p className="vv-article-excerpt">{item.excerpt}</p> : null}
        <span className="vv-article-link">
          <span>Read Full Article</span>
          <ArrowRight size={15} aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

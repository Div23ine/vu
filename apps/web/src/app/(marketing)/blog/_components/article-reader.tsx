import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { PublicContentDetail } from '@vunvault/contracts';
import { SEVERITY_CHIP_LABELS } from '@vunvault/contracts';
import { cn } from '@vunvault/lib';
import { ArticleThumb } from '../../_components/article-thumb';
import { formatPublishedDate } from '../../_components/article-card';
import { SafeMarkdown } from './safe-markdown';
import '../_styles/blog.css';

/* The featured image is a remote CDN asset; `next/image` refuses SVGs and
 * unconfigured hosts, but the reader's hero is a raster photograph slot —
 * the optimiser is the right tool here (host allowlist lives in
 * next.config.ts). */

/**
 * Article reader — the `/blog/[slug]` detail view.
 *
 * Server component: the page fetches the detail on the edge and hands the
 * parsed `PublicContentDetail` down. The body renders through `SafeMarkdown`
 * only — never `dangerouslySetInnerHTML`, never raw HTML. The back control
 * appears above and below the body, exactly as in the design (as links,
 * since it navigates).
 */

export interface ArticleReaderProps {
  item: PublicContentDetail;
}

function BackLink() {
  return (
    <Link href="/blog" className="vv-reader-back">
      <ArrowLeft size={14} aria-hidden="true" />
      <span>Back to News / All Reports</span>
    </Link>
  );
}

export function ArticleReader({ item }: ArticleReaderProps) {
  return (
    <section className="vv-reader" id="vv-article-reader">
      <div className="vv-reader-inner">
        <BackLink />

        <header className="vv-reader-header">
          <div className="vv-reader-cat-row" id="vv-reader-cat-row">
            {item.categoryLabel !== null ? (
              <span className="vv-reader-cat">{item.categoryLabel}</span>
            ) : null}
            {item.severity !== null ? (
              <span className={cn('vv-news-sev', 'vv-chip--static', `vv-chip--${item.severity}`)}>
                {SEVERITY_CHIP_LABELS[item.severity]}
              </span>
            ) : null}
          </div>
          <h1 className="vv-reader-title" id="vv-reader-title">
            {item.title}
          </h1>
          <div className="vv-reader-meta" id="vv-reader-meta">
            <span>
              By <strong>{item.author.fullName}</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>{formatPublishedDate(item.publishedAt)}</span>
            {item.readMinutes !== null ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{item.readMinutes} min read</span>
              </>
            ) : null}
          </div>
        </header>

        <div className="vv-reader-hero" id="vv-reader-hero">
          {item.featuredImageUrl !== null ? (
            <Image
              src={item.featuredImageUrl}
              alt={item.imageAlt ?? item.title}
              fill
              sizes="(max-width: 1024px) 100vw, 46rem"
              className="object-cover"
              priority
            />
          ) : (
            <ArticleThumb index={0} />
          )}
        </div>

        <div className="vv-reader-body" id="vv-reader-body">
          <SafeMarkdown source={item.bodyMd} />
        </div>

        <footer className="vv-reader-foot">
          <div className="vv-reader-tags" id="vv-reader-tags">
            {item.tags.map((tag) => (
              <span key={tag} className="vv-reader-tag">
                {tag}
              </span>
            ))}
          </div>
          <BackLink />
        </footer>
      </div>
    </section>
  );
}

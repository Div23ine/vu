import Link from 'next/link';
import type { PublicContentItem } from '@vunvault/contracts';
import { ArticleCard } from '../../_components/article-card';

/**
 * Server-rendered news index: the list, its metadata line and the pagination
 * are plain HTML so the newsroom reads correctly with JavaScript disabled
 * and crawls cleanly. Filters arrive as GET query parameters from the form
 * on the page — no JS required to apply them either.
 */

export interface NewsIndexProps {
  items: readonly PublicContentItem[];
  page: number;
  totalPages: number;
  total: number;
  query: { q: string; category: string; sort: string };
}

function pageHref(page: number, query: NewsIndexProps['query']): string {
  const params = new URLSearchParams();
  if (page > 1) params.set('page', String(page));
  if (query.category !== '') params.set('category', query.category);
  if (query.sort !== 'newest') params.set('sort', query.sort);
  const qs = params.toString();
  return qs === '' ? '/blog' : `/blog?${qs}`;
}

export function NewsIndex({ items, page, totalPages, total, query }: NewsIndexProps) {
  return (
    <section aria-label="News and blog articles" className="vv-blog-grid-wrap">
      {items.length === 0 ? (
        <p className="text-neutral-500 text-sm">
          Nothing published under these filters yet —{' '}
          <Link href="/blog" className="font-bold text-cyan-700 underline">
            clear the filters
          </Link>
          .
        </p>
      ) : (
        <div className="vv-blog-grid">
          {items.map((item, index) => (
            <ArticleCard key={item.id} item={item} index={index} />
          ))}
        </div>
      )}
      <p className="vv-news-count" role="status">
        {total} published {total === 1 ? 'piece' : 'pieces'} · page {page} of{' '}
        {Math.max(totalPages, 1)}
      </p>
      {totalPages > 1 && (
        <nav aria-label="Blog pagination" className="vv-news-pagination">
          {page > 1 ? (
            <Link rel="prev" href={pageHref(page - 1, query)}>
              ← Newer
            </Link>
          ) : (
            <span aria-disabled="true">← Newer</span>
          )}
          {page < totalPages ? (
            <Link rel="next" href={pageHref(page + 1, query)}>
              Older →
            </Link>
          ) : (
            <span aria-disabled="true">Older →</span>
          )}
        </nav>
      )}
    </section>
  );
}

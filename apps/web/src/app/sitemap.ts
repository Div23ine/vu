import type { MetadataRoute } from 'next';
import {
  PublicContentItem as PublicContentItemSchema,
  type PublicContentItem,
} from '@vunvault/contracts';
import { env } from '../env';
import { INDEXABLE_ROUTES, siteUrl } from '../lib/seo';

/**
 * `/sitemap.xml` — generated from the same route table `robots.ts` and
 * `llms.txt` read, so a page cannot appear in one surface and not the others.
 *
 * `lastModified` is emitted ONLY where a real timestamp exists (blog articles,
 * from `publishedAt`). The static routes deliberately omit it rather than
 * stamping "now": a date that changes on every regeneration tells crawlers
 * nothing except that the file was rebuilt, and chronic inaccuracy makes the
 * field get ignored everywhere.
 *
 * Blog articles are fetched best-effort. If the content API is down, slow or
 * returns something that fails the contract parse, the sitemap still ships every
 * static route — a partial sitemap is far better than a 500, which would drop the
 * whole file. The `revalidate` window is per-isolate on Cloudflare unless the R2
 * incremental cache is bound (see `wrangler.jsonc`), the same caveat the
 * `/blog/[slug]` route documents.
 */

export const revalidate = 3600;

/** How many articles one sitemap request asks the content API for. */
const ARTICLE_PAGE_SIZE = 200;

async function fetchArticles(): Promise<PublicContentItem[]> {
  try {
    const response = await fetch(
      `${env.NEXT_PUBLIC_API_URL}/api/v1/content?sort=newest&page=1&pageSize=${ARTICLE_PAGE_SIZE}`,
      { next: { revalidate } },
    );
    if (!response.ok) {
      console.warn(`[sitemap] content API responded ${response.status}; shipping static routes only`);
      return [];
    }
    const body: unknown = await response.json();
    const data = typeof body === 'object' && body !== null ? (body as { data?: unknown }).data : null;
    if (!Array.isArray(data)) {
      console.warn('[sitemap] content API envelope had no data array; shipping static routes only');
      return [];
    }
    // Parse each item individually: one malformed row must not discard the rest.
    const articles: PublicContentItem[] = [];
    for (const item of data) {
      const parsed = PublicContentItemSchema.safeParse(item);
      if (parsed.success) articles.push(parsed.data);
      else console.warn('[sitemap] skipped an article that failed the content contract');
    }
    return articles;
  } catch (error) {
    console.warn('[sitemap] content API unreachable; shipping static routes only', error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = INDEXABLE_ROUTES.map((route) => ({
    url: siteUrl(route.path),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const articles = await fetchArticles();
  const articleEntries: MetadataRoute.Sitemap = articles.map((article) => ({
    url: siteUrl(`/blog/${article.slug}`),
    lastModified: new Date(article.publishedAt),
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [...staticEntries, ...articleEntries];
}

import type { Metadata } from 'next';
import { fetchArticle } from './article-fetch';
import { ArticleReader } from '../_components/article-reader';
import { JsonLd } from '../../../../lib/json-ld';
import { SITE_NAME, articleJsonLd, breadcrumbJsonLd, siteUrl } from '../../../../lib/seo';

/** Breadcrumb trail shared by this route's markup and its `Article` graph. */
const ARTICLE_CRUMBS = [
  { name: SITE_NAME, path: '/' },
  { name: 'Blog & Advisories', path: '/blog' },
];

/**
 * `/blog/[slug]` — the article reader route.
 * Server-fetched with a 60 s revalidation window (the public content API is
 * cacheable). A 404 — or a payload that fails the contract parse — calls
 * `notFound()`. Metadata comes from the item itself: title, excerpt, and the
 * featured image for Open Graph.
 * This route deliberately does NOT declare `export const runtime = "edge"`.
 * `@opennextjs/cloudflare` runs Next's Node.js runtime on Workers and does not
 * support the Edge runtime for pages; declaring it here would break the build.
 * The `revalidate: 60` window is per-isolate unless the R2 incremental cache is
 * bound (see `wrangler.jsonc`).
 */
interface BlogArticlePageProps {
  params: Promise<{ slug: string }>;
}

// TODO(backend-contract): GET /api/v1/content/:slug → 200 { data: PublicContentDetail } | 404 { error: "not_found" }

export async function generateMetadata({ params }: BlogArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = await fetchArticle(slug);
  return {
    title: item.title,
    description: item.excerpt ?? undefined,
    // Overrides the `/blog` canonical inherited from `blog/layout.tsx`; without
    // this every article would canonicalise to the newsroom index.
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      type: 'article',
      url: siteUrl(`/blog/${slug}`),
      title: item.title,
      description: item.excerpt ?? undefined,
      publishedTime: item.publishedAt,
      authors: [item.author.fullName],
      ...(item.featuredImageUrl === null ? {} : { images: [item.featuredImageUrl] }),
    },
    twitter: {
      card: item.featuredImageUrl === null ? 'summary' : 'summary_large_image',
      title: item.title,
      description: item.excerpt ?? undefined,
    },
  };
}

export default async function BlogArticlePage({ params }: BlogArticlePageProps) {
  const { slug } = await params;
  const item = await fetchArticle(slug);
  return (
    <>
      {/* Article + breadcrumb graph: hands an answer engine the publication date,
          the author display name and the canonical URL explicitly instead of
          leaving it to infer them from the prose. */}
      <JsonLd
        data={articleJsonLd({
          title: item.title,
          slug,
          publishedAt: item.publishedAt,
          excerpt: item.excerpt,
          authorName: item.author.fullName,
          featuredImageUrl: item.featuredImageUrl,
        })}
      />
      <JsonLd data={breadcrumbJsonLd(ARTICLE_CRUMBS)} />
      <ArticleReader item={item} />
    </>
  );
}

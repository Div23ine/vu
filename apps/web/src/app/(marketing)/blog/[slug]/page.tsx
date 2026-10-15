import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  PublicContentDetail as PublicContentDetailSchema,
  type PublicContentDetail,
} from '@vunvault/contracts';
import { env } from '../../../../env';
import { ArticleReader } from '../_components/article-reader';

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
async function fetchArticle(slug: string): Promise<PublicContentDetail> {
  const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/v1/content/${slug}`, {
    next: { revalidate: 60 },
  });
  if (!response.ok) notFound();
  const body: unknown = await response.json();
  const data = typeof body === 'object' && body !== null ? (body as { data?: unknown }).data : null;
  const parsed = PublicContentDetailSchema.safeParse(data);
  if (!parsed.success) notFound();
  return parsed.data;
}

export async function generateMetadata({ params }: BlogArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = await fetchArticle(slug);
  return {
    title: item.title,
    description: item.excerpt ?? undefined,
    openGraph: item.featuredImageUrl === null ? undefined : { images: [item.featuredImageUrl] },
  };
}

export default async function BlogArticlePage({ params }: BlogArticlePageProps) {
  const { slug } = await params;
  const item = await fetchArticle(slug);
  return <ArticleReader item={item} />;
}

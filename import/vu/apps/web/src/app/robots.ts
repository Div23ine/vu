import type { MetadataRoute } from 'next';
import {
  DISALLOWED_PREFIXES,
  NOINDEX_PREFIXES,
  isPublicSiteUrl,
  siteOrigin,
  siteUrl,
} from '../lib/seo';

/**
 * `/robots.txt` — generated, never hand-edited in `public/`.
 *
 * The policy splits pages into three buckets, and the split is the whole design:
 *
 * - **Crawlable and indexable** — the marketing site. Allowed implicitly.
 * - **Crawlable but NOT indexable** (`NOINDEX_PATHS`: `/login`, `/signup`,
 *   `/checkout`, `/academy`, …). These are deliberately absent from `disallow`.
 *   A disallowed page cannot be fetched, so Google never sees its `noindex` tag
 *   and may still list the bare URL from inbound links. Letting the crawler in is
 *   what makes the `noindex` on those pages actually work.
 * - **Private / not pages at all** (`NOINDEX_PREFIXES`: `/portal`, `/admin`,
 *   `/onboarding`; `DISALLOWED_PREFIXES`: payment callbacks and `/api`).
 *   Disallowed: nothing public links to them and crawling them wastes budget.
 *
 * A blanket `Disallow: /` is emitted instead whenever `NEXT_PUBLIC_SITE_URL` is
 * not a real public host, so a laptop, a preview deployment or a staging host can
 * never be indexed as duplicate content.
 *
 * AI crawlers get their own group with the SAME disallow list. robots.txt groups
 * do not inherit: a bot that matches `GPTBot` ignores the `*` group entirely, so
 * omitting the disallows there would have exposed `/portal` to exactly the
 * crawlers we most want to answer questions about us. Allowing them is the point
 * of the AEO work — see `docs/seo-runbook.md` for the opt-out lines if training
 * use is ever declined (blocking `Google-Extended` does not affect Google Search).
 */

const DISALLOW: readonly string[] = [...NOINDEX_PREFIXES, ...DISALLOWED_PREFIXES];

/** Answer-engine and search-retrieval crawlers, allowed with identical limits. */
const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Applebot-Extended',
  'Amazonbot',
  'cohere-ai',
  'CCBot',
] as const;

export default function robots(): MetadataRoute.Robots {
  if (!isPublicSiteUrl()) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
    };
  }

  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: [...DISALLOW] },
      { userAgent: [...AI_CRAWLERS], allow: '/', disallow: [...DISALLOW] },
    ],
    sitemap: siteUrl('/sitemap.xml'),
    host: siteOrigin(),
  };
}

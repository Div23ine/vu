import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import robots from './robots';
import sitemap from './sitemap';
import { GET as llmsTxt } from './llms.txt/route';
import {
  DISALLOWED_PREFIXES,
  INDEXABLE_ROUTES,
  NOINDEX_PATHS,
  NOINDEX_PREFIXES,
  ORGANISATION_FACTS,
  SEO_GROUPS,
  SITE_DESCRIPTION,
  SITE_NAME,
  siteOrigin,
  siteUrl,
} from '../lib/seo';
import { HOME_QA } from './(marketing)/_components/qa-data';

/**
 * The three generated crawler surfaces. The invariant that matters is that they
 * all read the SAME route table: a page that is in the sitemap but missing from
 * `llms.txt`, or a private path that leaks into any of them, is the failure mode
 * these tests exist to catch.
 *
 * `env.NEXT_PUBLIC_SITE_URL` is `https://www.vunvault.test` under vitest (see
 * `vitest.config.ts`), which `isPublicSiteUrl` treats as a real host, so
 * `robots()` returns the production-shaped policy here. The non-public branch is
 * covered by the `isPublicSiteUrl` unit tests in `lib/seo.test.ts`.
 */

const ARTICLE = {
  id: 'f0000000-0000-4000-8000-000000000006',
  type: 'threat_advisory',
  title: 'Unsigned payment callbacks in the wild',
  excerpt: 'A callback with no signature is an invitation.',
  slug: 'unsigned-payment-callbacks',
  slugPath: '/news/unsigned-payment-callbacks',
  category: null,
  categoryLabel: null,
  severity: null,
  tags: [],
  readMinutes: 6,
  featuredImageUrl: null,
  imageAlt: null,
  publishedAt: '2026-09-21T12:00:00Z',
  author: { fullName: 'Grace Wanjiru' },
};

function stubFetch(implementation: typeof fetch): void {
  vi.stubGlobal('fetch', implementation);
}

/**
 * The degradation paths log a `warn` by design — an operator needs to know the
 * sitemap shipped without articles. The tests assert the behaviour, not the noise,
 * so the warnings are captured instead of printed.
 */
let warnings: unknown[][];

beforeEach(() => {
  warnings = [];
  vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    warnings.push(args);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('robots.txt', () => {
  it('advertises the sitemap and the host', () => {
    const policy = robots();
    expect(policy.sitemap).toBe(siteUrl('/sitemap.xml'));
    expect(policy.host).toBe(siteOrigin());
  });

  it('disallows private and machine-to-machine prefixes only', () => {
    const rules = robots().rules as Array<{ userAgent: string | string[]; disallow?: string[] }>;
    const [wildcard] = rules;
    if (wildcard === undefined) throw new Error('expected a wildcard robots rule');
    expect(wildcard.userAgent).toBe('*');
    expect(wildcard.disallow).toEqual([...NOINDEX_PREFIXES, ...DISALLOWED_PREFIXES]);
    for (const prefix of [...NOINDEX_PREFIXES, ...DISALLOWED_PREFIXES]) {
      expect(wildcard.disallow).toContain(prefix);
    }
  });

  it('keeps noindex pages CRAWLABLE so their meta tag is actually seen', () => {
    const rules = robots().rules as Array<{ disallow?: string[] }>;
    for (const rule of rules) {
      for (const path of NOINDEX_PATHS) {
        expect(rule.disallow ?? []).not.toContain(path);
      }
    }
  });

  it('gives AI crawlers the identical disallow list', () => {
    const rules = robots().rules as Array<{ userAgent: string | string[]; disallow?: string[] }>;
    expect(rules).toHaveLength(2);
    const [wildcard, ai] = rules;
    if (wildcard === undefined || ai === undefined) {
      throw new Error('expected a wildcard rule and an AI-crawler rule');
    }
    // robots.txt groups do not inherit: an AI bot matching this group ignores the
    // wildcard group entirely, so the disallows MUST be repeated or `/portal`
    // would be wide open to exactly the crawlers we want answering for us.
    expect(Array.isArray(ai.userAgent)).toBe(true);
    expect(ai.disallow).toEqual(wildcard.disallow);
    expect(ai.userAgent).toContain('GPTBot');
    expect(ai.userAgent).toContain('PerplexityBot');
    expect(ai.userAgent).toContain('ClaudeBot');
  });
});

describe('sitemap.xml', () => {
  it('lists every indexable route with its real URL and hints', async () => {
    stubFetch((() => Promise.resolve(new Response(JSON.stringify({ data: [], total: 0 })))) as typeof fetch);

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(entries).toHaveLength(INDEXABLE_ROUTES.length);
    for (const route of INDEXABLE_ROUTES) {
      const entry = entries.find((candidate) => candidate.url === siteUrl(route.path));
      expect(entry, `missing sitemap entry for ${route.path}`).toBeDefined();
      expect(entry?.changeFrequency).toBe(route.changeFrequency);
      expect(entry?.priority).toBe(route.priority);
    }
    expect(urls).toContain(siteUrl('/'));
  });

  it('never emits a private, transactional or placeholder route', async () => {
    stubFetch((() => Promise.resolve(new Response(JSON.stringify({ data: [], total: 0 })))) as typeof fetch);
    const urls = (await sitemap()).map((entry) => entry.url);

    for (const path of NOINDEX_PATHS) expect(urls).not.toContain(siteUrl(path));
    for (const prefix of [...NOINDEX_PREFIXES, ...DISALLOWED_PREFIXES]) {
      for (const url of urls) expect(url.startsWith(`${siteOrigin()}${prefix}`)).toBe(false);
    }
    expect(urls).not.toContain(siteUrl('/academy'));
  });

  it('appends blog articles from the content API with their real publish date', async () => {
    stubFetch((() =>
      Promise.resolve(new Response(JSON.stringify({ data: [ARTICLE], total: 1 })))) as typeof fetch);

    const entries = await sitemap();
    const article = entries.find((entry) => entry.url === siteUrl(`/blog/${ARTICLE.slug}`));
    expect(article).toBeDefined();
    expect(article?.lastModified).toEqual(new Date(ARTICLE.publishedAt));
    expect(entries).toHaveLength(INDEXABLE_ROUTES.length + 1);
  });

  it('asks the content API for the newest page of articles', async () => {
    const fetchMock = vi.fn((() =>
      Promise.resolve(new Response(JSON.stringify({ data: [], total: 0 })))) as unknown as typeof fetch);
    stubFetch(fetchMock);

    await sitemap();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requested = String(fetchMock.mock.calls[0]?.[0] ?? '');
    expect(requested).toContain('/api/v1/content?');
    expect(requested).toContain('sort=newest');
  });

  it('still ships every static route when the content API fails', async () => {
    stubFetch((() => Promise.reject(new Error('network down'))) as typeof fetch);
    const entries = await sitemap();
    expect(entries).toHaveLength(INDEXABLE_ROUTES.length);
    expect(entries.map((entry) => entry.url)).toContain(siteUrl('/'));
    // Degrading silently is the real risk: the warn must fire.
    expect(warnings.some((args) => String(args[0]).includes('unreachable'))).toBe(true);
  });

  it('still ships every static route on a 500 or a malformed envelope', async () => {
    stubFetch((() => Promise.resolve(new Response('boom', { status: 500 }))) as typeof fetch);
    expect(await sitemap()).toHaveLength(INDEXABLE_ROUTES.length);

    stubFetch((() => Promise.resolve(new Response(JSON.stringify({ nope: true })))) as typeof fetch);
    expect(await sitemap()).toHaveLength(INDEXABLE_ROUTES.length);
  });

  it('skips a row that fails the content contract but keeps its siblings', async () => {
    stubFetch((() =>
      Promise.resolve(
        new Response(JSON.stringify({ data: [{ ...ARTICLE, publishedAt: null }, ARTICLE], total: 2 })),
      )) as typeof fetch);

    const entries = await sitemap();
    expect(entries).toHaveLength(INDEXABLE_ROUTES.length + 1);
  });
});

describe('llms.txt', () => {
  it('is served as plain text and leads with the entity', async () => {
    const response = llmsTxt();
    expect(response.headers.get('content-type')).toContain('text/plain');

    const text = await response.text();
    expect(text.startsWith(`# ${SITE_NAME}\n`)).toBe(true);
    expect(text).toContain(`> ${SITE_DESCRIPTION}`);
    expect(text).toContain(ORGANISATION_FACTS.email);
    expect(text).toContain(ORGANISATION_FACTS.addressLocality);
  });

  it('lists one absolute link per indexable route, under its group heading', async () => {
    const text = await llmsTxt().text();
    for (const route of INDEXABLE_ROUTES) {
      expect(text).toContain(`- [${route.title}](${siteUrl(route.path)}): ${route.summary}`);
    }
    for (const group of SEO_GROUPS) expect(text).toContain(`## ${group}`);
  });

  it('leaks no private, transactional or placeholder path', async () => {
    const text = await llmsTxt().text();
    for (const path of NOINDEX_PATHS) expect(text).not.toContain(`${siteOrigin()}${path}`);
    for (const prefix of [...NOINDEX_PREFIXES, ...DISALLOWED_PREFIXES]) {
      expect(text).not.toContain(`${siteOrigin()}${prefix}`);
    }
    expect(text).not.toContain('/portal');
    expect(text).not.toContain('/admin');
    expect(text).not.toContain('/academy');
  });

  it('carries the published Q&A so an answer engine can cite it verbatim', async () => {
    const text = await llmsTxt().text();
    expect(text).toContain('## Questions buyers ask');
    expect(HOME_QA.length).toBeGreaterThan(0);
    for (const entry of HOME_QA) {
      expect(text).toContain(`### ${entry.q}`);
      expect(text).toContain(entry.a);
    }
  });
});

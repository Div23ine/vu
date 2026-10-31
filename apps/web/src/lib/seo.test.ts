import { describe, expect, it } from 'vitest';
import {
  DISALLOWED_PREFIXES,
  INDEXABLE_ROUTES,
  NOINDEX_PATHS,
  NOINDEX_PREFIXES,
  ORGANISATION_FACTS,
  SEO_GROUPS,
  BRAND_ASSETS,
  SITE_ALTERNATE_NAMES,
  SITE_DESCRIPTION,
  SITE_NAME,
  articleJsonLd,
  breadcrumbJsonLd,
  faqJsonLd,
  findRoute,
  isPublicSiteUrl,
  organisationJsonLd,
  routesByGroup,
  serviceJsonLd,
  siteOrigin,
  siteUrl,
  webSiteJsonLd,
} from './seo';
import { serialiseJsonLd } from './json-ld';

/**
 * The SEO/AEO surfaces are generated from one route table, so the invariants that
 * matter are cross-surface consistency and the deliberate omissions. A wrong
 * canonical or an invented `logo` is the kind of mistake that quietly costs
 * rankings for weeks, which is why these are pinned here rather than eyeballed.
 */

describe('siteUrl', () => {
  it('exposes a trailing-slash-free origin', () => {
    expect(siteOrigin()).not.toMatch(/\/$/);
    expect(siteOrigin()).toMatch(/^https?:\/\//);
  });

  it('keeps the trailing slash on the root and drops it everywhere else', () => {
    expect(siteUrl('/')).toBe(`${siteOrigin()}/`);
    expect(siteUrl()).toBe(`${siteOrigin()}/`);
    expect(siteUrl('/about')).toBe(`${siteOrigin()}/about`);
    expect(siteUrl('about')).toBe(`${siteOrigin()}/about`);
    expect(siteUrl('/services/penetration-testing/')).toBe(
      `${siteOrigin()}/services/penetration-testing`,
    );
    expect(siteUrl('//pricing//')).toBe(`${siteOrigin()}/pricing`);
  });

  it('produces absolute URLs for every indexable route', () => {
    for (const route of INDEXABLE_ROUTES) {
      const url = siteUrl(route.path);
      expect(url.startsWith(siteOrigin())).toBe(true);
      expect(url).not.toBe(siteOrigin());
    }
  });
});

describe('isPublicSiteUrl', () => {
  it('accepts a real https host', () => {
    expect(isPublicSiteUrl('https://www.vunvault.com')).toBe(true);
    expect(isPublicSiteUrl('https://vunvault.com')).toBe(true);
  });

  it('rejects anything a crawler should never index', () => {
    expect(isPublicSiteUrl('http://localhost:3000')).toBe(false);
    expect(isPublicSiteUrl('https://localhost')).toBe(false);
    expect(isPublicSiteUrl('http://127.0.0.1:3000')).toBe(false);
    expect(isPublicSiteUrl('https://192.168.1.10')).toBe(false);
    expect(isPublicSiteUrl('https://10.0.0.4')).toBe(false);
    expect(isPublicSiteUrl('https://preview.local')).toBe(false);
    // Plain http on a real host is not a canonical origin either.
    expect(isPublicSiteUrl('http://www.vunvault.com')).toBe(false);
    expect(isPublicSiteUrl('not a url')).toBe(false);
    expect(isPublicSiteUrl('')).toBe(false);
  });
});

describe('the route table', () => {
  it('has unique, well-formed paths', () => {
    const paths = INDEXABLE_ROUTES.map((route) => route.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toContain('/');
    for (const path of paths) {
      expect(path.startsWith('/')).toBe(true);
      if (path !== '/') expect(path.endsWith('/')).toBe(false);
    }
  });

  it('gives every route real copy for llms.txt and the sitemap', () => {
    for (const route of INDEXABLE_ROUTES) {
      expect(route.title.trim().length).toBeGreaterThan(0);
      expect(route.summary.trim().length).toBeGreaterThan(0);
      expect(route.priority).toBeGreaterThanOrEqual(0);
      expect(route.priority).toBeLessThanOrEqual(1);
      expect(SEO_GROUPS).toContain(route.group);
    }
  });

  it('buckets every route into exactly one llms.txt group', () => {
    const grouped = routesByGroup().flatMap((bucket) => bucket.routes.map((route) => route.path));
    expect(grouped.length).toBe(INDEXABLE_ROUTES.length);
    expect(new Set(grouped).size).toBe(grouped.length);
    // No route is silently dropped by a group typo.
    for (const route of INDEXABLE_ROUTES) expect(grouped).toContain(route.path);
  });

  it('never lists a private, transactional or placeholder route as indexable', () => {
    for (const route of INDEXABLE_ROUTES) {
      expect(NOINDEX_PATHS).not.toContain(route.path as (typeof NOINDEX_PATHS)[number]);
      for (const prefix of [...NOINDEX_PREFIXES, ...DISALLOWED_PREFIXES]) {
        expect(route.path.startsWith(prefix)).toBe(false);
      }
    }
    // The placeholder academy page and the checkout flow stay out.
    expect(findRoute('/academy')).toBeUndefined();
    expect(findRoute('/checkout')).toBeUndefined();
    expect(findRoute('/portal')).toBeUndefined();
  });

  it('names the home page after the brand so "vunvault" has an exact anchor', () => {
    const home = findRoute('/');
    expect(home?.title).toContain(SITE_NAME);
    expect(home?.priority).toBe(1);
  });
});

describe('organization / website JSON-LD', () => {
  it('describes the entity with only facts the site already publishes', () => {
    const org = organisationJsonLd();
    expect(org['@type']).toBe('Organization');
    expect(org['@id']).toBe(`${siteUrl('/')}#organization`);
    expect(org['name']).toBe(SITE_NAME);
    expect(org['alternateName']).toEqual([...SITE_ALTERNATE_NAMES]);
    expect(org['url']).toBe(siteUrl('/'));
    expect(org['description']).toBe(SITE_DESCRIPTION);
    expect(org['email']).toBe(ORGANISATION_FACTS.email);
    expect(org['address']).toMatchObject({
      '@type': 'PostalAddress',
      addressLocality: ORGANISATION_FACTS.addressLocality,
      addressCountry: ORGANISATION_FACTS.addressCountry,
    });
  });

  it('points logo at the rendered raster, not the SVG', () => {
    const org = organisationJsonLd();
    // schema.org ignores an SVG logo and requires raster ≥112×112, so the graph
    // points at the PNG rendered from the repo's own monogram. If someone swaps
    // the asset, this assertion is where they must update the graph.
    expect(org['logo']).toBe(siteUrl(BRAND_ASSETS.logoSquare));
    expect(org['logo']).toMatch(/\.png$/);
  });

  it('still omits sameAs rather than inventing profile URLs', () => {
    const org = organisationJsonLd();
    // No social or directory profiles exist anywhere in this repository; an
    // invented URL would damage entity disambiguation. Pinned until real
    // profiles exist (runbook §Off-page).
    expect(org).not.toHaveProperty('sameAs');
  });

  it('exposes support and press contact points', () => {
    const points = organisationJsonLd()['contactPoint'] as Array<Record<string, unknown>>;
    const types = points.map((point) => point['contactType']);
    expect(types).toContain('customer support');
    expect(types).toContain('press');
    const support = points.find((point) => point['contactType'] === 'customer support');
    expect(support?.['email']).toBe(ORGANISATION_FACTS.email);
  });

  it('links the website node back to the organization node', () => {
    const site = webSiteJsonLd();
    const org = organisationJsonLd();
    expect(site['@type']).toBe('WebSite');
    expect(site['@id']).toBe(`${siteUrl('/')}#website`);
    expect(site['publisher']).toEqual({ '@id': org['@id'] });
    // No site-wide search exists, so no SearchAction is claimed.
    expect(site).not.toHaveProperty('potentialAction');
  });
});

describe('faq / breadcrumb / service / article JSON-LD', () => {
  it('maps Q&A pairs onto Question/Answer nodes', () => {
    const entries = [
      { q: 'What is included in every engagement?', a: 'A written scope.' },
      { q: 'How long does an engagement take?', a: 'About two weeks.' },
    ];
    const faq = faqJsonLd(entries);
    expect(faq?.['@type']).toBe('FAQPage');
    const entities = faq?.['mainEntity'] as Array<Record<string, unknown>>;
    const [first, second] = entries;
    expect(entities).toEqual([
      { '@type': 'Question', name: first?.q, acceptedAnswer: { '@type': 'Answer', text: first?.a } },
      { '@type': 'Question', name: second?.q, acceptedAnswer: { '@type': 'Answer', text: second?.a } },
    ]);
  });

  it('returns null for an empty FAQ rather than emitting an empty entity', () => {
    expect(faqJsonLd([])).toBeNull();
  });

  it('numbers breadcrumb positions from 1 and absolutises each item', () => {
    const crumbs = breadcrumbJsonLd([
      { name: 'VUNVAULT', path: '/' },
      { name: 'Services', path: '/services' },
    ]);
    const items = crumbs?.['itemListElement'] as Array<Record<string, unknown>>;
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ position: 1, item: siteUrl('/') });
    expect(items[1]).toMatchObject({ position: 2, item: siteUrl('/services') });
    expect(breadcrumbJsonLd([])).toBeNull();
  });

  it('builds a Service from the route table so copy cannot drift', () => {
    const route = findRoute('/services/penetration-testing');
    const service = serviceJsonLd('/services/penetration-testing');
    expect(service?.['@type']).toBe('Service');
    expect(service?.['name']).toBe(route?.title);
    expect(service?.['description']).toBe(route?.summary);
    expect(service?.['url']).toBe(siteUrl('/services/penetration-testing'));
    expect(service?.['provider']).toEqual({ '@id': organisationJsonLd()['@id'] });
  });

  it('returns null for a Service path that is not indexable', () => {
    expect(serviceJsonLd('/checkout')).toBeNull();
    expect(serviceJsonLd('/nope')).toBeNull();
  });

  it('points an Article at its own canonical page and drops a missing image', () => {
    const withImage = articleJsonLd({
      title: 'Unsigned callbacks',
      slug: 'unsigned-callbacks',
      publishedAt: '2026-01-04T09:00:00.000Z',
      excerpt: 'A payment callback with no signature.',
      authorName: 'VUNVAULT Research',
      featuredImageUrl: 'https://assets.vunvault.com/a.png',
    });
    expect(withImage['mainEntityOfPage']).toEqual({
      '@type': 'WebPage',
      '@id': siteUrl('/blog/unsigned-callbacks'),
    });
    expect(withImage['image']).toEqual(['https://assets.vunvault.com/a.png']);
    expect(withImage['publisher']).toEqual({ '@id': organisationJsonLd()['@id'] });

    const noImage = articleJsonLd({
      title: 'No image',
      slug: 'no-image',
      publishedAt: '2026-02-01T09:00:00.000Z',
      excerpt: null,
      authorName: 'VUNVAULT Research',
      featuredImageUrl: null,
    });
    // `undefined` fields must not survive serialisation as nulls.
    expect(JSON.parse(JSON.stringify(noImage))).not.toHaveProperty('image');
    expect(JSON.parse(JSON.stringify(noImage))).not.toHaveProperty('description');
  });
});

describe('serialiseJsonLd', () => {
  it('cannot be broken out of by content containing a closing script tag', () => {
    const hostile = { name: '</script><script>alert(1)</script>' };
    const html = serialiseJsonLd(hostile);
    expect(html).not.toContain('</script>');
    expect(html).toContain('\\u003c');
    // Still valid JSON, and still the same data.
    expect(JSON.parse(html)).toEqual(hostile);
  });

  it('round-trips ordinary structured data', () => {
    const data = organisationJsonLd();
    expect(JSON.parse(serialiseJsonLd(data))).toEqual(JSON.parse(JSON.stringify(data)));
  });
});
